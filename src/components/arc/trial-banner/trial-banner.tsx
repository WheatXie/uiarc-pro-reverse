"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { AlarmClock, Check, Lock, TriangleAlert, Users, X } from "lucide-react";
import Button from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./trial-banner.module.css";

export type TrialBannerVariant = "banner" | "card" | "pill";
export type TrialTone = "active" | "warning" | "expired" | "upgraded";

export interface TrialFeature {
  id: string;
  label: string;
  /** Short right-aligned detail, such as "4 channels". */
  detail?: string;
  /** A 14px mark shown before the label. Inline SVG keeps the card self-contained. */
  icon?: ReactNode;
}

export interface TrialSnoozeOption {
  id: string;
  label: string;
  /** Days from the trial's end date the snooze runs for. */
  days: number;
}

export interface TrialSnooze extends TrialSnoozeOption {
  until: Date;
}

export interface TrialBannerProps {
  /** banner: a slim row for the top of an app. card: a sidebar card with the feature list. pill: a compact header pill that opens the card in a popover. */
  variant?: TrialBannerVariant;
  /** The plan being trialed, used in every line of copy. */
  plan?: string;
  /** Whole days left. 0 or less shows the expired state. */
  daysLeft?: number;
  /** Trial length in days. The ring shows daysLeft / trialDays. */
  trialDays?: number;
  /** When the trial ends, for the date copy. Defaults to October 27, 2026 plus daysLeft, a sample date. */
  endsAt?: Date | number | string;
  /** The last N days switch to the warning tone, with copy that names the end day. */
  warnAt?: number;
  /** The workspace name, used in the expired card copy. */
  workspace?: string;
  /** What the customer loses without paying, listed in the card. */
  features?: TrialFeature[];
  /** One short phrase for the banner copy. */
  lossSummary?: string;
  /** Opens checkout or the billing portal. Resolve to show the upgraded state; throw to show the error state. */
  onAddPayment?: (signal: AbortSignal) => Promise<void> | void;
  /** Opens your plans page. Without it the banner shows a short simulated note. */
  onComparePlans?: () => void;
  /** The secondary action in the upgraded state. */
  onManageBilling?: () => void;
  /** Called when the person dismisses the banner. Persist it. */
  onDismiss?: () => void;
  /** Called with the chosen snooze. Persist `until` and stop rendering until then. */
  onSnooze?: (snooze: TrialSnooze) => void;
  /** After dismiss or snooze: collapse to the trial pill, which reopens the banner, or render nothing. */
  collapseTo?: "pill" | "none";
  /** Shows the dismiss button. */
  dismissible?: boolean;
  /** Shows the snooze menu. */
  snoozable?: boolean;
  /** Class on the root. */
  className?: string;
}

/** The sample end date the docs quote (Oct 27, 2026, UTC); every default date is measured from it. */
const SAMPLE_TRIAL_END = Date.UTC(2026, 9, 27);
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const RING_SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const DAY = 86_400_000;

const endFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

const days = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"}`;
const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");

/** Inline brand marks: they ship as SVG so the card never loads an image. */
const OktaMark = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#007DC1" d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" />
  </svg>
);

const SlackMark = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
    <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
    <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
    <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

const LinearMark = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#5E6AD2" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
  </svg>
);

const DEFAULT_FEATURES: TrialFeature[] = [
  { id: "sso", label: "Single sign-on with Okta", icon: <OktaMark /> },
  { id: "slack", label: "Slack alerts", detail: "4 channels", icon: <SlackMark /> },
  { id: "linear", label: "Linear issue sync", detail: "148 issues", icon: <LinearMark /> },
  { id: "seats", label: "Team seats", detail: "12 in use", icon: <Users size={14} strokeWidth={1.8} /> },
];

type BillingState = "idle" | "adding" | "added" | "error";

