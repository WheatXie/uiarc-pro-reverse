"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, LayoutGroup, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Check, LoaderCircle, Rocket, X } from "lucide-react";
import AnimatedCounter from "../animated-counter/animated-counter";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../lib/motion-tokens";
import { person, type PersonId } from "../lib/media";
import styles from "./spotlight-grid.module.css";

const { spring, duration, blur } = motionTokens;
const ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const IN_OUT = [...motionTokens.ease.inOut] as [number, number, number, number];
const STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];

/** A spring tuned by frequency and damping, so the card surface and the detail land as one gesture. */
const springFor = (frequency: number, damping: number) => {
  const omega = (2 * Math.PI) / (1.2 * frequency);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - damping) * omega, mass: 1 };
};
/** Opening travels further, so it gets a slightly slower spring than closing. */
const OPEN = springFor(0.5, 0);
const CLOSE = springFor(0.4, 0);

interface CardData { id: string; title: string; blurb: string; wide?: boolean }

const CARDS: CardData[] = [
  { id: "latency", title: "Latency, as it happens", blurb: "Every route traced from the edge, with p95 updated each minute.", wide: true },
  { id: "deploys", title: "Deploys on autopilot", blurb: "Merges to main ship on their own once checks pass." },
  { id: "flags", title: "Flags without redeploys", blurb: "Release to a slice of traffic and widen it when it holds." },
  { id: "review", title: "Review in the preview", blurb: "Comments pin to the page your team is actually looking at.", wide: true },
];

/** A deterministic wobble: the same series on the server and the client, so the chart never hydrates twice. */
function noise(seed: number, count: number, center: number, amplitude: number) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 7.3 * seed;
    return Math.round(center + amplitude * (0.45 * Math.sin(0.55 * n) + 0.3 * Math.sin(1.37 * n + seed) + 0.25 * Math.sin(2.9 * n + 2 * seed)));
  });
}

