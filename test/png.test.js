'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const {inflateSync} = require('node:zlib');
const opentype = require('opentype.js');
const captcha = require('..');
const chToPath = require('../lib/ch-to-path');
const png = require('../lib/png');
const paletteColumns = require('../lib/palette');
const random = require('../lib/random');
const {rgb, luminance} = require('../lib/color');
const {alphabet, normalize} = require('../lib/option-manager');
const {scene} = require('../lib/render');
const {glyphCore} = require('../lib/balanced');

function decode(data) {
	assert.ok(Buffer.isBuffer(data));
	assert.equal(data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
	const chunks = {};
	for (let offset = 8; offset < data.length;) {
		const length = data.readUInt32BE(offset);
		const type = data.toString('ascii', offset + 4, offset + 8);
		chunks[type] = data.subarray(offset + 8, offset + 8 + length);
		let crc = 0xffffffff;
		for (const byte of data.subarray(offset + 4, offset + 8 + length)) {
			crc ^= byte;
			for (let i = 0; i < 8; i++) {
				crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
			}
		}
		assert.equal(data.readUInt32BE(offset + 8 + length), (crc ^ 0xffffffff) >>> 0);
		offset += 12 + length;
	}

	assert.deepEqual(Object.keys(chunks), ['IHDR', 'IDAT', 'IEND']);
	const width = chunks.IHDR.readUInt32BE(0);
	const height = chunks.IHDR.readUInt32BE(4);
	assert.deepEqual([...chunks.IHDR.subarray(8)], [8, 2, 0, 0, 0]);
	const scanlines = inflateSync(chunks.IDAT);
	const stride = width * 3 + 1;
	assert.equal(scanlines.length, stride * height);
	for (let y = 0; y < height; y++) {
		assert.equal(scanlines[y * stride], 0);
	}
	return {
		width, height,
		pixel(x, y) {
			const offset = y * stride + 1 + 3 * x;
			return [...scanlines.subarray(offset, offset + 3)];
		}
	};
}

function dottedLayer(layers) {
	return layers.find(layer => !layer.fallback && !layer.strokeWidth &&
		png.flatten(layer.commands).every(contour => {
			const winding = contour.reduce((area, point, index) => {
				const next = contour[(index + 1) % contour.length];
				return area + point.x * next.y - point.y * next.x;
			}, 0);
			return winding > 0;
		}));
}

test('strong profile returns a clean RGB PNG and six reduced-confusion characters', () => {
	const {text, data} = captcha.createStrong();
	assert.match(text, /^[23456789ACDEFHJKLMNPRTVWXY]{6}$/);
	const {width, height, pixel} = decode(data);
	assert.equal(width, 210);
	assert.equal(height, 68);
	assert.deepEqual(pixel(0, 0), [255, 255, 255]);
});

test('strong output fits wide glyphs in every slot on a small canvas', () => {
	const {text, data} = captcha.createStrong({
		charPreset: 'W', width: 61, height: 21, fontSize: 256, noise: 0, background: '#123'
	});
	assert.equal(text, 'WWWWWW');
	const image = decode(data);
	assert.equal(image.width, 61);
	assert.equal(image.height, 21);
	const background = '17,34,51';
	for (let slot = 0; slot < text.length; slot++) {
		let ink = 0;
		for (let y = 0; y < image.height; y++) {
			for (let x = Math.ceil(slot * 61 / 6); x < Math.floor((slot + 1) * 61 / 6); x++) {
				if (String(image.pixel(x, y)) !== background) {
					ink++;
				}
			}
		}
		assert.ok(ink > 0, `glyph in slot ${slot} must be visible`);
	}
	for (let x = 0; x < image.width; x++) {
		assert.equal(String(image.pixel(x, 0)), background);
		assert.equal(String(image.pixel(x, image.height - 1)), background);
	}
});

test('strong profile rejects layouts that can produce invisible glyphs before sampling', () => {
	for (const charPreset of ['.', 'A.']) {
		assert.throws(() => captcha.createStrong({
			width: 36, height: 16, fontSize: 8, noise: 0, charPreset
		}), /PNG layout is too small/);
	}
	assert.equal(captcha.createStrong({charPreset: '.', noise: 0}).text, '......');
});

test('interference styles render PNGs with the same answer and ink as their glyphs', () => {
	const text = 'AAAAAA';
	for (const interference of ['lines', 'beads', 'rings', 'decoy', 'mixed', 'balanced']) {
		const options = {charPreset: 'A', background: '#123', interference, noise: 2};
		const challenge = captcha.createStrong(options);
		assert.equal(challenge.text, text);
		const image = decode(challenge.data);
		assert.equal(image.width, 210);
		assert.equal(image.height, 68);
		assert.deepEqual(image.pixel(0, 0), [17, 34, 51]);

		const {layers} = scene([...text], normalize(options, true), true);
		const expectedOrnaments = interference === 'lines' ? 0 : 1;
		assert.equal(layers.filter(layer => layer.fallback).length, text.length);
		assert.equal(layers.filter(layer => layer.strokeWidth).length, 2);
		assert.equal(layers.length, text.length + 2 + expectedOrnaments);
		assert.equal(new Set(layers.map(layer => layer.color)).size, 1);
	}
});

test('mixed interference adds shapes at either density and retains the crossing count', () => {
	for (const [interferenceDensity, contoursPerGlyph] of [[1, 8], [2, 11]]) {
		const options = normalize({interference: 'mixed', interferenceDensity, noise: 3}, true);
		const chars = [...'AAAAAA'];
		const {layers} = scene(chars, options, true);
		const crossings = layers.filter(layer => layer.strokeWidth);
		assert.equal(crossings.length, 3);
		assert.ok(crossings.every(layer => layer.opacity >= 0.72 && layer.opacity <= 0.94));
		const shapes = layers.find(layer => !layer.fallback && !layer.strokeWidth);
		const contours = shapes.commands.filter(command => command.type === 'M');
		assert.equal(contours.length, contoursPerGlyph * chars.length);
	}
});

test('balanced interference limits combined line and ring contact even at maximum noise', () => {
	const options = normalize({interference: 'balanced', noise: 20}, true);
	const {width, height, background, layers} = scene([...'AB8WMQ'], options, true);
	const cores = layers.filter(layer => layer.fallback).map(layer => glyphCore(layer.commands));
	const curves = layers.filter(layer => layer.strokeWidth);
	const rings = layers.find(layer => !layer.fallback && !layer.strokeWidth);
	assert.equal(curves.length, 20);
	assert.ok(rings?.commands.length);
	const ringStarts = rings.commands.flatMap((command, index) => command.type === 'M' ? [index] : []);
	const overlays = [...curves];
	for (let i = 0; i < ringStarts.length; i += 2) {
		overlays.push({...rings, commands: rings.commands.slice(ringStarts[i], ringStarts[i + 2])});
	}

	const contactCounts = cores.map(() => 0);
	for (const layer of overlays) {
		const {pixel} = decode(png({width, height, background, layers: [layer]}));
		for (const [index, core] of cores.entries()) {
			let touched = false;
			for (let y = Math.ceil(core.top); y + 1 <= core.bottom && !touched; y++) {
				for (let x = Math.ceil(core.left); x + 1 <= core.right && !touched; x++) {
					touched = pixel(x, y)[0] < 255;
				}
			}
			contactCounts[index] += Number(touched);
		}
	}
	assert.ok(contactCounts.every(count => count <= 1), `core contacts: ${contactCounts.join(', ')}`);
});

test('balanced interference sees the outline used for a faint custom glyph', t => {
	const glyphPath = new opentype.Path();
	for (const x of [0, 19]) {
		glyphPath.moveTo(x, 0);
		glyphPath.lineTo(x + 1, 0);
		glyphPath.lineTo(x + 1, 1000);
		glyphPath.lineTo(x, 1000);
		glyphPath.closePath();
	}
	const font = new opentype.Font({
		familyName: 'Thin fixture',
		styleName: 'Regular',
		unitsPerEm: 2000,
		ascender: 1500,
		descender: -500,
		glyphs: [
			new opentype.Glyph({name: '.notdef', advanceWidth: 1000, path: new opentype.Path()}),
			new opentype.Glyph({name: 'I', unicode: 73, advanceWidth: 1000, path: glyphPath})
		]
	});
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-captcha-font-'));
	const fontPath = path.join(directory, 'thin.otf');
	fs.writeFileSync(fontPath, Buffer.from(font.toArrayBuffer()));
	try {
		captcha.loadFont(fontPath);
		t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
		const options = normalize({charPreset: 'I', interference: 'balanced'}, true);
		const {width, height, size} = options;
		const glyphs = [...'I'.repeat(size)];
		const distorted = chToPath('I', 0, size, options, true);
		const aligned = chToPath('I', 0, size, options, true, true);
		assert.equal(png.measureGlyph(distorted, width, height).visible, false);
		assert.equal(png.measureGlyph(aligned, width, height).visible, true);

		const {layers} = scene(glyphs, options, true);
		const actualCores = layers.filter(layer => layer.fallback)
			.map(layer => glyphCore(layer.commands)).sort((a, b) => a.left - b.left);
		const expectedCores = glyphs.map((char, i) => glyphCore(chToPath(char, i, size, options, true, true)));
		assert.deepEqual(actualCores, expectedCores);
	} finally {
		captcha.loadFont(path.join(__dirname, '../fonts/Comismsh.ttf'));
		fs.unlinkSync(fontPath);
		fs.rmdirSync(directory);
	}
});

test('beaded interference uses different font glyphs and keeps every dot outside answer cores', t => {
	t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
	t.mock.method(random, 'int', min => min);
	t.mock.method(random, 'shuffle', items => items);
	const chars = [...'AAAAAA'];
	const outlines = [];
	for (const [charPreset, interferenceDensity] of [['AH', 1], ['AZ', 1], ['AH', 2]]) {
		const options = normalize({interference: 'beaded', interferenceDensity, charPreset, noise: 0}, true);
		const {width, height, background, layers} = scene(chars, options, true, alphabet(options));
		const cores = layers.filter(layer => layer.fallback).map(layer => glyphCore(layer.commands));
		const dots = dottedLayer(layers);
		assert.ok(dots);
		const dotCount = dots.commands.filter(command => command.type === 'M').length;
		assert.ok(dotCount >= 6 && dotCount <= 72 * interferenceDensity);
		assert.equal(new Set(layers.map(layer => layer.color)).size, 1);
		const {pixel} = decode(png({width, height, background, layers: [dots]}));
		for (const core of cores) {
			for (let y = Math.ceil(core.top); y + 1 <= core.bottom; y++) {
				for (let x = Math.ceil(core.left); x + 1 <= core.right; x++) {
					assert.equal(pixel(x, y)[0], 255);
				}
			}
		}
		outlines.push(dots.commands);
	}
	assert.notDeepEqual(outlines[0], outlines[1]);
	assert.ok(outlines[2].length > outlines[0].length);
});

test('beaded silhouettes fit the shorter rendered neighbor even with widely unequal glyph sizes', t => {
	t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
	t.mock.method(random, 'int', min => min);
	t.mock.method(random, 'shuffle', items => items);
	for (const width of [40, 80]) {
		const options = normalize({
			interference: 'beaded', charPreset: 'WIJ', size: 2, width, height: 110, fontSize: 140, noise: 0
		}, true);
		const {layers} = scene([...'WI'], options, true, alphabet(options));
		const glyphHeights = layers.filter(layer => layer.fallback).map(layer => layer.inkHeight);
		const shortest = Math.min(...glyphHeights);
		assert.ok(Math.max(...glyphHeights) > shortest * 2);
		const dots = dottedLayer(layers);
		if (width === 40) {
			assert.equal(dots, undefined);
		} else {
			assert.ok(dots);
			const {inkHeight} = png.measureGlyph(dots.commands, width, options.height);
			assert.ok(inkHeight <= 0.75 * shortest);
		}
	}
});

test('beaded glyphs and interference share opaque interior pixels at both densities', t => {
	t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
	t.mock.method(random, 'int', (min, max) => min === 1 ? Math.floor((min + max) / 2) : min);
	t.mock.method(random, 'shuffle', items => items);
	for (const interferenceDensity of [1, 2]) {
		const options = normalize({
			interference: 'beaded', interferenceDensity, charPreset: 'AH', noise: 20
		}, true);
		const {width, height, background, layers} = scene([...'AAAAAA'], options, true, alphabet(options));
		assert.equal(layers.filter(layer => layer.strokeWidth).length, 20);
		assert.ok(layers.every(layer => (layer.opacity ?? 1) === 1 && layer.color === '#000'));
		for (const layer of [layers.find(shape => shape.fallback), dottedLayer(layers)]) {
			assert.ok(layer);
			const {pixel} = decode(png({width, height, background, layers: [layer]}));
			let opaque = false;
			let antialiased = false;
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const [red] = pixel(x, y);
					opaque ||= red === 0;
					antialiased ||= red > 0 && red < 255;
				}
			}
			assert.ok(opaque && antialiased);
		}
	}
});

