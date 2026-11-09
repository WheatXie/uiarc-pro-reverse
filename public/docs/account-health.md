# Account health

> A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.

- Type: Block
- Page: https://uiarc.dev/components/blocks/account-health
- Markdown: https://uiarc.dev/components/blocks/account-health/markdown

- Access: Arc Pro
- Registry id: `account-health`
- Source file: `registry/blocks/account-health/account-health.tsx`
- Built from: Button, SegmentedControl, TextShimmer
- Keywords: account health, customer health score, customer success, churn risk, renewal, qbr, nps, seat utilization, health gauge, ai summary, csm, sparkline

Drop it into an account or renewal page and pass `account` (name, plan, ARR, logo, term start and renewal date) and `periods` (one per time range, each with a score, the previous score, signals, a summary and an action). Pass `summarize(input, signal)` to return the summary text from your model. The card handles the thinking, streaming, abort and error states. Pass `onAction(action, input, signal)` to book the QBR for real, and reject it to show the retry state. `period`/`onPeriodChange` control the time range, and `asOf` fixes the countdown date. Keep the same number of trend points in every period so the sparklines morph from one to the next. With no props it plays a sample Linear Enterprise account.

## When to use

- A customer success or account page that needs a score, the signals behind it and a next step.
- Renewal prep views where the countdown and risk drivers matter more than raw metrics.
- Showing an AI written risk summary next to the evidence it was written from.

## When not to use

- Portfolio views across many accounts; use a table with a score column instead.
- Deep metric exploration with axes and ranges; use a full chart.
- Single KPI tiles with no recommendation; use a stat card.

## Installation

Account health is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/account-health
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AccountHealth } from "@/components/arc/blocks/account-health/account-health";

export function CustomerPanel({ account, periods }) {
  return (
    <AccountHealth
      account={account}
      periods={periods}
      summarize={async ({ account, period }, signal) => {
        const res = await fetch("/api/health-summary", { method: "POST", body: JSON.stringify({ id: account.name, period: period.id }), signal });
        return (await res.json()).text;
      }}
      onAction={async (action, { account }, signal) => {
        await fetch("/api/qbr", { method: "POST", body: JSON.stringify({ account: account.name }), signal });
      }}
    />
  );
}
```

## API reference

### AccountHealth

A customer success card: customer and plan, a health score gauge with trend, a renewal countdown, signal rows with sparklines and status, and an AI risk summary that ends in one recommended next step. With no props it plays a sample Linear Enterprise account.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `account` | `AccountHealthAccount` | `Linear sample` | The customer: name, plan, arr (formatted string), logo (ReactNode, about 24px), termStart and renewalDate (Date or ISO date). |
| `periods` | `AccountHealthPeriod[]` | `30d and 90d samples` | One entry per time range: id, label, spanLabel, score, previousScore, signals, summary and action. Keep the same number of trend points across periods so sparklines morph. |
| `period` | `string` | – | Controls the selected period id. Pair with onPeriodChange. |
| `defaultPeriod` | `string` | `first period` | The period selected on mount when uncontrolled. |
| `onPeriodChange` | `(period: string) => void` | – | Called when someone picks another time range. |
| `summarize` | `(input: { account, period }, signal: AbortSignal) => Promise<string>` | – | Writes the risk summary. Return the full text and the card streams it in. Aborted when the period changes or the summary is regenerated. Leave it out to use each period's summary, simulated. |
| `onAction` | `(action, input: { account, period }, signal: AbortSignal) => Promise<void> \| void` | – | Runs the recommended action, such as booking a QBR. Reject to show the error state with a retry. Leave it out to simulate it. |
| `model` | `{ name: string; mark?: ReactNode }` | `{ name: "Claude Sonnet 5.5" }` | The model credited on the summary, with its 14px mark. Defaults to the Claude mark. |
| `asOf` | `Date \| string` | `today` | The date the renewal countdown counts from. The sample account uses Oct 27, 2026. |
| `className` | `string` | – | Extra class on the card. |

### AccountHealthSignal

One signal row.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable key, shared across periods. |
| `label` (required) | `string` | – | "Product usage", "Seat utilization", "Support tickets", "NPS", "Invoice status". |
| `detail` | `string` | – | One short line of evidence: "Analytics down 18%". |
| `value` (required) | `string` | – | The headline value, right aligned in tabular numerals. |
| `status` (required) | `"good" \| "watch" \| "risk"` | – | Shown as an icon plus Good, Watch or At risk, and colors the sparkline when not good. |
| `trend` | `number[]` | – | Sparkline points, oldest first. |
| `source` | `ReactNode` | – | The source's 14px mark, such as PostHog, Okta, Zendesk, Intercom or Stripe. |
| `sourceLabel` | `string` | – | Names the source for screen readers: "From Zendesk". |

### AccountHealthAction

The recommended next step under the summary.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` (required) | `string` | – | Button label: "Schedule QBR". |
| `title` (required) | `string` | – | The recommendation as a sentence: "Schedule a QBR with Linear". |
| `reason` (required) | `string` | – | Why, in a few words: "Usage dropped 18% in Analytics". |
| `doneLabel` | `string` | – | Shown once the action has run: "Invite drafted for Tue, Nov 3, 10:00". |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the time range, regenerate and action buttons. |
| ArrowLeft / ArrowRight | Switches the time range inside the segmented control. |
| Enter / Space | Regenerates the summary or runs the recommended action. |

