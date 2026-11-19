# Changelog

## 2.1.0 (2026-11-20)

- Adds `svg-captcha/letter3d` and `captcha.letter3d` to generate single-image 3D letter challenges and verify single or multiple point selections on the server.
- Supports Chinese prompts with one to three constraints on letter, color and facing, including comparisons with a reference letter. Each 480 × 360 scene scatters letters in randomized sizes from 54 to 90 px before projection.
- Includes TypeScript declarations and a runnable browser example with free point placement, keyboard controls and monochrome challenges.

## 2.0.0 (2026-11-17)

- Requires Node.js 22 or later. Option validation now rejects incorrect types, out-of-range values, unsupported backgrounds, and missing drawable glyphs.
- Adds `createStrong()`, which returns a PNG `Buffer` and a random answer. Challenge generation uses Node.js cryptographic randomness.
- Adds same-ink PNG interference, including `balanced`, which limits marks across glyph centers, and `beaded`, which adds small dotted outlines in gaps and margins.
- Adds `shared`, `analogous`, and `per-glyph` PNG palettes. Glyphs and filled marks share ink by column, and each interference curve keeps one color from end to end.
- Preserves SVG string output from the callable export and in `data` from `create()` and `createMathExpr()`.
