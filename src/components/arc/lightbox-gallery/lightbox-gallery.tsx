"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./lightbox-gallery.module.css";

const { spring, duration, ease } = motionTokens;
const ENTER = [...ease.enter] as [number, number, number, number];
const STANDARD = [...ease.standard] as [number, number, number, number];

/** A spring expressed the way the shipped code writes it: settle time plus bounce. */
function settleSpring(visualDuration: number, bounce: number): Transition {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
}

/** Opening and return flights: 0.44 s and 0.4 s, critically damped. */
const FLIGHT = settleSpring(0.44, 0);
const RETURN = settleSpring(0.4, 0);
const SLIDE = settleSpring(spring.smooth.visualDuration, spring.smooth.bounce);
const SNAP = settleSpring(spring.snappy.visualDuration, spring.snappy.bounce);

/** Responsive sizes hint for the grid and the stage. */
const SIZES = "(min-width: 900px) 260px, (min-width: 600px) 34vw, 50vw";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Rubber band: follows the pointer at first, then approaches `dimension` (iOS-style resistance). */
const rubber = (distance: number, dimension: number, coefficient = 0.55) => (distance * dimension * coefficient) / (dimension + coefficient * Math.abs(distance));
/** Wheel deltas are reported in lines (1) or pages (2) as well as pixels. */
const wheelDelta = (delta: number, mode: number, dimension: number) => (mode === 1 ? 16 * delta : mode === 2 ? delta * dimension : delta);

export interface LightboxImage {
  /** Image URL. */
  src: string;
  /** Intrinsic width, which sets the aspect ratio in the grid, zoom, and return flight. */
  width: number;
  /** Intrinsic height. */
  height: number;
  /** Alternative text, also read in the viewer. */
  alt: string;
  /** First caption line. */
  title?: string;
  /** Second caption line. */
  caption?: string;
}

export interface LightboxGalleryProps {
  /** Photos in reading order. width and height are the intrinsic size. */
  images: LightboxImage[];
  /** Columns are added while each stays at least this wide, in px. There are always at least two. Defaults to 150. */
  minColumnWidth?: number;
  /** Gap between photos in px. Defaults to 8. */
  gap?: number;
  /** Accessible name of the gallery and its viewer. Defaults to "Photo gallery". */
  label?: string;
  /** Class on the root region. */
  className?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Viewport {
  w: number;
  h: number;
}

/** Chrome around the stage: a top bar for the counter and a bottom band for captions and thumbs. */
function viewportMetrics({ w, h }: Viewport) {
  const compact = w < 640;
  const top = compact ? 56 : 64;
  const bottom = compact ? 128 : 140;
  return { top, bottom, pad: compact ? 12 : 72, stage: Math.max(120, h - top - bottom) };
}

/** Where a photo sits when it fits the stage. */
function fitRect(image: LightboxImage, viewport: Viewport): Rect {
  const metrics = viewportMetrics(viewport);
  const scale = Math.min((viewport.w - 2 * metrics.pad) / image.width, (metrics.stage - 16) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, left: (viewport.w - width) / 2, top: metrics.top + (metrics.stage - height) / 2 };
}

/** The pan range for a zoomed photo, or 0..0 when it already fits. */
function panBounds(frame: Rect, zoom: number, viewport: Viewport) {
  const halfWidth = (frame.width * zoom) / 2;
  const halfHeight = (frame.height * zoom) / 2;
  const centerX = frame.left + frame.width / 2;
  const centerY = frame.top + frame.height / 2;
  const xs = [viewport.w - centerX - halfWidth, halfWidth - centerX];
  const ys = [viewport.h - centerY - halfHeight, halfHeight - centerY];
  return {
    minX: xs[0] > xs[1] ? 0 : xs[0],
    maxX: xs[0] > xs[1] ? 0 : xs[1],
    minY: ys[0] > ys[1] ? 0 : ys[0],
    maxY: ys[0] > ys[1] ? 0 : ys[1],
  };
}

/**
 * A masonry grid of photos that open in a fullscreen viewer. The tapped photo zooms out of its grid slot and flies
 * back to the slot of whichever photo is showing when the viewer closes.
 */
export function LightboxGallery({ images, minColumnWidth = 150, gap = 8, label = "Photo gallery", className }: LightboxGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const [columns, setColumns] = useState(3);
  const [viewer, setViewer] = useState<{ start: number; from: Rect | null } | null>(null);
  const [current, setCurrent] = useState(0);

  // Column count follows the gallery's own width, never the viewport.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setColumns(Math.max(2, Math.floor((entry.contentRect.width + gap) / (minColumnWidth + gap))));
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [gap, minColumnWidth]);

