"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ChevronUp, CircleAlert, RotateCcw, Sparkles, Square } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./ai-insight-card.module.css";

export interface InsightDriver {
  /** Stable id the segments reference through their `driver` field. */
  id: string;
  /** Driver name, e.g. "Annual renewals, EMEA". */
  label: string;
  /** Contribution in the metric's unit; negative values are subtractive. */
  delta: number;
  /** Index into `metric.points` the driver is pinned to on the sparkline. */
  point: number;
}

export interface InsightSegment {
  text: string;
  /** Marks this segment as the explanation of one driver, so it underlines and highlights the annotation. */
  driver?: string;
}

export interface Insight {
  segments: InsightSegment[];
  drivers: InsightDriver[];
}

export interface InsightMetric {
  /** Metric name, rendered as the card title. */
  label: string;
  /** Date range for the series, e.g. "Oct 20 to 26". */
  period: string;
  value: number;
  previous: number;
  /** Copy after the delta, e.g. "vs last week". */
  comparisonLabel: string;
  series: number[];
  previousSeries?: number[];
  /** One label per point, used by the axis, the tooltip and the screen-reader readout. */
  points: string[];
  seriesLabel?: string;
  previousSeriesLabel?: string;
  /** Formats every number on the card. Defaults to compact USD. */
  format?: (value: number) => string;
  /** Flips which direction of change reads as good. */
  lowerIsBetter?: boolean;
}

export interface InsightFollowUp {
  id: string;
  label: string;
  insight: Insight;
}

export interface ExplainRequest {
  metric: InsightMetric;
  /** Absent for the card's own "explain this change" request. */
  followUp?: InsightFollowUp;
  signal: AbortSignal;
}

export interface InsightMeta {
  label: string;
  icon: ReactNode;
}

export interface AiInsightCardProps {
  /** The KPI the card reports: value, comparison, series and point labels. */
  metric?: InsightMetric;
  /** The explanation streamed into the panel, and the drivers it ranks. */
  insight?: Insight;
  /** Follow-up questions rendered as chips under the drivers; each carries its own answer. */
  followUps?: InsightFollowUp[];
  /** Replaces the built-in sample data with a real request. Receives an AbortSignal. */
  explain?: (request: ExplainRequest) => Promise<Insight>;
  /** Fires when an explanation starts, with the follow-up that triggered it. */
  onExplain?: (followUp?: InsightFollowUp) => void;
  /** Opens the card and explains itself on its own. Defaults to on unless `explain` is provided. */
  autoPlay?: boolean;
  /** Status line while the answer is being prepared. */
  thinkingLabel?: string;
  /** Footer source, e.g. the billing system the numbers came from. Pass null to hide. */
  source?: InsightMeta | null;
  /** Footer model that wrote the explanation. Pass null to hide. */
  model?: InsightMeta | null;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/** U+2212 minus, so the delta and the compact currency read as typography rather than a hyphen. */
const MINUS = "−";
const MAIN = "main";
const NOTHING: ReadonlySet<string> = new Set();
/** Words per streamed chunk, cycling so the reveal never looks metronomic. */
const CHUNK_SIZES = [4, 6, 3, 5, 7, 4, 5];
const SKELETON_WIDTHS = [62, 48, 54];

/** Compact dollar formatting: $482.1k, $11.8k, $3.4k. */
export function formatCompactUsd(value: number): string {
  const magnitude = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (magnitude >= 1_000_000) return `${sign}$${(magnitude / 1_000_000).toFixed(2)}M`;
  if (magnitude >= 1_000) return `${sign}$${(magnitude / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(magnitude)}`;
}

/** Catmull-Rom through the points, with tangents clamped so a spike never overshoots. */
function smoothPath(points: Point[]): string {
  const count = points.length;
  if (count === 0) return "";
  if (count === 1) return `M${points[0].x},${points[0].y}`;

  const spans: number[] = [];
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index++) {
    spans.push(points[index + 1].x - points[index].x);
    slopes.push((points[index + 1].y - points[index].y) / spans[index]);
  }

