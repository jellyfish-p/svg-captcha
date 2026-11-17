'use strict';

const {randomInt} = require('node:crypto');

function int(min, max) {
	return randomInt(Math.ceil(min), Math.floor(max) + 1);
}

function decimal(min, max) {
	return min + (max - min) * (randomInt(65536) / 65535);
}

function shuffle(items) {
	for (let i = items.length - 1; i > 0; i--) {
		const j = int(0, i);
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

function captchaText(size, alphabet) {
	let text = '';
	for (let i = 0; i < size; i++) {
		text += alphabet[int(0, alphabet.length - 1)];
	}
	return text;
}

function mathExpr(min, max, operator) {
	const left = int(min, max);
	const right = int(min, max);
	if (operator !== '+' && operator !== '-') {
		operator = int(0, 1) === 0 ? '+' : '-';
	}
	const text = String(operator === '+' ? left + right : left - right);
	return {text, equation: `${left}${operator}${right}`};
}

module.exports = {int, decimal, shuffle, captchaText, mathExpr};
