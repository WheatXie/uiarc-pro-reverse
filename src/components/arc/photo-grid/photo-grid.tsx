"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, animate, LayoutGroup, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./photo-grid.module.css";

export interface PhotoGridPhoto {
  /** Stable id, used by favorites and by `onViewerChange`. */
  id: string;
  /** Full size source. */
  src: string;
  /** Optional responsive source list. */
  srcSet?: string;
  /** Described to assistive tech; the frame itself is decorative. */
  alt: string;
  /** Intrinsic width, keeps the tile from shifting while it loads. */
  width: number;
  /** Intrinsic height. */
  height: number;
  /** Caption shown in the viewer bar. */
  title: string;
  /** Small line under the title, such as the capture time. */
  detail?: string;
}

export interface PhotoGridProps {
  /** Photos in reading order; the grid derives its row count from this length and the column count. */
  photos: PhotoGridPhoto[];
  /** Name of the set, used by the header, the grid label and the viewer announcements. */
  title: string;
  /** Allowed photos per row, largest set first. Buttons and pinch steps walk this list. @default [5, 3, 2] */
  zoomLevels?: number[];
  /** Photos per row on first paint. Falls back to the middle level. @default 3 */
  defaultColumns?: number;
  /** Called with the next photos-per-row value. */
  onColumnsChange?: (columns: number) => void;
  /** Photo ids that start out favorited. */
  defaultFavorites?: string[];
  /** Called when a photo is favorited or unfavorited. */
  onFavoriteChange?: (id: string, favorite: boolean) => void;
  /** Called with the open photo id, or `null` when the viewer closes. */
  onViewerChange?: (id: string | null) => void;
  /** Extra class on the root. */
  className?: string;
}

type Phase = "closed" | "open" | "closing";
type Axis = "x" | "y" | null;

interface Flight {
  dx: number;
  dy: number;
  k: number;
  t: number;
  r: number;
  b: number;
  l: number;
}

const DEFAULT_LEVELS = [5, 3, 2];
const TILE_SIZES = "(max-width: 760px) 50vw, 360px";
const STRIP_GAP = 24;
const FLIGHT_NONE: Flight = { dx: 0, dy: 0, k: 1, t: 0, r: 0, b: 0, l: 0 };

const flickVelocity = (samples: { x: number; t: number }[], now: number) => {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > 80) return 0;
  let first = last;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (last.t - samples[index].t > 100) break;
    first = samples[index];
  }
  const dt = Math.max(1, last.t - first.t) / 1000;
  return (last.x - first.x) / dt;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const rubber = (value: number, size: number) => (1 - 1 / ((0.55 * value) / size + 1)) * size;
