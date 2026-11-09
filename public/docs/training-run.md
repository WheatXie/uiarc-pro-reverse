# Training run

> A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/training-run
- Markdown: https://uiarc.dev/components/training-run/markdown
- Source file: `registry/components/training-run/training-run.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, fine-tuning, training run, loss curve, lora, epochs, checkpoint, eval, learning rate, eta, deploy model, ml job, qwen, hugging face

## When to use

- A fine-tuning or training job page in an AI platform, where people watch loss, pause, cancel and deploy.
- An eval or distillation run that reports a loss curve, checkpoints and a final score.
- A product onboarding step that trains a custom model on the customer's data and ends in a deploy.

## When not to use

- A generic multi-series chart with no job lifecycle: use line-chart.
- A short agent task with steps rather than a loss curve: use agent-status.
- Explaining how training works conceptually: use model-training.

## Installation

Training run is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/training-run
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TrainingRun, QwenColorMark, HuggingFaceMark } from "@/components/arc/training-run/training-run";

export function FineTuneJob({ job }: { job: Job }) {
  return (
    <TrainingRun
      status={job.status}
      name={job.outputName}
      model={{ name: "Qwen3.8 Max", mark: <QwenColorMark /> }}
      details={["LoRA r16", "8× H200"]}
      dataset={{ name: "arcwork/support-tickets-oct", examples: 48210, mark: <HuggingFaceMark /> }}
      step={job.step}
      totalSteps={job.totalSteps}
      epochs={job.epochs}
      loss={job.loss}
      learningRate={job.learningRate}
      elapsed={job.elapsedSeconds}
      eta={job.etaSeconds}
      events={job.events}
      error={job.error}
      onPause={() => api.pause(job.id)}
      onResume={() => api.resume(job.id)}
      onCancel={() => api.cancel(job.id)}
      onRetry={() => api.retry(job.id)}
      onDeploy={signal => api.deploy(job.id, { signal })}
    />
  );
}
```

## API reference

### TrainingRun

