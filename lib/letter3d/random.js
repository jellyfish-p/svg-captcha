'use strict';

const {randomInt} = require('node:crypto');

function choose(values) {
	return values[randomInt(values.length)];
}

function shuffle(values) {
	for (let i = values.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[values[i], values[j]] = [values[j], values[i]];
	}
	return values;
}

function between(min, max) {
	const precision = 2 ** 32;
	return min + (max - min) * (randomInt(precision) / precision);
}

module.exports = {choose, shuffle, between};
