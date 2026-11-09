# Source cards

> A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/source-cards
- Markdown: https://uiarc.dev/components/source-cards/markdown
- Source file: `registry/components/source-cards/source-cards.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, sources, citations, ai search, perplexity, references, web search, favicon, cited answer, rag, search progress

## When to use

- Citations under an AI search or docs assistant answer.
- Showing live search progress ("Searching 3 of 8") while an agent browses.
- Linking inline [n] references in generated text to the pages they came from.

## When not to use

- A full search results page with many results and filters; use a list layout instead.
- Tool calls with arguments and outputs; use tool-call.
- A single link preview inside prose; use a tooltip or hover card.

## Installation

Source cards is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/source-cards
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SourceCards, SourceCitation } from "@/components/arc/source-cards/source-cards";

<SourceCards
  sources={results}            // [{ title, url, snippet, published }]
  status={searching ? "searching" : "done"}
  total={8}
  query="stripe webhook signature verification"
  duration={2100}
  onSourceClick={(source) => openReader(source.url)}
>
  <p>
    Read the raw body with <code>await request.text()</code> before parsing it <SourceCitation n={1} />
    <SourceCitation n={2} />.
  </p>
</SourceCards>
```

## API reference

### SourceCards

A row of cited sources under an AI answer. Each card shows the site's mark, its domain, the citation number and a two line title. While searching, cards stream into reserved slots under "Searching 3 of 7"; past `max` the rest collapse into a stack of overlapping marks ("+4 more"). Hovering or focusing a card lifts a preview with the passage, and a SourceCitation in the answer highlights its card. With no `sources` it renders a self-playing demo.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `sources` | `SourceCardsSource[]` | – | The sources in citation order: source 1 is cited as [1]. Append as results arrive; each new card fades into its slot. Leave out for the self-playing demo. |
| `status` | `"searching" \| "done" \| "error"` | `"done"` | Searching shows a spinner, a shimmering "Searching", a rolling count and reserved slots. Done shows "7 sources" and the time. Error keeps what arrived and shows "Search failed" with Retry. Done with no sources shows "No sources found". |
| `total` | `number` | – | How many sources the search will return. Drives "Searching 3 of 7" and reserves that many slots, so the row never shifts while it fills. |
| `query` | `string` | – | The search query, shown muted after the status while searching or when nothing was found. |
| `duration` | `number` | – | Search time in ms, shown after the count when done ("7 sources · 2.1s"). |
| `max` | `number` | `3` | Cards shown before the rest collapse into the stack. The grid has max + 1 columns on wide containers and two below 540px. |
| `expanded` | `boolean` | – | Controls whether the stack is open. Pair with onExpandedChange. |
| `defaultExpanded` | `boolean` | `false` | Opens the stack on first render. |
| `onExpandedChange` | `(expanded: boolean) => void` | – | Called from the stack, the Show all toggle, or a citation that points into the stack. |
| `highlighted` | `number \| null` | – | Controlled highlighted source number (1-based). Uncontrolled, a citation click highlights its card for 2.6s. |
| `onHighlightChange` | `(n: number \| null) => void` | – | Called when a SourceCitation is clicked. |
| `onSourceClick` | `(source: SourceCardsSource, n: number) => void` | – | Makes cards buttons and calls this instead of navigating, for an in-app reader or analytics. Without it cards are links that open in a new tab. |
| `onRetry` | `() => void` | – | Shows Retry on error and Search again when nothing was found. |
| `error` | `string` | – | Detail shown after "Search failed", such as "The search provider timed out after 8s." |
| `hideStatus` | `boolean` | `false` | Hides the status line when your UI already shows search progress. |
| `children` | `ReactNode` | – | The answer, rendered between the status line and the cards. Its height springs as it streams so the cards glide down. SourceCitation inside it is linked to the cards. |
| `label` | `string` | `"Sources"` | Accessible name of the source list. |
| `className` | `string` | – | Class on the root element. |

### SourceCitation

An inline [n] chip for the answer text, styled like the number on each card. Inside SourceCards it names its source for screen readers, turns accent while its card is highlighted, and highlights the card on click (opening the stack when needed).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `n` (required) | `number` | – | The 1-based source number. |
| `onClick` | `(event: MouseEvent<HTMLButtonElement>) => void` | – | Extra click handler, for example to scroll the cards into view. |
| `className` | `string` | – | Class on the chip. |

### SourceCardsSource

