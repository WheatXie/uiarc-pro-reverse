# AI insight card

> A KPI card that explains itself. Explain streams a short reason for the change and ranks three drivers with contribution bars. A numbered annotation lights up on the sparkline as each driver is read, and follow-up chips ask the next question in place.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-insight-card
- Markdown: https://uiarc.dev/components/blocks/ai-insight-card/markdown

- Access: Arc Pro
- Registry id: `ai-insight-card`
- Source file: `registry/blocks/ai-insight-card/ai-insight-card.tsx`
- Built from: Button, TextShimmer
- Keywords: ai insight, kpi card, explain metric, revenue explanation, drivers, sparkline, analytics ai, metric annotation, why did revenue drop, dashboard card

Pass your KPI as `metric`: totals, the current and previous series, and point labels. Pass `followUps` for the chips. Wire `explain({ metric, followUp, signal })` to your analysis endpoint. It should resolve with `{ segments, drivers }`, where each driver has a signed delta and the series index its annotation marks. Write one text segment per driver, with `driver` set and in rank order, so the chart lights up as the reader reaches it. The signal aborts on Stop, Hide or a new question. If the promise rejects, the card shows an error row with Retry. Use `lowerIsBetter` for churn or cost metrics so a rise reads red, and `format` for metrics that are not currency. With `explain` set, autoPlay is off by default, so the card never calls the model on its own.

## When to use

- A dashboard KPI where readers ask why it moved, such as net revenue, MRR, signups or churn.
- Weekly business reviews and finance dashboards that want an explanation next to the number.
- Products adding AI analysis to existing analytics without a separate chat.

## When not to use

- Open ended questions across many tables: use ask-your-data.
- A plain number with no explanation: use metric-card or stat-card.
- Dense multi series charts: use a full chart component.

## Installation

AI insight card is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-insight-card
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiInsightCard } from "@/components/arc/blocks/ai-insight-card/ai-insight-card";

export function RevenueCard({ metric }) {
  return (
    <AiInsightCard
      metric={metric}
      followUps={[{ id: "plan", label: "Break down by plan" }]}
      explain={async ({ metric, followUp, signal }) => {
        const res = await fetch("/api/insights/explain", {
          method: "POST",
          body: JSON.stringify({ metric: metric.label, followUp: followUp?.id }),
          signal,
        });
        if (!res.ok) throw new Error("The analysis service did not respond.");
        return res.json(); // { segments: [{ text, driver? }], drivers: [{ id, label, delta, point }] }
      }}
    />
  );
}
```

## API reference

### AiInsightCard

A KPI card with a sparkline that explains its own change: Explain streams a short reason, ranks three drivers with contribution bars and lights up a numbered chart annotation as each driver is read. Follow-up chips ask the next question in place.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `metric` | `InsightMetric` | `sampleMetric` | The KPI: label, period, value, previous, comparisonLabel, series, previousSeries, points (tooltip labels), legend labels, an optional format function and lowerIsBetter to flip delta colors. |
| `insight` | `Insight` | `sampleInsight` | The local answer for Explain: segments of text (a segment with `driver` lights up that driver) and up to three ranked drivers, each with a signed delta and the series index its annotation marks. |
| `followUps` | `InsightFollowUp[]` | `sampleFollowUps` | Follow-up chips under the answer. Each has an id, a label and an optional local insight. The chip showing its answer reads as pressed. |
| `explain` | `(request: { metric, followUp?, signal }) => Promise<Insight>` | – | Fetch a real answer. Resolve with the full insight; the card streams it in chunks and syncs the annotations. The signal aborts on Stop, Hide or a new question. A rejection shows the error row with Retry. |
| `onExplain` | `(followUp?: InsightFollowUp) => void` | – | Called when Explain is pressed (no argument) or a follow-up is picked. |
| `autoPlay` | `boolean` | `true without explain` | Plays Explain and each follow-up on a loop while the card is on screen, until the reader interacts. Off with reduced motion. |
| `thinkingLabel` | `string` | `"Reading invoices and renewals"` | Shimmering status line while the answer is prepared. |
| `source` | `{ label: string; icon?: ReactNode } \| null` | `Stripe billing` | Data source in the footer. Pass null to hide it. |
| `model` | `{ label: string; icon?: ReactNode } \| null` | `Claude Sonnet 5.5` | Model in the footer. Pass null to hide it. |
| `className` | `string` | – | Class on the card root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Explain (Stop while streaming, Hide when open), the chart, Retry and the follow-up chips. |
| Enter / Space | Explains the change, stops a stream, hides the panel or asks a follow-up. |
| Left / Right | With the chart focused, steps through the points and announces each value. |
| Home / End | Jumps to the first or last point. |
| Escape | Clears the chart readout. |

## Accessibility

- The card is a labelled section; Explain carries aria-expanded and aria-controls for the answer panel.
- A polite live region announces when the answer starts, the full answer when it is ready, Stop and errors. Without `explain` it says the answer is simulated from sample data.
- Deltas carry a sign as well as color, and unread driver rows are hidden from assistive tech until the answer reaches them.
- The chart is a focusable group with arrow key reading; values are announced through its own live region.
- Follow-up chips use aria-pressed for the answer on screen and are disabled while a stream runs.

## Motion

- The panel opens and closes on a critically damped 260ms spring; answers of a different length spring to their height. No bounce.
- The answer streams 3 to 7 words every 34ms, each chunk only fading in over 140ms. Its full text is reserved underneath, so the card never grows while streaming.
- Annotations fade and scale in over 200ms as their driver is read; the driver being read takes the accent on its badge, dot, guide, rank and underline.
- Contribution bars grow to their share over 240ms ease-out; skeletons crossfade to labels in 160ms.
- Reduced motion: the answer appears whole after the short thinking state, transitions cut, and the demo loop stays off.

## Responsive behavior

- The card fills its container up to 640px. Under 460px the legend hides and the contribution bars shorten, so driver labels keep their room and truncate with an ellipsis.
- Follow-up chips wrap onto a second row on phones. The chart redraws at the container width with crisp strokes.
- Touch scrubs the chart only while the finger is down, so vertical page scrolling still works.

## Performance

- The chart is one inline SVG with two paths; annotations are absolutely positioned spans with CSS transitions.
- Streaming updates one counter per tick; tokenizing runs once per answer.
- The demo loop waits while the card is off screen and stops for good on the first interaction.

## Notes for AI

- Use for one KPI that needs a why: revenue, signups, churn, pipeline. Return drivers that add up to the change, ranked by absolute size, at most three.
- Point each driver at the series index where it shows, and write one text segment per driver with `driver` set, in rank order, so the chart lights up as the reader reaches it.
- Pass lowerIsBetter for costs and churn so a rise reads red. Pass `format` for non-currency metrics.
- With a real `explain`, autoPlay defaults to off so the card never spends model calls on its own.

## Related

- [Ask your data](https://uiarc.dev/components/ask-your-data/markdown): A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.
- [Metric card](https://uiarc.dev/components/metric-card/markdown): A compact summary for a number that needs context.
- [Sparkline](https://uiarc.dev/components/sparkline/markdown): Show a compact trend beside a value.
- [Account health](https://uiarc.dev/components/blocks/account-health/markdown): A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
