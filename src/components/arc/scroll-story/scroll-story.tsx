"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import { ArrowUpRight, Check, Copy, Send, TriangleAlert } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { person } from "../lib/media";
import type { PersonId } from "../lib/media";
import { useCopyFeedback } from "../lib/use-copy-feedback";
import styles from "./scroll-story.module.css";

/** One step of the story: a tab, the copy that scrolls on the left and the product status chip. */
export interface ScrollStoryStep {
  /** Stable id, used as the React key. */
  id: string;
  /** Tab label in the product card. */
  tab: string;
  /** Step heading in the scrolling copy. */
  title: string;
  /** Step paragraph in the scrolling copy. */
  body: string;
  /** Short status shown in the card header for this step. */
  status: string;
}

/** One request in the inbox: who sent it, through which channel, and the theme it sorts into. */
export interface ScrollStoryMessage {
  /** Stable id, used as the React key and the position lookup. */
  id: string;
  /** Person id resolved through the shared media library. */
  person: PersonId;
  /** Channel the request arrived through, e.g. `Email` or `Chat`. */
  source: string;
  /** The request, verbatim. */
  message: string;
  /** Theme name, matched against `ScrollStoryTheme["theme"]`. */
  theme: string;
}

/** A theme row in the trend panel. */
export interface ScrollStoryTheme {
  /** Theme name, also used as the tag on each message. */
  theme: string;
  /** Request count for the bar. */
  count: number;
}

/** Someone the trend can be shared with. */
export interface ScrollStoryMember {
  /** Person id resolved through the shared media library. */
  person: PersonId;
  /** Access label, e.g. `Owner` or `Can edit`. */
  access: string;
}

export interface ScrollStoryProps {
  /**
   * Renders without the block's own surface. The preview frame flattens the scrolling viewport.
   */
  flat?: boolean;
}

const { spring, duration, ease, blur } = motionTokens;

const EASE_IN = [...ease.enter] as [number, number, number, number];
const EASE_STANDARD = [...ease.standard] as [number, number, number, number];

/** Turns a visual duration and bounce into the stiffness and damping pair motion needs on retarget. */
const springFrom = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }): Transition => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const SNAP = springFrom({ visualDuration: 0.5, bounce: 0 });
const SMOOTH = springFrom(spring.smooth);
const SHEET = springFrom({ visualDuration: 0.46, bounce: 0 });

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** The four beats of the story. */
export const sampleSteps: ScrollStoryStep[] = [
  {
    id: "collect",
    tab: "Collect",
    title: "Every request in one place",
    body: "Beacon pulls feedback from email, chat, surveys, and call notes into a single inbox, with the customer and their plan attached to every message.",
    status: "6 new",
  },
  {
    id: "sort",
    tab: "Sort",
    title: "Sorted before you read it",
    body: "Each message is tagged by theme the moment it arrives, so related requests line up next to each other without anyone triaging the queue.",
    status: "3 themes",
  },
  {
    id: "measure",
    tab: "Measure",
    title: "See what is growing",
    body: "Themes turn into trends. Watch a request climb week over week and know when it has quietly become the next thing to build.",
    status: "Last 8 weeks",
  },
  {
    id: "share",
    tab: "Share",
    title: "Close the loop",
    body: "Send a live trend to your team or a channel. Everyone sees the same numbers, and they update as new feedback comes in.",
    status: "Shared view",
  },
];

/** The six requests that land in the inbox. */
export const sampleMessages: ScrollStoryMessage[] = [
  { id: "m1", person: "jasmine-brooks", source: "Email", message: "Can we export reports to CSV?", theme: "Export" },
  { id: "m2", person: "tyler-hayes", source: "Chat", message: "The iPhone app keeps logging me out", theme: "Mobile" },
  { id: "m3", person: "hannah-walsh", source: "Survey", message: "We need a PDF of each monthly invoice", theme: "Billing" },
  { id: "m4", person: "andre-williams", source: "Call notes", message: "Scheduled exports to our warehouse?", theme: "Export" },
  { id: "m5", person: "ava-mitchell", source: "Chat", message: "Offline mode for the Android app, please", theme: "Mobile" },
  { id: "m6", person: "nathan-cole", source: "Email", message: "Bulk export of every comment thread", theme: "Export" },
];

