# Speech player

> A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/speech-player
- Markdown: https://uiarc.dev/components/speech-player/markdown
- Source file: `registry/components/speech-player/speech-player.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-popover, @radix-ui/react-tooltip
- Keywords: special, ai, new, text to speech, tts, read aloud, speech player, karaoke, word highlight, audio player, voice picker, playback speed, ai reply, accessibility, elevenlabs, openai tts, claude, message actions

## When to use

- A chat or answer surface where people want a reply read out, with the spoken word followed in the text.
- Accessibility and hands free reading for long AI answers, summaries or briefings.
- Previewing TTS voices and speeds against real product copy.

## When not to use

- Use dictation-button to turn speech into text in a composer.
- Use a plain audio player for podcasts or long recordings without a transcript to highlight.

## Installation

Speech player is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/speech-player
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SpeechPlayer } from "@/components/arc/speech-player/speech-player";

export function AssistantMessage({ message }) {
  return (
    <SpeechPlayer
      variant="plain"
      text={message.text}
      author={{ name: "Claude Sonnet 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> }}
      voices={[
        { id: "ava", name: "Ava", description: "Warm and conversational" },
        { id: "leo", name: "Leo", description: "Calm, lower register" },
      ]}
      synthesize={async ({ text, voice, signal }) => {
        const res = await fetch("/api/tts", { method: "POST", body: JSON.stringify({ text, voice: voice.id }), signal });
        if (!res.ok) throw new Error("The voice service is busy. Try again in a moment.");
        const { audioUrl, words } = await res.json(); // words: [{ start, end }] in ms
        return { src: audioUrl, timings: words };
      }}
      onPlay={e => track("tts_play", { voice: e.voice.id, speed: e.speed })}
      actions={<><CopyButton value={message.text} iconOnly variant="plain" /><RegenerateButton /></>}
    />
  );
}

// With no props it reads the sample reply, simulated, with no audio.
<SpeechPlayer />
```

## API reference

### SpeechPlayer

Read aloud for an AI reply. The reply sits above an action row with Read aloud, Copy, Good response and Bad response. Read aloud crossfades the row into a compact player of the same height: a play and pause button, the elapsed time, a thin scrubbable progress bar, the total time, a speed button (1×, 1.5×, 2×), a voice picker and Stop reading. As it plays, the spoken word is highlighted in the paragraph by one rounded rect that glides from word to word along a line and cuts cleanly to the next line, while words still to come stay dimmed. Clicking a word jumps there. It covers idle, preparing (a shimmering "Preparing Ava's voice"), playing, paused, switching voice mid-sentence (it resumes from the same word), finished (Play again) and failed (Retry). With no props it reads a sample travel reply from Claude Sonnet 5.5 once in view and loops through two voices until someone interacts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | – | The reply to read. Blank lines start new paragraphs; each whitespace separated word is one highlight step. Leave it out for the self playing sample. |
| `synthesize` | `(request: { text: string; voice: SpeechVoice; signal: AbortSignal }) => Promise<SpeechAudio>` | – | Fetches speech from your TTS provider. Resolve with { src, timings?, duration? }: src is an audio URL or object URL, and timings are word start and end times in milliseconds from the provider's alignment data. Without timings, they are estimated from the text and scaled to the audio length. Abort the request when the signal fires (a new voice or Stop reading). Leave synthesize out for simulated timing with no audio. |
| `voices` | `SpeechVoice[]` | `Ava, Leo, Maya, Noah` | Voices in the picker: { id, name, description? }. The description is one short line, such as "Warm and conversational". |
| `voice` | `string` | – | Selected voice id (controlled). Pair with onVoiceChange. |
| `defaultVoice` | `string` | `first voice` | Initial voice id when uncontrolled. |
| `onVoiceChange` | `(voice: SpeechVoice) => void` | – | Called when a voice is picked. While reading, the player fetches the new voice and resumes from the word being spoken. |
| `speed` | `1 \| 1.5 \| 2` | – | Playback speed (controlled). Pair with onSpeedChange. |
| `defaultSpeed` | `1 \| 1.5 \| 2` | `1` | Initial speed when uncontrolled. The speed button cycles 1×, 1.5×, 2×. |
| `onSpeedChange` | `(speed: SpeechSpeed) => void` | – | Called when the speed button is pressed. |
| `onPlay` | `(event: SpeechPlaybackEvent) => void` | – | Playback started or resumed. The event carries time and duration in milliseconds on the 1× timeline, wordIndex, voice and speed. |
| `onPause` | `(event: SpeechPlaybackEvent) => void` | – | Playback paused. |
| `onEnd` | `(event: SpeechPlaybackEvent) => void` | – | The last word finished. |
| `onSeek` | `(event: SpeechPlaybackEvent) => void` | – | A scrub, an arrow key or a click on a word moved playback. Fires once when a drag ends, not on every move. |
| `onWordChange` | `(event: SpeechWordEvent) => void` | – | The spoken word changed. Adds word to the playback event; use it to sync a caption or analytics. |
| `onClose` | `() => void` | – | Stop reading was pressed and the action row returned. Fetched audio is kept, so Read aloud starts again instantly. |
| `author` | `{ name: string; mark?: ReactNode } \| null` | – | Who wrote the reply, shown above it with a 16px mark. Defaults to Claude Sonnet 5.5 for the sample and to nothing when text is passed. |
| `actions` | `ReactNode` | – | Buttons after Read aloud in the action row. Defaults to Copy, Good response and Bad response (feedback is local and announced as simulated); null shows Read aloud alone. |
| `autoPlay` | `boolean` | `true for the sample` | Starts reading once the player is in view. Browsers may block audio autoplay; the player then waits paused at 0:00. |
| `simulated` | `boolean` | `true without synthesize` | Notes in the voice menu and in announcements that no audio plays. |
| `variant` | `"card" \| "plain"` | `"card"` | card draws a bordered surface; plain drops border and padding to sit inside a chat column. |
| `className` | `string` | – | Class on the root element. |

