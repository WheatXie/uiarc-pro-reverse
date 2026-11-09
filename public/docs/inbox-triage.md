# Inbox triage

> Process a focused inbox with archive, snooze, and restore actions.

- Type: Block
- Page: https://uiarc.dev/components/blocks/inbox-triage
- Markdown: https://uiarc.dev/components/blocks/inbox-triage/markdown

- Access: Arc Pro
- Registry id: `inbox-triage`
- Source file: `registry/blocks/inbox-triage/inbox-triage.tsx`
- Built from: Avatar, Button, Motion
- Keywords: react inbox, email triage ui, inbox component, archive snooze inbox, message list, mail app ui

Use this pattern when messages need clear next actions. Connect the demo folder state to your own message service.

## When to use

- A queue of messages or requests that need archive, snooze, or restore decisions.
- Inboxes where rows expand in place to show details and actions.

## When not to use

- Use inbox-sidebar for mail navigation with folders and counts.
- Use notification-center for system notifications.
- Use swipe-actions for touch-first lists with gesture actions.

## Installation

Inbox triage is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/inbox-triage
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { InboxTriage } from "@/components/arc/blocks/inbox-triage/inbox-triage";

export function Messages() {
  return <InboxTriage />;
}
```

## API reference

### InboxTriage

Inbox, Snoozed, and Archive tabs with messages that expand in place, an Unread filter, archive, snooze, and restore actions with single-key shortcuts, and an undo for the last move. Takes no props; messages are sample data.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Switch folders in the tab list. |
| ArrowUp / ArrowDown | Move between message rows. |
| Enter / Space | Expands or collapses the focused message and marks it read. |
| E | Archives the focused message (outside Archive). |
| S | Snoozes the focused message (in Inbox). |
| U | Moves the focused message back to Inbox (in Snoozed or Archive). |

## Accessibility

- Folders are a tablist with arrow key navigation; the list is its tabpanel.
- Message rows toggle with aria-expanded and aria-controls and declare their shortcuts with aria-keyshortcuts.
- After a message leaves, focus moves to the next row, or to the heading when the list is empty; undo returns focus to the restored row.
- Moves are announced in a polite role="status" region; the Unread filter uses aria-pressed.

## Motion

- Rows and message details open and collapse with height and opacity on the smooth spring.
- The folder indicator glides between tabs with a shared layoutId; the status line swaps with a short rise.
- Reduced motion removes height and travel and keeps plain fades.

## Responsive behavior

- Container queries: below 560px rows switch to a two-line layout with a 32px avatar, subject and preview under the sender, and a short hint in the footer.
- Below 360px the unread count hides, tabs tighten, and detail text drops its avatar indent.

## Performance

- Rows collapse with height animation; the list is not virtualized.
- Focus moves to the next row after an action on the next frame, without extra timers.

## Notes for AI

- Use when a queue of messages or requests needs clear next actions.
- No callbacks are exposed; replace initialMessages and the move() and undo() functions with calls to your message service.
- Composes Arc Avatar and Button.

## Related

- [Sidebar: Inbox](https://uiarc.dev/components/blocks/sidebar/markdown): A mail sidebar whose Compose button grows into a composer and whose folders take dropped mail.
- [Notification center](https://uiarc.dev/components/blocks/notification-center/markdown): A home for updates with read state, grouped information, and animated disclosure.
- [Swipe actions](https://uiarc.dev/components/swipe-actions/markdown): Reveal row actions with a swipe, or from the same actions in a menu.
- [Support conversation](https://uiarc.dev/components/blocks/support-conversation/markdown): A responsive message thread with useful quick replies and live feedback.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
