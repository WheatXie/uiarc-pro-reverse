"use client";

/**
 * Image trail — moving the pointer leaves a curated trail of photos that pop in, lean, and fade.
 *
 * A fixed pool of photo nodes is reused and animated with the Web Animations API, so a long trail
 * never grows the DOM and every frame runs on the compositor. Photos appear one per `spacing` px of
 * pointer travel, lean with the horizontal component of pointer velocity, and drift along the path
 * as they shrink and fade.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./image-trail.module.css";

export interface ImageTrailImage {
  src: string;
  alt?: string;
}

export interface ImageTrailProps {
  /** Photos shown in order along the trail. Pass small renditions; a photo is never shown larger than size. */
  images: readonly ImageTrailImage[];
  /** Content laid over the trail, such as a headline. Links and buttons inside stay clickable. */
  children?: ReactNode;
  /** Pointer travel between photos, in px. */
  spacing?: number;
  /** How long a photo stays before it fades, in ms. */
  lifetime?: number;
  /** Photo width in px. */
  size?: number;
  /** Photo width divided by height. */
  aspectRatio?: number;
  /** Largest lean in degrees at full pointer speed. */
  maxTilt?: number;
  /** How many photos can be on screen at once. */
  poolSize?: number;
  /** Plays one short S-curve sweep of photos the first time the area scrolls into view. */
  intro?: boolean;
  /** Stops new photos and gives touch scrolling back to the page. */
  disabled?: boolean;
  /** Extra class on the root. Give the root a height. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

interface Sample {
  t: number;
  x: number;
  y: number;
}

interface Track {
  next: number;
  image: number;
  z: number;
  drop: { x: number; y: number } | null;
  samples: Sample[];
  lastDrop: number;
  touch: number;
  touched: boolean;
}

interface Config {
  images: readonly ImageTrailImage[];
  spacing: number;
  lifetime: number;
  size: number;
  aspectRatio: number;
  maxTilt: number;
  disabled: boolean;
  reduced: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const noopSubscribe = () => () => {};

/** True only after hydration, so the server render and the first client render agree. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Builds the transform string used by every keyframe. */
const tf = (x: number, y: number, rotate: number, scale: number) =>
  `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rotate.toFixed(2)}deg) scale(${scale})`;

/** Enter curve: a slow pop that overshoots a touch around 60% of the entry. */
const ENTER_EASING =
  "linear(0, 0.0258, 0.09, 0.1763, 0.2732, 0.3724, 0.4683, 0.5573, 0.6376, 0.7082, 0.7689, 0.8202, 0.8628, 0.8976, 0.9256, 0.9476, 0.9648, 0.9778, 0.9875, 0.9945, 0.9994, 1.0026, 1.0047, 1.0058, 1.0062, 1.0062, 1.0059, 1.0055, 1.0049, 1.0043, 1.0036, 1.0031, 1.0025, 1.002, 1.0016, 1.0013, 1)";

