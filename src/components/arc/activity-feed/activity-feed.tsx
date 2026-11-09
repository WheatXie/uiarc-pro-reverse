"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Check,
  CheckCheck,
  GitCommitHorizontal,
  Image as ImageIcon,
  MessageSquare,
  Rocket,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { TextMorph } from "../text-morph/text-morph";
import SegmentedControl from "../segmented-control/segmented-control";
import { ArcImage } from "../lib/arc-provider";
import { motionTokens } from "../lib/motion-tokens";
import { person, photo, type PersonId, type PhotoId } from "../lib/media";
import styles from "./activity-feed.module.css";

/** What kind of event a row describes. It picks the icon in the badge and the filter it belongs to. */
export type ActivityType = "comment" | "change" | "deploy" | "file" | "member";

export interface CommentDetail { kind: "comment"; text: string }
export interface DeployDetail {
  kind: "deploy";
  environment: string;
  commit: string;
  duration: string;
  status: "ready" | "failed";
  log?: string[];
}
export interface DiffLine { kind: "context" | "add" | "remove"; text: string }
export interface DiffDetail { kind: "diff"; file: string; additions: number; deletions: number; lines: DiffLine[] }
export interface FilesDetail { kind: "files"; photos: PhotoId[] }

/** The expanded body of an event: a comment, a diff, a deploy summary or a photo grid. */
export type ActivityDetail = CommentDetail | DeployDetail | DiffDetail | FilesDetail;

export interface Activity {
  id: string;
  type: ActivityType;
  /** Person id from the shared media library; it resolves to the avatar. */
  actor: PersonId;
  /** The verb phrase between the two names, such as "commented on". */
  action: string;
  target: string;
  project: string;
  /** Days before `today`; 0 is today. */
  day: number;
  time: string;
  unread: boolean;
  detail?: ActivityDetail;
}

export interface ActivityFeedProps {
  /** Events, newest first: id, type, actor, action, target, project, day offset, time, unread, and an optional detail. */
  items?: Activity[];
  /** Events that arrive while the feed is open. They wait behind the new updates button. Pass [] to turn off the simulation. */
  incoming?: Activity[];
  /** Milliseconds between simulated arrivals. */
  incomingInterval?: number;
  /** ISO date the day offsets count back from. */
  today?: string;
  /** How far back the feed reaches. */
  defaultRange?: "today" | "week" | "month";
  /** Called when events are marked read, one at a time or all at once. */
  onRead?: (ids: string[]) => void;
  /** Heading. */
  title?: string;
  /** Class on the root. */
  className?: string;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
}

const ICONS: Record<ActivityType, LucideIcon> = {
  comment: MessageSquare,
  change: GitCommitHorizontal,
  deploy: Rocket,
  file: ImageIcon,
  member: UserPlus,
};

const TYPES: { value: "all" | ActivityType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "comment", label: "Comments" },
  { value: "change", label: "Changes" },
  { value: "deploy", label: "Deploys" },
  { value: "file", label: "Files" },
];

const RANGES = { today: 1, week: 7, month: 30 } as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SWEEP_EASE = motionTokens.ease.inOut;

