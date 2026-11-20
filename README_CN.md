![svg-captcha](https://raw.githubusercontent.com/jellyfish-p/svg-captcha/v2.0.0/media/header.png)

[English](README.md)

在 Node.js 中生成 SVG 或 PNG 验证码，无需安装原生扩展。运行环境要求 Node.js 22 或更高版本。

## 安装

在 [GitHub Releases](https://github.com/jellyfish-p/svg-captcha/releases) 中选择版本，按标签安装。例如：

```sh
npm install github:jellyfish-p/svg-captcha#v2.1.0
```

也可以在本地检出该标签后安装。

```sh
npm install ../svg-captcha
```

## 使用方法

```js
const captcha = require('svg-captcha');

const {data, text} = captcha.createStrong();
// data 是 PNG Buffer，以 image/png 发送。
// text 是正确答案，供服务端核验。

const svg = captcha.create();
// svg.data 是 SVG 字符串，以 image/svg+xml 发送。

const math = captcha.createMathExpr({mathMin: 0, mathMax: 9, mathOperator: '+/-'});
// math.text 是 math.data 所显示算式的结果。
```

新接入的图片验证码可使用 `createStrong()`。它默认从较容易区分的字符集中抽取六个字符，随机改变字形的位置、缩放、旋转、倾斜和弯曲程度，再渲染为像素。SVG 接口的字形路径仍可用于模板匹配，PNG 图片可通过 OCR 或视觉模型识别。图片验证码宜配合限流等防滥用措施使用。

[视觉识别实测报告](https://github.com/jellyfish-p/svg-captcha/blob/v2.0.0/reports/vision/README.md)

[后续干扰样式和配色实验](https://github.com/jellyfish-p/svg-captcha/blob/v2.0.0/reports/vision/iterations.md)

## API

| 函数 | 返回值 |
| --- | --- |
| `create(options?)` | `{text: string, data: string}`，包含随机答案及 SVG 图片 |
| `createStrong(options?)` | `{text: string, data: Buffer}`，包含随机答案及 PNG 图片 |
| `createMathExpr(options?)` | `{text: string, data: string}`，包含算式结果及 SVG 图片 |
| `letter3d.create(options?)` | `{challenge, solution}`，包含中文题干、一张 PNG 与服务端判题数据 |
| `letter3d.verify(solution, points)` | 返回布尔值，检查每个目标字母是否恰好命中一次 |
| `svgCaptcha(text?, options?)` | 根据指定文本生成 SVG 字符串。省略文本时生成随机验证码。 |
| `randomText(sizeOrOptions?)` | 返回随机答案字符串，可以传数字长度或配置对象。 |
| `loadFont(filepath)` | 为后续调用加载可信的本地 OpenType 字体。 |

`svgCaptcha.options` 是可修改的全局配置对象。调用参数优先于显式设置的全局参数，其次采用下表中的默认值。将某个全局参数设为 `undefined` 或删除该属性可恢复默认值。此优先级同样适用于 `randomText()` 和可调用的模块导出。

| 参数 | 取值 | SVG 默认值 | PNG 默认值 |
| --- | --- | --- | --- |
| `size` | 1 至 16 的整数 | 4 | 6 |
| `width` | 16 至 512 像素的整数 | 150 | 210 |
| `height` | 16 至 256 像素的整数 | 50 | 68 |
| `fontSize` | 最大字号，8 至 256 像素的整数 | 56 | 52 |
| `noise` | 0 至 20 条干扰线 | 1 | 3 |
| `interference` | PNG 样式：`none`、`lines`、`beads`、`rings`、`decoy`、`mixed`、`balanced` 或 `beaded` | — | `none` |
| `interferenceDensity` | `mixed` 和 `beaded` 样式的密度，可设为 `1` 或 `2` | — | `1` |
| `palette` | PNG 配色：`default`、`shared`、`analogous` 或 `per-glyph` | — | `default` |
| `letterMimicProbability` | 每张 PNG 尝试一次空心圆字母伪装的概率，范围为 `0`–`1` | — | `0.5` |
| `color` | 布尔值。设置自定义背景时启用彩色。 | `false` | `false` |
| `inverse` | 布尔值。用于深色背景的浅色字形。 | `false` | `false` |
| `background` | 空字符串、`#RGB` 或 `#RRGGBB` | 透明 | 实心白色，反色时为深色 |
| `charPreset` | 最多 256 个 UTF-16 代码单元 | ASCII 大小写字母及数字 | `23456789ACDEFHJKLMNPRTVWXY` |
| `ignoreChars` | 最多 256 个需要排除的 UTF-16 代码单元 | 空 | 空 |

渲染时每个字形至少需要 6 像素宽度，字形会按画布尺寸缩放。如果尺寸过小，导致候选字符无法绘制成可见字形，`createStrong()` 会抛出异常。直接调用模块时可传入 1 至 16 个字符。生成随机验证码时，字符集过滤后至少要保留一个可绘制的字符。字符集会去重，每个字符以相同概率抽取。当前内置的 OpenType 解析器支持基本多文种平面的字符查找。

使用 `palette: 'default'` 时，可选 PNG 干扰样式让字符和干扰图形使用相同的墨色。`lines` 增强干扰曲线的对比度，`beads` 和 `rings` 在字符附近添加实心圆点或空心环，`decoy` 添加由圆点组成的小型残缺字形。`mixed` 结合高对比度曲线和空心环，密度设为 `2` 时每个字符附近会多一个环和一个实心圆点。`noise` 控制干扰曲线条数。使用默认长度时，可提示用户从左到右读取六个大字符。

`balanced` 也组合曲线和空心环，限制每个字形中部最多被一处干扰图形穿过。遇到无法通过中部的曲线，可以将其放在画布边缘附近。空心环还可出现在字形边缘和字符间隙。

`beaded` 沿用 `balanced` 对答案字形周围干扰物的限制，并在空间充足的字间和边缘加入来自当前字体的小型点状字形。使用 `palette: 'default'` 时，答案字形、曲线、空心环和圆点共用一种不透明墨色。计入圆点大小后，点状字形的高度不超过相邻两个答案字形中较矮者实际渲染高度的 75%。密度为 `1` 时，每两个答案字形大约尝试加入一个点状字形；密度为 `2` 时，每个答案字形最多尝试加入一个，整张图最多 12 个点状字形、216 个圆点。过滤后的字符集需要包含至少两个不同的可绘制字符。可提示用户从左到右读取笔画连续的大字符。

干扰样式要求画布至少高 26 像素，每个字符至少宽 12 像素。每个候选字形在变形前的着墨高度至少为 12 像素。如果 `20 × 缩放系数` 大于 12，`rings`、`mixed`、`balanced` 和 `beaded` 以该值作为最低高度。`decoy` 对应的系数为 23。干扰图形的缩放系数为 `min(1.45, width / (35 × size), height / 68)`。PNG 专用参数适用于 `createStrong()`。

`createStrong()` 可以给一个合适的字母加一小串空心圆，模拟 `P→R` 的斜腿、`F→E` 的底横或 `C→G` 的内横和右侧折笔。`text` 中的答案仍为实线字母。圆环相距过远或离原字形太远时，渲染器会跳过伪装。`balanced` 和 `beaded` 模式还要求所有伪装圆环避开各字形受保护的中部区域。将 `letterMimicProbability` 设为 `0` 可关闭，设为 `1` 会在每次生成时尝试。

`createMathExpr()` 的 `mathMin` 和 `mathMax` 接受 0 至 999 的整数，且 `mathMin <= mathMax`。两端均可抽取，默认范围为 1 至 9。`mathOperator` 可设为 `'+'`（默认）、`'-'`、`'+/-'` 或 `'+-'`。后两种写法均随机选择加法或减法。当前字体须支持可能出现的数字和运算符。

参数类型不正确时抛出 `TypeError`。超出范围、不支持的运算符、不合法的背景色和缺少可绘制的字形会抛出 `RangeError`。可以用 `noise: 0` 关闭干扰线，用 `mathMin: 0` 允许算式包含零。

## 彩色点状干扰 PNG

PNG 配色控制墨色。`default` 使用现有的 `color`、`inverse` 和 `background` 设置。`shared` 为所有图形随机选取一种色相。`analogous` 在同一色系内随横向位置变化。`per-glyph` 为每个字符槽的中心像素列选取不同的 RGB 颜色，并在相邻中心之间平滑过渡。它优先选择色相相差较大的相邻颜色，只有在用完符合对比度要求的不同候选颜色后才会复用颜色。

显式配色独立于 `color` 参数。在相同的横向位置，答案字形、干扰点和圆环使用相同的不透明墨色。每条干扰曲线从一个字符槽的中心像素列选取不透明墨色，从起点到终点保持同一种颜色。不透明墨色与背景的对比度至少为 4.5:1，抗锯齿边缘会与下层像素混合。

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

## 3D 字母落点验证

从 v2.1.0 起，可直接引用 `svg-captcha/letter3d`，也可从包根入口使用 `captcha.letter3d`。这个模块使用自己的立体字模和渲染配置，在一张 PNG 上分散放置字母。

在 Node.js 原生 ES 模块中可写 `import letter3d from 'svg-captcha/letter3d.js'`。

每张 480 × 360 的题图都混排大小不同的字母。生成器把 54–90 像素的字号范围按字母个数等分，每段随机抽一个字号，再随机分配给图中的字母。这个范围指投影前的字模高度，画面上的实际高度还会随朝向略有变化。

```js
const letter3d = require('svg-captcha/letter3d');
const {challenge, solution} = letter3d.create({
	selection: 'multiple',
	mode: 'relative',
	constraintCount: 2
});
// 把题干、作答模式、尺寸和图片发给前端，solution 存在服务端。
const {prompt, selection, width, height, data} = challenge;

// 在提交接口中先原子取出并消耗绑定本次会话和操作的记录。
// points 为前端提交的 {x, y} 数组。
const checkAnswer = (record, points) => letter3d.verify(record.solution, points);
```

| 参数 | 取值与效果 |
| --- | --- |
| `selection` | `single` 恰有 1 个目标，`multiple` 有 2 至 3 个目标，默认的 `mixed` 逐题抽取模式。 |
| `mode` | `direct` 直接描述目标，`relative` 要求与参照字母同向，默认的 `mixed` 逐题抽取。参照物唯一，始终排除在答案外。 |
| `constraintCount` | 从颜色、朝向、字母中指定 `1`、`2` 或 `3` 项约束。省略时随机选择项数。 |
| `useColor` | 默认 `true`。设为 `false` 时生成单色图，最多可指定两项约束。 |

用户可在图中任意位置落点。单选只保留最后一点，多选逐点添加，提交前可撤销。以实际显示的图像内容左上角为原点，将坐标归一化到 `[0, 1)`。按原图比例显示时可用 `x = (clientX - rect.left) / rect.width`，纵坐标同理。`rect` 取实际图像内容范围，扣除内边距和等比显示产生的留白。服务端按可见字面和侧壁判定，点到空白或字腔、少点、多点及重复点中同一目标均失败。

服务端按二进制保存 `solution`。使用 JSON 会话库时，将 `objectAtPixel` 用 `Buffer.from(solution.objectAtPixel).toString('base64')` 编码，取出后用 `Buffer.from(encoded, 'base64')` 还原。每题绑定会话和操作、设置有效期，并在第一次有效绑定的提交中原子取出并消耗。

在包目录运行 `node examples/letter3d/server.js`，打开终端打印的地址即可体验从签发到坐标校验的完整流程。示例支持键盘定位和无颜色题目。将环境变量 `LETTER3D_ALTERNATIVE_URL` 设为业务已有的非视觉验证地址（HTTP 或 HTTPS），页面会直接显示入口。[可运行示例](examples/letter3d/server.js)

## 服务端接入

向浏览器发送图片和随机验证码 ID，把正确答案的验证数据保留在服务端。将 ID 绑定到会话及操作，设置短有效期，并在第一次有效绑定的验证请求中原子读取并删除记录，答错也要消耗此次验证码。对生成及核验接口分别限流，并通过 `Cache-Control: private, no-store` 避免缓存。

[查看 Express 接入示例](README.md#serving-and-verifying-a-challenge)

## 升级和测试

v2.0.0 要求 Node.js 22 或更高版本，并收紧了参数校验。在本地检出的仓库中运行 `npm ci` 和 `npm test`，即可使用 Node.js 自带的测试工具。发布详情见[更新日志](CHANGELOG.md)。

升级前检查现有配置，尤其是以字符串传入的数值、CSS 命名颜色、过滤后为空的字符集和不合法的算式范围。SVG 接口仍返回字符串，新增 PNG 接口返回用于 `image/png` 的 Buffer。

## 发布新版本

`main` 是开发主线。发版时，将 `npm version 2.0.1 --no-git-tag-version` 中的版本号替换为目标版本，执行后会同时更新 `package.json` 和 `package-lock.json`。在 [CHANGELOG.md](CHANGELOG.md) 中添加对应条目，将这些变更合入并推送到 `main`。然后在已同步的 `main` 上为发布提交创建并推送标签，例如：

```sh
git tag -a v2.0.1 -m "Release v2.0.1"
git push origin v2.0.1
```

工作流会检查标签指向的提交是否在 `main` 的历史中，以及标签是否与两个清单文件中的版本号一致。随后在 Node.js 22 和 24 上运行测试，对 npm 压缩包做安装和冒烟测试，并将压缩包和 `SHA256SUMS` 发布到 GitHub Releases。`v2.1.0-rc.1` 之类的标签会发布为预发行版。向 npm 注册表发布需要单独操作。

如需验证已有标签，在仓库的 **Actions** 页面手动运行 **Release**，输入标签并保留默认启用的 **dry_run**，然后在运行记录的产物中下载压缩包和校验文件。如需发布已有标签，关闭 **dry_run**。如果上次运行留下了草稿，请先在 GitHub Releases 中检查草稿，再重新运行。

## 许可证

[MIT](LICENSE.md)

本项目基于 [produck/svg-captcha](https://github.com/produck/svg-captcha)，由 `jellyfish-p` 维护。
