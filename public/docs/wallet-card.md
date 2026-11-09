# Wallet card

> A compact account view with balance, recent activity, and focused money actions.

- Type: Block
- Page: https://uiarc.dev/components/blocks/wallet-card
- Markdown: https://uiarc.dev/components/blocks/wallet-card/markdown

- Access: Arc Pro
- Registry id: `wallet-card`
- Source file: `registry/blocks/wallet-card/wallet-card.tsx`
- Built from: Button, Input, Number field
- Keywords: react wallet card, crypto wallet ui, balance card, fintech dashboard card, send money ui, account balance chart, banking app component

Use this for a balance summary. The preview uses sample values; connect its actions and amounts to your own verified data.

## When to use

- A personal or business balance summary with quick send, deposit, swap, and buy actions.
- Dashboards that pair a balance with a small history chart and recent activity.
- Apps with a main and a reserve account shown in one card.

## When not to use

- Use billing-overview for subscription billing and invoices.
- Use wallet-stack for a stack of payment cards.
- Use checkout-flow for paying for an order.

## Installation

Wallet card is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/wallet-card
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { WalletCard } from "@/components/arc/blocks/wallet-card/wallet-card";

export function AccountSummary() {
  return <WalletCard initialBalanceCents={482_150} />;
}
```

## API reference

### WalletCard

A wallet view with two accounts, a scrubbable balance chart, activity search, and send, deposit, swap, and buy panels. All balances, history, and actions are local sample state.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialBalanceCents` | `number` | `1_248_032` | Starting balance of the main wallet in cents. The reserve wallet starts at 285,000 cents. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move along the balance history via the range input scrubber. |

## Accessibility

- The balance is an aria-live region; hidden balances read as "Balance hidden".
- Action buttons use aria-pressed and aria-controls; focus returns to the action after a submit.
- Amount errors use role="alert" and aria-describedby on the input.

## Motion

- Balances count to the new value over about 0.75s, and the card resizes on a gentle spring.
- Panels swap with a short rise and blur; new activity rows expand in place.
- Reduced motion sets values instantly and disables layout animation.

## Responsive behavior

- The card is a container query root capped at 660px, so it adapts to its slot, not the viewport.
- At 420px container width padding tightens and action arrows hide; at 280px the wallet switcher drops its label and the footer text shrinks.
- Chart hover scrubbing is mouse only; touch and keyboard use the range input over the chart.

## Performance

- Balances tween through a motion value over about 0.75s instead of re-rendering per frame.
- Activity search filters in memory and shows three rows until expanded; the list is not virtualized.

## Notes for AI

- Use for a personal or business balance summary with quick money actions.
- Every action is simulated. Replace initialEntries, balances, and submit() with calls to your ledger, and never trust client amounts.
- Composes Arc Button, DropdownMenu, Popover, and SegmentedControl.

## Related

- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
