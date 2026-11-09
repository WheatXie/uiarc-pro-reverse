"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowRight, Check, CreditCard, Download, Mail, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../motion-tokens";
import styles from "./usage-billing.module.css";

export type MeterUnit = "requests" | "gigabytes" | "minutes" | "invocations" | "seats";

export interface UsageMeter {
  id: string;
  name: string;
  unit: MeterUnit;
  used: number;
  limit: number;
  /** Price line shown under the bar, e.g. "€2 per extra million". */
  overage: string;
}

export interface UsagePlan {
  id: string;
  name: string;
  /** Monthly price in whole currency units. */
  price: number;
  /** Limit per meter id, in the meter's own unit. */
  limits: Record<string, number>;
  perks: string[];
}

export interface SpendAlert {
  id: string;
  amount: number;
  email: boolean;
  slack: boolean;
}

export type InvoiceStatus = "paid" | "refunded" | "failed";

export interface Invoice {
  id: string;
  number: string;
  period: string;
  issued: string;
  amount: number;
  status: InvoiceStatus;
}

export interface UsagePeriod {
  /** Spoken and printed range, e.g. "Sep 1 to Sep 30". */
  label: string;
  /** First day as an ISO date, used for every date label in the block. */
  start: string;
  days: number;
  /** Day of the period already spent; the chart and the meters both stop here. */
  today: number;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expires: string;
}

export interface UsageBillingProps {
  period?: UsagePeriod;
  /** One entry per elapsed day. The length is the day count the chart draws. */
  daily?: number[];
  budget?: number;
  meters?: UsageMeter[];
  plan?: UsagePlan;
  /** Rendered as the plan offer; hide the offer by passing the current plan. */
  upgrade?: UsagePlan | null;
  defaultAlerts?: SpendAlert[];
  onAlertsChange?: (alerts: SpendAlert[]) => void;
  invoices?: Invoice[];
  payment?: PaymentMethod;
  onUpgrade?: (plan: UsagePlan) => Promise<void> | void;
  onDownloadInvoice?: (invoice: Invoice) => Promise<void> | void;
  currency?: string;
  className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PERIOD: UsagePeriod = { label: "Sep 1 to Sep 30", start: "2026-09-01", days: 30, today: 24 };

const DAILY = [
  38.2, 41.6, 36.9, 44.1, 52.8, 29.4, 27.1, 47.3, 49.9, 51.2, 55.6, 58.3, 33.8, 31.2, 54.7, 57.9, 62.4, 60.1,
  64.8, 38.6, 35.1, 66.2, 69.4, 78.2,
];

const METERS: UsageMeter[] = [
  { id: "requests", name: "API requests", unit: "requests", used: 842e4, limit: 1e7, overage: "€2 per extra million" },
  { id: "bandwidth", name: "Bandwidth", unit: "gigabytes", used: 1840, limit: 2e3, overage: "€0.08 per extra GB" },
  { id: "builds", name: "Build minutes", unit: "minutes", used: 3120, limit: 6e3, overage: "€0.01 per extra minute" },
  { id: "functions", name: "Function invocations", unit: "invocations", used: 214e5, limit: 5e7, overage: "€0.60 per extra million" },
  { id: "seats", name: "Seats", unit: "seats", used: 18, limit: 20, overage: "€19 per extra seat" },
];

const PRO: UsagePlan = {
  id: "pro",
  name: "Pro",
  price: 249,
  limits: { requests: 1e7, bandwidth: 2e3, builds: 6e3, functions: 5e7, seats: 20 },
  perks: ["Email support", "7 day log retention"],
};

const SCALE: UsagePlan = {
  id: "scale",
  name: "Scale",
  price: 699,
  limits: { requests: 25e6, bandwidth: 5e3, builds: 12e3, functions: 1e8, seats: 50 },
  perks: ["Priority support", "30 day log retention", "SAML single sign-on"],
};

const PAYMENT: PaymentMethod = { brand: "Visa", last4: "4242", expires: "08/28" };

const DEFAULT_ALERTS: SpendAlert[] = [
  { id: "a1", amount: 1e3, email: true, slack: false },
  { id: "a2", amount: 1500, email: true, slack: true },
];

const INVOICES: Invoice[] = [
  { id: "inv-08", number: "NW-2026-008", period: "August 2026", issued: "Sep 1", amount: 1742.18, status: "paid" },
  { id: "inv-07", number: "NW-2026-007", period: "July 2026", issued: "Aug 1", amount: 1618.4, status: "paid" },
  { id: "inv-06", number: "NW-2026-006", period: "June 2026", issued: "Jul 1", amount: 1480.07, status: "paid" },
  { id: "inv-05", number: "NW-2026-005", period: "May 2026", issued: "Jun 1", amount: 1302.55, status: "refunded" },
  { id: "inv-04", number: "NW-2026-004", period: "April 2026", issued: "May 1", amount: 1211.9, status: "paid" },
];

/** Drops trailing zeros so €1,000.00 prints as €1,000 but €184.80 keeps its cents. */
const trim = (value: number, decimals = 2) => value.toFixed(decimals).replace(/\.?0+$/, "");

/** One shared formatter for every meter unit, so API requests and GB read at the same weight. */
function formatAmount(value: number, unit: MeterUnit) {
  if (unit === "requests" || unit === "invocations") {
    if (value >= 1e6) return `${trim(value / 1e6)}M`;
    if (value >= 1e3) return `${trim(value / 1e3, 1)}K`;
    return `${Math.round(value)}`;
  }
  if (unit === "gigabytes") return value >= 1e3 ? `${trim(value / 1e3)} TB` : `${Math.round(value)} GB`;
  if (unit === "minutes") return `${Math.round(value).toLocaleString("en-US")} min`;
  return `${Math.round(value)} ${Math.round(value) === 1 ? "seat" : "seats"}`;
}

/** Day labels are derived from the period start, never hard-coded, so any month works. */
function formatDay(start: string, offset: number) {
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Measures an element against the block root so the sheet can start exactly on the plan card. */
function rectOf(element: HTMLElement, root: HTMLElement): Rect {
  const box = element.getBoundingClientRect();
  const frame = root.getBoundingClientRect();
  return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
}

/** The chart and the sheet both need the block's live width; a container query alone cannot feed SVG. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const flightOpen = motionTokens.spring.smooth;

interface ChartProps {
  cumulative: number[];
  projection: number[];
  days: number;
  start: string;
  budget: number;
  alerts: SpendAlert[];
  money: (value: number) => string;
  reduce: boolean;
}

/** Cumulative spend as one drawn line, with the projection, the budget and the alert rules on the same scale. */
function Chart({ cumulative, projection, days, start, budget, alerts, money, reduce }: ChartProps) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);
  const [cursor, setCursor] = useState<number | null>(null);

