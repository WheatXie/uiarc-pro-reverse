# Activity rings

> Daily goals as tick rings that sweep, count up, and trace a second lap past 100%.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/activity-rings
- Markdown: https://uiarc.dev/components/activity-rings/markdown
- Source file: `registry/components/activity-rings/activity-rings.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, activity, rings, react activity rings, apple watch rings, fitness rings, goal progress rings, concentric progress, habit tracker rings

## When to use

- Daily goals that fill up and can be exceeded, like move, exercise, and stand.
- Fitness or habit dashboards with a week picker to compare days.

## When not to use

- Use progress or gauge for a single value.
- Use usage-meter for quotas and limits.
- Use activity-heatmap for streaks across many weeks.

## Installation

Activity rings is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/activity-rings
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ActivityRings } from "@/components/arc/activity-rings/activity-rings";

export function Today() {
  return (
    <ActivityRings
      metrics={[
        { id: "move", label: "Move", unit: "kcal", goal: 500 },
        { id: "exercise", label: "Exercise", unit: "min", goal: 30 },
        { id: "stand", label: "Stand", unit: "hr", goal: 12 },
      ]}
      days={week}
      onRingClose={(metric, day) => celebrate(metric, day)}
    />
  );
}
```

## API reference

### ActivityRings

Daily goals drawn as concentric tick rings. Arcs sweep to each day's value, a second lap traces the inside edge past 100%, and numbers count to their new amounts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `metrics` (required) | `{ id: string; label: string; unit: string; goal: number; color?: string }[]` | – | One ring per metric, from the outside in. color falls back to the built in indigo, amber, and sage. |
| `days` (required) | `{ id: string; label: string; short: string; values: Record<string, number> }[]` | – | Days with values keyed by metric id. label is the full date for assistive technology; short is shown under the day. |
| `day` | `string` | – | Controlled selected day id. |
| `defaultDay` | `string` | – | Initial day when uncontrolled. Defaults to the last day. |
| `onDayChange` | `(day: string) => void` | – | Called when a day is picked. |
| `focused` | `string \| null` | – | Controlled isolated metric id. |
| `defaultFocused` | `string \| null` | `null` | Initial isolated metric when uncontrolled. |
| `onFocusedChange` | `(metric: string \| null) => void` | – | Called when a goal is selected or cleared from the legend. |
| `onRingClose` | `(metric: string, day: string) => void` | – | Called when a value on the same day crosses its goal. |
| `label` | `string` | `"Activity"` | Accessible name of the section. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | In the week picker, pick the previous or next day. |
| Home / End | In the week picker, pick the first or last day. |
| Enter / Space | On a legend row, isolates that goal or clears it. |

## Accessibility

- The rings are an img whose label lists each goal's percent for the day.
- Legend rows are toggle buttons with aria-pressed and a spoken summary such as "Move, 420 of 500 kcal, 84 percent".
- The week picker is a radiogroup with a roving tabindex, named by each day's full label.

## Motion

- Every change sweeps from what is on screen to the new values, so a quick second change redirects mid flight; past 100% a second lap traces the inside edge.
- Hovering or selecting a goal dims the others, and numbers count to their new amounts.
- MotionConfig follows the user's reduced motion setting, and values jump without the sweep.

## Responsive behavior

- The root is a container up to 38rem; from 30rem wide the legend moves beside the rings as a list.
- Narrower containers stack the rings above a compact legend.

## Performance

- The rings are SVG arcs driven by motion values, with no animation loop between changes.
- Each metric adds one ring; three to four stay legible within the fixed 220 unit viewBox.

## Notes for AI

- Choose it for daily goals that fill up and can be exceeded. Use progress or gauge for a single value and usage-meter for quotas.
- Keep metric ids stable and use them as keys in each day's values. Control day when another view drives the date.

## Related

- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.
- [Gauge](https://uiarc.dev/components/gauge/markdown): Show a value against a known range.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Activity heatmap](https://uiarc.dev/components/activity-heatmap/markdown): See a year of activity at a glance, one square per day.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.

## Also in data

- [Booking pill](https://uiarc.dev/components/booking-pill/markdown): One pill that reshapes through party size, date, time, and a ticket.
- [Time dial](https://uiarc.dev/components/time-dial/markdown): Spin a dial to pick an hour and see which team cities are at work.
- [Date reel](https://uiarc.dev/components/date-reel/markdown): A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support.

## Guidance for AI tools

Activity rings: Daily goals as tick rings that sweep, count up, and trace a second lap past 100%. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
