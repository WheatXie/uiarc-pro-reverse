# Lead scoring

> A lead scoring card where inbound B2B leads are ranked by an AI fit score, each with a score ring and a one-line reason. Open a lead to see its signals and score breakdown, then push it to HubSpot or Salesforce.

- Type: Block
- Page: https://uiarc.dev/components/blocks/lead-scoring
- Markdown: https://uiarc.dev/components/blocks/lead-scoring/markdown

- Access: Arc Pro
- Registry id: `lead-scoring`
- Source file: `registry/blocks/lead-scoring/lead-scoring.tsx`
- Built from: Button, SegmentedControl, TextShimmer, Tooltip
- Keywords: lead scoring, ai lead scoring, inbound leads, sales qualification, fit score, crm, hubspot, salesforce, sdr queue, b2b sales

Pass your leads newest first, each with a weighted `breakdown`, so the ring and the bars always agree (or set `score` directly). Mark a lead `scoring` while your model works on it. Wire `onPush(lead, crm, signal)` to your backend: resolve for the done state, reject for the error and retry state. `crms` picks the destinations, and `sort`/`onSortChange` control the order. `onRescore` shows a rescore button. With no props it plays a short intro once it scrolls into view: scores land, the list re-sorts by score, the top lead opens and is pushed to HubSpot. Every push in the demo is simulated.

## When to use

- A sales inbox or SDR queue that ranks new inbound leads by fit.
- Showing why a model scored a lead, with signals and a weighted breakdown.
- Handing a qualified lead to HubSpot or Salesforce from the same view.

## When not to use

- Large tables of hundreds of leads with filters and bulk edits; use a data table.
- Enriching columns of company data; use enrich-column.
- Tracking the health of existing customers; use account-health.

## Installation

Lead scoring is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/lead-scoring
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LeadScoring } from "@/components/arc/blocks/lead-scoring/lead-scoring";