  const plot = Math.max(0, width - 56);
  const elapsed = cumulative.length;
  // The axis snaps to a round step so the gridlines fall on readable numbers rather than on the data maximum.
  const ceiling = (() => {
    const max = 1.06 * Math.max(budget, projection[projection.length - 1] ?? 0, ...alerts.map(alert => alert.amount));
    const step = 10 ** Math.floor(Math.log10(max)) / 2;
    return Math.ceil(max / step) * step;
  })();
  const sx = (day: number) => ((day - 1) / (days - 1)) * plot;
  const sy = (value: number) => 12 + (1 - value / ceiling) * 154;

  const line = cumulative.map((value, index) => `${index ? "L" : "M"}${sx(index + 1).toFixed(1)},${sy(value).toFixed(1)}`).join("");
  const area = `${line}L${sx(elapsed).toFixed(1)},${sy(0)}L0,${sy(0)}Z`;
  const projected = projection.map((value, index) => `${index ? "L" : "M"}${sx(elapsed + index).toFixed(1)},${sy(value).toFixed(1)}`).join("");
  const ticks = plot < 360 ? [1, Math.ceil(days / 2), days] : [1, 8, 15, 22, days];
  const valueAt = (day: number) => (day <= elapsed ? cumulative[day - 1] : projection[day - elapsed]);

  function track(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const day = Math.round(((event.clientX - box.left) / Math.max(1, plot)) * (days - 1)) + 1;
    setCursor(Math.max(1, Math.min(days, day)));
  }

  const summary = `Spend so far ${money(cumulative[elapsed - 1] ?? 0)}, projected ${money(projection[projection.length - 1] ?? 0)} by ${formatDay(start, days - 1)}, budget ${money(budget)}.`;
  const tipLeft = cursor ? Math.max(64, Math.min(plot - 64, sx(cursor))) : 0;

