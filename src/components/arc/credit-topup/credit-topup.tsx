"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from "motion/react";
import { Check, CircleAlert, CircleCheck, Lock, RefreshCw, TriangleAlert } from "lucide-react";
import Button from "../button/button";
import Slider from "../slider/slider";
import Switch from "../switch/switch";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./credit-topup.module.css";

export type CreditBrand = "visa" | "mastercard";

/** One day of credit spend. The last entry in `usage` is today. */
export interface CreditUsageDay {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Credits spent that day. */
  credits: number;
}

/** A volume bonus that starts at `min` credits. */
export interface CreditBonusTier {
  /** Credits at which the bonus applies. */
  min: number;
  /** Percent of the purchase added on top. */
  percent: number;
}

export interface CreditPricing {
  /** Price of a single credit in `currency`. */
  unitPrice: number;
  /** ISO 4217 code the whole card is priced in. */
  currency: string;
  /** Volume bonuses, highest `min` wins. */
  bonusTiers: CreditBonusTier[];
}

export interface CreditRange {
  min: number;
  max: number;
  step: number;
}

export interface CreditPaymentMethod {
  id: string;
  brand: CreditBrand;
  last4: string;
  /** `MM/YYYY`. */
  expires: string;
}

export interface CreditAutoTopup {
  enabled: boolean;
  threshold: number;
}

/** What a number of credits costs, with the bonus already applied. */
export interface CreditQuote {
  credits: number;
  bonus: number;
  total: number;
  price: number;
  currency: string;
}

/** The quote handed to `onPurchase`, bound to the card that will be charged. */
export interface CreditOrder extends CreditQuote {
  paymentMethodId: string;
}

/** Auto top-up settings plus the amount they refill with, including bonus. */
export interface CreditAutoTopupChange extends CreditAutoTopup {
  credits: number;
}

export interface CreditTopupProps {
  /** The current balance in credits, controlled. Any change rolls the numerals. Leave it out and the card keeps its own balance and adds each purchase to it. */
  balance?: number;
  /** The starting balance when `balance` is left out. Defaults to `840`. */
  defaultBalance?: number;
  /** Daily usage, oldest first. The last day is today. Drives the bar chart, its hover readout and the days left estimate. Defaults to the Oct 14 to Oct 27, 2026 sample. */
  usage?: CreditUsageDay[];
  /** Preset pack sizes in credits, shown as a radio group. Keep it to three for the layout. Defaults to `[1000, 5000, 20000]`. */
  packs?: number[];
  /** Prices, bonus badges, the total and the per 1,000 rate all derive from it. Defaults to $0.01 a credit with +10% from 5,000 and +15% from 20,000. */
  pricing?: CreditPricing;
  /** The custom amount slider's range in credits. Defaults to `{ min: 500, max: 30000, step: 500 }`. */
  range?: CreditRange;
  /** The amount selected on mount. Defaults to the second pack. */
  defaultCredits?: number;
  /** Saved cards. Defaults to Visa 4242 and Mastercard 5454. */
  paymentMethods?: CreditPaymentMethod[];
  /** Choices for the auto top-up threshold. Defaults to `[500, 1000, 2500]`. */
  thresholds?: number[];
  /** Auto top-up settings on mount. Defaults to `{ enabled: false, threshold: 1000 }`. */
  defaultAutoTopup?: CreditAutoTopup;
  /** Called when auto top-up is switched or its threshold changes. `credits` is the selected amount including bonus. */
  onAutoTopupChange?: (settings: CreditAutoTopupChange) => void;
  /** Called when another saved card is chosen. */
  onPaymentMethodChange?: (id: string) => void;
  /** Charges the order. Resolve once the credits are added; reject with an Error and its message shows with a Try again button. Aborted on unmount. Leave it out to simulate a 1.2s charge. */
  onPurchase?: (order: CreditOrder, signal: AbortSignal) => Promise<void>;
  /** Called after a successful purchase with the new balance. */
  onPurchased?: (order: CreditOrder, balance: number) => void;
  /** Extra class on the card. */
  className?: string;
}

