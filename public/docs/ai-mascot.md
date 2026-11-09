# AI mascot

> A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ai-mascot
- Markdown: https://uiarc.dev/components/ai-mascot/markdown
- Source file: `registry/components/ai-mascot/ai-mascot.tsx`
- Keywords: special, ai, motion, new, ai mascot, assistant character, ai avatar, thinking animation, generating, loading character, agent face, blob, listening, writing, done sparkle, error shake, empty state, eyes follow cursor, svg animation

## When to use

- Give an assistant a face that shows what it is doing: in a reply header, beside a composer, on an image canvas while it generates, or in an empty state.
- Products that want generation to feel alive and friendly without a spinner, with states that read at 24px.

## When not to use

- Use agent-status when people need the steps, tools and elapsed time of a run, not just a mood.
- Use text-shimmer alone for a plain "Thinking" line in dense interfaces where a character would distract.
- Do not use it as a progress indicator with a known percentage; use a progress bar.

## Installation

AI mascot is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-mascot
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiMascot, type MascotStatus } from "@/components/arc/ai-mascot/ai-mascot";

// Inline next to a streaming reply
export function ReplyHeader({ phase }: { phase: "thinking" | "streaming" | "complete" | "failed" }) {
  const status: MascotStatus = phase === "streaming" ? "writing" : phase === "complete" ? "done" : phase === "failed" ? "error" : "thinking";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <AiMascot status={status} size={24} name="Atlas" followPointer={false} />
      <span>Atlas</span>
    </div>
  );
}

// Empty state: large, watching the pointer anywhere on the page
<AiMascot status="idle" size={160} followPointer="page" name="Atlas" />

// In a voice composer while the microphone is open
<AiMascot status={recording ? "listening" : "idle"} size={40} tone="ink" announce />

// Brand color body with light eyes
<AiMascot status="thinking" size={96} color="#7747ff" eyeColor="white" />
```

## API reference

### AiMascot

A small assistant character drawn in SVG: a soft pebble with pill eyes, a quiet form shade and a companion dot. Six states, each a continuous motion with no loop seam. Idle breathes, floats, blinks and glances around. Listening leans in with wider eyes while the dot pulses like a voice level. Thinking tilts the head and looks up as the dot orbits it, passing behind and in front. Writing looks down and reads along a line the dot writes, then the pen lifts and returns. Done squints happily as the dot turns into a sparkle. Error shakes once and shows worried brows. Status changes blend the two poses over 420ms, never a hard cut, and the eyes follow the pointer on hover.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"idle" \| "listening" \| "thinking" \| "writing" \| "done" \| "error"` | – | What the assistant is doing. Leave unset to play through every state on a loop (the docs demo). |
| `size` | `number` | `96` | Width and height in px, from 24 (inline next to a message) to 160 (empty state). Below 56 a compact drawing takes over: tighter framing, bolder eyes and dot, no ground line. |
| `tone` | `"accent" \| "ink" \| "soft"` | `"accent"` | Body color from the theme: the accent with accent-foreground eyes, the foreground ink with background eyes, or a muted surface with a 1px border and foreground eyes. |
| `color` | `string` | – | Any CSS color for the body. Overrides tone; the eyes become a dark mix of it unless eyeColor is set. |
| `eyeColor` | `string` | – | Any CSS color for the eyes and brows. |
| `followPointer` | `boolean \| "page"` | `true` | Eyes follow the pointer while it is over the mascot (true), anywhere on the page ("page", good for empty states) or never. Touch is ignored. Thinking and writing keep their own gaze. |
| `companion` | `boolean` | `true` | Show the companion dot that floats, pulses, orbits, writes and becomes the done sparkle. |
| `ground` | `boolean` | `true` | The soft contact shadow and the writing line under the mascot. Drawn only at 56px and up. |
| `paused` | `boolean` | `false` | Freeze on the current frame. The mascot also pauses by itself off screen and in background tabs, and resumes without a jump. |
| `name` | `string` | `"Assistant"` | Used in the accessible label, for example "Atlas, thinking". |
| `label` | `string` | – | Overrides the whole accessible label. |
| `announce` | `boolean` | `false` | Announce status changes in a polite live region. Turn it on for the one mascot that carries status, not for decorative copies. |
| `onStatusChange` | `(status: MascotStatus) => void` | – | Called when the self-playing loop (status unset) moves to the next state. Use it to sync a caption or a control. |
| `className` | `string` | – | Class on the root span. Set --mascot-body, --mascot-eye, --mascot-dot, --mascot-shade or --mascot-ground here to restyle. |
| `style` | `CSSProperties` | – | Inline style on the root span. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| None | The mascot is a status image and takes no focus. Pair it with a real control when people act on what it shows. |

