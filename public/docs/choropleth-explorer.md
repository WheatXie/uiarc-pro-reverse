# Choropleth explorer

> A filled-region map that shades every state or region by revenue, growth or penetration on a stepped scale, with a country switch (United States, Canada, Brazil, United Kingdom, France, Germany, Italy, Australia), a hoverable legend, a synced ranked list and a camera zoom into local detail.

- Type: Block
- Page: https://uiarc.dev/components/blocks/choropleth-explorer
- Markdown: https://uiarc.dev/components/blocks/choropleth-explorer/markdown

- Access: Arc Pro
- Registry id: `choropleth-explorer`
- Source file: `registry/blocks/choropleth-explorer/choropleth-explorer.tsx`
- Built from: Segmented control
- Keywords: choropleth, map, filled map, heat map, geography, states, counties, regions, drilldown, zoom, sales territories, penetration, legend, analytics

Render <ChoroplethExplorer /> for the demo, or pass your own regions (SVG paths, values per metric, optional subregions) and metrics. Listen to onRegionOpen and onMetricChange to sync the zoomed region or metric with the URL.

## When to use

- Sales, revenue or usage dashboards that break a metric down by state, country or territory.
- Market coverage and penetration reviews where a region's own subareas explain its number.
- Any analytics view where readers compare neighbouring areas and need the ranked numbers beside the map.

## When not to use

- Use offices-map to place pins at specific locations such as offices or stores.
- Use revenue-globe for flows and totals on a spinning globe when geography is ambience rather than the comparison.
- Use a bar chart or sortable table when the regions are few, or when area size would mislead (a large, sparse region draws more attention than a small, dense one).

## Installation

Choropleth explorer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/choropleth-explorer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ChoroplethExplorer } from "@/components/arc/blocks/choropleth-explorer/choropleth-explorer";