  return (
    <div
      ref={frame}
      className={styles.chart}
      tabIndex={0}
      role="img"
      aria-label={summary}
      onKeyDown={event => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (event.key === "Escape") setCursor(null);
        else if (step) {
          event.preventDefault();
          setCursor(current => Math.max(1, Math.min(days, (current ?? elapsed) + step)));
        }
      }}
      onBlur={() => setCursor(null)}
      onPointerMove={track}
      onPointerLeave={() => setCursor(null)}
      onPointerDown={track}
    >
      {width > 0 && (
        <svg width={width} height={188} aria-hidden="true">
          {[0.25, 0.5, 0.75].map(fraction => (
            <line key={fraction} x1={0} x2={plot} y1={sy(ceiling * fraction)} y2={sy(ceiling * fraction)} className={styles.gridLine} />
          ))}
          <line x1={0} x2={plot} y1={sy(0)} y2={sy(0)} className={styles.axis} />
          <g className={styles.budget}>
            <line x1={0} x2={plot} y1={sy(budget)} y2={sy(budget)} />
            <text x={plot + 8} y={sy(budget) + 4}>
              {money(budget).replace(/\.00$/, "")}
            </text>
          </g>
          {alerts.map(alert => (
            <motion.g
              key={alert.id}
              className={styles.alertRule}
              initial={false}
              animate={{ y: sy(alert.amount) }}
              transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
            >
              <line x1={0} x2={plot} y1={0} y2={0} />
              <circle cx={plot} cy={0} r={2.5} />
              <text x={plot + 8} y={4}>
                {money(alert.amount).replace(/\.00$/, "")}
              </text>
            </motion.g>
          ))}
          <motion.path
            d={area}
            className={styles.area}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          />
          <motion.path
            d={line}
            className={styles.line}
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: easeEnter }}
          />
          <motion.path
            d={projected}
            className={styles.projection}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          />
          <motion.circle
            cx={sx(elapsed)}
            cy={sy(cumulative[elapsed - 1] ?? 0)}
            r={3.5}
            className={styles.today}
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={reduce ? { duration: 0 } : { ...motionTokens.spring.snappy, delay: 0.8 }}
          />
          {ticks.map(tick => (
            <text key={tick} x={sx(tick)} y={182} className={styles.tick} textAnchor={tick === 1 ? "start" : tick === days ? "end" : "middle"}>
              {formatDay(start, tick - 1)}
            </text>
          ))}
          {cursor && (
            <g className={styles.cursor}>
              <line x1={sx(cursor)} x2={sx(cursor)} y1={12} y2={sy(0)} />
              <circle cx={sx(cursor)} cy={sy(valueAt(cursor))} r={3.5} />
            </g>
          )}
        </svg>
      )}
      <AnimatePresence>
        {cursor && (
          <motion.div
            className={styles.tip}
            style={{ left: tipLeft }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTokens.duration.instant }}
          >
            <span>
              {formatDay(start, cursor - 1)}
              {cursor > elapsed ? ", projected" : ""}
            </span>
            <strong>{money(valueAt(cursor))}</strong>
            {cursor <= elapsed && <small>{money(cumulative[cursor - 1] - (cumulative[cursor - 2] ?? 0))} that day</small>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The Slack mark is inline because the block draws it in brand colours, not in the current text colour. */
function SlackIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 122.8 122.8" aria-hidden="true">
      <path
        fill="#e01e5a"
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
      />
      <path
        fill="#36c5f0"
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
      />
      <path
        fill="#2eb67d"
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
      />
      <path
        fill="#ecb22e"
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
      />
    </svg>
  );
}

interface MeterBarProps {
  meter: UsageMeter;
  limit: number;
  days: number;
  today: number;
  index: number;
  reduce: boolean;
}

function MeterBar({ meter, limit, days, today, index, reduce }: MeterBarProps) {
  // Seats are bought, not consumed over time, so projecting them forward would be wrong.
  const projected = meter.unit === "seats" ? meter.used : (meter.used * days) / today;
  const ratio = meter.used / limit;
  const ahead = Math.min(1, projected / limit);
  const tone = ratio >= 0.9 ? "critical" : ratio >= 0.75 || projected > limit ? "warning" : "ok";
  const over = projected > limit ? Math.round((projected / limit - 1) * 100) : 0;
  const note =
    meter.unit === "seats"
      ? `${limit - meter.used} ${limit - meter.used === 1 ? "seat" : "seats"} left`
      : over
        ? `Projected ${formatAmount(projected, meter.unit)}, ${over}% over`
        : `Projected ${formatAmount(projected, meter.unit)}`;
  const delay = reduce ? 0 : 0.15 + index * motionTokens.stagger.item * 2;
  const transition = reduce ? { duration: 0 } : { ...motionTokens.spring.smooth, delay };

  return (
    <li className={styles.meter} data-tone={tone}>
      <div className={styles.meterHead}>
        <span className={styles.meterName}>
          {tone !== "ok" && <TriangleAlert size={14} aria-hidden="true" />}
          {meter.name}
        </span>
        <span className={styles.meterValue}>
          <strong>{formatAmount(meter.used, meter.unit)}</strong>
          {" of "}
          <TextMorph>{formatAmount(limit, meter.unit)}</TextMorph>
        </span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label={meter.name}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={meter.used}
        aria-valuetext={`${formatAmount(meter.used, meter.unit)} of ${formatAmount(limit, meter.unit)}${
          tone === "ok" ? "" : tone === "critical" ? ", near the limit" : ", projected over"
        }`}
      >
        <motion.span className={styles.ahead} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: ahead }} transition={transition} />
        <motion.span
          className={styles.used}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: Math.min(1, ratio) }}
          transition={transition}
        />
      </div>
      <div className={styles.meterFoot}>
        <span className={styles.meterNote}>
          <TextMorph>{tone !== "critical" || over ? note : `Near limit. ${note}`}</TextMorph>
        </span>
        <span>{meter.overage}</span>
      </div>
    </li>
  );
}

interface AlertRowProps {
  alert: SpendAlert;
  budget: number;
  sentOn: string | null;
  money: (value: number) => string;
  onChange: (alert: SpendAlert) => void;
  onSettle: () => void;
  onRemove: () => void;
  autoFocus: boolean;
  reduce: boolean;
}

