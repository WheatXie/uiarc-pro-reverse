"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, CircleAlert, CircleCheck, Gift, Mail, UserRoundCheck, X } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./referral-card.module.css";

export type ReferralStage = "invited" | "signed-up" | "earned";

export interface Referral {
  id: string;
  name?: string;
  email: string;
  avatar?: string;
  stage: ReferralStage;
  /** ISO timestamp. */
  invitedAt: string;
}

export interface ReferralMilestone {
  goal: number;
  reward: string;
  detail?: string;
}

export type ReferralShareChannel = "x" | "linkedin" | "email";

export interface ReferralCardProps {
  /** The invite URL. The domain is muted, the code keeps full contrast, and Copy takes the whole URL. */
  link?: string;
  /** Credit each side gets, in whole currency units. Drives the heading, the Earned total and the Earned label on rows. */
  reward?: number;
  currency?: string;
  title?: string;
  description?: string;
  /** Newest first. Leave unset and the card plays its own demo program. */
  referrals?: Referral[];
  milestone?: ReferralMilestone;
  shareMessage?: string;
  maxInvites?: number;
  simulate?: boolean;
  onCopy?: (link: string) => void;
  onShare?: (channel: ReferralShareChannel, url: string) => void;
  onInvite?: (emails: string[], options: { signal: AbortSignal }) => void | Promise<void>;
  onMilestone?: (milestone: ReferralMilestone) => void;
  className?: string;
}

const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const show = { duration: .16, ease } as const;
const hide = { duration: .1, ease } as const;
const instant = { duration: 0 } as const;
const growRow = { type: "spring", visualDuration: .24, bounce: 0 } as const;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

const SAMPLE: Referral[] = [
  { id: "ref-ryan", name: "Ryan Sullivan", email: "ryan@ledgerly.com", avatar: "/media/people/ryan-sullivan.svg", stage: "invited", invitedAt: "2026-10-26T09:10:00Z" },
  { id: "ref-chloe", name: "Chloe Nguyen", email: "chloe@parcel.so", avatar: "/media/people/chloe-nguyen.svg", stage: "signed-up", invitedAt: "2026-10-23T14:40:00Z" },
  { id: "ref-priya", name: "Priya Shah", email: "priya@hexwork.io", stage: "invited", invitedAt: "2026-10-21T08:05:00Z" },
  { id: "ref-daniel", name: "Daniel Kim", email: "daniel@fieldnote.studio", avatar: "/media/people/daniel-kim.svg", stage: "earned", invitedAt: "2026-10-17T11:25:00Z" },
  { id: "ref-jasmine", name: "Jasmine Brooks", email: "jasmine@lumen.dev", avatar: "/media/people/jasmine-brooks.svg", stage: "earned", invitedAt: "2026-10-12T17:20:00Z" },
  { id: "ref-marcus", name: "Marcus Johnson", email: "marcus@tidewater.co", avatar: "/media/people/marcus-johnson.svg", stage: "earned", invitedAt: "2026-10-06T10:00:00Z" },
];

/** The demo program: one friend completes sign-up, then earns, while the count-up and the segments chase them. */
const PROGRAM: { at: number; id: string; stage: ReferralStage }[] = [
  { at: 1400, id: "ref-chloe", stage: "earned" },
  { at: 2900, id: "ref-ryan", stage: "signed-up" },
  { at: 4400, id: "ref-ryan", stage: "earned" },
];

const DEFAULT_MILESTONE: ReferralMilestone = { goal: 5, reward: "3 months free", detail: "Applied to your next invoice" };
const IDLE_HINT = { tone: "idle", text: "Press Enter after each address" } as const;

type Hint = { tone: "idle" | "error" | "success"; text: string };

function XMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>;
}

