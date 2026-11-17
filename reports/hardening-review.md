# Hardening implementation and review

This records the initial hardening stage. Later rendering experiments and
human feedback are tracked in [the iteration log](vision/iterations.md).

Date: 2026-11-17, Asia/Shanghai. Baseline commit:
`eb2e1dd4f8f93e902d41c6256382b3dffa171ece`.

The implementation and both independent review processes were explicitly
dispatched as GPT-6.1 Sol with xhigh reasoning. The controller integrated
findings and conducted separate visual evaluations with the requested
GPT-6 Luna, GPT-6.1 Terra and GPT-6.1 Sol agents.

## Result

- `createStrong(options?)` returns a six-character PNG challenge by default.
  The rasterizer uses the existing OpenType parser and Node's built-in zlib;
  it adds no runtime or development dependencies.
- All public entries use validated configuration. Answer generation uses
  unbiased cryptographic randomness; XML attributes accept constrained
  types/formats; workload and input lengths are bounded.
- Existing callable, SVG, arithmetic and `randomText` entries remain
  available. Optional arguments, zero values, global/local precedence,
  filtered alphabets, supported glyphs and output consistency are covered.
- English and Chinese documentation describe the unpublished breaking
  upgrade to Node 22+, strict input rejection, PNG delivery, and a
  session/purpose-bound, expiring, atomically consumed challenge flow.
  The repository has no production application or datastore: the server
  flow is an integration example, not a deployed Redis/limiting service.

The change removes exposed vector outlines when the PNG entry is used.
It does **not** reliably block visual models. See the complete
[two-batch visual report](vision/README.md), including the high recognition
rates on the final frozen code.

## Standards

No documented-standard violations remained at the final review.
The contribution guide and editor configuration were checked. The package
contains the runtime, font and type declarations, and excludes evaluation
tooling and reports. Test tooling now uses Node's built-in runner; obsolete
Jest and XO dependencies and stale snapshot tests were removed.

One nonblocking maintainability suggestion remains: the two aligned
`chToPath(..., true, true)` calls in `lib/render.js` could use a named mode.
Both calls are now colocated in the same module, and the contract is covered
by visibility/fallback tests. This is a readability heuristic, not a
documented-standard violation or a demonstrated incorrect result.

## Specification

No blocking specification findings remained. Review reproduced and the
implementation fixed:

1. Narrow arithmetic layouts that randomly failed depending on the selected
   operands. The widest possible equation is now checked before sampling.
2. Freezing/sealing global options inadvertently recording descriptor-only
   operations as explicit defaults and downgrading the strong profile.
3. Tiny punctuation outlines disappearing from PNG pixels while remaining
   in the expected answer. Every selectable glyph is now checked in a
   canonical layout before sampling; faint random layouts use a pixel-aligned
   fallback. Only the last successful layout per loaded outline is cached.

An independent deterministic comparison of 200 default-profile draws found
no changed answers or PNG bytes after the visibility fix. The final visual
batch was still regenerated on the final source to make the evidence match
the delivered code directly.

## Verification

- A clean `npm ci --ignore-scripts --no-audit --no-fund` completed.
- All 16 tests passed on Node 22.0.0 and 24.20.0. The controller independently
  reran the full suite on 24.20.0 after the final freeze.
- TypeScript 5.9 strict NodeNext consumer fixtures compiled for both CJS and
  ESM, including callable/named exports and PNG `Buffer` typing. Runtime
  ESM named/default imports were also checked by the specification reviewer.
- `git diff --check` passed. No replacement linter is claimed; the broken XO
  command was removed and the contribution guide updated.
- `npm pack --dry-run --json` includes all renderer modules, font and types
  and excludes test/evaluation artifacts.
- `npm audit --omit=dev --json` reported zero known production dependency
  advisories on this date. It is not a proof of logical security.
- Four noise-free identical scenes were rasterized by the new renderer and
  evaluation-only resvg. The mean absolute channel difference was 0.93–1.31
  on the 0–255 RGB scale, consistent with different edge antialiasing.
- A local post-fix sample of 100 default PNG generations measured about
  33.5 ms cold, 2.62 ms warm p50 and 3.99 ms warm p95; mean output 2,589 bytes.
  These machine-specific figures are not production capacity guarantees.
- All stored sample hashes and model prediction hashes are checked against
  their scored reports. The final generator source fingerprint is recorded
  in `vision/2026-11-17-v2/results.json`.

No commit, publication, remote push or deployment was performed.
