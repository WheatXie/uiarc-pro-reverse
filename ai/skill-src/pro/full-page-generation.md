# Full-page generation

Turn a brief into a whole page: regions, every state, real copy, then verification. The order matters
— planning the regions before writing JSX is what keeps a generated page from becoming six unrelated
cards.

## 1. Brief

Write these five lines before touching code. Missing information is filled with a stated assumption,
not a question that stalls the work.

```
Page:      <what it is> for <who>
Job:       the one thing a person does here
Regions:   header, <body regions in reading order>, footer?
Data:      what is real, what is sample, where it comes from
States:    empty, loading, error, long content, dark, 390px
```

If the brief names a product ("a Stripe-like billing page"), keep the structure and drop the branding.
Sample names must look like data, not lorem ipsum.

## 2. Plan region by region

For each region, choose an item and say why in one line. Use the MCP: `search_components` with the
region's job, then `get_component` on the top two, and quote the "when not to use" line that decided it.

| Region | Item | Why this one |
| --- | --- | --- |
| Page chrome | `sidebar` or `site-header` | navigation with a current-section state |
| KPI row | `metrics-dashboard` | KPI tabs plus one inspectable chart |
| Records | `data-grid` (edit) / `sortable-data-table` (read) | the table has to sort and filter |
| Activity | `activity-feed` | append-only events with actors |

Rules for the plan:

- A block covers a region. Do not stack two blocks that each own a page container.
- One primary action per surface. If two regions both need a primary button, one of them is secondary.
- Every data region names its four states in the plan, even if the first build only ships two.
- Prefer the specialised item when it exists: `funnel-chart` over a bar chart for a funnel,
  `confirm-morph` over a dialog for a row delete, `agent-run` over a log list for an agent trace.

Stop here and show the plan when the brief is thin or the user asked for a plan. A wrong plan is cheap;
a wrong 900-line page is not.

## 3. Build in this order

1. **Shell** — page container, navigation, page header (`h1`, lede, one action).
2. **Skeleton of regions** — each region mounted with real item and sample data, no polishing.
3. **Data shape** — types first, then the item. If a callback is typed `void | Promise<…>`, return the
   promise so the item can show pending, success and error itself.
4. **States** — empty (`empty-state`), loading (`skeleton` matched to the final layout), error (inline
   `alert` with a retry), success (in place, not a toast).
5. **Copy** — sentence case, verbs on buttons, no eyebrows, no em dashes.
6. **Motion** — only where a change would otherwise be a jump: panel open, row insert, value change.
7. **Responsive** — 390 first (it is the width that breaks), then 768, 1024, 1440.

## 4. Verification

Run all four, in this order, and paste the numbers into the summary:

- **Widths** — 390, 768, 1024, 1440. No horizontal scroll; `document.documentElement.scrollWidth ===
  document.documentElement.clientWidth`. Wide tables scroll inside their card.
- **States** — force each one (empty data, `?loading`, a rejected promise) and confirm it renders
  inside the region, not as a blank page.
- **Keyboard** — Tab through the page once: focus order follows reading order, focus is visible,
  Escape closes the topmost overlay, no trap outside a dialog.
- **Dark** — switch theme; no element keeps a light-only background, no text drops below contrast.

## 5. Report

```
Page: <name> · regions: 5 · items: 7 (4 block, 3 component)
Widths: 390/768/1024/1440 ok, no overflow
States: empty/loading/error wired for records + activity
Open: <what you would do next, one line>
```

## Failure modes

- **Six equal cards.** No hierarchy: pick one KPI as the primary (larger number or accent), the rest
  secondary.
- **A block inside a card inside a section.** Nested surfaces read as noise; use one container.
- **States bolted on last.** Loading skeletons that do not match the final layout cause layout shift;
  derive the skeleton from the item's own rows.
- **Placeholder copy shipped.** "Lorem", "Company A", "user@example.com" and "99.9%" all get replaced
  before the page is called done.