  // Masonry: each photo goes to the currently shortest column, in reading order.
  const layout = useMemo(() => {
    const lanes = Array.from({ length: columns }, () => ({ height: 0, items: [] as number[] }));
    images.forEach((image, index) => {
      const target = lanes.reduce((best, lane) => (lane.height < best.height - 0.01 ? lane : best), lanes[0]);
      target.items.push(index);
      target.height += image.height / image.width;
    });
    return lanes.map(lane => lane.items);
  }, [images, columns]);

  const getThumb = useCallback((index: number) => thumbs.current[index] ?? null, []);
  const handleClosed = useCallback((index: number) => {
    setViewer(null);
    thumbs.current[index]?.focus({ preventScroll: true });
  }, []);

  return <div ref={rootRef} className={className ? `${styles.root} ${className}` : styles.root} role="region" aria-label={label}>
    <div className={styles.grid} style={{ gap }}>
      {layout.map((lane, column) => <div className={styles.column} style={{ gap }} key={column}>
        {lane.map(index => {
          const image = images[index];
          return <button
            key={image.src}
            ref={element => { thumbs.current[index] = element; }}
            type="button"
            className={styles.thumb}
            data-hidden={viewer && current === index ? "" : undefined}
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
            aria-label={`Open ${image.title ?? image.alt}, photo ${index + 1} of ${images.length}`}
            onClick={() => {
              const rect = thumbs.current[index]?.getBoundingClientRect();
              setCurrent(index);
              setViewer({
                start: index,
                from: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
              });
            }}
          >
            <ArcImage src={image.src} alt="" width={image.width} height={image.height} sizes={SIZES} draggable={false} className={styles.thumbImage} />
          </button>;
        })}
      </div>)}
    </div>
    {viewer && <LightboxViewer
      images={images}
      start={viewer.start}
      from={viewer.from}
      label={label}
      getThumb={getThumb}
      onIndexChange={setCurrent}
      onClosed={handleClosed}
    />}
  </div>;
}

type Gesture =
  | { mode: "idle" }
  | { mode: "pinch"; distance: number; zoom: number; midX: number; midY: number; panX: number; panY: number }
  | { mode: "pending"; id: number; x: number; y: number; baseStrip: number; basePanX: number; basePanY: number; grabX: number; grabY: number; onImage: boolean; history: Sample[] }
  | { mode: "swipe" | "dismiss" | "pan"; id: number; x: number; y: number; baseStrip: number; basePanX: number; basePanY: number; grabX: number; grabY: number; onImage: boolean; history: Sample[] };

interface Sample {
  x: number;
  y: number;
  t: number;
}

interface ViewerProps {
  images: LightboxImage[];
  start: number;
  from: Rect | null;
  label: string;
  getThumb: (index: number) => HTMLButtonElement | null;
  onIndexChange: (index: number) => void;
  onClosed: (index: number) => void;
}

