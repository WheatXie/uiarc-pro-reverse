# How the Pro source is recovered

The site sells access to 17 Pro components and 113 Pro blocks. The source itself is gated
server-side; the *shipped* code is not. This file records the route that works, so any item can be
recovered and re-verified without an account.

## 1. What is actually gated

| endpoint | behaviour |
| --- | --- |
| `GET /api/component-source?kind=component&id=<slug>` | `403 {"error":"Sign in with Pro access to view this source"}` when signed out; `200 {source}` only with a Clerk session that carries Pro |
| `GET /api/component-source?kind=block&id=<slug>` | same gate; `kind` takes `component` or `block` (`components`/`blocks` → `400 Invalid source`) |
| `GET /r/pro/<slug>.json` | Pro registry, needs `Authorization: Bearer arc_pro_…` |
| `GET /r/registry.json`, `GET /r/<slug>.json` | public, free items only, `meta.tier: "free"`, full `files[].content` |

The client short-circuits to a locked panel when no `__client_uat` cookie is present, so the gate is
never even asked. Nothing useful lives behind it for our purposes.

## 2. What is not gated

`GET /components/<slug>/frame` (and `/components/blocks/<slug>/frame`) is the public preview iframe.
It server-renders the real component markup and then loads that component's own CSS Module and the
webpack chunk that contains the full implementation, including the demo. Consequences:

- `frame.html` gives the exact DOM: element order, ARIA wiring, inline `--custom-properties`.
- `styles.css` is the item's CSS Module, flat but hashed (`.emoji-picker_picker__jQ_Yj`).
- `chunk.js` contains the component function, its helpers, the dataset, and the demo — minified but
  not obfuscated beyond that.
- `css.json` (every CSSOM rule of the frame) covers rules that live in shared stylesheets.

`GET /components/<slug>/markdown` is public and carries the props table, usage snippet, keyboard
table, and accessibility notes — used for JSDoc and for `public/docs/*.md`.

## 3. Capturing one item

```bash
node scripts/capture.mjs emoji-picker              # component
node scripts/capture.mjs ai-chat --kind=block      # block
```

The script opens the frame in headless Chrome at 1280×900, records every response body, then picks the
CSS and JS hits that actually contain the item's class prefix. A block's prefix is not its slug
(`ai-chat` renders `chat_*`), so the prefix is derived from the DOM's own module class names and
written to `captures/<slug>/meta.json`.

Three selection rules keep that trustworthy — the first version of the script got all three wrong and
produced 12 silently empty captures:

1. **Prefix vote, shared modules excluded.** `animated-counter`, `button`, `badge`, `segmented-control`,
   `text-morph`, `slider`, `site-header/footer` … appear on nearly every frame and can outnumber the
   item's own classes 700-to-190. The slug's own prefix wins when the DOM renders it; otherwise the
   most frequent *non-shared* prefix.
2. **CSS = smallest body that still carries ≥5 of the item's selectors.** A route-wide bundle also
   contains them and is 5–10× larger; picking the largest used to store `welcome_*` page CSS as an
   item's module.
3. **JS = body with the most distinct item classes**, not the biggest file.

Audit any time with `node scripts/audit-captures.mjs` (status `ok` = the item's own prefix appears in
both `chunk.js` and `styles.css`); `node scripts/queue.mjs` lists every remaining Pro item with its
capture sizes.

Never trust the chunk id→hash map in the webpack runtime: every `/_next/static/chunks/{id}-{hash}.js`
derived from it returns the Next 404 page. Only URLs observed in the HTML or on the wire resolve.

## 4. Turning a chunk into source

1. `npx prettier@3 --parser babel captures/<slug>/chunk.js > /tmp/<slug>.js`.
2. `perl -pi -e 's/\.([a-z0-9-]+)_([A-Za-z0-9-]+)__[A-Za-z0-9_]+/.$2/g' captures/<slug>/styles.css`,
   then camelCase the remaining kebab class names; keyframes get the same treatment.
3. Write `src/components/arc/<slug>/{<slug>.tsx, <slug>.module.css, demo.tsx}`, importing
   `styles from "./<slug>.module.css"`. The demo is picked up automatically by `src/previews.ts`.
4. Port behaviour, not just markup: state machine, timers, keyboard, focus, `useReducedMotion`,
   ARIA. Types stay strict — no `any`, no `@ts-ignore`.

See `PORTING.md` for the full checklist and the dependency list

## 5. Two gates, both mandatory

```bash
PYTHON=/Users/melonte/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
  node scripts/compare.mjs <slug> [--kind=block]     # pixels: requires score ≥ 98
node scripts/dom-diff.mjs <slug> [--kind=block]      # tree/box/text/ARIA
```

`compare.mjs` screenshots the live frame and `http://localhost:5183/frame/<slug>` at the same
viewport, waits for `document.fonts.ready`, and diffs them with `scripts/pixel_diff.py`
(`captures/<slug>/diff.png` = grey base, red where a pixel differs).

Two modes matter:

