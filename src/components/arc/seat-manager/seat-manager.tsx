"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { CircleAlert, CircleCheck, CircleMinus, CirclePlus, Info, Mail, Minus, Plus, TriangleAlert } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./seat-manager.module.css";

const utcDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const asDate = (value: Date | number) => (value instanceof Date ? value : new Date(value));

/** The price of one seat on the plan being managed. */
export interface SeatPlan {
  name: string;
  pricePerSeat: number;
  interval?: "month" | "year";
  currency?: string;
  /** The hard ceiling on seats. Anything above it needs sales. */
  maxSeats?: number;
}

/** One billing period, so prorating can count the days that are left. */
export interface BillingPeriod {
  start: Date | number;
  end: Date | number;
}

export interface SeatPaymentMethod {
  brand: string;
  last4: string;
}

export interface SeatMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface SeatInvite {
  id: string;
  email: string;
  invitedBy?: string;
  note?: string;
}

/** What changing the seat count costs today and from the next renewal. */
export interface SeatQuote {
  current: number;
  target: number;
  delta: number;
  dueToday: number;
  nextTotal: number;
  daysLeft: number;
  periodDays: number;
  renewsOn: Date;
}

export interface SeatInquiry {
  quote: SeatQuote;
  plan: SeatPlan;
  period: BillingPeriod;
}

export interface SeatCheckInPayload {
  id: string;
  email: string;
  invitedBy?: string;
  note?: string;
}

export interface SeatManagerProps {
  workspace?: string;
  plan?: SeatPlan;
  /** Seats paid for right now. */
  purchased?: number;
  members?: SeatMember[];
  /** Skip counting the member list when the workspace already knows the number. */
  memberCount?: number;
  invites?: SeatInvite[];
  period?: BillingPeriod;
  /** Freeze the prorating clock. Defaults to today. */
  now?: Date | number;
  paymentMethod?: SeatPaymentMethod | null;
  receiptEmail?: string;
  /** Resolve to charge the card, reject to show a payment failure. */
  updateSeats?: (quote: SeatQuote, signal: AbortSignal) => Promise<void>;
  resendInvite?: (invite: SeatInvite, signal: AbortSignal) => Promise<void>;
  revokeInvite?: (invite: SeatInvite, signal: AbortSignal) => Promise<void>;
  undoSeconds?: number;
  onQuoteChange?: (quote: SeatQuote) => void;
  onSeatsChange?: (seats: number, quote: SeatQuote) => void;
  onPhaseChange?: (phase: SeatPhase) => void;
  /** Walk through the whole flow on its own. Defaults to on when no handler is wired. */
  autoPlay?: boolean;
  className?: string;
}

export type SeatPhase = "idle" | "confirm" | "saving" | "done" | "error";
type InviteState = "idle" | "sending" | "sent" | "revoked";
type SeatKind = "member" | "invited" | "open" | "adding" | "removing";

/** Prorates the added seats over the days that are left, and prices the next renewal from the target count. */
export function buildQuote(current: number, target: number, plan: SeatPlan, period: BillingPeriod, now: Date | number): SeatQuote {
  const start = asDate(period.start);
  const end = asDate(period.end);
  const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5));
  const daysLeft = Math.min(periodDays, Math.max(0, Math.ceil((end.getTime() - asDate(now).getTime()) / 864e5)));
  const delta = target - current;
  const dueToday = delta > 0 ? Math.round(delta * plan.pricePerSeat * (daysLeft / periodDays) * 100) / 100 : 0;
  return { current, target, delta, dueToday, nextTotal: Math.round(target * plan.pricePerSeat * 100) / 100, daysLeft, periodDays, renewsOn: end };
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

