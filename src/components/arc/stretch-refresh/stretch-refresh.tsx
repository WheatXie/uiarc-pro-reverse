"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionStyle,
  type Transition,
} from "motion/react";
import { Check, RotateCw, TriangleAlert } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./stretch-refresh.module.css";

const { spring, duration, ease, blur, stagger } = motionTokens;

const enterEase = [...ease.enter] as [number, number, number, number];
const exitEase = [...ease.standard] as [number, number, number, number];
const still: Transition = { duration: 0 };

const settled = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };
const rising = { opacity: 0, y: "0.35em", filter: `blur(${blur.soft}px)` };
const popping = { opacity: 0, scale: 0.5, filter: `blur(${blur.subtle}px)` };

/** Travel after resistance, in px, that arms a refresh. */
const DEFAULT_THRESHOLD = 72;

type Phase = "idle" | "pulling" | "armed" | "refreshing" | "done";
type PullSource = "pointer" | "wheel" | "touch";

interface Gesture {
  phase: Phase;
  source: PullSource | null;
  pulling: boolean;
  startY: number;
  raw: number;
  pointer: number;
  lastWheel: number;
  wheelTimer: number;
  closeTimer: number;
  suppressClick: boolean;
  alive: boolean;
}

export interface StretchRefreshProps<T> {
  /** Heading above the feed. */
  title: string;
  /** Short status under the heading, such as "Updated 14 min ago". */
  subtitle?: string;
  /** Rows in the feed. */
  items: readonly T[];
  /** Stable key for each row. */
  getKey: (item: T) => string;
  /** Renders one row. */
  renderItem: (item: T) => ReactNode;
  /** Runs after a pull past the threshold or a press of the refresh button. */
  onRefresh: () => Promise<string | void>;
  /** Pull distance in px, after resistance, that arms a refresh. */
  threshold?: number;
  /** Result shown when onRefresh resolves without one. */
  doneLabel?: string;
  /** Result shown when onRefresh rejects. */
  errorLabel?: string;
  /** Accessible name of the refresh button. */
  refreshLabel?: string;
  /** Extra class on the root. */
  className?: string;
}