/** Theme counts for the bar list. The first entry also sets the bar scale. */
export const sampleThemes: ScrollStoryTheme[] = [
  { theme: "Export", count: 42 },
  { theme: "Mobile", count: 27 },
  { theme: "Billing", count: 12 },
];

/** Weekly export requests behind the trend line, oldest first. */
export const sampleTrend: number[] = [8, 11, 10, 15, 19, 18, 26, 31];

/** People the share sheet lists. */
export const sampleTeam: ScrollStoryMember[] = [
  { person: "olivia-bennett", access: "Owner" },
  { person: "marcus-johnson", access: "Can edit" },
  { person: "chloe-nguyen", access: "Can view" },
];

/** The share link, shown without a scheme. */
export const sampleLink = "beacon.example/t/export-requests";

const STEPS = sampleSteps;
const MESSAGES = sampleMessages;
const THEMES = sampleThemes;
const TREND = sampleTrend;
const TEAM = sampleTeam;
const LINK = sampleLink;

const CHART_W = 300;
const CHART_H = 96;
const TREND_MAX = 34;

const POINTS = TREND.map((value, index) => ({
  x: 6 + (288 * index) / (TREND.length - 1),
  y: 90 - (value / TREND_MAX) * 84,
}));

/** Catmull-Rom style cubic path through the weekly points, flat tangent at both ends. */
const PATH = (() => {
  let d = `M${POINTS[0].x},${POINTS[0].y}`;
  for (let index = 0; index < POINTS.length - 1; index += 1) {
    const before = POINTS[Math.max(0, index - 1)];
    const from = POINTS[index];
    const to = POINTS[index + 1];
    const after = POINTS[Math.min(POINTS.length - 1, index + 2)];
    const c1x = from.x + (to.x - before.x) / 6;
    const c1y = from.y + (to.y - before.y) / 6;
    const c2x = to.x - (after.x - from.x) / 6;
    const c2y = to.y - (after.y - from.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${to.x},${to.y}`;
  }
  return d;
})();

const LAST_POINT = POINTS[POINTS.length - 1];

interface InboxProps {
  active: number;
  arrived: number;
  compact: boolean;
  reduced: boolean;
}

interface TrendProps {
  active: number;
  progress: MotionValue<number>;
  reduced: boolean;
}

interface ShareSheetProps {
  open: boolean;
  reduced: boolean;
}

interface TabProps {
  index: number;
  label: string;
  selected: boolean;
  progress: MotionValue<number>;
  reduced: boolean;
  onSelect: () => void;
}

/**
 * The inbox panel: messages arrive one at a time, then sort into theme groups, then dim out of the way.
 */
const Inbox = memo(function Inbox({ active, arrived, compact, reduced }: InboxProps) {
  const sorted = active >= 1;
  const dimmed = active >= 2;
  const row = compact ? 36 : 40;

  const layout = useMemo(() => {
    const positions = new Map<string, { y: number; order: number }>();
    const headers: { theme: string; count: number; y: number }[] = [];
    if (!sorted) {
      MESSAGES.forEach((message, index) => {
        positions.set(message.id, { y: index * (row + 4), order: index });
      });
      return { positions, headers };
    }
    let y = 0;
    let order = 0;
    for (const { theme } of THEMES) {
      const group = MESSAGES.filter(message => message.theme === theme);
      headers.push({ theme, count: group.length, y });
      y += 24;
      for (const message of group) {
        positions.set(message.id, { y, order });
        order += 1;
        y += row + 4;
      }
    }
    return { positions, headers };
  }, [sorted, row]);

  return (
    <div className={styles.inbox} aria-hidden={dimmed || undefined}>
      <p className={styles.srOnly}>
        {sorted
          ? "Inbox sorted by theme: Export has 3 messages, Mobile 2, Billing 1."
          : `Inbox with ${arrived} new messages.`}
      </p>

      <AnimatePresence initial={false}>
        {layout.headers.map(header => (
          <motion.p
            key={header.theme}
            className={styles.group}
            initial={reduced ? { opacity: 0, y: header.y } : { opacity: 0, x: -6, y: header.y }}
            animate={{ opacity: dimmed ? 0 : 1, x: 0, y: header.y }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.fast, ease: EASE_STANDARD } }}
            transition={
              reduced
                ? { duration: duration.fast }
                : { opacity: { duration: duration.standard, delay: dimmed ? 0 : 0.18 }, x: SMOOTH, y: SNAP }
            }
          >
            {header.theme}
            <span className={styles.groupCount}>{header.count}</span>
          </motion.p>
        ))}
      </AnimatePresence>

      {MESSAGES.map((message, index) => {
        const visible = !dimmed && (sorted || index < arrived);
        const position = layout.positions.get(message.id) ?? { y: 0, order: index };
        const member = person(message.person);
        return (
          <motion.div
            key={message.id}
            className={styles.row}
            style={{ height: row }}
            aria-hidden="true"
            initial={false}
            animate={{
              y: position.y + (visible || reduced ? 0 : dimmed ? -10 : 10),
              opacity: visible ? 1 : 0,
              scale: visible || reduced ? 1 : 0.98,
            }}
            transition={
              reduced
                ? { duration: duration.fast }
                : {
                    y: { ...SNAP, delay: dimmed ? 0.025 * index : sorted ? 0.035 * position.order : 0 },
                    scale: SMOOTH,
                    opacity: {
                      duration: duration.standard,
                      ease: visible ? EASE_IN : EASE_STANDARD,
                      delay: dimmed ? 0.025 * index : 0,
                    },
                  }
            }
          >
            <img className={styles.avatar} src={member.src} alt="" width={28} height={28} loading="lazy" decoding="async" />
            <span className={styles.rowText}>
              <span className={styles.rowTop}>
                <span className={styles.rowName}>{member.name}</span>
                <span className={styles.rowSource}>{message.source}</span>
              </span>
              <span className={styles.rowMessage}>{message.message}</span>
            </span>
            <motion.span
              className={styles.tag}
              initial={false}
              animate={{ opacity: sorted ? 1 : 0, scale: sorted || reduced ? 1 : 0.9 }}
              transition={
                reduced
                  ? { duration: duration.fast }
                  : {
                      ...SMOOTH,
                      opacity: { duration: duration.fast, delay: sorted ? 0.1 + 0.035 * position.order : 0 },
                    }
              }
            >
              {message.theme}
            </motion.span>
          </motion.div>
        );
      })}
    </div>
  );
});

/**
 * The trend panel: the weekly line draws itself, the counter climbs to the latest week and the bars grow.
 */
const Trend = memo(function Trend({ active, progress, reduced }: TrendProps) {
  const show = active >= 2;
  const faded = active === 3;
  const draw = useTransform(progress, [2.02, 2.7], [0, 1]);
  const dot = useTransform(draw, [0.94, 1], [0, 1]);
  const counter = useMotionValue(0);
  const label = useTransform(counter, value => Math.round(value).toString());

  useLayoutEffect(() => {
    const target = show ? TREND[TREND.length - 1] : 0;
    if (reduced) {
      counter.jump(target);
      return;
    }
    const controls = animate(counter, target, { duration: show ? 0.9 : 0.2, ease: EASE_IN });
    return () => controls.stop();
  }, [show, reduced, counter]);

  return (
    <motion.div
      className={styles.trend}
      aria-hidden={!show || undefined}
      initial={false}
      animate={{ opacity: show ? (faded ? 0.45 : 1) : 0, y: show || reduced ? 0 : 12, scale: faded && !reduced ? 0.96 : 1 }}
      transition={
        reduced
          ? { duration: duration.fast }
          : { opacity: { duration: duration.standard, delay: show && !faded ? 0.18 : 0 }, y: SMOOTH, scale: SMOOTH }
      }
    >
      <div className={styles.trendHead}>
        <div>
          <p className={styles.trendLabel}>Export requests per week</p>
          <p className={styles.trendValue}>
            <motion.span className={styles.num}>{label}</motion.span>
            <span className={styles.srOnly}>{TREND[TREND.length - 1]} this week</span>
            <span className={styles.trendUnit} aria-hidden="true">
              this week
            </span>
          </p>
        </div>
        <p className={styles.delta}>
          <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
          288%<span className={styles.deltaNote}>since July</span>
        </p>
      </div>

      <div className={styles.chartBox}>
        <svg className={styles.chart} viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true">
          {[0.25, 0.5, 0.75].map(fraction => (
            <line
              key={fraction}
              x1={0}
              x2={CHART_W}
              y1={CHART_H * fraction}
              y2={CHART_H * fraction}
              className={styles.gridLine}
            />
          ))}
          <motion.path
            d={PATH}
            className={styles.line}
            style={{ pathLength: reduced ? 1 : draw }}
          />
        </svg>
        <div className={styles.chartDotLayer} aria-hidden="true">
          <motion.span
            className={styles.chartDot}
            style={{
              left: `${(LAST_POINT.x / CHART_W) * 100}%`,
              top: `${(LAST_POINT.y / CHART_H) * 100}%`,
              opacity: reduced ? (show ? 1 : 0) : dot,
            }}
          />
        </div>
      </div>

      <ul className={styles.bars}>
        {THEMES.map((theme, index) => (
          <li key={theme.theme} className={styles.bar}>
            <span className={styles.barLabel}>{theme.theme}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <motion.span
                className={styles.barFill}
                initial={false}
                animate={{ scaleX: show ? theme.count / THEMES[0].count : 0 }}
                transition={
                  reduced ? { duration: 0 } : { ...SMOOTH, delay: show ? 0.3 + 0.06 * index : 0 }
                }
              />
            </span>
            <span className={styles.barValue}>{theme.count}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
});

/** The drawn check mark used by the copy button. */
function CheckMark({ on, reduced }: { on: boolean; reduced: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={false}
        animate={{ pathLength: on || reduced ? 1 : 0 }}
        transition={on ? { duration: 0.22, ease: EASE_STANDARD, delay: 0.04 } : { duration: 0, delay: 0.12 }}
      />
    </svg>
  );
}

/**
 * Cross-fades three stacked labels inside a fixed-width box, so the button never changes width as the state
 * changes.
 */
function CopyLayers({ shown, reduced, children }: { shown: number; reduced: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const width = useMotionValue(0);
  const animated = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidths(Array.from(node.children, child => (child as HTMLElement).offsetWidth));
    measure();
    const observer = new ResizeObserver(measure);
    Array.from(node.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  const target = widths[shown];

  useLayoutEffect(() => {
    if (!target) return;
    if (!animated.current || reduced) {
      animated.current = true;
      width.jump(target);
      return;
    }
    const controls = animate(width, target, { type: "spring", visualDuration: 0.22, bounce: 0 });
    return () => controls.stop();
  }, [target, reduced, width]);

  return (
    <motion.span ref={ref} className={styles.copyLayers} style={target ? { width } : undefined}>
      {children}
    </motion.span>
  );
}

/** The share sheet: the team, a copyable link and a simulated send. */
const ShareSheet = memo(function ShareSheet({ open, reduced }: ShareSheetProps) {
  const { state: copyState, copy } = useCopyFeedback();
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const send = () => {
    if (timer.current) clearTimeout(timer.current);
    const next = sendState === "idle" ? "sending" : "idle";
    setSendState(next);
    if (next === "sending") {
      timer.current = setTimeout(() => setSendState("sent"), 700);
    }
  };

  return (
    <motion.div
      className={styles.sheet}
      role="group"
      aria-label="Share the export trend"
      aria-hidden={!open || undefined}
      inert={!open}
      initial={false}
      animate={{ y: open || reduced ? 0 : "108%", opacity: open ? 1 : reduced ? 0 : 1 }}
      transition={reduced ? { duration: duration.fast } : { y: open ? SHEET : SMOOTH, opacity: { duration: duration.fast } }}
    >
      <p className={styles.sheetTitle}>Share “Export requests”</p>

      <ul className={styles.team}>
        {TEAM.map(entry => {
          const member = person(entry.person);
          return (
            <li key={entry.person} className={styles.member}>
              <img className={styles.avatar} src={member.src} alt="" width={28} height={28} loading="lazy" decoding="async" />
              <span className={styles.memberName}>{member.name}</span>
              <span className={styles.memberAccess}>{entry.access}</span>
            </li>
          );
        })}
      </ul>

      <div className={styles.linkRow}>
        <span className={styles.link}>{LINK}</span>
        <button
          type="button"
          className={styles.ghostButton}
          data-state={copyState}
          onClick={() => void copy(`https://${LINK}`, "link")}
        >
          <CopyLayers shown={copyState === "copied" ? 1 : copyState === "error" ? 2 : 0} reduced={reduced}>
            <span className={styles.copyLayer} data-on={copyState === "idle" || undefined}>
              <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
              Copy link
            </span>
            <span className={styles.copyLayer} data-on={copyState === "copied" || undefined}>
              <CheckMark on={copyState === "copied"} reduced={reduced} />
              Copied
            </span>
            <span className={styles.copyLayer} data-on={copyState === "error" || undefined}>
              <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
              Not copied
            </span>
          </CopyLayers>
          <span className={styles.srOnly} aria-live="polite">
            {copyState === "copied" ? "Link copied" : copyState === "error" ? "Could not copy the link" : ""}
          </span>
        </button>
      </div>

      <button type="button" className={styles.sendButton} data-state={sendState} onClick={send}>
        <span className={styles.layers}>
          <span className={styles.layer} data-on={sendState === "idle" || undefined}>
            <Send size={14} strokeWidth={1.75} aria-hidden="true" />
            Send to #product-feedback
          </span>
          <span className={styles.layer} data-on={sendState === "sending" || undefined}>
            <span className={styles.spinner} aria-hidden="true" />
            Sending
          </span>
          <span className={styles.layer} data-on={sendState === "sent" || undefined}>
            <Check size={14} strokeWidth={1.75} aria-hidden="true" />
            Sent
          </span>
        </span>
        <span className={styles.srOnly} aria-live="polite">
          {sendState === "sent" ? "Sent to product feedback" : ""}
        </span>
      </button>
    </motion.div>
  );
});

/** One tab: the label and the progress rule under it. */
function Tab({ index, label, selected, progress, reduced, onSelect }: TabProps) {
  const fill = useTransform(progress, [index, index + 1], [0, 1]);
  const reached = useTransform(progress, value => (value >= index ? 1 : 0));
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={styles.tab}
      onClick={onSelect}
    >
      <span className={styles.tabLabel}>{label}</span>
      <span className={styles.tabTrack} aria-hidden="true">
        <motion.span className={styles.tabFill} style={{ scaleX: reduced ? reached : fill }} />
      </span>
    </button>
  );
}