One source.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` (required) | `string` | – | Page title as the search result shows it. Clamped to two lines on the card. |
| `url` (required) | `string` | – | Full URL. The host becomes the domain and picks the mark: github.com, developer.mozilla.org, stripe.com, vercel.com, wikipedia.org and stackoverflow.com draw their real marks; anything else gets a lettered disc. |
| `id` | `string` | – | Stable key. Defaults to the URL. |
| `site` | `string` | – | Readable site name for the preview and the stack, such as "Stripe Docs". |
| `snippet` | `string` | – | The passage the answer relied on, shown in the hover preview (four lines). |
| `published` | `string` | – | Short date label, such as "Oct 9, 2026". |
| `mark` | `"github" \| "mdn" \| "stripe" \| "vercel" \| "wikipedia" \| "stackoverflow"` | – | Forces a built in mark when the URL does not match. |
| `icon` | `ReactNode` | – | Custom favicon, drawn at 14px on the card and 16px in the preview. |

### SourceCardsSimulation

The demo SourceCards renders without sources, exported for docs and previews.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `scenario` | `"live" \| "error" \| "empty"` | `"live"` | Live searches, streams a cited answer and tours two citations, looping until someone interacts. Error fails after two sources with Retry. Empty finds nothing and offers Search again. |
| `className` | `string` | – | Class on the demo panel. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through citations, the Show all toggle, each card and the stack. A focused card shows its preview. |
| Enter / Space | Opens a card (or calls onSourceClick), opens the stack, or highlights a citation's card. |
| Escape | Closes the open preview. |

## Accessibility

- The cards are a labelled list (aria-label "Sources") marked aria-busy while searching; skeleton slots are hidden from assistive technology.
- A polite live region announces status changes once: searching for the query, the number found, no sources, or the failure. Counts do not announce on every card.
- Each card's name reads number, title and domain, and says when it opens in a new tab. The preview is a tooltip linked with aria-describedby while open.
- SourceCitation is a real button named "Source 2: Request: text() method, developer.mozilla.org"; its highlighted state is never color alone because the card also gains an outline.
- Status always pairs an icon with words: spinner and Searching, globe and the count, alert and Search failed, crossed search and No sources found.
- The demo says in a live region that the search is simulated and that card clicks open nothing.

## Motion

- Cards fade in with a 4px rise in 180ms as they arrive; skeletons crossfade out in 120ms. Nothing bounces.
- Collapsing the stack or a failed search dropping its reserved slots fades the leaving slots in place (120ms) while the stack or card taking their cell fades in, and the row height glides once. Skeleton bars sit on the same 18px lines as the text that replaces them.
- Counts roll 5px with tabular numerals in a reserved width; status icons and labels crossfade (100ms out, 160ms in).
- The answer's height springs (bounce 0) as it streams so the cards glide down instead of stepping one line at a time; a width change cuts straight to the new height.
- Previews open after a 320ms hover intent, then switch instantly between cards; they fade and rise 4px with a 0.98 scale in 160ms.
- Reduced motion keeps every end state and highlight but drops the rise, scale and skeleton pulse. The demo pauses off screen.

## Responsive behavior

- Wide containers show max + 1 equal columns; below 540px (container query) the grid becomes two columns, with the stack as the last tile.
- Previews align to the card's left or right edge so they never leave the component, and drop below the card when there is no room above.
- On touch there is no hover preview; tapping a card opens it. Citation chips have an enlarged hit area.

## Performance

- Cards are plain elements with CSS transitions; motion only drives arrivals, the preview and number rolls.
- One ResizeObserver per auto height box; the demo's timers stop off screen through an IntersectionObserver.
- Built in marks are inline SVG paths with no network requests.

## Notes for AI

- Use under an assistant message that cites web or docs sources. Keep sources in citation order so [n] maps to card n.
- Stream results by appending to sources with status "searching" and a total; switch to "done" when the model starts answering.
- Put the answer inside SourceCards as children when it contains SourceCitation chips; otherwise render SourceCards alone under your own answer and drive highlighted yourself.
- Pass onSourceClick for in-app reading; omit it for plain new-tab links. Do not wrap cards in your own links.
- Known hosts draw real marks automatically; pass icon for other favicons rather than inventing a logo.

## Related

- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Tooltip](https://uiarc.dev/components/tooltip/markdown): Short supporting text for unfamiliar controls.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.

## Also in ai

- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
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

Source cards: A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
