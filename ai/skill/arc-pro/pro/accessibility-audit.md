# Accessibility audit

A ranked list of real defects with patches — not a checklist recital. Audits fail when they report
"add alt text" while a dialog traps focus.

## 1. Structure

Walk the DOM and answer these; each "no" is a finding.

- Exactly one `h1`; heading levels never skip (`h2` → `h4`).
- Landmarks: `header`, `nav`, `main`, `aside`, `footer` — one `main` per page.
- Lists are `ul`/`ol` when they are lists; a stack of `div`s with borders is a list.
- Buttons are `button`, links are `a[href]`. A clickable `div` is a finding even with `role="button"`.
- Tables use `th[scope]`, `caption` or `aria-label`; a layout table is not a table.
- Images: informative ones get a description, decorative ones get `alt=""` (not a missing alt).
- Page `title` and `lang` are set; the title changes per route.

## 2. Keyboard

Tab through the page with the mouse untouched. Every step is observable.

- **Order** follows reading order; nothing focusable sits after a visual break that skips it.
- **Visible focus** on every focusable element. Arc draws it with `--focus-ring`; a custom
  `outline: none` without a replacement is a finding.
- **No traps** outside modal surfaces. `aria-modal` surfaces trap on purpose and release on Escape.
- **Composites** follow their model: menus move with arrows and close on Escape; tabs use
  arrows and expose `aria-selected`; grids use arrows, Home/End, PageUp/PageDown and keep
  `aria-activedescendant` current; radio groups move as one stop, not one stop per option.
- **Skip link** exists before the navigation and becomes visible on focus.
- **Focus return** — closing a dialog, sheet or popover puts focus back on the trigger.

## 3. Semantics and announcements

- Icon-only controls have an accessible name (`aria-label` describing the action, not the glyph).
- Toggles expose state: `aria-pressed`, `aria-checked`, `aria-expanded` — whichever the item already
  ships; do not invent a fourth.
- Live regions: results counts, save status, validation summaries, streaming text. Polite by default,
  assertive only for an error that blocks progress.
- Form fields: label associated with `for`/`id`, hint text via `aria-describedby`, error via
  `aria-invalid` + the same `aria-describedby`, and never a placeholder as the only label.
- Loading: `aria-busy` on the region, a text status for screen readers, skeleton marked
  `aria-hidden="true"`.

## 4. Contrast and colour

Measure, do not eyeball. Body ≥ 4.5:1, large text ≥ 3:1, UI/graphic boundaries ≥ 3:1, focus ring ≥ 3:1
against both the element and the surface behind it. Then check the non-text cases:

- Does any state rely on colour alone (error red, success green, chart series)? Add a label, icon or
  pattern.
- Do disabled controls fall below 3:1 while still carrying information? Use opacity on a surface rather
  than dimming text below legibility.
- Does forced-colors / high-contrast mode keep borders (`@media (forced-colors: active)` uses system
  colours; backgrounds disappear, so borders must exist).

## 5. Motion and media

- `prefers-reduced-motion` honoured everywhere (see [motion-recommendations.md](motion-recommendations.md)).
- Nothing flashes more than 3 times per second.
- Autoplaying media is muted, pausable and under 5 seconds unless it is essential.
- Video with speech has captions; audio-only has a transcript.

## 6. Rank, then patch

Order by impact on task completion, not by ease:

| Rank | Finding | Impact | Patch |
| --- | --- | --- | --- |
| 1 | Dialog never returns focus | keyboard users lose their place | store the trigger, restore on close |
| 2 | Table rows are `div`s with click handlers | no row semantics, no keyboard | `sortable-data-table` or `role="row"` + `tabIndex` |
| 3 | Muted helper text 3.1:1 | unreadable for low vision | `--text-secondary`, re-measure |

Every finding needs three things: selector or route, measured value, and the patch. "Improve labels"
is not a finding.

## 7. Verify

- Re-run the keyboard walk after patches; the focus order should be identical to the documented one.
- Re-measure the contrast pairs you changed.
- Run axe (devtools or `@axe-core/cli`) as a net, then dismiss its false positives explicitly —
  axe passes are not proof of usability.
- One screen-reader pass over the main flow (VoiceOver: `Cmd+F5`), reading order and announcements only.

## 8. Report

```
Surface: /dashboard/settings · standard: WCAG 2.1 AA
Findings: 11 (3 high, 5 medium, 3 low) · patched in this pass: 8
High: focus return on the edit sheet, row semantics in the members table, contrast of --text-muted on --surface-muted (3.1 → 4.6)
Verified: keyboard 24 stops unchanged, axe 0 violations, VoiceOver pass on save flow
Left open: <list with reason>
```

## Failure modes

- **Checklist dumped into the PR.** Findings without impact ranking get ignored.
- **`aria-label` on everything.** A label that repeats visible text is noise; labels replace missing
  text, they do not decorate.
- **Fixing colour by darkening text only in light mode.** Both themes, and both surfaces.
- **Assuming a library item is accessible.** Arc items ship keyboard models, but data, labels and
  composition decide whether the page is usable; audit the composition too.
