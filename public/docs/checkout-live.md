# Live checkout

> A subscription checkout whose summary recomputes as you edit, then glides to the centre and unfolds into a receipt.

- Type: Block
- Page: https://uiarc.dev/components/blocks/checkout-live
- Markdown: https://uiarc.dev/components/blocks/checkout-live/markdown

- Access: Arc Pro
- Registry id: `checkout-live`
- Source file: `registry/blocks/checkout-live/checkout-live.tsx`
- Built from: Segmented control, Checkbox, Input, Button, Animated counter
- Keywords: checkout, subscription, billing, payment form, order summary, coupon, receipt, seats, saas upgrade

Use this as the paid signup or upgrade step of a SaaS app. Load plans, add-ons and tax rates from your billing provider, check coupons on your server through validateCoupon, and charge through onPay with your payment SDK; the preview simulates payment.

## When to use

- Upgrade from a free plan to a paid team plan.
- Paid signup where seats and add-ons change the price.
- A self serve checkout that needs coupons and tax by country.

## When not to use

- A physical goods cart with shipping; use checkout-flow.
- Only showing totals without payment; use checkout-summary.
- Comparing plans before choosing; use plan-comparison.

## Installation

Live checkout is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/checkout-live
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CheckoutLive } from "@/components/arc/blocks/checkout-live/checkout-live";

export function UpgradePage() {
  return (
    <CheckoutLive
      defaultPlan="team"
      defaultSeats={12}
      validateCoupon={code => fetch(`/api/coupons/${code}`).then(r => r.json())}
      onPay={async order => {
        const res = await fetch("/api/subscribe", { method: "POST", body: JSON.stringify(order) });
        if (!res.ok) throw new Error("Your card was declined. Try another card.");
      }}
    />
  );
}
```

## API reference

### CheckoutLive

A subscription checkout with a live order summary. Plan, seats, billing period, add-ons, coupon and country recompute every line and the tax as you edit, and every amount rolls to its new value. On success the form steps aside and the summary glides to the centre and unfolds into a receipt.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `plans` | `Plan[]` | `sample plans` | Plans with an id, name, monthly seat price in cents, and a short blurb. |
| `addons` | `Addon[]` | `sample add-ons` | Optional add-ons with a flat monthly price in cents. |
| `countries` | `Country[]` | `sample countries` | Billing countries with a tax rate, tax label, postal code pattern, and a hint shown when the postal code does not match. |
| `defaultPlan` | `PlanId` | `"team"` | Plan selected on mount. |
| `defaultSeats` | `number` | `8` | Seats on mount, from 1 to 500. |
| `defaultBilling` | `"monthly" \| "yearly"` | `"yearly"` | Billing period on mount. |
| `defaultAddons` | `string[]` | `["support"]` | Add-on ids selected on mount. |
| `yearlyDiscount` | `number` | `0.2` | Discount for yearly billing, from 0 to 1. Shown on the billing toggle. |
| `currency` | `string` | `"USD"` | ISO currency code used to format every amount. |
| `validateCoupon` | `(code: string) => CouponResult \| Promise<CouponResult>` | `sample rules` | Checks a coupon. Return { ok: true, code, percent } or { ok: false, message }. The sample accepts LAUNCH20 and TEAM10. |
| `onPay` | `(order: CheckoutOrder) => void \| Promise<void>` | – | Charges the order. Throw an Error to show its message above the pay button. Without it the preview simulates payment and declines 4000 0000 0000 0002. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through express pay, plan, seats, add-ons, fields and pay. |
| Arrow keys | Move between plans inside the plan group. |
| Enter | Submits the form, or applies the coupon from the coupon field. |
| Escape | Closes the coupon field. |

## Accessibility

- Plans and billing period are radio groups with aria-checked; add-ons are real checkboxes.
- Errors are tied to their inputs with aria-describedby and aria-invalid, and a failed submit focuses the first invalid field.
- Rolling amounts keep the full value in visually hidden text, so screen readers never hear single digits.
- On success focus moves to the receipt heading; payment errors use role alert.

## Motion

- Every amount rolls digit by digit on the snappy spring; add-on and discount lines open and close their height on the smooth spring.
- On success the form fades aside and the summary glides to the centre with one position spring, while the coupon folds away and receipt details unfold.
- The selected plan ring and billing pill travel between options as shared layout highlights.
- Reduced motion keeps every state and swaps travel for instant changes.

## Responsive behavior

- Two columns with a sticky summary from 760px of frame width.
- Below that the summary sits on top as a collapsible total; plans stack below 520px.
- The receipt is a single centred column at every width.

## Performance

- Only the changed digits animate; lines are plain DOM.
- Validation runs on each change for a handful of fields, so it stays cheap.

## Notes for AI

- Choose this for a SaaS upgrade or paid signup where plan, seats and add-ons are chosen on the same page as payment.
- Prices are cents per month; yearly totals are derived with yearlyDiscount. Keep tax and coupon math on your server and treat the client numbers as a preview.
- Replace the card inputs with your payment provider's hosted fields in production; keep the layout and validation feedback.
- Below 760px of frame width the summary moves above the form and collapses to a total you can expand.

## Related

- [Checkout summary](https://uiarc.dev/components/blocks/checkout-summary/markdown): An order summary with a promo code that becomes a chip, discount and tax lines, and pay button states.
- [Pricing calculator](https://uiarc.dev/components/blocks/pricing-calculator/markdown): A seat slider and billing toggle drive plan cards with rolling prices and a moving recommended badge.
- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
