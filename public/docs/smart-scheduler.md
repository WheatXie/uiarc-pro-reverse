# Smart scheduler

> A scheduling card where one sentence like "Find 30 min with Maya and Leo next week, mornings" is read into chips. The three best slots are then ranked across everyone's Google Calendar and Outlook calendars, with an availability strip per person and conflicts called out. Picking a slot opens a draft invite with a Google Meet link, ready to send.

- Type: Block
- Page: https://uiarc.dev/components/blocks/smart-scheduler
- Markdown: https://uiarc.dev/components/blocks/smart-scheduler/markdown

- Access: Arc Pro
- Registry id: `smart-scheduler`
- Source file: `registry/blocks/smart-scheduler/smart-scheduler.tsx`
- Built from: Button, CopyButton, TextShimmer
- Keywords: ai scheduling, natural language scheduling, find a time, meeting scheduler, availability, free busy, calendar assistant, google calendar, outlook, google meet, invite, booking

Drop it into a CRM, recruiting tool or team app as the "find a time" step. Pass `parse` for your LLM call (structured output: duration, people, range, window) and keep `findSlots` deterministic on your server (Google freeBusy or Microsoft Graph getSchedule). Each slot returns every attendee's busy blocks for that day so the strips can draw them. `onSend` creates the event (reject to show a retry), and `onPick` plus `meetLink` let you create a real Meet link before sending. With no props it plays a simulated run on a loop until someone clicks or types in the card. The sample parser and slot finder (`parseScheduleRequest`, `findScheduleSlots`) are exported as a reference.

## When to use

- A scheduling assistant inside a CRM, recruiting tool, or team app that books internal meetings from one sentence.
- Showing why a time was suggested: who is free, what conflicts, and what is tentative.
- An AI feature demo where the result has to be checkable at a glance before anything is sent.

## When not to use

- Public booking pages where guests pick from your open times; use availability-picker or booking-pill.
- Browsing or editing a full calendar; use week-calendar or month-calendar.
- Picking a single date or time without other people involved; use date-picker or time-picker.

## Installation

Smart scheduler is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/smart-scheduler
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SmartScheduler } from "@/components/arc/blocks/smart-scheduler/smart-scheduler";

export function ScheduleCard({ me }) {
  return (
    <SmartScheduler
      organizer={me}
      defaultQuery=""
      timeZone="ET"
      parse={(query, signal) =>
        fetch("/api/schedule/parse", { method: "POST", body: JSON.stringify({ query }), signal }).then(async (res) => {
          if (!res.ok) throw new Error((await res.json()).message ?? "Couldn't read that request.");
          return res.json();
        })}
      findSlots={(request, signal) =>
        fetch("/api/schedule/slots", { method: "POST", body: JSON.stringify(request), signal }).then((res) => res.json())}
      onSend={(invite, signal) =>
        fetch("/api/schedule/invite", { method: "POST", body: JSON.stringify(invite), signal }).then((res) => {
          if (!res.ok) throw new Error("Not sent");
        })}
    />
  );
}
```

## API reference

### SmartScheduler

Natural language scheduling in one card. A request such as "Find 30 min with Maya and Leo next week, mornings" is read into chips (duration, people with their avatars, range, time of day), then the three best slots are ranked across everyone's calendars. Above the list, one availability strip per person (with a Google Calendar or Outlook mark) draws that day's busy blocks, and an outlined column marks the slot under the pointer, sliding as you move between suggestions. Conflicts are called out with a warning icon and a short reason ("Leo's Arch office hours is tentative") and tint the block they overlap. Picking a slot opens a draft invite in the same space: an editable title, the time, a Google Meet link with a copy button, the guests, and Send invite, which turns into Sent. With no props it plays a simulated run on a loop until someone interacts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultQuery` | `string` | `"Find 30 min with Maya and Leo next week, mornings"` | The request in the field on first render. |
| `placeholder` | `string` | `"Find 30 min with Maya next week"` | Placeholder for the empty field. |
| `organizer` | `SchedulerPerson` | `Sofia Ramirez (sample)` | The person sending the invite: { id, name, avatar?, email?, calendar?: "google" \| "outlook" }. Shown as "You" in the strips. |
| `directory` | `SchedulerPerson[]` | `sample directory` | People the built in parser can match by first name. Ignored when you pass parse. |
| `parse` | `(query: string, signal: AbortSignal) => Promise<ScheduleRequest>` | – | Turns the request into { duration (min), people, range: { label, detail, days: { id, label }[] }, window: { id, label, start, end } } (minutes from midnight). Wire your LLM call with structured output here. Throw an Error with a short message to show it in the card. A new request aborts the signal. |
| `findSlots` | `(request: ScheduleRequest, signal: AbortSignal) => Promise<SlotSuggestion[]>` | – | Returns ranked slots, best first; the first three are shown. Each is { id, day, start, end, reason, conflicts: { personId, title, tentative? }[], busy: Record<personId, BusyBlock[]> }. busy feeds the strips. An empty array shows the no time works state. |
| `onSend` | `(invite: InviteDraft, signal: AbortSignal) => Promise<void>` | – | Sends { title, slot, organizer, people, meetLink, timeZone }. Reject to show Couldn't send with the button ready to retry. Without it the send is simulated and the card says nothing was sent. |
| `onPick` | `(slot: SlotSuggestion) => void` | – | Called when a slot is picked and the draft opens. |
| `meetLink` | `string` | `"meet.google.com/kfq-rvwp-zte"` | Video link on the draft. Create a real one in onPick (Google Calendar conferenceData) and pass it back. |
| `timeZone` | `string` | `"ET"` | Short time zone label shown beside the window and the invite time. |
| `autoPlay` | `boolean` | `true without parse, findSlots and onSend` | Plays read, preview, pick and send on a loop. Stops for good on the first click or key press in the card, pauses off screen, and is off under reduced motion. |
| `className` | `string` | – | Class on the root element. |

