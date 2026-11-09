"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, Minus, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import { sampleResults, sampleRubric, sampleRuns, sampleSuite } from "./eval-suite-data";
import type { EvalCaseData, EvalCaseResult, EvalFilter, EvalOutcome, EvalRunRecord, EvalSuiteData } from "./eval-suite-data";
import styles from "./eval-suite.module.css";

export type { EvalCaseData, EvalCaseResult, EvalFilter, EvalModel, EvalOutcome, EvalRunRecord, EvalSuiteData, EvalVersion } from "./eval-suite-data";

export interface EvalSuiteProps {
  /** The suite: name, candidate { version, model }, baseline { version, model }, judge model, optional categories (row order), rubric (criteria the judge scores 1 to 5), cases and an estimate { costUsd, seconds } shown before the first run. A model is { name, brand?: "claude" | "openai", mark?: ReactNode }. Each case has id, category, title and its baseline outcome; add input, expected, baselineOutput and baselineScores to give it a drilldown. */
  suite?: EvalSuiteData;
  /** Earlier runs, oldest first, each { id, label, score, date? } with the score in percent. The sparkline shows the last seven plus the current run, and rings the last one as the baseline. */
  runs?: EvalRunRecord[];
  /** Runs the suite. Yield each EvalCaseResult { caseId, outcome, output?, scores?, rationale?, error?, costUsd? } as it is scored to fill the grid live, or resolve every result at once. Call started(caseId) to show a case as in flight. Stop aborts the signal. Throw to show the failed state with Try again. Without it, the run is simulated on eight workers and announced as simulated. */
  onRun?: (suite: EvalSuiteData, context: { signal: AbortSignal; started: (caseId: string) => void }) => AsyncIterable<EvalCaseResult> | Promise<EvalCaseResult[]>;
  /** Called by Mark as expected and Open issue. Return or resolve an issue key such as "SUP-2481" for an issue; reject to restore the buttons. Without it, triage is simulated and says so. */
  onTriage?: (caseId: string, action: "expected" | "issue") => void | string | Promise<void | string>;
  /** The filter the case list opens with. */
  defaultFilter?: EvalFilter;
  /** Class on the root element. */
  className?: string;
  /** Renders the card without its own surface. The preview frame flattens the card below 959px. */
  flat?: boolean;
}

type Status = "idle" | "running" | "done" | "stopped" | "failed";
type RunState = {
  status: Status;
  results: Record<string, EvalCaseResult>;
  inflight: string[];
  elapsed: number;
  simulated: boolean;
  id: number;
  error?: string;
};
type Change = "regression" | "improved" | null;
type Triage = { action: "expected" | "issue"; status: "pending" | "done"; issueKey?: string };
type TriageEntry = Record<string, Triage>;

const OUTCOME_LABEL: Record<EvalOutcome, string> = { pass: "Pass", fail: "Fail", error: "Error" };
const FILTER_LABEL: Record<EvalFilter, string> = { all: "All", failed: "Failed", regressions: "Regressions", improved: "Improved" };
const GLYPH_PATH: Record<EvalOutcome, string> = {
  pass: "M3.4 6.3 5.2 8.1 8.7 4.2",
  fail: "M4 4l4 4M8 4 4 8",
  error: "M6 3.4v3.1M6 8.55v.05",
};
const RUN_LABELS = [
  ["run", "Run"],
  ["stop", "Stop"],
  ["again", "Run again"],
] as const;

const morphSpring = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;
const instant = { duration: 0 } as const;
const listTransition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] } as const;
const countSpring = { type: "spring", visualDuration: 0.45, bounce: 0 } as const;

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const scoreText = (value: number) => value.toFixed(1);
const percentText = (value: number) => `${Math.round(value)}%`;
const moneyText = (value: number) => `$${value.toFixed(2)}`;

