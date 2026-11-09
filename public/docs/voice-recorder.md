# Voice recorder

> Record with a live waveform, review and scrub, then send the take into the thread.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/voice-recorder
- Markdown: https://uiarc.dev/components/voice-recorder/markdown
- Source file: `registry/components/voice-recorder/voice-recorder.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, react voice recorder, voice message, audio recorder ui, whatsapp voice note, record audio button, voice memo

## When to use

- Voice notes in chats, comments, or field notes where speaking beats typing.
- A thread of voice bubbles with playback and scrubbing.

## When not to use

- Use now-playing for music or long-form audio.
- Use hold-to-confirm for press-and-hold actions that do not record.
- Use stopwatch to time something without audio.

## Installation

Voice recorder is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/voice-recorder
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { VoiceRecorder, voicePeaks } from "@/components/arc/voice-recorder/voice-recorder";

const history = [
  { id: "m1", duration: 7, peaks: voicePeaks(1, 7), from: "Sam", avatar: "/people/sam.jpg", meta: "9:41 AM" },
];

export function Thread() {
  return <VoiceRecorder defaultMessages={history} maxDuration={30} onSend={message => console.log("sent", message.id)} />;
}
```

## API reference

### VoiceRecorder

A voice note composer and thread. Tap the mic to record into a live bar with a scrolling waveform and timer, stop into a review you can play and scrub, then send the take into the thread as a voice bubble.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultMessages` | `{ id: string; duration: number; peaks: number[]; from?: string; avatar?: string; meta?: string }[]` | `[]` | Messages already in the thread, oldest first. peaks are bar heights from 0 to 1 (the exported voicePeaks makes deterministic data); from and avatar mark incoming messages. |
| `onSend` | `(message: VoiceMessage) => void` | – | Called with each sent take. Recording is simulated, so wire this to real audio capture. |
| `onCancel` | `() => void` | – | Called when a take is discarded with the trash button or Escape. |
| `maxDuration` | `number` | `60` | Seconds before recording stops on its own and moves to review. |
| `sentMeta` | `string` | `"Just now"` | Meta line under messages you send. |
| `label` | `string` | `"Voice messages"` | Accessible name of the whole recorder. |
| `className` | `string` | – | Class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Activate the focused control: record, stop, send, play, or discard. Focus follows from mic to stop to send and back. |
| Escape | Discard the take while recording or reviewing. |

## Accessibility

- The recorder is a labelled section with a labelled message list; every control is a native button with an aria-label, such as "Stop recording at 0:04" or "Play voice message from Sam, 0:07".
- Recording, review, send, and discard are announced in a polite live region that also describes the mic.
- Waveforms, the live canvas, and timers are aria-hidden; the button labels carry the durations.

## Motion

- Mic, recording bar, review, and sent bubble share one layout id, so a take morphs from the mic into the thread on a spring.
- The live waveform scrolls on a canvas and playback fills the bars left to right; side buttons pop in and content crossfades with a slight blur.
- Motion follows the user's reduced motion setting: layout morphs are skipped, the waveform steps instead of growing, and the thread scrolls without smoothing.

## Responsive behavior

- The recorder fills its container width, and the review waveform flexes its bars between 1.5px and 3px to fit.
- Waveforms keep touch-action pan-y, so scrubbing by tap works without blocking scroll.

## Performance

- Recording is simulated; the live waveform is painted to a canvas each frame only while recording.
- Each message runs its own frame callback that returns early unless playing; long threads are not virtualized.

## Notes for AI

- Use for voice notes in chats, comments, or field notes where speaking beats typing. Audio is simulated; add MediaRecorder capture and upload in onSend before shipping.
- Seed history with voicePeaks for deterministic bars. Messages live in internal state, so persist them from onSend and pass them back as defaultMessages.

## Related

- [Now playing](https://uiarc.dev/components/now-playing/markdown): Grow a mini player into the full player in one continuous morph.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.

## Also in audio and video

- [Voice orb](https://uiarc.dev/components/voice-orb/markdown): A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls.

## Guidance for AI tools

Voice recorder: Record with a live waveform, review and scrub, then send the take into the thread. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