## Accessibility

- The SVG has role img and a label built from name and status, for example "Atlas, thinking", which updates with every state.
- With announce, status changes are read in a polite live region outside the image. Use it on one mascot per view so screen readers do not hear duplicates.
- Status is never carried by motion alone: each state changes the face (wide eyes, eyes up, eyes down, happy squint, worried brows) and the label. Show a text status next to it where the state matters.
- Pointer following ignores touch and is off under reduced motion.

## Motion

- Every state is a continuous function of time (sums of slow sines, an orbit angle, a writing cycle whose start and end meet at zero length), so loops never restart and have no seam.
- A status change blends the old pose into the new one over 420ms with an ease in and out; a change during a blend starts from the frame on screen. The first paint (and the server render) is the still pose, and the loop eases out of it over the same 420ms, so nothing jumps on mount. Eyes ride a critically damped spring: quick saccades when idle, a soft follow while thinking, tight tracking while writing. Nothing bounces.
- Done passes the eyes through a closed line into the happy squint while the dot shrinks and the sparkle grows in its place. Error shakes once, decaying to rest in about .7s.
- The dot is drawn twice, behind and in front of the body, and switches layers only at the ends of its orbit where it is clear of the body. While it crosses the crown in front it fades into the eye color, so it stays visible on the body.
- Blinks come every 2.4 to 5.2s, sometimes twice, and take 160ms.
- Reduced motion shows a still, representative pose for each state (eyes up with the dot over the head, half a written line, the squint and sparkle, the brows), switches in place and drops every loop, glance, blink and shake.

## Responsive behavior

- A fixed square of size px that never reflows its parent. The drawing scales crisply as vector art at any device pixel ratio.
- Below 56px the compact drawing frames the body tighter and enlarges the eyes, dot and sparkle so they stay legible at 24px.

## Performance

- One requestAnimationFrame loop per mascot writes SVG attributes directly through refs, so React does not re-render per frame; only the self-playing loop sets state, once per state.
- The loop stops off screen (IntersectionObserver) and in hidden tabs, and its clock only runs while visible, so it resumes on the same frame instead of jumping.
- Under reduced motion the loop repaints only when the status changes.
- About fifteen small SVG nodes, with no filters, masks or gradients.

## Notes for AI

- Map your assistant's real phases to status: microphone open is listening, waiting for the first token is thinking, streaming is writing, finished is done, failed is error, otherwise idle.
- Keep thinking short in real use; switch to writing on the first token so the mascot reads what it writes.
- Use size 24 to 32 inline in a message header or composer, 40 to 64 in a side panel header, 96 to 160 in an empty state. Below 56 the drawing simplifies on its own.
- Set name to the assistant's name so the label reads well. Turn announce on for one mascot only.
- Leave status unset only for showcases; in a product always pass it.

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [AI spark](https://uiarc.dev/components/ai-spark/markdown): A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.
- [Image reveal](https://uiarc.dev/components/image-reveal/markdown): An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.
- [Starter prompts](https://uiarc.dev/components/starter-prompts/markdown): A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).
- [Dictation button](https://uiarc.dev/components/dictation-button/markdown): A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.

## Also in ai

- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [Image generation](https://uiarc.dev/components/image-generation/markdown): An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.
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

AI mascot: A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