/** Feed that refreshes when pulled past its top edge; the line in the gap shows when to let go. */
export function StretchRefresh<T>({
  title,
  subtitle,
  items,
  getKey,
  renderItem,
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  doneLabel = "Up to date",
  errorLabel = "Couldn’t refresh",
  refreshLabel = "Refresh",
  className,
}: StretchRefreshProps<T>) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ ok: boolean; label: string } | null>(null);

  const gesture = useRef<Gesture>({
    phase: "idle",
    source: null,
    pulling: false,
    startY: 0,
    raw: 0,
    pointer: -1,
    lastWheel: -1e9,
    wheelTimer: 0,
    closeTimer: 0,
    suppressClick: false,
    alive: true,
  });

  const y = useMotionValue(0);
  const tension = useMotionValue(0);
  const run = useMotionValue(0);

  const progress = useTransform(y, value => Math.min(1, value / threshold));
  const runX = useTransform(run, value => `${150 * value}%`);
  const anchorY = useTransform(y, value => (value - 34) / 2);
  const anchorOpacity = useTransform(y, [4, 28], [0, 1]);
  const peel = useTransform(y, [0, 40], [0, 1]);

  const setPhaseValue = (next: Phase) => {
    gesture.current.phase = next;
    setPhase(next);
  };

  const springTo = (value: number) => {
    animate(
      y,
      value,
      reduced ? still : { ...(value ? spring.morph : spring.smooth), velocity: y.getVelocity() },
    );
    animate(tension, 0, reduced ? still : { ...spring.morph, velocity: tension.getVelocity() });
  };

  const settle = () => {
    void animate(y, 0, reduced ? still : spring.smooth).then(() => {
      if (!gesture.current.alive || gesture.current.phase !== "done") return;
      run.set(0);
      setPhaseValue("idle");
    });
  };

  const refresh = async () => {
    const state = gesture.current;
    if (state.phase === "refreshing" || state.phase === "done") return;
    window.clearTimeout(state.wheelTimer);
    state.source = null;
    state.pulling = false;
    state.pointer = -1;
    setPhaseValue("refreshing");
    springTo(60);
    run.set(0);
    if (!reduced) {
      animate(run, 1, {
        duration: 0.7,
        ease: [...ease.inOut] as [number, number, number, number],
        repeat: Infinity,
        repeatType: "mirror",
      });
    }
    const viewport = viewportRef.current;
    if (viewport && viewport.scrollTop > 0) {
      viewport.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
    let outcome: { ok: boolean; label: string };
    try {
      const label = await onRefresh();
      outcome = { ok: true, label: label || doneLabel };
    } catch {
      outcome = { ok: false, label: errorLabel };
    }
    if (!state.alive) return;
    run.stop();
    setResult(outcome);
    setPhaseValue("done");
    window.clearTimeout(state.closeTimer);
    state.closeTimer = window.setTimeout(settle, outcome.ok ? 1200 : 1800);
  };

  const pullTo = (distance: number) => {
    const state = gesture.current;
    state.raw = Math.max(0, distance);
    const eased = (196 * state.raw) / (0.7 * state.raw + 280);
    y.set(eased);
    tension.set(eased);
    const next: Phase = eased >= threshold ? "armed" : "pulling";
    if (state.phase !== next) setPhaseValue(next);
  };

  const begin = (source: PullSource, startY: number) => {
    const state = gesture.current;
    if (state.source || state.phase !== "idle" || (viewportRef.current?.scrollTop ?? 0) > 0) {
      return false;
    }
    y.stop();
    tension.stop();
    const current = y.get();
    const raw = current >= 279 ? 11200 : (280 * current) / (0.7 * (280 - current));
    state.source = source;
    state.pulling = raw > 0;
    state.raw = raw;
    state.startY = startY - raw;
    return true;
  };

  const moveTo = (clientY: number, slop: number) => {
    const state = gesture.current;
    const delta = clientY - state.startY;
    if (!state.pulling) {
      if (delta < 0) {
        state.source = null;
        state.pointer = -1;
        return false;
      }
      if (delta <= slop) return false;
      state.pulling = true;
    }
    pullTo(delta);
    return true;
  };

  const end = () => {
    const state = gesture.current;
    if (!state.source) return;
    const pulled = state.pulling;
    window.clearTimeout(state.wheelTimer);
    state.source = null;
    state.pulling = false;
    state.pointer = -1;
    state.raw = 0;
    if (!pulled) return;
    if (state.phase === "armed") {
      void refresh();
      return;
    }
    setPhaseValue("idle");
    springTo(0);
  };

  const onWheel = useEffectEvent((event: WheelEvent) => {
    const state = gesture.current;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    const gap = event.timeStamp - state.lastWheel;
    state.lastWheel = event.timeStamp;
    if (state.source !== "wheel") {
      if (delta >= 0 || gap < 180 || Math.abs(event.deltaX) > Math.abs(delta)) return;
      if (!begin("wheel", 0)) return;
      state.pulling = true;
    }
    event.preventDefault();
    pullTo(state.raw - delta);
    window.clearTimeout(state.wheelTimer);
    if (state.raw <= 0) {
      end();
    } else {
      state.wheelTimer = window.setTimeout(end, 160);
    }
  });

  const onTouchStart = useEffectEvent((event: TouchEvent) => {
    if (event.touches.length === 1) begin("touch", event.touches[0].clientY);
  });

  const onTouchMove = useEffectEvent((event: TouchEvent) => {
    if (gesture.current.source !== "touch" || event.touches.length !== 1) return;
    if (moveTo(event.touches[0].clientY, 0) && event.cancelable) event.preventDefault();
  });

  const onTouchEnd = useEffectEvent(() => {
    if (gesture.current.source === "touch") end();
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const element = event.currentTarget;
    if (event.clientX - element.getBoundingClientRect().left > element.clientWidth) return;
    if (begin("pointer", event.clientY)) gesture.current.pointer = event.pointerId;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.source !== "pointer" || event.pointerId !== state.pointer) return;
    const wasIdle = !state.pulling;
    if (moveTo(event.clientY, 4) && wasIdle) {
      event.currentTarget.setPointerCapture(event.pointerId);
      window.getSelection()?.removeAllRanges();
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = gesture.current;
    if (state.source !== "pointer" || event.pointerId !== state.pointer) return;
    if (state.pulling) {
      state.suppressClick = true;
      window.setTimeout(() => {
        state.suppressClick = false;
      }, 0);
    }
    end();
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!gesture.current.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const state = gesture.current;
    state.alive = true;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => onWheel(event);
    const touchStart = (event: TouchEvent) => onTouchStart(event);
    const touchMove = (event: TouchEvent) => onTouchMove(event);
    const touchEnd = () => onTouchEnd();
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("touchstart", touchStart, { passive: true });
    viewport.addEventListener("touchmove", touchMove, { passive: false });
    viewport.addEventListener("touchend", touchEnd);
    viewport.addEventListener("touchcancel", touchEnd);
    return () => {
      state.alive = false;
      run.stop();
      window.clearTimeout(state.wheelTimer);
      window.clearTimeout(state.closeTimer);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("touchstart", touchStart);
      viewport.removeEventListener("touchmove", touchMove);
      viewport.removeEventListener("touchend", touchEnd);
      viewport.removeEventListener("touchcancel", touchEnd);
    };
  }, [run]);

  const armed = phase === "armed";
  const refreshing = phase === "refreshing";
  const done = phase === "done";
  const ok = result?.ok ?? true;
  const busy = refreshing || done;
  const tone = done ? (ok ? "done" : "error") : "refresh";
  const statusText = done && result
    ? result.label
    : refreshing
      ? "Refreshing"
      : armed
        ? "Release to refresh"
        : "Pull to refresh";

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      data-state={phase}
      data-pulling={phase === "pulling" || armed || undefined}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          {subtitle ? (
            <p className={styles.subtitle}>
              <Rise text={subtitle} reduced={reduced} />
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void refresh()}
          aria-label={refreshLabel}
          aria-disabled={busy || undefined}
          data-busy={refreshing || undefined}
        >
          <span className={styles.refreshGlyph}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={tone}
                className={styles.refreshIcon}
                data-tone={tone}
                initial={popping}
                animate={settled}
                exit={{ ...popping, transition: { duration: duration.instant } }}
                transition={snapTransition(reduced)}
              >
                {tone === "done" ? (
                  <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                ) : tone === "error" ? (
                  <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <RotateCw size={16} strokeWidth={2} aria-hidden="true" className={styles.refreshTurn} />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </header>

      <div className={styles.stage}>
        <div className={styles.tray} aria-hidden="true">
          <motion.div className={styles.anchor} style={{ y: anchorY, opacity: anchorOpacity }}>
            <div className={styles.indicator} data-tone={done && !ok ? "warning" : undefined}>
              <motion.span
                className={styles.meter}
                initial={false}
                animate={done ? { opacity: 0, scaleX: 0.4 } : { opacity: 1, scaleX: armed && !reduced ? 1.12 : 1 }}
                transition={
                  reduced
                    ? { duration: duration.fast }
                    : done
                      ? { duration: duration.exit, ease: exitEase }
                      : spring.snappy
                }
              >
                <motion.span
                  className={styles.meterFill}
                  style={{ scaleX: progress }}
                  initial={false}
                  animate={{ opacity: busy ? 0 : 1 }}
                  transition={{ duration: duration.fast }}
                />
                <motion.span
                  className={styles.meterRun}
                  style={{ x: runX }}
                  initial={false}
                  animate={{ opacity: Number(!!refreshing) }}
                  transition={{ duration: duration.fast }}
                />
              </motion.span>
              <span className={styles.status}>
                <AnimatePresence initial={false}>
                  {done ? (
                    <motion.span
                      key={ok ? "ok" : "error"}
                      className={styles.mark}
                      initial={popping}
                      animate={settled}
                      exit={{ opacity: 0, transition: { duration: duration.instant } }}
                      transition={snapTransition(reduced, 0.06)}
                    >
                      {ok ? (
                        <DrawnCheck reduced={reduced} />
                      ) : (
                        <TriangleAlert size={14} strokeWidth={2} />
                      )}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
                <Rise text={statusText} reduced={reduced} />
              </span>
            </div>
          </motion.div>
        </div>

        <motion.div
          ref={viewportRef}
          layoutScroll
          className={styles.viewport}
          style={{ y, "--peel": peel } as MotionStyle}
          role="region"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
        >
          <motion.ul
            className={styles.list}
            aria-busy={refreshing || undefined}
            style={{ "--tension": tension } as MotionStyle}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((item, index) => (
                <StretchItem key={getKey(item)} index={index} reduced={reduced}>
                  {renderItem(item)}
                </StretchItem>
              ))}
            </AnimatePresence>
          </motion.ul>
        </motion.div>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {refreshing ? "Refreshing" : done && result ? result.label : ""}
      </p>
    </section>
  );
}

function snapTransition(reduced: boolean, delay = 0): Transition {
  if (reduced) {
    return {
      duration: duration.fast,
      scale: { duration: 0 },
      y: { duration: 0 },
      rotate: { duration: 0 },
      filter: { duration: 0 },
    };
  }
  return {
    ...spring.snappy,
    delay,
    opacity: { duration: duration.fast, ease: enterEase, delay },
    filter: { duration: duration.fast, ease: enterEase, delay },
  };
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M4.5 12.5l4.8 4.8L19.5 7"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                pathLength: { duration: 0.32, ease: enterEase, delay: 0.16 },
                opacity: { duration: 0.05, delay: 0.16 },
              }
        }
      />
    </svg>
  );
}

