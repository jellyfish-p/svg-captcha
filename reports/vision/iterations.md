# Same-color interference experiments — 2026-11-17

This continues the [initial hardening evaluation](README.md). The user asked
for repeated GPT-6 Luna / GPT-6.1 Terra / GPT-6.1 Sol blind trials, with
GPT-6.1 Sol xhigh implementing and independently reviewing the code. The
user chose to explore the readability/recognition tradeoff before setting
a pass threshold. No threshold or human pass rate is assumed.

After round 15, the user requested one color per continuous interference
line. That correction is documented below under “Solid-color curve
correction.” The historical recognition scores remain tied to their
recorded sources; they do not measure the corrected line coloring.

## Method

Unless a round explicitly says otherwise, model trials use fresh,
independently generated six-character PNGs with a 210×68 canvas,
52 maximum font size, three curves, and alphabet
`23456789ACDEFHJKLMNPRTVWXY`. Groups are interleaved under neutral IDs. Each
model is a fresh agent with no inherited conversation or answer manifest.
Every evaluator gets the same images and the same instruction: read the
six main characters, ignoring small dots, rings, lines and smaller fragments.
Sheets present eight images at 2× nearest-neighbor enlargement. Individual
image reinspection is permitted. Only visual inspection is permitted;
there is no programmatic OCR or preprocessing. These are instruction-blind
tests on a shared filesystem, not an access-isolated security benchmark.

The single participating human user transcribes separate randomized sheets.
Question marks count as wrong characters. No guesses are corrected before
scoring. The sample sizes per variant are small, and there is no timed or
multi-user usability study. Model scores and human scores on different
samples are reported separately.

## Screening round 3

Eight images per group. Runtime source hash for the new variants:
`e099437a95a1824446eb8f404440e77be9611c357520d16a6932f0d0dcd22671`.

| Variant | Luna exact | Terra exact | Sol exact |
| --- | ---: | ---: | ---: |
| Incumbent strong PNG | 3/8 | 7/8 | 7/8 |
| Same-color lines | 0/8 | 3/8 | 3/8 |
| Contour beads | 1/8 | 4/8 | 3/8 |
| Contour rings | 0/8 | 2/8 | 5/8 |
| Beaded decoy fragments | 2/8 | 3/8 | 4/8 |

Human screen 1: 7/8 exact, 47/48 character positions correct. Lines, rings
and decoy fragments were each 2/2; beads were 1/2, with one K read as Y.
The same sheet was redisplayed after the user reported an application
crash; only the subsequent submitted answers were scored.

Artifacts: [model results](2026-11-17-v3/results.json),
[human results](human-screen-1/results.json).

## Combination screening round 4

Twelve images per group. Runtime hash:
`f725c46c05f704ee17a07129a8ec1f93c76cb25790a3a9410dbede1df0f30b79`.

Medium mixed uses same-color stronger curves and four ring ornaments per
answer slot. Higher mixed keeps the same line count and adds one ring and
one solid bead per slot. The incumbent remains the pre-iteration source.

| Variant | Luna exact | Terra exact | Sol exact |
| --- | ---: | ---: | ---: |
| Incumbent strong PNG | 2/12 | 9/12 | 11/12 |
| Same-color lines | 0/12 | 6/12 | 5/12 |
| Mixed medium | 0/12 | 2/12 | 1/12 |
| Mixed higher | 0/12 | 0/12 | 3/12 |

Human screen 2: 7/8 exact, 47/48 character positions correct. Incumbent,
lines, and mixed medium were each 2/2; mixed higher was 1/2, with its final
A marked unreadable. Medium mixed is selected for larger confirmation
because it uses less clutter, was successful on these two human examples,
and lowered both target model scores in the screening batch. This is a
selection decision, not a validated general human success rate.

Artifacts: [model results](2026-11-17-v4/results.json),
[human results](human-screen-2/results.json).

## Confirmation round 5 and paired human feedback

Fresh batch, 24 images per group, runtime hash:
`c014c382cb23bf218c26be10ecac170e33b032a224905e6e2cd39254da4cf401`.
The PNG-only normalization and minimum glyph-height review findings were
fixed first. Explicit `none` was the incumbent-compatible control.

