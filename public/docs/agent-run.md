# Agent run

> A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-run
- Markdown: https://uiarc.dev/components/blocks/agent-run/markdown

- Access: Arc Pro
- Registry id: `agent-run`
- Source file: `registry/blocks/agent-run/agent-run.tsx`
- Built from: Button, Input, Text shimmer, Tooltip
- Keywords: ai agent, coding agent, agent run, tool calls, approval, human in the loop, diff, unified diff, pull request, steps, timeline, claude, streaming, autonomous agent, agent trace

With no props it plays a simulated run. To show a real agent, pass run={{ status, elapsedMs, steps, result }} built from your runtime's events, plus onApprove(change), onReject(change, reason), onOpenPullRequest() and onRestart. To replay your own scenario, pass script instead; autoPlay={false} shows a Start run button.

## When to use

- Coding agents and background jobs that read, search, edit and test, where people watch progress and approve the change before it is written.
- Product surfaces that hand an agent a ticket and return a pull request, such as an issue tracker, a review tool or an IDE side panel.
- Demos and onboarding that explain how an agent works step by step, with a real approval gate.

## When not to use

- Use research-run for a research agent that reads sources and writes a cited report.
- Use agent-approvals for an inbox of pending approvals across many agents and tools.
- Use agent-orchestrator when several agents work in parallel on parts of one job.
- Use code-review for reviewing a finished pull request line by line with comments.

## Installation

Agent run is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-run
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentRun } from "@/components/arc/blocks/agent-run/agent-run";

// Simulated demo
<AgentRun />

// Live: build the state from your agent runtime's events
export function AgentPanel({ run, task }) {
  return (
    <AgentRun
      task={task}
      run={run} // { status: "working" | "waiting" | "done", elapsedMs, steps, result }
      onApprove={change => agent.approve(change.id)}
      onReject={(change, reason) => agent.reject(change.id, reason)}
      onOpenPullRequest={() => agent.openPullRequest()} // resolves to { number, url }
      onRestart={() => agent.restart()}
    />
  );
}

