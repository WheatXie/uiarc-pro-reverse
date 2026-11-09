# Agent orchestrator

> A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-orchestrator
- Markdown: https://uiarc.dev/components/blocks/agent-orchestrator/markdown

- Access: Arc Pro
- Registry id: `agent-orchestrator`
- Source file: `registry/blocks/agent-orchestrator/agent-orchestrator.tsx`
- Built from: Button, Copy button, Segmented control, Text shimmer
- Keywords: multi agent, orchestrator, subagents, parallel agents, fan out, fan in, lead agent, agent workflow, concurrency, tool calls, token usage, cost, retry, agent observability, claude, ai agents

Pass a goal and run, which emits plan, dispatch, progress and result events, to show a real orchestration; with no props it plays a sample run.

## When to use

- Showing a multi agent run where a lead model splits a task across subagents, such as research, audits, migrations or comparisons.
- Debug or observability panels that need per worker progress, tool calls, errors, retries, tokens and cost in one view.
- Explaining the cost and speed tradeoff of parallel agents, with a live concurrency control.

## When not to use

- Use agent-run for a single agent working through steps in one thread.
- Use agent-plan when the job is to review and edit a plan before anything runs.
- Use research-run for a single research answer with sources and citations.
- Use agent-tasks to track many independent background tasks that do not merge into one result.
- Use model-router when one request is routed to one model rather than split across several.

## Installation

Agent orchestrator is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-orchestrator
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentOrchestrator, type OrchestratorRun } from "@/components/arc/blocks/agent-orchestrator/agent-orchestrator";

// Yield events from your orchestrator. The block handles timing, pulses, queues and totals.
const run: OrchestratorRun = async function* ({ goal, workers, concurrency, signal }) {
  const plan = await planWithLead(goal, workers);           // your lead model call
  for (const subtask of plan) yield { type: "plan", subtask };

  for await (const update of runWorkers(plan, { concurrency, signal })) {
    // update.kind: "dispatch" | "tool" | "toolDone" | "text" | "usage" | "error" | "retry" | "result"
    if (update.kind === "dispatch") yield { type: "dispatch", subtaskId: update.id };
    if (update.kind === "tool") yield { type: "tool", subtaskId: update.id, tool: update.tool, target: update.target };
    if (update.kind === "text") yield { type: "output", subtaskId: update.id, delta: update.text, newLine: update.first };
    if (update.kind === "usage") yield { type: "usage", subtaskId: update.id, tokens: update.tokens, cost: update.cost };
    if (update.kind === "error") yield { type: "error", subtaskId: update.id, message: update.message, retryInMs: 2000 };
    if (update.kind === "result") yield { type: "result", subtaskId: update.id, text: update.text };
  }

  for await (const delta of streamSummary(signal)) yield { type: "summary", delta };
  yield { type: "done" };
};

