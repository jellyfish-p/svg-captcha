'use strict';

const random = require('./random');
const {rgb, luminance, hslToRgb} = require('./color');

function wrapHue(hue) {
	return (hue + 1) % 1;
}

function hueAt(hues, position) {
	const positionInRange = Math.min(hues.length - 1, Math.max(0, position));
	const index = Math.floor(positionInRange);
	const next = hues[Math.min(index + 1, hues.length - 1)];
	const current = hues[index];
	const fraction = positionInRange - index;
	return interpolateHue(current, next, fraction);
}

function interpolateHue(current, next, fraction) {
	// Preserve the center hue and vary smoothly across the space between centers.
	const transition = fraction * fraction * (3 - 2 * fraction);
	const delta = wrapHue(next - current + 0.5) - 0.5;
	return wrapHue(current + delta * transition);
}

function hueDistance(first, second) {
	const distance = Math.abs(first - second);
	return Math.min(distance, 1 - distance);
}

function distinctAnchors(count, family, ink) {
	// Deduplicate by rendered RGB, since contrast correction can merge hues.
	const pool = Array.from({length: 128}, (_, index) => {
		const hue = wrapHue(family + index / 128);
		const channels = ink(hue);
		return {hue, channels, key: channels.join(',')};
	});
	const used = new Set();
	const anchors = [];
	for (let i = 0; i < count; i++) {
		const previous = anchors.at(-1);
		let candidates = pool.filter(entry => !used.has(entry.key));
		if (candidates.length === 0) {
			candidates = pool.filter(entry => entry.key !== previous.key);
			if (candidates.length === 0) {
				candidates = pool;
			}
		}
		if (previous) {
			const separated = candidates.filter(entry => hueDistance(previous.hue, entry.hue) >= 0.16);
			if (separated.length > 0) {
				candidates = separated;
			} else {
				const furthest = Math.max(...candidates.map(entry => hueDistance(previous.hue, entry.hue)));
				candidates = candidates.filter(entry => hueDistance(previous.hue, entry.hue) === furthest);
			}
		}
		const choice = candidates[random.int(0, candidates.length - 1)];
		used.add(choice.key);
		anchors.push(choice);
	}
	return anchors;
}

function perGlyphColumns(width, glyphCount, family, ink) {
	const anchors = distinctAnchors(glyphCount, family, ink);
	const centers = anchors.map((_, index) => Math.floor((index + 0.5) * width / glyphCount));
	let index = 0;
	return Array.from({length: width}, (_, x) => {
		if (index + 1 < centers.length && x >= centers[index + 1]) {
			index++;
		}
		const current = anchors[index];
		if (x <= centers[index] || index === centers.length - 1) {
			return current.channels;
		}
		const fraction = (x - centers[index]) / (centers[index + 1] - centers[index]);
		return ink(interpolateHue(current.hue, anchors[index + 1].hue, fraction));
	});
}

function ensureContrast(channels, backgroundLight, darkInk) {
	const meetsContrast = color => {
		const light = luminance(color);
		return darkInk ? (backgroundLight + 0.05) / (light + 0.05) >= 4.5 :
			(light + 0.05) / (backgroundLight + 0.05) >= 4.5;
	};
	if (meetsContrast(channels)) {
		return channels;
	}

	const neutral = darkInk ? 0 : 255;
	let closest = [neutral, neutral, neutral];
	let low = 0;
	let high = 1;
	// Find the least change toward black or white that meets the contrast floor.
	for (let iteration = 0; iteration < 10; iteration++) {
		const fraction = (low + high) / 2;
		const blended = channels.map(channel => Math.round(channel + (neutral - channel) * fraction));
		if (meetsContrast(blended)) {
			closest = blended;
			high = fraction;
		} else {
			low = fraction;
		}
	}
	return closest;
}

module.exports = function paletteColumns(mode, width, glyphCount, background) {
	const family = random.decimal(0, 1);
	const saturation = random.decimal(0.65, 0.83);
	const backgroundLight = luminance(rgb(background));
	const darkInk = backgroundLight > Math.sqrt(1.05 * 0.05) - 0.05;
	const lightness = darkInk ? random.decimal(0.18, 0.33) : random.decimal(0.68, 0.84);
	const ink = hue => ensureContrast(hslToRgb(hue, saturation, lightness), backgroundLight, darkInk);
	if (mode === 'shared' || (mode === 'per-glyph' && glyphCount === 1)) {
		return Array(width).fill(ink(family));
	}
	if (mode === 'per-glyph') {
		return perGlyphColumns(width, glyphCount, family, ink);
	}

	const hues = Array.from({length: glyphCount}, () => wrapHue(family + random.decimal(-0.11, 0.11)));
	return Array.from({length: width}, (_, x) => ink(hueAt(hues, (x + 0.5) * glyphCount / width - 0.5)));
};