// A step while it runs, and an approval step waiting for a decision
const steps = [
  { id: "tests", mark: "npm", verb: "Running tests", doneVerb: "Ran tests", doneTarget: "12 passed", status: "running", progress: { value: 8, total: 12 } },
  { id: "review", mark: "review", verb: "Preparing", doneVerb: "Approved", doneTarget: "changes to 2 files", status: "waiting", change },
];
```

## API reference

### AgentRun

One card that follows an AI coding agent through a task. The header holds the task, the model with its mark, a live status word (Working with a shimmer, Waiting for you, Done) and an elapsed timer. Steps stream into a list named Steps, the live verb shimmering; tool steps open in place to show their input and output in mono, and finished steps settle to secondary text with a drawn check. Before it writes, the agent stops on a compact unified diff with one tab per file and Approve and Reject; Reject asks for a short note and the agent revises once. When the run ends the steps fold into one line and a result appears: the closing message, files changed with a diffstat, checks, and Open pull request.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `task` | `string` | `"Add rate limiting to the public API"` | What the agent was asked to do, shown as the card title. |
| `model` | `{ name: string; mark?: ReactNode }` | `Claude Sonnet 5.5 with the Claude mark` | The model doing the work. The mark is decorative; the name is read out. |
| `script` | `RunScript` | `sampleScript` | The simulated run: steps with durations, approval steps carrying a ProposedChange and an optional revise branch, and the tests and checks to report. Ignored when run is set. |
| `run` | `AgentRunState` | – | A live run from your agent runtime: { status, elapsedMs, steps, result }. Map your runtime's events onto it; the card renders exactly what you pass. Leave it out to simulate script. |
| `autoPlay` | `boolean` | `true` | Start the simulation once the card is on screen. When false, the card shows a Start run button. |
| `onApprove` | `(change: ProposedChange) => void` | – | Called when someone approves a change. A simulation then writes it and carries on. |
| `onReject` | `(change: ProposedChange, reason: string) => void` | – | Called with the note when someone rejects a change. A simulation revises once, then stops on a second rejection. |
| `onOpenPullRequest` | `() => Promise<PullRequest \| void> \| PullRequest \| void` | – | Opens a pull request from the result and returns { number, url }. Throw to report a failure. Without it the preview simulates PR #482 and says so in a live region. |
| `onRestart` | `() => void` | – | Called by Restart run. A simulation restarts on its own. |
| `className` | `string` | – | Class on the root section. |

### useSimulatedRun

The hook behind the simulation, exported for tests and custom shells. Plays a RunScript on one animation frame clock and returns { state, start, restart, approve, reject }. The clock stops while a change waits, while the card is off screen and while the tab is hidden.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `script` | `RunScript` | – | The script to play. |
| `options.running` | `boolean` | – | Whether the clock may tick, for example only while the card is in view. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Restart run, each finished step, the file tabs and code of a waiting diff, Reject and Approve, the folded steps line and Open pull request. |
| Enter, Space | On a step, opens or closes its input and output. On the folded line, shows or hides the steps. |
| Arrow left / Arrow right, Home, End | On the diff's file tabs, switches file. |
| Enter | In the rejection note, sends the change back to the agent. |
| Escape | In the rejection note, cancels and returns focus to Reject. |

## Accessibility

- The card is a section named by the task. Steps are an ordered list named Steps; each expandable step is a button with aria-expanded and aria-controls.
- A polite live region announces each step as it starts, the wait for approval, the end of the run with the test count, and stopping. A second region reports the pull request, including that the preview only simulates it.
- Status is never color alone: the status word sits beside an icon, finished steps change to past tense with a check, and a sent back step reads Sent back with the note.
- Diff lines carry hidden Added and Removed prefixes; the + and − markers and the tints are decorative. The file tabs are a tablist with tabpanels, and the hidden panel is inert.
- Approving or rejecting moves focus to that step's row, opening the note moves focus into it, and cancelling returns it to Reject.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- New steps open their height on a critically damped spring and fade in; nothing bounces.
- The live verb shimmers with Text shimmer. When a step finishes, the verb crossfades to past tense (100ms out, 160ms in from 2px) while its slot follows the measured width, and the check draws its stroke once.
- The header status word swaps with the same crossfade; the timer uses tabular numerals in a reserved width.
- Every diff file shares one grid cell, so switching tabs only crossfades and the card never resizes. The reject note swaps in place while the footer height follows on the smooth spring.
- At the end the steps fold to one line and the result opens below; the closing message streams in chunks of a few words every 34ms, laid out in advance so nothing reflows.
- The pull request button keeps every label in one cell, so Open pull request, Opening and PR #482 opened crossfade without changing width.
- Reduced motion drops travel, fades and the shimmer and keeps every state, label and announcement.

## Responsive behavior

- The card is up to 720px wide and works from 320px. Below 520px the step durations hide, the step details lose their indent, the diffstat blocks hide and the approval buttons take a full row.
- Long step labels and file paths truncate on one line; the full path stays in the tab title and the panel label.
- Diff and tool output scroll sideways inside their own frame, so the card never scrolls horizontally.

## Performance

- The simulation commits about 25 times a second from one requestAnimationFrame loop and pauses off screen, in a hidden tab and while waiting.
- Finished steps keep the same object and the rows are memoized, so only the live row re-renders on each beat.
- Streaming text renders its chunks once and only flips their opacity; there is no per-word animation.

## Notes for AI

- Use it for one agent on one task with a human approval before writes. For a fleet of agents use agent-orchestrator; for a queue of approvals use agent-approvals.
- Pass run for a live agent. Each step needs id, mark, verb, doneVerb and status; add target, doneTarget, progress, io, text or change as they apply. The card derives labels: running shows verb + target, waiting shows Review + doneTarget, done shows doneVerb + doneTarget.
- An approval step carries change: { id, summary, files: [{ path, status, lines }], outcome }. Diff lines are { type: "add" | "del" | "ctx", old?, new?, text }.
- Marks: think, read, search, edit, terminal and review are lucide icons; npm, typescript and github are real brand marks. Pass icon on a step for your own.
- Set result when status is done: summary, files with additions and deletions, tests and checks. elapsedMs should count only time the agent worked.
- Do not show it as executing real code in a demo; the default script is simulated and the pull request is simulated unless onOpenPullRequest is wired.

## Related

- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
