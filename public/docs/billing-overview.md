# Billing overview

> A billing page where the plan card morphs into a picker and usage, invoices, and card follow.

- Type: Block
- Page: https://uiarc.dev/components/blocks/billing-overview
- Markdown: https://uiarc.dev/components/blocks/billing-overview/markdown

- Access: Arc Pro
- Registry id: `billing-overview`
- Source file: `registry/blocks/billing-overview/billing-overview.tsx`
- Built from: Button, Badge, Input, Segmented control, Text morph, Animated counter, Avatar
- Keywords: react billing page, subscription management, billing settings, invoice list, usage meters, change plan ui, saas billing

Use this as the billing settings page of a SaaS app. Load plan, usage, card, and invoices from your billing provider and connect Upgrade, Update, Pay now, and Download to it; every charge in the preview is simulated.

## When to use

- The billing settings page of a SaaS app.
- Pages that show plan, usage, payment method, and invoices together.
- Plan changes that should happen in place without leaving billing.

## When not to use

- Use plan-comparison or usage-pricing on a public pricing page.
- Use cancel-flow for the cancellation journey.
- Use usage-meter to show a single quota elsewhere.

## Installation

Billing overview is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/billing-overview
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { BillingOverview } from "@/components/arc/blocks/billing-overview/billing-overview";

export default function BillingPage() {
  return (
    <main>
      <BillingOverview />
    </main>
  );
}
```

## API reference

### BillingOverview

A billing settings page: a plan card that morphs into a plan picker with a monthly or yearly switch and a prorated quote, usage meters that fill when seen, a payment card that edits in place and turns its digits when replaced, and an invoice list with download and pay now. Plan, usage, card, and invoices are simulated.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys, Home / End | Move between plans in the picker. |
| Escape | Closes the plan picker or cancels card editing. |

## Accessibility

- The plan picker is a role="radiogroup" of role="radio" buttons; unavailable plans are disabled.
- The price quote updates in a polite live region, and actions are announced in a status region.

## Motion

- The plan card morphs into the picker and back inside a region whose height springs; the selected plan highlight glides with a shared layoutId.
- Changing copy rises into place while the old line lifts away; totals roll with AnimatedCounter and card digits turn one column at a time.
- Usage bars fill when they scroll into view.
- Reduced motion makes the morph and fills instant.

## Responsive behavior

- Below 780px container width the plan and payment cards stack; below 700px meters go single column and invoice rows wrap.
- Below 480px quote buttons stretch full width, and below 340px the card form fields stack.

## Performance

- Usage bars animate once when 30% in view.
- The invoice list is not virtualized; paginate long billing histories.

## Notes for AI

- Use as the billing settings page of a SaaS app.
- Load plan, usage, card, and invoices from your billing provider and connect confirmPlan, saveCard, pay, and download to it.
- Quotes prorate a mid-term change for the days left; switching billing period starts a new period today and credits unused time. Replace this with your provider's preview invoice.
- Composes Arc button, badge, input, segmented-control, text-morph, animated-counter, and avatar.

## Related

- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.
- [Cancel flow](https://uiarc.dev/components/blocks/cancel-flow/markdown): A cancellation flow that answers each reason with a tailored offer and a calm hold-to-cancel.
- [Invoice studio](https://uiarc.dev/components/blocks/invoice-studio/markdown): An editable invoice with live totals and a clear save flow.
- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
