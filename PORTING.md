# Porting a Pro item

Goal: a faithful React + CSS-module reconstruction of a Pro component or block, verified against the
live preview frame. Nothing else in the site shell matters.

## Components and blocks differ in one way

A component's CSS module prefix equals its slug (`emoji-picker_*`). A **block** ships its own module
with a shorter prefix (`blocks/ai-chat` renders `chat_*`, `blocks/metrics-dashboard` renders
`dashboard_*`). `captures/<slug>/meta.json` records the detected `marker` and `modulePrefixes`, and
`frame.html` is always the ground truth.

Mounting differs per item, not per kind: `frame.html`'s `<main data-layout data-width>` plus the
presence of a `previews-demos_canvas` wrapper decide it. Most blocks mount full-bleed
(`canvas: "none"`, no canvas wrapper); some are centred in a canvas like a component. Read the
attributes from the capture instead of assuming — `src/data/frames.json` already carries the parsed
value for every captured slug, and `scripts/frames-sync.mjs --write` fills in new ones.

Capture selection rules worth knowing (they bit us once): the item's module prefix is the slug when
the DOM renders it, otherwise the most frequent *non-shared* prefix (`animated-counter`, `button`,
`segmented-control`, `text-morph`, … appear on almost every frame). `styles.css` is the smallest CSS
body that still carries the item's own selectors, and `chunk.js` is the body with the most distinct
item classes — not the largest file, which used to grab a route-wide bundle or the wrong chunk.

## Inputs (per item)

`captures/<slug>/` holds everything the public preview frame ships:

| file         | what it is                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| `frame.html` | server-rendered markup of the live demo — the structural ground truth       |
| `styles.css` | the item's own CSS module, flat and hashed (`.slug_class__hash`)            |
| `chunk.js`   | webpack chunk with the demo + the component implementation                  |
| `css.json`   | every CSSOM rule of the frame, for rules that live in shared stylesheets     |
| `shot.png`   | full-frame screenshot                                                      |
| `styles.full.css` | the untouched stylesheet when slicing removed sibling rules (see below) |

Re-capture any time with `node scripts/capture.mjs <slug> [--kind=block]`.

### One stylesheet can hold several items

Analytics, Developer, Pricing and Settings blocks ship **one CSS module per group**, so a capture's
`styles.css` sometimes starts with a different item (`.cohort-retention_root{…}` on `mrr-waterfall`).
`scripts/capture.mjs` therefore slices the file down to the blocks whose selectors mention the item's
marker and leaves the original in `styles.full.css` (`scripts/css-slice.mjs <slug> --write` redoes it).
Port only your own item's rules; if you see a foreign prefix in `styles.css`, run the slicer and
compare against `styles.full.css` before assuming a rule is missing.

Check the whole corpus at any time with `node scripts/audit-captures.mjs` (flags `bad-chunk`,
`css-thin`, `no-chunk`) and `node scripts/queue.mjs` (what is still unported, with capture sizes).

## Steps

1. **Read the markup.** `frame.html` shows the exact element tree, ARIA wiring, inline `style`
   custom properties, and the order of children. Keep class semantics and DOM shape identical.
2. **Beautify the chunk.**
   ```bash
   npx prettier@3 --parser babel captures/<slug>/chunk.js > /tmp/<slug>.js
   ```
   Look for the component function (props destructured at the top) and the preview/demo function that
   renders sample data. Client components start with a `"use client"` module wrapper.
3. **Dehash the CSS.** Every selector looks like `.avatar-upload_dropZone__x9Kq2`. Strip the hash and
   camel-case the name:
   ```bash
   perl -pi -e 's/\.([a-z0-9-]+)_([A-Za-z0-9-]+)__[A-Za-z0-9_]+/.$2/g' captures/<slug>/styles.css
   ```
   Then convert remaining kebab names to camelCase, and rewrite each selector to
   `styles.<name>` in the component (`import styles from "./<slug>.module.css"`). Keyframes need the
   same treatment (`@keyframes slug_name__hash` → `@keyframes name`).
4. **Write the files.**
   ```
   src/components/arc/<slug>/<slug>.tsx           # component, exported default + named
   src/components/arc/<slug>/<slug>.module.css    # dehashed module
   src/components/arc/<slug>/demo.tsx             # default export = the live demo; `export const meta`
   src/components/arc/<slug>/demo.module.css      # only if the demo has its own styles
   ```
   The demo is auto-registered by `src/previews.ts` (it globs every `demo.tsx`), so do not edit any
   shared file.
