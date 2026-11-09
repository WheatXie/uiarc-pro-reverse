# Support widget

> An in-app help launcher that grows into live article search, reading, and a chat with your team.

- Type: Block
- Page: https://uiarc.dev/components/blocks/support-widget
- Markdown: https://uiarc.dev/components/blocks/support-widget/markdown

- Access: Arc Pro
- Registry id: `support-widget`
- Source file: `registry/blocks/support-widget/support-widget.tsx`
- Built from: Search field, Avatar, Button, Text morph, Animated counter
- Keywords: react support widget, help center widget, intercom style chat, in-app help launcher, customer support chat, help article search

Use this as the help entry point inside a SaaS app. Load articles from your help center into support-widget-data.ts and connect onSend to your inbox or chat provider; replies in the preview are simulated.

## When to use

- An in-app help launcher with article search, an article reader, and chat.
- SaaS products that want one help entry point mounted near the app root.

## When not to use

- Use support-conversation for a full page support chat.
- Use ai-composer for an AI prompt input without help articles.
- Use popover for a small anchored tip.

## Installation

Support widget is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/support-widget
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SupportWidget } from "@/components/arc/blocks/support-widget/support-widget";

export function AppShell() {
  return (
    <SupportWidget
      onSend={message => sendToInbox(message)}
      onOpenChange={open => track(open ? "help_opened" : "help_closed")}
    />
  );
}
```

## API reference

### SupportWidget

A help launcher that grows into article search, an article reader and a chat thread. Articles, team and suggested replies are sample data in support-widget-data.ts; agent replies are simulated.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSend` | `(message: string) => void` | – | Called with each message the person sends, so you can forward it to your inbox or chat provider. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the launcher opens or closes the panel. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Escape | Closes the panel and returns focus to the launcher. |
| Arrow down | From the search field, moves focus into the article list. |
| Arrow up / Arrow down | Moves between articles; up from the first article returns to search. |
| Enter | In search, opens the top result. |

## Accessibility

- The open panel is a role="dialog" whose label switches between Help and the conversation.
- The chat thread is a role="log" with a screen reader only typing indicator, and a polite live region announces view changes.
- The launcher uses aria-haspopup="dialog" and includes the unread reply count in its label.

## Motion

- The launcher springs open into the panel, and views slide in the direction of travel.
- Unread badges and the launcher icon pop in on a snappy spring; changing text crossfades with a short rise.
- Reduced motion replaces scale, slide and rotate with plain fades.

## Responsive behavior

- The dock is positioned absolute inside the block's 680px demo stage; move it to position fixed when you mount it in a real app.
- Below a 519px container the stage is 640px tall, the dock sits closer to the corner, and the sample app nav hides.
- On coarse pointers opening chat focuses the panel instead of the text field, so the keyboard does not pop up on its own.

## Performance

- Views mount one at a time and ResizeObservers animate the panel size between them.
- Article search filters an in-memory list; move it to your search API for a large help center.

## Notes for AI

- Use as the in-app help entry point of a SaaS product, mounted once near the app root.
- Replace ARTICLES, TEAM, SUGGESTIONS and replyTo in support-widget-data.ts with your help center and real replies.
- Wire onSend to your inbox or chat provider; the sample app page behind the launcher is decoration to remove.

## Related

- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.
- [Text morph](https://uiarc.dev/components/text-morph/markdown): Morph a label into its next state, letter by letter.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
