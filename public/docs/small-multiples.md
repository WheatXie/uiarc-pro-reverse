# Small multiples

> A trellis of small line charts that reads as one chart, with a synced crosshair, a shared or independent y scale that springs the axes, sorting with a FLIP reorder, a ghost of the overall total behind every panel and dimming for flat trends.

- Type: Block
- Page: https://uiarc.dev/components/blocks/small-multiples
- Markdown: https://uiarc.dev/components/blocks/small-multiples/markdown

- Access: Arc Pro
- Registry id: `small-multiples`
- Source file: `registry/blocks/small-multiples/small-multiples.tsx`
- Built from: Segmented control, Switch
- Keywords: small multiples, trellis, facet, sparklines, line chart grid, synced crosshair, shared scale, independent scale, compare regions, compare products, trend, analytics, dashboard

Render <SmallMultiples /> for the regional revenue demo, or pass series (id, name, values) and periods (short, long) with formatValue and formatTick for your own unit. Use defaultSort, defaultScale, defaultDimFlat, flatThreshold and growthLag to set the opening view, and onIndexChange to follow the crosshair.

## When to use

- Comparing revenue, signups or usage across regions, products, plans or channels over the same months.
- Showing which segments grow, shrink or stall at a glance, with one shared crosshair to read every value for the same period.
- Dashboards where one multi-line chart would be a tangle of overlapping series.

## When not to use

- Use line-chart when two or three series need to be read against each other on one plot.
- Use metric-explorer or kpi-drilldown when a person picks one metric and drills into its detail.
- Use sparkline inside a table row when each series is a small supporting detail beside other columns.
- Use a plain table when the exact values matter more than the shape of each trend.

## Installation

Small multiples is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/small-multiples
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SmallMultiples } from "@/components/arc/blocks/small-multiples/small-multiples";

export function SignupsByPlan() {
  return (
    <SmallMultiples
      title="Signups by plan"
      description="Weekly signups, last 26 weeks"
      series={plans.map(plan => ({ id: plan.id, name: plan.name, values: plan.weekly }))}
      periods={weeks.map(week => ({ short: week.short, long: week.long }))}
      growthLag={4}
      formatValue={value => value.toLocaleString("en-US")}
      formatTick={value => value.toLocaleString("en-US")}
      defaultScale="shared"
    />
  );
}
```

## API reference

### SmallMultiples

A trellis of small line charts, one per region or product, that reads as one chart. A synced crosshair shows every panel's value at the same period, a shared or independent y scale springs the axes and lines between comparing size and comparing shape, panels sort by latest value, growth or name with a FLIP reorder, a dashed ghost of the overall total sits behind every panel for context, and flat trends can be dimmed.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `series` | `SmallMultiplesSeries[]` | `smallMultiplesSeries` | One panel per series: a stable id, a name for the panel heading and one value per period. |
| `periods` | `SmallMultiplesPeriod[]` | `smallMultiplesPeriods` | Periods on the shared x axis, oldest first, each with a short label ("Sep 2025") and a long label ("September 2025") for the readout and screen readers. |
| `title` | `string` | `"Revenue by region"` | Heading of the block. |
| `description` | `string` | `smallMultiplesDescription` | Line under the title. Pass an empty string to hide it. |
| `defaultSort` | `"latest" \| "growth" \| "name"` | `"latest"` | Opening panel order. |
| `defaultScale` | `"independent" \| "shared"` | `"independent"` | Opening y scale. Independent fits each series to its own range so panels compare shape; shared starts every panel at zero on one range so panels compare size. |
| `defaultDimFlat` | `boolean` | `true` | Whether panels with a flat trend start dimmed. |
| `flatThreshold` | `number` | `0.05` | Growth below this absolute share counts as flat (0.05 is 5 percent). |
| `growthLag` | `number` | `12` | Periods between the latest value and the value growth is measured against. 12 compares monthly data with the same month last year. |
| `formatValue` | `(value: number) => string` | – | Formats values for panel headings, the readout and screen readers. The default reads values as thousands of US dollars ($412k, $1.71M). |
| `formatTick` | `(value: number) => string` | – | Formats compact axis ticks in the right gutter of each panel. |
| `onSortChange` | `(sort: SmallMultiplesSort) => void` | – | Called after the panel order changes. |
| `onScaleChange` | `(scale: SmallMultiplesScale) => void` | – | Called after the y scale switches between independent and shared. |
| `onIndexChange` | `(index: number \| null) => void` | – | Called when the synced crosshair moves to a period, or with null when it leaves the panels. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the sort control, the scale control, the dim switch and then the panels. |
| Left / Right arrow | On the panels, moves the synced crosshair one period in every panel at once. Focusing the panels with the keyboard places it on the latest period. |
| Page up / Page down | On the panels, moves the crosshair twelve periods. |
| Home / End | On the panels, jumps to the first or latest period. |
| Escape | On the panels, clears the crosshair and shows the latest values again. |
| Arrow keys | In the sort and scale controls, choose the next or previous option. |

## Accessibility

- The panels are one focusable group with a keyboard hint, so the whole trellis is a single tab stop instead of eight.
- Moving the crosshair by keyboard announces the period, the total and the highest series through one polite live region; sorting, scaling and dimming announce what changed.
- A visually hidden table lists every series with its value at the current period, its growth and its trend in words, in the current sort order.
- Trend direction is carried by an arrow icon and a signed percentage with a true minus sign, and flat trends are labelled Flat, so dimming never relies on opacity alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard position shows as the crosshair and the filled selection in the controls.

## Motion

- Switching the y scale springs each panel's domain on one critically damped spring. The line, the area, the end dot and the axis ticks all derive from the same two motion values, so the axes slide and the line reshapes as one movement; ticks for the other scale fade in as they arrive.
- Sorting moves every panel to its new slot with a FLIP layout animation on a no-overshoot spring, and the hairline dividers travel with the panels.
- The crosshair appears in place, then glides between periods on a short spring written straight to motion values; the dot in each panel rides its line between points.
- Dimming flat trends fades the panel content only, so the grid dividers stay crisp.
- Reduced motion makes the rescale, the reorder and the crosshair instant.

## Responsive behavior

- Four columns from a 640px container, two below it, with plot heights of 104px, 92px and 76px as the container narrows.
- On phones the controls wrap to full rows, the panel value moves under the name, and the tick gutter narrows.
- Hovering a panel drives the crosshair on fine pointers; on touch, a tap or horizontal drag on a chart places it while vertical swipes still scroll the page.
- Controls grow to 44px on coarse pointers.

## Performance

- Paths are SVG in a fixed viewBox stretched to the panel, with non-scaling strokes, so resizing never recomputes geometry.
- During a rescale, paths and ticks are rebuilt from motion values each frame without React renders; the crosshair moves by transforms of full-size layers.
- React renders only when the crosshair crosses into a new period, and the FLIP layout measurement runs only when the order changes.

## Notes for AI

- Choose it when the question is how several series of the same measure compare over one period, and every panel should be read at once rather than opened.
- Pass series with the same number of values as periods. Four to twelve panels work best; the grid is two columns on phones and four from a 640px container.
- The default formatters read values as thousands of US dollars; pass formatValue and formatTick for any other unit.
- The ghost line is the sum of all series drawn in its own scale, so it shows the overall shape, not a size to compare against.
- The line uses the first chart series color, which follows the accent; keep one color so the panels read as one chart.

## Related

- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [KPI drilldown](https://uiarc.dev/components/blocks/kpi-drilldown/markdown): KPI cards that expand into a full detail chart with period comparison and a breakdown table, then fold back.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
