"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheck, CircleDashed, Mail, TrendingUp, TriangleAlert } from "lucide-react";
import Button from "../button/button";
import Switch from "../switch/switch";
import styles from "./spend-alert.module.css";

export interface SpendPeriod {
  /** Full month name, shown in the subtitle. */
  label: string;
  /** Short month name used by the crossing date and the forecast legend. */
  short: string;
  /** Day of the period the spend figure is for. */
  day: number;
  days: number;
  /** Copy for the reset line, such as Nov 1. */
  resetsOn: string;
}

export type SpendChannel = "email" | "slack" | "pagerduty";

export interface SpendAlertSettings {
  /** Monthly budget in whole currency units. */
  budget: number;
  /** Alert threshold as a percentage of the budget, 10 to 100. */
  threshold: number;
  channels: Record<SpendChannel, boolean>;
  /** Pause requests once the budget is used up. */
  hardStop: boolean;
}

export type SpendDestinations = Partial<Record<SpendChannel, string>>;

export interface SpendAlertProps {
  /** Card title. @default "Spend alerts" */
  title?: string;
  /** Project or workspace the budget applies to, used in the subtitle and the Slack message. @default "Production" */
  project?: string;
  /** What is being metered, shown in the subtitle. @default "Model API usage" */
  scope?: string;
  /** Spend so far this period, drawn as the solid fill on the bar. @default 3412.8 */
  spend?: number;
  /** Projected spend at period end, drawn as the lighter fill. Defaults to a linear projection from spend and period. */
  forecast?: number;
  /** Billing period used for the forecast, the crossing date and the reset copy. @default October, day 27 of 31 */
  period?: SpendPeriod;
  /** ISO 4217 currency code for formatting. @default "USD" */
  currency?: string;
  /** Initial settings. Missing fields fall back to the demo defaults. */
  defaultValue?: Partial<SpendAlertSettings>;
  /** Threshold markers on the bar. The thumb snaps to them within 2% while dragging. @default [50, 80, 100] */
  markers?: number[];
  /** Where each channel delivers. PagerDuty pages only at 100%. */
  destinations?: SpendDestinations;
  /** Sender name in the Slack preview. @default "Acme Billing" */
  appName?: string;
  /** Footer copy while nothing has changed. @default "Last edited Oct 24 by Maya Chen" */
  lastSaved?: string;
  /** Called on every edit. */
  onChange?: (settings: SpendAlertSettings) => void;
  /** Persist the settings. Without it the save is simulated. Reject to show the error state. */
  onSave?: (settings: SpendAlertSettings, signal: AbortSignal) => Promise<void>;
  /** Send a test alert to the enabled channels. Without it the send is simulated. */
  onSendTest?: (settings: SpendAlertSettings, signal: AbortSignal) => Promise<void>;
  /** Extra class on the card. */
  className?: string;
}

type Status = "idle" | "saving" | "testing" | "saved" | "tested" | "error";
type Tone = "success" | "warning" | "danger" | "muted";

const defaultPeriod: SpendPeriod = { label: "October", short: "Oct", day: 27, days: 31, resetsOn: "Nov 1" };

const defaultDestinations: Required<SpendDestinations> = {
  email: "finance@acme.com",
  slack: "#eng-spend",
  pagerduty: "Platform on-call",
};

const defaults: SpendAlertSettings = {
  budget: 5000,
  threshold: 80,
  channels: { email: true, slack: true, pagerduty: false },
  hardStop: false,
};

/** The alert card's own ease, matching the standard spring's curve. */
const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatNumber = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