/** An area that leaves a trail of photos behind the pointer. */
export function ImageTrail({
  images,
  children,
  spacing = 90,
  lifetime = 700,
  size = 168,
  aspectRatio = 4 / 5,
  maxTilt = 10,
  poolSize = 14,
  intro = false,
  disabled = false,
  className,
  style,
}: ImageTrailProps) {
  const hydrated = useHydrated();
  const reduced = Boolean(useReducedMotion()) && hydrated;

  const root = useRef<HTMLDivElement | null>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const track = useRef<Track>({
    next: 0,
    image: 0,
    z: 1,
    drop: null,
    samples: [],
    lastDrop: 0,
    touch: -1,
    touched: false,
  });
  const config = useRef<Config>({ images, spacing, lifetime, size, aspectRatio, maxTilt, disabled, reduced });

  /** Spawns one photo at the pointer and plays its entry → drift → fade timeline. */
  function spawn(x: number, y: number, vx: number, vy: number) {
    const { images: list, lifetime: hold, size: width, aspectRatio: ratio, maxTilt: tilt, reduced: calm } = config.current;
    const state = track.current;
    const total = Math.min(poolSize, nodes.current.length);
    const node = nodes.current[state.next % total];
    if (!node || !list.length) return;
    // Bumped before the jitter reads it, so each photo gets its own fixed offset.
    state.next += 1;

    const img = node.firstElementChild;
    const src = list[state.image % list.length].src;
    state.image += 1;
    if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);

    const height = width / ratio;
    const left = x - width / 2;
    const top = y - height / 2;

    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    node.style.zIndex = String(++state.z);
    for (const running of node.getAnimations()) running.cancel();

    const duration = 520 + hold + 560;

    if (calm) {
      node.animate(
        [
          { transform: tf(left, top, 0, 1), opacity: 0 },
          { transform: tf(left, top, 0, 1), opacity: 1, offset: 160 / duration },
          { transform: tf(left, top, 0, 1), opacity: 1, offset: (520 + hold) / duration },
          { transform: tf(left, top, 0, 1), opacity: 0 },
        ],
        { duration, fill: "both" },
      );
      return;
    }

    // A fixed counter, not randomness: the third channel of variation in the lean.
    const jitter = ((37 * state.next) % 5 - 2) * 0.9;
    const lean = clamp(7 * vx, -tilt, tilt) + jitter;
    const driftX = clamp(70 * vx, -48, 48);
    const driftY = clamp(70 * vy, -48, 48);

    node.animate(
      [
        {
          transform: tf(left - 0.15 * driftX, top - 0.15 * driftY, 0.4 * lean, 0.6),
          opacity: 0,
          easing: ENTER_EASING,
        },
        { transform: tf(left, top, lean, 1), opacity: 1, offset: 520 / duration },
        {
          transform: tf(left + 0.25 * driftX, top + 0.25 * driftY, lean, 1),
          opacity: 1,
          offset: (520 + hold) / duration,
          easing: "cubic-bezier(.22, 1, .36, 1)",
        },
        { transform: tf(left + driftX, top + driftY + 10, 1.25 * lean, 0.86), opacity: 0 },
      ],
      { duration, fill: "both" },
    );
  }

  /** Records a pointer sample and spawns a photo once the pointer has travelled far enough. */
  function drop(x: number, y: number, time: number) {
    const { spacing: gap, reduced: calm } = config.current;
    const state = track.current;

    state.samples.push({ t: time, x, y });
    while (state.samples.length > 2 && time - state.samples[0].t > 80) state.samples.shift();

    if (!state.drop) {
      state.drop = { x, y };
      return;
    }
    if (Math.hypot(x - state.drop.x, y - state.drop.y) < gap * (calm ? 1.6 : 1)) return;
    if (time - state.lastDrop < 40) return;

    const first = state.samples[0];
    const span = Math.max(1, time - first.t);
    spawn(x, y, (x - first.x) / span, (y - first.y) / span);

    state.drop = { x, y };
    state.lastDrop = time;
  }

  // The intro loop samples through a ref so the observer effect mounts once, not once per render.
  const dropRef = useRef(drop);
  dropRef.current = drop;

  function handleEnd(event: PointerEvent<HTMLDivElement>) {
    const state = track.current;
    if (event.pointerType === "touch" && event.pointerId === state.touch) state.touch = -1;
    if (event.type === "pointerleave" || event.pointerType === "touch") {
      state.drop = null;
      state.samples = [];
    }
  }

  useLayoutEffect(() => {
    config.current = { images, spacing, lifetime, size, aspectRatio, maxTilt, disabled, reduced };
  });

  useEffect(() => {
    for (const image of images) {
      const preload = new Image();
      preload.decoding = "async";
      preload.src = image.src;
    }
  }, [images]);

  useEffect(() => {
    const element = root.current;
    if (!intro || !element || typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (config.current.reduced || config.current.disabled || track.current.touched) return;

        const start = performance.now();
        const step = (now: number) => {
          const state = track.current;
          if (state.touched) {
            state.drop = null;
            state.samples = [];
            return;
          }
          const progress = Math.min(1, (now - start) / 1100);
          // Ease in over the first half, out over the second: an S-curve across the area.
          const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          dropRef.current(
            element.offsetWidth * (0.14 + 0.72 * eased),
            element.offsetHeight * (0.5 + 0.2 * Math.sin(eased * Math.PI * 2)),
            now,
          );
          if (progress < 1) frame = requestAnimationFrame(step);
          else {
            state.drop = null;
            state.samples = [];
          }
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [intro]);

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      data-disabled={disabled ? "" : undefined}
      onPointerMove={event => {
        if (config.current.disabled) return;
        const state = track.current;
        if (event.pointerType === "touch" && state.touch !== event.pointerId) return;
        state.touched = true;
        const rect = event.currentTarget.getBoundingClientRect();
        drop(event.clientX - rect.left, event.clientY - rect.top, event.timeStamp);
      }}
      onPointerDown={event => {
        if (event.pointerType !== "touch" || config.current.disabled) return;
        const state = track.current;
        state.touch = event.pointerId;
        state.drop = null;
        state.samples = [];
      }}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      onPointerLeave={handleEnd}
    >
      <div className={styles.trail} aria-hidden="true">
        {Array.from({ length: poolSize }, (_, index) => (
          <div
            key={index}
            className={styles.photo}
            ref={node => {
              nodes.current[index] = node;
            }}
          >
            <img alt="" draggable={false} decoding="async" />
          </div>
        ))}
      </div>
      {children && <div className={styles.content}>{children}</div>}
    </div>
  );
}

export default ImageTrail;
