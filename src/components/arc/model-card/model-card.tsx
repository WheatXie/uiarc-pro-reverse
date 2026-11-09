"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AudioLines, Brain, Check, CircleAlert, FileText, Image as ImageIcon, Type, Video, Wrench } from "lucide-react";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import DropdownMenu from "../dropdown-menu/dropdown-menu";
import SegmentedControl from "../segmented-control/segmented-control";
import Slider from "../slider/slider";
import Switch from "../switch/switch";
import styles from "./model-card.module.css";

export type ModelCardView = "details" | "compare";

export type ModelModality = "text" | "image" | "pdf" | "audio" | "video" | "tools" | "reasoning";

export interface ModelCardPricing {
  /** Cost per 1M input tokens. */
  input?: number;
  /** Cost per 1M output tokens. */
  output?: number;
  /** Cost per 1M cached input tokens. */
  cachedInput?: number;
}

export interface ModelCardModel {
  id: string;
  name: string;
  provider: string;
  /** Brand mark, drawn at 16px (28px in the header). */
  mark?: ReactNode;
  summary?: string;
  modalities?: ModelModality[];
  contextWindow?: number;
  maxOutput?: number;
  /** Free text, shown as written: "Mar 2026". */
  knowledgeCutoff?: string;
  pricing?: ModelCardPricing;
  /** Score per benchmark id. */
  scores?: Record<string, number>;
}

export interface ModelCardBenchmark {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  max?: number;
  unit?: string;
}

