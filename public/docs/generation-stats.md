# Generation stats

> A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/generation-stats
- Markdown: https://uiarc.dev/components/generation-stats/markdown
- Source file: `registry/components/generation-stats/generation-stats.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, generation stats, llm stats, tokens per second, time to first token, ttft, latency, token usage, cost, streaming, sparkline, prompt cache, cached tokens, reasoning tokens, claude, gpt, gemini, dev panel, usage meter

## When to use

- Under assistant messages in a chat product that shows people what a response cost or how fast it was.
- Playgrounds, eval runners and internal dev panels comparing models on latency, throughput and cost.
- Admin or debugging views that inspect a single request's token usage and cache hit rate.

## When not to use

- Use context-window to show how much of a model's context a conversation has used.
- Use a chart or table for spend across many requests or days; this strip describes one response.
- Use agent-status for a long running agent with steps; this measures one model call.

## Installation

Generation stats is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/generation-stats
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GenerationStats } from "@/components/arc/generation-stats/generation-stats";

// Under an assistant message, fed by your streaming handler.
export function MessageStats({ run }) {
  return (
    <GenerationStats
      variant="inline"
      model={{ name: "Claude Sonnet 5.5", provider: "anthropic", id: "claude-sonnet-5-5" }}
      status={run.status}                 // "waiting" | "streaming" | "done" | "stopped" | "error"
      startedAt={run.startedAt}           // Date.now() when the request went out
      usage={{
        inputTokens: run.usage.input_tokens + run.usage.cache_read_input_tokens,
        cachedTokens: run.usage.cache_read_input_tokens,
        outputTokens: run.outputTokens,   // update on every chunk
        ttftMs: run.ttftMs,               // set on the first token
        durationMs: run.durationMs,       // set on the last
      }}
      pricing={{ input: 3, cachedInput: 0.3, output: 15 }}
      error={run.error}
      onRetry={() => run.retry()}
    />
  );
}

// A dev panel card with the breakdown open.
<GenerationStats model={model} status="done" usage={usage} pricing={pricing} defaultExpanded />

// With no props it plays the sample runs.
<GenerationStats />
```

## API reference

### GenerationStats

A live stats strip for a streaming LLM response. The head shows the model's real mark, its name and a status with icon and label (Waiting, Streaming, Done in 4.18s, Stopped at 1.90s, Failed). Below it four cells split by hairlines: time to first token, speed in tokens per second with a small sparkline, output tokens and cost. While the response streams every number counts up in tabular numerals and the sparkline draws; when it ends the numbers settle on exact values. Details opens a breakdown with a latency bar (first token, generation, total) and a token table (input, cached input, output, reasoning, total) with rates and cost. A failed response gets a reason row with Retry. With no props it plays four sample runs (Claude Sonnet 5.5, GPT-6.1 Sol, Gemini 3.8 Flash and Mistral Large 4, which fails once and retries).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"idle" \| "waiting" \| "streaming" \| "done" \| "stopped" \| "error"` | – | Where the response is: waiting until the first token, streaming until the last. Leave it out to play the built in sample runs. |
| `model` | `{ name: string; provider: GenerationProvider; id?: string }` | – | The model that answered. provider picks the mark: "anthropic", "openai", "google", "xai", "mistral", "deepseek", "meta" or "qwen". id goes into the copied JSON. |
| `startedAt` | `number` | – | Epoch ms when the request was sent. While waiting, time to first token counts live from here; while streaming, total latency does. |
| `usage` | `GenerationUsage` | `{}` | inputTokens (cached included), cachedTokens, outputTokens, reasoningTokens, ttftMs, durationMs, tokensPerSecond, costUsd. All optional. Update outputTokens as chunks arrive and set ttftMs on the first token and durationMs on the last; speed and cost are derived unless you pass tokensPerSecond or costUsd. |
| `pricing` | `{ input: number; cachedInput?: number; output: number }` | – | USD per million tokens. Enables the Rate and Cost columns and the live cost. Reasoning tokens bill at the output rate; cachedInput defaults to the input rate. |
| `speedSamples` | `number[]` | – | Speed readings in tokens per second, oldest first, for the sparkline. By default the component reads speed every 160ms while outputTokens grows, smoothed, and keeps the whole run's shape. |
| `error` | `string` | – | The reason shown in the error row when status is "error". |
| `onRetry` | `() => void` | – | Shows Retry in the error row. |
| `variant` | `"card" \| "inline"` | `"card"` | card is a bordered strip for dev panels and run views. inline is one quiet wrapping line ("412ms to first token · 88 tok/s · 284 tokens · $0.0077") for the space under a chat message; the breakdown opens as a panel below it. |
| `expanded` | `boolean` | – | Controls the breakdown. Pair with onExpandedChange. |
| `defaultExpanded` | `boolean` | `false` | Opens the breakdown on first render when uncontrolled. |
| `onExpandedChange` | `(expanded: boolean) => void` | – | Called when Details is pressed. |
| `note` | `ReactNode` | – | A footnote under the breakdown, for example "Rates from your Anthropic contract, updated Oct 1, 2026". The preview uses it to say the run is simulated. |
| `className` | `string` | – | Class on the root element. |

