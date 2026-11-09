# Week calendar

> A week calendar where you drag to create, move, and resize events, with color coded calendars, day and agenda views, and swipes on phones.

- Type: Block
- Page: https://uiarc.dev/components/blocks/week-calendar
- Markdown: https://uiarc.dev/components/blocks/week-calendar/markdown

- Access: Arc Pro
- Registry id: `week-calendar`
- Source file: `registry/blocks/week-calendar/week-calendar.tsx`
- Built from: Motion
- Keywords: react week calendar, drag and drop calendar, google calendar clone, scheduler component, time blocking calendar, event scheduler, react calendar with time zones

Use this for scheduling and planning views. Pass your events and calendars, and persist changes in onCreate, onUpdate, and onDelete.

## When to use

- Scheduling and planning screens where people create, move and resize time blocks across a week.
- Team or personal calendars that need several color coded calendars, all day events and an agenda on phones.

## When not to use

- Use month-calendar for a month overview with events per day.
- Use calendar or date-picker to pick a date, and time-picker for a single time.
- Use availability-picker to collect open slots from someone.

## Installation

Week calendar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/week-calendar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { WeekCalendar, type CalendarEvent } from "@/components/arc/blocks/week-calendar/week-calendar";

const calendars = [
  { id: "work", name: "Work", color: "blue" },
  { id: "personal", name: "Personal", color: "green" },
];

export default function SchedulePage({ initial }: { initial: CalendarEvent[] }) {
  const [events, setEvents] = useState(initial);
  return (
    <WeekCalendar
      events={events}
      onEventsChange={setEvents}
      calendars={calendars}
      onCreate={event => api.create(event)}
      onUpdate={event => api.update(event)}
      onDelete={event => api.remove(event.id)}
      startHour={6}
      timeZone="America/Los_Angeles"
    />
  );
}
```

## API reference

### WeekCalendar

A week calendar at the level of a native app: week, work week and day views on wide screens, three days and an agenda list on phones, a mini month and calendar toggles in a sidebar when there is room, and an all day row that collapses when it fills up. Drag on empty time to draw an event and name it in a quick create popover, drag events between days and times, stretch the bottom edge to resize, and click an event to edit its title, day, time and calendar; everything snaps to 15 minutes. Events can be controlled or uncontrolled; without events it shows a realistic sample week.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `events` | `CalendarEvent[]` | – | Controlled events: { id, title, start: Date, end: Date, calendarId, allDay?, location?, attendees? }. Pair with onEventsChange. |
| `defaultEvents` | `CalendarEvent[]` | – | Starting events when uncontrolled. Without events or defaultEvents the calendar shows the sample week from week-calendar-data.ts. |
| `onEventsChange` | `(events: CalendarEvent[]) => void` | – | Called with the full list after every change: create, move, resize, edit, delete and undo. |
| `onCreate` | `(event: CalendarEvent) => void` | – | Called when someone saves a new event, and when an undo restores a deleted one. |
| `onUpdate` | `(event: CalendarEvent, previous: CalendarEvent) => void` | – | Called after a move, resize or edit in the details popover, with the event before the change. |
| `onDelete` | `(event: CalendarEvent) => void` | – | Called when an event is deleted. The undo toast calls onCreate if the person restores it. |
| `calendars` | `CalendarSource[]` | `SAMPLE_CALENDARS` | Calendars as { id, name, color, hidden? }. color is blue, green, violet, amber, rose, teal or any CSS color; built in names are tuned for light and dark. |
| `defaultDate` | `Date` | – | The day to open on. Defaults to today, or to the sample week when showing sample events. |
| `defaultView` | `"week" \| "workweek" \| "day" \| "3day" \| "agenda"` | `"week"` | Starting view. Below a 640px container week views show three days, and agenda is offered instead of work week. |
| `onViewChange` | `(view: CalendarView) => void` | – | Called when the view changes. |
| `weekStartsOn` | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6` | `1` | First day of the week; 0 is Sunday. |
| `startHour` | `number` | `0` | First hour shown in the day grid. |
| `endHour` | `number` | `24` | Hour the day grid ends at. |
| `timeZone` | `string` | – | IANA zone the grid runs in, such as "America/New_York". Times are converted and formatted with Intl. Defaults to the browser's zone. |
| `locale` | `string` | `"en-US"` | Locale for dates and times. |
| `className` | `string` | – | Class for the root element. Set --calendar-height on it to change the height of the scrolling grid. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | Moves between days; past the edge of the range, the next week or days slide in. |
| T | Goes to today. |
| N | Drafts a new event at the next free hour of the focused day and opens the quick create form. |
| Enter | Saves the quick create form, opens a focused event, or drafts an event on a focused day. |
| Delete / Backspace | Deletes the focused or selected event, with an undo toast. |
| Escape | Closes a popover, cancels a drag, or clears the selection. |
| D / W | Switches to the day or week view. |
| Arrow up / Arrow down | On an event, moves focus to the previous or next event. |
| Alt + Arrow keys | Moves the focused event by a day or 15 minutes; add Shift with up and down to change its length. |
| Cmd / Ctrl + Z | Undoes the last move, resize, time change or delete. |