test('each solid PNG palette column meets the background contrast floor', () => {
	for (const background of ['#fff', '#000', '#17191f', '#921', '#1e0', '#757575', '#00f']) {
		for (const mode of ['shared', 'analogous', 'per-glyph']) {
			const backgroundLight = luminance(rgb(background));
			const columns = paletteColumns(mode, 211, 6, background);
			assert.equal(columns.length, 211);
			for (const channels of columns) {
				const light = luminance(channels);
				const ratio = (Math.max(light, backgroundLight) + 0.05) / (Math.min(light, backgroundLight) + 0.05);
				assert.ok(ratio >= 4.5, `${mode}, ${background}: ${ratio}`);
			}
			if (mode === 'shared') {
				assert.equal(new Set(columns.map(String)).size, 1);
			}
		}
	}
});

test('per-glyph PNG palettes select distinct center colors with a bounded draw budget', t => {
	t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
	const choose = t.mock.method(random, 'int', (min, max) => {
		assert.ok(max < 128);
		return min;
	});
	for (const [size, width] of [[1, 35], [6, 211], [8, 280], [16, 512]]) {
		for (const background of ['#fff', '#000', '#757575', '#777', '#921', '#04f']) {
			const before = choose.mock.callCount();
			const columns = paletteColumns('per-glyph', width, size, background);
			const centers = Array.from({length: size}, (_, index) => Math.floor((index + 0.5) * width / size));
			const anchors = centers.map(column => columns[column]);
			assert.equal(new Set(anchors.map(String)).size, size);
			assert.equal(choose.mock.callCount() - before, size === 1 ? 0 : size);
			const backgroundLight = luminance(rgb(background));
			for (const color of anchors) {
				const light = luminance(color);
				const ratio = (Math.max(light, backgroundLight) + 0.05) / (Math.min(light, backgroundLight) + 0.05);
				assert.ok(ratio >= 4.5);
			}
			if (background === '#fff') {
				for (let i = 1; i < anchors.length; i++) {
					const channelChanges = anchors[i].map((channel, index) => Math.abs(channel - anchors[i - 1][index]));
					assert.ok(Math.max(...channelChanges) >= 16);
				}
			}
		}
	}
});

