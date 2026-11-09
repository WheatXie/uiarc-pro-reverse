# Cohort retention

> A cohort retention triangle that morphs into retention curves and rewashes by segment.

- Type: Block
- Page: https://uiarc.dev/components/blocks/cohort-retention
- Markdown: https://uiarc.dev/components/blocks/cohort-retention/markdown

- Access: Arc Pro
- Registry id: `cohort-retention`
- Source file: `registry/blocks/cohort-retention/cohort-retention.tsx`
- Built from: Segmented control, Animated counter
- Keywords: react cohort retention chart, retention triangle, cohort analysis table, retention curves, churn cohort heatmap, saas retention chart

Use this on a growth or customer success dashboard to compare how signup cohorts retain. Replace simulate() in cohort-data.ts with your cohort sizes and retained counts per month; rates, averages, headline figures and deltas are derived from them.

## When to use

- Growth or customer success dashboards comparing how signup cohorts retain month over month.
- Views that need both the cohort triangle and retention curves from the same data.

## When not to use

- Use journey-flow for paths between funnel steps.
- Use activity-heatmap for activity by day rather than by cohort.
- Use revenue-explorer for revenue over time.

## Installation

Cohort retention is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/cohort-retention
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CohortRetention } from "@/components/arc/blocks/cohort-retention/cohort-retention";

export default function GrowthPage() {
  return (
    <section>
      <CohortRetention />
    </section>
  );
}
```

## API reference

### CohortRetention

A cohort retention triangle that morphs into retention curves, with segment filters and a keyboard-navigable cell cursor. Cohort sizes and retained counts come from simulate() in cohort-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move the cell cursor between cohorts (rows) and months (columns). |
| Home / End | Jump to the first or last month of the current cohort. |
| Escape | Clears the cursor. |

## Accessibility

- The chart is a focusable role="group" with aria-describedby, and a polite live region reads the focused cohort, month and rate.
- Decorative cells and curves are aria-hidden; the legend is a labelled role="img".

## Motion

- Cells morph into curves on the view switch and rewash their colour when the segment changes; headline figures roll with Animated counter.
- Reduced motion jumps values instantly and follows the pointer without springs.

## Responsive behavior

- Chart geometry follows container width through a ResizeObserver.
- Below a 560px container padding tightens and the KPI context wraps.
- The chart uses touch-action pan-y, so touch scrubbing does not block vertical page scroll.

## Performance

- The triangle is 12 cohorts by 12 months of SVG cells; much larger grids mean many more animated cells.
- Cell colour changes use CSS transitions with a stagger instead of JavaScript per cell.

## Notes for AI

- Use on a growth or customer success dashboard to compare how signup cohorts retain.
- Replace simulate() in cohort-data.ts with your cohort sizes and monthly retained counts; rates, averages and deltas are derived.
- Edit SEGMENTS in cohort-data.ts to match your segments. No props or callbacks.
- Composes Arc Segmented control and Animated counter.

## Related

- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Journey flow](https://uiarc.dev/components/blocks/journey-flow/markdown): A Sankey of user journeys whose flows morph by channel and trace a cohort on hover.
- [Metrics dashboard](https://uiarc.dev/components/blocks/metrics-dashboard/markdown): A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
