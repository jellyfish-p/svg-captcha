'use strict';

const random = require('./random');
const {outline} = require('./option-manager');

function glyphStyle(strong) {
	return {
		angle: random.decimal(-1, 1) * (strong ? 0.22 : 0.045),
		stretchX: random.decimal(0.92, 1.08),
		stretchY: random.decimal(0.87, 1.12),
		shear: strong ? random.decimal(-0.19, 0.19) : 0,
		phaseX: random.decimal(0, 2 * Math.PI),
		phaseY: random.decimal(0, 2 * Math.PI),
		warp: strong ? random.decimal(0.022, 0.055) : 0
	};
}

const alignedStyle = {
	angle: 0, stretchX: 1, stretchY: 1, shear: 0, phaseX: 0, phaseY: 0, warp: 0
};

function placeGlyph(char, index, length, options, strong, aligned = false) {
	const glyph = outline(char);
	const {angle, stretchX, stretchY, shear, phaseX, phaseY, warp} =
		aligned ? alignedStyle : glyphStyle(strong);
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);
	const slot = options.width / length;
	const shiftX = aligned ? 0.5 : Math.min(2.5, slot * 0.07) * (strong ? 1 : 0.25);
	const shiftY = (strong ? 6 : 1.5) * Math.min(1, options.height / 50);
	const gap = Math.min(1.5, slot * 0.08);
	const padding = Math.min(3, options.height * 0.1);
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	const points = [];

	function distort(x, y) {
		const centeredX = x - glyph.x;
		const centeredY = y - glyph.y;
		const warpedX = stretchX * centeredX + shear * centeredY +
			warp * Math.sin(9 * centeredY + phaseX);
		const warpedY = stretchY * centeredY + warp * Math.sin(8 * centeredX + phaseY);
		return {
			x: cosine * warpedX - sine * warpedY,
			y: sine * warpedX + cosine * warpedY
		};
	}

	function collect(x, y) {
		const point = distort(x, y);
		minX = Math.min(point.x, minX);
		maxX = Math.max(point.x, maxX);
		minY = Math.min(point.y, minY);
		maxY = Math.max(point.y, maxY);
		points.push(point);
		return point;
	}

	const commands = glyph.commands.map(({type, x, y, x1, y1, x2, y2}) => {
		const command = {type};
		if (type !== 'Z') {
			command.end = collect(x, y);
		}
		if (type === 'Q' || type === 'C') {
			command.control1 = collect(x1, y1);
		}
		if (type === 'C') {
			command.control2 = collect(x2, y2);
		}
		return command;
	});

	// A Bezier curve stays within the convex hull of its control points.
	// Fit against those points after distortion so the entire outline fits.
	const fitX = (slot - 2 * (gap + shiftX)) / (maxX - minX);
	const fitY = (options.height - 2 * padding) / (maxY - minY);
	const scaleX = Math.min(options.fontSize, fitX, fitY);
	const scaleY = strong ? Math.min(options.fontSize, fitY, scaleX * 1.28) : scaleX;
	const slotCenter = slot * (index + 0.5);
	// Pixel-aligned centers have the same subpixel coverage in every slot.
	const x = aligned ? Math.floor(slotCenter) + 0.5 : slotCenter + random.decimal(-shiftX, shiftX);
	const targetY = options.height / 2 + (glyph.y + glyph.baseline) * scaleY +
		(aligned ? 0 : random.decimal(-shiftY, shiftY));
	const yRadius = (maxY - minY) * scaleY / 2;
	const y = Math.max(padding + yRadius, Math.min(options.height - padding - yRadius, targetY));
	const originX = (minX + maxX) / 2;
	const originY = (minY + maxY) / 2;

	for (const point of points) {
		point.x = x + (point.x - originX) * scaleX;
		point.y = y + (point.y - originY) * scaleY;
	}

	const {x1, y1, x2, y2} = glyph.bounds;
	function project(column, row) {
		const point = distort(x1 + (x2 - x1) * column, y1 + (y2 - y1) * row);
		return {x: x + (point.x - originX) * scaleX, y: y + (point.y - originY) * scaleY};
	}
	return {commands, project};
}

module.exports = function (...args) {
	return placeGlyph(...args).commands;
};

module.exports.placeGlyph = placeGlyph;
