# Media player

> An audio player with a living playlist and complete playback controls.

- Type: Block
- Page: https://uiarc.dev/components/blocks/media-player
- Markdown: https://uiarc.dev/components/blocks/media-player/markdown

- Access: Arc Pro
- Registry id: `media-player`
- Source file: `registry/blocks/media-player/media-player.tsx`
- Built from: Button, Progress, Motion
- Keywords: react audio player, music player component, podcast player, playlist player, custom audio controls, media player ui

Use this for an audio collection where people need clear transport, progress, and volume controls. Replace the sample local loops with your media.

## When to use

- A small audio collection such as a podcast, sample pack, or playlist.
- Pages that need a full player with seek, skip, volume, and a track list.

## When not to use

- Use now-playing for a compact now playing widget.
- Use transcript-studio when the audio needs a synced transcript.
- Use voice-recorder for recording audio.

## Installation

Media player is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/media-player
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MediaPlayerBlock } from "@/components/arc/blocks/media-player/media-player";

export function Listen() {
  return <MediaPlayerBlock />;
}
```

## API reference

### MediaPlayerBlock

An audio player with cover art, a three-track playlist, seek bar, skip, and volume with mute. Takes no props; the tracks are short loops synthesized in the browser as WAV blobs, and covers come from lib/media photos.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Adjust seek position and volume on the focused range inputs. |

## Accessibility

- Uses a native audio element with range inputs for seek and volume.
- Transport and playlist buttons have labels such as "Play <title>" and "Next track"; the current track has aria-current.
- Seek and volume ranges carry aria-valuetext such as "0:12 of 0:24" and "70%". The mute button's label switches between Mute and Unmute audio.

## Motion

- The selection rail glides to the current track with a shared layoutId on the gentle spring; playing bars pulse beside it.
- The cover crossfades and the title rises in when the track changes; the play icon swaps with a short scale and blur.
- Reduced motion removes the glides, swaps, and bar animation.

## Responsive behavior

- Below 420px viewport width the padding tightens, the cover takes a 1.7 ratio, transport buttons shrink, and the volume slider narrows to 64px.
- Seek and volume are native range inputs, so touch and keyboard work without extra handling.

## Performance

- Uses a native audio element; position updates come from timeupdate, not a frame loop.
- The demo tracks are generated as WAV blobs in the browser; replace them with real audio URLs in production.

## Notes for AI

- Use for a small audio collection such as a podcast, a sample pack, or a playlist.
- Replace the tracks array and renderTrack() with real audio URLs set on the audio element, and the cover ids with your images.
- The default export is MediaPlayerBlock.

## Related

- [Now playing](https://uiarc.dev/components/now-playing/markdown): Grow a mini player into the full player in one continuous morph.
- [Slider](https://uiarc.dev/components/slider/markdown): Pick a value or a range on a track that follows your finger.
- [Voice recorder](https://uiarc.dev/components/voice-recorder/markdown): Record with a live waveform, review and scrub, then send the take into the thread.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
