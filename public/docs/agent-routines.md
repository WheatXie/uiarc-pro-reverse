# Agent routines

> Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-routines
- Markdown: https://uiarc.dev/components/blocks/agent-routines/markdown

- Access: Arc Pro
- Registry id: `agent-routines`
- Source file: `registry/blocks/agent-routines/agent-routines.tsx`
- Built from: Button, Input, Popover, Segmented control, Select, Switch, Text shimmer, Tooltip
- Keywords: scheduled agents, agent routines, cron, automations, recurring tasks, ai agent schedule, run history, slack digest, triage bot, agent runs, natural language schedule, workflow automation

Pass routines with onToggle, onRun and onChange to wire your scheduler; with no props it shows sample routines with live countdowns.

## When to use

- Settings or automation screens where people schedule agents to run on their own and post results to Slack.
- A card on a dashboard that shows at a glance which scheduled agents are healthy, which failed and when each runs next.
- Products that let people create automations from a sentence and confirm the parsed schedule, sources and destination.

## When not to use

- Use agent-run to watch a single agent work through a task in real time with its tool calls.
- Use agent-tasks for a queue of one-off jobs that run once rather than on a schedule.
- Use agent-approvals when the agent's output needs a person to approve it before anything is posted.
- Use agent-orchestrator to show several agents handing work to each other within one run.

## Installation

Agent routines is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-routines
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentRoutines, type Routine } from "@/components/arc/blocks/agent-routines/agent-routines";

export function Routines({ routines }: { routines: Routine[] }) {
  return (
    <AgentRoutines
      routines={routines}
      onRun={async routine => {
        const result = await api.routines.run(routine.id); // { id, status, summary, durationMs, report }
        return {
          run: { id: result.id, status: result.status, at: Date.now(), summary: result.summary, durationMs: result.durationMs },
          report: result.report,
        };
      }}
      onToggle={(id, enabled) => api.routines.update(id, { enabled })}
      onSave={(routine, { created }) => created ? api.routines.create(routine) : api.routines.update(routine.id, routine)}
    />
  );
}