function LinkedInMark({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.73 1.637-1.665 3.37-1.665 3.6 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>;
}

const CHANNELS: { id: ReferralShareChannel; label: string; done: string; icon: ReactNode }[] = [
  { id: "x", label: "Post on X", done: "Opened an X post draft", icon: <XMark size={14} /> },
  { id: "linkedin", label: "Share on LinkedIn", done: "Opened a LinkedIn share", icon: <LinkedInMark size={15} /> },
  { id: "email", label: "Share by email", done: "Opened an email draft", icon: <Mail size={16} strokeWidth={1.75} /> },
];

export function referralShareUrl({ channel, link, message }: { channel: ReferralShareChannel; link: string; message: string }) {
  const target = encodeURIComponent(link);
  if (channel === "x") return `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${target}`;
  if (channel === "linkedin") return `https://www.linkedin.com/sharing/share-offsite/?url=${target}`;
  return `mailto:?subject=${encodeURIComponent("An invite for you")}&body=${encodeURIComponent(`${message}\n\n${link}`)}`;
}

const STAGES: Record<ReferralStage, { label: (money: string) => string; icon: ReactNode }> = {
  invited: { label: () => "Invited", icon: <Mail size={14} strokeWidth={1.75} /> },
  "signed-up": { label: () => "Signed up", icon: <UserRoundCheck size={14} strokeWidth={1.75} /> },
  earned: { label: money => `Earned ${money}`, icon: <CircleCheck size={14} strokeWidth={1.75} /> },
};

/** Totals roll to their new value over 600ms instead of snapping, so an invite landing never looks like a page reload. */
function CountUp({ value, format, reduced }: { value: number; format: (value: number) => string; reduced: boolean }) {
  const count = useMotionValue(value);
  const text = useTransform(count, latest => format(Math.round(latest)));
  useEffect(() => {
    if (reduced) { count.set(value); return; }
    const controls = animate(count, value, { duration: .6, ease });
    return () => controls.stop();
  }, [count, value, reduced]);
  return <motion.span>{text}</motion.span>;
}

/** Swaps content by key: 160ms in with a 2px rise, 100ms out. The grid stack keeps the width from jumping. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/**
 * A referral panel that is honest about what is simulated: the link copies for real, the share buttons open real
 * drafts, but every invite and every row is local state, and the hint says so. Referrals arrive at the top of the
 * list on a height spring while the funnel counts up, and the milestone bar fills one segment per paid friend.
 */
export function ReferralCard({
  link = "https://northwind.app/r/emma20",
  reward = 20,
  currency = "USD",
  title,
  description,
  referrals,
  milestone = DEFAULT_MILESTONE,
  shareMessage = "I use Northwind to run our team's planning. Here is $20 off your first month.",
  maxInvites = 10,
  simulate,
  onCopy,
  onShare,
  onInvite,
  onMilestone,
  className,
}: ReferralCardProps) {
  const reduced = useReducedMotion() ?? false;
  const auto = simulate ?? referrals === undefined;
  const formatMoney = useCallback((value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value), [currency]);
  const money = formatMoney(reward);
  const heading = title ?? `Give ${money}, get ${money}`;
  const copy = description ?? `Friends get ${money} off their first month. You get ${money} in credit for each friend who subscribes.`;

  const [list, setList] = useState<Referral[]>(referrals ?? SAMPLE);
  const [previous, setPrevious] = useState(referrals);
  if (referrals !== previous) { setPrevious(referrals); if (referrals) setList(referrals); }

  const invited = list.length;
  const signedUp = list.filter(item => item.stage !== "invited").length;
  const earned = list.filter(item => item.stage === "earned").length;
  const goal = Math.max(1, milestone.goal);
  const unlocked = earned >= goal;
  const left = Math.max(0, goal - earned);

  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const stage = useCallback((id: string, next: ReferralStage, delay: number) => {
    timers.current.push(window.setTimeout(() => setList(rows => rows.map(row => row.id === id ? { ...row, stage: next } : row)), delay));
  }, []);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); timers.current = []; }, []);

  const started = useRef(false);
  useEffect(() => {
    if (!auto || referrals !== undefined || started.current) return;
    const node = root.current;
    const run = () => {
      if (started.current) return;
      started.current = true;
      PROGRAM.forEach(step => stage(step.id, step.stage, reduced ? step.at / 2 : step.at));
    };
    if (!node || typeof IntersectionObserver === "undefined") { run(); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { run(); observer.disconnect(); } }, { threshold: .4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [auto, referrals, stage, reduced]);

  const announced = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !announced.current) { announced.current = true; onMilestone?.(milestone); }
    if (!unlocked) announced.current = false;
  }, [unlocked, milestone, onMilestone]);

  const [done, setDone] = useState<ReferralShareChannel | null>(null);
  const [status, setStatus] = useState("");
  const doneTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  const [pending, setPending] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<Hint>(IDLE_HINT);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController>(null);
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { request.current?.abort(); window.clearTimeout(hintTimer.current); }, []);
  const hintId = useId();

  function hintFor(next: Hint, reset = 0) {
    window.clearTimeout(hintTimer.current);
    setHint(next);
    if (reset) hintTimer.current = window.setTimeout(() => setHint(IDLE_HINT), reset);
  }

  function addEmails(text: string): string[] | null {
    const candidates = text.split(/[\s,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean);
    if (!candidates.length) return pending;
    const next = [...pending];
    for (const address of candidates) {
      if (!EMAIL.test(address)) { setDraft(address); hintFor({ tone: "error", text: `${address} is not a full email address` }); return null; }
      if (!next.includes(address)) {
        if (list.some(row => row.email.toLowerCase() === address)) { setDraft(address); hintFor({ tone: "error", text: `${address} was already invited` }); return null; }
        if (next.length >= maxInvites) { setDraft(""); setPending(next); hintFor({ tone: "error", text: `Up to ${maxInvites} addresses per send` }); return null; }
        next.push(address);
      }
    }
    setPending(next);
    setDraft("");
    if (hint.tone === "error") hintFor(IDLE_HINT);
    requestAnimationFrame(() => { const node = track.current; if (node) node.scrollLeft = node.scrollWidth; });
    return next;
  }

  async function send() {
    if (sending) return;
    const emails = draft.trim() ? addEmails(draft) : pending;
    if (!emails) return;
    if (!emails.length) { hintFor({ tone: "error", text: "Add at least one email address" }); input.current?.focus(); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSending(true);
    hintFor(IDLE_HINT);
    try {
      if (onInvite) await onInvite(emails, { signal: controller.signal });
      else await new Promise(resolve => setTimeout(resolve, 700));
      if (controller.signal.aborted) return;
      const invitedAt = new Date().toISOString();
      const rows: Referral[] = emails.map((email, index) => ({ id: `invite-${Date.now()}-${index}`, email, stage: "invited", invitedAt }));
      setList(current => [...rows, ...current]);
      setPending([]);
      const count = `${emails.length} invite${emails.length === 1 ? "" : "s"}`;
      hintFor({ tone: "success", text: onInvite ? `Sent ${count}` : `Sent ${count}. Simulated, nothing was sent.` }, 4200);
      if (auto) { stage(rows[0].id, "signed-up", 2600); stage(rows[0].id, "earned", 4600); }
    } catch (error) {
      if (controller.signal.aborted) return;
      hintFor({ tone: "error", text: error instanceof Error && error.message ? error.message : "Could not send the invites. Try again." });
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }

  const address = link.replace(/^https?:\/\//, "");
  const slash = address.lastIndexOf("/") + 1;
  const segmentCount = Math.min(goal, 12);
  const filled = (Math.min(earned, goal) / goal) * segmentCount;

  function share(id: ReferralShareChannel) {
    const channel = CHANNELS.find(entry => entry.id === id)!;
    const url = referralShareUrl({ channel: id, link, message: shareMessage });
    if (onShare) { onShare(id, url); setStatus(`${channel.done}.`); } else setStatus(`${channel.done}. Simulated, nothing was posted.`);
    setDone(id);
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => setDone(null), 1600);
  }

  return <div ref={root} className={[styles.root, className].filter(Boolean).join(" ")}>
    <div className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.title}>{heading}</h3>
        <p className={styles.description}>{copy}</p>
      </header>
      <div className={styles.actions}>
        <div className={styles.linkRow}>
          <div className={styles.linkField}>
            <span className={styles.linkText} title={link}><span className={styles.linkBase}>{address.slice(0, slash)}</span>{address.slice(slash)}</span>
            <CopyButton value={link} label="Copy" variant="plain" className={styles.copy} onCopied={() => onCopy?.(link)} />
          </div>
          <div className={styles.shareGroup} role="group" aria-label="Share your link">
            {CHANNELS.map(channel => <Tooltip key={channel.id} content={channel.label}>
              <button type="button" className={styles.share} aria-label={channel.label} onClick={() => share(channel.id)} data-done={done === channel.id || undefined}>
                <Swap id={done === channel.id ? "done" : "idle"} reduced={reduced} className={styles.shareIcon}>
                  {done === channel.id ? <Check size={16} strokeWidth={1.75} /> : channel.icon}
                </Swap>
              </button>
            </Tooltip>)}
          </div>
        </div>
        <div className={styles.inviteRow}>
          <div className={styles.chipField} data-invalid={hint.tone === "error" || undefined} onMouseDown={event => {
            if (event.target === event.currentTarget || event.target === track.current) { event.preventDefault(); input.current?.focus(); }
          }}>
            <div ref={track} className={styles.chipTrack}>
              <AnimatePresence initial={false}>
                {pending.map(email => <motion.span key={email} className={styles.chip} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>
                  <span className={styles.chipText}>{email}</span>
                  <button type="button" className={styles.chipRemove} aria-label={`Remove ${email}`} onClick={() => { setPending(current => current.filter(value => value !== email)); input.current?.focus(); }} disabled={sending}>
                    <X size={12} strokeWidth={2} />
                  </button>
                </motion.span>)}
              </AnimatePresence>
              <input
                ref={input}
                className={styles.chipInput}
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                placeholder={pending.length ? "" : "Invite by email"}
                aria-label="Invite by email"
                aria-describedby={hintId}
                aria-invalid={hint.tone === "error" || undefined}
                readOnly={sending}
                onChange={event => { setDraft(event.target.value); if (hint.tone === "error") hintFor(IDLE_HINT); }}
                onKeyDown={event => {
                  const commit = event.key === "Enter" || event.key === "," || event.key === ";" || (event.key === " " && !!draft) || (event.key === "Tab" && !!draft.trim() && !event.shiftKey);
                  if (commit) {
                    if (event.key === "Enter" && !draft.trim()) { event.preventDefault(); if (pending.length) void send(); return; }
                    event.preventDefault();
                    addEmails(draft);
                  } else if (event.key === "Backspace" && !draft && pending.length) {
                    event.preventDefault();
                    setPending(current => current.slice(0, -1));
                  }
                }}
                onPaste={event => {
                  const text = event.clipboardData.getData("text");
                  if (/[\s,;]/.test(text.trim())) { event.preventDefault(); addEmails(`${draft} ${text}`); }
                }}
                onBlur={() => { if (draft.trim() && EMAIL.test(draft.trim())) addEmails(draft); }}
              />
            </div>
          </div>
          <Button size="md" className={styles.send} loading={sending} onClick={() => void send()}>Send</Button>
        </div>
        <p id={hintId} className={styles.hint} data-tone={hint.tone} role="status" aria-live="polite">
          <Swap id={`${hint.tone}:${hint.text}`} reduced={reduced}>
            {hint.tone !== "idle" && <span className={styles.hintIcon}>{hint.tone === "error" ? <CircleAlert size={14} strokeWidth={1.75} /> : <CircleCheck size={14} strokeWidth={1.75} />}</span>}
            <span className={styles.hintText}>{hint.text}</span>
          </Swap>
        </p>
      </div>
      <div className={styles.progress}>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Invited</dt>
            <dd><CountUp value={invited} format={String} reduced={reduced} /></dd>
          </div>
          <div className={styles.stat}>
            <dt>Signed up</dt>
            <dd><CountUp value={signedUp} format={String} reduced={reduced} /></dd>
          </div>
          <div className={styles.stat}>
            <dt>Earned</dt>
            <dd><CountUp value={earned * reward} format={formatMoney} reduced={reduced} /></dd>
          </div>
        </dl>
        <div className={styles.milestone} data-unlocked={unlocked || undefined}>
          <div className={styles.milestoneHead}>
            <Swap id={unlocked ? "unlocked" : `left-${left}`} reduced={reduced} className={styles.milestoneText}>
              <span className={styles.milestoneIcon}>{unlocked ? <CircleCheck size={16} strokeWidth={1.75} /> : <Gift size={16} strokeWidth={1.75} />}</span>
              <span className={styles.milestoneCopy}>
                {unlocked
                  ? <><span className={styles.milestoneStrong}>{milestone.reward} unlocked</span>{milestone.detail && <span className={styles.milestoneDetail}>{milestone.detail}</span>}</>
                  : <span>{left} more paid referral{left === 1 ? "" : "s"} to unlock {milestone.reward}</span>}
              </span>
            </Swap>
            <span className={styles.milestoneCount}><CountUp value={Math.min(earned, goal)} format={String} reduced={reduced} /> of {goal}</span>
          </div>
          <div className={styles.segments} role="progressbar" aria-label="Milestone progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(earned, goal)} aria-valuetext={unlocked ? `${milestone.reward} unlocked` : `${earned} of ${goal} paid referrals`}>
            {Array.from({ length: segmentCount }, (_, index) => <span key={index} className={styles.segment}>
              <span className={styles.segmentFill} style={{ transform: `scaleX(${Math.max(0, Math.min(1, filled - index))})` }} />
            </span>)}
          </div>
        </div>
        <ul className={styles.list} aria-label="Referrals">
          {list.length === 0 && <li className={styles.empty}>No invites yet. Share your link or invite someone by email.</li>}
          <AnimatePresence initial={false}>
            {list.map(row => {
              const meta = STAGES[row.stage];
              const time = new Date(row.invitedAt).getTime();
              return <motion.li key={row.id} className={styles.item} initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 52 }} exit={{ opacity: 0, height: 0 }} transition={reduced ? instant : { height: growRow, opacity: show }}>
                <div className={styles.row}>
                  <Avatar name={row.name ?? row.email} src={row.avatar} size="sm" />
                  <div className={styles.who}>
                    <span className={styles.name}>{row.name ?? row.email}</span>
                    <span className={styles.meta}>
                      {row.name ? <span className={styles.metaEmail}>{row.email}</span> : <span>Invited</span>}
                      <span className={styles.metaDate}>{row.name ? "· " : ""}{Number.isNaN(time) ? "" : Date.now() - time >= 0 && Date.now() - time < 36e5 ? "just now" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(time)}</span>
                    </span>
                  </div>
                  <Swap id={row.stage} reduced={reduced} className={styles.stage}>
                    <span className={styles.stageInner} data-stage={row.stage}>{meta.icon}<span>{meta.label(money)}</span></span>
                  </Swap>
                </div>
              </motion.li>;
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{status}</span>
  </div>;
}

export default ReferralCard;
