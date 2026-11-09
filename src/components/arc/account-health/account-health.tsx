"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check, CircleAlert, CircleCheck, Minus, RotateCw, TriangleAlert } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import TextShimmer from "../text-shimmer/text-shimmer";
import { ClaudeMark, demoAccount, demoModel, demoPeriods } from "./account-health-data";
import type { Account, HealthStatus, Period, PeriodAction, Signal } from "./account-health-data";
import styles from "./account-health.module.css";

export type { Account, HealthStatus, Period, PeriodAction, Signal } from "./account-health-data";
export { demoAccount, demoModel, demoPeriods } from "./account-health-data";

const standard = [...motionTokens.ease.standard] as [number, number, number, number];

/** The label fade that every in-place swap shares: fast, so a change of period reads as a correction, not an entrance. */
const SWAP = { duration: motionTokens.duration.fast, ease: standard };

const STATUS: Record<HealthStatus, { label: string; Icon: typeof CircleCheck }> = {
  good: { label: "Good", Icon: CircleCheck },
  watch: { label: "Watch", Icon: CircleAlert },
  risk: { label: "At risk", Icon: TriangleAlert },
};

/** Word counts per streamed chunk. Uneven on purpose: even batches read as a progress bar, this reads as writing. */
const CHUNK_SIZES = [4, 6, 3, 5];
/** How long the demo "thinks" before the first chunk lands when no summarize callback is given. */
const THINKING = 900;
const STREAM_STEP = 34;

const subscribeNothing = () => () => {};
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const todaySnapshot = () => dayStart(new Date());
const serverToday = () => null;

/** ISO strings parse as local midnight, so a renewal date never shifts a day across time zones. */
const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/** Splits a finished summary into chunks of whole words, keeping the whitespace that follows each run. */
function toChunks(text: string) {
  const parts = text.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let index = 0;
  while (index < parts.length) {
    const size = CHUNK_SIZES[chunks.length % CHUNK_SIZES.length];
    let chunk = "";
    for (let words = 0; index < parts.length && words < size; index += 1) {
      chunk += parts[index];
      if (/\S/.test(parts[index])) words += 1;
    }
    while (index < parts.length && !/\S/.test(parts[index])) chunk += parts[index++];
    chunks.push(chunk);
  }
  return chunks;
}

function band(score: number) {
  if (score >= 75) return { status: "good" as const, label: "Healthy" };
  if (score >= 50) return { status: "watch" as const, label: "Needs attention" };
  return { status: "risk" as const, label: "At risk" };
}

export interface AccountHealthProps {
  /** Account under review. Defaults to the sample Linear account. */
  account?: Account;
  /** Ranges the periods control switches between. The first one is the default. */
  periods?: Period[];
  /** Controlled period id. */
  period?: string;
  defaultPeriod?: string;
  onPeriodChange?: (period: string) => void;
  /** Replaces the sample copy. Resolve with the finished summary; reject to show the error line. */
  summarize?: (input: { account: Account; period: Period }, signal: AbortSignal) => Promise<string>;
  /** Runs the suggested next step. Resolve once it is done; reject to offer a retry. */
  onAction?: (action: PeriodAction, input: { account: Account; period: Period }, signal: AbortSignal) => Promise<void>;
  /** Name and mark shown on the summary header. */
  model?: { name: string; mark?: ReactNode };
  /** Overrides today, so a renewal countdown can be reproduced on any date. */
  asOf?: string | Date;
  className?: string;
}

/**
 * Account health for one customer: a health score, the days left on the term, the synced signals that moved it,
 * and a streamed risk summary with one suggested next step. Signals and copy are data, so the whole block can be
 * pointed at a real account without touching the layout.
 */
