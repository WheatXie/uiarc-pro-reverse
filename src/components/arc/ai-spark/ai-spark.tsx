"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ai-spark.module.css";

export type SparkStatus = "idle" | "thinking" | "generating" | "done" | "error";
export type SparkTone = "accent" | "foreground" | "muted" | "inherit";
export type SparkVariant = "mark" | "pill" | "avatar";

export interface AiSparkProps {
  /** What the AI is doing. Leave it unset and the spark plays through idle, thinking, generating and done on its own. */
  status?: SparkStatus;
  /** Size in px, or any CSS length such as "1em" to match surrounding text. The mark itself, the avatar tile, or the mark inside the pill. Proportions are hinted optically: small marks get heavier rays and under 18px the diagonals become dots. Defaults to 24 (32 for the avatar, 16 in the pill). */
  size?: number | string;
  /** Semantic color of the mark; the diagonals and core use a lighter tone of the same color. Error always eases to a muted danger tone. Defaults to "accent". */
  tone?: SparkTone;
  /** Any CSS color, overriding tone. */
  color?: string;
  /** `mark` renders the spark alone. `pill` adds a crossfading status label (Ready, Thinking, Writing, Done, Couldn't finish) in a quiet bordered capsule. `avatar` sets the mark in a round, lightly tinted tile for message avatars and icon buttons. Defaults to "mark". */
  variant?: SparkVariant;
  /** Pill text, overriding the built-in label for the current status, for example "Reading 12 files". */
  label?: string;
  /** Multiplies every loop and spin speed. Defaults to 1. */
  speed?: number;
  /** A very slow breathing twinkle while idle. Turn it off for a fully still idle mark. Defaults to true. */
  twinkle?: boolean;
  /** Freezes the animation in place; resuming continues from the same phase. Defaults to false. */
  paused?: boolean;
  /** Announce status changes through a polite live region. Turn it off for decorative copies so only one spark speaks. Defaults to true. */
  announce?: boolean;
  /** Accessible name. Defaults to a phrase for the status, such as "AI is thinking". */
  "aria-label"?: string;
  /** Class on the root span. */
  className?: string;
  /** Inline styles on the root span. */
  style?: CSSProperties;
}

/** Pill labels: the built-in text for each status. */
const LABELS: Record<SparkStatus, string> = {
  idle: "Ready",
  thinking: "Thinking",
  generating: "Writing",
  done: "Done",
  error: "Couldn't finish",
};

/** Accessible names for the mark variant, and for the pill when it is decorative. */
const PHRASES: Record<SparkStatus, string> = {
  idle: "AI ready",
  thinking: "AI is thinking",
  generating: "AI is writing",
  done: "AI finished",
  error: "AI couldn't finish",
};

const TONE_COLORS: Record<SparkTone, string> = {
  accent: "var(--accent)",
  foreground: "var(--foreground)",
  muted: "var(--text-muted)",
  inherit: "currentColor",
};

/** The self-play cycle, only used when `status` is left unset: [status, hold in ms]. */
const SELF_PLAY: [SparkStatus, number][] = [
  ["idle", 1600],
  ["thinking", 2800],
  ["generating", 3600],
  ["done", 2000],
];

const TAU = 2 * Math.PI;
/** A small fixed phase offset per ray, so the ring never pulses in perfect lockstep. */
const JITTER = [0, 0.021, -0.014, 0.017, -0.019, 0.012, 0.008, -0.016];

const fract = (value: number) => value - Math.floor(value);
const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** One clean cosine cycle over [0, 1]. */
const wave = (value: number) => 0.5 - 0.5 * Math.cos(TAU * value);
/** A sine-squared pulse that is zero outside [start, start + width]. */
const pulse = (value: number, start: number, width: number) =>
  value <= start || value >= start + width ? 0 : Math.sin((Math.PI * (value - start)) / width) ** 2;
const easeInOut = (value: number) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);
const round2 = (value: number) => String(Math.round(100 * value) / 100);

