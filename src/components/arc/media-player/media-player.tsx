"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeOff,
} from "lucide-react";
import { photos } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./media-player.module.css";

/** A synthesized loop in the sample playlist. */
export interface MediaPlayerTrack {
  /** Track name, shown in the now-playing block and the queue. */
  title: string;
  /** Artist line, printed above the "Original loop" suffix. */
  artist: string;
  /** Loop length in seconds; the generated WAV is exactly this long. */
  length: number;
  /** Beats per minute of the arpeggio that the loop is synthesized from. */
  bpm: number;
  /** Eight note frequencies, in hertz, cycled over the loop. */
  notes: number[];
  /** Id of the photo in `lib/media` used as cover art. */
  cover: string;
}

/** The three sample loops the block plays. Tracks are generated in the browser, not fetched. */
export const mediaPlayerTracks: MediaPlayerTrack[] = [
  {
    title: "Morning tide",
    artist: "Arc Sessions",
    length: 24,
    bpm: 84,
    notes: [220, 261.63, 329.63, 293.66, 246.94, 196, 246.94, 293.66],
    cover: "sea-at-dusk",
  },
  {
    title: "Glass garden",
    artist: "Arc Sessions",
    length: 24,
    bpm: 96,
    notes: [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63],
    cover: "sunroom",
  },
  {
    title: "After the rain",
    artist: "Arc Sessions",
    length: 24,
    bpm: 72,
    notes: [196, 246.94, 293.66, 261.63, 220, 261.63, 329.63, 246.94],
    cover: "alpine-lake",
  },
];

const SAMPLE_RATE = 22050;
const EASE = [...motionTokens.ease.standard] as [
  number,
  number,
  number,
  number,
];

/** `m:ss`, the transport and queue time format. */
function formatTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.floor(value) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Renders one loop as a mono 16-bit WAV: a plucked arpeggio over a soft bass pulse, faded in and
 * out so the loop does not click at either end.
 */