export function PricingReview() {
  return (
    <AgentOrchestrator
      goal="Compare our pricing page with four competitors and suggest changes"
      run={run}
      defaultConcurrency={3}
      onComplete={result => saveReport(result.summary, result.cost)}
    />
  );
}
```

## API reference

### AgentOrchestrator

A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what they return. The lead writes its plan one subtask at a time, then dispatches each subtask down a connector to its lane; a short pulse runs the connector on dispatch and again when the result comes back. Each lane shows its model, subtask, the current tool (web search, fetch page, read file, write findings), one line of streaming output, rolling tokens and cost, and elapsed time; a lane that fails counts down to a retry. When every lane has returned, the lead streams a summary and a totals row compares the wall time with running every subtask in sequence. A concurrency limit from 1 to 4 holds extra lanes in a visible queue, and clicking a lane opens its compact transcript. Lanes sit side by side on wide cards and stack under a trunk on narrow ones; the connectors are measured from the real layout and follow either arrangement.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `goal` | `string` | `"Compare our pricing page with four competitors and suggest changes"` | What the lead agent is asked to do. Shown as the card heading and passed to the run hook. |
| `plan` | `OrchestratorSubtask[]` | `samplePlan` | Subtasks passed to the run hook: { id, title, instruction?, workerId? }. The title heads the lane; the instruction is the line the lead writes in its plan. The built in simulation writes this plan; your own hook may yield a different one with plan events. |
| `workers` | `OrchestratorWorker[]` | `Claude Sonnet 5.5, Claude Haiku 5.5, Gemini 3.8 Flash, GPT-6 Luna` | The worker lanes in order: { id, name, mark? }. A subtask lands on the worker named by its workerId, or on the next free worker. Up to four lanes sit side by side; more always stack. |
| `lead` | `{ name: string; mark?: ReactNode }` | `Claude Opus 5.5` | The lead agent shown at the top of the flow and again on the summary. |
| `run` | `(context: OrchestratorRunContext) => AsyncIterable<OrchestratorEvent>` | `simulateOrchestration` | The run hook. It receives { goal, plan, workers, concurrency(), signal } and yields events: plan, dispatch, tool, toolResult, output, usage, error, retry, result, fail, summary and done. An async generator is the simplest way to write one. The signal aborts on Stop, on Run again and on unmount. Without it the block plays a local simulation and says so in its status region. |
| `concurrency` | `number` | – | Controlled concurrency limit from 1 to 4. Leave it out to let the built in control own the value. |
| `defaultConcurrency` | `number` | `number of workers, at most 4` | Starting limit when uncontrolled. |
| `onConcurrencyChange` | `(value: number) => void` | – | Called when someone picks a new limit. The run hook reads the live value through context.concurrency(), so raising it mid run releases queued lanes at once. |
| `autoStart` | `boolean` | `true` | Starts the first run when the block scrolls into view. Never starts on its own with reduced motion; the Run button is always there. |
| `onComplete` | `(result: OrchestratorResult) => void` | – | Called once per finished run, after the summary has landed, with { summary, tokens, cost, wallMs, sequentialMs, speedup, lanes }. Each lane reports its subtask, worker, status, text, tokens, cost and time. |
| `className` | `string` | – | Class on the root element. |

### simulateOrchestration

The default run hook, exported so you can read the event order it produces or wrap it. It plans four subtasks, dispatches them up to the live concurrency limit, runs each lane through scripted tool calls with token usage, fails one fetch with a 503 and retries it after two seconds, then streams the lead's summary. Prices for Claude models are list prices; the others are illustrative sample values.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `context` | `OrchestratorRunContext` | – | { goal, plan, workers, concurrency, signal }, as passed by the component. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the concurrency control, the Run or Stop button, each lane, and the copy summary button once a run is done. An open transcript has no controls of its own. |
| Arrow left / Arrow right | On the concurrency control, picks a lower or higher limit. Home and End pick 1 and the maximum. |
| Enter, Space | On a lane, opens or closes its transcript. On Run, starts a run; while running the same button stops it; afterwards it runs again. |

## Accessibility

- The goal is the card heading, and the lead, the plan and the summary are labelled sections, so the flow reads top to bottom in the order the work happens.
- Each lane is a button with aria-expanded and aria-controls, named by its subtask, model and status. A closed transcript is inert, so it leaves the reading order.
- Status never rests on color: every lane state pairs a glyph with a word (waiting, planned, queued with its place in line, starting, the running tool, failed with a retry countdown, returned, gave up, stopped).
- A polite status region announces planning, dispatch, errors and retries, each returned lane, the start of the summary and the final totals, and says that the default run is a simulation.
- Connectors and pulses are decorative and hidden from assistive technology; the plan's colored dots repeat information that the lane titles already give.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring, inset on lanes so it follows their corners.

## Motion

- Plan items grow in one by one on a critically damped spring and their text streams in chunks of a few words that only fade in.
- A dispatch sends a short colored packet down the connector to the lane; a returning result sends one from the lane to the summary. The simulation waits for the packet to land before the lane starts, so cause always comes before effect.
- A lane's branch and port take its series color when work reaches it; queued branches stay dashed with a hollow port.
- Tool, status and output swaps are one minimal crossfade: the old label fades out in 100ms while the new one fades in over 160ms from 2px below. Running labels carry a calm shimmer that stops when the lane settles.
- One line of output streams on a steady requestAnimationFrame clock and glides left under a soft edge when it outgrows the lane, so the newest words stay in view; settled lines rest at the start with an ellipsis.
- Tokens and cost count to each new value with tabular digits; elapsed times tick in tenths.
- Transcripts and the totals row open with height and opacity on a spring without bounce.
- Reduced motion removes pulses, spinners, shimmer, chunk fades and height travel, keeps every state, label and announcement, and never starts a run on its own.

## Responsive behavior

- Above 720px of card width, up to four lanes sit side by side; the trunk drops from the lead into a bus above them and their results merge on a second bus into the summary.
- Below that, lanes stack under a single trunk in the lead's column with a short branch into each lane, and the same pulses run down and back along it.
- Connectors are measured from the rendered layout with a ResizeObserver, so they follow wrapping text, an opened transcript and container resizes without breakpoints of their own.
- Below 440px the side padding tightens, the concurrency label and the lead's elapsed time are hidden, and the totals fall into two columns. It holds at 320px without horizontal scroll.

## Performance

- The run hook's events go through one reducer; nothing renders per animation frame except the chunk clock of a line that is streaming.
- Token and cost counters write their text straight to the DOM through motion values, so a busy run does not re-render lanes for every tick.
- Pulses are single SVG paths animated with the Web Animations API on stroke-dashoffset and removed when they finish.
- Connector geometry is recomputed only when an observed size changes and is skipped when nothing moved.

## Notes for AI

- Choose it when one model plans and several models work in parallel, and the reader needs to see who is doing what, what failed, and what parallelism saved.
- Write the run hook as an async generator. Yield plan events first, then dispatch before a lane's first tool event, then result (or fail) for every dispatched subtask, then summary deltas and done.
- Respect context.concurrency() before each dispatch. The block shows a lane as queued only while every slot is taken, so a hook that ignores the limit will simply show no queue.
- usage events are increments, not totals. Leave out subtaskId for the lead's own tokens; they count toward the totals row but not toward any lane.
- output deltas append to the lane's line; set newLine on the first delta of a new step. The block smooths bursty deltas into a steady stream.
- The sequential estimate is the wall time minus the parallel stretch plus every lane's own time from dispatch to return, so concurrency 1 reads as about the same as running in sequence.
- Company names, prices and pages in the sample are fictional. Prices for non Anthropic models are illustrative sample values.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