interface SparkGeometry {
  /** Primary rays: inner radius, outer radius, half width at the base and tip radius. */
  p: { r0: number; r1: number; a: number; b: number };
  /** Diagonal rays; `dot` collapses them into one round dot per diagonal. */
  s: { r0: number; r1: number; a: number; b: number; dot: boolean };
  core: number;
  particles: boolean;
  toneB: number;
}

interface SparkPose {
  /** Writes 35 values: 8 rays x [reach, width, offset, opacity], then breath, core scale and particle strength. */
  fill: (time: number, out: Float32Array) => void;
  spin: number;
  rest: boolean;
  loops: boolean;
}

interface SparkState {
  status: SparkStatus;
  twinkle: boolean;
  from: SparkPose;
  to: SparkPose;
  mixStart: number;
  mixDur: number;
  t: number;
  clock: number;
  angle: number;
  vel: number;
  target: number | null;
  glide: { start: number; from: number; v0: number; distance: number; duration: number };
  impulses: { kind: "gather" | "shake"; start: number }[];
  A: Float32Array;
  B: Float32Array;
  out: Float32Array;
  raf: number;
  last: number;
  inView: boolean;
  kick: () => void;
}

/**
 * One tapered ray: a capsule whose base sits at `inner` on the negative y axis and whose tip is a
 * half round at `outer`, so every ray reads as a brush stroke rather than a line. When the span is
 * shorter than the caps (the dot mode) the whole shape collapses into a circle.
 */
function rayPath(inner: number, outer: number, halfWidth: number, tip: number) {
  const span = outer - inner;
  if (span <= halfWidth - tip + 0.001) {
    const y = round2(-inner);
    const r = round2(halfWidth);
    return `M${r} ${y}A${r} ${r} 0 1 0 -${r} ${y}A${r} ${r} 0 1 0 ${r} ${y}Z`;
  }
  const k = (halfWidth - tip) / span;
  const l = Math.sqrt(1 - k * k);
  const s = round2(halfWidth * l);
  const o = round2(-inner - halfWidth * k);
  const u = round2(tip * l);
  const c = round2(-outer - tip * k);
  return `M${s} ${o}L${u} ${c}A${round2(tip)} ${round2(tip)} 0 0 0 -${u} ${c}L-${s} ${o}A${round2(halfWidth)} ${round2(halfWidth)} 0 1 0 ${s} ${o}Z`;
}

/** Reads the pose values of one ray into its geometry and returns the path. */
function rayFor(geometry: SparkGeometry, index: number, values: Float32Array) {
  const at = 4 * index;
  const reach = Math.max(0, values[at]);
  const width = values[at + 1];
  const offset = values[at + 2];
  if (index % 2 === 0) {
    const ray = geometry.p;
    const inner = ray.r0 + offset;
    return rayPath(inner, inner + (ray.r1 - ray.r0) * reach, ray.a * width, ray.b * width);
  }
  const ray = geometry.s;
  const inner = ray.r0 + offset;
  if (ray.dot) {
    const half = ray.a * width * (0.72 + 0.28 * Math.min(1.3, reach));
    return rayPath(inner, inner, half, half);
  }
  return rayPath(inner, inner + (ray.r1 - ray.r0) * reach, ray.a * width, Math.min(ray.a, ray.b) * width);
}

function writeRay(out: Float32Array, index: number, reach: number, width: number, offset: number, opacity: number) {
  const at = 4 * index;
  out[at] = reach;
  out[at + 1] = width;
  out[at + 2] = offset;
  out[at + 3] = opacity;
}

