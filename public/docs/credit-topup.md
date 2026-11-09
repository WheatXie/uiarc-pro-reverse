# Credit top-up

> A card for buying AI credits. It shows the balance with a 14 day usage chart and how many days are left, three preset packs with bonus badges, a custom amount slider with a live price, auto top-up with a threshold and the saved Visa or Mastercard. When you buy, the new balance rolls in like an odometer.

- Type: Block
- Page: https://uiarc.dev/components/blocks/credit-topup
- Markdown: https://uiarc.dev/components/blocks/credit-topup/markdown

- Access: Arc Pro
- Registry id: `credit-topup`
- Source file: `registry/blocks/credit-topup/credit-topup.tsx`
- Built from: Button, Slider, Switch
- Keywords: credits, top up, buy credits, ai credits, prepaid, token balance, auto recharge, auto top-up, usage based billing, wallet, balance, odometer, rolling numbers, billing

Drop it into a billing page, an out of credits dialog or a top-up drawer. Pass `balance` controlled, plus `usage` (daily credits, oldest first) and `paymentMethods`. Wire `onPurchase(order, signal)` to charge a saved card: resolve when the credits are added, or throw an Error with a short message to show the error state with Try again. `pricing` ({ unitPrice, currency, bonusTiers }) drives every price and bonus. Price orders on the server with the exported `quoteCredits` and the same pricing object. `onAutoTopupChange` and `onPaymentMethodChange` report settings changes. With no props it runs a simulated purchase for a workspace at 840 credits.

## When to use

- Selling prepaid AI credits or tokens with volume bonuses.
- A billing settings section where people also manage auto top-up and their card.
- An out of credits moment where the balance, burn rate and a one click refill belong together.

## When not to use

- Subscription plan changes with seats and billing cycles: use a plan picker or checkout-live.
- Collecting a new card number: use a card form or a hosted payment element, then pass the saved card here.
- Read-only usage reporting: use a usage meter or a chart.

## Installation

Credit top-up is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/credit-topup
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CreditTopup } from "@/components/arc/blocks/credit-topup/credit-topup";