### BusyBlock

One event on an attendee's day, as drawn in the strips.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `start` (required) | `number` | – | Minutes from midnight. |
| `end` (required) | `number` | – | Minutes from midnight. |
| `title` (required) | `string` | – | Event title, used in the block's tooltip, the strip's label and conflict reasons. |
| `tentative` | `boolean` | – | Drawn with a dashed outline and treated as a soft conflict. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the field, reads the request and finds times. |
| Tab | Moves from the field to Find times, then to the suggested slots, or through the draft's title, copy link, Back and Send invite. |
| Arrow up / Arrow down | Moves between the suggested slots; focusing a slot previews it in the strips. |
| Enter / Space | On a slot, opens the draft invite. |
| Escape | In the draft, goes back to the suggestions. |

## Accessibility

- The field is a labeled search form, the chips are a list named What was understood, and the slots are a list of buttons whose text carries the day, the time and the reason.
- Each strip is an image with a label listing that person's events in the window, with tentative ones marked, or free.
- Conflicts are never color alone: a warning icon plus a reason in words, and a dashed outline for tentative events.
- Reading, the parsed request, the number of times found, the draft and the send result are announced in a polite status region; the demo says nothing was sent.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Chips fade in from 2px, 40ms apart. Reading and checking calendars show a short shimmer on the label.
- The slot highlight and the strip column slide together on a critically damped spring (0.24s, no bounce) as the pointer or focus moves; busy blocks crossfade when the day changes.
- Suggestions, states and the draft share one fixed height and swap with a single crossfade (out 100ms, in 160ms), so the card never changes size. Send invite turns into Sent through the button's own label crossfade.
- The demo loop pauses off screen. Reduced motion drops the loop and the travel and opens on the ranked times.

## Responsive behavior

- Holds from 360px to 600px. Below about 460px the button keeps only its icon, chip details hide and the name column narrows; below 400px the people chip shows avatars only.
- Long names, reasons and links truncate with an ellipsis; nothing wraps, so rows keep their height.

## Performance

- Pure React and CSS with motion for the highlight, column and crossfades. No canvas, no timers beyond the demo script, and the loop stops off screen.
- Strips render only the blocks inside the time window.

## Notes for AI

- Use parse for the LLM step (structured output with duration, people ids, range, window) and keep findSlots deterministic: query free/busy (Google Calendar freeBusy, Microsoft Graph getSchedule) and score slots server side.
- Return busy blocks for every attendee on each slot's day so the strips can draw them; titles can be "Busy" when you only have free/busy access.
- The built in parseScheduleRequest and findScheduleSlots are exported and work on the sample calendars; they are a reference, not a production parser.

## Related

- [Availability picker](https://uiarc.dev/components/blocks/availability-picker/markdown): Find a meeting time across people and see the choice come together.
- [Week calendar](https://uiarc.dev/components/blocks/week-calendar/markdown): A week calendar where you drag to create, move, and resize events, with color coded calendars, day and agenda views, and swipes on phones.
- [Booking pill](https://uiarc.dev/components/booking-pill/markdown): One pill that reshapes through party size, date, time, and a ticket.
- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.
- [Smart form fill](https://uiarc.dev/components/smart-form-fill/markdown): A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.
- [Date range picker](https://uiarc.dev/components/date-range-picker/markdown): A range picker that grows from its trigger into two months with presets and a stretching range highlight.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
