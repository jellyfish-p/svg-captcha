'use strict';

const path = require('node:path');
const opentype = require('opentype.js');
const charPreset = require('./char-preset');

const defaults = Object.freeze({
	size: 4,
	width: 150,
	height: 50,
	fontSize: 56,
	noise: 1,
	color: false,
	inverse: false,
	background: '',
	ignoreChars: '',
	charPreset,
	mathMin: 1,
	mathMax: 9,
	mathOperator: '+'
});

const pngDefaults = Object.freeze({
	interference: 'none', interferenceDensity: 1, palette: 'default', letterMimicProbability: 0
});

const strongDefaults = Object.freeze({
	...defaults,
	...pngDefaults,
	size: 6,
	width: 210,
	height: 68,
	fontSize: 52,
	noise: 3,
	charPreset: '23456789ACDEFHJKLMNPRTVWXY'
});

const globalOverrides = new Set();
const options = new Proxy({...defaults, ...pngDefaults}, {
	defineProperty(target, key, descriptor) {
		const defined = Reflect.defineProperty(target, key, descriptor);
		if (defined && ['value', 'get', 'set'].some(name => Object.hasOwn(descriptor, name))) {
			globalOverrides.add(key);
		}
		return defined;
	},
	deleteProperty(target, key) {
		const deleted = Reflect.deleteProperty(target, key);
		if (deleted) {
			globalOverrides.delete(key);
		}
		return deleted;
	}
});

let font = opentype.loadSync(path.join(__dirname, '../fonts/Comismsh.ttf'));
let outlines = new Map();

function loadFont(filepath) {
	if (typeof filepath !== 'string') {
		throw new TypeError('Font path must be a string');
	}

	font = opentype.loadSync(filepath);
	outlines = new Map();
}

function integer(name, value, min, max) {
	if (typeof value !== 'number') {
		throw new TypeError(`${name} must be a number`);
	}
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
	}
}

function string(name, value, maxLength) {
	if (typeof value !== 'string') {
		throw new TypeError(`${name} must be a string`);
	}
	if (value.length > maxLength) {
		throw new RangeError(`${name} must be at most ${maxLength} UTF-16 code units long`);
	}
}

function normalize(input = {}, strong = false) {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		throw new TypeError('Options must be an object');
	}

	const normalized = {};
	// Only known own properties enter the renderer. Strong defaults apply
	// when the caller has left the corresponding global setting untouched.
	for (const [key, preset] of Object.entries(strong ? strongDefaults : defaults)) {
		const local = Object.hasOwn(input, key) ? input[key] : undefined;
		const global = globalOverrides.has(key) ? options[key] : undefined;
		normalized[key] = local === undefined ? (global === undefined ? preset : global) : local;
	}

	integer('size', normalized.size, 1, 16);
	integer('width', normalized.width, 16, 512);
	integer('height', normalized.height, 16, 256);
	integer('fontSize', normalized.fontSize, 8, 256);
	integer('noise', normalized.noise, 0, 20);
	integer('mathMin', normalized.mathMin, 0, 999);
	integer('mathMax', normalized.mathMax, 0, 999);

	if (normalized.mathMin > normalized.mathMax) {
		throw new RangeError('mathMin must be less than or equal to mathMax');
	}

	for (const key of ['color', 'inverse']) {
		if (typeof normalized[key] !== 'boolean') {
			throw new TypeError(`${key} must be a boolean`);
		}
	}

	string('charPreset', normalized.charPreset, 256);
	string('ignoreChars', normalized.ignoreChars, 256);
	string('background', normalized.background, 7);
	string('mathOperator', normalized.mathOperator, 3);

	const {background, mathOperator} = normalized;
	if (background !== '' &&
		!([4, 7].includes(background.length) && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(background))) {
		throw new RangeError('background must be empty or a #RGB or #RRGGBB color');
	}

	if (!['+', '-', '+/-', '+-'].includes(mathOperator)) {
		throw new RangeError('mathOperator must be +, -, +/-, or +-');
	}
	if (strong) {
		const {letterMimicProbability} = normalized;
		if (typeof letterMimicProbability !== 'number') {
			throw new TypeError('letterMimicProbability must be a number');
		}
		if (!Number.isFinite(letterMimicProbability) || letterMimicProbability < 0 || letterMimicProbability > 1) {
			throw new RangeError('letterMimicProbability must be between 0 and 1');
		}
		integer('interferenceDensity', normalized.interferenceDensity, 1, 2);
		string('interference', normalized.interference, 8);
		string('palette', normalized.palette, 9);
		if (!['none', 'lines', 'beads', 'rings', 'decoy', 'mixed', 'balanced', 'beaded'].includes(normalized.interference)) {
			throw new RangeError('interference must be none, lines, beads, rings, decoy, mixed, balanced, or beaded');
		}
		if (!['default', 'shared', 'analogous', 'per-glyph'].includes(normalized.palette)) {
			throw new RangeError('palette must be default, shared, analogous, or per-glyph');
		}
	}
	normalized.color = normalized.color || background !== '';

	return normalized;
}

function outline(char) {
	if (outlines.has(char)) {
		return outlines.get(char);
	}

	// The OpenType version used here looks up BMP characters by code unit.
	if (char.length !== 1 || /[\uD800-\uDFFF]/.test(char) || !font.charToGlyphIndex(char)) {
		throw new RangeError(`The loaded font has no glyph for ${JSON.stringify(char)}`);
	}

	const glyph = font.charToGlyph(char).getPath(0, 0, 1);
	const {x1, y1, x2, y2} = glyph.getBoundingBox();
	if (!glyph.commands.length || !(x2 > x1 && y2 > y1)) {
		throw new RangeError(`The loaded font has no drawable outline for ${JSON.stringify(char)}`);
	}

	const value = {
		commands: glyph.commands,
		bounds: {x1, y1, x2, y2},
		x: (x1 + x2) / 2,
		y: (y1 + y2) / 2,
		baseline: (font.ascender + font.descender) / (2 * font.unitsPerEm)
	};
	outlines.set(char, value);
	return value;
}

function alphabet({charPreset, ignoreChars}) {
	const excluded = new Set(ignoreChars);
	const chars = [...new Set(charPreset)].filter(char => !excluded.has(char));
	if (chars.length === 0) {
		throw new RangeError('charPreset must contain a character after applying ignoreChars');
	}
	for (const char of chars) {
		outline(char);
	}
	return chars;
}

function inputText(value) {
	string('text', value, 32);
	const chars = [...value];
	if (chars.length < 1 || chars.length > 16) {
		throw new RangeError('text must contain between 1 and 16 characters');
	}
	return chars;
}

module.exports = {options, normalize, alphabet, inputText, outline, loadFont};
