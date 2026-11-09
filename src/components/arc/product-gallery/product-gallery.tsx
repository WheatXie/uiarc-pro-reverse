"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { MotionValue, Variants } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Maximize2, RotateCcw, ShoppingBag, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./product-gallery.module.css";

export interface ProductGalleryImage {
  src: string;
  alt: string;
  srcSet?: string;
}

export interface ProductGalleryColor {
  /** Stable id for this colorway; it is what `color`, `defaultColor` and `onColorChange` speak. */
  value: string;
  /** Shown in the Color row, such as Oat. */
  label: string;
  /** Any CSS color used to paint the swatch chip. */
  swatch: string;
  /** Photos for this colorway. The track crossfades when the color changes. */
  images: ProductGalleryImage[];
  /** Marks the whole colorway as unavailable. */
  soldOut?: boolean;
}

export interface ProductGallerySize {
  /** Stable id for this size; it is what `size`, `defaultSize` and `onSizeChange` speak. */
  value: string;
  /** Button text, such as Queen. */
  label: string;
  /** `true` hides the size everywhere; a list of color values marks it sold out in those colorways only. */
  soldOut?: boolean | string[];
}

export interface ProductGalleryProps {
  /** Colorways, each with its own photo set. The first one is selected by default. */
  colors: ProductGalleryColor[];
  /** Optional size row. Sold out combinations are skipped by the roving tabindex. */
  sizes?: ProductGallerySize[];
  /** Controlled color value. */
  color?: string;
  /** Initial color when uncontrolled. @default colors[0].value */
  defaultColor?: string;
  /** Called with the next color value. */
  onColorChange?: (color: string) => void;
  /** Controlled size value, or `null` for no selection. */
  size?: string | null;
  /** Initial size when uncontrolled. @default null */
  defaultSize?: string | null;
  /** Called with the next size value, or `null` when the active size is toggled off. */
  onSizeChange?: (size: string | null) => void;
  /** Controlled photo index inside the active colorway. */
  index?: number;
  /** Initial photo index when uncontrolled. @default 0 */
  defaultIndex?: number;
  /** Called with the next photo index. */
  onIndexChange?: (index: number) => void;
  /** Magnifier magnification while the pointer is over the photo. @default 2.4 */
  zoom?: number;
  /** Turns the hover lens off; clicking the photo still opens the viewer. @default true */
  magnifier?: boolean;
  /** Stage width divided by height, also used by the thumbs. @default 0.8 */
  aspectRatio?: number;
  /** Accessible name of the photo group and the viewer dialog. @default "Product photos" */
  label?: string;
  /** Replaces the built in title, price and copy block. */
  header?: ReactNode;
  /** Rendered under the size row. */
  footer?: ReactNode;
  /** Extra class on the root. */
  className?: string;
}

interface Origin {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  ratio: number;
}

interface IndicatorState {
  x: MotionValue<number>;
  y: MotionValue<number>;
  width: MotionValue<number>;
  height: MotionValue<number>;
  opacity: MotionValue<number>;
}

const EASE_ENTER: [number, number, number, number] = [...motionTokens.ease.enter];
const EASE_STANDARD: [number, number, number, number] = [...motionTokens.ease.standard];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Damped tail used past the ends of the track and the rails. */
const rubberBand = (value: number, size: number, resistance = 0.55) =>
  (value * size * resistance) / (size + resistance * Math.abs(value));

