# Porting brief (standard, reusable)

You are reconstructing one or two Pro items of the uiarc.dev library from their shipped
artifacts into this repo. Read `PORTING.md` first (pipeline, gates, shell rules) and
`METHOD.md` (why the shell looks the way it does, irreducible residues). This file lists the
constraints every port must satisfy.

## Three component families

`catalog.json` has `components`, `blocks` and `special` groups. **Special components** (Docks and tabs,
Glass, Surfaces, Galleries, Audio and video, Data, Type, Loaders, Playful, Cursor, AI, Illustrations) are
still `kind=component`:

- capture: `node scripts/capture.mjs <slug>` (no `--kind` flag), page URL `https://uiarc.dev/components/<slug>/frame`
- route in the clone: `/components/<slug>` (same `ItemPage kind="component"`)
- gates: `node scripts/dom-diff.mjs <slug>` and `node scripts/compare.mjs <slug>` (no `--kind=block`)

Note that many of them are effect-style and mount a `data-layout="app"` (full-bleed) or `canvas:"bleed"`
frame — read `<main data-layout data-width>` from `captures/<slug>/frame.html`; `scripts/frames-sync.mjs --write`
already has an entry for every captured slug.

## Inputs

`captures/<slug>/` — `frame.html` (live DOM), `styles.css` (the item's slice of its CSS module),
`styles.full.css` (the untouched group bundle, when the slice was carved), `chunk.js`
(beautify with `npx prettier@3 --parser babel captures/<slug>/chunk.js > /tmp/<slug>.pretty.js`),
`css.json`, `shot.png`, `meta.json`.

The DOM's module prefix is not always the slug — take it from `frame.html`. A capture may contain
two co-located modules; namespace the collisions and say so.

## Output

Per item, under `src/components/arc/<slug>/`:

- `<slug>.tsx` — named export + default export, typed props with JSDoc matching `public/docs/<slug>.md`,
  no `any`, no `@ts-ignore`, no non-null-assertion shortcuts.
- `<slug>.module.css` — the de-hashed shipped CSS (`.prefix_someName__HASH` → `.someName`, camelCase),
  declarations byte-identical, `@keyframes`/`animation:` rewritten to the module-local names.
- `demo.tsx` — `export const meta = "Live · block"` (or `"Live · keyboard ready"` for components) and
  `export default function <Name>Demo()`. Demos auto-register via `src/previews.ts`; never edit it.
- `demo.module.css` — only when the demo needs its own chrome.

Reuse local ports instead of re-implementing: `src/components/arc/{button,copy-button,segmented-control,
animated-counter,text-morph,tooltip,avatar,avatar-group,badge,input,switch,checkbox,slider,select,tabs,
bottom-sheet,empty-state,filter-toolbar,lib/motion-tokens,lib/media,lib/arc-provider}`. Export shapes:
SegmentedControl default-only, CopyButton named-only, Button/Slider/AnimatedCounter/TextMorph both.

Available deps: `motion/react`, `lucide-react`, `@radix-ui/*`, `d3-*`, `@fontsource-variable/*`.
CSS modules only (no Tailwind). A missing package may be installed with `pnpm add` and reported.
Media under `public/media/…` may be fetched from `https://uiarc.dev/media/...`.

## Hard gates

```
PYTHON=/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
  node scripts/compare.mjs <slug> --kind=block          # ≥99.0, 100.0 expected
PYTHON=… node scripts/compare.mjs <slug> --kind=block   # with STABLE=1 as well
node scripts/dom-diff.mjs <slug> --kind=block           # --struct for mid-flight animations
WAIT=6000 node scripts/dom-diff.mjs <slug> --kind=block # settled pass for auto-starting / streaming items
npx tsc --noEmit                                        # clean for your files
```

`dom-diff.mjs` samples at 1200 ms by default; for an item that auto-starts or streams, run it again with
`WAIT=6000` and report that pass — a fixed early sample compares two different phases and invents
hundreds of "mismatches". State which sampling mode is honest for your item and why. Non-`STABLE` is honest for a block that
rests immediately; `STABLE=1` for anything with an entrance, a loop or a server-rendered clock that
starts before networkidle. Report verbatim gate lines.

## Shell facts (measured — do not re-derive)

- `src/index.css` already ships the reference base sheet: `h1..h6{font-weight:500;line-height:1.1!important}`,
  `h1,h2,h3{font-family:var(--font-display);letter-spacing:var(--tracking-display)}`, body `-0.01em`,
  `::selection{background:var(--surface-muted)}`, and a `button,input,textarea,select{letter-spacing:inherit}` fix.
  h4–h6 stay on the body face — only override `font-family` after measuring.
- The reference's Tailwind preflight zeroes form-control padding and collapses sr-only tables; this repo's
  sheet does not. When a box is off by exactly the padding/border difference, add a scoped rule:
  `.srOnly table{border-collapse:collapse}` + `.srOnly th,.srOnly td{padding:0}`,
  `.field input[type=text]{padding:0}` — each with a comment naming the measurement.
- Radix portals mount to `<body>`, outside `.root`: duplicate any reset the sheet puts on `.root` into the
  sheet classes themselves (see the commented block in `search-results.module.css`).
- Flattening: the live preview route injects inline `border:0;border-radius:0;box-shadow:none;
  background:transparent` plus `data-frame-flat` on the block root (or, for some blocks, on inner nodes
  only — read the capture!). Reproduce it with either an optional `flat?: boolean` prop, a demo-level
  `.flat.flat{…}` override, or a commented `:global(main[data-layout]) …` block. Never edit `src/frame/*`.
- Specificity: `src/frame/frame.module.css` sets `.root *{box-sizing:border-box}` at (0,1,1), so a module
  rule of one class loses — double the class (`.region.region{…}`) when a box-sizing or padding reset is
  being overridden.
- A missing frame entry → `node scripts/frames-sync.mjs --write`. Never hand-edit `src/data/frames.json`.

## Off limits

`src/index.css`, `src/previews.ts`, `src/frame/*`, `src/data/frames.json`, `src/site/*`,
`src/data/catalog.json`, and other components' directories. The dev server is already running on port
5183 — use it, never start or kill it. Scratch probes must be `.probe-<slug>-<task>.mjs` and deleted
afterwards; leave no prettified build files in the repo root. Several agents run in parallel in this
repo, so never delete a `.probe-*` file that is not yours and never reuse a shared scratch name.

Operator precedence in "pick the best candidate" code: compare the *whole* OR-expression —
`(score(c) - score(best) || |best - v| - |c - v|) > 0` — not `score(c) || |best - v| - |c - v| > 0`,
which silently accepts a worse candidate (measured: live 1020 vs wrong 1380 in `time-dial`).

## Behaviour = pixels

A/B the live frame (`https://uiarc.dev/components/blocks/<slug>/frame`) against
`http://localhost:5183/frame/<slug>` with Playwright (`playwright-core` installed, Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`): interactions, keyboard, ARIA, hover and
focus states, validation messages, responsive breakpoints, reduced motion. Normalise hashed class names
and `useId` prefixes before diffing markup. A pixel-identical static frame with wrong behaviour is not a
port.

## Report

Files with line counts, verbatim gate lines, the sampling mode you trust, every behaviour you verified
A/B, and every deliberate deviation with the measurement that justifies it.

## Shared group bundles (two known items)

`selection-toolbar` and `multi-step-form` are served from ONE shared webpack chunk
(`captures/{selection-toolbar,multi-step-form}/chunk.js` are byte-identical, 120 KB, md5
`a9f44ba05d6a873e7e0efb704bd1e5d2`). It contains the whole "Special inputs"/"Auth" group:
file-dropzone 52 classes, previews-actions-inputs 39, file-upload 33, multi-step-form 27,
multi-select 18, split-button 17, select 16, button 15, selection-toolbar 15, combobox 14,
time-picker 13, action-button 12, password-field 10, input 10.

Port only your item's module: locate it by its class prefix (`selection-toolbar_` /
`multi-step-form_`) and by the component function name in the module registry, ignore the rest.
`styles.css` for `multi-step-form` is likewise a group sheet — slice with
`node scripts/css-slice.mjs multi-step-form --write` if it still contains foreign prefixes.
