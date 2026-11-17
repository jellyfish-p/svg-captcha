# Changelog

## 2.0.0 (2026-11-17)

- Requires Node.js 22 or later. Option validation now rejects incorrect types, out-of-range values, unsupported backgrounds, and missing drawable glyphs.
- Adds `createStrong()`, which returns a PNG `Buffer` and a random answer. Challenge generation uses Node.js cryptographic randomness.
- Adds same-ink PNG interference, including `balanced`, which limits marks across glyph centers, and `beaded`, which adds small dotted outlines in gaps and margins.
- Adds `shared`, `analogous`, and `per-glyph` PNG palettes. Glyphs and filled marks share ink by column, and each interference curve keeps one color from end to end.
- Preserves SVG string output from the callable export and in `data` from `create()` and `createMathExpr()`.