function renderLoop(track: MediaPlayerTrack): Blob {
  const total = SAMPLE_RATE * track.length;
  const buffer = new ArrayBuffer(44 + 2 * total);
  const view = new DataView(buffer);
  const writeTag = (offset: number, tag: string) => {
    for (let index = 0; index < tag.length; index += 1) {
      view.setUint8(offset + index, tag.charCodeAt(index));
    }
  };

  writeTag(0, "RIFF");
  view.setUint32(4, 36 + 2 * total, true);
  writeTag(8, "WAVE");
  writeTag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeTag(36, "data");
  view.setUint32(40, 2 * total, true);

  const beat = 60 / track.bpm;

  for (let sample = 0; sample < total; sample += 1) {
    const time = sample / SAMPLE_RATE;
    const step = Math.floor(time / beat) % track.notes.length;
    const phase = (time % beat) / beat;
    const note = track.notes[step];
    const value = Math.max(
      -1,
      Math.min(
        1,
        (Math.sin(2 * Math.PI * note * time) * Math.exp(-(5.2 * phase)) * 0.43 +
          Math.sin(2 * Math.PI * note * 2 * time) *
            Math.exp(-(8 * phase)) *
            0.16 +
          0.18 *
            Math.sin(
              2 * Math.PI * track.notes[2 * Math.floor(step / 2)] * 0.5 * time,
            ) +
          Math.sin(2 * Math.PI * 82 * time) *
            Math.exp(-(((time % (2 * beat)) / beat) * 18)) *
            0.08) *
          Math.min(1, time / 0.18, (track.length - time) / 0.5),
      ),
    );

    view.setInt16(44 + 2 * sample, 32767 * value, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * An audio player with cover art, a three-track playlist, seek, skip, and volume with mute.
 *
 * Takes no props. The tracks are short loops synthesized in the browser as WAV blobs, so the demo
 * needs no audio files; covers come from the shared `lib/media` photo catalogue. Swap
 * `mediaPlayerTracks` for real sources to wire it to a media library.
 */
export function MediaPlayerBlock() {
  const reducedMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeRef = useRef(false);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [lastVolume, setLastVolume] = useState(0.7);
  const [ready, setReady] = useState(false);

  const track = mediaPlayerTracks[current];
  const cover = photos.find((photo) => photo.id === track.cover) ?? photos[0];

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !ready) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function selectTrack(index: number) {
    if (index === current) {
      void togglePlayback();
      return;
    }

    resumeRef.current = isPlaying;
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrent(index);
  }

  function stepTrack(offset: number) {
    selectTrack(
      (current + offset + mediaPlayerTracks.length) % mediaPlayerTracks.length,
    );
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const url = URL.createObjectURL(renderLoop(mediaPlayerTracks[current]));
    audio.src = url;
    audio.load();
    audio.currentTime = 0;

    if (resumeRef.current) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    setReady(true);

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [current]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const motionOk = !reducedMotion;
  const railTransition: Transition = motionOk
    ? motionTokens.spring.gentle
    : { duration: 0 };
  const progress = 100 * Math.min(1, currentTime / track.length);

  return (
    <section className={styles.player} aria-label="Audio player">
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onEnded={(event) => {
          event.currentTarget.currentTime = 0;
          setIsPlaying(false);
          resumeRef.current = false;
          setCurrentTime(0);
        }}
      />

      <div className={styles.cover}>
        <AnimatePresence initial={false}>
          <motion.div
            key={cover.id}
            className={styles.coverImage}
            initial={motionOk ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            exit={motionOk ? { opacity: 0 } : undefined}
            transition={{
              duration: motionOk ? motionTokens.duration.standard : 0,
              ease: EASE,
            }}
          >
            <Image
              src={cover.src}
              alt={cover.alt}
              fill
              sizes="(max-width: 560px) 100vw, 520px"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.nowPlaying}>
        <div className={styles.titleClip}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={track.title}
              initial={motionOk ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={motionOk ? { opacity: 0, y: -10 } : { opacity: 0 }}
              transition={
                motionOk ? motionTokens.spring.gentle : { duration: 0 }
              }
            >
              <h2>{track.title}</h2>
              <p>{`${track.artist} · Original loop`}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.transport}>
          <button
            type="button"
            onClick={() => stepTrack(-1)}
            aria-label="Previous track"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button
            className={styles.playButton}
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!ready}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {motionOk ? (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={isPlaying ? "pause" : "play"}
                  className={styles.playIcon}
                  initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                  transition={{
                    duration: motionTokens.duration.fast,
                    ease: EASE,
                  }}
                >
                  {isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play size={20} fill="currentColor" />
                  )}
                </motion.span>
              </AnimatePresence>
            ) : isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => stepTrack(1)}
            aria-label="Next track"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className={styles.timeline}>
        <span>{formatTime(currentTime)}</span>
        <input
          className={styles.range}
          style={{ "--fill": `${progress}%` } as CSSProperties}
          type="range"
          min={0}
          max={track.length}
          step={0.1}
          value={Math.min(currentTime, track.length)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = next;
            setCurrentTime(next);
          }}
          aria-label={`Seek ${track.title}`}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(track.length)}`}
        />
        <span>{formatTime(track.length)}</span>
      </div>

      <div className={styles.queueHead}>
        <h3>Playlist</h3>
        <div className={styles.volume}>
          <button
            type="button"
            onClick={() => {
              if (volume > 0) {
                setLastVolume(volume);
                setVolume(0);
              } else {
                setVolume(lastVolume || 0.7);
              }
            }}
            aria-label={volume ? "Mute audio" : "Unmute audio"}
          >
            {volume ? <Volume2 size={16} /> : <VolumeOff size={16} />}
          </button>
          <input
            className={styles.range}
            style={{ "--fill": `${100 * volume}%` } as CSSProperties}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            aria-valuetext={`${Math.round(100 * volume)}%`}
          />
        </div>
      </div>

      <ul className={styles.queue}>
        {mediaPlayerTracks.map((item, index) => {
          const isCurrent = index === current;

          return (
            <li key={item.title}>
              <button
                type="button"
                className={styles.track}
                data-current={isCurrent}
                onClick={() => selectTrack(index)}
                aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${item.title}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                {isCurrent && (
                  <motion.span
                    className={styles.selectionRail}
                    layoutId="media-player-selection"
                    transition={railTransition}
                    aria-hidden="true"
                  />
                )}
                <span className={styles.trackTitle}>{item.title}</span>
                <span className={styles.trackStatus}>
                  {isCurrent && isPlaying ? (
                    <span
                      className={styles.bars}
                      data-reduce={reducedMotion ? "true" : undefined}
                      aria-label="Playing"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    formatTime(item.length)
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default MediaPlayerBlock;
