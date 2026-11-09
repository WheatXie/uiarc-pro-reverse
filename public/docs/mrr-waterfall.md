# MRR waterfall

> An MRR bridge whose floating bars morph by period and open the accounts behind each move.

- Type: Block
- Page: https://uiarc.dev/components/blocks/mrr-waterfall
- Markdown: https://uiarc.dev/components/blocks/mrr-waterfall/markdown

- Access: Arc Pro
- Registry id: `mrr-waterfall`
- Source file: `registry/blocks/mrr-waterfall/mrr-waterfall.tsx`
- Built from: Segmented control, Animated counter
- Keywords: react waterfall chart, mrr bridge, revenue waterfall, mrr movements chart, saas revenue bridge, floating bar chart

Use this on a revenue or board reporting page to explain how MRR moved. Replace the seeded months and accounts in mrr-data.ts with your billing movements; levels, axis, ratios and lists are computed from them.

## When to use

- Revenue or board reporting that explains how MRR moved from start to end of a period.
- Finance views where each movement should list the accounts behind it.

## When not to use

- Use revenue-explorer for MRR over many months.
- Use bar-chart for plain comparisons that do not build from a start value.
- Use cohort-retention for retention by cohort.

## Installation

MRR waterfall is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/mrr-waterfall
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MrrWaterfall } from "@/components/arc/blocks/mrr-waterfall/mrr-waterfall";

export default function RevenuePage() {
  return (
    <section>
      <MrrWaterfall />
    </section>
  );
}
```

## API reference

### MrrWaterfall

An MRR bridge with floating bars per movement, a period switch and a panel listing the accounts behind the selected bar. Takes no props; periods, movements and accounts are sample data in mrr-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Moves the selection to the previous or next bar, wrapping at the ends. |
| Home / End | Selects the first or last bar. |

## Accessibility

- Bars are a role="radiogroup" of radio buttons with roving tabindex; each label reads the movement, amount and account count.
- The chart SVG carries a text summary, and the accounts panel is labelled by the selected movement.
- A polite live region announces each newly selected bar.

## Motion

- Bars morph to new levels when the period changes, and the account list reorders with layout animation.
- Headings and figures swap with a short rise, and totals roll with the animated counter.
- Reduced motion swaps values without movement.

## Responsive behavior

- Below an 800px container the accounts panel moves under the chart.
- Below 560px the summary stats become a three column row with smaller figures.
- Hover previews apply only to mouse pointers; touch taps select a bar.

## Performance

- A handful of SVG bars per period, sized by ResizeObserver; cheap at any size.
- Account lists are not virtualized, so cap or paginate large movements.

## Notes for AI

- Use on a revenue or board reporting page to explain how MRR moved between periods.
- Replace PERIODS in mrr-data.ts with your billing movements; levels, axis and lists are computed from them.

## Related

- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Cohort retention](https://uiarc.dev/components/blocks/cohort-retention/markdown): A cohort retention triangle that morphs into retention curves and rewashes by segment.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
