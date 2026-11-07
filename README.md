# ASCII Rose Generator

A cinematic, fully procedural ASCII rose that grows character by character. Every petal, leaf, thorn, star and glyph is generated in the browser at runtime with HTML5 Canvas and JavaScript. There are no images, no emoji and no pre-baked rose art anywhere in the project.

**Live concept:** black void → starfield ignition → stem growth → leaf unfurl → petal expansion → finished bloom with ambient glow and drifting sparks, while the real source code that powers the scene streams through a syntax-highlighted console beside it.

---

## Quick start

### Option 1 — open the file directly

Double-click `index.html` (or open it in any modern browser). The animation and all exports work from `file://`. The source console uses the bundled `source-snapshot.js` because browsers block `fetch()` on local files.

### Option 2 — run a local server (recommended)

Python 3 is the only requirement:

```bash
cd ascii-rose
python serve.py
```

Then open <http://localhost:8000>.

Or use the standard library server directly:

```bash
python -m http.server 8000
```

With a server running, the source console fetches the actual `.js` files live on every load (`cache: no-store`), so edits appear on refresh.

You can lock a specific genome with a URL seed:

```text
http://localhost:8000/?seed=0x9A3F12C7
http://localhost:8000/?seed=123456789
```

The seed is also mirrored in the HUD and footer. Copy it to reproduce the exact rose later.

---

## What is actually generated

| Element | How it is made |
| --- | --- |
| Rose head | Layered parametric petals with ruffled edges, rounded tips and a spiral centre, generated in `petal-generator.js` from a seeded RNG |
| Stem | A curved Bézier ribbon with variable width, thorn wedges and growth nodes |
| Leaves | Two serrated leaf silhouettes with midribs and branching veins |
| Glyph field | An offscreen supersampled raster is sampled per character cell; coverage, luminance, edge strength and depth select each glyph, colour and opacity |
| Stars | Canvas particle field with twinkling, parallax dust, occasional shooting stars and a bloom burst |
| Animation | A per-glyph `progress` threshold staggers growth from the bottom upward (stem → leaves → flower), then a completed scene keeps breathing with glow, shimmer and sparks. The default timeline is tuned to finish in about 12 seconds |
| Source console | Real JavaScript files, syntax highlighted, revealed line by line, auto-scrolled, with a blinking cursor |

The rose is not drawn as a finished image and then hidden behind an animation. The geometry is rebuilt from the seed, rasterised into an offscreen field, sampled into individual character records, and only characters whose growth threshold has passed are painted on each frame. The reveal climbs from the base of the stem to the top of the bloom one character at a time.

---

## Interaction

The page is intentionally a clean view: there is no visible control deck or configuration panel. The bloom auto-starts with maximum petal complexity and maximum star density, and completes in roughly 12 seconds. These hidden keyboard shortcuts still work:

| Key | Action |
| --- | --- |
| `Space` | Pause / resume |
| `R` | Restart sequence |
| `N` | New rose variation |
| `F` | Toggle fullscreen |
| `Esc` | Exit fullscreen |

Shortcuts are suppressed while typing in a form field. The engine remains exposed at `window.asciiRose.engine` for console use, including `downloadTXT()`, `exportPNG()` and `getASCII()`.

---

## Project structure

```text
ascii-rose/
├── index.html              Page structure, stage and source console
├── style.css               Terminal/lab UI, responsive and fullscreen layouts
├── script.js               Boot sequence, URL seed parsing, public debug hook
├── rose-engine.js          Rasteriser, glyph field, timeline, render loop, exports
├── petal-generator.js      Seeded procedural rose/stem/leaf geometry
├── particle-system.js      Starfield, dust, twinkling, shooting stars, bloom sparks
├── code-display.js         Live source fetching, highlighting, reveal, auto-scroll
├── controls.js             Hidden keyboard shortcuts, telemetry, fullscreen
├── source-snapshot.js      AUTO-GENERATED file:// fallback (do not edit)
├── tools/
│   └── build-snapshot.py   Regenerates source-snapshot.js from real sources
├── serve.py                Tiny no-cache local server
├── vercel.json             Vercel static deployment config
├── netlify.toml            Netlify static deployment config
├── .nojekyll               Disables Jekyll processing on GitHub Pages
└── README.md
```

### After editing source files

Regenerate the offline source snapshot so the `file://` console stays truthful:

```bash
python tools/build-snapshot.py
```

Over HTTP this is optional, because the console fetches the files directly.

---

## Performance notes

- The rose is rasterised once per rebuild into three offscreen canvases (flower, stem, leaves), then reused.
- Character records are plain objects with precomputed glyph, colour, opacity, glow, depth and growth threshold.
- The main loop only paints glyphs that are currently visible; completed frames animate through cheap alpha/glow modulation.
- Resize is debounced and the field is rebuilt at the new grid resolution.
- Device pixel ratio is capped at `2` to avoid runaway fill cost on high-density screens.
- The render loop pauses work when the tab is hidden.
- Star density and character density are independent so mobile users can keep the sky lush while reducing glyph cost. The default star density is the maximum supported (`2.5×`).
- The bloom duration is derived from the timeline at runtime, so the default 12-second target stays accurate across seeds and complexity changes.
- FPS, glyph count and phase are reported live in the HUD.

Target is 60 FPS on a typical desktop; the layout adapts below 980 px and again below 640 px. The code panel remains usable on phones.

---

## Deployment

The project is 100% static. No build step, no server code, no dependencies.

### Vercel

**Dashboard:** create a new project, import the repository (or drag the folder into Vercel), leave the framework preset as **Other**, root directory as the project root, build command empty, output directory `.`.

**CLI:**

```bash
npm i -g vercel
cd ascii-rose
vercel
vercel --prod
```

`vercel.json` supplies sensible static headers. No rewrites are required because every file is served directly.

### Netlify

**Dashboard:** **Add new site → Import an existing project**, or drag the `ascii-rose` folder onto <https://app.netlify.com/drop>.

**CLI:**

```bash
npm i -g netlify-cli
cd ascii-rose
netlify deploy
netlify deploy --prod
```

`netlify.toml` sets the publish directory to the project root and adds revalidation headers.

### GitHub Pages

1. Create a repository and push the contents of `ascii-rose/` to the default branch (usually `main`).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and the `/ (root)` folder, then save.
4. Wait for the Pages build and open `https://<user>.github.io/<repo>/`.

The included `.nojekyll` file prevents Jekyll from ignoring files and keeps the static asset paths intact. No relative-path changes are needed because all references are already relative.

### Any static host

Upload the folder as-is to Cloudflare Pages, Render, S3 + CloudFront, Firebase Hosting, nginx, Apache, or any static file server. MIME types should be standard (`.js` as `text/javascript`).

---

## Browser support

- Current Chrome, Edge, Firefox and Safari on desktop.
- iOS Safari and Android Chrome.
- Requires Canvas 2D, `requestAnimationFrame`, `ResizeObserver` (with a `resize` fallback) and `Path2D`.
- Clipboard write may require a secure context (`https` or `localhost`); the copy button falls back to a hidden textarea when the Clipboard API is unavailable.

---

## Truthfulness checklist

- The rose is composed of individually animated canvas glyphs, not an image or emoji.
- Petal count, layers and character count in the HUD are read from the live engine.
- The source console displays the actual project files, including the file that renders it.
- Every control is wired to a real engine method and every exporter produces real output.
- `DOWNLOAD .TXT` contains the current glyph field; `EXPORT .PNG` renders the current stage at up to 3× scale.

---

## License

MIT. Use it, remix it, grow stranger roses.
