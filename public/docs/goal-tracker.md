# Goal tracker

> A team goals card where objectives open into key results with owners, confidence and progress bars. A weekly check-in updates a value, confidence and note in place, fills the bar and recalculates the objective, and a quarter selector steps from last quarter's final scores to next quarter's planning.

- Type: Block
- Page: https://uiarc.dev/components/blocks/goal-tracker
- Markdown: https://uiarc.dev/components/blocks/goal-tracker/markdown

- Access: Arc Pro
- Registry id: `goal-tracker`
- Source file: `registry/blocks/goal-tracker/goal-tracker.tsx`
- Built from: Button, Avatar, SegmentedControl
- Keywords: okr, goals, objectives, key results, goal tracker, check-in, progress bar, quarterly goals, confidence, lattice, team goals

Pass `quarters` (each with id, label, status of active, closed or planning, optional meta and footnote, and objectives with key results). For each key result, set start, target and current in the metric's own units. The card works out progress itself, so a target below the start value (latency, cost) works with no extra setup. Save check-ins in `onCheckIn(checkIn, { signal })`. The card updates once the promise resolves. If it throws, the form shows "Not saved" and a Retry button. Control the selector with `quarterId` and `onQuarterChange`, and set `autoPlay={false}` in production. Helpers (`keyResultProgress`, `objectiveProgress`, `formatGoalValue`) and `sampleGoalQuarters` are exported.

## When to use

- Showing a team's quarterly objectives and key results with owners and confidence.
- Collecting a lightweight weekly check-in (value, confidence, note) without leaving the page.
- Comparing the active quarter against last quarter's final scores.

## When not to use

- A single KPI with a trend line; use a metric or stat card.
- Task or project tracking with assignees and due dates; use a task list or kanban block.
- Org-wide goal trees with parent and child alignment; this card is one level deep.

## Installation

Goal tracker is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/goal-tracker
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GoalTracker, type GoalCheckIn, type GoalQuarter } from "@/components/arc/blocks/goal-tracker/goal-tracker";

