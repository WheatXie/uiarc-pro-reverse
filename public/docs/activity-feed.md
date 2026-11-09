# Activity feed

> A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button, expandable details, and a mark all read sweep.

- Type: Block
- Page: https://uiarc.dev/components/blocks/activity-feed
- Markdown: https://uiarc.dev/components/blocks/activity-feed/markdown

- Access: Arc Pro
- Registry id: `activity-feed`
- Source file: `registry/blocks/activity-feed/activity-feed.tsx`
- Built from: Avatar, Animated counter, Button
- Keywords: activity feed, team activity, timeline, recent activity, mark all read, new updates, live feed, diff, filters, grouped by day

Use this for a workspace or project activity page. Load events from your activity API, stream new ones in through the items prop, and persist read state through onReadChange; new events in the preview are simulated.

## When to use

- A workspace or project activity page for a team product.
- A dashboard panel that shows what changed since someone last looked.

## When not to use

- Use audit-log for compliance history that needs search, export, and exact timestamps.
- Use notification-center for a personal inbox opened from a bell.
- Use changelog-feed for public release notes.

## Installation

Activity feed is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/activity-feed
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ActivityFeed } from "@/components/arc/blocks/activity-feed/activity-feed";

export function ProjectActivity({ events, live }: { events: Activity[]; live: Activity[] }) {
  return <ActivityFeed items={events} incoming={live} onRead={ids => markRead(ids)} />;
}
```

## API reference

### ActivityFeed

A team activity feed grouped by day on a quiet avatar timeline, with one type filter, expandable comments, diffs, deploy details, and photos, a new updates button that lands above the list, and a mark all read sweep.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `Activity[]` | `activities` | Events, newest first: id, type, actor, action, target, project, day offset, time, unread, and an optional detail. |
| `incoming` | `Activity[]` | `incomingActivities` | Events that arrive while the feed is open. They wait behind the new updates button. Pass [] to turn off the simulation. |
| `incomingInterval` | `number` | `6000` | Milliseconds between simulated arrivals. |
| `today` | `string` | `"2026-09-24"` | ISO date the day offsets count back from. |
| `defaultRange` | `"today" \| "week" \| "month"` | `"week"` | How far back the feed reaches. |
| `onRead` | `(ids: string[]) => void` | – | Called when events are marked read, one at a time or all at once. |
| `title` | `string` | `"Activity"` | Heading. |
| `className` | `string` | – | Class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the type filter, the new updates button, and each expandable event. |
| Enter / Space | Expands or collapses an event and marks it read. |
| Arrow keys | Move the type filter selection. |

## Accessibility

- Each day is a labeled section with a heading; events are an ordered list.
- Expandable events are buttons with aria-expanded and aria-controls.
- Unread state is spoken as part of the event and shown with a dot and a stronger name, not color alone.
- The type filter is a labeled group of toggle buttons with aria-pressed and arrow key navigation.
- A polite status region announces new updates shown and how many were marked read.

## Motion

- New events queue behind a button that opens its own row above the list, so no event is covered; showing them collapses that row and slides the new events in at the top.
- Mark all read sends a hairline down the list; each row lets go of its dot exactly as the line passes it.
- Changing the type filter crossfades the list, so rows never slide over each other.
- Details open with a height spring; the one line preview gives way to the full detail.
- Reduced motion removes the sweep delay and travel and keeps instant state changes.

## Responsive behavior

- Type filters scroll sideways on narrow screens.
- Below 440px the time moves into the meta line under each event.
- Day headings stick with a translucent material while their events scroll under them.

## Performance

- Filtering is memoized over the item list.
- The sweep uses CSS transition delays and one Web Animations API line, so it costs no React renders per row.
- Photos load through next/image at 96px.

## Notes for AI

- Map your events to action and target so each row reads as one sentence.
- Push websocket events into incoming; the new updates button counts them and merges them on click.
- Keep details short: a comment, a small diff, a deploy summary, or up to four photos.
- Persist read state through onRead.

## Related

- [Notification center](https://uiarc.dev/components/blocks/notification-center/markdown): A home for updates with read state, grouped information, and animated disclosure.
- [Changelog feed](https://uiarc.dev/components/blocks/changelog-feed/markdown): Release notes you can filter, open in place, and scroll through month by month.
- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.
- [Inbox triage](https://uiarc.dev/components/blocks/inbox-triage/markdown): Process a focused inbox with archive, snooze, and restore actions.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
