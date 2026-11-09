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
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock3,
  Flag,
  FlaskConical,
  Info,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./training-run.module.css";

export type TrainingRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type TrainingEventKind = "start" | "checkpoint" | "eval" | "epoch" | "info" | "warning" | "error" | "done";

/** One loss sample. Train is drawn raw and smoothed; validation joins its own samples. */
export interface LossSample {
  step: number;
  train?: number;
  val?: number;
}

export interface TrainingEvent {
  id: string;
  kind: TrainingEventKind;
  label: string;
  step?: number;
}

export interface TrainingMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface TrainingModel {
  name: string;
  mark?: ReactNode;
}

export interface TrainingDataset {
  name: string;
  examples?: number;
  mark?: ReactNode;
}

export interface TrainingRunProps {
  /** Where the job is. Running with no loss samples reads as starting up. Leave it out to play the built in simulation. */
  status?: TrainingRunStatus;
  /** The job or output model name. */
  name?: string;
  /** The base model. The mark renders at 24px. */
  model?: TrainingModel;
  /** Short facts after the model name, such as ["LoRA r16", "8× H200"]. */
  details?: string[];
  /** The training data, shown in the footer with an optional 14px mark. */
  dataset?: TrainingDataset;
  /** Optimizer steps done. */
  step?: number;
  /** Steps in the whole run. Fixes the x axis so the curve never rescales mid-run. */
  totalSteps?: number;
  /** Number of epochs. The axis splits into one band and one progress segment per epoch. */
  epochs?: number;
  /** Loss samples, oldest first. */
  loss?: LossSample[];
  /** The current learning rate, shown as 1.84e-4. */
  learningRate?: number;
  /** Seconds of training so far, excluding pauses. */
  elapsed?: number;
  /** Estimated seconds left. */
  eta?: number;
  /** The event log, oldest first. The newest three show. */
  events?: TrainingEvent[];
  /** Up to four results that replace the live stats on completion. */
  metrics?: TrainingMetric[];
  /** A line over the empty chart while queued or starting. */
  activity?: string;
  /** Why the run failed, shown in the footer in place of the dataset. */
  error?: string;
  onPause?: () => void;
  onResume?: () => void;
  /** Called after a second press on Confirm cancel within 3 seconds. */
  onCancel?: () => void;
  onRetry?: () => void;
  onRestart?: () => void;
  /** Shows Deploy on completion. The button loads while the promise runs. */
  onDeploy?: (signal: AbortSignal) => Promise<{ endpoint?: string } | void>;
  /** A one-off message for screen readers, such as the result of an action. */
  notice?: string;
  scenario?: "healthy" | "oom";
  className?: string;
}

const ease = [...motionTokens.ease.standard] as [number, number, number, number];

/* ------------------------------------------------------------------ marks */

