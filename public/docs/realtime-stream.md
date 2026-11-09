# Realtime stream

> A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/realtime-stream
- Markdown: https://uiarc.dev/components/realtime-stream/markdown
- Source file: `registry/components/realtime-stream/realtime-stream.tsx`
- Dependencies: motion
- Keywords: data, chart, live, new, realtime chart, live chart, streaming chart, react live line chart, monitoring chart, scrolling chart, anomaly chart, 60fps chart

## When to use

- Live monitoring panels and status pages.
- A hero on an infrastructure or observability page where motion shows the system is alive.

## When not to use

- Use line-chart for static time series.
- Use brush-chart for long histories people zoom into.
- Use sparkline for a tiny trend inside a stat.

## Installation

Realtime stream is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/realtime-stream
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { RealtimeStream, type StreamPoint } from "@/components/arc/realtime-stream/realtime-stream";

export function Latency({ socket }: { socket: WebSocket }) {
  const [points, setPoints] = useState<StreamPoint[]>([]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const { t, p95 } = JSON.parse(event.data);
      setPoints(list => [...list.slice(-200), { t, value: p95, anomaly: p95 > 300 ? "Spike" : undefined }]);
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket]);
  return <RealtimeStream points={points} label="p95 latency" unit="ms" interval={500} />;
}
```

## API reference

### RealtimeStream

A live line chart on a canvas that scrolls continuously at the display rate. It draws one interval behind the newest reading so each point slides in, eases its value axis, pops a marker for anomalies, and holds still on hover so a point can be read while new ones queue.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `points` (required) | `StreamPoint[]` | – | Append-only feed in ascending time: { t, value, anomaly? }. A string anomaly becomes the marker tag. |
| `label` (required) | `string` | – | What is measured. Names the chart, the current value, and the table. |
| `unit` | `string` | `""` | Unit after values, such as "ms". |
| `windowMs` | `number` | `30000` | Visible span of time. |
| `interval` | `number` | `1000` | Typical time between points. The view trails the newest point by this much. |
| `height` | `number` | `200` | Plot height in pixels. |
| `formatValue` | `(value: number) => string` | – | Formats values in the readout, tooltip, and table. |
| `formatTime` | `(t: number) => string` | `HH:MM:SS` | Formats times in the tooltip and table. |
| `paused` | `boolean` | – | Controlled pause. |
| `defaultPaused` | `boolean` | `false` | Initial pause when uncontrolled. |
| `onPausedChange` | `(paused: boolean) => void` | – | Called when the status button or Space toggles the pause. |
| `pauseOnHover` | `boolean` | `true` | Holds the view while the pointer is over the plot. |
| `min` | `number` | – | Fixed bottom of the value axis. Leave it out to follow the data. |
| `max` | `number` | – | Fixed top of the value axis. |
| `emptyLabel` | `string` | `"Waiting for data"` | Shown before the first point. |
| `ref` | `Ref<HTMLElement>` | – | Forwarded to the figure. |
| `className` | `string` | – | Extra class on the figure. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the plot, holds the view, and reads the newest visible point. |
| ArrowLeft / ArrowRight | Previous or next point. |
| PageUp / PageDown | Ten points back or forward. |
| Home / End | Oldest or newest visible point. |
| Space / Enter | Pauses or resumes the stream. |
| Escape | Clears the reading and resumes. |

## Accessibility

- The current value is text with an accessible name; the rolling digits are aria-hidden.
- The status button is a toggle with aria-pressed and shows live or paused with a shape and a label, never colour alone.
- Anomalies are announced once in a polite live region as they arrive; point readings are announced as the keyboard moves.
- A visually hidden table lists the latest twenty readings with their notes.

## Motion

- The line scrolls continuously at the display rate; the head interpolates between readings, so new points slide in rather than pop.
- The value axis eases toward the visible range, so gridlines slide instead of jumping.
- Anomaly markers and tags pop in with one overshoot as the head reaches them.
- Resuming glides from the held view back to live.
- Reduced motion stops the scroll: the chart redraws only when a reading arrives, without interpolation or pops.

## Responsive behavior

- The canvas fills its container at the device pixel ratio and redraws on resize.
- Time labels thin out as the plot narrows.
- Touch reads points with a press and drag, which also holds the view.

## Performance

- One canvas, one requestAnimationFrame loop, stopped off screen and in hidden tabs.
- Only points inside the window are drawn, found by binary search.
- Theme tokens are resolved from hidden probes a few times a second, not every frame.

## Notes for AI

- Choose it for one live measure where the last seconds or minutes matter: latency, throughput, queue depth, active users.
- Set interval to the feed's cadence and windowMs to a few dozen points; trim the array to a few windows.
- Flag anomalies on the data itself with a short tag; the chart does not detect them.
- For history or several series, use line-chart or brush-chart instead.

## Related

- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Brush chart](https://uiarc.dev/components/brush-chart/markdown): A dense time series with an overview strip: drag a window to zoom, resize it by its handles, and read events in place.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.

## Also in advanced charts

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.
- [Data grid](https://uiarc.dev/components/data-grid/markdown): A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

## Guidance for AI tools

Realtime stream: A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
