# Image reveal

> An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/image-reveal
- Markdown: https://uiarc.dev/components/image-reveal/markdown
- Source file: `registry/components/image-reveal/image-reveal.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, motion, new, image generation, ai image, generating, progressive reveal, diffusion, denoising, latent noise, sampler steps, vae decode, progress, canvas, image placeholder, midjourney style, chatgpt image

## When to use

- Showing an image model's progress on a canvas or in a chat reply.
- A batch of image variations sampling side by side.
- A queued image job that should feel alive before it starts.

## When not to use

- Plain image loading from a CDN; use a blur-up placeholder or a skeleton.
- Text generation or tool calls; use text-shimmer or tool-call.
- Determinate file uploads; use progress.

## Installation

Image reveal is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/image-reveal
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ImageReveal } from "@/components/arc/image-reveal/image-reveal";

export function GeneratedImage({ job }: { job: { status: "queued" | "generating" | "done" | "error"; step: number; url?: string } }) {
  return (
    <ImageReveal
      src={job.url}
      alt="A calm alpine lake at golden hour"
      status={job.status}
      progress={job.step / 30}
      steps={30}
      aspectRatio="4 / 5"
      onRetry={() => retry(job)}
    />
  );
}
```

## Examples

### Estimated duration, no progress events

```tsx
<ImageReveal src={url} status={url ? "done" : "generating"} duration={8000} />
```

### Batch of four with a Generate again button

```tsx
const [run, setRun] = useState(0);

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
  {urls.map((url, index) => (
    <ImageReveal key={index} src={url} size="sm" seed={index + 1}
      runKey={run} loop={false} duration={4200} style={{ maxInlineSize: "none" }} />
  ))}
</div>
<Button onClick={() => setRun(run + 1)}>Generate again</Button>
```

## API reference

### ImageReveal

Image generation the way a diffusion model samples: pure latent noise, then one denoising step at a time the prediction resolves from color blobs to composition to shapes while the noise falls away, then a tiled decode lands the sharp image and the pill shows how long it took. With no props it plays a looping, simulated generation over sample photos.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | – | Final image URL. Cross-origin images work (pixels are never read back). Omit to cycle through sample photos. |
| `alt` | `string` | `"Generated image"` | Alt text for the final image, used as the canvas label once done. |
| `status` | `"queued" \| "generating" \| "decoding" \| "done" \| "error"` | – | Controlled state. Omit for auto mode, which runs queued, sampling over `duration`, decoding over `decodeDuration`, then done. Going straight from generating to done still plays the decode. Every change transitions smoothly. |
| `progress` | `number` | – | Controlled progress from 0 to 1 while generating, usually step / total. The canvas moves one denoising step at a time, like the real sampler. Omit to step at a constant rate over `duration`. |
| `duration` | `number` | `4600` | Milliseconds the sampling steps take when `progress` is not controlled. |
| `decodeDuration` | `number` | `560` | Milliseconds the tiled decode takes after the last step. |
| `steps` | `number` | `30` | Sampling steps. Each is one visible denoising step, and the pill shows it as 18 / 30 (tabular numerals, reserved width). |
| `aspectRatio` | `number \| string` | `1` | Width over height, as a number (1.5) or a CSS ratio ("4 / 5"). The image is cover-cropped to it. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Overlay scale and corner radius. "sm" (grids, thumbnails) shows only the ring and 18 / 30; "md" and "lg" add the Denoising label. The canvas always renders at device pixel ratio. |
| `color` | `string` | – | Any CSS color for the progress ring. Defaults to the accent. |
| `showProgress` | `boolean` | `true` | Shows the translucent progress pill. It fades out shortly after the image resolves. |
| `sheen` | `boolean` | `true` | Plays one soft light sheen across the image when it resolves. Skipped with reduced motion. |
| `queueLabel` | `string` | `"Queued"` | Chip label while queued, such as "Queued, 2 ahead". |
| `errorMessage` | `string` | `"Generation failed"` | Message in the error state. |
| `onRetry` | `() => void` | – | Shows a Retry button in the error state. |
| `onStatusChange` | `(status: ImageRevealStatus) => void` | – | Called when the displayed status changes, including auto mode transitions. |
| `onComplete` | `() => void` | – | Called once per run when the final image is fully resolved and crisp. |
| `autoPlay` | `boolean` | `true` | Auto mode only: starts generating on mount. |
| `loop` | `boolean` | `true` | Auto mode only: after `holdDuration` the image blurs back out and generates again. |
| `startDelay` | `number` | `0` | Auto mode only: extra queue time in milliseconds before a run, for staggered grids. |
| `queueDuration` | `number` | `900` | Auto mode only: milliseconds in the queue before each run. |
| `holdDuration` | `number` | `2600` | Auto mode only: milliseconds the finished image holds before a loop restarts. |
| `runKey` | `string \| number` | – | Auto mode only: change it to blur back out and run again (a Generate again button). |
| `seed` | `number` | `1` | Seeds the latent noise, so tiles in a batch differ and a replay of the same seed shows the same noise. Pass the model's real seed. |
| `className` | `string` | – | Class on the root. The root is 100% wide with a 560px max width; override max-inline-size in grids. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves to the Retry button in the error state. The canvas itself is not focusable. |
| Enter / Space | Activates Retry. |