// A routine
const triage: Routine = {
  id: "morning-triage",
  name: "Morning triage",
  instruction: "Read new Linear issues, match them to Sentry errors and post a ranked list to #triage.",
  schedule: { frequency: "weekdays", time: "09:00" },
  sources: ["linear", "sentry"],
  destination: "#triage",
  model: "claude-sonnet-5-5",
  enabled: true,
  steps: ["Reading new Linear issues", "Matching Sentry errors", "Ranking by customer impact", "Posting to #triage"],
  history: [{ id: "r-1", status: "success", at: "2026-10-19T09:00:00", durationMs: 41000, summary: "Triaged 9 issues, 2 urgent" }],
  report: "Triage for Monday 19 October\n- ENG-2141 Checkout button stays disabled. Urgent, assigned to Priya.\n9 issues reviewed, 2 urgent.",
};
```

## API reference

### AgentRoutines

Scheduled agents in one card. Each row reads as a sentence: the routine's name and an on and off switch, its schedule in plain words with a live countdown to the next run and the last run on the right, then the connectors it reads, the Slack destination and the model as small colored marks in a fixed slot that never wraps, beside its last 14 runs as small tinted ticks with a tooltip each. Run now sits in a reserved slot that shows on hover or focus; a run fills a thin line under the row in the routine's series color, shimmers a Running label with the current step, then slides a new tick into the history and updates the last run. Clicking a row opens it in place, one at a time, with the latest run's output as a short formatted report, the instruction prompt and a compact schedule editor. New routine opens an inline row where a sentence is read into editable chips for the schedule, sources and destination.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `routines` | `Routine[]` | `four sample routines` | The routines: id, name, instruction, schedule ({ frequency: "hourly" \| "daily" \| "weekdays" \| "weekly", time: "HH:MM", day?: 0-6 }), sources (connector ids: linear, github, sentry, google-calendar, notion), destination ("#channel" or "Direct message"), model (claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, gpt-6-luna, gemini-3-8-flash), enabled, history (oldest first), an optional report, optional step labels and an optional accent (1 to 4, the series color for its progress). Passing a new array replaces the list; changes made in the card are kept until then. |
| `onRun` | `(routine: Routine) => Promise<RoutineRunResult> \| RoutineRunResult \| void` | – | Called when a run starts, from Run now or when a schedule comes due while the card is open. Return a promise of { run, report? } to drive the row from your backend: the steps advance while it is pending, the result lands when it resolves, and a rejection shows its message as the error. Return nothing to keep the built-in simulation, which says so in the status region. |
| `onToggle` | `(id: string, enabled: boolean) => void` | – | Called when a routine's schedule switch changes. |
| `onSave` | `(routine: Routine, meta: { created: boolean }) => void` | – | Called with the full routine when its schedule changes in the open row, and with created: true when New routine adds one. |
| `now` | `number \| Date` | – | The current time for countdowns and run times. Without it the card uses a demo clock that starts on Tuesday 20 October 2026 at 6:45 when no routines are passed, and the real clock otherwise. |
| `defaultOpenId` | `string \| null` | `null` | The routine that starts open. Opening another closes it. |
| `title` | `string` | `"Routines"` | The card title, also the list's accessible name. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through New routine, then for each row the routine name, Run now, the schedule switch and the run ticks, then the open row's schedule editor. |
| Enter, Space | On a routine name, opens or closes the row. On Run now, starts a run; while it runs the same button stops it. |
| Arrow up / Arrow down, Home, End | On a routine name, moves focus to the previous, next, first or last routine. |
| Arrow left / Arrow right, Home, End | Inside the run ticks, moves between runs; each run shows its result, time, duration and summary in a tooltip. In the frequency control, changes the frequency. |
| Enter | In the New routine sentence field, adds the routine. A sentence typed a moment ago is read at once. |
| Escape | In the sentence field, cancels New routine and returns focus to its button. In a chip's popover, closes the popover. |

## Accessibility

- Each routine name is a real button with aria-expanded; the rest of the row also opens it on click, while Run now, the switch and the ticks stay separate controls.
- Status is never color alone: the last run pairs an icon with its time, each tick has a full text label and a tooltip with an icon and a label, and the strip is a group named with its counts (for example 12 succeeded, 1 failed, 1 skipped).
- Connector, destination and model marks are hidden from assistive technology and replaced by one sentence per row: what it reads, where it posts and which model runs it.
- The run ticks are one tab stop with a roving index, so a list of routines does not add 14 stops per row.
- Run starts, results, failures, stops, toggles, schedule changes and new routines are announced in a polite status region, including that the preview only simulates runs and Slack posts.
- While a run is in progress the open row lists its steps as an ordered list with the current step marked aria-current="step"; a failure is announced as an alert with the step and the error.
- The sentence parser's state and the simulation note sit in a polite live region. Chips are buttons named with their field and value, and their popovers use pressed buttons for sources and the destination.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- A row opens from height 0 to auto and back on a critically damped spring (about 340ms, no bounce). Opacity starts a beat after the height and ends a beat before it on close, the content rises 6px into place, and the chevron and the row's quiet tint change on the same timing. Opening one row closes the other at the same time, and the rows below glide with the height.
- While a row is open its height keeps following its content on the same spring, so a streamed report or the step list never resizes the card in one frame.
- Run now fills a 2px line under the row at the pace of the steps, in the routine's series color, then the line fades. A new tick slides in from one slot to the right while the others tween one slot left and the oldest fades out, on a 240ms ease-out tween. Ticks sit in fixed slots and never measure layout, so they do not drift while rows open or close.
- Labels change with one minimal crossfade: the old one fades out in 100ms and the new one fades in over 160ms from 2px below. A schedule change slides the text after it as its width follows on a critically damped spring. The countdown uses tabular numerals in a reserved width.
- The Running label and the active step carry a calm shimmer that stops when the run ends. Run now and Stop share one button and one width, so the swap never resizes it.
- The latest report streams in chunks of 15 to 40 characters every 32ms on a requestAnimationFrame clock; each new chunk only fades in and settled text never re-renders.
- Reduced motion opens, closes, shifts and swaps at once and keeps every state, label and announcement; the shimmer stops and streamed chunks appear without the fade.

## Responsive behavior

- The card is up to 680px wide and reads the same at 360px: every row keeps its three lines, and the marks slot and ticks never wrap.
- Below 540px of card width the last run moves out of line two (it stays in the ticks' tooltips and the open row), and the insets tighten.
- Below 420px Run now and Stop become icon buttons with the same accessible names, and the schedule's time field takes its own line.
- Long step labels and destinations truncate with an ellipsis; the full text is in the open row, the tooltips and the status region.

## Performance

- One shared one second clock drives every countdown; nothing else re-renders on a timer.
- Runs are cancelled with an AbortController when stopped or when the card unmounts, so no timers outlive it.
- Ticks animate only transform and opacity in fixed slots; nothing in the list uses layout animation.
- Closed rows unmount their details, so a long list only renders one report and one schedule editor.
- Brand marks are inline SVG components in the block's folder; the Gemini mark scopes its gradient ids per instance.

## Notes for AI

- Choose it for agents that run on a schedule and report back: daily triage, weekly digests, hourly watchers, meeting briefs. One row per routine; keep names short and specific so the first line never truncates.
- Schedules are four plain shapes (hourly at a minute, daily, weekdays, weekly on a day) with 24 hour times. The card derives the plain words, the cron expression and the next run in local time.
- History is oldest first and only the last 14 runs show. Use status skipped for runs that found nothing to post, so the strip separates quiet runs from failures.
- The report is short plain text: the first line is the title, lines starting with "- " become list items and other lines become paragraphs. Issue keys like ENG-2141, pull requests like #1842 and channels like #eng are set apart.
- Rows show up to three source marks; with four or more they show two and a +N count whose tooltip names the rest. Give each routine step labels that match what your agent really does, so the progress is honest.
- New routine parsing is a local, simulated pattern match and says so. In production, send the sentence to a model and keep the chips as the confirmation step before onSave.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.
- [MCP servers](https://uiarc.dev/components/blocks/mcp-servers/markdown): Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
