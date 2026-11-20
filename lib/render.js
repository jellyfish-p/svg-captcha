'use strict';

const color = require('./color');
const chToPath = require('./ch-to-path');
const {outline} = require('./option-manager');
const {measureGlyph} = require('./png');
const random = require('./random');
const ornaments = require('./interference');
const {balancedLayers} = require('./balanced');
const beadedLayer = require('./beaded');
const {letterMimicLayer, hasRecipe} = require('./letter-mimic');
const paletteColumns = require('./palette');

// Keep at most the last layout checked per glyph in the current font.
const visibleLayouts = new WeakMap();

function validateWidth(width, length) {
	if (width < 6 * length) {
		throw new RangeError('width must leave at least 6 pixels per character');
	}
}

function validateStrongLayout(alphabet, options) {
	const {width, height, size, fontSize} = options;
	if (options.interference === 'beaded' && alphabet.length < 2) {
		throw new RangeError('beaded interference requires at least two distinct drawable characters');
	}
	validateWidth(width, size);
	if (options.interference !== 'none' && (width < 12 * size || height < 26)) {
		throw new RangeError('interference requires a height of 26 pixels and 12 pixels per character');
	}
	const layout = `${width}:${height}:${size}:${fontSize}`;
	const minimumHeight = ornaments.minimumGlyphHeight(options);
	for (const char of alphabet) {
		const glyph = outline(char);
		let measured = visibleLayouts.get(glyph);
		if (measured?.layout !== layout) {
			const commands = chToPath(char, 0, size, options, true, true);
			const {visible, inkHeight} = measureGlyph(commands, width, height);
			if (!visible) {
				throw new RangeError(`The PNG layout is too small to draw ${JSON.stringify(char)}`);
			}
			measured = {layout, inkHeight};
			visibleLayouts.set(glyph, measured);
		}
		if (measured.inkHeight < minimumHeight) {
			throw new RangeError(`The PNG glyph ${JSON.stringify(char)} is too short for the selected interference`);
		}
	}
}

function noiseLayer({width, height, inverse, color: hasColor}, strong, backdrop, ink, matchingLine) {
	const start = {x: random.decimal(1, width * 0.13), y: random.int(1, height - 2)};
	const end = {x: random.decimal(width * 0.87, width - 1), y: random.int(1, height - 2)};
	const control1 = {x: random.decimal(width * 0.2, width * 0.5), y: random.int(1, height - 2)};
	const control2 = {x: random.decimal(width * 0.5, width * 0.8), y: random.int(1, height - 2)};
	const noiseColor = ink ?? (hasColor ? color.color(backdrop) :
		(inverse ? color.grey(7, 12) : color.grey(5, 10)));
	return {
		commands: [
			{type: 'M', end: start},
			{type: 'C', control1, control2, end}
		],
		color: noiseColor,
		strokeWidth: matchingLine ? random.decimal(1.35, 2.5) : (strong ? random.decimal(1.1, 2.3) : 1),
		opacity: matchingLine ? random.decimal(0.72, 0.94) : (strong ? random.decimal(0.26, 0.54) : 1)
	};
}

function scene(chars, options, strong, alphabet) {
	const {width, height, noise, inverse} = options;
	validateWidth(width, chars.length);

	const interference = strong ? options.interference : 'none';
	const useDecoys = interference === 'beaded';
	const protectCore = interference === 'balanced' || useDecoys;
	const matchingLine = protectCore || interference === 'lines' || interference === 'mixed';
	const backdrop = options.background || (inverse ? '#17191f' : '#fff');
	const foregroundColor = () => {
		if (options.color) {
			return color.color(backdrop);
		}
		return inverse ? color.grey(11, 15) : color.grey(0, 4);
	};
	// Experimental styles share one ink color across characters and ornaments.
	const ink = interference === 'none' ? undefined : foregroundColor();
	const mimicProbability = strong ? options.letterMimicProbability : 0;
	const mimicCandidates = [];
	const layers = chars.map((char, index) => {
		const fallback = strong ? () => chToPath(char, index, chars.length, options, true, true) : undefined;
		const placement = mimicProbability > 0 && hasRecipe(char) ?
			chToPath.placeGlyph(char, index, chars.length, options, true) : undefined;
		let commands = placement?.commands ?? chToPath(char, index, chars.length, options, strong);
		let inkHeight;
		if (protectCore) {
			const measured = measureGlyph(commands, width, height);
			// Core protection and decoy sizing use the outline that gets drawn.
			if (!measured.visible) {
				commands = fallback();
			}
			if (useDecoys) {
				inkHeight = measured.visible ? measured.inkHeight : measureGlyph(commands, width, height).inkHeight;
			}
		}
		const glyph = {commands, color: ink ?? foregroundColor(), fallback, inkHeight};
		if (placement && commands === placement.commands) {
			mimicCandidates.push({char, index, project: placement.project, glyph});
		}
		return glyph;
	});

	const createCurve = () => noiseLayer(options, strong, backdrop, ink, matchingLine);
	if (protectCore) {
		const interferenceLayers = balancedLayers(layers, options, ink, createCurve);
		if (useDecoys) {
			const decoys = beadedLayer(layers, chars, alphabet, options, ink);
			if (decoys) {
				interferenceLayers.push(decoys);
			}
			// Solid interiors share the glyph ink at full opacity.
			for (const layer of interferenceLayers) {
				layer.opacity = 1;
			}
		}
		layers.push(...interferenceLayers);
	} else {
		if (interference !== 'none') {
			layers.push(...ornaments(layers, options, ink));
		}
		for (let i = 0; i < noise; i++) {
			layers.push(createCurve());
		}
	}

	const shuffled = random.shuffle(layers);
	const rendered = {width, height, background: strong ? backdrop : options.background, layers: shuffled};
	const paletteMode = options.palette ?? 'default';
	if (strong && paletteMode !== 'default') {
		const palette = paletteColumns(paletteMode, width, chars.length, backdrop);
		for (const layer of shuffled) {
			if (layer.strokeWidth) {
				const slot = random.int(0, chars.length - 1);
				const center = Math.floor((slot + 0.5) * width / chars.length);
				layer.paletteColor = palette[center];
			}
		}
		rendered.palette = palette;
	}
	const mimic = letterMimicLayer(mimicCandidates, mimicProbability, rendered, width / chars.length, protectCore);
	if (mimic) {
		shuffled.push(mimic);
	}
	return rendered;
}

function pointData(point) {
	return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function pathData(commands) {
	return commands.map(({type, control1, control2, end}) =>
		type + [control1, control2, end].filter(Boolean).map(pointData).join(' ')).join('');
}

function svg({width, height, background, layers}) {
	const rectangle = background ? `<rect width="100%" height="100%" fill="${background}"/>` : '';
	const paths = layers.map(layer => {
		const d = pathData(layer.commands);
		return layer.strokeWidth ?
			`<path d="${d}" stroke="${layer.color}" fill="none"/>` :
			`<path fill="${layer.color}" d="${d}"/>`;
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0,0,${width},${height}">${rectangle}${paths.join('')}</svg>`;
}

module.exports = {scene, svg, validateWidth, validateStrongLayout};
