# Race bar chart

> A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/race-bar-chart
- Markdown: https://uiarc.dev/components/race-bar-chart/markdown
- Source file: `registry/components/race-bar-chart/race-bar-chart.tsx`
- Dependencies: motion, lucide-react
- Keywords: data, chart, new, bar chart race, racing bars, ranking over time, animated bar chart, leaderboard, timeline, data story

## When to use

- Showing how the leaders of a ranking change across many periods.
- A launch or recap moment where the motion itself is the point.
- Letting people scrub to any period and read exact values.

## When not to use

- Use line-chart when exact trends over time matter more than rank.
- Use bar-chart for a single period's comparison.
- Avoid for dashboards people glance at; autoplay competes with other content.

## Installation

Race bar chart is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/race-bar-chart
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RaceBarChart } from "@/components/arc/race-bar-chart/race-bar-chart";

const items = [
  { id: "chair", label: "Oak lounge chair", group: "furniture" },
  { id: "lamp", label: "Mushroom lamp", group: "lighting" },
];
const frames = [
  { period: "January", values: { chair: 14000, lamp: 66000 } },
  { period: "February", values: { chair: 30000, lamp: 128000 } },
];

export function ProductRace() {
  return <RaceBarChart items={items} frames={frames} groups={[{ id: "furniture", label: "Furniture" }, { id: "lighting", label: "Lighting" }]} label="Revenue by product" highlight="chair" />;
}
```

## API reference

### RaceBarChart

A bar chart race: bars overtake each other on springs as values grow, numbers count continuously, the period rolls in large type, and a timeline plays, pauses, and scrubs through time.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `{ id: string; label: string; group?: string }[]` | – | The things being ranked. A stable id keeps each bar's identity across frames. |
| `frames` (required) | `{ period: string; values: Record<string, number> }[]` | – | One frame per period, in order. Missing ids count as zero. |
| `label` (required) | `string` | – | What is ranked. Names the chart for assistive technology. |
| `groups` | `{ id: string; label: string }[]` | – | Names and order of the groups. The first four take the series hues and a legend appears; without groups every bar takes the first hue. |
| `formatValue` | `(value: number) => string` | – | Formats values on bars, in the tooltip, and in the table. Defaults to a compact number. |
| `formatTick` | `(value: number) => string` | – | Formats the value axis. |
| `bars` | `number` | `8` | Bars shown at once. Items below the cut slide out of view. |
| `frame` | `number` | – | Controlled frame index. A new value glides the race there. |
| `defaultFrame` | `number` | `0` | Initial frame when uncontrolled. |
| `onFrameChange` | `(index: number) => void` | – | Called when the shown period changes. |
| `playing` | `boolean` | – | Controlled playback. |
| `defaultPlaying` | `boolean` | `false` | Initial playback when uncontrolled. |
| `onPlayingChange` | `(playing: boolean) => void` | – | Called when playback starts or stops. |
| `autoPlay` | `boolean` | `true` | Starts playing the first time the chart scrolls into view. Ignored with reduced motion. |
| `frameDuration` | `number` | `1400` | Milliseconds per period while playing. |
| `loop` | `boolean` | `false` | Rewinds to the first period after the last and keeps playing. |
| `highlight` | `string` | – | Item id whose name and value are emphasized, such as your own product. |
| `className` | `string` | – | Extra class on the root figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Space / Enter | Plays or pauses. At the end, replays from the start. |
| ArrowLeft / ArrowRight | Steps one period back or forward; the race glides there. |
| ArrowUp / ArrowDown | Moves the reading through the bars by rank and shows the tooltip. |
| Home / End | Jumps to the first or last period. |
| Escape | Clears the reading. |

## Accessibility

- The plot is a focusable group with a description of its keys; the timeline is role="slider" with the period as aria-valuetext.
- Stepping announces the period and the leader through a polite live region; reading a bar announces its name, rank, and value.
- A visually hidden table lists every item's value for every period.
- Group hue is never the only cue: every bar carries its name and value.

## Motion

- Time is continuous: values interpolate between periods, so bars grow smoothly and numbers count rather than jump.
- Rank changes move each row on its own spring, so overtakes read as one continuous slide; bars entering the top set rise from below and fade in.
- The drawn clock follows the requested time on a critically damped spring, so steps glide and a replay sweeps back through every period.
- Axis ticks glide with the scale and crossfade when the step changes; the period label rolls in with a short blur.
- Playback pauses while the chart is off screen. Reduced motion skips autoplay, steps periods without interpolation, and places bars immediately.

## Responsive behavior

- Below 400px names move inside the bars so bar length keeps its room; values sit past the name when a bar is short.
- The tick count adapts to the plot width and the period label steps down a size on small screens.
- The timeline is a 36px tall touch target and scrubs with a finger.

## Performance

- One requestAnimationFrame loop writes transforms, widths, and text straight to the DOM; React renders only on period changes.
- The loop sleeps when paused and settled.

## Notes for AI

- Choose it for a ranking that changes over time, told as a story: top products, cities, or accounts month by month.
- Pass cumulative values (year to date) for a race that only grows, or raw values for a ranking that rises and falls.
- Keep items to about 20 and bars to 6 to 10; the table carries the rest.
- Colors come from the shared --series-1 to --series-4 tokens in foundation.css: series 1 is the accent itself and series 2 to 4 rotate its hue, validated all-pairs for color vision deficiency across every accent in light and dark. Override the tokens on any ancestor to rebrand.

## Related

- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Streamgraph](https://uiarc.dev/components/streamgraph/markdown): Layered streams on a wiggle baseline that morph between ranges, with a layer you can isolate and read week by week.
- [Slope chart](https://uiarc.dev/components/slope-chart/markdown): Before and after on two axes: lines draw in, rank moves sit beside each value, and switching datasets slides every line to its new slope.

## Also in advanced charts

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Race bar chart: A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