/** Round to one decimal and keep the typographic minus, so a delta never reflows the row. */
function deltaText(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? "0.0" : `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

const deltaTone = (value: number) => (Math.abs(value) < 0.05 ? "flat" : value > 0 ? "up" : "down");

function deltaSentence(value: number) {
  const tone = deltaTone(value);
  const text = deltaText(value).replace(/^[+−]/, "");
  return tone === "flat" ? "no change" : `${tone} ${text} points`;
}

const ratio = (value: number, total: number) => (total ? (value / total) * 100 : 0);

function Fnv1a(id: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 0x1000193);
  return ((hash >>> 0) % 1e3) / 1e3;
}

function ClaudeMark({ title = "Claude", className, ...rest }: { title?: string; className?: string } & React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className} {...rest}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", className, ...rest }: { title?: string; className?: string } & React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className} {...rest}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function LinearMark({ title = "Linear", className, ...rest }: { title?: string; className?: string } & React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className} {...rest}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

/** The outcome glyph. Shape, not colour, carries the meaning, so every cell reads at 8px. */
function Glyph({ outcome, className }: { outcome: EvalOutcome; className?: string }) {
  return (
    <svg className={cn(styles.glyph, className)} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d={GLYPH_PATH[outcome]} />
    </svg>
  );
}

function Mini({ outcome, strong }: { outcome?: EvalOutcome; strong?: boolean }) {
  return (
    <span className={styles.mini} data-outcome={outcome} data-strong={strong || undefined} aria-hidden="true">
      {outcome && <Glyph outcome={outcome} />}
    </span>
  );
}

function ModelMark({ model }: { model: EvalSuiteData["judge"] }) {
  if (model.mark) {
    return (
      <span className={styles.mark} aria-hidden="true">
        {model.mark}
      </span>
    );
  }
  if (model.brand === "claude") return <ClaudeMark className={styles.mark} data-brand="claude" aria-hidden="true" title="" />;
  if (model.brand === "openai") return <OpenAIMark className={styles.mark} aria-hidden="true" title="" />;
  return null;
}

function Chip({ model, version }: { model: EvalSuiteData["judge"]; version?: string }) {
  return (
    <span className={styles.chip}>
      <ModelMark model={model} />
      <span className={styles.chipName}>{model.name}</span>
      {version && <span className={styles.chipVersion}>{version}</span>}
    </span>
  );
}

/** A score that counts to its new value on one spring, so a burst of results reads as a single count. */
function AnimatedCount({ value, format, className }: { value: number; format: (value: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const current = useMotionValue(value);
  const text = useTransform(current, format);
  useEffect(() => {
    if (reduced || value === 0) {
      current.jump(value);
      return;
    }
    const controls = animate(current, value, countSpring);
    return () => controls.stop();
  }, [value, reduced, current]);
  return (
    <span className={cn(styles.count, className)}>
      <span className={styles.srOnly}>{format(value)}</span>
      <motion.span aria-hidden="true">{text}</motion.span>
    </span>
  );
}

/** Follows the height of whatever filter arm is mounted, so the list never jumps between filters. */
function AutoHeight({ children, armKey, className }: { children: ReactNode; armKey: string; className?: string }) {
  const reduced = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [lastKey, setLastKey] = useState(armKey);
  const [armed, setArmed] = useState(false);

  if (armKey !== lastKey) {
    setLastKey(armKey);
    setArmed(true);
  }

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 600);
    return () => window.clearTimeout(timer);
  }, [armed, lastKey]);

  return (
    <motion.div className={cn(styles.autoHeight, className)} initial={false} animate={{ height }} transition={armed && !reduced ? motionTokens.spring.smooth : instant}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

interface SegOption {
  value: EvalFilter;
  label: string;
  count?: number;
}

/** The case filter: a radio group with roving focus and a highlight that glides between options. */
function FilterSeg({ options, value, onChange, label, controls }: { options: SegOption[]; value: EvalFilter; onChange: (value: EvalFilter) => void; label: string; controls: string }) {
  const reduced = useReducedMotion();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = Math.max(0, options.findIndex((option) => option.value === value));

  const move = (index: number) => {
    onChange(options[index].value);
    refs.current[index]?.focus({ preventScroll: true });
    refs.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    move(next);
  };

  return (
    <div className={styles.seg} role="radiogroup" aria-label={label} aria-controls={controls}>
      {options.map((option, index) => {
        const on = index === active;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            className={styles.segOption}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-on={on || undefined}
            onClick={() => move(index)}
            onKeyDown={onKeyDown}
          >
            {on && <motion.span layoutId="filter-highlight" className={styles.segHighlight} style={{ borderRadius: 999 }} transition={reduced ? instant : morphSpring} aria-hidden="true" />}
            <span className={styles.segLabel}>
              {option.label}
              {option.count !== undefined && <span className={styles.segCount}>{option.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Run, Stop and Run again crossfade in place while the pill follows the width of the measured label. */
function RunButton({ which, onClick, label }: { which: "run" | "stop" | "again"; onClick: () => void; label: string }) {
  const reduced = useReducedMotion();
  const refs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [lastWhich, setLastWhich] = useState(which);
  const [armed, setArmed] = useState(false);

  if (which !== lastWhich) {
    setLastWhich(which);
    setArmed(true);
  }

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setWidths(Object.fromEntries(RUN_LABELS.map(([key]) => [key, refs.current[key]?.offsetWidth ?? 0])));
    });
    RUN_LABELS.forEach(([key]) => {
      const node = refs.current[key];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <button type="button" className={styles.run} data-running={which === "stop" || undefined} onClick={onClick} aria-label={label}>
      <span className={styles.runIcon} aria-hidden="true">
        <Play data-on={which === "run" || undefined} />
        <Square data-on={which === "stop" || undefined} />
        <RotateCcw data-on={which === "again" || undefined} />
      </span>
      <motion.span className={styles.runLabel} aria-hidden="true" initial={false} animate={{ width: widths[which] || "auto" }} transition={armed && !reduced ? morphSpring : instant}>
        {RUN_LABELS.map(([key, text]) => (
          <span
            key={key}
            ref={(node) => {
              refs.current[key] = node;
            }}
            data-on={key === which || undefined}
          >
            {text}
          </span>
        ))}
      </motion.span>
    </button>
  );
}

function Bar({ value, baseline, tone, className }: { value: number; baseline?: number; tone?: "up" | "down" | "flat"; className?: string }) {
  return (
    <span className={cn(styles.bar, className)} data-tone={tone} aria-hidden="true">
      <span className={styles.barFill} style={{ "--p": Math.max(0, Math.min(1, value)) } as CSSProperties} />
      {baseline !== undefined && <span className={styles.ghost} style={{ "--b": Math.max(0, Math.min(1, baseline)) } as CSSProperties} />}
    </span>
  );
}

function Delta({ value, unit, className }: { value: number; unit?: boolean; className?: string }) {
  const tone = deltaTone(value);
  const Icon = tone === "up" ? ArrowUp : tone === "down" ? ArrowDown : Minus;
  const text = deltaText(value).replace(/^[+−]/, "");
  return (
    <span className={cn(styles.delta, className)} data-dir={tone}>
      <Icon className={styles.deltaIcon} aria-hidden="true" />
      <span>
        {text}
        {unit ? " pts" : ""}
      </span>
    </span>
  );
}

interface SparkProps {
  runs: EvalRunRecord[];
  current: number | null;
  currentLabel: string;
  tone: "up" | "down" | "flat";
}

/** Last seven runs plus the live one. Hovering or arrowing steps a readout through them; Escape returns to the latest. */
function Sparkline({ runs, current, currentLabel, tone }: SparkProps) {
  const reduced = useReducedMotion();
  const history = runs.slice(-7);
  const points = [...history.map((run) => ({ label: run.label, score: run.score, date: run.date })), { label: currentLabel, score: current, date: undefined }];
  const scores = points.map((point) => point.score).filter((score): score is number => score !== null);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const pad = Math.max(2, (max - min) * 0.18);
  let low = min - pad;
  let high = max + pad;
  if (high - low < 8) {
    const middle = (high + low) / 2;
    low = middle - 4;
    high = middle + 4;
  }
  const length = points.length;
  const x = (index: number) => (length > 1 ? (index / (length - 1)) * 100 : 50);
  const y = (score: number) => 100 - ((score - low) / (high - low)) * 100;
  const line = history.map((run, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(run.score).toFixed(2)}`).join(" ");
  const last = history.length - 1;
  const tail =
    current !== null && last >= 0 ? `M${x(last).toFixed(2)} ${y(history[last].score).toFixed(2)} L${x(length - 1).toFixed(2)} ${y(current).toFixed(2)}` : null;

  const [hovered, setHovered] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const index = hovered ?? (current !== null ? length - 1 : last);
  const active = points[Math.max(0, index)];
  const readout = active
    ? `${active.label}${index === last && last < length - 1 ? " baseline" : ""} · ${active.score === null ? "not run" : `${active.score.toFixed(1)}%`}${active.date ? ` · ${active.date}` : ""}`
    : "";

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const from = hovered ?? index;
    const next = ({ ArrowLeft: from - 1, ArrowDown: from - 1, ArrowRight: from + 1, ArrowUp: from + 1, Home: 0, End: length - 1 } as Record<string, number>)[event.key];
    if (event.key === "Escape") setHovered(null);
    else if (next !== undefined) {
      event.preventDefault();
      setHovered(Math.max(0, Math.min(length - 1, next)));
    }
  };

  return (
    <div className={styles.spark}>
      <div className={styles.statLabel}>
        <span>{`Last ${length} runs`}</span>
        <span className={styles.sparkReadout} aria-hidden="true">
          {readout}
        </span>
      </div>
      <div
        ref={plot}
        className={styles.sparkPlot}
        role="slider"
        tabIndex={0}
        aria-label="Run history"
        aria-valuemin={1}
        aria-valuemax={length}
        aria-valuenow={index + 1}
        aria-valuetext={readout}
        onPointerMove={(event) => {
          const rect = plot.current?.getBoundingClientRect();
          if (!rect?.width) {
            setHovered(null);
            return;
          }
          setHovered(Math.max(0, Math.min(length - 1, Math.round(((event.clientX - rect.left) / rect.width) * (length - 1)))));
        }}
        onPointerLeave={() => setHovered(null)}
        onBlur={() => setHovered(null)}
        onKeyDown={onKeyDown}
      >
        <svg className={styles.sparkSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path className={styles.sparkLine} d={line} vectorEffect="non-scaling-stroke" />
          {tail && (
            <motion.path
              className={styles.sparkTail}
              data-tone={tone}
              d={tail}
              vectorEffect="non-scaling-stroke"
              initial={!reduced && { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}
            />
          )}
        </svg>
        {current === null && <span className={styles.sparkSlot} style={{ left: `${x(length - 1)}%` }} aria-hidden="true" />}
        {points.map((point, dot) =>
          point.score === null ? null : (
            <span
              key={`${point.label}${dot}`}
              aria-hidden="true"
              className={styles.sparkDot}
              data-kind={dot === length - 1 ? "current" : dot === last ? "baseline" : undefined}
              data-tone={dot === length - 1 ? tone : undefined}
              data-active={hovered === dot || undefined}
              style={{ left: `${x(dot)}%`, top: `${y(point.score)}%` }}
            />
          ),
        )}
      </div>
      <div className={styles.sparkAxis} aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{currentLabel}</span>
      </div>
    </div>
  );
}

/** One diff run, with its trailing whitespace kept outside the mark so the two panes still read as prose. */
function DiffChunk({ kind, text }: { kind: "add" | "del"; text: string }) {
  const body = text.trimEnd();
  const trailing = text.slice(body.length);
  return kind === "add" ? (
    <>
      <ins className={styles.diffAdd}>{body}</ins>
      {trailing}
    </>
  ) : (
    <>
      <del className={styles.diffDel}>{body}</del>
      {trailing}
    </>
  );
}

interface DiffPart {
  type: "same" | "change";
  before: string;
  after: string;
}

/** Word level diff. When the two replies share little wording the panes show plain text instead of a wall of marks. */
function diffWords(before: string, after: string) {
  const a = before.match(/\S+\s*/g) ?? [];
  const b = after.match(/\S+\s*/g) ?? [];
  const same = (i: number, j: number) => a[i].trimEnd() === b[j].trimEnd();
  const table = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = same(i, j) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  let parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], beforeText = "", afterText = "") => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) {
      last.before += beforeText;
      last.after += afterText;
    } else parts.push({ type, before: beforeText, after: afterText });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(i, j)) push("same", a[i++], b[j++]);
    else if (table[i + 1][j] >= table[i][j + 1]) push("change", a[i++]);
    else push("change", "", b[j++]);
  }
  while (i < a.length) push("change", a[i++]);
  while (j < b.length) push("change", "", b[j++]);

  for (let merged = true; merged; ) {
    merged = false;
    for (let index = 1; index < parts.length - 1; index++) {
      const part = parts[index];
      if (part.type !== "same" || part.before.trim().split(/\s+/).length > 1 || parts[index - 1].type !== "change" || parts[index + 1].type !== "change") continue;
      const left = parts[index - 1];
      const right = parts[index + 1];
      parts = [
        ...parts.slice(0, index - 1),
        { type: "change", before: left.before + part.before + right.before, after: left.after + part.after + right.after },
        ...parts.slice(index + 2),
      ];
      merged = true;
      break;
    }
  }

  const shared = parts.reduce((total, part) => total + (part.type === "same" ? part.after.length : 0), 0);
  return { parts, rewritten: shared / Math.max(1, before.length, after.length) < 0.3 };
}

