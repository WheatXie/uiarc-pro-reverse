# Voice orb

> A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/voice-orb
- Markdown: https://uiarc.dev/components/voice-orb/markdown
- Source file: `registry/components/voice-orb/voice-orb.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, new, react voice orb, voice assistant ui, ai voice mode, audio visualizer orb, microphone level, speaking animation, voice chat controls, live transcript

## When to use

- A voice mode for an assistant where the user needs to see whether it is listening, thinking, or speaking.
- Hands-free or call-like flows that need start, mute, a running clock, and end in one compact control.
- Live captions under a speaking agent, via VoiceTranscript.

## When not to use

- Use voice-recorder when the user records a clip to send or save.
- Use chat-thread with text-stream for typed chat where no audio is involved.
- Use progress or skeleton for a generic loading state; the orb implies a voice session.

## Installation

Voice orb is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/voice-orb
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useEffect, useState } from "react";
import { VoiceControls, VoiceOrb, VoiceTranscript, useMicLevel } from "@/components/arc/voice-orb/voice-orb";
import type { VoiceOrbState } from "@/components/arc/voice-orb/voice-orb";

export function VoiceMode() {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<VoiceOrbState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const mic = useMicLevel(active && !muted);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 24 }}>
      <VoiceOrb state={state} inputLevel={mic.level} muted={muted} />
      <VoiceTranscript text="How can I help?" turn={1} complete />
      <VoiceControls
        active={active}
        muted={muted}
        elapsed={elapsed}
        onStart={() => { setActive(true); setState("listening"); }}
        onMuteChange={setMuted}
        onEnd={() => { setActive(false); setState("idle"); setElapsed(0); }}
      />
    </div>
  );
}
```

## API reference

### VoiceOrb

A luminous fluid sphere in the accent colour, drawn with WebGL, that morphs between idle, listening, thinking, and speaking and reacts to live audio levels. Idle breathes, listening ripples outward with the microphone, thinking orbits a band of light around its rim, and speaking brightens with the voice. Pauses offscreen, falls back to a canvas gradient without WebGL, and draws still frames under reduced motion.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `state` (required) | `"idle" \| "listening" \| "thinking" \| "speaking"` | – | Current voice state. Every shape parameter springs toward the new state, so changes blend mid-motion. |
| `inputLevel` | `MotionValue<number>` | – | Microphone level from 0 to 1, read every frame while listening, such as useMicLevel().level. Simulated when omitted. |
| `outputLevel` | `MotionValue<number>` | – | Voice level from 0 to 1 while speaking. A deterministic speech envelope is used when omitted. |
| `muted` | `boolean` | `false` | Calms and desaturates the orb while listening and ignores the input level. |
| `size` | `number` | `208` | Rendered width and height in px. The sphere fills about 60% of it; the rest holds its light and ripples. Colours follow --accent, or --voice-orb-tint and --voice-orb-tint-2 on any ancestor. |
| `label` | `string` | – | Accessible description. Defaults to a sentence about the state, or "Muted" while listening muted. |
| `className` | `string` | – | Extra class on the canvas. |

### useMicLevel

Hook that reads the microphone level as a motion value while enabled. Returns { level, source }. Falls back to a simulated voice when the microphone is denied or missing. Nothing is recorded.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` (required) | `boolean` | – | Asks for the microphone when it turns true and stops every track when it turns false. |

### VoiceTranscript

One line of live transcript. Words settle in from a soft blur, two lines are kept, and a new turn crossfades in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` (required) | `string` | – | Transcript text so far. Words are split on whitespace. |
| `turn` | `string \| number` | `0` | Change it when a new turn begins so the old line crossfades out. |
| `speaker` | `"user" \| "assistant" \| "system"` | `"assistant"` | Assistant reads in the foreground color, the person in secondary, system smaller and muted. |
| `complete` | `boolean` | `false` | Set when the turn is finished to announce it to screen readers. |
| `className` | `string` | – | Extra class on the wrapper. |

### VoiceControls

Call controls in one pill: a start button at rest, and mute, a running clock, and end once the session is live.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `active` (required) | `boolean` | – | Whether a session is live. |
| `muted` | `boolean` | `false` | Pressed state of the mute button. |
| `elapsed` | `number` | `0` | Seconds since the session began, shown as m:ss with tabular numerals. |
| `onStart` | `() => void` | – | Called by the start button. |
| `onMuteChange` | `(muted: boolean) => void` | – | Called with the next muted value. |
| `onEnd` | `() => void` | – | Called by the end button. |
| `startLabel` | `ReactNode` | `"Start voice chat"` | Content of the start button. |
| `className` | `string` | – | Extra class on the pill. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Starts the session, toggles mute, or ends the call from the focused control. |

## Accessibility

- The orb is a canvas with role="img" and an aria-label that follows the state (Listening, Thinking, Speaking, Muted).
- VoiceTranscript hides the animated words and announces only the completed turn through a polite live region.
- The mute button uses aria-pressed and switches its label between Mute and Unmute microphone; the clock is role="timer" with a spoken minutes and seconds label.
- Focus moves to mute when a session starts and back to start when it ends, so keyboard users never lose their place.

## Motion

- Nine shape parameters (breath, wobble, swirl, tint, ring, and more) follow the state on a hand-rolled spring each frame, so state changes interrupt cleanly.
- Listening swells with the input level and draws two ripple rings; speaking pulses with the output level; thinking contracts into a slow swirl.
- The controls pill springs its width to fit while the start button and live controls crossfade with a small scale and blur.
- Reduced motion stops the rAF loop and draws one still frame per state; transcript and controls fall back to short opacity fades.

## Responsive behavior

- The orb has a fixed pixel size from the size prop; pick a smaller value such as 144 on narrow screens.
- The transcript caps at 30rem wide and two lines tall, with a top fade mask so older lines lift away.
- Hover styles on the controls apply only on hover-capable fine pointers; buttons are 40px round for touch.

## Performance

- One requestAnimationFrame loop per orb draws a 96-point blob and gradients on a canvas capped at 2x device pixel ratio.
- An IntersectionObserver and visibilitychange stop the loop while offscreen or in a background tab; a MutationObserver rereads theme colors.
- useMicLevel runs its own rAF loop over a 1024-sample AnalyserNode and closes the AudioContext when disabled.

## Notes for AI

- Use for a voice assistant surface. Feed useMicLevel().level to inputLevel while listening and your TTS analyser level to outputLevel while speaking.
- The orb only visualises; map your session events to the four states yourself (idle, listening, thinking, speaking).
- The body uses --foreground; the inner light uses the brand gradient (--arc-gradient-from and --arc-gradient-to, falling back to --accent). Set --voice-orb-tint and optionally --voice-orb-tint-2 on a parent to recolor it; with only --voice-orb-tint set, both lights use it.
- For recording and saving audio clips use voice-recorder instead; this component never records.

## Related

- [Voice recorder](https://uiarc.dev/components/voice-recorder/markdown): Record with a live waveform, review and scrub, then send the take into the thread.
- [Chat thread](https://uiarc.dev/components/chat-thread/markdown): A chat thread with grouped messages, reactions, read receipts, typing, and a composer with attachments.

## Also in audio and video

- [Now playing](https://uiarc.dev/components/now-playing/markdown): Grow a mini player into the full player in one continuous morph.

## Guidance for AI tools

Voice orb: A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