function Rise({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.rise, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={styles.riseItem}
          initial={rising}
          animate={settled}
          exit={{
            opacity: 0,
            y: "-0.3em",
            filter: `blur(${blur.subtle}px)`,
            transition: { duration: duration.instant, ease: exitEase },
          }}
          transition={
            reduced
              ? { duration: duration.fast, y: { duration: 0 }, filter: { duration: 0 } }
              : { duration: duration.standard, ease: enterEase }
          }
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function StretchItem({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const delay = 0.1 + Math.min(index, 5) * stagger.line * 0.75;
  return (
    <motion.li
      layout="position"
      className={styles.item}
      initial={{ opacity: 0, y: -16, scale: 0.97, filter: `blur(${blur.soft}px)` }}
      animate={settled}
      exit={{
        opacity: 0,
        scale: 0.97,
        filter: `blur(${blur.subtle}px)`,
        transition: { duration: reduced ? duration.instant : duration.exit, ease: exitEase },
      }}
      transition={
        reduced
          ? {
              duration: duration.fast,
              y: { duration: 0 },
              scale: { duration: 0 },
              filter: { duration: 0 },
              layout: { duration: 0 },
            }
          : {
              y: { ...spring.morph, delay },
              scale: { ...spring.morph, delay },
              opacity: { duration: duration.standard, ease: enterEase, delay },
              filter: { duration: duration.standard, ease: enterEase, delay },
              layout: spring.smooth,
            }
      }
    >
      <div className={styles.row} style={{ "--i": Math.min(index, 6) } as CSSProperties}>
        {children}
      </div>
    </motion.li>
  );
}

export default StretchRefresh;