/** The ring arc: a 0–1 progress stroke that springs to its new length. */
function Ring({ size, stroke, progress, tone, reduced, children }: {
  size: number;
  stroke: number;
  progress: number;
  tone: TrialTone;
  reduced: boolean;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const center = size / 2;
  return (
    <span className={styles.ring} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.ringSvg}>
        <circle className={styles.ringTrack} cx={center} cy={center} r={radius} strokeWidth={stroke} fill="none" />
        <motion.circle
          className={styles.ringValue}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          pathLength={1}
          strokeDasharray="1 1"
          strokeLinecap="round"
          initial={false}
          animate={{ strokeDashoffset: 1 - progress, opacity: progress > 0 ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { strokeDashoffset: RING_SPRING, opacity: { duration: 0.16, ease: EASE } }}
        />
      </svg>
      {children}
    </span>
  );
}

/** One text slot: the old value fades out while the new one rises 2px, both in the same grid cell. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? false : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: EASE } }}
          exit={{ opacity: 0, y: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The pill label measures its own text and springs the slot to that width, so a shorter or longer state never snaps. */
function PillLabel({ text, reduced }: { text: string; reduced: boolean }) {
  const measure = useRef<HTMLSpanElement>(null);
  const last = useRef<string | null>(null);
  const [box, setBox] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false });

  useLayoutEffect(() => {
    const node = measure.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = node.textContent;
      const changed = last.current !== null && last.current !== next;
      last.current = next;
      setBox({ width: Math.ceil(node.getBoundingClientRect().width), animate: changed });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.span className={styles.pillLabel} initial={false} animate={{ width: box.width }} transition={box.animate && !reduced ? RING_SPRING : { duration: 0 }}>
      <span ref={measure} className={styles.pillMeasure} aria-hidden="true">{text}</span>
      <Swap id={text} reduced={reduced}><span className={styles.truncate}>{text}</span></Swap>
    </motion.span>
  );
}

