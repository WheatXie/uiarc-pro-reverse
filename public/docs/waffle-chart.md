# Waffle chart

> A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.

- Type: Component (data)
- Access: Free, open source
- Page: https://uiarc.dev/components/waffle-chart
- Markdown: https://uiarc.dev/components/waffle-chart/markdown
- Registry item: https://uiarc.dev/r/waffle-chart.json
- Source file: `registry/components/waffle-chart/waffle-chart.tsx`
- Dependencies: motion
- Keywords: data, chart, new, waffle chart, unit chart, square pie chart, percentage grid, part to whole chart, react waffle chart, animated waffle, isotype chart

## When to use

- Showing shares of one whole where people should be able to count units.
- Comparing the same categories across a few datasets, such as countries or years.
- Replacing a pie or donut when small shares need to stay visible.

## When not to use

- Use line-chart or streamgraph for how shares change over time.
- Use bar-chart when exact comparison of many categories matters more than the whole.
- Use sunburst for nested parts of a whole.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/waffle-chart
pnpm dlx shadcn@latest add @uiarc/waffle-chart
yarn dlx shadcn@latest add @uiarc/waffle-chart
bunx --bun shadcn@latest add @uiarc/waffle-chart
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/waffle-chart.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion
```

2. Copy the source into your project. Main file: `registry/components/waffle-chart/waffle-chart.tsx`

   The source is in the registry item: https://uiarc.dev/r/waffle-chart.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { WaffleChart } from "@/components/arc/waffle-chart/waffle-chart";

const mix = [
  { key: "wind-solar", label: "Wind and solar", value: 218 },
  { key: "hydro", label: "Hydro", value: 20 },
  { key: "gas", label: "Gas", value: 76 },
  { key: "coal", label: "Coal", value: 132 },
  { key: "other", label: "Other", value: 61 },
];

export function PowerMix() {
  return <WaffleChart data={mix} label="Electricity generation, 2023" unit="TWh" />;
}
```

## API reference

### WaffleChart

A unit chart where every cell is one share of the whole. When the data changes, cells keep following their category and fly to their new block with a staggered spring, and the shares in the legend roll to their new values.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `WaffleCategory[]` | – | Categories in fill order: { key, label, value, color? }. The first fills from the bottom-left corner, column by column. Shares come from the total. |
| `label` (required) | `string` | – | What the whole is, such as "Electricity generation, 2023". Names the chart, the summary, and the table. |
| `unit` | `string` | `""` | Unit after raw values in the tooltip and table, such as "TWh". |
| `formatValue` | `(value: number, category: WaffleCategory) => string` | – | Formats raw values. Shares are always percentages. |
| `rows` | `number` | `10` | Grid rows. rows × columns cells make the whole. |
| `columns` | `number` | `10` | Grid columns. 10 × 10 means one cell per percent. |
| `accentKey` | `string \| null` | `first key` | The category painted in the first series hue, derived from the accent. The next three take the supporting series and later ones fall back to neutral steps. |
| `activeKey` | `string \| null` | – | Controlled focused category. Other cells dim while one is focused. |
| `defaultActiveKey` | `string \| null` | `null` | Initial focused category when uncontrolled. |
| `onActiveChange` | `(key: string \| null) => void` | – | Called when a legend item is pinned or released. |
| `legend` | `boolean` | `true` | Category list with rolling shares. It sits beside the grid from 420px and below it on narrower containers. |
| `decimals` | `number` | `0` | Decimal places for shares. |
| `emptyLabel` | `string` | `"No data"` | Message when the data is empty or sums to zero. |
| `ref` | `Ref<HTMLElement>` | – | Forwarded to the figure. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the grid, then each legend item. |
| Arrow keys | Move the reading cell by cell across the grid. |
| PageUp / PageDown | Jump to the first cell of the previous or next category. |
| Home / End | Go to the first or last filled cell. |
| Escape | Clears the reading. |
| Enter / Space on a legend item | Pins or releases that category. |

## Accessibility

- The grid is a focusable group with a roledescription and instructions; cells are decorative and aria-hidden.
- A polite live region reads the category, share, and value under the keyboard cursor.
- A visually hidden summary and a table list every category with its value, share, and cell count.
- Legend items are toggle buttons with aria-pressed; identity never relies on colour alone because every category is named in the legend.

## Motion

- Cells are persistent: a data change keeps as many cells in place as possible and flies the rest to their new block, staggered by position so the grid refills like a wave.
- A travelling cell dips in scale mid-flight and changes colour with the same delay, so it reads as lifting out of one group and landing in another.
- Shares in the legend roll to their new values on a critically damped spring.
- The first time the chart is seen, cells pop in from the bottom-left corner.
- Reduced motion places cells and shares immediately and drops the dip, pop, and stagger.

## Responsive behavior

- The grid is square and fills up to 300px; the legend moves beside it from 420px of container width.
- Legend labels truncate with an ellipsis; the full name stays in the tooltip, the live region, and the table.
- Touch reads cells with a press and drag; the page still scrolls vertically.

## Performance

- One element per cell, 100 by default, animated with transforms only.
- Hover is resolved from pointer position arithmetic, not per-cell listeners.
- Grid size is measured with one ResizeObserver.

## Notes for AI

- Choose it for part-to-whole with four to eight categories where countable units help, such as energy mix, survey answers, or budget split.
- Keep categories in a meaningful order; the fill order is the reading order.
- Use accentKey for the category the story is about and leave the rest neutral.
- Switching datasets with the same keys is where it shines: cells travel instead of repainting.

## Related

- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.

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
- [Treemap](https://uiarc.dev/components/treemap/markdown): A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.
- [Split bar](https://uiarc.dev/components/split-bar/markdown): A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

## Guidance for AI tools

Waffle chart: A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