test('spatial palette colors match glyph and filled ornament pixels by column', () => {
	const width = 16;
	const background = '#fff';
	const palette = paletteColumns('per-glyph', width, 2, background);
	const glyph = contour([[1, 2.5], [15, 2.5], [15, 8], [1, 8]]);
	const {pixel} = decode(png({
		width, height: 16, background, palette,
		layers: [
			{commands: glyph, color: '#f00', fallback: () => glyph},
			{commands: contour([[1, 10.5], [15, 10.5], [15, 15], [1, 15]]), color: '#0f0', opacity: 0.32}
		]
	}));
	for (let x = 2; x < 14; x++) {
		assert.deepEqual(pixel(x, 4), palette[x]);
		assert.deepEqual(pixel(x, 12), palette[x]);
		assert.deepEqual(pixel(x, 2), palette[x].map(channel => Math.round((channel + 255) / 2)));
	}
	assert.deepEqual(pixel(0, 0), [255, 255, 255]);
});

test('a standalone interference curve keeps one opaque ink across a varying palette', () => {
	const width = 80;
	const height = 20;
	const background = '#fff';
	const palette = paletteColumns('per-glyph', width, 2, background);
	assert.notDeepEqual(palette[20], palette[60]);
	const {pixel} = decode(png({
		width, height, background, palette,
		layers: [{
			commands: [
				{type: 'M', end: {x: 1, y: 10.5}},
				{type: 'C', control1: {x: 27, y: 4.5}, control2: {x: 53, y: 16.5}, end: {x: 79, y: 10.5}}
			],
			color: '#0f0',
			strokeWidth: 4,
			opacity: 0.32
		}]
	}));
	const ink = palette[width / 2];
	const shades = Array.from({length: 5}, (_, samples) =>
		String(ink.map(channel => Math.round((channel * samples + 255 * (4 - samples)) / 4)))
	);
	for (let x = 2; x < width - 2; x++) {
		const colors = Array.from({length: height}, (_, y) => String(pixel(x, y)));
		assert.ok(colors.includes(String(ink)), `column ${x} must contain opaque curve ink`);
		assert.ok(colors.every(color => shades.includes(color)), `column ${x} must use only one curve ink`);
	}
});

