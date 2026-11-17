'use strict';

// Local regression probe for the old SVG outline-template weakness. This is
// intentionally independent from the visual-only model experiment.
const path = require('node:path');

const directory = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const count = Number(process.argv[3] || 1000);
if (!Number.isInteger(count) || count < 1 || count > 10000) {
	throw new RangeError('Sample count must be an integer from 1 to 10000');
}
const captcha = require(directory);

function paths(svg) {
	return Array.from(svg.matchAll(/<path fill="[^"]*" d="([^"]*)"\/>/g), match => match[1]);
}

function shape(data) {
	const commands = (data.match(/[MLQCZ]/g) || []).join('');
	const numbers = (data.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
	return {commands, numbers, normalized: numbers.map((number, index) => number - numbers[index % 2])};
}

const dictionary = Array.from(captcha.options.charPreset, character => ({character, ...shape(paths(captcha(character, {noise: 0}))[0])}));
const topology = new Map();
for (const entry of dictionary) {
	topology.set(entry.commands, (topology.get(entry.commands) || 0) + 1);
}

function recover(svg) {
	return paths(svg).map(data => {
		const observed = shape(data);
		let best;
		for (const reference of dictionary) {
			if (reference.commands !== observed.commands || reference.normalized.length !== observed.normalized.length) {
				continue;
			}
			const error = observed.normalized.reduce((sum, number, index) => sum + (number - reference.normalized[index]) ** 2, 0) / observed.normalized.length;
			if (!best || error < best.error) {
				best = {character: reference.character, error, x: observed.numbers[0] - reference.numbers[0]};
			}
		}
		return best || {character: '?', x: 0};
	}).sort((a, b) => a.x - b.x).map(entry => entry.character).join('');
}

let solved = 0;
const started = performance.now();
for (let index = 0; index < count; index++) {
	const sample = captcha.create();
	if (recover(sample.data) === sample.text) {
		solved++;
	}
}
console.log(JSON.stringify({directory, solved, total: count, uniqueCommandTopologies: [...topology.values()].filter(value => value === 1).length, alphabetSize: dictionary.length, elapsedMsIncludingGeneration: Math.round(performance.now() - started)}, null, 2));
