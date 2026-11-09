# Metric explorer

> KPI cards that open into a scrubbable chart and morph between metrics and ranges.

- Type: Block
- Page: https://uiarc.dev/components/blocks/metric-explorer
- Markdown: https://uiarc.dev/components/blocks/metric-explorer/markdown

- Access: Arc Pro
- Registry id: `metric-explorer`
- Source file: `registry/blocks/metric-explorer/metric-explorer.tsx`
- Built from: Segmented control, Animated counter
- Keywords: react kpi cards, metric explorer, analytics dashboard chart, expandable stat card, kpi to chart, saas metrics

Use this at the top of a SaaS analytics or finance page. Replace the seeded series in metric-data.ts with daily values from your warehouse or metrics API; the range and comparison math stay the same.

## When to use

- The top of a SaaS analytics or finance page with KPI cards that open into a chart.
- Dashboards where people move between a few metrics and date ranges.

## When not to use

- Use stat-card or metric-card for static KPI tiles.
- Use revenue-explorer for a revenue breakdown with a range brush.
- Use metrics-dashboard for a full dashboard layout.

## Installation

Metric explorer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/metric-explorer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MetricExplorer } from "@/components/arc/blocks/metric-explorer/metric-explorer";

export default function AnalyticsPage() {
  return (
    <main>
      <MetricExplorer />
    </main>
  );
}
```

## API reference

### MetricExplorer

A row of KPI cards that morph open into a scrubbable chart with metric tabs and a range switch. Takes no props; series and ranges are sample data in metric-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | On the metric tabs, switches metric; on the chart, steps back or forward one interval. |
| Home / End | Jumps to the first or last metric tab, or the first or last point in range. |
| Escape | Clears the scrubbed point, then closes the chart back to its card. |

## Accessibility

- Each card is a button whose label reads the value, change and range.
- The open chart uses a tablist and tabpanel, and the scrubber is a role="slider" with a dated aria-valuetext.
- The close button advertises Escape with aria-keyshortcuts, and a polite live region announces changes.

## Motion

- A card's surface morphs into the chart panel with a shared layout transition and back on close.
- The line morphs between metrics and ranges, and the tab highlight slides with the selection.
- Reduced motion replaces the morph and slides with instant changes.

## Responsive behavior

- Four cards per row drop to two below a 760px container.
- Below 640px tab values hide and the readout stacks; below 440px card padding and values shrink.
- The chart uses touch-action pan-y, so touch scrubbing does not block page scroll.

## Performance

- Opening a card morphs one shared surface with a layoutId, and ResizeObservers fit the chart and tab indicator.
- SVG charts over daily series; aggregate long histories before passing them in.

## Notes for AI

- Use at the top of a SaaS analytics or finance page.
- Replace the seeded series in metric-data.ts with daily values from your warehouse; range and comparison math stay the same.

## Related

- [Metric card](https://uiarc.dev/components/metric-card/markdown): A compact summary for a number that needs context.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
