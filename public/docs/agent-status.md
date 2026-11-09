# Agent status

> A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/agent-status
- Markdown: https://uiarc.dev/components/agent-status/markdown
- Source file: `registry/components/agent-status/agent-status.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, ai, new, agent status, ai agent, status pill, run status, live indicator, approval, human in the loop, coding agent, research agent, elapsed timer, progress, dynamic island, agent run, claude, tool calls

## When to use

- An app header, title bar or composer that needs to show at a glance that an agent is running, what it is doing and for how long.
- Coding, research or browser agents that pause for approval, so the person can approve or deny without opening a full run view.
- Background runs that people check on occasionally: the pill stays small, and the panel shows recent steps and controls on demand.

## When not to use

- Use agent-run or research-run when the run itself is the page and every step, tool call and output needs room.
- Use agent-approvals to review a queue of pending approvals across several agents.
- Use agent-orchestrator or agent-tasks to compare many agents or runs at once.
- Use text-shimmer alone for a single inline working label without a timer, steps or controls.

## Installation

Agent status is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-status
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentStatus } from "@/components/arc/agent-status/agent-status";
import { FileSearch, FilePen, FlaskConical } from "lucide-react";

export function RunHeader({ run, agent }) {
  return (
    <AgentStatus
      status={run.status}               // "working" | "needs-input" | "paused" | "done" | ...
      startedAt={run.startedAt}
      agent={{ name: "Claude Sonnet 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> }}
      activity={{ label: "Running tests", icon: FlaskConical, progress: { value: 8, total: 12 } }}
      steps={[
        { id: "read", label: "Read 12 files", icon: FileSearch, status: "done", durationMs: 1900 },
        { id: "edit", label: "Edited src/billing/invoice.ts", icon: FilePen, status: "done", durationMs: 2500 },
        { id: "tests", label: "Running tests", icon: FlaskConical, status: "active", startedAt: run.stepStartedAt },
        { id: "push", label: "Push the branch", status: "pending" },
      ]}
      onPause={() => agent.pause(run.id)}
      onResume={() => agent.resume(run.id)}
      onStop={() => agent.cancel(run.id)}
      onApprove={() => agent.approve(run.id)}
      onDeny={() => agent.deny(run.id)}
      onRetry={() => agent.retry(run.id)}
      onOpenRun={() => router.push(`/runs/${run.id}`)}
    />
  );
}

// With no props it plays the simulated coding run.
<AgentStatus />
```

## API reference

### AgentStatus