A fine-tuning job card with a live train and validation loss curve, epoch progress, learning rate, elapsed time and ETA, recent events, pause and cancel, and results with a Deploy button once the run completes. With no props it plays a simulated LoRA run of Qwen3.8 Max.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"queued" \| "running" \| "paused" \| "completed" \| "failed" \| "cancelled"` | – | Where the job is. Running with no loss samples reads as starting up. Leave it out to play the built in simulation. |
| `name` | `string` | `"Fine-tuning job"` | The job or output model name. |
| `model` | `{ name: string; mark?: ReactNode }` | `Qwen3.8 Max with its mark` | The base model. The mark renders at 24px; color marks keep brand fills, mono marks use currentColor. |
| `details` | `string[]` | `[]` | Short facts after the model name, such as ["LoRA r16", "8× H200"]. |
| `dataset` | `{ name: string; examples?: number; mark?: ReactNode }` | – | The training data, shown in the footer with an optional 14px mark (Hugging Face in the demo). |
| `step` | `number` | `0` | Optimizer steps done. |
| `totalSteps` | `number` | `1` | Steps in the whole run. Fixes the x axis so the curve never rescales mid-run. |
| `epochs` | `number` | `1` | Number of epochs. The axis splits into one band and one progress segment per epoch. |
| `loss` | `{ step: number; train?: number; val?: number }[]` | `[]` | Loss samples, oldest first. Train is drawn raw (faint) and smoothed; validation joins its own samples. The line eases toward each new point. |
| `learningRate` | `number` | – | The current learning rate, shown as 1.84e-4. |
| `elapsed` | `number` | – | Seconds of training so far, excluding pauses. |
| `eta` | `number` | – | Estimated seconds left. While queued it reads as About 18m 40s. |
| `events` | `{ id: string; kind: TrainingEventKind; label: string; step?: number }[]` | `[]` | The event log, oldest first. The newest three show; kinds are start, checkpoint, eval, epoch, info, warning, error and done. |
| `metrics` | `{ label: string; value: string; hint?: string }[]` | – | Up to four results that replace the live stats on completion. Defaults to final train loss, validation loss, steps and duration. |
| `activity` | `string` | – | A line over the empty chart while queued or starting, such as Waiting for 8× H200 · 2nd in queue. |
| `error` | `string` | – | Why the run failed, shown in the footer in place of the dataset. |
| `onPause` | `() => void` | – | Shows Pause while running. |
| `onResume` | `() => void` | – | Shows Resume while paused. |
| `onCancel` | `() => void` | – | Shows Cancel while queued, running or paused. Called after a second press on Confirm cancel within 3 seconds. |
| `onRetry` | `() => void` | – | Shows Retry from checkpoint when the run failed. |
| `onRestart` | `() => void` | – | Shows Run again after a run completes, fails or is cancelled. |
| `onDeploy` | `(signal: AbortSignal) => Promise<{ endpoint?: string } \| void>` | – | Shows Deploy on completion. The button loads while the promise runs, then the footer shows the endpoint with a copy button; a rejection shows its message and Retry deploy. Aborted if the card unmounts or the run leaves completed. |
| `notice` | `string` | – | A one-off message for screen readers, such as the result of an action. |
| `scenario` | `"healthy" \| "oom"` | `"healthy"` | Demo only, when status is left out: oom fails once at step 940 so the retry path can be seen. |
| `className` | `string` | – | Extra class on the card. |

### useTrainingRunSimulation

The hook behind the demo. Returns every TrainingRun prop for a simulated run, so you can prototype against it before wiring a real job API.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `scenario` | `"healthy" \| "oom"` | `"healthy"` | Which simulated run to play. |
| `active` | `boolean` | `true` | Freezes the simulation while false, for example when the card is off screen. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the loss chart and the footer actions. |
| Left / Right | On the focused chart, steps through samples; the legend shows that step's train and validation loss. |
| Shift + Left / Right | Jumps ten samples. |
| Home / End | Jumps to the first or latest sample. |
| Escape | Clears the inspected step. |
| Enter / Space | Activates the focused action. Cancel needs a second press on Confirm cancel. |

## Accessibility

- A polite live region announces status changes (Queued, Training, Paused, Completed, Failed, Deployed) and any notice, never every step.
- Status is an icon plus a label, never color alone; the failure reason is text in the footer and in the event log.
- The chart is a labelled group whose name carries the current step and both losses; the arrow keys inspect samples and the legend reads them out visually.
- Cancel is a two step action so a stray press never stops a long run. Deploy keeps focus while loading.
- Stats are a description list; event steps and numbers use tabular numerals.

## Motion

- The curve and epoch segments ease toward each new sample every frame (exponential, 120ms), so data arriving in bursts still draws at an even pace with no jumps. A rollback or reset jumps instantly.
- The y axis is fixed from the first samples and the x axis spans the whole run, so nothing rescales mid-run.
- New events slide the list down with one bounce-free spring (0.24s); status, stats and footer text crossfade (100ms out, 160ms in, 2px rise).
- Reduced motion: the curve jumps to each sample, the spinner and shimmer stop, and crossfades become instant.
- The demo simulation freezes while the card is off screen.

## Responsive behavior

- Fills its container up to 640px. Under 440px the card padding drops to 16px, stats go to two columns, the legend shortens Validation to Val and the footer stacks context over actions.
- The chart measures its width and redraws at true pixel size, so strokes stay 2px crisp at any width. Touch drag scrubs the chart horizontally while vertical swipes still scroll.

## Performance

- Curve paths are written straight to the SVG on animation frames, without React renders; the smoother stops when it reaches the latest sample.
- Comfortable up to a few thousand samples. For longer runs, downsample to about 500 points before passing loss.

## Notes for AI

- Use for one fine-tuning or training job: model, dataset, live loss, controls and deploy. For a list of jobs, render one compact row per job and open this card for the selected one.
- Pass totalSteps and epochs from the job config so the axis is right from the first sample. Send loss as it streams; there is no need to throttle, the card smooths it.
- Each control only appears when its callback is passed, so a read-only monitor needs only data props.
- Real marks: import QwenColorMark, MetaColorMark or HuggingFaceMark from the component, or pass your own SVG as model.mark.
- Primary actions (Resume, Retry, Deploy) use the accent; only Confirm cancel uses danger.

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Model training](https://uiarc.dev/components/model-training/markdown): Training data batches feed a small neural net diagram whose connections strengthen, a loss curve descends beside it, and an evaluation check turns green at the end.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.

## Also in ai

- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
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

Training run: A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
