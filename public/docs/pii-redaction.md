# PII redaction

> A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/pii-redaction
- Markdown: https://uiarc.dev/components/pii-redaction/markdown
- Source file: `registry/components/pii-redaction/pii-redaction.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, pii, redaction, guardrail, privacy, data loss prevention, dlp, anonymize, mask, placeholder, llm safety, prompt, claude, personal data, gdpr, support assistant

## When to use

- Explaining or proving a privacy guardrail in an AI product: support assistants, health or finance copilots, enterprise chat.
- A settings or onboarding screen where admins see what the PII filter does before they turn it on.
- A playground where people paste text and see exactly what would reach the model.

## When not to use

- Use ai-chat or ai-composer for the conversation itself; redact behind the scenes and show this card only where the guardrail needs explaining.
- Do not rely on the built-in detector for compliance; pass a real DLP service through detect.
- Use tool-call to show an arbitrary tool step in a transcript.

## Installation

PII redaction is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/pii-redaction
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PiiRedaction, detectPii, redactPii, restorePii } from "@/components/arc/pii-redaction/pii-redaction";

export function SupportGuard({ user }) {
  return (
    <PiiRedaction
      autoPlay={false}
      defaultMessage=""
      names={[user.name]}
      model={{ name: "Claude Sonnet 5.5" }}
      detect={async (text, signal) => {
        const res = await fetch("/api/dlp/scan", { method: "POST", body: text, signal });
        return res.json(); // [{ type: "email", start: 74, end: 100 }, ...]
      }}
      send={async (prompt, signal) => {
        const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ prompt }), signal });
        const { text } = await res.json();
        return text; // may contain [NAME_1], [EMAIL_1], restored by the component
      }}
      onRedact={({ entities }) => audit.log("pii.redacted", entities.map(e => e.type))}
    />
  );
}

// Server side, without the card:
const { prompt, entities } = redactPii(message, detectPii(message, { names: [user.name] }));
const reply = restorePii(await model.complete(prompt), entities);

// With no props it plays the simulated support conversation.
<PiiRedaction />
```

## API reference

### PiiRedaction