/** Idle: a 6.4s breath of the whole mark while one diagonal at a time softly reaches out. */
function idlePose(twinkle: boolean): SparkPose {
  return {
    fill: (time, out) => {
      for (let index = 0; index < 8; index += 1) {
        if (index % 2 === 0) {
          writeRay(out, index, 1, 1, 0, 1);
          continue;
        }
        const reach = twinkle ? pulse(fract(time / 6.4 - (index - 1) / 8 + JITTER[index]), 0, 0.32) : 0;
        writeRay(out, index, 1 + 0.3 * reach, 1 + 0.08 * reach, reach, 1);
      }
      out[32] = twinkle ? 1 + 0.018 * wave(time / 6.4) : 1;
      out[33] = twinkle ? 1 + 0.1 * wave(time / 3.2) : 1;
      out[34] = 0;
    },
    spin: 0,
    rest: true,
    loops: twinkle,
  };
}

/** Thinking: one crest ripples around the ring every 1.9s while the mark turns at 26 degrees per second. */
const THINKING: SparkPose = {
  fill: (time, out) => {
    for (let index = 0; index < 8; index += 1) {
      const crest = wave(time / 1.9 - index / 8 + JITTER[index]) ** 1.35;
      if (index % 2 === 0) writeRay(out, index, 0.7 + 0.3 * crest, 0.94 + 0.08 * crest, -1 + 2 * crest, 1);
      else writeRay(out, index, 0.42 + 0.78 * crest, 0.88 + 0.16 * crest, -1 + 3 * crest, 0.5 + 0.5 * crest);
    }
    out[32] = 0.965 + 0.03 * wave(time / 4);
    out[33] = 0.7 + 0.22 * wave(time);
    out[34] = 0;
  },
  spin: 26,
  rest: false,
  loops: true,
};

/** Generating: a lub dub every 1.04s, axes firing in sequence and diagonals answering, at 46 degrees per second. */
const beat = (value: number) => pulse(value, 0, 0.2) + 0.62 * pulse(value, 0.2, 0.22);

const GENERATING: SparkPose = {
  fill: (time, out) => {
    for (let index = 0; index < 8; index += 1) {
      const pair = index >> 1;
      if (index % 2 === 0) {
        const hit = beat(fract(time / 1.04 - 0.045 * pair + 0.3 * JITTER[index]));
        writeRay(out, index, 0.7 + 0.32 * hit, 0.96 + 0.08 * hit, 0.8 * hit, 1);
      } else {
        const hit = beat(fract(time / 1.04 - 0.17 - 0.045 * pair + 0.3 * JITTER[index]));
        writeRay(out, index, 0.55 + 0.65 * hit, 0.92 + 0.12 * hit, 2.5 * hit, 0.6 + 0.4 * hit);
      }
    }
    const hit = beat(fract(time / 1.04));
    out[32] = 0.975 + 0.035 * hit;
    out[33] = 0.9 + 0.5 * beat(fract(time / 1.04 - 0.03));
    out[34] = 1;
  },
  spin: 46,
  rest: false,
  loops: true,
};

/** Done: every ray at rest, ready for the gather impulse to pull it in. */
const DONE: SparkPose = {
  fill: (_time, out) => {
    for (let index = 0; index < 8; index += 1) writeRay(out, index, 1, 1, 0, 1);
    out[32] = 1;
    out[33] = 1;
    out[34] = 0;
  },
  spin: 0,
  rest: true,
  loops: false,
};

/** Error: shorter rays, dimmer diagonals and no spin. */
const ERROR: SparkPose = {
  fill: (_time, out) => {
    for (let index = 0; index < 8; index += 1) {
      if (index % 2 === 0) writeRay(out, index, 0.56, 0.96, -1, 1);
      else writeRay(out, index, 0.34, 0.9, -2, 0.45);
    }
    out[32] = 0.96;
    out[33] = 0.8;
    out[34] = 0;
  },
  spin: 0,
  rest: true,
  loops: false,
};

const IDLE_TWINKLE = idlePose(true);
const IDLE_STILL = idlePose(false);