const easeOut = (value: number, size: number) => (1 - 1 / ((0.55 * value) / size + 1)) * size;
const stillness = (offset: number, size: number) => 1 - 0.42 * clamp(offset / Math.max(size, 1), 0, 1);
const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const springFrom = (duration: number, bounce = 0) => {
  const omega = (2 * Math.PI) / (1.2 * duration);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const SPRING_FLIGHT = springFrom(0.46);
const SPRING_POS = { ...motionTokens.spring.smooth, visualDuration: 0.34 };
const SPRING_SNAP = motionTokens.spring.snappy;
const SPRING_MORPH = motionTokens.spring.morph;
const EASE_ENTER: [number, number, number, number] = [...motionTokens.ease.enter];
const EASE_STANDARD: [number, number, number, number] = [...motionTokens.ease.standard];

/** Fit a photo inside the stage with a 24px inset, preserving its aspect ratio. */
function fitInStage(photo: PhotoGridPhoto, stageWidth: number, stageHeight: number) {
  const availableWidth = Math.max(stageWidth - 24, 1);
  const availableHeight = Math.max(stageHeight - 24, 1);
  const ratio = photo.width / photo.height;
  let width = availableWidth;
  let height = availableWidth / ratio;
  if (height > availableHeight) {
    height = availableHeight;
    width = availableHeight * ratio;
  }
  return { left: (stageWidth - width) / 2, top: (stageHeight - height) / 2, width, height };
}

/** Text swap used by the caption: the outgoing line blurs up, the incoming one blurs in. */
function Swap({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.swapText}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.fast } } : { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.soft}px)` }}
          transition={reduced ? { duration: motionTokens.duration.fast } : { duration: motionTokens.duration.standard, ease: EASE_ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Width morph: the wrapper animates to the measured width of the content it holds. */
function Morph({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const innerRef = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<string | number>("auto");
  const first = useRef(true);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const outer = inner?.parentElement;
    if (!inner || !outer) return;
    const measure = () => {
      const next = inner.offsetWidth;
      if (!next) return;
      if (first.current || reduced) {
        first.current = false;
        width.jump(next);
        return;
      }
      outer.dataset.morphing = "";
      animate(width, next, {
        ...SPRING_MORPH,
        onComplete: () => {
          delete outer.dataset.morphing;
        },
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [reduced, width]);

  return (
    <motion.span className={styles.morph} style={{ width }}>
      <span ref={innerRef} className={styles.morphInner}>
        {children}
      </span>
    </motion.span>
  );
}

/** Rolling digits: the old digit drops out as the new one rises. */
function Digit({ value, reduced }: { value: number; reduced: boolean }) {
  const digits = String(value).split("");
  return (
    <span className={styles.roll}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className={styles.place}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.62em", filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.fast } } : { opacity: 0, y: "-0.62em", filter: `blur(${motionTokens.blur.subtle}px)` }}
          transition={
            reduced
              ? { duration: motionTokens.duration.fast }
              : { ...SPRING_SNAP, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } }
          }
        >
          {digits.map((digit, digitIndex) => (
            <span key={`${value}-${digits.length - digitIndex}`} className={styles.digit}>
              {digit}
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The little grid glyph on the photos-per-row buttons. */
function ZoomGlyph({ columns }: { columns: number }) {
  const gap = columns > 2 ? 1 : 2;
  const size = (14 - gap * (columns - 1)) / columns;
  const cells = Array.from({ length: columns * columns }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { x: 1 + column * (size + gap), y: 1 + row * (size + gap) };
  });
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {cells.map(cell => (
        <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={size} height={size} rx={columns > 3 ? 0.5 : 1.25} />
      ))}
    </svg>
  );
}

/** The sharp overlay that fades in over the flight photo once the full size image decodes. */
function SharpLayer({ photo }: { photo: PhotoGridPhoto }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className={styles.sharp}
      src={photo.src}
      srcSet={photo.srcSet}
      sizes="(max-width: 760px) 100vw, 720px"
      alt=""
      draggable={false}
      decoding="async"
      data-loaded={loaded ? "" : undefined}
      onLoad={() => setLoaded(true)}
    />
  );
}

interface ThumbProps {
  photo: PhotoGridPhoto;
  index: number;
  pos: MotionValue<number>;
  widths: number[];
  stripWidth: MotionValue<number>;
}

function StripThumb({ photo, index, pos, widths, stripWidth }: ThumbProps) {
  const layout = () => {
    const current = pos.get();
    const lower = Math.floor(clamp(current, 0, widths.length - 1));
    const upper = Math.ceil(clamp(current, 0, widths.length - 1));
    const fraction = current - lower;
    const width = (i: number) => {
      const neighbor = Math.max(0, 1 - Math.abs(i - current));
      return 22 + (widths[i] - 22) * neighbor;
    };
    let start = 0;
    for (let i = 0; i < index; i += 1) start += width(i) + 4 * Math.max(0, 1 - Math.abs(i - current)) + 4;
    const center = (i: number) => {
      let offset = 0;
      for (let n = 0; n < i; n += 1) offset += width(n) + 4 * Math.max(0, 1 - Math.abs(n - current)) + 4;
      return offset + width(i) / 2;
    };
    const anchor = lerp(center(lower), center(upper), fraction);
    return {
      x: stripWidth.get() / 2 - anchor + start,
      width: width(index),
      clip: (widths[index] - width(index)) / 2,
      opacity: 1 - 0.5 * Math.min(1, Math.abs(index - current)),
    };
  };

  const x = useTransform(() => layout().x);
  const width = useTransform(() => layout().width);
  const clip = useTransform(() => `inset(0 ${layout().clip}px round 4px)`);
  const opacity = useTransform(() => layout().opacity);

  return (
    <motion.span className={styles.thumb} style={{ x, width, clipPath: clip, opacity }}>
      <img src={photo.src} srcSet={photo.srcSet} alt="" draggable={false} loading="lazy" />
    </motion.span>
  );
}

interface ViewerProps {
  photos: PhotoGridPhoto[];
  index: number;
  phase: Phase;
  reduced: boolean;
  title: string;
  favorites: Set<string>;
  onIndex: (index: number, velocity?: number) => void;
  onClose: (point?: { x: number; y: number }) => void;
  onToggleFavorite: () => void;
  flight: MotionValue<number>;
  geometry: MotionValue<Flight>;
  pos: MotionValue<number>;
  settled: MotionValue<number>;
  stride: MotionValue<number>;
  stageHeight: MotionValue<number>;
  stripWidth: MotionValue<number>;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  barOpacity: MotionValue<number>;
  viewerOpacity: MotionValue<number>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  stripRef: React.RefObject<HTMLDivElement | null>;
  closeRef: React.RefObject<HTMLButtonElement | null>;
}

function PhotoGridViewer({
  photos,
  index,
  phase,
  reduced,
  title,
  favorites,
  onIndex,
  onClose,
  onToggleFavorite,
  flight,
  geometry,
  pos,
  settled,
  stride,
  stageHeight,
  stripWidth,
  dragX,
  dragY,
  barOpacity,
  viewerOpacity,
  stageRef,
  stripRef,
  closeRef,
}: ViewerProps) {
  const [windowRange, setWindowRange] = useState<[number, number]>([0, 0]);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ id: number; x: number; y: number; start: number; axis: Axis; samples: { x: number; y: number; t: number }[] } | null>(null);
  const stripDragRef = useRef<{ id: number; x: number; start: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);
  const current = photos[index];
  const open = phase !== "closed";
  const favorite = favorites.has(current?.id ?? "");

  useEffect(() => {
    setWindowRange([Math.max(0, index - 1), Math.min(photos.length - 1, index + 1)]);
  }, [index, photos.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = { w: stage.clientWidth, h: stage.clientHeight };
      setStageSize(previous => (previous.w === next.w && previous.h === next.h ? previous : next));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef]);

  const barY = useTransform(() => -(1 - barOpacity.get()) * 8);
  const stripY = useTransform(() => (1 - barOpacity.get()) * 10);
  const trackX = useTransform(() => -pos.get() * stride.get());
  const backdropOpacity = useTransform(() =>
    clamp(flight.get(), 0, 1) * (1 - clamp(Math.abs(dragY.get()) / Math.max(0.5 * stageHeight.get(), 1), 0, 1)),
  );
  const frostOpacity = useTransform(() => Math.min(1, 2 * backdropOpacity.get()));

  const widths = photos.map(photo => clamp((40 * photo.width) / photo.height, 22, 72));

  const photoX = useTransform(
    () => (1 - flight.get()) * (geometry.get().dx - (settled.get() - pos.get()) * stride.get()) + dragX.get(),
  );
  const photoY = useTransform(() => (1 - flight.get()) * geometry.get().dy + dragY.get());
  const photoScale = useTransform(() => lerp(geometry.get().k, 1, flight.get()) * stillness(dragY.get(), stageHeight.get()));
  const photoClip = useTransform(() => {
    const geo = geometry.get();
    const progress = clamp(flight.get(), 0, 1);
    const radius = lerp(6 / Math.max(geo.k, 0.01), 14, progress);
    return `inset(${geo.t * (1 - progress)}px ${geo.r * (1 - progress)}px ${geo.b * (1 - progress)}px ${geo.l * (1 - progress)}px round ${radius}px)`;
  });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      onIndex(clamp(index + (event.key === "ArrowRight" ? 1 : -1), 0, photos.length - 1), event.key === "ArrowRight" ? 240 : -240);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      onIndex(event.key === "Home" ? 0 : photos.length - 1);
    }
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "open") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: pos.get(), axis: null, samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }] };
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    drag.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    if (drag.samples.length > 24) drag.samples.shift();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.axis === null && Math.hypot(dx, dy) > 6) drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (drag.axis === "x") {
      const limit = stride.get();
      const raw = drag.start - dx / limit;
      pos.set(raw < 0 ? -rubber(-raw, 1) * 0.12 : raw > photos.length - 1 ? photos.length - 1 + rubber(raw - photos.length + 1, 1) * 0.12 : raw);
    } else if (drag.axis === "y") {
      dragY.set(dy < 0 ? -easeOut(-dy, stageHeight.get()) : dy);
    }
  };

  const handleStagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    const last = drag.samples[drag.samples.length - 1];
    const first = drag.samples[0];
    const velocityX = ((last.x - first.x) / Math.max(1, last.t - first.t)) * 1000;
    const velocityY = ((last.y - first.y) / Math.max(1, last.t - first.t)) * 1000;
    if (drag.axis === "x") {
      const next = clamp(Math.round(pos.get() + (velocityX / 1000) * 0.24), 0, photos.length - 1);
      onIndex(next, velocityX);
      return;
    }
    if (drag.axis === "y" && dragY.get() + 0.18 * velocityY > Math.min(140, 0.22 * stageHeight.get()) && velocityY > -240) {
      onClose({ x: event.clientX, y: event.clientY });
      return;
    }
    dragY.set(0);
    onIndex(clamp(Math.round(pos.get()), 0, photos.length - 1));
  };

  const handleStripPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "open") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stripDragRef.current = { id: event.pointerId, x: event.clientX, start: pos.get(), moved: false, samples: [{ x: event.clientX, t: event.timeStamp }] };
  };

  const handleStripPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = stripDragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    drag.samples.push({ x: event.clientX, t: event.timeStamp });
    if (drag.samples.length > 24) drag.samples.shift();
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    pos.set(clamp(drag.start - dx / STRIP_GAP, 0, photos.length - 1));
    onIndex(clamp(Math.round(pos.get()), 0, photos.length - 1));
  };

  const handleStripPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = stripDragRef.current;
    stripDragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = event.clientX - rect.left - rect.width / 2;
      onIndex(clamp(Math.round(pos.get() + offset / 60), 0, photos.length - 1));
      return;
    }
    const velocity = flickVelocity(drag.samples, event.timeStamp);
    onIndex(clamp(Math.round(pos.get() + 0.12 * (-velocity / STRIP_GAP)), 0, photos.length - 1), velocity);
  };

  return (
    <motion.div
      className={styles.viewer}
      data-state={phase}
      role="dialog"
      aria-label="Photo viewer"
      aria-hidden={phase === "closed" ? true : undefined}
      tabIndex={-1}
      style={{ opacity: viewerOpacity }}
      onKeyDown={handleKeyDown}
    >
      <motion.div className={styles.frost} style={{ opacity: frostOpacity }} />
      <motion.div className={styles.backdrop} style={{ opacity: backdropOpacity }} />
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
      >
        <motion.div className={styles.track} style={{ x: trackX }}>
          {open
            ? photos.slice(windowRange[0], windowRange[1] + 1).map((photo, offset) => {
                const slideIndex = windowRange[0] + offset;
                const fit = fitInStage(photo, stageSize.w, stageSize.h);
                return (
                  <div
                    key={photo.id}
                    className={styles.slide}
                    style={{ left: `calc(${slideIndex} * (100% + ${STRIP_GAP}px))` }}
                    aria-hidden={slideIndex === index ? undefined : true}
                  >
                    <motion.div
                      className={styles.photo}
                      style={
                        slideIndex === index
                          ? { left: fit.left, top: fit.top, width: fit.width, height: fit.height, x: photoX, y: photoY, scale: photoScale, clipPath: photoClip }
                          : { left: fit.left, top: fit.top, width: fit.width, height: fit.height, x: 0, y: 0, scale: 1, clipPath: "inset(0px round 14px)" }
                      }
                    >
                      <img src={photo.src} srcSet={photo.srcSet} alt={slideIndex === index ? photo.alt : ""} decoding="sync" draggable={false} />
                      <SharpLayer photo={photo} />
                    </motion.div>
                  </div>
                );
              })
            : null}
        </motion.div>
      </div>
      <motion.div className={styles.bar} style={{ opacity: barOpacity, y: barY }}>
        <button ref={closeRef} type="button" className={styles.glass} aria-label="Back to all photos" onClick={() => onClose()}>
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className={styles.caption}>
          <span className={styles.captionTitle}>
            <Swap text={current?.title ?? ""} reduced={reduced} />
          </span>
          <span className={styles.captionMeta}>
            {current?.detail ? (
              <Morph reduced={reduced}>
                <Swap text={current.detail} reduced={reduced} />
              </Morph>
            ) : null}
            <span className={styles.counterPart}>
              <span aria-hidden="true">·</span>
              <span className={styles.counter}>
                <Morph reduced={reduced}>
                  <Digit value={index + 1} reduced={reduced} />
                </Morph>{" of "}
                {photos.length}
              </span>
            </span>
          </span>
        </div>
        <button type="button" className={styles.glass} aria-pressed={favorite} aria-label="Favorite" onClick={onToggleFavorite}>
          <motion.span
            className={styles.icon}
            initial={false}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={reduced ? { duration: 0 } : SPRING_SNAP}
          >
            <Heart size={20} strokeWidth={1.75} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
          </motion.span>
        </button>
      </motion.div>
      <motion.div className={styles.navs} style={{ opacity: barOpacity }}>
        <button
          type="button"
          className={cx(styles.glass, styles.nav)}
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={() => onIndex(index - 1, -240)}
        >
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cx(styles.glass, styles.nav)}
          aria-label="Next photo"
          disabled={index === photos.length - 1}
          onClick={() => onIndex(index + 1, 240)}
        >
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </motion.div>
      <motion.div
        ref={stripRef}
        className={styles.strip}
        role="slider"
        tabIndex={phase === "open" ? 0 : -1}
        aria-label="Photos"
        aria-orientation="horizontal"
        aria-valuemin={1}
        aria-valuemax={photos.length}
        aria-valuenow={index + 1}
        aria-valuetext={`${current?.title ?? title}, ${index + 1} of ${photos.length}`}
        style={{ opacity: barOpacity, y: stripY }}
        onPointerDown={handleStripPointerDown}
        onPointerMove={handleStripPointerMove}
        onPointerUp={handleStripPointerUp}
        onPointerCancel={handleStripPointerUp}
      >
        {open
          ? photos.map((photo, thumbIndex) => (
              <StripThumb
                key={photo.id}
                photo={photo}
                index={thumbIndex}
                pos={pos}
                widths={widths}
                stripWidth={stripWidth}
              />
            ))
          : null}
      </motion.div>
    </motion.div>
  );
}

export const PhotoGrid = forwardRef<HTMLDivElement, PhotoGridProps>(function PhotoGrid(
  {
    photos,
    title,
    zoomLevels = DEFAULT_LEVELS,
    defaultColumns = 3,
    onColumnsChange,
    defaultFavorites,
    onFavoriteChange,
    onViewerChange,
    className,
  },
  ref,
) {
  const id = useId();
  const reduced = Boolean(useReducedMotion());
  const levels = useMemo(() => [...new Set(zoomLevels)].filter(level => level > 0).sort((a, b) => b - a), [zoomLevels]);
  const [columns, setColumnsState] = useState(() =>
    levels.includes(defaultColumns) ? defaultColumns : (levels[Math.floor(levels.length / 2)] ?? 3),
  );
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(defaultFavorites ?? []));
  const [phase, setPhase] = useState<Phase>("closed");
  const [viewerIndex, setViewerIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [live, setLive] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const attachRoot = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const phaseRef = useRef<Phase>("closed");
  const columnsRef = useRef(columns);
  const pendingScroll = useRef<{ index: number; fraction: number; viewY: number } | null>(null);
  const restoreFocus = useRef(false);
  const pinch = useRef({ active: false, log: 0, x: 0, y: 0, distance: 0, timer: 0, wheelX: 0, wheelAt: 0, wheelLock: false });

  const flight = useMotionValue(0);
  const viewerOpacity = useMotionValue(1);
  const barOpacity = useMotionValue(0);
  const pos = useMotionValue(0);
  const settled = useMotionValue(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const stride = useMotionValue(0);
  const stageHeight = useMotionValue(0);
  const stripWidth = useMotionValue(0);
  const geometry = useMotionValue<Flight>(FLIGHT_NONE);
  const pinchScale = useMotionValue(1);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const announce = useCallback((message: string) => setLive(message), []);

  /** Column stride for a given count: the grid width split into columns with 3px gaps. */
  const strideFor = useCallback((count: number) => {
    const width = scrollerRef.current?.clientWidth ?? 0;
    return (width - (count - 1) * 3) / count;
  }, []);

  const anchorFor = useCallback((point?: { x: number; y: number }) => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    const rect = scroller.getBoundingClientRect();
    const headerHeight = headerRef.current?.offsetHeight ?? 60;
    const targetY = point ? point.y - rect.top : (rect.height + headerHeight) / 2;
    let best: { index: number; fraction: number; viewY: number } | null = null;
    let bestDistance = Infinity;
    tileRefs.current.forEach((tile, index) => {
      if (!tile) return;
      const box = tile.getBoundingClientRect();
      const viewY = box.top - rect.top;
      const distance = Math.abs(viewY + box.height / 2 - targetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { index, fraction: 0.5, viewY };
      }
    });
    return best;
  }, []);

  const setColumns = useCallback(
    (next: number, point?: { x: number; y: number }, flush = false) => {
      if (!levels.includes(next) || next === columnsRef.current) return;
      const anchor = anchorFor(point);
      if (anchor) pendingScroll.current = anchor;
      columnsRef.current = next;
      if (flush) flushSync(() => setColumnsState(next));
      else setColumnsState(next);
      onColumnsChange?.(next);
      announce(`${next} photos per row`);
    },
    [anchorFor, announce, levels, onColumnsChange],
  );

  const zoomStep = useCallback(
    (delta: number, point?: { x: number; y: number }) => {
      const current = levels.indexOf(columnsRef.current);
      const next = levels[current + delta];
      if (next === undefined) return;
      setColumns(next, point);
    },
    [levels, setColumns],
  );

  const flightFor = useCallback((index: number) => {
    const stage = stageRef.current;
    const tile = tileRefs.current[index];
    const scroller = scrollerRef.current;
    const photo = photos[index];
    if (!stage || !tile || !scroller || !photo) return FLIGHT_NONE;
    const stageBox = stage.getBoundingClientRect();
    const tileBox = tile.getBoundingClientRect();
    const scrollBox = scroller.getBoundingClientRect();
    const fit = fitInStage(photo, stageBox.width, stageBox.height);
    const scale = Math.max(tileBox.width / fit.width, tileBox.height / fit.height) || 1;
    const insetX = (fit.width - tileBox.width / scale) / 2;
    const insetY = (fit.height - tileBox.height / scale) / 2;
    return {
      dx: tileBox.left + tileBox.width / 2 - (stageBox.left + fit.left + fit.width / 2),
      dy: tileBox.top + tileBox.height / 2 - (stageBox.top + fit.top + fit.height / 2),
      k: scale,
      t: insetY + Math.max(0, scrollBox.top - tileBox.top) / scale,
      b: insetY + Math.max(0, tileBox.bottom - scrollBox.bottom) / scale,
      l: insetX + Math.max(0, scrollBox.left - tileBox.left) / scale,
      r: insetX + Math.max(0, tileBox.right - scrollBox.right) / scale,
    };
  }, [photos]);

  const goTo = useCallback(
    (next: number, velocity?: number) => {
      const clamped = clamp(next, 0, photos.length - 1);
      if (clamped === viewerIndex) {
        if (reduced) pos.jump(clamped);
        else animate(pos, clamped, { ...SPRING_POS, velocity });
        return;
      }
      setViewerIndex(clamped);
      settled.set(clamped);
      announce(`${photos[clamped]?.title ?? title}, ${clamped + 1} of ${photos.length}`);
      if (reduced) {
        pos.jump(clamped);
        return;
      }
      animate(pos, clamped, { ...SPRING_POS, velocity });
    },
    [announce, photos, pos, reduced, settled, title, viewerIndex],
  );

  const openViewer = useCallback(
    (index: number) => {
      const photo = photos[index];
      if (!photo) return;
      geometry.set(flightFor(index));
      pos.jump(index);
      settled.jump(index);
      dragX.jump(0);
      dragY.jump(0);
      setViewerIndex(index);
      setPhaseBoth("open");
      onViewerChange?.(photo.id);
      announce(`${photo.title}, ${index + 1} of ${photos.length}`);
      if (reduced) {
        flight.jump(1);
        barOpacity.jump(1);
      } else {
        flight.jump(0);
        animate(flight, 1, SPRING_FLIGHT);
        barOpacity.jump(0);
        animate(barOpacity, 1, { duration: motionTokens.duration.fast });
      }
      window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);
    },
    [announce, barOpacity, dragX, dragY, flight, flightFor, geometry, onViewerChange, photos, pos, reduced, setPhaseBoth, settled],
  );

  const closeViewer = useCallback(
    (point?: { x: number; y: number }) => {
      if (phaseRef.current !== "open") return;
      const index = clamp(Math.round(pos.get()), 0, photos.length - 1);
      restoreFocus.current = Boolean(rootRef.current?.contains(document.activeElement));
      if (flight.get() > 0.95) {
        const tile = tileRefs.current[index];
        const scroller = scrollerRef.current;
        if (tile && scroller) {
          const box = tile.getBoundingClientRect();
          const view = scroller.getBoundingClientRect();
          if (box.top < view.top + 60 || box.bottom > view.bottom) {
            scroller.scrollTop += box.top - view.top - 60;
          }
        }
      }
      geometry.set(flightFor(index));
      settled.set(index);
      pos.jump(index);
      setPhaseBoth("closing");
      onViewerChange?.(null);
      const finish = () => {
        flight.set(0);
        barOpacity.set(0);
        setPhaseBoth("closed");
      };
      if (reduced) {
        viewerOpacity.set(0);
        finish();
        return;
      }
      animate(barOpacity, 0, { duration: motionTokens.duration.instant });
      animate(dragX, 0, { ...SPRING_POS, velocity: point ? 0 : undefined });
      animate(dragY, 0, SPRING_POS);
      animate(flight, 0, { ...SPRING_FLIGHT, onComplete: finish });
    },
    [barOpacity, dragX, dragY, flight, flightFor, geometry, onViewerChange, photos.length, pos, reduced, setPhaseBoth, settled, viewerOpacity],
  );

  const toggleFavorite = useCallback(() => {
    const photo = photos[viewerIndex];
    if (!photo) return;
    setFavorites(previous => {
      const next = new Set(previous);
      const nowFavorite = !next.has(photo.id);
      if (nowFavorite) next.add(photo.id);
      else next.delete(photo.id);
      onFavoriteChange?.(photo.id, nowFavorite);
      announce(nowFavorite ? `Added ${photo.title} to favorites` : `Removed ${photo.title} from favorites`);
      return next;
    });
  }, [announce, onFavoriteChange, photos, viewerIndex]);

  // Keep the column mirror and the grid scale in sync with the runtime values.
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const apply = (value: number) => {
      grid.style.transform = value === 1 ? "" : `scale(${value})`;
    };
    apply(pinchScale.get());
    return pinchScale.on("change", apply);
  }, [pinchScale]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    const strip = stripRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      stride.set(scroller.clientWidth + 24);
      if (stage) stageHeight.set(stage.clientHeight);
      if (strip) stripWidth.set(strip.clientWidth);
    });
    observer.observe(scroller);
    if (stage) observer.observe(stage);
    if (strip) observer.observe(strip);
    return () => observer.disconnect();
  }, [stageHeight, stride, stripWidth]);

  // Restore the scroll anchor after a column change so the photo under the pointer stays put.
  useLayoutEffect(() => {
    pinchScale.jump(1);
    const pending = pendingScroll.current;
    if (!pending) return;
    pendingScroll.current = null;
    const scroller = scrollerRef.current;
    const tile = tileRefs.current[pending.index];
    const grid = gridRef.current;
    if (!scroller || !tile || !grid) return;
    const headerHeight = headerRef.current?.offsetHeight ?? 60;
    const target = tile.offsetTop + grid.offsetTop + pending.fraction * tile.offsetHeight - Math.max(pending.viewY, headerHeight);
    scroller.scrollTop = clamp(target, 0, scroller.scrollHeight - scroller.clientHeight);
  }, [columns, pinchScale]);

  useEffect(() => {
    if (phase === "open") closeRef.current?.focus({ preventScroll: true });
    if (phase === "closed" && restoreFocus.current) {
      restoreFocus.current = false;
      tileRefs.current[viewerIndex]?.focus({ preventScroll: true });
    }
  }, [phase, viewerIndex]);

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      const tile = tileRefs.current[focusedIndex];
      const box = tile?.getBoundingClientRect();
      zoomStep(1, box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      const tile = tileRefs.current[focusedIndex];
      const box = tile?.getBoundingClientRect();
      zoomStep(-1, box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
      return;
    }
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
      Home: -Infinity,
      End: Infinity,
      PageDown: 3 * columns,
      PageUp: -3 * columns,
    };
    const delta = map[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = clamp(delta === -Infinity ? 0 : delta === Infinity ? photos.length - 1 : focusedIndex + delta, 0, photos.length - 1);
    setFocusedIndex(next);
    tileRefs.current[next]?.focus({ preventScroll: true });
  };

  // Pinch / ctrl-wheel zoom, plus horizontal scrub while the viewer is open.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = pinch.current;

    const endPinch = () => {
      if (!state.active) return;
      state.active = false;
      state.log = 0;
      state.distance = 0;
      animate(pinchScale, 1, reduced ? { duration: 0 } : SPRING_SNAP);
    };

    const onWheel = (event: WheelEvent) => {
      if (phaseRef.current !== "closed") {
        if (event.ctrlKey) return;
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        const now = performance.now();
        if (now - state.wheelAt > 180) state.wheelX = 0;
        state.wheelAt = now;
        state.wheelX += event.deltaX;
        if (Math.abs(state.wheelX) > 36 && !state.wheelLock) {
          state.wheelLock = true;
          goTo(clamp(Math.round(pos.get()) + Math.sign(state.wheelX), 0, photos.length - 1), state.wheelX);
        }
        if (now - state.wheelAt > 180) state.wheelLock = false;
        return;
      }
      if (!event.ctrlKey) return;
      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? 400 : 1;
      const delta = -event.deltaY * multiplier;
      if (Math.abs(delta) >= 40) {
        zoomStep(delta > 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
        return;
      }
      state.log += clamp(0.012 * delta, -0.4, 0.4);
      pinchScale.set(Math.exp(clamp(state.log, -0.2, 0.2)));
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(endPinch, 160);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      state.active = true;
      state.log = 0;
      state.distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      state.x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      state.y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !state.active) return;
      event.preventDefault();
      const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      if (!state.distance) state.distance = distance;
      state.log += Math.log(distance / state.distance);
      state.distance = distance;
      pinchScale.set(clamp(Math.exp(clamp(state.log, -0.2, 0.2)), 0.8, 1.25));
      if (state.log >= 0.22) {
        state.log = 0;
        zoomStep(1, { x: state.x, y: state.y });
      } else if (state.log <= -0.22) {
        state.log = 0;
        zoomStep(-1, { x: state.x, y: state.y });
      }
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(endPinch, 200);
    };
    const onTouchEnd = () => endPinch();
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      state.active = true;
      state.log = 0;
    };
    const onGestureChange = (event: Event) => {
      const detail = (event as unknown as { scale: number }).scale;
      pinchScale.set(clamp(detail, 0.8, 1.25));
    };
    const onGestureEnd = () => endPinch();

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("gesturestart", onGestureStart);
    root.addEventListener("gesturechange", onGestureChange);
    root.addEventListener("gestureend", onGestureEnd);
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("gesturestart", onGestureStart);
      root.removeEventListener("gesturechange", onGestureChange);
      root.removeEventListener("gestureend", onGestureEnd);
    };
  }, [goTo, photos.length, pinchScale, pos, reduced, zoomStep]);

  const open = phase !== "closed";

  return (
    <div ref={attachRoot} className={cx(styles.root, className)} data-phase={phase}>
      <LayoutGroup id={id}>
        <header ref={headerRef} className={styles.header} data-scrolled={scrolled ? "" : undefined} inert={open}>
          <div className={styles.heading}>
            <p className={styles.title}>{title}</p>
            <p className={styles.subtitle}>
              <span>{photos.length} photos</span>
              <span className={styles.favoriteCount} aria-label={`${favorites.size} favorites`}>
                <Heart size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                <Morph reduced={reduced}>
                  <Digit value={favorites.size} reduced={reduced} />
                </Morph>
              </span>
            </p>
          </div>
          <div className={styles.zoom} role="group" aria-label="Zoom">
            {levels.map(level => (
              <button
                key={level}
                type="button"
                className={styles.zoomButton}
                aria-pressed={level === columns}
                aria-label={`${level} photos per row`}
                title={`${level} per row`}
                onClick={() => setColumns(level)}
              >
                {level === columns ? (
                  <motion.span
                    className={styles.zoomSelection}
                    layoutId="zoom-selection"
                    layoutDependency={columns}
                    transition={reduced ? { duration: 0 } : SPRING_MORPH}
                  />
                ) : null}
                <ZoomGlyph columns={level} />
              </button>
            ))}
          </div>
        </header>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          inert={open}
          onScroll={event => setScrolled(event.currentTarget.scrollTop > 2)}
        >
          <ul
            ref={gridRef}
            className={styles.grid}
            style={{ "--columns": columns } as CSSProperties}
            aria-label={`${title}, ${photos.length} photos`}
            onKeyDown={handleGridKeyDown}
          >
            {photos.map((photo, index) => {
              const favorite = favorites.has(photo.id);
              return (
                <li key={photo.id} className={styles.cell}>
                  <motion.button
                    ref={node => {
                      tileRefs.current[index] = node;
                    }}
                    type="button"
                    layout
                    layoutDependency={columns}
                    transition={{ layout: reduced ? { duration: 0 } : motionTokens.spring.smooth }}
                    className={styles.tile}
                    style={{ borderRadius: 6 }}
                    tabIndex={index === focusedIndex ? 0 : -1}
                    aria-label={favorite ? `${photo.alt}, favorite` : photo.alt}
                    data-hidden={phase !== "closed" && index === viewerIndex ? "" : undefined}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => openViewer(index)}
                  >
                    <img
                      src={photo.src}
                      srcSet={photo.srcSet}
                      sizes={TILE_SIZES}
                      alt=""
                      width={photo.width}
                      height={photo.height}
                      draggable={false}
                      decoding="async"
                    />
                    <AnimatePresence initial={false}>
                      {favorite ? (
                        <motion.span
                          key="badge"
                          className={styles.badge}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: `blur(${motionTokens.blur.subtle}px)` }}
                          transition={reduced ? { duration: 0 } : SPRING_SNAP}
                        >
                          <Heart size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </div>
        <PhotoGridViewer
          photos={photos}
          index={viewerIndex}
          phase={phase}
          reduced={reduced}
          title={title}
          favorites={favorites}
          onIndex={goTo}
          onClose={closeViewer}
          onToggleFavorite={toggleFavorite}
          flight={flight}
          geometry={geometry}
          pos={pos}
          settled={settled}
          stride={stride}
          stageHeight={stageHeight}
          stripWidth={stripWidth}
          dragX={dragX}
          dragY={dragY}
          barOpacity={barOpacity}
          viewerOpacity={viewerOpacity}
          stageRef={stageRef}
          stripRef={stripRef}
          closeRef={closeRef}
        />
        <p className={styles.srOnly} role="status" aria-live="polite">
          {live}
        </p>
      </LayoutGroup>
    </div>
  );
});

PhotoGrid.displayName = "PhotoGrid";

export default PhotoGrid;
