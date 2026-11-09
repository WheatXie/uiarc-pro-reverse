# Sunburst

> A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/sunburst
- Markdown: https://uiarc.dev/components/sunburst/markdown
- Source file: `registry/components/sunburst/sunburst.tsx`
- Dependencies: motion
- Keywords: data, chart, new, sunburst chart, zoomable sunburst, hierarchical pie chart, radial treemap, drill down chart, multi level donut, cloud cost breakdown, react sunburst

## When to use

- Drilling into where a total comes from, one level at a time.
- Showing the share of each part within its parent and within the whole.
- Dashboards where a compact, explorable overview beats a long table.

## When not to use

- Use donut-chart for a single level of parts.
- Use tree-table when people need to compare exact values across many rows.
- Avoid it for more than about 150 leaves; thin slivers stop being readable.

## Installation

Sunburst is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/sunburst
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { Sunburst } from "@/components/arc/sunburst/sunburst";

const spend = {
  id: "all", label: "All teams",
  children: [
    { id: "platform", label: "Platform", children: [
      { id: "platform/compute", label: "Compute", children: [{ id: "api", label: "api-cluster", value: 18910 }, { id: "batch", label: "batch-workers", value: 8160 }] },
      { id: "platform/storage", label: "Storage", value: 8670 },
    ] },
    { id: "data", label: "Data", children: [{ id: "data/warehouse", label: "Warehouse", value: 31020 }] },
  ],
};

export function CloudSpend() {
  return <Sunburst data={spend} label="Cloud spend, September" formatValue={value => `$${(value / 1000).toFixed(1)}K`} />;
}
```

## API reference

### Sunburst

A hierarchy drawn as rings. Clicking a segment swings every arc around it as the new centre, the breadcrumb follows, and the centre label rolls to the new total.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` (required) | `SunburstNode` | – | The root: { id, label, value?, children? }. A branch's value is the sum of its children. |
| `label` (required) | `string` | – | Names the chart for assistive technology. |
| `formatValue` | `(value: number) => string` | – | Formats the centre value, legend, tooltip, and table. |
| `depth` | `number` | `3` | Rings shown around the centre at once. Fewer levels below a zoomed node fill the full radius. |
| `size` | `number` | `340` | Largest diameter in pixels. The chart scales down to fit its container. |
| `focus` | `string` | – | Controlled id of the node in the centre. |
| `defaultFocus` | `string` | – | Initial centre when uncontrolled. Defaults to the root. |
| `onFocusChange` | `(id: string) => void` | – | Called when a segment, breadcrumb, legend row, or the centre zooms. |
| `legend` | `boolean` | `true` | Lists the children of the centre with values and shares, synced with the arcs. |
| `emptyLabel` | `string` | `"No data yet"` | Shown in the centre when the total is zero. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the chart and highlights the first segment. |
| ArrowLeft / ArrowRight | Moves between sibling segments. |
| ArrowDown / ArrowUp | Moves to the first child or back to the parent segment. |
| Enter / Space | Zooms into the highlighted segment. |
| Escape / Backspace | Zooms out one level. |

## Accessibility

- The chart is a focusable group; the highlighted segment is announced with its path, value, and share of its parent.
- The breadcrumb is a nav landmark with the current level marked aria-current.
- Legend rows are buttons that name the segment, its value and share, and whether it zooms in.
- A visually hidden table lists every node's full path, value, and share of its parent.

## Motion

- Zooming interpolates every arc's angles and ring from where it is on screen to its place around the new centre, on one spring.
- Rings re-share the radius as levels appear or run out, so a shallow branch fills the chart as it zooms.
- The centre value rolls digit by digit; labels rise in from a soft blur; the breadcrumb slides and reflows.
- Reduced motion jumps arcs to their final place and swaps text with a short fade.

## Responsive behavior

- The ring scales to its container; the legend sits beside it when there is room and below it on narrow screens.
- Arc labels follow the ring's curve and appear only where the arc can hold them.
- Touch taps zoom; the centre is a large target to zoom back out.

## Performance

- Partitioning runs once per data change; arcs are painted by writing path attributes, not by re-rendering React each frame.
- Label fit is measured per arc during paint; keep the tree under a few hundred nodes.

## Notes for AI

- Choose it for exploring a two to four level hierarchy by share: spend, storage, headcount, time.
- Give every node a stable, unique id so switching datasets morphs the arcs.
- Keep top level branches to about eight; each takes the next series hue derived from the accent and its children step lighter; past four they fall back to ink.
- Control focus when a URL or another view should drive the zoom.

## Related

- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Tree table](https://uiarc.dev/components/tree-table/markdown): A table with nested rows, tri-state selection, hierarchy-preserving sort, and lazy-loaded children.
- [Tree view](https://uiarc.dev/components/tree-view/markdown): Navigate nested folders and structured content.

## Also in advanced charts

- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Sunburst: A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