A guardrail card that shows personal data being redacted before a prompt reaches the model. Scan marks each name, email, phone number and card in the message with its type, then swaps each one for a numbered placeholder such as [EMAIL_1] in a single crossfade. Send carries the safe prompt along a small flow (you, the PII guard, the model), the reply streams back in quick chunks with its placeholders, and the guard restores the original values for the person. Show original flips the message between the safe prompt and what was typed. The message is editable before a scan, so people can paste their own text. With no props it plays a simulated support conversation with Claude Sonnet 5.5 on a loop while on screen.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultMessage` | `string` | `piiSampleMessage` | The message to check. The sample is a double charge support request from Sofia Ramirez with a name, a Luhn-valid test card, an email and a phone number. |
| `editable` | `boolean` | `true` | Lets people edit the message before a scan. Cmd or Ctrl plus Enter scans from the field. |
| `names` | `string[]` | `["Sofia Ramirez"]` | Names the built-in detector always flags, on top of introductions like "I'm", "this is" and "my name is". Pass the signed-in person's name and their contacts. |
| `detect` | `(text: string, signal: AbortSignal) => PiiMatch[] \| Promise<PiiMatch[]>` | – | Replaces the built-in detector, for example with your DLP or NER service. Return spans as { type: "name" \| "email" \| "phone" \| "card", start, end } with an exclusive end. The signal aborts when the person presses Stop or Reset. |
| `send` | `(prompt: string, signal: AbortSignal) => Promise<string>` | – | Sends the redacted prompt to your model and resolves with its reply, placeholders included. The component restores them. Without it the reply is simulated and the status says so. A rejection shows the error message with Retry. |
| `model` | `{ name: string; mark?: ReactNode }` | `{ name: "Claude Sonnet 5.5" }` | The model the safe prompt goes to, on the flow and above the reply. The mark draws at 16px; without one the Claude mark shows in its brand color. |
| `autoPlay` | `boolean` | `true` | Plays scan, send and restore on a loop while at least a quarter of the card is on screen. Stops for good as soon as someone edits, toggles or presses a button. Off with reduced motion. |
| `showOriginal` | `boolean` | – | Shows the original message instead of the safe prompt once it is redacted. Pair with onShowOriginalChange. |
| `defaultShowOriginal` | `boolean` | `false` | Initial Show original state when uncontrolled. |
| `onShowOriginalChange` | `(show: boolean) => void` | – | Called when the Show original switch changes. |
| `onRedact` | `(result: { prompt: string; entities: PiiEntity[] }) => void` | – | Called once the message is redacted, with the safe prompt and every entity (type, start, end, value, token). Log the entities server side, never the prompt alongside them. |
| `onReply` | `(reply: { raw: string; restored: string }) => void` | – | Called when the reply is restored, with the model's raw reply and the text the person sees. |
| `onPhaseChange` | `(phase: PiiRedactionPhase) => void` | – | Called on every phase change: idle, scanning, redacted, sending, thinking, streaming, restoring, done or error. |
| `className` | `string` | – | Class on the root card. |

### detectPii, redactPii, restorePii

The pure helpers behind the card, safe on the server. detectPii(text, { names }) finds emails, card numbers (13 to 19 digits that pass Luhn), phone numbers (7 to 15 digits) and names. redactPii(text, matches) returns { prompt, entities } and gives a repeated value the same token. restorePii(reply, entities) puts the values back and leaves unknown tokens as they are.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | – | The message to scan or redact. |
| `matches` | `PiiMatch[]` | – | Spans from detectPii or your own detector. Overlapping spans after the first are skipped. |
| `entities` | `PiiEntity[]` | – | The entities from redactPii, used to restore a reply. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the message field (before a scan), the Show original switch once there is a safe prompt, Reset when it shows, and the primary action. |
| Cmd + Enter, Ctrl + Enter | Scans the message from the field. Focus moves to the primary action, which now reads Stop. |
| Space, Enter | Toggles Show original, or activates Scan, Stop, Send, Run again, Retry or Reset. |

## Accessibility

- A polite status region announces each phase ("Scanning for personal data", "4 items redacted", "Reply restored") and, when the reply is simulated, adds "Simulated, nothing was sent".
- Status never relies on color: every phase pairs an icon with a short label, each type cell says Name, Email, Phone or Card with its token or None found, and marks in the original message carry labels such as "Email, redacted as EMAIL_1".
- Scan, Stop, Send, Run again and Retry are one button whose label changes, so keyboard focus stays put through the whole flow. Reset returns focus to the message field.
- Only the visible text layer is exposed to assistive tech; the hidden layers that keep the height steady are aria-hidden.
- The flow strip is decorative and hidden from screen readers, since the status region already narrates each hop.
- The Show original label is a real label for the switch, and the switch is disabled with a muted label until there is a safe prompt to compare.

## Motion

- Scan highlights each entity in turn, 120ms apart, with a 160ms tint in its type color while the matching type cell crossfades from Checking to its token.
- The swap to placeholders is a single crossfade between two stacked text layers (old out in 100ms, new in over 160ms), so no words slide or rewrap mid animation and the height never changes.
- Each hop of the flow is one dot traveling the connector in 460ms on an ease in out curve; the active node's label shimmers while it works.
- The reply streams three to six words every 34ms, each chunk only fading in, then crossfades once to the restored text.
- Labels, statuses and the Reset button crossfade in place; nothing bounces and nothing changes size between states.
- Reduced motion drops the travel, the stagger, the streaming and the autoplay loop, and keeps every state, label and announcement.

## Responsive behavior

- The card fills its container up to 640px. Below 520px the four type cells fall into two rows of two.
- Below 400px the card tightens its gaps and hides the Simulated tag (the status region still announces it); the model name truncates with an ellipsis in the flow.
- Text layers stack in one grid cell and the reply reserves the sample reply's height, so nothing jumps at 360px, 390px or desktop widths.

## Performance

- Detection is a handful of regular expressions and a Luhn check, linear in the message length.
- The loop runs only while the card is at least a quarter on screen (IntersectionObserver) and stops for good on the first interaction.
- Highlights and layer swaps are CSS transitions on opacity and background color; the dot animates a transform; every pending step aborts through one AbortController.

## Notes for AI

- Redact on the server in production: run detectPii and redactPii (or your DLP) before the prompt leaves your backend, keep entities in the request scope, and call restorePii on the reply. Use this card to show people what happens, or as the UI over that pipeline through detect and send.
- The built-in detector is a baseline. Names beyond the names list and simple introductions need an NER model or a DLP service passed through detect.
- Keep the same token for a repeated value within one conversation so the model can refer back to it; redactPii does this per call, so persist the entity map across turns if you need it.
- Instruct the model to keep placeholders verbatim (for example "Refer to [EMAIL_1] exactly as written") so restorePii can put the values back.
- Set autoPlay={false} in product UI and pass defaultMessage="" for a blank field.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Prompt studio](https://uiarc.dev/components/blocks/prompt-studio/markdown): One card for editing, testing and shipping a prompt template: variables as chips with sample values, a test run against the chosen model, and versions you can compare and promote to production.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.

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

PII redaction: A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
