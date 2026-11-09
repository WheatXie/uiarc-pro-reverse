import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./now-playing.module.css";

/** One entry of the queue. `duration` is in seconds. */
export interface NowPlayingTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  artwork: string;
  artworkAlt?: string;
}

export interface NowPlayingProps {
  /** The queue. duration is in seconds. */
  tracks: NowPlayingTrack[];
  /** Controlled position in the queue. */
  index?: number;
  /** Initial position when uncontrolled. */
  defaultIndex?: number;
  /** Called when the track changes by skip or when a track ends. The queue wraps at both ends. */
  onIndexChange?: (index: number) => void;
  /** Controlled playback state. */
  playing?: boolean;
  /** Initial playback state when uncontrolled. */
  defaultPlaying?: boolean;
  /** Called on play and pause. */
  onPlayingChange?: (playing: boolean) => void;
  /** Position in seconds from real audio, such as audio.currentTime on timeupdate. The built-in clock keeps the waveform moving between updates, and each new value corrects it. Ignored while the waveform is being dragged. */
  currentTime?: number;
  /** Called with the new position in seconds when a waveform drag ends, on each keyboard seek, and when Previous restarts the track. Set audio.currentTime here. */
  onSeek?: (seconds: number) => void;
  /** Starts as the full player. */
  defaultExpanded?: boolean;
  /** Accessible name of the player section. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
}

const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const EASE_EXIT = [...motionTokens.ease.exit] as [number, number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Rubber-band an overshoot: the further past the edge, the less of it you get. */
function rubberband(value: number, distance: number, resistance = 0.55) {
  const magnitude = Math.abs(value);
  return (magnitude * distance * resistance * Math.sign(value)) / (distance + resistance * magnitude);
}

/**
 * Deterministic bar heights for a track: a sine envelope shaped by the track id, so every render
 * and every reload draws the same waveform.
 */
function barHeights(id: string) {
  let seed = 0;
  for (const char of id) seed = (31 * seed + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 54 }, (_, index) => {
    const envelope = 0.35 + 0.65 * Math.sin(Math.PI * clamp((index / 53) * 1.1, 0, 1)) ** 0.7;
    seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
    return clamp(envelope * (0.45 + 0.55 * (seed / 0x100000000)), 0.12, 1);
  });
}