  const tangents = [slopes[0]];
  for (let index = 1; index < count - 1; index++) {
    tangents.push(slopes[index - 1] * slopes[index] <= 0 ? 0 : (slopes[index - 1] + slopes[index]) / 2);
  }
  tangents.push(slopes[count - 2]);

  for (let index = 0; index < count - 1; index++) {
    if (slopes[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const before = tangents[index] / slopes[index];
    const after = tangents[index + 1] / slopes[index];
    const length = before * before + after * after;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      tangents[index] = scale * before * slopes[index];
      tangents[index + 1] = scale * after * slopes[index];
    }
  }

  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let index = 0; index < count - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    const handle = spans[index] / 3;
    path += `C${(from.x + handle).toFixed(2)},${(from.y + tangents[index] * handle).toFixed(2)} ${(to.x - handle).toFixed(2)},${(to.y - tangents[index + 1] * handle).toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`;
  }
  return path;
}

function annotationState(id: string, mentioned: ReadonlySet<string>, activeId?: string): "active" | "mentioned" | "hidden" {
  if (activeId === id) return "active";
  return mentioned.has(id) ? "mentioned" : "hidden";
}

interface SparklineProps {
  metric: InsightMetric;
  format: (value: number) => string;
  drivers: InsightDriver[];
  mentioned: ReadonlySet<string>;
  activeId?: string;
  onHoverDriver?: (id?: string) => void;
}

