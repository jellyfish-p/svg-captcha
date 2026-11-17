'use strict';

const random = require('./random');
const chToPath = require('./ch-to-path');
const {flatten} = require('./png');
const {ball} = require('./interference');
const {glyphCore, circleTouchesCore} = require('./balanced');

const maximumDotsPerGlyph = 24;
const maximumDots = 216;
const maximumDecoyRatio = 0.75;
const maximumDotRadius = 1.02;

function outlineDots(char, {shorter, mean}, slot, dotLimit, options) {
	const radiusScale = Math.min(1.25, Math.max(0.72, mean / 28));
	// Leave room for both bead rims and the outer antialiasing pixels.
	const heightLimit = maximumDecoyRatio * shorter - 2 * maximumDotRadius * radiusScale - 1.5;
	if (heightLimit <= 0) {
		return;
	}
	const commands = chToPath(char, 0, options.size, options, true, true);
	const contours = flatten(commands);
	const points = contours.flat();
	let left = Infinity;
	let right = -Infinity;
	let top = Infinity;
	let bottom = -Infinity;
	for (const {x, y} of points) {
		left = Math.min(left, x);
		right = Math.max(right, x);
		top = Math.min(top, y);
		bottom = Math.max(bottom, y);
	}

	const targetHeight = Math.min(mean * random.decimal(0.55, maximumDecoyRatio), heightLimit);
	const scale = Math.min(targetHeight / (bottom - top), slot * 0.73 / (right - left));
	const xMid = (left + right) / 2;
	const yMid = (top + bottom) / 2;
	const lengths = contours.map(contour => contour.map((a, index) => {
		const b = contour[(index + 1) % contour.length];
		return Math.hypot(b.x - a.x, b.y - a.y);
	}));
	const perimeters = lengths.map(edges => edges.reduce((total, length) => total + length, 0));
	const perimeter = perimeters.reduce((total, length) => total + length, 0);
	const spacing = Math.max(2.25, mean * 0.084);
	const stride = Math.max(spacing / scale, perimeter / dotLimit);
	const dots = [];

	for (const [index, contour] of contours.entries()) {
		const count = Math.floor(perimeters[index] / stride);
		if (count < 2) {
			continue;
		}
		let edge = 0;
		let start = 0;
		for (let dot = 0; dot < count; dot++) {
			const distance = (dot + 0.5) * perimeters[index] / count;
			while (start + lengths[index][edge] <= distance) {
				start += lengths[index][edge];
				edge++;
			}
			const a = contour[edge];
			const b = contour[(edge + 1) % contour.length];
			const ratio = (distance - start) / lengths[index][edge];
			const x = (a.x + (b.x - a.x) * ratio - xMid) * scale;
			const y = (a.y + (b.y - a.y) * ratio - yMid) * scale;
			const radius = radiusScale * random.decimal(0.60, maximumDotRadius);
			if (dots.every(other => Math.hypot(other.x - x, other.y - y) > other.radius + radius + 0.45)) {
				dots.push({x, y, radius});
			}
		}
	}
	return {dots, width: (right - left) * scale, height: (bottom - top) * scale};
}

function placeDots(shape, {left, right, middle}, above, cores, options) {
	const {width, height} = options;
	const slot = width / cores.length;
	const border = above ? Math.min(left.top, right.top) : Math.max(left.bottom, right.bottom);
	const xMargin = shape.width / 2 + 2.5;
	const yMargin = shape.height / 2 + 2.5;
	let best = [];
	for (let attempt = 0; attempt < 6; attempt++) {
		const targetX = middle + slot * random.decimal(-0.21, 0.21);
		const targetY = border + shape.height * (above ? -1 : 1) * random.decimal(0.12, 0.43);
		const x = Math.max(xMargin, Math.min(width - xMargin, targetX));
		const y = Math.max(yMargin, Math.min(height - yMargin, targetY));
		const placed = shape.dots
			.map(dot => ({x: x + dot.x, y: y + dot.y, radius: dot.radius}))
			.filter(dot => !cores.some(core => circleTouchesCore(dot, dot.radius + 0.25, core)));
		if (placed.length > best.length) {
			best = placed;
		}
		if (placed.length === shape.dots.length) {
			break;
		}
	}
	return best.length >= Math.max(6, Math.ceil(shape.dots.length * 0.70)) ? best : [];
}

function pickGaps(length, density) {
	if (length === 1) {
		return [0];
	}
	const first = density === 2 ? 0 : 1;
	const available = density === 2 ? length + 1 : length - 1;
	const count = density === 2 ? Math.min(12, length) : Math.min(7, Math.floor(length / 2));
	const gaps = Array.from({length: available}, (_, index) => index + first);
	return random.shuffle(gaps).slice(0, count);
}

// These groups are hypotheses about shared contours in the bundled font.
const similarGlyphs = ['27', '38', '4AH', '5689', 'CD', 'EF', 'HMNW', 'JL', 'KXR', 'P9R', '7TY', 'VWXY'];

function decoyCandidates(left, right, alphabet) {
	const different = alphabet.filter(char => char !== left && char !== right);
	const groups = similarGlyphs.filter(group => group.includes(left) || group.includes(right));
	const similar = different.filter(char => groups.some(group => group.includes(char)));
	return similar.length > 0 ? similar : different;
}

module.exports = function beadedLayer(glyphs, chars, alphabet, options, ink) {
	const cores = glyphs.map(glyph => glyphCore(glyph.commands));
	const gaps = pickGaps(chars.length, options.interferenceDensity);
	const upperFirst = random.int(0, 1);
	const slot = options.width / glyphs.length;
	const commands = [];
	let remainingDots = maximumDots;
	for (const [index, gap] of gaps.entries()) {
		if (remainingDots < 6) {
			break;
		}
		const left = Math.max(0, gap - 1);
		const right = Math.min(gap, chars.length - 1);
		const candidates = decoyCandidates(chars[left], chars[right], alphabet);
		if (candidates.length === 0) {
			continue;
		}
		const char = candidates[random.int(0, candidates.length - 1)];
		const leftHeight = glyphs[left].inkHeight;
		const rightHeight = glyphs[right].inkHeight;
		const heights = {shorter: Math.min(leftHeight, rightHeight), mean: (leftHeight + rightHeight) / 2};
		const shape = outlineDots(char, heights, slot, Math.min(maximumDotsPerGlyph, remainingDots), options);
		if (!shape) {
			continue;
		}
		const neighbors = {left: cores[left], right: cores[right], middle: chars.length === 1 ? slot / 2 : gap * slot};
		const dots = placeDots(shape, neighbors, index % 2 === upperFirst, cores, options);
		for (const dot of dots) {
			ball(commands, dot, dot.radius, options, false);
		}
		remainingDots -= dots.length;
	}
	return commands.length > 0 ? {commands, color: ink} : undefined;
};