/** The demo week: fifteen events across ten days, six of them unread. */
export const activities: Activity[] = [
  { id: "a1", type: "comment", actor: "emma-collins", action: "commented on", target: "Pricing page v3", project: "Website", day: 0, time: "10:42", unread: true, detail: { kind: "comment", text: "Can we move the annual toggle above the cards? On 13 inch screens it pushes the main button below the fold." } },
  { id: "a2", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-web to Production", project: "Atlas", day: 0, time: "10:05", unread: true, detail: { kind: "deploy", environment: "Production", commit: "a41f9c2 Cache plan limits per workspace", duration: "1m 48s", status: "ready" } },
  { id: "a3", type: "change", actor: "marcus-johnson", action: "changed", target: "checkout/summary.tsx", project: "Atlas", day: 0, time: "09:31", unread: true, detail: { kind: "diff", file: "app/checkout/summary.tsx", additions: 3, deletions: 2, lines: [
    { kind: "context", text: "const subtotal = sum(items.map(item => item.price * item.qty));" },
    { kind: "remove", text: "const tax = subtotal * 0.23;" },
    { kind: "remove", text: "const total = subtotal + tax;" },
    { kind: "add", text: "const rate = taxRates[address.country] ?? 0;" },
    { kind: "add", text: "const tax = round(subtotal * rate, 2);" },
    { kind: "add", text: "const total = round(subtotal + tax - discount, 2);" },
  ] } },
  { id: "a4", type: "file", actor: "jasmine-brooks", action: "added 4 photos to", target: "Autumn catalog", project: "Brand", day: 0, time: "08:57", unread: true, detail: { kind: "files", photos: ["lounge-chair", "table-lamp", "stoneware-cups", "linen-throw"] } },
  { id: "a5", type: "member", actor: "sofia-ramirez", action: "invited Hannah Walsh to", target: "Support", project: "Workspace", day: 1, time: "17:20", unread: true },
  { id: "a6", type: "deploy", actor: "mateo-alvarez", action: "failed to deploy", target: "atlas-ios to Preview", project: "Atlas", day: 1, time: "16:02", unread: true, detail: { kind: "deploy", environment: "Preview", commit: "9be07d1 Swap image cache for the new loader", duration: "2m 11s", status: "failed", log: ["Compiling ImageLoader.swift", "error: cannot find 'DiskCache' in scope", "Build failed after 2m 11s"] } },
  { id: "a7", type: "comment", actor: "chloe-nguyen", action: "commented on", target: "Q3 retention report", project: "Insights", day: 1, time: "14:48", unread: false, detail: { kind: "comment", text: "Week 6 retention is up 4 points for teams that finished onboarding. The dip in August lines up with the pricing test." } },
  { id: "a8", type: "change", actor: "daniel-kim", action: "fixed", target: "Webhook retries drop the idempotency key", project: "Platform", day: 1, time: "11:16", unread: false, detail: { kind: "diff", file: "services/webhooks/retry.ts", additions: 2, deletions: 1, lines: [
    { kind: "context", text: "for (const attempt of backoff(5)) {" },
    { kind: "remove", text: "  const response = await send(event.url, event.body);" },
    { kind: "add", text: '  const headers = { "Idempotency-Key": event.id };' },
    { kind: "add", text: "  const response = await send(event.url, event.body, { headers });" },
    { kind: "context", text: "  if (response.ok) return response;" },
  ] } },
  { id: "a9", type: "comment", actor: "ryan-sullivan", action: "commented on", target: "Lisbon Coffee Co. renewal", project: "Sales", day: 2, time: "15:37", unread: false, detail: { kind: "comment", text: "They signed for two years at 40 seats. Finance has the order form; kickoff is booked for October 6." } },
  { id: "a10", type: "file", actor: "ava-mitchell", action: "added 3 photos to", target: "Lisbon launch event", project: "Marketing", day: 2, time: "12:03", unread: false, detail: { kind: "files", photos: ["lisbon-tram", "lisbon-rooftops", "restaurant"] } },
  { id: "a11", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-api to Production", project: "Atlas", day: 3, time: "18:44", unread: false, detail: { kind: "deploy", environment: "Production", commit: "e3c1a70 Rate limit exports per workspace", duration: "3m 02s", status: "ready" } },
  { id: "a12", type: "member", actor: "nathan-cole", action: "made Daniel Kim an admin of", target: "Platform", project: "Workspace", day: 3, time: "09:12", unread: false },
  { id: "a13", type: "change", actor: "emma-collins", action: "changed", target: "tokens/color.css", project: "Design system", day: 6, time: "16:25", unread: false, detail: { kind: "diff", file: "tokens/color.css", additions: 2, deletions: 2, lines: [
    { kind: "remove", text: "--border: oklch(92% 0 0);" },
    { kind: "remove", text: "--border-subtle: oklch(95% 0 0);" },
    { kind: "add", text: "--border: oklch(93.5% 0 0);" },
    { kind: "add", text: "--border-subtle: oklch(96.5% 0 0);" },
  ] } },
  { id: "a14", type: "comment", actor: "diane-foster", action: "commented on", target: "2027 hiring plan", project: "Operations", day: 9, time: "10:30", unread: false, detail: { kind: "comment", text: "Approved the two platform roles. Let's hold the second designer until Q1 numbers are in." } },
  { id: "a15", type: "member", actor: "tyler-hayes", action: "joined", target: "Sales", project: "Workspace", day: 13, time: "08:45", unread: false },
];

/** The simulated live arrivals: three events that wait behind the new updates button. */
export const incomingActivities: Activity[] = [
  { id: "live-1", type: "comment", actor: "marcus-johnson", action: "replied on", target: "Pricing page v3", project: "Website", day: 0, time: "Just now", unread: true, detail: { kind: "comment", text: "Agreed. I'll move the toggle and keep the cards the same height so nothing jumps." } },
  { id: "live-2", type: "deploy", actor: "olivia-bennett", action: "deployed", target: "atlas-web to Preview", project: "Atlas", day: 0, time: "Just now", unread: true, detail: { kind: "deploy", environment: "Preview", commit: "c7d2e19 Move annual toggle above plan cards", duration: "1m 12s", status: "ready" } },
  { id: "live-3", type: "file", actor: "jasmine-brooks", action: "added 2 photos to", target: "Autumn catalog", project: "Brand", day: 0, time: "Just now", unread: true, detail: { kind: "files", photos: ["ceramic-lamp", "glass-carafe"] } },
];

function tone(detail: ActivityDetail | undefined) {
  if (detail?.kind !== "deploy") return undefined;
  return detail.status === "failed" ? "danger" : "success";
}

/** Solves a cubic-bezier for a linear progress, so the sweep line and the row delays share one curve. */
function cubicBezier(progress: number) {
  const [x1, y1, x2, y2] = SWEEP_EASE;
  const curve = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2;
    if (curve(mid, x1, x2) < progress) low = mid;
    else high = mid;
  }
  return curve((low + high) / 2, y1, y2);
}

function Detail({ detail }: { detail: ActivityDetail }) {
  if (detail.kind === "comment") return <blockquote className={styles.comment}>{detail.text}</blockquote>;

  if (detail.kind === "files") {
    return <div className={styles.photos}>
      {detail.photos.map(id => {
        const file = photo(id);
        return <span key={id} className={styles.photo}><ArcImage src={file.src} alt={file.alt} fill sizes="84px" /></span>;
      })}
    </div>;
  }

  if (detail.kind === "diff") {
    return <div className={styles.diff}>
      <div className={styles.diffHead}>
        <span>{detail.file}</span>
        <span><span className={styles.plus}>+{detail.additions}</span>{" "}<span className={styles.minus}>−{detail.deletions}</span></span>
      </div>
      <pre>
        {detail.lines.map((line, index) => <span key={index} className={styles.diffLine} data-kind={line.kind}>
          <span aria-hidden="true">{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}</span>
          <span className={styles.srOnly}>{line.kind === "add" ? "Added: " : line.kind === "remove" ? "Removed: " : ""}</span>
          {line.text}{"\n"}
        </span>)}
      </pre>
    </div>;
  }

  return <div className={styles.deploy}>
    <dl>
      <div><dt>Status</dt><dd><span className={styles.state} data-state={detail.status}>{detail.status === "ready" ? "Ready" : "Failed"}</span></dd></div>
      <div><dt>Commit</dt><dd className={styles.mono}>{detail.commit}</dd></div>
      <div><dt>Build time</dt><dd>{detail.duration}</dd></div>
    </dl>
    {detail.log && <pre className={styles.log}>{detail.log.join("\n")}</pre>}
  </div>;
}

interface ItemProps {
  item: Activity;
  open: boolean;
  sweepDelay: number | undefined;
  onToggle: () => void;
  reduce: boolean;
}

function Item({ item, open, sweepDelay, onToggle, reduce }: ItemProps) {
  const actor = person(item.actor);
  const Icon = ICONS[item.type];
  const detailId = `${useId()}-detail`;
  const preview = item.detail?.kind === "comment" ? item.detail.text
    : item.detail?.kind === "deploy" ? item.detail.commit
      : item.detail?.kind === "diff" ? item.detail.file
        : undefined;

  const headText = <>
    <span className={styles.sentence}>
      <strong>{actor.name}</strong> {item.action} <strong>{item.target}</strong>
      <span className={styles.srOnly}>{item.unread ? ", unread" : ""}</span>
    </span>
    <span className={styles.meta}>
      <span className={styles.metaProject}>{item.project}</span>
      {preview && !open && <><span className={styles.metaDot} aria-hidden="true">·</span><span>{preview}</span></>}
    </span>
  </>;

  const side = <span className={styles.side}>
    <span className={styles.time}>{item.time}</span>
    <span className={styles.dotSlot} aria-hidden="true"><span className={styles.dot} /></span>
  </span>;

  return <motion.li
    layout={reduce ? false : "position"}
    className={styles.item}
    data-id={item.id}
    data-unread={item.unread}
    style={{ "--sweep-delay": `${sweepDelay ?? 0}ms` } as CSSProperties}
    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={reduce ? { duration: motionTokens.duration.instant } : {
      layout: motionTokens.spring.smooth,
      y: motionTokens.spring.smooth,
      opacity: { duration: motionTokens.duration.standard },
    }}
  >
    <span className={styles.avatar}>
      <ArcImage src={actor.src} alt={actor.name} width={32} height={32} />
      <span className={styles.badge} data-tone={tone(item.detail)} aria-hidden="true"><Icon size={10} strokeWidth={2.25} /></span>
    </span>
    <div className={styles.body}>
      {item.detail
        ? <button type="button" className={styles.head} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
          <span className={styles.headText}>{headText}</span>
          {side}
        </button>
        : <div className={styles.head}>
          <span className={styles.headText}>{headText}</span>
          {side}
        </div>}
      <AnimatePresence initial={false}>
        {open && item.detail && <motion.div
          id={detailId}
          className={styles.detailWrap}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : {
            height: motionTokens.spring.smooth,
            opacity: { duration: motionTokens.duration.standard },
          }}
        >
          <div className={styles.detail}><Detail detail={item.detail} /></div>
        </motion.div>}
      </AnimatePresence>
    </div>
  </motion.li>;
}

