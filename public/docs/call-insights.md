# Call insights

> A sales call insights card where talk time, flagged pricing, competitor and objection moments, an AI summary and owned next steps sit in one view. Selecting a moment plays its quote, and checking off next steps lowers the deal risk.

- Type: Block
- Page: https://uiarc.dev/components/blocks/call-insights
- Markdown: https://uiarc.dev/components/blocks/call-insights/markdown

- Access: Arc Pro
- Registry id: `call-insights`
- Source file: `registry/blocks/call-insights/call-insights.tsx`
- Built from: Avatar, Checkbox, CopyButton, TextShimmer
- Keywords: call insights, sales call, conversation intelligence, gong, talk time, talk ratio, call recording, deal risk, next steps, call summary, objection, competitor mention

Pass `call`, `speakers` (with side and talk share), `moments` (type, seconds, speakerId, quote, clip length), `summary` and `nextSteps` (with ownerId and due) from your transcription or conversation intelligence pipeline. Wire `loadClip(moment, signal)` to seek your audio player to `moment.at`; it should resolve when playback can start and abort on the signal. Use `onNextStepChange` to save step state. Leave `risk` unset to tie it to the open next steps, or pass your own score. Set `autoPlay={false}` in a product so the demo tour does not run.

## When to use

- A deal page that shows the latest sales call with talk ratio, flagged moments, summary and next steps.
- A call review queue for sales managers who coach on talk time and objection handling.
- A research or support tool that recaps a recorded customer call with jump-to-quote clips.

## When not to use

- Full transcript reading or editing: use transcript-studio.
- An internal meeting recap without a prospect or deal: use meeting-summary.
- A pipeline overview across many deals: use a table such as crm-contacts.

## Installation

Call insights is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/call-insights
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CallInsights } from "@/components/arc/blocks/call-insights/call-insights";

export function DealCall({ call, transcript }) {
  return (
    <CallInsights
      call={{ title: "Data platform evaluation", company: "Ramp", date: "Oct 22, 2026", duration: 2052 }}
      speakers={transcript.speakers}
      moments={transcript.moments}
      summary={transcript.summary}
      nextSteps={transcript.nextSteps}
      autoPlay={false}
      loadClip={(moment, signal) => audio.load(call.recordingUrl, moment.at, { signal })}
      onNextStepChange={(step, done) => fetch(`/api/steps/${step.id}`, { method: "PATCH", body: JSON.stringify({ done }) })}
    />
  );
}
```

## API reference

### CallInsights

A sales call distilled into one card. The header carries the prospect's logo, the call title, the meeting platform mark, date and length, the attendees and a deal risk chip. Talk time is one bar split by speaker and grouped by side, with a legend in tabular percentages. Key moments sit on a rail for the whole call as 24px markers (pricing, competitor mention, objection, each with its own icon); selecting one fills the rail up to it and crossfades the quote, speaker and timestamp into a well with a play button and a seekable waveform. Below are the AI summary, which streams in once with a copy button, and next steps with owners and due dates. Checking off a step lowers the deal risk when the risk is derived. With no props it renders a 34 minute Ramp evaluation on Zoom that tours its moments until someone interacts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `call` | `CallDetails` | `Ramp evaluation on Zoom` | { title, company, logo?: ReactNode (20px, currentColor), platform?, platformMark?: ReactNode (14px), date, duration (seconds) }. |
| `speakers` | `CallSpeaker[]` | `four sample speakers` | { id, name, title?, avatar?, side: "internal" \| "external", talk }. talk is any scale and is normalised to 100. Talk time groups your team first, then the prospect. |
| `moments` | `CallMoment[]` | `five sample moments` | { id, type: "pricing" \| "competitor" \| "objection", at (seconds), speakerId, quote, clip (seconds) }. Positioned on the rail by at / call.duration. |
| `summary` | `string` | `sample summary` | AI summary. Streams in once when the card first scrolls into view, over a reserved block so the card never grows. An empty string shows the empty state. |
| `summaryModel` | `string` | `"Claude Sonnet 5.5"` | Model credited next to the summary heading. |
| `nextSteps` | `CallNextStep[]` | `three sample steps` | { id, label, ownerId, due, done?, risk? }. ownerId is a speaker id. risk (default true) means the open step keeps the deal at risk. |
| `risk` | `"low" \| "medium" \| "high"` | – | Fixed deal risk. When omitted it follows the open risk steps: all open (two or more) is high, some open is medium, none open is low. |
| `autoPlay` | `boolean` | `true` | Tours the moments and plays each clip while the card is on screen, until the first pointer or key press inside it. Always off with reduced motion. |
| `defaultMomentId` | `string` | – | Moment selected first. Defaults to the first moment. |
| `loadClip` | `(moment: CallMoment, signal: AbortSignal) => Promise<void>` | – | Resolves when the clip is ready to play; the button shows a spinner meanwhile and a rejection shows Clip unavailable with Retry. The signal aborts when another moment is selected or loading is cancelled. Without it, loading is simulated and the status region says no audio plays. |
| `onMomentChange` | `(moment: CallMoment) => void` | – | Called when a moment is selected, by click, keyboard or the tour. |
| `onNextStepChange` | `(step: CallNextStep, done: boolean) => void` | – | Called when a next step is checked or unchecked. Persist it here. |
| `className` | `string` | – | Class on the root section. |

### deriveRisk

The rule the card uses when risk is omitted, exported so a list view can show the same chip.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` (required) | `CallNextStep[]` | – | Next steps. |
| `done` (required) | `Record<string, boolean>` | – | Done state by step id. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the selected moment marker, the play button, the waveform, the copy button and each next step checkbox. |
| Arrow keys, Home, End | On the markers, select the previous, next, first or last moment. On the waveform, seek one second back or forward, or to the start or end. |
| Space / Enter | Play, pause, cancel loading or retry the clip; toggle a next step. |

