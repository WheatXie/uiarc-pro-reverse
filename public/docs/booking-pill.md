# Booking pill

> One pill that reshapes through party size, date, time, and a ticket.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/booking-pill
- Markdown: https://uiarc.dev/components/booking-pill/markdown
- Source file: `registry/components/booking-pill/booking-pill.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, react booking widget, table reservation, restaurant booking ui, date and time picker flow, reservation pill, booking flow

## When to use

- Venue or service pages where booking a table or slot is the one action people came for.
- Mobile-first flows that walk through party size, date, time, and confirm in one surface.

## When not to use

- Use date-picker and time-picker inside a regular form for multi-field checkouts.
- Use stepper or multi-step-form for longer flows with many fields.
- Use calendar when people need to see a whole month.

## Installation

Booking pill is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/booking-pill
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { BookingPill, type Booking } from "@/components/arc/booking-pill/booking-pill";

export function ReserveBar({ today, book }: { today: string; book: (booking: Booking) => Promise<void> }) {
  return (
    <BookingPill
      venue="Osteria Nove"
      venueDetail="12 Harbour Street"
      startDate={today}
      hourCycle={24}
      isAvailable={(date, time, party) => !(party > 6 && time > "20:00")}
      onConfirm={book}
    />
  );
}
```

## API reference

### BookingPill

One floating pill that reshapes itself through a booking flow: party size, a draggable date strip, a time grid, a ticket to confirm, and a booked state.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `venue` (required) | `string` | – | Venue name printed on the ticket. |
| `venueDetail` | `string` | – | Second ticket line, such as the address. |
| `startDate` (required) | `string` | – | First day on the strip as an ISO date. Pass it from data so server and client agree. |
| `days` | `number` | `21` | Days on the strip. |
| `times` | `string[]` | `["17:00", "17:30", … "22:30"]` | Seating times as "HH:MM", in order, shown four to a row. The default runs every half hour from 17:00 to 22:30. |
| `isAvailable` | `(date: string, time: string, partySize: number) => boolean` | – | Whether a time is free. Everything is free by default. |
| `preferredTime` | `string` | `"19:30"` | Preselected when free, otherwise the nearest free time, as "HH:MM". |
| `minPartySize` | `number` | `1` | Smallest party. |
| `maxPartySize` | `number` | `12` | Largest party. |
| `defaultPartySize` | `number` | `2` | Starting party size. |
| `onConfirm` | `(booking: { date: string; time: string; partySize: number }) => Promise<void> \| void` | – | Books the table. Resolve to show the booked state, reject to keep the ticket open with an error. Defaults to a short simulated wait. |
| `onStepChange` | `(step: "start" \| "party" \| "date" \| "time" \| "review" \| "booked") => void` | – | Called on every step, for example to let the page recede while the pill is open. |
| `hourCycle` | `12 \| 24` | `12` | Clock used for displayed times, such as 7:30 PM or 19:30. times, preferredTime, and onConfirm always use "HH:MM". |
| `label` | `string` | `"Book a table"` | Label of the closed pill. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move a day on the date strip, or between free times in the grid. |
| Page Up / Page Down | Move a week on the date strip. |
| Home / End | First or last day, or first or last free time. |
| Enter | Confirm the date on the strip and continue. |
| Escape | Go back one step. |

## Accessibility

- The date strip is a role="slider" with a spoken aria-valuetext; times are a role="radiogroup" with unavailable times marked aria-disabled.
- Every round icon button has an aria-label (Back, Fewer guests, Next, choose a date).
- Step changes are announced in a polite live region, and booking errors use role="alert".

## Motion

- The pill's shape springs to fit each step while content slides in a beat later in the direction of travel.
- The date strip follows drags 1:1, rubber-bands at the ends, and flicks glide to a day; party count digits roll.
- Reduced motion jumps the strip, drops slides and blurs, and swaps faces with fades.

## Responsive behavior

- The root is a container; each step's face is capped at the container width minus 24px, up to 340 to 420px.
- The date strip drags horizontally with touch-action pan-y, so vertical page scroll still works on touch.

## Performance

- The pill uses a 24px backdrop blur; the date strip renders every day in days, 21 by default.
- ResizeObservers track each face for the shape spring, and only the current step is mounted.

## Notes for AI

- Use on a venue or service page where booking is the one action people came for. Use date-picker and time-picker in a regular form for multi-field checkouts.
- Anchor it to the bottom of its container, pass startDate from the server, and wire isAvailable and onConfirm to your backend. Set hourCycle for display only; data stays in "HH:MM".

## Related

- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Time picker](https://uiarc.dev/components/time-picker/markdown): Choose a time with sensible keyboard behavior.
- [Calendar](https://uiarc.dev/components/calendar/markdown): Browse dates in a clear, compact month view.
- [Number field](https://uiarc.dev/components/number-field/markdown): Enter a bounded number with clear increment controls.
- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.

## Also in data

- [Activity rings](https://uiarc.dev/components/activity-rings/markdown): Daily goals as tick rings that sweep, count up, and trace a second lap past 100%.
- [Time dial](https://uiarc.dev/components/time-dial/markdown): Spin a dial to pick an hour and see which team cities are at work.
- [Date reel](https://uiarc.dev/components/date-reel/markdown): A 3D wheel date and time picker (like iOS reels) with momentum scrolling, snapping, curved perspective, and full keyboard support.

## Guidance for AI tools

Booking pill: One pill that reshapes through party size, date, time, and a ticket. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
