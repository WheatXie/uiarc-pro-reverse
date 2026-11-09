# Revenue explorer

> A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.

- Type: Block
- Page: https://uiarc.dev/components/blocks/revenue-explorer
- Markdown: https://uiarc.dev/components/blocks/revenue-explorer/markdown

- Access: Arc Pro
- Registry id: `revenue-explorer`
- Source file: `registry/blocks/revenue-explorer/revenue-explorer.tsx`
- Built from: Animated counter
- Keywords: react revenue chart, mrr chart, chart with brush zoom, range selector chart, saas analytics chart, comparison line chart, interactive area chart

Use this for MRR or other monthly flow metrics on an analytics page. Replace the seeded months in revenue-data.ts with your billing data; the chart, brush and comparison compute everything from that series.

## When to use

- Monthly MRR or revenue broken into new, expansion, and churn on an analytics page.
- Charts where people need to zoom a date range with an overview brush and compare against a prior period.

## When not to use

- Use mrr-waterfall to explain how MRR moved between two points in time.
- Use metric-explorer for a row of KPI cards that open into a chart.
- Use bar-chart or sparkline for a small chart inside a card.

## Installation

Revenue explorer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/revenue-explorer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RevenueExplorer } from "@/components/arc/blocks/revenue-explorer/revenue-explorer";

export default function AnalyticsPage() {
  return (
    <section>
      <RevenueExplorer />
    </section>
  );
}
```

## API reference

### RevenueExplorer

A monthly revenue chart with series toggles, a comparison mode, a hover scrubber and an overview brush that zooms the range. All figures derive from the seeded months in revenue-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | On the plot, step the scrubbed month. On the brush or its handles, move the window or one edge by a month. |
| Shift + Arrow keys | Move the brush or a handle by three months. |
| Home / End | Jump to the range start or end (plot), or to the timeline edges (brush). |
| Escape | Clears the scrubbed month on the plot. |

## Accessibility

- The brush window and both handles are role="slider" with aria-valuenow and month-name aria-valuetext.
- Series toggles use aria-pressed and the comparison toggle is a role="switch" with aria-checked.
- The plot is a focusable role="img" with aria-describedby pointing at the live summary.

## Motion

- Paths, axes and ticks glide to the new range on springs while totals roll with Animated counter.
- Reduced motion jumps values instantly and replaces movement with opacity changes.

## Responsive behavior

- Chart width follows its container through a ResizeObserver, so axes and paths recompute at any width.
- Below a 560px container padding tightens and the comparison context wraps under the KPIs.
- The plot uses touch-action pan-y so vertical page scroll still works, while the brush uses touch-action none and pointer capture for dragging.

## Performance

- Geometry is computed from 24 months of data; paths and ticks animate on springs rather than a per-frame loop.
- It is SVG with no downsampling, so long daily series should be aggregated to months before passing them in.

## Notes for AI

- Use for MRR or other monthly flow metrics (new, expansion, churn) on an analytics page.
- Replace DATA and the month calendar in revenue-data.ts with your billing series; geometry, summaries and y domains are computed from it.
- No props or callbacks; lift the data into props if you load it at runtime.

## Related

- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [MRR waterfall](https://uiarc.dev/components/blocks/mrr-waterfall/markdown): An MRR bridge whose floating bars morph by period and open the accounts behind each move.
- [Usage forecast](https://uiarc.dev/components/blocks/usage-forecast/markdown): A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.
- [Cohort retention](https://uiarc.dev/components/blocks/cohort-retention/markdown): A cohort retention triangle that morphs into retention curves and rewashes by segment.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
