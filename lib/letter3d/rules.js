'use strict';

const {randomInt} = require('node:crypto');
const {choose, shuffle} = require('./random');
const {colors, directions} = require('./style');
const glyphs = require('./glyphs');

const combinations = [
	['direction'], ['color'], ['letter'],
	['direction', 'color'], ['direction', 'letter'], ['color', 'letter'],
	['direction', 'color', 'letter']
];

const colored = Object.keys(colors).filter(color => color !== 'gray');
const letters = Object.keys(glyphs);
const orientations = Object.keys(directions);

function normalize(options = {}) {
	if (options === null || typeof options !== 'object' || Array.isArray(options)) {
		throw new TypeError('Letter3d options must be an object');
	}
	const settings = {};
	for (const [key, fallback] of Object.entries({selection: 'mixed', mode: 'mixed', useColor: true, constraintCount: undefined})) {
		const value = Object.hasOwn(options, key) ? options[key] : undefined;
		settings[key] = value === undefined ? fallback : value;
	}
	const {selection, mode, useColor, constraintCount} = settings;
	if (typeof selection !== 'string' || typeof mode !== 'string' || typeof useColor !== 'boolean') {
		throw new TypeError('Letter3d selection and mode must be strings and useColor must be a boolean');
	}
	if (!['single', 'multiple', 'mixed'].includes(selection)) {
		throw new RangeError('Letter3d selection must be single, multiple, or mixed');
	}
	if (!['direct', 'relative', 'mixed'].includes(mode)) {
		throw new RangeError('Letter3d mode must be direct, relative, or mixed');
	}
	if (constraintCount !== undefined) {
		if (typeof constraintCount !== 'number') {
			throw new TypeError('Letter3d constraintCount must be a number');
		}
		if (![1, 2, 3].includes(constraintCount) || (!useColor && constraintCount === 3)) {
			throw new RangeError(`Letter3d constraintCount must be between 1 and ${useColor ? 3 : 2}`);
		}
	}
	return settings;
}

function profiles(palette) {
	return orientations.flatMap(direction => palette.flatMap(color => letters.map(letter => ({direction, color, letter}))));
}

function matches(object, constraints) {
	return Object.entries(constraints).every(([key, value]) => object[key] === value);
}

function sameLabel(a, b) {
	return a.letter === b.letter && a.color === b.color;
}

function generatePuzzle(settings) {
	const selection = settings.selection === 'mixed' ? choose(['single', 'multiple']) : settings.selection;
	const mode = settings.mode === 'mixed' ? choose(['direct', 'relative']) : settings.mode;
	const attributes = choose(combinations.filter(attributes => (
		(mode !== 'relative' || attributes.includes('direction')) &&
		(settings.useColor || !attributes.includes('color')) &&
		(settings.constraintCount === undefined || attributes.length === settings.constraintCount)
	)));
	const candidates = profiles(settings.useColor ? colored : ['gray']);
	const values = choose(candidates);
	const constraints = Object.fromEntries(attributes.map(key => [key, values[key]]));
	const matching = candidates.filter(object => matches(object, constraints));
	const reference = mode === 'relative' ? {...choose(candidates.filter(object =>
		object.direction === constraints.direction && matching.some(target => !sameLabel(target, object))
	))} : undefined;
	const available = reference ? candidates.filter(object => !sameLabel(object, reference)) : candidates;
	const targetCount = selection === 'single' ? 1 : randomInt(2, 4);
	const targetProfiles = available.filter(object => matches(object, constraints));
	const targets = Array.from({length: targetCount}, () => ({...choose(targetProfiles)}));
	const distractors = attributes.map(attribute => ({...choose(available.filter(object => attributes.every(key =>
		key === attribute ? object[key] !== constraints[key] : object[key] === constraints[key]
	)))}));
	const required = reference ? [...targets, ...distractors, reference] : [...targets, ...distractors];
	const distractorProfiles = available.filter(object => !matches(object, constraints));
	const fillers = Array.from({length: randomInt(7, 10) - required.length}, () => ({...choose(distractorProfiles)}));
	shuffle([...required, ...fillers]).forEach((object, index) => { object.id = index + 1; });
	return {selection, mode, constraints, reference, targets, distractors, fillers};
}

function validatePuzzle({reference, constraints, targets, selection}, objects) {
	if (reference) {
		const labeled = objects.filter(object => sameLabel(object, reference));
		if (labeled.length !== 1 || labeled[0].id !== reference.id || labeled[0].direction !== constraints.direction) {
			throw new Error('Letter3d scene does not have the intended unique reference');
		}
	}
	const eligible = objects.filter(object => object.id !== reference?.id);
	const matching = eligible.filter(object => matches(object, constraints));
	const targetIds = matching.map(object => object.id);
	const uniqueTargets = new Set(targetIds);
	if ((selection === 'single' ? targetIds.length !== 1 : ![2, 3].includes(targetIds.length)) ||
		uniqueTargets.size !== targets.length || targetIds.length !== targets.length ||
		!targets.every(object => uniqueTargets.has(object.id))) {
		throw new Error('Letter3d scene does not have the intended targets');
	}
	for (const attribute of Object.keys(constraints)) {
		const relaxed = {...constraints};
		delete relaxed[attribute];
		if (!eligible.some(object => !uniqueTargets.has(object.id) && matches(object, relaxed))) {
			throw new Error('Letter3d scene has a redundant constraint');
		}
	}
	return targetIds;
}

function describe({color, letter}) {
	const label = colors[color]?.label;
	if (letter) {
		return `${label || '字母'} ${letter}`;
	}
	return `${label || ''}字母`;
}

function promptFor({selection, constraints, reference}) {
	const action = selection === 'single' ? '请点选' : '请选出所有';
	const target = describe(constraints);
	if (reference) {
		const label = describe(reference);
		return matches(reference, constraints) ? `除了${label}，${action}和它朝向相同的${target}。` :
			`${action}和${label} 朝向相同的${target}。`;
	}
	const direction = directions[constraints.direction];
	return `${action}${direction ? `${direction.label}的` : ''}${target}。`;
}

module.exports = {normalize, generatePuzzle, validatePuzzle, promptFor};
