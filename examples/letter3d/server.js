'use strict';

const {randomBytes} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {createServer} = require('node:http');
const {join} = require('node:path');
const letter3d = require('../../letter3d');

const host = '127.0.0.1';
const challengePath = '/challenge';
const actionPath = '/demo-action';
const challengeLifetime = 2 * 60_000;
const maxChallenges = 32;
const maxBodyBytes = 4096;
const challenges = new Map();
const limits = new Map([
	[challengePath, {limit: 30, minute: -1, requests: 0}],
	[actionPath, {limit: 60, minute: -1, requests: 0}]
]);
const page = readFileSync(join(__dirname, 'index.html'), 'utf8')
	.replace('<!-- alternative-verification -->', alternativeVerification);
const assets = new Map([
	['/', {type: 'text/html; charset=utf-8', data: page}],
	['/client.js', {type: 'text/javascript; charset=utf-8', data: readFileSync(join(__dirname, 'client.js'))}],
	['/style.css', {type: 'text/css; charset=utf-8', data: readFileSync(join(__dirname, 'style.css'))}]
]);

function alternativeVerification() {
	const configured = process.env.LETTER3D_ALTERNATIVE_URL?.trim();
	if (!configured) return '此示例使用图像验证。实际接入时，请同时提供非视觉验证方式。';
	const url = /^https?:\/\//i.test(configured) && URL.canParse(configured) ? new URL(configured) : null;
	if (!url || url.username || url.password) {
		throw new Error('LETTER3D_ALTERNATIVE_URL must be an absolute HTTP(S) URL without credentials.');
	}
	const href = url.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	return `<a href="${href}" rel="noreferrer">使用非视觉验证</a>`;
}

function json(response, status, body) {
	response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
	response.end(JSON.stringify(body));
}

function allowRequest(bucket) {
	const minute = Math.floor(Date.now() / 60_000);
	if (bucket.minute !== minute) {
		bucket.minute = minute;
		bucket.requests = 0;
	}
	if (bucket.requests >= bucket.limit) return false;
	bucket.requests++;
	return true;
}

async function readBody(request, response) {
	const type = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
	if (type !== 'application/json') {
		json(response, 415, {error: '请发送 JSON。'});
		return;
	}
	let size = 0;
	const chunks = [];
	for await (const chunk of request.iterator({destroyOnReturn: false})) {
		size += chunk.length;
		if (size > maxBodyBytes) {
			response.setHeader('Connection', 'close');
			json(response, 413, {error: '请求过大，请换一张图。'});
			return;
		}
		chunks.push(chunk);
	}
	try {
		const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
		if (body && typeof body === 'object' && !Array.isArray(body)) return body;
	} catch (error) {
		if (!(error instanceof SyntaxError)) throw error;
	}
	json(response, 400, {error: '请求格式错误。'});
}

function randomId() {
	return randomBytes(24).toString('hex');
}

function getSession(request) {
	return /(?:^|;\s*)letter3d_session=([a-f0-9]{48})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
}

function removeExpiredChallenges() {
	const now = Date.now();
	for (const [session, entry] of challenges) {
		if (entry.expiresAt <= now) challenges.delete(session);
	}
}

function issue(request, response, {selection, useColor}) {
	if (!['single', 'multiple', 'mixed'].includes(selection) || typeof useColor !== 'boolean') {
		json(response, 400, {error: '请选择作答方式和配色。'});
		return;
	}
	removeExpiredChallenges();
	const previousSession = getSession(request);
	const session = challenges.has(previousSession) ? previousSession : randomId();
	challenges.delete(session);
	const {challenge, solution} = letter3d.create({selection, useColor});
	if (challenges.size >= maxChallenges) challenges.delete(challenges.keys().next().value);
	const id = randomId();
	challenges.set(session, {id, action: actionPath, solution, expiresAt: Date.now() + challengeLifetime});
	response.setHeader('Set-Cookie', `letter3d_session=${session}; HttpOnly; SameSite=Strict; Path=/`);
	const {data, selection: actualSelection, prompt, width, height} = challenge;
	json(response, 200, {id, selection: actualSelection, prompt, width, height, data: data.toString('base64')});
}

function performDemoAction(request, response, {id, points}) {
	removeExpiredChallenges();
	const session = getSession(request);
	const entry = challenges.get(session);
	if (!entry || entry.id !== id || entry.action !== actionPath) {
		json(response, 409, {error: '这道题已失效，请换一张图。'});
		return;
	}
	// Consume the bound challenge before checking the answer, even when the points are invalid.
	challenges.delete(session);
	json(response, 200, {ok: letter3d.verify(entry.solution, points)});
}

async function handleRequest(request, response) {
	const authority = `${host}:${server.address().port}`;
	const origin = request.headers.origin;
	response.setHeader('Cache-Control', 'private, no-store');
	response.setHeader('X-Content-Type-Options', 'nosniff');
	response.setHeader('Content-Security-Policy',
		"default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
	if (request.headers.host !== authority || (origin && origin !== `http://${authority}`)) {
		json(response, 403, {error: '请从本地示例页面发起请求。'});
		return;
	}
	const asset = assets.get(request.url);
	if (request.method === 'GET' && asset) {
		response.writeHead(200, {'Content-Type': asset.type});
		response.end(asset.data);
		return;
	}
	const bucket = limits.get(request.url);
	if (request.method !== 'POST' || !bucket) {
		json(response, 404, {error: '找不到该页面。'});
		return;
	}
	if (!allowRequest(bucket)) {
		json(response, 429, {error: '操作太频繁，请稍后再试。'});
		return;
	}
	const body = await readBody(request, response);
	if (!body) return;
	if (request.url === challengePath) issue(request, response, body);
	else performDemoAction(request, response, body);
}

const server = createServer({requestTimeout: 10_000, headersTimeout: 10_000}, (request, response) => {
	handleRequest(request, response).catch(error => {
		if (response.destroyed) return;
		console.error(error);
		json(response, 500, {error: '示例服务出错，请再试一次。'});
	});
});

server.listen(Number(process.env.PORT ?? 3000), host, () => {
	console.log(`3D letter CAPTCHA demo at http://${host}:${server.address().port}`);
});
