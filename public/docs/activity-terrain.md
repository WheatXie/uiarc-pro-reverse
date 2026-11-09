# Activity terrain

> A 3D terrain of hourly activity you can orbit, zoom, fly into and flatten into a heatmap.

- Type: Block
- Page: https://uiarc.dev/components/blocks/activity-terrain
- Markdown: https://uiarc.dev/components/blocks/activity-terrain/markdown

- Access: Arc Pro
- Registry id: `activity-terrain`
- Source file: `registry/blocks/activity-terrain/activity-terrain.tsx`
- Keywords: react 3d heatmap, activity terrain, 3d bar chart canvas, hourly activity chart, week by hour heatmap, canvas data visualization

Use this on an analytics or operations page to show when a product is busiest. Replace the seeded week in terrain-data.ts with hourly counts from your events warehouse; the camera, springs and summaries follow the data.

## When to use

- Analytics or operations pages showing when a product is busiest across a week.
- Showcase dashboards where a 3D view of a 7 by 24 grid adds impact, with a flat heatmap fallback.

## When not to use

- Use activity-heatmap for a plain 2D grid that is easier to read.
- Use bar-chart for totals by day or hour.

## Installation

Activity terrain is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/activity-terrain
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ActivityTerrain } from "@/components/arc/blocks/activity-terrain/activity-terrain";

export default function UsagePatterns() {
  return (
    <section>
      <ActivityTerrain />
    </section>
  );
}
```

## API reference

### ActivityTerrain

A canvas 3D terrain of hourly activity across a week that can orbit, zoom, fly to a cell and flatten into a heatmap. Takes no props; metrics and the hourly grid are sample data in terrain-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Moves the highlighted day and hour. |
| Shift + Arrow keys | Orbits the camera. |
| Home / End | Jumps to the first or last hour of the day. |
| + / - | Zooms in or out. |
| Enter / Space | Flies to the highlighted hour. |
| Escape | Returns to the whole week, then clears the highlight. |

## Accessibility

- The stage is a focusable group with a keyboard hint, and the canvas has a text summary as its label.
- Peak hours are aria-pressed buttons that fly to or leave the hour.
- A polite live region reads the highlighted hour's value.

## Motion

- Columns rise in a wave on load and when the metric changes; camera moves use spring physics with momentum on drag.
- Flattening to a heatmap springs the camera to a top view.
- The engine watches prefers-reduced-motion and snaps the camera and heights with no wave.

## Responsive behavior

- Below an 880px container the stats move under the plot; below 560px the plot is 280px tall and the camera starts from a steeper angle.
- Touch devices swipe sideways to orbit while vertical swipes scroll the page, and the hint text switches for coarse pointers.
- Two-finger pinch zooms on touch.

## Performance

- Draws on a 2D canvas with devicePixelRatio capped at 2.
- The requestAnimationFrame loop pauses offscreen via IntersectionObserver and in hidden tabs, and idles when nothing moves.

## Notes for AI

- Use on an analytics or operations page to show when a product is busiest across a week.
- Replace METRICS in terrain-data.ts with hourly counts from your events warehouse; keep the 7 by 24 shape.

## Related

- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Revenue globe](https://uiarc.dev/components/blocks/revenue-globe/markdown): A dotted globe where live payments arc home to headquarters, with a replayable day.
- [Customer galaxy](https://uiarc.dev/components/blocks/customer-galaxy/markdown): 2,400 accounts as a drifting galaxy that spirals into clusters by plan, region or health.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
