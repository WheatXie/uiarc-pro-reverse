# Agent tasks

> A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-tasks
- Markdown: https://uiarc.dev/components/blocks/agent-tasks/markdown

- Access: Arc Pro
- Registry id: `agent-tasks`
- Source file: `registry/blocks/agent-tasks/agent-tasks.tsx`
- Built from: Button, Kbd, Segmented control, Tooltip
- Keywords: background agents, coding agent, agent tasks, task queue, cloud agent, pull request, diff stat, ci checks, step log, changed files, retry, cancel, archive, repository picker, branch picker, model picker, ai agent dashboard

Pass tasks and onStart to connect your agent runner, and onCreatePullRequest for the review step; with no props it simulates a few runs.

## When to use

- A product surface where people hand coding tasks to background agents and come back later to review, open a pull request, retry or archive.
- Dashboards for automated maintenance runs, such as dependency upgrades, flaky test fixes or codemods, where each run ends in a branch with a diff and checks.
- Any queue of long running agent jobs where the current step, the elapsed time and a clear finished state matter more than a transcript.

## When not to use

- Use agent-run to follow one live agent run in detail, with its plan, tool calls and output.
- Use code-review when people need to read the diff line by line and leave comments; this block only summarizes the change.
- Use agent-approvals when the agent pauses for a person to approve a risky action before it continues.
- Use agent-routines for scheduled, recurring agent jobs rather than one-off tasks.
- Use ai-composer for a chat style prompt box without a task list.

## Installation

Agent tasks is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-tasks
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentTasks } from "@/components/arc/blocks/agent-tasks/agent-tasks";

export function BackgroundAgents({ tasks, repositories }) {
  return (
    <AgentTasks
      tasks={tasks}
      repositories={repositories}
      onStart={({ prompt, repo, branch, model }) => api.tasks.create({ prompt, repo, branch, model })}
      onCreatePullRequest={async task => {
        const pr = await api.tasks.openPullRequest(task.id);
        return { number: pr.number, url: pr.html_url };
      }}
      onCancel={task => api.tasks.cancel(task.id)}
      onRetry={task => api.tasks.retry(task.id)}
      onArchive={task => api.tasks.archive(task.id)}
    />
  );
}

// A running task streams its current step; a finished one carries files and checks.
const task = {
  id: "task_8f2",
  title: "Fix the flaky checkout test in CI",
  repo: "arc-ui/web",
  branch: "fix/flaky-checkout-test",
  baseBranch: "main",
  model: "claude-opus-5-5",
  status: "running",
  startedAt: Date.parse("2026-10-20T09:14:00Z"),
  step: "Running tests",
  steps: [{ text: "Installed dependencies with pnpm", state: "done", seconds: 38 }, { text: "Running tests", state: "active" }],
};
```

## API reference

### AgentTasks

A home for background coding agents. A composer takes the task, a repository, a branch and a model; Start inserts a card at the top that moves through queued, setting up environment and running, with the live step shimmering, until it is ready for review with a diff stat, the changed file count and the checks. Create pull request turns the button into the PR number with the GitHub mark. Filter tabs with rolling counts split the list into all, running, ready for review and merged; each card expands in place to show its step log and changed files, and running tasks can be cancelled, failed or cancelled ones retried and finished ones archived with undo. Without `tasks` the block runs a simulated demo and says so to assistive technology.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tasks` | `AgentTask[]` | – | The tasks to show, newest first. Passing it makes the list controlled: nothing is simulated, every action calls back and you update the tasks. Each task has id, title, repo, branch, model (an id from `models`), status, startedAt (epoch ms) and optionally baseBranch, finishedAt, step (the live line), steps, files, checks, pullRequest and error. Leave it out for the demo. |
| `repositories` | `Repository[]` | `sampleRepositories` | Repositories for the composer as { name, branches, defaultBranch }. Picking a repository resets the branch to its default. |
| `models` | `AgentModel[]` | `sampleModels` | Models for the composer chip as { id, name, short, provider }, where provider is "anthropic", "openai" or "google" and picks the mark. The first model is the default. The sample list is Claude Opus 5.5, Claude Sonnet 5.5, Claude Fable 5.1, GPT-6.1 Sol and Gemini 4 Argon. |
| `onStart` | `(request: StartRequest) => void \| Promise<void>` | – | Called with { prompt, repo, branch, model } when someone presses Start or Command Enter. Reject to keep the prompt and show an inline error. In the demo it is called before the simulated run begins. |
| `onCreatePullRequest` | `(task: AgentTask) => PullRequest \| Promise<PullRequest>` | – | Opens a pull request for a task that is ready for review and returns { number, url?, state? }. The button shows a spinner while it runs, then morphs into "PR #number open"; with a url the result is a link. Throw to show Try again. Without it the preview simulates PR #482 onwards. |
| `onCancel` | `(task: AgentTask) => void` | – | Called when someone cancels a queued, setting up or running task. In the demo the run stops and the card reads Cancelled. |
| `onRetry` | `(task: AgentTask) => void` | – | Called when someone retries a failed or cancelled task. In the demo the card restarts from queued in place. |
| `onArchive` | `(task: AgentTask) => void` | – | Called when someone archives a finished task. The card leaves the list right away and an Undo line stays for six seconds; undo only restores it locally, so treat archive as reversible on your side. |
| `defaultFilter` | `"all" \| "running" \| "review" \| "merged"` | `"all"` | The filter tab shown first. |
| `className` | `string` | – | Class on the root element, for width or a max height with your own scrolling. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the task field, the repository, branch and model chips, Start, the filter tabs, then each card's toggle and its actions. |
| Command Enter / Control Enter | In the task field, starts the task. |
| Enter, Space | On a chip, opens its menu. On a card, expands or collapses the step log and changed files. On an action, runs it. |
| Arrow up / Arrow down | Inside an open chip menu, moves between options; Enter picks one and Escape closes the menu and returns focus to the chip. |
| Arrow left / Arrow right, Home, End | On the filter tabs, moves the selection. |

