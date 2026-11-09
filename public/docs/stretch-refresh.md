# Stretch refresh

> Pull a feed down and a line stretches to tell you when to let go.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/stretch-refresh
- Markdown: https://uiarc.dev/components/stretch-refresh/markdown
- Source file: `registry/components/stretch-refresh/stretch-refresh.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, react pull to refresh, pull to refresh, refresh feed, rubber band refresh, mobile pull down refresh, feed refresh animation

## When to use

- Timelines, inboxes, and activity feeds where new entries arrive at the top.
- Panels that should support pull to refresh by touch, mouse drag, and trackpad scroll.

## When not to use

- Use a plain list for static content that never refreshes.
- Use pagination for paging through older items.
- Use timeline for a static history of events.

## Installation

Stretch refresh is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/stretch-refresh
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { StretchRefresh } from "@/components/arc/stretch-refresh/stretch-refresh";

export function Inbox() {
  const [messages, setMessages] = useState(initial);
  return (
    <StretchRefresh
      title="Inbox"
      items={messages}
      getKey={m => m.id}
      renderItem={m => <MessageRow message={m} />}
      onRefresh={async () => {
        const fresh = await fetchNew();
        setMessages(prev => [...fresh, ...prev]);
        return `${fresh.length} new messages`;
      }}
    />
  );
}
```

## Examples

### Fill the height of a sidebar

```tsx
<aside style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
  <StretchRefresh
    title="Activity"
    items={events}
    getKey={e => e.id}
    renderItem={e => <EventRow event={e} />}
    onRefresh={reload}
    className="grow"
  />
</aside>
```

## API reference

### StretchRefresh

A feed that refreshes when pulled down past its top edge. The sheet rubber-bands while rows spread apart, a line in the gap stretches to show when to let go, then runs while the work happens.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` (required) | `string` | – | Heading above the feed. |
| `subtitle` | `string` | – | Short status under the heading, such as "Updated 14 min ago". A change rises in. |
| `items` (required) | `readonly T[]` | – | Rows in the feed. |
| `getKey` (required) | `(item: T) => string` | – | Stable key for each row. |
| `renderItem` (required) | `(item: T) => ReactNode` | – | Renders one row. |
| `onRefresh` (required) | `() => Promise<string \| void>` | – | Runs after a pull past the threshold or a press of the refresh button. Update items before it resolves; resolve with a short result such as "3 new updates". |
| `threshold` | `number` | `72` | Pull distance in px, after resistance, that arms a refresh. |
| `doneLabel` | `string` | `"Up to date"` | Result shown when onRefresh resolves without one. |
| `errorLabel` | `string` | `"Couldn’t refresh"` | Result shown when onRefresh rejects. |
| `refreshLabel` | `string` | `"Refresh"` | Accessible name of the refresh button. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | On the refresh button, runs a refresh without pulling. |

## Accessibility

- A refresh button gives keyboard and switch users the same path as the pull gesture, with aria-disabled while busy.
- The feed is a labelled, focusable region and the list sets aria-busy while refreshing.
- "Refreshing" and the result are announced in a polite status region.

## Motion

- The sheet rubber-bands with growing resistance while rows spread apart; scrolling up again at the top also pulls.
- A line in the gap reaches full length exactly at the threshold, runs while refreshing, then gives way to the result as new rows settle in from the top.
- Reduced motion keeps the same states and only fades.

## Responsive behavior

- The root is a flex column with min-height 0, so give it a sized parent; the feed scrolls inside it.
- Touch pulls use native listeners and only take over once the feed is at the top, so normal scrolling is untouched.

## Performance

- Rows are not virtualized and use layout position animation; keep the feed to what one panel shows plus a page or so.
- Wheel and touchmove listeners are non-passive so the pull can prevent scrolling, but they return early unless pulling.

## Notes for AI

- Choose it for timelines, inboxes, and activity feeds where new entries arrive at the top. For static lists use a plain list, and for paging use pagination.
- Update items inside onRefresh before it resolves, and keep the call at least half a second so the running line reads as work.

## Related

- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.
- [Skeleton](https://uiarc.dev/components/skeleton/markdown): Reserve space while content is still loading.
- [Toast](https://uiarc.dev/components/toast/markdown): Brief confirmation for a completed background action.
- [Reorderable list](https://uiarc.dev/components/reorderable-list/markdown): Organize items with direct drag and drop.

## Also in loaders

- [Morph loader](https://uiarc.dev/components/morph-loader/markdown): Tiny loaders that morph between shapes and fold into a check or a cross when done.
- [Skeleton morph](https://uiarc.dev/components/skeleton-morph/markdown): Loading skeletons that grow into the real content, block by block, instead of swapping.
- [Black hole](https://uiarc.dev/components/black-hole/markdown): A delete transition that pulls the chosen items into a tiny singularity while the rest of the list bends around it; undo spins them back out.
- [Charge session](https://uiarc.dev/components/charge-session/markdown): An EV or device charging card. Energy packets flow from a charger along the cable into the battery pack, which fills toward a draggable charge limit. The charge curve tapers near full, and power, energy, time to limit and cost update live. Stop charging drains the flow.

## Guidance for AI tools

Stretch refresh: Pull a feed down and a line stretches to tell you when to let go. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