### simulateSpeech

The stand in TTS request behind the preview: waits like a network round trip, then resolves with estimated word timings and no audio. Nothing is sent. Pass { fail: true } as the second argument to see the error state, or { delay } to tune the wait. estimateSpeechTimings(text, pace) and fitTimings(timings, durationMs) are exported too.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `request` | `{ text: string; voice: SpeechVoice; signal: AbortSignal }` | – | The same request synthesize receives. |
| `options` | `{ delay?: number; fail?: boolean }` | `{ delay: 640 }` | Milliseconds before it resolves, and whether it rejects instead. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Read aloud and the actions, or, while reading, through play, the progress bar, speed, voice and Stop reading. |
| Enter, Space | On Read aloud, opens the player and starts reading with focus on the play button. On play, plays or pauses; on Stop reading, closes the player and returns focus to Read aloud. |
| Arrow Left, Arrow Right | On the progress bar, moves 2 seconds back or forward. Page Up and Page Down move 10 seconds; Home and End jump to the start or end. |
| Space, K | On the progress bar, plays or pauses. |
| Arrow Up, Arrow Down | In the voice menu, moves between voices; Enter picks one and Escape closes the menu. |

## Accessibility

- The player is a labelled group. The play button's name follows its state: Play, Pause, Play again, Retry, or Preparing audio (aria-disabled while a request is in flight).
- The progress bar is a slider with a value text such as "0:04 of 0:22", updated once a second rather than every frame.
- A polite status region announces what changed: reading with Ava at 1× (simulated, no audio plays), paused at 0:12, switching to Leo, finished, the failure message, speed changes and feedback.
- Status never relies on color: the error pairs an alert icon with "Couldn't generate audio" and the reason; dimmed upcoming words keep body contrast and are only a progress cue.
- Read aloud is described by the reply text. The voice menu uses menuitemradio items with aria-checked and opens with focus on the selected voice.
- The hidden layer of the dock is inert, so Tab never lands on a control that is not visible. Pointer focus draws no ring; keyboard focus uses Arc's shared focus ring.

## Motion

- Read aloud and Stop reading crossfade the action row and the player in the same 32px slot (out in 100ms, in 160ms with a 2px rise), so the card never changes size.
- The word highlight is one rect that glides between words on a line in 150ms at 1× (about 100ms at 1.5× and 75ms at 2×, so it always lands before the next word) and cuts to the next line instead of sweeping across it. Spoken words fade from dimmed to full color.
- The progress bar fill and thumb are written straight to transforms on each animation frame; the track thickens and the thumb scales in on hover, focus and drag.
- Play, pause, replay, retry and the spinner swap in place with a bounce free scale and fade. Speed and voice labels crossfade over hidden copies of every option, so their buttons never resize.
- The preparing label carries a calm shimmer. Reduced motion keeps every state and announcement, drops the glide, the shimmer and the sample loop, and moves the highlight instantly.

## Responsive behavior

- The card fills its container up to 640px; the reply wraps and the highlight re-measures on resize without animating.
- Below 440px of width the total time steps aside so the progress bar keeps room; elapsed time, speed, voice and Stop reading stay.
- On touch screens the row grows to 36px so every control meets the touch target size.

## Performance

- One requestAnimationFrame loop runs only while playing. It writes the bar to the DOM and commits React state only when the spoken word or the whole second changes.
- Highlight positions come from offsetLeft and offsetTop of the current word, read once per word, never per frame.
- Fetched audio is kept per voice, so replaying after Stop reading starts instantly; switching voices aborts the previous request.

## Notes for AI

- Pass synthesize for real audio. Most TTS providers can return word or character alignment; convert it to one { start, end } per whitespace separated word of text, in milliseconds. If yours cannot, return src alone and the timings are estimated and fitted to the audio length.
- Keep text exactly what was spoken: the word count of text must match timings. Strip markdown before passing it.
- Throw an Error with a short, human message from synthesize to show it next to "Couldn't generate audio"; the play button becomes Retry.
- Use variant="plain" inside a chat transcript and pass your own actions so the row matches the rest of the message actions.
- Without synthesize the player is a timed simulation that plays no sound; keep the simulated note so nobody thinks audio is broken.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Dictation button](https://uiarc.dev/components/dictation-button/markdown): A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.

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
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [Image generation](https://uiarc.dev/components/image-generation/markdown): An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.
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

Speech player: A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