export function InboundLeads({ leads }: { leads: Lead[] }) {
  return (
    <LeadScoring
      leads={leads}
      onPush={async (lead, crm, signal) => {
        const res = await fetch(`/api/crm/${crm}/leads`, { method: "POST", body: JSON.stringify({ id: lead.id }), signal });
        if (!res.ok) throw new Error("Push failed");
      }}
    />
  );
}
```

## API reference

### LeadScoring

A card of inbound leads ranked by an AI fit score. Each row shows the company mark, the person, a score ring and the model's one-line reason; opening a row shows signal chips, the weighted score breakdown and a push to HubSpot or Salesforce. With no props it plays a short intro on first view with sample leads and simulated pushes.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `leads` | `Lead[]` | `leadScoringSamples` | Leads to show, newest first. Each lead has id, name, title, company, mark, received, reason, and optional signals, breakdown, score, scoring and pushedTo. |
| `title` | `string` | `"Inbound leads"` | Card title. |
| `description` | `ReactNode` | – | Line under the title. Defaults to the scoring model and the lead count. |
| `sort` | `"score" \| "newest"` | – | Controlled sort. Newest keeps the array order. |
| `defaultSort` | `"score" \| "newest"` | `"newest" while auto playing, else "score"` | Starting sort when uncontrolled. |
| `onSortChange` | `(sort: LeadSort) => void` | – | Called when the sort control changes. |
| `crms` | `LeadCrmId[]` | `["hubspot", "salesforce"]` | CRMs a lead can be pushed to. The first is the default destination; one entry hides the picker. |
| `onPush` | `(lead: Lead, crm: LeadCrmId, signal: AbortSignal) => Promise<void>` | – | Creates the contact and deal. Resolve for the done state, reject for the error state with a retry. The signal aborts on unmount. Without it pushes are simulated and announced as such. |
| `onRescore` | `() => void` | – | Shows a rescore button. Mark leads scoring while you rescore them. The sample demo rescores on its own. |
| `autoPlay` | `boolean` | `true for sample data` | Plays the intro once when the card scrolls into view: scores land, the list sorts by score, the top lead opens and is pushed to the first CRM. |
| `defaultExpandedId` | `string \| null` | `null` | Lead open on first render. |
| `className` | `string` | – | Class on the card. |

### Lead

One inbound lead.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id, used as the React key and for push state. |
| `name` (required) | `string` | – | Person's name. |
| `title` (required) | `string` | – | Job title. Hidden in the row on narrow cards. |
| `company` (required) | `string` | – | Company name. |
| `mark` | `LeadCompanyMarkId \| ReactNode` | – | "vercel", "ramp", "linear", "notion", "retool", "figma", or your own 20px logo node. Falls back to a monogram. |
| `received` (required) | `string` | – | Arrival time, already formatted ("6m ago"). |
| `reason` (required) | `string` | – | The model's one-line reason for the score. |
| `signals` | `{ kind: LeadSignalKind; label: string }[]` | – | Chips in the open row. Kinds: pricing, team, hiring, email, demo, stack, docs, repo, security. |
| `breakdown` | `{ id: string; label: string; value: number; weight: number }[]` | – | Score factors, 0 to 100, with weights that add up to 1. The score is their weighted sum unless score is set. |
| `score` | `number` | – | 0 to 100. Overrides the breakdown sum. |
| `scoring` | `boolean` | – | Still being scored: the ring spins and the reason shimmers. |
| `pushedTo` | `LeadCrmId[]` | – | CRMs the lead already lives in. Shows Synced in the row. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the sort control, rescore, each lead row and the open row's controls. |
| Enter / Space | Opens or closes the focused lead. |
| ArrowDown / ArrowUp | Moves focus between lead rows. |
| Home / End | Jumps to the first or last lead row. |
| ArrowLeft / ArrowRight | Switches the CRM destination inside the open row. |

## Accessibility

- Each row is a button with aria-expanded and aria-controls; its label reads name, title, company, score, fit band and the reason.
- The score ring is decorative; the number and the fit band are in the row label and the breakdown list label.
- Status is never color alone: done and error states pair an icon with a short label.
- The CRM picker is a radio group with roving focus and named options.
- A polite live region announces pushes, errors and rescoring, and says when a push was simulated.

## Motion

- Re-sorting glides each row to its new place with a bounce-free spring (position only, text is never scaled).
- The ring arc and number share one motion value, so they count up together in about 640ms with tabular numerals.
- Opening a row springs the measured height with no bounce; breakdown bars grow with a 30ms stagger.
- Time, synced, reason and status swaps are single crossfades in a fixed slot, so nothing changes size.
- The scoring spinner pauses off screen. Reduced motion keeps every end state and drops travel, counting and the spinner.

## Responsive behavior

- Fits 360px to 640px. Below 460px the job title leaves the row, details start at the card edge and the push button fills the row.
- Names, roles and reasons truncate with an ellipsis; scores and times keep fixed slots.

## Performance

- Designed for a short queue of 5 to 20 leads; every row is rendered.
- Ring counting runs on motion values without React renders.

## Notes for AI

- Use for ranking inbound leads, trial signups or accounts by an AI fit score with a reason and a CRM handoff.
- Pass leads newest first; let the score come from a weighted breakdown so the bars and the ring always agree.
- Keep the reason to one short line of evidence (funding stage, team size, intent), not a paragraph.
- Wire onPush to your backend; never call a CRM from the client with secret keys.

## Related

- [Account health](https://uiarc.dev/components/blocks/account-health/markdown): A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.
- [Enrich column](https://uiarc.dev/components/enrich-column/markdown): An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.
- [Call insights](https://uiarc.dev/components/blocks/call-insights/markdown): A sales call insights card where talk time, flagged pricing, competitor and objection moments, an AI summary and owned next steps sit in one view. Selecting a moment plays its quote, and checking off next steps lowers the deal risk.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Connector setup](https://uiarc.dev/components/connector-setup/markdown): A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
