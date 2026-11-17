'use strict';

// Generate fresh, shuffled PNG-only experiments. Scoring is performed with
// vision-benchmark.js; answer manifests remain outside the blind directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const [configFile, blindPath, answerPath] = process.argv.slice(2);
if (!configFile || !blindPath || !answerPath) {
	throw new Error('Usage: node scripts/vision-round.js CONFIG BLIND_DIR PRIVATE_MANIFEST');
}
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
if (!Array.isArray(config.groups) || config.groups.length === 0) {
	throw new TypeError('At least one experiment group is required');
}
const groupNames = new Set();
for (const group of config.groups) {
	if (!group || typeof group.name !== 'string' || group.name.trim() !== group.name ||
		group.name.length === 0 || groupNames.has(group.name)) {
		throw new Error('Group names must be unique, non-empty strings without surrounding whitespace');
	}
	groupNames.add(group.name);
}
const blindDirectory = path.resolve(blindPath);
const privateManifest = path.resolve(answerPath);
if (fs.existsSync(blindDirectory) || fs.existsSync(privateManifest)) {
	throw new Error('Fresh output paths are required to preserve evidence');
}
if (privateManifest.toLowerCase() === blindDirectory.toLowerCase() ||
	privateManifest.toLowerCase().startsWith(blindDirectory.toLowerCase() + path.sep)) {
	throw new Error('Keep answers outside the blind image directory');
}
if (!Number.isInteger(config.countPerGroup) || config.countPerGroup < 1 || config.countPerGroup > 100) {
	throw new RangeError('countPerGroup must be from 1 to 100');
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function sourceHash(directory) {
	const files = ['index.js', ...fs.readdirSync(path.join(directory, 'lib')).filter(name => name.endsWith('.js')).sort().map(name => 'lib/' + name)];
	return hash(files.map(file => file + '\n' + fs.readFileSync(path.join(directory, file), 'utf8')).join('\n'));
}
function writeJson(filename, value) {
	fs.mkdirSync(path.dirname(filename), {recursive: true});
	fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
}
const samples = [];
const groups = [];
for (const group of config.groups) {
	const directory = path.resolve(group.module);
	const generator = require(directory);
	const options = {...config.options, ...group.options};
	const count = group.count ?? config.countPerGroup;
	if (!Number.isInteger(count) || count < 1 || count > 100) {
		throw new RangeError('Group count must be from 1 to 100');
	}
	groups.push({name: group.name, sourceSha256: sourceHash(directory), options, count});
	for (let index = 0; index < count; index++) {
		const generated = generator.createStrong(options);
		if (!Buffer.isBuffer(generated.data)) {
			throw new TypeError('A PNG Buffer is required');
		}
		samples.push({group: group.name, text: generated.text, bytes: generated.data});
	}
}
for (let i = samples.length - 1; i > 0; i--) {
	const j = crypto.randomInt(i + 1);
	[samples[i], samples[j]] = [samples[j], samples[i]];
}
fs.mkdirSync(blindDirectory, {recursive: true});
const manifest = samples.map((sample, index) => {
	const id = 's' + String(index + 1).padStart(3, '0');
	fs.writeFileSync(path.join(blindDirectory, id + '.png'), sample.bytes);
	return {
		id, group: sample.group, text: sample.text, sha256: hash(sample.bytes),
		width: sample.bytes.readUInt32BE(16), height: sample.bytes.readUInt32BE(20),
		length: Array.from(sample.text).length
	};
});
writeJson(privateManifest, {createdAt: new Date().toISOString(), round: config.round, groups, samples: manifest});
writeJson(path.join(blindDirectory, 'images.json'), manifest.map(({id, sha256, width, height, length}) => ({id, sha256, width, height, length})));
console.log(JSON.stringify({round: config.round, samples: manifest.length, groups: groups.map(group => ({name: group.name, sourceSha256: group.sourceSha256})), blindDirectory}));