const BRAND_LABEL: Record<CreditBrand, string> = { visa: "Visa", mastercard: "Mastercard" };

const SAMPLE_PRICING: CreditPricing = {
  unitPrice: 0.01,
  currency: "USD",
  bonusTiers: [
    { min: 5_000, percent: 10 },
    { min: 20_000, percent: 15 },
  ],
};

const SAMPLE_PACKS = [1_000, 5_000, 20_000];
const SAMPLE_RANGE: CreditRange = { min: 500, max: 30_000, step: 500 };
const SAMPLE_THRESHOLDS = [500, 1_000, 2_500];

const SAMPLE_USAGE: CreditUsageDay[] = [356, 402, 388, 441, 297, 214, 198, 423, 468, 437, 489, 452, 471, 318].map((credits, index) => ({
  date: `2026-10-${String(14 + index).padStart(2, "0")}`,
  credits,
}));

const SAMPLE_METHODS: CreditPaymentMethod[] = [
  { id: "card_visa_4242", brand: "visa", last4: "4242", expires: "08/2028" },
  { id: "card_mc_5454", brand: "mastercard", last4: "5454", expires: "03/2029" },
];

/** Prices an order: the highest bonus tier the amount reaches, rounded to whole credits, priced at the unit rate. */
export function quoteCredits(credits: number, pricing: CreditPricing): CreditQuote {
  const tier = [...pricing.bonusTiers].sort((a, b) => b.min - a.min).find((t) => credits >= t.min);
  const bonus = tier ? Math.round((credits * tier.percent) / 100) : 0;
  return {
    credits,
    bonus,
    total: credits + bonus,
    price: Math.round(credits * pricing.unitPrice * 100) / 100,
    currency: pricing.currency,
  };
}

/** The ten glyphs of a strip, with a repeat so a roll from 9 to 0 has somewhere to land. */
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const ROLL_EASE = [...motionTokens.ease.standard] as [number, number, number, number];

/** The crossfade every label swap uses: 2px rise, out in 100ms, in over 160ms. */
const swap = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] as [number, number, number, number] } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Bounce-free 0.24s spring the selection ring and the threshold pill glide on, matching the strip width spring. */
const glide: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };

const list = (value: number) => value.toLocaleString("en-US");

function currency(value: number, code: string, cents = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

/** Arrow, Home and End roving focus for a radio group, which then selects the option it lands on. */
function rove(event: KeyboardEvent<HTMLButtonElement>, index: number, count: number, select: (index: number) => void) {
  const next =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (index + 1) % count
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? (index - 1 + count) % count
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? count - 1
            : -1;
  if (next < 0) return;
  event.preventDefault();
  select(next);
  const options = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=radio]");
  options?.[next]?.focus();
}

interface DigitProps {
  value: number;
  /** Position from the right, 0 for the ones place. */
  place: number;
  change: { up: boolean; diff: number; version: number };
  duration: number;
  spin: boolean;
  reduced: boolean;
}

