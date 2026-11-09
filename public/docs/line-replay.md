# Line replay

> A time replay line chart that draws a day of traffic with a moving playhead, a value label on the tip, a scrubber, speed control and key moments annotated as the playhead passes them.

- Type: Block
- Page: https://uiarc.dev/components/blocks/line-replay
- Markdown: https://uiarc.dev/components/blocks/line-replay/markdown

- Access: Arc Pro
- Registry id: `line-replay`
- Source file: `registry/blocks/line-replay/line-replay.tsx`
- Built from: Button, Segmented control
- Keywords: replay, time replay, playback chart, animated line chart, playhead, scrubber, timeline, annotations, key moments, launch day, incident timeline, story chart, speed control

Render <LineReplay /> for the launch day demo, or pass data (points with time in minutes, value and optional baseline) and moments on the same clock. Use onMomentReached to react as playback passes each moment, and defaultPosition, duration and defaultSpeed to tune how it opens and plays.

## When to use

- Post-launch or campaign reviews where the team wants to watch traffic respond to each announcement.
- Incident retrospectives that step through a metric with the alert, the deploy and the recovery marked.
- Storytelling pages and reports where a single series over one session or day is best understood in sequence.

## When not to use

- Use annotated-trend when people need to add and edit their own notes on a static trend.
- Use connected-scatter to replay how two measures moved together over time.
- Use metric-explorer or a line chart to compare several series or ranges at a glance without playback.

## Installation

Line replay is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/line-replay
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LineReplay, type ReplayMoment, type ReplayPoint } from "@/components/arc/blocks/line-replay/line-replay";