export interface ModelCardProps {
  model: ModelCardModel;
  /** Other models this one is measured against. An empty list hides the compare switch. */
  rivals?: ModelCardModel[];
  benchmarks?: ModelCardBenchmark[];
  view?: ModelCardView;
  defaultView?: ModelCardView;
  onViewChange?: (view: ModelCardView) => void;
  compareWith?: string;
  defaultCompareWith?: string;
  onCompareWithChange?: (id: string) => void;
  defaultBenchmark?: string;
  onBenchmarkChange?: (id: string) => void;
  defaultMonthlyTokens?: number;
  onMonthlyTokensChange?: (tokens: number) => void;
  /** Share of traffic that is input, 0 to 1. Cost estimates assume the rest is output. */
  inputShare?: number;
  currency?: string;
  /** Sample figures are labelled "samples, not official". */
  sample?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onCopyId?: () => void;
  onSelect?: (model: ModelCardModel) => void;
  selected?: boolean;
  selectLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/** Nine stops the monthly-volume slider snaps to. */
const VOLUME_VALUES = [1e6, 5e6, 1e7, 2.5e7, 5e7, 1e8, 2.5e8, 5e8, 1e9];
const VOLUME_LABELS = ["1M", "5M", "10M", "25M", "50M", "100M", "250M", "500M", "1B"];

const MODALITIES: { key: ModelModality; label: string; Icon: typeof Type }[] = [
  { key: "text", label: "Text", Icon: Type },
  { key: "image", label: "Image", Icon: ImageIcon },
  { key: "pdf", label: "PDF", Icon: FileText },
  { key: "audio", label: "Audio", Icon: AudioLines },
  { key: "video", label: "Video", Icon: Video },
  { key: "tools", label: "Tools", Icon: Wrench },
  { key: "reasoning", label: "Reasoning", Icon: Brain },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** 1,000,000 → "1M"; 128,000 → "128K". */
function shortTokens(value: number) {
  if (value >= 1e9) return `${+(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${+(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${+(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

function ordinal(rank: number) {
  const rest = rank % 100;
  if (rest >= 11 && rest <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
}

function cutoffMonths(text: string | undefined) {
  if (!text) return undefined;
  const match = /^([A-Z][a-z]{2}) (\d{4})$/.exec(text);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[1]);
  if (month < 0) return undefined;
  return Number(match[2]) * 12 + month;
}

/** A value that rolls in place when the model changes: the grid cell keeps both copies stacked. */
function Swap({ children, swapKey, className }: { children: ReactNode; swapKey: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false}>
        <motion.span
          key={swapKey}
          className={cx(styles.swapItem, className)}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
          transition={{ duration: reduced ? 0 : 0.16 }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Same roll for a whole block (summary, readout, tally), where the block itself is the stack. */
function BlockSwap({ children, swapKey, className }: { children: ReactNode; swapKey: string; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={swapKey}
        className={cx(styles.swapItem, className)}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
        transition={{ duration: reduced ? 0 : 0.16 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Brand marks roll too, so a model change never leaves the old logo behind. */
function Mark({ mark, swapKey, size }: { mark: ReactNode; swapKey: string; size: "head" | "row" | "compare" | "picker" }) {
  const reduced = useReducedMotion();
  // The compare picker's trigger has no stacked copy: its label carries the change instead.
  if (size === "picker") {
    return (
      <span className={cx(styles.mark, styles.cmpMark)} aria-hidden="true">
        {mark}
      </span>
    );
  }
  return (
    <span className={cx(styles.mark, size === "head" && styles.headMark, size === "compare" && styles.cmpMark)} aria-hidden="true">
      <span className={styles.swap}>
        <AnimatePresence initial={false}>
          <motion.span
            key={swapKey}
            className={styles.swapItem}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
            transition={{ duration: reduced ? 0 : 0.16 }}
          >
            {mark}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

function BarRow({
  row,
  active,
  max,
  unit,
  onActive,
}: {
  row: { model: ModelCardModel; score: number; rank: number; label: string; primary: boolean };
  active: boolean;
  max: number;
  unit: string;
  onActive: (id: string | null) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <li
      className={styles.barRow}
      data-primary={row.primary ? "true" : undefined}
      data-active={active ? "true" : undefined}
      aria-label={row.label}
      tabIndex={0}
      onPointerEnter={() => onActive(row.model.id)}
      onPointerLeave={() => onActive(null)}
      onFocus={() => onActive(row.model.id)}
      onBlur={() => onActive(null)}
    >
      <Mark size="row" swapKey={row.model.id} mark={row.model.mark ?? <FallbackMark />} />
      <span className={styles.barName}>
        <Swap swapKey={row.model.name} className={styles.ellipsis}>
          {row.model.name}
        </Swap>
      </span>
      <span className={styles.track} data-primary={row.primary ? "true" : undefined} aria-hidden="true">
        <motion.span
          className={styles.fill}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: row.score / max }}
          transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }}
        />
      </span>
      <span className={styles.score}>
        <span className={styles.number}>{row.score.toFixed(1)}</span>
        <span className={styles.unit}>{unit}</span>
      </span>
    </li>
  );
}

/** The compare switch, wired to the shared Switch so the thumb reads the same as everywhere else. */
function SwitchControl({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return <Switch checked={checked} onCheckedChange={onChange} label="Compare" className={styles.compareSwitch} />;
}

/** Placeholder mark for models without one, sized like the real thing. */
function FallbackMark() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Model" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" opacity=".2" />
    </svg>
  );
}

/** Money for one million tokens keeps the cents; a monthly total drops them. */
function formatPrice(value: number, symbol: string, cents: boolean) {
  const amount = cents ? value.toFixed(2) : Math.round(value).toLocaleString("en-US");
  return `${symbol}${amount}`;
}

export function ModelCard({
  model,
  rivals = [],
  benchmarks = [],
  view,
  defaultView = "details",
  onViewChange,
  compareWith,
  defaultCompareWith,
  onCompareWithChange,
  defaultBenchmark,
  onBenchmarkChange,
  defaultMonthlyTokens = 1e8,
  onMonthlyTokensChange,
  inputShare = 0.75,
  currency = "USD",
  sample = true,
  loading = false,
  error,
  onRetry,
  onCopyId,
  onSelect,
  selected = false,
  selectLabel = "Use model",
  className,
  style,
}: ModelCardProps) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const [innerView, setInnerView] = useState<ModelCardView>(defaultView);
  const [innerRival, setInnerRival] = useState(defaultCompareWith ?? rivals[0]?.id ?? "");
  const [innerBenchmark, setInnerBenchmark] = useState(defaultBenchmark ?? benchmarks[0]?.id ?? "");
  const [innerTokens, setInnerTokens] = useState(defaultMonthlyTokens);
  const [hovered, setHovered] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const currentView = view ?? innerView;
  const rival = rivals.find(item => item.id === (compareWith ?? innerRival)) ?? rivals[0];
  const benchmark = benchmarks.find(item => item.id === innerBenchmark) ?? benchmarks[0];
  const volume = VOLUME_VALUES.reduce((best, value, index) => (Math.abs(value - innerTokens) < Math.abs(VOLUME_VALUES[best] - innerTokens) ? index : best), 0);
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const input = model.pricing?.input;
  const output = model.pricing?.output;
  const cost = input === undefined || output === undefined ? undefined : VOLUME_VALUES[volume] * inputShare * (input / 1e6) + VOLUME_VALUES[volume] * (1 - inputShare) * (output / 1e6);

  function setView(next: ModelCardView) {
    if (view === undefined) setInnerView(next);
    onViewChange?.(next);
    setStatus(next === "compare" ? `Comparing with ${rival?.name ?? "a rival"}` : `Showing ${model.name}`);
  }

  function setRival(id: string) {
    if (compareWith === undefined) setInnerRival(id);
    onCompareWithChange?.(id);
    setStatus(`Comparing with ${rivals.find(item => item.id === id)?.name ?? id}`);
  }

  function setBenchmark(id: string) {
    setInnerBenchmark(id);
    onBenchmarkChange?.(id);
  }

  function setTokens(index: number) {
    const next = VOLUME_VALUES[index] ?? VOLUME_VALUES[0];
    setInnerTokens(next);
    onMonthlyTokensChange?.(next);
  }

  // The panels share one grid cell, so the card keeps its height while views swap.
  const panel = (name: string, active: boolean) => ({
    className: cx(styles.panel, name === "identity" && styles.identity, name === "footerRow" && styles.footerRow),
    "data-active": active ? "true" : undefined,
    inert: !active || undefined,
    "aria-hidden": !active || undefined,
    initial: false as const,
    animate: { opacity: active ? 1 : 0 },
    transition: { duration: reduced ? 0 : active ? 0.16 : 0.1 },
  });

  const stage = loading ? "skeleton" : error ? "error" : currentView;

  // Benchmarks read as one ranking across the model and everything it is measured against.
  const ranked = useMemo(() => {
    if (!benchmark) return [];
    const pool = [model, ...rivals]
      .filter(item => item.scores?.[benchmark.id] !== undefined)
      .sort((a, b) => (b.scores?.[benchmark.id] ?? 0) - (a.scores?.[benchmark.id] ?? 0));
    return pool.slice(0, 3).map(item => {
      const score = item.scores?.[benchmark.id] ?? 0;
      const rank = pool.findIndex(entry => entry.id === item.id) + 1;
      // The leader is measured against whoever is next; everyone else against the leader.
      const other = rank === 1 ? pool[1] : pool[0];
      const otherScore = other?.scores?.[benchmark.id];
      const gap = otherScore === undefined ? 0 : Math.abs(score - otherScore);
      const label = other && otherScore !== undefined
        ? `${item.name} scores ${score}${benchmark.unit ?? "%"}, ${ordinal(rank)} of ${pool.length}. ${+gap.toFixed(1)} points ${rank === 1 ? "ahead of" : "behind"} ${other.name}.`
        : `${item.name} scores ${score}${benchmark.unit ?? "%"}, ${ordinal(rank)} of ${pool.length}.`;
      return { model: item, score, rank, label, primary: item.id === model.id };
    });
  }, [benchmark, model, rivals]);

  const maxScore = Math.max(...ranked.map(row => row.score), benchmark?.max ?? 100);

  // Compare rows are derived once so the tally and the table can never disagree.
  type Cell = { text: string; unit?: string; score?: number; missing?: boolean };
  type Row = { label: string; left: Cell; right: Cell; better: "left" | "right" | null; delta?: string; spoken?: string };
  const rows: Row[] = [];
  if (rival) {
    const pair = (
      label: string,
      read: (item: ModelCardModel) => { value?: number; text?: string; unit?: string },
      direction: "higher" | "lower",
      format: (value: number, other: number) => { delta: string; spoken: string },
      best: (left: number | undefined, right: number | undefined) => "left" | "right" | null,
    ) => {
      const leftRead = read(model);
      const rightRead = read(rival);
      const leftValue = leftRead.value;
      const rightValue = rightRead.value;
      const winner = best(leftValue, rightValue);
      const delta = winner !== null && leftValue !== undefined && rightValue !== undefined
        ? format(winner === "left" ? leftValue : rightValue, winner === "left" ? rightValue : leftValue)
        : undefined;
      void direction;
      rows.push({
        label,
        left: leftValue === undefined ? { text: leftRead.text ?? "Not listed", missing: true } : { text: leftRead.text ?? String(leftValue), unit: leftRead.unit },
        right: rightValue === undefined ? { text: rightRead.text ?? "Not listed", missing: true } : { text: rightRead.text ?? String(rightValue), unit: rightRead.unit },
        better: winner,
        delta: delta?.delta,
        spoken: delta?.spoken,
      });
    };

    const prefer = (direction: "higher" | "lower") => (left?: number, right?: number) => {
      if (left === undefined || right === undefined || left === right) return null;
      return (direction === "higher" ? left > right : left < right) ? "left" : "right";
    };

    pair("Context window", item => ({ value: item.contextWindow, text: item.contextWindow ? shortTokens(item.contextWindow) : undefined, unit: " tokens" }), "higher", (value) => ({ delta: `+${shortTokens(value)}`, spoken: `+${shortTokens(value)}` }), prefer("higher"));
    pair("Max output", item => ({ value: item.maxOutput, text: item.maxOutput ? shortTokens(item.maxOutput) : undefined, unit: " tokens" }), "higher", (value) => ({ delta: `+${shortTokens(value)}`, spoken: `+${shortTokens(value)}` }), prefer("higher"));
    pair("Knowledge cutoff", item => ({ value: cutoffMonths(item.knowledgeCutoff), text: item.knowledgeCutoff }), "higher", (value, other) => {
      const months = value - other;
      const size = Math.abs(months) % 12;
      const years = Math.floor(Math.abs(months) / 12);
      const text = [years ? `${years} yr` : "", size ? `${size} mo` : ""].filter(Boolean).join(" ");
      return { delta: `+${text}`, spoken: `+${text}` };
    }, prefer("higher"));
    pair("Input price", item => ({ value: item.pricing?.input, text: item.pricing?.input === undefined ? undefined : formatPrice(item.pricing.input, symbol, true) }), "lower", (value, other) => ({ delta: `\u2212${Math.round(((other - value) / other) * 100)}%`, spoken: `${Math.round(((other - value) / other) * 100)}%` }), prefer("lower"));
    pair("Output price", item => ({ value: item.pricing?.output, text: item.pricing?.output === undefined ? undefined : formatPrice(item.pricing.output, symbol, true) }), "lower", (value, other) => ({ delta: `\u2212${Math.round(((other - value) / other) * 100)}%`, spoken: `${Math.round(((other - value) / other) * 100)}%` }), prefer("lower"));
    pair(`Cost at ${VOLUME_LABELS[volume]}/mo`, item => {
      const unitIn = item.pricing?.input;
      const unitOut = item.pricing?.output;
      const total = unitIn === undefined || unitOut === undefined ? undefined : VOLUME_VALUES[volume] * inputShare * (unitIn / 1e6) + VOLUME_VALUES[volume] * (1 - inputShare) * (unitOut / 1e6);
      return { value: total, text: total === undefined ? undefined : formatPrice(total, symbol, false) };
    }, "lower", (value, other) => ({ delta: `\u2212${Math.round(((other - value) / other) * 100)}%`, spoken: `${Math.round(((other - value) / other) * 100)}%` }), prefer("lower"));

    for (const item of benchmarks) {
      const leftScore = model.scores?.[item.id];
      const rightScore = rival.scores?.[item.id];
      const winner = prefer("higher")(leftScore, rightScore);
      const gap = leftScore === undefined || rightScore === undefined ? 0 : Math.abs(leftScore - rightScore);
      rows.push({
        label: item.shortName ?? item.name,
        left: leftScore === undefined ? { text: "Not listed", missing: true } : { text: String(leftScore), unit: item.unit ?? "%", score: leftScore },
        right: rightScore === undefined ? { text: "Not listed", missing: true } : { text: String(rightScore), unit: item.unit ?? "%", score: rightScore },
        better: winner,
        delta: winner ? `+${+gap.toFixed(1)}` : undefined,
        spoken: winner ? `+${+gap.toFixed(1)}` : undefined,
      });
    }
  }

  // The modalities row is a list, not a value to win on, so it never enters `rows`.
  const tallyRows = rows;
  const leftWins = tallyRows.filter(row => row.better === "left").length;
  const rightWins = tallyRows.filter(row => row.better === "right").length;
  const leader = rightWins >= leftWins ? rival : model;
  const trailer = leader === model ? rival : model;
  const leaderWins = Math.max(leftWins, rightWins);
  const trailerWins = Math.min(leftWins, rightWins);

  const context = model.contextWindow;
  const pages = context ? Math.round((context / 1000) * 1.5) : undefined;

  return (
    <article className={cx(styles.root, className)} style={style} aria-labelledby={titleId} data-view={currentView}>
      <header className={styles.header}>
        <div className={styles.identitySlot}>
          <motion.div {...panel("identity", stage === "details")}>
            <Mark size="head" swapKey={model.id} mark={model.mark ?? <FallbackMark />} />
            <div className={styles.titles}>
              <h3 className={styles.name} id={titleId}>
                <Swap swapKey={model.name} className={styles.ellipsis}>
                  {model.name}
                </Swap>
              </h3>
              <p className={styles.provider}>
                <Swap swapKey={model.provider} className={styles.ellipsis}>
                  {model.provider}
                </Swap>
              </p>
            </div>
          </motion.div>
          <motion.div {...panel("identity", stage !== "details")}>
            <span className={styles.bone} style={{ width: 28, height: 28, borderRadius: 999 }} />
            <div className={styles.titles}>
              <span className={styles.bone} style={{ width: 132, height: 14 }} />
              <span className={styles.bone} style={{ width: 72, height: 10 }} />
            </div>
          </motion.div>
        </div>
        {rivals.length > 0 ? <SwitchControl checked={currentView === "compare"} onChange={next => setView(next ? "compare" : "details")} /> : null}
      </header>

      <div className={styles.stage}>
        <motion.div {...panel("details", stage === "details")}>
          <div className={styles.details}>
            <div className={cx(styles.swapBlock, styles.summary)}>
              <BlockSwap swapKey={model.id}>
                {model.summary ?? "No summary listed for this model."}
              </BlockSwap>
            </div>

            <ul className={styles.chips} aria-label="Modalities">
              {MODALITIES.map(({ key, label, Icon }) => {
                const on = model.modalities?.includes(key) ?? false;
                return (
                  <li
                    key={key}
                    className={styles.chip}
                    data-off={on ? undefined : ""}
                    title={on ? undefined : `${label} not supported`}
                  >
                    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                    {label}
                    <span className={styles.srOnly}>{on ? ", supported" : ", not supported"}</span>
                  </li>
                );
              })}
            </ul>

            <div className={styles.limits}>
              <dl className={styles.specs}>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Context window</dt>
                  <dd className={styles.specValue}>
                    <Swap swapKey={String(model.contextWindow)}>
                      {model.contextWindow ? shortTokens(model.contextWindow) : <span className={styles.missing}>Not listed</span>}
                      {model.contextWindow ? <span className={styles.unit}> tokens</span> : null}
                    </Swap>
                  </dd>
                </div>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Max output</dt>
                  <dd className={styles.specValue}>
                    <Swap swapKey={String(model.maxOutput)}>
                      {model.maxOutput ? shortTokens(model.maxOutput) : <span className={styles.missing}>Not listed</span>}
                      {model.maxOutput ? <span className={styles.unit}> tokens</span> : null}
                    </Swap>
                  </dd>
                </div>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Knowledge cutoff</dt>
                  <dd className={styles.specValue}>
                    <Swap swapKey={model.knowledgeCutoff ?? ""}>
                      {model.knowledgeCutoff ?? <span className={styles.missing}>Not listed</span>}
                    </Swap>
                  </dd>
                </div>
              </dl>
              <div className={styles.contextRow}>
                <span className={cx(styles.track, styles.contextTrack)} data-primary="true" aria-hidden="true">
                  <motion.span
                    className={styles.fill}
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: context ? Math.min(context / 2e6, 1) : 0 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }}
                  />
                </span>
                <span className={styles.pages}>
                  Fits about <span className={styles.number}>{pages ? pages.toLocaleString("en-US") : "—"}</span> pages
                </span>
              </div>
            </div>

            <section className={styles.section} aria-label="Pricing">
              <dl className={styles.specs}>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Input per 1M</dt>
                  <dd className={styles.specValue}>
                    {input === undefined ? <span className={styles.missing}>Not listed</span> : <span className={styles.number}>{formatPrice(input, symbol, true)}</span>}
                  </dd>
                </div>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Output per 1M</dt>
                  <dd className={styles.specValue}>
                    {output === undefined ? <span className={styles.missing}>Not listed</span> : <span className={styles.number}>{formatPrice(output, symbol, true)}</span>}
                  </dd>
                </div>
                <div className={styles.spec}>
                  <dt className={styles.specLabel}>Cached per 1M</dt>
                  <dd className={styles.specValue}>
                    {model.pricing?.cachedInput === undefined ? <span className={styles.missing}>Not listed</span> : <span className={styles.number}>{formatPrice(model.pricing.cachedInput, symbol, true)}</span>}
                  </dd>
                </div>
              </dl>
              <div className={styles.estimator}>
                <Slider
                  className={styles.slider}
                  label="Monthly volume"
                  value={volume}
                  min={0}
                  max={VOLUME_VALUES.length - 1}
                  step={1}
                  format={index => `${VOLUME_LABELS[index] ?? ""} tokens`}
                  onValueChange={setTokens}
                />
                <div className={styles.estimate}>
                  <span className={styles.estimateLabel}>Estimated cost</span>
                  <span className={styles.estimateValue}>
                    <span className={cx(styles.number, styles.costNumber)}>{cost === undefined ? "—" : formatPrice(cost, symbol, false)}</span>
                    <span className={styles.unit}>/mo</span>
                  </span>
                </div>
              </div>
            </section>

            {benchmark ? (
              <section className={styles.section} aria-label="Benchmarks">
                <div className={styles.sectionHead}>
                  <h4 className={styles.sectionTitle}>Benchmarks</h4>
                  <SegmentedControl
                    className={styles.benchTabs}
                    label="Benchmark"
                    options={benchmarks.map(item => ({ value: item.id, label: item.shortName ?? item.name }))}
                    value={benchmark.id}
                    onValueChange={setBenchmark}
                  />
                </div>
                <ul className={styles.bars} data-hovering={hovered ? "true" : undefined}>
                  {ranked.map(row => (
                    <BarRow key={row.model.id} row={row} active={hovered === row.model.id} max={maxScore} unit={benchmark.unit ?? "%"} onActive={setHovered} />
                  ))}
                </ul>
                <div className={cx(styles.swapBlock, styles.readout)}>
                  <BlockSwap swapKey={`${benchmark.id}-${model.id}`}>
                    {`${benchmark.name}, ${benchmark.description ?? ""}. Prices and scores are ${sample ? "samples" : "figures"}, not official.`.replace(" ,", ",")}
                  </BlockSwap>
                </div>
              </section>
            ) : null}
          </div>
        </motion.div>

        <motion.div {...panel("compare", stage === "compare")}>
          <div className={styles.compare}>
            <div className={styles.cmpTable} role="table" aria-label={rival ? `${model.name} compared with ${rival.name}` : `${model.name} compared`}>
              <div className={cx(styles.cmpRow, styles.cmpHead)} role="row">
                <span className={styles.cmpCorner} role="columnheader">
                  <span className={styles.srOnly}>Spec</span>
                </span>
                <div className={styles.cmpModel} role="columnheader">
                  <Mark size="compare" swapKey={model.id} mark={model.mark ?? <FallbackMark />} />
                  <Swap swapKey={model.name} className={styles.ellipsis}>
                    {model.name}
                  </Swap>
                </div>
                <div className={styles.cmpModel} role="columnheader">
                  {rival ? (
                    <span className={styles.picker} inert={stage !== "compare" || undefined}>
                      <DropdownMenu
                        label={rival.name}
                        icon={<Mark size="picker" swapKey={rival.id} mark={rival.mark ?? <FallbackMark />} />}
                        items={rivals.map(item => ({ label: item.name, onSelect: () => setRival(item.id) }))}
                      />
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.cmpRow} role="row">
                <span className={styles.cmpLabel} role="rowheader">Modalities</span>
                {[model, rival].map((item, index) => (
                  <span key={index} className={styles.cmpCell} role="cell">
                    <span className={styles.modIcons}>
                      {MODALITIES.map(({ key, label, Icon }) => {
                        const on = item?.modalities?.includes(key) ?? false;
                        return <Icon key={key} size={14} strokeWidth={1.75} aria-hidden="true" data-off={on ? undefined : ""} />;
                      })}
                      <span className={styles.srOnly}>
                        {(item?.modalities ?? []).map(key => MODALITIES.find(entry => entry.key === key)?.label).filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </span>
                ))}
              </div>

              {rows.map(row => (
                <div key={row.label} className={styles.cmpRow} role="row">
                  <span className={styles.cmpLabel} role="rowheader">{row.label}</span>
                  {(["left", "right"] as const).map(side => {
                    const cell = side === "left" ? row.left : row.right;
                    const better = row.better === side;
                    return (
                      <span key={side} className={styles.cmpCell} role="cell" data-better={better ? "true" : undefined}>
                        <Swap swapKey={`${model.id}-${rival?.id ?? ""}-${row.label}-${cell.text}`} className={styles.cmpValue}>
                          {cell.score !== undefined ? (
                            <span className={styles.cmpScore}>
                              <span className={styles.number}>
                                {cell.text}
                                <span className={styles.unit}>{cell.unit}</span>
                              </span>
                              <span className={cx(styles.track, styles.miniTrack)} data-primary={side === "left" ? "true" : undefined} aria-hidden="true">
                                <motion.span
                                  className={styles.fill}
                                  initial={reduced ? false : { scaleX: 0 }}
                                  animate={{ scaleX: Math.min(cell.score / 100, 1) }}
                                  transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.24, bounce: 0 }}
                                />
                              </span>
                            </span>
                          ) : (
                            <>
                              {cell.text}
                              {cell.unit ? <span className={styles.unit}>{cell.unit}</span> : null}
                            </>
                          )}
                        </Swap>
                        <span className={styles.betterSlot}>
                          {better && row.delta ? (
                            <span className={styles.better} style={{ opacity: 1 }}>
                              <Check size={14} strokeWidth={2} aria-hidden="true" />
                              <span className={styles.delta}>{row.delta}</span>
                              <span className={styles.srOnly}>{", better"}{` by ${row.spoken}`}</span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ))}

            </div>

            <div className={cx(styles.swapBlock, styles.tally)}>
              <BlockSwap swapKey={`${model.id}-${rival?.id ?? ""}-tally`}>
                {leader && trailer
                  ? `${leader.name} leads on ${leaderWins} of ${tallyRows.length}, ${trailer.name} on ${trailerWins}.`
                  : `${model.name} has no values to compare.`}
              </BlockSwap>
            </div>
            <p className={styles.caption}>
              Prices per 1M tokens. Cost assumes{" "}
              {inputShare * 100}
              {"% input. A check marks the better value."}
              {sample ? " Sample figures, not official." : null}
            </p>
          </div>
        </motion.div>

        <motion.div {...panel("skeleton", stage === "skeleton")}>
          <div className={styles.skeleton} aria-hidden="true">
            <span className={styles.boneLines}>
              <span className={styles.bone} style={{ width: "94%", height: 12 }} />
              <span className={styles.bone} style={{ width: "62%", height: 12 }} />
            </span>
            <span className={styles.boneRow}>
              {[56, 64, 52, 64, 60, 60, 84].map((width, index) => (
                // Widths repeat (two 64s, two 60s), so the index is the only unique key the skeleton can use.
                <span key={index} className={styles.bone} style={{ width, height: 28, borderRadius: 999 }} />
              ))}
            </span>
            {[0, 1].map(group => (
              <span key={group} className={styles.boneGrid}>
                {[0, 1, 2].map(cell => (
                  <span key={cell} className={styles.boneCell}>
                    <span className={styles.bone} style={{ width: "56%", height: 10 }} />
                    <span className={styles.bone} style={{ width: "44%", height: 14 }} />
                  </span>
                ))}
              </span>
            ))}
            {[0, 1, 2, 3].map(bar => (
              <span key={bar} className={styles.boneBar}>
                <span className={styles.bone} style={{ width: 16, height: 16, borderRadius: 999 }} />
                <span className={styles.bone} style={{ width: 96, height: 10 }} />
                <span className={styles.bone} style={{ flex: 1, height: 6 }} />
                <span className={styles.bone} style={{ width: 36, height: 10 }} />
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div {...panel("error", stage === "error")}>
          <div className={styles.error}>
            <CircleAlert size={16} strokeWidth={1.75} className={styles.errorIcon} aria-hidden="true" />
            <div className={styles.errorText}>
              <p className={styles.errorTitle}>Couldn't load model details</p>
              <p className={styles.errorMessage}>{error}</p>
              {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerSlot}>
          <motion.div {...panel("footerRow", stage === "details")}>
            <code className={styles.modelId} title={model.id}>
              <Swap swapKey={model.id} className={styles.ellipsis}>
                {model.id}
              </Swap>
            </code>
            <span className={styles.actions}>
              <CopyButton value={model.id} label="Copy model id" onCopied={() => { onCopyId?.(); setStatus(`Copied ${model.id}`); }} />
              {onSelect ? (
                <span className={styles.selectSlot}>
                  <Button variant={selected ? "secondary" : "primary"} size="sm" onClick={() => onSelect(model)}>
                    {selected ? "Selected" : selectLabel}
                  </Button>
                </span>
              ) : null}
            </span>
          </motion.div>
          <motion.div {...panel("footerRow", stage !== "details")}>
            <span className={styles.bone} style={{ width: 120, height: 12 }} />
            <span className={styles.bone} style={{ width: 132, height: 32, borderRadius: 999 }} />
          </motion.div>
        </div>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </article>
  );
}

export default ModelCard;