interface DetailProps {
  suite: EvalSuiteData;
  item: EvalCaseData;
  result?: EvalCaseResult;
  rubric: string[];
  triage?: Triage;
  simulated: boolean;
  onTriage: (action: "expected" | "issue") => void;
  onUndo: () => void;
}

function Detail({ suite, item, result, rubric, triage, simulated, onTriage, onUndo }: DetailProps) {
  const baselineOutput = item.baselineOutput;
  const output = result?.output;
  const diff = useMemo(() => (baselineOutput && output ? diffWords(baselineOutput, output) : null), [baselineOutput, output]);
  const baselineOutcome = item.baseline;
  const outcome = result?.outcome;
  const scored = Boolean(result?.scores?.length);
  const pendingAction = triage?.status === "pending" ? triage.action : null;
  const actions = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const run = (action: () => void) => {
    moved.current = true;
    action();
  };
  const triageStatus = triage?.status ?? "none";

  useEffect(() => {
    if (triageStatus === "pending" || !moved.current) return;
    moved.current = false;
    const node = actions.current;
    (node?.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? node?.querySelector<HTMLElement>("[tabindex='-1']"))?.focus({ preventScroll: true });
  }, [triageStatus]);

  return (
    <div className={styles.detail}>
      <dl className={styles.defs}>
        <div className={styles.def}>
          <dt>Input</dt>
          <dd className={styles.quote}>{item.input}</dd>
        </div>
        {item.expected && (
          <div className={styles.def}>
            <dt>Expected</dt>
            <dd>{item.expected}</dd>
          </div>
        )}
      </dl>

      <div className={styles.compare}>
        <section className={styles.pane} aria-label={`${suite.baseline.version} output`}>
          <header className={styles.paneHead}>
            <span className={styles.paneTitle}>
              <ModelMark model={suite.baseline.model} />
              {suite.baseline.version}
              <span className={styles.paneModel}>{suite.baseline.model.name}</span>
            </span>
            <span className={styles.outcomeTag} data-outcome={baselineOutcome}>
              <Glyph outcome={baselineOutcome} />
              {OUTCOME_LABEL[baselineOutcome]}
            </span>
          </header>
          <p className={styles.paneBody}>
            {diff && !diff.rewritten
              ? diff.parts.map((part, index) =>
                  part.type === "change" ? part.before && <DiffChunk key={index} kind="del" text={part.before} /> : <span key={index}>{part.before}</span>,
                )
              : item.baselineOutput}
          </p>
        </section>

        <section className={styles.pane} aria-label={`${suite.candidate.version} output`}>
          <header className={styles.paneHead}>
            <span className={styles.paneTitle}>
              <ModelMark model={suite.candidate.model} />
              {suite.candidate.version}
              <span className={styles.paneModel}>{suite.candidate.model.name}</span>
            </span>
            {outcome && (
              <span className={styles.outcomeTag} data-outcome={outcome}>
                <Glyph outcome={outcome} />
                {OUTCOME_LABEL[outcome]}
              </span>
            )}
          </header>
          {result?.error && !result.output ? (
            <p className={styles.paneError}>
              <AlertCircle aria-hidden="true" />
              {result.error}
            </p>
          ) : (
            <p className={styles.paneBody}>
              {diff && !diff.rewritten
                ? diff.parts.map((part, index) =>
                    part.type === "change" ? part.after && <DiffChunk key={index} kind="add" text={part.after} /> : <span key={index}>{part.after}</span>,
                  )
                : (result?.output ?? <span className={styles.muted}>Not run yet</span>)}
            </p>
          )}
        </section>
      </div>

      <section className={styles.judge} aria-label={`Judge, ${suite.judge.name}`}>
        <div className={styles.judgeHead} aria-hidden="true">
          Judge
        </div>
        <div className={styles.judgeBody}>
          <p className={styles.judgeModel}>
            <span className={styles.judgeKey}>Judge</span>
            <ModelMark model={suite.judge} />
            <span className={styles.judgeName}>{suite.judge.name}</span>
            {scored && item.baselineScores && (
              <span className={styles.judgeLegend} aria-hidden="true">
                <span className={styles.ghostKey} />
                {suite.baseline.version}
              </span>
            )}
          </p>
          {scored ? (
            <ul className={styles.rubric}>
              {rubric.map((name, index) => {
                const score = result?.scores?.[index];
                const base = item.baselineScores?.[index];
                if (score === undefined) return null;
                const change = base === undefined ? 0 : score - base;
                return (
                  <li key={name} className={styles.rubricRow}>
                    <span className={styles.rubricName}>{name}</span>
                    <Bar value={score / 5} baseline={base === undefined ? undefined : base / 5} tone={deltaTone(change)} className={styles.rubricBar} />
                    <span className={styles.rubricScore}>
                      <span className={styles.srOnly}>{`${suite.candidate.version} ${score} of 5${base === undefined ? "" : `, ${suite.baseline.version} ${base}`}`}</span>
                      <span aria-hidden="true">
                        {score}
                        <span className={styles.muted}> / 5</span>
                      </span>
                    </span>
                    <span className={styles.rubricDelta} aria-hidden="true">
                      {base !== undefined && change !== 0 ? <Delta value={change} /> : <span className={styles.muted}>Same</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.rationale}>{result?.error ? "Not scored. The case errored before the judge could read a reply." : "Scores appear once the case runs."}</p>
          )}
          {result?.rationale && <p className={styles.rationale}>{result.rationale}</p>}
        </div>
      </section>

      <div ref={actions} className={styles.actions}>
        {triage?.status === "done" ? (
          <p className={styles.triaged} tabIndex={-1}>
            <span className={styles.triagedMain}>
              <span className={styles.triagedIcon}>
                {triage.action === "expected" ? <Check aria-hidden="true" /> : <LinearMark className={styles.linear} aria-hidden="true" title="" />}
              </span>
              <span className={styles.triagedText}>
                {triage.action === "expected" ? "Marked as expected. Later runs will not count it as a regression." : `${triage.issueKey ?? "Issue"} opened in Linear${simulated ? " (simulated)" : ""}`}
              </span>
            </span>
            {triage.action === "expected" && (
              <Button variant="ghost" size="sm" className={styles.undo} onClick={() => run(onUndo)}>
                <RotateCcw aria-hidden="true" />
                Undo
              </Button>
            )}
          </p>
        ) : (
          <>
            <Button variant="secondary" size="sm" loading={pendingAction === "expected"} disabled={Boolean(pendingAction) && pendingAction !== "expected"} onClick={() => run(() => onTriage("expected"))}>
              <Check aria-hidden="true" />
              Mark as expected
            </Button>
            <Button variant="secondary" size="sm" loading={pendingAction === "issue"} disabled={Boolean(pendingAction) && pendingAction !== "issue"} onClick={() => run(() => onTriage("issue"))}>
              <LinearMark className={styles.linear} aria-hidden="true" title="" />
              Open issue
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  id: string;
  item: EvalCaseData;
  suite: EvalSuiteData;
  rubric: string[];
  result?: EvalCaseResult;
  change: Change;
  open: boolean;
  triage?: Triage;
  simulated: boolean;
  onToggle: () => void;
  onTriage: (action: "expected" | "issue") => void;
  onUndo: () => void;
}

function Row({ id, item, suite, rubric, result, change, open, triage, simulated, onToggle, onTriage, onUndo }: RowProps) {
  const reduced = useReducedMotion();
  const hasInput = Boolean(item.input);
  const panel = `${id}-panel`;
  const outcome = result?.outcome;
  const hiddenText = `${suite.baseline.version} ${OUTCOME_LABEL[item.baseline].toLowerCase()}, ${suite.candidate.version} ${outcome ? OUTCOME_LABEL[outcome].toLowerCase() : "not run"}${change === "regression" ? ", regression" : change === "improved" ? ", improved" : ""}`;
  const tag = triage?.status === "done" ? triage : undefined;

  const content = (
    <>
      <span className={styles.trans} aria-hidden="true">
        <Mini outcome={item.baseline} />
        <ArrowRight className={styles.transArrow} />
        <Mini outcome={outcome} strong={change === "regression"} />
      </span>
      <span className={styles.rowTitle}>
        {item.title}
        <span className={styles.srOnly}>
          {`. ${item.category}. ${hiddenText}${tag ? `. ${tag.action === "expected" ? "Marked as expected" : `Issue ${tag.issueKey}`}` : ""}`}
        </span>
      </span>
      {tag && (
        <span className={styles.rowTag} aria-hidden="true">
          {tag.action === "expected" ? (
            <>
              <Check />
              <span className={styles.rowTagText}>Expected</span>
            </>
          ) : (
            <>
              <LinearMark title="" className={styles.linear} />
              <span className={styles.rowTagText}>{tag.issueKey}</span>
            </>
          )}
        </span>
      )}
      <span className={styles.rowCategory} aria-hidden="true">
        {item.category}
      </span>
      {hasInput ? <ChevronDown className={styles.chevron} aria-hidden="true" /> : <span className={styles.chevronSpace} aria-hidden="true" />}
    </>
  );

  return (
    <motion.li
      className={styles.item}
      data-open={open || undefined}
      initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reduced ? instant : { height: motionTokens.spring.smooth, opacity: listTransition }}
    >
      {hasInput ? (
        <button type="button" id={id} className={styles.rowButton} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
          {content}
        </button>
      ) : (
        <div id={id} className={styles.rowStatic}>
          {content}
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && hasInput && (
          <motion.div
            key="detail"
            id={panel}
            role="region"
            aria-labelledby={id}
            className={styles.detailWrap}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? instant : { height: motionTokens.spring.smooth, opacity: listTransition }}
          >
            <Detail suite={suite} item={item} result={result} rubric={rubric} triage={triage} simulated={simulated} onTriage={onTriage} onUndo={onUndo} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const initialState: RunState = { status: "idle", results: {}, inflight: [], elapsed: 0, simulated: true, id: 0 };

/** Drives one run. Without onRun eight workers stream the sample results so the grid fills exactly like a real run. */
function useEvalRun(suite: EvalSuiteData, onRun: EvalSuiteProps["onRun"], resultFor: (item: EvalCaseData) => EvalCaseResult) {
  const [state, setState] = useState<RunState>(initialState);
  const controller = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const runId = useRef(0);

  const clear = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback(() => {
    clear();
    const id = ++runId.current;
    const control = new AbortController();
    controller.current = control;
    const startedAt = performance.now();
    setState({ status: "running", results: {}, inflight: [], elapsed: 0, simulated: !onRun, id });
    const update = (next: (state: RunState) => RunState) => setState((current) => (current.id === id ? next(current) : current));

    if (!onRun) {
      const byCategory = new Map<string, EvalCaseData[]>();
      for (const item of suite.cases) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
      const columns = [...byCategory.values()];
      const longest = Math.max(0, ...columns.map((column) => column.length));
      const queue: EvalCaseData[] = [];
      for (let row = 0; row < longest; row++) for (const column of columns) if (column[row]) queue.push(column[row]);
      const total = queue.length;
      const target = suite.estimate?.seconds ?? 190;
      const unit = Math.max(1.6, Math.min(4.2, 0.034 * total));
      const scaled = target / unit;
      const perCase = (1000 * unit * 8) / Math.max(1, total);
      let cursor = 0;
      let settled = 0;

      const pump = () => {
        if (control.signal.aborted) return;
        const item = queue[cursor++];
        if (!item) return;
        const result = resultFor(item);
        const delay = perCase * (0.55 + 0.9 * Fnv1a(item.id)) * (result.outcome === "error" ? 1.6 : 1);
        update((current) => ({ ...current, inflight: [...current.inflight, item.id] }));
        timers.current.push(
          window.setTimeout(() => {
            if (control.signal.aborted) return;
            const last = ++settled === total;
            const elapsed = last ? target : ((performance.now() - startedAt) / 1000) * scaled;
            update((current) => ({
              ...current,
              results: { ...current.results, [item.id]: result },
              inflight: current.inflight.filter((pending) => pending !== item.id),
              elapsed: Math.min(target, Math.max(current.elapsed, elapsed)),
              status: last ? "done" : current.status,
            }));
            pump();
          }, delay),
        );
      };

      for (let worker = 0; worker < Math.min(8, total); worker++) timers.current.push(window.setTimeout(pump, 40 * worker));
      if (!total) update((current) => ({ ...current, status: "done" }));
      return;
    }

    const started = (caseId: string) =>
      update((current) => (current.inflight.includes(caseId) ? current : { ...current, inflight: [...current.inflight, caseId] }));
    const settle = (result: EvalCaseResult) =>
      update((current) => ({
        ...current,
        results: { ...current.results, [result.caseId]: result },
        inflight: current.inflight.filter((pending) => pending !== result.caseId),
        elapsed: (performance.now() - startedAt) / 1000,
      }));

    void (async () => {
      try {
        const run = onRun(suite, { signal: control.signal, started });
        if (run && typeof (run as AsyncIterable<EvalCaseResult>)[Symbol.asyncIterator] === "function") {
          for await (const result of run as AsyncIterable<EvalCaseResult>) {
            if (control.signal.aborted) return;
            settle(result);
          }
        } else {
          const results = await (run as Promise<EvalCaseResult[]>);
          if (control.signal.aborted) return;
          results.forEach(settle);
        }
        if (control.signal.aborted) return;
        update((current) => ({ ...current, status: "done", inflight: [], elapsed: (performance.now() - startedAt) / 1000 }));
      } catch (error) {
        if (control.signal.aborted) return;
        update((current) => ({ ...current, status: "failed", inflight: [], error: error instanceof Error ? error.message : "The run failed." }));
      }
    })();
  }, [clear, onRun, suite, resultFor]);

  const stop = useCallback(() => {
    clear();
    setState((current) => (current.status === "running" ? { ...current, status: "stopped", inflight: [] } : current));
  }, [clear]);

  return { state, start, stop };
}

export function EvalSuite({ suite, runs = sampleRuns, onRun, onTriage, defaultFilter = "regressions", className, flat }: EvalSuiteProps) {
  const data = suite ?? sampleSuite;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const rubric = data.rubric ?? sampleRubric;
  const { candidate, baseline } = data;

  const resultFor = useCallback(
    (item: EvalCaseData): EvalCaseResult => (suite ? undefined : sampleResults[item.id]) ?? { caseId: item.id, outcome: item.baseline, costUsd: 0.024 },
    [suite],
  );
  const { state, start, stop } = useEvalRun(data, onRun, resultFor);

  const running = state.status === "running";
  const done = state.status === "done";
  const results = state.results;
  const total = data.cases.length;
  const byId = useMemo(() => new Map(data.cases.map((item) => [item.id, item])), [data.cases]);
  const categories = useMemo(() => data.categories ?? [...new Set(data.cases.map((item) => item.category))], [data]);
  const inflight = useMemo(() => new Set(state.inflight), [state.inflight]);

  const change = useCallback(
    (item: EvalCaseData): Change => {
      const result = results[item.id];
      if (!result) return null;
      const before = item.baseline === "pass";
      const after = result.outcome === "pass";
      return before && !after ? "regression" : !before && after ? "improved" : null;
    },
    [results],
  );

  const stats = useMemo(() => {
    const counts: Record<EvalOutcome, number> = { pass: 0, fail: 0, error: 0 };
    let regressions = 0;
    let improved = 0;
    let cost = 0;
    for (const result of Object.values(results)) {
      counts[result.outcome]++;
      cost += result.costUsd ?? 0;
      const item = byId.get(result.caseId);
      if (!item) continue;
      if (item.baseline === "pass" && result.outcome !== "pass") regressions++;
      if (item.baseline !== "pass" && result.outcome === "pass") improved++;
    }
    const baselinePass = data.cases.filter((item) => item.baseline === "pass").length;
    return { counts, regressions, improved, cost, completed: Object.keys(results).length, baselinePass };
  }, [results, byId, data.cases]);

  const scored = stats.completed > 0;
  const score = ratio(stats.counts.pass, total);
  const baselineScore = ratio(stats.baselinePass, total);
  const delta = score - baselineScore;
  const tone = deltaTone(delta);

  const perCategory = useMemo(
    () =>
      categories.map((name) => {
        const items = data.cases.filter((item) => item.category === name);
        let pass = 0;
        let fail = 0;
        let error = 0;
        let counted = 0;
        for (const item of items) {
          const outcome = results[item.id]?.outcome;
          if (!outcome) continue;
          counted++;
          if (outcome === "pass") pass++;
          else if (outcome === "fail") fail++;
          else error++;
        }
        return { name, items, pass, fail, error, scored: counted, baselinePass: items.filter((item) => item.baseline === "pass").length, total: items.length };
      }),
    [categories, data.cases, results],
  );

  const [filter, setFilter] = useState<EvalFilter>(defaultFilter);
  const [expandedFilter, setExpandedFilter] = useState<EvalFilter | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const arrival = useMemo(() => new Map(Object.keys(results).map((id, index) => [id, index])), [results]);

  const matches = useCallback(
    (item: EvalCaseData, target: EvalFilter) => {
      if (target === "all") return true;
      const result = results[item.id];
      if (!result) return false;
      if (target === "failed") return result.outcome !== "pass";
      return change(item) === (target === "regressions" ? "regression" : "improved");
    },
    [results, change],
  );

  const inFilter = useCallback(
    (target: EvalFilter) =>
      target === "all" ? data.cases : data.cases.filter((item) => matches(item, target)).sort((a, b) => (arrival.get(a.id) ?? 0) - (arrival.get(b.id) ?? 0)),
    [data.cases, matches, arrival],
  );

  const filtered = useMemo(() => inFilter(filter), [inFilter, filter]);
  const expanded = expandedFilter === filter;
  const visible = expanded ? filtered : filtered.slice(0, 8);
  const remaining = filtered.length - visible.length;
  const counts = { all: total, failed: stats.counts.fail + stats.counts.error, regressions: stats.regressions, improved: stats.improved };

  const [triage, setTriage] = useState<TriageEntry>({});
  const issueCounter = useRef(2481);
  const [announcement, setAnnouncement] = useState("");
  const triagedRegressions = data.cases.filter((item) => triage[item.id]?.status === "done" && change(item) === "regression").length;

  const [lastStatus, setLastStatus] = useState(state.status);
  if (lastStatus !== state.status) {
    setLastStatus(state.status);
    const message =
      state.status === "running"
        ? `Running ${total} cases${state.simulated ? ", simulated" : ""}`
        : state.status === "done"
          ? `Run finished. Score ${score.toFixed(1)} percent, ${deltaSentence(delta)} against ${baseline.version}. ${stats.regressions} regressions, ${stats.improved} improved.`
          : state.status === "stopped"
            ? `Run stopped after ${stats.completed} of ${total} cases`
            : state.status === "failed"
              ? `Run failed. ${state.error ?? ""}`
              : "";
    if (message) setAnnouncement(message);
  }

  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredItem = hovered ? byId.get(hovered) : undefined;
  const rowId = (id: string) => `${uid}-row-${id}`;

  const openCase = (id: string) => {
    const item = byId.get(id);
    if (!item?.input) return;
    const result = results[id];
    const movement = change(item);
    const target: EvalFilter = movement === "regression" ? "regressions" : movement === "improved" ? "improved" : result && result.outcome !== "pass" ? "failed" : "all";
    setFilter(target);
    setSelected(id);
    if (inFilter(target).findIndex((entry) => entry.id === id) >= 8) setExpandedFilter(target);
    window.requestAnimationFrame(() => {
      const node = document.getElementById(rowId(id));
      node?.focus({ preventScroll: true });
      node?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  };

  const caseOf = (event: React.SyntheticEvent) => (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-case]")?.dataset.case ?? null;

  const scoreLabel = running ? null : state.status === "stopped" ? `Partial score, ${stats.completed} of ${total}` : state.status === "failed" ? "Run failed" : "Score";

  const empty = ((): { text: string; done: boolean } => {
    if (!scored && !running)
      return { text: `Run the suite to compare every case with ${baseline.version}.`, done: false };
    if (running) return { text: "None so far.", done: false };
    if (state.status === "stopped") return { text: "None in the cases scored before the stop.", done: false };
    if (filter === "regressions") return { text: `No regressions. Every case that passed on ${baseline.version} still passes.`, done: true };
    if (filter === "failed") return { text: "Every case passed.", done: true };
    return { text: `No case went from failing on ${baseline.version} to passing.`, done: false };
  })();

  const runLabel = running ? "Stop" : state.status === "idle" ? "Run" : "Run again";

  const triageCase = (item: EvalCaseData, action: "expected" | "issue") => {
    setTriage((current) => ({ ...current, [item.id]: { action, status: "pending" } }));
    const fallbackKey = `SUP-${issueCounter.current++}`;
    const finish = (key?: string) => {
      const issueKey = key ?? fallbackKey;
      setTriage((current) => ({ ...current, [item.id]: { action, status: "done", issueKey } }));
      setAnnouncement(action === "expected" ? `${item.title} marked as expected` : `Issue ${issueKey} opened in Linear for ${item.title}${onTriage ? "" : ", simulated"}`);
    };
    if (onTriage) {
      void Promise.resolve(onTriage(item.id, action)).then(
        (value) => finish(typeof value === "string" ? value : undefined),
        () => {
          setTriage((current) => {
            const next = { ...current };
            delete next[item.id];
            return next;
          });
          setAnnouncement(`Could not ${action === "expected" ? "mark the case as expected" : "open the issue"}. Try again.`);
        },
      );
      return;
    }
    window.setTimeout(() => finish(), action === "issue" ? 700 : 260);
  };

  const undo = (item: EvalCaseData) => {
    setTriage((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setAnnouncement(`${item.title} is a regression again`);
  };

  return (
    <div className={cn(styles.root, className)}>
      <section className={styles.card} data-frame-flat={flat || undefined} aria-labelledby={`${uid}-title`} aria-busy={running || undefined}>
        <header className={styles.header}>
          <h2 id={`${uid}-title`} className={styles.title}>
            {data.name}
          </h2>
          <p className={styles.subtitle}>
            <span>
              {candidate.version} against {baseline.version}
            </span>
            <span className={styles.subDot} aria-hidden="true">
              ·
            </span>
            <span>{total} test cases</span>
          </p>
          <RunButton
            which={running ? "stop" : state.status === "idle" ? "run" : "again"}
            onClick={() => {
              if (running) stop();
              else {
                setHovered(null);
                start();
              }
            }}
            label={running ? "Stop run" : `${runLabel}, ${total} cases`}
          />
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <span className={styles.metaKey}>{candidate.version}</span>
              <Chip model={candidate.model} version={candidate.version} />
            </span>
            <span className={styles.metaAgainst}>against</span>
            <span className={styles.metaItem}>
              <span className={styles.metaKey}>{baseline.version}</span>
              <Chip model={baseline.model} version={baseline.version} />
            </span>
            <span className={styles.metaDivider} aria-hidden="true" />
            <span className={styles.metaItem}>
              <span className={styles.metaKey} data-keep="">
                Judge
              </span>
              <Chip model={data.judge} />
            </span>
          </div>
        </header>

        <div className={styles.summary}>
          <div className={styles.scoreStat}>
            <div className={styles.statLabel}>
              {running ? (
                <span className={styles.scoring}>
                  <TextShimmer>Scoring</TextShimmer>
                  <span className={styles.scoringCount}>
                    {stats.completed} of {total}
                  </span>
                </span>
              ) : (
                <span>{scoreLabel}</span>
              )}
            </div>
            <div className={styles.scoreLine}>
              {scored || running ? (
                <span key="score" className={styles.score}>
                  <AnimatedCount value={score} format={scoreText} />
                  <span className={styles.scoreUnit}>%</span>
                </span>
              ) : (
                <span key="empty" className={styles.scoreEmpty}>
                  Not run yet
                </span>
              )}
              <span className={styles.scoreDelta} data-on={done || undefined} aria-hidden={!done || undefined}>
                <Delta value={delta} unit />
                <span className={styles.srOnly}>
                  {deltaSentence(delta)} against {baseline.version}
                </span>
              </span>
            </div>
            <div className={styles.baselineLine}>
              <span className={styles.ghostKey} aria-hidden="true" />
              <span>
                {baseline.version} scored {baselineScore.toFixed(1)}%
              </span>
            </div>
          </div>

          <Sparkline runs={runs} current={done ? score : null} currentLabel={candidate.version} tone={tone} />

          <dl className={styles.costStat}>
            <div>
              <dt className={styles.statLabel}>Cost</dt>
              <dd className={styles.costValue} data-estimate={!scored || undefined}>
                {scored ? (
                  <AnimatedCount value={stats.cost} format={moneyText} />
                ) : data.estimate ? (
                  `About ${moneyText(data.estimate.costUsd ?? 0)}`
                ) : (
                  "Not run"
                )}
              </dd>
            </div>
            <div>
              <dt className={styles.statLabel}>Time</dt>
              <dd className={styles.costValue} data-estimate={!scored || undefined}>
                {scored ? (
                  (() => {
                    const seconds = Math.max(0, Math.round(state.elapsed));
                    const minutes = Math.floor(seconds / 60);
                    return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
                  })()
                ) : data.estimate ? (
                  `About ${Math.round((data.estimate.seconds ?? 0) / 60)} min`
                ) : (
                  "Not run"
                )}
              </dd>
            </div>
          </dl>
        </div>

        <AnimatePresence initial={false}>
          {state.status === "failed" && (
            <motion.div
              key="failed"
              className={styles.alertWrap}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduced ? instant : motionTokens.spring.smooth}
            >
              <div className={styles.alert} role="alert">
                <AlertCircle aria-hidden="true" />
                <span className={styles.alertText}>
                  {state.error ?? "The run failed."} {stats.completed ? `${stats.completed} of ${total} cases were scored.` : ""}
                </span>
                <Button variant="secondary" size="sm" onClick={start}>
                  Try again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.gridSection}>
          <div
            className={styles.rows}
            data-running={running || undefined}
            onPointerOver={(event) => setHovered(caseOf(event))}
            onPointerLeave={() => setHovered(null)}
            onClick={(event) => {
              const id = caseOf(event);
              if (id) openCase(id);
            }}
          >
            {perCategory.map((category) => {
              const percent = ratio(category.pass, category.total);
              const categoryDelta = percent - ratio(category.baselinePass, category.total);
              const label = category.scored
                ? `${category.name}: ${category.pass} of ${category.total} passed, ${category.fail} failed, ${category.error} ${category.error === 1 ? "error" : "errors"}${category.scored < category.total ? `, ${category.total - category.scored} not scored yet` : ""}. ${Math.round(percent)} percent${done ? `, ${deltaSentence(categoryDelta)} against ${baseline.version}` : ""}.`
                : `${category.name}: ${category.total} cases, ${running ? "waiting" : "not run"}. ${baseline.version} passed ${category.baselinePass}.`;
              return (
                <div key={category.name} className={styles.catRow} role="img" aria-label={label}>
                  <span className={styles.catLabel}>{category.name}</span>
                  <span className={styles.cells} style={{ "--n": category.total, "--half": Math.ceil(category.total / 2) } as CSSProperties}>
                    {category.items.map((item) => {
                      const outcome = results[item.id]?.outcome;
                      const movement = change(item);
                      const dim = !running && scored && filter !== "all" && !matches(item, filter);
                      return (
                        <span
                          key={item.id}
                          className={styles.cell}
                          data-case={item.id}
                          data-outcome={outcome}
                          data-running={(!outcome && inflight.has(item.id)) || undefined}
                          data-strong={movement === "regression" || undefined}
                          data-dim={dim || undefined}
                          data-selected={selected === item.id || undefined}
                          data-hover={hovered === item.id || undefined}
                          data-clickable={(Boolean(item.input) && Boolean(outcome)) || undefined}
                        >
                          {outcome && <Glyph outcome={outcome} />}
                        </span>
                      );
                    })}
                  </span>
                  <span className={styles.catStats}>
                    <Bar value={category.pass / Math.max(1, category.total)} baseline={category.baselinePass / Math.max(1, category.total)} tone={done ? deltaTone(categoryDelta) : undefined} className={styles.catBar} />
                    <span className={styles.catPct}>
                      {category.scored ? (
                        <AnimatedCount value={percent} format={percentText} />
                      ) : (
                        <span className={styles.muted}>–</span>
                      )}
                    </span>
                    <span className={styles.catDelta} data-on={done || undefined}>
                      <Delta value={categoryDelta} />
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.readout} aria-hidden="true">
            <div className={styles.legend} data-hidden={hoveredItem ? "" : undefined}>
              <span className={styles.legendItem}>
                <Mini outcome="pass" />
                {scored ? `${stats.counts.pass} passed` : "Pass"}
              </span>
              <span className={styles.legendItem}>
                <Mini outcome="fail" />
                {scored ? `${stats.counts.fail} failed` : "Fail"}
              </span>
              <span className={styles.legendItem}>
                <Mini outcome="error" />
                {scored ? `${stats.counts.error} ${stats.counts.error === 1 ? "error" : "errors"}` : "Error"}
              </span>
              <span className={styles.legendItem}>
                <Mini outcome="fail" strong />
                {scored ? `${stats.regressions} ${stats.regressions === 1 ? "regression" : "regressions"}` : "Regression"}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.ghostKey} />
                {baseline.version}
              </span>
            </div>
            <div className={styles.hoverLine} data-hidden={hoveredItem ? undefined : ""}>
              {hoveredItem && (
                <>
                  <span className={styles.hoverTitle}>{hoveredItem.title}</span>
                  <span className={styles.hoverOutcomes}>
                    <Mini outcome={hoveredItem.baseline} />
                    {baseline.version}
                    <ArrowRight className={styles.transArrow} />
                    <Mini outcome={results[hoveredItem.id]?.outcome} strong={change(hoveredItem) === "regression"} />
                    {results[hoveredItem.id] ? candidate.version : `${candidate.version} not run`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cases}>
          <div className={styles.casesBar}>
            <FilterSeg
              label="Filter cases"
              controls={`${uid}-list`}
              value={filter}
              onChange={(value) => setFilter(value)}
              options={(Object.keys(FILTER_LABEL) as EvalFilter[]).map((value) => ({
                value,
                label: FILTER_LABEL[value],
                count: value === "all" || scored ? counts[value] : undefined,
              }))}
            />
            {filter === "regressions" && done && stats.regressions > 0 && (
              <span className={styles.casesNote}>
                {triagedRegressions} of {stats.regressions} triaged
              </span>
            )}
          </div>

          <AutoHeight armKey={`${filter}-${expanded}`}>
            <div id={`${uid}-list`}>
              {visible.length ? (
                <ul key={filter} className={styles.list}>
                  <AnimatePresence initial={false}>
                    {visible.map((item) => (
                      <Row
                        key={item.id}
                        id={rowId(item.id)}
                        item={item}
                        suite={data}
                        rubric={rubric}
                        result={results[item.id]}
                        change={change(item)}
                        open={selected === item.id}
                        triage={triage[item.id]}
                        simulated={!onTriage}
                        onToggle={() => setSelected((current) => (current === item.id ? null : item.id))}
                        onTriage={(action) => triageCase(item, action)}
                        onUndo={() => undo(item)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <motion.p
                  key={`${filter}-${state.status}`}
                  className={styles.empty}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduced ? instant : listTransition}
                >
                  {empty.done && <Check aria-hidden="true" />}
                  {empty.text}
                </motion.p>
              )}
              {(remaining > 0 || (expanded && filtered.length > 8)) && (
                <button type="button" className={styles.more} onClick={() => setExpandedFilter(expanded ? null : filter)} aria-controls={`${uid}-list`}>
                  {expanded ? "Show fewer" : `Show ${remaining} more`}
                  <ChevronDown className={styles.moreIcon} data-flip={expanded || undefined} aria-hidden="true" />
                </button>
              )}
            </div>
          </AutoHeight>
        </div>

        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>
      </section>
    </div>
  );
}

export default EvalSuite;