function AlertRow({ alert, budget, sentOn, money, onChange, onSettle, onRemove, autoFocus, reduce }: AlertRowProps) {
  const [draft, setDraft] = useState(String(alert.amount));
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // While the field has focus the draft owns the text, so a half-typed "1" is not rewritten to "1,000".
  const value = editing ? draft : String(alert.amount);

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    input.current?.select();
  }, [autoFocus]);

  const percent = Math.round((alert.amount / budget) * 100);

  return (
    <motion.li
      layout={!reduce}
      className={styles.alert}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={reduce ? { duration: 0 } : { layout: motionTokens.spring.smooth, height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}
    >
      <div className={styles.alertInner}>
        <label className={styles.amount}>
          <span className={styles.srOnly}>Alert amount in euros</span>
          <span aria-hidden="true">€</span>
          <input
            ref={input}
            value={value}
            inputMode="numeric"
            onFocus={() => {
              setDraft(String(alert.amount));
              setEditing(true);
            }}
            onBlur={() => {
              setEditing(false);
              onSettle();
            }}
            onChange={event => {
              const next = event.target.value;
              setDraft(next);
              const amount = Number(next.replace(/[^\d.]/g, ""));
              if (next.trim() && Number.isFinite(amount) && amount > 0 && amount < 1e6) onChange({ ...alert, amount: Math.round(amount) });
            }}
            onKeyDown={event => {
              if (event.key === "Enter") input.current?.blur();
            }}
          />
        </label>
        <span className={styles.alertMeta} title={sentOn ? `Sent ${sentOn}` : `${percent}% of budget`}>
          {sentOn ? (
            <>
              <Check size={12} aria-hidden="true" />
              <span className={styles.srOnly}>Sent </span>
              {sentOn}
            </>
          ) : (
            <>
              {percent}%<span className={styles.srOnly}> of budget</span>
            </>
          )}
        </span>
        <span className={styles.channels}>
          <button
            type="button"
            className={styles.channel}
            aria-pressed={alert.email}
            onClick={() => onChange({ ...alert, email: !alert.email })}
            aria-label={`Email at ${money(alert.amount)}`}
          >
            <Mail size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.channel}
            data-brand=""
            aria-pressed={alert.slack}
            onClick={() => onChange({ ...alert, slack: !alert.slack })}
            aria-label={`Slack at ${money(alert.amount)}`}
          >
            <SlackIcon className={styles.slack} />
          </button>
          <button type="button" className={styles.remove} onClick={onRemove} aria-label={`Remove the ${money(alert.amount)} alert`}>
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      </div>
    </motion.li>
  );
}

interface InvoiceDownloadProps {
  invoice: Invoice;
  onDownload?: (invoice: Invoice) => Promise<void> | void;
}

type DownloadState = "idle" | "loading" | "done" | "error";

