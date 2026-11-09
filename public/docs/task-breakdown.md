# Task breakdown

> A goal input where AI breaks one sentence into a plan: tasks stream in with estimates, owners and dependencies, and a live timeline shows whether the deadline holds. Reorder, edit or regenerate any task, then send the plan to Linear or Jira with progress for each issue and links.

- Type: Block
- Page: https://uiarc.dev/components/blocks/task-breakdown
- Markdown: https://uiarc.dev/components/blocks/task-breakdown/markdown

- Access: Arc Pro
- Registry id: `task-breakdown`
- Source file: `registry/blocks/task-breakdown/task-breakdown.tsx`
- Built from: Button, TextShimmer
- Keywords: task breakdown, ai project plan, goal to tasks, linear export, jira export, estimates, critical path, timeline, drag reorder, ai planning, work breakdown

Drop `<TaskBreakdown />` into a planning surface. With no props it plays a simulated plan. Pass `generate(goal, signal)` returning `TaskDraft[]` (id, title, estimate in working days, ownerId, dependsOn) and the block streams the rows in, works out the critical path, the ship date and the slack against `deadline`, and keeps them current as people edit. Pass `createIssue(target, task, signal)` returning `{ key, url }` to create real Linear or Jira issues one by one in list order. `regenerate` rewrites a single task, `owners` supplies your team's portraits, and `onTasksChange` and `onSent` report edits and finished exports.

## When to use

- Turning a goal or brief into a scoped project plan inside a PM, CRM or internal tool.
- Exporting AI drafted work to Linear or Jira with a review step before anything is created.
- Showing whether a plan fits a deadline and updating that as people edit estimates.

## When not to use

- Showing an agent working through steps live; use agent-plan.
- A full backlog or board with many projects; use a dedicated table or kanban.
- Single task creation from a prompt; a simple composer is lighter.

## Installation

Task breakdown is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/task-breakdown
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TaskBreakdown } from "@/components/arc/blocks/task-breakdown/task-breakdown";

export function PlanFromGoal() {
  return (
    <TaskBreakdown
      deadline="2026-12-01"
      generate={async (goal, signal) => {
        const res = await fetch("/api/plan", { method: "POST", body: JSON.stringify({ goal }), signal });
        return res.json();
      }}
      createIssue={async (target, task, signal) => {
        const res = await fetch(`/api/${target}/issues`, { method: "POST", body: JSON.stringify(task), signal });
        return res.json(); // { key: "BIL-241", url: "https://linear.app/..." }
      }}
    />
  );
}
```

## API reference

### TaskBreakdown

A goal input that turns one sentence into a project plan. Press Break down and, after a short "Planning tasks" shimmer, tasks stream into reserved rows in fast chunks, each with an estimate in working days, an owner avatar and its dependencies ("After 2, 3"). A summary above the list counts tasks and total effort, and a timeline bar draws the critical path from the start date toward the deadline marker with "Ships Nov 17, 10d early" or a warning when the plan runs late; both update live as rows land and as tasks change. Rows can be edited in place (title and estimate), reordered by dragging the grip or with the arrow keys, and regenerated one at a time. A dependency placed below its task turns into a "Waits on 5" warning. Send to Linear or Send to Jira creates one issue per task with a spinner per row, then swaps each row's actions for its issue key link. With no props it plays a simulated plan for "Launch usage-based billing by Dec 1".

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultGoal` | `string` | `"Launch usage-based billing by Dec 1"` | Goal shown in the input on first render. |
| `defaultTasks` | `TaskDraft[]` | – | Tasks to open with. The block then starts ready instead of empty and does not auto start. A TaskDraft has id, title, estimate (working days, steps of 0.5), ownerId and dependsOn (task ids). |
| `owners` | `TaskOwner[]` | `demoOwners` | People tasks can be assigned to: id, name and an optional avatar URL (initials otherwise). |
| `generate` | `(goal: string, signal: AbortSignal) => Promise<TaskDraft[]>` | – | Breaks a goal into tasks. Rows stream in visually as soon as it resolves. Stop aborts the signal. Simulated with the sample plan when omitted. |
| `regenerate` | `(task: TaskDraft, context: { goal: string; tasks: TaskDraft[] }, signal: AbortSignal) => Promise<Partial<Omit<TaskDraft, "id">>>` | – | Rewrites one task. Return the fields to replace; the id and, unless returned, dependencies are kept. Simulated when omitted. |
| `createIssue` | `(target: "linear" \| "jira", task: TaskDraft, signal: AbortSignal) => Promise<{ key: string; url: string }>` | – | Creates one issue, called once per task in list order. A rejection marks that row failed with a retry button. Simulated (BIL-241 and up, PAY-318 and up) when omitted. |
| `targets` | `("linear" \| "jira")[]` | `["linear", "jira"]` | Trackers offered in the footer. The first one is the primary button. |
| `startDate` | `Date \| string` | `"2026-10-27"` | First working day of the plan. Weekends are skipped. |
| `deadline` | `Date \| string` | `"2026-12-01"` | Ship-by date, drawn as the marker on the timeline and used for the early or late label. |
| `model` | `string` | `"Claude Sonnet 5.5"` | Model named in the footer next to the Claude mark. |
| `autoStart` | `boolean` | `true without defaultTasks` | Run the breakdown once when the block scrolls into view. |
| `onTasksChange` | `(tasks: TaskDraft[]) => void` | – | Called after every edit, reorder or regeneration. |
| `onSent` | `(target: "linear" \| "jira", issues: Record<string, { key: string; url: string }>) => void` | – | Called once every task has an issue, keyed by task id. |
| `className` | `string` | – | Class on the root card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the goal input, breaks the goal down. While drafting the same button stops. |
| ArrowUp / ArrowDown | On a row's grip, moves the task up or down; focus stays on the grip. |
| Enter | While editing a row, saves the title and estimate. |
| Escape | While editing a row, cancels the edit. |
| Tab | Moves through the goal, each row's grip, regenerate and edit buttons, issue links and the footer actions. |