| Variant | Luna exact | Terra exact | Sol exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 0/24 | 16/24 | 14/24 |
| Mixed medium | 0/24 | 0/24 | 4/24 |

The Sol agent initially declined the local transcription task, then completed
it after clarification of the owner-authorized scope. It submitted only one
set of predictions and received no answers or accuracy feedback. The initial
non-execution was not scored as an incorrect answer.

Eight mixed images were selected uniformly before predictions and shown to
the user with remapped IDs. The user described the first five as confidently
readable and the last three as requiring guesses. No transcription was
provided for the first five, so they are not verified correct. The three
submitted hard examples all failed exact matching, with 14/18 positions
correct. This is evidence of a usability tail problem, not a human accuracy
estimate from an unbiased three-image sample. Mixed medium was **not**
promoted based on its low model score.

Artifacts: [model results](2026-11-17-v5/results.json),
[partial human results](human-screen-3/results.json).

## Individual-image robustness round 6

Fresh images, presented individually at 4× nearest-neighbor enlargement
(840×272), with six incumbent controls and twelve mixed images. This checks
whether the result only depends on the smaller contact-sheet presentation.

| Variant | Luna exact | Terra exact | Sol xhigh review exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 2/6 | 6/6 | 6/6 |
| Mixed medium | 0/12 | 1/12 | 5/12 |

The first Sol agent declined even after scope clarification and generated no
predictions; it is recorded separately as unexecuted. A fresh GPT-6.1 Sol
xhigh review agent completed the measurement without answers or feedback.
Its reasoning effort and changed presentation are explicitly reported, and
its result is not pooled as if it were the same protocol as earlier rounds.
The stronger Sol result reinforces the need to qualify robustness claims.

Artifact: [results, execution notes and enlarged-image hashes](2026-11-17-v6/results.json).

## Core-protection screening round 7

The `balanced` candidate keeps same-color curves/rings while budgeting at
most one conservative contact per real glyph core. Curve and ring placement
use bounded trials, with edge-band fallbacks for curves that cannot safely
cross a core. Source hash when generated:
`095b7b7fdb59df1ebce96dbae7127a1ffd903239d071c0e2605e137365364f4f`.
A subsequent correctness fix resolves faint-glyph fallback before choosing
core regions; 200 paired deterministic default outputs were byte-identical.

| Variant | Luna exact | Terra exact | Sol exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 4/6 | 4/6 | 4/6 |
| Mixed medium | 0/12 | 2/12 | 2/12 |
| Balanced core protection | 0/12 | 3/12 | 5/12 |

Four balanced examples were shown in their pre-existing shuffled order,
without selection by model correctness. The user strongly endorsed their
readability but did not submit exact transcriptions. Record this as positive
subjective feedback from one user, not a verified 4/4 or a universal human
pass rate. Balanced is the clarity reference for the next experiment;
remaining model success is too high to call it a reliable block.

Artifacts: [model results](2026-11-17-v7/results.json),
[four human examples](human-screen-4/blind/sheet-01.png).

## Dotted-outline screening round 8

The `beaded` candidate adds small, disconnected outlines from the loaded
font while preserving the protected cores of `balanced`. Its first version
used softer opacity for dotted outlines. Source hash:
`bda978be17f9b128188809d46689f9f0d3a9bdb2c9f55512c5ae68a52c372c61`.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 0/6 | 4/6 | 4/6 |
| Balanced | 0/12 | 6/12 | 8/12 |
| Beaded outlines | 2/12 | 2/12 | 4/12 |

The independent review identified that a dotted outline could be taller
than its shorter neighboring main glyph, particularly for wide, short
outlines. Placement now uses actual rendered ink height, includes bead
radii and an antialiasing margin, and caps dotted outlines at 75% of the
shorter neighbor. If the available space is too small, it omits the outline.

Artifact: [round 8 results](2026-11-17-v8/results.json).

## Opaque-ink and density round 9

