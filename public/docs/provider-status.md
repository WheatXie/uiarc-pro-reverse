# Provider status

> A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/provider-status
- Markdown: https://uiarc.dev/components/provider-status/markdown
- Source file: `registry/components/provider-status/provider-status.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, provider status, ai status, llm uptime, status page, incident, uptime bar, latency, health check, openai status, anthropic status, model provider, monitoring

## When to use

- Showing the live health, latency and recent uptime of the model providers your product routes to.
- Explaining degraded AI features to users or admins with the provider's incident updates in place.
- A routing or fallback settings page where people need to see which providers are healthy right now.

## When not to use

- A full public status page with components, subscriptions and history: build a page, not a card.
- A single provider's state inside a chat header: use agent-status or a small badge.
- Detailed latency charts over time: use a chart component.

## Installation

Provider status is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/provider-status
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ProviderStatus } from "@/components/arc/provider-status/provider-status";
import { AnthropicMark, OpenaiMark } from "@/components/arc/provider-status/provider-status";

export function Health() {
  const [providers, setProviders] = useState<ProviderStatusItem[]>(initial);
  return (
    <ProviderStatus
      providers={providers}
      refreshInterval={60_000}
      onRefresh={async signal => {
        const res = await fetch("/api/provider-status", { signal });
        if (!res.ok) throw new Error("Couldn’t reach the status feeds. Showing the last results.");
        return (await res.json()) as ProviderStatusItem[];
      }}
      onOpenIncident={(provider, incident) => window.open(incident.url, "_blank")}
      footnote="Latency is the median over the last 5 minutes."
    />
  );
}
```

## API reference

### ProviderStatus

A status card for the AI providers a product depends on. Each row shows the provider's real mark, its health as an icon and label (Operational, Degraded, Outage), median latency in tabular numerals and a 30 day uptime bar of small ticks with a tooltip per day. A row with an incident expands into its updates (Investigating, Identified, Monitoring, Resolved), newest first, and new updates grow the panel smoothly. The header sums up health across providers and checks again on a visible countdown ring, with a refresh button, a Checking state and an error state that keeps the last results. Narrow cards switch to two lines per row. With no props it plays a sample story on simulated checks: an OpenAI outage and a Gemini slowdown resolve, Mistral has a short incident, and one check fails to show the error state.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `providers` | `ProviderStatusItem[]` | – | The providers to show. Each has id, name, mark (a 16px ReactNode), detail (a short line such as the models you call), status ("operational" \| "degraded" \| "outage"), latencyMs, days and incident. Leave it out to play the built in sample. |
| `providers[].days` | `ProviderDay[]` | – | Daily history, oldest first; the bar shows the last 30 and pads missing days as No data. Each day has date ("YYYY-MM-DD"), uptime (0 to 100, or null), an optional status (derived from uptime when left out: below 99.9 degraded, below 99 outage) and an optional note for the tooltip. The last day is labeled Today. |
| `providers[].incident` | `{ id: string; title: string; updates: IncidentUpdate[]; url?: string }` | – | An open or just resolved incident. Its row becomes a button that expands the updates. Each update has stage ("investigating" \| "identified" \| "monitoring" \| "resolved"), at (a Date, a timestamp shown as HH:MM UTC, or a preformatted string) and message. |
| `onRefresh` | `(signal: AbortSignal) => Promise<ProviderStatusItem[] \| void>` | – | Fetches fresh status on the countdown and on the refresh button. Return the new providers, or update the providers prop yourself and return nothing. Throw to show the error state; the last results stay on screen and the countdown turns into a retry. A newer check aborts the older one through the signal. Without it the refresh controls are hidden. |
| `refreshInterval` | `number \| null` | `30000` | Milliseconds between automatic checks. The countdown pauses while the card is off screen or the tab is hidden. Retries after an error wait at most 10 seconds. Null turns auto refresh off and keeps the refresh button. The sample uses 8000. |
| `loading` | `boolean` | `false` | Shows skeleton rows with the same row height, for the first load. |
| `error` | `string \| null` | – | An error to show in the header, such as a failed first load. Errors thrown by onRefresh show on their own. |
| `title` | `string` | `"AI providers"` | Card title. |
| `expandedId` | `string \| null` | – | Which provider's incident is open. Pair with onExpandedChange. |
| `defaultExpandedId` | `string \| null` | `null` | The incident open on first render when uncontrolled. |
| `onExpandedChange` | `(id: string \| null) => void` | – | Called when an incident row is opened or closed. |
| `onOpenIncident` | `(provider: ProviderStatusItem, incident: ProviderIncident) => void` | – | Called by the Status page link in an open incident. Without it, the link opens incident.url in a new tab; with neither, the link is hidden. |
| `footnote` | `ReactNode` | – | A quiet line under the list, such as how latency and uptime are measured. The sample shows a sample data note. |
| `notice` | `string` | – | A one-off message for screen readers, such as the result of an action. |
| `className` | `string` | – | Class on the root element. |

