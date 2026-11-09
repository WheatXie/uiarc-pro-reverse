# Date reel

> A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/date-reel
- Markdown: https://uiarc.dev/components/date-reel/markdown
- Source file: `registry/components/date-reel/date-reel.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, input, date, gesture, new, date picker, time picker, wheel picker, reel, drum picker, ios picker, scroll picker, momentum, snap, schedule send, reminder, birthday, 3d

## When to use

- Scheduling a send, reminder or post where a phone-style wheel is familiar and faster than a calendar grid.
- Touch-first flows and mobile web, where flicking a reel beats typing a date.
- Birthdays and other dates far from today, using date mode with its month, day and year reels.

## When not to use

- Use date-picker or date-range-picker when people need to see a whole month or pick a range.
- Use time-picker for a compact field inside a dense form.
- Use time-dial to compare times across cities.

## Installation

Date reel is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/date-reel
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DateReel } from "@/components/arc/date-reel/date-reel";

export function SendLater({ onSchedule }: { onSchedule: (at: Date) => Promise<void> }) {
  return (
    <DateReel
      title="Send later"
      today={new Date(2026, 8, 24)}
      defaultValue={new Date(2026, 8, 25, 9, 0)}
      onConfirm={onSchedule}
    />
  );
}
```

## API reference

### DateReel

A 3D reel date and time picker, like the wheels on a phone. Each column is a curved drum laid on a real cylinder: flick it and it keeps your momentum, glides and snaps into a glass lens, and a drag past the first or last entry stretches like rubber. A summary above reads the moment back in words as the reels turn ("Tomorrow at 9:00 AM"), quick picks spin every reel to a preset, and an optional confirm button settles in place.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `"datetime" \| "date" \| "time"` | `"datetime"` | Which reels to show: day, hour, minute and AM or PM; month, day and year; or time only. |
| `value` | `Date` | – | Controlled value. When it changes from outside, every reel spins to it along the short way around. |
| `defaultValue` | `Date` | `Sep 24, 2026 9:30 AM` | Starting value when uncontrolled. Pass a fixed date so the first render matches on server and client. |
| `onChange` | `(value: Date) => void` | – | Called once when the reels come to rest on a new moment, not on every frame. |
| `today` | `Date` | `Day of the first value` | Start of today, used for the Today entry and relative words such as Tomorrow or In 12 days. Pass new Date() after mount in an app. |
| `minDate` | `Date` | `30 days before today (100 years in date mode)` | Earliest selectable day. The day and year reels stop here with a rubber band. |
| `maxDate` | `Date` | `A year after today (10 years in date mode)` | Latest selectable day. |
| `minuteStep` | `1 \| 5 \| 10 \| 15 \| 30` | `5` | Minutes between entries on the minute reel. |
| `hourCycle` | `12 \| 24` | `12` | 12 hour clock with an AM or PM reel, or a 24 hour clock. |
| `locale` | `string` | `"en-US"` | BCP 47 locale for day and month names, the time format, the AM and PM words and relative phrases. |
| `presets` | `{ label: string; value: Date \| ((today: Date) => Date) }[] \| false` | `This evening, Tomorrow, Monday` | Quick picks under the reels. Choosing one spins every reel to it with a small stagger. The chip that matches the current value is marked pressed. false hides them. |
| `title` | `string` | – | Optional heading above the summary, such as "Send later". |
| `onConfirm` | `(value: Date) => void \| Promise<void>` | – | Adds a primary button. Return a promise to show pending, success and failure in place without changing its width. |
| `labels` | `DateReelLabels` | – | Words for localization: reel names (day, month, date, year, hour, minute, period), the at joiner, the quick picks group name and the confirm button states. |
| `intro` | `boolean` | `true` | Spins the reels into place, one after another, the first time the picker scrolls into view. |
| `speed` | `number` | `1` | Multiplies the speed of glides, snaps and the intro. |
| `paused` | `boolean` | `false` | Stops automatic motion. Reels still follow a drag and land on the nearest entry at once. |
| `accent` | `string` | – | Any CSS color for the active reel in the lens and the chosen quick pick. Defaults to the theme accent. |
| `label` | `string` | `"Date and time"` | Accessible name of the picker group. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves between reels, the quick picks and the confirm button. |
| Arrow up / Arrow down | Turns the focused reel one entry. |
| Page up / Page down | Turns by a larger step: a week of days, 3 or 6 hours, 15 minutes, 10 years. |
| Home / End | Jumps to the first or last entry of the reel. |
| Arrow left / Arrow right | Moves focus to the neighbouring reel. |
| Type a number or letters | Jumps to the matching entry, such as 4 for 4 o'clock, 45 for :45, p for PM or ma for March. |

## Accessibility

- The picker is a named group; each reel is a role="spinbutton" with its own name (Day, Hour, Minute, AM or PM) and aria-valuetext that reads the entry, such as "Fri, Sep 25".
- A polite live region announces the full moment once the reels come to rest after a change, and again when the confirm button succeeds or fails.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The focused reel shows its entry in the accent color inside the lens, and quick picks use aria-pressed.
- Dates that do not exist, such as February 30, are dimmed on the reel and the day reel turns back to the last real day by itself.
- Drawn entries and the visual summary are hidden from assistive technology so a moving reel never floods the reader.

## Motion

- One requestAnimationFrame loop runs only while a reel moves and writes transforms, opacity and text straight to recycled DOM nodes; React re-renders only when a value is committed.
- Each reel is projected onto a cylinder: entries rise on a sine curve, compress with the cosine of their angle and fade toward the edges, and a second copy clipped to the lens shows the crisp selected text.
- A flick keeps its measured velocity on an exponential glide that is solved to land exactly on an entry, then hands the last half row to a critically damped spring; drags past the ends stretch like rubber and bounce back.
- Keyboard steps, taps, wheel scrolling and quick picks all spin on the same spring, so pressing again mid-spin adds to the motion instead of restarting it.
- The loop stops when the picker leaves the viewport or the tab is hidden and resumes where it left off. With reduced motion every change lands at once and there is no intro.

## Responsive behavior

- A container query sets the row height and type size, so the reels fit a 320px phone and read larger on desktop without changing proportions.
- Reels size to their widest entry and sit centered under one lens that spans the full width.
- Below about 480px the confirm button moves under the quick picks at full width and 44px tall.
- Reels use touch-action pan-x, so a vertical swipe turns the reel and does not scroll the page.

## Performance

- Eleven recycled nodes per reel (twice, for the lens), regardless of how many days or years the range holds.
- Text is written only when a node shows a new entry; the loop sleeps when every reel is at rest.
- Wheel scrolling is attached as a non-passive listener only on the reels.

## Notes for AI

- Use it where choosing a moment is the task: schedule send, reminders, booking a slot, a birthday on sign up.
- Pass today and defaultValue as fixed dates for server rendering, then update today after mount if you need the real clock.
- onChange fires when the reels rest, so it is safe to save or validate there. For a confirm flow return the promise from onConfirm.

## Related

- [Time picker](https://uiarc.dev/components/time-picker/markdown): Choose a time with sensible keyboard behavior.
- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Time dial](https://uiarc.dev/components/time-dial/markdown): Spin a dial to pick an hour and see which team cities are at work.

## Also in data

- [Booking pill](https://uiarc.dev/components/booking-pill/markdown): One pill that reshapes through party size, date, time, and a ticket.
- [Activity rings](https://uiarc.dev/components/activity-rings/markdown): Daily goals as tick rings that sweep, count up, and trace a second lap past 100%.

## Guidance for AI tools

Date reel: A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