/** One rolling digit: a strip of ten glyphs moved on its own motion value, so a roll never re-renders React. */
function Digit({ value, place, change, duration, spin, reduced }: DigitProps) {
  const digit = useMotionValue(value);
  const y = useTransform(digit, (current) => `${-(((current % 10) + 10) % 10) * 1.2}em`);
  const { up, diff, version } = change;
  const seen = useRef(version);

  useEffect(() => {
    const moved = seen.current !== version;
    seen.current = version;
    const from = digit.get();
    const rest = ((Math.round(from) % 10) + 10) % 10;
    if (reduced) {
      digit.jump(value);
      return;
    }
    // A big jump on the leading places takes one extra lap, so the odometer reads as counting up.
    const lap = moved && spin && place <= 2 && diff >= 10 ** place ? 1 : 0;
    if (rest === value && !lap) return;
    const delta = up ? ((value - rest + 10) % 10) + 10 * lap : -(((rest - value + 10) % 10) + 10 * lap);
    const controls = animate(digit, Math.round(from) + delta, { duration, ease: ROLL_EASE });
    return () => controls.stop();
  }, [value, version, up, diff, duration, spin, place, reduced, digit]);

  return (
    <span className={styles.digit}>
      <span className={styles.digitGhost}>0</span>
      <motion.span className={styles.digitStrip} style={{ y }} aria-hidden="true">
        {DIGITS.map((glyph, index) => (
          <span className={styles.digitCell} key={index}>
            {glyph}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

interface RollingNumberProps {
  value: number;
  format: (value: number) => string;
  /** Seconds each digit takes to roll. Defaults to `0.24`. */
  duration?: number;
  /** Give the leading places one extra lap when a large amount lands. */
  spin?: boolean;
  className?: string;
}

/** A number that rolls like an odometer. The digits are hidden from screen readers, which get the whole value instead. */
function RollingNumber({ value, format, duration = motionTokens.duration.standard, spin = false, className }: RollingNumberProps) {
  const reduced = useReducedMotion() ?? false;
  const [shown, setShown] = useState({
    value,
    change: { up: true, diff: 0, version: 0 },
  });
  let change = shown.change;
  if (shown.value !== value) {
    change = {
      up: value > shown.value,
      diff: Math.abs(value - shown.value),
      version: shown.change.version + 1,
    };
    setShown({ value, change });
  }

  const text = format(value);
  const chars = text.split("");
  let place = 0;
  const slots = chars
    .map((char, index) => ({ char, fromRight: chars.length - index, digit: /\d/.test(char) }))
    .reverse()
    .map((char) => ({ ...char, place: char.digit ? place++ : -1 }))
    .reverse();

  return (
    <span className={[styles.rolling, className].filter(Boolean).join(" ")}>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        <AnimatePresence initial={false}>
          {slots.map((slot) => (
            <motion.span
              className={styles.slot}
              key={`${slot.fromRight}-${slot.digit ? "d" : slot.char}`}
              initial={reduced ? { opacity: 0 } : { width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { width: 0, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      width: { type: "spring", visualDuration: motionTokens.spring.snappy.visualDuration, bounce: 0 },
                      opacity: { duration: motionTokens.duration.fast, ease: ROLL_EASE },
                    }
              }
            >
              {slot.digit ? <Digit value={Number(slot.char)} place={slot.place} change={change} duration={duration} spin={spin} reduced={reduced} /> : slot.char}
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </span>
  );
}

interface BrandMarkProps {
  brand: CreditBrand;
  className?: string;
}

/** A 34 × 22 saved-card mark: the network mark drawn inside a white plastic rectangle. */
function BrandMark({ brand, className }: BrandMarkProps) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className={className} width={34} height={22} viewBox="0 0 34 22" role="img" aria-label={BRAND_LABEL[brand]}>
      <rect x=".5" y=".5" width="33" height="21" rx="4.5" fill="#fff" stroke="#d9d3ca" />
      {brand === "visa" ? (
        <svg x="5" y="3" width="24" height="16" viewBox="0 6 24 12">
          <path
            d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
            fill="#1a1f71"
          />
        </svg>
      ) : (
        <g>
          <defs>
            <clipPath id={`${clip}-l`}>
              <circle cx={13.4} cy={11} r={5.8} />
            </clipPath>
          </defs>
          <circle cx={13.4} cy={11} r={5.8} fill="#eb001b" />
          <circle cx={20.6} cy={11} r={5.8} fill="#f79e1b" />
          <circle cx={20.6} cy={11} r={5.8} fill="#ff5f00" clipPath={`url(#${clip}-l)`} />
        </g>
      )}
    </svg>
  );
}

type Status = "idle" | "processing" | "done" | "error";
type Tone = "done" | "error" | "auto";

/**
 * A card for buying AI credits: the balance with a 14 day usage chart and days left, preset packs with bonus
 * badges, a custom amount slider with a live price, auto top-up with a threshold, the saved card, and a
 * checkout that rolls the new balance in. With no props it plays a simulated purchase for a workspace at 840 credits.
 */
export function CreditTopup({
  balance,
  defaultBalance = 840,
  usage = SAMPLE_USAGE,
  packs = SAMPLE_PACKS,
  pricing = SAMPLE_PRICING,
  range = SAMPLE_RANGE,
  defaultCredits,
  paymentMethods = SAMPLE_METHODS,
  thresholds = SAMPLE_THRESHOLDS,
  defaultAutoTopup = { enabled: false, threshold: 1_000 },
  onAutoTopupChange,
  onPaymentMethodChange,
  onPurchase,
  onPurchased,
  className,
}: CreditTopupProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const [innerBalance, setInnerBalance] = useState(defaultBalance);
  const shown = balance ?? innerBalance;
  const [credits, setCredits] = useState(defaultCredits ?? packs[1] ?? packs[0] ?? range.min);
  const [cardIndex, setCardIndex] = useState(0);
  const [auto, setAuto] = useState(defaultAutoTopup);
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState<{ key: number; text: string; tone: Tone } | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busy = status === "processing";

  useEffect(
    () => () => {
      inFlight.current?.abort();
      clearTimeout(timeout.current);
    },
    [],
  );

  const quote = quoteCredits(credits, pricing);
  const method = paymentMethods[cardIndex] ?? paymentMethods[0];
  const glyph = useMemo(
    () =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: pricing.currency })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? "",
    [pricing.currency],
  );
  const simulated = !onPurchase;
  // Today is still in progress, so the burn rate is the average of the full days behind it.
  const fullDays = usage.length > 1 ? usage.slice(0, -1) : usage;
  const dailyAverage = Math.max(1, Math.round(fullDays.reduce((sum, day) => sum + day.credits, 0) / Math.max(1, fullDays.length)));
  const daysLeft = Math.floor(shown / dailyAverage);
  const peak = Math.max(1, ...usage.map((day) => day.credits));
  const low = shown < auto.threshold;
  const perThousand = currency(1_000 * pricing.unitPrice, pricing.currency, (1_000 * pricing.unitPrice) % 1 !== 0);

  function notify(text: string, tone: Tone, ms = 2_600) {
    clearTimeout(timeout.current);
    setNotice({ key: Date.now(), text, tone });
    if (tone !== "error") {
      timeout.current = setTimeout(() => {
        setNotice(null);
        setStatus((current) => (current === "done" ? "idle" : current));
      }, ms);
    }
  }

  function choose(next: number) {
    if (busy) return;
    setCredits(next);
    if (status === "error") {
      setStatus("idle");
      setNotice(null);
    }
  }

  function configure(next: CreditAutoTopup) {
    if (busy) return;
    setAuto(next);
    onAutoTopupChange?.({ ...next, credits: quote.total });
    notify(next.enabled ? `Auto top-up on below ${list(next.threshold)} credits` : "Auto top-up off", "auto");
  }

  async function purchase() {
    if (busy || !method) return;
    clearTimeout(timeout.current);
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const order: CreditOrder = { ...quote, paymentMethodId: method.id };
    setNotice(null);
    setStatus("processing");
    try {
      if (onPurchase) {
        await onPurchase(order, controller.signal);
      } else {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 1_200);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      }
      if (controller.signal.aborted) return;
      const next = shown + order.total;
      if (balance === undefined) setInnerBalance(next);
      setStatus("done");
      notify(`Added ${list(order.total)} credits.${simulated ? " Nothing was charged." : ""}`, "done", 2_400);
      onPurchased?.(order, next);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus("error");
      notify(error instanceof Error && error.message ? error.message : "Payment failed. Try again or change card.", "error");
    }
  }

  const view = notice
    ? {
        key: `m${notice.key}`,
        text: notice.text,
        icon:
          notice.tone === "done" ? (
            <CircleCheck className={styles.good} />
          ) : notice.tone === "error" ? (
            <CircleAlert className={styles.bad} />
          ) : (
            <TriangleAlert />
          ),
      }
    : busy && method
      ? {
          key: "busy",
          text: `Charging ${BRAND_LABEL[method.brand]} ending ${method.last4}`,
          icon: <RefreshCw />,
        }
      : {
          key: "idle",
          text: simulated ? "Simulated checkout. Credits never expire." : "Credits never expire.",
          icon: <Lock />,
        };
  const selectedPack = packs.indexOf(credits);
  const selectedThreshold = thresholds.indexOf(auto.threshold);
  const day = hoveredDay === null ? null : usage[hoveredDay];

  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")} aria-label="Buy AI credits" aria-busy={busy || undefined}>
      <div className={styles.head}>
        <div className={styles.balance}>
          <div className={styles.labelRow}>
            <span className={styles.muted}>Credit balance</span>
            <span className={styles.health}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span className={styles.healthInner} key={low ? "low" : "ok"} {...swap}>
                  {low ? <TriangleAlert className={styles.warn} aria-hidden="true" /> : <CircleCheck className={styles.good} aria-hidden="true" />}
                  {low ? "Running low" : "Healthy"}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
          <div className={styles.amount}>
            <RollingNumber value={shown} format={list} duration={0.9} spin className={styles.big} />
            <span className={styles.unit}>credits</span>
          </div>
          <div className={styles.metaSlot}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span className={styles.meta} key={daysLeft} {...swap}>
                {daysLeft < 1 ? "Less than a day left" : `About ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left at ${list(dailyAverage)} a day`}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <div className={styles.chart}>
          <div
            className={styles.bars}
            role="img"
            aria-label={`Daily usage, last ${usage.length} days. Average ${list(dailyAverage)} credits a day.`}
            onPointerLeave={() => setHoveredDay(null)}
          >
            {usage.map((entry, index) => (
              <span
                className={styles.barHit}
                key={entry.date}
                onPointerEnter={() => setHoveredDay(index)}
                data-today={index === usage.length - 1 || undefined}
                data-active={hoveredDay === index || undefined}
                data-dim={(hoveredDay !== null && hoveredDay !== index) || undefined}
              >
                <span className={styles.bar} style={{ height: `${Math.max(6, (entry.credits / peak) * 100)}%` }} />
              </span>
            ))}
          </div>
          <div className={styles.caption} aria-hidden="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={day ? day.date : "all"} {...swap}>
                {day ? (
                  <>
                    {hoveredDay === usage.length - 1
                      ? "Today"
                      : new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    {": "}
                    <span className={styles.num}>{list(day.credits)}</span>
                  </>
                ) : (
                  `Last ${usage.length} days`
                )}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className={[styles.section, styles.buySection].join(" ")}>
        <div className={styles.titleRow}>
          <span className={styles.title} id={`${uid}-packs`}>
            Add credits
          </span>
          <span className={styles.muted}>{perThousand} per 1,000</span>
        </div>
        <LayoutGroup id={`${uid}-pack`}>
          <div className={styles.packs} role="radiogroup" aria-labelledby={`${uid}-packs`}>
            {packs.map((size, index) => {
              const priced = quoteCredits(size, pricing);
              const percent = priced.bonus ? Math.round((priced.bonus / size) * 100) : 0;
              const active = index === selectedPack;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${list(size)} credits, ${currency(priced.price, pricing.currency)}${percent ? `, ${percent}% bonus` : ""}`}
                  tabIndex={active || (selectedPack < 0 && index === 0) ? 0 : -1}
                  className={styles.pack}
                  key={size}
                  data-selected={active || undefined}
                  onClick={() => choose(size)}
                  onKeyDown={(event) => rove(event, index, packs.length, (next) => choose(packs[next]))}
                >
                  <AnimatePresence initial={false}>
                    {active ? (
                      <motion.span
                        layoutId="ring"
                        className={styles.ring}
                        key="ring"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reduced ? { duration: 0 } : { ...glide, opacity: { duration: motionTokens.duration.fast } }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span className={styles.packAmount}>{list(size)}</span>
                  <span className={styles.packFoot}>
                    <span className={styles.muted}>{currency(priced.price, pricing.currency, priced.price % 1 !== 0)}</span>
                    {percent ? <span className={styles.bonus}>+{percent}%</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
        <Slider
          label="Custom amount"
          value={credits}
          onValueChange={(next) => choose(next)}
          min={range.min}
          max={range.max}
          step={range.step}
          format={(value) => `${list(value)} credits`}
          showValue
          className={styles.slider}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.title} id={`${uid}-auto`}>
              Auto top-up
            </span>
            <span className={styles.meta}>Refills with your selected amount</span>
          </div>
          <Switch checked={auto.enabled} onCheckedChange={(checked) => configure({ ...auto, enabled: checked })} aria-labelledby={`${uid}-auto`} />
        </div>
        <div className={styles.row} data-off={!auto.enabled || undefined}>
          <span className={styles.muted} id={`${uid}-threshold`}>
            Refill when below
          </span>
          <LayoutGroup id={`${uid}-threshold`}>
            <div className={styles.thresholds} role="radiogroup" aria-labelledby={`${uid}-threshold`} aria-disabled={!auto.enabled || undefined}>
              {thresholds.map((value, index) => {
                const active = index === selectedThreshold;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!auto.enabled}
                    tabIndex={active || (selectedThreshold < 0 && index === 0) ? 0 : -1}
                    className={styles.chip}
                    key={value}
                    data-selected={active || undefined}
                    onClick={() => configure({ ...auto, threshold: value })}
                    onKeyDown={(event) => rove(event, index, thresholds.length, (next) => configure({ ...auto, threshold: thresholds[next] }))}
                  >
                    {active ? <motion.span layoutId="pill" className={styles.pill} transition={reduced ? { duration: 0 } : glide} /> : null}
                    <span className={styles.chipLabel}>{list(value)}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </div>

      {method ? (
        <div className={styles.section}>
          <div className={styles.row}>
            <div className={styles.methodSlot}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div className={styles.method} key={method.id} {...swap}>
                  <BrandMark brand={method.brand} className={styles.chipMark} />
                  <div className={styles.rowText}>
                    <span className={styles.body}>
                      {BRAND_LABEL[method.brand]} ending {method.last4}
                    </span>
                    <span className={styles.meta}>Expires {method.expires}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            {paymentMethods.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                className={styles.change}
                aria-disabled={busy || undefined}
                aria-label={`Change card, ${paymentMethods.length} saved`}
                onClick={() => {
                  if (busy || paymentMethods.length < 2) return;
                  const next = (cardIndex + 1) % paymentMethods.length;
                  setCardIndex(next);
                  onPaymentMethodChange?.(paymentMethods[next].id);
                  if (status === "error") {
                    setStatus("idle");
                    setNotice(null);
                  }
                }}
              >
                Change
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.foot}>
        <div className={styles.total}>
          <div className={styles.rowText}>
            <span className={styles.title}>
              <RollingNumber value={quote.total} format={list} /> credits
            </span>
            <span className={styles.metaSlot}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  className={styles.meta}
                  key={quote.bonus ? "bonus" : `none-${pricing.bonusTiers[0]?.min ?? 0}`}
                  {...swap}
                >
                  {quote.bonus ? (
                    <>
                      Includes <RollingNumber value={quote.bonus} format={list} /> bonus
                    </>
                  ) : pricing.bonusTiers.length ? (
                    `Bonus starts at ${list(Math.min(...pricing.bonusTiers.map((tier) => tier.min)))}`
                  ) : (
                    "No bonus"
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
          <span className={styles.price}>
            {glyph}
            <RollingNumber
              value={quote.price}
              format={(value) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
          </span>
        </div>
        <Button className={styles.buy} loading={busy} onClick={purchase} disabled={!method}>
          {busy ? (
            "Processing"
          ) : status === "done" ? (
            <>
              <Check aria-hidden="true" /> Credits added
            </>
          ) : status === "error" ? (
            "Try again"
          ) : (
            "Buy credits"
          )}
        </Button>
        <div className={styles.status} role="status" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span className={styles.statusInner} key={view.key} data-tone={notice?.tone} {...swap}>
              <span className={styles.statusIcon} aria-hidden="true">
                {view.icon}
              </span>
              <span className={styles.statusText}>{view.text}</span>
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export default CreditTopup;