export function AccountHealth({
  account = demoAccount,
  periods = demoPeriods,
  period,
  defaultPeriod,
  onPeriodChange,
  summarize,
  onAction,
  model = demoModel,
  asOf,
  className,
}: AccountHealthProps) {
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLElement | null>(null);
  const sampleAccount = account === demoAccount;

  const [innerPeriod, setInnerPeriod] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const periodId = period ?? innerPeriod;
  const current = periods.find(entry => entry.id === periodId) ?? periods[0];
  const changePeriod = useCallback((next: string) => { if (period === undefined) setInnerPeriod(next); onPeriodChange?.(next); }, [period, onPeriodChange]);

  // The block stays quiet until a third of it is on screen, so a long report does not animate every account at once.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node || started) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setStarted(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setStarted(true); observer.disconnect(); } }, { threshold: .35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [started]);

  const today = useSyncExternalStore(subscribeNothing, todaySnapshot, serverToday);
  const now = asOf ? dayStart(toDate(asOf)) : sampleAccount ? dayStart(toDate("2026-10-27")) : today;
  const renewal = toDate(account.renewalDate);
  const daysLeft = now === null ? null : Math.round((dayStart(renewal) - now) / 864e5);
  const termStart = account.termStart ? toDate(account.termStart) : new Date(renewal.getFullYear() - 1, renewal.getMonth(), renewal.getDate());
  const termLength = Math.max(1, dayStart(renewal) - dayStart(termStart));
  const termProgress = now === null ? 0 : Math.min(1, Math.max(0, (now - dayStart(termStart)) / termLength));

  // One motion value drives the number, the arc and the arc's fade, so all three stay in step without extra state.
  const score = useMotionValue(0);
  const sweep = useTransform(score, value => Math.max(0, Math.min(1, value / 100)));
  const arcOpacity = useTransform(score, value => (value < .5 ? 0 : 1));
  const [scoreText, setScoreText] = useState("0");
  useMotionValueEvent(score, "change", value => setScoreText(String(Math.round(value))));
  const firstScore = useRef(true);
  const target = current?.score ?? 0;
  useEffect(() => {
    if (!started) return;
    if (reduced) { score.jump(target); firstScore.current = false; return; }
    const controls = animate(score, target, firstScore.current ? { duration: .56, ease: standard } : { duration: motionTokens.duration.standard, ease: standard });
    firstScore.current = false;
    return () => controls.stop();
  }, [started, target, reduced, score]);

  const [summary, setSummary] = useState<{ status: "idle" | "thinking" | "streaming" | "done" | "error"; chunks: string[]; shown: number }>({ status: "idle", chunks: [], shown: 0 });
  const [generation, setGeneration] = useState(0);
  const [summaryReady, setSummaryReady] = useState(false);
  const [message, setMessage] = useState("");
  const latest = useRef({ summarize, account, current, reduced });
  useEffect(() => { latest.current = { summarize, account, current, reduced }; });

  // Each period (and each regenerate) starts a fresh stream and aborts the previous one, so a slow reply can never overwrite a newer one.
  useEffect(() => {
    const { current: entry } = latest.current;
    if (!started || !entry) return;
    const controller = new AbortController();
    let timer = 0;
    setSummary({ status: "thinking", chunks: [], shown: 0 });
    (async () => {
      try {
        const { summarize: write, account: owner, reduced: still } = latest.current;
        const text = write ? await write({ account: owner, period: entry }, controller.signal) : (await wait(THINKING, controller.signal), entry.summary ?? "");
        if (controller.signal.aborted) return;
        const chunks = toChunks(text.trim());
        if (still || !chunks.length) { setSummary({ status: "done", chunks, shown: chunks.length }); setSummaryReady(true); return; }
        let shown = 1;
        setSummary({ status: "streaming", chunks, shown });
        timer = window.setInterval(() => {
          shown += 1;
          const finished = shown >= chunks.length;
          setSummary({ status: finished ? "done" : "streaming", chunks, shown });
          if (finished) { window.clearInterval(timer); setSummaryReady(true); }
        }, STREAM_STEP);
      } catch {
        if (controller.signal.aborted) return;
        setSummary({ status: "error", chunks: [], shown: 0 });
        setMessage("The summary could not be written. Try again.");
      }
    })();
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [started, periodId, generation]);

  const [actionState, setActionState] = useState<"idle" | "running" | "done" | "error">("idle");
  const actionAbort = useRef<AbortController | null>(null);
  useEffect(() => () => actionAbort.current?.abort(), []);
  const runAction = useCallback(async () => {
    if (!current?.action || actionState === "running" || actionState === "done") return;
    const controller = new AbortController();
    actionAbort.current?.abort();
    actionAbort.current = controller;
    setActionState("running");
    setMessage("");
    try {
      if (onAction) await onAction(current.action, { account, period: current }, controller.signal);
      else await wait(THINKING, controller.signal);
      if (controller.signal.aborted) return;
      setActionState("done");
      setMessage(onAction ? `${current.action.label} done.` : `${current.action.label} done. Simulated, no invite was sent.`);
    } catch {
      if (controller.signal.aborted) return;
      setActionState("error");
      setMessage(`${current.action.label} failed. Try again.`);
    }
  }, [actionState, current, onAction, account]);

  if (!current) {
    return <section ref={root} className={[styles.root, className].filter(Boolean).join(" ")} aria-label={`${account.name} account health`}>
      <p className={styles.empty}>No health data for {account.name} yet. Signals appear after the first sync.</p>
    </section>;
  }

  const health = band(current.score);
  const delta = current.score - current.previousScore;
  const TrendIcon = delta < 0 ? ArrowDownRight : delta > 0 ? ArrowUpRight : Minus;
  const span = current.spanLabel ?? current.label;
  const trendText = delta === 0 ? `No change in ${span}` : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} pts in ${span}`;
  const thinking = summary.status === "thinking" || summary.status === "idle";
  const busy = thinking || summary.status === "streaming";
  const headline = summary.status === "error" ? "Summary unavailable" : thinking ? `Reading ${current.signals.length} signals` : "Risk summary";
  // Every summary the account has, hidden but laid out, so the streaming copy does not push the action row down as it grows.
  const ghosts = periods.map(entry => entry.summary).filter((text): text is string => !!text);
  const streamed = summary.chunks.join("");
  if (streamed && !ghosts.includes(streamed)) ghosts.push(streamed);
  const action = current.action;
  const actionVisible = summaryReady && !!action;
  const actionText = actionState === "done" ? action?.doneLabel ?? "Done" : actionState === "error" ? "Could not complete. Try again." : action?.reason ?? "";
  const actionKey = actionState === "done" || actionState === "error" ? actionState : `reason:${current.id}`;

  return <section ref={root} className={[styles.root, className].filter(Boolean).join(" ")} aria-label={`${account.name} account health`}>
    <div className={styles.top}>
      <header className={styles.header}>
        {account.logo ? <span className={styles.logo} aria-hidden="true">{account.logo}</span> : null}
        <div className={styles.identity}>
          <h3 className={styles.name}>{account.name}</h3>
          <p className={styles.meta}>{[account.plan, account.arr].filter(Boolean).join(" · ")}</p>
        </div>
        {periods.length > 1 ? <SegmentedControl className={styles.periods} label="Time range" value={current.id} onValueChange={changePeriod} options={periods.map(entry => ({ value: entry.id, label: entry.label }))} /> : null}
      </header>
      <div className={styles.overview}>
        <div className={styles.scoreCell}>
          <div className={styles.gauge} role="img" aria-label={`Health score ${current.score} out of 100, ${health.label.toLowerCase()}`}>
            <svg viewBox="0 0 112 60" width="112" height="60" aria-hidden="true">
              <path className={styles.gaugeTrack} d="M8 56a48 48 0 0 1 96 0" />
              <motion.path className={styles.gaugeValue} data-status={health.status} d="M8 56a48 48 0 0 1 96 0" style={{ pathLength: sweep, opacity: arcOpacity }} />
            </svg>
            <motion.span className={styles.scoreNumber} aria-hidden="true">{scoreText}</motion.span>
          </div>
          <div className={styles.scoreText}>
            <span className={styles.band} data-status={health.status}>
              <StatusIcon status={health.status} />
              <span className={styles.truncate}>{health.label}</span>
            </span>
            <Swap swapKey={`${current.id}:${delta}`} className={styles.trend} reduced={reduced}>
              <TrendIcon size={14} strokeWidth={2} aria-hidden="true" />
              <span className={styles.truncate}>{trendText}</span>
            </Swap>
          </div>
        </div>
        <div className={styles.renewalCell}>
          <p className={styles.renewalLabel}>
            <span className={styles.truncate}>Renews {renewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </p>
          <span className={styles.term} aria-hidden="true">
            <motion.span className={styles.termFill} initial={{ scaleX: 0 }} animate={{ scaleX: started ? termProgress : 0 }} transition={reduced ? { duration: 0 } : { duration: .56, ease: standard }} />
          </span>
          <p className={styles.renewalDays} aria-label={daysLeft === null ? undefined : `${daysLeft} days until renewal`}>
            {daysLeft === null
              ? <span className={styles.placeholder}> </span>
              : daysLeft > 0
                ? <><span className={styles.bigNumber}>{daysLeft}</span><span className={styles.unit}>{daysLeft === 1 ? "day left" : "days left"}</span></>
                : <span className={styles.unit}>{daysLeft === 0 ? "Renews today" : `Overdue by ${-daysLeft} days`}</span>}
          </p>
        </div>
      </div>
    </div>
    {current.signals.length
      ? <ul className={styles.signals} aria-label="Signals">
        {current.signals.map((entry, index) => <SignalRow key={entry.id} signal={entry} index={index} started={started} reduced={reduced} />)}
      </ul>
      : <p className={styles.noSignals}>No signals synced for this period yet.</p>}
    <div className={styles.ai}>
      <div className={styles.aiHead}>
        <span className={styles.modelMark} aria-hidden="true">{model.mark ?? <ClaudeMark />}</span>
        <Swap swapKey={headline} className={styles.aiLabel} reduced={reduced}>
          {thinking ? <TextShimmer>{headline}</TextShimmer> : <span className={styles.truncate}>{headline}</span>}
        </Swap>
        <span className={styles.modelName}>{model.name}</span>
        <Button variant="ghost" size="sm" className={styles.regenerate} aria-label="Regenerate summary" disabled={busy} onClick={() => { setMessage(""); setGeneration(value => value + 1); }}>
          <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
      <div className={styles.summary} aria-busy={busy || undefined}>
        {ghosts.map((text, index) => <p key={index} className={styles.ghost} aria-hidden="true">{text}</p>)}
        {summary.status === "error"
          ? <p className={styles.summaryError}>
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
            <span>Claude did not respond. Your signals are unchanged, so try again in a moment.</span>
          </p>
          : <p className={styles.summaryText}>
            {summary.chunks.slice(0, summary.shown).map((chunk, index) => <motion.span key={`${generation}:${periodId}:${index}`} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .14, ease: "linear" }}>{chunk}</motion.span>)}
          </p>}
      </div>
      {action
        ? <motion.div className={styles.action} initial={false} animate={{ opacity: actionVisible ? 1 : 0, y: actionVisible || reduced ? 0 : 2 }} transition={reduced ? { duration: 0 } : { duration: .2, ease: standard }} aria-hidden={!actionVisible || undefined} inert={!actionVisible || undefined}>
          <div className={styles.actionText}>
            <p className={styles.actionTitle}>{action.title}</p>
            <Swap swapKey={actionKey} className={styles.actionMeta} reduced={reduced} data-tone={actionState === "error" || actionState === "done" ? actionState : undefined}>
              {actionState === "done" ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : actionState === "error" ? <CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> : null}
              <span className={styles.truncate}>{actionText}</span>
            </Swap>
          </div>
          <Button size="sm" variant={actionState === "done" ? "secondary" : "primary"} className={styles.actionButton} loading={actionState === "running"} aria-disabled={actionState === "done" || undefined} onClick={runAction}>
            {actionState === "done" ? <><Check size={14} strokeWidth={2} aria-hidden="true" />Scheduled</> : actionState === "error" ? "Try again" : action.label}
          </Button>
        </motion.div>
        : null}
    </div>
    <p className={styles.srOnly} role="status" aria-live="polite">{message}</p>
  </section>;
}

function StatusIcon({ status }: { status: HealthStatus }) {
  const { Icon } = STATUS[status];
  return <Icon className={styles.statusIcon} data-status={status} size={14} strokeWidth={2} aria-hidden="true" />;
}

/** Keeps the row's height while one label replaces another: the outgoing copy leaves in place, the incoming one rises two pixels into it. */
function Swap({ swapKey, className, reduced, children, ...rest }: { swapKey: string; className?: string; reduced: boolean; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")} {...rest}>
    <AnimatePresence initial={false}>
      <motion.span key={swapKey} className={styles.swapItem} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: reduced ? { duration: .1 } : SWAP }} exit={{ opacity: 0, transition: { duration: .1, ease: standard } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

function SignalRow({ signal, index, started, reduced }: { signal: Signal; index: number; started: boolean; reduced: boolean }) {
  const { label } = STATUS[signal.status];
  // Normalising each trend to its own min and max fills the 16px tall box at any scale, so a 5% move and a 40% move both read as shape.
  const points = useMemo(() => {
    const values = signal.trend.length > 1 ? signal.trend : [signal.trend[0] ?? 0, signal.trend[0] ?? 0];
    const low = Math.min(...values);
    const room = Math.max(...values) - low || 1;
    return values.map((value, at) => [+(2 + (at / (values.length - 1)) * 60).toFixed(2), +(2 + (1 - (value - low) / room) * 16).toFixed(2)]);
  }, [signal.trend]);
  const path = points.map(([x, y], at) => `${at ? "L" : "M"}${x} ${y}`).join(" ");
  const last = points[points.length - 1];
  const draw = reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: standard };
  const reveal = reduced ? { duration: 0 } : { duration: .4, ease: standard, delay: .04 * index };
  return <li className={styles.signal}>
    <span className={styles.source} aria-hidden="true">{signal.source}</span>
    <span className={styles.signalText}>
      <span className={styles.signalLabel}>{signal.label}{signal.sourceLabel ? <span className={styles.srOnly}>, {signal.sourceLabel.toLowerCase()}</span> : null}</span>
      {signal.detail ? <span className={styles.signalDetail}>{signal.detail}</span> : null}
    </span>
    <span className={styles.spark} data-status={signal.status} aria-hidden="true">
      {signal.trend.length
        ? <svg viewBox="0 0 64 20" width="64" height="20">
          <motion.path d={path} initial={{ d: path, pathLength: 0 }} animate={{ d: path, pathLength: started ? 1 : 0 }} transition={{ d: draw, pathLength: reveal }} />
          {last ? <motion.circle r={2.25} initial={{ cx: last[0], cy: last[1], opacity: 0 }} animate={{ cx: last[0], cy: last[1], opacity: started ? 1 : 0 }} transition={{ cx: draw, cy: draw, opacity: reduced ? { duration: 0 } : { duration: .16, delay: .32 + .04 * index } }} /> : null}
        </svg>
        : null}
    </span>
    <span className={styles.value}>{signal.value}</span>
    <span className={styles.status} data-status={signal.status}>
      <StatusIcon status={signal.status} />
      <span>{label}</span>
    </span>
  </li>;
}

export default AccountHealth;
