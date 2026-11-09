# TL;DR toggle

> An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/tldr-toggle
- Markdown: https://uiarc.dev/components/tldr-toggle/markdown
- Source file: `registry/components/tldr-toggle/tldr-toggle.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-tooltip
- Keywords: special, ai, new, tldr, summarize, summary toggle, ai summary, key points, article summary, read mode, length slider, streaming summary, source links, citations

## When to use

- Offering a quick summary or key points above or in place of a long article, doc or report.
- Letting readers verify AI claims against the source, through key points that link back to paragraphs.
- Reading surfaces where people choose how much detail they want with a length control.

## When not to use

- Open-ended questions about content: use an answer or chat component such as ai-answer.
- Short content under a couple of paragraphs, where a summary saves no time.
- Summaries of many documents at once: use a list or a digest layout instead of one card per item.

## Installation

TL;DR toggle is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/tldr-toggle
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TldrToggle, type TldrSummarize } from "@/components/arc/tldr-toggle/tldr-toggle";

// Stream from your route: newline-delimited JSON events, { type: "text", text } or { type: "point", source }.
const summarize: TldrSummarize = async function* ({ mode, length, targetWords, pointCount, article, signal }) {
  const response = await fetch("/api/tldr", {
    method: "POST",
    body: JSON.stringify({ mode, length, targetWords, pointCount, paragraphs: article.paragraphs }),
    signal,
  });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line) yield JSON.parse(line);
  }
};

export function PostSummary({ post }) {
  return (
    <TldrToggle
      article={{
        title: post.title,
        source: { name: "Engineering blog" },
        author: { name: post.author.name, avatar: post.author.avatar },
        date: post.date,
        paragraphs: post.paragraphs, // [{ id: "intro", text: "..." }, ...]
      }}
      summarize={summarize}
      model={{ name: "Claude Haiku 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> }}
      onJump={id => track("tldr_jump", { id })}
    />
  );
}
```

## API reference

### TldrToggle

An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article in fast 3 to 8 word chunks while the card's height follows on a spring with no bounce. Key points arrive as a checklist: each point ticks when it is written, and once the list is done its ¶ jump link switches back to the article, scrolls the source paragraph into view and highlights it. Results are kept per mode and length, so switching back is instant; Regenerate asks again, Stop or Escape ends a stream and keeps what arrived, and a failure shows the message with Try again. With no props it summarizes a sample Linear engineering post with a simulated Claude Haiku 5.5 and opens the summary by itself once in view.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `article` | `{ title: string; paragraphs: { id: string; text: string }[]; source?: { name: string; mark?: ReactNode }; author?: { name: string; avatar?: string }; date?: string; readingTime?: string }` | `tldrSampleArticle` | The article to show and summarize. Paragraph ids are what key points link back to. readingTime is worked out at 230 words a minute when left out. An article with no paragraphs shows a quiet empty state. |
| `summarize` | `(request: TldrRequest) => AsyncIterable<TldrStreamEvent> \| Promise<string \| TldrKeyPoint[]>` | – | Produces the result. The request carries mode ("summary" \| "points"), length (1 to 5), targetWords (35 to 130), pointCount (3 to 7), the article and an AbortSignal that fires on Stop, Escape, a mode or length change, or unmount. Stream { type: "text", text } events for prose; for key points send { type: "point", source: paragraphId } before each point's text. A promise of the finished string or points also works: the card streams it in chunks itself. Leave it out to run the built-in simulation, which sends nothing. |
| `model` | `{ name: string; mark?: ReactNode }` | `Claude Haiku 5.5` | The model credited in the footer, with a 14px mark. Give a mono mark its brand color, for example the Claude mark in #D97757. |
| `mode` | `"full" \| "summary" \| "points"` | – | Controlled mode. Pair with onModeChange. |
| `defaultMode` | `"full" \| "summary" \| "points"` | `"full"` | Starting mode when uncontrolled. |
| `onModeChange` | `(mode: TldrMode) => void` | – | Called when the switch, a jump link or autoplay changes the mode. |
| `length` | `1 \| 2 \| 3 \| 4 \| 5` | – | Controlled length. Summaries aim for about 35, 60, 85, 100 and 130 words; key points return 3 to 7 items. |
| `defaultLength` | `1 \| 2 \| 3 \| 4 \| 5` | `2` | Starting length when uncontrolled. |
| `onLengthChange` | `(length: TldrLength) => void` | – | Called when a slider drag is released or a key moves it, not on every step, so each change makes one request. |
| `onComplete` | `(result: { mode; length; text: string; points?: TldrKeyPoint[]; words: number }) => void` | – | Called when a result finishes, for analytics or a server-side cache. Stopped and failed runs do not call it. |
| `onJump` | `(paragraphId: string) => void` | – | Called when a key point's jump link is used, before the card scrolls to the paragraph. |
| `autoPlay` | `boolean` | `true without summarize` | Opens the summary by itself once the card is half in view for a second, unless the reader has already touched the card. |
| `simulated` | `boolean` | `true without summarize` | Adds "Simulated, nothing was sent" to announcements and error text. Set it when you wrap simulateTldr yourself. |
| `className` | `string` | – | Class on the root element. |