const percentile = (values: number[], share: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(share * values.length) - 1)];
const fixed = (value: number) => value.toFixed(1);
/** Value to y, inset so the stroke never touches the top or bottom edge. */
const toY = (value: number, height: number, min: number, max: number, inset = 8) => inset + (1 - (value - min) / (max - min)) * (height - 2 * inset);
/** A smooth cubic through every point: half the distance to the neighbours, which keeps the curve inside the data. */
function smoothPath(values: number[], width: number, height: number, min: number, max: number) {
  const points = values.map((value, index) => [(index / (values.length - 1)) * width, toY(value, height, min, max)]);
  let path = `M${fixed(points[0][0])} ${fixed(points[0][1])}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    path += ` C${fixed(current[0] + (next[0] - previous[0]) / 6)} ${fixed(current[1] + (next[1] - previous[1]) / 6)} ${fixed(next[0] - (after[0] - current[0]) / 6)} ${fixed(next[1] - (after[1] - current[1]) / 6)} ${fixed(next[0])} ${fixed(next[1])}`;
  }
  return path;
}

const SPARK = noise(4, 72, 124, 56);

type Range = "24h" | "7d" | "30d";
const RANGES: Record<Range, { values: number[]; axis: string[]; errors: string }> = {
  "24h": { values: noise(1, 32, 128, 64), axis: ["12 AM", "12 PM", "Now"], errors: "0.02%" },
  "7d": { values: noise(2, 32, 150, 84), axis: ["Sep 16", "Sep 20", "Now"], errors: "0.04%" },
  "30d": { values: noise(3, 32, 138, 52), axis: ["Aug 24", "Sep 8", "Now"], errors: "0.03%" },
};
const RANGE_OPTIONS = (Object.keys(RANGES) as Range[]).map(value => ({ value, label: value }));

/** Requests waiting in the review queue, cycled when a new deploy lands. */
const COMMENTS = [
  { message: "Cache product images at the edge", who: "marcus-johnson" },
  { message: "Fix double submit on checkout", who: "olivia-bennett" },
  { message: "Retry failed webhook deliveries", who: "daniel-kim" },
  { message: "Tighten hero spacing on pricing", who: "emma-collins" },
];

const SHIP_HISTORY = [
  { id: 3, message: "Move session store to the new region", who: "olivia-bennett", when: "4 min ago" },
  { id: 2, message: "Add empty state to invoices", who: "emma-collins", when: "18 min ago" },
  { id: 1, message: "Bump image optimizer to 2.4", who: "daniel-kim", when: "1 hr ago" },
];

const ROLLOUT_OPTIONS = [
  { value: "5", label: "5%" },
  { value: "25", label: "25%" },
  { value: "100", label: "100%" },
];

const REVIEW_FACES = ["jasmine-brooks", "marcus-johnson", "chloe-nguyen", "daniel-kim"];

const REVIEW_COMMENTS = [
  { who: "jasmine-brooks", text: "Tighten the hero spacing on mobile, it crowds the fold.", when: "9 min ago" },
  { who: "marcus-johnson", text: "Checkout button matches the new radius now. Looks right.", when: "6 min ago" },
  { who: "chloe-nguyen", text: "Conversion event fires once per order. Verified here.", when: "2 min ago" },
];

const noopSubscribe = () => () => {};
const isMounted = () => true;
const neverMounted = () => false;

/** Crossfades a short label in place. The old one leaves upward while the new one rises into its slot. */
function TextSwap({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={className}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${blur.subtle}px)` }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.35em", filter: `blur(${blur.subtle}px)`, transition: { duration: duration.fast } }}
          transition={reduced ? { duration: duration.instant } : { duration: duration.standard, ease: ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Numbers roll digit by digit, so 1284 → 1285 moves one wheel, not the whole figure. */
function Num({ value }: { value: number }) {
  return <span className={styles.num}><AnimatedCounter value={value} /></span>;
}

function Face({ who, size = 24, className }: { who: string; size?: number; className?: string }) {
  return <ArcImage className={[styles.avatar, className].filter(Boolean).join(" ")} src={person(who as PersonId).src} alt="" width={size} height={size} sizes={`${size}px`} />;
}

/** A pill group with roving tabindex: one tab stop, arrows move the selection. */
function Segmented({ label, options, value, onChange, disabled, reduced, pillId }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean; reduced: boolean; pillId: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={node => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            className={styles.segment}
            onClick={() => onChange(option.value)}
            onKeyDown={event => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = (index + step + options.length) % options.length;
              onChange(options[next].value);
              refs.current[next]?.focus();
            }}
          >
            {checked && <motion.span layoutId={pillId} className={styles.segmentPill} transition={reduced ? { duration: 0 } : spring.morph} />}
            <span className={styles.segmentLabel}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The latency card's preview: the last 24 samples of the spark series, scrolling one step every 1.1 s while hovered. */
function LatencyMini({ active, seen, reduced }: { active: boolean; seen: boolean; reduced: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    const timer = window.setInterval(() => setTick(current => current + 1), 1100);
    return () => window.clearInterval(timer);
  }, [active, reduced]);
  const series = Array.from({ length: 24 }, (_, index) => SPARK[(tick + index) % SPARK.length]);
  const path = smoothPath(series, 320, 84, 50, 210);
  const dot = (toY(series[series.length - 1], 84, 50, 210) / 84) * 100;
  const morph = reduced ? { duration: 0 } : { duration: 0.7, ease: IN_OUT };
  return (
    <div className={styles.latencyMini}>
      <div className={styles.miniHead}>
        <span className={styles.miniLabel}>p95</span>
        <span className={styles.miniValue}><Num value={percentile(series, 0.95)} /> ms</span>
        <span className={styles.live} data-on={active || undefined}>Live</span>
      </div>
      <div className={styles.spark}>
        <svg viewBox="0 0 320 84" preserveAspectRatio="none" className={styles.sparkSvg}>
          <motion.path
            d={path}
            className={styles.sparkLine}
            vectorEffect="non-scaling-stroke"
            initial={!reduced && { d: path, pathLength: 0 }}
            animate={{ d: path, pathLength: reduced || seen ? 1 : 0 }}
            transition={{ d: morph, pathLength: reduced ? { duration: 0 } : { duration: 1.3, ease: ENTER, delay: 0.15 } }}
          />
        </svg>
        <motion.span className={styles.sparkDot} initial={false} animate={{ top: `${dot}%`, opacity: reduced || seen ? 1 : 0, scale: reduced || seen ? 1 : 0.6 }} transition={{ top: morph, opacity: { duration: 0.2, delay: 1.2 * (reduced ? 0 : 1) }, scale: reduced ? { duration: 0 } : { ...spring.snappy, delay: 1.2 } }} />
      </div>
    </div>
  );
}

/** The deploys card's preview: eighteen ticks whose heights come from the deploy id, one added per hover tick. */
function DeploysMini({ count, seen, reduced }: { count: number; seen: boolean; reduced: boolean }) {
  const ticks = Array.from({ length: 18 }, (_, index) => count - 17 + index);
  const justLanded = count === 1284;
  return (
    <div className={styles.deploysMini}>
      <div className={styles.bigStat}>
        <span className={styles.bigNum}><Num value={count} /></span>
        <span className={styles.caption}>deploys this week</span>
      </div>
      <div className={styles.ticks}>
        <AnimatePresence initial={false} mode="popLayout">
          {ticks.map((value, index) => (
            <motion.span
              key={value}
              layout={!reduced}
              className={styles.tick}
              data-new={value === count || undefined}
              style={{ height: 10 + ((7 * value) % 13) * 1.6 }}
              initial={{ opacity: 0, scaleY: 0.2 }}
              animate={{ opacity: reduced || seen ? 1 : 0, scaleY: reduced || seen ? 1 : 0.2 }}
              exit={{ opacity: 0, scaleY: 0.2, transition: { duration: duration.fast } }}
              transition={reduced ? { duration: 0 } : { ...spring.snappy, delay: justLanded ? 0.1 + 0.025 * index : 0 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The flags card's preview: the switch and the meter move together, and the caption names the rollout. */
function FlagsMini({ active, reduced }: { active: boolean; reduced: boolean }) {
  const on = active || reduced;
  return (
    <div className={styles.flagsMini}>
      <div className={styles.flagRow}>
        <code className={styles.flagKey}>new-checkout</code>
        <span className={styles.switchTrack} data-on={on || undefined} data-size="sm">
          <motion.span className={styles.switchThumb} initial={false} animate={{ x: 14 * (on ? 1 : 0) }} transition={reduced ? { duration: 0 } : spring.snappy} />
        </span>
      </div>
      <div className={styles.meter}>
        <motion.span className={styles.meterFill} initial={false} animate={{ scaleX: 0.25 * (on ? 1 : 0) }} transition={reduced ? { duration: 0 } : { ...spring.morph, delay: 0.08 * (on ? 1 : 0) }} />
      </div>
      <span className={styles.caption}><TextSwap text={on ? "25% of traffic" : "Off for everyone"} reduced={reduced} /></span>
    </div>
  );
}

/** The review card's preview: a page skeleton, a comment pin and the faces reading it. */
function ReviewMini({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <div className={styles.reviewMini}>
      <div className={styles.page}>
        <span className={styles.pageBar} />
        <span className={styles.pageHero} />
        <span className={styles.pageLine} />
        <span className={styles.pageLine} data-short="" />
        <AnimatePresence initial={false}>
          {(active || reduced) && (
            <motion.span
              className={styles.pin}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: STANDARD } }}
              transition={reduced ? { duration: 0 } : spring.snappy}
            >
              <Face who="jasmine-brooks" size={20} />
              <span>Tighten the hero spacing?</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.stack}>
        {REVIEW_FACES.map(who => <Face key={who} who={who} size={26} />)}
      </div>
    </div>
  );
}

/** Full latency view: the same series at full height, with the range switched inside the card. */
function LatencyDetail({ reduced, pillId }: { reduced: boolean; pillId: string }) {
  const [range, setRange] = useState<Range>("24h");
  const { values, axis, errors } = RANGES[range];
  const line = smoothPath(values, 640, 200, 40, 250);
  const area = `${line} L640 200 L0 200 Z`;
  const p95 = percentile(values, 0.95);
  const p50 = percentile(values, 0.5);
  const p95Y = toY(p95, 200, 40, 250);
  const morph = reduced ? { duration: 0 } : { duration: 0.6, ease: IN_OUT };
  return (
    <div className={styles.detailStack}>
      <div className={styles.detailRow}>
        <dl className={styles.stats}>
          <div><dt>p95</dt><dd><Num value={p95} /> ms</dd></div>
          <div><dt>p50</dt><dd><Num value={p50} /> ms</dd></div>
          <div><dt>Errors</dt><dd><TextSwap text={errors} reduced={reduced} /></dd></div>
        </dl>
        <Segmented label="Time range" options={RANGE_OPTIONS} value={range} onChange={value => setRange(value as Range)} reduced={reduced} pillId={pillId} />
      </div>
      <div className={styles.chart}>
        <svg viewBox="0 0 640 200" preserveAspectRatio="none" className={styles.chartSvg} role="img" aria-label={`Latency over ${range}, p95 ${p95} milliseconds`}>
          {[0.25, 0.5, 0.75].map(share => <line key={share} x1="0" x2={640} y1={200 * share} y2={200 * share} className={styles.gridLine} vectorEffect="non-scaling-stroke" />)}
          <motion.path d={area} className={styles.chartArea} initial={false} animate={{ d: area }} transition={morph} />
          <motion.line x1="0" x2={640} y1={p95Y} y2={p95Y} className={styles.p95Line} vectorEffect="non-scaling-stroke" initial={false} animate={{ y1: p95Y, y2: p95Y }} transition={morph} />
          <motion.path d={line} className={styles.chartLine} vectorEffect="non-scaling-stroke" initial={false} animate={{ d: line }} transition={morph} />
        </svg>
        <div className={styles.axis} aria-hidden="true">
          {axis.map((label, index) => <TextSwap key={index} text={label} reduced={reduced} />)}
        </div>
      </div>
    </div>
  );
}

/** Full deploys view: the count, a working ship button and the deploy log it writes into. */
function DeploysDetail({ count, recent, onShip, reduced }: { count: number; recent: typeof SHIP_HISTORY; onShip: () => void; reduced: boolean }) {
  const [phase, setPhase] = useState<"idle" | "shipping" | "shipped">("idle");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);
  const ship = () => {
    if (phase !== "idle") return;
    setPhase("shipping");
    timers.current.push(
      window.setTimeout(() => {
        onShip();
        setPhase("shipped");
        timers.current.push(window.setTimeout(() => setPhase("idle"), 1400));
      }, reduced ? 400 : 1100),
    );
  };
  return (
    <div className={styles.detailStack}>
      <div className={styles.detailRow}>
        <div className={styles.bigStat}>
          <span className={styles.bigNum}><Num value={count} /></span>
          <span className={styles.caption}>deploys this week, all checks passing</span>
        </div>
        <button type="button" className={styles.primary} onClick={ship} aria-disabled={phase !== "idle" || undefined} data-state={phase}>
          <span className={styles.labels}>
            <span data-on={phase === "idle" || undefined} aria-hidden={phase !== "idle" || undefined}><Rocket size={16} strokeWidth={1.75} aria-hidden="true" />Ship a deploy</span>
            <span data-on={phase === "shipping" || undefined} aria-hidden={phase !== "shipping" || undefined}><LoaderCircle className={styles.spin} size={16} strokeWidth={1.75} aria-hidden="true" />Deploying</span>
            <span data-on={phase === "shipped" || undefined} aria-hidden={phase !== "shipped" || undefined}><Check size={16} strokeWidth={1.75} aria-hidden="true" />Shipped</span>
          </span>
        </button>
      </div>
      <ol className={styles.deployList} aria-label="Recent deploys">
        <AnimatePresence initial={false} mode="popLayout">
          {recent.map(deploy => (
            <motion.li
              key={deploy.id}
              layout={!reduced}
              className={styles.deployRow}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: `blur(${blur.subtle}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={{ opacity: 0, transition: { duration: duration.fast } }}
              transition={reduced ? { duration: 0 } : spring.smooth}
            >
              <Face who={deploy.who} />
              <span className={styles.deployText}>
                <span className={styles.deployMessage}>{deploy.message}</span>
                <span className={styles.deployMeta}>
                  {person(deploy.who as PersonId).name} · <code>{((0x9e3779b1 * deploy.id) >>> 0).toString(16).padStart(8, "0").slice(0, 7)}</code>
                </span>
              </span>
              <span className={styles.deployWhen} data-new={deploy.when === "Just now" || undefined}>{deploy.when}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <p className={styles.srOnly} aria-live="polite">{phase === "shipped" ? "Deploy shipped" : ""}</p>
    </div>
  );
}

/** Full flags view: the switch gates the rollout group, and the meter follows both. */
function FlagsDetail({ on, rollout, setOn, setRollout, reduced, pillId }: { on: boolean; rollout: number; setOn: (on: boolean) => void; setRollout: (rollout: number) => void; reduced: boolean; pillId: string }) {
  const share = on ? rollout : 0;
  return (
    <div className={styles.detailStack}>
      <div className={styles.detailRow}>
        <div className={styles.flagInfo}>
          <span className={styles.flagTitle} id={`${pillId}-name`}>New checkout</span>
          <span className={styles.caption}><code className={styles.flagKey}>new-checkout</code> in production</span>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-labelledby={`${pillId}-name`} className={styles.switchTrack} data-on={on || undefined} onClick={() => setOn(!on)}>
          <motion.span className={styles.switchThumb} initial={false} animate={{ x: 20 * (on ? 1 : 0) }} transition={reduced ? { duration: 0 } : spring.snappy} />
        </button>
      </div>
      <div className={styles.detailRow}>
        <span className={styles.caption}>Rollout</span>
        <Segmented label="Rollout" options={ROLLOUT_OPTIONS} value={String(rollout)} onChange={value => setRollout(Number(value))} disabled={!on} reduced={reduced} pillId={pillId} />
      </div>
      <div className={styles.meter} data-size="lg">
        <motion.span className={styles.meterFill} initial={false} animate={{ scaleX: share / 100 }} transition={reduced ? { duration: 0 } : spring.morph} />
      </div>
      <p className={styles.flagSummary}><Num value={Math.round((48200 * share) / 100)} /> <span>visitors a day see it</span></p>
      <p className={styles.footnote}>Changes apply without a redeploy.</p>
    </div>
  );
}

/** Full review view: the approval state, the approve button and the pinned comments. */
function ReviewDetail({ approved, setApproved, reduced }: { approved: boolean; setApproved: (approved: boolean) => void; reduced: boolean }) {
  return (
    <div className={styles.detailStack}>
      <div className={styles.detailRow}>
        <div className={styles.reviewStatus} data-approved={approved || undefined}>
          <span className={styles.statusDot} aria-hidden="true" />
          <TextSwap text={approved ? "Ready to merge" : "Waiting on your review"} reduced={reduced} />
          <span className={styles.caption}><Num value={approved ? 3 : 2} /> of 3 approvals</span>
        </div>
        <button type="button" className={styles.approve} aria-pressed={approved} data-on={approved || undefined} onClick={() => setApproved(!approved)}>
          <span className={styles.labels}>
            <span data-on={!approved || undefined} aria-hidden={approved || undefined}>Approve</span>
            <span data-on={approved || undefined} aria-hidden={!approved || undefined}><Check size={16} strokeWidth={1.75} aria-hidden="true" />Approved</span>
          </span>
        </button>
      </div>
      <ul className={styles.comments}>
        {REVIEW_COMMENTS.map(comment => (
          <li key={comment.who} className={styles.comment}>
            <Face who={comment.who} size={28} />
            <span className={styles.commentBody}>
              <span className={styles.commentHead}>
                <span className={styles.commentName}>{person(comment.who as PersonId).name}</span>
                <span className={styles.caption}>{comment.when}</span>
              </span>
              <span className={styles.commentText}>{comment.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.srOnly} aria-live="polite">{approved ? "Approved. Ready to merge." : ""}</p>
    </div>
  );
}

interface CardProps {
  card: CardData;
  gridRef: React.RefObject<HTMLDivElement | null>;
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  lit: ReturnType<typeof useMotionValue<number>>;
  isOpen: boolean;
  anyOpen: boolean;
  front: boolean;
  reduced: boolean;
  detailId: string;
  onOpen: () => void;
  mini: (active: boolean) => ReactNode;
}

/** One card: its own light, its preview, and the button that opens the detail in place. */
function Card({ card, gridRef, sx, sy, lit, isOpen, anyOpen, front, reduced, detailId, onOpen, mini }: CardProps) {
  const node = useRef<HTMLElement>(null);
  const blurbId = useId();
  const left = useMotionValue(0);
  const top = useMotionValue(0);
  const offsetX = useTransform(() => sx.get() - left.get());
  const offsetY = useTransform(() => sy.get() - top.get());
  const x = useMotionTemplate`${offsetX}px`;
  const y = useMotionTemplate`${offsetY}px`;
  const style = { "--x": x, "--y": y, "--lit": lit } as CSSProperties;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  // The light is positioned in grid coordinates, so card offsets are measured rather than assumed.
  useLayoutEffect(() => {
    const element = node.current;
    const grid = gridRef.current;
    if (!element || !grid) return;
    const measure = () => {
      left.set(element.offsetLeft);
      top.set(element.offsetTop);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    observer.observe(element);
    return () => observer.disconnect();
  }, [gridRef, left, top]);

  const active = (hovered || focused) && !anyOpen;
  const litHere = hovered && !anyOpen;

  return (
    <motion.article
      ref={node}
      className={styles.card}
      data-card={card.id}
      data-wide={card.wide || undefined}
      data-front={front || undefined}
      data-open={isOpen || undefined}
      data-hovered={litHere || undefined}
      style={style}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      {isOpen ? (
        <div className={styles.surface} data-ghost="" />
      ) : (
        <motion.div layoutId={reduced ? undefined : `surface-${card.id}`} className={styles.surface} style={{ borderRadius: 28 }} transition={CLOSE} />
      )}
      <span className={styles.wash} aria-hidden="true" />
      <span className={styles.light} aria-hidden="true" />
      <motion.div className={styles.stage} aria-hidden="true" initial={false} animate={{ opacity: isOpen ? 0 : 1 }} transition={{ duration: isOpen ? duration.instant : duration.standard, delay: isOpen || reduced ? 0 : duration.fast }}>
        {mini(active)}
      </motion.div>
      <div className={styles.copy}>
        <h3 className={styles.cardTitle}>
          <button
            type="button"
            className={styles.cardButton}
            aria-expanded={isOpen}
            aria-controls={isOpen ? detailId : undefined}
            aria-describedby={blurbId}
            onClick={() => { setHovered(false); onOpen(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            {isOpen ? (
              <span className={styles.titleText} data-hidden="">{card.title}</span>
            ) : (
              <motion.span layoutId={reduced ? undefined : `title-${card.id}`} layout="position" className={styles.titleText} transition={CLOSE}>{card.title}</motion.span>
            )}
          </button>
        </h3>
        <motion.p id={blurbId} className={styles.blurb} initial={false} animate={{ opacity: isOpen ? 0 : 1 }} transition={{ duration: isOpen ? duration.instant : duration.standard, delay: isOpen || reduced ? 0 : duration.fast }}>{card.blurb}</motion.p>
      </div>
    </motion.article>
  );
}

/** A deploy counter that ticks while its preview is hovered, so the card reads as live even before it opens. */
function HoverTicker({ active, reduced, onTick, children }: { active: boolean; reduced: boolean; onTick: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!active || reduced) return;
    const timer = window.setInterval(onTick, 900);
    return () => window.clearInterval(timer);
  }, [active, onTick, reduced]);
  return children;
}

export function SpotlightGrid() {
  const mounted = useSyncExternalStore(noopSubscribe, isMounted, neverMounted);
  const reduced = !!useReducedMotion() && mounted;
  const id = useId();
  const headingId = `${id}-heading`;
  const detailId = `${id}-detail`;
  const detailTitleId = `${id}-detail-title`;

  const arena = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const seen = useInView(grid, { once: true, amount: 0.3 });

  const [open, setOpen] = useState<string | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [layout, setLayout] = useState({ top: 0, minHeight: 0 });
  const [detailHeight, setDetailHeight] = useState(0);
  const [count, setCount] = useState(1284);
  const [ships, setShips] = useState(SHIP_HISTORY);
  const [flagOn, setFlagOn] = useState(false);
  const [rollout, setRollout] = useState(25);
  const [approved, setApproved] = useState(false);

  // The pointer light is two springs chasing the pointer, so it trails on purpose.
  const pointerX = useMotionValue(-9999);
  const pointerY = useMotionValue(-9999);
  const springX = useSpring(pointerX, { stiffness: 380, damping: 40 });
  const springY = useSpring(pointerY, { stiffness: 380, damping: 40 });
  const lit = useMotionValue(0);

  const moveLight = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || reduced || open) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (lit.get() < 0.05) {
      pointerX.jump(x);
      pointerY.jump(y);
      springX.jump(x);
      springY.jump(y);
    } else {
      pointerX.set(x);
      pointerY.set(y);
    }
    if (lit.get() < 1) animate(lit, 1, { duration: duration.standard, ease: ENTER });
  };
  const fadeLight = () => animate(lit, 0, { duration: duration.considered, ease: STANDARD });

  const tickCount = useCallback(() => setCount(current => current + 1), []);
  const ship = useCallback(() => {
    setCount(current => current + 1);
    setShips(current => {
      const nextId = (current[0]?.id ?? 0) + 1;
      const comment = COMMENTS[nextId % COMMENTS.length];
      return [
        { id: nextId, message: comment.message, who: comment.who, when: "Just now" },
        ...current.map(entry => (entry.when === "Just now" ? { ...entry, when: "1 min ago" } : entry)),
      ].slice(0, 4);
    });
  }, []);

  const lastOpen = useRef<string | null>(null);
  const close = useCallback(() => {
    lastOpen.current = open;
    setOpen(null);
  }, [open]);

  // Focus follows the detail: in when it opens, back to the card button when it closes.
  useLayoutEffect(() => {
    if (open) {
      closeButton.current?.focus({ preventScroll: true });
      return;
    }
    const previous = lastOpen.current;
    lastOpen.current = null;
    if (previous && grid.current) grid.current?.querySelector<HTMLElement>(`[data-card="${previous}"] button`)?.focus({ preventScroll: true });
  }, [open]);

  const measureDetail = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setDetailHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const previews: Record<string, (active: boolean) => ReactNode> = {
    latency: active => <LatencyMini active={active} seen={seen} reduced={reduced} />,
    deploys: active => (
      <HoverTicker active={active} reduced={reduced} onTick={tickCount}>
        <DeploysMini count={count} seen={seen} reduced={reduced} />
      </HoverTicker>
    ),
    flags: active => <FlagsMini active={active} reduced={reduced} />,
    review: active => <ReviewMini active={active} reduced={reduced} />,
  };
  const opened = CARDS.find(card => card.id === open);
  const details: Record<string, ReactNode> = {
    latency: <LatencyDetail reduced={reduced} pillId={`${id}-range`} />,
    deploys: <DeploysDetail count={count} recent={ships} onShip={ship} reduced={reduced} />,
    flags: <FlagsDetail on={flagOn} rollout={rollout} setOn={setFlagOn} setRollout={setRollout} reduced={reduced} pillId={`${id}-rollout`} />,
    review: <ReviewDetail approved={approved} setApproved={setApproved} reduced={reduced} />,
  };

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.heading}>From merge to production, in view</h2>
        <p className={styles.lede}>Four tools that stay quiet until you need them. Hover to preview one, open it to try it.</p>
      </header>
      <LayoutGroup id={id}>
        <motion.div ref={arena} className={styles.arena} initial={false} animate={{ minHeight: open ? layout.top + detailHeight : 0 }} transition={reduced ? { duration: 0 } : spring.smooth}>
          <div ref={grid} className={styles.grid} inert={!!open || undefined} onPointerEnter={moveLight} onPointerMove={moveLight} onPointerLeave={fadeLight}>
            {CARDS.map(card => (
              <Card
                key={card.id}
                card={card}
                gridRef={grid}
                sx={springX}
                sy={springY}
                lit={lit}
                isOpen={open === card.id}
                anyOpen={!!open}
                front={front === card.id}
                reduced={reduced}
                detailId={detailId}
                mini={previews[card.id]}
                onOpen={() => {
                  const area = arena.current;
                  const gridNode = grid.current;
                  const target = gridNode?.querySelector(`[data-card="${card.id}"]`);
                  if (!area || !gridNode || !target) return;
                  const top = area.offsetWidth < 520 ? (target as HTMLElement).offsetTop : 0;
                  setLayout({ top, minHeight: gridNode.offsetHeight - top });
                  fadeLight();
                  setFront(card.id);
                  setOpen(card.id);
                }}
              />
            ))}
          </div>
          <AnimatePresence onExitComplete={() => setDetailHeight(0)}>
            {opened && (
              <motion.div
                ref={measureDetail}
                key={opened.id}
                id={detailId}
                className={styles.detail}
                role="region"
                aria-labelledby={detailTitleId}
                style={{ top: layout.top, minHeight: layout.minHeight }}
                initial={reduced ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduced ? duration.instant : duration.exit, ease: STANDARD } }}
                transition={{ duration: duration.fast }}
              >
                <motion.div layoutId={reduced ? undefined : `surface-${opened.id}`} className={styles.detailSurface} style={{ borderRadius: 32 }} transition={OPEN} />
                <div className={styles.detailBody}>
                  <div className={styles.detailHeader}>
                    <h3 id={detailTitleId} className={styles.detailTitle}>
                      <motion.span layoutId={reduced ? undefined : `title-${opened.id}`} layout="position" className={styles.titleText} transition={OPEN}>{opened.title}</motion.span>
                    </h3>
                    <motion.button
                      ref={closeButton}
                      type="button"
                      className={styles.close}
                      aria-label="Close"
                      onClick={close}
                      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduced ? { duration: 0 } : { ...spring.snappy, delay: 0.12 }}
                    >
                      <X size={18} strokeWidth={1.75} aria-hidden="true" />
                    </motion.button>
                  </div>
                  <motion.p className={styles.detailBlurb} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.standard, delay: 0.08 }}>{opened.blurb}</motion.p>
                  <motion.div className={styles.detailContent} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ opacity: { duration: duration.standard, delay: 0.12, ease: ENTER }, y: { ...spring.smooth, delay: 0.08 } }}>
                    {details[opened.id]}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
    </section>
  );
}

export default SpotlightGrid;