/** The icon swaps in place and the button never changes width, so the table does not reflow. */
function InvoiceDownload({ invoice, onDownload }: InvoiceDownloadProps) {
  const [state, setState] = useState<DownloadState>("idle");
  const reduce = useReducedMotion();
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const icon =
    state === "done" ? (
      <Check size={15} />
    ) : state === "error" ? (
      <RotateCcw size={15} />
    ) : state === "loading" ? (
      <span className={styles.spinner} />
    ) : (
      <Download size={15} />
    );

  return (
    <button
      type="button"
      className={styles.download}
      data-state={state}
      onClick={() => {
        if (state === "loading") return;
        setState("loading");
        (onDownload
          ? Promise.resolve().then(() => onDownload(invoice))
          : new Promise(resolve => {
              timer.current = window.setTimeout(resolve, 700);
            })
        )
          .then(
            () => setState("done"),
            () => setState("error"),
          )
          .finally(() => {
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setState("idle"), 1600);
          });
      }}
      aria-label={
        state === "done"
          ? `${invoice.number} downloaded`
          : state === "error"
            ? `Download of ${invoice.number} failed, try again`
            : `Download ${invoice.number} as PDF`
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className={styles.downloadIcon}
          aria-hidden="true"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
          transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

type SheetState = "review" | "working" | "done" | "error";

interface SheetTarget {
  origin: Rect;
  minY: number;
  from: UsagePlan;
  to: UsagePlan;
}

interface UpgradeSheetProps {
  target: SheetTarget;
  closing: Rect | null;
  rootWidth: number;
  onClosed: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  state: SheetState;
  meters: UsageMeter[];
  days: number;
  today: number;
  money: (value: number) => string;
  payment: PaymentMethod;
  reduce: boolean;
}

/**
 * The plan card grows into the sheet and folds back into it on cancel, so the change of surface is
 * readable as one object. The dialog is not portalled: it is placed in the block's own coordinate
 * space, which is what makes the flight measurable.
 */
function UpgradeSheet({
  target,
  closing,
  rootWidth,
  onClosed,
  onCancel,
  onConfirm,
  state,
  meters,
  days,
  today,
  money,
  payment,
  reduce,
}: UpgradeSheetProps) {
  const { origin, minY, from, to } = target;
  const width = Math.min(440, rootWidth - 24);
  const destination = { x: (rootWidth - width) / 2, y: Math.max(minY, origin.y - 24), width };

  const x = useMotionValue(reduce ? destination.x : origin.x);
  const y = useMotionValue(reduce ? destination.y : origin.y);
  const sheetWidth = useMotionValue(reduce ? destination.width : origin.width);
  const height = useMotionValue(origin.height);
  const opacity = useMotionValue(reduce ? 1 : 0);
  const content = useMotionValue(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const remaining = days - today + 1;
  const charge = (to.price * remaining) / days;
  const credit = (from.price * remaining) / days;

  // Opening: jump to the plan card's box, then let the spring carry it to the sheet's place and size.
  useLayoutEffect(() => {
    if (closing) return;
    const element = contentRef.current;
    if (!element) return;
    const fly = (initial: boolean) => {
      if (reduce) {
        x.jump(destination.x);
        y.jump(destination.y);
        sheetWidth.jump(destination.width);
        height.jump(element.offsetHeight);
        return;
      }
      animate(x, destination.x, flightOpen);
      animate(y, destination.y, flightOpen);
      animate(sheetWidth, destination.width, flightOpen);
      animate(height, element.offsetHeight, initial ? flightOpen : motionTokens.spring.smooth);
    };
    fly(true);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fly(false));
    observer.observe(element);
    return () => observer.disconnect();
  }, [closing, content, height, opacity, reduce, sheetWidth, x, y, destination.x, destination.y, destination.width, destination.x]);

  useEffect(() => {
    if (closing) return;
    animate(opacity, 1, { duration: reduce ? motionTokens.duration.fast : 0 });
    animate(content, 1, {
      duration: reduce ? motionTokens.duration.fast : motionTokens.duration.standard,
      delay: 0.1 * (reduce ? 0 : 1),
      ease: easeEnter,
    });
    heading.current?.focus({ preventScroll: true });
  }, [content, closing, opacity, reduce]);

  // Closing: fly back to whatever the plan card is now, then let the parent unmount the sheet.
  useEffect(() => {
    if (!closing) return;
    if (reduce) {
      const fade = animate(opacity, 0, { duration: motionTokens.duration.fast });
      fade.then(onClosed);
      return () => fade.stop();
    }
    animate(content, 0, { duration: motionTokens.duration.instant });
    animate(x, closing.x, motionTokens.spring.smooth);
    animate(y, closing.y, motionTokens.spring.smooth);
    animate(sheetWidth, closing.width, motionTokens.spring.smooth);
    animate(height, closing.height, motionTokens.spring.smooth);
    const fade = animate(opacity, 0, { duration: motionTokens.duration.instant, delay: 0.3 });
    fade.then(onClosed);
    return () => fade.stop();
  }, [closing, content, height, onClosed, opacity, reduce, sheetWidth, x, y]);

  return (
    <motion.div
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={event => {
        if (event.key === "Escape" && state !== "working") {
          event.preventDefault();
          onCancel();
          return;
        }
        if (event.key !== "Tab") return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
        if (!buttons.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      style={{ x, y, width: sheetWidth, height, opacity }}
    >
      <motion.div ref={contentRef} className={styles.sheetContent} style={{ width: destination.width, opacity: content }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "done" ? (
            <motion.div
              key="done"
              className={styles.sheetDone}
              initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: motionTokens.duration.standard, ease: easeEnter }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <motion.path
                  d="M5 12.5 9.5 17 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduce ? 0 : 0.36, delay: reduce ? 0 : 0.08, ease: easeEnter }}
                />
              </svg>
              <h3 ref={heading} id={headingId} tabIndex={-1}>
                You are on {to.name}
              </h3>
              <p>New limits apply right away.</p>
            </motion.div>
          ) : (
            <motion.div
              key="review"
              exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: motionTokens.duration.fast }}
            >
              <div className={styles.sheetHead}>
                <h3 ref={heading} id={headingId} tabIndex={-1}>
                  Upgrade to {to.name}
                </h3>
                <button type="button" className={styles.iconButton} onClick={onCancel} disabled={state === "working"} aria-label="Close">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <table className={styles.limits}>
                <caption className={styles.srOnly}>Limits before and after the upgrade</caption>
                <tbody>
                  {meters.map(meter => (
                    <tr key={meter.id}>
                      <th scope="row">{meter.name}</th>
                      <td>{formatAmount(from.limits[meter.id] ?? meter.limit, meter.unit)}</td>
                      <td aria-hidden="true">
                        <ArrowRight size={13} />
                      </td>
                      <td>
                        <strong>{formatAmount(to.limits[meter.id] ?? meter.limit, meter.unit)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className={styles.charges}>
                <div>
                  <dt>
                    {to.name}, {remaining} days
                  </dt>
                  <dd>{money(charge)}</dd>
                </div>
                <div>
                  <dt>Unused {from.name} time</dt>
                  <dd>−{money(credit)}</dd>
                </div>
                <div className={styles.due}>
                  <dt>Due today</dt>
                  <dd>{money(charge - credit)}</dd>
                </div>
              </dl>
              <p className={styles.sheetNote}>
                Then {money(to.price)} a month. Charged to {payment.brand} ending {payment.last4}.
              </p>
              {state === "error" && (
                <p className={styles.sheetError} role="alert">
                  The card was declined. Nothing was charged.
                </p>
              )}
              <div className={styles.sheetActions}>
                <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={state === "working"}>
                  Cancel
                </Button>
                <Button type="button" size="sm" loading={state === "working"} onClick={onConfirm}>
                  {state === "working" ? "Upgrading" : `Pay ${money(charge - credit)}`}
                </Button>
              </div>
              <p className={styles.simulated}>Preview only. No payment is taken.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/**
 * A usage period with the spend curve, the plan offer, per-meter projections, spend alerts and invoices.
 * Everything is computed from the period and the daily series: the chart, the pace sentence, the meters
 * and the prorated upgrade all read the same numbers, so a different month needs no other edits.
 */
export function UsageBilling({
  period = PERIOD,
  daily = DAILY,
  budget = 2000,
  meters = METERS,
  plan = PRO,
  upgrade = SCALE,
  defaultAlerts = DEFAULT_ALERTS,
  onAlertsChange,
  invoices = INVOICES,
  payment = PAYMENT,
  onUpgrade,
  onDownloadInvoice,
  currency = "EUR",
  className,
}: UsageBillingProps) {
  const reduce = !!useReducedMotion();
  const [current, setCurrent] = useState(plan);
  const [alerts, setAlerts] = useState<SpendAlert[]>(() => [...defaultAlerts].sort((a, b) => a.amount - b.amount));
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [closing, setClosing] = useState<Rect | null>(null);
  const [sheetState, setSheetState] = useState<SheetState>("review");
  const [live, setLive] = useState("");

  const root = useRef<HTMLDivElement>(null);
  const planCard = useRef<HTMLElement>(null);
  const upgradeButton = useRef<HTMLButtonElement>(null);
  const timers = useRef(new Set<number>());
  const alertCounter = useRef(0);
  const rootWidth = useWidth(root);

  const money = useMemo(() => {
    const format = new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (value: number) => format.format(value);
  }, [currency]);

  const currencySymbol = useMemo(
    () =>
      new Intl.NumberFormat("en-IE", { style: "currency", currency })
        .formatToParts(0)
        .find(part => part.type === "currency")?.value ?? "",
    [currency],
  );

  const cumulative = useMemo(() => daily.reduce<number[]>((sums, value) => [...sums, (sums[sums.length - 1] ?? 0) + value], []), [daily]);
  const elapsed = cumulative.length;
  const spend = cumulative[elapsed - 1] ?? 0;
  // The projection is the flat average of the last week, not a curve fit: a week is long enough to
  // survive one quiet day and short enough to react to a spike.
  const average = daily.slice(-7).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(7, daily.length));
  const projection = useMemo(
    () => Array.from({ length: period.days - elapsed + 1 }, (_, index) => spend + average * index),
    [period.days, average, spend, elapsed],
  );
  const projectedTotal = projection[projection.length - 1] ?? spend;

  const nextAlert = alerts.find(alert => alert.amount > spend && alert.amount <= projectedTotal);
  const pace =
    projectedTotal > budget
      ? {
          tone: "critical",
          text: `On pace to pass your budget around ${formatDay(period.start, Math.min(period.days, elapsed + Math.ceil((budget - spend) / average)) - 1)}`,
        }
      : nextAlert
        ? {
            tone: "warning",
            text: `On pace to reach your ${money(nextAlert.amount).replace(/\.00$/, "")} alert around ${formatDay(period.start, Math.min(period.days, elapsed + Math.ceil((nextAlert.amount - spend) / average)) - 1)}`,
          }
        : { tone: "ok", text: "On pace to stay under every alert" };

  const offer = upgrade && current.id !== upgrade.id ? upgrade : null;
  const hotMeters = meters.filter(meter => meter.used / (current.limits[meter.id] ?? meter.limit) >= 0.75).map(meter => meter.name.toLowerCase());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(id => window.clearTimeout(id));
  }, []);

  const later = useCallback((run: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      run();
    }, delay);
    timers.current.add(id);
  }, []);

  function applyAlerts(next: SpendAlert[]) {
    setAlerts(next);
    onAlertsChange?.(next);
  }

  /** Closing reverses the flight: the sheet folds back into the plan card, then focus returns to it. */
  function closeSheet(upgrading = false) {
    if (!root.current || !planCard.current) return;
    setClosing(rectOf(planCard.current, root.current));
    later(() => (upgrading ? planCard.current : upgradeButton.current)?.focus({ preventScroll: true }), 360 * (reduce ? 0 : 1));
  }

  const settle = useCallback(() => {
    setTarget(null);
    setClosing(null);
  }, []);

  /** The day a rule fires, for the sent tick in the alert row. */
  function sentOnFor(amount: number) {
    const index = cumulative.findIndex(total => total >= amount);
    return index >= 0 ? formatDay(period.start, index) : null;
  }

  return (
    <div ref={root} className={`${styles.root} ${className ?? ""}`}>
      <header className={styles.header}>
        <div>
          <h2>Usage and billing</h2>
          <p>
            {period.label} · day {elapsed} of {period.days}
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <section className={`${styles.panel} ${styles.spend}`} aria-labelledby="usage-billing-spend">
          <div className={styles.spendHead}>
            <div className={styles.stat}>
              <h3 id="usage-billing-spend">Spend so far</h3>
              <span className={styles.big}>
                <AnimatedCounter value={spend} prefix={currencySymbol} decimals={2} animateOnView />
              </span>
            </div>
            <dl className={styles.substats}>
              <div>
                <dt>Projected</dt>
                <dd>{money(projectedTotal)}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{money(budget)}</dd>
              </div>
            </dl>
          </div>
          <Chart
            cumulative={cumulative}
            projection={projection}
            days={period.days}
            start={period.start}
            budget={budget}
            alerts={alerts}
            money={money}
            reduce={reduce}
          />
          <p className={styles.pace} data-tone={pace.tone}>
            {pace.tone !== "ok" && <TriangleAlert size={14} aria-hidden="true" />}
            {rootWidth >= 520 ? (
              <TextMorph>{pace.text}</TextMorph>
            ) : (
              <span className={styles.paceText}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={pace.text}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? motionTokens.duration.instant : motionTokens.duration.fast }}
                  >
                    {pace.text}
                  </motion.span>
                </AnimatePresence>
              </span>
            )}
          </p>
        </section>

        <section
          ref={planCard}
          tabIndex={-1}
          className={`${styles.panel} ${styles.plan}`}
          data-hidden={target ? "" : undefined}
          aria-labelledby="usage-billing-plan"
        >
          <div className={styles.planNow}>
            <h3 id="usage-billing-plan">Plan</h3>
            <p className={styles.planName}>
              <TextMorph>{current.name}</TextMorph>
              <span className={styles.planPrice}>
                <TextMorph>{`${money(current.price).replace(/\.00$/, "")} a month`}</TextMorph>
              </span>
            </p>
            <p className={styles.muted}>
              Renews Oct 1 · {payment.brand} ending {payment.last4}
            </p>
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            {offer ? (
              <motion.div key="offer" className={styles.offer} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast }}>
                <p className={styles.offerLead}>
                  {hotMeters.length
                    ? `${offer.name} gives you room on ${hotMeters.slice(0, 2).join(" and ")}.`
                    : `${offer.name} raises every limit.`}
                </p>
                <ul className={styles.perks}>
                  {meters
                    .filter(meter => (offer.limits[meter.id] ?? 0) > (current.limits[meter.id] ?? 0))
                    .slice(0, 3)
                    .map(meter => {
                      const limit = offer.limits[meter.id];
                      const label = meter.name
                        .split(" ")
                        .map(word => (word === word.toUpperCase() ? word : word.toLowerCase()))
                        .join(" ");
                      return (
                        <li key={meter.id}>
                          <Check size={14} aria-hidden="true" />
                          {meter.unit === "minutes" || meter.unit === "seats"
                            ? `${Math.round(limit).toLocaleString("en-US")} ${label}`
                            : `${formatAmount(limit, meter.unit)} ${label}`}
                        </li>
                      );
                    })}
                  {offer.perks.slice(0, 1).map(perk => (
                    <li key={perk}>
                      <Check size={14} aria-hidden="true" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  ref={upgradeButton}
                  type="button"
                  size="sm"
                  className={styles.offerButton}
                  onClick={() => {
                    if (!root.current || !planCard.current || !offer) return;
                    setSheetState("review");
                    setClosing(null);
                    const minY = Math.max(12, 88 - root.current.getBoundingClientRect().top);
                    setTarget({ origin: rectOf(planCard.current, root.current), minY, from: current, to: offer });
                  }}
                >
                  Upgrade to {offer.name}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="top"
                className={styles.offer}
                initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: motionTokens.duration.standard, ease: easeEnter }}
              >
                <p className={styles.offerLead}>Every limit is raised for the rest of {formatDay(period.start, 0).split(" ")[0]}.</p>
                <ul className={styles.perks}>
                  {current.perks.map(perk => (
                    <li key={perk}>
                      <Check size={14} aria-hidden="true" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className={`${styles.panel} ${styles.meters}`} aria-labelledby="usage-billing-meters">
          <div className={styles.panelHead}>
            <h3 id="usage-billing-meters">Usage</h3>
            <span className={styles.muted}>Resets {formatDay(period.start, period.days)}</span>
          </div>
          <ul className={styles.meterList}>
            {meters.map((meter, index) => (
              <MeterBar
                key={meter.id}
                meter={meter}
                limit={current.limits[meter.id] ?? meter.limit}
                days={period.days}
                today={elapsed}
                index={index}
                reduce={reduce}
              />
            ))}
          </ul>
        </section>

        <section className={`${styles.panel} ${styles.alerts}`} aria-labelledby="usage-billing-alerts">
          <div className={styles.panelHead}>
            <h3 id="usage-billing-alerts">Spend alerts</h3>
            <span className={styles.legend} aria-hidden="true">
              <Mail size={12} /> Email <SlackIcon size={11} /> Slack
            </span>
          </div>
          <ul className={styles.alertList}>
            <AnimatePresence initial={false}>
              {alerts.map(alert => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  budget={budget}
                  money={money}
                  autoFocus={autoFocusId === alert.id}
                  reduce={reduce}
                  sentOn={sentOnFor(alert.amount)}
                  onChange={next => applyAlerts(alerts.map(item => (item.id === next.id ? next : item)))}
                  onSettle={() => {
                    setAutoFocusId(null);
                    setAlerts(previous =>
                      previous.every((item, index) => !index || previous[index - 1].amount <= item.amount)
                        ? previous
                        : [...previous].sort((a, b) => a.amount - b.amount),
                    );
                  }}
                  onRemove={() => {
                    applyAlerts(alerts.filter(item => item.id !== alert.id));
                    setLive(`Removed the ${money(alert.amount)} alert`);
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
          {!alerts.length && <p className={styles.muted}>No alerts. You will only hear about spend on your invoice.</p>}
          <div className={styles.alertFoot}>
            <button
              type="button"
              className={styles.add}
              onClick={() => {
                if (alerts.length >= 5) return;
                const highest = alerts[alerts.length - 1]?.amount ?? 0.5 * budget;
                const id = `alert-${Date.now().toString(36)}-${alertCounter.current++}`;
                applyAlerts([
                  ...alerts,
                  { id, amount: Math.min(budget, 50 * Math.round((highest + 250) / 50)), email: true, slack: false },
                ]);
                setAutoFocusId(id);
                setLive("Alert added");
              }}
              disabled={alerts.length >= 5}
            >
              <Plus size={14} aria-hidden="true" />
              Add alert
            </button>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.invoices}`} aria-labelledby="usage-billing-invoices">
          <div className={styles.panelHead}>
            <h3 id="usage-billing-invoices">Invoices</h3>
            <span className={styles.muted}>
              <CreditCard size={13} aria-hidden="true" /> {payment.brand} ending {payment.last4}
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col" className={styles.issued}>
                  Issued
                </th>
                <th scope="col" className={styles.num}>
                  Amount
                </th>
                <th scope="col" className={styles.statusCol}>
                  Status
                </th>
                <th scope="col">
                  <span className={styles.srOnly}>Download</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>
                    <span className={styles.invoiceName}>{invoice.period}</span>
                    <span className={styles.invoiceNumber}>{invoice.number}</span>
                  </td>
                  <td className={styles.issued}>{invoice.issued}</td>
                  <td className={styles.num}>
                    {money(invoice.amount)}
                    <span className={`${styles.status} ${styles.statusInline}`} data-status={invoice.status} aria-hidden="true">
                      {invoice.status === "paid" ? "Paid" : invoice.status === "refunded" ? "Refunded" : "Failed"}
                    </span>
                  </td>
                  <td className={styles.statusCol}>
                    <span className={styles.status} data-status={invoice.status}>
                      {invoice.status === "paid" ? "Paid" : invoice.status === "refunded" ? "Refunded" : "Failed"}
                    </span>
                  </td>
                  <td className={styles.action}>
                    <InvoiceDownload invoice={invoice} onDownload={onDownloadInvoice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <AnimatePresence>
        {target && !closing && (
          <motion.div
            key="scrim"
            className={styles.scrim}
            onPointerDown={() => sheetState !== "working" && closeSheet()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? motionTokens.duration.instant : motionTokens.duration.standard }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {target && rootWidth > 0 && (
        <UpgradeSheet
          target={target}
          closing={closing}
          rootWidth={rootWidth}
          onClosed={settle}
          onCancel={() => closeSheet()}
          onConfirm={() => {
            const next = target.to;
            if (!next || sheetState === "working") return;
            setSheetState("working");
            setLive(`Upgrading to ${next.name}`);
            const succeed = () => {
              setSheetState("done");
              setLive(`You are on ${next.name}. New limits apply right away.`);
              later(() => {
                closeSheet(true);
                later(() => setCurrent(next), 280 * (reduce ? 0 : 1));
              }, 1100);
            };
            if (onUpgrade) {
              Promise.resolve()
                .then(() => onUpgrade(next))
                .then(succeed, () => {
                  setSheetState("error");
                  setLive("The upgrade failed. Nothing was charged.");
                });
            } else {
              later(succeed, 1100);
            }
          }}
          state={sheetState}
          meters={meters}
          days={period.days}
          today={elapsed}
          money={money}
          payment={payment}
          reduce={reduce}
        />
      )}

      <p className={styles.srOnly} role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

export default UsageBilling;
