# KPI drilldown

> KPI cards that expand into a full detail chart with period comparison and a breakdown table, then fold back.

- Type: Block
- Page: https://uiarc.dev/components/blocks/kpi-drilldown
- Markdown: https://uiarc.dev/components/blocks/kpi-drilldown/markdown

- Access: Arc Pro
- Registry id: `kpi-drilldown`
- Source file: `registry/blocks/kpi-drilldown/kpi-drilldown.tsx`
- Built from: Animated counter, Button
- Keywords: kpi, dashboard, drilldown, metric card, shared layout, expand card, period comparison, breakdown table, sparkline, analytics

Use this as the overview of an analytics or finance dashboard. Load each metric's series and breakdowns from your warehouse and keep the range in your URL.

## When to use

- An analytics or finance overview where each number deserves a closer look.
- Executive dashboards that compare the current period with the previous one.

## When not to use

- Use metric-explorer to compare many metrics on one chart.
- Use metrics-dashboard for a static summary without drill down.
- Avoid it for real time monitoring where values change every second.

## Installation

KPI drilldown is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/kpi-drilldown
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { KpiDrilldown } from "@/components/arc/blocks/kpi-drilldown/kpi-drilldown";

export function Overview({ metrics }: { metrics: Kpi[] }) {
  const [metric, setMetric] = useQueryState("metric");
  return <KpiDrilldown kpis={metrics} selected={metric} onSelectedChange={setMetric} />;
}
```

## API reference

### KpiDrilldown

A KPI overview where each card expands into a full detail view on one spring: the label and value stay put while the chart, period comparison, and breakdown table are revealed around them. Ranges morph every sparkline in place.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `kpis` | `Kpi[]` | `kpis` | Metrics: id, label, format, kind (total or rate), lowerIsBetter, daily series, breakdowns by dimension, and a description. |
| `dimensions` | `{ value: string; label: string }[]` | `breakdownDimensions` | Breakdown dimensions; values match keys in each metric's breakdowns. |
| `end` | `string` | `"2026-09-24"` | ISO date of the last value in every series. |
| `defaultRange` | `"7" \| "30" \| "90"` | `"30"` | Initial range in days. |
| `selected` | `string \| null` | – | Controlled open metric id, or null for the grid. |
| `onSelectedChange` | `(id: string \| null) => void` | – | Called when a metric opens or closes. Use it to keep the selection in the URL. |
| `title` | `string` | `"Overview"` | Heading. |
| `className` | `string` | – | Class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space on a card | Opens the metric; focus moves to the close button. |
| Escape | Folds the detail back into its card and returns focus to it. |
| Arrow left / Arrow right | Moves the chart cursor one day while the chart has focus. |

## Accessibility

- Cards are buttons whose name includes the value and the change.
- The detail is a labeled region; the grid behind it is hidden from assistive technology while it is open.
- The chart has a spoken summary and a keyboard cursor; changes pair an arrow and sign with color.
- Breakdowns are real tables with row headers.

## Motion

- The card grows into the detail on one spring, and the detail folds back into the same card.
- Every range is resampled to the same number of points, so sparklines and the detail line morph instead of redrawing.
- Values roll digit by digit when the range changes.
- The previous period line fades in and out with Compare; breakdown rows crossfade and their share bars fill with a small stagger.
- Reduced motion jumps between grid and detail and keeps short fades.

## Responsive behavior

- Three columns above 760px, two down to 520px, then one.
- Below 520px the share column hides and Compare becomes an icon button.
- The detail scrolls inside its panel when it is taller than the grid.

## Performance

- Sparklines use a fixed 100 by 32 viewBox with non scaling strokes, so resizing never re measures them.
- The detail chart measures its width once per resize and animates only path data.

## Notes for AI

- Give each metric at least twice the longest range of daily values so the comparison period exists.
- Use kind rate for percentages so changes read in points, and set lowerIsBetter for churn or latency.
- Keep selected in the URL with onSelectedChange so a detail can be shared.
- Six metrics fit best; more belong in metric-explorer.

## Related

- [Metrics dashboard](https://uiarc.dev/components/blocks/metrics-dashboard/markdown): A dense analytics view with KPI tabs, one inspectable chart, and top pages and sources.
- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [MRR waterfall](https://uiarc.dev/components/blocks/mrr-waterfall/markdown): An MRR bridge whose floating bars morph by period and open the accounts behind each move.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
