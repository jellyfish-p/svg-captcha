'use strict';

const {projectGlyph} = require('./geometry');
const {between, shuffle} = require('./random');

const margin = 14;
const gap = 11;
const minSize = 54;
const maxSize = 90;
const positionAttempts = 80;
const sceneAttempts = 6;

function overlaps(a, b) {
	return a.left < b.right + gap && a.right + gap > b.left &&
		a.top < b.bottom + gap && a.bottom + gap > b.top;
}

function placeObjects(width, height, objects) {
	const bandWidth = (maxSize - minSize) / objects.length;
	// Sample one size per band and shuffle independently of placement order.
	const sizes = shuffle(objects.map((_, i) => minSize + bandWidth * between(i, i + 1)));
	const placements = [];
	const boxes = [];
	for (const [i, object] of shuffle([...objects]).entries()) {
		const geometry = projectGlyph(object.letter, object.direction, sizes[i]);
		const {left, right, top, bottom} = geometry.bounds;
		const minX = margin - left;
		const maxX = width - margin - right;
		const minY = margin - top;
		const maxY = height - margin - bottom;
		if (minX > maxX || minY > maxY) {
			return null;
		}
		for (let attempt = 0; attempt < positionAttempts; attempt++) {
			const x = between(minX, maxX);
			const y = between(minY, maxY);
			const box = {left: x + left, right: x + right, top: y + top, bottom: y + bottom};
			if (!boxes.some(other => overlaps(box, other))) {
				boxes.push(box);
				placements.push({object, geometry, x, y});
				break;
			}
		}
		if (placements.at(-1)?.object !== object) {
			return null;
		}
	}
	return shuffle(placements);
}

function layout(width, height, {targets, distractors, reference, fillers}) {
	const required = reference ? [...targets, ...distractors, reference] : [...targets, ...distractors];
	for (let count = fillers.length; count >= Math.max(0, 7 - required.length); count--) {
		const objects = [...required, ...fillers.slice(0, count)];
		for (let attempt = 0; attempt < sceneAttempts; attempt++) {
			const placements = placeObjects(width, height, objects);
			if (placements) {
				return placements;
			}
		}
	}
	throw new Error('Unable to lay out the Letter3d scene');
}

module.exports = {layout};
