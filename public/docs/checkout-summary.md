# Checkout summary

> An order summary with a promo code that becomes a chip, discount and tax lines, and pay button states.

- Type: Block
- Page: https://uiarc.dev/components/blocks/checkout-summary
- Markdown: https://uiarc.dev/components/blocks/checkout-summary/markdown

- Access: Arc Pro
- Registry id: `checkout-summary`
- Source file: `registry/blocks/checkout-summary/checkout-summary.tsx`
- Built from: Motion
- Keywords: react checkout summary, order summary, promo code field, coupon input, pay button states, checkout total, stripe checkout summary

Use this as a starting point and replace the sample data with your own.

## When to use

- The last step before a hosted checkout such as a Stripe session redirect.
- A single product purchase with launch discounts or promo codes.
- A pricing page side panel that confirms the final total.

## When not to use

- Use checkout-flow when you collect shipping and card details in the page.
- Use cart-drawer for a cart with several items and quantities.
- Use billing-overview for an existing subscription's invoices and plan.

## Installation

Checkout summary is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/checkout-summary
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CheckoutSummary } from "@/components/arc/blocks/checkout-summary/checkout-summary";

export function Checkout() {
  return (
    <CheckoutSummary
      item={{ name: "Arc Pro", description: "All components and blocks", price: 199, period: "one payment" }}
      adjustments={[{ id: "launch", label: "Launch price", amount: -50, note: "38 of 50 left" }]}
      coupon={{
        onApply: async code => {
          const res = await fetch("/api/coupon", { method: "POST", body: JSON.stringify({ code }) });
          return res.json();
        },
      }}
      tax={{ label: "Tax", note: "Calculated at checkout" }}
      form={{ action: "/api/checkout", fields: { plan: "pro" } }}
      payLabel={total => `Continue to payment, ${total}`}
    />
  );
}
```

## API reference

### CheckoutSummary

An order summary for the last step before payment, with discount lines, a promo code field, a counting total, and a pay button that moves from idle to processing to paid. Without item it renders a sample order with simulated code and payment.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `item` | `CheckoutSummaryItem` | – | The product: name, price, and optional description, period, and media. Omit it to render the built-in sample order. |
| `adjustments` | `CheckoutSummaryLine[]` | `[]` | Automatic lines, each with id, label, amount (negative for a discount), and optional note. |
| `coupon` | `{ onApply: (code: string) => Promise<CheckoutCouponResult>; placeholder?: string }` | – | Enables the promo code field. onApply resolves { ok: true, code, label?, amount } or { ok: false, message }. Validate on your server. |
| `tax` | `{ label: string; rate?: number; note?: string }` | – | Tax line. With rate the amount is computed from the discounted subtotal; without it note, or Calculated at checkout, is shown. |
| `currency` | `string` | `"$"` | Symbol before amounts. |
| `title` | `string` | `"Order summary"` | Heading, also the section's accessible name. |
| `payLabel` | `(total: string) => string` | `total => 'Pay ${total}'` | Pay button label. Receives the formatted total. |
| `onPay` | `() => Promise<void>` | – | Client-side payment. Resolve to show success, reject to show an error and Try again. |
| `form` | `{ action: string; fields?: Record<string, string> }` | – | Posts a native form instead, such as to a route that creates a hosted checkout session. fields become hidden inputs. |
| `secureNote` | `ReactNode` | `"Encrypted payment"` | Line beside the lock under the button. |
| `successLabel` | `string` | `"Paid"` | Button label once onPay resolves. |
| `disabled` | `boolean` | `false` | Shows the button but blocks payment, such as before checkout opens. |
| `footnote` | `ReactNode` | – | Small print under the button. |
| `className` | `string` | – | Extra class on the root section. |

### CheckoutSummaryItem

The product being bought.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` (required) | `string` | – | Product name, truncated on one line. |
| `description` | `string` | – | Short line under the name. |
| `price` (required) | `number` | – | Price before adjustments. Shown as the subtotal. |
| `period` | `string` | – | Note under the price, such as one payment or per year. |
| `media` | `ReactNode` | – | Thumbnail or mark in a 44px tile. |

### CheckoutSummaryLine

An adjustment line.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable key. "coupon" is used by the applied code line. |
| `label` (required) | `string` | – | Line label. |
| `amount` (required) | `number` | – | Amount added to the subtotal. Negative for a discount, which is tinted. |
| `note` | `string` | – | Short note under the label, such as 38 of 50 left. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the promo code field, applies the code. An empty field keeps focus. |
| Enter / Space | On the remove button of an applied code, removes it and returns focus to the field. |

## Accessibility

- The block is a section labelled by title with an h3 heading.
- The promo field has a visually hidden label. Errors set aria-invalid, aria-describedby, and a role="alert" message.
- The applied code chip has a remove button labelled Remove code followed by the code.
- The pay button is aria-live="polite", so Processing, Paid, and Try again are announced. A payment error adds a role="alert" line.
- The total has visually hidden formatted text, while the rolling digits are aria-hidden.

## Motion

- Adjustment and coupon lines open with a height spring and fade.
- The promo form swaps to the applied chip with a small scale and blur. An invalid code shakes the field horizontally for 360ms.
- The total rolls through AnimatedCounter. The pay button's label and icon swap with a rise and blur on each state change, and a spinner turns while processing.
- Reduced motion skips the shake, makes lines appear instantly, reduces swaps to fades, and slows the spinner to 1.6s per turn.

## Responsive behavior

- The card is up to 440px wide and fills narrower containers. Padding scales between 20px and 28px with the viewport.
- The product name truncates on one line; the price column stays unwrapped.
- Hover styles apply only on fine pointers. Buttons scale down slightly on press.

## Performance

- One pageshow listener per instance. No timers except those in the sample handlers.
- Only the total uses AnimatedCounter. Line and button animations run on state changes only.

## Notes for AI

- Choose it for a one-product order summary before payment. Use checkout-flow for a multi-step checkout with address and payment fields, and cart-drawer for many items.
- Pass either onPay for a client-side payment or form for a server route that redirects to a hosted checkout. With form, the button shows Processing on submit and resets on back-forward cache restore.
- Always pass item in production. Without it the block uses a sample order, a WELCOME10 test code, and a simulated payment.
- Coupon amounts are positive in CheckoutCouponResult and are subtracted. The subtotal never goes below zero; decimals switch to two when any amount is fractional.

## Related

- [Cart drawer](https://uiarc.dev/components/blocks/cart-drawer/markdown): Products fly into the cart, counts roll, and a drawer handles quantities, shipping progress, and checkout.
- [Billing toggle](https://uiarc.dev/components/billing-toggle/markdown): A monthly and yearly switch with a savings badge and prices that roll to the new amount.
- [Action button](https://uiarc.dev/components/action-button/markdown): A compact button for frequent toolbar actions.
- [Money input](https://uiarc.dev/components/money-input/markdown): A currency field with live grouping, stable width, rolling digits, and minor-unit output.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
