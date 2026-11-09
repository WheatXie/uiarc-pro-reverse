# Sankey flow

> Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/sankey-flow
- Markdown: https://uiarc.dev/components/sankey-flow/markdown
- Source file: `registry/components/sankey-flow/sankey-flow.tsx`
- Dependencies: motion
- Keywords: data, chart, new, sankey diagram, sankey chart react, flow diagram, funnel flow, user journey chart, alluvial diagram, particle flow chart, conversion flow

## When to use

- Showing how a total splits and recombines across three to five stages.
- Explaining where a funnel leaks, with the share at each step one hover away.
- Comparing two periods of the same flow by switching data.

## When not to use

- Use bar-chart for a simple linear funnel with no branches.
- Use sunburst for a strict hierarchy where each part has one parent.
- Avoid more than about 12 nodes per column; small flows become unreadable slivers.

## Installation

Sankey flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/sankey-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SankeyFlow } from "@/components/arc/sankey-flow/sankey-flow";

const nodes = [
  { id: "organic", label: "Organic" }, { id: "paid", label: "Paid" },
  { id: "activated", label: "Activated" }, { id: "inactive", label: "Not activated" },
  { id: "free", label: "Free" }, { id: "pro", label: "Pro" },
];
const links = [
  { source: "organic", target: "activated", value: 3380 }, { source: "organic", target: "inactive", value: 1820 },
  { source: "paid", target: "activated", value: 1990 }, { source: "paid", target: "inactive", value: 1910 },
  { source: "activated", target: "free", value: 3860 }, { source: "activated", target: "pro", value: 1510 },
];

export function SignupJourney() {
  return <SankeyFlow nodes={nodes} links={links} label="Signup journey" columns={["Source", "Activation", "Plan"]} unit="people" totalLabel="signups" />;
}
```

## API reference

### SankeyFlow

A Sankey diagram with smooth ribbons, values on every node, and fine particles drifting along each flow. Hovering a node or ribbon pours the share of every flow that passes through it, end to end. Sources wear the series palette derived from the accent, and a trace pours in its source's hue.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` (required) | `{ id: string; label: string; column?: number }[]` | – | Nodes in the order they stack within each column. Columns default to each node's distance from a source. |
| `links` (required) | `{ source: string; target: string; value: number }[]` | – | Flows between node ids. A node's value is the larger of what flows in and out. |
| `label` (required) | `string` | – | Names the chart for assistive technology. |
| `columns` | `string[]` | – | Stage names printed above each column. Hidden when a name would not fit, and in the upright layout. |
| `unit` | `string` | `""` | Unit after values in the tooltip and table, such as "people". |
| `totalLabel` | `string` | `"the total"` | What the first column adds up to, used in shares such as "21% of signups". |
| `formatValue` | `(value: number) => string` | – | Formats node values, the tooltip, and the table. |
| `height` | `number` | `340` | Plot height in pixels. The upright layout below 420px wide uses at least 480. |
| `particles` | `boolean` | – | Controlled particles along the ribbons. |
| `defaultParticles` | `boolean` | `true` | Initial particles state when uncontrolled. |
| `onParticlesChange` | `(on: boolean) => void` | – | Called when the built in toggle is pressed. |
| `particleToggle` | `boolean` | `true` | Shows the Flow toggle under the plot. |
| `emptyLabel` | `string` | `"No flows yet"` | Shown when there are no positive links. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the diagram and highlights the first node. |
| ArrowUp / ArrowDown | Moves between nodes in a column (left and right in the upright layout). |
| ArrowLeft / ArrowRight | Steps to the nearest node in the previous or next column (up and down in the upright layout). |
| Home / End | Jumps to the first or last column. |
| Escape | Clears the highlight. |

## Accessibility

- The plot is one focusable group; the node in focus is announced with its value, share of the total, and where it flows next.
- A visually hidden table lists every flow with its value and share of the source.
- Labels, particles, and ribbons are aria-hidden; the table and announcements carry the data.
- Highlighting uses the accent plus dimming of everything else, never color alone; values are printed on nodes.

## Motion

- Nodes and ribbons grow in from their centres on first view, and morph from the layout on screen to the new one when data changes.
- Focus pours the traced share into each ribbon on a short spring and drains it back out when focus leaves.
- Particles move at one constant speed on a canvas and pause when the chart is off screen.
- Reduced motion jumps to the final layout and removes particles and the toggle.

## Responsive behavior

- Below 420px wide the diagram turns upright: stages run top to bottom and labels sit under each node at full width.
- On wide layouts the last column labels to its right in a gutter sized to its labels, so no two labels share a gap.
- Touch taps a node or ribbon to trace it and taps again to clear; the tooltip stays inside the plot.

## Performance

- Layout is computed once per data and size change; morphs interpolate numbers and write path attributes directly.
- Particles draw on one canvas, capped at 34 per ribbon, and stop when the chart leaves the viewport.
- Tracing walks each column once, so it stays instant for a few hundred links.

## Notes for AI

- Choose it for funnels that split and merge: acquisition to activation to plan, budget sources to spend, traffic between pages.
- Keep node ids stable across datasets so switching periods morphs instead of redrawing.
- Order nodes within a column the way people read them, such as good outcomes on top; the layout keeps that order.
- Tracing assumes each node mixes what reaches it, which fits aggregates. Say so if exact per person paths matter.

## Related

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Streamgraph](https://uiarc.dev/components/streamgraph/markdown): Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.

## Also in advanced charts

- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Sankey flow: Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
