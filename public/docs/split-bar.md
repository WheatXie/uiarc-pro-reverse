# Split bar

> A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/split-bar
- Markdown: https://uiarc.dev/components/split-bar/markdown
- Source file: `registry/components/split-bar/split-bar.tsx`
- Dependencies: motion
- Keywords: data, chart, motion, new, split bar, stacked bar, 100% bar, part to whole, share, proportion, percent, traffic sources, budget, storage bar, legend toggle, leader lines, segment, breakdown

## When to use

- A compact part to whole view that fits in a card row or a dashboard header.
- Comparing shares where people also want exact figures on demand and the option to leave a category out.
- Showing how a mix changes between periods or filters with one continuous reflow.

## When not to use

- Use bar-chart to compare absolute values across many categories.
- Use donut-chart when the total in the middle is the headline, or waffle-chart for a count of units.
- Use a stacked chart over time when the trend of each share matters more than today's split.

## Installation

Split bar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/split-bar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SplitBar, type SplitSegment } from "@/components/arc/split-bar/split-bar";

const budget: SplitSegment[] = [
  { id: "payroll", label: "Payroll", value: 412_000 },
  { id: "cloud", label: "Cloud", value: 96_500 },
  { id: "marketing", label: "Marketing", value: 74_200 },
  { id: "tools", label: "Software", value: 18_900 },
  { id: "other", label: "Other", value: 9_300 },
];

export function BudgetSplit() {
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <SplitBar
      title="Q4 budget"
      segments={budget}
      format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
      hidden={hidden}
      onHiddenChange={setHidden}
    />
  );
}
```

## API reference

### SplitBar

One 100% bar split into shares, for traffic sources, budgets, storage or votes. Rest on a segment and it widens a little (small ones widen enough to show their own label) while the others give way proportionally and dim, and the readout above names it precisely: share, value and unit. Labels sit inside a segment when they fit, as name and percent or percent alone, and otherwise move to a lane under the bar with soft leader lines, pushed apart so they never overlap. The legend switches segments off and on: a hidden segment collapses in place and the rest reflow to fill the bar on springs, their percentages rolling to the new shares. New data does the same, so switching a period is one continuous reflow.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `segments` | `readonly SplitSegment[]` | – | The shares in display order: { id, label, value, color? }. Shares are each value over the total of the visible segments; zero and negative values are left out. Segments are matched by id when the data changes. |
| `segments[].color` | `string` | – | Any CSS color. Defaults to --series-1 to --series-4, then two neutrals meant for catch-all shares such as Referral or Other. |
| `title` | `string` | – | Heading above the bar and the accessible name unless label is set. |
| `description` | `string` | – | One line under the title. |
| `format` | `Intl.NumberFormatOptions` | – | Number format for values in the readout, such as currency for a budget. Shares always read as percentages with one decimal. |
| `unit` | `string` | – | Word after values in the readout, such as sessions. |
| `totalLabel` | `string` | `"Total"` | Label of the readout when nothing is highlighted. |
| `hidden` | `readonly string[]` | – | Ids of segments that are switched off (controlled). |
| `defaultHidden` | `readonly string[]` | `[]` | Ids switched off at first (uncontrolled). |
| `onHiddenChange` | `(hidden: string[]) => void` | – | Called with the new list when the legend or the keyboard switches a segment. |
| `legend` | `boolean` | `true` | Show the legend. Each item toggles its segment and highlights it on hover. |
| `locale` | `string` | `"en-US"` | Formatting locale. Fixed by default so server and client render the same digits. |
| `label` | `string` | – | Accessible name. Defaults to the title. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the bar, then each legend item. |
| Arrow Right / Arrow Down | On the bar: highlights the next visible segment, widening it and reading it out. |
| Arrow Left / Arrow Up | On the bar: highlights the previous visible segment. |
| Home / End | On the bar: highlights the first or last visible segment. |
| Enter / Space | On the bar: switches the highlighted segment off. On a legend item: switches its segment off or back on. |
| Escape | Clears the highlight. |

## Accessibility

- The bar is a focusable group with the role description split bar, named with every visible share (Organic search 41.6%, Direct 24.8% and so on) and how to read each one.
- Moving through segments with the arrow keys announces the segment's name, share and value in a polite live region; switching a segment off or on is announced too.
- Legend items are toggle buttons with aria-pressed, named with the segment and its share or hidden. An off segment is also shown without color: a hollow swatch, struck through name and the word Off.
- The last visible segment cannot be switched off; the legend item gives a small shake and the reason is announced.
- Inside labels, outside labels, leader lines and rolling digits are hidden from assistive technology; the group name and readout carry the same numbers as text.
- Segments use the shared chart palette, validated for color vision deficiency in both themes, and every segment is named in the legend, so color is never the only key.

## Motion

- Each segment is a full width layer cut to its share with an animated clip-path, and its edges ride the smooth spring. Reflow never touches layout, and a new target mid flight retargets from where the edges are.
- Hovering or arrowing onto a segment widens it by about 4.5% of the bar, or enough to fit its name and share when it is small, while the others give way proportionally and dim, so the bar always stays at 100%.
- Labels live inside the clipped layer, so they slide with their segment and are cut cleanly at its edge instead of spilling into a neighbour. When a segment grows or shrinks, its name opens or closes on a spring beside the percentage.
- Outside labels glide to their new places and fade in and out; their leader lines are S curves that morph with them. The label lane opens and closes smoothly when the first label moves outside or the last one comes back.
- Percentages, values and the total roll digit by digit like an odometer, in the direction they changed.
- The readout above the bar crossfades between the total and the highlighted segment with a short rise and a little blur.
- With reduced motion segments and labels move at once, digits change in place, readouts swap without travel and the refusal shake is skipped.

## Responsive behavior

- The bar spans its container. Its width is measured with a ResizeObserver and label fitting is recalculated, so the same data shows more labels inside on a wide card and moves more of them outside on a phone.
- The readout wraps under the title on narrow screens; the legend wraps to as many rows as it needs.
- On touch, a tap on a segment highlights it and a tap elsewhere clears it; vertical page scrolling is never captured.

## Performance

- Label fitting uses canvas text metrics cached per font, so it never reads layout while animating.
- Segment edges, caps and labels are driven by motion values; React renders only when the data, the hidden set or the highlighted segment changes.
- Segments animate clip-path and transform only.

## Notes for AI

- Use it for a part to whole split of two to eight categories where people compare shares at a glance: traffic sources, budget lines, storage by file type, survey answers, device mix.
- Order segments by size or by a meaningful sequence, and put catch-all shares such as Other last so they take the neutral colors.
- Set unit or format so the readout gives the exact figure, not only the percentage.
- Keep labels short. Long names only show inside wide segments; everything else moves to the outside lane.
- Pass new segments with the same ids to animate between periods or filters; the bar reflows instead of redrawing.

## Related

- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Waffle chart](https://uiarc.dev/components/waffle-chart/markdown): A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.
- [Treemap](https://uiarc.dev/components/treemap/markdown): A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.

## Also in charts

- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Streamgraph](https://uiarc.dev/components/streamgraph/markdown): Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.
- [Brush chart](https://uiarc.dev/components/brush-chart/markdown): A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.
- [Slope chart](https://uiarc.dev/components/slope-chart/markdown): Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Gauge](https://uiarc.dev/components/gauge/markdown): Show a value against a known range.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Ridgeline](https://uiarc.dev/components/ridgeline/markdown): Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.

## Guidance for AI tools

Split bar: A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