### useGenerationSimulation

The simulated stream behind the preview, exported for prototypes and tests. Returns { frame, cueOpen, retry, next }, where frame holds model, pricing, status, startedAt, usage and error in exactly the shape GenerationStats takes. Output ramps up, wavers a few percent and arrives in chunks of four or more tokens, like a real stream. Nothing is sent anywhere.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `runs` | `GenerationSampleRun[]` | `generationSampleRuns` | The runs to play in order. A run with failAtTokens fails there once and succeeds when retried. |
| `active` | `boolean` | `true` | Ticks only while true; pass false when the card is off screen. |
| `hold` | `boolean` | `false` | Keeps a settled run on screen instead of moving on. |
| `loop` | `boolean` | `true` | Plays the runs in a loop. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to Details, then Retry when a response failed, then the copy button inside an open breakdown. |
| Enter, Space | Opens or closes the breakdown, retries, or copies the stats as JSON. |

## Accessibility

- The strip is a group named after the model ("Claude Sonnet 5.5 stats"). The four stats are a description list, so each value is read with its label: "First token, 412ms".
- Details is a button with aria-expanded and aria-controls; at narrow widths it becomes an icon button that keeps the name Show details or Hide details.
- A polite status region announces settled outcomes ("Claude Sonnet 5.5 done in 4.18s, 284 output tokens at 88 tokens per second, $0.0077"), failures and stops, never the live counts. The self-playing preview says once that it is simulated and stays quiet until someone interacts with it.
- Status never relies on color: a spinner, drawn check, alert or square always sits next to a word. The latency bar is decorative; its values are listed beside it in text.
- The breakdown is a real table with column and row headers and a caption, so screen readers can navigate tokens, rates and cost by cell.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Numbers glide toward each new value in about 100ms per step with tabular numerals in reserved cells, so chunks of tokens read as one smooth count and nothing beside them moves. A drop, like a new request, cuts straight to the new value instead of counting down.
- While streaming, speed is measured when each chunk lands, so it holds still between chunks instead of sagging and jumping. The sparkline adds a smoothed reading every 160ms and compresses to keep the whole run's shape.
- Status labels swap with a single crossfade (out in 100ms, in over 160ms with a 2px rise); the done check draws itself once.
- The breakdown and the error row open on a 260ms critically damped spring for height with a 160ms fade. Nothing bounces.
- The preview loop pauses off screen and holds on a settled run while someone has the breakdown open.
- Reduced motion shows final values at once, drops the spinner, the check drawing and the height springs, and stops the preview on a settled run.

## Responsive behavior

- The card's four cells sit in one row above 600px of width and in a two by two grid below it, so the speed cell keeps room for its sparkline.
- Below 440px Details becomes an icon button and the Rate column hides; the model name truncates with an ellipsis rather than wrapping.
- The inline variant wraps its stats onto a second line on phones instead of scrolling; the breakdown spans the full width under it.

## Performance

- The live clock runs on requestAnimationFrame only while waiting or streaming, and each counting number re-renders only itself.
- The speed series is sampled on a 160ms interval only while streaming and capped at 48 points.
- The preview's simulation ticks every 40ms in virtual time and only while the card is on screen.

## Notes for AI

- Wire it to the stream you already have: set startedAt when the request leaves, status "waiting" until the first chunk, then "streaming" while you add to outputTokens, then "done" with durationMs. Speed, latency and cost follow.
- Map provider usage fields: Anthropic input_tokens plus cache_read_input_tokens is inputTokens and cache_read_input_tokens is cachedTokens; OpenAI prompt_tokens and prompt_tokens_details.cached_tokens map the same way, and completion_tokens_details.reasoning_tokens is reasoningTokens.
- Pass pricing from your own config. If your provider already reports cost, pass usage.costUsd and leave pricing out; the Rate column then hides.
- Use variant="inline" under chat messages and the card in eval views, playgrounds and admin panels. Keep the model name as people know it ("Claude Sonnet 5.5"), and put the API id in model.id.
- When the person stops a response, set status "stopped" with durationMs; when the request fails, set status "error" with a short, specific reason and onRetry.

## Related

- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.

## Also in ai

- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
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

Generation stats: A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