function LightboxViewer({ images, start, from, label, getThumb, onIndexChange, onClosed }: ViewerProps) {
  const reduced = !!useReducedMotion();
  const titleId = useId();
  const [viewport, setViewport] = useState<Viewport>(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [closing, setClosing] = useState(false);
  const indexRef = useRef(start);
  const viewportRef = useRef(viewport);
  const closingRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>({ mode: "idle" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);

  const stripX = useMotionValue(-start * viewport.w);
  const heroX = useMotionValue(0);
  const heroY = useMotionValue(0);
  const heroScale = useMotionValue(1);
  const heroOpacity = useMotionValue(1);
  const zoomScale = useMotionValue(1);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const veil = useMotionValue(0);
  const chrome = useTransform(veil, [0.6, 1], [0, 1]);
  // The corner radius shrinks as the photo zooms so it stays 12 px on screen.
  const radius = useTransform(() => `${12 / Math.max(0.05, zoomScale.get() * heroScale.get())}px`);

  useMotionValueEvent(heroScale, "change", value => setZoomed(value > 1.01));

  const frameOf = useCallback((target: number) => fitRect(images[target], viewportRef.current), [images]);

  // Entrance: fly out of the grid slot, or fade in when there is no slot or motion is reduced.
  useLayoutEffect(() => {
    const frame = fitRect(images[start], viewportRef.current);
    if (reduced || !from) {
      heroOpacity.jump(0);
      animate(heroOpacity, 1, { duration: duration.standard, ease: ENTER });
    } else {
      heroX.jump(from.left - frame.left);
      heroY.jump(from.top - frame.top);
      heroScale.jump(from.width / frame.width);
      animate(heroX, 0, FLIGHT);
      animate(heroY, 0, FLIGHT);
      animate(heroScale, 1, FLIGHT);
    }
    animate(veil, 1, { duration: reduced ? duration.standard : 0.34, ease: ENTER });
    closeRef.current?.focus({ preventScroll: true });
    // The flight runs once, from the slot it was opened from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock the page behind the viewer and re-measure when the window changes.
  useEffect(() => {
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    const previous = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    const measure = () => {
      const next = { w: window.innerWidth, h: window.innerHeight };
      viewportRef.current = next;
      stripX.jump(-indexRef.current * next.w);
      heroScale.jump(1);
      panX.jump(0);
      panY.jump(0);
      setViewport(next);
    };
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      html.style.overflow = previous.overflow;
      html.style.paddingRight = previous.paddingRight;
    };
  }, [stripX, heroScale, panX, panY]);

  const settleZoom = useCallback(() => {
    heroScale.stop();
    panX.stop();
    panY.stop();
  }, [heroScale, panX, panY]);

  /** Flings the photo inside its pan range after a drag. */
  const panWithMomentum = useCallback((velocity: { x: number; y: number }) => {
    const limits = panBounds(frameOf(indexRef.current), heroScale.get(), viewportRef.current);
    if (reduced) {
      animate(panX, clamp(panX.get(), limits.minX, limits.maxX), { duration: duration.fast, ease: STANDARD });
      animate(panY, clamp(panY.get(), limits.minY, limits.maxY), { duration: duration.fast, ease: STANDARD });
      return;
    }
    const inertia = { type: "inertia" as const, power: 0.7, timeConstant: 300, bounceStiffness: 320, bounceDamping: 36, restDelta: 0.5 };
    animate(panX, panX.get(), { ...inertia, velocity: velocity.x, min: limits.minX, max: limits.maxX });
    animate(panY, panY.get(), { ...inertia, velocity: velocity.y, min: limits.minY, max: limits.maxY });
  }, [frameOf, panX, panY, reduced, heroScale]);

  /** Drops zoom and pan back to the fitted photo. */
  const resetZoom = useCallback((instant?: boolean) => {
    if (!instant || reduced) {
      zoomScale.jump(1);
      panX.jump(0);
      panY.jump(0);
      return;
    }
    animate(zoomScale, 1, SNAP);
    animate(panX, 0, SNAP);
    animate(panY, 0, SNAP);
  }, [reduced, zoomScale, panX, panY]);

  /** Moves to another photo, carrying the flick's momentum into the slide spring. */
  const goTo = useCallback((target: number, velocity = 0) => {
    if (closingRef.current) return;
    const width = viewportRef.current.w;
    const previous = indexRef.current;
    const next = clamp(target, 0, images.length - 1);
    if (next !== previous) {
      resetZoom(false);
      // A jump of more than one photo lands without sliding through the photos between.
      if (Math.abs(next - previous) > 1) stripX.jump(-(next - Math.sign(next - previous)) * width + (stripX.get() + previous * width));
      indexRef.current = next;
      setIndex(next);
      onIndexChange(next);
    }
    if (reduced) stripX.jump(-next * width);
    else animate(stripX, -next * width, { ...SLIDE, velocity });
  }, [images.length, onIndexChange, reduced, resetZoom, stripX]);

  /** Closes: flies back into the slot of the photo currently showing when it is still on screen. */
  const close = useCallback((velocity?: { x: number; y: number }) => {
    if (closingRef.current) return;
    const flick = velocity ?? { x: heroX.getVelocity(), y: heroY.getVelocity() };
    closingRef.current = true;
    setClosing(true);
    const currentIndex = indexRef.current;
    const measured = viewportRef.current;
    const frame = fitRect(images[currentIndex], measured);
    const thumb = getThumb(currentIndex);
    thumb?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const slot = thumb?.getBoundingClientRect();
    const visible = !!slot && slot.width > 0 && slot.bottom > 0 && slot.top < measured.h && slot.right > 0 && slot.left < measured.w;
    const done = () => onClosed(currentIndex);
    animate(veil, 0, { duration: reduced ? duration.standard : 0.3, ease: STANDARD });
    if (reduced || !visible || !slot) {
      resetZoom(true);
      stripX.jump(-currentIndex * measured.w);
      void animate(heroOpacity, 0, { duration: duration.exit, ease: STANDARD }).then(done);
      return;
    }
    resetZoom(true);
    animate(stripX, -currentIndex * measured.w, RETURN);
    animate(heroX, slot.left - frame.left, { ...RETURN, velocity: flick.x });
    animate(heroY, slot.top - frame.top, { ...RETURN, velocity: flick.y });
    void animate(heroScale, slot.width / frame.width, { ...RETURN, velocity: heroScale.getVelocity() }).then(done);
  }, [getThumb, heroOpacity, heroScale, heroX, heroY, images, onClosed, reduced, resetZoom, stripX, veil]);

  /** Zooms around a point, keeping the pixel under the pointer in place. */
  const zoomAround = useCallback((px: number, py: number, target: number, animated: boolean) => {
    const frame = frameOf(indexRef.current);
    const current = heroScale.get();
    const centerX = frame.left + frame.width / 2;
    const centerY = frame.top + frame.height / 2;
    const next = clamp(target, 1, 4);
    const limits = panBounds(frame, next, viewportRef.current);
    const x = clamp(px - centerX - (px - centerX - panX.get()) * (next / current), limits.minX, limits.maxX);
    const y = clamp(py - centerY - (py - centerY - panY.get()) * (next / current), limits.minY, limits.maxY);
    if (animated && !reduced) {
      animate(heroScale, next, SNAP);
      animate(panX, x, SNAP);
      animate(panY, y, SNAP);
    } else {
      heroScale.jump(next);
      panX.jump(x);
      panY.jump(y);
    }
  }, [frameOf, panX, panY, reduced, heroScale]);

  /** Double click (or the zoom button): in to fit the stage at 2–4×, or back out. */
  const toggleZoom = useCallback((px?: number, py?: number) => {
    const frame = frameOf(indexRef.current);
    if (heroScale.get() > 1.01) {
      resetZoom(true);
      return;
    }
    const measured = viewportRef.current;
    const cover = Math.max(measured.w / frame.width, measured.h / frame.height);
    zoomAround(px ?? frame.left + frame.width / 2, py ?? frame.top + frame.height / 2, clamp(cover, 2, 4), true);
  }, [frameOf, resetZoom, zoomAround, heroScale]);

  // Wheel and trackpad gestures: Ctrl/⌘ + wheel zooms, a horizontal swipe changes photo, zoomed wheel pans.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const swipe: { travel: number; locked: boolean; timer: number } = { travel: 0, locked: false, timer: 0 };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (closingRef.current) return;
      const measured = viewportRef.current;
      const dx = wheelDelta(event.deltaX, event.deltaMode, measured.w);
      const dy = wheelDelta(event.deltaY, event.deltaMode, measured.h);
      if (event.ctrlKey) {
        settleZoom();
        zoomAround(event.clientX, event.clientY, heroScale.get() * Math.exp(-(0.012 * clamp(dy, -50, 50))), false);
        return;
      }
      if (heroScale.get() <= 1.01) {
        window.clearTimeout(swipe.timer);
        swipe.timer = window.setTimeout(() => {
          swipe.travel = 0;
          swipe.locked = false;
        }, 160);
        if (!swipe.locked && Math.abs(dx) > Math.abs(dy)) {
          swipe.travel += dx;
          if (Math.abs(swipe.travel) >= 70) {
            swipe.locked = true;
            goTo(indexRef.current + Math.sign(swipe.travel));
          }
        }
        return;
      }
      settleZoom();
      const limits = panBounds(frameOf(indexRef.current), heroScale.get(), measured);
      panX.jump(clamp(panX.get() - dx, limits.minX, limits.maxX));
      panY.jump(clamp(panY.get() - dy, limits.minY, limits.maxY));
    };
    let pinchZoom = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      settleZoom();
      pinchZoom = heroScale.get();
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (closingRef.current) return;
      const scale = (event as Event & { scale: number }).scale;
      zoomAround((event as Event & { clientX: number }).clientX, (event as Event & { clientY: number }).clientY, pinchZoom * scale, false);
    };
    const onGestureEnd = (event: Event) => event.preventDefault();
    overlay.addEventListener("wheel", onWheel, { passive: false });
    overlay.addEventListener("gesturestart", onGestureStart);
    overlay.addEventListener("gesturechange", onGestureChange);
    overlay.addEventListener("gestureend", onGestureEnd);
    return () => {
      window.clearTimeout(swipe.timer);
      overlay.removeEventListener("wheel", onWheel);
      overlay.removeEventListener("gesturestart", onGestureStart);
      overlay.removeEventListener("gesturechange", onGestureChange);
      overlay.removeEventListener("gestureend", onGestureEnd);
    };
  }, [frameOf, goTo, panX, panY, settleZoom, zoomAround, heroScale]);

  /** Whether a point falls on the photo itself rather than the empty stage around it. */
  const onPhoto = (x: number, y: number) => {
    const box = heroRef.current?.getBoundingClientRect();
    return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  };

  /** Recent pointer velocity, in px/s, or zero when the pointer rested before release. */
  const velocityOf = (history: Sample[]) => {
    const last = history[history.length - 1];
    if (!last || performance.now() - last.t > 60) return { x: 0, y: 0 };
    let first = last;
    for (let cursor = history.length - 1; cursor >= 0 && last.t - history[cursor].t <= 80; cursor -= 1) first = history[cursor];
    const seconds = (last.t - first.t) / 1000;
    return seconds > 0 ? { x: (last.x - first.x) / seconds, y: (last.y - first.y) / seconds } : { x: 0, y: 0 };
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) overlayRef.current?.removeAttribute("data-panning");
    const state = gesture.current;
    const measured = viewportRef.current;
    if (state.mode === "pinch") {
      const zoom = heroScale.get();
      if (zoom < 0.86 && event.type !== "pointercancel") {
        pointers.current.clear();
        gesture.current = { mode: "idle" };
        close();
        return;
      }
      if (zoom < 1) animate(veil, 1, { duration: duration.fast, ease: ENTER });
      const frame = frameOf(indexRef.current);
      const remaining = [...pointers.current.entries()][0];
      if (remaining && zoom > 1.01) {
        const [id, point] = remaining;
        gesture.current = {
          mode: "pan", id, x: point.x, y: point.y,
          baseStrip: stripX.get(), basePanX: panX.get(), basePanY: panY.get(),
          grabX: 0.5, grabY: 0.5, onImage: true,
          history: [{ ...point, t: performance.now() }],
        };
      } else gesture.current = { mode: "idle" };
      if (remaining && zoom > 1.01 && zoom <= 4) return;
      if (zoom <= 1.02) {
        resetZoom(true);
        return;
      }
      const snapped = clamp(zoom, 1, 4);
      const limits = panBounds(frame, snapped, measured);
      animate(heroScale, snapped, SNAP);
      animate(panX, clamp(panX.get(), limits.minX, limits.maxX), SNAP);
      animate(panY, clamp(panY.get(), limits.minY, limits.maxY), SNAP);
      return;
    }
    if (state.mode === "idle" || event.pointerId !== state.id) return;
    gesture.current = { mode: "idle" };
    const velocity = velocityOf(state.history);
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (state.mode === "pending") {
      if (event.type === "pointercancel") return;
      if (!state.onImage) {
        close();
        return;
      }
      if (event.pointerType === "mouse") return;
      const now = performance.now();
      const previous = lastTap.current;
      if (previous && now - previous.t < 300 && Math.hypot(previous.x - event.clientX, previous.y - event.clientY) < 30) {
        lastTap.current = null;
        toggleZoom(event.clientX, event.clientY);
      } else lastTap.current = { x: event.clientX, y: event.clientY, t: now };
      return;
    }
    if (state.mode === "swipe") {
      const projected = dx + ((value: number, friction = 0.995) => ((value / 1000) * friction) / (1 - friction))(velocity.x);
      const flicked = Math.abs(velocity.x) > 450 && Math.sign(velocity.x) === Math.sign(dx) ? -Math.sign(velocity.x) : 0;
      const step = projected < -0.3 * measured.w ? 1 : projected > 0.3 * measured.w ? -1 : flicked;
      goTo(indexRef.current + step, velocity.x);
      return;
    }
    if (state.mode === "dismiss") {
      if (dy > 0 && (velocity.y > 500 || (dy > 110 && velocity.y > -150))) {
        close(velocity);
        return;
      }
      const transition = reduced ? { duration: duration.fast, ease: STANDARD } : null;
      animate(heroX, 0, transition ?? { ...SNAP, velocity: velocity.x });
      animate(heroY, 0, transition ?? { ...SNAP, velocity: velocity.y });
      animate(heroScale, 1, transition ?? SNAP);
      animate(veil, 1, { duration: duration.standard, ease: ENTER });
      return;
    }
    if (state.mode === "pan") panWithMomentum(velocity);
  };

  // The thumbnail strip keeps the current photo centred.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector(`[data-index="${index}"]`);
    if (!strip || !active) return;
    const image = images[index];
    const thumbWidth = clamp((48 * image.width) / image.height, 36, 72);
    strip.scrollTo({
      left: (active as HTMLElement).offsetLeft + thumbWidth / 2 - strip.clientWidth / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [images, index, reduced]);

  const metrics = viewportMetrics(viewport);
  const active = images[index];
  const slides = [index - 1, index, index + 1].filter(target => target >= 0 && target < images.length);

  return createPortal(<div
    ref={overlayRef}
    className={styles.overlay}
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    data-closing={closing || undefined}
    data-zoomed={zoomed || undefined}
    onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(indexRef.current + 1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(indexRef.current - 1);
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const frame = frameOf(indexRef.current);
        zoomAround(frame.left + frame.width / 2, frame.top + frame.height / 2, heroScale.get() * 1.5, true);
        return;
      }
      if (event.key === "-") {
        event.preventDefault();
        const frame = frameOf(indexRef.current);
        zoomAround(frame.left + frame.width / 2, frame.top + frame.height / 2, heroScale.get() / 1.5, true);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        resetZoom(true);
        return;
      }
      if (event.key === "Tab") {
        const controls = [...(overlayRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }}
  >
    <motion.div className={styles.veil} style={{ opacity: veil }} aria-hidden="true" />
    <div
      className={styles.stage}
      onPointerDown={event => {
        if (closingRef.current || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          animate(stripX, -indexRef.current * viewportRef.current.w, SNAP);
          animate(heroX, 0, SNAP);
          animate(heroY, 0, SNAP);
          animate(heroScale, 1, SNAP);
          animate(veil, 1, { duration: duration.fast });
          settleZoom();
          gesture.current = {
            mode: "pinch",
            distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
            zoom: heroScale.get(),
            midX: (a.x + b.x) / 2,
            midY: (a.y + b.y) / 2,
            panX: panX.get(),
            panY: panY.get(),
          };
          return;
        }
        if (pointers.current.size > 2) return;
        stripX.stop();
        panX.stop();
        panY.stop();
        if (heroScale.get() > 1.01) heroScale.stop();
        const frame = frameOf(indexRef.current);
        gesture.current = {
          mode: "pending",
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          baseStrip: stripX.get(),
          basePanX: panX.get(),
          basePanY: panY.get(),
          grabX: clamp((event.clientX - frame.left) / frame.width, 0, 1),
          grabY: clamp((event.clientY - frame.top) / frame.height, 0, 1),
          onImage: onPhoto(event.clientX, event.clientY),
          history: [{ x: event.clientX, y: event.clientY, t: performance.now() }],
        };
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const state = gesture.current;
        const measured = viewportRef.current;
        if (state.mode === "pinch") {
          if (pointers.current.size < 2) return;
          const [a, b] = [...pointers.current.values()];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const raw = (state.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / state.distance;
          const next = raw < 1 ? 1 - rubber(1 - raw, 1, 0.4) : raw > 4 ? 4 + rubber(raw - 4, 4, 0.4) : raw;
          const frame = frameOf(indexRef.current);
          const centerX = frame.left + frame.width / 2;
          const centerY = frame.top + frame.height / 2;
          heroScale.set(next);
          veil.set(next < 1 ? clamp(1 - (1 - next) * 4, 0.25, 1) : 1);
          panX.set(state.midX - centerX - (state.midX - centerX - state.panX) * (next / state.zoom) + (midX - state.midX));
          panY.set(state.midY - centerY - (state.midY - centerY - state.panY) * (next / state.zoom) + (midY - state.midY));
          return;
        }
        if (state.mode === "idle" || event.pointerId !== state.id) return;
        state.history.push({ x: event.clientX, y: event.clientY, t: performance.now() });
        if (state.history.length > 12) state.history.shift();
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        let mode: "pending" | "swipe" | "dismiss" | "pan" = state.mode;
        if (mode === "pending") {
          if (Math.hypot(dx, dy) < 6) return;
          mode = heroScale.get() > 1.01 ? "pan" : Math.abs(dx) > Math.abs(dy) ? "swipe" : "dismiss";
          gesture.current = { ...state, mode };
          if (mode === "pan") overlayRef.current?.setAttribute("data-panning", "");
        }
        if (mode === "swipe") {
          const end = -(images.length - 1) * measured.w;
          const next = state.baseStrip + dx;
          stripX.set(next > 0 ? rubber(next, measured.w) : next < end ? end + rubber(next - end, measured.w) : next);
        } else if (mode === "dismiss") {
          const progress = clamp(Math.max(0, dy) / (0.6 * measured.h), 0, 1);
          const scale = 1 - 0.4 * progress;
          const frame = frameOf(indexRef.current);
          heroScale.set(scale);
          heroX.set(dx + (1 - scale) * frame.width * state.grabX);
          heroY.set((dy < 0 ? -rubber(-dy, measured.h, 0.35) : dy) + (1 - scale) * frame.height * state.grabY);
          veil.set(1 - 0.85 * progress);
        } else if (mode === "pan") {
          const limits = panBounds(frameOf(indexRef.current), heroScale.get(), measured);
          const resist = (value: number, min: number, max: number, dimension: number) =>
            value < min ? min - rubber(min - value, dimension) : value > max ? max + rubber(value - max, dimension) : value;
          panX.set(resist(state.basePanX + dx, limits.minX, limits.maxX, measured.w));
          panY.set(resist(state.basePanY + dy, limits.minY, limits.maxY, measured.h));
        }
      }}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={event => {
        if (!closingRef.current && onPhoto(event.clientX, event.clientY)) toggleZoom(event.clientX, event.clientY);
      }}
    >
      <motion.div className={styles.strip} style={{ x: stripX }}>
        {slides.map(target => {
          const frame = fitRect(images[target], viewport);
          const isActive = target === index;
          return <div
            key={images[target].src}
            className={styles.slide}
            style={{ left: target * viewport.w, width: viewport.w, height: viewport.h }}
            aria-hidden={!isActive || undefined}
          >
            <Slide
              image={images[target]}
              frame={frame}
              active={isActive}
              imageRef={isActive ? heroRef : undefined}
              hero={isActive ? { x: heroX, y: heroY, scale: heroScale, opacity: heroOpacity } : null}
              zoom={isActive ? { scale: zoomScale, x: panX, y: panY, radius } : null}
            />
          </div>;
        })}
      </motion.div>
    </div>

    <motion.div className={styles.topBar} style={{ opacity: chrome, height: metrics.top }}>
      <p className={styles.counter} aria-live="polite">
        <span className={styles.num}>{index + 1}</span> of <span className={styles.num}>{images.length}</span>
      </p>
      <h2 id={titleId} className={styles.srOnly}>{label}: {active.title ?? active.alt}</h2>
      <div className={styles.actions}>
        <button type="button" className={styles.iconButton} onClick={() => toggleZoom()} aria-label={zoomed ? "Zoom out" : "Zoom in"} aria-pressed={zoomed}>
          {zoomed ? <ZoomOut size={20} strokeWidth={1.75} aria-hidden="true" /> : <ZoomIn size={20} strokeWidth={1.75} aria-hidden="true" />}
        </button>
        <button ref={closeRef} type="button" className={styles.iconButton} onClick={() => close()} aria-label="Close viewer">
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </motion.div>

    <motion.div className={styles.sideNav} style={{ opacity: chrome }}>
      <button type="button" className={styles.navButton} data-side="prev" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" className={styles.navButton} data-side="next" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} aria-label="Next photo">
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </motion.div>

    <motion.div className={styles.bottom} style={{ opacity: chrome, height: metrics.bottom }}>
      <div className={styles.captions}>
        <AnimatePresence initial={false}>
          <motion.div
            key={index}
            className={styles.caption}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: duration.fast } }}
            transition={reduced ? { duration: duration.fast } : { duration: duration.standard, ease: ENTER, delay: 0.04 }}
          >
            {active.title && <p className={styles.captionTitle}>{active.title}</p>}
            {active.caption && <p className={styles.captionText}>{active.caption}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div ref={stripRef} className={styles.thumbStrip} role="group" aria-label="All photos">
        {images.map((image, target) => {
          const width = clamp((48 * image.width) / image.height, 36, 72);
          return <button
            key={image.src}
            type="button"
            data-index={target}
            className={styles.stripThumb}
            data-active={target === index || undefined}
            style={{ width: target === index ? width : 36 }}
            onClick={() => goTo(target)}
            aria-label={`Show ${image.title ?? image.alt}`}
            aria-current={target === index ? "true" : undefined}
          >
            <ArcImage src={image.src} alt="" width={image.width} height={image.height} sizes="80px" draggable={false} />
          </button>;
        })}
      </div>
    </motion.div>
  </div>, document.body);
}