export function BillingCredits({ workspace }) {
  return (
    <CreditTopup
      balance={workspace.credits}
      usage={workspace.dailyUsage}
      paymentMethods={workspace.cards}
      onPurchase={async (order, signal) => {
        const res = await fetch("/api/credits/purchase", { method: "POST", body: JSON.stringify(order), signal });
        if (!res.ok) throw new Error((await res.json()).message ?? "Payment failed. Try again or change card.");
      }}
      onAutoTopupChange={settings => fetch("/api/credits/auto-topup", { method: "PUT", body: JSON.stringify(settings) })}
    />
  );
}
```

## API reference

### CreditTopup

A card for buying AI credits: the balance with a 14 day usage chart and days left, preset packs with bonus badges, a custom amount slider with a live price, auto top-up with a threshold, the saved card, and a checkout that rolls the new balance in. With no props it plays a simulated purchase for a workspace at 840 credits.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `balance` | `number` | – | The current balance in credits, controlled. Any change rolls the numerals. Leave it out and the card keeps its own balance and adds each purchase to it. |
| `defaultBalance` | `number` | `840` | The starting balance when `balance` is left out. |
| `usage` | `CreditUsageDay[]` | `Oct 14 to Oct 27, 2026 sample` | Daily usage, oldest first: { date: ISO date, credits }. The last day is today. Drives the bar chart, its hover readout, and the days left estimate (average of the full days). |
| `packs` | `number[]` | `[1000, 5000, 20000]` | Preset pack sizes in credits, shown as a radio group. Keep it to three for the layout. |
| `pricing` | `CreditPricing` | `$0.01 a credit, +10% from 5,000, +15% from 20,000` | { unitPrice, currency, bonusTiers: { min, percent }[] }. Prices, bonus badges, the total and the per 1,000 rate all derive from it. |
| `range` | `{ min: number; max: number; step: number }` | `{ min: 500, max: 30000, step: 500 }` | The custom amount slider's range in credits. A slider value equal to a pack selects that pack. |
| `defaultCredits` | `number` | `the second pack` | The amount selected on mount. |
| `paymentMethods` | `CreditPaymentMethod[]` | `Visa 4242, Mastercard 5454` | Saved cards: { id, brand: "visa" \| "mastercard", last4, expires: "MM/YYYY" }. Change cycles through them. |
| `thresholds` | `number[]` | `[500, 1000, 2500]` | Choices for the auto top-up threshold. The balance reads as running low below the selected one. |
| `defaultAutoTopup` | `{ enabled: boolean; threshold: number }` | `{ enabled: false, threshold: 1000 }` | Auto top-up settings on mount. |
| `onAutoTopupChange` | `(settings: { enabled, threshold, credits }) => void` | – | Called when auto top-up is switched or its threshold changes. credits is the selected amount including bonus. |
| `onPaymentMethodChange` | `(id: string) => void` | – | Called when another saved card is chosen. |
| `onPurchase` | `(order: CreditOrder, signal: AbortSignal) => Promise<void>` | – | Charges the order { credits, bonus, total, price, currency, paymentMethodId }. Resolve once the credits are added; reject with an Error and its message shows with a Try again button. Aborted on unmount. Leave it out to simulate a 1.2s charge. |
| `onPurchased` | `(order: CreditOrder, balance: number) => void` | – | Called after a successful purchase with the new balance. |
| `className` | `string` | – | Extra class on the card. |

### quoteCredits

The pricing helper the card uses: quoteCredits(credits, pricing) returns { credits, bonus, total, price, currency }. Use it on the server to price the same order.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the packs, slider, auto top-up switch, threshold, Change and Buy credits. |
| ArrowLeft / ArrowRight | Moves between packs or thresholds and selects as it goes. Home and End jump to the first and last. |
| ArrowLeft / ArrowRight on the slider | Steps the custom amount by 500 credits. PageUp and PageDown take larger steps. |
| Space | Switches auto top-up. |
| Enter / Space | Buys the selected credits or changes the card. |

## Accessibility

- Packs and thresholds are radio groups with roving focus and labels that read the amount, price and bonus, such as "5,000 credits, $50, 10% bonus".
- Rolling numerals are aria-hidden; a visually hidden copy of each value is read instead, so screen readers never hear partial digits.
- A polite live region announces the charge, the result ("Added 5,500 credits. Nothing was charged.") and errors. Without onPurchase it says the checkout is simulated.
- Balance health is an icon plus a label (Running low, Healthy), never color alone. The usage chart is one image with a spoken summary.
- The Buy button stays focusable while processing (aria-busy) so keyboard focus is not lost.

## Motion

- After a purchase the balance rolls up odometer style over 0.9s: each digit rolls one way to its target and the lower places take one extra lap, so it reads as counting. New leading places open their width on a bounce-free spring.
- The total and price roll in 0.24s as the slider moves, in tabular numerals so nothing shifts.
- The pack selection ring and threshold pill glide between options on a 0.24s spring with no bounce. Status, health, days left and the saved card crossfade (100ms out, 160ms in, 2px rise).
- The card never changes size between idle, processing, done and error.
- Reduced motion: numbers and highlights jump to their end state; crossfades stay as plain fades.

## Responsive behavior

- Fluid up to 480px. Below about 450px container width the usage chart moves under the balance and stretches full width, and padding drops to 16px.
- Packs stay three across down to 320px; the bonus badge sits on the price line so amounts never truncate.
- Container queries, not viewport queries, so it adapts inside dialogs and sidebars.

## Performance

- Each digit is one transformed strip driven by a motion value: no re-renders while numbers roll.
- No timers or loops while idle; the only timeout clears the done message.
- Brand marks are inline SVG, about 1 KB.

## Notes for AI

- Use for usage-based AI products that sell prepaid credits: a billing page section, an out of credits dialog body, or a top-up drawer.
- Keep pricing on the server authoritative: price orders with the exported quoteCredits and the same pricing object, never trust the client total.
- Pass balance controlled when credits change elsewhere (live usage); the numerals roll on every change, so it doubles as a live balance.
- Wire onPurchase to a saved payment method charge (for example a Stripe PaymentIntent with off_session) and throw an Error with a short human message on decline.

## Related

- [Live checkout](https://uiarc.dev/components/blocks/checkout-live/markdown): A subscription checkout whose summary recomputes as you edit, then glides to the centre and unfolds into a receipt.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