## Accessibility

- The canvas has role img; its label names the state while generating and becomes the alt text once done.
- A polite live region announces Queued, Generating image, Image ready and the error message, not every step. Auto mode appends simulated.
- While generating, the pill is a progressbar with aria-valuenow and an aria-valuetext of Step n of total.
- Status is never color alone: the pill pairs a ring or check with a short label, and the error state pairs an alert icon with its message.

## Motion

- Queued is the calm surface tone with one broad, soft shimmer that starts and ends fully off canvas, so its 2.6s loop has no seam.
- Generating starts from pure latent noise: per-cell gaussian color at about 1/8 of the output resolution, drawn as crisp blocks, with a new seeded frame every step crossfaded in 35ms.
- Under the noise is the model's current prediction, built from the image itself (6 to 96 px wide copies, smoothly upscaled). It moves along that chain per step, so color blobs come first, then composition, then shapes.
- Noise strength follows a schedule that drops fast early, so the composition reads by about a third of the steps and the last steps only refine. Steps run at a constant rate, like a real sampler.
- After the last step a tiled decode lands the sharp image tile by tile in raster order, each tile crossfading in, and the pill switches to Decoding.
- One soft-light sheen sweeps across once at completion (1.1s), the pill shows the elapsed time, then fades out.
- Starting over or swapping the photo fades the decoded image straight back to the surface before anything resets underneath, and a photo swap crossfades from a snapshot, so there is never a hard cut.
- Pill labels crossfade (100ms out, 160ms in after a 60ms gap) and the pill width springs with no bounce.
- Reduced motion keeps one static noise frame, decodes as a single crossfade and drops the shimmer travel, spinner and sheen.
- The frame loop stops off screen (IntersectionObserver) and in background tabs, and draws nothing once the image is resolved.

## Responsive behavior

- Fills its container width (up to 560px by default) and keeps the given aspect ratio.
- The canvas renders at device pixel ratio (capped at 2), so it stays crisp from a 120px thumbnail to a large canvas.
- Latent noise is sized in CSS pixels (about 6 px cells), so it reads as the same latent grid at every size.

## Performance

- Canvas 2D only, no WebGL and no per-pixel work per frame: a few drawImage calls. Noise is generated once per step at latent resolution (a few thousand cells).
- The prediction chain is built once per image and size; decode tiles are direct copies from the sharp image.
- Frames stop drawing when the image is resolved and nothing changes, and the loop stops entirely off screen.
- Images are decoded off the main thread before use.

## Notes for AI

- Use for image generation surfaces: an image canvas, an inline image in a chat reply, a variations grid, or an empty state while a first image renders.
- Wire a real job by passing status and progress (step / total), plus the job's seed. Pass decoding while the VAE decodes if the backend reports it. With no progress events, pass status only and an estimated duration.
- Use size="sm" in grids. A batch samples in lockstep, so give every tile the same duration and its own seed, and override max-inline-size through className or style.
- The preview is sampled from the final image, so pass src as soon as a preview or final URL exists; until it loads the tile stays in the calm queued look.
- For text or agent work in progress, pick a text shimmer or an agent status component instead.

## Related

- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Progress](https://uiarc.dev/components/progress/markdown): Show how much of a known task is complete.

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
- [Provider status](https://uiarc.dev/components/provider-status/markdown): A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.
- [Training run](https://uiarc.dev/components/training-run/markdown): A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.
- [AI command](https://uiarc.dev/components/ai-command/markdown): A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.
- [Starter prompts](https://uiarc.dev/components/starter-prompts/markdown): A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).
- [AI mascot](https://uiarc.dev/components/ai-mascot/markdown): A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.
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

Image reveal: An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
