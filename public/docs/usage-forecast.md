# Usage forecast

> A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.

- Type: Block
- Page: https://uiarc.dev/components/blocks/usage-forecast
- Markdown: https://uiarc.dev/components/blocks/usage-forecast/markdown

- Access: Arc Pro
- Registry id: `usage-forecast`
- Source file: `registry/blocks/usage-forecast/usage-forecast.tsx`
- Built from: Segmented control, Animated counter, Text morph
- Keywords: react usage chart, usage forecast, budget alert chart, billing usage graph, metered billing dashboard, spend forecast

Use this on a billing or usage page to warn before a customer hits a budget. Replace the readings in usage-data.ts with your metering data and connect the budget and alert rules to your billing settings; alert emails in the preview are simulated.

## When to use

- Billing or usage pages that warn customers before they hit a budget.
- Metered products that show month to date usage with a forecast range.

## When not to use

- Use usage-meter for a simple progress bar against a limit.
- Use usage-pricing to estimate price from usage before buying.
- Use metric-explorer for general KPIs without a budget.

## Installation

Usage forecast is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/usage-forecast
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { UsageForecast } from "@/components/arc/blocks/usage-forecast/usage-forecast";

export default function BillingUsagePage() {
  return (
    <section>
      <UsageForecast />
    </section>
  );
}
```

## API reference

### UsageForecast

A billing period usage chart with a forecast cone, a draggable budget line and alert rules. Takes no props; readings and metrics are sample data in usage-data.ts, and alert emails are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | On the plot, steps one day; on the budget handle, moves the budget one step. |
| Page up / Page down | Jumps a week on the plot, or five steps on the budget handle. |
| Home / End | Jumps to the first or last day, or to the minimum or maximum budget. |
| Escape | Clears the inspected day on the plot. |

## Accessibility

- The plot and the budget handle are role="slider" elements with aria-valuetext in plain words.
- The chart SVG has a full sentence label and is described by a data table; a polite live region reads the forecast summary.
- Alert rules are toggle buttons with aria-pressed and labels that include their current status.

## Motion

- The budget line follows drags directly and settles on a snappy spring when released or moved by keyboard.
- The crossing marker and inspection panel follow the scrubbed day on springs; numbers roll with the animated counter.
- Reduced motion drops the springs and applies changes immediately.

## Responsive behavior

- Chart width follows its container through a ResizeObserver, and below 560px KPIs and the legend tighten.
- The plot uses touch-action pan-y for scrubbing, while the budget handle uses touch-action none so it can be dragged on touch.

## Performance

- SVG over daily readings for one billing period; the forecast cone is computed once per change, not per frame.
- Dragging the budget updates one line and label; there is no loop at rest.

## Notes for AI

- Use on a billing or usage page to warn customers before they hit a budget.
- Replace METRICS and daily readings in usage-data.ts with your metering data.
- Persist budget and alert rule changes to your billing settings; they are local state in the preview.

## Related

- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Usage pricing](https://uiarc.dev/components/blocks/usage-pricing/markdown): A pricing calculator that finds your plan as you drag seats and traffic.
- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
