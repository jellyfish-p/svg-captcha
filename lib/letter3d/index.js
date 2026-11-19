'use strict';

const {normalize, generatePuzzle, validatePuzzle, promptFor} = require('./rules');
const {layout} = require('./layout');
const {rasterize} = require('./raster');
const encodePng = require('../encode-png');

const canvasWidth = 480;
const canvasHeight = 360;

function create(options) {
	const puzzle = generatePuzzle(normalize(options));
	const {selection} = puzzle;
	const width = canvasWidth;
	const height = canvasHeight;
	const placements = layout(width, height, puzzle);
	const targetIds = validatePuzzle(puzzle, placements.map(({object}) => object));
	const {scanlines, objectAtPixel} = rasterize(width, height, placements);
	const data = encodePng(width, height, scanlines);
	return {
		challenge: {data, prompt: promptFor(puzzle), selection, width, height},
		solution: {width, height, objectAtPixel, targetIds, selection}
	};
}

function verify(solution, points) {
	if (!solution || !Array.isArray(points)) {
		return false;
	}
	const {width, height, objectAtPixel, targetIds, selection} = solution;
	if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
		!(objectAtPixel instanceof Uint8Array) || objectAtPixel.length !== width * height ||
		!Array.isArray(targetIds) || points.length !== targetIds.length ||
		!(selection === 'single' ? points.length === 1 : selection === 'multiple' && [2, 3].includes(points.length))) {
		return false;
	}
	const remaining = new Set(targetIds);
	if (remaining.size !== points.length || !targetIds.every(id => Number.isInteger(id) && id > 0 && id <= 255)) {
		return false;
	}
	for (const point of points) {
		if (point === null || typeof point !== 'object' || Array.isArray(point)) {
			return false;
		}
		const {x, y} = point;
		if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= 1 || y < 0 || y >= 1) {
			return false;
		}
		const px = Math.floor(x * width);
		const py = Math.floor(y * height);
		if (!remaining.delete(objectAtPixel[py * width + px])) {
			return false;
		}
	}
	return remaining.size === 0;
}

module.exports = {create, verify};
