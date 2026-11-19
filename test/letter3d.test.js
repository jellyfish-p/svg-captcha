'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const captcha = require('..');
const letter3d = require('../letter3d');
const {projectGlyph} = require('../lib/letter3d/geometry');
const {layout} = require('../lib/letter3d/layout');
const {rasterize} = require('../lib/letter3d/raster');
const {generatePuzzle, normalize, promptFor, validatePuzzle} = require('../lib/letter3d/rules');

function pointAt(solution, index) {
	return {
		x: (index % solution.width + 0.5) / solution.width,
		y: (Math.floor(index / solution.width) + 0.5) / solution.height
	};
}

test('both public entries issue a private solution and a single public PNG', () => {
	assert.equal(captcha.letter3d, letter3d);
	const {challenge, solution} = letter3d.create();
	assert.deepEqual(Object.keys(challenge).sort(), ['data', 'height', 'prompt', 'selection', 'width']);
	assert.ok(['single', 'multiple'].includes(challenge.selection));
	assert.match(challenge.prompt, /[\u4e00-\u9fff]/u);
	assert.ok(Buffer.isBuffer(challenge.data));
	assert.equal(challenge.data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
	assert.equal(challenge.data.readUInt32BE(16), challenge.width);
	assert.equal(challenge.data.readUInt32BE(20), challenge.height);
	assert.equal(solution.width, challenge.width);
	assert.equal(solution.height, challenge.height);
	assert.equal(solution.selection, challenge.selection);
	assert.ok(solution.objectAtPixel instanceof Uint8Array);
	assert.equal(solution.objectAtPixel.length, challenge.width * challenge.height);
	const chunks = [];
	for (let offset = 8; offset < challenge.data.length;) {
		chunks.push(challenge.data.toString('ascii', offset + 4, offset + 8));
		offset += challenge.data.readUInt32BE(offset) + 12;
	}
	assert.ok(chunks.every(type => ['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)));
});

test('pixel hits verify through every supported selection, prompt mode, count and color setting', () => {
	for (const selection of ['single', 'multiple']) {
		for (const mode of ['direct', 'relative']) {
			for (const useColor of [true, false]) {
				for (let constraintCount = 1; constraintCount <= (useColor ? 3 : 2); constraintCount++) {
					const {challenge, solution} = letter3d.create({selection, mode, useColor, constraintCount});
					assert.equal(challenge.selection, selection);
					const {targetIds, objectAtPixel} = solution;
					assert.equal(new Set(targetIds).size, targetIds.length);
					assert.ok(selection === 'single' ? targetIds.length === 1 : [2, 3].includes(targetIds.length));
					const pixels = targetIds.map(id => objectAtPixel.indexOf(id));
					assert.ok(pixels.every(index => index >= 0));
					const points = pixels.map(index => pointAt(solution, index)).reverse();
					assert.equal(letter3d.verify(solution, points), true);
					assert.equal(letter3d.verify(solution, points.slice(1)), false);
					assert.equal(letter3d.verify(solution, [...points, points[0]]), false);
					const background = objectAtPixel.indexOf(0);
					const distractor = objectAtPixel.findIndex(id => id && !targetIds.includes(id));
					for (const index of [background, distractor]) {
						assert.ok(index >= 0);
						assert.equal(letter3d.verify(solution, [pointAt(solution, index), ...points.slice(1)]), false);
					}
				}
			}
		}
	}
});

test('two different pixels of the same letter cannot satisfy two targets', () => {
	const {solution} = letter3d.create({selection: 'multiple'});
	const {targetIds, objectAtPixel} = solution;
	const points = targetIds.map(id => pointAt(solution, objectAtPixel.indexOf(id)));
	const last = objectAtPixel.lastIndexOf(targetIds[0]);
	assert.notEqual(last, objectAtPixel.indexOf(targetIds[0]));
	points[1] = pointAt(solution, last);
	assert.equal(letter3d.verify(solution, points), false);
});

test('every condition has a near miss, and a reference is unique and excluded', () => {
	for (const mode of ['relative', 'direct']) {
		for (const useColor of [true, false]) {
			for (let constraintCount = 1; constraintCount <= (useColor ? 3 : 2); constraintCount++) {
				const puzzle = generatePuzzle(normalize({mode, useColor, constraintCount}));
				const {reference, targets, distractors, fillers, constraints} = puzzle;
				const candidates = [...targets, ...distractors, ...fillers];
				const attributes = Object.entries(constraints);
				assert.equal(attributes.length, constraintCount);
				assert.equal(Boolean(reference), mode === 'relative');
				if (reference) {
					assert.equal(constraints.direction, reference.direction);
					assert.ok(candidates.every(glyph => glyph.color !== reference.color || glyph.letter !== reference.letter));
				}
				const misses = glyph => attributes.filter(([key, value]) => glyph[key] !== value);
				assert.deepEqual(candidates.filter(glyph => misses(glyph).length === 0), targets);
				for (const [attribute] of attributes) {
					assert.ok(distractors.some(glyph => {
						const differences = misses(glyph);
						return differences.length === 1 && differences[0][0] === attribute;
					}));
				}
				if (!useColor) {
					assert.equal(Object.hasOwn(constraints, 'color'), false);
					assert.equal(new Set(candidates.map(glyph => glyph.color)).size, 1);
				}
			}
		}
	}
});

test('the Chinese prompt and the answer agree for all seven direct and four relative rules', () => {
	const target = {id: 1, color: 'orange', letter: 'F', direction: 'right'};
	const alternatives = {color: 'purple', letter: 'E', direction: 'front'};
	const forms = [
		[['color'], '橙色字母'], [['letter'], '字母 F'], [['direction'], '朝屏幕右侧的字母'],
		[['color', 'letter'], '橙色 F'], [['direction', 'color'], '朝屏幕右侧的橙色字母'],
		[['direction', 'letter'], '朝屏幕右侧的字母 F'], [['direction', 'color', 'letter'], '朝屏幕右侧的橙色 F']
	];
	for (const [attributes, direct] of forms) {
		const constraints = Object.fromEntries(attributes.map(key => [key, target[key]]));
		const reference = {id: 9, color: 'blue', letter: 'T', direction: 'right'};
		const references = attributes.includes('direction') ? [undefined, reference] : [undefined];
		for (const anchor of references) {
			for (const selection of ['single', 'multiple']) {
				const targets = selection === 'single' ? [target] : [target, {...target, id: 2}];
				const objects = [...targets, ...attributes.map((key, i) => ({...target, id: i + 3, [key]: alternatives[key]}))];
				if (anchor) objects.push(anchor);
				const rule = {selection, targets, constraints, reference: anchor};
				const action = selection === 'single' ? '请点选' : '请选出所有';
				const relativeNoun = direct.replace('朝屏幕右侧的', '');
				let expected = action + direct;
				if (anchor) {
					expected = attributes.length === 1 ? '除了蓝色 T，' + action + '和它朝向相同的字母' :
						action + '和蓝色 T 朝向相同的' + relativeNoun;
				}
				assert.equal(promptFor(rule), expected + '。');
				assert.deepEqual(validatePuzzle(rule, objects), targets.map(glyph => glyph.id));
			}
		}
	}
});

test('points follow the visible face, inner wall and outline, preserving the hole in R', () => {
	const width = 110;
	const height = 110;
	const {scanlines, objectAtPixel} = rasterize(width, height, [{
		object: {id: 1, color: 'blue'}, geometry: projectGlyph('R', 'front', 75), x: 55, y: 55
	}]);
	const solution = {width, height, objectAtPixel, targetIds: [1], selection: 'single'};
	function sample(x, y, expected) {
		assert.equal(letter3d.verify(solution, [pointAt(solution, y * width + x)]), expected);
		const offset = y * (1 + 3 * width) + 1 + 3 * x;
		return scanlines.readUIntBE(offset, 3);
	}
	const face = sample(35, 42, true);
	const innerWall = sample(55, 49, true);
	const outline = sample(25, 40, true);
	assert.ok(outline < innerWall && innerWall < face);
	assert.equal(sample(55, 41, false), sample(3, 3, false));
});

test('a scene covers the nominal size range and hits follow the scaled glyphs', () => {
	// Identical letters and orientations isolate size variation from perspective.
	const unit = projectGlyph('T', 'front', 1).bounds;
	for (const count of [7, 8, 9]) {
		const objects = Array.from({length: count}, (_, i) => ({
			id: i + 1, letter: 'T', direction: 'front', color: 'blue'
		}));
		const width = 480;
		const height = 360;
		const placements = layout(width, height, {targets: objects, distractors: [], fillers: []});
		assert.equal(placements.length, count);
		const sizes = placements.map(({geometry, object}) => ({
			id: object.id, size: (geometry.bounds.bottom - geometry.bounds.top) / (unit.bottom - unit.top)
		})).sort((a, b) => a.size - b.size);
		const band = (90 - 54) / count;
		sizes.forEach(({size}, i) => {
			assert.ok(size >= 54 + i * band - 1e-8 && size <= 54 + (i + 1) * band + 1e-8);
		});
		const {objectAtPixel} = rasterize(width, height, placements);
		const targetIds = [sizes[0].id, sizes.at(-1).id];
		const solution = {width, height, selection: 'multiple', objectAtPixel, targetIds};
		const points = targetIds.map(id => {
			const pixel = objectAtPixel.indexOf(id);
			assert.ok(pixel >= 0);
			return pointAt(solution, pixel);
		});
		assert.equal(letter3d.verify(solution, points), true);
	}
});

test('point verification respects pixel boundaries and rejects invalid client payloads', () => {
	const solution = {
		selection: 'single', width: 2, height: 2,
		objectAtPixel: Uint8Array.of(0, 2, 0, 1), targetIds: [1]
	};
	assert.equal(letter3d.verify(solution, [{x: 0.5, y: 0.5}]), true);
	assert.equal(letter3d.verify(solution, [{x: 1 - Number.EPSILON, y: 1 - Number.EPSILON}]), true);
	for (const coordinate of [-1, 0, 0.5 - Number.EPSILON, 1, NaN, Infinity, '0.5', null, undefined]) {
		assert.equal(letter3d.verify(solution, [{x: coordinate, y: 0.5}]), false);
		assert.equal(letter3d.verify(solution, [{x: 0.5, y: coordinate}]), false);
	}
	for (const input of [undefined, null, '1', {}, [], [null], [0], [{}], new Array(1), [[0.5, 0.5]]]) {
		assert.equal(letter3d.verify(solution, input), false);
	}
});

test('unsupported options and three monochrome constraints are rejected before generation', () => {
	for (const options of [{mode: 'grid'}, {selection: 'both'}, {constraintCount: 0},
		{constraintCount: 4}, {constraintCount: 1.5}, {useColor: false, constraintCount: 3}]) {
		assert.throws(() => letter3d.create(options), RangeError);
	}
	for (const options of [null, [], true, {useColor: 'false'}, {constraintCount: '2'}]) {
		assert.throws(() => letter3d.create(options), TypeError);
	}
});
