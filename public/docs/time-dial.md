# Time dial

> Spin a dial to pick an hour and see which team cities are at work.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/time-dial
- Markdown: https://uiarc.dev/components/time-dial/markdown
- Source file: `registry/components/time-dial/time-dial.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, react time zone picker, world clock dial, meeting time planner, timezone converter ui, rotary time picker, time zone dial

## When to use

- Planning a moment across two to five cities, such as calls, releases, or handovers.
- Distributed teams that need to see at a glance who is inside working hours.

## When not to use

- Use time-picker for a single local time.
- Use date-picker or calendar when the day matters more than the hour.
- Use slider for a plain numeric range.

## Installation

Time dial is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/time-dial
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { TimeDial } from "@/components/arc/time-dial/time-dial";

const cities = [
  { id: "nyc", name: "New York", code: "NYC", offset: -240 },
  { id: "lon", name: "London", code: "LON", offset: 60 },
  { id: "tyo", name: "Tokyo", code: "TYO", offset: 540 },
];

export function CallPlanner() {
  const [time, setTime] = useState(15 * 60);
  return <TimeDial cities={cities} value={time} onValueChange={setTime} hourCycle={24} workingHours={[480, 1020]} label="Call time" />;
}
```

## API reference

### TimeDial

A 24 hour rotary dial for choosing a time across time zones. Every city rides the dial at its own local time, a shaded band marks working hours, and the home city reads out in the center.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `cities` (required) | `{ id: string; name: string; code: string; offset: number }[]` | – | Two to five cities. offset is minutes from UTC in steps of 15; code is two or three letters shown on the dial. |
| `value` | `number` | – | Controlled time in UTC minutes from midnight on the reference day. May leave 0 to 1439 to reach adjacent days. |
| `defaultValue` | `number` | `0` | Initial time when uncontrolled. |
| `onValueChange` | `(value: number) => void` | – | Fires with the destination as soon as the dial is released or stepped, before it comes to rest. |
| `homeId` | `string` | – | Controlled id of the city the dial reads in. Defaults to the first city. |
| `defaultHomeId` | `string` | – | Initial home city when uncontrolled. |
| `onHomeChange` | `(id: string) => void` | – | Called when a city is chosen from the list. |
| `min` | `number` | `-Infinity` | Earliest time in UTC minutes. The dial stretches past it and springs back. |
| `max` | `number` | `Infinity` | Latest time in UTC minutes. |
| `weekday` | `number` | `1` | Weekday of the reference day in UTC, 0 for Sunday. |
| `hourCycle` | `12 \| 24` | `12` | Clock for the readout: 12 reads 9:30 AM, 24 reads 09:30. |
| `workingHours` | `[start: number, end: number]` | `[540, 1080]` | Local working hours in minutes from midnight, drawn as a band on the dial. A city inside the band is at work. Defaults to 9:00 to 18:00. |
| `label` | `string` | `"Time"` | Accessible name of the dial. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow Right / Arrow Up | Step forward a quarter hour. |
| Arrow Left / Arrow Down | Step back a quarter hour. |
| Page Up / Page Down | Step an hour forward or back. |
| Home / End | Jump to the start or last quarter hour of the home city's day. |

## Accessibility

- The dial is a focusable role="slider" with aria-valuenow in home-city minutes and a spoken aria-valuetext.
- The city list uses buttons with aria-pressed for the home city.
- Changes are announced through a polite live region; the SVG face and readout are aria-hidden.

## Motion

- Drags have soft quarter-hour detents, flicks coast on a spring into the nearest quarter hour, and bounds rubber-band.
- Readout digits roll like an odometer, city marks swap between knob and dot as the home city changes, and the sun and moon turn over at the day/night boundary.
- Reduced motion removes flick coasting and replaces rises and blurs with plain fades.

## Responsive behavior

- The root is a container up to 720px; from 600px the dial and city list sit side by side, below that they stack.
- The dial is min(100%, 256px) with touch-action none, so dragging it on touch never scrolls the page.
- Below 360px of container width the city rows tighten.

## Performance

- The face is one SVG and rotation runs on motion values, so drags do not re-render city rows.
- Offsets are fixed per city; there is no time zone database, so pass DST-correct offsets yourself.

## Notes for AI

- Use to plan a moment across two to five offices (calls, releases, handovers). For a single local time use time-picker.
- Store the value in UTC minutes and convert per city yourself; offsets are fixed, so pass DST-correct offsets for the date in question.
- Set workingHours to the team's shared day so the band shows at a glance who would be at work, and hourCycle to match the locale.

## Related

- [Time picker](https://uiarc.dev/components/time-picker/markdown): Choose a time with sensible keyboard behavior.
- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Calendar](https://uiarc.dev/components/calendar/markdown): Browse dates in a clear, compact month view.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.

## Also in data

- [Booking pill](https://uiarc.dev/components/booking-pill/markdown): One pill that reshapes through party size, date, time, and a ticket.
- [Activity rings](https://uiarc.dev/components/activity-rings/markdown): Daily goals as tick rings that sweep, count up, and trace a second lap past 100%.
- [Date reel](https://uiarc.dev/components/date-reel/markdown): A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support.

## Guidance for AI tools

Time dial: Spin a dial to pick an hour and see which team cities are at work. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