/** The Qwen mark in its brand colours. */
export function QwenColorMark({ title = "Qwen", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z"
        fill={`url(#lobe-icons-qwen-${uid})`}
        fillRule="nonzero"
      />
      <defs>
        <linearGradient id={`lobe-icons-qwen-${uid}`} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#6336E7" stopOpacity=".84" />
          <stop offset="100%" stopColor="#6F69F7" stopOpacity=".84" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The Hugging Face emoji mark. */
export function HuggingFaceMark({ title = "Hugging Face", ...props }: { title?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378 0 1.112.178 2.181.503 3.185.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284.278.173.48.408.71.694.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542.01.026.653 1.552 1.657 2.54.616.605 1.01 1.223 1.082 1.912.055.537-.096 1.059-.38 1.572.637.121 1.294.187 1.967.187.657 0 1.298-.063 1.921-.178-.287-.517-.44-1.041-.384-1.581.07-.69.465-1.307 1.081-1.913 1.004-.987 1.647-2.513 1.657-2.539.021-.074.083-.285.233-.542.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952.23-.286.432-.52.71-.694.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378M8.327 6.583a1.5 1.5 0 0 1 .713.174 1.487 1.487 0 0 1 .617 2.013c-.183.343-.762-.214-1.102-.094-.38.134-.532.914-.917.71a1.487 1.487 0 0 1 .69-2.803m7.486 0a1.487 1.487 0 0 1 .689 2.803c-.385.204-.536-.576-.916-.71-.34-.12-.92.437-1.103.094a1.487 1.487 0 0 1 .617-2.013 1.5 1.5 0 0 1 .713-.174m-10.68 1.55a.96.96 0 1 1 0 1.921.96.96 0 0 1 0-1.92m13.838 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92M8.489 11.458c.588.01 1.965 1.157 3.572 1.164 1.607-.007 2.984-1.155 3.572-1.164.196-.003.305.12.305.454 0 .886-.424 2.328-1.563 3.202-.22-.756-1.396-1.366-1.63-1.32q-.011.001-.02.006l-.044.026-.01.008-.03.024q-.018.017-.035.036l-.032.04a1 1 0 0 0-.058.09l-.014.025q-.049.088-.11.19a1 1 0 0 1-.083.116 1.2 1.2 0 0 1-.173.18q-.035.029-.075.058a1.3 1.3 0 0 1-.251-.243 1 1 0 0 1-.076-.107c-.124-.193-.177-.363-.337-.444-.034-.016-.104-.008-.2.022q-.094.03-.216.087-.06.028-.125.063l-.13.074q-.067.04-.136.086a3 3 0 0 0-.135.096 3 3 0 0 0-.26.219 2 2 0 0 0-.12.121 2 2 0 0 0-.106.128l-.002.002a2 2 0 0 0-.09.132l-.001.001a1.2 1.2 0 0 0-.105.212q-.013.036-.024.073c-1.139-.875-1.563-2.317-1.563-3.203 0-.334.109-.457.305-.454m.836 10.354c.824-1.19.766-2.082-.365-3.194-1.13-1.112-1.789-2.738-1.789-2.738s-.246-.945-.806-.858-.97 1.499.202 2.362c1.173.864-.233 1.45-.685.64-.45-.812-1.683-2.896-2.322-3.295s-1.089-.175-.938.647 2.822 2.813 2.562 3.244-1.176-.506-1.176-.506-2.866-2.567-3.49-1.898.473 1.23 2.037 2.16c1.564.932 1.686 1.178 1.464 1.53s-3.675-2.511-4-1.297c-.323 1.214 3.524 1.567 3.287 2.405-.238.839-2.71-1.587-3.216-.642-.506.946 3.49 2.056 3.522 2.064 1.29.33 4.568 1.028 5.713-.624m5.349 0c-.824-1.19-.766-2.082.365-3.194 1.13-1.112 1.789-2.738 1.789-2.738s.246-.945.806-.858.97 1.499-.202 2.362c-1.173.864.233 1.45.685.64.451-.812 1.683-2.896 2.322-3.295s1.089-.175.938.647-2.822 2.813-2.562 3.244 1.176-.506 1.176-.506 2.866-2.567 3.49-1.898-.473 1.23-2.037 2.16c-1.564.932-1.686 1.178-1.464 1.53s3.675-2.511 4-1.297c.323 1.214-3.524 1.567-3.287 2.405.238.839 2.71-1.587 3.216-.642.506.946-3.49 2.056-3.522 2.064-1.29.33-4.568 1.028-5.713-.624" />
    </svg>
  );
}

/* -------------------------------------------------------------- formatters */

const formatInteger = (value: number) => Math.floor(value).toLocaleString("en-US");

/** Seconds as 4m 30s, 1h 05m or 9s. */
function formatTime(value: number) {
  const total = Math.max(0, Math.round(value));
  if (total >= 3600) return `${Math.floor(total / 3600)}h ${String(Math.floor(total / 60) % 60).padStart(2, "0")}m`;
  if (total >= 60) return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
  return `${total}s`;
}

/** 0.0002 as 2e-4. */
function formatRate(value: number) {
  if (value === 0) return "0";
  const [lead, exponent] = value.toExponential(2).split("e");
  return `${lead}e${Number(exponent)}`;
}

/* ------------------------------------------------------------------ values */

/** Eases a MotionValue toward each new target so data arriving in bursts still draws at an even pace. */
function useSmoothed(target: number, snap: boolean, tau = 120) {
  const value = useMotionValue(target);
  const latest = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    latest.current = target;
    if (snap || target < value.get() - 0.5) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      value.jump(target);
      return;
    }
    if (frame.current) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(64, now - previous);
      previous = now;
      const to = latest.current;
      const from = value.get();
      const next = from + (to - from) * (1 - Math.exp(-delta / tau));
      if (Math.abs(to - next) < 0.05) {
        value.set(to);
        frame.current = 0;
        return;
      }
      value.set(next);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [target, snap, tau, value]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return value;
}

/** The train curve the card draws: a light exponential smoother over the raw samples. */
function smoothTrain(loss: LossSample[]) {
  let previous: number | undefined;
  const points: { step: number; v: number }[] = [];
  for (const sample of loss) {
    if (sample.train === undefined) continue;
    previous = previous === undefined ? sample.train : .3 * sample.train + .7 * previous;
    points.push({ step: sample.step, v: previous });
  }
  return points;
}

/** The value of a series at any step, interpolated between its samples. */
function valueAt(points: { step: number; v: number }[], step: number) {
  if (!points.length || step < points[0].step) return undefined;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (to.step >= step) return from.v + (to.v - from.v) * ((step - from.step) / (to.step - from.step || 1));
  }
  return points.at(-1)?.v;
}

/* ------------------------------------------------------------------- chart */

interface ChartProps {
  loss: LossSample[];
  totalSteps: number;
  epochs: number;
  shown: MotionValue<number>;
  progress: MotionValue<number>;
  tone: "quiet" | "live" | "done" | "danger";
  hover: number | null;
  onHover: (step: number | null) => void;
  overlay: ReactNode;
  label: string;
}

