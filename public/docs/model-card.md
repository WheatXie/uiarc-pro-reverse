# Model card

> A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/model-card
- Markdown: https://uiarc.dev/components/model-card/markdown
- Source file: `registry/components/model-card/model-card.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-switch, @radix-ui/react-dropdown-menu
- Keywords: special, ai, new, model card, model details, model picker, llm, ai model, compare models, benchmark, context window, pricing per token, cost estimator, token cost calculator, tokens, claude, gpt, gemini, grok, copy model id, marketplace

## When to use

- The detail pane of a model picker, showing what the highlighted model can do and what it costs before someone selects it.
- Model pages in docs or a marketplace, with limits, prices and a quick benchmark read against close rivals.
- Settings where a team picks a default model and wants a side by side check against an alternative.

## When not to use

- Use model-picker to choose between many models; pair it with this card for the details.
- Use context-window to show how full a live conversation's context is.
- Use a pricing table for plan pricing; this card shows per token API prices.
- Do not use it for official benchmark leaderboards with many models; the bar list shows three models.

## Installation

Model card is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/model-card
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ModelCard, type ModelCardModel } from "@/components/arc/model-card/model-card";
import { ClaudeMark, OpenaiMark } from "@/components/arc/model-card/model-card-marks";

const sonnet: ModelCardModel = {
  id: "claude-sonnet-5-5",
  name: "Claude Sonnet 5.5",
  provider: "Anthropic",
  mark: <ClaudeMark aria-hidden style={{ color: "#D97757" }} />,
  summary: "The balanced Claude for everyday coding, agents and analysis at scale.",
  modalities: ["text", "image", "pdf", "tools", "reasoning"],
  contextWindow: 1_000_000,
  maxOutput: 64_000,
  knowledgeCutoff: "2026-03",
  pricing: { input: 3, output: 15, cachedInput: 0.3 },
  scores: { "swe-bench": 82.1, gpqa: 85.4 },
};

export function ModelDetails({ rivals, current, onPick }: { rivals: ModelCardModel[]; current: string; onPick: (id: string) => void }) {
  return (
    <ModelCard
      model={sonnet}
      rivals={rivals}
      benchmarks={[
        { id: "swe-bench", name: "SWE-bench Verified", shortName: "SWE-bench", description: "real GitHub issues resolved" },
        { id: "gpqa", name: "GPQA Diamond", shortName: "GPQA", description: "graduate level science questions" },
      ]}
      defaultMonthlyTokens={50_000_000}
      sample={false}
      selected={current === sonnet.id}
      onSelect={model => onPick(model.id)}
      onCopyId={id => console.log("copied", id)}
    />
  );
}
```

## API reference

### ModelCard

