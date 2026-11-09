# LLM cost calculator

> A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/llm-cost-calculator
- Markdown: https://uiarc.dev/components/llm-cost-calculator/markdown
- Source file: `registry/components/llm-cost-calculator/llm-cost-calculator.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, llm cost calculator, token pricing, ai pricing, model cost, api cost estimate, prompt caching, cached input, price comparison, claude, gpt, gemini, deepseek, monthly cost, budget, slider

## When to use

- A pricing or settings page needs an honest monthly estimate for an LLM workload across several models.
- People pick a model for a feature and should see how cost moves with prompt size, output length, traffic and caching.
- An internal tool compares provider prices before a migration or a budget review.

## When not to use

- Use model-picker to choose a model in a chat or composer without a cost comparison.
- Use context-window to show the live token usage of one conversation against a model's context window.
- Use usage-meter or usage-pricing for actual metered spend against a plan; this estimates, it does not report.

## Installation

LLM cost calculator is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/llm-cost-calculator
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LlmCostCalculator, computeLlmCost, type LlmModelPrice } from "@/components/arc/llm-cost-calculator/llm-cost-calculator";

// With no props: eight current models at sample prices, RAG workload.
export function PricingSection() {
  return <LlmCostCalculator />;
}

// Your own price list, wired to your plan picker.
const models: LlmModelPrice[] = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", provider: "Anthropic", mark: <ClaudeMark />, input: 3, cachedInput: 0.3, output: 15 },
  { id: "gpt-6-luna", name: "GPT-6 Luna", provider: "OpenAI", mark: <OpenaiMark />, input: 0.25, cachedInput: 0.025, output: 3 },
];

export function ModelBudget({ prices, onPick }) {
  const [usage, setUsage] = useState({ inputTokens: 8000, outputTokens: 500, requestsPerDay: 20000, cached: true });
  return (
    <LlmCostCalculator
      models={prices.data ?? models}
      loading={prices.isLoading}
      error={prices.error?.message}
      onRetry={prices.refetch}
      usage={usage}
      onUsageChange={setUsage}
      cacheHitRate={0.7}
      description="List prices per 1M tokens, checked October 24, 2026"
      onSelectedChange={(id, model) => onPick(model, computeLlmCost(model, usage, { cacheHitRate: 0.7 }))}
    />
  );
}
```

## API reference

### LlmCostCalculator

A pricing calculator for LLM workloads in one panel. The header shows the selected model's monthly total in a large rolling figure. Below it, workload presets (Chat, RAG, Agent, Batch), three sliders for input tokens per request, output tokens per request and requests per day, and a Cached input switch that bills part of the input at the cache read rate. Every model sits in a ranked list, lowest cost first, with its real mark, a bar relative to the most expensive model and a rolling monthly cost; rows glide to their new rank as values change. Picking a row selects that model for the total and the footer breakdown (input, cached, output, per request) and its price line. With no props it compares eight current models at sample prices.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `models` | `LlmModelPrice[]` | `llmCostSampleModels` | Models to compare. Each has an id, name, provider, an optional 16px mark, and prices in US dollars per 1M tokens: input, output and optional cachedInput (cache reads; without it cached tokens bill at the input price). An empty array shows the empty state. |
| `usage` | `LlmUsage` | – | Controlled workload: { inputTokens, outputTokens, requestsPerDay, cached }. Pair with onUsageChange. Values between slider stops still compute exactly; the slider shows the nearest stop. |
| `defaultUsage` | `LlmUsage` | `the RAG preset (16,000 in, 500 out, 5,000 a day, cached)` | Starting workload when uncontrolled. |
| `onUsageChange` | `(usage: LlmUsage) => void` | – | Called on every slider step, preset and cache toggle with the whole workload. |
| `selected` | `string` | – | Controlled id of the selected model. Pair with onSelectedChange. An id that is not in models falls back to the cheapest model. |
| `defaultSelected` | `string` | `the second model` | Starting selection when uncontrolled. |
| `onSelectedChange` | `(id: string, model: LlmModelPrice) => void` | – | Called when someone picks a row by pointer or with the arrow keys. |
| `presets` | `LlmUsagePreset[] \| false` | `llmCostPresets` | Workload shortcuts shown as a segmented control, each { id, label, usage }. A Custom segment lights up when the sliders match no preset. Pass false to hide the row. |
| `cacheHitRate` | `number` | `0.6` | Share of input tokens billed at the cached rate while Cached input is on, from 0 to 1. Shown beside the switch as a percentage. |
| `daysPerMonth` | `number` | `30` | Days in a billing month. |
| `loading` | `boolean` | `false` | Shows placeholder rows with the list's exact geometry and disables the controls while prices load. |
| `error` | `string` | – | Shows "Prices did not load" with this reason in place of the list. Pair with onRetry. |
| `onRetry` | `() => void` | – | Adds a Try again button to the error state. |
| `title` | `string` | `"Estimated monthly cost"` | Heading of the panel. |
| `description` | `string` | `"Sample list prices per 1M tokens, October 2026"` | Line under the heading. Say where your prices come from and when they were checked. |
| `note` | `string` | `"Sample prices for illustration, not a quote. Calculated in your browser, nothing was sent."` | Fine print at the bottom of the panel. |
| `className` | `string` | – | Class on the root section. |