function Chart({ loss, totalSteps, epochs, shown, progress, tone, hover, onHover, overlay, label }: ChartProps) {
  const plot = useRef<HTMLDivElement>(null);
  const rawPath = useRef<SVGPathElement>(null);
  const valPath = useRef<SVGPathElement>(null);
  const trainPath = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = plot.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const raw = useMemo(() => loss.flatMap((sample) => (sample.train === undefined ? [] : [{ step: sample.step, v: sample.train }])), [loss]);
  const smooth = useMemo(() => smoothTrain(loss), [loss]);
  const val = useMemo(() => loss.flatMap((sample) => (sample.val === undefined ? [] : [{ step: sample.step, v: sample.val }])), [loss]);

  const highest = useMemo(() => loss.reduce((max, sample) => Math.max(max, sample.train ?? 0, sample.val ?? 0), 0), [loss]);

  let maxY = 2.5;
  if (highest > 0) {
    const target = 1.06 * highest;
    const unit = target > 4 ? 1 : target > 1.2 ? .5 : target > .5 ? .25 : .1;
    maxY = Math.max(unit, Math.ceil(target / unit) * unit);
  }

  const ticks = useMemo(() => {
    let unit = 10;
    for (const candidate of [.1, .25, .5, 1, 2, 5]) {
      if (maxY / candidate <= 3.01) {
        unit = candidate;
        break;
      }
    }
    const out: number[] = [];
    for (let value = 0; value <= maxY + 1e-9; value += unit) out.push(+value.toFixed(2));
    return out;
  }, [maxY]);

  const plotWidth = Math.max(1, width - 32 - 6);
  const atX = useCallback((step: number) => 32 + (step / totalSteps) * plotWidth, [plotWidth, totalSteps]);
  const atY = useCallback((value: number) => 8 + (1 - Math.min(value, maxY) / maxY) * 142, [maxY]);

  const draw = useCallback((points: { step: number; v: number }[], upto: number) => {
    let d = "";
    let lx = 0;
    let ly = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (point.step > upto) {
        const previous = points[index - 1];
        if (!previous) break;
        const ratio = (upto - previous.step) / (point.step - previous.step || 1);
        lx = atX(upto);
        ly = atY(previous.v + (point.v - previous.v) * ratio);
        d += `L${lx.toFixed(1)} ${ly.toFixed(1)}`;
        break;
      }
      lx = atX(point.step);
      ly = atY(point.v);
      d += `${d ? "L" : "M"}${lx.toFixed(1)} ${ly.toFixed(1)}`;
    }
    return { d, lx, ly };
  }, [atX, atY]);

  const paint = useCallback((upto: number) => {
    rawPath.current?.setAttribute("d", draw(raw, upto).d);
    valPath.current?.setAttribute("d", draw(val, upto).d);
    const point = draw(smooth, upto);
    trainPath.current?.setAttribute("d", point.d);
    const group = head.current;
    if (!group) return;
    group.style.opacity = point.d ? "1" : "0";
    group.setAttribute("transform", `translate(${point.lx.toFixed(1)} 0)`);
    group.querySelector("circle")?.setAttribute("cy", point.ly.toFixed(1));
  }, [draw, raw, val, smooth]);

  useLayoutEffect(() => {
    if (width) paint(shown.get());
  }, [paint, shown, width]);

  useMotionValueEvent(shown, "change", (value) => {
    if (width) paint(value);
  });

  const steps = useMemo(() => raw.map((point) => point.step), [raw]);
  const nearest = (step: number) => {
    let best = steps[0];
    let distance = Infinity;
    for (const candidate of steps) {
      const delta = Math.abs(candidate - step);
      if (delta < distance) {
        distance = delta;
        best = candidate;
      }
    }
    return best;
  };

  const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!steps.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const step = ((event.clientX - rect.left - 32) / plotWidth) * totalSteps;
    onHover(nearest(Math.max(0, Math.min(steps.at(-1) ?? 0, step))));
  };

  const hoveredTrain = hover === null ? undefined : valueAt(smooth, hover);
  const hoveredVal = hover === null ? undefined : valueAt(val, Math.min(hover, val.at(-1)?.step ?? -1));

  const indices = Array.from({ length: epochs }, (_, index) => index);
  const per = totalSteps / epochs;

  return (
    <div className={styles.chart} data-tone={tone}>
      <div
        ref={plot}
        className={styles.plot}
        style={{ height: 156 }}
        tabIndex={loss.length ? 0 : -1}
        role="group"
        aria-label={label}
        onPointerMove={scrub}
        onPointerDown={scrub}
        onPointerLeave={() => onHover(null)}
        onKeyDown={(event) => {
          if (!steps.length) return;
          const current = hover === null ? steps.length - 1 : steps.indexOf(nearest(hover));
          const jump = event.shiftKey ? 10 : 1;
          let next: number | undefined;
          if (event.key === "ArrowLeft") next = steps[Math.max(0, current - (hover === null ? 0 : jump))];
          else if (event.key === "ArrowRight") next = steps[Math.min(steps.length - 1, current + (hover === null ? 0 : jump))];
          else if (event.key === "Home") next = steps[0];
          else if (event.key === "End") next = steps.at(-1);
          else {
            if (event.key !== "Escape" || hover === null) return;
            event.preventDefault();
            onHover(null);
            return;
          }
          event.preventDefault();
          onHover(next ?? null);
        }}
        onBlur={() => onHover(null)}
      >
        {width ? (
          <svg className={styles.svg} width={width} height={156} viewBox={`0 0 ${width} 156`} aria-hidden="true">
            {ticks.map((tick) => (
              <g key={tick}>
                <line className={styles.grid} x1={32} x2={width - 6} y1={atY(tick)} y2={atY(tick)} />
                <text className={styles.tick} x={24} y={atY(tick)} dy=".34em" textAnchor="end">{tick.toFixed(1)}</text>
              </g>
            ))}
            {indices.slice(1).map((index) => (
              <line key={index} className={styles.boundary} x1={atX(index * per)} x2={atX(index * per)} y1={8} y2={150} />
            ))}
            <path ref={rawPath} className={styles.raw} />
            <path ref={valPath} className={styles.val} />
            <path ref={trainPath} className={styles.train} />
            <g ref={head} className={styles.head} style={{ opacity: 0 }}>
              <line x1={0} x2={0} y1={8} y2={150} />
              <circle cx={0} cy={0} r={3.5} />
            </g>
            {hover !== null ? (
              <g className={styles.cursor} transform={`translate(${atX(hover).toFixed(1)} 0)`}>
                <line x1={0} x2={0} y1={8} y2={150} />
                {hoveredVal !== undefined ? <circle className={styles.cursorVal} cx={0} cy={atY(hoveredVal)} r={3} /> : null}
                {hoveredTrain !== undefined ? <circle className={styles.cursorTrain} cx={0} cy={atY(hoveredTrain)} r={3} /> : null}
              </g>
            ) : null}
          </svg>
        ) : null}
        {overlay ? <div className={styles.overlay} style={{ left: 32 }}>{overlay}</div> : null}
      </div>
      <div className={styles.epochs} style={{ paddingLeft: 32, paddingRight: 6 }} aria-hidden="true">
        {indices.map((index) => <EpochFill key={index} index={index} per={per} progress={progress} />)}
      </div>
    </div>
  );
}