function Sparkline({ metric, format, drivers, mentioned, activeId, onHoverDriver }: SparklineProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const { series, previousSeries = [], points } = metric;

  useEffect(() => {
    const node = chartRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const all = [...series, ...previousSeries];
    if (!width || series.length < 2 || all.length === 0) return null;
    const low = Math.min(...all);
    const high = Math.max(...all);
    const spread = high - low || 1;
    const floor = low - spread * 0.12;
    const ceiling = high + spread * 0.08;
    const step = (width - 12) / (series.length - 1);
    const project = (value: number, index: number): Point => ({
      x: 6 + index * step,
      y: 30 + (1 - (value - floor) / (ceiling - floor)) * 76,
    });
    return {
      step,
      current: series.map(project),
      previous: previousSeries.slice(0, series.length).map(project),
    };
  }, [width, series, previousSeries]);

  const scrubTo = (clientX: number) => {
    if (!geometry || !chartRef.current) return;
    const offset = clientX - chartRef.current.getBoundingClientRect().left;
    setScrubIndex(Math.max(0, Math.min(series.length - 1, Math.round((offset - 6) / geometry.step))));
  };

  if (series.length < 2) return <div className={styles.chartEmpty}>No data for this period yet</div>;

  const currentPoint = scrubIndex !== null && geometry ? geometry.current[scrubIndex] : null;
  const previousPoint = scrubIndex !== null && geometry ? geometry.previous[scrubIndex] : null;
  const tooltipLeft = currentPoint ? Math.max(104, Math.min(width - 104, currentPoint.x)) : 0;
  const chartLabel = `${metric.label}, ${metric.points[0]} to ${metric.points[metric.points.length - 1]}. Use the arrow keys to read each point.`;
  const readout =
    scrubIndex !== null
      ? `${points[scrubIndex]}: ${format(series[scrubIndex])}${previousSeries[scrubIndex] !== undefined ? `, ${metric.previousSeriesLabel ?? "previous"} ${format(previousSeries[scrubIndex])}` : ""}`
      : "";

  return (
    <div
      ref={chartRef}
      className={styles.chart}
      tabIndex={0}
      role="group"
      aria-label={chartLabel}
      onPointerMove={(event) => {
        if (event.pointerType !== "touch" || event.buttons) scrubTo(event.clientX);
      }}
      onPointerDown={(event) => scrubTo(event.clientX)}
      onPointerLeave={() => setScrubIndex(null)}
      onKeyDown={(event) => {
        const last = series.length - 1;
        const next =
          event.key === "ArrowRight"
            ? Math.min(last, (scrubIndex ?? -1) + 1)
            : event.key === "ArrowLeft"
              ? Math.max(0, (scrubIndex ?? last + 1) - 1)
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? last
                  : event.key === "Escape"
                    ? null
                    : undefined;
        if (next !== undefined) {
          event.preventDefault();
          setScrubIndex(next);
        }
      }}
      onBlur={() => setScrubIndex(null)}
    >
      {geometry ? (
        <svg className={styles.chartSvg} width={width} height={112} viewBox={`0 0 ${width} 112`} aria-hidden="true">
          <line className={styles.baseline} x1={0} x2={width} y1={111.5} y2={111.5} />
          {geometry.previous.length > 1 ? <path className={styles.linePrevious} d={smoothPath(geometry.previous)} /> : null}
          <path className={styles.lineCurrent} d={smoothPath(geometry.current)} />
          {drivers.map((driver) => {
            const point = geometry.current[driver.point];
            return point ? (
              <line
                key={driver.id}
                className={styles.guide}
                data-state={annotationState(driver.id, mentioned, activeId)}
                x1={point.x}
                x2={point.x}
                y1={23}
                y2={point.y - 6}
              />
            ) : null;
          })}
          {currentPoint ? <line className={styles.scrubLine} x1={currentPoint.x} x2={currentPoint.x} y1={24} y2={112} /> : null}
        </svg>
      ) : null}
      {geometry
        ? drivers.map((driver, index) => {
            const point = geometry.current[driver.point];
            if (!point) return null;
            const state = annotationState(driver.id, mentioned, activeId);
            return (
              <span key={driver.id} aria-hidden="true">
                <span className={styles.annotationDot} data-state={state} style={{ left: point.x, top: point.y }} />
                <span
                  className={styles.annotationBadge}
                  data-state={state}
                  style={{ left: point.x, top: 10 }}
                  onPointerEnter={() => onHoverDriver?.(driver.id)}
                  onPointerLeave={() => onHoverDriver?.(undefined)}
                >
                  {index + 1}
                </span>
              </span>
            );
          })
        : null}
      {currentPoint ? (
        <>
          {previousPoint ? (
            <span className={styles.scrubDotPrevious} style={{ left: previousPoint.x, top: previousPoint.y }} aria-hidden="true" />
          ) : null}
          <span className={styles.scrubDot} style={{ left: currentPoint.x, top: currentPoint.y }} aria-hidden="true" />
          <span className={styles.tooltip} style={{ left: tooltipLeft }} aria-hidden="true">
            <span className={styles.tooltipLabel}>{points[scrubIndex as number]}</span>
            <span className={styles.tooltipRow}>
              <i className={styles.swatchCurrent} />
              {format(series[scrubIndex as number])}
            </span>
            {previousSeries[scrubIndex as number] !== undefined ? (
              <span className={styles.tooltipRow}>
                <i className={styles.swatchPrevious} />
                {format(previousSeries[scrubIndex as number])}
              </span>
            ) : null}
          </span>
        </>
      ) : null}
      <span className={styles.srOnly} aria-live="polite">
        {readout}
      </span>
    </div>
  );
}

export const sampleMetric: InsightMetric = {
  label: "Net revenue",
  period: "Oct 20 to 26",
  value: 482100,
  previous: 515100,
  comparisonLabel: "vs last week",
  series: [74800, 66100, 73200, 69000, 70600, 60400, 68000],
  previousSeries: [76200, 78900, 77400, 75800, 74100, 66300, 66400],
  points: ["Mon, Oct 20", "Tue, Oct 21", "Wed, Oct 22", "Thu, Oct 23", "Fri, Oct 24", "Sat, Oct 25", "Sun, Oct 26"],
  seriesLabel: "This week",
  previousSeriesLabel: "Last week",
};

