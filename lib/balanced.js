'use strict';

const random = require('./random');
const {flatten} = require('./png');
const {ball, fitBall, ornamentUnit} = require('./interference');

function glyphCore(commands) {
	let left = Infinity;
	let right = -Infinity;
	let top = Infinity;
	let bottom = -Infinity;
	for (const {end, control1, control2} of commands) {
		for (const point of [end, control1, control2]) {
			if (point) {
				left = Math.min(left, point.x);
				right = Math.max(right, point.x);
				top = Math.min(top, point.y);
				bottom = Math.max(bottom, point.y);
			}
		}
	}

	const insetX = (right - left) * 0.13;
	const insetY = (bottom - top) * 0.16;
	return {
		left: left + insetX,
		right: right - insetX,
		top: top + insetY,
		bottom: bottom - insetY
	};
}

function crossedCores(layer, cores) {
	const [points] = flatten(layer.commands);
	const radius = layer.strokeWidth / 2;
	const touched = [];
	for (const [index, core] of cores.entries()) {
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			// The stroked segment is contained by this expanded rectangle.
			if (Math.min(a.x, b.x) - radius <= core.right &&
				Math.max(a.x, b.x) + radius >= core.left &&
				Math.min(a.y, b.y) - radius <= core.bottom &&
				Math.max(a.y, b.y) + radius >= core.top) {
				touched.push(index);
				break;
			}
		}
	}
	return touched;
}

function edgeCurve(layer, cores, height) {
	const margin = layer.strokeWidth / 2 + 0.25;
	const top = Math.min(...cores.map(core => core.top));
	const bottom = Math.max(...cores.map(core => core.bottom));
	const band = top > height - bottom ? [0.5, top - margin] : [bottom + margin, height - 0.5];
	for (const {end, control1, control2} of layer.commands) {
		for (const point of [end, control1, control2]) {
			if (point) {
				point.y = random.decimal(...band);
			}
		}
	}
	return {...layer, opacity: 0.42};
}

function chooseCurve(cores, reserved, options, createCurve) {
	let safe;
	let candidate;
	for (let attempt = 0; attempt < 12; attempt++) {
		candidate = createCurve();
		const touched = crossedCores(candidate, cores);
		if (touched.length === 0) {
			safe ??= candidate;
		} else if (touched.length <= 3 && touched.every(index => !reserved.has(index))) {
			for (const index of touched) {
				reserved.add(index);
			}
			return candidate;
		}
	}
	return safe ?? edgeCurve(candidate, cores, options.height);
}

function addRing(commands, pickCenter, radius, options, cores, reserved) {
	for (let attempt = 0; attempt < 8; attempt++) {
		const center = fitBall(pickCenter(), radius, options);
		const touched = [];
		for (const [index, core] of cores.entries()) {
			if (circleTouchesCore(center, radius, core)) {
				touched.push(index);
			}
		}
		if (touched.length <= 1 && touched.every(index => !reserved.has(index))) {
			ball(commands, center, radius, options, true);
			for (const index of touched) {
				reserved.add(index);
			}
			return;
		}
	}
}

function circleTouchesCore(center, radius, core) {
	const dx = Math.max(core.left - center.x, center.x - core.right, 0);
	const dy = Math.max(core.top - center.y, center.y - core.bottom, 0);
	return dx * dx + dy * dy <= radius * radius;
}

function balancedLayers(glyphs, options, ink, createCurve) {
	const cores = glyphs.map(glyph => glyphCore(glyph.commands));
	// Give each core at most one intrusive shape across curves and rings.
	const reserved = new Set();
	const layers = Array.from({length: options.noise}, () =>
		chooseCurve(cores, reserved, options, createCurve)
	);
	const commands = [];
	const unit = ornamentUnit(options, glyphs.length);
	const slot = options.width / glyphs.length;
	for (const [index, glyph] of glyphs.entries()) {
		const ends = glyph.commands.filter(command => command.end).map(command => command.end);
		for (let n = 0; n < 3; n++) {
			const radius = unit * random.decimal(2.1, 5.3);
			addRing(commands, () => {
				const anchor = ends[random.int(0, ends.length - 1)];
				return {
					x: anchor.x + unit * random.decimal(-6, 6),
					y: anchor.y + unit * random.decimal(-6, 6)
				};
			}, radius, options, cores, reserved);
		}
		const gap = index === glyphs.length - 1 ? options.width - 0.23 * slot : (index + 1) * slot;
		const radius = unit * random.decimal(1.35, 2.6);
		addRing(commands, () => ({
			x: gap + unit * random.decimal(-3, 3),
			y: options.height * random.decimal(0.22, 0.78)
		}), radius, options, cores, reserved);
	}
	if (commands.length > 0) {
		layers.push({commands, color: ink, opacity: 0.92});
	}
	return layers;
}

module.exports = {balancedLayers, glyphCore, circleTouchesCore};