/**
 * A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button,
 * expandable details, and a mark all read sweep. Load events from your activity API, stream new ones in through
 * `incoming`, and persist read state through `onRead`.
 */
export function ActivityFeed({
  items = activities,
  incoming = incomingActivities,
  incomingInterval = 6000,
  today = "2026-09-24",
  defaultRange = "week",
  onRead,
  title = "Activity",
  className,
  flat = false,
}: ActivityFeedProps) {
  const reduce = !!useReducedMotion();
  const [events, setEvents] = useState(items);
  const [queue, setQueue] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<"all" | ActivityType>("all");
  const [open, setOpen] = useState<string[]>([]);
  const [sweep, setSweep] = useState<{ delays: Record<string, number>; duration: number } | null>(null);
  const [status, setStatus] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const sweepLine = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<number>());

  const later = useCallback((run: () => void, delay: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); run(); }, delay);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(id => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    if (!incoming.length) return;
    const ids = incoming.map((event, index) => window.setTimeout(
      () => setQueue(current => current.some(item => item.id === event.id) ? current : [event, ...current]),
      incomingInterval * (index + 1) - 2000,
    ));
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [incoming, incomingInterval]);

  // The chosen range trims by day offset; the filter then trims by type. Both counts feed the segmented accessory.
  const inRange = useMemo(() => events.filter(event => event.day < RANGES[defaultRange]), [events, defaultRange]);
  const shown = useMemo(() => filter === "all" ? inRange : inRange.filter(event => event.type === filter), [inRange, filter]);
  const groups = useMemo(() => {
    const byDay = new Map<number, Activity[]>();
    for (const event of shown) byDay.set(event.day, [...(byDay.get(event.day) ?? []), event]);
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);
  const options = useMemo(() => TYPES.map(type => ({
    value: type.value,
    label: type.label,
    accessory: <span className={styles.count}>{type.value === "all" ? inRange.length : inRange.filter(event => event.type === type.value).length}</span>,
  })), [inRange]);
  const unread = events.filter(event => event.unread).length;

  // One hairline runs down the list; every row's dot is released exactly as the line reaches it.
  const markAllRead = () => {
    const ids = events.filter(event => event.unread).map(event => event.id);
    if (!ids.length) return;
    const node = list.current;
    const viewport = scroller.current;
    const delays: Record<string, number> = {};
    let duration = 0;
    if (node && viewport && !reduce) {
      const top = viewport.scrollTop;
      const span = Math.min(node.scrollHeight - top, viewport.clientHeight);
      duration = Math.max(700, Math.min(1100, 1.6 * span));
      const origin = node.getBoundingClientRect().top + top;
      node.querySelectorAll<HTMLElement>("[data-id]").forEach(row => {
        const offset = row.getBoundingClientRect().top - origin;
        const progress = Math.min(1, Math.max(0, offset / span));
        const id = row.dataset.id;
        if (id) delays[id] = Math.round(cubicBezier(progress) * duration);
      });
      sweepLine.current?.animate([
        { transform: `translateY(${top}px)`, opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { opacity: 1, offset: 0.88 },
        { transform: `translateY(${top + span}px)`, opacity: 0 },
      ], { duration, easing: `cubic-bezier(${SWEEP_EASE.join(",")})` });
    }
    setSweep({ delays, duration });
    setEvents(current => current.map(event => event.unread ? { ...event, unread: false } : event));
    onRead?.(ids);
    setStatus(`${ids.length} ${ids.length === 1 ? "update" : "updates"} marked read`);
    later(() => setSweep(null), duration + 600);
  };

  const showQueue = () => {
    if (!queue.length) return;
    const count = queue.length;
    setEvents(current => [...queue, ...current]);
    setQueue([]);
    setFilter("all");
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    setStatus(`${count} new ${count === 1 ? "update" : "updates"} shown`);
  };

  return <div className={`${styles.root} ${className ?? ""}`}>
    <div
      className={styles.frame}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2>{title}</h2>
          <span className={styles.unread}><span className={styles.inherit}><AnimatedCounter value={unread} /></span>{"\u00a0unread"}</span>
        </div>
        <button type="button" className={styles.markAll} onClick={markAllRead} disabled={!unread}>
          {unread ? <CheckCheck size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <TextMorph>{unread ? "Mark all read" : "All caught up"}</TextMorph>
        </button>
      </header>

      <div className={styles.filters}>
        <SegmentedControl className={styles.segment} options={options} value={filter} onValueChange={value => setFilter(value as "all" | ActivityType)} label="Filter by type" />
      </div>

      <AnimatePresence initial={false}>
        {queue.length > 0 && <motion.div
          className={styles.incoming}
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduce ? { duration: motionTokens.duration.fast } : {
            height: motionTokens.spring.smooth,
            opacity: { duration: motionTokens.duration.standard },
          }}
        >
          <div className={styles.incomingInner}>
            <button type="button" className={styles.pill} onClick={showQueue}>
              <span className={styles.stack} aria-hidden="true">
                <AnimatePresence initial={false}>
                  {queue.slice(0, 3).map(event => {
                    const actor = person(event.actor);
                    return <motion.span
                      key={event.id}
                      className={styles.stackItem}
                      layout={!reduce}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
                    >
                      <ArcImage src={actor.src} alt="" width={22} height={22} />
                    </motion.span>;
                  })}
                </AnimatePresence>
              </span>
              <span className={styles.pillText}>
                <span className={styles.inherit}><AnimatedCounter value={queue.length} /></span>
                {"\u00a0new\u00a0"}
                <TextMorph>{queue.length === 1 ? "update" : "updates"}</TextMorph>
              </span>
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>}
      </AnimatePresence>

      <div className={styles.main}>
        <div ref={scroller} className={styles.scroller}>
          <div ref={list} className={styles.list} data-sweeping={sweep ? "" : undefined}>
            <div ref={sweepLine} className={styles.sweepLine} aria-hidden="true" />
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={filter}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: motionTokens.duration.instant } : {
                  opacity: { duration: motionTokens.duration.fast },
                  y: motionTokens.spring.smooth,
                }}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {groups.map(([day, dayEvents]) => {
                    const date = new Date(`${today}T12:00:00Z`);
                    date.setUTCDate(date.getUTCDate() - day);
                    const label = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
                    const heading = day === 0 ? "Today" : day === 1 ? "Yesterday" : WEEKDAYS[date.getUTCDay()];
                    return <motion.section
                      key={day}
                      layout={reduce ? false : "position"}
                      className={styles.group}
                      aria-label={heading}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={reduce ? { duration: 0 } : {
                        layout: motionTokens.spring.smooth,
                        opacity: { duration: motionTokens.duration.standard },
                      }}
                    >
                      <h3 className={styles.day}><span>{heading}</span><span className={styles.dayDate}>{label}</span></h3>
                      <ol className={styles.items}>
                        <AnimatePresence initial={false} mode="popLayout">
                          {dayEvents.map(event => <Item
                            key={event.id}
                            item={event}
                            open={open.includes(event.id)}
                            sweepDelay={sweep?.delays[event.id]}
                            onToggle={() => {
                              setOpen(current => current.includes(event.id) ? current.filter(id => id !== event.id) : [...current, event.id]);
                              if (event.unread) {
                                setEvents(current => current.map(item => item.id === event.id ? { ...item, unread: false } : item));
                                onRead?.([event.id]);
                              }
                            }}
                            reduce={reduce}
                          />)}
                        </AnimatePresence>
                      </ol>
                    </motion.section>;
                  })}
                </AnimatePresence>
                {!groups.length && <div className={styles.empty}>
                  <p>Nothing of this type yet</p>
                  <button type="button" className={styles.emptyButton} onClick={() => setFilter("all")}>Show all activity</button>
                </div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
  </div>;
}

export default ActivityFeed;
