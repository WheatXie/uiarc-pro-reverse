"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useIsPresent, useReducedMotion, type MotionProps } from "motion/react";
import { Check, CircleAlert, Clock3, Download, TriangleAlert } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import { Badge, type BadgeTone } from "../badge/badge";
import { Button } from "../button/button";
import { Input } from "../input/input";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./billing-overview.module.css";

/* ------------------------------------------------------------------ types */

type PlanId = "starter" | "growth" | "scale";
type BillingTerm = "monthly" | "yearly";
type InvoiceStatus = "paid" | "due" | "failed";
type CardMode = "summary" | "edit";
type DownloadState = "preparing" | "done";

interface Plan {
  name: string;
  rank: number;
  monthly: number;
  yearly: number;
  seats: number;
  calls: number;
  storage: number;
}

interface Subscription {
  plan: PlanId;
  billing: BillingTerm;
  renews: string;
  periodEnd: string;
  daysLeft: number;
  periodDays: number;
}

interface Invoice {
  id: string;
  date: string;
  title: string;
  detail: string;
  amount: number;
  status: InvoiceStatus;
}

interface CardForm {
  number: string;
  expiry: string;
  cvc: string;
}

type CardErrors = Partial<Record<keyof CardForm, string>>;

export interface BillingOverviewProps {
  /**
   * Set by the frame when the block is embedded in a host card: the visible header is dropped and
   * "Billing" is kept as visually hidden text so the section keeps its accessible name.
   */
  embedded?: boolean;
}

/* ------------------------------------------------------------------- data */

const PLANS: Record<PlanId, Plan> = {
  starter: { name: "Starter", rank: 0, monthly: 49, yearly: 39, seats: 5, calls: 250_000, storage: 25 },
  growth: { name: "Growth", rank: 1, monthly: 199, yearly: 159, seats: 15, calls: 1_000_000, storage: 100 },
  scale: { name: "Scale", rank: 2, monthly: 499, yearly: 399, seats: 50, calls: 5_000_000, storage: 500 },
};

const PLAN_ORDER: PlanId[] = ["starter", "growth", "scale"];

const INITIAL_SUBSCRIPTION: Subscription = {
  plan: "growth",
  billing: "monthly",
  renews: "Oct 14, 2026",
  periodEnd: "Oct 13",
  daysLeft: 22,
  periodDays: 30,
};

/** The term a plan switch starts: a new period from today, so its length replaces the days left. */
const TERMS: Record<BillingTerm, { renews: string; periodEnd: string; days: number }> = {
  monthly: { renews: "Oct 22, 2026", periodEnd: "Oct 21", days: 30 },
  yearly: { renews: "Sep 22, 2027", periodEnd: "Sep 21, 2027", days: 365 },
};

const INITIAL_INVOICES: Invoice[] = [
  { id: "sep-renewal", date: "Sep 14, 2026", title: "Growth plan", detail: "Sep 14 – Oct 13", amount: 199, status: "paid" },
  { id: "sep-retention", date: "Sep 3, 2026", title: "Log retention add-on", detail: "Card declined by the bank", amount: 36, status: "failed" },
  { id: "aug-workshop", date: "Aug 28, 2026", title: "Onboarding workshop", detail: "Bank transfer, due Sep 27", amount: 600, status: "due" },
  { id: "aug-renewal", date: "Aug 14, 2026", title: "Growth plan", detail: "Aug 14 – Sep 13", amount: 199, status: "paid" },
];

const STATUS: Record<InvoiceStatus, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  paid: { label: "Paid", tone: "success", icon: <Check size={12} strokeWidth={2} aria-hidden="true" /> },
  due: { label: "Due", tone: "warning", icon: <Clock3 size={12} strokeWidth={2} aria-hidden="true" /> },
  failed: { label: "Failed", tone: "danger", icon: <CircleAlert size={12} strokeWidth={2} aria-hidden="true" /> },
};

const EMPTY_CARD: CardForm = { number: "", expiry: "", cvc: "" };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const moneyWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

/** What a plan costs over its term: yearly billing is charged once for twelve months. */
const planTotal = (plan: PlanId, billing: BillingTerm) => (billing === "monthly" ? PLANS[plan].monthly : 12 * PLANS[plan].yearly);