## Accessibility

- The card is a labelled section; the goal input has a label and the task list is an ordered list named Tasks.
- A polite live region announces planning, drafted counts, saves, moves ("Moved to position 3 of 7"), rewrites and issue creation, and says when an action was simulated.
- Each grip is a button named with the task and its position, and explains the arrow keys; row actions are named with the task number.
- Status never relies on color: late plans and blocked dependencies pair a warning icon with text, created issues show their key.
- Rows that are streaming or regenerating set aria-busy; the timeline bar has a text label with the ship date and the deadline.

## Motion

- Rows stream three words per 36ms tick, each chunk fading in over 140ms; meta fades in when the title completes. The thinking shimmer lasts under a second.
- Reordering uses bounce-free springs (visualDuration .24, bounce 0) on position only, so text is never scaled.
- Titles, estimates, owners, dependency labels and footer status swap with one crossfade (100ms out, 160ms in, 2px rise).
- Timeline segments glide their left and width on the same bounce-free spring; the list area reserves seven rows so the card never changes height between empty, drafting and ready.
- Reduced motion skips streaming and travel and keeps every end state and status.

## Responsive behavior

- The card fills its container up to 640px and holds at 360px without horizontal scroll.
- Below 520px container width the dependency column hides; below 440px the footer buttons shorten to the tracker name with their marks.
- Titles truncate with an ellipsis; row actions are always visible on touch screens.

## Performance

- Streaming is one interval and one state update per tick; it stops as soon as the last row lands.
- The schedule is a memoized dependency walk, linear in the number of tasks.
- Auto start waits for an IntersectionObserver and runs once; nothing loops off screen.

## Notes for AI

- Choose this when a user states a goal and needs a plan with estimates, owners and dependencies they can push to a tracker; it is a planning surface, not an execution log.
- Wire generate to a model call that returns TaskDraft[] with stable ids and dependsOn ids; the block computes the critical path and ship date itself.
- createIssue is called sequentially per task, so issue keys come back in list order; return the tracker's real key and URL.
- Owners are matched by ownerId; pass your team as owners with portrait URLs.
- For an agent that executes steps after approval use agent-plan instead.

## Related

- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
