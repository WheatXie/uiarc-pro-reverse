"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { ChevronLeft, ChevronRight, MoveUpRight } from "lucide-react";
import styles from "./page-curl.module.css";

type Point = [number, number];

const emptyPolygon = "polygon(0px 0px, 0px 0px, 0px 0px)";
/** Serialises a polygon for clip-path, or collapses to an empty one below three points. */
function polygon(points: Point[]) {
  return points.length < 3 ? emptyPolygon : `polygon(${points.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;
}

/** Sutherland–Hodgman half-plane clip: keeps the points a score function likes and inserts the
 *  intersections where the outline crosses the cut, which is what makes the fold edge straight. */
function clip(points: Point[], score: (point: Point) => number): Point[] {
  const out: Point[] = [];
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const a = score(current);
    const b = score(next);
    if (a >= 0) out.push(current);
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b);
      out.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t]);
    }
  }
  return out;
}

interface Fold {
  front: string;
  flap: string;
  matrix: string;
  fold: string;
  amount: number;
}

/** The whole curl is one fold line: dragging the corner reflects the page across the perpendicular
 *  bisector of corner and target, and the same half-plane cut splits the flat part from the turned part. */
function fold(px: number, py: number, width: number, height: number, anchorY: number): Fold {
  let x = px;
  let y = py;
  const origin: Point = [0, anchorY];
  const hinge: Point = [0, height - anchorY];

  // The corner cannot travel further than a page width from either end of the spine.
  let distance = Math.hypot(x - origin[0], y - origin[1]);
  if (distance > width) {
    x = origin[0] + ((x - origin[0]) * width) / distance;
    y = origin[1] + ((y - origin[1]) * width) / distance;
  }
  const reach = Math.hypot(width, height);
  distance = Math.hypot(x - hinge[0], y - hinge[1]);
  if (distance > reach) {
    x = hinge[0] + ((x - hinge[0]) * reach) / distance;
    y = hinge[1] + ((y - hinge[1]) * reach) / distance;
  }

  const flat: Point[] = [[0, 0], [width, 0], [width, height], [0, height]];
  const dx = width - x;
  const dy = anchorY - y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return { front: polygon(flat), flap: emptyPolygon, matrix: "none", fold: "none", amount: 0 };

  const gx = dx / length;
  const gy = dy / length;
  const cx = (width + x) / 2;
  const cy = (anchorY + y) / 2;
  const score = ([sx, sy]: Point) => (sx - cx) * gx + (sy - cy) * gy;
  const offset = cx * gx + cy * gy;
  const degrees = (180 * Math.atan2(gy, gx)) / Math.PI;

  return {
    front: polygon(clip(flat, (point) => -score(point))),
    flap: polygon(clip(flat, score)),
    matrix: `matrix(${1 - 2 * gx * gx}, ${-2 * gx * gy}, ${-2 * gx * gy}, ${1 - 2 * gy * gy}, ${2 * offset * gx}, ${2 * offset * gy})`,
    fold: `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px) rotate(${degrees.toFixed(3)}deg)`,
    amount: Math.min(1, length / width),
  };
}

const noopSubscribe = () => () => {};

function Page({ children, blank }: { children?: ReactNode; blank?: boolean }) {
  return (
    <div className={styles.page} data-blank={blank || undefined}>
      {children}
    </div>
  );
}

function Shade({ at, className, opacity }: { at: MotionValue<string>; className: string; opacity?: MotionValue<number> }) {
  return <motion.div className={`${styles.shade} ${className}`} style={{ transform: at, opacity }} />;
}

export interface PageCurlProps {
  /** One node per page, in reading order. The first page is the cover, so spreads alternate right-then-left. */
  pages: ReactNode[];
  /** Controlled spread index in pages, counting the cover as page 1. */
  spread?: number;
  /** Spread shown before the first turn when uncontrolled. */
  defaultSpread?: number;
  /** Called with the new spread after a turn commits. */
  onSpreadChange?: (spread: number) => void;
  /** Page width over height. A page is half the book width tall this much. */
  pageAspect?: number;
  /** Accessible name of the book. */
  label?: string;
  /** Lets the first visible corner lift on its own, and lifts it a little when the pointer arrives. */
  tease?: boolean;
  /** Hint under the book. Pass null to hide it. */
  hint?: ReactNode;
  /** Shows the previous/next buttons and the page count. */
  controls?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A page-turn book: drag either page edge and the sheet folds over on a real curl, then springs to the
 *  next spread or falls back. Arrow keys, the controls, and corner hover all drive the same turn. */
export function PageCurl({
  pages,
  spread,
  defaultSpread = 0,
  onSpreadChange,
  pageAspect = 0.72,
  label = "Book",
  tease = true,
  hint = "Drag the corner",
  controls = true,
  className,
  style,
}: PageCurlProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduced = (useReducedMotion() ?? false) && mounted;
  const last = Math.ceil(pages.length / 2);
  const [ownSpread, setOwnSpread] = useState(defaultSpread);
  const controlled = spread !== undefined;
  const index = Math.max(0, Math.min(last, controlled ? spread : ownSpread));
  const [turn, setTurn] = useState<{ dir: 1 | -1; cy: number; mode: "drag" | "auto" | "tease" | "peek" } | null>(null);
  const [half, setHalf] = useState(0);
  const [width, setWidth] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const turnRef = useRef(turn);
  const indexRef = useRef(index);

  useLayoutEffect(() => {
    turnRef.current = turn;
    indexRef.current = index;
  }, [turn, index]);

  const setTurnNow = useCallback((next: typeof turn) => {
    turnRef.current = next;
    setTurn(next);
  }, []);

  const runs = useRef<AnimationPlaybackControls[]>([]);
  const [interacted, setInteracted] = useState(false);
  const lastTease = useRef(0);
  const teaseTimer = useRef(0);
  const drag = useRef<{ id: number; bx: number; by: number; px: number; py: number; samples: { x: number; t: number }[]; moved: boolean; start: number } | null>(null);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setWidth(node.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pageW = Math.max(1, Math.floor(width / 2));
  const pageH = Math.round(pageW / pageAspect);
  const size = useMotionValue({ w: pageW, h: pageH });
  useLayoutEffect(() => {
    size.set({ w: pageW, h: pageH });
  }, [pageW, pageH, size]);

  const cornerX = useMotionValue(pageW);
  const cornerY = useMotionValue(pageH);
  const anchorY = useMotionValue(pageH);
  const geometry = useTransform(() => {
    const { w, h } = size.get();
    return fold(cornerX.get(), cornerY.get(), w, h, anchorY.get());
  });
  const frontPath = useTransform(geometry, (value) => value.front);
  const flapPath = useTransform(geometry, (value) => value.flap);
  const foldMatrix = useTransform(geometry, (value) => value.matrix);
  const foldOrigin = useTransform(geometry, (value) => value.fold);
  const curlOpacity = useTransform(geometry, (value) => 0.9 * Math.sin(Math.min(1, value.amount) * Math.PI * 0.5 + 0.15));

  // While a turn is in flight the book shifts by a page so both leaves sit where the eye expects.
  const [delta, setDelta] = useState(0);
  const shown = Math.max(0, Math.min(last, index + delta));
  const shift = shown === 0 ? -pageW / 2 : pages[2 * shown] ? 0 : pageW / 2;
  const bookShift = useSpring(shift, { stiffness: 170, damping: 26 });

  useEffect(() => {
    if (reduced) bookShift.jump(shift);
    else bookShift.set(shift);
  }, [bookShift, shift, reduced]);

  const jumped = useRef(true);
  useEffect(() => {
    if (pageW > 1 && jumped.current) {
      jumped.current = false;
      bookShift.jump(shift);
    }
  }, [pageW, bookShift, shift]);

  const stopRuns = () => {
    window.clearTimeout(teaseTimer.current);
    runs.current.forEach((run) => run.stop());
    runs.current = [];
  };

  useEffect(() => () => stopRuns(), []);

  const canTurn = useCallback(
    (dir: 1 | -1) => (dir === 1 ? !!pages[2 * indexRef.current] : !!pages[2 * indexRef.current - 1]),
    [pages],
  );

  const commit = useCallback((dir: 1 | -1) => {
    const next = indexRef.current + dir;
    indexRef.current = next;
    setDelta(0);
    setTurnNow(null);
    setInteracted(true);
    if (!controlled) setOwnSpread(next);
    onSpreadChange?.(next);
  }, [controlled, onSpreadChange, setTurnNow]);

  const settle = useCallback((forward: boolean, velocity = 0) => {
    const current = turnRef.current;
    if (!current) return;
    stopRuns();
    if (reduced) {
      if (forward) commit(current.dir);
      else setTurnNow(null);
      return;
    }
    setDelta(forward ? current.dir : 0);
    const spring = { type: "spring" as const, stiffness: 190, damping: 28, restDelta: 0.5 };
    runs.current = [
      animate(cornerY, current.cy, spring),
      animate(cornerX, forward ? -pageW : pageW, {
        ...spring,
        velocity,
        onComplete: () => {
          if (forward) commit(current.dir);
          else setTurnNow(null);
        },
      }),
    ];
  }, [pageW, cornerX, cornerY, commit, reduced, setTurnNow]);

  const autoTurn = useCallback((dir: 1 | -1) => {
    if (!canTurn(dir) || drag.current || turnRef.current?.mode === "auto") return;
    stopRuns();
    if (reduced) {
      commit(dir);
      return;
    }
    const same = turnRef.current?.dir === dir;
    const cy = same ? (turnRef.current as { cy: number }).cy : pageH;
    if (!same) {
      anchorY.set(cy);
      cornerX.set(pageW);
      cornerY.set(cy);
    }
    const from = { x: cornerX.get(), y: cornerY.get() };
    setTurnNow({ dir, cy, mode: "auto" });
    setDelta(dir);
    runs.current = [
      animate(0, 1, {
        duration: 0.72,
        ease: [0.45, 0.05, 0.25, 1],
        onUpdate: (t) => {
          cornerX.set(from.x + (-pageW - from.x) * t);
          cornerY.set(from.y + (cy - from.y) * t + (cy === pageH ? -1 : 1) * Math.sin(Math.PI * t) * pageH * 0.16);
        },
        onComplete: () => commit(dir),
      }),
    ];
  }, [pageH, pageW, canTurn, commit, anchorY, cornerX, cornerY, reduced, setTurnNow]);

  const teaseCorner = useCallback((amount: number) => {
    if (reduced || turnRef.current || drag.current || !canTurn(1) || pageW < 2) return;
    stopRuns();
    lastTease.current = performance.now();
    anchorY.set(pageH);
    cornerX.set(pageW);
    cornerY.set(pageH);
    setTurnNow({ dir: 1, cy: pageH, mode: "tease" });
    const spring = { type: "spring" as const, visualDuration: 0.55, bounce: 0.18 };
    runs.current = [
      animate(cornerX, pageW * (1 - amount), spring),
      animate(cornerY, pageH * (1 - 0.5 * amount), spring),
    ];
    teaseTimer.current = window.setTimeout(() => {
      if (turnRef.current?.mode === "tease" && !drag.current) settle(false);
    }, 820);
  }, [pageH, pageW, anchorY, canTurn, cornerX, cornerY, reduced, settle, setTurnNow]);

  const teaseRef = useRef(teaseCorner);
  useLayoutEffect(() => {
    teaseRef.current = teaseCorner;
  }, [teaseCorner]);

  useEffect(() => {
    const node = root.current;
    if (!tease || pageW <= 1 || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      timer = window.setTimeout(() => teaseRef.current(0.26), 650);
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [tease, pageW]);

  const local = (clientX: number, clientY: number) => {
    const box = book.current?.getBoundingClientRect();
    if (!box) return { bx: 0, by: 0 };
    return { bx: clientX - box.left, by: clientY - box.top };
  };
  const cornerDistance = (dir: 1 | -1, x: number) => (dir === 1 ? x - pageW : pageW - x);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const { bx, by } = local(event.clientX, event.clientY);
    const current = turnRef.current;
    let dir: 1 | -1;
    if (current && current.mode !== "auto") dir = current.dir;
    else if (!current && bx > pageW && canTurn(1)) dir = 1;
    else if (!current && bx < pageW && canTurn(-1)) dir = -1;
    else return;

    stopRuns();
    setInteracted(true);
    setDelta(0);
    event.currentTarget.setPointerCapture(event.pointerId);
    const cy = current ? current.cy : by < pageH / 2 ? 0 : pageH;
    if (!current) {
      anchorY.set(cy);
      cornerX.set(pageW);
      cornerY.set(cy);
    }
    setTurnNow({ dir, cy, mode: "drag" });
    drag.current = {
      id: event.pointerId,
      bx,
      by,
      px: cornerX.get(),
      py: cornerY.get(),
      samples: [{ x: cornerDistance(dir, bx), t: performance.now() }],
      moved: false,
      start: performance.now(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const { bx, by } = local(event.clientX, event.clientY);
    const dragState = drag.current;
    if (dragState && dragState.id === event.pointerId) {
      const current = turnRef.current;
      if (!current) return;
      const dx = (bx - dragState.bx) * current.dir;
      const dy = by - dragState.by;
      if (Math.hypot(dx, dy) > 4) dragState.moved = true;
      cornerX.set(dragState.px + dx);
      cornerY.set(dragState.py + dy);
      dragState.samples.push({ x: cornerDistance(current.dir, bx), t: performance.now() });
      if (dragState.samples.length > 6) dragState.samples.shift();
      return;
    }
    if (event.pointerType !== "mouse") return;
    setHalf(bx > pageW && canTurn(1) ? 1 : bx < pageW && canTurn(-1) ? -1 : 0);
    if (reduced || (turnRef.current && turnRef.current.mode !== "peek")) return;

    // The four outer corners lift when the pointer is near them, so the affordance is discoverable.
    const near = (x: number, y: number) => Math.hypot(bx - x, by - y) < 44;
    const target = canTurn(1) && near(2 * pageW, pageH) ? { dir: 1 as const, cy: pageH, mode: "peek" as const }
      : canTurn(1) && near(2 * pageW, 0) ? { dir: 1 as const, cy: 0, mode: "peek" as const }
        : canTurn(-1) && near(0, pageH) ? { dir: -1 as const, cy: pageH, mode: "peek" as const }
          : canTurn(-1) && near(0, 0) ? { dir: -1 as const, cy: 0, mode: "peek" as const }
            : null;
    const current = turnRef.current;
    if (target && (!current || current.dir !== target.dir || current.cy !== target.cy)) {
      stopRuns();
      anchorY.set(target.cy);
      cornerX.set(pageW);
      cornerY.set(target.cy);
      setTurnNow(target);
      const spring = { type: "spring" as const, visualDuration: 0.35, bounce: 0.25 };
      runs.current = [
        animate(cornerX, pageW - 34, spring),
        animate(cornerY, target.cy + (target.cy ? -26 : 26), spring),
      ];
    } else if (!target && current?.mode === "peek") settle(false);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = drag.current;
    if (!dragState || dragState.id !== event.pointerId) return;
    drag.current = null;
    const current = turnRef.current;
    if (!current) return;
    const first = dragState.samples[0];
    const final = dragState.samples[dragState.samples.length - 1];
    const velocity = final.t - first.t > 0 ? (final.x - first.x) / ((final.t - first.t) / 1000) : 0;
    if (!dragState.moved && performance.now() - dragState.start < 400) {
      setTurnNow({ ...current, mode: "peek" });
      autoTurn(current.dir);
      return;
    }
    settle(cornerX.get() + 0.14 * velocity < 0.5 * pageW || velocity < -700, velocity);
  };

  const turnPage = (dir: 1 | -1) => {
    setInteracted(true);
    autoTurn(dir);
  };

  const pageAt = (at: number) => pages[at];
  const renderPage = (at: number) => (pageAt(at) === undefined ? null : <Page>{pageAt(at)}</Page>);

  const dir = turn?.dir ?? 0;
  const leftIndex = dir === -1 ? 2 * index - 3 : 2 * index - 1;
  const rightIndex = dir === 1 ? 2 * index + 2 : 2 * index;
  const frontIndex = dir === 1 ? 2 * index : 2 * index - 1;
  const flapIndex = dir === 1 ? 2 * index + 1 : 2 * index - 2;
  const hasFlap = dir !== 0 && pageAt(flapIndex) !== undefined;
  const leftPage = 2 * index - 1 >= 0 && pageAt(2 * index - 1) !== undefined ? 2 * index : null;
  const rightPage = pageAt(2 * index) !== undefined ? 2 * index + 1 : null;
  const shownPages = [leftPage, rightPage].filter((value): value is number => value !== null).join(" and ");
  const countLabel = index === 0 ? "Cover" : rightPage === null ? "Back cover" : leftPage === null ? `Page ${rightPage}` : `Pages ${leftPage}\u2013${rightPage}`;
  const hasNext = pageAt(2 * index) !== undefined;
  const hasPrev = pageAt(2 * index - 1) !== undefined;

  return (
    <div
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{
        ...style,
        "--page-w": `${pageW}px`,
        "--page-h": `${pageH}px`,
        "--diag": `${Math.ceil(Math.hypot(pageW, pageH))}px`,
      } as CSSProperties}
      role="group"
      aria-roledescription="book"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          turnPage(1);
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          turnPage(-1);
        }
      }}
      data-ready={width ? "" : undefined}
    >
      <motion.div
        ref={book}
        className={styles.book}
        style={{ x: bookShift }}
        data-half={half || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(event) => {
          setHalf(0);
          if (event.pointerType === "mouse" && !drag.current && turnRef.current?.mode === "peek") settle(false);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse" || !tease || interacted || performance.now() - lastTease.current < 2500) return;
          teaseCorner(0.13);
        }}
      >
        <div className={`${styles.slot} ${styles.left}`}>{renderPage(leftIndex)}</div>
        <div className={`${styles.slot} ${styles.right}`}>{renderPage(rightIndex)}</div>
        {pageAt(2 * index - 1) !== undefined && pageAt(2 * index) !== undefined && !turn && <div className={styles.gutter} aria-hidden="true" />}
        <div className={`${styles.edge} ${styles.edgeLeft}`} aria-hidden="true" data-on={hasPrev || undefined}>
          <span className={styles.cue}>
            <ChevronLeft size={16} strokeWidth={1.75} />
          </span>
        </div>
        <div className={`${styles.edge} ${styles.edgeRight}`} aria-hidden="true" data-on={hasNext || undefined}>
          <span className={styles.cue}>
            <ChevronRight size={16} strokeWidth={1.75} />
          </span>
        </div>
        {hint !== null && hasNext && (
          <p className={styles.hint} data-hidden={interacted || undefined} aria-hidden="true">
            {hint}
            <MoveUpRight size={14} strokeWidth={1.75} />
          </p>
        )}
        {turn && (
          <div className={styles.turn} data-dir={dir} aria-hidden="true">
            <motion.div className={styles.front} style={{ clipPath: frontPath }}>
              <div className={dir === -1 ? styles.mirror : undefined}>{renderPage(frontIndex)}</div>
              <Shade at={foldOrigin} className={styles.frontCurl} opacity={curlOpacity} />
            </motion.div>
            <motion.div className={styles.under} style={{ clipPath: flapPath }}>
              <Shade at={foldOrigin} className={styles.underShadow} opacity={curlOpacity} />
            </motion.div>
            <div className={styles.flapWrap}>
              <motion.div className={styles.flap} style={{ clipPath: flapPath, transform: foldMatrix }}>
                <div className={dir === 1 ? styles.mirror : undefined}>
                  {hasFlap ? renderPage(flapIndex) : <Page blank />}
                </div>
                <Shade at={foldOrigin} className={styles.flapCurl} />
              </motion.div>
            </div>
          </div>
        )}
      </motion.div>
      {controls && (
        <div className={styles.controls}>
          <button type="button" className={styles.control} onClick={() => turnPage(-1)} disabled={!hasPrev} aria-label="Previous page">
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <p className={styles.count} aria-hidden="true">
            <span>{countLabel}</span>
            <span className={styles.total}>{index === 0 || rightPage === null ? `${pages.length} pages` : `of ${pages.length}`}</span>
          </p>
          <button type="button" className={styles.control} onClick={() => turnPage(1)} disabled={!hasNext} aria-label="Next page">
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      )}
      <span className={styles.status} role="status">
        {shownPages ? `Page ${shownPages} of ${pages.length}` : ""}
      </span>
    </div>
  );
}

export default PageCurl;
