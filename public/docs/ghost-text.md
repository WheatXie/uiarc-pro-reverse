# Ghost text

> An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ghost-text
- Markdown: https://uiarc.dev/components/ghost-text/markdown
- Source file: `registry/components/ghost-text/ghost-text.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, ghost text, ai autocomplete, inline suggestion, copilot, tab to accept, text completion, autocomplete textarea, predictive text, smart compose, llm, claude, streaming, pull request, email, writing assistant

## When to use

- Long-form fields people write in product: pull request descriptions, emails, support replies, issue bodies, release notes, CRM notes.
- Short single-line fields where a likely completion saves typing, such as an email subject or a commit message.
- Anywhere you want AI help that stays out of the way until the person pauses, and never changes their text without an explicit key press.

## When not to use

- Use ai-composer for a chat-style prompt box that sends a message to an assistant.
- Use code-suggestion for code diffs with accept and reject per hunk.
- Use a combobox or command menu when the person picks from a list of known options rather than free text.
- Avoid it in fields with sensitive content (passwords, card numbers, health data) unless your model provider and data policy allow it.

## Installation

Ghost text is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ghost-text
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GhostText, ClaudeMark } from "@/components/arc/ghost-text/ghost-text";

// Stream a continuation from your API route (any model works).
async function* suggest(text: string, signal: AbortSignal) {
  const response = await fetch("/api/autocomplete", { method: "POST", body: JSON.stringify({ text }), signal });
  if (!response.ok || !response.body) throw new Error("Autocomplete is unavailable");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    yield value;
  }
}

export function PullRequestDescription() {
  const [body, setBody] = useState("");
  return (
    <GhostText
      value={body}
      onValueChange={setBody}
      suggest={suggest}
      rows={6}
      placeholder="Describe what changed and why"
      label="Description"
      model={{ name: "Claude Haiku 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> }}
      onAccept={(text, mode) => track("autocomplete_accept", { mode, chars: text.length })}
    />
  );
}

// Single-line, uncontrolled, whole suggestions from a promise.
<GhostText multiline={false} defaultValue="" aria-label="Subject" suggest={(text, signal) => api.complete(text, { signal })} />

// Flush inside your own card: the card owns the border and focus style.
<div className="compose-card">
  <ComposeHeader />
  <GhostText variant="plain" value={body} onValueChange={setBody} suggest={suggest} aria-label="Message" />
</div>

// With no props it plays the simulated pull request card.
<GhostText />
```

## API reference

### GhostText

