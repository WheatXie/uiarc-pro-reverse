---
name: arc-pro
description: Builds and reviews React interfaces with the full Arc library — all 233 Pro components and blocks plus the 147 free items, reconstructed in this repository with source, docs and live previews. Use when the user mentions Arc or uiarc, when the project contains src/components/arc or components/arc/foundation.css, or when asked to build or polish UI such as a settings page, pricing section, dashboard, landing page, sign-in, form, table, chart, dialog, command palette, AI chat, agent run or data grid.
---

# Arc Pro (complete library)

Arc is a React component and block library: CSS Modules, semantic CSS variables, Motion, Geist and
Inter. This repository holds **380 items** — the 233 Pro components, blocks and special components
reconstructed from the artifacts the site ships to its preview frames, plus the 147 free registry
items. Docs, live previews and source are all local, so nothing here needs an account or a token.

The quality bar is a calm, neutral interface where type, spacing and one considered interaction carry
the character. Motion explains a change; it never decorates one.

## Workflow

```
Arc task:
- [ ] 1. Find: search_components with the job, then get_component on the top two and compare "when not to use"
- [ ] 2. Read: API reference, keyboard, accessibility and responsive notes for the pick
- [ ] 3. Acquire: free → npx shadcn add @uiarc/<id>; Pro → copy src/components/arc/<id>/ (already local)
- [ ] 4. Wire: documented props only, real data, callbacks return promises
- [ ] 5. Compose: one page container, spacing rhythm, every state (composition.md)
- [ ] 6. Style and copy: tokens, sentence case, no eyebrows (design.md, copy.md)
- [ ] 7. Review: checklist.md, fix, run it again until every line passes
```

**Find.** With the local MCP server (`node ai/mcp/server.mjs`): `search_components` with the user's
intent, then `get_component` on the top two or three and compare `whenToUse` with `whenNotToUse`. The
"not" entry names the better alternative — follow it. Without MCP, read
[components.md](components.md), which lists all 380 ids by group, or `public/docs/<id>.md`.

**Read.** `get_component {id}` returns the docs the site serves for that item: when to use, when not
to, install, usage, API reference (every prop, type and default), keyboard interactions,
accessibility, motion, responsive behaviour and performance notes. Read the API reference before
writing JSX; guessing prop names is the most common failure with this library.

**Acquire.** Free items are the original registry items:

```bash
npx shadcn@latest add @uiarc/button @uiarc/input @uiarc/switch
```

Pro items are already in this repository: `src/components/arc/<id>/` with `<id>.tsx`,
`<id>.module.css` and a `demo.tsx`. Import from `@/components/arc/<id>/<id>`. In another project, copy
the folder plus any shared item it imports (`button`, `input`, `select`, `popover`,
`segmented-control`, `text-morph`, `tooltip`, `lib/`) and import `foundation.css` once.

**Wire.** Selection components take `value` and `onValueChange`; pickers and editors take `value` and
`onChange`. When a callback is typed `void | Promise<…>`, return the promise: the item shows its own
pending, success and error states.

## Core principles

1. **Use Arc before writing UI.** Compose components; do not restyle their internals.
2. **One purpose per surface.** One `h1`, one primary action, one memorable detail.
3. **Neutral surfaces, meaningful color.** Semantic tokens only. The accent marks active, selected,
   progress and emphasized data. Status colours mean status.
4. **Hierarchy from size, spacing and contrast.** Weights 400 and 500 only.
5. **Motion explains a change.** Shared tokens, transform and opacity, one continuous movement,
   reduced motion respected.
6. **Every state designed.** Empty, loading, success, error, disabled, long content, 390px, dark mode.

## Never do

- Eyebrow labels, overlines or kicker text above headings; all caps or uppercase transforms.
- Em dashes in copy. Use a period, comma, colon or parentheses.
- Hand-made focus rings, outlines or halos, or any ring on pointer focus.
- Raw hex, Tailwind colour classes or arbitrary font sizes on Arc surfaces.
- Decorative gradients, glows, coloured shadows, or icons inside rounded tiles.
- Nested cards, double page gutters, or a second page container inside a block.
- A toast as the only confirmation of a foreground action.
- Browser-only values (`window`, `Date.now()`, `Math.random()`, `localStorage`) in the first render.

## Quick decisions

| The user wants | Use | Not |
| --- | --- | --- |
| 2 to 5 views of the same data | `segmented-control` | `tabs` (tabs swap whole panels) |
| Peer panels of one object | `tabs` | Separate routes per panel |
| On or off that applies now | `switch` | `checkbox` (checkbox is for submitted forms) |
| One of a few visible options | `radio-group`, or `radio-cards` with descriptions | `select` for fewer than 5 |
| Long option list | `select`, `combobox` to search | `radio-group` |
| A decision that must interrupt | `dialog` | `drawer` |
| A long form beside the page | `drawer` | `dialog` |
| A task on phones | `bottom-sheet` | `dialog` for mobile-first tasks |
| Destructive action | `confirm-morph`, `hold-to-confirm` when irreversible | A modal for every delete |
| Records to compare | `data-grid` or a table block | Hand-built tables |
| KPI row | `metrics-dashboard`, `metric-card` | Hand-built cards |
| Result of a save | The button or row confirms in place | `toast` (background work only) |
| AI chat surface | `ai-chat`, `ai-composer`, `ai-answer` | A plain textarea |
| Agent run / approvals | `agent-run`, `agent-approvals`, `agent-timeline` | Custom log lists |

The full catalogue by group, with the reason to use and not to use each item, is in
[components.md](components.md).

## Reference files

Read only the file the task needs. Each is one level from here.

| File | Read it when |
| --- | --- |
| [components.md](components.md) | Choosing an item: all 380 ids by group, with use and not-for |
| [composition.md](composition.md) | Laying out a page: containers, dashboards, marketing sections, states, React correctness |
| [design.md](design.md) | Tokens for colour, type, surfaces, radii, spacing, icons, metallic and brand treatments |
| [copy.md](copy.md) | Writing any visible text: headings, buttons, errors, empty states, claims |
| [motion.md](motion.md) | Adding or reviewing animation |
| [accessibility.md](accessibility.md) | Semantics, keyboard, names, announcements |
| [responsive.md](responsive.md) | Widths, touch targets, overflow, tables on phones |
| [checklist.md](checklist.md) | Before you finish. Always |
| [example-settings.md](example-settings.md) | Worked example: account settings page |
| [example-pricing.md](example-pricing.md) | Worked example: pricing section with plans, comparison and FAQ |
| [example-dashboard.md](example-dashboard.md) | Worked example: analytics overview with KPIs, chart and table |