### computeLlmCost

The function the calculator uses, exported for server code, tests and invoices: computeLlmCost(model, usage, { cacheHitRate, daysPerMonth }) returns { input, cachedInput, output, total, perRequest } in dollars per month (perRequest per call).

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the workload presets, the three sliders, the Cached input switch, the selected model row, then Try again in the error state. |
| Arrow left / Arrow right | On the presets, moves between workloads. On a slider, moves one stop. |
| Page up / Page down, Shift + Arrow | On a slider, moves two stops. |
| Home / End | On a slider, jumps to the smallest or largest stop. In the model list, selects the cheapest or most expensive model. |
| Arrow up / Arrow down | In the model list, selects the next or previous model by rank and moves focus with it. |
| Space | Toggles Cached input. |

## Accessibility

- The panel is a section named by its heading. The model list is a radio group named "Models ranked by monthly cost, lowest first" with a single tab stop on the selected model.
- Rows are in DOM order by rank, so a screen reader reads them in the order shown. Each row's name says the model, the provider, its rank and its monthly cost.
- Sliders are Arc sliders with real values spoken as token and request counts, not stop indexes.
- One polite status region announces the selected model's monthly cost and rank once the numbers settle (not on every drag frame) and says the prices are samples calculated in the browser.
- Selection is shown by a tinted row, an accent bar and aria-checked, never by color alone in the accessible tree. The error state pairs an icon with the words Prices did not load.
- The large total and the rolling numbers are hidden from assistive tech where the status region and row labels already carry the value.
- Pointer focus draws no ring; keyboard focus uses Arc's shared focus ring.

## Motion

- Rows are placed by transform only and move to their new rank on a critically damped spring (about 240ms, no bounce), so a re-rank is one clean glide with no reflow.
- Bars follow the same spring to their new share of the most expensive model.
- Every price counts to its new value over 240ms on an ease-out with tabular numerals, written straight to the node so eight rows roll during a drag without re-rendering.
- The model name under the total and the price line crossfade (100ms out, 160ms in) when the selection changes. State changes between loading, list, error and empty crossfade the list area at a fixed height.
- Reduced motion jumps rows, bars and numbers to their end values and keeps every state and announcement. The loading pulse stops.

## Responsive behavior

- A container query stacks the sliders below 600px and, below 520px, moves the total under the heading, puts each bar on its own line under the model name (rows grow from 44 to 58px), and wraps the breakdown into two columns.
- Monthly costs switch to compact figures ($420K, $4.2M) above $100,000, so the cost column never overflows; the total keeps every digit.
- The presets scroll inside their own track if they ever outgrow the panel. Reads well from 320px to 720px; the panel caps at 720px.

## Performance

- Costs are pure arithmetic memoized per workload; a slider drag re-renders one small list.
- Rolling numbers update text nodes from a motion value, not React state, and only transform, width and opacity animate.
- The status announcement is debounced to 450ms so screen readers are not flooded during a drag. Nothing runs while the panel is idle.

## Notes for AI

- Use it on a pricing page, a model settings screen or a budgeting step where people need to see what a workload costs across models. Prices are inputs: pass your own models with current list prices and say where they came from in description.
- The default prices are plausible samples for illustration, labeled as samples in the header and fine print. Do not present them as real quotes.
- Prices are US dollars per 1M tokens. cachedInput is the cache read price; cacheHitRate decides what share of input bills at it while Cached input is on.
- Keep marks 16px. Mono marks should use currentColor; the sample Claude mark is tinted with its brand color #D97757 and works in both themes.
- Use computeLlmCost on the server for the same numbers the panel shows, for example to store an estimate with a plan.
- Slider stops are fixed (250 to 200,000 input tokens, 100 to 16,000 output tokens, 100 to 1,000,000 requests a day). Controlled usage outside a stop still computes exactly.

## Related

- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Usage pricing](https://uiarc.dev/components/blocks/usage-pricing/markdown): A pricing calculator that finds your plan as you drag seats and traffic.
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

LLM cost calculator: A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