function poseFor(status: SparkStatus, twinkle: boolean): SparkPose {
  switch (status) {
    case "idle":
      return twinkle ? IDLE_TWINKLE : IDLE_STILL;
    case "thinking":
      return THINKING;
    case "generating":
      return GENERATING;
    case "done":
      return DONE;
    default:
      return ERROR;
  }
}

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Self-play: walks the cycle only while no status is given and the mark is not paused. */
function useSelfPlay(enabled: boolean): SparkStatus {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => setIndex((value) => (value + 1) % SELF_PLAY.length), SELF_PLAY[index][1]);
    return () => window.clearTimeout(id);
  }, [enabled, index]);
  return SELF_PLAY[index][0];
}

/** The pill label: the visible layer crossfades and rises, while the box eases to the new width. */
function Label({ text, busy, reduced }: { text: string; busy: boolean; reduced: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const restWidth = useRef(0);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const from = node.style.width ? node.getBoundingClientRect().width : restWidth.current;
    node.style.width = "";
    const to = node.getBoundingClientRect().width;
    restWidth.current = to;
    if (reduced || !from || Math.abs(from - to) < 0.5) return;
    const controls = animate(node, { width: [from, to] }, {
      type: "spring",
      visualDuration: 0.24,
      bounce: 0,
      onComplete: () => {
        node.style.width = "";
      },
    });
    return () => controls.stop();
  }, [text, reduced]);

  return (
    <span ref={box} className={styles.labelBox}>
      <span className={styles.sizer} aria-hidden="true">
        {text}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={styles.labelLayer}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.1 : 0.16, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: "easeOut" } }}
        >
          <TextShimmer active={busy}>{text}</TextShimmer>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * An animated spark mark that shows an AI at work: four tapered primary rays and four lighter
 * diagonal rays around a soft core. Each status is its own motion, and every change blends from the
 * current pose, so states never hard cut. Use `variant="pill"` for a status label or
 * `variant="avatar"` for a round tile.
 */
