# Agent loop

> An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/agent-loop
- Markdown: https://uiarc.dev/components/agent-loop/markdown
- Source file: `registry/components/agent-loop/agent-loop.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-tooltip
- Keywords: special, motion, illustration, new, agent loop, ai agent, tool use, tool calling, gather context, take action, verify, agentic loop, react loop, observe act, context window, claude, explainer, ai diagram

## When to use

- Docs, explainers and landing pages that teach how an AI agent works: it gathers context, calls tools, checks the result and repeats until the task is done.
- Showing why agents take several passes, with a failed check or a failed tool call that sends the loop round again.
- A visual summary of a finished agent run with the tools it used and the context it built up.

## When not to use

- Use agent-run or research-run to show a real agent's live steps and streamed output.
- Use tool-call for a single tool call card inside a chat or a log.
- Use reasoning-tree to explain search over thoughts rather than tool use.
- Use mcp-flow to explain how a host talks to MCP servers over a transport.
- Use context-window to show what fills a model's context and how close it is to the limit.

## Installation

Agent loop is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-loop
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentLoop } from "@/components/arc/agent-loop/agent-loop";
import { GithubMark, SlackColorMark } from "@/components/arc/agent-loop/agent-loop-marks";

export function DeployLoop() {
  return (
    <AgentLoop
      task="Fix the failing deploy on main and tell #releases."
      summary="The build cache was stale. Cleared it, the deploy passed and #releases knows."
      onDone={() => console.log("loop finished")}
      iterations={[
        {
          gather: { label: "Build log", detail: "Step 4 of 9 failed", tokens: 3200 },
          calls: [{ tool: "GitHub", mark: <GithubMark aria-hidden />, action: "Read workflow run", result: "Cache key mismatch" }],
          verify: { passed: false, note: "Fix not applied yet" },
        },
        {
          gather: { label: "Workflow file", detail: "deploy.yml, 84 lines", tokens: 1900, mark: <GithubMark aria-hidden /> },
          calls: [
            { tool: "GitHub", mark: <GithubMark aria-hidden />, action: "Clear cache and rerun", result: "Deploy passed in 3m 12s" },
            { tool: "Slack", mark: <SlackColorMark aria-hidden />, action: "Post update", result: "Posted in #releases" },
          ],
          verify: { passed: true, note: "Deploy green, team told" },
        },
      ]}
    />
  );
}
```

## API reference

### AgentLoop