/**
 * A feature section where scrolling the copy drives a pinned product view through four steps: messages arrive,
 * sort by theme, fold into a trend and end in a share sheet.
 */
export function ScrollStory({ flat = false }: ScrollStoryProps) {
  const reduced = useReducedMotion() ?? false;
  const headingId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const activeRef = useRef(0);
  const progress = useMotionValue(0);

  const [active, setActive] = useState(0);
  const [arrived, setArrived] = useState(3);
  const [compact, setCompact] = useState(false);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const visual = visualRef.current;
    if (!viewport || !visual) return;
    const frame = viewport.getBoundingClientRect();
    const column = visual.getBoundingClientRect();
    const anchor = column.width > frame.width * 0.75 ? (column.bottom + frame.bottom) / 2 : frame.top + frame.height / 2;

    let value = 0;
    stepRefs.current.forEach((node, index) => {
      if (!node) return;
      const box = node.getBoundingClientRect();
      if (anchor >= box.top) value = index + clamp((anchor - box.top) / box.height);
    });
    progress.set(value);

    const nextActive = Math.min(STEPS.length - 1, Math.floor(value));
    if (nextActive !== activeRef.current) {
      activeRef.current = nextActive;
      setActive(nextActive);
    }
    const nextArrived = nextActive >= 1 ? MESSAGES.length : clamp(3 + Math.floor(5 * value), 3, MESSAGES.length);
    setArrived(current => (current === nextArrived ? current : nextArrived));
  }, [progress]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      setCompact(entry.contentRect.width < 700);
      measure();
    });
    observer.observe(viewport);
    measure();
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure]);

  const goToStep = useCallback(
    (index: number) => {
      const viewport = viewportRef.current;
      const visual = visualRef.current;
      const target = stepRefs.current[index];
      if (!viewport || !visual || !target) return;
      const frame = viewport.getBoundingClientRect();
      const column = visual.getBoundingClientRect();
      const anchor = column.width > frame.width * 0.75 ? (column.bottom + frame.bottom) / 2 : frame.top + frame.height / 2;
      const box = target.getBoundingClientRect();
      viewport.scrollBy({
        top: box.top + Math.min(box.height * 0.35, 120) - anchor,
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [reduced],
  );

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = STEPS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(last, active + 1)
        : event.key === "ArrowLeft"
          ? Math.max(0, active - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    goToStep(next);
    const list = event.currentTarget;
    const tab = list.children[next];
    if (tab instanceof HTMLElement) tab.focus();
  };

  const step = STEPS[active];

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-label="Beacon product story, scroll to advance"
        data-frame-flat={flat ? "" : undefined}
        style={
          flat
            ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" }
            : undefined
        }
      >
        <div className={styles.track}>
          <div ref={visualRef} className={styles.visualCol}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.brand}>
                  <span className={styles.mark} aria-hidden="true" />
                  Beacon
                </span>
                <span className={styles.status} aria-live="polite">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={step.id}
                      className={styles.statusItem}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${blur.subtle}px)` }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                      exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.instant } }}
                      transition={{ duration: reduced ? 0 : duration.standard, ease: EASE_IN }}
                    >
                      {step.status}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>

              <div className={styles.tabs} role="tablist" aria-label="Story steps" onKeyDown={onTabKeyDown}>
                {STEPS.map((entry, index) => (
                  <Tab
                    key={entry.id}
                    index={index}
                    label={entry.tab}
                    selected={index === active}
                    progress={progress}
                    reduced={reduced}
                    onSelect={() => goToStep(index)}
                  />
                ))}
              </div>

              <div className={styles.canvas} data-compact={compact || undefined}>
                <Inbox active={active} arrived={arrived} compact={compact} reduced={reduced} />
                <Trend active={active} progress={progress} reduced={reduced} />
                <ShareSheet open={active === 3} reduced={reduced} />
              </div>
            </div>
          </div>

          <div className={styles.copy}>
            <header className={styles.intro}>
              <h2 id={headingId} className={styles.heading}>
                From scattered feedback to a clear next step
              </h2>
              <p className={styles.lede}>Beacon collects what customers ask for and shows you what matters most.</p>
            </header>
            <ol className={styles.steps}>
              {STEPS.map((entry, index) => (
                <li
                  key={entry.id}
                  ref={node => {
                    stepRefs.current[index] = node;
                  }}
                  className={styles.step}
                  data-active={index === active || undefined}
                  aria-current={index === active ? "step" : undefined}
                >
                  <h3 className={styles.stepTitle}>{entry.title}</h3>
                  <p className={styles.stepBody}>{entry.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ScrollStory;
