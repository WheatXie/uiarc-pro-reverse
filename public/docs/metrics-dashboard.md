# Metrics dashboard

> A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.

- Type: Block
- Page: https://uiarc.dev/components/blocks/metrics-dashboard
- Markdown: https://uiarc.dev/components/blocks/metrics-dashboard/markdown

- Access: Arc Pro
- Registry id: `metrics-dashboard`
- Source file: `registry/blocks/metrics-dashboard/metrics-dashboard.tsx`
- Built from: Button, Charts, Motion
- Keywords: react metrics dashboard, analytics dashboard, kpi dashboard, dashboard with chart, saas analytics ui, traffic dashboard

Use this to make a small set of key measures explorable. Replace the sample figures with your analytics source.

## When to use

- A small, explorable KPI overview with a range toggle and one chart.
- Product or marketing dashboards with four headline metrics, a 7, 30, or 90 day range, and top pages and sources.

## When not to use

- Use metric-explorer or revenue-explorer for larger or drill-down data.
- Use stat-card for a single number.
- Use sparkline for inline trends in a table.

## Installation

Metrics dashboard is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/metrics-dashboard
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MetricsDashboard } from "@/components/arc/blocks/metrics-dashboard/metrics-dashboard";

export function Overview() {
  return <MetricsDashboard />;
}
```

## API reference

### MetricsDashboard

A dense analytics view: a range control, four KPI tabs that pick the charted metric, one line chart with an optional previous-period comparison and a hover or keyboard tooltip, and top pages and sources lists. Takes no props; all figures are sample data.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the range control, Export, the KPI tabs, Compare, and the chart. |
| ArrowLeft / ArrowRight | With the chart focused, moves the inspected point. |
| Home / End | Jumps to the first or last point. |

## Accessibility

- Range buttons use aria-pressed; the KPI tiles are tabs with aria-selected.
- The chart is role="img" with a label; the inspected value is announced through a status tooltip.
- Deltas carry a text direction, not only color.

## Motion

- KPI values and list counts count to their new amounts with tabular numerals.
- The range thumb and KPI underline slide on a spring; the chart crossfades between metrics and ranges.
- Reduced motion swaps values and views immediately.

## Responsive behavior

- Layout follows the block's own width through a ResizeObserver: below 640px the KPI tabs form a two by two grid and the top pages and sources lists stack.
- Below 460px padding tightens, the range control and actions fill the width, KPI values shrink, and the chart is 168px tall.
- Chart hover is mouse based; touch and keyboard select points through focus and the arrow keys.

## Performance

- The chart is a hand-built SVG with a monotone cubic path: up to 30 daily points, or 13 weekly points for 90 days. No charting library.
- All aggregation runs over an in-memory daily series on each change; for larger data or drill-down use metric-explorer.

## Notes for AI

- Use for a compact product or marketing analytics overview.
- Replace the generated daily series with your analytics source; Export only shows a local confirmation.
- The layout follows the block's own width (measured), so it works in narrow panels as well as full pages.
- For larger sets, prefer metric-explorer or revenue-explorer.

## Related

- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