## Accessibility

- Each card's title row is a button with aria-expanded and aria-controls pointing at its details; closed details are inert so their content leaves the tab order.
- Status is never color alone: every state pairs an icon with a label, such as Ready for review, Failed or Checks passed, and the live step is read with its status.
- The diff stat has a spoken label (lines added, removed and files changed); each file and step carries a hidden change or state word before it.
- Elapsed time has a spoken label such as Running for 2 minutes 14 seconds, so the compact 2m 14s is never the only form.
- Starting, finishing, cancelling, retrying, archiving and opening a pull request are announced in a polite status region, including that the preview simulates the run and the PR.
- Focus follows the control that replaced the pressed one: Cancel to Retry, Retry to Cancel, a created PR back to its card, and an archived card to its neighbour.
- Chips are Radix dropdown menus with radio items, so the chosen repository, branch and model are announced as checked. Pointer focus draws no ring; keyboard focus uses Arc's shared ring.

## Motion

- A started task grows in at the top on the critically damped smooth spring and its background flashes the accent tint once, so the eye lands on it.
- The live step shimmers with a calm, linear sweep while the agent works. A new step crossfades in: the old line fades out in about 100ms and the new one fades in over 160ms from 3px below. The sweep stops the moment the run stops.
- Status changes crossfade the state line once. Actions crossfade as a group and their slot follows the new width on the morph spring, which is how Create pull request becomes PR #482 open.
- Filter counts roll up or down with tabular numerals on the snappy spring, and the tab highlight glides on the segmented control's morph spring.
- Expanding a card animates height and opacity together on the smooth spring; new log lines grow in the same way. Archiving collapses the card so the list closes the gap.
- Reduced motion keeps every state, label, announcement and focus move but drops the sweep, the spinner rotation, the travel and the springs; content crossfades quickly or appears at once.

## Responsive behavior

- The block is a single panel up to 760px wide and works from 320px. Layout follows the panel's own width through a container query, not the viewport.
- The composer chips wrap under the task field on narrow panels, the shortcut hint hides below 520px and Start stays at the end of the row.
- Card titles wrap to two lines; the branch truncates first in the meta line; the state line wraps its facts and the actions drop to their own line when there is no room.
- Filter tabs scroll inside their track with edge fades when all four do not fit. The expanded details show steps and changed files side by side from 600px and stack below.

## Performance

- One shared clock ticks once a second only while a task is queued, setting up or running, and stops when nothing runs.
- The demo runs each task on a single chained timer that is cleared on cancel, retry and unmount.
- Collapsed details stay mounted and inert, so reopening a card is instant; counts and filters are derived from the task list on each render without extra state.

## Notes for AI

- Use it for asynchronous agent work that ends in a branch: background coding agents, dependency bots, code migration runs. Pass `tasks` from your store and update them from your backend events (queued, setting-up, running with `step`, then ready with `files` and `checks`).
- Statuses: queued, setting-up and running count as Running; ready waits for review (open or not); merged is final; failed shows `error` as the reason and offers Retry; cancelled offers Retry.
- Keep `step` short and concrete, such as "Reading src/billing/invoice.ts" or "Running tests". Push a matching `steps` entry with state "active" so the expanded log matches the card.
- The diff stat and file count are summed from `files`; do not pass totals. Paths render in a monospace font with the directory muted and truncated first.
- A pull request on the task (`pullRequest`) wins over the local result of `onCreatePullRequest`, so once your data has the PR you can return anything.
- Model ids must exist in `models`; the mark comes from the provider. Use current models only, such as Claude Opus 5.5 or Claude Sonnet 5.5.
- This block lists runs and their outcome. Send people to code-review for the full diff and to agent-run for a single live run with its tool calls.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