A model details card for a model picker, docs or a marketplace that keeps one size in every state. The header shows the provider mark, the model name and the provider, with a Compare switch. The details view has a two line summary, all seven modality chips (unsupported ones dashed and muted), context window, max output and knowledge cutoff with a context gauge that reads as pages (1M tokens fits about 1,500 pages), input, output and cached prices per million tokens, a monthly volume slider that rolls the estimated monthly cost live, and benchmark bars against two rivals where hovering or focusing a row shows the exact score, its rank and the gap to the leader. The footer shows the API model id with Copy model id. Compare crossfades to a side by side table against any rival, including the cost at the chosen volume, with a check and the margin (+2.3, −20%, 2x) on the better value and a tally of who leads. Details, compare, loading and error are stacked in one grid cell, so switching models, views or benchmarks never moves the card. Ships with sample data for Claude Opus 5.5 against GPT-6.1 Sol, Gemini 4 Argon and Grok 4.7; prices and scores are labeled as samples.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `model` | `ModelCardModel` | `Claude Opus 5.5 (sample)` | The model the card describes: { id, name, provider, mark?, summary?, modalities?, contextWindow?, maxOutput?, knowledgeCutoff?, pricing?, scores? }. contextWindow and maxOutput are token counts (1_000_000 reads as 1M). knowledgeCutoff is an ISO month such as "2026-03" (shown as Mar 2026); any other string is shown as is. pricing is { input, output, cachedInput? } per million tokens. scores maps benchmark ids to numbers. A missing value reads as Not listed. |
| `rivals` | `ModelCardModel[]` | `GPT-6.1 Sol, Gemini 4 Argon, Grok 4.7 (sample)` | Other models. The first two appear under the model in the benchmark rows, ranks count every rival with a score, and every rival can be picked in the compare view. The model itself is filtered out, so one shared pool works for every model. Pass [] to hide the Compare switch. |
| `benchmarks` | `ModelCardBenchmark[]` | `SWE-bench Verified, GPQA Diamond, Terminal-Bench 2.0` | Benchmarks in order: { id, name, shortName?, description?, max?, unit? }. shortName labels the switcher, description follows the name in the caption, max fills a bar (default 100) and unit follows each score (default %). Only benchmarks the model has a score for are offered; with none the section hides. |
| `view` | `"details" \| "compare"` | – | Controlled view. Pair it with onViewChange. |
| `defaultView` | `"details" \| "compare"` | `"details"` | Starting view when uncontrolled. |
| `onViewChange` | `(view: ModelCardView) => void` | – | Called when the Compare switch changes. |
| `compareWith` | `string` | – | Controlled id of the rival in the compare view. Pair it with onCompareWithChange. |
| `defaultCompareWith` | `string` | `first rival` | Starting rival when uncontrolled. |
| `onCompareWithChange` | `(id: string) => void` | – | Called when a rival is picked from the compare menu. |
| `defaultBenchmark` | `string` | `first scored benchmark` | Benchmark shown first. |
| `onBenchmarkChange` | `(id: string) => void` | – | Called when the benchmark switcher changes. |
| `defaultMonthlyTokens` | `number` | `100_000_000` | Monthly token volume the cost estimator starts at. Snaps to the nearest stop: 1M, 5M, 10M, 25M, 50M, 100M, 250M, 500M or 1B. |
| `onMonthlyTokensChange` | `(tokens: number) => void` | – | Called with the new monthly volume as the slider moves. |
| `inputShare` | `number` | `0.75` | Share of the monthly volume billed at the input price; the rest is billed at the output price. |
| `currency` | `string` | `"USD"` | ISO 4217 currency for prices. |
| `sample` | `boolean` | `true` | Labels prices and scores as samples in the benchmark caption and the compare footnote. Set it to false once you wire real figures. |
| `loading` | `boolean` | `false` | Shows a skeleton of the card, disables Compare and sets aria-busy. |
| `error` | `string` | – | Replaces the body with an error message. The header still shows the model. |
| `onRetry` | `() => void` | – | Adds a Retry button to the error state. |
| `onCopyId` | `(id: string) => void` | – | Called after Copy model id writes the id to the clipboard. |
| `onSelect` | `(model: ModelCardModel) => void` | – | Adds a primary Use model button to the footer, for model pickers. |
| `selected` | `boolean` | `false` | Shows the select button as Selected with a check and aria-pressed. |
| `selectLabel` | `string` | `"Use model"` | Label for the select button. |
| `className` | `string` | – | Class on the root article. |
| `style` | `CSSProperties` | – | Inline style on the root article. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the Compare switch, the monthly volume slider, the benchmark switcher, each benchmark row (focus shows its score and rank), or the rival menu in the compare view, then Copy model id and Use model when present. Hidden views are inert, so Tab never lands in them. |
| Arrow keys / Page up / Home / End | On the volume slider, step through the monthly volumes; the estimated cost rolls to the new value. |
| Space / Enter | Toggles Compare, copies the model id or selects the model. |
| Arrow left / Arrow right | Moves between benchmarks in the switcher. |
| Enter / Arrow down | On the rival menu, opens it; arrows move between rivals and Enter picks one. Escape closes it. |

## Accessibility