## Accessibility

- Each range is a role="grid" labelled with its dates and described by screen reader instructions; every day is a labelled grid cell with its date and event count, and keyboard focus moves between them with the arrow keys.
- Events are buttons whose labels read the title, full date, start and end time, calendar and location; all day events and agenda rows follow the same pattern.
- The quick create form and event details are labelled dialogs that take focus, close on Escape or a press outside, and return focus to the event.
- A polite live region announces range changes, creates, moves, resizes, deletes and undos. Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Focus shows the same fill as hover.

## Motion

- Ranges slide in the direction of travel on a spring without overshoot, the header and all day row move with the grid, and a swipe on touch drags the neighbors along so letting go continues without a seam.
- Events animate to new positions with transforms only: a dragged event hops between 15 minute slots, and neighbors settle into their new columns after a drop or an edit.
- Popovers scale in from the edge that faces their event; the undo toast rises from the bottom.
- Reduced motion replaces slides and position springs with instant moves and short fades.

## Responsive behavior

- From a 1100px container a sidebar adds a mini month and calendar toggles; narrower, the toggles move into a Calendars popover.
- Between 640px and 900px the gutter and dates tighten and event blocks drop details that no longer fit, using container queries on each event.
- Below 640px the week becomes three days with Day and Agenda views, horizontal swipes change days, and a long press starts creating or moving so vertical swipes still scroll.
- The grid scrolls inside a height of clamp(480px, 72vh, 760px); set --calendar-height on the root to change it.

## Performance

- Event blocks are memoized on primitive props, so a drag re-renders only the event that moves; position changes animate with transforms, never layout.
- Time zone conversion runs once per events change; the now line updates on each minute boundary.
- All events are plain DOM; for thousands of events per week, pass only the visible range.

## Notes for AI

- Use for scheduling and planning screens where people create and rearrange time blocks; pass events and persist in onCreate, onUpdate and onDelete.
- Event times are Date instants. The grid shows them in timeZone (or the browser's zone), so store UTC and let the calendar format them.
- Map your calendars to calendars with a color each; hidden calendars start toggled off in the calendar list.
- sampleEvents() and SAMPLE_CALENDARS in week-calendar-data.ts are demo content to remove.

## Related

- [Calendar](https://uiarc.dev/components/calendar/markdown): Browse dates in a clear, compact month view.
- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Time picker](https://uiarc.dev/components/time-picker/markdown): Choose a time with sensible keyboard behavior.
- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.
- [Availability picker](https://uiarc.dev/components/blocks/availability-picker/markdown): Find a meeting time across people and see the choice come together.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
