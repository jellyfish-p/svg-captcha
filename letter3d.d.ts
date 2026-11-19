import type { Buffer } from 'node:buffer';

export type SelectionMode = 'single' | 'multiple';

export interface Options {
	/** 'mixed' (the default) chooses a selection mode for each challenge. */
	selection?: SelectionMode | 'mixed';
	/** Direct prompts name attributes. Relative prompts compare facing with a reference letter. */
	mode?: 'direct' | 'relative' | 'mixed';
	/** Number of attributes the requested letters must match. */
	constraintCount?: 1 | 2 | 3;
	/** Defaults to true. Monochrome challenges support one or two constraints. */
	useColor?: boolean;
}

export interface Point {
	/** Horizontal fraction of the displayed image, from 0 inclusive to 1 exclusive. */
	x: number;
	/** Vertical fraction of the displayed image, from 0 inclusive to 1 exclusive. */
	y: number;
}

export interface Challenge {
	selection: SelectionMode;
	/** Simplified Chinese selection prompt. */
	prompt: string;
	/** One PNG containing the entire scene. */
	data: Buffer;
	width: number;
	height: number;
}

/** Private verification data. Keep this object on the server. */
export interface Solution {
	selection: SelectionMode;
	width: number;
	height: number;
	objectAtPixel: Uint8Array;
	targetIds: number[];
}

export function create(options?: Options): {challenge: Challenge; solution: Solution};
/** Accepts untrusted input. Every target needs one distinct hit, in any order. */
export function verify(solution: Solution, points: unknown): boolean;
