import type { Buffer } from 'node:buffer';

declare function svgCaptcha(text?: string, options?: svgCaptcha.ConfigObject): string;

declare namespace svgCaptcha {
	type MathOperator = '+' | '-' | '+/-' | '+-';
	type Interference = 'none' | 'lines' | 'beads' | 'rings' | 'decoy' | 'mixed' | 'balanced' | 'beaded';
	type Palette = 'default' | 'shared' | 'analogous' | 'per-glyph';

	interface ConfigObject {
		/** Random character count, 1–16. Defaults to 4 for SVG or 6 for strong PNG. */
		size?: number;
		/** Image width in pixels, 16–512. Defaults to 150 for SVG or 210 for strong PNG. */
		width?: number;
		/** Image height in pixels, 16–256. Defaults to 50 for SVG or 68 for strong PNG. */
		height?: number;
		/** Maximum font size in pixels, 8–256. Defaults to 56 for SVG or 52 for strong PNG. */
		fontSize?: number;
		/** Candidate characters with drawable glyphs in the loaded font. Repeats are deduplicated. */
		charPreset?: string;
		/** Characters to exclude from the candidate set. Defaults to an empty string. */
		ignoreChars?: string;
		/** Use a colored palette. Defaults to false and is enabled by a custom background. */
		color?: boolean;
		/** Use a light palette on a dark backdrop. Defaults to false. */
		inverse?: boolean;
		/** Number of noise lines, 0–20. Defaults to 1 for SVG or 3 for strong PNG. */
		noise?: number;
		/** An empty string, #RGB, or #RRGGBB. Empty is transparent for SVG, solid for strong PNG. */
		background?: string;
		/** Operator to display. Both '+/-' and '+-' select either operator at random. */
		mathOperator?: MathOperator;
		/** Minimum operand, 0–999. Defaults to 1. */
		mathMin?: number;
		/** Maximum operand, 0–999. Defaults to 9. */
		mathMax?: number;
	}

	interface StrongConfigObject extends ConfigObject {
		/** Optional same-color interference style. Defaults to 'none'. */
		interference?: Interference;
		/** Amount of ornamentation in the mixed or beaded style. Defaults to 1. */
		interferenceDensity?: 1 | 2;
		/** Explicit palettes color filled marks by column and use one glyph-center color per curve. Defaults to 'default'. */
		palette?: Palette;
	}

	interface CaptchaObj<T = string> {
		/** The expected answer, for server-side verification. */
		text: string;
		/** The image payload, ready to send to the client. */
		data: T;
	}

	/** Generate a random character challenge as SVG. */
	function create(options?: ConfigObject): CaptchaObj;
	/** Generate a random character challenge as PNG. */
	function createStrong(options?: StrongConfigObject): CaptchaObj<Buffer>;
	/** Generate an arithmetic challenge as SVG. */
	function createMathExpr(options?: ConfigObject): CaptchaObj;
	/** Load a trusted local OpenType font file for subsequent calls. */
	function loadFont(filepath: string): void;
	/** Mutable global option overrides. */
	const options: StrongConfigObject;
	function randomText(sizeOrOptions?: number | ConfigObject): string;
}

export = svgCaptcha;
