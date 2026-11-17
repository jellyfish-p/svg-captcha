# Captcha visual evaluation — 2026-11-17

This report covers the initial two batches. The subsequent same-color,
ring, and human-readability experiments are in [the iteration log](iterations.md).

The user requested independent image-only evaluations by GPT-6 Luna,
GPT-6.1 Terra, and GPT-6.1 Sol. GPT-6.1 Sol at xhigh separately implemented
and reviewed the changes. The evaluators did not inherit the controller's
conversation, and they did not receive the expected answers or group labels.

## Protocol

- Each batch has 24 original SVG controls rasterized to PNG and 24 new
  `createStrong()` PNGs. The control is commit
  `eb2e1dd4f8f93e902d41c6256382b3dffa171ece`.
- Both groups use six characters, a 210 × 68 canvas, font size 52, three
  noise lines, and the alphabet `23456789ACDEFHJKLMNPRTVWXY`.
- Each group draws independent random answers. The images are shuffled and
  given neutral IDs. All three evaluators see the same images in that batch.
- Contact sheets show eight samples each at an exact 2× nearest-neighbor
  enlargement. Evaluators may re-inspect pixels but may not use OCR code,
  inspect source/metadata, read answers, or inspect another model's results.
- The allowed alphabet and six-character length are disclosed to every
  evaluator. There is no correctness feedback or second answer attempt.
- Each evaluator writes all 48 predictions before scoring. Leading/trailing
  whitespace is trimmed and letters uppercased. No substitutions, edit
  distance tolerance, or corrections are applied to exact-answer accuracy.
- SHA-256 hashes cover the individual images, raw prediction files, and the
  generator JavaScript source used when the samples were made. The source
  fingerprint is of the local file bytes, so line-ending conversion changes
  it. A recorded fingerprint is never replaced by a later source revision.
  Submitted prediction JSON files have a targeted Git `-text` attribute so
  their recorded bytes survive checkout on different operating systems.
- The original controls are rasterized by evaluation-only `@resvg/resvg-js`
  2.6.2. Contact sheets use evaluation-only Pillow (10.2.0 in this run).
  Neither is a dependency of the package or its PNG implementation.

Blinding here is instruction-based: the agents share a filesystem but are
instructed to access only the supplied images. It is not an operating-system
access-isolation experiment. Model names are those explicitly selected in
the subagent tool; the visual agents' reasoning effort was not overridden.

## First batch, before review fixes

Source fingerprint:
`b16097b15a692abb65c92dcbc21641fc81c68e09eecad6913d28ad9237eec317`.

| Model | Original, exact | Strong PNG, exact | Strong character-position accuracy |
| --- | ---: | ---: | ---: |
| GPT-6 Luna | 15/24 (62.5%) | 8/24 (33.3%) | 118/144 (81.9%) |
| GPT-6.1 Terra | 23/24 (95.8%) | 18/24 (75.0%) | 138/144 (95.8%) |
| GPT-6.1 Sol | 23/24 (95.8%) | 18/24 (75.0%) | 138/144 (95.8%) |

The strong exact-answer Wilson 95% intervals are 18.0–53.3% for Luna and
55.1–88.0% for Terra/Sol. These are small-sample intervals, not a security
guarantee. The same samples across models are correlated; do not pool the
models as independent trials.

The new rendering lowered exact recognition on this batch, but it did not
block Terra or Sol. The purpose of PNG is to remove the exposed SVG outline
structure. It does not make a recognizable character puzzle resistant to
multimodal models. No human-user study or production endpoint abuse test
was conducted.

Artifacts: [scored answers and fingerprints](2026-11-17-v1/results.json),
[Luna predictions](2026-11-17-v1/predictions/luna.json),
[Terra predictions](2026-11-17-v1/predictions/terra.json),
[Sol predictions](2026-11-17-v1/predictions/sol.json),
[contact sheet 1](2026-11-17-v1/blind/sheet-01.png).