## Accessibility

- The card is a section named after the company. Markers are a radio group named Key moments; each radio names the type, timestamp and speaker, so type never relies on the icon alone.
- The waveform is a slider with the clip position as value text (0:03 of 0:07).
- Deal risk is an icon plus the words High, Medium or Low risk. Talk time is an image whose name lists every speaker and share.
- Playback, pauses, load failures and next step changes (with any change in risk) are announced in a polite status region, which also says clips are simulated with no audio.
- The summary is aria-busy while it streams and only exposed once complete; the thinking label is hidden from assistive tech.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Selecting a moment fills the rail up to it on one 240ms ease-out transform and crossfades the quote (old out in 100ms, new in over 160ms from 2px). All quotes share one grid cell, so the well never changes height.
- The waveform reshapes per clip with a 240ms height ease, and the played part is clipped in from a CSS variable each frame, so playback never re-renders React per frame.
- The summary waits 0.7s on a calm shimmer, then streams 3 to 8 words every 35ms with each chunk fading in over 140ms. Talk time reveals left to right once. The risk chip crossfades its icon and label inside the width of its longest label.
- The tour pauses while the card is off screen and stops at the first interaction. Nothing bounces.
- Reduced motion skips the tour, streaming and reveals and drops travel; selection, playback and every state and announcement stay.

## Responsive behavior

- Fluid from 360px to 680px. Container queries move the talk legend to two columns and hide the attendee stack below 560px; below 460px sections pad 16px and the company name, platform name, type legend, speaker title and owner names drop, leaving marks and avatars.
- Markers keep a 40px hit area and clamp inside the rail at both ends. Checkboxes keep their 44px target.

## Performance

- Playback writes one CSS variable per frame and re-renders only when the whole second changes. The tour and playback stop off screen through an IntersectionObserver.
- Waveforms are 52 bars per layer, computed once per moment.

## Notes for AI

- Use for a recorded call, demo or interview where the reader needs the gist and the moments that matter: sales call reviews, CRM deal pages, customer research recaps.
- Feed moments from your transcription or conversation intelligence pipeline; keep quotes under about 20 words so the well stays two lines.
- Wire loadClip to seek your audio player to moment.at and resolve when playback can start; abort on the signal.
- Pass risk when your own model scores deals; leave it unset to tie risk to the open next steps.

## Related

- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.
- [Lead scoring](https://uiarc.dev/components/blocks/lead-scoring/markdown): A lead scoring card where inbound B2B leads are ranked by an AI fit score, each with a score ring and a one-line reason. Open a lead to see its signals and score breakdown, then push it to HubSpot or Salesforce.
- [Account health](https://uiarc.dev/components/blocks/account-health/markdown): A customer success card where a health score gauge, a renewal countdown and five sourced signals with sparklines lead into an AI risk summary and one recommended next step, like scheduling a QBR before usage slips further.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