export function SalesByRegion() {
  return (
    <ChoroplethExplorer
      defaultMetric="growth"
      onRegionOpen={id => router.replace(id ? `?state=${id}` : "?")}
    />
  );
}
```

## API reference

### ChoroplethExplorer

A filled-region map that shades every state by a metric on a stepped sequential or diverging scale. A metric switch sweeps the new fills across the map from west to east, the legend steps light every region in their bin, a ranked list stays in sync with the map both ways, and selecting a state zooms the camera into it and shades its counties.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `maps` | `ChoroplethMap[]` | `choroplethMaps` | Areas to switch between, such as countries: an id, a name, its regions, a plural region noun, an optional title, metrics (for a local currency) and view box. A country switch appears when there is more than one. Ignored when regions is set. |
| `defaultMap` | `string` | – | Id of the area shown first. Defaults to the first one. |
| `onMapChange` | `(id: string) => void` | – | Called after the area changes. |
| `regions` | `ChoroplethRegion[]` | – | Top level regions of a single area: an id, a name, SVG path data in view box units, an optional bounding box, one value per metric id (null for no data) and optional subregions with their own paths and values. |
| `metrics` | `ChoroplethMetric[]` | `choroplethMetrics` | Metrics in the switch. Each has a label, a headline label, a format ("currency", "change" or "percent"), a scale ("sequential" or "diverging") and how the headline aggregates ("sum", or "weighted" by the first metric). |
| `defaultMetric` | `string` | – | Id of the metric shown first. Defaults to the first metric. |
| `viewBox` | `[number, number]` | `[975, 610]` | Width and height of the view box the region paths are drawn in. |
| `areaName` | `string` | `"United States"` | Name of the whole area, shown above the map before zooming in. |
| `regionNoun` | `string` | `"states"` | Plural noun for top level regions, used in the list heading, legend and announcements. |
| `title` | `string` | `"Revenue by state"` | Heading of the block. |
| `description` | `string` | `choroplethCaption` | Line under the title. Pass an empty string to hide it. |
| `onRegionOpen` | `(id: string \| null) => void` | – | Called after the map zooms into a region, with its id, or with null when it zooms back out. |
| `onMetricChange` | `(id: string) => void` | – | Called after the metric changes. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the metric switch, the back button when zoomed in, the legend steps and the ranked list. |
| Arrow up / Arrow down | In the ranked list, moves between regions and outlines the focused one on the map. |
| Home / End | In the ranked list, jumps to the first or last region. |
| Enter / Space | On a state, zooms into it and lists its counties. On a county, pins it on the map. On a legend step, keeps its regions lit until pressed again. |
| Escape | Releases a pinned legend step, then zooms back out to every state. |

## Accessibility

- The map is an image with a label naming the area and the metric; the ranked list next to it is the accessible path to every value and every zoom.
- The list is one tab stop with roving focus. Each row names its rank, region, value and whether it opens counties.
- Zooming, zooming out, switching the metric and pinning a county are announced through one polite live region, including the highest region for the new metric.
- Legend steps are toggle buttons with aria-pressed and a label that counts their regions and states their range. Values carry a sign and a true minus, so direction never depends on color alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard position shows as a filled row and an outline on the map.

## Motion

- Switching the metric fades each region to its new fill with a delay set by its position, so the change sweeps across the map from west to east in under 800ms.
- Selecting a state moves one camera on a critically damped spring: translate and scale travel together, so the state glides to the center in a straight line and can be reversed mid-flight. Counties fade in while the camera is still arriving; other states recede to context.
- The headline total counts to each new value on a motion value, list rows glide to their new rank with a layout spring, and rank bars resize on a transform.
- The tooltip follows the pointer on motion values without React renders; the hovered row scrolls into view inside the list, never the page.
- Reduced motion makes every fill, zoom, count and reorder instant.

## Responsive behavior

- From an 820px container the map and the ranked list sit side by side and the list matches the map column's height; below that the list stacks under the map and scrolls inside a fixed height.
- The metric switch takes the full width on phones; the legend wraps its no data step below the ramp.
- Rows are 44px tall, and switches, legend steps and the back button grow to 44px on touch. Tapping a state zooms in directly; tooltips are limited to fine pointers.
- Nothing scrolls sideways: the map scales with its container through the view box.

## Performance

- About 51 state paths plus the counties of one state at a time, with one delegated pointer listener for the whole map.
- The camera writes a single transform attribute from three motion values, and strokes use non-scaling-stroke so the zoom never re-rasterises line widths in JavaScript.
- Fills change through CSS transitions of fill and fill-opacity; ranking and binning are memoized per metric and level.
- The sample data file is about 85KB of simplified path data; supply your own paths at the precision your map needs.

## Notes for AI

- Choose it when the question is how a metric is distributed across areas that people recognise by shape, and when a region's subareas are worth a closer look.
- Bins are recomputed for whatever is in view: quantile breaks rounded to two significant digits, split at zero with a second hue on diverging metrics. Pass raw values and let the block choose the steps.
- Paths are straight segment SVG data. Top level regions share one view box; subregions use a local grid placed with origin [x, y, unit], which keeps small states sharp when zoomed. The sample data is simplified US Census cartographic boundaries in Albers USA.
- Only ten states carry county data in the sample; the others zoom in and explain there is no county detail, which is also how the block handles a region without subregions.
- The positive side uses the first chart series color and the negative side the third, both theme tokens. No data renders as a flat neutral with its own legend step.

## Related

- [Revenue globe](https://uiarc.dev/components/blocks/revenue-globe/markdown): A dotted globe where live payments arc home to headquarters, with a replayable day.
- [Revenue explorer](https://uiarc.dev/components/blocks/revenue-explorer/markdown): A SaaS revenue chart you zoom with a brush while paths, axes and figures glide to the range.
- [KPI drilldown](https://uiarc.dev/components/blocks/kpi-drilldown/markdown): KPI cards that expand into a full detail chart with period comparison and a breakdown table, then fold back.
- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
