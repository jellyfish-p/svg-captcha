'use strict';

const random = require('./random');

function rgb(hex) {
	const digits = hex.slice(1);
	const pairs = digits.length === 3 ? [...digits].map(ch => ch + ch) : digits.match(/../g);
	return pairs.map(pair => Number.parseInt(pair, 16));
}

function grey(min, max) {
	const digit = random.int(min, max).toString(16);
	return '#' + digit.repeat(3);
}

function luminance(channels) {
	const [r, g, b] = channels.map(channel => {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslToRgb(hue, saturation, lightness) {
	const q = lightness < 0.5 ?
		lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
	const p = 2 * lightness - q;

	return [hue + 1 / 3, hue, hue - 1 / 3].map(value => {
		const h = (value + 1) % 1;
		const fraction = Math.max(0, Math.min(1, 6 * h, 4 - 6 * h));
		return Math.round((p + (q - p) * fraction) * 255);
	});
}

function color(background) {
	// Pick a dark or light HSL color based on which has more contrast
	// against the supplied background, including saturated backgrounds.
	const hue = random.int(0, 23) / 24;
	const saturation = random.decimal(0.6, 0.8);
	const bg = luminance(rgb(background));
	const dark = bg > Math.sqrt(1.05 * 0.05) - 0.05;
	const lightness = dark ? random.decimal(0.13, 0.36) : random.decimal(0.66, 0.86);
	let channels = hslToRgb(hue, saturation, lightness);
	const target = dark ? 0 : 255;
	let light = luminance(channels);
	while ((Math.max(light, bg) + 0.05) / (Math.min(light, bg) + 0.05) < 4.5) {
		channels = channels.map(channel => Math.round((channel + target) / 2));
		light = luminance(channels);
	}

	return '#' + channels.map(channel => channel.toString(16).padStart(2, '0')).join('');
}

module.exports = {rgb, grey, color, luminance, hslToRgb};