## Accessibility

- The card is a labelled section; the gauge is one image with the score and band in its label.
- Every status pairs an icon with a word (Good, Watch, At risk, Needs attention), never color alone.
- Signal sources are named for screen readers; sparklines are decorative and hidden.
- A polite live region reports the action result and says when it was simulated ("Simulated, no invite was sent").
- The summary is aria-busy while it is written; the action row stays inert until it appears.

## Motion

- On first view the gauge sweeps and the score counts up from one motion value (560ms ease-out), sparklines draw in with a 40ms stagger, and the term bar fills.
- The summary thinks for about 0.9s with a shimmer on the label, then streams 3 to 6 words every 34ms, each chunk fading in over 140ms.
- Switching the time range morphs each sparkline point to point and crossfades the trend line; no element changes size.
- Reduced motion jumps to end states, shows the summary at once and keeps all feedback.

## Responsive behavior

- Holds 600px at most and fills narrower containers.
- Below 520px card width the sparklines step aside and padding drops to 16px; below 440px the score and renewal stack.
- Labels and details truncate with an ellipsis; values and status keep fixed columns.

## Performance

- Pure SVG and CSS; one motion value drives the gauge and number.
- The entrance starts on first intersection and runs once; no loops besides the label shimmer while thinking.
- Summary runs are aborted on period change, regenerate and unmount.

## Notes for AI

- Pick this for a customer success, account management or renewal view about one customer.
- Pass real signals per period; keep 5 signals or fewer so the card stays one glance.
- Return plain text from summarize; the card handles thinking, streaming, abort and error states.
- The action button uses the accent; keep destructive actions out of this slot.

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [AI insight card](https://uiarc.dev/components/blocks/ai-insight-card/markdown): A KPI card that explains itself. Explain streams a short reason for the change and ranks three drivers with contribution bars. A numbered annotation lights up on the sparkline as each driver is read, and follow-up chips ask the next question in place.
- [Call insights](https://uiarc.dev/components/blocks/call-insights/markdown): A sales call insights card where talk time, flagged pricing, competitor and objection moments, an AI summary and owned next steps sit in one view. Selecting a moment plays its quote, and checking off next steps lowers the deal risk.
- [Goal tracker](https://uiarc.dev/components/blocks/goal-tracker/markdown): A team goals card where objectives open into key results with owners, confidence and progress bars. A weekly check-in updates a value, confidence and note in place, fills the bar and recalculates the objective, and a quarter selector steps from last quarter's final scores to next quarter's planning.
- [Generation stats](https://uiarc.dev/components/generation-stats/markdown): A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