export const sampleInsight: Insight = {
  segments: [
    { text: "Driven by fewer annual renewals in EMEA, down from 41 to 23 on Tuesday.", driver: "emea" },
    { text: " " },
    { text: "Failed card payments in North America cost another $11.8k on Thursday,", driver: "failed" },
    { text: " while " },
    { text: "Enterprise usage overages added back $3.4k on Sunday.", driver: "overage" },
  ],
  drivers: [
    { id: "emea", label: "Annual renewals, EMEA", delta: -24600, point: 1 },
    { id: "failed", label: "Failed card payments, NA", delta: -11800, point: 3 },
    { id: "overage", label: "Usage overages, Enterprise", delta: 3400, point: 6 },
  ],
};

export const sampleFollowUps: InsightFollowUp[] = [
  {
    id: "quarter",
    label: "Compare to last quarter",
    insight: {
      segments: [
        { text: "This week is $13.2k above the Q3 weekly average of $468.9k. " },
        { text: "New business in North America ran ahead from Monday,", driver: "new" },
        { text: " and " },
        { text: "Enterprise expansion landed on Sunday.", driver: "expansion" },
        { text: " Only " },
        { text: "failed card payments on Thursday fell below the Q3 pace.", driver: "failed" },
      ],
      drivers: [
        { id: "new", label: "New business, NA", delta: 9800, point: 0 },
        { id: "expansion", label: "Expansion, Enterprise", delta: 6600, point: 6 },
        { id: "failed", label: "Failed card payments, NA", delta: -3200, point: 3 },
      ],
    },
  },
  {
    id: "plan",
    label: "Break down by plan",
    insight: {
      segments: [
        { text: "Team carried the decline, down $26.9k as EMEA renewals lapsed on Tuesday.", driver: "team" },
        { text: " " },
        { text: "Pro slipped $9.5k, mostly from failed payments on Thursday.", driver: "pro" },
        { text: " " },
        { text: "Enterprise grew $3.4k on overage invoices billed Sunday.", driver: "enterprise" },
      ],
      drivers: [
        { id: "team", label: "Team plan", delta: -26900, point: 1 },
        { id: "pro", label: "Pro plan", delta: -9500, point: 3 },
        { id: "enterprise", label: "Enterprise plan", delta: 3400, point: 6 },
      ],
    },
  },
];

const stripeIcon = (
  <svg viewBox="0 0 24 24" fill="#635BFF" role="img" aria-label="Stripe" width={14} height={14} aria-hidden="true">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>
);

const claudeIcon = (
  <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label="Claude" width={14} height={14} aria-hidden="true">
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

const defaultSource: InsightMeta = { label: "Stripe billing, 1,284 invoices", icon: stripeIcon };
const defaultModel: InsightMeta = { label: "Claude Sonnet 5.5", icon: claudeIcon };

type Status = "idle" | "thinking" | "streaming" | "done" | "stopped" | "error";

interface Token {
  text: string;
  segment: number;
  chunk: number;
}

/**
 * Springs the panel's wrapper to the measured height of its content whenever the answer grows or shrinks,
 * so the card never jumps between streamed chunks. A width change (a resize) jumps instead of animating.
 */
function useAutoHeight(reduced: boolean) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const reset = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      controls = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || widthChanged) {
        reset();
        return;
      }
      outer.style.overflow = "hidden";
      controls = animate(outer, { height: [from, nextHeight] }, { type: "spring", visualDuration: 0.24, bounce: 0, onComplete: reset });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [reduced]);

  return { outerRef, innerRef };
}