- `STABLE=1` — sample until two consecutive frames are byte-identical. Removes the load-time head
  start the server-rendered frame has over the local page (measured 0.8–2.7 s per item), which is the
  usual reason a faithful port scores 94–97 in the fixed-delay mode.
- Fixed delay (default, `WAIT=<ms>`, 1200 ms) — for looping demos that never settle; `STABLE` burns its
  budget and shoots an arbitrary phase instead.

So each item is honest in exactly one mode: settle-able demos need `STABLE=1`, loops need the fixed
delay, and a port that matches in neither is really wrong. `scripts/report.mjs` therefore measures both
and reports the better number with the mode that produced it.

`dom-diff` compares path/tag/box(±1px)/text/role/aria-label. Same pixels with a different tree is not
a port. Time-driven items legitimately differ in text every load — run those with `--struct`.

`dom-diff` samples at 1200 ms and now accepts `WAIT=<ms>`. For an item that auto-starts or streams, the
1200 ms pass compares two different phases and invents hundreds of mismatches: `task-breakdown` read
350 vs 341 nodes / 327 mismatches at 1200 ms and 350 vs 350 / 0 at `WAIT=6000`. A demo that never rests
at all (`onboarding-survey` loops question 1 → 3 → done → restart) cannot be gated by wall-clock at all;
drive both pages into the same state in a probe and compare there — that produced 0 mismatches across
five states while the free-running gates disagreed by a phase.

`scripts/report.mjs` runs both gates over every ported item and writes `REPORT.md`.

## 6. Shell compensations you will keep meeting

The reference site's global stylesheet is not part of any item's shipped CSS. Two of its rules are
now mirrored once in `src/index.css` because every port needs them:

| reference rule | why it matters |
| --- | --- |
| `h1…h6 { font-weight: 500; line-height: 1.1 !important }` | without it every title is 4–6 px shorter (`h2` 22.4 px vs 17.6 px) |
| `h1, h2, h3 { letter-spacing: var(--tracking-display) }` (−0.03 em) | display headings 0.5–3 px narrower |
| `button, input, textarea, select { letter-spacing: inherit }` | Chrome's UA resets tracking to `normal` on controls, so buttons drifted ~1 px per 8 chars |

Everything else stays scoped to the module that needs it:

| symptom | cause on the reference | compensation in the module |
| --- | --- | --- |
| sr-only table 2 px per cell taller | preflight `table { border-collapse: collapse }`, `th/td { padding: 0 }` | `.srOnly table/th/td` resets |
| demo card keeps its border below 900 px | the frame page goes full-bleed under 900 px | `@media (max-width: 900px)` in `demo.module.css` |
| block card stays bordered in the live frame | the frame writes `border:0;border-radius:0;box-shadow:none;background:transparent` inline on some nodes | optional `flat` prop writing `data-frame-flat` + the same four declarations (measured threshold per item, e.g. `eval-suite` 958 px) |
| `box-sizing` collapse on an inner node | `src/frame/frame.module.css` `.root * { box-sizing: border-box }` outranks a single-class rule | `.region.region`-style specificity bump |
| Radix sheet unstyled inside a block | portals mount on `<body>`, outside the module's `.root` scope | a commented reset block re-applying the sheet rules |
| form control 2 px taller than live | preflight zeroes control padding, `src/index.css` does not | `.search input { padding: 0 }` scoped to the block |

Fonts are self-hosted (`@fontsource-variable/inter`, `@fontsource-variable/geist`) because the
reference ships next/font subsets; `@import` lines must stay above the first rule in
`src/index.css` or Vite drops them silently.

## 7. Known irreducible residues

- Canvas/particle demos seeded with `Math.random` (particle positions, realtime feeds) — phase only.
  Where the opening frame matters, the port seeds an LCG so the first N points are deterministic.
- Free-running animation on the reference that never settles: `customer-galaxy` (undamped 1.6°/s
  drift) and `revenue-globe` (continuous globe rotation) score ~96–98 against the live frame — but a
  remote-vs-remote comparison of the *same* reference scores 95.9–96.6, and under
  `prefers-reduced-motion` both ports score 99.9–100.0. The reference fails its own gate.
- `market-terminal`'s feed is an unseeded random walk that has already advanced on the remote page
  before any screenshot: pixel 99.7–99.8, and with the 1200 ms tick frozen both sides render a
  byte-identical series (sparkline `path d` matches character for character).
- `useId` prefixes (`_R_…` server vs `_r_0_` client) — structural ids match.
- Glyph rasterisation of ⌘-style symbols where the reference's subset falls back to a system font
  (`⌘↵` 24.48 px vs 23.52 px in `prompt-studio`).
- Autoplay phase for time-driven blocks: the remote loop hydrates ~1 s before `networkidle`, the
  local one mounts there; timings are kept faithful rather than bent to match a screenshot.
- lucide-version drift: the shipped bundle renders `DollarSign` as `<line>+<path>` where
  `lucide-react@1.69` emits `<path d="M12 2v20">`. Geometry identical, DOM differs — noted per port.