export function IncidentReplay({ points, moments }: { points: ReplayPoint[]; moments: ReplayMoment[] }) {
  return (
    <LineReplay
      title="Checkout errors, 14 May"
      description="Failed payments per minute across the incident window, UTC."
      data={points}
      moments={moments}
      seriesLabel="14 May"
      baselineLabel="Previous Tuesday"
      valueLabel="Errors"
      duration={20}
      onMomentReached={moment => analytics.track("replay_moment", { id: moment.id })}
    />
  );
}
```

## API reference

### LineReplay

A time replay line chart. Press play and the line draws through the day with a playhead, a value label riding the tip and a clock on the time axis. Key moments are annotated as the playhead passes them: a marker settles onto the line, a callout rises in a lane above the plot, and the matching row in the moments list lights up and reveals its effect once that window has played. A scrubber with moment ticks, a speed control and a live readout (time, value, ratio to a comparison line and the peak so far) sit around the chart.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `ReplayPoint[]` | `POINTS` | Points in time order: `time` in minutes from the start, the replayed `value`, and an optional `baseline` drawn in full as a quiet dashed comparison. Leave `baseline` out of every point to hide the comparison, its legend entry and the ratio readout. |
| `moments` | `ReplayMoment[]` | `MOMENTS` | Key moments on the same clock: `id`, `time`, `title`, an optional one-line `detail` and a `kind` (launch, press, email, incident or milestone) that picks the icon. Incidents are drawn in the warning color and their effect is the dip over 20 minutes; every other moment reports the rise over the next hour. |
| `title` | `string` | `"Launch day"` | Heading of the block. |
| `description` | `string` | `"People on site every five minutes on Tuesday 8 September 2026, Pacific time."` | One line under the heading that names what is measured and when. |
| `seriesLabel` | `string` | `"Launch day"` | Legend name of the replayed line. |
| `baselineLabel` | `string` | `"Typical Tuesday"` | Legend name of the comparison line, also used in the ratio readout ("Versus typical Tuesday"). |
| `valueLabel` | `string` | `"On site"` | Label of the value under the playhead, in the readout and the scrubber's value text. |
| `formatTime` | `(minutes: number) => string` | `formatClock` | Formats a time on the replay clock for the readout, the playhead clock, callouts and the moments list. The default prints 9:40 am. |
| `formatTick` | `(minutes: number) => string` | `formatHour` | Formats the time axis labels. The default prints 6 am. |
| `formatValue` | `(value: number) => string` | `formatCount` | Formats values in the readout, the tip label and moment effects. |
| `duration` | `number` | `16` | Seconds a full replay takes at 1×. |
| `defaultSpeed` | `0.5 \| 1 \| 2 \| 4` | `1` | Starting playback speed. |
| `defaultPosition` | `"start" \| "end"` | `"end"` | Where the playhead rests before the first play. "end" shows the whole line with every moment; pressing Replay rewinds and plays from the start. |
| `autoPlay` | `boolean` | `false` | Plays from the start the first time the block is 40% in view. Ignored with reduced motion. |
| `onMomentReached` | `(moment: ReplayMoment) => void` | – | Called when playback passes a moment (not when scrubbing or jumping). |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the play button, the scrubber, the speed control and each key moment. |
| Space / Enter / K | On the scrubber, plays or pauses the replay. At the end it replays from the start. |
| Arrow left / Arrow right | On the scrubber, steps one point (five minutes in the sample). Hold Shift to step an hour. |
| Page up / Page down | On the scrubber, steps an hour. |
| Home / End | On the scrubber, jumps to the start or the end. |
| Arrow keys | On the speed control, moves between 0.5×, 1×, 2× and 4×. |
| Enter / Space | On a key moment, moves the playhead to it; playback continues from there if it was playing. |

## Accessibility

- The scrubber is a role="slider" measured in minutes; its value text reads the time and the value ("9:40 am, 2,316 on site") and is updated whenever playback is paused, so a screen reader is not flooded while it plays.
- The readout above the chart repeats the time, the value, the ratio to the comparison and the peak so far as text, so nothing is available only as a line position. The drawing itself is hidden from assistive technology.
- Passing a moment during playback, pausing, jumping and finishing are announced through a polite live region ("9:40 am. Hacker News front page.", "Replay finished. Peak 6,041 at 10:25 am.").
- Key moments are an ordered list of buttons; the latest reached one has aria-current. A moment's effect line stays hidden from screen readers until the replay has played through it.
- The play button has a specific name for each state: Play replay, Pause replay, Replay from the start.
- Incidents carry a warning icon and their own title, never color alone. Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The scrubber and the moment rows show keyboard position with a fill.

## Motion

- Playback advances a single motion value from requestAnimationFrame; each frame writes the line and area paths, the playhead, the tip label, the axis clock, the scrubber and the readout straight to the DOM. React renders only when a moment is passed, playback starts or stops, or the size changes.
- Replay and jumping to a moment glide the playhead with the smooth spring, which never overshoots, so the line retracts or extends to the target and a new jump mid-way picks up from where it is.
- Passing a moment settles its marker onto the line (opacity and scale), fades in its stem, and rises its callout into the lane above the plot on the smooth spring; the previous callout fades out faster than the new one enters.
- Time axis labels fade out of the way of the playhead clock instead of overlapping it.
- Reduced motion keeps playback (it is started by the viewer and can be paused at any time) but makes rewinds, jumps, markers and callouts instant and turns off autoplay.

## Responsive behavior

- From a block width of 1000px the key moments sit in a divided column beside the chart; below that they move under it in two columns, and in one column below 560px.
- Below 560px the readout becomes a three-column grid with the peak on its own row, the time axis labels every six hours, the chart is 300px tall, and the scrubber takes a full row above the play button and the speed control.
- The play button and every moment row are at least 44px tall, and the scrubber's hit area is 44px tall. The chart keeps vertical page scrolling; a horizontal drag or a tap scrubs.

## Performance

- One path string is built per frame from precomputed point positions (288 points in the sample), and text nodes are written only when their text changes.
- Running peaks, moment positions and effects are computed once per data set; positions are recomputed only on resize through a ResizeObserver.
- No React render happens per frame; state changes only a handful of times per replay.

## Notes for AI

- Choose it when the order in which something happened is the story: a launch day, an incident, an election night, a match, a trading session. The replay makes cause and effect visible by revealing the line and the moments together.
- Pass points on one clock in minutes from the start, and moments on the same clock. Points do not need to be evenly spaced; moments between points are placed by interpolation.
- The value axis is fixed to the whole series, so the line never rescales while it plays.
- The sample is an illustrative launch day for a fictional product with typical traffic for comparison; it is not real traffic.

## Related

- [Connected scatter](https://uiarc.dev/components/blocks/connected-scatter/markdown): A connected scatterplot of monthly CAC against LTV where the path draws itself in, a scrubber moves a head along the curve, and a channel switch morphs the path against a shaded 3x target line.
- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
