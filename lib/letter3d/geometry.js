'use strict';

const glyphs = require('./glyphs');
const {directions} = require('./style');

const focalLength = 29;
const halfDepth = 1.2;
const pitch = 18 * Math.PI / 180;
const cosPitch = Math.cos(pitch);
const sinPitch = Math.sin(pitch);

function signedArea(points) {
	let twiceArea = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		twiceArea += a.x * b.y - b.x * a.y;
	}
	return twiceArea;
}

function projectGlyph(letter, direction, size) {
	const yaw = directions[direction].angle * Math.PI / 180;
	const cosYaw = Math.cos(yaw);
	const sinYaw = Math.sin(yaw);
	const scale = size / 10;
	const outline = size * 0.02;

	function rotate(x, y, z) {
		const yawZ = -x * sinYaw + z * cosYaw;
		return [x * cosYaw + z * sinYaw, y * cosPitch + yawZ * sinPitch, yawZ * cosPitch - y * sinPitch];
	}

	function project([x, y], z) {
		const [px, py, pz] = rotate(x - 3.7, y - 5, z);
		const depth = focalLength / (focalLength - pz);
		return {x: px * scale * depth, y: py * scale * depth, depth};
	}

	function light(x, y, z) {
		const [nx, ny, nz] = rotate(x, y, z);
		return Math.max(0, -0.37 * nx - 0.56 * ny + 0.74 * nz);
	}

	const contours = glyphs[letter];
	const front = contours.map(points => points.map(point => project(point, halfDepth)));
	const back = contours.map(points => points.map(point => project(point, -halfDepth)));
	const faces = [{contours: front, shade: 0.92 + 0.08 * light(0, 0, 1)}];
	for (let c = 0; c < contours.length; c++) {
		const points = contours[c];
		for (let i = 0; i < points.length; i++) {
			const next = (i + 1) % points.length;
			const side = [front[c][i], front[c][next], back[c][next], back[c][i]];
			// Front-facing walls wind the opposite way to the front outline.
			if (signedArea(side) >= -1e-8) {
				continue;
			}
			const dx = points[next][0] - points[i][0];
			const dy = points[next][1] - points[i][1];
			const length = Math.hypot(dx, dy);
			faces.push({contours: [side], shade: 0.57 + 0.22 * light(dy / length, -dx / length, 0)});
		}
	}

	const points = [...front.flat(), ...back.flat()];
	const xs = points.map(point => point.x);
	const ys = points.map(point => point.y);
	const left = Math.min(...xs);
	const right = Math.max(...xs);
	const top = Math.min(...ys);
	const bottom = Math.max(...ys);
	const centerX = (left + right) / 2;
	const centerY = (top + bottom) / 2;
	for (const point of points) {
		point.x -= centerX;
		point.y -= centerY;
	}
	return {
		faces,
		outline,
		bounds: {left: left - centerX - outline, right: right - centerX + outline,
			top: top - centerY - outline, bottom: bottom - centerY + outline}
	};
}

module.exports = {projectGlyph};