An illustration of the agent loop: gather context, take action, verify, repeat. A bright head with a soft gradient trail runs clockwise round a ring past three stations, with the model at the center. At Gather context a block joins the context stack beside the ring and the token count rolls up; at Take action a tool call with its real mark drops out of the ring on a short pin and resolves with a result (or an error); at Verify a check passes or leaves a retry note that sends the loop round again. A counter rolls with each loop, and the last one ends in a done state with the ring drawn in, a check at the center and the summary as the caption, or a stopped state when the last check fails. Play, pause, step, restart and speed drive it. The run, the tool calls and their results are sample data; nothing calls a real service.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `iterations` | `AgentLoopIteration[]` | `sample triage run (3 loops)` | The loops, in order. Each is { gather, calls, verify }: gather is the context block { label, detail?, tokens, mark? }, calls are one to three tool calls { tool, mark?, action, result, status? } shown one after another, and verify is { passed, note }. A failed check reads as a retry note; when the last one fails the run ends as stopped. An empty array shows the ring at rest with the controls off. |
| `task` | `string` | `"Find out why EU cards are declined at checkout, then update the team."` | The caption while the loop is ready or running. |
| `summary` | `string` | – | The caption once the loop ends. Defaults to a count of loops and tool calls, or a stopped note when the last check fails (the sample run has its own summary). |
| `model` | `{ name: string; mark?: ReactNode } \| null` | `Claude Opus 5.5 with the Claude mark` | The model at the center. Pass null to show only the loop counter. |
| `title` | `string` | `"Agent loop"` | Card title. |
| `stationLabels` | `Partial<Record<"gather" \| "act" \| "verify", string>>` | `Gather context, Take action, Verify` | Station names. Keep them to about two words; a longer name truncates beside its station. |
| `autoPlay` | `boolean` | `true` | Starts the loop the first time the card is mostly in view. Under reduced motion the card opens on its done state instead. |
| `loop` | `boolean` | `false` | Plays again about four seconds after the done state. |
| `speed` | `number` | – | Playback speed, controlled. At 1 the sample run takes about 18 seconds; 0 holds still. Pair it with onSpeedChange. |
| `defaultSpeed` | `number` | `1` | Starting speed when uncontrolled. The control offers 0.5, 1 and 2. |
| `onSpeedChange` | `(speed: number) => void` | – | Called when the speed control changes. |
| `controls` | `boolean` | `true` | Shows play and pause, step, restart and the speed control. |
| `onStationChange` | `(station: "gather" \| "act" \| "verify", iteration: number) => void` | – | Called when the head reaches a station, with the zero based loop. Fires once per beat, never per frame. |
| `onDone` | `() => void` | – | Called each time playback reaches the done state. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline style on the root. Set --al-accent to recolor the head, trail, pins and active stations (defaults to --series-1). |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through play or pause, next step, restart and the speed control. |
| Enter / Space | On play, pauses or resumes; on next step, plays to the next beat (a new context block, a tool result, a check or the end) and stops there; on restart, starts over from the ready state. |
| Arrow left / Arrow right | On the speed control, moves between 0.5×, 1× and 2×. |

## Accessibility

- The card is a labelled group. Station names, tool calls, results, checks and context blocks are real text, and the ring drawing itself (track, pins, head) is hidden from assistive technology.
- A polite status region speaks each beat when you step or pause (for example "GitHub returned: EU cards, since Oct 18"), and the summary at the end, but stays quiet while the loop plays on its own.
- Status never relies on color: ready, running, paused, done and stopped each pair an icon with a label; a tool result shows a check or a cross, a failed call says failed to screen readers, and a check shows a check icon with "Check passed" or a rotate icon with "Retry".
- The context list is an ordered list, read in the order blocks were gathered.
- When stepping reaches the end, Next step turns off and focus moves to Restart instead of falling back to the page.
- Pointer focus draws no ring; keyboard focus uses Arc's shared focus outline on every control.

## Motion

- The head eases from station to station round the ring and drags a soft gradient trail that stretches with its speed and shrinks to nothing when it lands, so it never sits still with a tail. Small chevrons on the track show the direction.
- The active station's node fills, a thin ring settles around it and its label carries a calm shimmer that stops with a clear solid state.
- A tool call drops out of the ring: the pin under Take action draws down in about 180ms, then the chip lands at its end with a 6px drop and a slight scale on a critically damped spring (no bounce), growing from the pin. Its spinner crossfades to a check or a cross as the result fades in. A second call crossfades into the same lane after the old one fades out in 80ms, so nothing reflows. Checks drop from Verify the same way.
- A new context block fades in at the end of the stack with a short drop while the token count rolls up in tabular numerals; the space for every block is reserved, so the card never grows.
- The loop counter rolls its digit up inside a fixed width. Labels such as the status and the caption swap with one short crossfade.
- At the end the ring draws in clockwise in about 760ms and the head fades out. A stopped run leaves the ring neutral.
- Reduced motion opens on the done state. Playing and stepping still work, with no travel and no trail: the head jumps between stations and each change applies in place.

## Responsive behavior

- From a 640px container the context stack sits in a column beside the ring, with the check and the tool call side by side in two lanes, each at the end of its station's pin.
- Narrower, the context stack moves under the ring (two columns between 460 and 640px) and one lane shows the latest tool call or check.
- The ring is laid out in real pixels from the measured width, so strokes and labels stay crisp at every size. Below a 360px ring column the labels drop their icons and shrink, and on the narrowest cards the two lower stations move further down the ring so their labels fit beside them, which holds down to 320px.
- The speed label hides below a 400px container and the controls wrap onto two lines on the narrowest phones.

