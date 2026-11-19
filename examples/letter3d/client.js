'use strict';

const selection = document.querySelector('#selection');
const noColor = document.querySelector('#no-color');
const newChallenge = document.querySelector('#new-challenge');
const instructions = document.querySelector('#instructions');
const mode = document.querySelector('#mode');
const prompt = document.querySelector('#prompt');
const board = document.querySelector('#board');
const image = document.querySelector('#challenge-image');
const marks = document.querySelector('#marks');
const cursor = document.querySelector('#cursor');
const actions = document.querySelector('#actions');
const count = document.querySelector('#mark-count');
const undo = document.querySelector('#undo');
const submit = document.querySelector('#submit');
const result = document.querySelector('#result');

let challenge;
let points = [];
let position;
let pointer;
let busy = false;

async function post(path, body) {
	const response = await fetch(path, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(body)
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error);
	return data;
}

function moveElement(element, {x, y}) {
	element.style.left = `${x * 100}%`;
	element.style.top = `${y * 100}%`;
}

function updateControls() {
	const active = Boolean(challenge && !busy);
	newChallenge.setAttribute('aria-disabled', String(busy));
	selection.disabled = busy;
	noColor.disabled = busy;
	board.tabIndex = active ? 0 : -1;
	board.setAttribute('aria-disabled', String(!active));
	undo.disabled = !active || points.length === 0;
	submit.disabled = !active || points.length === 0;
}

function renderMarks() {
	marks.replaceChildren(...points.map(point => {
		const mark = document.createElement('span');
		mark.className = 'mark';
		moveElement(mark, point);
		return mark;
	}));
	count.textContent = `已选 ${points.length} 处`;
	updateControls();
}

function place(point) {
	if (challenge.selection === 'single') points = [point];
	else points.push(point);
	moveElement(cursor, point);
	position = point;
	renderMarks();
}

async function loadChallenge() {
	if (busy) return;
	const previousFocus = document.activeElement;
	const options = {selection: selection.value, useColor: !noColor.checked};
	challenge = undefined;
	points = [];
	pointer = undefined;
	busy = true;
	board.hidden = instructions.hidden = actions.hidden = true;
	result.textContent = '正在生成题图…';
	renderMarks();
	try {
		const next = await post('/challenge', options);
		image.width = next.width;
		image.height = next.height;
		image.src = `data:image/png;base64,${next.data}`;
		await image.decode();
		challenge = {id: next.id, selection: next.selection, width: next.width, height: next.height};
		position = {x: pixelStep(0.5, 0, next.width), y: pixelStep(0.5, 0, next.height)};
		moveElement(cursor, position);
		mode.textContent = next.selection === 'single' ? '单选' : '多选';
		prompt.textContent = next.prompt;
		board.hidden = instructions.hidden = actions.hidden = false;
		result.textContent = '';
	} catch (error) {
		result.textContent = error.message || '无法加载题图，请换一张。';
	} finally {
		busy = false;
		updateControls();
		if (document.activeElement === document.body && (previousFocus === selection || previousFocus === noColor)) {
			previousFocus.focus();
		}
	}
}

function pixelStep(value, delta, size) {
	const pixel = Math.min(size - 1, Math.max(0, Math.floor(value * size) + delta));
	return (pixel + 0.5) / size;
}

async function submitAnswer() {
	if (!challenge || busy || points.length === 0) return;
	const id = challenge.id;
	challenge = undefined;
	busy = true;
	result.textContent = '正在验证…';
	updateControls();
	try {
		const {ok} = await post('/demo-action', {id, points});
		result.textContent = ok ? '验证通过。' : '验证未通过，请换一张图。';
	} catch (error) {
		result.textContent = error.message || '验证请求失败，请换一张图。';
	} finally {
		busy = false;
		updateControls();
		if (document.activeElement === document.body) newChallenge.focus();
	}
}

function reachedDragDistance(event) {
	return Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6;
}

board.addEventListener('pointerdown', event => {
	if (!challenge || busy || pointer || !event.isPrimary || event.button !== 0) return;
	pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false};
	board.setPointerCapture(event.pointerId);
});

board.addEventListener('pointermove', event => {
	if (pointer?.id === event.pointerId && reachedDragDistance(event)) pointer.dragged = true;
});

board.addEventListener('lostpointercapture', event => {
	if (pointer?.id === event.pointerId) pointer = undefined;
});

board.addEventListener('pointerup', event => {
	if (pointer?.id !== event.pointerId) return;
	const dragged = pointer.dragged || reachedDragDistance(event);
	pointer = undefined;
	if (!challenge || busy || dragged) return;
	// The image fills this borderless board without letterboxing. Overlays share its rectangle.
	const rect = image.getBoundingClientRect();
	const x = (event.clientX - rect.left) / rect.width;
	const y = (event.clientY - rect.top) / rect.height;
	if (x >= 0 && x < 1 && y >= 0 && y < 1) {
		board.focus({preventScroll: true});
		place({x, y});
	}
});

const arrow = new Map([
	['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]],
	['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]]
]);

board.addEventListener('keydown', event => {
	if (!challenge || busy || event.altKey || event.ctrlKey || event.metaKey) return;
	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		if (!event.repeat) place(position);
		return;
	}
	const direction = arrow.get(event.key);
	if (!direction) return;
	event.preventDefault();
	const step = event.shiftKey ? 12 : 1;
	position = {
		x: direction[0] ? pixelStep(position.x, direction[0] * step, challenge.width) : position.x,
		y: direction[1] ? pixelStep(position.y, direction[1] * step, challenge.height) : position.y
	};
	moveElement(cursor, position);
});

undo.addEventListener('click', () => {
	points.pop();
	renderMarks();
	if (undo.disabled) board.focus();
});
newChallenge.addEventListener('click', loadChallenge);
selection.addEventListener('change', loadChallenge);
noColor.addEventListener('change', loadChallenge);
submit.addEventListener('click', submitAnswer);
loadChallenge();
