'use strict';

// Evaluation tooling only. The external SVG renderer is supplied by path and
// is not a dependency of svg-captcha or of its production PNG renderer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function digest(value) {
	return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filename, value) {
	fs.mkdirSync(path.dirname(filename), {recursive: true});
	fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}

function sourceDigest(directory) {
	const files = ['index.js', ...fs.readdirSync(path.join(directory, 'lib')).filter(name => name.endsWith('.js')).sort().map(name => 'lib/' + name)];
	return digest(files.map(file => file + '\n' + fs.readFileSync(path.join(directory, file), 'utf8')).join('\n'));
}

function generate(args) {
	const [baselineDirectory, rendererModule, blindDirectory, privateManifest, countString = '24'] = args.map((value, index) => index < 4 ? path.resolve(value) : value);
	const count = Number(countString);
	if (!Number.isInteger(count) || count < 1 || count > 1000) {
		throw new RangeError('Sample count must be an integer from 1 to 1000');
	}
	if (fs.existsSync(privateManifest) || fs.existsSync(blindDirectory)) {
		throw new Error('Use new output paths to preserve earlier evaluation evidence');
	}
	if (privateManifest.toLowerCase() === blindDirectory.toLowerCase() ||
		privateManifest.toLowerCase().startsWith(blindDirectory.toLowerCase() + path.sep)) {
		throw new Error('Answer manifest must be outside the blind image directory');
	}
	const baseline = require(baselineDirectory);
	const currentDirectory = path.resolve(__dirname, '..');
	const current = require(currentDirectory);
	const {Resvg} = require(rendererModule);
	const options = {size: 6, width: 210, height: 68, fontSize: 52, noise: 3, charPreset: '23456789ACDEFHJKLMNPRTVWXY'};
	const samples = [];
	for (let index = 0; index < count; index++) {
		const control = baseline.create(options);
		samples.push({group: 'original-svg-rasterized', text: control.text, bytes: new Resvg(control.data, {background: '#ffffff'}).render().asPng()});
		const strong = current.createStrong(options);
		if (!Buffer.isBuffer(strong.data)) {
			throw new TypeError('createStrong must return a PNG Buffer');
		}
		samples.push({group: 'strong-png', text: strong.text, bytes: strong.data});
	}
	for (let index = samples.length - 1; index > 0; index--) {
		const other = crypto.randomInt(index + 1);
		[samples[index], samples[other]] = [samples[other], samples[index]];
	}
	fs.mkdirSync(blindDirectory, {recursive: true});
	const manifest = samples.map((sample, index) => {
		const id = 's' + String(index + 1).padStart(3, '0');
		fs.writeFileSync(path.join(blindDirectory, id + '.png'), sample.bytes);
		return {id, group: sample.group, text: sample.text, sha256: digest(sample.bytes)};
	});
	writeJson(privateManifest, {
		createdAt: new Date().toISOString(),
		baselineSourceSha256: sourceDigest(baselineDirectory),
		strongSourceSha256: sourceDigest(currentDirectory),
		options,
		samples: manifest
	});
	writeJson(path.join(blindDirectory, 'images.json'), manifest.map(({id, sha256}) => ({id, sha256})));
	console.log(JSON.stringify({samples: manifest.length, blindDirectory, privateManifest, strongSourceSha256: sourceDigest(currentDirectory)}));
}

function wilson(successes, total) {
	const z = 1.959963984540054;
	const rate = successes / total;
	const denominator = 1 + z * z / total;
	const center = (rate + z * z / (2 * total)) / denominator;
	const margin = z * Math.sqrt(rate * (1 - rate) / total + z * z / (4 * total * total)) / denominator;
	return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function score(args) {
	const [manifestFilename, outputFilename, ...predictionFilenames] = args;
	if (predictionFilenames.length === 0) {
		throw new Error('At least one model prediction file is required');
	}
	const manifest = JSON.parse(fs.readFileSync(manifestFilename, 'utf8'));
	const knownIds = new Set(manifest.samples.map(sample => sample.id));
	const models = predictionFilenames.map(filename => {
		const prediction = JSON.parse(fs.readFileSync(filename, 'utf8'));
		const rows = prediction.predictions;
		if (!Array.isArray(rows)) {
			throw new TypeError(filename + ': predictions must be an array');
		}
		const byId = new Map();
		for (const row of rows) {
			if (!knownIds.has(row.id) || byId.has(row.id) || typeof row.text !== 'string') {
				throw new Error(filename + ': unknown/duplicate sample ID or invalid transcription');
			}
			byId.set(row.id, row.text.trim().toUpperCase());
		}
		if (byId.size !== manifest.samples.length) {
			throw new Error(filename + ': every sample must have a prediction (use ? for unreadable)');
		}
		const results = manifest.samples.map(sample => {
			const guess = byId.get(sample.id);
			return {...sample, guess, exact: guess === sample.text, matchingPositions: Array.from(sample.text).filter((character, index) => guess[index] === character).length};
		});
		const groups = [...new Set(manifest.samples.map(sample => sample.group))].map(group => {
			const selected = results.filter(sample => sample.group === group);
			const exact = selected.filter(sample => sample.exact).length;
			const characters = selected.reduce((sum, sample) => sum + sample.text.length, 0);
			const matchingPositions = selected.reduce((sum, sample) => sum + sample.matchingPositions, 0);
			return {group, exact, total: selected.length, exactRate: exact / selected.length, exactRateWilson95: wilson(exact, selected.length), matchingPositions, characters, positionAccuracy: matchingPositions / characters};
		});
		return {model: prediction.model, reasoningEffort: prediction.reasoningEffort || 'inherited/default', predictionsSha256: digest(fs.readFileSync(filename)), groups, results};
	});
	writeJson(outputFilename, {
		createdAt: new Date().toISOString(),
		manifest,
		method: 'Same shuffled images; separate agents with no answer manifest; visual transcription only; no feedback or retries. Exact whole-answer accuracy at the specified sample length, trim and uppercase only. Shared filesystem is instruction-blinded, not access-isolated. Confidence intervals describe these samples, not a security guarantee.',
		models
	});
	console.log(JSON.stringify(models.map(({model, groups}) => ({model, groups})), null, 2));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'generate' && args.length >= 4) {
	generate(args);
} else if (command === 'score' && args.length >= 3) {
	score(args);
} else {
	console.error('Usage: node scripts/vision-benchmark.js generate BASELINE_DIR RESVG_MODULE BLIND_DIR PRIVATE_MANIFEST [COUNT_PER_GROUP]\n       node scripts/vision-benchmark.js score MANIFEST OUTPUT PREDICTIONS...');
	process.exitCode = 1;
}