test('generated interference curves select an ink from the glyph slot centers', t => {
	t.mock.method(random, 'decimal', (min, max) => (min + max) / 2);
	t.mock.method(random, 'int', min => min);
	const options = normalize({interference: 'lines', palette: 'per-glyph', noise: 1, size: 3, width: 120}, true);
	const image = scene([...'AHH'], options, true);
	const curve = image.layers.find(layer => layer.strokeWidth);
	const first = Math.ceil(curve.commands[0].end.x);
	const last = Math.floor(curve.commands.at(-1).end.x);
	const ink = image.palette[20];
	assert.notDeepEqual(ink, image.palette[60]);
	const {pixel} = decode(png({...image, layers: [curve]}));
	for (let x = first; x < last; x++) {
		assert.deepEqual(pixel(x, 0), ink);
	}
});

test('explicit PNG palettes work with default color settings and inverse themes', () => {
	for (const palette of ['shared', 'analogous', 'per-glyph']) {
		const options = {interference: 'beaded', palette, inverse: true};
		const {data, text} = captcha.createStrong(options);
		const {pixel, width} = decode(data);
		assert.equal(text.length, 6);
		assert.equal(width, 210);
		assert.deepEqual(pixel(0, 0), [23, 25, 31]);
	}
	assert.throws(() => captcha.createStrong({palette: true}), TypeError);
	assert.throws(() => captcha.createStrong({palette: 'invalid'}), RangeError);
});