### sampleProviders

The sample data behind the preview, exported for prototypes and tests: sampleProviders(check) returns six providers (Anthropic, OpenAI, Google Gemini, Mistral AI, xAI, Amazon Bedrock) after a number of simulated checks. Every number is a plausible sample, not a measurement.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `check` | `number` | – | How many simulated checks have run. The story loops every 11 checks. |

### AnthropicMark, OpenaiMark, GeminiColorMark, MistralColorMark, XaiMark, AwsMark

The provider marks used by the sample, from Simple Icons (CC0) and Lobe Icons (MIT). Mono marks draw with currentColor; Gemini and Mistral keep their brand fills.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | – | Accessible name of the mark. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the refresh button, each incident row and each uptime bar. |
| Enter / Space | On an incident row, opens or closes its updates. |
| Arrow Left / Arrow Right | On an uptime bar, moves the day tooltip one day back or forward. |
| Home / End | On an uptime bar, jumps to the oldest day or today. |
| Escape | On an uptime bar, hides the day tooltip. |

## Accessibility

- The card is a labelled section. Rows are a list; an incident row has a full-row button with aria-expanded and aria-controls, named with the provider, its health and the incident title.
- Health is never color alone: every status shows an icon and a label, and day ticks carry their health in the tooltip and in the bar's label.
- Each uptime bar is one tab stop with a label that sums up the 30 days. Arrow keys move through the days and a polite live region reads each one, so 180 ticks never flood the tab order.
- A polite live region announces checks, refresh errors and simulated actions ("Simulated, no requests were sent").
- Focus rings come from the shared :focus-visible styles; the row button's ring sits just inside the row.

## Motion

- Health labels, latency, uptime and the summary change with a single crossfade (out in 100ms, in over 160ms with a 2px rise) inside a reserved grid cell, so nothing reflows.
- The incident panel springs to its measured height with no bounce (visual duration 240ms); new updates fade in while the panel grows.
- Ticks change color over 240ms. The countdown ring is a linear CSS drain that pauses with the countdown off screen; Checking swaps it for a short spinner and a shimmer label.
- Reduced motion keeps every end state and drops the rise, the height spring, the spinner and the skeleton pulse.

## Responsive behavior

- From 560px wide each row is one line with columns for status, p50 latency, the uptime bar and the 30 day percentage.
- Below 560px (a container query, so it follows the card, not the window) rows take two lines: name and status above, a full width uptime bar and percentage below, with latency under the name.
- Holds up at 360px with no horizontal scroll; long names and details truncate with an ellipsis.
- Touch: tapping a tick shows its day, dragging sideways scrubs, and vertical scrolling still works.

## Performance

- One shared tooltip for the whole card, positioned on demand, instead of one per tick.
- The countdown re-renders once per second at most; the ring animates in CSS. Both pause off screen and in background tabs.
- Refreshes are abortable and never overlap.

## Notes for AI

- Use it for a provider health view in an AI product: a settings page, an admin dashboard tile or a status popover. Wire onRefresh to your own aggregation endpoint; do not poll provider status pages from the browser.
- Pass real marks at 16px. Mono marks should use currentColor so they follow the theme.
- Keep latency and uptime as plain numbers; the component formats them (412 ms, 1.92 s, 99.61%).
- Label sample or synthetic numbers with the footnote prop.

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Tooltip](https://uiarc.dev/components/tooltip/markdown): Short supporting text for unfamiliar controls.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.

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

Provider status: A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