/** A line of state text that crossfades in one grid cell, so swapping it never moves the layout. */
function Fade({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={cn(styles.fade, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.fadeItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.12 : 0.16, ease } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const tones = { success: CircleCheck, warning: TriangleAlert, danger: TriangleAlert, muted: CircleDashed };

/** Status never leans on color alone: every tone pairs an icon with its label. */
function ToneLine({ tone, icon: Icon = tones[tone], children }: { tone: Tone; icon?: typeof CircleCheck; children: React.ReactNode }) {
  return (
    <>
      <Icon size={14} strokeWidth={2} className={styles.toneIcon} data-tone={tone} aria-hidden="true" />
      <span className={styles.ellipsis}>{children}</span>
    </>
  );
}

function SlackMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function PagerDutyMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <path
        fill="#06AC38"
        d="M16.965 1.18C15.085.164 13.769 0 10.683 0H3.73v14.55h6.926c2.743 0 4.8-.164 6.61-1.37 1.975-1.303 3.004-3.484 3.004-6.007 0-2.716-1.262-4.896-3.305-5.994zm-5.5 10.326h-3.86V3.135l3.65-.014c3.325-.041 4.99 1.13 4.99 4.12 0 3.21-2.059 4.265-4.78 4.265zM3.73 17.43h3.867V24H3.73Z"
      />
    </svg>
  );
}

interface ThresholdSliderProps {
  value: number;
  onChange: (next: number) => void;
  spendPct: number;
  forecastPct: number;
  markers: number[];
  labelId: string;
  valueText: string;
  disabled: boolean;
  over: boolean;
}

/** The alert line is dragged straight off the spend bar: one rail, one thumb, markers that snap. */
function ThresholdSlider({ value, onChange, spendPct, forecastPct, markers, labelId, valueText, disabled, over }: ThresholdSliderProps) {
  const reduced = useReducedMotion();
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [intro, setIntro] = useState(false);
  const [growing, setGrowing] = useState(false);

  // The fills grow once, the first time the bar is properly on screen.
  useEffect(() => {
    const node = rail.current;
    if (!node || reduced) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setIntro(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setGrowing(true);
        requestAnimationFrame(() => setIntro(true));
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!growing) return;
    const timer = setTimeout(() => setGrowing(false), 760);
    return () => clearTimeout(timer);
  }, [growing]);

  const sorted = useMemo(() => [...markers].sort((a, b) => a - b), [markers]);

  const fromPointer = (clientX: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || box.width === 0) return value;
    const raw = clamp(Math.round(((clientX - box.left) / box.width) * 100), 10, 100);
    return sorted.find((marker) => Math.abs(marker - raw) <= 2) ?? raw;
  };

  const stop = () => {
    drag.current = null;
    setDragging(false);
    setPressed(false);
  };

  const shown = intro || !!reduced;
  const vars = {
    "--t": `${value}%`,
    "--spend": `${shown ? spendPct : 0}%`,
    "--forecast": `${shown ? forecastPct : 0}%`,
  } as CSSProperties;

  return (
    <div className={styles.bar} style={vars} data-dragging={dragging || undefined} data-intro={growing || undefined} data-disabled={disabled || undefined} data-over={(shown && over) || undefined}>
      <div
        ref={rail}
        className={styles.rail}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (disabled || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, moved: false };
          setPressed(true);
          thumb.current?.focus({ preventScroll: true });
          onChange(fromPointer(event.clientX));
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          if (!state.moved) {
            state.moved = true;
            setDragging(true);
          }
          onChange(fromPointer(event.clientX));
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <div className={styles.track} aria-hidden="true">
          <span className={styles.forecastFill} />
          <span className={styles.spendFill} />
          <span className={styles.overFill} />
          {sorted
            .filter((marker) => marker < 100)
            .map((marker) => (
              <span key={marker} className={styles.notch} style={{ left: `${marker}%` }} />
            ))}
        </div>
        <div
          ref={thumb}
          className={styles.thumb}
          data-pressed={pressed || undefined}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-valuemin={10}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-disabled={disabled || undefined}
          onKeyDown={
            disabled
              ? undefined
              : (event) => {
                  const step = event.shiftKey ? 10 : 1;
                  let next: number | undefined;
                  if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + step;
                  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - step;
                  else if (event.key === "PageUp") next = sorted.find((marker) => marker > value) ?? 100;
                  else if (event.key === "PageDown") next = [...sorted].reverse().find((marker) => marker < value) ?? 10;
                  else if (event.key === "Home") next = 10;
                  else if (event.key === "End") next = 100;
                  if (next === undefined) return;
                  event.preventDefault();
                  onChange(clamp(next, 10, 100));
                }
          }
        />
      </div>
      <div className={styles.markers}>
        {sorted.map((marker) => (
          <button
            key={marker}
            type="button"
            tabIndex={-1}
            className={styles.marker}
            data-edge={marker === 100 || undefined}
            data-active={marker === value || undefined}
            style={{ left: `${marker}%` }}
            disabled={disabled}
            onClick={() => onChange(marker)}
            aria-label={`Alert at ${marker}%`}
          >
            {marker}%
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Budget and spend alert settings in one card: a monthly budget, a threshold slider drawn on the
 * live spend bar, Email, Slack and PagerDuty toggles, a hard stop switch, and a live preview of the
 * Slack message the alert posts.
 */
export function SpendAlert({
  title = "Spend alerts",
  project = "Production",
  scope = "Model API usage",
  spend = 3412.8,
  forecast,
  period = defaultPeriod,
  currency = "USD",
  defaultValue,
  markers = [50, 80, 100],
  destinations,
  appName = "Acme Billing",
  lastSaved = "Last edited Oct 24 by Maya Chen",
  onChange,
  onSave,
  onSendTest,
  className,
}: SpendAlertProps) {
  const base = useId();
  const ids = {
    title: `${base}-title`,
    budget: `${base}-budget`,
    budgetMeta: `${base}-budget-meta`,
    threshold: `${base}-threshold`,
    hardStop: `${base}-hardstop`,
  };
  const where = { ...defaultDestinations, ...destinations };
  const initial = useMemo(
    () => ({ ...defaults, ...defaultValue, channels: { ...defaults.channels, ...defaultValue?.channels } }),
    [],
  );

  const [budget, setBudget] = useState(() => formatNumber(initial.budget));
  const [threshold, setThreshold] = useState(() => clamp(Math.round(initial.threshold), 10, 100));
  const [channels, setChannels] = useState(initial.channels);
  const [hardStop, setHardStop] = useState(initial.hardStop);
  const [saved, setSaved] = useState<SpendAlertSettings>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [flash, setFlash] = useState(0);
  const abort = useRef<AbortController>(null);

  const budgetValue = Number.isFinite(parseFloat(budget.replace(/[^0-9.]/g, ""))) ? Math.min(parseFloat(budget.replace(/[^0-9.]/g, "")), 1e7) : 0;
  const settings = useMemo<SpendAlertSettings>(() => ({ budget: budgetValue, threshold, channels, hardStop }), [budgetValue, threshold, channels, hardStop]);
  const valid = budgetValue > 0;
  const dirty =
    settings.budget !== saved.budget ||
    settings.threshold !== saved.threshold ||
    settings.hardStop !== saved.hardStop ||
    settings.channels.email !== saved.channels.email ||
    settings.channels.slack !== saved.channels.slack ||
    settings.channels.pagerduty !== saved.channels.pagerduty;
  const busy = status === "saving" || status === "testing";

  const format = useMemo(() => {
    const whole = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    const cents = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (value: number, exact = false) => (exact ? cents : whole).format(value);
  }, [currency]);

  const dailyRate = spend / Math.max(1, period.day);
  const forecastTotal = forecast ?? dailyRate * period.days;
  const thresholdAmount = (budgetValue * threshold) / 100;
  const spendPct = valid ? clamp((spend / budgetValue) * 100, 0, 100) : 0;
  const forecastPct = valid ? clamp((forecastTotal / budgetValue) * 100, 0, 100) : 0;
  const daysLeft = period.days - period.day + 1;
  const firstRun = useRef(false);

  useEffect(() => {
    if (!firstRun.current) {
      firstRun.current = true;
      return;
    }
    onChange?.(settings);
    setStatus((current) => (current === "saved" || current === "tested" || current === "error" ? "idle" : current));
  }, [settings]);

  useEffect(() => () => abort.current?.abort(), []);

  const pill = (() => {
    if (!valid) return { key: "none", tone: "muted" as Tone, label: "No budget set" };
    if (spend >= budgetValue) return { key: "over", tone: "danger" as Tone, label: "Over budget" };
    if (spend >= thresholdAmount) return { key: "past", tone: "warning" as Tone, label: `Past ${threshold}%` };
    if (forecastTotal >= thresholdAmount) {
      const day = clamp(Math.ceil(thresholdAmount / dailyRate), period.day, period.days);
      return { key: "cross", tone: "warning" as Tone, icon: TrendingUp, label: `Hits ${threshold}% ${period.short} ${day}` };
    }
    return { key: "ok", tone: "success" as Tone, label: "On track" };
  })();

  const budgetHint = valid
    ? spend > budgetValue
      ? { key: "over", tone: "warning" as Tone, label: `Already ${format(spend - budgetValue)} over this month` }
      : { key: "ok", tone: undefined, label: `Resets ${period.resetsOn}, in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}` }
    : { key: "invalid", tone: "danger" as Tone, label: `Enter a budget above ${format(0)}` };

  const enabled = Object.keys(channels).filter((key) => channels[key as SpendChannel]) as SpendChannel[];
  const channelLabel: Record<SpendChannel, string> = { email: "email", slack: "Slack", pagerduty: "PagerDuty" };

  const run = async (kind: "save" | "test") => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus(kind === "save" ? "saving" : "testing");
    try {
      const handler = kind === "save" ? onSave : onSendTest;
      if (handler) await handler(settings, controller.signal);
      else
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, kind === "save" ? 700 : 900);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      if (controller.signal.aborted) return;
      if (kind === "save") {
        setSaved(settings);
        setStatus("saved");
      } else {
        const names = enabled.map((key) => channelLabel[key]);
        setMessage(names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
        setFlash((count) => count + 1);
        setStatus("tested");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatus("error");
    }
  };

  const footer =
    status === "saving"
      ? { key: "saving", label: "Saving" }
      : status === "testing"
        ? { key: "testing", label: "Sending test alert" }
        : status === "error"
          ? { key: "error", tone: "danger" as Tone, label: "Could not save. Try again." }
          : status === "saved"
            ? { key: "saved", tone: "success" as Tone, label: onSave ? "Saved" : "Saved. Simulated, nothing was stored." }
            : status === "tested"
              ? { key: "tested", tone: "success" as Tone, label: `Test sent to ${message}.${onSendTest ? "" : " Simulated, nothing was sent."}` }
              : valid
                ? dirty
                  ? { key: "dirty", label: "Unsaved changes" }
                  : { key: "clean", label: lastSaved }
                : { key: "invalid", label: "Enter a budget to save" };

  const atFull = threshold === 100;
  const previewTone: Tone = atFull ? "danger" : "warning";
  const headline = atFull
    ? hardStop
      ? `${project} used its budget. Requests paused`
      : `${project} used its full budget`
    : `${project} passed ${threshold}% of budget`;
  const context =
    [
      channels.email ? `Also emailed ${where.email}` : null,
      atFull && channels.pagerduty ? `Paged ${where.pagerduty}` : null,
      atFull && hardStop ? `Blocked until ${period.resetsOn}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || `Posted to ${where.slack} only`;

  return (
    <section className={cn(styles.root, className)} aria-labelledby={ids.title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={ids.title} className={styles.title}>
            {title}
          </h2>
          <p className={styles.meta}>
            {project} · {scope} in {period.label}
          </p>
        </div>
        <Fade id={pill.key} className={styles.status}>
          <ToneLine tone={pill.tone} icon={pill.icon}>
            {pill.label}
          </ToneLine>
        </Fade>
      </header>

      <div className={cn(styles.section, styles.budgetRow)}>
        <div className={styles.rowText}>
          <label htmlFor={ids.budget} className={styles.label}>
            Monthly budget
          </label>
          <Fade id={budgetHint.key} className={styles.meta}>
            <span id={ids.budgetMeta} className={styles.metaLine}>
              {budgetHint.tone ? (
                <ToneLine tone={budgetHint.tone}>{budgetHint.label}</ToneLine>
              ) : (
                <span className={styles.ellipsis}>{budgetHint.label}</span>
              )}
            </span>
          </Fade>
        </div>
        <div className={styles.field} data-invalid={!valid || undefined}>
          <span className={styles.affix} aria-hidden="true">
            $
          </span>
          <input
            id={ids.budget}
            className={styles.input}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={budget}
            aria-invalid={!valid || undefined}
            aria-describedby={ids.budgetMeta}
            onChange={(event) => setBudget(event.target.value.replace(/[^0-9.,]/g, ""))}
            onBlur={() => {
              if (valid) setBudget(formatNumber(budgetValue));
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              const step = event.shiftKey ? 1000 : 100;
              setBudget(formatNumber(Math.max(0, Math.round((budgetValue + (event.key === "ArrowUp" ? step : -step)) / step) * step)));
            }}
          />
          <span className={styles.affix} aria-hidden="true">
            {currency}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.rowHead}>
          <span id={ids.threshold} className={styles.label}>
            Alert at
          </span>
          <span className={styles.value} aria-hidden="true">
            <span className={styles.percent}>{threshold}%</span>
            <span className={styles.dot}>·</span>
            <span>{format(valid ? thresholdAmount : 0)}</span>
          </span>
        </div>
        <ThresholdSlider
          value={threshold}
          onChange={setThreshold}
          spendPct={spendPct}
          forecastPct={forecastPct}
          markers={markers}
          labelId={ids.threshold}
          valueText={`${threshold}%, ${format(thresholdAmount)}`}
          disabled={!valid}
          over={valid && spend >= budgetValue}
        />
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="spend" aria-hidden="true" />
            <span className={styles.ellipsis}>Spent {format(spend, true)}</span>
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="forecast" aria-hidden="true" />
            <span className={styles.ellipsis}>
              Forecast {format(forecastTotal)} by {period.short} {period.days}
            </span>
          </span>
          <span className={styles.legendPct}>{valid ? `${Math.round((spend / budgetValue) * 100)}% used` : "No budget"}</span>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Notify</span>
        <ul className={styles.channels}>
          <li className={styles.channel}>
            <Mail size={16} strokeWidth={1.75} className={styles.mailIcon} aria-hidden="true" />
            <span className={styles.channelText}>
              <span className={styles.channelName}>Email</span>
              <span className={cn(styles.muted, styles.ellipsis)}>{where.email}</span>
            </span>
            <Switch checked={channels.email} onCheckedChange={(next) => setChannels((current) => ({ ...current, email: next }))} aria-label="Email alerts" />
          </li>
          <li className={styles.channel}>
            <SlackMark className={styles.mark} />
            <span className={styles.channelText}>
              <span className={styles.channelName}>Slack</span>
              <span className={cn(styles.muted, styles.ellipsis)}>{where.slack}</span>
            </span>
            <Switch checked={channels.slack} onCheckedChange={(next) => setChannels((current) => ({ ...current, slack: next }))} aria-label="Slack alerts" />
          </li>
          <li className={styles.channel}>
            <PagerDutyMark className={styles.mark} />
            <span className={styles.channelText}>
              <span className={styles.channelName}>PagerDuty</span>
              <span className={cn(styles.muted, styles.ellipsis)}>{where.pagerduty} at 100%</span>
            </span>
            <Switch checked={channels.pagerduty} onCheckedChange={(next) => setChannels((current) => ({ ...current, pagerduty: next }))} aria-label="PagerDuty alerts" />
          </li>
        </ul>
      </div>

      <div className={cn(styles.section, styles.stopRow)}>
        <div className={styles.rowText}>
          <span id={ids.hardStop} className={styles.label}>
            Hard stop at 100%
          </span>
          <Fade id={hardStop ? "on" : "off"} className={styles.meta}>
            {hardStop ? (
              <ToneLine tone="warning">Requests return 429 until {period.resetsOn}</ToneLine>
            ) : (
              <span className={styles.ellipsis}>Keep serving past the budget</span>
            )}
          </Fade>
        </div>
        <Switch checked={hardStop} onCheckedChange={setHardStop} aria-labelledby={ids.hardStop} />
      </div>

      <div className={styles.section}>
        <div className={styles.rowHead}>
          <span className={styles.label}>Slack preview</span>
          <span className={cn(styles.muted, styles.previewWhere)}>
            <SlackMark size={14} />
            {where.slack}
          </span>
        </div>
        <div className={styles.preview} data-off={!channels.slack || undefined}>
          {flash > 0 ? (
            <span className={styles.flash} aria-hidden="true">
              {flash}
            </span>
          ) : null}
          <div className={styles.message} aria-hidden={!channels.slack || undefined}>
            <span className={styles.avatar} aria-hidden="true">
              {appName.charAt(0)}
            </span>
            <div className={styles.messageBody}>
              <div className={styles.sender}>
                <span className={cn(styles.senderName, styles.ellipsis)}>{appName}</span>
                <span className={styles.badge}>App</span>
                <span className={styles.time}>{flash > 0 ? "Just now" : "9:41 AM"}</span>
              </div>
              <p className={styles.headline}>
                <TriangleAlert size={14} strokeWidth={2} className={styles.toneIcon} data-tone={previewTone} aria-hidden="true" />
                <span className={styles.ellipsis}>{headline}</span>
              </p>
              <div className={styles.attachment} data-tone={previewTone}>
                <span className={styles.field2}>
                  <span className={styles.fieldLabel}>Used</span>
                  <span className={styles.ellipsis}>
                    <span className={styles.num}>{format(thresholdAmount)}</span> of {format(budgetValue)}
                  </span>
                </span>
                <span className={styles.field2}>
                  <span className={styles.fieldLabel}>Forecast</span>
                  <span className={styles.ellipsis}>
                    {format(forecastTotal)} by {period.short} {period.days}
                  </span>
                </span>
              </div>
              <p className={cn(styles.context, styles.ellipsis)}>{context}</p>
            </div>
          </div>
          <div className={styles.previewOff} aria-hidden={channels.slack || undefined}>
            <SlackMark size={16} />
            <span>Turn on Slack to preview this alert</span>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerStatus} role="status" aria-live="polite">
          <Fade id={footer.key} className={styles.meta}>
            {footer.tone ? (
              <ToneLine tone={footer.tone}>{footer.label}</ToneLine>
            ) : (
              <span className={styles.ellipsis}>{footer.label}</span>
            )}
          </Fade>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" loading={status === "testing"} disabled={!valid || enabled.length === 0 || busy} onClick={() => run("test")}>
            Send test
          </Button>
          <Button variant="primary" size="sm" loading={status === "saving"} disabled={!valid || !dirty || busy} onClick={() => run("save")}>
            Save
          </Button>
        </div>
      </footer>
    </section>
  );
}

export default SpendAlert;
