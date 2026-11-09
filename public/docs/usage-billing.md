# Usage billing

> A usage based billing dashboard with a projected spend line, meters against limits, alerts, and an upgrade that morphs into a confirm sheet.

- Type: Block
- Page: https://uiarc.dev/components/blocks/usage-billing
- Markdown: https://uiarc.dev/components/blocks/usage-billing/markdown

- Access: Arc Pro
- Registry id: `usage-billing`
- Source file: `registry/blocks/usage-billing/usage-billing.tsx`
- Built from: Animated counter, Text morph, Button
- Keywords: usage billing, metered billing, spend dashboard, projected spend, usage limits, spend alerts, budget alerts, invoice history, upgrade plan, proration

Use this in the billing area of a usage priced product. Load meters, daily spend, and invoices from your billing provider, save alerts through onAlertsChange, and send the upgrade to your checkout; every charge in the preview is simulated.

## When to use

- A billing page for usage priced SaaS or infrastructure products.
- Admin dashboards where finance needs spend alerts and invoice history in one place.
- Upgrade moments driven by limits, where the upgrade should explain what changes.

## When not to use

- Use billing-overview for flat seat based plans without meters.
- Use plan-comparison or usage-pricing on a public pricing page.
- Avoid it for a single quota; a usage meter component is enough.

## Installation

Usage billing is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/usage-billing
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { UsageBilling } from "@/components/arc/blocks/usage-billing/usage-billing";

export function BillingPage({ usage, plans }: { usage: BillingSnapshot; plans: PlanCatalog }) {
  return (
    <UsageBilling
      period={usage.period}
      daily={usage.dailySpend}
      meters={usage.meters}
      plan={plans.current}
      upgrade={plans.next}
      defaultAlerts={usage.alerts}
      onAlertsChange={alerts => saveAlerts(alerts)}
      onUpgrade={plan => startUpgrade(plan.id)}
      onDownloadInvoice={invoice => downloadPdf(invoice.id)}
    />
  );
}
```

## API reference

### UsageBilling

A usage based billing dashboard: spend so far with a projected line and live alert rules on the chart, per meter usage against limits with warning states, a spend alerts editor, invoice history with downloads, and a plan card that grows into an upgrade confirm sheet.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `period` | `{ label: string; start: string; days: number; today: number }` | `billingPeriod` | The current billing period and which day it is. |
| `daily` | `number[]` | `dailySpend` | Usage charges per day so far. Its length is the number of days elapsed. |
| `budget` | `number` | `2000` | Monthly budget drawn on the chart. |
| `meters` | `Meter[]` | `meters` | Metered resources: id, name, unit (requests, gigabytes, minutes, invocations, seats), used, limit, and an overage price label. |
| `plan` | `Plan` | `currentPlan` | The current plan: name, monthly price, limits keyed by meter id, and perks. |
| `upgrade` | `Plan \| null` | `upgradePlan` | The plan offered in the upgrade card. Pass null to hide the offer. |
| `defaultAlerts` | `SpendAlert[]` | `spendAlerts` | Initial alerts: amount, email, and slack. |
| `onAlertsChange` | `(alerts: SpendAlert[]) => void` | – | Called whenever alerts are added, edited, or removed. |
| `invoices` | `Invoice[]` | `invoices` | Past invoices with number, period, issue date, amount, and status. |
| `payment` | `{ brand: string; last4: string; expires: string }` | `paymentMethod` | Card shown on the plan card, the invoices header, and the confirm sheet. |
| `onUpgrade` | `(plan: Plan) => Promise<void> \| void` | – | Runs the upgrade. Resolve to switch plans, reject to show a declined message. Without it the upgrade is simulated. |
| `onDownloadInvoice` | `(invoice: Invoice) => Promise<void> \| void` | – | Fetches an invoice PDF. Without it the download is simulated. |
| `currency` | `string` | `"EUR"` | ISO currency code for every amount. |
| `className` | `string` | – | Class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the chart, plan card, alerts, and invoice downloads. |
| Arrow left / Arrow right | Moves the chart cursor one day at a time while the chart has focus. |
| Enter in an alert amount | Commits the amount; alerts re sort by amount when the field loses focus. |
| Escape | Closes the upgrade sheet unless a payment is in progress. |

## Accessibility

- The chart is an image with a spoken summary of spend, projection, and budget; its cursor also works from the keyboard.
- Each meter is a meter role with a value text that says when it is near or projected over the limit.
- Warnings pair an icon and words with color. Invoice status pairs a dot with a label.
- The upgrade sheet is a modal dialog that traps Tab, focuses its heading, and returns focus to the plan card.
- The sheet states that the preview takes no payment.

## Motion

- The spend line draws in once, the projection and alert rules follow; alert rules glide to their new height while you type an amount.
- Meter bars fill with a short stagger. After an upgrade every limit grows, so the bars shrink and warnings clear in place.
- The plan card grows into the confirm sheet on one spring and folds back into the card once the upgrade lands.
- Invoice downloads swap their icon for a spinner, then a check, without changing width.
- Reduced motion removes the draw in, stagger, and flight, and keeps short fades.

## Responsive behavior

- From 700px the chart and plan card share a row, and meters sit beside alerts.
- Below 520px the invoice issue date and overage prices hide; everything else stacks.
- The confirm sheet keeps a 12px margin and stays clear of sticky page chrome.

## Performance

- The chart is one SVG sized from a ResizeObserver; hover updates only the cursor and tooltip.
- Bars animate transform scale only.
- Sheet flight animates one element's transform and size.

## Notes for AI

- Choose it for products billed on usage: API calls, compute, storage, bandwidth, seats.
- Feed daily spend from your billing provider; the projection is the average of the last seven days carried to the end of the period.
- Set plan limits per meter id so the upgrade can recompute every bar.
- Call your checkout or subscription update API in onUpgrade and reject on a declined card.

## Related

- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Usage forecast](https://uiarc.dev/components/blocks/usage-forecast/markdown): A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.
- [Usage pricing](https://uiarc.dev/components/blocks/usage-pricing/markdown): A pricing calculator that finds your plan as you drag seats and traffic.
- [Plan comparison](https://uiarc.dev/components/blocks/plan-comparison/markdown): Compare meaningful differences between plans and billing periods.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
