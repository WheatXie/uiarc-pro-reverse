# Spend alert

> A budget and spend alert card where the threshold is set right on the live spend bar, with forecast, Email, Slack and PagerDuty toggles, a hard stop and a live preview of the Slack message the alert will post.

- Type: Block
- Page: https://uiarc.dev/components/blocks/spend-alert
- Markdown: https://uiarc.dev/components/blocks/spend-alert/markdown

- Access: Arc Pro
- Registry id: `spend-alert`
- Source file: `registry/blocks/spend-alert/spend-alert.tsx`
- Built from: Switch, Button
- Keywords: spend alert, budget alert, billing threshold, usage alert, cost alert, ai spend, slack notification preview, pagerduty, hard stop, budget settings

Drop SpendAlert into a billing or usage settings page. Pass `spend` and `period` from your usage API (the forecast is projected for you unless you pass `forecast`), set the starting `defaultValue` (budget, threshold, channels, hardStop), and set `destinations` for your email, Slack channel and PagerDuty service. Wire `onSave` and `onSendTest`: each receives the settings and an AbortSignal, and the card handles the loading, saved, error and unsaved-changes states. Without handlers, both actions are simulated and the live region says so. `onChange` reports every edit.

## When to use

- Letting a team set a monthly budget and alert threshold for metered spend.
- Showing how close current and forecast spend are to an alert line.
- Choosing where cost alerts go and previewing the Slack message before saving.

## When not to use

- Read-only usage reporting with no settings; use usage-forecast or usage-billing instead.
- Per-seat plans with no metered spend.
- Complex multi-budget policies across many projects; use a table of budgets that opens this card per row.

## Installation

Spend alert is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/spend-alert
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SpendAlert } from "@/components/arc/blocks/spend-alert/spend-alert";

export function BillingAlerts({ usage }: { usage: { spend: number } }) {
  return (
    <SpendAlert
      project="Production"
      spend={usage.spend}
      defaultValue={{ budget: 5000, threshold: 80 }}
      destinations={{ email: "finance@acme.com", slack: "#eng-spend" }}
      onSave={async (settings, signal) => {
        const response = await fetch("/api/budget-alerts", { method: "PUT", body: JSON.stringify(settings), signal });
        if (!response.ok) throw new Error("Save failed");
      }}
    />
  );
}
```

## API reference

### SpendAlert

Budget and spend alert settings in one card: a monthly budget, a threshold slider drawn on the live spend bar, Email, Slack and PagerDuty toggles, a hard stop switch, and a live preview of the Slack message the alert posts. Renders the full demo with no props.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Spend alerts"` | Card title. |
| `project` | `string` | `"Production"` | Project or workspace the budget applies to. Used in the subtitle and the Slack message. |
| `scope` | `string` | `"Model API usage"` | What is being metered, shown in the subtitle. |
| `spend` | `number` | `3412.8` | Spend so far this period, drawn as the solid fill on the bar. |
| `forecast` | `number` | – | Projected spend at period end, drawn as the lighter fill. Defaults to a linear projection from spend and period. |
| `period` | `{ label: string; short: string; day: number; days: number; resetsOn: string }` | `{ label: "October", short: "Oct", day: 27, days: 31, resetsOn: "Nov 1" }` | Billing period used for the forecast, the crossing date and the reset copy. |
| `currency` | `string` | `"USD"` | ISO 4217 currency code for formatting. |
| `defaultValue` | `Partial<SpendAlertSettings>` | `{ budget: 5000, threshold: 80, channels: { email: true, slack: true, pagerduty: false }, hardStop: false }` | Initial settings. Missing fields fall back to the demo defaults. |
| `markers` | `number[]` | `[50, 80, 100]` | Threshold markers on the bar. The thumb snaps to them within 2% while dragging, and PageUp or PageDown jumps between them. |
| `destinations` | `Partial<Record<"email" \| "slack" \| "pagerduty", string>>` | `{ email: "finance@acme.com", slack: "#eng-spend", pagerduty: "Platform on-call" }` | Where each channel delivers. PagerDuty pages only at 100%. |
| `appName` | `string` | `"Acme Billing"` | Sender name in the Slack preview. |
| `lastSaved` | `string` | `"Last edited Oct 24 by Maya Chen"` | Footer copy while nothing has changed. |
| `onChange` | `(settings: SpendAlertSettings) => void` | – | Called on every edit. |
| `onSave` | `(settings: SpendAlertSettings, signal: AbortSignal) => Promise<void>` | – | Persist the settings. Without it the save is simulated. Reject to show the error state. |
| `onSendTest` | `(settings: SpendAlertSettings, signal: AbortSignal) => Promise<void>` | – | Send a test alert to the enabled channels. Without it the send is simulated. |
| `className` | `string` | – | Extra class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | On the threshold slider, move the alert line by 1%. |
| Shift + Arrow keys | Move the alert line by 10%. |
| PageUp / PageDown | Jump to the next or previous marker. |
| Home / End | Set the threshold to 10% or 100%. |
| ArrowUp / ArrowDown | In the budget field, change the budget by 100 (Shift for 1,000). |
| Space | Toggle a focused channel or the hard stop switch. |

## Accessibility

- The threshold is a role="slider" labelled "Alert at" with aria-valuetext giving the percent and the amount.
- The budget field is labelled and described by its helper line, which also carries the invalid and over-budget messages with aria-invalid.
- Each channel switch has its own label; the hard stop switch is labelled by its row title.
- Save and test results land in a polite live region, including "Simulated, nothing was sent" when no handler is wired.
- Status is never color alone: every tone pairs an icon with a short label.

## Motion

- Spend and forecast fills grow in once when the card scrolls into view (720ms ease-out), then follow budget changes in 160ms.
- The thumb follows the pointer 1:1 while dragging and glides 160ms on clicks, marker jumps and keys.
- Status, helper and footer lines swap with a single crossfade in one grid cell, so nothing changes size.
- Switching Slack off crossfades the preview to a placeholder inside the same box. A test send washes the preview once.
- Reduced motion keeps every end state and drops the fill growth and glides.

## Responsive behavior

- Holds from 360px to 580px. Under 440px the gutter tightens, channel destinations move under their names and the footer actions go full width.
- Every line truncates with an ellipsis rather than wrapping, so state changes never change the card height.
- The slider rail is 28px tall for touch and keeps vertical page scroll (touch-action: pan-y).

## Performance

- Bar fills animate clip-path and the thumb animates left on one element; no layout animation on text.
- One IntersectionObserver runs until the first reveal, then disconnects.

## Notes for AI

- Use for usage-based billing settings: AI model spend, cloud cost budgets, API overage alerts.
- Pass spend and period from your usage API; forecast is derived unless you pass your own.
- Wire onSave and onSendTest with the AbortSignal; the card handles loading, success, error and dirty states.
- Keep it as one card in a settings page; do not wrap it in another card.

## Related

- [Usage forecast](https://uiarc.dev/components/blocks/usage-forecast/markdown): A billing period usage chart with a forecast cone and a draggable budget that dates the crossing.
- [Usage billing](https://uiarc.dev/components/blocks/usage-billing/markdown): A usage based billing dashboard with a projected spend line, meters against limits, alerts, and an upgrade that morphs into a confirm sheet.
- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
