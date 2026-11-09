# Budget variance

> Budget against actual operating spend by department as aligned bullet charts, with favorable and unfavorable variance, a month, quarter and year to date switch that springs every bar, in-place drill-down into budget lines, and a total row.

- Type: Block
- Page: https://uiarc.dev/components/blocks/budget-variance
- Markdown: https://uiarc.dev/components/blocks/budget-variance/markdown

- Access: Arc Pro
- Registry id: `budget-variance`
- Source file: `registry/blocks/budget-variance/budget-variance.tsx`
- Built from: Segmented control, Avatar
- Keywords: budget, budget vs actual, variance, bullet chart, finance, fp&a, operating expenses, opex, cost center, department spend, favorable, unfavorable, plan vs actual, month close

Render <BudgetVariance /> for the demo, or pass departments (lines with budget and actual keyed by period id), periods, defaultPeriod, defaultExpanded and ranges. Department figures and the total are summed from the lines, and onPeriodChange and onDepartmentToggle report changes.

## When to use

- Monthly close and budget review screens that compare planned and actual operating spend by department or cost center.
- Finance dashboards where a controller needs to see at a glance which teams are over, which are under, and by how much.
- Any plan against actual comparison with a meaningful tolerance band, such as headcount cost or cloud spend by team.

## When not to use

- Use mrr-waterfall to explain how a single total moved from one value to another.
- Use usage-forecast to project spend against a cap over time.
- Use a line or bar chart to show a trend across many periods; this block compares one window at a time.
- Use a sortable data table when there are dozens of cost centers and sorting matters more than the visual comparison.

## Installation

Budget variance is part of Arc Pro. The live preview is public; the source and install command need Pro.

### CLI with a Pro token

1. Create a token in your account and set it in the environment (or `.env.local`). Never commit it.

```bash
export ARC_PRO_TOKEN=arc_pro_...
```

2. Add the Pro registry to `components.json`:

```json
{
  "registries": {
    "@uiarc": "https://uiarc.dev/r/{name}.json",
    "@uiarc-pro": {
      "url": "https://uiarc.dev/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${ARC_PRO_TOKEN}"
      }
    }
  }
}
```

3. Install:

```bash
npx shadcn@latest add @uiarc-pro/budget-variance
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { BudgetVariance } from "@/components/arc/blocks/budget-variance/budget-variance";

export function FinanceOverview({ departments }) {
  return (
    <BudgetVariance
      departments={departments}
      defaultPeriod="quarter"
      ranges={[0.9, 1.05]}
      onDepartmentToggle={(id, open) => open && prefetchLines(id)}
    />
  );
}
```

## API reference

### BudgetVariance

Budget against actual spend by department as bullet charts on one shared scale, so every budget tick lines up down the table. Each row shows qualitative bands, the actual bar with the overspend drawn in the danger color past the tick, and variance as a signed amount and share colored by whether it is favorable. A month, quarter and year to date switch springs every bar and counts every number to the new window, a total row sums the table, and any department opens in place to show its budget lines.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `departments` | `BudgetDepartment[]` | `budgetDepartments` | Departments with an id, a name, an owner ({ name, avatar? }) and budget lines. Each line has an id, a name, and budget and actual amounts keyed by period id. Department figures and the total are summed from the lines. |
| `periods` | `BudgetPeriod[]` | `budgetPeriods` | Reporting windows for the switch, each with an id, a short label, a description shown under the title and a phrase for screen reader sentences ("in the third quarter"). |
| `defaultPeriod` | `string` | – | Id of the window shown first. Defaults to the first period. |
| `defaultExpanded` | `string \| null` | `"engineering"` | Id of the department open on first render. Pass null to start with every department closed. |
| `ranges` | `[number, number]` | `[0.9, 1.1]` | Qualitative band edges as shares of budget. Spend between them is within tolerance; the bands step darker past the upper edge. |
| `onPlanThreshold` | `number` | `0.005` | Variance smaller than this share of budget reads as on plan and stays neutral. |
| `currency` | `string` | `"$"` | Symbol placed before every amount. Amounts shorten to k and M. |
| `title` | `string` | `"Budget vs actual"` | Heading of the block. |
| `description` | `string` | – | Replaces the period description under the title. |
| `onPeriodChange` | `(periodId: string) => void` | – | Called when the reporting window changes. |
| `onDepartmentToggle` | `(departmentId: string, open: boolean) => void` | – | Called when a department opens or closes. Opening one closes the one that was open, which is reported first. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the period switch, then into the department list, then out of the block. |
| Arrow left / Arrow right | On the period switch, changes the reporting window. |
| Arrow up / Arrow down | In the department list, moves to the previous or next department. |
| Home / End | In the department list, jumps to the first or last department. |
| Enter / Space | Opens or closes the budget lines of the department in focus. |

## Accessibility

- Each department is a heading with a disclosure button (aria-expanded, aria-controls) whose name is a full sentence: spent, budget, variance and whether it is favorable.
- The total and every budget line carry the same sentence in visually hidden text; the charts and the counting numbers are hidden from assistive technology so nothing is read twice or mid-count.
- Changing the window announces the new window and the total through a polite live region.
- Variance never relies on color: amounts carry a sign and every share ends in over, under or on plan.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The focused department shows a filled row.

## Motion

- Switching the window springs every bar to its new length on one critically damped spring and counts every amount and share to the new value, all written to the DOM from motion values.
- The overspend is the same bar clipped to the space past budget, so the danger color appears exactly as the bar crosses the tick, with no second animation to keep in sync.
- Opening a department grows its lines in height and opacity together without overshoot; closing is faster. The chevron turns on the shared spring curve.
- Every animation is interruptible: a new window or toggle starts from wherever the bars and numbers are.
- Reduced motion jumps bars and numbers to their final values and opens lines at full height.

## Responsive behavior

- From a 760px container the block is a table: name and owner, the bullet chart, actual, budget, variance and the disclosure chevron in aligned columns.
- Below that each row puts the name, its actual of budget and the variance on top and the bullet chart across the full width below, so the chart never gets squeezed.
- Long names wrap instead of truncating. The period switch fills the width on phones.
- Rows are at least 60px tall and the switch grows to 44px on touch screens.

## Performance

- Bars animate transform only (scaleX from the left edge); bands and ticks are static percentage positions, so a window change never measures layout.
- Numbers count on motion values that write text content directly, so a window change renders React once, not once per frame.
- Department and total figures are memoized per window; the shared scale is computed once per data set.

## Notes for AI

- Choose it for cost centers where spending under budget is favorable. Every department and line is read as an expense.
- Pass one amount per period id for both budget and actual on every line; departments and the total are summed, so they always reconcile.
- The scale is shared by every row and every period (at least 120 percent of budget, rounded up to fit the largest line), so the budget tick never moves when the window changes.
- Bands mix the text color and the overspend uses the danger token, so the block stays neutral in any accent. The accent marks only the open department's chevron and the selected window.
- The first render formats every number from props, so server and client match.

## Related

- [MRR waterfall](https://uiarc.dev/components/blocks/mrr-waterfall/markdown): An MRR bridge whose floating bars morph by period and open the accounts behind each move.
- [Usage forecast](https://uiarc.dev/components/blocks/usage-forecast/markdown): A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Metrics dashboard](https://uiarc.dev/components/blocks/metrics-dashboard/markdown): A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