/** The allowance line under a plan name, in the same shorthand the picker rows use. */
function planFacts(plan: PlanId) {
  const { seats, calls, storage } = PLANS[plan];
  return `${seats} seats · ${calls >= 1_000_000 ? `${calls / 1_000_000}M` : `${calls / 1_000}k`} API calls · ${storage} GB`;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** motionTokens easings are readonly tuples; motion's curve type wants a mutable four-number tuple. */
type Bezier = [number, number, number, number];

/* --------------------------------------------------------------- primitives */

/**
 * One line of copy. It rises in from below, and the copy it replaces lifts away — both driven by
 * AnimatePresence, so a leaving line is hidden from assistive tech while it is still on screen.
 */
function SwapPhase({ children, className, reduced }: { children: ReactNode; className?: string; reduced: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={className}
      aria-hidden={present ? undefined : true}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.35em" }}
      animate={{ opacity: 1, y: "0em" }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
      transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
    >
      {children}
    </motion.span>
  );
}

/** Copy that changes in place: the new line rises while the old one lifts out of the same slot. */
function SwapText({ children, className, anchor = "left" }: { children: string; className?: string; anchor?: "left" | "right" }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false} anchorX={anchor}>
        <SwapPhase key={children} className={styles.swapText} reduced={reduced}>
          {children}
        </SwapPhase>
      </AnimatePresence>
    </span>
  );
}