function SnoozeMenu({ options, onSelect }: { options: TrialSnoozeOption[]; onSelect: (option: TrialSnoozeOption) => void }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.iconButton} aria-label="Snooze">
        <AlarmClock size={16} strokeWidth={1.8} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12} loop>
          {options.map(option => (
            <DropdownMenu.Item key={option.id} className={styles.menuItem} onSelect={() => onSelect(option)}>
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function TrialBanner({
  variant = "banner",
  plan = "Pro",
  daysLeft = 9,
  trialDays = 14,
  endsAt,
  warnAt = 3,
  workspace = "Northwind",
  features = DEFAULT_FEATURES,
  lossSummary = "Okta SSO and 12 seats",
  onAddPayment,
  onComparePlans,
  onManageBilling,
  onDismiss,
  onSnooze,
  collapseTo = "pill",
  dismissible = true,
  snoozable = true,
  className,
}: TrialBannerProps) {
  const reduced = !!useReducedMotion();
  const [billing, setBilling] = useState<BillingState>("idle");
  const [collapsed, setCollapsed] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const controller = useRef<AbortController | null>(null);
  const noteTimer = useRef(0);
  const pillButton = useRef<HTMLButtonElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<"pill" | "primary" | null>(null);

  useEffect(() => () => {
    controller.current?.abort();
    window.clearTimeout(noteTimer.current);
  }, []);

  const left = Math.max(0, Math.ceil(daysLeft));
  const end = new Date(endsAt !== undefined ? endsAt : SAMPLE_TRIAL_END + DAY * left);
  const tone: TrialTone = billing === "added" ? "upgraded" : left <= 0 ? "expired" : left <= warnAt ? "warning" : "active";
  const progress = tone === "upgraded" ? 1 : tone === "expired" ? 0 : Math.min(1, left / Math.max(1, trialDays));
  const endLabel = endFormat.format(end);
  const shortLabel = shortFormat.format(end);
  const weekday = weekdayFormat.format(end);

  const copy = {
    active: {
      title: `${days(left, "day")} left in your ${plan} trial`,
      sub: `Keep ${lossSummary} after ${shortLabel}.`,
      meta: `Trial ends ${endLabel}`,
      list: "Add a card to keep",
      pill: `${days(left, "day")} left`,
    },
    warning: {
      title: left === 1 ? `Your ${plan} trial ends tomorrow` : `Your ${plan} trial ends in ${days(left, "day")}`,
      sub: `On ${weekday} you lose ${lossSummary}.`,
      meta: `Ends ${endLabel}`,
      list: `You lose these on ${weekday}`,
      pill: `${days(left, "day")} left`,
    },
    expired: {
      title: `Your ${plan} trial has ended`,
      sub: `${lossSummary.charAt(0).toUpperCase()}${lossSummary.slice(1)} are paused on Free.`,
      meta: `Ended ${endLabel}`,
      list: `Paused while ${workspace} is on Free`,
      pill: "Trial ended",
    },
    upgraded: {
      title: `You're all set on ${plan}`,
      sub: `Payment method added. Billing starts ${shortLabel}.`,
      meta: `Billing starts ${endLabel}`,
      list: `Staying on ${plan}`,
      pill: `${plan} active`,
    },
  }[tone];

  const error = billing === "error" ? "Billing didn't open. Check your connection and try again." : null;
  const subline = note ?? error ?? copy.sub;
  const primaryLabel = tone === "upgraded" ? "Done" : billing === "error" ? "Try again" : tone === "expired" ? `Upgrade to ${plan}` : "Add payment method";
  const secondaryLabel = tone === "upgraded" ? "Manage billing" : "Compare plans";

  const snoozeOptions: TrialSnoozeOption[] = [{ id: "tomorrow", label: "Remind me tomorrow", days: 1 }];
  if (tone === "active" && left > 3) snoozeOptions.push({ id: "3-days", label: "Remind me in 3 days", days: 3 });
  if (tone === "active" && left > warnAt + 1) snoozeOptions.push({ id: "warning", label: `Remind me when ${days(warnAt, "day")} are left`, days: left - warnAt });

  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    (target === "pill" ? pillButton : primaryButton).current?.focus();
  });

  const flash = useCallback((message: string) => {
    window.clearTimeout(noteTimer.current);
    setNote(message);
    noteTimer.current = window.setTimeout(() => setNote(null), 2200);
  }, []);

  /** Dismiss and snooze share one exit: close the menu, announce, and fold into the pill. */
  const fold = (message: string) => {
    setPopoverOpen(false);
    setNote(null);
    setAnnouncement(message);
    if (variant !== "pill") {
      setCollapsed(true);
      focusTarget.current = collapseTo === "pill" ? "pill" : null;
    }
  };

  const dismiss = () => {
    onDismiss?.();
    fold(onDismiss ? "Trial banner hidden." : "Trial banner hidden. Simulated, nothing was saved.");
  };

  const snooze = (option: TrialSnoozeOption) => {
    const until = new Date(SAMPLE_TRIAL_END + DAY * option.days);
    onSnooze?.({ ...option, until });
    fold(`Snoozed until ${endFormat.format(until)}.${onSnooze ? "" : " Simulated, nothing was saved."}`);
  };

  const addPayment = async () => {
    if (billing === "adding") return;
    if (tone === "upgraded") { dismiss(); return; }
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setNote(null);
    setBilling("adding");
    setAnnouncement(onAddPayment ? "Opening billing." : "Opening billing. Simulated, no card is charged.");
    try {
      if (onAddPayment) await onAddPayment(next.signal);
      else {
        const signal = next.signal;
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 900);
          signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(signal.reason); }, { once: true });
        });
      }
      if (next.signal.aborted) return;
      setBilling("added");
      setAnnouncement(onAddPayment ? `Payment method added. You stay on ${plan}.` : `Payment method added. You stay on ${plan}. Simulated, no card was charged.`);
    } catch {
      if (next.signal.aborted) return;
      setBilling("error");
      setAnnouncement("Billing didn't open. Try again.");
    }
  };

  const secondary = () => {
    if (tone === "upgraded") {
      if (onManageBilling) onManageBilling();
      else flash("Simulated: this opens your billing settings.");
      return;
    }
    if (onComparePlans) onComparePlans();
    else flash("Simulated: this opens your plans page.");
  };

  const ring = (size: number, stroke: number, withDays: boolean) => (
    <Ring size={size} stroke={stroke} progress={progress} tone={tone} reduced={reduced}>
      {withDays && (
        <Swap
          id={tone === "upgraded" ? "check" : tone === "expired" ? "lock" : String(left)}
          reduced={reduced}
          className={styles.ringCenter}
        >
          {tone === "upgraded" ? <Check size={14} strokeWidth={2} />
            : tone === "expired" ? <Lock size={14} strokeWidth={1.8} />
              : <span className={styles.ringDays}>{left}</span>}
        </Swap>
      )}
    </Ring>
  );

  const icons = (
    <span className={styles.icons}>
      {snoozable && <SnoozeMenu options={snoozeOptions} onSelect={snooze} />}
      {dismissible && (
        <button type="button" className={styles.iconButton} aria-label="Dismiss" onClick={dismiss}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </span>
  );

  const sublineSlot = (slot: string) => (
    <Swap id={subline} reduced={reduced} className={slot}>
      <span className={styles.subInner}>
        {error && !note && <TriangleAlert className={styles.errorIcon} size={14} strokeWidth={1.8} aria-hidden="true" />}
        <span className={styles.subText}>{subline}</span>
      </span>
    </Swap>
  );

  const secondaryButton = (size: "sm" | "md") => (
    <Button variant="ghost" size={size} onClick={secondary}>{secondaryLabel}</Button>
  );

  const primary = (size: "sm" | "md") => (
    <Button ref={primaryButton} variant="primary" size={size} loading={billing === "adding"} onClick={addPayment}>{primaryLabel}</Button>
  );

  const card = (floating: boolean) => (
    <div className={cx(styles.card, floating && styles.cardFloating)} data-tone={tone}>
      <div className={styles.cardHead}>
        {ring(40, 3, true)}
        {!floating && icons}
        {floating && (
          <span className={styles.icons}>
            {snoozable && <SnoozeMenu options={snoozeOptions} onSelect={snooze} />}
            <Popover.Close className={styles.iconButton} aria-label="Close">
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </Popover.Close>
          </span>
        )}
      </div>
      <Swap id={copy.title} reduced={reduced} className={styles.cardTitle}>
        <span className={styles.truncate}>{copy.title}</span>
      </Swap>
      {note || error ? sublineSlot(styles.cardMeta) : (
        <Swap id={copy.meta} reduced={reduced} className={styles.cardMeta}>
          <span className={styles.truncate}>{copy.meta}</span>
        </Swap>
      )}
      <div className={styles.list}>
        <Swap id={copy.list} reduced={reduced} className={styles.listLabel}>
          <span className={styles.truncate}>{copy.list}</span>
        </Swap>
        <ul className={styles.rows}>
          {features.map(feature => (
            <li key={feature.id} className={styles.row}>
              <span className={styles.rowIcon} aria-hidden="true">{feature.icon}</span>
              <span className={styles.rowLabel}>{feature.label}</span>
              {feature.detail && <span className={styles.rowDetail}>{feature.detail}</span>}
              <Swap id={tone} reduced={reduced} className={styles.rowState}>
                {tone === "expired" ? <Lock size={14} strokeWidth={1.8} aria-label="Paused" />
                  : tone === "upgraded" ? <Check size={14} strokeWidth={2} aria-label="Kept" />
                    : <span />}
              </Swap>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.cardActions}>
        {primary("md")}
        {secondaryButton("md")}
      </div>
    </div>
  );

  const pill = (props: { onClick?: () => void } = {}) => (
    <button
      ref={pillButton}
      type="button"
      className={styles.pill}
      data-tone={tone}
      {...props}
      aria-label={`${plan} trial: ${copy.pill}${collapsed ? ". Show details" : ""}`}
    >
      <Swap id={tone === "expired" ? "lock" : tone === "upgraded" ? "check" : "ring"} reduced={reduced} className={styles.pillLead}>
        {tone === "expired" ? <Lock size={14} strokeWidth={1.8} />
          : tone === "upgraded" ? <Check size={14} strokeWidth={2} />
            : <Ring size={16} stroke={2} progress={progress} tone={tone} reduced={reduced} />}
      </Swap>
      <PillLabel text={copy.pill} reduced={reduced} />
    </button>
  );

  let key = "";
  let body: ReactNode;
  if (variant === "pill") {
    key = "pill";
    body = (
      <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Trigger asChild>{pill()}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.popover} side="bottom" align="start" sideOffset={8} collisionPadding={12} aria-label={`${plan} trial`}>
            {card(true)}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  } else if (collapsed) {
    key = "collapsed";
    body = collapseTo === "pill"
      ? pill({ onClick: () => { setCollapsed(false); setAnnouncement(""); focusTarget.current = "primary"; } })
      : null;
  } else {
    key = variant;
    body = variant === "card"
      ? <section aria-label={`${plan} trial`}>{card(false)}</section>
      : (
        <section className={styles.banner} data-tone={tone} aria-label={`${plan} trial`}>
          <span className={styles.bannerRing}>{ring(28, 2.5, true)}</span>
          <div className={styles.bannerText}>
            <Swap id={copy.title} reduced={reduced} className={styles.bannerTitle}>
              <span className={styles.truncate}>{copy.title}</span>
            </Swap>
            {sublineSlot(styles.bannerSub)}
          </div>
          <div className={styles.bannerActions}>
            {secondaryButton("sm")}
            {primary("sm")}
          </div>
          {icons}
        </section>
      );
  }

  return (
    <div className={cx(styles.root, variant === "pill" ? styles.isPill : variant === "card" ? styles.isCard : styles.isBanner, className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          className={styles.view}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16 * (reduced ? 0 : 1), ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * (reduced ? 0 : 1), ease: EASE } }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}

export default TrialBanner;
