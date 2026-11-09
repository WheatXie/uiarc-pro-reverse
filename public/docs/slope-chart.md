# Slope chart

> Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.

- Type: Component (data)
- Access: Free, open source
- Page: https://uiarc.dev/components/slope-chart
- Markdown: https://uiarc.dev/components/slope-chart/markdown
- Registry item: https://uiarc.dev/r/slope-chart.json
- Source file: `registry/components/slope-chart/slope-chart.tsx`
- Dependencies: motion
- Keywords: data, chart, new, slope chart, slopegraph, before after chart, react slope chart, rank change chart, two period comparison, bump chart, animated slope chart

## When to use

- Showing which items rose, which fell, and how the order changed between two periods.
- Replacing a grouped bar chart when the change is the story.

## When not to use

- Use line-chart for three or more moments.
- Use bar-chart when only the latest values matter.
- Avoid more than about ten items; labels start to crowd.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/slope-chart
pnpm dlx shadcn@latest add @uiarc/slope-chart
yarn dlx shadcn@latest add @uiarc/slope-chart
bunx --bun shadcn@latest add @uiarc/slope-chart
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/slope-chart.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion
```

2. Copy the source into your project. Main file: `registry/components/slope-chart/slope-chart.tsx`

   The source is in the registry item: https://uiarc.dev/r/slope-chart.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { SlopeChart } from "@/components/arc/slope-chart/slope-chart";

const channels = [
  { key: "email", label: "Email", start: 3.1, end: 4.6 },
  { key: "search", label: "Organic search", start: 3.4, end: 3.6 },
  { key: "social", label: "Paid social", start: 1.9, end: 1.3 },
];

export function Channels() {
  return <SlopeChart data={channels} label="Conversion by channel" startLabel="Q1" endLabel="Q2" highlightKey="email" formatValue={value => `${value.toFixed(1)}%`} />;
}
```

## API reference

### SlopeChart

Before and after for several items on two shared axes. Lines draw in on first view, labels spread apart to avoid overlaps with a hairline back to their point, rank moves sit beside each end value, and switching datasets slides every line to its new slope.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `SlopeItem[]` | – | Items: { key, label, start, end }. Keys keep lines stable across datasets. |
| `label` (required) | `string` | – | What is measured. Names the chart, the summary, and the table. |
| `startLabel` (required) | `string` | – | First column heading, such as "Q1". |
| `endLabel` (required) | `string` | – | Second column heading, such as "Q2". |
| `formatValue` | `(value: number) => string` | – | Formats values beside the points, in the tooltip, and in the table. |
| `formatChange` | `(change: number, item: SlopeItem) => string` | – | Formats the change in the tooltip, such as "+1.5 pts". |
| `height` | `number` | `44px per item` | Plot height in pixels. |
| `highlightKey` | `string \| null` | `null` | The item drawn in the first series hue, derived from the accent. |
| `activeKey` | `string \| null` | – | Controlled item in focus. The others fade. |
| `onActiveChange` | `(key: string \| null) => void` | – | Called as the item in focus changes. |
| `ranks` | `boolean` | `true` | Rank movement beside each end value. |
| `emptyLabel` | `string` | `"No data"` | Message when there are no items. |
| `ref` | `Ref<HTMLElement>` | – | Forwarded to the figure. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the chart and reads the top item by end value. |
| ArrowDown / ArrowRight | Next item in end order. |
| ArrowUp / ArrowLeft | Previous item. |
| Home / End | First or last item. |
| Escape | Clears the reading. |

## Accessibility

- The chart is a focusable group with a roledescription and instructions; lines and labels are aria-hidden.
- A polite live region reads both values, the change, and the rank move for the item in focus.
- A visually hidden summary and a table list every item in end order.
- Rank moves use an arrow glyph and a number, never colour alone.

## Motion

- On first view each line draws from start to end with a small stagger, and the end dots and labels arrive as it lands.
- Switching datasets moves lines, dots, labels, and leader hairlines on the shared morph spring; rank numbers roll in the direction they moved.
- The item in focus comes forward while the others fade; the tooltip glides to the middle of its line.
- Reduced motion shows every line drawn and moves it immediately.

## Responsive behavior

- Label columns narrow below 440px and names truncate with an ellipsis; the full name stays in the tooltip and table.
- Overlapping labels spread apart with a hairline to their point instead of colliding.
- Touch reads the nearest line with a press and drag.

## Performance

- SVG lines and HTML labels animated with springs; around ten items render in a few dozen nodes.
- One ResizeObserver measures the container.

## Notes for AI

- Choose it for exactly two moments and three to ten items: before and after a launch, quarter over quarter, last year against this year.
- Use highlightKey for the item the story is about.
- Give the columns short headings; names sit on the left only, values on both sides.
- For more than two moments use line-chart.

## Related

- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Streamgraph](https://uiarc.dev/components/streamgraph/markdown): Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.
- [Sortable data table](https://uiarc.dev/components/sortable-data-table/markdown): Compare structured records with sortable columns.

## Also in charts

- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Brush chart](https://uiarc.dev/components/brush-chart/markdown): A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.
- [Waffle chart](https://uiarc.dev/components/waffle-chart/markdown): A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Gauge](https://uiarc.dev/components/gauge/markdown): Show a value against a known range.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Ridgeline](https://uiarc.dev/components/ridgeline/markdown): Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.
- [Treemap](https://uiarc.dev/components/treemap/markdown): A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.
- [Split bar](https://uiarc.dev/components/split-bar/markdown): A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

## Guidance for AI tools

Slope chart: Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
