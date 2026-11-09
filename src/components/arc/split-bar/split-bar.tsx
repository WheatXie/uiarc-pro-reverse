"use client";

/**
 * Split bar — a single 100% bar split into shares.
 *
 * Reconstructed from the shipped Pro preview chunk: each segment is a full-width layer cut to its
 * share with an animated clip-path, the highlighted one widens while the others give way
 * proportionally, labels sit inside the layer when they fit (and slide with it, cut at the edge)
 * or move to a lane under the bar with S-curve leader lines, and every figure rolls like an
 * odometer. The legend switches segments off and the rest reflow on springs.
 */
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionStyle } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./split-bar.module.css";

/** One share of the bar. */
export interface SplitSegment {
  /** Stable identity. Segments are matched by id when the data changes, so a new period reflows instead of redrawing. */
  id: string;
  /** Short name, shown inside the segment, in the legend and in the readout. */
  label: string;
  /** Absolute amount. Shares are each value over the total of the visible segments; zero and negative values are left out. */
  value: number;
  /** Any CSS color. Defaults to --series-1 to --series-4, then two neutrals meant for catch-all shares such as Referral or Other. */
  color?: string;
}

export interface SplitBarProps {
  /** The shares in display order: { id, label, value, color? }. */
  segments: readonly SplitSegment[];
  /** Heading above the bar and the accessible name unless label is set. */
  title?: string;
  /** One line under the title. */
  description?: string;
  /** Number format for values in the readout, such as currency for a budget. Shares always read as percentages with one decimal. */
  format?: Intl.NumberFormatOptions;
  /** Word after values in the readout, such as sessions. */
  unit?: string;
  /** Label of the readout when nothing is highlighted. */
  totalLabel?: string;
  /** Ids of segments that are switched off (controlled). */
  hidden?: readonly string[];
  /** Ids switched off at first (uncontrolled). */
  defaultHidden?: readonly string[];
  /** Called with the new list when the legend or the keyboard switches a segment. */
  onHiddenChange?: (hidden: string[]) => void;
  /** Show the legend. Each item toggles its segment and highlights it on hover. */
  legend?: boolean;
  /** Formatting locale. Fixed by default so server and client render the same digits. */
  locale?: string;
  /** Accessible name. Defaults to the title. */
  label?: string;
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
}

/** CSS custom properties are not part of CSSProperties; a narrow helper keeps the casts out of the JSX. */
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/** Shared chart palette, then two neutrals for catch-all shares. */
const PALETTE = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--text-muted)",
  "var(--border-strong)",
] as const;

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type LabelMode = "full" | "short" | "outside" | "none";

interface Slice {
  id: string;
  start: number;
  end: number;
  share: number;
  on: boolean;
  mode: LabelMode;
}

interface OutsideLabel {
  id: string;
  name: string;
  anchor: number;
  width: number;
  x: number;
}

/** The vertical feathered window of a digit column: the wanted digit sits in the middle, its
 * neighbours peek in from above and below so the wheel reads as a continuous strip. */
const glyphTransition = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto" as const, opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

