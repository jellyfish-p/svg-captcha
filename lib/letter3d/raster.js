'use strict';

const {colors, background} = require('./style');

// Use an odd grid size so a sample falls at each pixel center for the hit map.
const samples = 3;

function firstSample(coordinate, origin) {
	return Math.ceil((coordinate - origin) * samples - 0.5);
}

function sampleAt(index, origin) {
	return origin + (index + 0.5) / samples;
}

function stroke(grid, a, b, radius) {
	const {left, top, width, height, surface} = grid;
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lengthSquared = dx * dx + dy * dy;
	const radiusSquared = radius * radius;
	const startX = Math.max(0, firstSample(Math.min(a.x, b.x) - radius, left));
	const endX = Math.min(width, firstSample(Math.max(a.x, b.x) + radius, left));
	const startY = Math.max(0, firstSample(Math.min(a.y, b.y) - radius, top));
	const endY = Math.min(height, firstSample(Math.max(a.y, b.y) + radius, top));
	for (let row = startY; row < endY; row++) {
		const y = sampleAt(row, top) - a.y;
		for (let col = startX; col < endX; col++) {
			const x = sampleAt(col, left) - a.x;
			const t = Math.max(0, Math.min(1, (x * dx + y * dy) / lengthSquared));
			const distanceX = x - t * dx;
			const distanceY = y - t * dy;
			if (distanceX * distanceX + distanceY * distanceY <= radiusSquared) {
				surface[row * width + col] = 1;
			}
		}
	}
}

function depthPlane([a, b, ...points]) {
	const abX = b.x - a.x;
	const abY = b.y - a.y;
	const abDepth = b.depth - a.depth;
	for (const c of points) {
		const acX = c.x - a.x;
		const acY = c.y - a.y;
		const area = abX * acY - abY * acX;
		if (Math.abs(area) > 1e-8) {
			const acDepth = c.depth - a.depth;
			const x = (abDepth * acY - acDepth * abY) / area;
			const y = (abX * acDepth - acX * abDepth) / area;
			return {x, y, constant: a.depth - x * a.x - y * a.y};
		}
	}
	throw new Error('Unable to rasterize a degenerate Letter3d face');
}

function fill(grid, contours, ink) {
	const {left, top, width, height, surface, depth} = grid;
	const plane = depthPlane(contours[0]);
	const rows = Array.from({length: height}, () => []);
	for (const points of contours) {
		for (let i = 0; i < points.length; i++) {
			let a = points[i];
			let b = points[(i + 1) % points.length];
			if (a.y > b.y) {
				[a, b] = [b, a];
			}
			const first = Math.max(0, firstSample(a.y, top));
			const end = Math.min(height, firstSample(b.y, top));
			const slope = (b.x - a.x) / (b.y - a.y);
			for (let row = first; row < end; row++) {
				rows[row].push(a.x + (sampleAt(row, top) - a.y) * slope);
			}
		}
	}

	for (let row = 0; row < height; row++) {
		// Pairing scanline crossings leaves the R counter open. Reciprocal
		// camera depth is affine in screen space, including on a side wall.
		const crossings = rows[row].sort((a, b) => a - b);
		const yDepth = plane.constant + sampleAt(row, top) * plane.y;
		for (let i = 0; i + 1 < crossings.length; i += 2) {
			const start = Math.max(0, firstSample(crossings[i], left));
			const end = Math.min(width, firstSample(crossings[i + 1], left));
			for (let col = start; col < end; col++) {
				const index = row * width + col;
				const value = yDepth + sampleAt(col, left) * plane.x;
				if (value > depth[index]) {
					surface[index] = ink;
					depth[index] = value;
				}
			}
		}
	}
}

function shade(rgb, factor) {
	return rgb.map(channel => Math.round(channel * factor));
}

function drawObject(scanlines, objectAtPixel, width, height, {object, geometry, x, y}) {
	const left = Math.max(0, Math.floor(x + geometry.bounds.left));
	const right = Math.min(width, Math.ceil(x + geometry.bounds.right));
	const top = Math.max(0, Math.floor(y + geometry.bounds.top));
	const bottom = Math.min(height, Math.ceil(y + geometry.bounds.bottom));
	if (right <= left || bottom <= top) {
		return;
	}
	const sampleWidth = (right - left) * samples;
	const sampleHeight = (bottom - top) * samples;
	const surface = new Uint8Array(sampleWidth * sampleHeight);
	const grid = {left: left - x, top: top - y, width: sampleWidth, height: sampleHeight,
		surface, depth: new Float64Array(surface.length)};
	const rgb = colors[object.color].rgb;
	const palette = [background, shade(rgb, 0.42)];

	// Start with an outline, then paint the actual faces above it. This
	// leaves a stroke on the visible silhouette, including inside a counter.
	for (const {contours} of geometry.faces) {
		for (const points of contours) {
			for (let i = 0; i < points.length; i++) {
				stroke(grid, points[i], points[(i + 1) % points.length], geometry.outline);
			}
		}
	}
	for (const face of geometry.faces) {
		fill(grid, face.contours, palette.length);
		palette.push(shade(rgb, face.shade));
	}

	const stride = width * 3 + 1;
	const center = ((samples - 1) / 2) * (sampleWidth + 1);
	for (let py = top; py < bottom; py++) {
		for (let px = left; px < right; px++) {
			const first = (py - top) * samples * sampleWidth + (px - left) * samples;
			if (surface[first + center] !== 0) {
				objectAtPixel[py * width + px] = object.id;
			}
			let red = 0;
			let green = 0;
			let blue = 0;
			for (let row = 0; row < samples; row++) {
				for (let col = 0; col < samples; col++) {
					const ink = palette[surface[first + row * sampleWidth + col]];
					red += ink[0];
					green += ink[1];
					blue += ink[2];
				}
			}
			const offset = py * stride + 1 + px * 3;
			scanlines[offset] = Math.round(red / (samples * samples));
			scanlines[offset + 1] = Math.round(green / (samples * samples));
			scanlines[offset + 2] = Math.round(blue / (samples * samples));
		}
	}
}

function rasterize(width, height, placements) {
	const objectAtPixel = new Uint8Array(width * height);
	const stride = width * 3 + 1;
	const scanlines = Buffer.alloc(height * stride);
	const paper = Buffer.from(background);
	for (let y = 0; y < height; y++) {
		scanlines.fill(paper, y * stride + 1, (y + 1) * stride);
	}
	for (const placement of placements) {
		drawObject(scanlines, objectAtPixel, width, height, placement);
	}
	return {scanlines, objectAtPixel};
}

module.exports = {rasterize};
