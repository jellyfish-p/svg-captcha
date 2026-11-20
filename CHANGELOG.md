# Changelog

## 2.2.0 (2026-11-21)

- Adds the opt-in `letterMimicProbability` option to `createStrong()`. It defaults to `0`. Set it to `0.5` to attempt a hollow-ring stroke on half of generated challenges, or to `1` to attempt one on every challenge.
- A short row of hollow rings can suggest the leg of R on a P, the bottom bar of E on an F, or the inner bar and turn of G on a C. The answer follows the solid letter. The renderer skips the effect when the rings would be crowded or overlap a protected glyph center.

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