All beaded layers now use fully opaque ink, including fallback curves, so
opacity does not directly separate interference from main glyphs. Other
styles retain their existing behavior. Source hash:
`ec2063f588e8f561b0aa1e88e8664563ef1a9cfc213f649d2513094e9d64b058`.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 3/8 | 7/8 | 7/8 |
| Beaded density 1 | 0/16 | 5/16 | 2/16 |
| Beaded density 2 | 0/16 | 3/16 | 7/16 |

Higher density did not consistently reduce recognition and adds clutter.
Density 1 was retained for the color experiments. The user subsequently
delegated further testing while asleep and asked for random color families
and optionally different colors for each main glyph. No further human
accuracy measurements were collected; geometric guards and model reviews
do not establish a human pass rate.

Artifact: [round 9 results](2026-11-17-v9/results.json).

## Palette screening round 10

All candidates use six characters and beaded density 1. `shared` chooses a
random common hue; `analogous` smoothly varies within one family;
`per-glyph` varies between glyph centers. At any x position, main glyphs and
all interference use identical ink. Solid ink is corrected to at least
4.5:1 contrast against the actual background; antialiased edges blend with
that background. Source hash:
`0f525025ea2d7b98c8d074327e894d5ab4eb4c9aa8804ddbd55dd59cae747a68`.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Gray | 0/8 | 1/8 | 2/8 |
| Shared random hue | 0/12 | 3/12 | 3/12 |
| Analogous family | 0/12 | 2/12 | 4/12 |
| Per-glyph hues | 0/12 | 4/12 | 3/12 |

No palette demonstrated a clear advantage at this sample size. Before the
next round, per-glyph selection was tightened to choose distinct rendered
RGB anchors from a bounded contrast-safe pool, including nonadjacent
glyphs. Adjacent hues preferentially remain separated. Colors are reused
only if the distinct candidate pool is exhausted. Shared, analogous,
default and SVG output were unchanged in deterministic comparisons.

Artifact: [round 10 results](2026-11-17-v10/results.json).

## Constant-glyph-size length screening round 11

The eight-character candidates use 280×68 instead of 210×68, preserving
35 pixels per slot and the same maximum font size. Contact sheets preserve
native proportions at 2× and label the expected count for each fixture.
All candidates use beaded density 1. Source hash:
`76e63906b71b6fdcd4231332b668ca39b1fbde1ca65e6952d419a76e44cfaf51`.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Six, shared | 0/12 | 1/12 | 3/12 |
| Six, per-glyph | 0/12 | 0/12 | 3/12 |
| Eight, shared | 0/12 | 3/12 | 2/12 |
| Eight, per-glyph | 0/12 | 3/12 | 4/12 |

Sol misread three six-character captions as eight and explicitly appended
two placeholder question marks. Before scoring, the controller checked PNG
dimensions, public metadata and sheet labels, confirmed six, and supplied
only the expected count for these three fixtures. Sol removed its padding
after reinspection; all other predictions stayed unchanged. No answer
characters or correctness feedback were supplied. The
[initial submission](2026-11-17-v11/sol-xhigh-initial.json) and
[administrative correction notes](2026-11-17-v11/sol-xhigh-notes.md) are
preserved. This exception is recorded rather than treating padding as
visual-recognition resistance.

Eight characters did not produce a consistent benefit across the two
models. The next confirmation retains six to avoid additional typing
burden without demonstrated benefit. The scores are exploratory and
cannot prove the variants equivalent.

Artifact: [round 11 results](2026-11-17-v11/results.json).

## Fresh color confirmation round 12

Source unchanged from round 11. Fresh images include eight ordinary PNG
controls, 24 shared-hue beaded images and 24 per-glyph beaded images, all
six characters. Each model received the same 56 shuffled images at 2×,
with individual reinspection allowed and no feedback or corrections.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 4/8 (50.0%) | 7/8 (87.5%) | 7/8 (87.5%) |
| Shared hue, beaded | 2/24 (8.3%) | 9/24 (37.5%) | 8/24 (33.3%) |
| Per-glyph hues, beaded | 2/24 (8.3%) | 4/24 (16.7%) | 8/24 (33.3%) |