A compact live status pill for a running AI agent, made for an app header or the space above a composer. Collapsed it shows the agent's mark inside a thin live ring, the current activity with a matching icon, and an elapsed timer in tabular numerals. Each new activity rolls in from below while the pill's width follows on a spring. A click expands the pill in place into a small floating panel with the latest steps (icon, text, duration), a thin step progress bar and Pause, Stop and Open run controls; Escape or a press outside closes it. It covers idle (Ready), working, needs input (an accent dot with inline Approve and Deny), paused, done (the ring closes and the mark morphs into a check, then it settles back to Ready), failed (with Retry) and stopped. With no props it plays a simulated coding run.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"idle" \| "working" \| "needs-input" \| "paused" \| "done" \| "failed" \| "stopped"` | – | The run's state. Leave it out to play the built in simulated coding run (Claude Sonnet 5.5) with working controls. |
| `activity` | `{ label: string; icon?: AgentIcon; progress?: { value: number; total: number } }` | – | What the agent is doing now, in the present tense ("Reading 12 files", "Editing src/billing/invoice.ts"). The icon rolls in with the label. Progress ticks in place as "8 of 12" without rolling the label. In needs input it is the request ("Needs your approval to run git push"), in done the outcome appended to "Done in 1m 12s" ("6 files changed"), and in failed the failure ("Tests failed · 2 errors"). |
| `steps` | `AgentStep[]` | `[]` | Every step of the run, pending ones included so the progress bar knows the total. Each step has id, label, optional icon, status ("pending" \| "active" \| "waiting" \| "done" \| "failed" \| "skipped"), startedAt for a live step and durationMs for a finished one. Write active labels in the present tense and finished ones in the past tense ("Running tests" then "Passed 12 of 12 tests"), so the text itself carries the status. |
| `startedAt` | `number \| Date` | – | When the run started. The timer counts from here and leaves out time spent paused or failed, so it never jumps when the run resumes. |
| `endedAt` | `number \| Date` | – | When the run ended. Defaults to the moment the status turned done or stopped. |
| `agent` | `{ name: string; mark?: ReactNode }` | `{ name: "Agent" }` | The model or agent and its brand mark, drawn at 12px inside the live ring. Give a mono mark its brand color, for example the Claude mark in #D97757. |
| `onPause` | `() => void` | – | Shows Pause in the panel while working. |
| `onResume` | `() => void` | – | Shows Resume in the panel while paused. Pause and Resume share one button, so focus stays put. |
| `onStop` | `() => void` | – | Shows Stop in the panel while working or paused. |
| `onApprove` | `() => void` | – | Shows Approve in the accent color, inline in the pill and in the panel, while the status is needs-input. |
| `onDeny` | `() => void` | – | Shows Deny next to Approve while the status is needs-input. |
| `onRetry` | `() => void` | – | Shows Retry in the accent color, inline and in the panel, when the run failed. |
| `onOpenRun` | `() => void` | – | Shows an Open run button in the panel for a full log or trace view. It confirms with a check for a moment after it is pressed. |
| `settleAfter` | `number \| null` | `4000` | Milliseconds after done or stopped before the pill settles back to Ready. The panel keeps the last run's steps. Null keeps the result on screen. |
| `align` | `"start" \| "center" \| "end"` | `"center"` | Which edge the panel grows from. Use start or end when the pill sits against a header edge. |
| `expanded` | `boolean` | – | Controls the panel. Pair with onExpandedChange. |
| `defaultExpanded` | `boolean` | `false` | Opens the panel on first render when uncontrolled. |
| `onExpandedChange` | `(expanded: boolean) => void` | – | Called when the pill is pressed, Escape is pressed or a press lands outside the open panel. |
| `maxSteps` | `number` | `5` | How many of the latest steps the panel lists. Older steps slide out at the top as new ones arrive. |
| `notice` | `string` | – | A one-off message for screen readers, such as the result of an action. It joins the automatic status announcement. |
| `className` | `string` | – | Class on the root element. |

### useAgentRunSimulation

The scripted runs behind the preview, exported for prototypes and tests. Returns every AgentStatus prop for a run plus replay(). Nothing runs for real: approvals, pushes, searches and Open run only update local state and say so through notice.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `scenarioId` | `"coding" \| "research"` | `"coding"` | Coding is Claude Sonnet 5.5 fixing a proration bug, ending on an approval to run git push. Research is Gemini 4 Argon comparing vendor pricing; one fetch times out on the first try so Retry can be seen. |
| `startDelay` | `number` | `900` | Milliseconds of Ready before the run starts. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the pill, then to the inline Deny and Approve or Retry buttons when they show. With the panel open, Tab moves through Pause or Resume, Stop or Deny, and Open run. |
| Enter, Space | On the pill, opens or closes the panel. On a button, activates it. |
| Escape | Closes the panel from anywhere inside it and returns focus to the pill. |

## Accessibility

- The pill is a button with aria-expanded and aria-controls pointing at the panel, and an accessible name that reads the agent, the activity, the count and the elapsed time.
- A polite status region announces each new activity and the outcome ("Claude Sonnet 5.5: done in 14 seconds, 6 files changed"), not every tick of a count or the timer. Pass notice to add the result of an action.
- Status never relies on color: every state pairs the ring and glyph with words (Ready, Paused, Needs your approval, Done in, Failed, Stopped after), and steps use present tense while running and past tense once finished.
- The step progress bar is a progressbar with a value text such as "4 of 6 steps finished".
- Pause and Resume, and Approve and the Pause that follows it, share one button, so keyboard focus stays in place. If a focused control disappears with a state change, focus moves to the pill instead of the page.
- In narrow containers the inline Approve, Deny and Retry and the Open run button become icon buttons with accessible names. A truncated activity stays readable in full through the pill's name and the panel's step list.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring, inset on the pill.

## Motion

- A new activity rolls in vertically in about 180ms while the old one leaves upward; the pill's width follows on the morph spring, and the label fades at its right edge only while it is wider than its room, so nothing snaps or wraps.
- Opening the panel springs width and height together on the smooth spring from the pill's own footprint; the header row stays where it is and the panel content fades in after a beat. Closing reverses it with a faster fade.
- The live ring spins a short arc while working, freezes in place when paused, gives way to an accent dot with one soft ping when input is needed, and closes around the glyph as the mark morphs into a drawn check (done) or cross (failed).
- The working label carries a calm shimmer that stops in every other state. Counts and the timer change in place with tabular numerals.
- New steps fade in at the bottom of the panel while older ones slide up; segments of the progress bar fill from the left.
- Reduced motion swaps every spring for an instant change, drops the roll, the spin, the ping and the shimmer, and keeps all states, text, focus and announcements.

## Responsive behavior

- The pill sizes to its content and never exceeds its parent's width; a long activity fades out at its right edge instead of wrapping.
- Below 400px of available width the inline actions become icon buttons, the timer steps aside while they show, and Open run in the panel becomes an icon button.
- The panel opens at 384px or the pill's width, whichever is wider, capped by the parent, and floats over the page with a shadow so nothing below moves.
- Step labels in the panel wrap rather than truncate, so long file paths stay readable on a phone.

## Performance

- The timer runs on a small per-instance clock that ticks four times a second only while the run is live and stops when paused, done or idle.
- Width and height animate motion values directly; natural widths come from two hidden, inert measuring rows watched by a ResizeObserver, so the pill never measures in the middle of an animation.
- The spinner and shimmer are CSS animations that pause or stop outside the working state.

## Notes for AI

- Drive it from your agent's event stream: set status, keep activity to the latest tool call or phase in the present tense, and append steps as they finish. Keep the pill's label short; the panel carries the history.
- Keep startedAt fixed for the whole run; the component freezes paused and failed time itself. Pass endedAt from your backend when you have it.
- Use needs-input for any approval gate (shell commands, pushes, payments, emails) and phrase activity.label as the request: "Needs your approval to run git push".
- For done, put only the outcome in activity.label ("6 files changed"); the component writes "Done in 1m 12s · 6 files changed".
- Pass only the handlers your backend supports; each control appears only when its handler exists.
- Place it in a container that sets its width, such as a header slot or a flex row: the pill measures its parent to truncate cleanly and to size the panel.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Also in ai

- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [Image generation](https://uiarc.dev/components/image-generation/markdown): An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.
- [Dictation button](https://uiarc.dev/components/dictation-button/markdown): A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.
- [Speech player](https://uiarc.dev/components/speech-player/markdown): A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.
- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.
- [Reply draft](https://uiarc.dev/components/reply-draft/markdown): An AI email reply drafter where Claude streams a reply under a received Gmail message. Quick replies steer a fresh draft, tone and length rewrite it with a single crossfade, and you can edit the finished draft before you insert it.
- [Agent handoff](https://uiarc.dev/components/agent-handoff/markdown): A support conversation where an AI assistant hands off to a person. When it transfers, a card shows the summary it passes to the team and the typical wait. The person then joins and takes over, and a thin timeline on the left marks each step.
- [PII redaction](https://uiarc.dev/components/pii-redaction/markdown): A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.
- [Response feedback](https://uiarc.dev/components/response-feedback/markdown): A feedback control for AI replies where thumbs down opens an inline panel with reason chips and an optional note, thumbs up fills and asks what was good, and a submit shows a short thank-you before folding back into the row.
- [LLM cost calculator](https://uiarc.dev/components/llm-cost-calculator/markdown): A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.
- [Provider keys](https://uiarc.dev/components/provider-keys/markdown): A settings card for bring-your-own-key AI products. Each provider row shows its real mark, the masked key, a status and when the key was last used. You can reveal a key for five seconds, copy, rotate or remove it with undo. Adding or rotating a key opens an inline form that checks the format as you type, then tests the connection before saving.
- [Generation stats](https://uiarc.dev/components/generation-stats/markdown): A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.
- [AI translate](https://uiarc.dev/components/ai-translate/markdown): A message card where picking a language streams the AI translation in place, sentence by sentence over the dimmed original, with a detected-language chip, a Show original toggle and a status line credited to the model's mark.
- [TL;DR toggle](https://uiarc.dev/components/tldr-toggle/markdown): An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.
- [Connector setup](https://uiarc.dev/components/connector-setup/markdown): A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.
- [Smart form fill](https://uiarc.dev/components/smart-form-fill/markdown): A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.
- [Enrich column](https://uiarc.dev/components/enrich-column/markdown): An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.
- [Ticket router](https://uiarc.dev/components/ticket-router/markdown): A support ticket router where messages from Gmail, Intercom, Slack and Zendesk come in one at a time. An AI classifier labels each one with intent, sentiment and confidence, and the ticket moves into a team lane with an assignee. Low confidence tickets wait in a review lane, and one click there routes them to the suggested team.
- [Ask your data](https://uiarc.dev/components/ask-your-data/markdown): A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.
- [Agent cursor](https://uiarc.dev/components/agent-cursor/markdown): A live document where Claude edits like a collaborator. Its labeled cursor comes out of its avatar, selects a paragraph and streams in a rewrite, adds a heading and fixes a typo, while a teammate's cursor reads along. Changes stay tinted until someone accepts or undoes them from a floating review bar.
- [Provider status](https://uiarc.dev/components/provider-status/markdown): A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.
- [Training run](https://uiarc.dev/components/training-run/markdown): A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.
- [AI command](https://uiarc.dev/components/ai-command/markdown): A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.
- [Starter prompts](https://uiarc.dev/components/starter-prompts/markdown): A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).
- [AI mascot](https://uiarc.dev/components/ai-mascot/markdown): A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.
- [Image reveal](https://uiarc.dev/components/image-reveal/markdown): An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.
- [AI spark](https://uiarc.dev/components/ai-spark/markdown): A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.
- [Pixel mascot](https://uiarc.dev/components/pixel-mascot/markdown): A pixel-art robot that shows what an AI assistant is doing. It idles, thinks, types, celebrates and errors in frame-stepped sprite animations, and stays crisp at every integer size from 24px to 192px.
- [Ghost mascot](https://uiarc.dev/components/ghost-mascot/markdown): A floating ghost mascot whose soft sheet ripples at the hem while it hovers. It blinks when idle, turns toward you to listen, fades a little translucent while thinking, draws a tiny pen line while writing, smiles with a sparkle when done and wobbles once on an error.
- [Cube mascot](https://uiarc.dev/components/cube-mascot/markdown): An isometric cube mascot where three shaded faces and a painted-on face show what the assistant is doing. It turns a quarter turn in eased steps while thinking, prints lines onto the floor while writing, settles with a sparkle when done, and shakes once on error.
- [Tone tuner](https://uiarc.dev/components/tone-tuner/markdown): A brand voice card where two sliders (formality and detail) and Friendly, Confident and Empathetic chips rewrite a customer reply. Each changed sentence crossfades in place, new words can be highlighted against the original, and Copy takes the current version.
- [Upgrade prompt](https://uiarc.dev/components/upgrade-prompt/markdown): An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.
- [Referral card](https://uiarc.dev/components/referral-card/markdown): A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.
- [Trial banner](https://uiarc.dev/components/trial-banner/markdown): A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.
- [Team switcher](https://uiarc.dev/components/team-switcher/markdown): A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.
- [Live visitors](https://uiarc.dev/components/live-visitors/markdown): A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.
- [Social proof toast](https://uiarc.dev/components/social-proof-toast/markdown): A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.
- [Install snippet](https://uiarc.dev/components/install-snippet/markdown): A "get started in 30 seconds" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.

## Guidance for AI tools

Agent status: A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
