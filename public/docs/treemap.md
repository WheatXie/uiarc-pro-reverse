# Treemap

> A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile.

- Type: Component (data)
- Access: Free, open source
- Page: https://uiarc.dev/components/treemap
- Markdown: https://uiarc.dev/components/treemap/markdown
- Registry item: https://uiarc.dev/r/treemap.json
- Source file: `registry/components/treemap/treemap.tsx`
- Dependencies: motion
- Keywords: data, chart, new, treemap, tree map, squarified, hierarchy, part to whole, drill down, zoomable treemap

## When to use

- Many parts where the biggest ones matter and people drill for detail.
- Showing size and a second measure at once.

## When not to use

- Use bar-chart when exact comparisons between similar values matter.
- Use sunburst when the depth of the hierarchy is the story.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/treemap
pnpm dlx shadcn@latest add @uiarc/treemap
yarn dlx shadcn@latest add @uiarc/treemap
bunx --bun shadcn@latest add @uiarc/treemap
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/treemap.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion
```

2. Copy the source into your project. Main file: `registry/components/treemap/treemap.tsx`

   The source is in the registry item: https://uiarc.dev/r/treemap.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { Treemap } from "@/components/arc/treemap/treemap";

const data = {
  id: "all", label: "All regions",
  children: [
    { id: "na", label: "North America", children: [{ id: "us", label: "United States", value: 18400, color: 24 }, { id: "ca", label: "Canada", value: 2350, color: 19 }] },
    { id: "eu", label: "Europe", children: [{ id: "de", label: "Germany", value: 4120, color: 28 }] },
  ],
};

export function Revenue() {
  return <Treemap data={data} label="ARR" colorLabel="Growth" formatColor={value => `+${value}%`} />;
}
```

## API reference

### Treemap

A squarified treemap of a hierarchy. Click a branch and its tile grows to fill the view while its children open inside; the breadcrumb zooms back out. Switching the size or shading measure morphs every tile.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `TreemapNode` | – | The root: { id, label, value?, color?, children? }. A branch's value is the sum of its children. |
| `label` (required) | `string` | – | What the whole is. Names the chart for assistive technology. |
| `formatValue` | `(value: number) => string` | – | Formats sizes on tiles, the total, and the tooltip. |
| `colorLabel` | `string` | – | Names the shading measure, such as "Growth". Tiles take the hue of their top level branch and deepen with the measure. Leave it out for one depth. |
| `formatColor` | `(value: number) => string` | – | Formats the shading measure. |
| `colorDomain` | `[number, number]` | – | Range of the shading measure. Defaults to the range of the leaves. |
| `focus` | `string` | – | Controlled id of the node that fills the view. |
| `defaultFocus` | `string` | – | Initial focus when uncontrolled. Defaults to the root. |
| `onFocusChange` | `(id: string) => void` | – | Called when people drill in or out. |
| `height` | `number` | `420` | Height of the tiles in pixels. |
| `emptyLabel` | `string` | `"No data yet"` | Shown when every value is zero. |
| `className` | `string` | – | Extra class on the root figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move to the nearest top level tile in that direction. |
| Home / End | Move to the first or last tile. |
| Enter / Space | Zooms into the tile in focus. |
| Escape / Backspace | Zooms out one level. |

## Accessibility

- The tiles form a focusable group with a description of its keys; the breadcrumb is a nav with aria-current on the current level.
- The tile in focus is announced with its path, value, share of parent, and shading measure through a polite live region.
- A visually hidden table lists every node's path, value, share, and measure.

## Motion

- Drilling in carries every tile through one affine zoom: the chosen tile grows to fill the view, its siblings fly outward, and its children open inside it.
- Zooming out reverses the same path, so each level shrinks back into the tile it came from.
- Changing a measure re-lays out the same ids, so tiles resize and recolor in place; totals roll and breadcrumbs slide.
- Text never scales: tiles are sized each frame and labels appear only where they fit. Reduced motion places tiles immediately.

## Responsive behavior

- The layout squarifies to the measured width, so tiles stay close to square on any screen; headers and labels hide where they would not fit.
- Tap a tile to read it, tap a branch to drill in.

## Performance

- Layouts are computed per focus; animation interpolates rects and writes transforms and sizes directly. Comfortable up to a few hundred nodes.

## Notes for AI

- Choose it for part-to-whole across a hierarchy with many leaves, such as revenue by region, country, and plan.
- Give nodes stable ids so switching the size measure morphs rather than rebuilds.
- The shading measure should be a magnitude (growth, margin), not identity; identity comes from the top level hue.
- Colors come from the shared --series-1 to --series-4 tokens in foundation.css: series 1 is the accent itself and series 2 to 4 rotate its hue, validated all-pairs for color vision deficiency across every accent in light and dark. Override the tokens on any ancestor to rebrand.

## Related

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Waffle chart](https://uiarc.dev/components/waffle-chart/markdown): A ten by ten unit chart where every cell is one percent, and cells fly to their new group when the data changes.

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
- [Split bar](https://uiarc.dev/components/split-bar/markdown): A single 100% bar split into shares: rest on a segment to widen it and read its exact figures, toggle segments from the legend and the rest reflow, with labels inside when they fit and on leader lines when they don't.

## Guidance for AI tools

Treemap: A squarified treemap: click to drill and the tiles grow to fill the view, with a breadcrumb back and metrics that morph every tile. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