The reduction relative to ordinary PNG was reproduced, but Sol still read
one third of each colored group exactly. For per-glyph, Terra's 95% Wilson
interval is 6.7–35.9%; Sol's is 18.0–53.3%. These wide intervals and the
exploratory selection history do not support a fixed success-rate guarantee
or a claim that the colored profile reliably blocks either model. Its
position accuracies were 77.8% for Terra and 80.6% for Sol. Model character
accuracy is not a substitute for human readability measurement.

Per-glyph was retained for a narrow curve-count experiment: increase the
number of curves from three to four or five while keeping the same cap of
one intrusive curve/ring per main glyph core. This checks a remaining
parameter without increasing dotted-glyph density or answer length.

Artifact: [round 12 results](2026-11-17-v12/results.json).

## Curve-count screening round 13

Source unchanged. Sixteen fresh images per group compare three, four and
five curves, all with per-glyph color and beaded density 1. The core-contact
budget is unchanged. Each model sees the same 48 shuffled images at 2×.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Three curves | 0/16 | 5/16 | 7/16 |
| Four curves | 0/16 | 4/16 | 4/16 |
| Five curves | 0/16 | 2/16 | 5/16 |

Four curves had the lowest worst-model exact rate in this screening set
(25% for both Terra and Sol), while five only improved Terra. Four was
selected before the final fresh individual-image enlargement check. This
is exploratory candidate selection, not a statistically established
advantage over three or five curves. The final check uses eight ordinary
PNG controls and 24 candidate images, all individually enlarged to 840×272
with nearest-neighbor sampling. New evaluator agents receive no previous
predictions or results.

Artifact: [round 13 results](2026-11-17-v13/results.json).

## Individual-image enlargement round 14

Fresh images on unchanged source: eight ordinary PNG controls and 24
per-glyph beaded candidates with four curves, six characters and density
1. All images are presented individually at 4× nearest-neighbor
enlargement (840×272), with reinspection permitted and no answer feedback.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 0/8 | 5/8 | 7/8 |
| Four-curve per-glyph | 0/24 | 9/24 | 12/24 |

Terra's candidate exact rate was 37.5% (95% Wilson 21.2–57.3%) and Sol's
was 50.0% (31.4–68.6%). Candidate position accuracies were 83.3% and 89.6%
respectively. The profile therefore does not reliably block these strong
models under enlarged individual presentation. The ordinary control had
93.8%/97.9% position accuracy for Terra/Sol, respectively.

Luna's control performance was anomalously poor: zero exact answers and
only 1/48 correct positions. A protocol-only follow-up confirmed that the
agent opened all 32 files in sequence, associated IDs by file order, and
reported no display error, skipped image, or copied prediction. No answers
or scores were supplied and no new submission was accepted. Preserve this
run, but do not interpret its zero candidate score as evidence of a
successful defense; the control did not validate its discrimination.

The preview consists of the first four candidates in the existing shuffled
order, selected before scoring rather than by model failure. Runtime
defaults remain unchanged. A further experiment will target dotted-decoy
character selection while preserving the same geometric and color limits.

Artifacts: [round 14 results](2026-11-17-v14/results.json),
[uncurated preview](2026-11-17-v14/preview.png),
[preview selection](2026-11-17-v14/preview-selection.json).

## Confusable-decoy prototype round 15

The experimental copy changes only dotted-decoy identity selection. It
prefers an eligible alternative sharing one of twelve proposed contour
groups with either adjacent answer glyph, excludes both neighbors, falls
back to other eligible glyphs, and skips an exhausted two-character pool.
Main glyphs, curves, rings, dot geometry budgets and palettes are unchanged.
The controller retained the production candidate at source
`76e63906b71b6fdcd4231332b668ca39b1fbde1ca65e6952d419a76e44cfaf51`;
the temporary prototype hash is
`4c1b359f842bc3d15b358e7d89749b362bcb71e6f8f8973fe0dee8b88ff1c0fe`.

Fresh 4× individual-image comparison, with six ordinary controls and 16
images per beaded group. The instructions require displaying the ID before
each image and at most four images per tool batch to reduce bookkeeping
errors. All models see the same shuffled fixtures, without answer feedback.

