# Availability picker

> Find a meeting time across people and see the choice come together.

- Type: Block
- Page: https://uiarc.dev/components/blocks/availability-picker
- Markdown: https://uiarc.dev/components/blocks/availability-picker/markdown

- Access: Arc Pro
- Registry id: `availability-picker`
- Source file: `registry/blocks/availability-picker/availability-picker.tsx`
- Built from: Avatar, Button, Calendar, Motion
- Keywords: react availability picker, meeting time picker, group scheduling, calendly style picker, time slot picker, book a meeting ui

Use this to let people choose a time that fits a group. Connect confirmation to your scheduling service.

## When to use

- Picking a meeting time that works for several attendees.
- Booking flows that show a few days and open slots with a confirmation step.

## When not to use

- Use calendar or date-picker to pick a single date.
- Use time-picker for a free time input.
- Use event-invite to show and respond to an invite.

## Installation

Availability picker is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/availability-picker
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AvailabilityPicker } from "@/components/arc/blocks/availability-picker/availability-picker";

export function Schedule() {
  return (
    <AvailabilityPicker
      onConfirm={({ date, time }) => bookMeeting({ date, time })}
    />
  );
}
```

## API reference

### AvailabilityPicker

A day strip and time slot list for a group meeting, with attendee avatars and a confirmation step. Days, slots, and attendees are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onConfirm` | `(selection: { date: string; time: string }) => void` | – | Called with the chosen day label and time when confirmed. |

## Accessibility

- Days and times are labeled groups of buttons with aria-pressed.
- The selected day and the final selection are aria-live regions.

## Motion

- Time slots slide in from the direction of the day change.
- The selected slot highlight moves with a shared layoutId on a responsive spring.
- Reduced motion removes the horizontal offset and uses zero durations.

## Responsive behavior

- The five days sit in a fixed five-column grid and time slots in two columns at every width.
- Below 700px attendee names hide; below 490px day cards shrink and the heading icon and date header hide.

## Performance

- Slot lists swap with AnimatePresence on day change; there are no timers or observers.
- Load availability before render, since the block does no fetching.

## Notes for AI

- Use for picking a meeting time across several people.
- Replace the days, slots, and attendees with availability from your calendar service; times are labeled Zürich time.
- onConfirm receives display strings, so map them back to real timestamps.

## Related

- [Calendar](https://uiarc.dev/components/calendar/markdown): Browse dates in a clear, compact month view.
- [Time picker](https://uiarc.dev/components/time-picker/markdown): Choose a time with sensible keyboard behavior.
- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Booking pill](https://uiarc.dev/components/booking-pill/markdown): One pill that reshapes through party size, date, time, and a ticket.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