5. **Port honestly.** Behaviour matters as much as pixels: state, keyboard handling, timers,
   `useReducedMotion`, focus management, ARIA attributes, pointer/keyboard parity, animations.
   Types stay strict — no `any`, no `@ts-ignore`. Props get the JSDoc from `public/docs/<slug>.md`.
6. **Verify.**
   ```bash
   PYTHON=/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
     node scripts/compare.mjs <slug>
   ```
   It screenshots `https://uiarc.dev/components/<slug>/frame` and `http://localhost:5183/frame/<slug>`,
   then reports `diff N% of pixels · score N` plus the hottest 32px cells. Iterate until the score is
   ≥ 98 (the bar we actually accept is ≥ 99, and most ports reach 100.0), and open
   `captures/<slug>/diff.png` to see what still differs. Element geometry (`getBoundingClientRect`)
   should match exactly; text antialiasing is the only acceptable residual.
   For anything with a timer, a loop or a feed, also run `STABLE=1 node scripts/compare.mjs <slug>`
   — it samples until two consecutive frames are byte-equal, which removes the "the reference clock
   started a second earlier" phase difference. Report which mode you used and why.
   Then check structure: `node scripts/dom-diff.mjs <slug>` compares path/tag/box/text/role/ARIA
   (`--struct` drops the box test for marquees and streams). Same pixels with a different tree is not
   a port.
7. **Typecheck.** `npx tsc --noEmit` must stay clean.

## Dependencies

Use what the chunk imports: `motion/react` (`motion`, `AnimatePresence`, `useReducedMotion`,
`useMotionValue`, `animate`), `lucide-react`, `@radix-ui/react-*`, `d3-*` for the charts. All are
already installed; add a package only when the chunk genuinely needs it, and say so.

## Don'ts

- No Tailwind utility classes — the whole library is CSS modules.
- Do not change other items' files, `src/data/catalog.json`, or the site shell.
- Do not invent a different visual design when a value is missing; measure the live element instead.
- Do not import `{ SegmentedControl }` — that module only has a default export (`import SegmentedControl from "../segmented-control/segmented-control"`). A named import breaks the Vite module graph for every frame until it is removed.
- `motionTokens.ease.*` are readonly tuples; pass them as `ease: [...motionTokens.ease.standard] as [number, number, number, number]`, otherwise motion's `Transition` type rejects them (TS2322).

## Hard gates (run both)

```bash
PYTHON=/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 node scripts/compare.mjs <slug> [--kind=block]   # >= 98, aim 99.5
node scripts/dom-diff.mjs <slug> [--kind=block]                                    # 0 mismatches, or every remaining one explained
```

`dom-diff.mjs` is the honesty check the pixel score cannot give: same pixels with a different tree is
not a port. It compares path / tag / box (±1px) / text / role / aria-label. Expect residual noise only
from (a) text that animates between the two timestamps and (b) `<span>` wrappers Chrome adds around
whitespace. Everything else is a bug.

## Frame shell is already correct — do not edit it

 * `src/data/frames.json` has an entry for **every** item (layout / width / canvas). Never add or change
   entries; if a block looks 560px wide it is because the demo itself sets `max-width`, not the frame.
 * `src/frame/frame.module.css` matches the reference: center layout is a 32px padded flex column with
   `margin:auto`, children sized `min(100%, var(--frame-width))`, and `:where(.content) > *` keeps
   specificity at zero so a component's own `max-width` still wins.
 * Items whose frame HTML has no `previews-demos_canvas` get `"canvas": "none"` and mount straight into
   the content column (that is why `catch-up` is 600px wide, not 880px).

## Typography (already applied globally — check before adding local fixes)

 * `src/index.css` self-hosts Inter + Geist through `@fontsource-variable`, sets
   `body { letter-spacing: -0.01em }`, and `button, input, textarea, select { letter-spacing: inherit }`.
   Chrome otherwise resets form controls to `normal`, which widens every button by ~1px per 8 characters.
 * Only add a local `letter-spacing` / `line-height` override when the live measurement disagrees with the
   shipped CSS *and* you have the measured numbers to prove it (e.g. `.title` really is `-.03em / 1.1`).
   Never compensate with font-size.