- The card is an article labelled by the model name. Specs and prices are description lists, so each value is read with its label.
- The compare view is a table with column headers for the two models and a row header per spec. The better value carries a check icon and the text "better" for screen readers, so the comparison never relies on color.
- A polite status region says what changed when you switch views, rivals or benchmarks (for example "Comparing Claude Opus 5.5 with Gemini 4 Argon"). Copy model id announces Copied on its own.
- Benchmark bars are hidden from assistive technology; each row is focusable and labelled with the full readout (score, rank and gap to the leader). Marks are decorative and hidden, since the name is always written next to them.
- Modality chips say supported or not supported to screen readers; unsupported chips are dashed as well as muted, so the difference never relies on color.
- While loading, the card is aria-busy, the skeleton is hidden, Compare is disabled and the status region says Loading model details. An error is announced with role alert. Inactive panels are inert and aria-hidden.
- During a text swap the outgoing value is hidden from assistive technology, so names and values are never read twice.
- Pointer focus draws no ring; keyboard focus uses Arc's shared focus outline.

## Motion

- The card never changes size. Details, compare, loading and error are panels stacked in one grid cell, so the card is always as tall as the tallest panel; switching fades the old panel out in 100ms and the new one in over 160ms. Inside a panel every slot is reserved: two summary lines, all seven chips, every spec and price cell, a fixed number of benchmark rows and a readout that holds its lines.
- Switching models crossfades every text value in place and rolls prices, the estimated cost, page counts and scores to their new values in tabular numerals inside reserved widths. Bars and the context gauge slide on a critically damped spring (visualDuration 0.24, no bounce).
- Dragging the volume slider rolls the estimated cost live; the compare table's cost row follows the same volume.
- Hovering or focusing a benchmark row tints it, fades the other rows to half opacity and crossfades the readout to its score, rank and gap, all within 160ms.
- The bars grow from zero once, the first time the card is mostly in view, 40ms apart.
- Reduced motion keeps every end state and drops travel: views, bars, numbers and values change in place, and the skeleton holds still.

## Responsive behavior

- The card is fluid up to 640px and reads its own width with container queries, so it works in a narrow side pane as well as a page.
- Below a 480px card, specs and prices become rows of label and value under hairlines, the cost estimate drops under the slider, the benchmark switcher drops under its heading and the readout reserves three lines. Below 420px the summary reserves three lines. Below 360px each bar moves under its name.
- From a 520px card the compare table has a label column beside the two model columns and shows margins on the better value; narrower, each label sits above its two values and the mini bars and margins hide.
- The footer wraps the copy and select buttons under the model id when space runs out. It holds at 320px without horizontal scroll.

## Performance

- Bars animate transform only (scaleX) and numbers are written in place during the roll, so React renders once per change, not per frame.
- No measuring: the stacked grid cell reserves the height in CSS, so there is no ResizeObserver and no height animation.
- Nothing runs while idle: no loops apart from the CSS skeleton pulse while loading. Hidden panels stay mounted (inert) so values are ready the moment a view switches.

## Notes for AI

- Use real figures from your model catalog and set sample={false}; leave sample on while the numbers are placeholders. The bundled data is a plausible October 2026 sample, not official pricing or results.
- Keep the summary to one sentence of about 90 characters; the card reserves two lines (three on narrow cards) and clamps anything longer.
- Give scores for the same benchmark ids on the model and its rivals. A row without a score shows None and the compare table shows Not listed, so rows never appear or disappear.
- Pass one shared pool as rivals when the model changes (the card filters out the current model), so the benchmark rows and ranks stay stable while values roll.
- Copy marks from model-card-marks.tsx (Claude, OpenAI, Gemini, Grok) or pass any SVG with aria-hidden. Mono marks follow the text color; set style={{ color }} for a brand color, as the Claude mark does. Brand marks are sample content, never an implied endorsement.
- Price cells read per million tokens. Omit cachedInput to show two price cells.
- For a list of many models, render a compact picker and show one ModelCard for the highlighted model; the card is a detail view, not a row.

## Related

- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
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

Model card: A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
