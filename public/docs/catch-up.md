# Catch up

> A catch me up digest for when you return, where one button reads Slack, Linear, GitHub and Gmail for the range you pick and streams back a short ranked summary: Needs you, Decisions made, Shipped and FYI. Each item is one sentence with its source mark, people and a jump link, and marking items as read clears them with a smooth collapse.

- Type: Block
- Page: https://uiarc.dev/components/blocks/catch-up
- Markdown: https://uiarc.dev/components/blocks/catch-up/markdown

- Access: Arc Pro
- Registry id: `catch-up`
- Source file: `registry/blocks/catch-up/catch-up.tsx`
- Built from: Button, SegmentedControl, TextShimmer, Tooltip
- Keywords: catch up, catch me up, digest, ai summary, chief of staff, while you were away, inbox summary, slack summary, notifications digest, linear, github, gmail, prioritized summary, mark as read

Drop it on a home or inbox screen for the moment someone comes back. Pass `generate(range, signal)` returning `CatchUpItem[]` (id, section, source, one-sentence text, context, when, people, href) and abort when the signal fires. Pass `counts` keyed by range for the per-source totals shown before it runs, plus `onOpen` and `onMarkRead` to wire jump links and read state. `ranges`, `range`/`onRangeChange`, `model` and `title` are optional. With no props it plays a simulated three-day digest once it scrolls into view.

## When to use

- A home or inbox screen that summarizes what happened across connected tools while the user was away.
- An AI assistant feature that turns hundreds of notifications into a short ranked list with jump links.
- A weekly or daily digest preview inside a product's notification settings.

## When not to use

- A live notification feed where every event matters; use a plain activity list instead.
- A long-form report or meeting summary with paragraphs; use a document view or ai-chat.
- Approving agent actions; use agent-approvals.

## Installation

Catch up is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/catch-up
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CatchUp } from "@/components/arc/blocks/catch-up/catch-up";

export function ReturnDigest() {
  return (
    <CatchUp
      generate={async (range, signal) => {
        const response = await fetch(`/api/digest?range=${range}`, { signal });
        if (!response.ok) throw new Error("Gmail did not respond. Try again in a minute.");
        return response.json();
      }}
      counts={{ "1d": { slack: 31, linear: 9 }, "3d": { slack: 86, linear: 31 }, "1w": { slack: 214, linear: 77 } }}
      onOpen={item => window.open(item.href, "_blank")}
      onMarkRead={ids => fetch("/api/digest/read", { method: "POST", body: JSON.stringify({ ids }) })}
    />
  );
}
```

## API reference

### CatchUp

A catch me up digest card. One button reads Slack, Linear, GitHub and Gmail for a time range and streams back a prioritized summary in four sections: Needs you, Decisions made, Shipped and FYI. With no props it plays a simulated three day digest.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `generate` | `(range: string, signal: AbortSignal) => Promise<CatchUpItem[]>` | – | Builds the digest for a range. Abort the request when the signal fires (Stop, a new range, unmount). Leave it out to play the built in sample digest, which reads nothing. |
| `ranges` | `CatchUpRange[]` | `1 day, 3 days, 1 week` | Options in the time range selector: { value, label, since }. The label also fills the button ("Catch up on 3 days") and since fills the summary line. |
| `range` | `string` | – | Controlled range value. Pair with onRangeChange. |
| `defaultRange` | `string` | `second range` | Starting range when uncontrolled. |
| `onRangeChange` | `(range: string) => void` | – | Called when the range changes. A digest that is already showing rebuilds for the new range. |
| `counts` | `Record<string, Partial<Record<CatchUpSource, number>>>` | `sample counts` | Unread updates per source, keyed by range value. Shown before the digest runs and summed in the summary line. |
| `onOpen` | `(item: CatchUpItem) => void` | – | Jump to an item in its app. Without it, items with an href open in a new tab, and items without one show a simulated notice. |
| `onMarkRead` | `(ids: string[]) => void` | – | Called with the ids marked as read, one item at a time or all at once from Mark all as read. |
| `model` | `{ name: string; mark?: ReactNode }` | `Claude Haiku 5.5` | The model that writes the digest, shown in the footer. |
| `title` | `string` | `"Welcome back"` | Card title. |
| `autoStart` | `boolean` | `true without generate` | Runs the digest once when the card first scrolls into view. |
| `className` | `string` | – | Extra class on the root card. |

### CatchUpItem

One digest line.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id, passed back to onMarkRead. |
| `section` (required) | `"needs-you" \| "decisions" \| "shipped" \| "fyi"` | – | Which section the item belongs to. Sections show in this order and hide when empty. |
| `source` (required) | `"slack" \| "linear" \| "github" \| "gmail"` | – | Source app, drawn with its real mark. |
| `text` (required) | `string` | – | One sentence. It streams in a few words at a time. |
| `context` | `string` | – | Where it happened: a channel, issue, pull request or thread. |
| `when` | `string` | – | Short time label, such as "Sun 13:10". |
| `people` | `{ name: string; avatar?: string }[]` | – | People involved. Up to three faces show, with the first name and a count. |
| `href` | `string` | – | Jump link to the item in its app. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the range selector, each item's open and mark as read buttons, then the footer action. |
| Arrow keys | Move between time ranges in the selector. |
| Enter / Space | Runs the digest, stops it, opens an item, or marks it as read. |

## Accessibility

- A polite live region announces each phase: reading, digest ready with the item count, marked as read with the count left, and all caught up. The sample adds that it is simulated and nothing was read.
- Sections are labelled regions with a heading that includes the count, and each sentence starts with its source name for screen readers.
- Rows that have not streamed in yet are hidden from assistive tech and their buttons are out of the tab order.
- After marking an item as read, focus moves to the next item's mark as read button, or to the footer action when the list is clear.
- Status is never color alone: sections pair an icon with a label, and the reading state uses a spinner then a check per source.

## Motion

- The digest streams four words every 34ms; each chunk only fades in. Rows reserve their full height up front behind quiet skeleton bars, so nothing shifts while text streams.
- Switching between sources, digest and outcome is one crossfade (100ms out, 160ms in) while the card height springs to the new size with no bounce.
- Mark as read collapses the row's height and opacity in 200ms; an emptied section collapses the same way. The card follows the collapse frame by frame instead of chasing it with a second spring.
- Labels, counts and the summary line swap with a single crossfade and a 2px rise. The button keeps a fixed minimum width across labels.
- Reduced motion shows the finished digest at once, keeps crossfades as plain fades, and stops the spinner.

## Responsive behavior

- The card fills its container up to 600px. Below 440px container width the padding tightens, the range selector wraps under the title, and meta lines truncate with an ellipsis.
- Item actions are always visible, so touch users do not depend on hover.
- Holds at 360px and 390px viewports without horizontal scroll.

## Performance

- Streaming re-renders one small list on a 34ms timer only while text is streaming; it stops at ready.
- Word fades run on CSS opacity transitions, not per-word motion components.
- The sample starts once via IntersectionObserver; the spinner animates only during reading.

## Notes for AI

- Use for a return or Monday morning moment: a manager or engineer comes back after time away and needs what changed, ranked by whether it needs them.
- Keep items to one sentence written as an outcome ("API v2.14 is live with 38% faster search"), not a raw message. Put the person, channel and time in people, context and when.
- Order is fixed by section: Needs you first. Only put items in Needs you when the reader has to act.
- Pass generate for real data; it receives an AbortSignal that fires on Stop, a range change or unmount.
- Sources are Slack, Linear, GitHub and Gmail. To add another, extend CatchUpSource and the marks file.

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