const DEFAULT_PLAN: SeatPlan = { name: "Pro", pricePerSeat: 16, interval: "month", currency: "USD", maxSeats: 25 };
const DEFAULT_PERIOD: BillingPeriod = { start: utcDate(2026, 10, 18), end: utcDate(2026, 11, 18) };
const FALLBACK_NOW = utcDate(2026, 10, 27);
const DEFAULT_PAYMENT: SeatPaymentMethod = { brand: "Visa", last4: "4242" };
const DEFAULT_MEMBERS: SeatMember[] = [
  { id: "emma-collins", name: "Emma Collins", avatar: "/media/people/emma-collins.svg" },
  { id: "nathan-cole", name: "Nathan Cole", avatar: "/media/people/nathan-cole.svg" },
  { id: "jasmine-brooks", name: "Jasmine Brooks", avatar: "/media/people/jasmine-brooks.svg" },
  { id: "daniel-kim", name: "Daniel Kim", avatar: "/media/people/daniel-kim.svg" },
  { id: "olivia-bennett", name: "Olivia Bennett", avatar: "/media/people/olivia-bennett.svg" },
  { id: "marcus-johnson", name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.svg" },
  { id: "chloe-nguyen", name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.svg" },
  { id: "sofia-ramirez", name: "Sofia Ramirez", avatar: "/media/people/sofia-ramirez.svg" },
  { id: "mateo-alvarez", name: "Mateo Alvarez", avatar: "/media/people/mateo-alvarez.svg" },
  { id: "hannah-walsh", name: "Hannah Walsh", avatar: "/media/people/hannah-walsh.svg" },
];
const DEFAULT_INVITES: SeatInvite[] = [
  { id: "inv-kai", email: "kai.tanaka@halcyon.so", invitedBy: "Emma Collins", note: "2 days ago" },
  { id: "inv-priya", email: "priya.raman@halcyon.so", invitedBy: "Nathan Cole", note: "expires Oct 29" },
];

const EASE = [.22, 1, .36, 1] as [number, number, number, number];
const swapEnter = { duration: .16, ease: EASE };
const swapExit = { duration: .1, ease: EASE };
const instant = { duration: 0 };
const cellSpring = { type: "spring" as const, visualDuration: .24, bounce: 0 };
const legendFade = { duration: .16, ease: EASE };
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const DIGITS = "0123456789".split("");
const SEAT_KINDS: SeatKind[] = ["member", "invited", "open", "adding", "removing"];

/** One line of copy at a time in the same slot: the new line rises 2px as it fades in, the old one fades out faster. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: reduced ? instant : swapExit }}
        transition={reduced ? instant : swapEnter}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** An odometer digit: each numeral is a strip of 0-9 that slides to the current value, so a count rolls instead of swapping. */
function Roll({ value, className }: { value: string; className?: string }) {
  const chars = [...value];
  const keys = chars.map((char, index) => `${/\d/.test(char) ? "d" : `c${char}`}${chars.length - index}`);
  const [state, setState] = useState<{ value: string; prev: string[] | null; keys: string[] }>({ value, prev: null, keys });
  if (state.value !== value) setState({ value, prev: state.keys, keys });
  const fresh = state.value !== value ? new Set(state.keys) : state.prev ? new Set(state.prev) : null;
  return <span className={[styles.roll, className].filter(Boolean).join(" ")}>
    <span className={styles.srOnly}>{value}</span>
    <span className={styles.rollTrack} aria-hidden="true">
      {chars.map((char, index) => {
        const key = keys[index];
        const isFresh = fresh !== null && !fresh.has(key);
        return /\d/.test(char)
          ? <span key={key} className={styles.digit} data-fresh={isFresh || undefined}>
            <span className={styles.strip} style={{ transform: `translateY(${-(10 * Number(char))}%)` }}>
              {DIGITS.map(digit => <span key={digit}>{digit}</span>)}
            </span>
          </span>
          : <span key={key} className={styles.rollChar} data-fresh={isFresh || undefined}>{char}</span>;
      })}
    </span>
  </span>;
}

/** One cell per seat, so adding or removing seats grows the bar instead of moving a percentage. */
function SeatMeter({ cells, reduced, label }: { cells: SeatKind[]; reduced: boolean; label: string }) {
  const grouped = cells.length > 40;
  const transition = reduced ? instant : cellSpring;
  const items = grouped
    ? SEAT_KINDS.map(kind => ({ key: kind, kind, grow: cells.filter(cell => cell === kind).length })).filter(item => item.grow > 0)
    : cells.map((kind, index) => ({ key: String(index), kind, grow: 1 }));
  return <div className={styles.meter} role="img" aria-label={label} data-grouped={grouped || undefined}>
    <AnimatePresence initial={false}>
      {items.map(item => <motion.span key={item.key} className={styles.cell} data-kind={item.kind}
        initial={{ flexGrow: 0, paddingLeft: 0, paddingRight: 0 }}
        animate={{ flexGrow: item.grow, paddingLeft: 1.5, paddingRight: 1.5 }}
        exit={{ flexGrow: 0, paddingLeft: 0, paddingRight: 0 }}
        transition={transition}><span className={styles.cellFill} /></motion.span>)}
    </AnimatePresence>
  </div>;
}

function StripeMark({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Holding a step button keeps stepping: one press, then a repeat every 70ms after 380ms. */
function useHoldRepeat(action: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(action);
  useLayoutEffect(() => { latest.current = action; });
  const stop = useCallback(() => clearTimeout(timer.current), []);
  useEffect(() => stop, [stop]);
  return {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      latest.current();
      const repeat = (ms: number) => {
        timer.current = setTimeout(() => { latest.current(); repeat(70); }, ms);
      };
      repeat(380);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => { if (event.detail === 0) latest.current(); },
  };
}

export function SeatManager({
  workspace = "Halcyon",
  plan = DEFAULT_PLAN,
  purchased = 12,
  members = DEFAULT_MEMBERS,
  memberCount,
  invites = DEFAULT_INVITES,
  period = DEFAULT_PERIOD,
  now,
  paymentMethod = DEFAULT_PAYMENT,
  receiptEmail = "billing@halcyon.so",
  updateSeats,
  resendInvite,
  revokeInvite,
  undoSeconds = 3,
  onQuoteChange,
  onSeatsChange,
  onPhaseChange,
  autoPlay,
  className,
}: SeatManagerProps) {
  const reduced = !!(useReducedMotion());
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { amount: .3 });
  const simulated = !updateSeats && !resendInvite && !revokeInvite;
  const [interacted, setInteracted] = useState(false);
  const playing = (autoPlay ?? simulated) && !interacted && inView;
  const nowDate = useMemo(() => now ?? (simulated ? FALLBACK_NOW : new Date()), [now, simulated]);
  const [paid, setPaid] = useState(purchased);
  const [target, setTarget] = useState(purchased);
  const [list, setList] = useState(invites);
  const [inviteState, setInviteState] = useState<Record<string, InviteState>>({});
  const [phase, setPhase] = useState<SeatPhase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"min" | "max" | null>(null);
  const [live, setLive] = useState("");
  const [pressed, setPressed] = useState<string | null>(null);

  const counted = memberCount ?? members.length;
  const pending = list.filter(invite => inviteState[invite.id] !== "revoked").length;
  const taken = counted + pending;
  const minSeats = Math.max(1, taken);
  const maxSeats = plan.maxSeats ?? 9999;
  const quote = useMemo(() => buildQuote(paid, target, plan, period, nowDate), [paid, target, plan, period, nowDate]);
  const money = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency ?? "USD" }), [plan.currency]);
  const suffix = plan.interval === "year" ? "/yr" : "/mo";
  const renewsOn = quote.renewsOn.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const card = paymentMethod ? `${paymentMethod.brand} ending ${paymentMethod.last4}` : "your card";
  const dirty = quote.delta !== 0;
  const locked = phase === "confirm" || phase === "saving";
  const tail = (line: string) => (simulated ? ` Simulated, ${line}.` : "");

  /* Autoplay speaks for the demo, so a real user's announcement would double up. */
  const playingRef = useRef(playing);
  useLayoutEffect(() => { playingRef.current = playing; });
  const announce = (message: string) => { if (!playingRef.current) setLive(message); };
  const targetRef = useRef(target);
  const limitsRef = useRef({ minSeats, maxSeats });
  useLayoutEffect(() => {
    targetRef.current = target;
    limitsRef.current = { minSeats, maxSeats };
  });

  const timers = useRef(new Set<number>());
  const later = useCallback((ms: number, run: () => void) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); run(); }, ms);
    timers.current.add(timer);
    return timer;
  }, []);
  const noticeTimer = useRef<number | undefined>(undefined);
  const phaseTimer = useRef<number | undefined>(undefined);
  const undoTimers = useRef(new Map<string, number>());
  const aborters = useRef(new Set<AbortController>());
  const payRef = useRef<HTMLButtonElement>(null);
  const updateRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<"confirm" | "update" | null>(null);
  useEffect(() => {
    const running = timers.current, pendingTimers = undoTimers.current, controllers = aborters.current;
    return () => {
      running.forEach(clearTimeout);
      pendingTimers.forEach(clearTimeout);
      controllers.forEach(controller => controller.abort());
      clearTimeout(noticeTimer.current);
      clearTimeout(phaseTimer.current);
    };
  }, []);
  const begin = () => {
    const controller = new AbortController();
    aborters.current.add(controller);
    return controller;
  };
  const setPhaseNow = (next: SeatPhase) => { setPhase(next); onPhaseChange?.(next); };
  const setTargetNow = (next: number) => { targetRef.current = next; setTarget(next); };

  useEffect(() => { onQuoteChange?.(quote); }, [quote]);
  /* Focus follows the flow: the pay button when the confirm bar appears, Update seats once it settles. */
  useEffect(() => {
    const where = focusRef.current;
    focusRef.current = null;
    const root = rootRef.current;
    if (!root?.contains(document.activeElement)) return;
    if (where === "confirm") payRef.current?.focus();
    if (where === "update") updateRef.current?.focus();
  }, [phase]);

  const flash = (kind: "min" | "max") => {
    clearTimeout(noticeTimer.current);
    setNotice(kind);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600);
  };
  const stepBy = (amount: number) => {
    if (locked) return;
    const { minSeats: floor, maxSeats: ceiling } = limitsRef.current;
    const asked = targetRef.current + amount;
    const next = Math.min(ceiling, Math.max(floor, asked));
    if (asked < floor) flash("min");
    else if (asked > ceiling) flash("max");
    else if (notice) { clearTimeout(noticeTimer.current); setNotice(null); }
    if (next === targetRef.current) return;
    setTargetNow(next);
    if (phase === "done" || phase === "error") { clearTimeout(phaseTimer.current); setPhaseNow("idle"); }
  };
  const minus = useHoldRepeat(() => stepBy(-1));
  const plus = useHoldRepeat(() => stepBy(1));

  const review = () => {
    if (!dirty || locked) return;
    focusRef.current = "confirm";
    setPhaseNow("confirm");
    announce(quote.delta > 0
      ? `Review: ${plural(quote.delta, "seat")} added, ${money.format(quote.dueToday)} due today.`
      : `Review: ${plural(-quote.delta, "seat")} removed on ${renewsOn}.`);
  };

  const confirm = async () => {
    if (phase !== "confirm" && phase !== "error") return;
    setPhaseNow("saving");
    setError("");
    const controller = begin();
    try {
      if (updateSeats) await updateSeats(quote, controller.signal);
      else await delay(900, controller.signal);
      setPaid(quote.target);
      focusRef.current = "update";
      setPhaseNow("done");
      announce(`Updated to ${plural(quote.target, "seat")}.${quote.delta > 0 ? ` ${money.format(quote.dueToday)} charged.` : ""}${tail("nothing was charged")}`);
      onSeatsChange?.(quote.target, quote);
      clearTimeout(phaseTimer.current);
      phaseTimer.current = window.setTimeout(() => setPhaseNow("idle"), 2800);
    } catch (caught) {
      if (isAbort(caught)) return;
      const message = caught instanceof Error && caught.message ? caught.message : "Payment failed. Nothing was charged.";
      setError(message);
      setPhaseNow("error");
      announce(message);
    } finally {
      aborters.current.delete(controller);
    }
  };

  const resend = async (invite: SeatInvite) => {
    if (inviteState[invite.id]) return;
    setInviteState(current => ({ ...current, [invite.id]: "sending" }));
    const controller = begin();
    try {
      if (resendInvite) await resendInvite(invite, controller.signal);
      else await delay(650, controller.signal);
      setInviteState(current => ({ ...current, [invite.id]: "sent" }));
      announce(`Invite sent again to ${invite.email}.${tail("no email was sent")}`);
    } catch (caught) {
      if (isAbort(caught)) return;
      setInviteState(current => {
        const next = { ...current };
        delete next[invite.id];
        return next;
      });
      announce(`Could not resend the invite to ${invite.email}.`);
    } finally {
      aborters.current.delete(controller);
    }
  };

  const revoke = (invite: SeatInvite) => {
    setInviteState(current => ({ ...current, [invite.id]: "revoked" }));
    announce(`Invite to ${invite.email} revoked, 1 seat freed. Undo is available for ${undoSeconds} seconds.`);
    const timer = window.setTimeout(async () => {
      undoTimers.current.delete(invite.id);
      const controller = begin();
      try {
        if (revokeInvite) await revokeInvite(invite, controller.signal);
        setList(current => current.filter(item => item.id !== invite.id));
        setInviteState(current => {
          const next = { ...current };
          delete next[invite.id];
          return next;
        });
        if (simulated) announce(`Invite to ${invite.email} removed.${tail("nothing was sent")}`);
      } catch (caught) {
        if (isAbort(caught)) return;
        undo(invite);
        announce(`Could not revoke the invite to ${invite.email}. It is still pending.`);
      } finally {
        aborters.current.delete(controller);
      }
    }, undoSeconds * 1000);
    undoTimers.current.set(invite.id, timer);
  };

  const undo = (invite: SeatInvite) => {
    clearTimeout(undoTimers.current.get(invite.id));
    undoTimers.current.delete(invite.id);
    setInviteState(current => {
      const next = { ...current };
      delete next[invite.id];
      return next;
    });
    const floor = limitsRef.current.minSeats + 1;
    if (targetRef.current < floor) setTargetNow(Math.min(floor, limitsRef.current.maxSeats));
    announce(`Invite to ${invite.email} restored.`);
  };

  const reset = () => {
    undoTimers.current.forEach(clearTimeout);
    undoTimers.current.clear();
    clearTimeout(phaseTimer.current);
    setPaid(purchased);
    setTargetNow(purchased);
    setList(invites);
    setInviteState({});
    setNotice(null);
    setError("");
    setPhase("idle");
  };

  /* The loop reads the newest handlers through a ref, so a step never holds a stale seat count or invite list. */
  const actions = useRef({ stepBy, review, confirm, resend, revoke, reset, invites: list });
  useLayoutEffect(() => { actions.current = { stepBy, review, confirm, resend, revoke, reset, invites: list }; });

  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const flashPress = (id: string) => {
      setPressed(id);
      later(140, () => setPressed(current => (current === id ? null : current)));
    };
    const steps: [number, () => void][] = [
      [1300, () => { flashPress("plus"); actions.current.stepBy(1); }],
      [280, () => { flashPress("plus"); actions.current.stepBy(1); }],
      [280, () => { flashPress("plus"); actions.current.stepBy(1); }],
      [1100, () => { flashPress("update"); actions.current.review(); }],
      [1300, () => { flashPress("confirm"); void actions.current.confirm(); }],
      [2300, () => {
        const invite = actions.current.invites[0];
        if (!invite) return;
        flashPress(`resend:${invite.id}`);
        void actions.current.resend(invite);
      }],
      [1500, () => {
        const invite = actions.current.invites[actions.current.invites.length - 1];
        if (!invite) return;
        flashPress(`revoke:${invite.id}`);
        actions.current.revoke(invite);
      }],
      [undoSeconds * 1000 + 1600, () => actions.current.reset()],
    ];
    const [wait, run] = steps[step % steps.length];
    const timer = later(wait, () => {
      run();
      setStep(index => (index + 1) % steps.length);
    });
    const scheduled = timers.current;
    return () => { clearTimeout(timer); scheduled.delete(timer); };
  }, [playing, step, later, undoSeconds]);

  const interact = () => { if (!interacted && (autoPlay ?? simulated)) setInteracted(true); };

  const cells: SeatKind[] = useMemo(
    () => Array.from({ length: Math.max(paid, target, taken) }, (_, index) =>
      index < counted ? "member"
        : index < taken ? "invited"
          : index < Math.min(paid, target) ? "open"
            : target > paid ? "adding" : "removing"),
    [paid, target, taken, counted],
  );
  const open = Math.max(0, paid - taken);
  const full = taken >= paid;

  const note = notice === "min"
    ? { id: "min", tone: "info", icon: <Info {...ICON} />, text: pending > 0 ? `${plural(taken, "seat")} are taken. Revoke an invite to go lower.` : `${plural(taken, "seat")} are taken. Remove a member to go lower.` }
    : notice === "max"
      ? { id: "max", tone: "info", icon: <Info {...ICON} />, text: `${plan.name} includes up to ${maxSeats} seats. Contact sales for more.` }
      : quote.delta > 0
        ? { id: "add", tone: "accent", icon: <CirclePlus {...ICON} />, text: `${plural(quote.delta, "new seat")} open after you update.` }
        : quote.delta < 0
          ? { id: "remove", tone: "muted", icon: <CircleMinus {...ICON} />, text: `${plural(-quote.delta, "open seat")} removed on ${renewsOn}.` }
          : full
            ? { id: "limit", tone: "warning", icon: <TriangleAlert {...ICON} />, text: "Seat limit reached. New invites need a seat.", action: true }
            : { id: "open", tone: "success", icon: <CircleCheck {...ICON} />, text: `${plural(open, "seat")} open for new invites.` };

  const footer: { id: string; node: ReactNode } = (() => {
    if (phase === "saving") return { id: "saving", node: <TextShimmer className={styles.ellipsis}>{quote.delta > 0 ? `Charging ${card}` : "Updating seats"}</TextShimmer> };
    if (phase === "done") return {
      id: "done",
      node: <span className={styles.footLine} data-tone="success">
        <CircleCheck {...ICON} />
        <span className={styles.ellipsis}>Now on {plural(paid, "seat")}. Receipt sent to {receiptEmail}.</span>
      </span>,
    };
    if (phase === "error") return {
      id: "error",
      node: <span className={styles.footLine} data-tone="danger">
        <CircleAlert {...ICON} />
        <span className={styles.ellipsis}>{error}</span>
      </span>,
    };
    if (phase === "confirm") return {
      id: `confirm${Math.sign(quote.delta)}`,
      node: <span className={styles.ellipsis}>
        {quote.delta > 0
          ? <>Charge <span className={styles.strong}>{money.format(quote.dueToday)}</span> to {card} now?</>
          : <>Remove {plural(-quote.delta, "seat")} on {renewsOn}?</>}
      </span>,
    };
    if (dirty) return {
      id: `dirty${Math.sign(quote.delta)}`,
      node: <span className={styles.ellipsis}>
        {quote.delta > 0
          ? <>
            <span className={styles.strong}>+<Roll value={String(quote.delta)} /> {quote.delta === 1 ? "seat" : "seats"}</span>, <Roll value={money.format(quote.dueToday)} /> due today
          </>
          : <>
            <span className={styles.strong}>−<Roll value={String(-quote.delta)} /> {-quote.delta === 1 ? "seat" : "seats"}</span> from {renewsOn}, nothing due today
          </>}
      </span>,
    };
    return {
      id: "idle",
      node: paymentMethod
        ? <span className={styles.footLine}>
          <StripeMark />
          <span className={styles.ellipsis} title="Billed via Stripe">
            <span className={styles.srOnly}>Billed via Stripe, </span>
            {card}
          </span>
        </span>
        : <span className={styles.ellipsis}>No changes</span>,
    };
  })();

  const shown = members.slice(0, 4);
  const extra = counted - shown.length;

  return <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={uid} onPointerDown={interact} onKeyDown={interact}>
    <div className={styles.block}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h3 id={uid} className={styles.title}>Seats</h3>
          <span className={styles.badge}>{plan.name}</span>
        </div>
        <p className={styles.description}>{workspace} · {money.format(plan.pricePerSeat).replace(/\.00$/, "")} per seat{suffix} · Renews {renewsOn}</p>
      </header>
      <div className={styles.usage}>
        <div className={styles.usageRow}>
          <div className={styles.avatars} role="group" aria-label={plural(counted, "member")}>
            {shown.map(member => <Avatar key={member.id} name={member.name} src={member.avatar} size="sm" className={styles.avatar} title={member.name} />)}
            {extra > 0 && <span className={styles.more} aria-hidden="true">+{extra}</span>}
          </div>
          <span className={styles.used}><Roll value={String(taken)} /> of <Roll value={String(paid)} /> seats used</span>
        </div>
        <SeatMeter cells={cells} reduced={reduced} label={`${taken} of ${paid} seats used: ${plural(counted, "member")}, ${pending} invited, ${open} open${quote.delta > 0 ? `, ${quote.delta} being added` : quote.delta < 0 ? `, ${-quote.delta} being removed` : ""}`} />
        <ul className={styles.legend} aria-hidden="true">
          <li><i data-kind="member" /><span><Roll value={String(counted)} /> members</span></li>
          <li><i data-kind="invited" /><span><Roll value={String(pending)} /> invited</span></li>
          <li><i data-kind="open" /><span><Roll value={String(open)} /> open</span></li>
          <AnimatePresence initial={false}>
            {quote.delta !== 0 && <motion.li key="delta" className={styles.legendDelta}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: .1 } }}
              transition={reduced ? instant : legendFade}>
              <i data-kind={quote.delta > 0 ? "adding" : "removing"} />
              <span><Roll value={String(Math.abs(quote.delta))} /> {quote.delta > 0 ? "new" : "removed"}</span>
            </motion.li>}
          </AnimatePresence>
        </ul>
        <Swap id={note.id} reduced={reduced} className={styles.notice}>
          <span className={styles.noticeLine} data-tone={note.tone}>
            {note.icon}
            <span className={styles.ellipsis}>{note.text}</span>
            {note.action && <button type="button" className={styles.link} onClick={() => stepBy(1)} disabled={locked}>Add a seat</button>}
          </span>
        </Swap>
      </div>
    </div>
    <div className={styles.block}>
      <div className={styles.seatsRow}>
        <div className={styles.label}>
          <span className={styles.name}>Seats</span>
          <span className={styles.meta}><Roll value={String(paid)} /> purchased</span>
        </div>
        <div className={styles.stepper} data-locked={locked || undefined}>
          <Button variant="ghost" size="sm" className={styles.stepBtn} aria-label="Remove a seat" aria-controls={`${uid}-seats`} aria-disabled={target <= minSeats || locked || undefined} data-pressed={pressed === "minus" || undefined} {...minus}>
            <Minus {...ICON} />
          </Button>
          <span id={`${uid}-seats`} className={styles.count} role="spinbutton" tabIndex={locked ? -1 : 0} aria-label="Seats"
            aria-valuemin={minSeats} aria-valuemax={maxSeats} aria-valuenow={target} aria-valuetext={plural(target, "seat")}
            aria-disabled={locked || undefined}
            onKeyDown={event => {
              const amount = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5, Home: -9999, End: 9999 } as Record<string, number>)[event.key];
              if (amount === undefined) return;
              event.preventDefault();
              if (event.key === "Home") stepBy(limitsRef.current.minSeats - target);
              else if (event.key === "End") stepBy(Math.min(limitsRef.current.maxSeats, 9999) - target);
              else stepBy(amount);
            }}>
            <Roll value={String(target)} />
          </span>
          <Button variant="ghost" size="sm" className={styles.stepBtn} aria-label="Add a seat" aria-controls={`${uid}-seats`} aria-disabled={target >= maxSeats || locked || undefined} data-pressed={pressed === "plus" || undefined} {...plus}>
            <Plus {...ICON} />
          </Button>
        </div>
      </div>
      <dl className={styles.quote}>
        <div className={styles.quoteRow}>
          <dt>
            <span>Due today</span>
            <Swap id={quote.delta > 0 ? "pro" : quote.delta < 0 ? "renewal" : "none"} reduced={reduced} className={styles.quoteMeta}>
              <span className={styles.ellipsis}>
                {quote.delta > 0 ? `Prorated for ${plural(quote.daysLeft, "day")}` : quote.delta < 0 ? `Removals apply on ${renewsOn}` : "No change"}
              </span>
            </Swap>
          </dt>
          <dd className={styles.amount} data-strong={quote.dueToday > 0 || undefined}><Roll value={money.format(quote.dueToday)} /></dd>
        </div>
        <div className={styles.quoteRow}>
          <dt>
            <span>From {renewsOn}</span>
            <Swap id={dirty ? "was" : "same"} reduced={reduced} className={styles.quoteMeta}>
              <span className={styles.ellipsis}>{dirty ? `Was ${money.format(paid * plan.pricePerSeat)}` : "Current total"}</span>
            </Swap>
          </dt>
          <dd className={styles.amount}><Roll value={`${money.format(quote.nextTotal)}${suffix}`} /></dd>
        </div>
      </dl>
    </div>
    <div className={styles.block}>
      <div className={styles.sectionHead}>
        <span className={styles.name}>Pending invites</span>
        <span className={styles.meta}><Roll value={String(pending)} /></span>
      </div>
      <ul className={styles.invites} aria-label="Pending invites">
        <AnimatePresence initial={false}>
          {list.map(invite => {
            const state = inviteState[invite.id] ?? "idle";
            return <motion.li key={invite.id} className={styles.invite}
              initial={{ height: 0, opacity: 0 }} animate={{ height: 56, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={reduced ? instant : { height: cellSpring, opacity: legendFade }}>
              <Swap id={state === "revoked" ? "revoked" : "active"} reduced={reduced} className={styles.inviteSwap}>
                {state === "revoked"
                  ? <span className={styles.inviteInner}>
                    <Mail {...ICON} className={styles.inviteIcon} />
                    <span className={styles.inviteText}>
                      <span className={[styles.email, styles.struck].join(" ")}>{invite.email}</span>
                      <span className={styles.meta}>Invite revoked, 1 seat freed</span>
                    </span>
                    <span className={styles.actions}>
                      <Button variant="ghost" size="sm" onClick={() => undo(invite)}>Undo</Button>
                    </span>
                  </span>
                  : <span className={styles.inviteInner}>
                    <Mail {...ICON} className={styles.inviteIcon} />
                    <span className={styles.inviteText}>
                      <span className={styles.email} title={invite.email}>{invite.email}</span>
                      <span className={[styles.meta, styles.ellipsis].join(" ")}>{[invite.invitedBy && `Invited by ${invite.invitedBy}`, invite.note].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className={styles.actions}>
                      <Button variant="ghost" size="sm" loading={state === "sending"} disabled={state === "sent"} onClick={() => void resend(invite)} data-pressed={pressed === `resend:${invite.id}` || undefined}
                        aria-label={state === "sent" ? `Invite sent to ${invite.email}` : `Resend invite to ${invite.email}`}>
                        {state === "sent" ? <><CircleCheck {...ICON} className={styles.sentIcon} />Sent</> : "Resend"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => revoke(invite)} disabled={state === "sending"} data-pressed={pressed === `revoke:${invite.id}` || undefined} aria-label={`Revoke invite to ${invite.email}`}>Revoke</Button>
                    </span>
                  </span>}
              </Swap>
            </motion.li>;
          })}
        </AnimatePresence>
        <AnimatePresence>
          {list.length === 0 && <motion.li key="empty" className={styles.empty}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={reduced ? instant : { ...legendFade, delay: .12 }}>
            <Mail {...ICON} className={styles.inviteIcon} />No pending invites
          </motion.li>}
        </AnimatePresence>
      </ul>
    </div>
    <footer className={styles.footer}>
      <Swap id={footer.id} reduced={reduced} className={styles.footText}>{footer.node}</Swap>
      <Swap id={locked || phase === "error" ? "confirm" : "main"} reduced={reduced} className={styles.footActions}>
        {locked || phase === "error"
          ? <span className={styles.buttons}>
            <Button variant="ghost" size="sm" onClick={() => { focusRef.current = "update"; setError(""); setPhaseNow("idle"); }} disabled={phase === "saving"}>Back</Button>
            <Button ref={payRef} size="sm" loading={phase === "saving"} onClick={() => void confirm()} data-pressed={pressed === "confirm" || undefined}>
              {phase === "error" ? "Try again" : quote.delta > 0 ? `Pay ${money.format(quote.dueToday)}` : "Confirm"}
            </Button>
          </span>
          : <span className={styles.buttons}>
            <Button ref={updateRef} size="sm" onClick={review} disabled={!dirty} data-pressed={pressed === "update" || undefined}>Update seats</Button>
          </span>}
      </Swap>
    </footer>
    <div className={styles.srOnly} aria-live="polite" role="status">{live}</div>
  </section>;
}

export default SeatManager;
