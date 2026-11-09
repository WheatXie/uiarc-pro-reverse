# Cancel flow

> A cancellation flow that answers each reason with a tailored offer and a calm hold-to-cancel.

- Type: Block
- Page: https://uiarc.dev/components/blocks/cancel-flow
- Markdown: https://uiarc.dev/components/blocks/cancel-flow/markdown

- Access: Arc Pro
- Registry id: `cancel-flow`
- Source file: `registry/blocks/cancel-flow/cancel-flow.tsx`
- Built from: Button, Badge, Avatar, Textarea, Animated counter, Hold to confirm
- Keywords: react cancel subscription flow, churn prevention flow, cancellation survey, retention offer, pause subscription, cancel flow saas

Use this in billing settings when someone cancels a subscription. Connect each offer's accept to your discount, pause or plan change API, the hold to your cancel endpoint, and the note to your feedback store; the preview simulates them.

## When to use

- Subscription cancellation in billing settings with a reason step and a retention offer.
- Flows that offer a discount, pause, or downgrade before confirming the cancel.

## When not to use

- Use dialog with hold-to-confirm for a one step destructive action without offers.
- Use plan-comparison when people are choosing a plan rather than leaving.
- Use billing-overview for the billing page itself.

## Installation

Cancel flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/cancel-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CancelFlow } from "@/components/arc/blocks/cancel-flow/cancel-flow";

export default function CancelPage() {
  return (
    <main>
      <CancelFlow />
    </main>
  );
}
```

## API reference

### CancelFlow

A three step subscription cancellation (reason, tailored offer, confirm) that ends in a hold-to-cancel. Reasons, offers, price, resume dates and impacts are sample data in cancel-flow.tsx.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move between reason cards and select them (wraps around). |
| Home / End | Select the first or last reason; on the pause offer, set the shortest or longest pause. |
| Up / Down, Left / Right | On the pause offer, change the pause length between one and three months. |

## Accessibility

- Reasons form a role="radiogroup" with aria-checked cards.
- The pause length is a role="spinbutton" whose aria-valuetext includes the resume date.
- A polite role="status" region announces offer changes and the outcome.

## Motion

- Steps slide between reason, offer and confirm, the selection highlight glides with a layoutId, and prices roll with Animated counter.
- Reduced motion swaps slides for fades and figures change without rolling.

## Responsive behavior

- Below a 520px container the reason cards drop to one column and the action buttons fill the width.
- The final hold works with mouse, touch, and keyboard through hold-to-confirm.

## Performance

- Only the current step is mounted; prices roll with Animated counter.
- No observers or loops; the cost is a few spring transitions per step change.

## Notes for AI

- Use in billing settings when someone cancels a subscription.
- Connect each offer's accept to your discount, pause or plan change API, the hold to your cancel endpoint and the note to your feedback store; all are simulated.
- Edit REASONS, PRICE, RESUME and IMPACTS in cancel-flow.tsx to match your plans.
- Composes Arc Button, Badge, Avatar, Textarea, Animated counter and Hold to confirm.

## Related

- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.
- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
