# Usage pricing

> A pricing calculator that finds your plan as you drag seats and traffic.

- Type: Block
- Page: https://uiarc.dev/components/blocks/usage-pricing
- Markdown: https://uiarc.dev/components/blocks/usage-pricing/markdown

- Access: Arc Pro
- Registry id: `usage-pricing`
- Source file: `registry/blocks/usage-pricing/usage-pricing.tsx`
- Built from: Slider, Segmented control, Animated counter, Text morph, Button
- Keywords: react pricing calculator, usage based pricing, seat pricing slider, pricing page component, plan recommender, monthly yearly toggle, saas pricing

Use this on a pricing page for seat and usage based plans. Replace the plan table with your own rates and limits and connect the trial button to signup.

## When to use

- Pricing pages for plans priced by seats plus usage.
- Calculators that should recommend a plan as people move sliders.
- Monthly and yearly toggles where the saving should be visible in the breakdown.

## When not to use

- Use plan-comparison for a side by side table of fixed tiers.
- Use usage-forecast to project spend for an existing customer.
- Use billing-overview for the settings page of someone already subscribed.

## Installation

Usage pricing is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/usage-pricing
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { UsagePricing } from "@/components/arc/blocks/usage-pricing/usage-pricing";

export default function PricingPage() {
  return (
    <main>
      <UsagePricing />
    </main>
  );
}
```

## API reference

### UsagePricing

A pricing calculator with seat and traffic sliders and a monthly or yearly toggle that recommends a plan, shows its features, and breaks down the cost. Plan rates, limits, and features are sample data.

No props.

## Accessibility

- The plan card and breakdown are labelled sections tied to their headings with aria-labelledby.
- Plan changes are announced in a polite live region with the plan name and reason.
- The decorative meter is aria-hidden; the numbers are real text.

## Motion

- Prices roll with the animated counter and plan names morph with text-morph as sliders move.
- The feature list reflows as items are added or removed for the recommended plan.
- Reduced motion drops the layout and entrance animations.

## Responsive behavior

- At 780px container width and above the plan card sits in its own column beside the sliders; below that everything stacks.
- The block caps at 1060px and clips its own overflow, so it fits any page column.

## Performance

- Prices roll with the animated counter and the feature list reflows with layout animation on each slider change.
- A ResizeObserver drives the height morph of the plan card.

## Notes for AI

- Use on a pricing page for seat plus usage based plans.
- Replace the plan table, rates, and limits with your own; the trial button only sets local state, so route it to signup.
- Composes Arc slider, segmented-control, animated-counter, text-morph, and button.

## Related

- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Usage forecast](https://uiarc.dev/components/blocks/usage-forecast/markdown): A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