function EpochFill({ index, per, progress }: { index: number; per: number; progress: MotionValue<number> }) {
  const fill = useTransform(progress, (value) => Math.max(0, Math.min(1, (value - index * per) / per)));
  return (
    <span className={styles.epoch}>
      <span className={styles.epochTrack}>
        <motion.span className={styles.epochFill} style={{ scaleX: fill }} />
      </span>
      <span className={styles.epochLabel}>{`Epoch ${index + 1}`}</span>
    </span>
  );
}

/* --------------------------------------------------------------- fragments */

/** Crossfades a value in place: 100ms out, 160ms in with a 2px rise. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }}
          exit={{ opacity: 0, transition: { duration: .1 * (reduced ? 0 : 1), ease } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A legend value in tabular numerals, hidden until there is something to read. */
function Num({ value }: { value?: string }) {
  return <span className={styles.num} data-empty={value === undefined || undefined}>{value ?? "0.000"}</span>;
}

function Spin() {
  return (
    <svg className={styles.spinner} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="6" className={styles.spinnerTrack} />
      <path d="M8 2a6 6 0 0 1 6 6" className={styles.spinnerArc} />
    </svg>
  );
}

const EVENT_ICON: Record<TrainingEventKind, (props: { size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: "true" }) => ReactNode> = {
  start: Play,
  checkpoint: Save,
  eval: FlaskConical,
  epoch: Flag,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  done: CircleCheck,
};

/* -------------------------------------------------------------------- card */

interface Action {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant: "secondary" | "accent" | "danger";
  loading?: boolean;
}

