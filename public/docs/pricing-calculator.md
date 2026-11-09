# Pricing calculator

> A seat slider and billing toggle drive plan cards with rolling prices and a moving recommended badge.

- Type: Block
- Page: https://uiarc.dev/components/blocks/pricing-calculator
- Markdown: https://uiarc.dev/components/blocks/pricing-calculator/markdown

- Access: Arc Pro
- Registry id: `pricing-calculator`
- Source file: `registry/blocks/pricing-calculator/pricing-calculator.tsx`
- Built from: Motion
- Keywords: react pricing calculator, seat pricing slider, per seat pricing, pricing page, monthly yearly toggle, saas pricing plans, team size pricing, volume discount pricing

Use this as a starting point and replace the sample data with your own.

## When to use

- Per-seat pricing where showing the exact total for a team size helps people choose.
- Pricing pages with a monthly and yearly toggle and a visible yearly saving.
- Plans with seat caps or volume discounts that are hard to explain in a static table.

## When not to use

- Use usage-pricing when price depends on metered usage rather than seats.
- Use plan-comparison for a feature by feature table across plans.
- Use billing-toggle when you only need the monthly and yearly switch.

## Installation

Pricing calculator is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/pricing-calculator
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PricingCalculator } from "@/components/arc/blocks/pricing-calculator/pricing-calculator";

export function PricingPage() {
  return <PricingCalculator />;
}
```

## API reference

### PricingCalculator

A seat based pricing section. A slider picks team size from fixed seat stops, a billing toggle switches monthly and yearly, and three plan cards update prices, totals, volume discounts, and features live. The recommended plan follows the seat count. Plans and prices are constants in the file; the trial is simulated. Also the default export.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys / Home / End / Page Up / Page Down | Native range input: moves between seat stops. |
| Arrow keys | In the billing toggle, switch between monthly and yearly and move focus with the selection. |
| Enter / Space | Chooses a plan, steps seats with the plus and minus buttons, and starts the trial. |

## Accessibility

- The slider is a native range input labelled "Team size" with aria-valuetext such as "20 seats".
- Billing is a radiogroup with roving tabindex; plan buttons use aria-pressed for the selected plan.
- Each plan card is labelled by its heading, and each feature list is labelled with the plan name.
- Billing changes, plan picks, and the started trial are announced in a polite live region.

## Motion

- The selection frame and the Recommended badge are shared layout elements that travel between cards on a spring.
- Prices and totals roll with AnimatedCounter; changed copy crossfades with a short blur.
- Features that appear or disappear with the seat count open and close in height.
- Reduced motion removes the offsets and blur and sets layout and height transitions to zero.

## Responsive behavior

- The root is a size container. At 860px and below the three plan cards stack in one column.
- At 560px and below padding and the title shrink, and the controls tighten.
- At 360px and below the savings line and switch button wrap onto several lines.

## Performance

- State is a seat index, billing period, and picked plan; everything else is derived on render.
- Twenty three seat stops and three cards, so no memoization or virtualization is needed.

## Notes for AI

- Use for per-seat SaaS pricing where the right plan depends on team size and billing period.
- Edit STOPS, PLANS, recommend, and seatPrice to match your pricing. Starter has maxSeats 10; picking more shows a limit note and a button to drop back to 10 seats.
- Volume pricing takes $2 off each seat from 25 seats and $4 from 100 on Team and Business.
- There are no props. Wire startTrial to your signup or checkout; it currently waits 1.1s. Composes Arc Button and AnimatedCounter.

## Related

- [Usage pricing](https://uiarc.dev/components/blocks/usage-pricing/markdown): A pricing calculator that finds your plan as you drag seats and traffic.
- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.
- [Billing toggle](https://uiarc.dev/components/billing-toggle/markdown): A monthly and yearly switch with a savings badge and prices that roll to the new amount.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
