'use strict';

const random = require('./random');
const {options, normalize, alphabet, inputText, outline, loadFont} = require('./option-manager');
const {scene, svg, validateWidth, validateStrongLayout} = require('./render');
const png = require('./png');

function generateText(settings) {
	return random.captchaText(settings.size, alphabet(settings));
}

function createCaptcha(text, input) {
	const settings = normalize(input);
	const chars = text === undefined ? [...generateText(settings)] : inputText(text);
	return svg(scene(chars, settings, false));
}

function create(input) {
	const settings = normalize(input);
	const text = generateText(settings);
	return {text, data: svg(scene([...text], settings, false))};
}

function createStrong(input) {
	const settings = normalize(input, true);
	const chars = alphabet(settings);
	validateStrongLayout(chars, settings);
	const text = random.captchaText(settings.size, chars);
	return {text, data: png(scene([...text], settings, true, chars))};
}

function createMathExpr(input) {
	const settings = normalize(input);
	const {mathMin, mathMax, mathOperator} = settings;
	validateWidth(settings.width, 2 * String(mathMax).length + 1);
	const required = new Set(mathOperator === '+' || mathOperator === '-' ? mathOperator : '+-');
	for (let number = mathMin; number <= mathMax; number++) {
		for (const digit of String(number)) {
			required.add(digit);
		}
	}
	for (const char of required) {
		outline(char);
	}
	const {text, equation} = random.mathExpr(mathMin, mathMax, mathOperator);
	return {text, data: svg(scene([...equation], settings, false))};
}

function randomText(input) {
	return generateText(normalize(typeof input === 'number' ? {size: input} : input));
}

module.exports = createCaptcha;
module.exports.randomText = randomText;
module.exports.create = create;
module.exports.createStrong = createStrong;
module.exports.createMathExpr = createMathExpr;
module.exports.options = options;
module.exports.loadFont = loadFont;
