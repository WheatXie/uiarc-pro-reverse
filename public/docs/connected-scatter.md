# Connected scatter

> A connected scatterplot of monthly CAC against LTV where the path draws itself in, a scrubber moves a head along the curve, and a channel switch morphs the path against a shaded 3x target line.

- Type: Block
- Page: https://uiarc.dev/components/blocks/connected-scatter
- Markdown: https://uiarc.dev/components/blocks/connected-scatter/markdown

- Access: Arc Pro
- Registry id: `connected-scatter`
- Source file: `registry/blocks/connected-scatter/connected-scatter.tsx`
- Built from: Segmented control, Button
- Keywords: connected scatter, connected scatterplot, scatter plot, cac, ltv, ltv to cac, unit economics, time series, trajectory, path chart, scrubber, morph, growth, acquisition channels, price volume

Render <ConnectedScatter /> for the demo, or pass series (same number of points in each, in time order), xAxis, yAxis, targetRatio and formatValue for your own two metrics. Listen to onMonthChange to sync the month the head settles on.

## When to use

- A growth or finance screen that shows whether unit economics are moving toward or away from a target ratio.
- Comparing how a few segments or channels travelled through the same two metrics over the same months.
- A report where specific months (a pricing change, a campaign) explain a turn and deserve a label on the path.

## When not to use

- Use line-chart or metric-explorer when time itself is the axis and one metric is enough.
- Use efficient-frontier for risk against return of a portfolio you can change.
- Use a plain scatter or beeswarm when points have no time order to connect.

## Installation

Connected scatter is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/connected-scatter
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ConnectedScatter } from "@/components/arc/blocks/connected-scatter/connected-scatter";

export function UnitEconomics() {
  return (
    <ConnectedScatter
      defaultSeries="partners"
      onMonthChange={index => setSelectedMonth(index)}
    />
  );
}
```

## API reference

### ConnectedScatter

A connected scatterplot of two metrics over time. Each month is a point, joined in time order by a smooth path with small direction arrows. The path draws itself in once, a head marks the selected month and a time scrubber moves it along the path, a channel switch morphs the path point by point to another series, and a dashed target line (LTV = 3x CAC) splits the plot with the healthy side lightly shaded. Hovering a point shows its date and both values.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `series` | `ScatterSeries[]` | `SERIES` | Series to switch between: id, name, points in time order ({ label, x, y }) and optional notes ({ index, text, side }) that label key months. Every series needs the same number of points so the path can morph. |
| `defaultSeries` | `string` | – | Id of the series shown first. Defaults to the first series. |
| `xAxis` | `ScatterAxis` | `X_AXIS` | Horizontal axis: short name for the readout, title printed on the axis, min, max and gridline step. The sample is CAC from $200 to $1,800. |
| `yAxis` | `ScatterAxis` | `Y_AXIS` | Vertical axis, same shape. The sample is 12 month LTV from $2,000 to $6,000. |
| `targetRatio` | `number` | `3` | Slope of the reference line y = targetRatio times x. The region above it is shaded as healthy and the readout says whether the selected month is above or below it. |
| `formatValue` | `(value: number) => string` | `whole US dollars` | Formats values in the readout, the tooltip, the axis ticks and the screen reader table. |
| `title` | `string` | `"CAC and LTV by channel"` | Block heading. |
| `description` | `string` | – | One line under the heading. Defaults to a sentence naming the metrics and the date range. |
| `onMonthChange` | `(index: number) => void` | – | Called with the month index whenever the head settles on a month: a released scrub, a key press, a tap on a point, or the end of playback. Not called on every frame. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the channel switch, the play button and the month scrubber. |
| Arrow left / Arrow right | On the scrubber, moves the head one month back or forward along the path. |
| Page up / Page down | On the scrubber, moves three months at a time. |
| Home / End | On the scrubber, jumps to the first or last month. |
| Arrow keys in the channel switch | Switch channel; the path morphs to the new series. |
| Enter / Space on the play button | Plays through the months from the head, pauses, or replays from the first month at the end. |

## Accessibility

- The scrubber is role="slider" over the months, with a value text that reads the date, both values, the ratio and whether it is above or below the target.
- A polite live region announces the month when the head settles and the new values when the channel changes. Playback announces only where it stops.
- The readout is a description list, so the selected month, both values and the ratio are always available as text.
- The chart drawing is hidden from assistive technology; a visually hidden table lists every month with both values and the ratio for the current channel.
- Above or below target is written out beside a status dot, never shown by color alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The focused scrubber fills and enlarges its thumb.

## Motion

- The first time the block scrolls into view, the head travels every month and the path draws in behind it; the dotted future path, arrows and labels fade in once it lands.
- Scrubbing moves the head along the real curve, not a straight line between months. A press glides the head to the pointer once, then it follows one to one, and a release settles on the nearest month with the smooth spring, which never overshoots.
- Switching channel morphs every point, arrow and the path itself on the smooth spring; the readout numbers count through the in between values and month labels crossfade.
- Every moving part (path, trail length, head, guides, dots, arrows, scrubber thumb and readout values) is a motion value written once per frame, so none of it re-renders React.
- Reduced motion shows the finished path at once, jumps the head to each month, steps playback month by month and swaps channels without a morph.

## Responsive behavior

- The block reflows against its own width with container queries: four readout cells in a row from 720px, two by two below it.
- The chart draws in real pixels at every size, so text and strokes never stretch; the plot is 380px tall on wide layouts, 330px at tablet widths and 300px on phones.
- Below 480px of plot width the notes, the target line label and the zone label hide (the key names both), x ticks thin to every other gridline, and edge labels flip inward.
- The scrubber is 44px tall for touch and the play button is a full size control. On phones the play button sits above the scrubber, and quarter labels under the scrubber hide below 560px.
- Tapping a point on a touch screen shows its values and moves the head there.

## Performance

- The path is traced as Catmull-Rom Béziers and sampled once per resize or per morph frame (24 samples per month), so moving the head is a lookup, not a curve solve.
- Only month changes, hover changes and the play state re-render React; every frame writes motion values directly.
- Comfortable up to a few dozen points per series; beyond that, thin the direction arrows or aggregate to quarters.

## Notes for AI

- Choose it when the story is how two metrics moved together over time, such as CAC against LTV, price against volume, or spend against conversions.
- The sample data is monthly CAC and 12 month LTV for three acquisition channels, January 2025 to June 2026. Replace SERIES, X_AXIS and Y_AXIS with your own; keep the same number of points in every series.
- Use notes sparingly (one or two per series) for events that explain a turn in the path; the first and last month are labelled automatically and narrow plots hide the notes.
- The target line always passes through the origin, so it suits ratio targets. Set min on both axes to zoom into where the data lives; the shaded region is clipped to the plot.
- The first render is server safe: it draws at a default size with the head on the first month, then measures and animates on the client.

## Related

- [Metric explorer](https://uiarc.dev/components/blocks/metric-explorer/markdown): KPI cards that open into a scrubbable chart and morph between metrics and ranges.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
