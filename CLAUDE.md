# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page static portfolio piece ("PLINTH / 001") presenting a 3D-modeling case study for a lounge chair — reference plates, material/mood variants, and a live 3D viewer. There is no build system, package manager, framework, or test suite: it's plain HTML/CSS/vanilla JS served as static files, with three.js loaded from a CDN via an import map.

## Running / previewing

There's no dev server or build step. Open [index.html](index.html) directly in a browser, or serve the folder over HTTP so ES module imports and `fetch` (used by the viewer's fallback probe) work correctly, e.g.:

```
npx serve .
# or
python -m http.server
```

Opening via `file://` will break the module viewer (`assets/js/viewer.js`) in most browsers due to CORS restrictions on ES modules — use a local server when testing the 3D viewer.

There is no lint/test/build command to run after changes; verify visually in the browser.

## Cache-busting convention

`index.html` references `assets/css/style.css` and the two JS files with `?v=N` query strings (e.g. `style.css?v=60`, `main.js?v=24`, `viewer.js?v=5`). **Bump the relevant `?v=` number whenever you edit that file** — this is the only cache invalidation mechanism in use, there's no build hash.

## Architecture

Everything hangs off one file, [index.html](index.html), organized as a sequence of `<section class="sheet">` blocks representing "contact sheet" plates (index grid, clay-material views, renders, mood variants, postpro views, interior, 3D viewer). Two independent, dependency-free JS files run against this markup:

- **[assets/js/main.js](assets/js/main.js)** — all page chrome and interaction that doesn't need 3D: scroll progress bar, nav solid/scroll-spy state, `IntersectionObserver`-based reveal-on-scroll, mobile menu, the film modal, and the image lightbox. The lightbox groups images by the closest ancestor's `data-gallery` attribute and reads `data-full`/`data-caption` off each `.tile`/`.bleed` button — new galleries just need those data attributes, no JS changes. Also includes a drag-to-scrub turntable fallback (`#viewerFallback`, 36 numbered frames under `assets/img/turntable/`) and a 7s watchdog that swaps to it if no `<canvas>` appears in `#viewerCanvas` (i.e. three.js/CDN failed).
- **[assets/js/viewer.js](assets/js/viewer.js)** — the three.js viewer, loaded as an ES module (see the `importmap` in `index.html` pinning `three@0.169.0` from jsdelivr; bump both the importmap and the DRACOLoader decoder path together if upgrading). Loads two real LODs (`assets/model/chair_low.glb` default, `chair_high.glb` on demand) via `GLTFLoader` + `DRACOLoader`. GLBs are expected to ship *without* materials — a shared clay `MeshStandardMaterial` is applied when the glTF has no materials, so the shape reads on its own. Falls back in order: turntable images (if `assets/img/turntable/frame-001.webp` exists) → a procedurally-built box "proxy" chair (`buildProxy()`), so the viewer never shows an empty rectangle. GLTF load and scene-assembly are deliberately separated (see the comment above `loadLod`) so an assembly bug doesn't get miscategorized as a network failure.

Styling ([assets/css/style.css](assets/css/style.css)) is one file built around a strict 12-column "sheet" grid with 1px hairline gutters standing in for all borders (`--line` background showing through `gap`, not actual `border` rules) — see the "The sheet" and "Plates" sections. Key conventions to preserve when adding markup:
- Grid spans use utility classes `.w2/.w3/.w6/.w9/.w12` scoped as `.sheet > .wN`.
- Repeating image groups use `.strip` (5 or 6 col sub-grid) + `.tile` buttons; plates are auto-numbered via CSS `counter(plate)` on `.tile::before` — use `.tile--bare` to opt a tile out of numbering (e.g. the index sheet) without breaking the count for later plates.
- Key/value blocks (pipeline steps) reuse `.data.data--1` rather than one-off styles.
- All CSS custom properties (colors, spacing, easing) are defined once on `:root`; there's no dark/light theme toggle (site is dark-only, `color-scheme:dark`).
- Responsive behavior remaps grid spans at `1000px`/`640px` breakpoints rather than changing structure.

## Content notes

- `index.html` currently has `<meta name="robots" content="noindex, nofollow">` with a comment explaining it's intentional while renders are placeholders — remove only when told the page is ready to publish.
- Some external links (Portfolio, ArtStation, LinkedIn in the footer) are still placeholders (`href="#"`) — don't treat their absence as a bug unless asked to wire them up.
- Comments in the JS/CSS are a mix of English and Portuguese; match whichever language a given comment block already uses when editing nearby.
- There is no Specs/delivery section (removed by request) — the `.spec` table CSS and the `downloads/` PDF/MP4 links that lived only in that section were removed along with it. Nav no longer has a `#specs` entry; the `01 3D` link now carries the `nav__link--cta` styling that `Specs` used to have.

## Sharing / SEO meta

`index.html`'s `<head>` carries a full Open Graph + Twitter Card set (title, description, `og:site_name`, `og:locale`, canonical link) plus a dedicated share image: **`assets/img/og-interior.jpg`** (1200×630, cropped from `images/chair/interior.webp`, regenerated via Pillow — center-crop to a 1.91:1 ratio then resize, not a straight resize, so nothing gets squashed). If the interior render changes, regenerate that crop rather than hand-editing it, and keep `og:image`/`twitter:image` pointed at the same file. `<meta name="robots" content="noindex, nofollow">` only affects search engines — it does **not** block social/chat link-preview scrapers (Slack, WhatsApp, iMessage, LinkedIn, etc.), so share previews work correctly even while the page stays out of Google.

## Asset hygiene

- Only files actually referenced by `index.html`/`main.js`/`viewer.js` should live under `images/` and `assets/img/` — this repo previously accumulated ~148MB of orphaned raw PNG exports and unused WIP folders (`assets/img/{interior,lowpoly,moods,research,sculpt,studio}`) that were never linked from the page; these were removed. Before adding new renders, wire them into a `<section class="sheet">`/`data-gallery` rather than dropping them in `images/chair/` unreferenced.
- In-use `images/chair/*.webp` are capped at 1400px on the long edge and re-encoded at quality 82 — that's plenty for the grid tile sizes they render at (see `.tile`/`.ar-*` in the CSS). Don't re-introduce full-resolution (2000px+) exports directly into this folder; keep a separate archive outside the repo for print/high-res masters.
