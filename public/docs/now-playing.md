# Now playing

> Grow a mini player into the full player in one continuous morph.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/now-playing
- Markdown: https://uiarc.dev/components/now-playing/markdown
- Source file: `registry/components/now-playing/now-playing.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, media, music, react music player, now playing bar, mini player, audio player component, spotify style player, waveform scrubber

## When to use

- Media that keeps playing while people browse, such as music, podcasts, or audio lessons.
- A mini player bar that expands into a full player with artwork and a scrubber.

## When not to use

- Use bottom-sheet or dialog for a one-off overlay that is not a player.
- Use voice-recorder for recording and playing back short voice notes.
- Use slider for a plain seek bar without the player chrome.

## Installation

Now playing is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/now-playing
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useRef, useState } from "react";
import { NowPlaying } from "@/components/arc/now-playing/now-playing";

const tracks = [
  { id: "1", title: "Night Drive", artist: "Arc Ensemble", duration: 212, artwork: "/covers/night-drive.jpg", src: "/audio/night-drive.mp3" },
  { id: "2", title: "Low Tide", artist: "Harbor", duration: 185, artwork: "/covers/low-tide.jpg", src: "/audio/low-tide.mp3" },
];

export function Player() {
  const audio = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  return (
    <>
      <audio ref={audio} src={tracks[index].src} autoPlay={playing} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} />
      <NowPlaying
        tracks={tracks}
        index={index}
        onIndexChange={setIndex}
        playing={playing}
        onPlayingChange={next => { setPlaying(next); if (next) audio.current?.play(); else audio.current?.pause(); }}
        currentTime={time}
        onSeek={seconds => { if (audio.current) audio.current.currentTime = seconds; }}
      />
    </>
  );
}
```

## API reference

### NowPlaying

A compact player that grows from a mini bar into a full player in one continuous morph, with a waveform scrubber and artwork that slides in the direction you skip.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tracks` (required) | `{ id: string; title: string; artist: string; duration: number; artwork: string; artworkAlt?: string }[]` | – | The queue. duration is in seconds. |
| `index` | `number` | – | Controlled position in the queue. |
| `defaultIndex` | `number` | `0` | Initial position when uncontrolled. |
| `onIndexChange` | `(index: number) => void` | – | Called when the track changes by skip or when a track ends. The queue wraps at both ends. |
| `playing` | `boolean` | – | Controlled playback state. |
| `defaultPlaying` | `boolean` | `false` | Initial playback state when uncontrolled. |
| `onPlayingChange` | `(playing: boolean) => void` | – | Called on play and pause. |
| `currentTime` | `number` | – | Position in seconds from real audio, such as audio.currentTime on timeupdate. The built-in clock keeps the waveform moving between updates, and each new value corrects it. Ignored while the waveform is being dragged. |
| `onSeek` | `(seconds: number) => void` | – | Called with the new position in seconds when a waveform drag ends, on each keyboard seek, and when Previous restarts the track. Set audio.currentTime here. |
| `defaultExpanded` | `boolean` | `false` | Starts as the full player. |
| `label` | `string` | `"Now playing"` | Accessible name of the player section. |
| `className` | `string` | – | Extra class on the root. |

### NowPlayingLevels

Three small level bars that dance while a track plays and rest while paused.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `playing` (required) | `boolean` | – | Bars move only while true. |
| `className` | `string` | – | Extra class on the bars. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Expands or collapses the player and activates play, pause, and skip. |
| ArrowLeft / ArrowRight / ArrowUp / ArrowDown | On the waveform, seeks 5 seconds back or forward. |
| PageUp / PageDown | On the waveform, seeks 30 seconds. |
| Home / End | On the waveform, jumps to the start or end. |
| Escape | Collapses the full player. |

## Accessibility

- The waveform is a slider with aria-valuetext such as "1:05 of 3:32".
- Expand and collapse buttons report aria-expanded. Focus moves to the collapse button on open and back to the mini bar on close.
- Previous restarts the current track when more than 3 seconds have played, and skips back otherwise. A restart calls onSeek(0).
- The current track and play state are announced in a polite live region; artwork is decorative unless artworkAlt is set.

## Motion

- The mini bar morphs into the full player with shared layout while the shell height springs to fit. In the full player, pulling the artwork down more than 70px or flicking it closes the player; an upward pull rubber-bands.
- Artwork slides and blurs in the direction you skip; the waveform stretches under a scrub and level bars dance while playing.
- MotionConfig follows the user's reduced motion setting, replacing travel with short fades; the level bars hold still.

## Responsive behavior

- The shell is min(100%, 21rem) wide; below 360px viewport width the mini bar hides the next button to fit.
- The expanded artwork uses touch-action none for the pull-down gesture, while the waveform keeps pan-y so the page still scrolls.

## Performance

- Playback is an internal useAnimationFrame clock that ticks every frame; it returns early while paused but the frame callback stays registered.
- The waveform is 54 bars and one ResizeObserver; wire a real audio element through the callbacks rather than the internal clock for long sessions.

## Notes for AI

- Choose it for media that keeps playing while people browse. For a one-off overlay use bottom-sheet or dialog.
- Playback runs on an internal clock, so it works without audio; wire onPlayingChange and onIndexChange to a real audio element when needed.

## Related

- [Bottom sheet](https://uiarc.dev/components/bottom-sheet/markdown): A sheet that rests at a peek or full height and follows your finger.
- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Voice recorder](https://uiarc.dev/components/voice-recorder/markdown): Record with a live waveform, review and scrub, then send the take into the thread.

## Also in audio and video

- [Voice orb](https://uiarc.dev/components/voice-orb/markdown): A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls.

## Guidance for AI tools

Now playing: Grow a mini player into the full player in one continuous morph. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