test('interference is range-checked and requires room beside each answer glyph', () => {
	assert.throws(() => captcha.createStrong({interference: 'typo'}), RangeError);
	assert.throws(() => captcha.createStrong({interference: true}), TypeError);
	assert.throws(() => captcha.createStrong({interference: 'mixed', interferenceDensity: 3}), RangeError);
	assert.throws(() => captcha.createStrong({interference: 'mixed', interferenceDensity: '2'}), TypeError);
	assert.throws(() => captcha.createStrong({interference: 'beaded', charPreset: 'AAB', ignoreChars: 'B'}),
		/at least two distinct drawable characters/);
	assert.throws(() => captcha.createStrong({interference: 'rings', width: 70}), /12 pixels per character/);
	assert.throws(() => captcha.createStrong({interference: 'decoy', height: 25}), /height of 26 pixels/);
	const {data} = captcha.createStrong({
		size: 16, width: 512, height: 256, noise: 20, interference: 'decoy', inverse: true
	});
	assert.equal(decode(data).width, 512);

	const options = normalize({interference: 'decoy', noise: 0});
	const {layers} = scene(['A'], options, false);
	assert.equal(layers.length, 1);
});

test('interference requires visible answer glyphs to be taller than the small marks', () => {
	for (const [width, height] of [[210, 68], [512, 256]]) {
		const options = {charPreset: 'H', fontSize: 8, width, height};
		assert.equal(captcha.createStrong(options).text, 'HHHHHH');
		assert.throws(() => captcha.createStrong({...options, interference: 'mixed'}), /too short/);
		assert.throws(() => captcha.createStrong({...options, interference: 'lines'}), /too short/);
	}
	assert.throws(() => captcha.createStrong({charPreset: 'A.', interference: 'rings'}), /too short/);
	assert.equal(captcha.createStrong({charPreset: 'I', interference: 'mixed'}).text, 'IIIIII');
});

function contour(points) {
	return points.map(([x, y], i) => ({type: i ? 'L' : 'M', end: {x, y}})).concat({type: 'Z'});
}

test('PNG rasterization preserves counters and antialiases edges', () => {
	const commands = [
		...contour([[2.5, 2.5], [13.5, 2.5], [13.5, 13.5], [2.5, 13.5]]),
		...contour([[6, 6], [6, 10], [10, 10], [10, 6]])
	];
	const {pixel} = decode(png({
		width: 16, height: 16, background: '#fff',
		layers: [{commands, color: '#000'}]
	}));
	assert.deepEqual(pixel(0, 0), [255, 255, 255]);
	assert.deepEqual(pixel(3, 3), [0, 0, 0]);
	assert.deepEqual(pixel(8, 8), [255, 255, 255]);
	assert.deepEqual(pixel(2, 3), [128, 128, 128]);
});

test('a barely visible distorted glyph uses the pixel-aligned outline', () => {
	const {pixel} = decode(png({
		width: 16,
		height: 16,
		background: '#fff',
		layers: [{
			commands: contour([[2, 2], [2.4, 2], [2.4, 2.4], [2, 2.4]]),
			color: '#000',
			fallback: () => contour([[8, 8], [11, 8], [11, 11], [8, 11]])
		}]
	}));
	assert.deepEqual(pixel(2, 2), [255, 255, 255]);
	assert.deepEqual(pixel(9, 9), [0, 0, 0]);
});