function DigitGlyph({ position, digit }: { position: ReturnType<typeof useMotionValue<number>>; digit: number }) {
  // Offset from the current position, wrapped to [-5, 5], so 9 -> 0 always moves one step.
  const offset = useTransform(position, (value) => ((((digit - value) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, (value) => `${value}em`);
  const opacity = useTransform(offset, (value) => Math.max(0, 1 - 1.2 * Math.abs(value)));
  return (
    <motion.span className={styles.glyph} style={{ y, opacity }}>
      {digit}
    </motion.span>
  );
}

/** One odometer column. `direction` keeps the roll going the way the value changed, so an increase
 * always scrolls the same way even when the digit wraps from 9 to 0. */
function RollingDigit({ digit, direction, reduceMotion }: { digit: number; direction: number; reduceMotion: boolean }) {
  const position = useMotionValue(digit);
  const state = useRef({ digit, target: digit });

  useEffect(() => {
    const current = state.current;
    if (current.digit === digit) return;
    current.target += direction < 0 ? -((current.digit - digit + 10) % 10) : (digit - current.digit + 10) % 10;
    current.digit = digit;
    if (reduceMotion) {
      position.jump(current.target);
      return;
    }
    const controls = animate(position, current.target, motionTokens.spring.smooth);
    return () => controls.stop();
  }, [digit, direction, position, reduceMotion]);

  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>0</span>
      {DIGITS.map((value) => (
        <DigitGlyph position={position} digit={value} key={value} />
      ))}
    </span>
  );
}

type Piece = { key: string; text: string } | { key: string; digit: number };

const splitParts = (parts: Intl.NumberFormatPart[]): Piece[] => {
  let integerDigits = parts.reduce((count, part) => count + (part.type === "integer" ? part.value.length : 0), 0);
  let fractionDigits = 0;
  const pieces: Piece[] = [];
  parts.forEach((part, index) => {
    if (part.type === "integer") {
      for (const character of part.value) pieces.push({ key: `i${--integerDigits}`, digit: Number(character) });
    } else if (part.type === "fraction") {
      for (const character of part.value) pieces.push({ key: `f${fractionDigits++}`, digit: Number(character) });
    } else {
      pieces.push({
        key: part.type === "group" ? `g${integerDigits}` : part.type === "literal" ? `l${index}` : part.type,
        text: part.value,
      });
    }
  });
  return pieces;
};

/** A number whose integer and fraction digits roll on separate wheels, symbols fading and sliding
 * in as the width of the number changes. */
function RollingNumber({
  value,
  formatter,
  reduceMotion,
}: {
  value: number;
  formatter: Intl.NumberFormat;
  reduceMotion: boolean;
}) {
  const [state, setState] = useState({ value, direction: 1 });
  // Derived during render: the roll direction is read by the digits on the same pass.
  if (state.value !== value) setState({ value, direction: value >= state.value ? 1 : -1 });

  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
  const pieces = splitParts(formatter.formatToParts(value));

  return (
    <span className={styles.number} aria-hidden="true">
      <AnimatePresence initial={false}>
        {pieces.map((piece) =>
          "digit" in piece ? (
            <motion.span className={styles.column} {...glyphTransition} transition={transition} key={piece.key}>
              <RollingDigit digit={piece.digit} direction={state.direction} reduceMotion={reduceMotion} />
            </motion.span>
          ) : (
            <motion.span className={styles.symbol} {...glyphTransition} transition={transition} key={piece.key}>
              {piece.text}
            </motion.span>
          ),
        )}
      </AnimatePresence>
    </span>
  );
}

/** A full-width layer cut to its share. The clip runs through motion values, so a new target mid
 * flight retargets from where the edges are and layout is never touched. */
function SegmentLayer({
  slice,
  color,
  width,
  active,
  dimmed,
  text,
  reduceMotion,
}: {
  slice: Slice;
  color: string;
  width: ReturnType<typeof useMotionValue<number>>;
  active: boolean;
  dimmed: boolean;
  text: { name: string; share: number; formatter: Intl.NumberFormat };
  reduceMotion: boolean;
}) {
  const start = useMotionValue(slice.start);
  const end = useMotionValue(slice.end);

  useEffect(() => {
    if (reduceMotion) {
      start.jump(slice.start);
      end.jump(slice.end);
      return;
    }
    const startControls = animate(start, slice.start, motionTokens.spring.smooth);
    const endControls = animate(end, slice.end, motionTokens.spring.smooth);
    return () => {
      startControls.stop();
      endControls.stop();
    };
  }, [end, reduceMotion, slice.end, slice.start, start]);

  // The inset keeps a rounded 4px corner, shrinking the radius as the segment narrows.
  const clipPath = useTransform([start, end, width], ([s = 0, e = 0, w = 0]: number[]) => {
    const leftRound = Math.min(1, s * w);
    const rightRound = Math.min(1, (1 - e) * w);
    return `inset(0 calc(${((1 - e) * 100).toFixed(3)}% + ${rightRound.toFixed(2)}px) 0 calc(${(100 * s).toFixed(3)}% + ${leftRound.toFixed(2)}px) round 4px)`;
  });
  const capX = useTransform([end, width], ([e = 0, w = 0]: number[]) => e * w - 3 - Math.min(1, (1 - e) * w));
  const capOpacity = useTransform([start, end, width], ([s = 0, e = 0, w = 0]: number[]) => Math.max(0, Math.min(1, ((e - s) * w - 4) / 6)));
  const insideX = useTransform([start, width], ([s = 0, w = 0]: number[]) => s * w + 10);

  const hasInside = slice.on && (slice.mode === "full" || slice.mode === "short");

  return (
    <motion.span
      className={styles.segment}
      data-active={active || undefined}
      data-dimmed={dimmed || undefined}
      style={{ clipPath, "--seg": color } as unknown as MotionStyle}
      aria-hidden="true"
    >
      <motion.span className={styles.cap} style={{ x: capX, opacity: capOpacity }} />
      <motion.span
        className={styles.inside}
        style={{ x: insideX }}
        initial={false}
        animate={{ opacity: Number(hasInside) }}
        transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}
      >
        <motion.span
          className={styles.insideName}
          initial={false}
          animate={{
            opacity: Number(slice.mode === "full"),
            width: slice.mode === "full" ? "auto" : 0,
            marginRight: 5 * Number(slice.mode === "full"),
          }}
          transition={reduceMotion ? { duration: 0 } : motionTokens.spring.morph}
        >
          {text.name}
        </motion.span>
        <RollingNumber value={text.share} formatter={text.formatter} reduceMotion={reduceMotion} />
      </motion.span>
    </motion.span>
  );
}

/** Measures the label font once and caches widths per string, so fitting never reads layout while
 * the bar is animating. */
function useTextMetrics(probe: React.RefObject<HTMLSpanElement | null>) {
  const [font, setFont] = useState("");

  useEffect(() => {
    const read = () => {
      if (probe.current) setFont(getComputedStyle(probe.current).font);
    };
    read();
    document.fonts?.ready.then(read).catch(() => {});
  }, [probe]);

  return useMemo(() => {
    const cache = new Map<string, number>();
    const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (context && font) context.font = font;
    return (text: string) => {
      const cached = cache.get(text);
      if (cached !== undefined) return cached;
      const measured = context && font ? context.measureText(text).width : 7 * text.length;
      cache.set(text, measured);
      return measured;
    };
  }, [font]);
}

export function SplitBar({
  segments,
  title,
  description,
  format,
  unit,
  totalLabel = "Total",
  hidden,
  defaultHidden = [],
  onHiddenChange,
  legend = true,
  locale = "en-US",
  label,
  className,
  style,
}: SplitBarProps) {
  const reduceMotion = !!useReducedMotion();
  const titleId = useId();

  const [uncontrolledHidden, setUncontrolledHidden] = useState<string[]>(() => [...defaultHidden]);
  const hiddenIds = hidden ?? uncontrolledHidden;
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const commitHidden = (next: string[]) => {
    if (!hidden) setUncontrolledHidden(next);
    onHiddenChange?.(next);
  };

  const valueFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        ...format,
        numberingSystem: "latn",
      }),
    [format, locale],
  );
  const shareFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        numberingSystem: "latn",
      }),
    [locale],
  );

  const barRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const width = useMotionValue(0);
  const [barWidth, setBarWidth] = useState(0);

  useLayoutEffect(() => {
    const node = barRef.current;
    if (!node) return;
    const measure = () => {
      width.set(node.clientWidth);
      setBarWidth(node.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  const measureText = useTextMetrics(probeRef);

  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [refusal, setRefusal] = useState<{ id: string; key: number } | null>(null);

  const colorOf = (segment: SplitSegment, index: number) =>
    segment.color ?? PALETTE[index % PALETTE.length] ?? "var(--text-muted)";

  const visible = segments.filter((segment) => !hiddenSet.has(segment.id) && segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  const active = highlighted && visible.some((segment) => segment.id === highlighted) ? highlighted : null;
  const shareOf = (segment: SplitSegment) => (total > 0 && !hiddenSet.has(segment.id) ? Math.max(0, segment.value) / total : 0);
  const shares = new Map(segments.map((segment) => [segment.id, shareOf(segment)]));

  // Hovering or arrowing onto a segment widens it by ~4.5% of the bar, or enough to fit its name
  // and share when it is small; the others give way proportionally so the bar stays at 100%.
  const slices: Slice[] = (() => {
    const laid = new Map(shares);
    if (active && barWidth > 0) {
      const current = laid.get(active) ?? 0;
      const segment = segments.find((item) => item.id === active);
      const needed = segment ? (measureText(`${segment.label} ${shareFormatter.format(current)}`) + 30) / barWidth : 0;
      const target = Math.min(Math.max(current + 0.045, Math.min(needed, 0.42)), 0.9);
      if (target > current && current < 1) {
        const scale = (1 - target) / (1 - current);
        for (const [id, share] of laid) laid.set(id, id === active ? target : share * scale);
      }
    }
    const edges = segments.reduce<number[]>((acc, segment) => [...acc, (acc[acc.length - 1] ?? 0) + (laid.get(segment.id) ?? 0)], []);
    return segments.map((segment, index) => {
      const share = laid.get(segment.id) ?? 0;
      const start = index ? (edges[index - 1] ?? 0) : 0;
      const end = Math.min(1, edges[index] ?? 0);
      const pixels = (end - start) * barWidth;
      const on = end - start > 0;
      const full = measureText(`${segment.label} ${shareFormatter.format(share)}`) + 30;
      const short = measureText(shareFormatter.format(share)) + 26;
      return {
        id: segment.id,
        start,
        end,
        share,
        on,
        mode: on ? (pixels >= full ? "full" : pixels >= short ? "short" : "outside") : "none",
      };
    });
  })();

  // Labels that do not fit inside move to the lane under the bar, pushed apart so they never
  // overlap: first to the right, then clamped back from the end.
  const outsideLabels: OutsideLabel[] = (() => {
    const place = (withNames: boolean) =>
      slices
        .filter((slice) => slice.mode === "outside")
        .map((slice) => {
          const name = withNames ? (segments.find((segment) => segment.id === slice.id)?.label ?? "") : "";
          const share = shareFormatter.format(slice.share);
          return {
            id: slice.id,
            name,
            anchor: ((slice.start + slice.end) / 2) * barWidth,
            width: measureText(name ? `${name} ${share}` : share) + 6,
            x: 0,
          };
        });
    let labels = place(true);
    if (labels.reduce((sum, item, index) => sum + item.width + 12 * Number(index > 0), 0) > barWidth) labels = place(false);
    labels.forEach((item, index) => {
      const previous = labels[index - 1];
      item.x = Math.max(previous ? previous.x + previous.width + 12 : 0, item.anchor - item.width / 2);
    });
    for (let index = labels.length - 1; index >= 0; index--) {
      const item = labels[index];
      if (!item) continue;
      const next = labels[index + 1];
      const limit = next ? next.x - 12 : barWidth;
      if (item.x + item.width > limit) item.x = Math.max(0, limit - item.width);
    }
    return labels;
  })();

  const toggle = (id: string) => {
    const segment = segments.find((item) => item.id === id);
    if (!segment) return;
    if (hiddenSet.has(id)) {
      commitHidden(hiddenIds.filter((item) => item !== id));
      setAnnouncement(`${segment.label} shown.`);
    } else {
      if (visible.length <= 1) {
        setRefusal((current) => ({ id, key: (current?.key ?? 0) + 1 }));
        setAnnouncement(`${segment.label} is the only share shown, so it stays on.`);
        return;
      }
      commitHidden([...hiddenIds, id]);
      setAnnouncement(`${segment.label} hidden.`);
    }
  };

  const pointAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / box.width;
    const hit = slices.find((slice) => slice.on && fraction >= slice.start && fraction < slice.end);
    if (hit && hit.id !== active) setHighlighted(hit.id);
  };

  const activeSegment = active ? segments.find((segment) => segment.id === active) : undefined;
  const activeIndex = activeSegment ? segments.indexOf(activeSegment) : -1;
  const nameList = visible.map((segment) => `${segment.label} ${shareFormatter.format(shareOf(segment))}`).join(", ");
  const accessibleName = label ?? title ?? "Split bar";

  const onBarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const ids = visible.map((segment) => segment.id);
    if (!ids.length) return;
    const index = active ? ids.indexOf(active) : -1;
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index <= 0 ? ids.length - 1 : index - 1,
      ArrowUp: index <= 0 ? ids.length - 1 : index - 1,
      Home: 0,
      End: ids.length - 1,
    };
    if (event.key === "Escape") {
      setHighlighted(null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (active) {
        event.preventDefault();
        toggle(active);
      }
      return;
    }
    if (!(event.key in targets)) return;
    event.preventDefault();
    const nextId = ids[((targets[event.key] ?? 0) + ids.length) % ids.length];
    if (!nextId) return;
    setHighlighted(nextId);
    const segment = segments.find((item) => item.id === nextId);
    if (segment) {
      setAnnouncement(
        `${segment.label}, ${shareFormatter.format(shareOf(segment))}, ${valueFormatter.format(segment.value)}${unit ? ` ${unit}` : ""}.`,
      );
    }
  };

  return (
    <figure
      className={[styles.figure, className].filter(Boolean).join(" ")}
      style={style}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : accessibleName}
    >
      <span ref={probeRef} className={styles.probe} aria-hidden="true">
        0
      </span>

      <div className={styles.head}>
        {(title || description) && (
          <div className={styles.heading}>
            {title && (
              <p id={titleId} className={styles.title}>
                {title}
              </p>
            )}
            {description && <p className={styles.description}>{description}</p>}
          </div>
        )}

        <div className={styles.readout} aria-hidden="true">
          <AnimatePresence mode="popLayout" anchorX="right" initial={false}>
            <motion.div
              className={styles.readoutLine}
              key={activeSegment ? activeSegment.id : "total"}
              initial={
                reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: -6,
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                      transition: { duration: motionTokens.duration.fast },
                    }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }
              }
            >
              {activeSegment ? (
                <Fragment>
                  <span className={styles.readoutSwatch} style={{ "--seg": colorOf(activeSegment, activeIndex) } as StyleWithVars} />
                  <span className={styles.readoutName}>{activeSegment.label}</span>
                  <span className={styles.readoutShare}>
                    <RollingNumber value={shareOf(activeSegment)} formatter={shareFormatter} reduceMotion={reduceMotion} />
                  </span>
                  <span className={styles.readoutValue}>
                    <RollingNumber value={activeSegment.value} formatter={valueFormatter} reduceMotion={reduceMotion} />
                    {unit ? ` ${unit}` : ""}
                  </span>
                </Fragment>
              ) : (
                <Fragment>
                  <span className={styles.readoutName}>{totalLabel}</span>
                  <span className={styles.readoutShare}>
                    <RollingNumber value={total} formatter={valueFormatter} reduceMotion={reduceMotion} />
                  </span>
                  {unit && <span className={styles.readoutValue}>{unit}</span>}
                </Fragment>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div
        ref={barRef}
        className={styles.bar}
        data-active={active ? "" : undefined}
        tabIndex={0}
        role="group"
        aria-roledescription="split bar"
        aria-label={`${accessibleName}: ${nameList}. Use the arrow keys to read each share.`}
        onPointerMove={pointAt}
        onPointerDown={pointAt}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHighlighted(null);
        }}
        onKeyDown={onBarKeyDown}
        onBlur={() => setHighlighted(null)}
      >
        {segments.map((segment, index) => {
          const slice = slices[index];
          if (!slice) return null;
          return (
            <SegmentLayer
              key={segment.id}
              slice={slice}
              color={colorOf(segment, index)}
              width={width}
              active={active === segment.id}
              dimmed={!!active && active !== segment.id}
              text={{ name: segment.label, share: slice.share, formatter: shareFormatter }}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </div>

      <motion.div
        className={styles.lane}
        initial={false}
        animate={{ height: 40 * Number(outsideLabels.length > 0) }}
        transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
        aria-hidden="true"
      >
        <svg className={styles.leaders} width="100%" height={40}>
          <AnimatePresence initial={false}>
            {outsideLabels.map((item) => {
              const tip = item.x + item.width / 2;
              const d = `M${item.anchor.toFixed(1)} 0 C${item.anchor.toFixed(1)} 10 ${tip.toFixed(1)} 6 ${tip.toFixed(1)} 15`;
              return (
                <motion.path
                  key={item.id}
                  className={styles.leader}
                  data-dimmed={(active && active !== item.id) || undefined}
                  initial={{ opacity: 0, d }}
                  animate={{ opacity: 1, d }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { d: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
                  }
                />
              );
            })}
          </AnimatePresence>
        </svg>

        <AnimatePresence initial={false}>
          {outsideLabels.map((item) => {
            const slice = slices.find((candidate) => candidate.id === item.id);
            return (
              <motion.span
                key={item.id}
                className={styles.outside}
                data-dimmed={(active && active !== item.id) || undefined}
                initial={{ opacity: 0, x: item.x, y: -4 }}
                animate={{ opacity: 1, x: item.x, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
                }
              >
                {item.name && <span className={styles.outsideName}>{item.name}</span>}
                <RollingNumber value={slice?.share ?? 0} formatter={shareFormatter} reduceMotion={reduceMotion} />
              </motion.span>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {legend && (
        <ul className={styles.legend} aria-label={`${accessibleName} segments`}>
          {segments.map((segment, index) => {
            const shown = !hiddenSet.has(segment.id);
            return (
              <li key={segment.id}>
                <button
                  type="button"
                  className={styles.legendItem}
                  data-off={!shown || undefined}
                  data-active={active === segment.id || undefined}
                  aria-pressed={shown}
                  aria-label={`${segment.label}, ${shown ? shareFormatter.format(shareOf(segment)) : "hidden"}`}
                  style={{ "--seg": colorOf(segment, index) } as StyleWithVars}
                  onClick={() => toggle(segment.id)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse" && shown) setHighlighted(segment.id);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") setHighlighted(null);
                  }}
                >
                  <motion.span
                    className={styles.legendLabel}
                    key={refusal?.id === segment.id ? refusal.key : 0}
                    initial={{ x: 0 }}
                    animate={
                      refusal?.id !== segment.id || reduceMotion ? { x: 0 } : { x: [0, -3, 3, -2, 0] }
                    }
                    transition={{ duration: 0.32, ease: motionTokens.ease.standard }}
                  >
                    <span className={styles.swatch} aria-hidden="true" />
                    <span className={styles.legendName}>{segment.label}</span>
                  </motion.span>
                  <span className={styles.legendShare} aria-hidden="true">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {shown ? (
                        <motion.span
                          key="on"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}
                        >
                          <RollingNumber value={shareOf(segment)} formatter={shareFormatter} reduceMotion={reduceMotion} />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="off"
                          className={styles.legendOff}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : motionTokens.duration.fast }}
                        >
                          Off
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </figure>
  );
}

export default SplitBar;