interface SlideProps {
  image: LightboxImage;
  frame: Rect;
  active: boolean;
  hero: { x: MotionValue<number>; y: MotionValue<number>; scale: MotionValue<number>; opacity: MotionValue<number> } | null;
  zoom: { scale: MotionValue<number>; x: MotionValue<number>; y: MotionValue<number>; radius: MotionValue<string> } | null;
  imageRef?: React.RefObject<HTMLDivElement | null>;
}

/** One photo: a low-res layer that is always there, and the real image that fades in over it. */
function Slide({ image, frame, active, hero, zoom, imageRef }: SlideProps) {
  const [loaded, setLoaded] = useState(false);
  return <motion.div className={styles.frame} style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, ...(hero ?? {}) }}>
    <motion.div ref={imageRef} className={styles.zoom} style={zoom ?? { borderRadius: 12 }}>
      <ArcImage src={image.src} alt="" width={image.width} height={image.height} sizes={SIZES} draggable={false} className={styles.layer} />
      <ArcImage
        src={image.src}
        alt={active ? image.alt : ""}
        width={image.width}
        height={image.height}
        sizes="100vw"
        draggable={false}
        className={styles.layer}
        data-loaded={loaded || undefined}
        onLoad={() => setLoaded(true)}
        loading={active ? "eager" : "lazy"}
      />
    </motion.div>
  </motion.div>;
}

export default LightboxGallery;