### simulateTldr

The simulation behind the preview, exported for prototypes and tests. It waits briefly, then streams the authored summary or key points for the sample article (or lead sentences of any other article) in 3 to 8 word chunks every 30 to 40ms. Nothing is sent anywhere.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `request` (required) | `TldrRequest` | – | The request the card passes to summarize. |
| `options.fail` | `boolean` | `false` | Throws after the thinking pause, to show the error state. |
| `options.thinkMs` | `number` | `700` | Milliseconds of thinking before the first chunk. |

### streamResult

Turns a finished string or key point list into paced stream events, honoring the AbortSignal. Useful when a provider returns whole results but you still want the card to stream.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `result` (required) | `string \| TldrKeyPoint[]` | – | The finished summary, or the key points with their source paragraph ids. |
| `signal` (required) | `AbortSignal` | – | Stops the stream. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the mode switch, the length slider, the key point jump links and the footer actions. |
| Arrow keys | On the mode switch, move between Full, Summary and Key points. On the slider, change the length by one step; each step makes one request. |
| Home / End | Jump to the first or last mode, or the shortest or longest length. |
| Enter / Space | On a jump link, switch to the article, scroll to its source paragraph, move focus there and highlight it. |
| Escape | Stops a running stream and keeps what arrived. |

## Accessibility

- The card is an article with the title as a heading. The mode switch is a labelled group of pressed buttons, the length is a slider whose spoken value is the target ("~60 words", "4 points"), disabled in Full mode.
- A polite live region announces each run once ("Summarizing with Claude Haiku 5.5", "Summary ready, 58 words", "4 key points ready", "Stopped"), never the streamed chunks. With the simulation it adds "Simulated, nothing was sent".
- The card is aria-busy while a result streams. Failures render as an alert with the message and a Try again button.
- Jump links are named after their point ("Jump to paragraph 3: Partial bootstrapping loads..."), and the jump moves focus to the highlighted paragraph so screen reader and keyboard users land where the eye does.
- Status is never color alone: done, stopped and failed each pair an icon with a word, and key points tick from a dashed circle to a check.

## Motion

- The body's height follows its content on one critically damped spring (visualDuration .26, no bounce), whether a view swaps or text streams in. A container resize cuts straight to the new height.
- Views swap with a single crossfade: old out in 100ms, new in over 160ms. The footer's state label and actions crossfade the same way.
- Streamed chunks of 3 to 8 words arrive every 30 to 40ms and only fade in over 140ms. A cached result appears whole, with no fade.
- Thinking lasts about 0.7s with a calm shimmer on its label; the footer's Writing label shimmers while text arrives, so only one shimmer runs at a time.
- A jump waits for the height to settle, scrolls smoothly to the paragraph and fades a highlight in over 160ms and out over 600ms.
- Reduced motion drops the height spring, the chunk fades, smooth scrolling and the icon transitions; every end state and the highlight remain.

## Responsive behavior

- The card fills its container up to 680px. Below 520px the length slider moves under the mode switch at full width; below 440px the padding steps from 24px to 16px.
- Footer labels stay on one line, the model name truncates first, and actions keep 32px targets.
- Works at 360px with no horizontal scroll; long titles wrap and balance.

## Performance

- Each chunk is a small span with a CSS fade; a long summary renders a few dozen nodes.
- One ResizeObserver drives the height spring, and results are cached per mode and length, so switching back makes no request.
- Changing the slider aborts the previous request through its AbortSignal before the next starts.

## Notes for AI

- Use it where people read long content inside a product: blog posts, docs pages, release notes, tickets, research reports or support articles.
- Give paragraphs stable ids and have the model return the id each key point came from, so jump links land on the right paragraph.
- Pass length to the model as targetWords or pointCount rather than a vague word like "short".
- Stream when the provider streams; return a promise when it does not, and the card paces it.
- Without summarize the card runs a simulation and says so in its announcements; never ship that to production.

## Related

- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
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

TL;DR toggle: An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
