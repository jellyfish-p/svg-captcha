'use strict';

const {rgb} = require('./color');
const encodePng = require('./encode-png');

// The downsampler below averages this fixed 2-by-2 sample grid.
const samples = 2;
const minimumGlyphCoverage = 2 * samples * samples;

function flatten(commands) {
	const contours = [];
	let points;
	let start;

	for (const {type, control1, control2, end} of commands) {
		if (type === 'M') {
			points = [end];
			contours.push(points);
		} else if (type === 'L') {
			points.push(end);
		} else if (type === 'Q' || type === 'C') {
			// Subdivide according to control polygon length. The square root
			// keeps the geometric approximation finer than a sample pixel.
			const controls = control2 ? [start, control1, control2, end] : [start, control1, end];
			let length = 0;
			for (let i = 1; i < controls.length; i++) {
				length += Math.hypot(controls[i].x - controls[i - 1].x, controls[i].y - controls[i - 1].y);
			}
			const steps = Math.max(1, Math.ceil(Math.sqrt(length * 8)));
			for (let i = 1; i < steps; i++) {
				const t = i / steps;
				const u = 1 - t;
				const weights = control2 ? [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3] :
					[u * u, 2 * u * t, t * t];
				let x = 0;
				let y = 0;
				for (let j = 0; j < weights.length; j++) {
					x += controls[j].x * weights[j];
					y += controls[j].y * weights[j];
				}
				points.push({x, y});
			}
			points.push(end);
		}
		start = end;
	}
	return contours;
}

function stroke(points, width) {
	// Noise curves progress left to right, so adjacent samples provide a
	// nonzero tangent even when the curve has a horizontal section.
	const sides = [[], []];
	for (let i = 0; i < points.length; i++) {
		const before = points[Math.max(0, i - 1)];
		const after = points[Math.min(i + 1, points.length - 1)];
		const dx = after.x - before.x;
		const dy = after.y - before.y;
		const scale = width / (2 * Math.hypot(dx, dy));
		const point = points[i];
		sides[0].push({x: point.x - dy * scale, y: point.y + dx * scale});
		sides[1].push({x: point.x + dy * scale, y: point.y - dx * scale});
	}
	return sides[0].concat(sides[1].reverse());
}

function spans(width, height, contours) {
	const rows = Array.from({length: height}, () => []);
	for (const points of contours) {
		for (let i = 0; i < points.length; i++) {
			const a = points[i];
			const b = points[(i + 1) % points.length];
			if (a.y === b.y) {
				continue;
			}
			const direction = a.y < b.y ? 1 : -1;
			const top = Math.max(0, Math.ceil(Math.min(a.y, b.y) * samples - 0.5));
			const bottom = Math.min(height, Math.ceil(Math.max(a.y, b.y) * samples - 0.5));
			for (let row = top; row < bottom; row++) {
				const t = ((row + 0.5) / samples - a.y) / (b.y - a.y);
				rows[row].push({x: (a.x + (b.x - a.x) * t) * samples, direction});
			}
		}
	}

	// A sample lies inside a filled glyph when its winding count is
	// nonzero. Counters like the center of A are preserved by this rule.
	let coverage = 0;
	const ranges = [];
	for (let row = 0; row < height; row++) {
		const crossings = rows[row].sort((a, b) => a.x - b.x);
		let winding = 0;
		for (let i = 0; i < crossings.length - 1; i++) {
			winding += crossings[i].direction;
			if (winding === 0) {
				continue;
			}

			const start = Math.max(0, Math.ceil(crossings[i].x - 0.5));
			const end = Math.min(width, Math.ceil(crossings[i + 1].x - 0.5));
			if (end > start) {
				coverage += end - start;
				ranges.push({row, start, end});
			}
		}
	}
	return {coverage, ranges};
}

function fill(pixels, width, ranges, color, opacity, palette) {
	for (const {row, start, end} of ranges) {
		for (let x = start; x < end; x++) {
			const index = (row * width + x) * 3;
			const foreground = palette ? palette[Math.floor(x / samples)] : color;
			for (let channel = 0; channel < 3; channel++) {
				pixels[index + channel] = Math.round(
					pixels[index + channel] * (1 - opacity) + foreground[channel] * opacity
				);
			}
		}
	}
}

function layerSpans(layer, width, height) {
	let contours = flatten(layer.commands);
	if (layer.strokeWidth) {
		contours = [stroke(contours[0], layer.strokeWidth)];
	}
	const painted = spans(width, height, contours);
	if (layer.fallback && painted.coverage < minimumGlyphCoverage) {
		return spans(width, height, flatten(layer.fallback()));
	}
	return painted;
}

function raster({width, height, background, layers, palette}) {
	const sampleWidth = width * samples;
	const sampleHeight = height * samples;
	const pixels = Buffer.alloc(sampleWidth * sampleHeight * 3);
	pixels.fill(Buffer.from(rgb(background)));

	for (const layer of layers) {
		const {ranges} = layerSpans(layer, sampleWidth, sampleHeight);
		// Filled marks share the column palette. A stroke uses one ink throughout.
		const columnPalette = layer.strokeWidth ? undefined : palette;
		const ink = palette ? (layer.paletteColor ?? palette[Math.floor(width / 2)]) : rgb(layer.color);
		fill(pixels, sampleWidth, ranges, ink, palette ? 1 : (layer.opacity ?? 1), columnPalette);
	}

	// Rows start with the PNG filter type (0 means unfiltered).
	const stride = width * 3 + 1;
	const scanlines = Buffer.alloc(height * stride);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const target = y * stride + 1 + x * 3;
			const source = (y * samples * sampleWidth + x * samples) * 3;
			for (let channel = 0; channel < 3; channel++) {
				const offset = source + channel;
				scanlines[target + channel] = Math.round(
					(pixels[offset] + pixels[offset + 3] +
						pixels[offset + sampleWidth * 3] + pixels[offset + sampleWidth * 3 + 3]) / 4
				);
			}
		}
	}
	return scanlines;
}

module.exports = function png(scene) {
	return encodePng(scene.width, scene.height, raster(scene));
};

module.exports.measureGlyph = function (commands, width, height) {
	const {coverage, ranges} = spans(width * samples, height * samples, flatten(commands));
	return {
		visible: coverage >= minimumGlyphCoverage,
		inkHeight: coverage > 0 ? (ranges.at(-1).row - ranges[0].row + 1) / samples : 0
	};
};

module.exports.flatten = flatten;

module.exports.inkNear = function (layers, width, height) {
	const sampleWidth = width * samples;
	const sampleHeight = height * samples;
	const rows = Array.from({length: sampleHeight}, () => []);
	for (const layer of layers) {
		for (const range of layerSpans(layer, sampleWidth, sampleHeight).ranges) {
			rows[range.row].push(range);
		}
	}
	return function ({x, y}, radius) {
		const top = Math.max(0, Math.ceil((y - radius) * samples - 0.5));
		const bottom = Math.min(sampleHeight, Math.ceil((y + radius) * samples - 0.5));
		for (let row = top; row < bottom; row++) {
			const dy = (row + 0.5) / samples - y;
			const dx = Math.sqrt(radius * radius - dy * dy);
			const left = Math.ceil((x - dx) * samples - 0.5);
			const right = Math.ceil((x + dx) * samples - 0.5);
			if (right > left && rows[row].some(({start, end}) => start < right && end > left)) {
				return true;
			}
		}
		return false;
	};
};
