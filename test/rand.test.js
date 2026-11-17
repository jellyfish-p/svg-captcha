'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const captcha = require('..');
const random = require('../lib/random');
const {alphabet, normalize} = require('../lib/option-manager');

test('random integer ranges are inclusive and contain only integers', () => {
	assert.equal(random.int(0, 0), 0);
	assert.equal(random.int(1.5, 2.5), 2);
	for (let i = 0; i < 100; i++) {
		const value = random.int(-2.5, 4.5);
		assert.ok(Number.isInteger(value) && value >= -2 && value <= 4);
	}
});

test('challenge creation and rendering do not depend on Math.random', t => {
	t.mock.method(Math, 'random', () => assert.fail('Math.random was used'));
	assert.equal(captcha.create().text.length, 4);
	assert.equal(captcha.createStrong().text.length, 6);
	assert.match(captcha.createMathExpr().text, /^\d+$/);
	assert.equal(captcha.randomText(16).length, 16);
});

test('math operations use the supplied bounds, include zero and match the answer', () => {
	assert.deepEqual(random.mathExpr(0, 0, '+'), {text: '0', equation: '0+0'});
	assert.deepEqual(random.mathExpr(999, 999, '+'), {text: '1998', equation: '999+999'});
	assert.deepEqual(random.mathExpr(0, 0, '-'), {text: '0', equation: '0-0'});
	for (const operator of ['+', '-', '+/-', '+-']) {
		for (let i = 0; i < 16; i++) {
			const {equation, text} = random.mathExpr(0, 20, operator);
			const [, left, sign, right] = equation.match(/^(\d+)([+-])(\d+)$/);
			if (operator.length === 1) {
				assert.equal(sign, operator);
			}
			assert.ok(Number(left) <= 20 && Number(right) <= 20);
			assert.equal(Number(text), sign === '+' ? Number(left) + Number(right) : left - right);
		}
	}
});

test('character filtering and deduplication preserve a usable alphabet', () => {
	assert.deepEqual(alphabet(normalize({charPreset: 'AAA1BC', ignoreChars: '1B'})), ['A', 'C']);
	assert.equal(captcha.randomText({size: 5, charPreset: 'AA1', ignoreChars: '1'}), 'AAAAA');
	assert.throws(() => captcha.randomText({charPreset: 'AAA', ignoreChars: 'A'}), RangeError);
	assert.throws(() => captcha.randomText({charPreset: ''}), RangeError);
	assert.throws(() => captcha.randomText({charPreset: 'A '}), /no drawable outline/);
	assert.throws(() => captcha.randomText({charPreset: 'A😀'}), /no glyph/);
	assert.throws(() => captcha.randomText({charPreset: 'A\ud800'}), /no glyph/);
});
