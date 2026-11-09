"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./sheet-stack.module.css";

export type SheetStackMode = "auto" | "sheet" | "dialog";

/** A spring from a duration and bounce, so every motion in the stack is described the way it is felt. */
const spring = (duration: number, bounce: number): Transition => {
  const omega = (2 * Math.PI) / (1.2 * duration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1, restDelta: 0.01, restSpeed: 0.5 };
};

const enter = spring(0.44, 0.06);
const leave = spring(0.34, 0);
const depthSpring = spring(0.42, 0);
const heightSpring = spring(0.4, 0);
const flung = spring(0.36, 0.08);
const lift: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };

/** How much of each lower sheet shows above the one in front. */
const peek = { sheet: 10, dialog: 14 } as const;
/** Room kept above the stack for the layer's own inset. */
const inset = { sheet: 20, dialog: 40 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The dismiss spring, carrying the speed the finger let go at. */
const flungWith = (velocity: number): Transition => ({ ...flung, velocity });

const subscribe = () => () => {};

/** True after hydration. Portals only exist in the browser, so the server render stays portal-free and matches. */
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

interface StackSize { w: number; h: number }

interface SheetStackContextValue {
  stack: string[];
  push: (id: string) => void;
  pop: () => void;
  popTo: (id: string) => void;
  close: () => void;
  mode: "sheet" | "dialog";
  layer: HTMLDivElement | null;
  size: StackSize;
  heights: Record<string, number>;
  titles: Record<string, string>;
  reportHeight: (id: string, height: number) => void;
  reportTitle: (id: string, title: string) => void;
  frontTop: MotionValue<number>;
  release: MotionValue<number>;
  reduced: boolean;
}

const SheetStackContext = createContext<SheetStackContextValue | null>(null);

/** The stack every sheet in this provider shares: who is open, and how to move between them. */
export function useSheetStack() {
  const context = useContext(SheetStackContext);
  if (!context) throw new Error("useSheetStack must be used inside SheetStack");
  const { stack, push, pop, popTo, close } = context;
  return { stack, push, pop, popTo, close };
}

export interface SheetStackProps {
  children?: ReactNode;
  /** The ids of the open sheets, bottom first. */
  stack?: string[];
  defaultStack?: string[];
  onStackChange?: (stack: string[]) => void;
  mode?: SheetStackMode;
  breakpoint?: number;
  /** Keeps the layer inside the nearest positioned parent, for a contained demo. */
  contained?: boolean;
}

/**
 * A stack of sheets that push over each other: each new one lifts the ones below, dims them, and
 * takes the focus. Escape, a drag down, or the back button unwinds one level at a time.
 */
export function SheetStack({ children, stack, defaultStack = [], onStackChange, mode = "auto", breakpoint = 640, contained = false }: SheetStackProps) {
  const mounted = useMounted();
  const reduced = !!useReducedMotion() && mounted;
  const [uncontrolled, setUncontrolled] = useState(defaultStack);
  const open = stack ?? uncontrolled;
  const latest = useRef(open);
  useLayoutEffect(() => {
    latest.current = open;
  }, [open]);

  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<StackSize>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!layer) return;
    const measure = () => setSize(current => current.w === layer.clientWidth && current.h === layer.clientHeight ? current : { w: layer.clientWidth, h: layer.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [layer]);

  const resolved: "sheet" | "dialog" = mode === "auto" ? (size.w >= breakpoint ? "dialog" : "sheet") : mode;

  const [heights, setHeights] = useState<Record<string, number>>({});
  const reportHeight = useCallback((id: string, height: number) => {
    setHeights(current => Math.abs((current[id] ?? -1) - height) < 0.5 ? current : { ...current, [id]: height });
  }, []);

  const [titles, setTitles] = useState<Record<string, string>>({});
  const reportTitle = useCallback((id: string, title: string) => {
    setTitles(current => current[id] === title ? current : { ...current, [id]: title });
  }, []);

  // The element that opened each sheet, so closing it can hand focus back to where the visit started.
  const openers = useRef(new Map<string, HTMLElement>());
  const restore = useRef<HTMLElement | null>(null);

  const commit = useCallback((next: string[]) => {
    const previous = latest.current;
    next.forEach(id => {
      if (!previous.includes(id) && document.activeElement instanceof HTMLElement) openers.current.set(id, document.activeElement);
    });
    const closed = previous.filter(id => !next.includes(id));
    if (closed.length) restore.current = openers.current.get(closed[0]) ?? null;
    closed.forEach(id => openers.current.delete(id));
    latest.current = next;
    if (stack === undefined) setUncontrolled(next);
    onStackChange?.(next);
  }, [onStackChange, stack]);

  const push = useCallback((id: string) => {
    const current = latest.current;
    const at = current.indexOf(id);
    commit(at >= 0 ? current.slice(0, at + 1) : [...current, id]);
  }, [commit]);

  const pop = useCallback(() => {
    if (latest.current.length) commit(latest.current.slice(0, -1));
  }, [commit]);

  const popTo = useCallback((id: string) => {
    const at = latest.current.indexOf(id);
    if (at >= 0) commit(latest.current.slice(0, at + 1));
  }, [commit]);

  const close = useCallback(() => {
    if (latest.current.length) commit([]);
  }, [commit]);

  const frontTop = useMotionValue(0);
  const release = useMotionValue(0);
  const progress = useMotionValue(0);
  // The scrim stays put while the last sheet is dragged away: the drag itself carries the fade.
  const scrimOpacity = useTransform(() => progress.get() * (1 - (latest.current.length === 1 ? release.get() : 0)));

  const front = open[open.length - 1];
  const frontHeight = front ? heights[front] : undefined;
  const measuredTop = frontHeight === undefined ? null : resolved === "sheet" ? size.h - frontHeight : (size.h - frontHeight) / 2;
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (measuredTop === null) return;
    if (!placed.current || reduced) {
      frontTop.jump(measuredTop);
      placed.current = true;
      return;
    }
    const controls = animate(frontTop, measuredTop, depthSpring);
    return () => controls.stop();
  }, [measuredTop, frontTop, reduced]);

  const count = open.length;
  const lastCount = useRef(count);
  useLayoutEffect(() => {
    const previous = lastCount.current;
    lastCount.current = count;
    // A closing stack keeps the scrim where the drag left it, then fades from there.
    if (count === 0 && previous > 0) progress.jump(progress.get() * (1 - release.get()));
    release.jump(0);
    if (count === 0) placed.current = false;
    const controls = animate(progress, +!!count, reduced
      ? { duration: 0.16 }
      : count
        ? { duration: 0.3, ease: [...motionTokens.ease.enter] }
        : { duration: 0.24, ease: [...motionTokens.ease.standard] });
    const target = restore.current;
    restore.current = null;
    if (target?.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
    return () => controls.stop();
  }, [count, release, reduced, progress]);

  useEffect(() => {
    if (!count) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      pop();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [count, pop]);

  // A sheet owns the page behind it, so the page underneath never scrolls away.
  useEffect(() => {
    if (contained || !count) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [contained, count]);

  const value = useMemo<SheetStackContextValue>(() => ({
    stack: open,
    push,
    pop,
    popTo,
    close,
    mode: resolved,
    layer,
    size,
    heights,
    titles,
    reportHeight,
    reportTitle,
    frontTop,
    release,
    reduced,
  }), [close, frontTop, heights, layer, pop, popTo, push, reduced, release, resolved, size, titles, open, reportHeight, reportTitle]);

  const layerElement = <div ref={setLayer} className={styles.layer} data-contained={contained || undefined} data-open={count ? "" : undefined} data-mode={resolved}>
    <motion.div className={styles.scrim} style={{ opacity: scrimOpacity }} aria-hidden="true" onClick={pop} />
  </div>;

  return <SheetStackContext.Provider value={value}>
    {children}
    {contained ? layerElement : mounted ? createPortal(layerElement, document.body) : null}
  </SheetStackContext.Provider>;
}

export interface SheetProps {
  id: string;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** The name of the sheet this one returns to, used by the back button. */
  backLabel?: string;
  dismissible?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Declares one sheet. It renders nothing until its id is in the stack. */
export function Sheet(props: SheetProps) {
  const context = useContext(SheetStackContext);
  if (!context) throw new Error("Sheet must be used inside SheetStack");
  const { id, title, backLabel } = props;
  const { reportTitle } = context;
  useLayoutEffect(() => {
    reportTitle(id, backLabel ?? title);
  }, [backLabel, id, reportTitle, title]);
  const index = context.stack.indexOf(id);
  if (!context.layer) return null;
  return createPortal(<AnimatePresence>
    {index >= 0 ? <SheetPanel key={id} {...props} index={index} depth={context.stack.length - 1 - index} context={context} /> : null}
  </AnimatePresence>, context.layer);
}

interface SheetPanelProps extends SheetProps {
  index: number;
  depth: number;
  context: SheetStackContextValue;
}

function SheetPanel({ id, title, description, children, footer, dismissible = true, className, ref, index, depth, context }: SheetPanelProps) {
  const { mode, size, heights, titles, reportHeight, frontTop, release, reduced, stack, pop, close } = context;
  const uid = useId();
  const [present, safeToRemove] = usePresence();
  const panel = useRef<HTMLDivElement | null>(null);
  const sizer = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const isTop = depth === 0 && present;
  const known = heights[id];
  const layerPeek = peek[mode];
  const measuredTop = known === undefined ? 0 : mode === "sheet" ? size.h - known : (size.h - known) / 2;
  const maxHeight = Math.max(160, size.h - inset[mode] - layerPeek * index - (mode === "dialog" ? inset.dialog : 0));
  const parent = index > 0 ? stack[index - 1] : undefined;

  const depthValue = useMotionValue(depth);
  const dragY = useMotionValue(0);
  /** The sizer's height: measured, then sprung when its content changes. */
  const height = useMotionValue<string | number>("auto");
  const appear = useMotionValue(+!reduced);
  const top = useMotionValue(measuredTop);
  useLayoutEffect(() => {
    top.set(measuredTop);
  }, [top, measuredTop]);

  // The whole depth choreography: a sheet below rises from behind, scales down, and dims by half for each level.
  const transform = useTransform(() => {
    const behind = Math.max(0, depthValue.get() - release.get());
    const y = (reduced || behind <= 0
      ? 0
      : behind >= 1
        ? frontTop.get() - layerPeek * behind - top.get()
        : behind * (frontTop.get() - layerPeek - top.get())) + dragY.get();
    const scale = reduced ? 1 : (1 - 0.05 * behind) * (mode === "dialog" ? 1 - 0.03 * (1 - appear.get()) : 1);
    return `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  });
  const dim = useTransform(() => clamp(depthValue.get() - release.get(), 0, 2) / 2);
  const opacity = useTransform(() => mode === "dialog" || reduced ? appear.get() : 1);

  const sized = useRef(false);
  useLayoutEffect(() => {
    const node = sizer.current;
    if (!node) return;
    const measure = () => {
      const next = node.offsetHeight;
      const scroller = body.current;
      if (scroller) scroller.toggleAttribute("data-scrolls", scroller.scrollHeight > scroller.clientHeight + 1);
      reportHeight(id, next);
      if (!sized.current || reduced) {
        height.jump(next);
        sized.current = true;
        return;
      }
      animate(height, next, heightSpring);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, id, reduced, reportHeight]);

  // A sheet coming in from below: sheets slide up from the bottom edge, dialogs lift and fade.
  useLayoutEffect(() => {
    const node = sizer.current;
    if (!node) return;
    panel.current?.focus({ preventScroll: true });
    if (reduced) {
      appear.jump(0);
      animate(appear, 1, { duration: 0.16 });
      return;
    }
    if (mode === "sheet") {
      dragY.jump(node.offsetHeight + 24);
      animate(dragY, 0, enter);
      return;
    }
    dragY.jump(18);
    appear.jump(0);
    animate(dragY, 0, enter);
    animate(appear, 1, { duration: 0.2, ease: [...motionTokens.ease.enter] });
  }, []);

  const lastDepth = useRef(depth);
  useLayoutEffect(() => {
    if (!present || lastDepth.current === depth) return;
    lastDepth.current = depth;
    depthValue.jump(Math.max(0, depthValue.get() - release.get()));
    if (reduced) {
      depthValue.jump(depth);
      return;
    }
    const controls = animate(depthValue, depth, depthSpring);
    return () => controls.stop();
  }, [depth, depthValue, present, reduced, release]);

  const velocity = useRef(0);
  useEffect(() => {
    if (present) return;
    const speed = velocity.current;
    const node = sizer.current;
    const measured = node?.offsetHeight ?? 400;
    const controls = reduced
      ? [animate(appear, 0, { duration: 0.14 })]
      : mode === "sheet"
        ? [animate(dragY, (depth === 0 ? measured : size.h) + 24, speed ? flungWith(speed) : leave)]
        : [
          animate(dragY, speed ? dragY.get() + Math.max(120, 0.2 * speed) : 18, speed ? flungWith(speed) : leave),
          animate(appear, 0, lift),
        ];
    Promise.all(controls).then(() => safeToRemove?.());
    return () => controls.forEach(control => control.stop());
  }, [present]);

  const pointer = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | "none" | null; samples: { t: number; y: number }[] } | null>(null);
  const dragging = useRef(false);
  const measuredHeight = () => sizer.current?.offsetHeight ?? 1;
  const reportRelease = (value: number) => {
    if (dragging.current) release.set(clamp(value / measuredHeight(), 0, 1));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pointer.current;
    if (!state || state.id !== event.pointerId) return;
    pointer.current = null;
    if (state.axis !== "y") return;
    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const speed = (last.y - first.y) / Math.max(0.001, (last.t - first.t) / 1000);
    const offset = dragY.get();
    const extent = measuredHeight();
    // A third of the sheet, or a quick flick, is enough to dismiss it.
    if (offset > 0 && (offset > 0.35 * extent || (speed > 450 && offset > 16))) {
      velocity.current = Math.max(speed, 0);
      dragging.current = false;
      pop();
      return;
    }
    const stop = dragY.on("change", reportRelease);
    animate(dragY, 0, speed ? { ...enter, velocity: speed } as Transition : enter).then(() => {
      stop();
      dragging.current = false;
    });
  };

  return <motion.div
    ref={node => {
      panel.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }}
    className={[styles.panel, className].filter(Boolean).join(" ")}
    data-mode={mode}
    data-top={isTop || undefined}
    role="dialog"
    aria-modal={isTop || undefined}
    aria-labelledby={`${uid}-title`}
    aria-describedby={description ? `${uid}-description` : undefined}
    tabIndex={-1}
    inert={!isTop || undefined}
    onKeyDown={event => {
      if (event.key !== "Tab" || !isTop) return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []).filter(node => !node.closest("[inert]"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const at = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && at <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && at === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    }}
    style={{ transform, opacity, height, zIndex: index + 2 } as unknown as CSSProperties}
    onPointerDown={event => {
      if (!dismissible || !isTop || event.button !== 0 || pointer.current) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, button, a, label, [role='slider'], [data-sheet-no-drag]")) return;
      const scroller = body.current;
      // A body that is scrolled up keeps the drag for itself; the sheet only starts pulling at the top.
      if (scroller && scroller.contains(target) && scroller.scrollTop > 0) return;
      pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, samples: [{ t: event.timeStamp, y: event.clientY }] };
    }}
    onPointerMove={event => {
      const state = pointer.current;
      if (!state || state.id !== event.pointerId || state.axis === "none") return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (!state.axis) {
        if (Math.hypot(dx, dy) < 6) return;
        const scroller = body.current;
        if (Math.abs(dx) > Math.abs(dy) || (dy < 0 && scroller && scroller.scrollHeight > scroller.clientHeight)) {
          state.axis = "none";
          return;
        }
        state.axis = "y";
        state.y = event.clientY - dragY.get();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragY.stop();
        dragging.current = true;
      }
      state.samples.push({ t: event.timeStamp, y: event.clientY });
      if (state.samples.length > 6) state.samples.shift();
      const offset = event.clientY - state.y;
      // Pulling up gives a short rubber band instead of dragging the sheet off its top edge.
      const next = offset >= 0 ? offset : (offset * measuredHeight() * 0.3) / (measuredHeight() + 0.3 * Math.abs(offset));
      dragY.set(next);
      reportRelease(next);
    }}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
  >
    <div ref={sizer} className={styles.sizer} style={{ maxHeight }}>
      {mode === "sheet" && <span className={styles.grabber} aria-hidden="true" />}
      <header className={styles.header}>
        <span className={styles.lead}>
          {parent && <button type="button" className={styles.back} onClick={pop}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.backLabel}>{titles[parent] ?? "Back"}</span>
          </button>}
        </span>
        <h2 id={`${uid}-title`} className={styles.title}>{title}</h2>
        <span className={styles.trail}>
          <button type="button" className={styles.close} aria-label={stack.length > 1 ? "Close all" : "Close"} onClick={close}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      </header>
      {description && <p id={`${uid}-description`} className={styles.description}>{description}</p>}
      <div ref={body} className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
    <motion.div className={styles.dim} style={{ opacity: dim }} aria-hidden="true" />
  </motion.div>;
}

export default SheetStack;
