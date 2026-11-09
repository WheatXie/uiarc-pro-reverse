# AI spark

> A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ai-spark
- Markdown: https://uiarc.dev/components/ai-spark/markdown
- Source file: `registry/components/ai-spark/ai-spark.tsx`
- Dependencies: motion
- Keywords: special, ai, motion, new, ai spark, ai sparkle, asterisk, thinking indicator, generating indicator, ai loader, ai logo animation, working indicator, ai status mark, spinner alternative, ai avatar, sparkle animation

## When to use

- Showing that an assistant is thinking or writing, inline above a streaming reply.
- A send or generate button that turns into a working indicator inside a composer.
- An image or canvas tool that needs a calm, branded working mark over the canvas while a render runs.
- Empty states and onboarding where a 64 to 96px hero mark gives the AI feature an identity.

## When not to use

- Determinate progress with a known percentage; use a progress bar or the generation stats component instead.
- Multi step agent runs where each step needs its own state and detail; use agent-status or agent-run.
- Plain text loading lines with no mark; use text-shimmer.

## Installation

AI spark is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-spark
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiSpark } from "@/components/arc/ai-spark/ai-spark";

export function ReplyStatus({ phase }: { phase: "thinking" | "generating" | "done" }) {
  return <AiSpark variant="pill" status={phase} />;
}
```

## Examples

### Assistant avatar

```tsx
<AiSpark variant="avatar" size={32} status={phase} announce={false} />
```

### Inline in a sentence

```tsx
<p>
  <AiSpark size="1em" tone="inherit" status="generating" announce={false} /> Drafting a reply to Maya Chen
</p>
```

### Custom progress label

```tsx
<AiSpark variant="pill" status="thinking" label="Searching 4 sources" />
```

### Hero mark in an empty state

```tsx
<AiSpark size={96} status="idle" />
```

## API reference

### AiSpark

An animated spark mark that shows an AI at work: four tapered primary rays and four lighter diagonal rays around a soft core. Each status is its own motion, and every change blends from the current pose, so states never hard cut. Use variant="pill" for a status label or variant="avatar" for a round tile.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `"idle" \| "thinking" \| "generating" \| "done" \| "error"` | – | What the AI is doing. Leave it unset and the spark plays through idle, thinking, generating and done on its own. |
| `size` | `number \| string` | `24 (32 for the avatar, 16 in the pill)` | Size in px, or any CSS length such as "1em" to match surrounding text. The mark itself, the avatar tile, or the mark inside the pill. Proportions are hinted optically: small marks get heavier rays and under 18px the diagonals become dots. |
| `tone` | `"accent" \| "foreground" \| "muted" \| "inherit"` | `"accent"` | Semantic color of the mark; the diagonals and core use a lighter tone of the same color. Error always eases to a muted danger tone. |
| `color` | `string` | – | Any CSS color, overriding tone. |
| `variant` | `"mark" \| "pill" \| "avatar"` | `"mark"` | mark renders the spark alone. pill adds a crossfading status label (Ready, Thinking, Writing, Done, Couldn't finish) in a quiet bordered capsule. avatar sets the mark in a round, lightly tinted tile for message avatars and icon buttons. |
| `label` | `string` | – | Pill text, overriding the built-in label for the current status, for example "Reading 12 files". |
| `speed` | `number` | `1` | Multiplies every loop and spin speed. |
| `twinkle` | `boolean` | `true` | A very slow breathing twinkle while idle. Turn it off for a fully still idle mark. |
| `paused` | `boolean` | `false` | Freezes the animation in place; resuming continues from the same phase. |
| `announce` | `boolean` | `true` | Announce status changes through a polite live region. Turn it off for decorative copies so only one spark speaks. |
| `aria-label` | `string` | – | Accessible name. Defaults to a phrase for the status, such as "AI is thinking". |
| `className` | `string` | – | Class on the root span. |
| `style` | `CSSProperties` | – | Inline styles on the root span. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| None | The spark is a status indicator and takes no focus. Put controls such as Stop next to it. |

## Accessibility

- The root is a polite live region (role="status"): a status change is announced once, as "AI is thinking" for the mark or as the label text for the pill.
- aria-busy is set while thinking or generating.
- Status is never color alone: each state has its own shape and motion, error shortens the rays and dims the diagonals, and the pill adds a text label.
- Set announce={false} on decorative copies (lists, size ladders) so screen readers hear one voice. They then render as role="img" with an accessible name.
- The SVG is aria-hidden; the name comes from the label or a visually hidden phrase.

## Motion

- One requestAnimationFrame loop per spark writes eight small ray paths, a core radius and two group transforms. React never re-renders per frame and nothing triggers layout.
- Every status is a periodic function of time and of position around the ring, so idle, thinking and generating loop with no seam.
- Idle: a 6.4s breath of the whole mark while one diagonal at a time softly reaches out. Thinking: one crest ripples around the ring every 1.9s, with small per-ray phase offsets, while the mark turns at 26 degrees per second. Generating: a lub dub heartbeat every 1.04s, axes firing in sequence and diagonals answering, 46 degrees per second, with two particles orbiting just outside the rays (40px and up).
- Done: the rays gather toward the center in 170ms and ease back to rest over 510ms with no overshoot, while the spin glides into the home angle on an ease-out whose speed only falls.
- Error: one small decaying shake over 460ms, shorter rays, dimmer diagonals and a muted danger tone over 320ms.
- Status changes blend over 420 to 560ms from wherever the mark is; an interrupted blend becomes the new starting point, and the gather and shake gestures always finish smoothly even if the status changes again. Pill labels crossfade (100ms out, 160ms in, 2px rise) while the pill eases to its new width.
- Reduced motion: no spin, loops, gather, shake or particles. Each status shows a still pose with a 200ms blend between poses and the color change.
- The loop pauses when the spark is off screen or the tab is hidden, and stops entirely once a resting state has settled.

## Responsive behavior

- The mark has a fixed footprint at any status, so it never shifts surrounding layout.
- Crisp from 12px to 120px and beyond: geometry lives in a 100 unit viewBox, ray weight is hinted on a log scale by rendered size, and CSS lengths are measured so hinting still applies.
- The pill keeps a 28px height and only animates its label width.

## Performance

- Eight SVG paths, three circles and one rAF loop per spark; resting states stop the loop entirely, and off screen sparks do not tick.
- No canvas, no filters, no blur, no gradients; depth comes from two tones of one color.
- The pill label shimmer runs only while thinking or generating.

## Notes for AI

- Map your stream lifecycle to status: request sent or tool running -> thinking, first token until the last -> generating, finished -> done, failed or aborted -> error. Return to idle when the composer is ready again.
- Use variant="pill" with label for specific progress ("Searching 4 sources", "Drawing"); keep labels to one or two words.
- Use size="1em" and tone="inherit" to drop the mark inline into a sentence or a button so it matches the text.
- Use one spark per active generation. For many rows, render a static mark (status="idle", twinkle={false}) and animate only the active row.
- Use variant="avatar" next to assistant messages or inside an icon button; size sets the tile and the mark is 56% of it.
- Leaving status unset makes it self-play, which is only meant for demos and marketing pages.

## Related

- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [AI mascot](https://uiarc.dev/components/ai-mascot/markdown): A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.

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
- [Image reveal](https://uiarc.dev/components/image-reveal/markdown): An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.
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

AI spark: A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