| Variant | Luna exact | Terra exact | Sol xhigh exact |
| --- | ---: | ---: | ---: |
| Incumbent-compatible | 0/6 | 6/6 | 6/6 |
| Random dotted decoys, four curves | 0/16 | 3/16 | 6/16 |
| Confusable dotted decoys, four curves | 0/16 | 5/16 | 5/16 |

The one-image Sol improvement is accompanied by worse Terra exact accuracy
and identical Sol position accuracy (83/96) for both beaded groups. Luna
again had zero exact controls, although 27/36 control positions matched;
its zero candidate scores do not establish blocking. The prototype is
**not promoted**: the observed tradeoff does not justify its additional
answer-dependent information.

An exact enumeration of uniformly random default-alphabet neighbor pairs
quantified that information before placement/visibility filtering. If a
decoy's identity is observed exactly, the selection rule's mutual
information about the neighbor pair is 0.1132 bits with random exclusion
and 2.3631 bits with targeted selection. This is a mathematical property
of the selector, not a measured attack success rate. The independent Sol
xhigh reviewer recommended keeping the prototype experimental until
rule-aware rendered-image attacks are tested. Such an attack was not run
because this prototype did not justify promotion in the visual comparison.

The prototype passed all 30 copied tests and an exhaustive 676-neighbor-pair
eligibility probe. One hundred seeded scene comparisons preserved main,
curve and ring geometry and kept dotted layers outside the cores and within
the dot cap. The reviewer requested dedicated preference/exhaustion
regressions if the prototype is ever integrated. It remains outside the
package; its snapshots and selection audit are retained for reproduction.

Artifacts: [round 15 results](2026-11-17-v15/results.json),
[prototype record](prototypes/confusable-decoys/record.json),
[candidate source](prototypes/confusable-decoys/candidate-beaded.js).

## Configuration at the end of round 15 and evidence limits

Retain six characters at 210×68, font size 52, `interference: 'beaded'`,
density 1, four curves and `palette: 'per-glyph'` as the selected colored
candidate. Shared-hue and analogous-family palettes remain available.
API defaults are unchanged, and this is an opt-in example rather than a
claim of a universally optimal configuration.

The two enlarged-image runs place the retained candidate at Terra 9/24 and
3/16, and Sol xhigh 12/24 and 6/16. These separate runs show reduced
recognition relative to their ordinary controls, but substantial remaining
Sol success. Neither stable blocking nor a sub-20% recognition rate is
established. Increasing answer length, dotted density, or curve count did
not consistently help both models. The targeted-decoy hypothesis adds a
correlation risk without a convincing measured gain. All exploratory
variants, including disappointing results, remain in the log.

Human evidence remains the original one-person responses and the subjective
endorsement of four balanced images. No exact human readings were collected
for the new colored profile after the user delegated autonomous work. Its
core protection and size/contrast checks are engineering constraints, not
a measured human accuracy rate. This completes the implemented color options
and this exploration pass; the request for reliable strong-model blocking
is **not demonstrated by the evidence**. Claims should remain at measured
recognition reduction with the stated presentation and sample sizes.

## Color implementation review

Two independent GPT-6.1 Sol xhigh agents refreshed the Standards and Spec
reviews after the distinct-anchor change.

### Standards

No documented-standard violation or palette correctness issue remained.
All four focused palette tests passed on Node 24.20.0. The package dry run
includes all runtime modules, font and TypeScript declarations, with no new
dependencies. Reports and evaluation scripts are excluded. The reviewer
identified an evaluation guard edge: identical fresh image-directory and answer-file
paths were not rejected before generation. Both generator scripts now
reject equality, and a probe confirmed rejection before any output exists.

Final outstanding actionable findings: **0**; one evaluation guard finding
was fixed. No unresolved worst-severity finding remains on this axis.

### Specification