- Avatars: the reference routes images through `/_next/image?w=32` (rasterised); our shared `Avatar`
  serves the SVG directly, so 20 px circle edges differ by AA only (~236 px per avatar, 0.01 %).

## 8. Flattening: closed per item, not in the shell

The reference frame page flattens a block's own card when the preview is narrow (and for some blocks
at every width): it writes `border:0; border-radius:0; box-shadow:none; background:transparent`
inline on specific nodes — the demo root, a footer, a panel, sometimes only one of them. Thresholds
are item-specific (`ai-feature-launch` flat at ≤ 664 px, `eval-suite` at ≤ 958 px, `account-health` at
≤ 737 px, `usage-forecast` unconditionally).

`src/frame/FramePage.tsx` deliberately does not guess: each port exposes an optional `flat` prop that
writes `data-frame-flat` plus the same four declarations on exactly the nodes the capture shows, and
its demo passes it. Flattening the wrong node is measurable — `delivery-tracker` lost 0.8 points
because two 1 px `border-top` separators survived, and `connected-scatter` lost 3 px of height when
the root was flattened but the live frame only flattens `.stats` and `.scrub`.

## 9. Corpus state

233 Pro items (17 components + 113 blocks + 103 special components) are reconstructed under
`src/components/arc/<slug>/`, each
with the component, its de-hashed CSS Module and a demo that auto-registers through
`src/previews.ts`. `scripts/prune-free.mjs --apply` removed the 89 free-registry directories whose
code no Pro item imports (the user-facing catalogue only lists Pro items anyway); what survives is
the import closure of the Pro roots — 166 directories, including the shared primitives
(`lib`, `button`, `popover`, `select`, `tabs`, `tooltip`, `checkbox`, `switch`, …).

`REPORT.md` is regenerated by `scripts/report.mjs`; for the full corpus run it in shards and merge:

```bash
node scripts/report.mjs --only=<slugs> --out=captures/shards/shard0.md   # one process per shard
node scripts/report-merge.mjs
```

## 10. The docs shell: sidebar

The sidebar is site chrome, not a library item, so its CSS came from the shell stylesheets rather than
a capture: `library-sidebar_*` lives in `/_next/static/css/c78978ac3e2c160d.css` and `pro-badge_*` in
`/_next/static/css/9eedb49febe2cbe3.css`. Both were fetched, de-hashed (`.library-sidebar_x__hash` →
`.camelName`) and kept verbatim in `src/site/sidebar.module.css`.

Geometry, measured on the live page at 1280×900 and reproduced to the pixel:

| node | live | clone |
| --- | --- | --- |
| column / panel | x 26 · w 242 → content 227 | identical (aside pads 26 left, 14 right, 1 border) |
| top block (search + tiers) | y 85 · h 78 · gap 8 · pad-bottom 10 | identical |
| search | h 32 · r 10 · bg `--surface-muted` | identical |
| tiers | y 125 · h 28 · pad 2 · gap 2 · r 10 | identical |
| scroll | y 163 · h 674 | 673 (1px border) |
| section head | h 32 · pad 0 6 0 8 · r 8 | identical |
| group head | h 28 · pad 0 8 0 8 · gap 7 · r 8 | identical |
| row | x 48 · w 205 · h 30 · 13px | identical |
| Pro badge | 33.75 × 18 · r 9999 · 11px/11px 500 | identical |

Motion, sampled from the live DOM frame by frame rather than guessed:

- **Collapse** is a height + opacity animation on the section/group body with `overflow: clip`. Inside a
  group of 339px the body reads 339 → 303 → 252 → 174 → 130 → 83 → 51 → 30 → 18 → 10 → 5.9 → … → 0 over
  ~520ms with no overshoot, i.e. a spring with `visualDuration ≈ 0.34, bounce 0` — reproduced exactly.
- **Chevrons** rotate to `-90deg` on the same spring (the reference writes `transform: rotate(-90deg)`
  inline); group chevrons additionally go from `opacity .6` to `1` and `--text-muted` to foreground.
- **The tier indicator** is one element that travels between the three radio buttons
  (`translate3d(-75.5381px, 0, 0) scale(0.999769, 1)` at the Pro position). Ours is a `layoutId` pill, so
  the same translate/scale is produced by measurement instead of a hard-coded offset.
- **The active row** is a `.pill` inset in the row with a 1px `--accent` tick at the guide line, moved by
  `layoutId`; rows themselves cross-fade background/color over `0.14s var(--ease-standard)`.
- Sticky heads (`section head` at `top: 0`, `group head` at `top: 32px`), the bottom fade mask driven by
  `data-fade-top` / `data-fade-bottom`, the truncated-label tooltip (`.tip` positioned with
  `--tip-x/--tip-y`), ⌘K focus and Escape-to-clear are all reproduced.

One intentional difference: the clone lists **only Pro items** (17 components + 113 blocks) because free
items were pruned at the user's request, so the clone's sidebar is much shorter than the live one — the
live page counts 134 components / 113 blocks. Everything above the first group, and every head/badge/row
in it, matches.
