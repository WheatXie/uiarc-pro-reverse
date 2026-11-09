# Code suggestion

> An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/code-suggestion
- Markdown: https://uiarc.dev/components/code-suggestion/markdown
- Source file: `registry/components/code-suggestion/code-suggestion.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, code suggestion, ai code edit, inline diff, accept reject, cursor, copilot, code review, diff hunk, inline edit, ai coding, apply changes, claude, code diff, suggested changes, accept all

## When to use

- Showing an AI's proposed edit to a file as an inline diff the person accepts or rejects hunk by hunk.
- Approving an agent's file change before it is written, with a clear record of what was kept.
- Landing pages and docs that demonstrate an AI coding feature with a realistic, self playing edit.

## When not to use

- Use a dedicated diff tool for large multi file diffs or side by side comparisons; this card is for one file and a handful of hunks.
- Use code-magic-move to animate code from one version to another without a review step.
- Use code-block to show code without changes.
- Use tool-call for an agent step that is not a file edit.
- Use agent-approvals when the person approves actions in general (emails, payments, deploys) rather than code.

## Installation

Code suggestion is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/code-suggestion
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CodeSuggestion, type CodeSuggestionHunk } from "@/components/arc/code-suggestion/code-suggestion";
import { ClaudeMark } from "@/components/arc/code-suggestion/code-suggestion-marks";

const hunks: CodeSuggestionHunk[] = [
  { id: "timeout", start: 2, remove: 1, summary: "Add a 10s timeout", insert: [
    "  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });",
  ] },
];

export function InlineEdit({ file, onSave }: { file: { name: string; text: string }; onSave: (text: string) => void }) {
  return (
    <CodeSuggestion
      code={file.text}
      hunks={hunks}
      fileName={file.name}
      instruction="Time out slow requests"
      model={{ name: "Claude Opus 5.5", mark: <ClaudeMark aria-hidden style={{ color: "#D97757" }} /> }}
      onResolve={({ code }) => onSave(code)}
    />
  );
}
```

## API reference

### CodeSuggestion

An AI code edit suggestion in a small editor panel, like an inline edit in Cursor or GitHub Copilot. The header shows the model mark, the instruction and the model; the panel shows a file tab with its language mark, a running +/− count and the code with each proposed change as an inline diff hunk: removed lines tinted red with a minus, new lines tinted green with a plus. New lines stream in, then every hunk gets Reject and Accept under it, and the footer offers Reject all and Accept all (Cmd or Ctrl + Enter). Accepting a hunk folds its removed lines away and settles the new lines into the file; rejecting folds the new lines away and restores the original. With no props it plays a simulated suggestion on a sample billing helper (Add retry with backoff, Claude Sonnet 5.5) that reviews itself and replays until someone touches it; pass code and hunks to show a real one.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `code` | `string` | `sample fetch-invoice.ts` | The original file contents, lines split on \n. |
| `hunks` | `CodeSuggestionHunk[]` | – | The proposed changes. Each is { id, start, remove?, insert?, summary? }: it replaces `remove` lines starting at the zero based line `start` with the `insert` lines (remove 0 inserts before start, an empty insert deletes). Overlapping hunks after the first are ignored. Leave it unset to play the built-in simulated suggestion. |
| `status` | `"thinking" \| "streaming" \| "ready" \| "error"` | `"ready"` | Controlled status when you pass hunks. thinking shows a shimmer label over the plain file; streaming shows hunks as they grow (append lines to insert and they fade in); ready shows Accept and Reject; error shows the error message and Retry. Going back to thinking clears earlier decisions. |
| `instruction` | `string` | `"Add retry with backoff"` | What the person asked for, shown as the header title. |
| `model` | `{ name: string; mark?: ReactNode } \| null` | `Claude Sonnet 5.5 with the Claude mark` | The model that wrote the suggestion. Mono marks take the text color; pass style={{ color }} for the brand color. null hides the model line. |
| `fileName` | `string` | `"fetch-invoice.ts"` | File name in the tab. |
| `filePath` | `string` | `"src/billing" for the sample` | Folder shown after the file name from a 520px card. |
| `fileMark` | `ReactNode \| null` | `TypeScript mark` | Language mark in the tab. null hides it. |
| `error` | `string` | `"The model stopped responding. Nothing was changed."` | Message for the error status. |
| `onDecision` | `(hunk: CodeSuggestionHunk, decision: "accepted" \| "rejected", code: string) => void` | – | Called for every hunk accepted or rejected (Accept all calls it once per hunk), with the file as it now stands: accepted hunks applied, the rest original. |
| `onResolve` | `(result: { code: string; accepted: string[]; rejected: string[] }) => void` | – | Called once every hunk has a decision, with the final code and the hunk ids. Write the file here. |
| `onStop` | `() => void` | – | Shows Stop while thinking or streaming. Abort your request here. The simulated suggestion stops on its own and keeps only the hunks it finished. |
| `onRegenerate` | `() => void` | – | Shows Regenerate once the review is done (or there were no changes) and Retry on error. The simulated suggestion replays on its own. |
| `autoPlay` | `boolean` | `true` | Simulated suggestion only: after streaming it accepts and rejects hunks on its own (alternating one by one and Accept all) and replays about 2.6s after it finishes. Any pointer, key or focus inside the card hands control to the person for that run. Off under reduced motion. |
| `shortcuts` | `boolean` | `true` | Cmd or Ctrl + Enter accepts all and Cmd or Ctrl + Backspace rejects all while focus is inside the card. Accept all shows the hint. |
| `maxCodeHeight` | `number` | – | Caps the code area height in pixels; longer files scroll inside it. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline style on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the code area (scrollable, and where the shortcuts work), then each hunk's Reject and Accept, then the footer actions. |
| Enter / Space | Presses the focused Accept, Reject, Accept all, Reject all, Stop or Regenerate. After a hunk is decided, focus moves to the next pending hunk's Accept, or to the code area when none are left. |
| Cmd / Ctrl + Enter | Accepts every pending hunk while focus is inside the card. |
| Cmd / Ctrl + Backspace | Rejects every pending hunk while focus is inside the card. |
| Arrow left / Arrow right | Scrolls long lines when the code area has focus. |

