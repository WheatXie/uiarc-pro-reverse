# Horizon chart

> A horizon chart that stacks fourteen daily series as compact folded rows, with a synced crosshair, a sort by name, peak or latest, a band count setting that folds every row on one spring, and a legend that explains how to read the bands.

- Type: Block
- Page: https://uiarc.dev/components/blocks/horizon-chart
- Markdown: https://uiarc.dev/components/blocks/horizon-chart/markdown

- Access: Arc Pro
- Registry id: `horizon-chart`
- Source file: `registry/blocks/horizon-chart/horizon-chart.tsx`
- Built from: Segmented control
- Keywords: horizon chart, horizon graph, time series, many series, deviation, baseline, anomaly, monitoring, compact chart, bands, crosshair, analytics

Render <HorizonChart /> for the demo, or pass series (signed values against a baseline, one per day), days and ticks, plus baselineLabel for the legend. defaultSort, defaultBands and extent set the opening view; onSortChange, onBandsChange and onDayChange report changes.

## When to use

- Operations or growth dashboards comparing many markets, services or products against their own baseline over weeks or months.
- Monitoring views where the reader scans for which rows broke from normal and when, then reads exact values on one day.
- Any time series comparison where small multiples of line charts would need too much height.

## When not to use

- Use small-multiples when there are only a few series and the reader needs axes and exact levels in each panel.
- Use ridgeline to compare distributions rather than values over time.
- Use streamgraph to show how parts add up to a total over time.
- Use line-chart for one to four series that should be read precisely against a y axis.

## Installation

Horizon chart is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/horizon-chart
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { HorizonChart } from "@/components/arc/blocks/horizon-chart/horizon-chart";

export function MarketHealth({ markets, days }) {
  return (
    <HorizonChart
      title="Sessions against baseline"
      series={markets}
      days={days}
      baselineLabel="spring average"
      defaultBands={3}
      onDayChange={index => setInspectedDay(index)}
    />
  );
}
```

## API reference

### HorizonChart

A horizon chart that stacks many daily series as compact rows. Each row folds its curve into bands of rising intensity, one hue above the baseline and one below, so a dozen series fit in the height of two line charts. A synced crosshair reads every row on the same day, rows sort by name, peak swing or latest value on one spring, a band count setting folds and unfolds every row together, and a legend explains how to read the bands.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `series` | `HorizonSeries[]` | `horizonSeries` | One row per series: an id, a name and one value per day as a signed distance from its baseline (12 means 12% above, -8 means 8% below). |
| `days` | `HorizonDay[]` | `horizonDays` | Days on the shared x axis, oldest first, each with a short label and a long label for the readout and screen readers. |
| `ticks` | `{ index: number; label: string }[]` | `horizonMonthTicks` | Labels on the x axis, each placed at a day index. |
| `title` | `string` | `"Sessions against baseline"` | Heading of the block. |
| `description` | `string` | `horizonDescription` | Line under the title. Pass an empty string to hide it. |
| `baselineLabel` | `string` | `"spring average"` | What the values are measured against, used in the legend caption and for screen readers. |
| `defaultSort` | `"name" \| "peak" \| "latest"` | `"peak"` | Opening row order. Peak sorts by the largest swing from baseline in either direction, latest by the value on the last day. |
| `defaultBands` | `1 \| 2 \| 3 \| 4` | `3` | Opening number of bands each row folds into. One band draws a plain area chart. |
| `extent` | `number` | – | Distance from the baseline that fills every band; larger values stay in the strongest band. Defaults to the largest value rounded up to a multiple of 12, so every band count has a round step. |
| `formatValue` | `(value: number) => string` | `signed whole percent` | Formats a value for the rows, the legend and screen readers. The default uses a true minus sign. |
| `onSortChange` | `(sort: HorizonSort) => void` | – | Called after the row order changes. |
| `onBandsChange` | `(bands: 1 \| 2 \| 3 \| 4) => void` | – | Called after the band count changes. |
| `onDayChange` | `(index: number \| null) => void` | – | Called when the synced crosshair moves to a day, or with null when it clears. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the sort switch, the band count switch and the chart. |
| Arrow keys | On a switch, moves the selection. On the chart, moves the crosshair one day left or right. |
| Shift + Arrow left / right | On the chart, moves the crosshair one week. |
| Home / End | On the chart, jumps to the first or last day. |
| Escape | On the chart, clears the crosshair and shows the latest day again. |

## Accessibility

- The chart is a focusable group with a keyboard hint; focusing it places the crosshair on the latest day.
- A visually hidden table lists every row with its latest value, its highest and its lowest value with their dates, in the current order.
- Moving the crosshair by keyboard announces the day with the highest and lowest row through one polite live region; sort and band changes are announced there too.
- Values carry a sign and the legend names both sides (below and above), so direction never depends on color alone. The color scale is an image with a full text label.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard position shows as the crosshair, the readout and the selected fills of the switches.

## Motion

- Changing the band count animates one motion value that drives two custom properties on the root, so every layer in every row folds or unfolds together on a no-overshoot spring, on transform and opacity alone.
- Sorting moves each row to its new place with a layout spring that never overshoots.
- The crosshair is a full-width track translated by a share of its own width, following the pointer on a short critically damped spring; it appears in place instead of sliding in from its last day.
- Row values and the date are written straight to the DOM while scrubbing, so the pointer never renders React.
- Reduced motion makes the fold, the reorder and the crosshair instant.

## Responsive behavior

- Rows share one plot column, so the crosshair spans every row at any width.
- Below a 560px container the name and value columns narrow, text steps down to the small size and the switches wrap under the title at full width.
- Switches grow to 44px on touch. Tapping or dragging across the chart sets the crosshair and keeps it after the finger lifts; vertical scrolling is never captured.
- The legend moves under the readout on narrow screens and keeps its fixed scale so band changes never shift the layout.

## Performance

- Each row draws its above and below areas once as paths in a unit box; the bands are CSS transforms of those paths, so changing the band count never rebuilds geometry.
- Scrubbing writes the date and one text node per row without React renders; hit testing uses one rectangle over the plot column.
- Comfortable up to about 40 rows of a few hundred days; beyond that, aggregate days into weeks.

## Notes for AI

- Choose it for 8 to 30 series on one time axis where each value is a deviation from a baseline: sessions against a seasonal average, latency against a target, demand against a forecast, returns against a benchmark.
- Pass signed values against the baseline, not raw levels. Convert levels first (value / baseline - 1) so rows of different sizes compare on one scale.
- The above side uses the first chart series color and the below side the third, both theme tokens that follow the accent; keep them if you restyle.
- Every row always renders four layers per side; a layer above the band count covers values past the extent and stays empty, which is what lets the band count animate continuously.

## Related

- [Small multiples](https://uiarc.dev/components/blocks/small-multiples/markdown): A trellis of small line charts that reads as one chart, with a synced crosshair, a shared or independent y scale that springs the axes, sorting with a FLIP reorder, a ghost of the overall total behind every panel and dimming for flat trends.
- [Ridgeline](https://uiarc.dev/components/ridgeline/markdown): Overlapping distributions, one ridge per group: hover to lift a ridge and read its quartiles, switch datasets and every curve morphs.
- [Streamgraph](https://uiarc.dev/components/streamgraph/markdown): Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