export function AiInsightCard({
  metric = sampleMetric,
  insight = sampleInsight,
  followUps = sampleFollowUps,
  explain,
  onExplain,
  autoPlay,
  thinkingLabel = "Reading invoices and renewals",
  source = defaultSource,
  model = defaultModel,
  className,
}: AiInsightCardProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { amount: 0.4 });

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [activeId, setActiveId] = useState<string>(MAIN);
  const [current, setCurrent] = useState<Insight>(insight);
  const [revealed, setRevealed] = useState(0);
  const [hovered, setHovered] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [interacted, setInteracted] = useState(false);

  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const { outerRef, innerRef } = useAutoHeight(reduced);
  const panelId = useId();

  const format = metric.format ?? formatCompactUsd;
  const auto = (autoPlay ?? !explain) && !interacted && !reduced;

  // Split every segment into word-ish tokens, then group them into chunks of a varying size. The
  // streamer reveals whole chunks; a segment's driver is "mentioned" as soon as one of its chunks lands.
  const { tokens, total } = useMemo(() => {
    const list: Token[] = [];
    let chunk = 0;
    let inChunk = 0;
    current.segments.forEach((segment, index) => {
      for (const word of segment.text.match(/\S+\s*|\s+/g) ?? []) {
        list.push({ text: word, segment: index, chunk });
        if (/\S/.test(word) && ++inChunk >= CHUNK_SIZES[chunk % CHUNK_SIZES.length]) {
          chunk++;
          inChunk = 0;
        }
      }
    });
    return { tokens: list, total: list.length ? list[list.length - 1].chunk + 1 : 0 };
  }, [current]);

  const visible = status === "done" ? Number.POSITIVE_INFINITY : revealed;

  const { mentioned, reading } = useMemo(() => {
    const ids = new Set<string>();
    let last: string | undefined;
    for (const token of tokens) {
      if (token.chunk >= visible) break;
      const driver = current.segments[token.segment].driver;
      if (driver) {
        ids.add(driver);
        last = driver;
      }
    }
    return { mentioned: ids, reading: last };
  }, [tokens, visible, current]);

  const active = hovered ?? (status === "streaming" ? reading : undefined);

  const runExplain = useCallback(
    async (id: string) => {
      const run = ++runRef.current;
      // A second request cancels the first outright, so a late answer can never overwrite a newer one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const followUp = id === MAIN ? undefined : followUps.find((item) => item.id === id);
      const target = followUp?.insight ?? insight;
      setOpen(true);
      setActiveId(id);
      setStatus("thinking");
      setRevealed(0);
      setHovered(undefined);
      setError("");
      if (!explain) setCurrent(target);
      onExplain?.(followUp);
      try {
        const started = performance.now();
        const result = explain ? await explain({ metric, followUp, signal: controller.signal }) : target;
        // A floor on the thinking state keeps a cached answer from flashing straight into text.
        const wait = Math.max(0, 820 - (performance.now() - started));
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, wait);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
        if (run !== runRef.current) return;
        setCurrent(result);
        setStatus(reduced ? "done" : "streaming");
      } catch (cause) {
        if (controller.signal.aborted || run !== runRef.current) return;
        setError(cause instanceof Error && cause.message ? cause.message : "The request failed.");
        setStatus("error");
      }
    },
    [explain, followUps, insight, metric, onExplain, reduced],
  );

  const stop = useCallback(() => {
    runRef.current++;
    abortRef.current?.abort();
    setStatus("stopped");
  }, []);

  const close = useCallback(() => {
    runRef.current++;
    abortRef.current?.abort();
    setOpen(false);
    setHovered(undefined);
  }, []);

  useEffect(() => {
    if (status !== "streaming") return;
    const timer = setTimeout(
      () => {
        if (revealed + 1 >= total) setStatus("done");
        setRevealed(revealed + 1);
      },
      revealed >= total ? 0 : 34,
    );
    return () => clearTimeout(timer);
  }, [status, revealed, total]);

  // Autoplay: explain once the card is in view, then walk the follow-ups on its own and stop at the last one.
  useEffect(() => {
    if (!auto || !inView) return;
    let action: (() => void) | undefined;
    let delay = 3600;
    if (!open) {
      if (status === "idle" || status === "done" || status === "stopped") {
        action = () => runExplain(MAIN);
        delay = 1400;
      }
    } else if (status === "done") {
      const order = [MAIN, ...followUps.map((item) => item.id)];
      const next = order[order.indexOf(activeId) + 1];
      action = next ? () => runExplain(next) : close;
    }
    if (!action) return;
    const timer = setTimeout(action, delay);
    return () => clearTimeout(timer);
  }, [auto, inView, open, status, activeId, followUps, runExplain, close]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = open && (status === "thinking" || status === "streaming");
  const delta = metric.value - metric.previous;
  const percent = metric.previous ? (delta / metric.previous) * 100 : 0;
  const tone = (value: number): "bad" | "good" | "neutral" =>
    value === 0 ? "neutral" : value < 0 !== !!metric.lowerIsBetter ? "bad" : "good";
  const maxDelta = Math.max(1, ...current.drivers.map((driver) => Math.abs(driver.delta)));
  const fullText = current.segments.map((segment) => segment.text).join("");

  const announcement = open
    ? status === "thinking"
      ? `Explaining ${metric.label.toLowerCase()}.${explain ? "" : " Simulated from sample data, nothing was queried."}`
      : status === "done"
        ? `Explanation ready. ${fullText}`
        : status === "stopped"
          ? "Stopped."
          : status === "error"
            ? `Could not explain this change. ${error}`
            : ""
    : "";

  const action = busy
    ? { label: "Stop", icon: <Square className={styles.stopIcon} />, onClick: stop }
    : open
      ? { label: "Hide", icon: <ChevronUp />, onClick: close }
      : { label: "Explain", icon: <Sparkles className={styles.sparkle} />, onClick: () => runExplain(MAIN) };

  const rendered = current.segments.map((segment, index) => {
    const chunks: { chunk: number; text: string }[] = [];
    for (const token of tokens) {
      if (token.segment !== index || token.chunk >= visible) continue;
      const last = chunks[chunks.length - 1];
      if (last && last.chunk === token.chunk) last.text += token.text;
      else chunks.push({ chunk: token.chunk, text: token.text });
    }
    if (!chunks.length) return null;
    const spans = chunks.map((chunk) => (
      <span key={chunk.chunk} className={styles.chunk}>
        {chunk.text}
      </span>
    ));
    if (!segment.driver) return <span key={index}>{spans}</span>;
    const driver = segment.driver;
    return (
      <span
        key={index}
        className={styles.mention}
        data-active={active === driver || undefined}
        onPointerEnter={() => setHovered(driver)}
        onPointerLeave={() => setHovered(undefined)}
      >
        {spans}
      </span>
    );
  });

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={`${metric.label}, ${metric.period}`}
      onPointerDownCapture={() => setInteracted(true)}
      onKeyDownCapture={() => setInteracted(true)}
    >
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{metric.label}</h3>
          <span className={styles.period}>{metric.period}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className={styles.explain}
          onClick={action.onClick}
          disabled={metric.series.length < 2 && !open}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
        >
          {action.icon}
          {action.label}
        </Button>
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{format(metric.value)}</span>
        <span className={styles.delta} data-tone={tone(delta)}>
          {percent < 0 ? MINUS : percent > 0 ? "+" : ""}
          {Math.abs(percent).toFixed(1)}%
        </span>
        <span className={styles.compare}>{metric.comparisonLabel}</span>
        {metric.previousSeries?.length ? (
          <span className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <i className={styles.swatchCurrent} />
              {metric.seriesLabel ?? "Current"}
            </span>
            <span className={styles.legendItem}>
              <i className={styles.swatchPrevious} />
              {metric.previousSeriesLabel ?? "Previous"}
            </span>
          </span>
        ) : null}
      </div>
      <Sparkline
        metric={metric}
        format={format}
        drivers={current.drivers}
        mentioned={open ? mentioned : NOTHING}
        activeId={active}
        onHoverDriver={setHovered}
      />
      {metric.series.length >= 2 ? (
        <div className={styles.axis} aria-hidden="true">
          <span>{metric.points[0]}</span>
          <span>{metric.points[metric.points.length - 1]}</span>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            className={styles.panelClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    height: { type: "spring", visualDuration: 0.26, bounce: 0 },
                    opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                  }
            }
          >
            <div ref={outerRef}>
              <div ref={innerRef} className={styles.panel}>
                <div className={styles.textBox}>
                  <p className={styles.ghost} aria-hidden="true">
                    {fullText}
                  </p>
                  <div className={styles.textLayer}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {status === "thinking" ? (
                        <motion.div
                          key="thinking"
                          className={styles.thinking}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.16 }}
                        >
                          <Sparkles className={styles.sparkle} aria-hidden="true" />
                          <TextShimmer>{thinkingLabel}</TextShimmer>
                        </motion.div>
                      ) : status === "error" ? (
                        <motion.div
                          key="error"
                          className={styles.error}
                          role="alert"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.16 }}
                        >
                          <CircleAlert className={styles.errorIcon} aria-hidden="true" />
                          <span className={styles.errorText}>Could not explain this change. {error}</span>
                          <Button size="sm" variant="ghost" className={styles.retry} onClick={() => runExplain(activeId)}>
                            <RotateCcw />
                            Retry
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.p
                          key={`answer-${activeId}`}
                          className={styles.text}
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        >
                          {rendered}
                          {status === "stopped" ? (
                            <span className={styles.stopped}>
                              {revealed === 0 ? "Stopped before the answer started." : " Stopped."}
                            </span>
                          ) : null}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <ol className={styles.drivers} aria-label="Top drivers">
                  {current.drivers.slice(0, 3).map((driver, index) => {
                    const shown = mentioned.has(driver.id);
                    const share = Math.abs(driver.delta) / maxDelta;
                    return (
                      <li
                        key={`${activeId}-${driver.id}`}
                        className={styles.driver}
                        aria-hidden={!shown || undefined}
                        data-shown={shown || undefined}
                        data-active={active === driver.id || undefined}
                        onPointerEnter={shown ? () => setHovered(driver.id) : undefined}
                        onPointerLeave={() => setHovered(undefined)}
                      >
                        <span className={styles.rank} aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className={styles.driverBody}>
                          <span className={styles.skeleton} aria-hidden="true">
                            <i style={{ width: `${SKELETON_WIDTHS[index]}%` }} />
                          </span>
                          <span className={styles.driverLabel}>{driver.label}</span>
                        </span>
                        <span className={styles.bar} aria-hidden="true">
                          <i data-tone={tone(driver.delta)} style={{ width: `${shown ? share * 100 : 0}%` }} />
                        </span>
                        <span className={styles.driverDelta} data-tone={tone(driver.delta)}>
                          {driver.delta > 0 ? "+" : ""}
                          {format(driver.delta)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {followUps.length ? (
                  <div className={styles.chips} role="group" aria-label="Follow-up questions">
                    {followUps.map((followUp) => (
                      <button
                        key={followUp.id}
                        type="button"
                        className={styles.chip}
                        aria-pressed={activeId === followUp.id}
                        disabled={busy}
                        onClick={() => {
                          if (activeId !== followUp.id || status !== "done") runExplain(followUp.id);
                        }}
                      >
                        {followUp.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {source || model ? (
                  <div className={styles.footer}>
                    {source ? (
                      <span className={styles.meta}>
                        {source.icon}
                        <span className={styles.metaText}>{source.label}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    {model ? (
                      <span className={styles.meta}>
                        {model.icon}
                        <span className={styles.metaText}>{model.label}</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}

export default AiInsightCard;