/** Springs are described the way the Arc source describes them: settle time plus bounce. */
const springFrom = (duration: number, bounce = 0) => {
  const omega = (2 * Math.PI) / (1.2 * duration);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const SPRING_TRACK = springFrom(0.42);
const SPRING_INDICATOR = springFrom(0.34);
const SPRING_VIEWER_REST = springFrom(0.46);
const SPRING_VIEWER_BACK = springFrom(0.4);
const SPRING_ZOOM = springFrom(0.42);

const POP_IN = { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.soft}px)` };
const POP_OUT = { opacity: 1, y: 0, filter: "blur(0px)" };
const POP_UP = { opacity: 0, y: -8, filter: `blur(${motionTokens.blur.soft}px)` };
const POP_TRANSITION = { duration: motionTokens.duration.standard, ease: EASE_ENTER };

const subscribeMount = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

/** `true` when a size cannot be bought in the given colorway. */
export function isSoldOut(size: ProductGallerySize, color: string): boolean {
  return size.soldOut === true || (Array.isArray(size.soldOut) && size.soldOut.includes(color));
}

function useControllable<T>(controlled: T | undefined, initial: T, onChange?: (value: T) => void) {
  const [internal, setInternal] = useState(initial);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : internal;
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [value, setValue] as const;
}

function GalleryImage({ image, className, eager }: { image: ProductGalleryImage; className: string; eager?: boolean }) {
  return (
    <img
      className={className}
      src={image.src}
      srcSet={image.srcSet}
      alt={image.alt}
      draggable={false}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
    />
  );
}

/**
 * Slides the highlight ring, the swatch ring and the size fill from the currently active
 * `[data-active]` element, springing on change and jumping on first paint or with reduced motion.
 */
function useActiveIndicator(containerRef: RefObject<HTMLElement | null>, selector: string, dep: string, reduced: boolean): IndicatorState {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const opacity = useMotionValue(0);
  const firstRun = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`${selector}[data-active]`);
    const measure = () => {
      const active = container.querySelector<HTMLElement>(`${selector}[data-active]`);
      if (!active) {
        animate(opacity, 0, { duration: motionTokens.duration.fast });
        return;
      }
      const next = {
        x: active.offsetLeft,
        y: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      };
      const jump = firstRun.current || reduced || opacity.get() < 0.05;
      firstRun.current = false;
      if (jump) {
        x.jump(next.x);
        y.jump(next.y);
        width.jump(next.width);
        height.jump(next.height);
        opacity.jump(1);
        return;
      }
      animate(x, next.x, SPRING_INDICATOR);
      animate(y, next.y, SPRING_INDICATOR);
      animate(width, next.width, SPRING_INDICATOR);
      animate(height, next.height, SPRING_INDICATOR);
      animate(opacity, 1, { duration: motionTokens.duration.fast });
    };
    measure();
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(target);
    return () => observer.disconnect();
    // `target` is re-queried inside measure, so the dep string is what re-runs the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, selector, dep, reduced, x, y, width, height, opacity]);

  return { x, y, width, height, opacity };
}

interface RovingOptions {
  total: number;
  index: number;
  select: (next: number) => void;
  skip?: (index: number) => boolean;
}

/** Arrow keys, Home and End for a roving tabindex group; wraps and honours disabled entries. */
function handleRovingKey(event: ReactKeyboardEvent<HTMLElement>, { total, index, select, skip }: RovingOptions) {
  const keys: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
    Home: -Infinity,
    End: Infinity,
  };
  const delta = keys[event.key];
  if (delta === undefined) return;
  event.preventDefault();
  if (total < 1) return;
  let next = delta === -Infinity ? 0 : delta === Infinity ? total - 1 : (index + delta + total) % total;
  let guard = 0;
  while (skip?.(next) && guard < total) {
    next = (next + (delta < 0 ? -1 : 1) + total) % total;
    guard += 1;
  }
  if (skip?.(next)) return;
  select(next);
  const group = event.currentTarget;
  const options = group.querySelectorAll<HTMLElement>("[data-option]");
  options[next]?.focus();
}

function fitBox(ratio: number, viewportWidth: number, viewportHeight: number) {
  const topBar = viewportWidth < 640 ? 56 : 64;
  const available = viewportHeight - topBar - 72 - 8;
  const width = Math.min(viewportWidth - 2 * (viewportWidth < 640 ? 12 : 48), available * ratio);
  const height = width / ratio;
  return { left: (viewportWidth - width) / 2, top: topBar + (available - height) / 2, width, height };
}

interface ViewerProps {
  images: ProductGalleryImage[];
  index: number;
  origin: Origin;
  zoom: number;
  reduced: boolean;
  label: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}

interface DragState {
  id: number;
  x: number;
  y: number;
  time: number;
  panX: number;
  panY: number;
  moved: boolean;
}

function GalleryViewer({ images, index, origin, zoom, reduced, label, onIndex, onClose }: ViewerProps) {
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const box = useMemo(() => fitBox(origin.ratio, viewport.w, viewport.h), [origin.ratio, viewport]);
  const flight = useMemo(() => {
    const scale = origin.width / box.width;
    return {
      x: origin.left + origin.width / 2 - (box.left + box.width / 2),
      y: origin.top + origin.height / 2 - (box.top + box.height / 2),
      scale,
      borderRadius: origin.radius / scale,
    };
  }, [box, origin]);

  const frameRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [direction, setDirection] = useState(1);
  const scale = useMotionValue(1);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const springX = useSpring(panX, { stiffness: 260, damping: 34 });
  const springY = useSpring(panY, { stiffness: 260, damping: 34 });
  const photo = images[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
      restore?.focus({ preventScroll: true });
    };
  }, []);

  const panLimit = useCallback((value: number, size: number) => clamp(value, -((zoom - 1) * size) / 2, ((zoom - 1) * size) / 2), [zoom]);

  const panTo = useCallback(
    (pointX: number, pointY: number) => {
      panX.set(panLimit(-(pointX - (box.left + box.width / 2)) * (zoom - 1), box.width));
      panY.set(panLimit(-(pointY - (box.top + box.height / 2)) * (zoom - 1), box.height));
    },
    [box, panLimit, panX, panY, zoom],
  );

  const applyZoom = useCallback(
    (next: boolean, point?: { x: number; y: number }) => {
      setZoomed(next);
      if (next && point) panTo(point.x, point.y);
      if (!next) {
        panX.set(0);
        panY.set(0);
      }
      if (reduced) scale.set(next ? zoom : 1);
      else animate(scale, next ? zoom : 1, SPRING_ZOOM);
    },
    [panTo, panX, panY, reduced, scale, zoom],
  );

  const step = useCallback(
    (delta: number) => {
      const next = clamp(index + delta, 0, images.length - 1);
      if (next === index) return;
      setDirection(delta);
      onIndex(next);
    },
    [images.length, index, onIndex],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (zoomed) applyZoom(false);
      else onClose();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (zoomed) applyZoom(false);
      step(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = viewerRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
      panX: panX.get(),
      panY: panY.get(),
      moved: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (zoomed && drag.moved) {
      panX.set(panLimit(drag.panX + dx, box.width));
      panY.set(panLimit(drag.panY + dy, box.height));
      springX.jump(panX.get());
      springY.jump(panY.get());
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const velocity = Math.abs(dx) / Math.max(1, event.timeStamp - drag.time);
    if (Math.hypot(dx, dy) < 6) {
      applyZoom(!zoomed, { x: event.clientX, y: event.clientY });
      return;
    }
    if (!zoomed && event.pointerType !== "mouse" && Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > 60 || velocity > 0.4)) {
      step(dx < 0 ? 1 : -1);
    }
  };

  const frameVariants: Variants = {
    from: { x: flight.x, y: flight.y, scale: flight.scale, borderRadius: flight.borderRadius },
    rest: { x: 0, y: 0, scale: 1, borderRadius: 18, transition: SPRING_VIEWER_REST },
    back: { x: flight.x, y: flight.y, scale: flight.scale, borderRadius: flight.borderRadius, transition: SPRING_VIEWER_BACK },
  };

  const slideVariants: Variants = {
    enter: (custom: number) => ({ opacity: 0, x: custom * 48 }),
    center: { opacity: 1, x: 0 },
    leave: (custom: number) => ({ opacity: 0, x: -custom * 48 }),
  };

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  return (
    <motion.div
      ref={viewerRef}
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      aria-label={`${label}, photo ${index + 1} of ${images.length}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      {...fade}
      transition={{ duration: motionTokens.duration.fast }}
    >
      <motion.div className={styles.backdrop} {...fade} transition={{ duration: motionTokens.duration.fast, ease: EASE_STANDARD }} />
      <motion.div
        ref={frameRef}
        className={styles.frame}
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        variants={frameVariants}
        initial="from"
        animate="rest"
        exit="back"
        data-zoomed={zoomed ? "" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <motion.div className={styles.zoomLayer} style={{ scale, x: springX, y: springY }}>
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={photo?.src ?? index}
              className={styles.frameSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="leave"
              transition={{ x: SPRING_TRACK, opacity: { duration: motionTokens.duration.standard, ease: EASE_STANDARD } }}
            >
              {photo ? <img className={styles.photo} src={photo.src} srcSet={photo.srcSet} alt={photo.alt} draggable={false} decoding="async" /> : null}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
      <motion.div
        className={styles.viewerTop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionTokens.duration.standard, delay: 0.12, ease: EASE_ENTER }}
      >
        <span className={styles.counter} aria-live="polite">
          {index + 1} / {images.length}
        </span>
        <span className={styles.hint}>{zoomed ? "Move to pan, click to zoom out" : "Click the photo to zoom"}</span>
        <button ref={closeRef} type="button" className={styles.viewerButton} aria-label="Close" onClick={onClose}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </motion.div>
      {images.length > 1 ? (
        <motion.div
          className={styles.viewerNav}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: motionTokens.duration.standard, delay: 0.12, ease: EASE_ENTER }}
        >
          <button type="button" className={styles.viewerButton} aria-label="Previous photo" disabled={index === 0} onClick={() => step(-1)}>
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className={styles.viewerDots} aria-hidden="true">
            {images.map((item, dotIndex) => (
              <span key={item.src} className={styles.dot} data-active={dotIndex === index ? "true" : undefined} />
            ))}
          </span>
          <button
            type="button"
            className={styles.viewerButton}
            aria-label="Next photo"
            disabled={index === images.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export const ProductGallery = forwardRef<HTMLDivElement, ProductGalleryProps>(function ProductGallery(
  {
    colors,
    sizes,
    color,
    defaultColor,
    onColorChange,
    size,
    defaultSize = null,
    onSizeChange,
    index,
    defaultIndex = 0,
    onIndexChange,
    zoom = 2.4,
    magnifier = true,
    aspectRatio = 0.8,
    label = "Product photos",
    header,
    footer,
    className,
  },
  ref,
) {
  const id = useId();
  const mounted = useSyncExternalStore(subscribeMount, getMounted, getServerMounted);
  const reducedMotion = useReducedMotion();
  const reduced = Boolean(reducedMotion) && mounted;

  const [colorValue, setColor] = useControllable(color, defaultColor ?? colors[0].value, onColorChange);
  const [sizeValue, setSize] = useControllable(size, defaultSize, onSizeChange);
  const [indexValue, setIndex] = useControllable(index, defaultIndex, onIndexChange);

  const colorIndex = Math.max(
    0,
    colors.findIndex(entry => entry.value === colorValue),
  );
  const entry = colors[colorIndex] ?? colors[0];
  const images = entry.images;
  const current = clamp(indexValue, 0, Math.max(0, images.length - 1));
  const selectedSize = sizes?.find(item => item.value === sizeValue && !isSoldOut(item, entry.value));

  const stageRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const swatchesRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [hovering, setHovering] = useState(false);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; from: number; axis: "x" | null; samples: { x: number; t: number }[] } | null>(
    null,
  );

  const trackX = useMotionValue(0);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const lensX = useSpring(pointerX, { stiffness: 620, damping: 44, mass: 0.6 });
  const lensY = useSpring(pointerY, { stiffness: 620, damping: 44, mass: 0.6 });
  const lensOffsetX = useTransform(lensX, value => value - 88);
  const lensOffsetY = useTransform(lensY, value => value - 88);
  const lensImageX = useTransform(lensX, value => 88 - value * zoom);
  const lensImageY = useTransform(lensY, value => 88 - value * zoom);

  const railIndicator = useActiveIndicator(railRef, `.${styles.thumb}`, `${current}-${images.length}`, reduced);
  const swatchRing = useActiveIndicator(swatchesRef, `.${styles.swatch}`, `${colorIndex}-${colors.length}`, reduced);
  const sizeFill = useActiveIndicator(sizesRef, `.${styles.size}`, `${selectedSize?.value ?? "none"}`, reduced);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = { w: node.clientWidth, h: node.clientHeight };
      setStage(previous => (previous.w === next.w && previous.h === next.h ? previous : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const widthRef = useRef(stage.w);
  const colorRef = useRef(entry.value);

  useLayoutEffect(() => {
    const widthChanged = widthRef.current !== stage.w;
    const colorChanged = colorRef.current !== entry.value;
    widthRef.current = stage.w;
    colorRef.current = entry.value;
    const target = -current * stage.w;
    if (reduced || widthChanged || colorChanged) trackX.jump(target);
    else animate(trackX, target, SPRING_TRACK);
  }, [current, entry.value, reduced, stage.w, trackX]);

  const setPhoto = useCallback(
    (next: number) => {
      if (next === current || next < 0 || next >= images.length) return;
      setIndex(next);
    },
    [current, images.length, setIndex],
  );

  const chooseColor = useCallback(
    (next: number) => {
      const nextEntry = colors[next];
      if (!nextEntry || nextEntry.value === entry.value) return;
      setColor(nextEntry.value);
      if (sizeValue && sizes?.some(item => item.value === sizeValue && isSoldOut(item, nextEntry.value))) setSize(null);
      if (current > nextEntry.images.length - 1) setIndex(Math.max(0, nextEntry.images.length - 1));
    },
    [colors, current, entry.value, setColor, setIndex, setSize, sizeValue, sizes],
  );

  const openViewer = useCallback(() => {
    const node = stageRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const radius = Number.parseFloat(window.getComputedStyle(node).borderTopLeftRadius) || 22;
    setOrigin({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, radius, ratio: aspectRatio });
  }, [aspectRatio]);

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      from: trackX.get(),
      axis: null,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointerX.set(event.clientX - rect.left);
      pointerY.set(event.clientY - rect.top);
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    drag.samples.push({ x: event.clientX, t: event.timeStamp });
    if (drag.samples.length > 12) drag.samples.shift();
    const dx = event.clientX - drag.x;
    if (drag.axis === null && Math.abs(dx) > 8) drag.axis = "x";
    if (drag.axis !== "x") return;
    const min = -(images.length - 1) * stage.w;
    const raw = drag.from + dx;
    trackX.set(raw > 0 ? rubberBand(raw, stage.w) : raw < min ? min + rubberBand(raw - min, stage.w) : raw);
  };

  const handleStagePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const samples = drag.samples;
    const last = samples[samples.length - 1];
    const previous = samples[samples.length - 2] ?? last;
    const velocity = ((last.x - previous.x) / Math.max(1, last.t - previous.t)) * 1000;
    const projected = trackX.get() + (velocity / 1000) * 0.995 * (1 / (1 - 0.995));
    const next = clamp(Math.round(-projected / Math.max(1, stage.w)), current - 1, current + 1);
    if (next !== current) setPhoto(next);
    else animate(trackX, -current * stage.w, { ...SPRING_TRACK, velocity });
  };

  const stageLabel = `${images[current]?.alt ?? label}. Photo ${current + 1} of ${images.length}. Open fullscreen`;
  const lensOn = magnifier && hovering && images.length > 0;

  return (
    <div ref={ref} className={[styles.root, className].filter(Boolean).join(" ")} style={{ "--ratio": aspectRatio } as CSSProperties}>
      <div className={styles.layout}>
        <div className={styles.media} role="group" aria-label={label} aria-roledescription="gallery">
          <button
            ref={stageRef}
            type="button"
            id={`${id}-stage`}
            className={styles.stage}
            aria-label={stageLabel}
            data-lens={lensOn ? "" : undefined}
            onClick={openViewer}
            onKeyDown={event => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setPhoto(current + 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPhoto(current - 1);
              }
            }}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={handleStagePointerUp}
            onPointerEnter={event => {
              if (event.pointerType === "mouse") setHovering(true);
            }}
            onPointerLeave={() => setHovering(false)}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={entry.value}
                className={styles.track}
                style={{ x: trackX }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.text}px)` }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast, delay: reduced ? 0 : motionTokens.duration.fast } }}
                transition={{ duration: reduced ? motionTokens.duration.fast : 0.36, ease: EASE_ENTER }}
              >
                {images.map((image, photoIndex) => (
                  <span key={image.src} className={styles.slide} aria-hidden={photoIndex === current ? undefined : true}>
                    <GalleryImage image={image} className={styles.photo} eager={photoIndex === current} />
                  </span>
                ))}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence>
              {lensOn ? (
                <motion.span
                  key="lens"
                  className={styles.lens}
                  style={{ x: lensOffsetX, y: lensOffsetY }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ scale: SPRING_INDICATOR, opacity: { duration: motionTokens.duration.fast } }}
                  aria-hidden="true"
                >
                  <motion.img
                    className={styles.lensPhoto}
                    src={images[current]?.src}
                    srcSet={images[current]?.srcSet}
                    alt=""
                    draggable={false}
                    style={{ width: stage.w * zoom, height: stage.h * zoom, x: lensImageX, y: lensImageY }}
                  />
                </motion.span>
              ) : null}
            </AnimatePresence>
            <span className={styles.expand} aria-hidden="true">
              <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className={styles.dots} aria-hidden="true">
              {images.map((image, dotIndex) => (
                <span key={image.src} className={styles.dot} data-active={dotIndex === current ? "true" : undefined} />
              ))}
            </span>
          </button>
          {images.length > 1 ? (
            <div
              ref={railRef}
              className={styles.rail}
              role="tablist"
              aria-label="Photos"
              onKeyDown={event => handleRovingKey(event, { total: images.length, index: current, select: setPhoto })}
            >
              <motion.span
                className={styles.railIndicator}
                aria-hidden="true"
                style={{
                  x: railIndicator.x,
                  y: railIndicator.y,
                  width: railIndicator.width,
                  height: railIndicator.height,
                  opacity: railIndicator.opacity,
                }}
              />
              {images.map((image, photoIndex) => (
                <button
                  key={image.src}
                  type="button"
                  role="tab"
                  data-option=""
                  data-active={photoIndex === current ? "true" : undefined}
                  className={styles.thumb}
                  aria-selected={photoIndex === current}
                  aria-controls={`${id}-stage`}
                  tabIndex={photoIndex === current ? 0 : -1}
                  aria-label={`Photo ${photoIndex + 1}: ${image.alt}`}
                  onClick={() => setPhoto(photoIndex)}
                >
                  <AnimatePresence initial={false}>
                    <motion.img
                      key={image.src}
                      className={styles.thumbPhoto}
                      src={image.src}
                      srcSet={image.srcSet}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: motionTokens.duration.fast }}
                    />
                  </AnimatePresence>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.details}>
          {header ?? (
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <h3 className={styles.title}>Washed linen duvet set</h3>
              </div>
              <p className={styles.copy}>
                Stonewashed European flax that softens with every wash. Hover the photo to look closer, or open it fullscreen.
              </p>
            </div>
          )}
          <div className={styles.picker}>
            <p className={styles.pickerLabel} id={`${id}-color`}>
              <span>Color</span>
              <span className={styles.pickerValue}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={`${entry.label}${entry.soldOut ? "-out" : ""}`}
                    initial={POP_IN}
                    animate={POP_OUT}
                    exit={POP_UP}
                    transition={POP_TRANSITION}
                  >
                    {entry.label}
                    {entry.soldOut ? " · sold out" : ""}
                  </motion.span>
                </AnimatePresence>
              </span>
            </p>
            <div
              ref={swatchesRef}
              className={styles.swatches}
              role="radiogroup"
              aria-labelledby={`${id}-color`}
              onKeyDown={event => handleRovingKey(event, { total: colors.length, index: colorIndex, select: chooseColor })}
            >
              <motion.span
                className={styles.swatchRing}
                aria-hidden="true"
                style={{
                  x: swatchRing.x,
                  y: swatchRing.y,
                  width: swatchRing.width,
                  height: swatchRing.height,
                  opacity: swatchRing.opacity,
                }}
              />
              {colors.map((item, itemIndex) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  data-option=""
                  data-active={itemIndex === colorIndex ? "true" : undefined}
                  aria-checked={itemIndex === colorIndex}
                  tabIndex={itemIndex === colorIndex ? 0 : -1}
                  className={styles.swatch}
                  aria-label={`${item.label}${item.soldOut ? ", sold out" : ""}`}
                  data-sold-out={item.soldOut ? "true" : undefined}
                  onClick={() => chooseColor(itemIndex)}
                >
                  <span className={styles.swatchFill} style={{ background: item.swatch }} />
                </button>
              ))}
            </div>
          </div>
          {sizes && sizes.length > 0 ? (
            <div className={styles.picker}>
              <p className={styles.pickerLabel} id={`${id}-size`}>
                <span>Size</span>
                <span className={styles.pickerValue}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={selectedSize?.value ?? "none"}
                      initial={POP_IN}
                      animate={POP_OUT}
                      exit={POP_UP}
                      transition={POP_TRANSITION}
                    >
                      {selectedSize?.label ?? "Select a size"}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </p>
              <div
                ref={sizesRef}
                className={styles.sizes}
                role="radiogroup"
                aria-labelledby={`${id}-size`}
                onKeyDown={event =>
                  handleRovingKey(event, {
                    total: sizes.length,
                    index: Math.max(0, sizes.findIndex(item => item.value === selectedSize?.value)),
                    select: next => setSize(sizes[next].value),
                    skip: next => isSoldOut(sizes[next], entry.value),
                  })
                }
              >
                <motion.span
                  className={styles.sizeFill}
                  aria-hidden="true"
                  style={{
                    x: sizeFill.x,
                    y: sizeFill.y,
                    width: sizeFill.width,
                    height: sizeFill.height,
                    opacity: sizeFill.opacity,
                  }}
                />
                {sizes.map((item, itemIndex) => {
                  const soldOut = isSoldOut(item, entry.value);
                  const active = selectedSize?.value === item.value;
                  const firstAvailable = sizes.findIndex(candidate => !isSoldOut(candidate, entry.value));
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      data-option=""
                      data-active={active ? "true" : undefined}
                      aria-checked={active}
                      aria-disabled={soldOut ? true : undefined}
                      tabIndex={active || (!selectedSize && firstAvailable === itemIndex) ? 0 : -1}
                      className={styles.size}
                      aria-label={soldOut ? `${item.label}, sold out` : undefined}
                      data-sold-out={soldOut ? "true" : undefined}
                      onClick={() => {
                        if (soldOut) return;
                        setSize(active ? null : item.value);
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {footer}
        </div>
      </div>
      {mounted && origin
        ? createPortal(
            <AnimatePresence custom={origin}>
              <GalleryViewer
                key="viewer"
                images={images}
                index={current}
                origin={origin}
                zoom={zoom}
                reduced={reduced}
                label={label}
                onIndex={setPhoto}
                onClose={() => setOrigin(null)}
              />
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
});

ProductGallery.displayName = "ProductGallery";

export default ProductGallery;