export function AiSpark({
  status,
  size,
  tone = "accent",
  color,
  variant = "mark",
  label,
  speed = 1,
  twinkle = true,
  paused = false,
  announce = true,
  "aria-label": ariaLabel,
  className,
  style,
}: AiSparkProps) {
  const selfPlayed = useSelfPlay(status === undefined && !paused);
  const activeStatus = status ?? selfPlayed;
  const isPill = variant === "pill";
  const isAvatar = variant === "avatar";

  const box = useRef<HTMLSpanElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const outer = useRef<SVGGElement>(null);
  const ring = useRef<SVGGElement>(null);
  const core = useRef<SVGCircleElement>(null);
  const rays = useRef<(SVGPathElement | null)[]>([]);
  const particles = useRef<(SVGCircleElement | null)[]>([]);
  const stateRef = useRef<SparkState | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  const sizeCss = size ?? (isPill ? 16 : isAvatar ? 32 : 24);
  const boxCss = typeof sizeCss === "number" ? `${sizeCss}px` : sizeCss;
  const markCss = isAvatar
    ? typeof sizeCss === "number"
      ? `${Math.round(0.56 * sizeCss)}px`
      : `calc(${sizeCss} * .56)`
    : boxCss;

  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(hydrated && prefersReduced);

  const hinted = typeof sizeCss === "number" ? (isAvatar ? Math.round(0.56 * sizeCss) : sizeCss) : null;

  // CSS length sizes cannot hint from a number, so the rendered svg is measured once it exists.
  useLayoutEffect(() => {
    if (hinted !== null) return;
    const node = svg.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = node.getBoundingClientRect().width;
      if (width > 0) setMeasured(Math.round(width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hinted]);

  const px = hinted ?? measured ?? 16;

  const geometry = useMemo<SparkGeometry>(() => {
    const hint = clamp01(Math.log(Math.max(1, px) / 12) / Math.log(8));
    const dot = px < 18;
    return {
      p: { r0: mix(11, 13.5, hint), r1: mix(41.5, 44, hint), a: mix(8.4, 5.6, hint), b: mix(3.9, 1.8, hint) },
      s: dot
        ? { r0: 27, r1: 27, a: mix(5.6, 5, clamp01((px - 12) / 6)), b: 0, dot }
        : { r0: mix(23.5, 22, hint), r1: mix(32, 36, hint), a: mix(4.9, 3.7, hint), b: mix(2.3, 1.4, hint), dot },
      core: px >= 28 ? mix(2.6, 3.4, hint) : 0,
      particles: px >= 40,
      toneB: mix(0.66, 0.5, hint),
    };
  }, [px]);

  const live = useRef({ geometry, speed, reduced, paused, twinkle });
  useLayoutEffect(() => {
    live.current = { geometry, speed, reduced, paused, twinkle };
  });

  const [initialStatus] = useState(activeStatus);
  const initial = useMemo(() => {
    const values = new Float32Array(35);
    poseFor(initialStatus, false).fill(0, values);
    return values;
  }, [initialStatus]);

  useEffect(() => {
    const state: SparkState = stateRef.current ?? {
      status: initialStatus,
      twinkle: live.current.twinkle,
      from: poseFor(initialStatus, live.current.twinkle),
      to: poseFor(initialStatus, live.current.twinkle),
      mixStart: 0,
      mixDur: 0,
      t: 0,
      clock: 0,
      angle: 0,
      vel: 0,
      target: null,
      glide: { start: 0, from: 0, v0: 0, distance: 0, duration: 0 },
      impulses: [],
      A: new Float32Array(35),
      B: new Float32Array(35),
      out: new Float32Array(35),
      raf: 0,
      last: 0,
      inView: true,
      kick: () => {},
    };
    stateRef.current = state;

    /** How far the blend from the previous pose has travelled, 0 to 1. */
    const blend = () => (state.mixDur <= 0 ? 1 : Math.min(1, (state.clock - state.mixStart) / state.mixDur));

    /** Writes the current pose straight to the DOM: eight paths, a core radius and two group transforms. */
    const draw = () => {
      const { geometry: geo, reduced: still } = live.current;
      const out = state.out;
      const progress = easeInOut(blend());
      if (progress >= 1) state.to.fill(still ? 0 : state.t, out);
      else {
        state.from.fill(still ? 0 : state.t, state.A);
        state.to.fill(still ? 0 : state.t, state.B);
        for (let index = 0; index < 35; index += 1) out[index] = state.A[index] + (state.B[index] - state.A[index]) * progress;
      }

      let shake = 0;
      let breath = out[32];
      let coreScale = out[33];

      if (!still)
        for (const impulse of state.impulses) {
          const elapsed = state.clock - impulse.start;
          if (impulse.kind === "shake") {
            shake +=
              elapsed < 0 || elapsed >= 0.46 ? 0 : 3.2 * Math.sin((TAU * elapsed) / 0.15) * (1 - elapsed / 0.46) ** 2;
            continue;
          }
          const gather =
            elapsed < 0 || elapsed >= 0.68
              ? 0
              : elapsed < 0.17
                ? 1 - Math.pow(1 - elapsed / 0.17, 3)
                : 1 - easeInOut((elapsed - 0.17) / 0.51);
          if (gather <= 0) continue;
          for (let index = 0; index < 8; index += 1) {
            const at = 4 * index;
            const primary = index % 2 === 0;
            out[at] *= 1 - (primary ? 0.12 : 0.2) * gather;
            out[at + 2] -= (primary ? 2.4 : 3) * gather;
          }
          breath *= 1 - 0.045 * gather;
          coreScale *= 1 + 0.35 * gather;
        }

      for (let index = 0; index < 8; index += 1) {
        const node = rays.current[index];
        if (!node) continue;
        node.setAttribute("d", rayFor(geo, index, out));
        node.setAttribute("opacity", out[4 * index + 3].toFixed(3));
      }
      core.current?.setAttribute("r", (geo.core * Math.max(0, coreScale)).toFixed(2));
      outer.current?.setAttribute("transform", `translate(${shake.toFixed(2)} 0) scale(${breath.toFixed(4)})`);
      ring.current?.setAttribute("transform", `rotate(${state.angle.toFixed(3)})`);

      // Two particles orbit just outside the rays, only on marks 40px and up.
      const strength = geo.particles && !still ? out[34] : 0;
      for (let index = 0; index < 2; index += 1) {
        const node = particles.current[index];
        if (!node) continue;
        if (strength < 0.01) {
          node.setAttribute("opacity", "0");
          continue;
        }
        const turn = index === 0 ? 30 + (360 * state.t) / 2.6 : 210 + (360 * state.t) / 3.9;
        const flicker = 0.55 + 0.45 * wave(state.t / 1.3 + 0.5 * index);
        node.setAttribute(
          "transform",
          `rotate(${(turn % 360).toFixed(2)}) translate(0 -47.5) scale(${(0.5 + 0.5 * strength).toFixed(3)})`,
        );
        node.setAttribute("opacity", (strength * flicker).toFixed(3));
      }
    };

    const frame = (now: number) => {
      const { speed: rate, reduced: still } = live.current;
      const delta = state.last ? Math.min(1 / 30, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      state.clock += delta;
      if (!still) state.t += delta * rate;

      if (blend() >= 1) state.from = state.to;
      state.impulses = state.impulses.filter((impulse) => state.clock - impulse.start < 0.7);

      if (still) {
        state.vel = 0;
        state.angle = 90 * Math.round(state.angle / 90);
      } else if (state.to.rest) {
        // Resting poses glide into the next quarter turn on a curve whose speed only falls.
        if (state.target === null) {
          const v0 = Math.max(0, state.vel);
          state.target = 90 * Math.ceil((state.angle + 0.2 * v0) / 90 - 1e-6);
          const distance = state.target - state.angle;
          state.glide = {
            start: state.clock,
            from: state.angle,
            v0,
            distance,
            duration: Math.min(1.8, Math.max(0.6, v0 > 0.5 ? (3 * distance) / v0 : 1.2)),
          };
        }
        const glide = state.glide;
        const elapsed = state.clock - glide.start;
        if (glide.distance < 0.01 || elapsed >= glide.duration) {
          state.angle = state.target;
          state.vel = 0;
        } else {
          const duration = glide.duration;
          const distance = glide.distance;
          const c2 = (3 * distance - 2 * glide.v0 * duration) / (duration * duration);
          const c3 = (glide.v0 * duration - 2 * distance) / (duration * duration * duration);
          state.angle = glide.from + glide.v0 * elapsed + c2 * elapsed * elapsed + c3 * elapsed * elapsed * elapsed;
          state.vel = glide.v0 + 2 * c2 * elapsed + 3 * c3 * elapsed * elapsed;
        }
      } else {
        state.target = null;
        state.vel += (state.to.spin * rate - state.vel) * (1 - Math.exp(-(3 * delta)));
        state.angle += state.vel * delta;
        if (state.angle >= 360) state.angle -= 360;
      }

      draw();

      const settled = still || (state.to.rest && state.target !== null && state.angle === state.target);
      if (blend() >= 1 && state.impulses.length === 0 && settled && (still || !state.to.loops)) {
        if (!still && state.target !== null) {
          state.angle = state.target % 360;
          state.target = state.angle;
          state.vel = 0;
          draw();
        }
        state.raf = 0;
        state.last = 0;
        return;
      }
      state.raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
      state.last = 0;
    };

    state.kick = () => {
      if (!state.inView || document.hidden || live.current.paused) stop();
      else if (!state.raf) {
        state.last = 0;
        state.raf = requestAnimationFrame(frame);
      }
    };

    const node = box.current;
    const observer =
      typeof IntersectionObserver !== "undefined" && node
        ? new IntersectionObserver(
            ([entry]) => {
              state.inView = entry.isIntersecting;
              state.kick();
            },
            { rootMargin: "48px" },
          )
        : null;
    if (observer && node) observer.observe(node);

    const onVisibility = () => state.kick();
    document.addEventListener("visibilitychange", onVisibility);
    state.kick();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [initialStatus]);

  // A status change blends from wherever the mark is, and queues the gather or shake gesture.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.status !== activeStatus || state.twinkle !== twinkle) {
      const progress = state.mixDur <= 0 ? 1 : Math.min(1, (state.clock - state.mixStart) / state.mixDur);
      const previousFrom = state.from;
      const previousTo = state.to;
      const eased = easeInOut(progress);
      state.from =
        progress < 1
          ? {
              fill: (time, out) => {
                previousFrom.fill(time, state.A);
                previousTo.fill(time, state.B);
                for (let index = 0; index < 35; index += 1) out[index] = state.A[index] + (state.B[index] - state.A[index]) * eased;
              },
              spin: previousTo.spin,
              rest: previousTo.rest,
              loops: previousFrom.loops || previousTo.loops,
            }
          : previousTo;
      state.to = poseFor(activeStatus, twinkle);
      state.mixStart = state.clock;
      state.mixDur = reduced ? 0.2 : activeStatus === "generating" ? 0.42 : activeStatus === "done" ? 0.5 : 0.56;
      if (state.status !== activeStatus) {
        state.target = null;
        if (!reduced && activeStatus === "done") state.impulses.push({ kind: "gather", start: state.clock });
        if (!reduced && activeStatus === "error") state.impulses.push({ kind: "shake", start: state.clock });
      }
      state.status = activeStatus;
      state.twinkle = twinkle;
    }
    state.kick();
  }, [activeStatus, twinkle, reduced]);

  const busy = activeStatus === "thinking" || activeStatus === "generating";
  const text = label ?? LABELS[activeStatus];
  const phrase = ariaLabel ?? (isPill ? undefined : PHRASES[activeStatus]);
  const rootStyle = {
    "--spark-color": color ?? TONE_COLORS[tone],
    ...(isAvatar ? { width: boxCss, height: boxCss } : null),
    ...style,
  } as CSSProperties;

  return (
    <span
      ref={box}
      className={[styles.root, isPill ? styles.pill : "", isAvatar ? styles.avatar : "", className].filter(Boolean).join(" ")}
      data-status={activeStatus}
      style={rootStyle}
      role={announce ? "status" : "img"}
      aria-live={announce ? "polite" : undefined}
      aria-busy={busy || undefined}
      aria-label={announce ? undefined : (phrase ?? text)}
    >
      <svg
        ref={svg}
        className={styles.mark}
        viewBox="-50 -50 100 100"
        width={markCss}
        height={markCss}
        aria-hidden="true"
        focusable="false"
        shapeRendering="geometricPrecision"
      >
        <g ref={outer}>
          <g ref={ring}>
            {Array.from({ length: 8 }, (_, index) => (
              <path
                key={index}
                ref={(node) => {
                  rays.current[index] = node;
                }}
                d={rayFor(geometry, index, initial)}
                opacity={initial[4 * index + 3]}
                transform={`rotate(${45 * index})`}
                fill="currentColor"
                fillOpacity={index % 2 === 0 ? 1 : geometry.toneB}
              />
            ))}
            <circle ref={core} r={geometry.core * initial[33]} fill="currentColor" fillOpacity={geometry.toneB} />
          </g>
          {[1.9, 1.3].map((radius, index) => (
            <circle
              key={radius}
              ref={(node) => {
                particles.current[index] = node;
              }}
              r={radius}
              opacity={0}
              fill="currentColor"
              fillOpacity={index === 0 ? 0.8 : geometry.toneB}
            />
          ))}
        </g>
      </svg>
      {isPill ? (
        <Label text={text} busy={busy} reduced={reduced} />
      ) : announce ? (
        <span className={styles.srOnly}>{phrase}</span>
      ) : null}
    </span>
  );
}

export default AiSpark;