## Accessibility

- The card is a labelled group ("Code suggestion: Add retry with backoff") and the code is a focusable region named after the file.
- Each pending removed or added line starts with a visually hidden "Removed:" or "Added:", so the diff never relies on the red and green tints; the visible minus and plus signs carry it for sighted readers too.
- Accept and Reject name their hunk ("Accept Retry 429 and 5xx with backoff"). Accept all and Reject all expose their shortcuts with aria-keyshortcuts.
- A polite status region speaks the state ("3 changes to review"), each decision ("Accepted: Add retry limits. 2 changes to review") and the result. The simulated suggestion adds "Simulated, nothing was written to disk" when it finishes. Streaming is announced once, not per line.
- Status always pairs an icon with a label: a spinner for reading and writing, a dot for review, a check for applied, a cross for rejected and an alert for errors.
- Focus never falls back to the page when the pressed control leaves with its hunk or state. Pointer focus draws no ring; keyboard focus uses Arc's shared focus outline.

## Motion

- Thinking lasts about 0.8s with a calm shimmer on "Reading fetch-invoice.ts". Then each hunk opens: its removed lines tint red in 240ms and its new lines stream in one every 38ms, each opening to its 20px row in 120ms while it fades in. The whole sample streams in about 1.6s.
- Review bars open under every hunk at once on a critically damped spring (0.24s, no bounce).
- Accept folds the removed lines and the bar to zero height on the same spring (0.26s), so the code below glides up, while the green tint and the plus signs fade out. Reject does the same for the new lines and lets the red fade. Rows have fixed heights, so nothing is measured mid animation and nothing jitters.
- The footer status icon, label and actions each swap with one short crossfade in place (old out in 100ms, new in 160ms, the label with a 2px rise). The icon only swaps when its kind changes, so the spinner keeps turning from Reading to Writing and a count change swaps only the text. Zero counts in the tab turn muted.
- Reduced motion opens on the finished suggestion with no streaming, no autoplay and instant folds; decisions still apply and the status still updates. Autoplay waits until the card is in view and its replay waits until the card is back in view.

## Responsive behavior

- The card fills its container up to 720px. Long lines scroll sideways inside the code area while the line numbers stay pinned on the left and each review bar stays pinned to the visible width, so Accept is always in reach.
- The folder after the file name hides below a 520px card.
- Below a 440px card the gutter narrows, code drops to 12px, hunk summaries hide (the buttons keep their names for screen readers) and the footer stacks the status above full width actions. It holds down to 320px without page scroll.

## Performance

- Rows are fixed 20px lines animated between known heights; nothing is measured during animation.
- Each line is highlighted once and memoized by its text, so streaming a new line never re-highlights the others.
- The simulation runs on single timeouts per step, starts only when the card is in view and stops its loop when it scrolls away. Pass maxCodeHeight for long files.

## Notes for AI

- Use it wherever an AI proposes edits to one file and a person approves them: inline edit in an editor, a code review assistant, a config or SQL change preview, an agent's file edit approval.
- Map a unified diff to hunks: start is the zero based line of the first removed line (or the insert position), remove is the removed line count and insert the added lines. Keep hunks sorted and non overlapping, and give each a summary of two to six words.
- To stream, set status="streaming" and grow the hunks array and each hunk's insert as tokens arrive, then set status="ready". Wire onStop to abort the request with an AbortController.
- Write the file in onResolve (or progressively in onDecision); the component never writes anything itself. Say in surrounding copy when content is a sample.
- Copy marks from code-suggestion-marks.tsx (Claude, OpenAI, TypeScript) or pass any ReactNode with aria-hidden. Brand marks are sample content, never an implied endorsement.
- The highlighter is a small TypeScript and JavaScript tokenizer. For other languages, the code still renders cleanly in the plain text color.

## Related

- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Code block](https://uiarc.dev/components/code-block/markdown): Present code with legible hierarchy and copy access.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
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

Code suggestion: An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