## Performance

- The whole run is a pure timeline built once from the iterations, so pausing, stepping and replaying are exact.
- The head and the trail are written straight to the SVG from one requestAnimationFrame loop that runs only while playing or stepping; React renders once per beat, not per frame.
- The trail is one arc path with a gradient whose ends follow the tail and the head; everything else animates transform, opacity or a stroke dash.
- Autoplay waits until the card is in view.

## Notes for AI

- Use it to explain how a tool using agent works (gather context, act, verify, repeat), not to stream a real agent's output. Say in the surrounding copy that the run is illustrative.
- Write two to four iterations. Give each a short context label (one to three words), a detail under about 30 characters, a tool call action of two to four words and a result under about 30 characters, so nothing truncates in the context column or the chips. The context stack reserves a slot per iteration.
- Let the last iteration pass its check; earlier ones can fail with a retry note to show why the loop goes round again. Set status: "error" on a call to show a failed tool call followed by a retry in the same step.
- Copy brand marks from agent-loop-marks.tsx or pass any ReactNode with aria-hidden. Mono marks follow the text color; set style={{ color }} for a brand color. Brand marks are sample content, never an implied endorsement.
- The card is a single focused component about 760px wide at most; it puts the context stack beside the ring from a 640px container and under it below that.

## Related

- [Reasoning tree](https://uiarc.dev/components/reasoning-tree/markdown): An illustration of tree search over thoughts: candidates are scored, weak branches fade, the best expand, and the winning path from question to answer draws in.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Also in illustrations

- [Data flow](https://uiarc.dev/components/data-flow/markdown): Data flow illustration. Sources (app, database, events) are on the left, a processing core with a live count sits in the middle, and destinations (warehouse, dashboard, alerts) are on the right. Records leave as hollow dots and travel curved paths. In the core they turn into solid accent squares, then fan out to each destination; alerts receives about every third record.
- [Payment flow](https://uiarc.dev/components/payment-flow/markdown): A card tap goes to a processor, then the network, then the bank and back with authorization, then settlement; each hop lights up with a status label and the amount travels as a chip.
- [DNS resolution](https://uiarc.dev/components/dns-resolution/markdown): A browser asks for a domain and the query hops from the resolver to a root server, the TLD server and the authoritative nameserver, each pointing to the next, until an IP address comes back and the page connects. The resolver keeps the answer with a TTL ring that drains, and a second lookup is answered straight from that cache in one short hop.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Multi-region failover](https://uiarc.dev/components/multi-region-failover/markdown): Animated multi-region failover on a 2.5D stage: users stream requests through a global load balancer to two regions; the primary degrades, fails three health checks, traffic shifts smoothly to the healthy region, then it recovers, passes three checks and traffic ramps back to an even split.
- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Branch graph](https://uiarc.dev/components/branch-graph/markdown): A git commit graph where branches draw in as colored lanes, merge commits join lines, a rebase lifts commits and replays them onto main, a squash folds them into one, and hovering a commit shows its message, author and diff stats.
- [Mixture of experts](https://uiarc.dev/components/mixture-of-experts/markdown): An illustration of mixture of experts routing: each token is scored by a router, travels to its top experts, and their outputs merge into the token's result.
- [Speculative decoding](https://uiarc.dev/components/speculative-decoding/markdown): An illustration of speculative decoding: a fast draft model guesses a few tokens, the target model checks them in one pass, and accepted guesses join the answer.
- [Prompt cache](https://uiarc.dev/components/prompt-cache/markdown): An animated explainer for prompt caching: the shared prefix of each request is cached once, later requests read it back, and the cost and time saved add up.

## Guidance for AI tools

Agent loop: An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