No blocking runtime specification finding remained. The reviewer
independently ran all 30 tests on Node 24.20.0. Its
2,700 per-glyph palette probes covered 900 backgrounds (766 near the
light/dark ink crossover), sizes 1/6/16 and narrow, wide and odd-width
layouts; no center-column RGB duplicates occurred. Across 1,690,875 solid
columns the minimum contrast was 4.50000002489:1. Six hundred deterministic
default/shared/analogous PNG and SVG comparisons were byte-identical to
the source before the distinct-anchor change. Fifty per-glyph comparisons
preserved geometry and layer order. Actual human accuracy of the colored
variant remains unmeasured; color and geometry invariants do not establish
that outcome. Final outstanding actionable code findings: **0**.

The implementation agent also ran all 30 tests on Node 22.0.0 and 24.20.0.
Both README color examples were executed and returned valid
210×68 PNGs and six-character answers. Runtime defaults remain unchanged;
the colored beaded profile is explicitly selected by its options.

## Solid-color curve correction

The user requested “同一线条同一颜色”: each complete interference curve
keeps one color even when it crosses differently colored characters. The
renderer now chooses one existing glyph-slot-center RGB per curve after
geometry and palette generation, and the rasterizer applies that color
throughout the stroke. Filled glyphs, dots and rings retain their existing
column palette. Antialiasing and normal overlap still apply. No new public
option is required.

Runtime source changed from
`76e63906b71b6fdcd4231332b668ca39b1fbde1ca65e6952d419a76e44cfaf51`
to `8ccd9bd7ab18d4ed2a00ba77273a462dc9911a7d30e0ed312336caf8815e9d3d`.
The [paired preview](solid-line-color/comparison.png) uses the same fresh
deterministic seed for each before/after challenge so the answer, geometry
and filled palettes match. This is a visual demonstration, not a new model
recognition round. Its [record](solid-line-color/comparison.json) includes
the options and source hashes. Demo seeding is confined to a separate
process; production randomness is unchanged.

Implementation and independent reviews used GPT-6.1 Sol xhigh. All 32 tests
passed on Node 24.20.0. In an isolated cubic-curve regression, the 76 sampled
columns had 76 different solid colors before and exactly one after.

- **Specification:** no actionable findings. Independent review checked
  192 deterministic scenes across all styles/palettes and normal/inverse
  themes. Geometry, layer order and palette columns matched. Default/shared
  PNGs, isolated filled layers and SVG comparisons were byte-identical.
  All 432 isolated curves, including 24 edge fallbacks, used one selected
  anchor color plus its valid antialias shades. Both new curve regressions
  fail against the original spatially varying line renderer.
- **Standards:** no contribution-rule violations. One documentation
  ambiguity about all beaded marks sharing one ink was corrected to specify
  the default palette. The duplicated glyph-center calculation remains a
  nonblocking maintainability heuristic; center-selection tests cover the
  current alignment.

## Reproduction notes

`scripts/vision-round.js` generates the PNG-only batches from a configuration
file; `scripts/vision-sheets.py` creates the contact sheets. Scoring uses
`scripts/vision-benchmark.js score`. The historical configuration JSONs
retain the actual local temporary reference-module path used in each run.
To rerun them, replace that path with a local copy of the pre-iteration
source, or use the current module with explicit `interference: 'none'`.
Independent deterministic comparisons established that this disabled mode
reproduces the prior answers and PNG bytes for the benchmark settings.
Always write fresh image/answer paths and use new evaluator agents.

The submitted predictions and their hashes, image hashes, source hashes,
and scored answers are retained in each results file. Source hashes refer
to the local JavaScript bytes at generation time; recorded hashes are not
rewritten after later fixes. Human responses are stored under the corresponding
human-screen directory after submission.

Completed model reports embed the original private manifest as `manifest`.
To rescore archived submissions, write that object to a separate JSON file
outside the blind directory and pass it to the score command. Round 15's
temporary module can be reconstructed from the retained prototype source
snapshots and the unchanged baseline module. The snapshots and raw original
submissions have Git attributes that preserve their recorded byte hashes.

The end-of-round-15 [evidence verification](verification.json) checked 644 canonical
images, 47 submitted prediction files represented in 17 scored reports,
88 enlarged images, two prototype source snapshots, recomputed group
scores, the bundled font fingerprint and the frozen runtime fingerprint.
No mismatch was found. These counts include the human screens; they are
not 644 independent samples for a single candidate.
