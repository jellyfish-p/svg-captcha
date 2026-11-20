![svg-captcha](https://raw.githubusercontent.com/jellyfish-p/svg-captcha/v2.0.0/media/header.png)

[中文](README_CN.md)

Generate SVG and PNG CAPTCHAs in Node.js without native addons. Requires Node.js 22 or later.

## Install

Choose a version from [GitHub Releases](https://github.com/jellyfish-p/svg-captcha/releases) and install it by tag. For example:

```sh
npm install github:jellyfish-p/svg-captcha#v2.1.0
```

You can also install from a local checkout of the tag.

```sh
npm install ../svg-captcha
```

## Usage

```js
const captcha = require('svg-captcha');

const {data, text} = captcha.createStrong();
// data is a PNG Buffer to send as image/png.
// text is the expected answer for server-side verification.

const svg = captcha.create();
// svg.data is an SVG string to send as image/svg+xml.

const math = captcha.createMathExpr({mathMin: 0, mathMax: 9, mathOperator: '+/-'});
// math.text is the result of the expression shown in math.data.
```

Use `createStrong()` when deploying a new image challenge. It generates six characters from a reduced-confusion alphabet, varies glyph scale, position, rotation, shear and curvature, and rasterizes the result. The PNG carries pixels without SVG glyph paths. The existing SVG APIs expose path structures that can be matched to font templates. Vision models read many samples in the recorded experiments; OCR is another possible approach, but was not measured in those experiments. Use image CAPTCHAs as one signal alongside rate limiting and other abuse controls.

[Recognition benchmark](https://github.com/jellyfish-p/svg-captcha/blob/v2.0.0/reports/vision/README.md)

[Interference and color experiments](https://github.com/jellyfish-p/svg-captcha/blob/v2.0.0/reports/vision/iterations.md)

## API

| Function | Return value |
| --- | --- |
| `create(options?)` | `{text: string, data: string}` with a random answer and an SVG |
| `createStrong(options?)` | `{text: string, data: Buffer}` with a random answer and a PNG |
| `createMathExpr(options?)` | `{text: string, data: string}` with the arithmetic result and an SVG |
| `letter3d.create(options?)` | `{challenge, solution}` with a Chinese prompt, one PNG and private point-verification data |
| `letter3d.verify(solution, points)` | Boolean indicating whether each target was hit exactly once |
| `svgCaptcha(text?, options?)` | SVG string for explicit text. Omit text to generate a random challenge. |
| `randomText(sizeOrOptions?)` | Random answer string. Accepts a numeric size or an options object. |
| `loadFont(filepath)` | Loads a trusted local OpenType font for subsequent calls. |

`svgCaptcha.options` is the mutable global settings object. Per-call values override explicitly assigned global values, which override the profile defaults in the table. Set an overridden property to `undefined` or delete it to restore the profile default. This precedence applies to `randomText()` and the callable export as well.

| Option | Accepted values | SVG default | Strong PNG default |
| --- | --- | --- | --- |
| `size` | Integer from 1 to 16 | 4 | 6 |
| `width` | Integer from 16 to 512 pixels | 150 | 210 |
| `height` | Integer from 16 to 256 pixels | 50 | 68 |
| `fontSize` | Maximum font size, integer from 8 to 256 pixels | 56 | 52 |
| `noise` | Integer from 0 to 20 lines | 1 | 3 |
| `interference` | PNG styles `none`, `lines`, `beads`, `rings`, `decoy`, `mixed`, `balanced`, or `beaded` | — | `none` |
| `interferenceDensity` | `1` or `2` for the mixed and beaded styles | — | `1` |
| `palette` | PNG palettes `default`, `shared`, `analogous`, or `per-glyph` | — | `default` |
| `letterMimicProbability` | Chance of attempting one hollow-ring letter mimic per PNG, `0`–`1` | — | `0.5` |
| `color` | Boolean. A custom background enables a colored palette. | `false` | `false` |
| `inverse` | Boolean. Use a light palette for a dark background. | `false` | `false` |
| `background` | Empty string, `#RGB` or `#RRGGBB` | Transparent | Solid white or dark when inverted |
| `charPreset` | Up to 256 UTF-16 code units | Uppercase and lowercase ASCII letters and digits | `23456789ACDEFHJKLMNPRTVWXY` |
| `ignoreChars` | Up to 256 UTF-16 code units to exclude | Empty | Empty |

Rendering requires at least 6 horizontal pixels per glyph and scales the actual outlines to fit. `createStrong()` rejects layouts that are too small to draw every candidate glyph visibly. Pass 1–16 characters to the callable export. For generated challenges, the alphabet must contain at least one drawable character after filtering. The library samples each distinct character with equal probability. The currently bundled OpenType parser supports character lookup in the Basic Multilingual Plane.

With `palette: 'default'`, the optional PNG interference styles use the same ink color for the characters and the added marks. `lines` gives the crossing curves stronger contrast. `beads` and `rings` place solid and hollow marks near the characters. `decoy` adds small partial shapes built from dots. `mixed` combines stronger crossing curves with rings. Setting its density to `2` adds a ring and a solid bead per character. `noise` controls the number of crossing curves. Describe the task as reading the six large characters from left to right when using the default size with these styles.

`balanced` also combines crossing curves with rings. It limits the number of marks crossing the middle of each glyph to one. Curves that would exceed that limit can run near the canvas edges. Rings can appear around the glyph edges and in the gaps.

`beaded` uses the same limits near the answer glyphs as `balanced`. It adds smaller dotted outlines from the loaded font to gaps and margins where there is enough room. With `palette: 'default'`, the answer glyphs, curves, rings, and dots share one opaque ink. Each dotted outline, including its beads, fits within 75% of the shorter neighboring glyph's rendered height. At density `1`, the renderer tries about one dotted outline for every two answer glyphs. Density `2` tries up to one per answer glyph, with a limit of 12 outlines and 216 dots. The style requires at least two distinct drawable characters in the filtered alphabet. Ask users to read the large, solid characters from left to right.

Interference requires at least 26 pixels of canvas height and 12 pixels of width per character. Every selectable glyph needs at least 12 pixels of ink height before distortion. The minimum rises to `20 × scale` for `rings`, `mixed`, `balanced`, and `beaded`, or `23 × scale` for `decoy`, when that value exceeds 12. The ornament scale is `min(1.45, width / (35 × size), height / 68)`. The PNG-only options apply to `createStrong()`.

`createStrong()` can add a short row of hollow circles to one eligible letter. The circles suggest the diagonal leg of `R` on `P`, the bottom bar of `E` on `F`, or the inward bar of `G` on `C`. The original solid letter remains the answer in `text`. If the chosen layout has no room for a clear row of circles, the renderer skips the mimic. Use `letterMimicProbability: 0` to turn this off or `1` to attempt it on every challenge.

For `createMathExpr()`, set `mathMin` and `mathMax` to integers from 0 to 999 with `mathMin <= mathMax`. They default to 1 and 9 and include both endpoints. `mathOperator` accepts `'+'` (default), `'-'`, `'+/-'` or `'+-'`. The last two choose either operator at random. The loaded font must cover the digits and operators that can appear.

Pass an options object or omit it. Wrong types throw `TypeError`. Out-of-range values, unsupported operators, invalid colors, or missing drawable glyphs throw `RangeError`. Use explicit `noise: 0` to render without noise and `mathMin: 0` to include zero in an arithmetic challenge.

## Colored beaded PNG

The PNG palette controls how ink is colored. `default` uses the existing `color`, `inverse`, and `background` settings. `shared` selects one random hue for all marks. `analogous` varies the hue across the image within one color family. `per-glyph` assigns distinct RGB colors to the center columns of the glyph slots and transitions smoothly between them. It prioritizes separation between neighboring hues and reuses colors only after exhausting the distinct contrast-safe candidates.

Explicit palettes select their own colors regardless of the `color` flag. At each horizontal location, glyphs, dots, and rings share the same opaque ink. Each interference curve uses one opaque color from a glyph slot center for its entire length. Solid ink has at least 4.5:1 contrast against the background. Antialiased edges blend with the pixels underneath.

```js
const captcha = require('svg-captcha');

const {data, text} = captcha.createStrong({
	size: 6,
	width: 210,
	height: 68,
	fontSize: 52,
	noise: 4,
	interference: 'beaded',
	interferenceDensity: 1,
	palette: 'per-glyph'
});
```

## 3D letter point selection

`require('svg-captcha/letter3d')` and `require('svg-captcha').letter3d` expose the same server API, available since v2.1.0. This entry draws scattered block letters in one PNG with its own font and rendering settings.

For a native Node.js ES module, use `import letter3d from 'svg-captcha/letter3d.js'`.

Each 480 × 360 scene mixes letter sizes. The generator divides the 54–90 px size range into one band per letter, samples one size from each band, and randomly assigns them to the letters. The range measures glyph height before projection. Visible height also varies slightly with orientation.

```js
const letter3d = require('svg-captcha/letter3d');
const {challenge, solution} = letter3d.create({
	selection: 'multiple',
	mode: 'relative',
	constraintCount: 2
});
// Send the prompt, selection mode, dimensions and PNG to the client.
// Keep solution in the server-side record for this challenge.
const {prompt, selection, width, height, data} = challenge;

// In the submission handler, atomically consume the bound record first.
// points comes from the client as an array of {x, y}.
const checkAnswer = (record, points) => letter3d.verify(record.solution, points);
```

| Option | Values and effect |
| --- | --- |
| `selection` | `single` has one correct letter, `multiple` has two or three, and `mixed` (default) chooses per challenge. |
| `mode` | `direct` names the target attributes. `relative` compares facing with a uniquely described reference letter, which is excluded from the answer. `mixed` (default) chooses either. |
| `constraintCount` | `1`, `2` or `3` of letter, color and facing. Omit to vary the number. |
| `useColor` | Defaults to `true`. With `false`, generation uses monochrome letters and at most two constraints. |

Record a point anywhere on the image. A single selection replaces the previous point. Multiple selections accumulate and can be undone before submission. Send coordinates relative to the displayed image content, with its top-left corner at `{x: 0, y: 0}` and both values strictly below 1. For an image rendered at its natural aspect ratio, use `x = (clientX - rect.left) / rect.width` and the equivalent formula for `y`. Exclude padding and any letterboxing from `rect`. The server checks the visible letter faces. Points on background, including holes, fail, as do missing targets, extra points and two hits on the same letter.

Keep `solution` in a binary-capable store. For a JSON-backed store, encode `objectAtPixel` with `Buffer.from(solution.objectAtPixel).toString('base64')` and restore it with `Buffer.from(encoded, 'base64')` before verification. Bind the record to the session and action, expire it and consume it on the first bound submission.

Run `node examples/letter3d/server.js` from the package directory to try issuance and verification in a browser. The example supports keyboard placement and monochrome challenges. Set `LETTER3D_ALTERNATIVE_URL` to the HTTP or HTTPS address of the application's existing nonvisual verification flow to display its link alongside the challenge. [Runnable example](examples/letter3d/server.js)

## Serving and verifying a challenge

Send the image and an opaque challenge ID to the browser. Keep the expected answer on the server. The example binds each challenge to a session and the signup action, expires it after two minutes, and consumes it on the first bound verification attempt. Keep a separate rate limit for issuance and submission.

`challengeStore`, `limits` and `completeSignup` represent your application's storage, rate limiting and signup logic. `challengeStore.put(record)` stores the record until `expiresAt`. `challengeStore.take({id, sessionId, purpose})` must atomically return and delete an unexpired record only when all three fields match. Use a shared store when running multiple server processes.

```js
const {createHmac, randomBytes, timingSafeEqual} = require('node:crypto');
const captcha = require('svg-captcha');

// Load a dedicated secret of at least 32 random bytes from server configuration.
function mountCaptchaRoutes(app, {challengeStore, limits, answerKey, completeSignup}) {
	const purpose = 'signup';
	const ttl = 2 * 60 * 1000;

	function answerTag(id, answer) {
		return createHmac('sha256', answerKey).update(id).update(':').update(answer).digest();
	}

	app.get('/signup/captcha', async (req, res, next) => {
		try {
			if (!await limits.allow(req, 'captcha:issue')) {
				return res.sendStatus(429);
			}

			const {data, text} = captcha.createStrong();
			const id = randomBytes(24).toString('base64url');
			await challengeStore.put({
				id,
				sessionId: req.sessionID,
				purpose,
				expiresAt: Date.now() + ttl,
				tag: answerTag(id, text).toString('hex')
			});
			res.set({'Cache-Control': 'private, no-store', 'X-Captcha-Id': id});
			return res.type('image/png').send(data);
		} catch (err) {
			return next(err);
		}
	});

	app.post('/signup', async (req, res, next) => {
		try {
			if (!await limits.allow(req, 'captcha:verify')) {
				return res.sendStatus(429);
			}

			const {challengeId, captchaAnswer} = req.body ?? {};
			if (typeof challengeId !== 'string' || challengeId.length !== 32 ||
				!/^[A-Za-z0-9_-]{32}$/.test(challengeId)) {
				return res.sendStatus(400);
			}

			const record = await challengeStore.take({id: challengeId, sessionId: req.sessionID, purpose});
			if (!record || typeof captchaAnswer !== 'string' || captchaAnswer.length !== 6 ||
				!/^[A-Za-z0-9]{6}$/.test(captchaAnswer)) {
				return res.sendStatus(400);
			}

			const candidate = answerTag(challengeId, captchaAnswer.toUpperCase());
			if (!timingSafeEqual(candidate, Buffer.from(record.tag, 'hex'))) {
				return res.sendStatus(400);
			}

			return await completeSignup(req, res);
		} catch (err) {
			return next(err);
		}
	});
}
```

Configure session middleware before these routes and initialize the session when serving the signup page. Configure body parsing with an application-appropriate request limit. Have the client read `X-Captcha-Id` from the image response and submit it as `challengeId` together with `captchaAnswer`. Fetch a fresh challenge after every unsuccessful attempt. If you change the profile's size or alphabet, update the verifier's input rules to match.

## Migration and tests

Version 2.0.0 requires Node.js 22 or later and validates options more strictly. Run `npm ci` and `npm test` in the checkout to use the built-in Node.js test runner. See [the changelog](CHANGELOG.md) for release details.

Review existing option values before upgrading, especially numeric strings, named CSS backgrounds, empty filtered alphabets, and invalid arithmetic bounds. The SVG methods still return strings. Applications using `createStrong()` should serve its buffer as `image/png`.

## Publishing a release

Development happens on `main`. To prepare a release, run `npm version 2.0.1 --no-git-tag-version` with the intended version to update both manifests, then add a section for it to [CHANGELOG.md](CHANGELOG.md). Land those changes on `main` and push them before tagging the release commit. For example, from the up-to-date `main` checkout:

```sh
git tag -a v2.0.1 -m "Release v2.0.1"
git push origin v2.0.1
```

The workflow checks that the tag points to a commit in `main` and matches the versions in both manifests. It runs tests on Node.js 22 and 24, smoke-tests the npm tarball, and publishes it with `SHA256SUMS` on GitHub Releases. A tag such as `v2.1.0-rc.1` creates a prerelease. npm registry publication is a separate step.

To verify an existing tag, run **Release** in the repository's **Actions** tab, enter the existing version in **tag**, and leave **dry_run** enabled. Download the package and checksum from the workflow run's artifacts. To publish an existing tag, disable **dry_run**. If an earlier attempt left a draft, review it in GitHub Releases before rerunning.

## License

[MIT](LICENSE.md)

This project is based on [produck/svg-captcha](https://github.com/produck/svg-captcha) and is maintained by `jellyfish-p`.