## Final batch, after review fixes

Source fingerprint:
`52364ac41897c3e49fb6159e4d8d6c8f3495d48226dd6aa7e4a9a5f5f5843fb2`.

After the first batch, review found and fixed narrow arithmetic layouts,
freeze/seal handling of global defaults, and invisible glyphs at extreme
custom PNG sizes. The last fix adds canonical-layout coverage validation
and an aligned fallback. An independent reviewer compared 200 deterministic
default-profile draws before and after that fix and found identical answers
and PNG bytes. Nevertheless, the final code was evaluated with a fresh
batch, fresh evaluator agents, and no answer feedback from the first batch.

| Model | Original, exact | Final strong PNG, exact | Strong character-position accuracy | Strong exact Wilson 95% interval |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 15/24 (62.5%) | 10/24 (41.7%) | 124/144 (86.1%) | 24.5–61.2% |
| GPT-6.1 Terra | 24/24 (100.0%) | 23/24 (95.8%) | 142/144 (98.6%) | 79.8–99.3% |
| GPT-6.1 Sol | 23/24 (95.8%) | 22/24 (91.7%) | 141/144 (97.9%) | 74.2–97.7% |

The final result does **not** support a claim that `createStrong()` blocks
vision models. Terra and Sol still solve almost all samples in this batch.
Differences between batches also demonstrate why the lower first-batch
recognition rates must not be selected as the headline security result.
Both batches are retained: 96 distinct images and 288 total transcriptions.
No parameter changes were selected using scored answers from the first
batch. No human-user readability study was conducted.

Artifacts: [final scored answers and fingerprints](2026-11-17-v2/results.json),
[Luna predictions](2026-11-17-v2/predictions/luna.json),
[Terra predictions](2026-11-17-v2/predictions/terra.json),
[Sol predictions](2026-11-17-v2/predictions/sol.json),
[contact sheet 1](2026-11-17-v2/blind/sheet-01.png).

SVG structure was assessed separately using
`scripts/check-path-leakage.js`: the original implementation yielded
1000/1000 recovered default answers. The hardened SVG implementation still
yielded 941/1000 in a separate local run. Those probes used different draws
from the visual experiment. PNG contains no SVG glyph path structure, but
that fact is not an OCR or multimodal-resistance measurement.

## Reproducing a batch

1. Install the package's production dependencies with `npm ci` on Node 22+.
2. Extract the baseline commit into a separate directory using `git archive`.
   Make its `opentype.js` dependency resolvable (for example through
   `NODE_PATH` pointing at the working checkout's `node_modules`).
3. Install `@resvg/resvg-js@2.6.2` in a separate temporary evaluation directory.
   Do not add it to this package. Make Pillow available to Python if contact
   sheets are desired.
4. Generate a fresh batch, with the answer manifest outside the blind folder:

   ```text
   node scripts/vision-benchmark.js generate BASELINE_DIR RESVG_MODULE BLIND_DIR PRIVATE_MANIFEST 24
   python scripts/vision-sheets.py BLIND_DIR
   ```

5. Start three independent agents using the named models. Give each the
   same six contact sheets, the rules above, and a unique prediction file.
   Do not give them the answer manifest. Save predictions as:

   ```json
   {"model":"gpt-6-luna","predictions":[{"id":"s001","text":"ABC234"}]}
   ```

   A real prediction file must contain all 48 unique IDs; `?` is allowed for
   an unreadable character and scores as incorrect.
6. Only after all predictions are complete, score them:

   ```text
   node scripts/vision-benchmark.js score PRIVATE_MANIFEST RESULTS_JSON LUNA_JSON TERRA_JSON SOL_JSON
   ```

The generator refuses to overwrite a previous image directory or answer
manifest. The scorer rejects duplicate/unknown/missing IDs. The output
contains the answer manifest after the evaluation is complete, so do not
expose it to an evaluator working on that batch.
