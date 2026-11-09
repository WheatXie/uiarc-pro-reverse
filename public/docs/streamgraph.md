# Streamgraph

> Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.

- Type: Component (data)
- Access: Free, open source
- Page: https://uiarc.dev/components/streamgraph
- Markdown: https://uiarc.dev/components/streamgraph/markdown
- Registry item: https://uiarc.dev/r/streamgraph.json
- Source file: `registry/components/streamgraph/streamgraph.tsx`
- Dependencies: motion
- Keywords: data, chart, new, streamgraph, stream graph react, stacked area chart, wiggle chart, theme river, stacked stream chart, layered area chart, animated streamgraph

## When to use

- Showing the changing share of topics, channels, or genres week by week.
- Storytelling dashboards where the shape of seasonality and spikes is the point.
- Comparing ranges where a morph between them explains what changed.

## When not to use

- Use line-chart when exact values or comparisons between series matter.
- Use bar-chart for a few periods or categories.
- Avoid it for data with negative values; streams stack magnitudes.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/streamgraph
pnpm dlx shadcn@latest add @uiarc/streamgraph
yarn dlx shadcn@latest add @uiarc/streamgraph
bunx --bun shadcn@latest add @uiarc/streamgraph
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/streamgraph.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion
```

2. Copy the source into your project. Main file: `registry/components/streamgraph/streamgraph.tsx`

   The source is in the registry item: https://uiarc.dev/r/streamgraph.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { Streamgraph } from "@/components/arc/streamgraph/streamgraph";

const series = [{ key: "bugs", label: "Bugs" }, { key: "billing", label: "Billing" }, { key: "onboarding", label: "Onboarding" }];
const data = weeks.map(week => ({ key: week.iso, label: `Week of ${week.name}`, axisLabel: week.monthStart ? week.month : undefined, values: week.tickets }));

export function TicketsByTopic() {
  return <Streamgraph data={data} series={series} label="Support tickets by topic" unit="tickets" categoryLabel="Week" />;
}
```

## API reference

### Streamgraph

Layers stacked on a wiggle baseline that flow over time. Switching ranges morphs every layer; hovering one isolates it and reads every layer at that point.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `{ key: string; label: string; axisLabel?: string; values: Record<string, number \| undefined> }[]` | – | Points in time. Datasets of any length morph into each other. |
| `series` (required) | `{ key: string; label: string; color?: string }[]` | – | Layers from the centre out: the first runs through the middle and the rest alternate above and below it. |
| `label` (required) | `string` | – | Names the chart for assistive technology. |
| `unit` | `string` | `""` | Unit after each value. |
| `height` | `number` | `260` | Plot height in pixels. |
| `offset` | `"wiggle" \| "silhouette" \| "zero"` | `"wiggle"` | Wiggle minimises layer slopes, silhouette centres the stack, zero stacks from a flat baseline. |
| `formatValue` | `(value: number, series) => string` | – | Formats values in the tooltip and table. |
| `hiddenSeries` | `string[]` | – | Controlled hidden layers. A hidden layer thins to nothing and the rest reflow. |
| `defaultHiddenSeries` | `string[]` | – | Initial hidden layers when uncontrolled. |
| `onHiddenSeriesChange` | `(hidden: string[]) => void` | – | Called when a legend toggle is pressed. |
| `onActiveChange` | `(index: number \| null, seriesKey: string \| null) => void` | – | Called as the reading moves between points and layers. |
| `legend` | `boolean` | `true` | Layer toggles above the plot. |
| `directLabels` | `boolean` | `true` | Names each layer at its thickest stretch when the text fits. |
| `categoryLabel` | `string` | `"Date"` | Header of the first column in the screen reader table. |
| `emptyLabel` | `string` | `"No data for this range"` | Shown when there are no points. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the plot and reads the latest point. |
| ArrowLeft / ArrowRight | Moves through time. |
| ArrowUp / ArrowDown | Moves the isolated layer up or down the stack. |
| PageUp / PageDown / Home / End | Jumps by a sixth of the range, or to the first or last point. |
| Escape | Clears the reading. |

## Accessibility

- The plot is a focusable group; each reading is announced with the point, the isolated layer's value, and the total.
- Legend toggles are buttons with aria-pressed; hovering or focusing one isolates its layer.
- A visually hidden table lists every point and layer value.
- Layers are separated by a 2px surface gap and named in place, so identity never rests on shade alone.

## Motion

- The stream swells out of a hairline along its centre the first time it is seen.
- New data blends every layer on a shared grid, so ranges of different lengths morph without redrawing.
- Hidden layers thin to nothing while the rest reflow; the crosshair and tooltip glide on springs.
- Reduced motion jumps to the final shapes and keeps the crosshair and tooltip without travel.

## Responsive behavior

- The plot fills its container; axis labels thin out to one per 72px, counted back from the latest.
- Direct labels hide where a layer is too thin or the plot too narrow; the tooltip and legend still name it.
- Touch drags scrub through time with pointer capture while vertical page scroll stays free.

## Performance

- Each layer is resampled once per data change onto 161 points; paint recomputes the baseline and writes paths directly.
- Hover state re-renders only the tooltip and a few attributes; morphs never re-render React per frame.

## Notes for AI

- Choose it for how a mix changes over time when the overall rhythm matters more than exact totals.
- Put the most important layer first; it runs through the middle of the stream.
- Use offset="zero" when people need to read totals against a baseline, like a stacked area chart.
- Keep layers to about eight; fold the rest into Other.

## Related

- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Brush chart](https://uiarc.dev/components/brush-chart/markdown): A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.

## Also in charts

- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Waffle chart](https://uiarc.dev/components/waffle-chart/markdown): A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.
- [Slope chart](https://uiarc.dev/components/slope-chart/markdown): Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Gauge](https://uiarc.dev/components/gauge/markdown): Show a value against a known range.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Ridgeline](https://uiarc.dev/components/ridgeline/markdown): Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.
- [Treemap](https://uiarc.dev/components/treemap/markdown): A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.
- [Split bar](https://uiarc.dev/components/split-bar/markdown): A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

## Guidance for AI tools

Streamgraph: Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
