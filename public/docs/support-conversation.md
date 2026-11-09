# Support conversation

> A responsive message thread with useful quick replies and live feedback.

- Type: Block
- Page: https://uiarc.dev/components/blocks/support-conversation
- Markdown: https://uiarc.dev/components/blocks/support-conversation/markdown

- Access: Arc Pro
- Registry id: `support-conversation`
- Source file: `registry/blocks/support-conversation/support-conversation.tsx`
- Built from: Input, Button, Avatar, Motion
- Keywords: react support chat, chat thread ui, customer support conversation, help desk chat, chat with typing indicator, ticket conversation

Use this as a conversation shell. Replace the deterministic demo replies with messages from your own support service.

## When to use

- A support chat or ticket thread with quick replies and attachments.
- Help flows that should show a typing indicator and a resolve toggle.

## When not to use

- Use support-widget for a floating help launcher.
- Use ai-composer for a prompt input without a thread.
- Use inbox-triage to handle many conversations at once.

## Installation

Support conversation is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/support-conversation
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SupportConversation } from "@/components/arc/blocks/support-conversation/support-conversation";

export function Ticket({ ticketId }: { ticketId: string }) {
  return (
    <SupportConversation
      onSend={(message) => postMessage(ticketId, message)}
      onResolve={(resolved) => setTicketResolved(ticketId, resolved)}
    />
  );
}
```

## API reference

### SupportConversation

A support thread with quick replies, PDF attachment, a typing indicator, and a resolve toggle. Replies are deterministic canned answers.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSend` | `(message: string) => void` | – | Called with each message the user sends. |
| `onResolve` | `(resolved: boolean) => void` | – | Called when the conversation is marked resolved or reopened. |

## Accessibility

- New messages are announced through a polite live region.
- The send, attach, and typing indicator elements have aria-labels.
- The file input only accepts PDF.

## Motion

- Messages rise into the thread on a gentle spring and existing messages shift via layout.
- Reduced motion removes the offsets and uses instant transitions.

## Responsive behavior

- The thread scrolls within a 350 to 450px height and centers messages up to 590px wide.
- Below 650px and again below 390px the header and composer padding tighten and the portrait shrinks.

## Performance

- Every message stays mounted and the thread is not virtualized, so load long histories in pages.
- New messages smooth-scroll the thread to the bottom; replies are simulated with timers you should replace.

## Notes for AI

- Use as a chat or ticket thread shell.
- Replace replyFor and scheduleReply with messages from your support backend, and initialMessages with the real history.
- onSend fires before the simulated reply; the component still keeps its own message list.

## Related

- [Support widget](https://uiarc.dev/components/blocks/support-widget/markdown): An in-app help launcher that grows into live article search, reading, and a chat with your team.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Inbox triage](https://uiarc.dev/components/blocks/inbox-triage/markdown): Process a focused inbox with archive, snooze, and restore actions.
- [Textarea](https://uiarc.dev/components/textarea/markdown): A multiline field for notes, descriptions, and longer text.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