function ActionSlot({ action, reduced }: { action: Action | null; reduced: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {action ? (
        <motion.span
          key="slot"
          className={styles.slot}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }}
          exit={{ opacity: 0, transition: { duration: .1 * (reduced ? 0 : 1), ease } }}
        >
          <Button
            size="sm"
            variant={action.variant === "accent" ? "primary" : action.variant}
            loading={action.loading}
            className={action.variant === "accent" ? styles.accent : undefined}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

const icon16 = (Icon: typeof Play) => <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;

export const TrainingRun = forwardRef<HTMLDivElement, TrainingRunProps>(function TrainingRun({
  status,
  name = "Fine-tuning job",
  model,
  details = [],
  dataset,
  step = 0,
  totalSteps = 1,
  epochs = 1,
  loss = [],
  learningRate,
  elapsed,
  eta,
  events = [],
  metrics,
  activity,
  error,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRestart,
  onDeploy,
  notice,
  className,
}, ref) {
  const reduced = useReducedMotion() ?? false;
  const modelProp = model ?? DEFAULT_MODEL;
  const datasetProp = dataset ?? DEFAULT_DATASET;

  const total = Math.max(1, totalSteps);
  const epochCount = Math.max(1, epochs);
  const completedSteps = Math.min(Math.max(0, step), total);

  const shown = useSmoothed(loss.at(-1)?.step ?? 0, reduced);
  const progress = useSmoothed(status === "completed" ? total : completedSteps, reduced);

  const [hover, setHover] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deploy, setDeploy] = useState<{ phase: "idle" | "deploying" | "deployed" | "error"; endpoint?: string; error?: string }>({ phase: "idle" });
  const [seenStatus, setSeenStatus] = useState(status);

  if (seenStatus !== status) {
    setSeenStatus(status);
    setConfirming(false);
    if (status !== "completed") setDeploy({ phase: "idle" });
  }

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const deployment = useRef<AbortController | null>(null);
  useEffect(() => {
    if (status !== "completed") deployment.current?.abort();
  }, [status]);
  useEffect(() => () => deployment.current?.abort(), []);

  const runDeploy = async () => {
    if (!onDeploy || deploy.phase === "deploying") return;
    const controller = new AbortController();
    deployment.current = controller;
    setDeploy({ phase: "deploying" });
    try {
      const result = await onDeploy(controller.signal);
      if (!controller.signal.aborted) setDeploy({ phase: "deployed", endpoint: result?.endpoint });
    } catch (cause) {
      if (!controller.signal.aborted) {
        setDeploy({ phase: "error", error: cause instanceof Error ? cause.message : "Deploy failed" });
      }
    }
  };

  const smoothedPoints = useMemo(() => smoothTrain(loss), [loss]);
  const lastTrain = smoothedPoints.at(-1)?.v;
  const lastVal = useMemo(() => {
    for (let index = loss.length - 1; index >= 0; index -= 1) {
      if (loss[index].val !== undefined) return loss[index].val;
    }
    return undefined;
  }, [loss]);

  const inspected = hover === null ? null : {
    train: smoothedPoints.find((point) => point.step === hover)?.v,
    val: (() => {
      let value: number | undefined;
      for (const sample of loss) {
        if (sample.step > hover) break;
        if (sample.val !== undefined) value = sample.val;
      }
      return value;
    })(),
  };

  const trainValue = (inspected ? inspected.train : lastTrain)?.toFixed(3);
  const valValue = (inspected ? inspected.val : lastVal)?.toFixed(3);

  const stepText = hover !== null ? (
    <>Step <span className={styles.num}>{formatInteger(hover)}</span></>
  ) : (
    <>Step <span className={styles.num}>{formatInteger(completedSteps)}</span> / <span className={styles.num}>{formatInteger(total)}</span></>
  );

  const deployed = status === "completed" && deploy.phase === "deployed";
  const starting = status === "running" && loss.length === 0;

  const badge = deployed ? { key: "deployed", label: "Deployed", icon: <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "success" }
    : status === "queued" ? { key: "queued", label: "Queued", icon: <Clock3 size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" }
      : status === "running" ? { key: starting ? "starting" : "running", label: starting ? "Starting" : "Training", icon: <Spin />, tone: "live" }
        : status === "paused" ? { key: "paused", label: "Paused", icon: <Pause size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" }
          : status === "completed" ? { key: "completed", label: "Completed", icon: <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "success" }
            : status === "failed" ? { key: "failed", label: "Failed", icon: <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "danger" }
              : { key: "cancelled", label: "Cancelled", icon: <CircleSlash size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" };

  const epochNow = Math.min(epochCount, Math.floor(completedSteps / (total / epochCount)) + 1);
  const liveStats: TrainingMetric[] = [
    { label: "Epoch", value: status === "queued" || starting ? `0 of ${epochCount}` : `${epochNow} of ${epochCount}` },
    { label: "Learning rate", value: learningRate === undefined ? "Not set" : formatRate(learningRate) },
    { label: "Elapsed", value: formatTime(elapsed ?? 0) },
    {
      label: "ETA",
      value: status === "queued" ? `About ${formatTime(eta ?? 0)}`
        : status === "failed" || status === "cancelled" ? "Stopped"
          : status === "paused" ? "On hold"
            : formatTime(eta ?? 0),
    },
  ];
  const resultStats: TrainingMetric[] = metrics ?? [
    { label: "Train loss", value: lastTrain?.toFixed(3) ?? "0.000" },
    { label: "Validation loss", value: lastVal?.toFixed(3) ?? "0.000" },
    { label: "Steps", value: formatInteger(total) },
    { label: "Duration", value: formatTime(elapsed ?? 0) },
  ];
  const finished = status === "completed";
  const stats = finished ? resultStats.slice(0, 4) : liveStats;

  const chartOverlay = status === "queued" || starting ? (
    <span className={styles.overlayBox}>
      <span className={styles.overlayText} data-shimmer={reduced ? undefined : ""}>
        {activity ?? (starting ? "Starting" : "Waiting for a GPU")}
      </span>
    </span>
  ) : loss.length === 0 ? (
    <span className={styles.overlayBox}>
      <span className={styles.overlayText}>No loss samples yet</span>
    </span>
  ) : null;

  const info = deploy.phase === "error" ? {
    key: `deploy-error:${deploy.error}`,
    tone: "danger",
    body: (
      <>
        <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.truncate}>{deploy.error}</span>
      </>
    ),
  } : deployed && deploy.endpoint ? {
    key: `endpoint:${deploy.endpoint}`,
    tone: "plain",
    body: (
      <>
        <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" className={styles.successIcon} />
        <code className={`${styles.truncate} ${styles.endpoint}`}>{deploy.endpoint}</code>
        <CopyButton value={deploy.endpoint} label="Copy endpoint" iconOnly variant="plain" className={styles.copy} />
      </>
    ),
  } : status === "failed" && error ? {
    key: `error:${error}`,
    tone: "danger",
    body: (
      <>
        <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.truncate}>{error}</span>
      </>
    ),
  } : {
    key: `dataset:${datasetProp.name}`,
    tone: "plain",
    body: (
      <>
        {datasetProp.mark ? <span className={styles.datasetMark} aria-hidden="true">{datasetProp.mark}</span> : null}
        <span className={styles.truncate}>{datasetProp.name}</span>
        {datasetProp.examples !== undefined ? <span className={styles.muted}>{formatInteger(datasetProp.examples)} examples</span> : null}
      </>
    ),
  };

  const cancel: Action | null = onCancel ? (confirming ? {
    label: "Confirm cancel",
    onClick: () => {
      setConfirming(false);
      onCancel();
    },
    variant: "danger",
  } : {
    label: "Cancel",
    icon: icon16(X),
    onClick: () => setConfirming(true),
    variant: "secondary",
  }) : null;

  let primary: Action | null = null;
  let secondary: Action | null = null;
  if (status === "queued") {
    primary = cancel;
  } else if (status === "running") {
    primary = cancel;
    secondary = onPause ? { label: "Pause", icon: icon16(Pause), onClick: onPause, variant: "secondary" } : null;
  } else if (status === "paused") {
    primary = cancel;
    secondary = onResume ? { label: "Resume", icon: icon16(Play), onClick: onResume, variant: "accent" } : null;
  } else if (status === "failed") {
    primary = onRestart ? { label: "Run again", onClick: onRestart, variant: "secondary" } : null;
    secondary = onRetry ? { label: "Retry from checkpoint", icon: icon16(RotateCcw), onClick: onRetry, variant: "accent" } : null;
  } else if (status === "cancelled") {
    secondary = onRestart ? { label: "Run again", icon: icon16(RotateCcw), onClick: onRestart, variant: "accent" } : null;
  } else if (status === "completed") {
    primary = onRestart ? { label: "Run again", onClick: onRestart, variant: "secondary" } : null;
    secondary = onDeploy && !deployed ? {
      label: deploy.phase === "error" ? "Retry deploy" : deploy.phase === "deploying" ? "Deploying" : "Deploy",
      icon: icon16(Rocket),
      onClick: runDeploy,
      variant: "accent",
      loading: deploy.phase === "deploying",
    } : null;
  }

  const statusText = `${name}: ${badge.label}${status === "failed" && error ? `. ${error}` : ""}${confirming ? ". Press Confirm cancel to stop the run" : ""}`;
  const chartLabel = loss.length
    ? `Loss curve, step ${formatInteger(completedSteps)} of ${formatInteger(total)}. Train loss ${lastTrain?.toFixed(3) ?? "none"}, validation loss ${lastVal?.toFixed(3) ?? "none"}. Use the arrow keys to inspect steps.`
    : "Loss curve, no samples yet";
  const tone = status === "failed" ? "danger" : status === "completed" ? "done" : status === "running" ? "live" : "quiet";
  const eventRows = events.slice(-4).reverse();

  return (
    <div ref={ref} className={[styles.root, className].filter(Boolean).join(" ")} data-status={status}>
      <header className={styles.header}>
        {modelProp.mark ? <span className={styles.mark} aria-hidden="true">{modelProp.mark}</span> : null}
        <div className={styles.heading}>
          <h3 className={styles.title}>{name}</h3>
          <p className={styles.meta}>{[modelProp.name, ...details].join(" · ")}</p>
        </div>
        <Swap id={badge.key} className={styles.badgeSlot} reduced={reduced}>
          <span className={styles.badge} data-tone={badge.tone}>
            {badge.icon}
            <span>{badge.label}</span>
          </span>
        </Swap>
      </header>

      <section className={styles.curve} aria-label="Loss">
        <div className={styles.legend}>
          <span className={styles.key}>
            <span className={styles.swatch} data-series="train" aria-hidden="true" />
            <span className={styles.keyLabel}>Train</span>
            <Num value={trainValue} />
          </span>
          <span className={styles.key}>
            <span className={styles.swatch} data-series="val" aria-hidden="true" />
            <span className={styles.keyLabel}>
              <span className={styles.long}>Validation</span>
              <span className={styles.short}>Val</span>
            </span>
            <Num value={valValue} />
          </span>
          <span className={styles.stepText}>{stepText}</span>
        </div>
        <Chart
          loss={loss}
          totalSteps={total}
          epochs={epochCount}
          shown={shown}
          progress={progress}
          tone={tone}
          hover={hover}
          onHover={setHover}
          overlay={chartOverlay}
          label={chartLabel}
        />
      </section>

      <Swap id={finished ? "results" : "live"} className={styles.statsSlot} reduced={reduced}>
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>
                <span className={finished || stat === liveStats[1] ? undefined : styles.num}>{stat.value}</span>
                {stat.hint ? <span className={styles.hint}>{stat.hint}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </Swap>

      <section className={styles.events} aria-label="Events">
        <ol className={styles.eventList}>
          {eventRows.length ? (
            <AnimatePresence initial={false}>
              {eventRows.map((event, index) => {
                const Icon = EVENT_ICON[event.kind];
                return (
                  <motion.li
                    key={event.id}
                    className={styles.event}
                    data-kind={event.kind}
                    aria-hidden={index > 2 || undefined}
                    initial={{ opacity: 0, y: 32 * index }}
                    animate={{ opacity: index > 2 ? 0 : 1, y: 32 * index }}
                    exit={{ opacity: 0, transition: { duration: .1 * (reduced ? 0 : 1) } }}
                    transition={reduced ? { duration: 0 } : {
                      y: { type: "spring", visualDuration: .24, bounce: 0 },
                      opacity: { duration: motionTokens.duration.fast, ease },
                    }}
                  >
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true" className={styles.eventIcon} />
                    <span className={styles.truncate}>{event.label}</span>
                    {event.step !== undefined ? <span className={styles.eventStep}>Step {formatInteger(event.step)}</span> : null}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          ) : (
            <li className={styles.eventEmpty}>Evals and checkpoints show here</li>
          )}
        </ol>
      </section>

      <footer className={styles.footer}>
        <Swap id={info.key} className={styles.infoSlot} reduced={reduced}>
          <span className={styles.info} data-tone={info.tone}>{info.body}</span>
        </Swap>
        <div className={styles.actions}>
          <ActionSlot action={primary} reduced={reduced} />
          <ActionSlot action={secondary} reduced={reduced} />
        </div>
      </footer>

      <span className={styles.srOnly} role="status">{[statusText, notice].filter(Boolean).join(". ")}</span>
    </div>
  );
});

export default TrainingRun;

/* ------------------------------------------------------------- simulation */

const DEFAULT_MODEL: TrainingModel = { name: "Qwen3.8 Max", mark: <QwenColorMark /> };
const DEFAULT_DATASET: TrainingDataset = { name: "arcwork/support-tickets-oct", examples: 48210, mark: <HuggingFaceMark /> };

const TOTAL_STEPS = 1860;
const STEPS_PER_SECOND = 1860 / 1120;

const noise = (step: number) => {
  const value = 43758.5453 * Math.sin(12.9898 * step + 78.233);
  return value - Math.floor(value) - .5;
};
const trainLoss = (step: number) =>
  .3 + 1.62 * Math.exp(-step / 240) + .14 * Math.exp(-step / 1100)
  - .035 * Math.floor(Math.min(step, 1859) / 620)
  + .08 * noise(step) * (.45 + .55 * Math.exp(-step / 700));
const valLoss = (step: number) =>
  .44 + 1.38 * Math.exp(-step / 280) + .1 * Math.exp(-step / 1000)
  + 3e-5 * Math.max(0, step - 1300)
  + .01 * noise(step + 7);
const accuracy = (step: number) => .87 - .29 * Math.exp(-step / 520);

let eventSeq = 0;
const makeEvent = (kind: TrainingEventKind, label: string, step?: number): TrainingEvent => ({ id: `e${++eventSeq}`, kind, label, step });

type SimPhase = "queue" | "warmup" | "train" | "idle" | "hold";

interface SimState {
  status: TrainingRunStatus;
  step: number;
  loss: LossSample[];
  events: TrainingEvent[];
  activity?: string;
  wait: number;
  phase: SimPhase;
  failedOnce: boolean;
  error?: string;
  notice?: string;
}

const freshRun = (): SimState => ({
  status: "queued",
  step: 0,
  loss: [],
  events: [],
  activity: "Waiting for 8× H200 · 2nd in queue",
  wait: 1300,
  phase: "queue",
  failedOnce: false,
});

/** Adds every sample the run crossed since the last frame, with its evals and checkpoints. */
function advance(state: SimState, target: number): SimState {
  const loss = state.loss.slice();
  const events = state.events.slice();
  for (let step = 10 * Math.floor(state.step / 10) + 10; step <= target; step += 10) {
    const sample: LossSample = { step, train: trainLoss(step) };
    if (step % 60 === 0 || step === TOTAL_STEPS) sample.val = valLoss(step);
    loss.push(sample);
    if (step % 620 === 0 && step < TOTAL_STEPS) events.push(makeEvent("checkpoint", `Checkpoint saved · epoch ${step / 620}`, step));
    if (step % 310 === 0 && step % 620 !== 0) events.push(makeEvent("eval", `Eval: ${accuracy(step).toFixed(2)} accuracy`, step));
  }
  return { ...state, step: target, loss, events };
}

export interface TrainingRunSimulation extends TrainingRunProps {
  status: TrainingRunStatus;
}

/** Plays a simulated LoRA run of Qwen3.8 Max so the card can be prototyped before a job API is wired. */
export function useTrainingRunSimulation(scenario: "healthy" | "oom" = "healthy", active = true) {
  const [state, setState] = useState<SimState>(freshRun);
  const live = useRef(active);

  useEffect(() => {
    live.current = active;
  }, [active]);

  const [currentScenario, setCurrentScenario] = useState(scenario);
  if (currentScenario !== scenario) {
    setCurrentScenario(scenario);
    setState(freshRun());
  }

  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(100, now - previous);
      previous = now;
      if (!live.current) return;
      setState((previousState) => {
        if (previousState.phase === "queue" || previousState.phase === "warmup" || previousState.phase === "hold") {
          const wait = previousState.wait - delta;
          if (wait > 0) return { ...previousState, wait };
          if (previousState.phase === "queue") {
            return {
              ...previousState,
              status: "running",
              phase: "warmup",
              wait: 900,
              activity: `Loading weights · ${(48210).toLocaleString("en-US")} examples`,
            };
          }
          if (previousState.phase === "warmup") {
            return {
              ...previousState,
              phase: "train",
              activity: undefined,
              loss: [{ step: 0, train: trainLoss(0), val: valLoss(0) }],
              events: [makeEvent("start", "Training started on 8× H200", 0)],
            };
          }
          return { ...freshRun(), failedOnce: false };
        }
        if (previousState.phase !== "train" || previousState.status !== "running") return previousState;

        const reached = Math.min(TOTAL_STEPS, previousState.step + (TOTAL_STEPS * delta) / 14000);
        const failed = scenario === "oom" && !previousState.failedOnce && reached >= 940;
        const next = advance(previousState, failed ? 940 : reached);

        if (failed) {
          return {
            ...next,
            status: "failed",
            phase: "idle",
            failedOnce: true,
            error: `CUDA out of memory on GPU 3 at step ${(940).toLocaleString("en-US")}`,
            events: [...next.events, makeEvent("error", "Out of memory · GPU 3", 940)],
            notice: "Run failed at step 940. Simulated, nothing was sent.",
          };
        }
        if (reached >= TOTAL_STEPS) {
          return {
            ...next,
            status: "completed",
            phase: "hold",
            wait: 9000,
            events: [...next.events, makeEvent("done", `Training complete · ${accuracy(1860).toFixed(2)} accuracy`, 1860)],
          };
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [scenario]);

  const pause = useCallback(() => setState((state) => (state.status === "running" ? {
    ...state,
    status: "paused",
    notice: `Paused at step ${Math.floor(state.step).toLocaleString("en-US")}. Simulated, nothing was sent.`,
  } : state)), []);

  const resume = useCallback(() => setState((state) => (state.status === "paused" ? {
    ...state,
    status: "running",
    notice: "Resumed. Simulated, nothing was sent.",
  } : state)), []);

  const cancel = useCallback(() => setState((state) => ({
    ...state,
    status: "cancelled",
    phase: "hold",
    wait: 7000,
    activity: undefined,
    events: [...state.events, makeEvent("warning", "Cancelled · last checkpoint kept", Math.floor(state.step))],
    notice: "Run cancelled. Simulated, nothing was sent.",
  })), []);

  const retry = useCallback(() => setState((state) => {
    const step = 620 * Math.floor(state.step / 620);
    return {
      ...state,
      status: "running",
      phase: "train",
      step,
      error: undefined,
      loss: state.loss.filter((sample) => sample.step <= step),
      events: [...state.events, makeEvent("info", step ? `Resumed from checkpoint · epoch ${step / 620}` : "Restarted from step 0", step)],
      notice: `Retrying from step ${step.toLocaleString("en-US")}. Simulated, nothing was sent.`,
    };
  }), []);

  const restart = useCallback(() => setState(() => ({ ...freshRun(), notice: "Run queued again. Simulated, nothing was sent." })), []);

  const deploy = useCallback(async (signal: AbortSignal) => {
    setState((state) => ({ ...state, wait: Math.max(state.wait, 8000) }));
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1200);
      signal.addEventListener("abort", () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    });
    setState((state) => ({ ...state, wait: 6500, notice: "Deployed. Simulated, nothing was deployed." }));
    return { endpoint: "ft:qwen3.8-max:arcwork:support-triage-v3" };
  }, []);

  const step = Math.floor(state.step);
  const firstVal = state.loss[0]?.val ?? valLoss(0);
  const lastVal = [...state.loss].reverse().find((sample) => sample.val !== undefined)?.val ?? firstVal;
  const results: TrainingMetric[] | undefined = state.status === "completed" ? [
    { label: "Validation loss", value: lastVal.toFixed(3), hint: `from ${firstVal.toFixed(2)}` },
    { label: "Eval accuracy", value: accuracy(1860).toFixed(2), hint: `from ${accuracy(0).toFixed(2)}` },
    { label: "Train loss", value: (smoothTrain(state.loss).at(-1)?.v ?? 0).toFixed(3), hint: "smoothed" },
    { label: "Cost", value: "$9.70", hint: "Sample" },
  ] : undefined;

  return {
    status: state.status,
    step,
    totalSteps: TOTAL_STEPS,
    epochs: 3,
    loss: state.loss,
    learningRate: step < 60 ? (step / 60) * 2e-4 : 2e-5 + 9e-5 * (1 + Math.cos((Math.PI * (step - 60)) / 1800)),
    elapsed: step / STEPS_PER_SECOND,
    eta: (TOTAL_STEPS - step) / STEPS_PER_SECOND,
    events: state.events,
    metrics: results,
    activity: state.activity,
    error: state.error,
    notice: state.notice,
    onPause: pause,
    onResume: resume,
    onCancel: cancel,
    onRetry: retry,
    onRestart: restart,
    onDeploy: deploy,
  } satisfies TrainingRunSimulation;
}