Inline AI autocomplete for a textarea or a single-line input. When the person pauses, muted ghost text continues their sentence right at the caret, streamed from your suggest(text, signal) function. Tab accepts the whole suggestion, Cmd+Right (Ctrl+Right on Windows, Option or Alt+Right too) accepts one word at a time, Escape dismisses it, and typing the same characters as the ghost keeps it in place instead of asking again. A small chip in the corner shows the model's mark and name, a shimmering Thinking while it waits, a Tab key cap and "to accept" when a suggestion is ready (a tap target on touch screens), Accepted with a check after Tab, and No suggestion with Retry when your function throws. Accepted text settles from ghost ink to text ink in place, with no flicker or movement. Works controlled or uncontrolled, as a bordered field or flush inside your own card (variant="plain"). With no props it plays a simulated pull request card that types, pauses, accepts and loops, and you can take it over by clicking it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `suggest` | `(text: string, signal: AbortSignal) => string \| null \| Promise<string \| null> \| AsyncIterable<string>` | – | Returns a continuation for the text before the caret. Return a string or a promise of one for a whole suggestion, or an async iterable (an async generator over your model's stream) to stream it in chunk by chunk. Return null synchronously to skip without showing Thinking. Abort your request when signal fires: the person kept typing, moved the caret or left the field. A thrown error shows No suggestion with Retry. |
| `value` | `string` | – | The text, for a controlled field. Pair with onValueChange. Programmatic changes run through the same logic as typing, so a parent can drive the field. |
| `defaultValue` | `string` | `""` | The starting text for an uncontrolled field. |
| `onValueChange` | `(value: string) => void` | – | Called with the new text on every edit and every accepted suggestion or word. |
| `delay` | `number` | `450` | Milliseconds of pause before suggest is called. Every keystroke resets it. |
| `minLength` | `number` | `3` | Trimmed characters needed before suggestions start. |
| `multiline` | `boolean` | `true` | A growing textarea with a footer row, or a single-line input with the chip inline at its end. Line breaks pasted into a single-line field become spaces. |
| `variant` | `"field" \| "plain"` | `"field"` | field draws its own 1px border, hover and keyboard focus ring. plain drops the border, background and ring so the text sits flush inside a card you already have (a compose panel, a PR form); give the card its own focus style. |
| `rows` | `number` | `3` | Minimum visible lines of a multi-line field. |
| `maxRows` | `number` | `10` | Lines before a multi-line field stops growing and scrolls, keeping the caret in view. |
| `placeholder` | `string` | – | Placeholder text for the empty field. |
| `label` | `ReactNode` | – | A quiet row above the text, such as a field name with an icon. It labels the field unless aria-label is set. Multi-line only. |
| `footer` | `ReactNode` | – | Content at the start of the footer row, such as a character count, a note or a send button. Multi-line only. |
| `model` | `{ name: string; mark?: ReactNode }` | `{ name: "Autocomplete" }` | The model behind the suggestions. The name shows in the idle chip and the mark at 12px in every chip state. Give a mono mark its brand color, for example the Claude mark in #D97757. |
| `hint` | `boolean` | `true` | Shows the chip, the Cmd+Right and Escape key hints next to it on wide fields, and a screen reader description of the keys. |
| `onAccept` | `(accepted: string, mode: "all" \| "word") => void` | – | Called with the text that was accepted: the whole suggestion (all) or the next word (word). Useful for acceptance-rate analytics. |
| `onDismiss` | `(suggestion: string) => void` | – | Called with the suggestion the person dismissed with Escape. |
| `onStatusChange` | `(status: "idle" \| "loading" \| "ready" \| "error") => void` | – | Called when the suggestion status changes. |
| `disabled` | `boolean` | `false` | Disables the field and stops suggestions. |
| `name, id, autoFocus, aria-label` | `string \| boolean` | – | Passed to the textarea or input. |
| `notice` | `string` | – | A one-off message for screen readers, joined to the field's own announcements. |
| `ref` | `Ref<GhostTextHandle>` | – | Imperative handle: focus(), acceptAll(), acceptWord(), dismiss(), request() to ask now without waiting for a pause, and getState() returning { status, suggestion, streaming }. Use it for an Accept button of your own or for tests. |
| `className` | `string` | – | Class on the root element. |

### createDemoSuggest

The rule based stand in for a model used by the preview, exported for prototypes and tests. It streams PR writing continuations in 3 to 6 word chunks after a short think, completes partial words from a small vocabulary, and fails with a timeout when the text contains the word timeout so the error state can be seen. Nothing is sent anywhere.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `scriptedOnly` | `boolean` | `false` | Only answer the autoplay script's contexts and return null for everything else. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Accepts the whole suggestion and keeps the caret at the end. With no suggestion showing, Tab moves focus as usual. |
| Cmd+Right / Ctrl+Right | Accepts the next word of the suggestion; the rest stays. Option+Right and Alt+Right work too. With no suggestion showing, the keys move the caret as usual. |
| Escape | Dismisses the suggestion. With no suggestion showing, Escape is left alone, so a surrounding dialog can still close. |
| Typing | Characters that match the start of the ghost consume it in place; anything else clears it and a new suggestion is asked for after the next pause. |
| Arrow keys, click | Moving the caret away from the end of the text clears the suggestion; suggestions only continue from the end. |

