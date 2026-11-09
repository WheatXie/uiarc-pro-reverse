# Radar chart

> Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/radar-chart
- Markdown: https://uiarc.dev/components/radar-chart/markdown
- Source file: `registry/components/radar-chart/radar-chart.tsx`
- Dependencies: motion
- Keywords: data, chart, new, radar chart, spider chart, web chart, react radar chart, comparison chart, animated radar chart, profile comparison, polar chart

## When to use

- Comparing the profile of a few options across shared measures.
- Showing strengths and gaps at a glance, such as scores or ratings.

## When not to use

- Use bar-chart when the precise difference on one measure matters.
- Use plan-matrix for feature comparisons with yes or no values.
- Avoid more than three profiles; the shapes stop being readable.

## Installation

Radar chart is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/radar-chart
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RadarChart } from "@/components/arc/radar-chart/radar-chart";

const axes = [
  { key: "talent", label: "Talent pool" },
  { key: "afford", label: "Affordability" },
  { key: "transit", label: "Transit" },
  { key: "life", label: "Quality of life" },
  { key: "tax", label: "Tax climate" },
];

export function Offices({ rival }: { rival: RadarSeries }) {
  return <RadarChart axes={axes} series={[lisbon, rival]} label="Office locations" />;
}
```

## API reference

### RadarChart

Two or three profiles on one web of five to eight measures. Profiles are drawn by position, so replacing one morphs its shape into the next. Moving across the web picks the nearest axis and compares every profile's value there.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `axes` (required) | `RadarAxis[]` | – | Measures around the web, clockwise from the top: { key, label, max? }. At least three. |
| `series` (required) | `RadarSeries[]` | – | Up to three profiles: { key, label, values }. They take the series hues in order, the first derived from the accent; replacing the series at a position morphs that shape. |
| `label` (required) | `string` | – | What is compared. Names the chart, the summary, and the table. |
| `max` | `number` | `100` | Default top of every axis. |
| `rings` | `number` | `4` | Concentric guides. |
| `size` | `number` | `320` | Largest web diameter in pixels. It shrinks to fit narrow containers. |
| `formatValue` | `(value: number, axis: RadarAxis) => string` | – | Formats values in the tooltip and table. |
| `activeAxis` | `string \| null` | – | Controlled axis in focus. |
| `onActiveAxisChange` | `(key: string \| null) => void` | – | Called as the axis in focus changes. |
| `legend` | `boolean` | `true` | Profile names with a line key. Hovering or pressing one brings its shape forward. |
| `emptyLabel` | `string` | `"No data"` | Message with fewer than three axes or no series. |
| `ref` | `Ref<HTMLElement>` | – | Forwarded to the figure. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the web and reads the first axis, then the legend. |
| ArrowRight / ArrowDown | Next axis, clockwise. |
| ArrowLeft / ArrowUp | Previous axis. |
| Home / End | First or last axis. |
| Escape | Clears the reading. |

## Accessibility

- The web is a focusable group with a roledescription and instructions; shapes and labels are aria-hidden.
- A polite live region reads the axis and every profile's value there.
- A visually hidden summary and a table list every value by measure and profile.
- Profiles are named in the legend and the tooltip with a line key, so identity never relies on colour alone.

## Motion

- Swapping a profile morphs its shape from the one on screen with a gently bouncing spring.
- The web unfolds from the centre the first time it is seen.
- Vertex markers and the tooltip glide between axes on springs; the tooltip sits past the axis label so the label and vertices stay visible.
- Reduced motion swaps shapes and moves markers immediately.

## Responsive behavior

- The web shrinks to the container and the label ring tightens below 360px; axis labels wrap.
- The tooltip clamps inside the chart at every width.
- Touch reads axes with a press and drag.

## Performance

- Shapes are rewritten from one paint function during morphs; React renders once per change.
- One ResizeObserver measures the container.

## Notes for AI

- Choose it for the overall shape of two or three profiles on the same five to eight measures: products, plans, locations, candidates.
- Put the subject of the story first so it takes the accent derived first series, and drive the second position from a picker to get the morph.
- Every axis must point the same way, higher is better, or the shape misleads.
- For exact comparison of values, pair it with a table or use bar-chart.

## Related

- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Slope chart](https://uiarc.dev/components/slope-chart/markdown): Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.
- [Donut chart](https://uiarc.dev/components/donut-chart/markdown): A donut whose arcs morph between datasets, with the active value rolling into the center.

## Also in advanced charts

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Radar chart: Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