function Levels({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span
      className={[styles.levels, className].filter(Boolean).join(" ")}
      data-playing={playing || undefined}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

interface ScrubberProps {
  track: NowPlayingTrack;
  progress: MotionValue<number>;
  onScrub: (scrubbing: boolean) => void;
  onSeek: (value: number) => void;
}

function Scrubber({ track, progress, onScrub, onSeek }: ScrubberProps) {
  const heights = barHeights(track.id);
  const clipPath = useTransform(progress, (value) => `inset(0 ${(1 - value) * 100}% 0 0)`);
  const dragX = useMotionValue(0);
  const dragScale = useMotionValue(1);
  const drag = useRef<{ pointer: number; left: number; width: number } | null>(null);
  const [elapsed, setElapsed] = useState(() => Math.floor(progress.get() * track.duration));

  useEffect(() => progress.on("change", (value) => setElapsed(Math.floor(value * track.duration))), [progress]);

  function moveTo(clientX: number) {
    const box = drag.current;
    if (!box) return;
    const ratio = (clientX - box.left) / box.width;
    progress.set(clamp(ratio, 0, 1));
    dragX.set(
      ratio < 0
        ? rubberband(ratio * box.width, box.width, 0.3)
        : ratio > 1
          ? rubberband((ratio - 1) * box.width, box.width, 0.3)
          : 0,
    );
  }

  function release(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    onScrub(false);
    animate(dragScale, 1, motionTokens.spring.snappy);
    animate(dragX, 0, { type: "spring", visualDuration: 0.4, bounce: 0 });
    onSeek(progress.get());
  }

  const bars = heights.map((height, index) => <span key={index} style={{ height: `${100 * height}%` }} />);

  return (
    <div className={styles.scrubber}>
      <motion.div
        className={styles.wave}
        role="slider"
        tabIndex={0}
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={track.duration}
        aria-valuenow={elapsed}
        aria-valuetext={`${time(elapsed)} of ${time(track.duration)}`}
        style={{ x: dragX, scaleY: dragScale }}
        onPointerDown={(event) => {
          if (drag.current || event.button !== 0) return;
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointer: event.pointerId, left: box.left, width: box.width };
          onScrub(true);
          animate(dragScale, 1.18, motionTokens.spring.snappy);
          moveTo(event.clientX);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointer === event.pointerId) moveTo(event.clientX);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(event) => {
          const step = 5 / track.duration;
          const steps: Record<string, number> = {
            ArrowRight: step,
            ArrowUp: step,
            ArrowLeft: -step,
            ArrowDown: -step,
            PageUp: 6 * step,
            PageDown: -(6 * step),
            Home: -1,
            End: 1,
          };
          if (!(event.key in steps)) return;
          event.preventDefault();
          const next = clamp(progress.get() + steps[event.key], 0, 0.999);
          progress.set(next);
          onSeek(next);
        }}
      >
        <span className={styles.bars} aria-hidden="true">
          {bars}
        </span>
        <motion.span className={styles.bars} data-played aria-hidden="true" style={{ clipPath }}>
          {bars}
        </motion.span>
      </motion.div>
      <div className={styles.times} aria-hidden="true">
        <span>{time(elapsed)}</span>
        <span>−{time(Math.max(0, track.duration - elapsed))}</span>
      </div>
    </div>
  );
}

interface PlayGlyphProps {
  icon: typeof Play;
  playing: boolean;
  size: number;
}

function PlayGlyph({ icon: Icon, playing, size }: PlayGlyphProps) {
  return (
    <span className={styles.playGlyph} style={{ width: size, height: size }}>
      <AnimatePresence initial={false}>
        <motion.span
          key={playing ? "pause" : "play"}
          className={styles.playPhase}
          data-icon={playing ? "pause" : "play"}
          initial={{ opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            scale: 0.6,
            filter: `blur(${motionTokens.blur.subtle}px)`,
            transition: { duration: motionTokens.duration.instant },
          }}
          transition={motionTokens.spring.snappy}
        >
          <Icon size={size} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A compact player that grows from a mini bar into a full player in one continuous morph, with a
 * waveform scrubber and artwork that slides in the direction you skip.
 */
export function NowPlaying({
  tracks,
  index,
  defaultIndex = 0,
  onIndexChange,
  playing,
  defaultPlaying = false,
  onPlayingChange,
  currentTime,
  onSeek,
  defaultExpanded = false,
  label = "Now playing",
  className,
}: NowPlayingProps) {
  const reduced = useReducedMotion() ?? false;
  const describedBy = useId();
  const [ownIndex, setOwnIndex] = useState(defaultIndex);
  const [ownPlaying, setOwnPlaying] = useState(defaultPlaying);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [direction, setDirection] = useState(1);
  const active = clamp(index ?? ownIndex, 0, tracks.length - 1);
  const isPlaying = playing ?? ownPlaying;
  const track = tracks[active];
  const progress = useMotionValue(0);
  const dragY = useMotionValue(0);
  const pull = useRef<{ pointer: number; y: number; lastY: number; lastT: number; velocity: number } | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const miniMain = useRef<HTMLButtonElement | null>(null);
  const collapseButton = useRef<HTMLButtonElement | null>(null);
  const previousExpanded = useRef(expanded);
  const shellHeight = useMotionValue<number | "auto">("auto");
  const motionState = useRef({ reduced, expanded });
  const dragging = useRef(false);

  useEffect(() => {
    motionState.current = { reduced, expanded };
  });

  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const height = node.offsetHeight;
      const current = shellHeight.get();
      if (typeof current !== "number") {
        shellHeight.jump(height);
        return;
      }
      if (Math.abs(current - height) < 0.5) return;
      const { reduced: reducedNow, expanded: expandedNow } = motionState.current;
      animate(
        shellHeight,
        height,
        reducedNow
          ? { duration: motionTokens.duration.fast }
          : { type: "spring", visualDuration: 0.46, bounce: 0.1 * Number(Boolean(expandedNow)) },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [shellHeight]);

  const live = useRef({ playing: isPlaying, index: active, count: tracks.length, duration: track.duration });
  useEffect(() => {
    live.current = { playing: isPlaying, index: active, count: tracks.length, duration: track.duration };
  });

  useEffect(() => {
    dragging.current = false;
  }, [active, expanded]);

  useEffect(() => {
    if (currentTime === undefined || dragging.current) return;
    progress.set(clamp(currentTime / live.current.duration, 0, 1));
  }, [currentTime, progress]);

  useAnimationFrame((_, delta) => {
    const state = live.current;
    if (!state.playing || pull.current || dragging.current) return;
    const next = progress.get() + delta / 1000 / state.duration;
    if (next < 1) {
      progress.set(next);
      return;
    }
    const wrapped = (state.index + 1) % state.count;
    progress.set(0);
    setDirection(1);
    setOwnIndex(wrapped);
    onIndexChange?.(wrapped);
  });

  useEffect(() => {
    // Focus follows the morph, but not on the first paint: the player opens with nothing focused.
    if (previousExpanded.current === expanded) return;
    previousExpanded.current = expanded;
    (expanded ? collapseButton : miniMain).current?.focus({ preventScroll: true });
  }, [expanded]);

  const shellTransition: Transition = reduced
    ? { duration: motionTokens.duration.fast }
    : { type: "spring", visualDuration: 0.46, bounce: 0.1 * Number(Boolean(expanded)) };

  const playIcon = isPlaying ? Pause : Play;
  const playLabel = `${isPlaying ? "Pause" : "Play"} ${track.title}`;

  const textMotion = {
    initial: { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -6, transition: { duration: motionTokens.duration.instant } },
    transition: { duration: motionTokens.duration.standard, ease: EASE_ENTER },
  };

  /** Rows that appear only in one shape fade and lift in; the stagger keeps the morph readable. */
  const row = (delay: number, lift = 8) => ({
    initial: {
      opacity: 0,
      y: reduced ? 0 : lift,
      filter: reduced ? "blur(0px)" : `blur(${motionTokens.blur.subtle}px)`,
    },
    animate: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: motionTokens.duration.standard,
        ease: EASE_ENTER,
        delay: reduced ? 0 : delay,
      },
    },
    exit: {
      opacity: 0,
      filter: reduced ? "blur(0px)" : `blur(${motionTokens.blur.subtle}px)`,
      transition: {
        duration: reduced ? motionTokens.duration.instant : 0.1,
        ease: EASE_EXIT,
      },
    },
  });

  function skip(step: number) {
    if (step < 0 && progress.get() * track.duration > 3) {
      animate(progress, 0, reduced ? { duration: 0 } : motionTokens.spring.smooth);
      onSeek?.(0);
      return;
    }
    const next = (active + step + tracks.length) % tracks.length;
    setDirection(step);
    progress.set(0);
    setOwnIndex(next);
    onIndexChange?.(next);
  }

  function releasePull(event: React.PointerEvent<HTMLDivElement>) {
    const state = pull.current;
    if (!state || state.pointer !== event.pointerId) return;
    pull.current = null;
    const dismiss = dragY.get() > 70 || state.velocity > 0.5;
    if (dismiss) setExpanded(false);
    animate(dragY, 0, { type: "spring", visualDuration: 0.4, bounce: 0.25 * Number(!dismiss) });
  }

  return (
    <MotionConfig reducedMotion="user">
      <section
        className={[styles.root, className].filter(Boolean).join(" ")}
        aria-label={label}
        aria-describedby={describedBy}
        onKeyDown={(event) => {
          if (event.key === "Escape" && expanded) {
            event.stopPropagation();
            setExpanded(false);
          }
        }}
      >
        <p id={describedBy} className={styles.srOnly} aria-live="polite">
          {track.title} by {track.artist}, {isPlaying ? "playing" : "paused"}
        </p>
        <motion.div
          className={styles.shell}
          data-expanded={expanded || undefined}
          initial={false}
          animate={{ borderRadius: expanded ? 30 : 22 }}
          style={{ y: dragY, height: shellHeight }}
          transition={shellTransition}
        >
          <div ref={inner} className={styles.inner}>
            <motion.div
              layout
              className={styles.art}
              initial={false}
              animate={{ borderRadius: expanded ? 20 : 12 }}
              transition={shellTransition}
              onPointerDown={
                expanded
                  ? (event) => {
                      if (pull.current || event.button !== 0) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragY.stop();
                      pull.current = {
                        pointer: event.pointerId,
                        y: event.clientY,
                        lastY: event.clientY,
                        lastT: event.timeStamp,
                        velocity: 0,
                      };
                    }
                  : undefined
              }
              onPointerMove={
                expanded
                  ? (event) => {
                      const state = pull.current;
                      if (!state || state.pointer !== event.pointerId) return;
                      const dy = event.clientY - state.y;
                      dragY.set(dy > 0 ? 0.6 * dy : rubberband(dy, 200, 0.2));
                      state.velocity =
                        (event.clientY - state.lastY) / Math.max(1, event.timeStamp - state.lastT);
                      state.lastY = event.clientY;
                      state.lastT = event.timeStamp;
                    }
                  : undefined
              }
              onPointerUp={expanded ? releasePull : undefined}
              onPointerCancel={expanded ? releasePull : undefined}
            >
              <motion.div layout className={styles.artSquare} transition={shellTransition}>
                <AnimatePresence initial={false} custom={direction}>
                  <motion.img
                    key={track.id}
                    className={styles.artImage}
                    src={track.artwork}
                    alt={track.artworkAlt ?? ""}
                    draggable={false}
                    decoding="async"
                    custom={direction}
                    variants={{
                      enter: (custom: number) =>
                        reduced
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: `${24 * custom}%`,
                              scale: 0.96,
                              filter: `blur(${motionTokens.blur.soft}px)`,
                            },
                      center: { opacity: 1, x: "0%", scale: 1, filter: "blur(0px)" },
                      exit: (custom: number) =>
                        reduced
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: `${-24 * custom}%`,
                              scale: 0.96,
                              filter: `blur(${motionTokens.blur.soft}px)`,
                            },
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      ...motionTokens.spring.smooth,
                      opacity: { duration: motionTokens.duration.standard },
                    }}
                  />
                </AnimatePresence>
              </motion.div>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.button
                    key="collapse"
                    ref={collapseButton}
                    type="button"
                    className={styles.collapse}
                    aria-label="Collapse player"
                    aria-expanded="true"
                    onClick={() => setExpanded(false)}
                    onPointerDown={(event) => event.stopPropagation()}
                    {...row(0.16, 0)}
                  >
                    <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
            <AnimatePresence initial={false} mode="popLayout">
              {expanded ? (
                [
                  <motion.div key="info" className={styles.info} {...row(0.08, 12)}>
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.div key={track.id} className={styles.infoText} {...textMotion}>
                        <h3 className={styles.titleLarge}>{track.title}</h3>
                        <p className={styles.artistLarge}>{track.artist}</p>
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>,
                  <motion.div key="wave" className={styles.waveArea} {...row(0.12, 14)}>
                    <Scrubber
                      track={track}
                      progress={progress}
                      onScrub={(scrubbing) => {
                        dragging.current = scrubbing;
                      }}
                      onSeek={(value) => {
                        progress.set(value);
                        onSeek?.(value * track.duration);
                      }}
                    />
                  </motion.div>,
                  <motion.button
                    key="prev"
                    type="button"
                    className={styles.prev}
                    aria-label="Previous track"
                    onClick={() => skip(-1)}
                    {...row(0.14, 10)}
                  >
                    <SkipBack size={20} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
                  </motion.button>,
                ]
              ) : (
                [
                  <motion.button
                    key="main"
                    ref={miniMain}
                    type="button"
                    className={styles.miniMain}
                    aria-label={`Expand player, ${track.title} by ${track.artist}`}
                    aria-expanded="false"
                    onClick={() => setExpanded(true)}
                    {...row(0.1, 4)}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span key={track.id} className={styles.miniText} {...textMotion}>
                        <span className={styles.miniTitle}>{track.title}</span>
                        <span className={styles.miniArtist}>{track.artist}</span>
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>,
                  <motion.span key="levels" className={styles.levelsArea} {...row(0.14, 0)}>
                    <Levels playing={isPlaying} />
                  </motion.span>,
                  <motion.span key="progress" className={styles.miniProgressTrack} aria-hidden="true" {...row(0.16, 0)}>
                    <motion.span className={styles.miniProgress} style={{ scaleX: progress }} />
                  </motion.span>,
                ]
              )}
            </AnimatePresence>
            <motion.button
              layout
              type="button"
              className={styles.play}
              aria-label={playLabel}
              onClick={() => {
                const next = !isPlaying;
                setOwnPlaying(next);
                onPlayingChange?.(next);
              }}
              transition={shellTransition}
            >
              <PlayGlyph icon={playIcon} playing={isPlaying} size={expanded ? 24 : 18} />
            </motion.button>
            <motion.button
              layout
              type="button"
              className={styles.next}
              aria-label="Next track"
              onClick={() => skip(1)}
              transition={shellTransition}
            >
              <SkipForward size={expanded ? 20 : 18} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}

export default NowPlaying;