export function TeamGoals({ quarters }: { quarters: GoalQuarter[] }) {
  return (
    <GoalTracker
      title="Platform goals"
      quarters={quarters}
      onCheckIn={async (checkIn: GoalCheckIn, { signal }) => {
        const response = await fetch("/api/check-ins", { method: "POST", body: JSON.stringify(checkIn), signal });
        if (!response.ok) throw new Error("Check-in failed");
      }}
    />
  );
}
```

## API reference

### GoalTracker

A team goals card. Objectives expand into key results with owners, confidence and progress bars; a key result opens a weekly check-in that updates its value, confidence and note, animates the bar and recalculates the objective. A quarter selector steps between closed, active and planning quarters. With no props it shows sample Q4 2026 goals and plays one check-in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `quarters` | `GoalQuarter[]` | `sampleGoalQuarters` | Quarters, oldest first. Each has id, label, status (active, closed or planning), optional meta and footnote lines, and objectives. Seeds the card; saved check-ins update it in place. |
| `title` | `string` | `"Company goals"` | Card heading. |
| `quarterId` | `string` | – | Selected quarter id. Pair with onQuarterChange to control the selector. |
| `defaultQuarterId` | `string` | `the active quarter` | Quarter shown first when uncontrolled. |
| `onQuarterChange` | `(quarterId: string) => void` | – | Called when the person steps to another quarter. |
| `onCheckIn` | `(checkIn: GoalCheckIn, context: { signal: AbortSignal }) => Promise<void> \| void` | – | Saves a check-in: quarterId, objectiveId, keyResultId, value, previousValue, confidence and note. Throw to show the error state with Retry; the signal aborts when the person cancels. Leave it out to simulate a save. |
| `autoPlay` | `boolean` | `true with sample data, false with your own` | Plays one scripted check-in the first time the card scrolls into view. Any pointer or key input hands control back at once. |
| `className` | `string` | – | Extra class on the card. |

### GoalKeyResult

One measurable result. Progress runs from start to target, so a target below start (latency, cost, ticket counts) also works.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id, returned in GoalCheckIn. |
| `title` (required) | `string` | – | What success looks like, such as "Checkout p95 latency under 400 ms". |
| `start` (required) | `number` | – | Value when the quarter began. |
| `target` (required) | `number` | – | Value that counts as 100%. |
| `current` (required) | `number` | – | Latest checked in value. |
| `prefix` | `string` | – | Text before the number, such as "$". |
| `unit` | `string` | – | Text after the number, such as "%", " ms" or "k". |
| `decimals` | `number` | `0` | Decimal places shown and pre-filled in the check-in. |
| `confidence` (required) | `"on-track" \| "at-risk" \| "off-track"` | – | Owner's confidence, shown as an icon and label and as the bar color. |
| `source` | `{ name: string; icon?: ReactNode }` | – | Where the number is synced from, shown as a small mark (Stripe, Linear, Vercel in the sample). |

### GoalObjective

An objective with its owner and key results. Progress is the mean of its key results; confidence is their rounded mean.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id. |
| `title` (required) | `string` | – | The objective. |
| `owner` (required) | `{ name: string; avatar?: string }` | – | Owner shown with an avatar; initials when there is no image. |
| `keyResults` (required) | `GoalKeyResult[]` | – | Two to five key results reads best. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the quarter buttons, objectives, key results and the footer Check in button. |
| Enter / Space | On an objective, expands or collapses it. On a key result, opens its check-in with the value selected. |
| Arrow keys | In the check-in, moves between On track, At risk and Off track. |
| Enter | In the check-in, saves. |
| Escape | Cancels the check-in and returns focus to the key result. |

## Accessibility

- Objectives are disclosure buttons with aria-expanded and aria-controls; collapsed bodies are inert.
- Each key result button has a label with its value, target, progress and confidence, so the visual bar is not the only source.
- Confidence is always an icon plus a text label, never color alone.
- The check-in is a labelled form; the hidden form and hidden key results are inert so focus never lands on invisible controls.
- A polite live region announces saves, errors and the recalculated objective, and says when a save was simulated.

## Motion

- Bars fill once when the card first scrolls into view, then tween to new values (560ms ease-out) with percentages counting in tabular numerals.
- The objective bar follows its key result 120ms later so cause and effect read clearly.
- Key results and the check-in form share one grid cell and crossfade (100ms out, 160ms in), so the card never changes height when the form opens.
- Objective bodies open with a bounce-free 240ms spring on measured height; quarters crossfade with an 8px directional shift and the empty state borrows the previous height.
- Reduced motion keeps the end states, crossfades and feedback, and drops the fill travel, shifts and the scripted demo.

## Responsive behavior

- Fluid from 360px to 640px wide using container queries, so it adapts to its column rather than the viewport.
- Below 480px the bars shorten and the confidence picker moves under the value field; below 380px owner names collapse to avatars.
- Titles truncate with an ellipsis; numbers, labels and bars never wrap or shift.

## Performance

- Progress animations run on motion values and clip-path, so numbers and bars update without React re-renders.
- One IntersectionObserver for the first fill and one ResizeObserver for the quarter height; both disconnect on unmount.
- Designed for up to about five objectives with five key results each per quarter.

## Notes for AI

- Use for OKRs, team goals or quarterly targets inside a product: a settings or team page, a dashboard column, or a weekly review.
- Pass real data through quarters and persist check-ins in onCheckIn; the card updates optimistically after the promise resolves, and shows Retry if it throws.
- Set start, target and current in the metric's own units; the card computes progress, so decreasing targets need no special handling.
- Set autoPlay={false} in production. The sample data plays one demo check-in by default.
- Keep one card per team; for many teams, stack cards rather than adding more objectives to one card.

## Related

- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Activity feed](https://uiarc.dev/components/blocks/activity-feed/markdown): A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button, expandable details, and a mark all read sweep.
- [Account health](https://uiarc.dev/components/blocks/account-health/markdown): A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
