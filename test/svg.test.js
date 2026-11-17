'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const {test} = require('node:test');
const captcha = require('..');

function glyphs(svg) {
	return [...svg.matchAll(/<path fill="#[0-9a-f]{3,6}" d="([^"]+)"\/>/gi)].map(match => match[1]);
}

function noiseLines(svg) {
	return (svg.match(/<path d="[^"]+" stroke="#[0-9a-f]{3,6}" fill="none"\/>/gi) || []).length;
}

test('default SVG APIs keep their string data and render the full answer', () => {
	const challenge = captcha.create();
	assert.match(challenge.data, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="150" height="50" viewBox="0,0,150,50">/);
	assert.ok(challenge.data.endsWith('</svg>'));
	assert.match(challenge.text, /^[0-9a-zA-Z]{4}$/);
	assert.equal(glyphs(challenge.data).length, challenge.text.length);
	assert.equal(noiseLines(challenge.data), 1);
	assert.equal(glyphs(captcha('ABBA')).length, 4);
	assert.equal(glyphs(captcha()).length, 4);
	assert.throws(() => captcha(''), RangeError);
	assert.throws(() => captcha('😀'), /no glyph/);
	assert.throws(() => captcha(123), TypeError);
});

test('math challenge can be created with omitted, zero or maximum bounds', () => {
	for (const [input, min, max, glyphCount] of [
		[undefined, 2, 18, 3],
		[{mathMin: 0, mathMax: 0}, 0, 0, 3],
		[{mathMin: 999, mathMax: 999, mathOperator: '+'}, 1998, 1998, 7],
		[{mathMin: 999, mathMax: 999, mathOperator: '-'}, 0, 0, 7]
	]) {
		const {text, data} = captcha.createMathExpr(input);
		assert.ok(Number(text) >= min && Number(text) <= max);
		assert.equal(glyphs(data).length, glyphCount);
	}

	assert.throws(() => captcha.createMathExpr({mathMin: 4, mathMax: 3}), RangeError);
	assert.throws(() => captcha.createMathExpr({mathOperator: '*'}), RangeError);
	assert.throws(() => captcha.createMathExpr({width: 24, mathMin: 0, mathMax: 20}), /6 pixels per character/);
	assert.equal(captcha.createMathExpr({width: 30, mathMin: 20, mathMax: 20}).text, '40');
});

test('SVG draws valid path coordinates on small, odd canvases and supports zero noise', () => {
	for (let i = 0; i < 16; i++) {
		const {data} = captcha.create({
			width: 41, height: 19, fontSize: 256, charPreset: 'MWjq', noise: 0
		});
		assert.match(data, /width="41" height="19" viewBox="0,0,41,19"/);
		assert.equal(noiseLines(data), 0);
		assert.equal(glyphs(data).length, 4);
		for (const path of glyphs(data)) {
			assert.match(path, /^[MLQCZ0-9. -]+$/);
			const numbers = path.match(/-?\d+\.\d+/g).map(Number);
			for (let j = 0; j < numbers.length; j += 2) {
				assert.ok(numbers[j] > 0 && numbers[j] < 41, `x coordinate: ${numbers[j]}`);
				assert.ok(numbers[j + 1] > 0 && numbers[j + 1] < 19, `y coordinate: ${numbers[j + 1]}`);
			}
		}
	}
	assert.equal(noiseLines(captcha.create({width: 41, height: 19, noise: 20}).data), 20);
	assert.throws(() => captcha.create({width: 16, size: 16}), /6 pixels per character/);
});

test('valid hexadecimal backgrounds are the only strings serialized as SVG fills', () => {
	assert.match(captcha.create({background: '#a1B'}).data, /<rect width="100%" height="100%" fill="#a1B"\/>/);
	assert.match(captcha.create({background: '#abcDEF'}).data, /<rect width="100%" height="100%" fill="#abcDEF"\/>/);

	for (const background of ['red', '#1234', '#abcdex', '#ab\n', '#abcde\n', 'url(#x)', '#fff" onclick="x']) {
		assert.throws(() => captcha.create({background}), RangeError);
	}

	assert.throws(() => captcha.create({width: '150" onload="x'}), TypeError);
	assert.throws(() => captcha('A', {height: '50"><script>x</script>'}), TypeError);
	const input = Object.assign(Object.create({width: 'bad', background: 'bad'}), {font: null, x: NaN, y: NaN});
	assert.match(captcha.create(input).data, / width="150" height="50"/);
});

test('all public entry points reject invalid options before rendering or sampling', () => {
	assert.throws(() => captcha.create(null), TypeError);
	assert.throws(() => captcha.createStrong('bad'), TypeError);
	assert.throws(() => captcha.createMathExpr([]), TypeError);
	assert.throws(() => captcha.randomText({color: 'false'}), TypeError);
	assert.throws(() => captcha.randomText('4'), TypeError);
	assert.throws(() => captcha.randomText({size: '4'}), TypeError);

	for (const input of [
		{size: -1}, {size: 0}, {size: 17}, {size: 1.5}, {width: Infinity}, {width: 513},
		{height: 257}, {noise: -1}, {noise: NaN}, {noise: 21}, {fontSize: 0},
		{fontSize: 257}, {mathMin: -1}, {mathMax: 1000}, {charPreset: 'A'.repeat(257)}
	]) {
		for (const generate of [captcha.create, captcha.createStrong, captcha.createMathExpr, captcha.randomText]) {
			assert.throws(() => generate(input), RangeError);
		}
	}
});

test('global settings apply everywhere and local values take precedence, including zero', () => {
	const changed = ['size', 'charPreset', 'ignoreChars', 'noise', 'width', 'mathMin', 'mathMax', 'mathOperator'];
	try {
		// Explicitly setting the default SVG size and width also overrides the strong defaults.
		Object.assign(captcha.options, {
			size: 4, charPreset: 'AB', ignoreChars: 'B', noise: 3, width: 150,
			mathMin: 0, mathMax: 0, mathOperator: '-'
		});
		assert.equal(captcha.randomText(), 'AAAA');
		assert.equal(captcha.randomText(2), 'AA');
		assert.equal(captcha.create({charPreset: 'B', ignoreChars: '', size: 2}).text, 'BB');
		assert.equal(glyphs(captcha()).length, 4);
		assert.equal(captcha.createMathExpr().text, '0');
		assert.equal(noiseLines(captcha.create({noise: 0}).data), 0);

		const strong = captcha.createStrong();
		assert.equal(strong.text, 'AAAA');
		assert.equal(strong.data.readUInt32BE(16), 150);
	} finally {
		for (const key of changed) {
			delete captcha.options[key];
		}
	}
	assert.equal(captcha.createStrong().text.length, 6);
});

test('sealing or freezing global options preserves explicit and profile defaults', () => {
	const cwd = path.join(__dirname, '..');
	for (const operation of ['seal', 'freeze']) {
		execFileSync(process.execPath, ['-e', `
			const assert = require('node:assert/strict');
			const captcha = require('.');
			const {normalize} = require('./lib/option-manager');
			captcha.options.noise = 0;
			Object.${operation}(captcha.options);
			const strong = normalize({}, true);
			assert.equal(strong.size, 6);
			assert.equal(strong.width, 210);
			assert.equal(strong.noise, 0);
		`], {cwd});
	}
});

test('malformed PNG-only settings are isolated from the SVG APIs and randomText', () => {
	try {
		captcha.options.interference = 'bad';
		captcha.options.interferenceDensity = 8;
		captcha.options.palette = 'bad';
		assert.equal(captcha.randomText().length, 4);
		assert.equal(glyphs(captcha()).length, 4);
		assert.equal(glyphs(captcha.create().data).length, 4);
		assert.equal(glyphs(captcha.createMathExpr().data).length, 3);
		assert.throws(() => captcha.createStrong({interference: 'none'}), /interferenceDensity/);
		assert.throws(() => captcha.createStrong({interferenceDensity: 1}), /interference must be/);
		assert.throws(() => captcha.createStrong({interference: 'none', interferenceDensity: 1}), /palette must be/);
		assert.equal(captcha.createStrong({
			interference: 'none', interferenceDensity: 1, palette: 'default'
		}).text.length, 6);
	} finally {
		delete captcha.options.interference;
		delete captcha.options.interferenceDensity;
		delete captcha.options.palette;
	}
});
