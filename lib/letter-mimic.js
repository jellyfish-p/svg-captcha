'use strict';

const {inkNear, measureGlyph} = require('./png');
const random = require('./random');

// Anchors are near the real stroke, followed by positions along the missing
// stroke. Coordinates are relative to the undistorted outline's bounding box.
const recipes = new Map([
	['P', {anchor: [0.57, 0.60], points: [[0.63, 0.71], [0.90, 0.86], [1.17, 1.01]]}], // Diagonal leg of R
	['F', {anchor: [0.34, 0.89], points: [[0.53, 0.89], [0.78, 0.89], [1.03, 0.89]]}], // Bottom bar of E
	['C', {anchor: [0.90, 0.84], points: [[0.51, 0.55], [0.72, 0.55], [0.92, 0.55], [0.92, 0.74]]}] // Bar of G
]);

const rimWidth = 0.75;
const minimumRadius = 1.9;
const minimumRings = 3;
const gap = 0.45;

function distance(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function ring(center, radius, reverse = false) {
	const sides = 16;
	const commands = Array.from({length: sides}, (_, index) => {
		const angle = 2 * Math.PI * index / sides * (reverse ? -1 : 1);
		return {
			type: index ? 'L' : 'M',
			end: {x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle)}
		};
	});
	commands.push({type: 'Z'});
	return commands;
}

function ringPositions({char, index, project, glyph}, slot, width, height, nearNoise) {
	const {anchor, points} = recipes.get(char);
	const centers = points.map(([x, y]) => project(x, y));
	const glyphHeight = distance(project(0.5, 0), project(0.5, 1));
	const separations = centers.flatMap((point, i) => centers.slice(i + 1).map(other => distance(point, other)));
	const limit = Math.min(2.5, glyphHeight * 0.09, (Math.min(...separations) - gap) / 2);
	if (limit < minimumRadius || !measureGlyph(glyph.commands, width, height).visible) {
		return;
	}

	const nearGlyph = inkNear([glyph], width, height);
	if (!nearGlyph(project(...anchor), Math.max(2, glyphHeight * 0.09))) {
		return;
	}
	for (const radius of [limit, (limit + minimumRadius) / 2, minimumRadius]) {
		const margin = radius + gap;
		const holeRadius = radius - rimWidth;
		const run = [];
		for (const center of centers) {
			const inSlot = center.x >= index * slot + margin && center.x <= (index + 1) * slot - margin;
			const inFrame = center.y >= margin && center.y <= height - margin;
			if (inSlot && inFrame && !nearGlyph(center, margin) && !nearNoise(center, holeRadius)) {
				run.push(center);
			} else if (run.length < minimumRings) {
				run.length = 0;
			} else {
				break;
			}
		}
		if (run.length >= minimumRings) {
			return {centers: run, radius, holeRadius};
		}
	}
}

function letterMimicLayer(candidates, probability, {width, height, layers}, slot) {
	if (candidates.length === 0 || (probability < 1 && random.decimal(0, 1) >= probability)) {
		return;
	}
	let nearInterference;
	const nearNoise = (point, radius) => {
		nearInterference ??= inkNear(layers.filter(layer => !layer.fallback), width, height);
		return nearInterference(point, radius);
	};
	for (const candidate of random.shuffle(candidates)) {
		const positions = ringPositions(candidate, slot, width, height, nearNoise);
		if (positions) {
			const {centers, radius, holeRadius} = positions;
			return {
				commands: centers.flatMap(center => [...ring(center, radius), ...ring(center, holeRadius, true)]),
				color: candidate.glyph.color
			};
		}
	}
}

module.exports = {letterMimicLayer, hasRecipe: char => recipes.has(char)};
