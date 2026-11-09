# Audio and video

## `now-playing` · Now playing (Pro, special)

Grow a mini player into the full player in one continuous morph.

When to use:
- Media that keeps playing while people browse, such as music, podcasts, or audio lessons.
- A mini player bar that expands into a full player with artwork and a scrubber.

When not to use:
- Use bottom-sheet or dialog for a one-off overlay that is not a player.
- Use voice-recorder for recording and playing back short voice notes.

Keywords: special, media, music, react music player, now playing bar, mini player, audio player component, spotify style player, waveform scrubber

Files: demo.module.css, demo.tsx, now-playing.module.css, now-playing.tsx

## `voice-orb` · Voice orb (Pro, special)

A voice mode orb that listens, thinks, and speaks, with a live transcript and call controls.

When to use:
- A voice mode for an assistant where the user needs to see whether it is listening, thinking, or speaking.
- Hands-free or call-like flows that need start, mute, a running clock, and end in one compact control.

When not to use:
- Use voice-recorder when the user records a clip to send or save.
- Use chat-thread with text-stream for typed chat where no audio is involved.

Keywords: special, new, react voice orb, voice assistant ui, ai voice mode, audio visualizer orb, microphone level, speaking animation, voice chat controls, live transcript

Files: demo.tsx, voice-orb.module.css, voice-orb.tsx

## `voice-recorder` · Voice recorder (Pro, special)

Record with a live waveform, review and scrub, then send the take into the thread.

When to use:
- Voice notes in chats, comments, or field notes where speaking beats typing.
- A thread of voice bubbles with playback and scrubbing.

When not to use:
- Use now-playing for music or long-form audio.
- Use hold-to-confirm for press-and-hold actions that do not record.

Keywords: special, motion, react voice recorder, voice message, audio recorder ui, whatsapp voice note, record audio button, voice memo

Files: demo.tsx, voice-recorder.module.css, voice-recorder.tsx