## Accessibility

- The field is a native textarea (or input), labelled by aria-label or the label row, and described by a hidden sentence that explains Tab, Cmd or Ctrl+Right and Escape.
- The ghost text lives in an aria-hidden mirror behind the field, so it is never read as content. A polite status region reads the finished suggestion ("Suggestion: date the plan changed. Press Tab to accept."), then Suggestion accepted, Suggestion dismissed or Couldn't get a suggestion.
- The chip is a button with a clear name in each state (Accept suggestion, Retry suggestion). It is reachable with Tab only in the error state, where Retry is the action; in the ready state Tab itself accepts. Pressing the chip never steals focus from the field.
- State is never shown by color alone: Thinking, the Tab key cap with "to accept", Accepted with a check and No suggestion with an alert icon all carry words.
- Keyboard focus draws Arc's focus ring around the whole field; pointer focus does not.
- On touch screens, where there is no Tab key, the chip reads Tap to accept.

## Motion

- Ghost text only fades in, chunk by chunk as it streams (140ms each, opacity only, no blur or slide), so a suggestion settles without any movement. Escape and leaving the field fade it out in 110ms; typing a different character clears it at once so nothing lingers over new text.
- Accepting turns the ghost solid in place: for 200ms an aria-hidden mirror with the field's exact metrics draws the text while the native glyphs go transparent (the caret stays), and the accepted range eases from muted to text color. Cmd+Right does the same per word, and the rest of the ghost never re-fades.
- The field's height follows the text, ghost included, on a 180ms tween and never bounces. The box is clipped while it grows, so the browser cannot scroll it under the caret mid-tween.
- Chip states crossfade in place (old out in 100ms, new in 160ms) while the chip's width follows on a 200ms tween, anchored to its right edge. Key caps press for 160ms when their key or the matching handle method fires. Thinking carries a calm shimmer.
- Reduced motion removes the fades, the ink merge, the shimmer and the height tween and keeps every state, text and announcement. The preview plays once and stops instead of looping, and it pauses while off screen.

## Responsive behavior

- The field fills its container's width; the text and ghost wrap identically at any width, so the suggestion always starts at the caret.
- Below 520px of field width the Cmd+Right and Escape hints step aside and only the chip remains; the footer note truncates with an ellipsis.
- On touch screens the chip reads Tap to accept and accepts on tap.
- The single-line variant scrolls sideways with the caret and keeps the chip inline at its end.

## Performance

- One debounced request at a time: each keystroke clears the timer and aborts the in-flight request, so a fast typist triggers nothing until they pause.
- Typing through a matching suggestion trims it locally without a new request.
- The ghost renders as a few spans in a mirror behind a native textarea, so typing stays native-fast and works with spellcheck, IME, undo and autofill.
- The height and the chip width animate motion values directly; ResizeObserver measures, never a layout read mid-animation.

## Notes for AI

- Use a fast, cheap model for suggest (Claude Haiku 5.5, Gemini 3.8 Flash or DeepSeek V4.1 Flash): people expect ghost text within about half a second of pausing. Cap max tokens to a sentence or a short line.
- Prompt for a continuation only: no preamble, no repetition of the input, and include a leading space when the text ends mid-sentence without one. The component strips a leading space if the text already ends with whitespace.
- Always pass signal to fetch. The component aborts on every keystroke, caret move, blur and accept, and ignores late chunks.
- Return null synchronously for contexts you never want to complete (inside a code block, after a URL), so no Thinking state flashes.
- Log onAccept and onDismiss to measure acceptance rate per model and prompt.

## Related

- [Textarea](https://uiarc.dev/components/textarea/markdown): A multiline field for notes, descriptions, and longer text.
- [Input](https://uiarc.dev/components/input/markdown): A single line field with clear labels and useful states.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
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

Ghost text: An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