/** Card digits turn column by column, each column a beat after the one before it. */
function CardDigits({ value }: { value: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <span className={styles.digits}>
      {value.split("").map((character, index) => (
        <span className={styles.digit} key={index}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={character}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.7em" }}
              animate={{ opacity: 1, y: "0em" }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.7em", transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard], delay: 0.04 * index } }}
              transition={reduced ? { duration: 0 } : { default: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: 0.04 * index }, y: { ...motionTokens.spring.snappy, delay: 0.04 * index } }}
            >
              {character}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/** A region that springs to the measured height of whatever it currently holds (summary or picker). */
function HeightRegion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div className={styles.region} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
      <div ref={innerRef} className={styles.regionInner}>
        {children}
      </div>
    </motion.div>
  );
}

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  decimals?: number;
  unit?: string;
  limitValue: number;
  limitSuffix?: string;
  left: string;
  valueText: string;
  index: number;
  /** The panel has been seen: the bar fills once, in a stagger by index. */
  revealed: boolean;
}

/**
 * One allowance: the counted figure, what it is counted against, the bar and the sentence a screen
 * reader gets instead of the bar.
 */
function UsageMeter({ label, used, limit, decimals = 0, unit, limitValue, limitSuffix, left, valueText, index, revealed }: UsageMeterProps) {
  const labelId = useId();
  const reduced = useReducedMotion() ?? false;
  const ratio = used / limit;
  const near = ratio >= 0.85;

  return (
    <div className={styles.meter} data-near={near || undefined}>
      <div className={styles.meterHead}>
        <span id={`${labelId}-label`}>{label}</span>
        <AnimatePresence initial={false}>
          {near && (
            <motion.span
              key="near"
              className={styles.nearBadge}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.9, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}
              transition={reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
            >
              <Badge tone="warning" size="sm" icon={<TriangleAlert size={12} strokeWidth={2} aria-hidden="true" />}>
                Near limit
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <p className={styles.meterValue}>
        <span className={styles.num}>
          <AnimatedCounter value={used} decimals={decimals} animateOnView />
        </span>
        {unit && <span className={styles.meterUnit}>{unit}</span>}
        <span className={styles.meterOf}>
          of <span className={styles.num}>
            <AnimatedCounter value={limitValue} suffix={limitSuffix} />
          </span>
        </span>
      </p>
      <div
        className={styles.track}
        role="meter"
        aria-labelledby={`${labelId}-label`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={valueText}
      >
        <motion.span
          className={styles.fill}
          initial={{ width: "0%" }}
          animate={{ width: revealed ? `${Math.min(100, 100 * ratio)}%` : "0%" }}
          transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: 0.06 * index }}
        />
      </div>
      <SwapText className={styles.meterCaption}>{`${Math.round(100 * ratio)}% used · ${left} left`}</SwapText>
    </div>
  );
}

/* -------------------------------------------------------------- the block */

/**
 * A billing settings page: a plan card that morphs into a plan picker with a monthly or yearly switch
 * and a prorated quote, usage meters that fill when seen, a payment card that edits in place and turns
 * its digits when replaced, and an invoice list with download and pay now. Plan, usage, card, and
 * invoices are simulated, so every charge in the quote is a preview.
 */
export function BillingOverview({ embedded = false }: BillingOverviewProps) {
  const id = useId();
  const reduced = useReducedMotion() ?? false;

  const [subscription, setSubscription] = useState<Subscription>(INITIAL_SUBSCRIPTION);
  const [view, setView] = useState<"summary" | "picker">("summary");
  const [draft, setDraft] = useState<{ plan: PlanId; billing: BillingTerm }>({ plan: "scale", billing: "monthly" });
  const [committing, setCommitting] = useState(false);
  const [planNotice, setPlanNotice] = useState("");
  const [card, setCard] = useState({ last4: "7719", expiry: "04/28" });
  const [cardMode, setCardMode] = useState<CardMode>("summary");
  const [form, setForm] = useState<CardForm>(EMPTY_CARD);
  const [errors, setErrors] = useState<CardErrors>({});
  const [saving, setSaving] = useState(false);
  const [cardNotice, setCardNotice] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [downloads, setDownloads] = useState<Record<string, DownloadState | undefined>>({});
  const [paying, setPaying] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const usageRef = useRef<HTMLElement>(null);
  const usageSeen = useInView(usageRef, { once: true, amount: 0.3 });
  const upgradeRef = useRef<HTMLButtonElement>(null);
  const updateRef = useRef<HTMLButtonElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const planButtonRefs = useRef(new Map<PlanId, HTMLButtonElement>());
  const invoiceDownloadRefs = useRef(new Map<string, HTMLButtonElement>());
  /** A node to focus once the render that closes a panel has committed. */
  const focusAfterRender = useRef<(() => HTMLElement | null) | null>(null);
  const timeouts = useRef(new Set<number>());
  const invoiceCount = useRef(0);

  useEffect(() => {
    const take = focusAfterRender.current;
    if (!take) return;
    focusAfterRender.current = null;
    take()?.focus();
  });

  useEffect(() => {
    const pending = timeouts.current;
    return () => pending.forEach((timeout) => window.clearTimeout(timeout));
  }, []);

  const after = (ms: number, run: () => void) => {
    const timeout = window.setTimeout(() => {
      timeouts.current.delete(timeout);
      run();
    }, ms);
    timeouts.current.add(timeout);
  };

  const currentPlan = PLANS[subscription.plan];
  const nextPlan = PLANS[draft.plan];
  const isTopPlan = currentPlan.rank === PLAN_ORDER.length - 1;

  const sameTerm = draft.billing === subscription.billing;
  const overTerm = (planTotal(subscription.plan, subscription.billing) * subscription.daysLeft) / subscription.periodDays;
  const quote = {
    amount: round2((sameTerm ? (planTotal(draft.plan, draft.billing) * subscription.daysLeft) / subscription.periodDays : planTotal(draft.plan, draft.billing)) - overTerm),
    credit: round2(overTerm),
    sameTerm,
    renews: sameTerm ? subscription.renews : TERMS[draft.billing].renews,
    unchanged: draft.plan === subscription.plan && sameTerm,
  };

  const direction: "billing" | "up" | "down" = draft.plan === subscription.plan ? "billing" : nextPlan.rank > currentPlan.rank ? "up" : "down";
  const ctaLabel = quote.unchanged ? "Current plan" : direction === "up" ? `Upgrade to ${nextPlan.name}` : direction === "down" ? `Move to ${nextPlan.name}` : `Switch to ${draft.billing}`;
  const quoteDetail = quote.unchanged ? "This is your current plan" : quote.sameTerm ? `Prorated for ${subscription.daysLeft} days` : `Renews ${quote.renews} · ${money.format(quote.credit)} credited`;

  function closePicker() {
    if (committing) return;
    setView("summary");
    focusAfterRender.current = () => upgradeRef.current;
  }

  function selectPlan(plan: PlanId) {
    if (committing || PLANS[plan].seats < 12) return;
    setDraft((value) => ({ ...value, plan }));
  }

  function closeCardEditor() {
    if (saving) return;
    setCardMode("summary");
    focusAfterRender.current = () => updateRef.current;
  }

  function updateField(field: keyof CardForm, value: string) {
    const digits = value.replace(/\D/g, "");
    const next =
      field === "number"
        ? digits.slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ")
        : field === "expiry"
          ? (() => {
              const short = digits.slice(0, 4);
              return short.length > 2 ? `${short.slice(0, 2)}/${short.slice(2)}` : short;
            })()
          : digits.slice(0, 4);
    setForm((current) => ({ ...current, [field]: next }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const reveal: MotionProps = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] as Bezier } },
    transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as Bezier, delay: 0.05 },
  };

  const meters: UsageMeterProps[] = [
    { index: 0, label: "Seats", used: 12, limit: currentPlan.seats, limitValue: currentPlan.seats, limitSuffix: "", left: `${currentPlan.seats - 12} seats`, valueText: `12 of ${currentPlan.seats} seats used`, revealed: usageSeen },
    { index: 1, label: "API calls", used: 912_480, limit: currentPlan.calls, limitValue: currentPlan.calls >= 1_000_000 ? currentPlan.calls / 1_000_000 : currentPlan.calls / 1_000, limitSuffix: currentPlan.calls >= 1_000_000 ? "M" : "k", left: `${count.format(currentPlan.calls - 912_480)} calls`, valueText: `${count.format(912_480)} of ${count.format(currentPlan.calls)} API calls used`, revealed: usageSeen },
    { index: 2, label: "Storage", used: 38.4, limit: currentPlan.storage, decimals: 1, unit: "GB", limitValue: currentPlan.storage, limitSuffix: " GB", left: `${(currentPlan.storage - 38.4).toFixed(1)} GB`, valueText: `38.4 of ${currentPlan.storage} GB used`, revealed: usageSeen },
  ];

  return (
    <section className={styles.billing} aria-labelledby={`${id}-title`}>
      {embedded ? (
        <h2 id={`${id}-title`} className={styles.srOnly}>
          Billing
        </h2>
      ) : (
        <header className={styles.header}>
          <h2 id={`${id}-title`}>Billing</h2>
          <p>Fieldnote Labs workspace</p>
        </header>
      )}

      <div className={styles.top}>
        <section className={styles.panel} aria-labelledby={`${id}-plan`}>
          <div className={styles.panelHead}>
            <h3 id={`${id}-plan`}>Current plan</h3>
            <SwapText className={styles.panelNote} anchor="right">
              {subscription.billing === "monthly" ? "Billed monthly" : `${moneyWhole.format(12 * currentPlan.yearly)} billed yearly`}
            </SwapText>
          </div>

          <div className={styles.planLine}>
            <TextMorph className={styles.planName}>{currentPlan.name}</TextMorph>
            <span className={styles.planPrice}>
              <span className={styles.num}>
                <AnimatedCounter value={subscription.billing === "monthly" ? currentPlan.monthly : currentPlan.yearly} prefix="$" />
              </span>
              <span className={styles.per}>/ month</span>
            </span>
          </div>

          <HeightRegion>
            <AnimatePresence mode="popLayout" initial={false}>
              {view === "summary" ? (
                <motion.div key="summary" className={styles.planSummary} {...reveal}>
                  <div className={styles.planFacts}>
                    <p>Renews {subscription.renews}</p>
                    <span>{planFacts(subscription.plan)}</span>
                  </div>
                  <Button
                    ref={upgradeRef}
                    type="button"
                    variant={isTopPlan ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => {
                      const next = PLAN_ORDER.find((plan) => PLANS[plan].rank > currentPlan.rank) ?? subscription.plan;
                      setDraft({ plan: next, billing: subscription.billing });
                      setPlanNotice("");
                      setView("picker");
                      focusAfterRender.current = () => planButtonRefs.current.get(next) ?? null;
                    }}
                  >
                    {isTopPlan ? "Change plan" : "Upgrade"}
                  </Button>
                  {planNotice && (
                    <p className={styles.notice}>
                      <Check size={14} strokeWidth={2} aria-hidden="true" />
                      {planNotice}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="picker"
                  className={styles.picker}
                  {...reveal}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closePicker();
                    }
                  }}
                >
                  <div className={styles.pickerHead}>
                    <div>
                      <h4 id={`${id}-picker`}>Change plan</h4>
                      <p>Yearly billing saves 20%</p>
                    </div>
                    <SegmentedControl
                      label="Billing period"
                      value={draft.billing}
                      onValueChange={(value) => {
                        if (committing) return;
                        setDraft((current) => ({ ...current, billing: value as BillingTerm }));
                      }}
                      options={[
                        { value: "monthly", label: "Monthly" },
                        { value: "yearly", label: "Yearly" },
                      ]}
                    />
                  </div>

                  <div
                    className={styles.options}
                    role="radiogroup"
                    aria-labelledby={`${id}-picker`}
                    onKeyDown={(event) => {
                      const available = PLAN_ORDER.filter((plan) => PLANS[plan].seats >= 12);
                      const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[event.key];
                      const target =
                        event.key === "Home"
                          ? available[0]
                          : event.key === "End"
                            ? available[available.length - 1]
                            : step
                              ? available[(available.indexOf(draft.plan) + step + available.length) % available.length]
                              : undefined;
                      if (!target) return;
                      event.preventDefault();
                      selectPlan(target);
                      planButtonRefs.current.get(target)?.focus();
                    }}
                  >
                    {PLAN_ORDER.map((planId) => {
                      const plan = PLANS[planId];
                      const selected = draft.plan === planId;
                      const unavailable = plan.seats < 12;
                      return (
                        <button
                          key={planId}
                          ref={(node) => {
                            if (node) planButtonRefs.current.set(planId, node);
                            else planButtonRefs.current.delete(planId);
                          }}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={unavailable}
                          tabIndex={selected ? 0 : -1}
                          className={styles.option}
                          onClick={() => selectPlan(planId)}
                        >
                          {selected && (
                            <motion.span layoutId="plan-highlight" className={styles.optionHighlight} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />
                          )}
                          <span className={styles.radio} aria-hidden="true" />
                          <span className={styles.optionName}>
                            {plan.name}
                            {planId === subscription.plan && <span className={styles.optionCurrent}>Current</span>}
                          </span>
                          <span className={styles.optionMeta}>{unavailable ? `12 seats in use, ${plan.name} allows ${plan.seats}` : planFacts(planId)}</span>
                          <span className={styles.optionAmount}>
                            <span className={styles.num}>
                              <AnimatedCounter value={draft.billing === "monthly" ? plan.monthly : plan.yearly} prefix="$" />
                            </span>
                            <span className={styles.per}>/mo</span>
                          </span>
                          <SwapText className={styles.optionBilled} anchor="right">
                            {draft.billing === "yearly" ? `${moneyWhole.format(12 * plan.yearly)} a year` : "Billed monthly"}
                          </SwapText>
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.quote}>
                    <div className={styles.quoteText} aria-live="polite">
                      <SwapText className={styles.quoteLabel}>{quote.amount < 0 ? "Credit to next invoice" : "Due today"}</SwapText>
                      <span className={styles.quoteAmount}>
                        <span className={styles.num}>
                          <AnimatedCounter value={Math.abs(quote.amount)} prefix="$" decimals={2} />
                        </span>
                      </span>
                      <SwapText className={styles.quoteDetail}>{quoteDetail}</SwapText>
                    </div>
                    <div className={styles.quoteActions}>
                      <Button type="button" variant="ghost" size="sm" onClick={closePicker} disabled={committing}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={quote.unchanged}
                        loading={committing}
                        onClick={() => {
                          if (quote.unchanged || committing) return;
                          const plan = PLANS[draft.plan];
                          const term = TERMS[draft.billing];
                          const next: Subscription = quote.sameTerm
                            ? { ...subscription, plan: draft.plan }
                            : { plan: draft.plan, billing: draft.billing, renews: term.renews, periodEnd: term.periodEnd, daysLeft: term.days, periodDays: term.days };
                          const verb = direction === "billing" ? `Switched to ${draft.billing} billing` : direction === "up" ? `Upgraded to ${plan.name}` : `Moved to ${plan.name}`;
                          const message =
                            quote.amount > 0
                              ? `${verb}. ${money.format(quote.amount)} charged to card ending ${card.last4}.`
                              : quote.amount < 0
                                ? `${verb}. ${money.format(-quote.amount)} credited to your next invoice.`
                                : `${verb}.`;
                          const invoice: Invoice | null =
                            quote.amount > 0
                              ? {
                                  id: `change-${++invoiceCount.current}`,
                                  date: "Sep 22, 2026",
                                  title: `${plan.name} plan`,
                                  detail: quote.sameTerm ? `Prorated, Sep 22 – ${subscription.periodEnd}` : `${draft.billing === "yearly" ? "Yearly" : "Monthly"}, Sep 22 – ${term.periodEnd}`,
                                  amount: quote.amount,
                                  status: "paid",
                                }
                              : null;
                          setCommitting(true);
                          after(900, () => {
                            setCommitting(false);
                            setSubscription(next);
                            setView("summary");
                            setPlanNotice(message);
                            setStatus(message);
                            if (invoice) setInvoices((list) => [invoice, ...list]);
                            focusAfterRender.current = () => upgradeRef.current;
                          });
                        }}
                      >
                        {ctaLabel}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </HeightRegion>
        </section>

        <section className={styles.panel} aria-labelledby={`${id}-payment`}>
          <div className={styles.panelHead}>
            <h3 id={`${id}-payment`}>Payment method</h3>
          </div>

          <div className={styles.cardRow}>
            <div className={styles.cardFace} aria-hidden="true">
              <span className={styles.cardTop}>
                <span className={styles.chip} />
                <span>Business</span>
              </span>
              <span className={styles.cardBottom}>
                <span className={styles.cardHolder}>Fieldnote Labs</span>
                <span className={styles.cardNumber}>
                  <span>••••</span>
                  <CardDigits value={card.last4} />
                </span>
                <span className={styles.cardExpiry}>
                  <CardDigits value={card.expiry} />
                </span>
              </span>
            </div>
            <div className={styles.cardDetails}>
              <SwapText className={styles.cardTitle}>{`Card ending ${card.last4}`}</SwapText>
              <SwapText className={styles.cardMeta}>{`Expires ${card.expiry}`}</SwapText>
              <Button
                ref={updateRef}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setForm(EMPTY_CARD);
                  setErrors({});
                  setCardNotice("");
                  setCardMode("edit");
                  focusAfterRender.current = () => numberRef.current;
                }}
                disabled={cardMode === "edit"}
              >
                Update
              </Button>
            </div>
          </div>

          <HeightRegion>
            <AnimatePresence mode="popLayout" initial={false}>
              {cardMode === "edit" ? (
                <motion.form
                  key="edit"
                  className={styles.cardForm}
                  noValidate
                  aria-label="New card"
                  {...reveal}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (saving) return;
                    const found: CardErrors = {};
                    if (form.number.replace(/\D/g, "").length !== 16) found.number = "Enter all 16 digits";
                    const [month, year] = form.expiry.split("/").map(Number);
                    if (!/^\d{2}\/\d{2}$/.test(form.expiry) || month < 1 || month > 12) found.expiry = "Use MM/YY, like 08/29";
                    else if (year < 26 || (year === 26 && month < 9)) found.expiry = "This card has expired";
                    if (!/^\d{3,4}$/.test(form.cvc)) found.cvc = "Enter 3 or 4 digits";
                    setErrors(found);
                    const first = found.number ? numberRef : found.expiry ? expiryRef : found.cvc ? cvcRef : null;
                    if (first) {
                      first.current?.focus();
                      return;
                    }
                    const next = { last4: form.number.replace(/\D/g, "").slice(-4), expiry: form.expiry };
                    setSaving(true);
                    after(900, () => {
                      const message = `Card ending ${next.last4} saved. Renewals and retries now use it.`;
                      setSaving(false);
                      setCard(next);
                      setCardMode("summary");
                      setCardNotice(message);
                      setStatus(message);
                      focusAfterRender.current = () => updateRef.current;
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closeCardEditor();
                    }
                  }}
                >
                  <Input
                    ref={numberRef}
                    label="Card number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 1234 1234 1234"
                    value={form.number}
                    error={errors.number}
                    onChange={(event) => updateField("number", event.target.value)}
                  />
                  <div className={styles.formRow}>
                    <Input
                      ref={expiryRef}
                      label="Expiry"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={form.expiry}
                      error={errors.expiry}
                      onChange={(event) => updateField("expiry", event.target.value)}
                    />
                    <Input
                      ref={cvcRef}
                      label="Security code"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={form.cvc}
                      error={errors.cvc}
                      onChange={(event) => updateField("cvc", event.target.value)}
                    />
                  </div>
                  <div className={styles.formFoot}>
                    <span />
                    <div className={styles.formActions}>
                      <Button type="button" variant="ghost" size="sm" onClick={closeCardEditor} disabled={saving}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" loading={saving}>
                        Save card
                      </Button>
                    </div>
                  </div>
                </motion.form>
              ) : cardNotice ? (
                <motion.p key={cardNotice} className={`${styles.notice} ${styles.cardNotice}`} {...reveal}>
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                  {cardNotice}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </HeightRegion>
        </section>
      </div>

      <section ref={usageRef} className={styles.panel} aria-labelledby={`${id}-usage`}>
        <div className={styles.panelHead}>
          <h3 id={`${id}-usage`}>Usage this period</h3>
          <span className={styles.panelNote}>Sep 14 – Oct 13</span>
        </div>
        <div className={styles.meters}>
          {meters.map(({ index, ...meter }) => (
            <UsageMeter key={meter.label} {...meter} index={index} />
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby={`${id}-invoices`}>
        <div className={styles.panelHead}>
          <h3 id={`${id}-invoices`}>Invoices</h3>
          <span className={styles.recipient}>
            <Avatar name="Emma Collins" src="/media/people/emma-collins.svg" size="sm" />
            Sent to Emma Collins
          </span>
        </div>

        <ul className={styles.invoices}>
          <AnimatePresence initial={false}>
            {invoices.map((invoice) => {
              const meta = STATUS[invoice.status];
              const download = downloads[invoice.id];
              return (
                <motion.li
                  key={invoice.id}
                  className={styles.invoice}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }}
                >
                  <div className={styles.invoiceRow}>
                    <span className={styles.invoiceText}>
                      <span className={styles.invoiceTitle}>{invoice.title}</span>
                      <SwapText className={styles.invoiceDetail}>{invoice.detail}</SwapText>
                    </span>
                    <span className={styles.invoiceAmount}>{money.format(invoice.amount)}</span>
                    <span className={styles.invoiceMeta}>
                      <span className={styles.invoiceDate}>{invoice.date}</span>
                      <span className={styles.invoiceStatus}>
                        <Badge tone={meta.tone} size="sm" icon={meta.icon}>
                          {meta.label}
                        </Badge>
                      </span>
                    </span>
                    <span className={styles.invoiceActions}>
                      <AnimatePresence mode="popLayout" initial={false}>
                        {invoice.status === "failed" && (
                          <motion.span
                            key="pay"
                            className={styles.payNow}
                            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.9, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}
                          >
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              loading={paying === invoice.id}
                              aria-label={`Pay ${money.format(invoice.amount)} for ${invoice.title}`}
                              onClick={() => {
                                if (paying) return;
                                const { last4 } = card;
                                setPaying(invoice.id);
                                after(1000, () => {
                                  setPaying(null);
                                  setInvoices((list) =>
                                    list.map((item) => (item.id === invoice.id ? { ...item, status: "paid", detail: `Paid Sep 22 with card ending ${last4}` } : item)),
                                  );
                                  setStatus(`${money.format(invoice.amount)} invoice from ${invoice.date} paid with card ending ${last4}.`);
                                  focusAfterRender.current = () => invoiceDownloadRefs.current.get(invoice.id) ?? null;
                                });
                              }}
                            >
                              Pay now
                            </Button>
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <Button
                        ref={(node) => {
                          if (node) invoiceDownloadRefs.current.set(invoice.id, node);
                          else invoiceDownloadRefs.current.delete(invoice.id);
                        }}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={styles.iconButton}
                        loading={download === "preparing"}
                        aria-label={download === "done" ? `Invoice from ${invoice.date} downloaded` : `Download invoice from ${invoice.date}`}
                        onClick={() => {
                          if (downloads[invoice.id]) return;
                          setDownloads((state) => ({ ...state, [invoice.id]: "preparing" }));
                          after(700, () => {
                            setDownloads((state) => ({ ...state, [invoice.id]: "done" }));
                            setStatus(`Invoice from ${invoice.date} downloaded.`);
                            after(2200, () =>
                              setDownloads((state) => {
                                const next = { ...state };
                                delete next[invoice.id];
                                return next;
                              }),
                            );
                          });
                        }}
                      >
                        {download === "done" ? (
                          <Check className={styles.done} size={16} strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                        )}
                      </Button>
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

export default BillingOverview;
