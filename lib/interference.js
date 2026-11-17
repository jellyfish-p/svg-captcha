'use strict';

const random = require('./random');

// Open polylines make smaller, incomplete glyph-like forms in the margins.
const decoyPaths = [
	[[-0.5, 0.45], [-0.5, -0.45], [0.05, -0.45], [0.32, -0.1], [-0.45, -0.05]],
	[[-0.5, 0.48], [-0.35, -0.48], [0.15, 0.28], [0.48, -0.41]],
	[[-0.48, -0.37], [0.43, -0.43], [-0.34, 0.41], [0.48, 0.38]],
	[[-0.45, -0.4], [-0.34, 0.23], [-0.06, 0.44], [0.32, 0.37], [0.46, -0.2]],
	[[0.43, -0.48], [-0.37, -0.41], [-0.41, 0.46], [0.36, 0.42]]
];

function clamp(value, min, max) {
	return Math.max(min, Math.min(value, max));
}

function fitBall(center, radius, {width, height}) {
	return {
		x: clamp(center.x, radius + 1, width - radius - 1),
		y: clamp(center.y, radius + 1, height - radius - 1)
	};
}

function ball(commands, center, radius, bounds, hollow) {
	const sides = 12;
	const angle = random.decimal(0, 2 * Math.PI);
	const ratio = random.decimal(0.75, 1);
	const {x, y} = fitBall(center, radius, bounds);
	const rim = Array.from({length: sides}, (_, index) => {
		const direction = angle + index * 2 * Math.PI / sides;
		const length = radius * random.decimal(0.85, 1);
		return {x: length * Math.cos(direction), y: ratio * length * Math.sin(direction)};
	});

	function contour(points, scale) {
		for (const [index, point] of points.entries()) {
			commands.push({
				type: index === 0 ? 'M' : 'L',
				end: {x: x + point.x * scale, y: y + point.y * scale}
			});
		}
		commands.push({type: 'Z'});
	}

	contour(rim, 1);
	if (hollow) {
		// Opposite winding preserves the center of the ring.
		contour(rim.reverse(), random.decimal(0.64, 0.78));
	}
}

function scatter(commands, glyphs, bounds, unit, hollow, count, markGap = true) {
	const slot = bounds.width / glyphs.length;
	for (const [index, glyph] of glyphs.entries()) {
		const endpoints = glyph.commands.filter(command => command.end);
		for (let n = 0; n < count; n++) {
			const anchor = endpoints[random.int(0, endpoints.length - 1)].end;
			const center = {
				x: anchor.x + unit * random.decimal(-6, 6),
				y: anchor.y + unit * random.decimal(-6, 6)
			};
			const radius = unit * (hollow ? random.decimal(2.1, 5.6) : random.decimal(0.75, 2.55));
			ball(commands, center, radius, bounds, hollow);
		}

		if (markGap) {
			// Place some ink outside the glyph contours to interrupt the gaps.
			const gap = index === glyphs.length - 1 ? bounds.width - 0.23 * slot : (index + 1) * slot;
			const center = {x: gap + unit * random.decimal(-3, 3), y: bounds.height * random.decimal(0.22, 0.78)};
			ball(commands, center, unit * random.decimal(1.35, 2.6), bounds, hollow);
		}
	}
}

function decoys(commands, glyphCount, bounds, unit) {
	const slot = bounds.width / glyphCount;
	for (let i = 0; i < glyphCount; i++) {
		const centerX = Math.min(bounds.width - slot * 0.35, (i + 0.88) * slot);
		const centerY = bounds.height * (i % 2 ? random.decimal(0.52, 0.69) : random.decimal(0.31, 0.48));
		const path = decoyPaths[random.int(0, decoyPaths.length - 1)];
		const size = unit * random.decimal(14, 22);
		for (let segment = 1; segment < path.length; segment++) {
			const [ax, ay] = path[segment - 1];
			const [bx, by] = path[segment];
			const steps = Math.max(1, Math.ceil(size * Math.hypot(bx - ax, by - ay) / (4.5 * unit)));
			for (let step = 0; step < steps; step++) {
				const ratio = step / steps;
				const center = {
					x: centerX + size * (ax + (bx - ax) * ratio) + unit * random.decimal(-0.85, 0.85),
					y: centerY + size * (ay + (by - ay) * ratio) + unit * random.decimal(-0.85, 0.85)
				};
				ball(commands, center, unit * random.decimal(0.85, 1.75), bounds, false);
			}
		}
	}
}

function ornamentUnit({width, height}, glyphCount) {
	return Math.min(1.45, width / (35 * glyphCount), height / 68);
}

module.exports = function ornaments(glyphs, bounds, color) {
	const {interference, interferenceDensity} = bounds;
	const commands = [];
	const unit = ornamentUnit(bounds, glyphs.length);
	switch (interference) {
		case 'beads':
			scatter(commands, glyphs, bounds, unit, false, 5);
			break;
		case 'rings':
			scatter(commands, glyphs, bounds, unit, true, 3);
			break;
		case 'mixed':
			scatter(commands, glyphs, bounds, unit, true, interferenceDensity === 2 ? 4 : 3);
			if (interferenceDensity === 2) {
				scatter(commands, glyphs, bounds, unit, false, 1, false);
			}
			break;
		case 'decoy':
			decoys(commands, glyphs.length, bounds, unit);
			break;
		default:
			return [];
	}
	return [{commands, color, opacity: interference === 'decoy' ? 0.84 : 0.92}];
};

module.exports.minimumGlyphHeight = function (options) {
	const unit = ornamentUnit(options, options.size);
	switch (options.interference) {
		case 'none':
			return 0;
		case 'rings':
		case 'mixed':
		case 'balanced':
		case 'beaded':
			return Math.max(12, 20 * unit);
		case 'decoy':
			return Math.max(12, 23 * unit);
		default:
			return 12;
	}
};

module.exports.ball = ball;
module.exports.fitBall = fitBall;
module.exports.ornamentUnit = ornamentUnit;
