"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, CircleAlert, MicOff, RotateCcw } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import styles from "./meeting-summary.module.css";

export type MeetingPlatform = "google-meet" | "zoom" | "other";
export type SendTarget = "linear" | "notion";
export type SummaryStatus = "summarizing" | "ready" | "error";

export interface MeetingQuote {
  speakerId: string;
  /** Seconds into the call. */
  at: number;
  text: string;
}

export interface MeetingAttendee {
  id: string;
  name: string;
  avatar?: string;
}

export interface MeetingPoint {
  id: string;
  text: string;
  quote?: MeetingQuote;
}

export interface MeetingActionItem extends MeetingPoint {
  ownerId?: string;
  /** ISO date, `YYYY-MM-DD`. */
  due?: string;
  done?: boolean;
}

export interface MeetingSummaryMeeting {
  title: string;
  platform: MeetingPlatform;
  /** Local ISO timestamp without a zone, `YYYY-MM-DDTHH:mm`. */
  startsAt: string;
  durationMinutes: number;
  transcriptWords?: number;
  attendees: MeetingAttendee[];
  summary: MeetingPoint[];
  decisions: MeetingPoint[];
  actionItems: MeetingActionItem[];
}

export interface SendState {
  status: "idle" | "sending" | "sent" | "failed";
  result?: { reference?: string; url?: string };
}

export interface MeetingSummaryProps {
  meeting?: MeetingSummaryMeeting;
  status?: SummaryStatus;
  error?: string;
  autoPlay?: boolean;
  streamIn?: boolean;
  model?: { name: string; icon: ReactNode } | null;
  sendTargets?: SendTarget[];
  onSend?: (item: MeetingActionItem, target: SendTarget, signal: AbortSignal) => Promise<SendState["result"] | void> | SendState["result"] | void;
  onActionItemChange?: (item: MeetingActionItem, done: boolean) => void;
  onRegenerate?: () => void;
  className?: string;
}

const cx = (...values: Array<string | false | undefined | null>) => values.filter(Boolean).join(" ");

const SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const ENTER = { duration: 0.16, ease: [0.22, 1, 0.36, 1] } as const;
const EXIT = { duration: 0.1, ease: [0.22, 1, 0.36, 1] } as const;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Chunk sizes the summary streams in at, cycled so paragraphs break at uneven points. */
const CHUNK_SIZES = [4, 6, 3, 5, 7, 4, 5, 8, 3, 6];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TARGETS: SendTarget[] = ["linear", "notion"];
const TARGET_NAMES: Record<SendTarget, string> = { linear: "Linear", notion: "Notion" };
const PLATFORM_NAMES: Record<MeetingPlatform, string> = { "google-meet": "Google Meet", zoom: "Zoom", other: "Meeting" };

const pad = (value: number) => String(value).padStart(2, "0");

/** Seconds into the call as `mm:ss`, or `h:mm:ss` once it runs past an hour. */
export function timestamp(value: number) {
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${pad(minutes)}:${pad(total % 60)}`;
}

/** `2026-10-30` as `Oct 30`. */
export function shortDate(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return month && day ? `${MONTHS[month - 1]} ${day}` : value;
}

/** Local start and end clock of a call, plus the weekday heading it is filed under. */
export function meetingWhen(startsAt: string, durationMinutes: number) {
  const [date, clock = "00:00"] = startsAt.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const end = (60 * hour + minute + durationMinutes) % 1440;
  return {
    day: `${weekday}, ${MONTHS[month - 1]} ${day}`,
    range: `${pad(hour)}:${pad(minute)} to ${pad(Math.floor(end / 60))}:${pad(end % 60)}`,
  };
}

interface Chunk {
  text: string;
  tick: number;
}

interface ChunkPlan {
  chunks: Map<string, Chunk[]>;
  sectionTick: Record<string, number>;
  total: number;
}

/** Splits every line into the chunk order the notes stream in at, one tick per chunk. */
export function planChunks(meeting: MeetingSummaryMeeting): ChunkPlan {
  const chunks = new Map<string, Chunk[]>();
  const sectionTick: Record<string, number> = {};
  let tick = 0;
  let cursor = 0;
  const sections: Array<[string, MeetingPoint[]]> = [
    ["summary", meeting.summary],
    ["decisions", meeting.decisions],
    ["actions", meeting.actionItems],
  ];
  for (const [key, items] of sections) {
    if (!items.length) continue;
    if (tick > 0) tick += 3;
    sectionTick[key] = tick++;
    for (const item of items) {
      const words = item.text.split(/\s+/).filter(Boolean);
      const parts: Chunk[] = [];
      for (let index = 0; index < words.length; ) {
        const size = CHUNK_SIZES[cursor++ % CHUNK_SIZES.length];
        parts.push({ text: words.slice(index, index + size).join(" ") + (index + size < words.length ? " " : ""), tick: tick++ });
        index += size;
      }
      chunks.set(item.id, parts);
    }
  }
  return { chunks, sectionTick, total: tick };
}

export const MEETING: MeetingSummaryMeeting = {
  title: "Annual billing launch review",
  platform: "google-meet",
  startsAt: "2026-10-27T10:00",
  durationMinutes: 42,
  transcriptWords: 6214,
  attendees: [
    { id: "diane", name: "Diane Foster", avatar: "/media/people/diane-foster.svg" },
    { id: "nathan", name: "Nathan Cole", avatar: "/media/people/nathan-cole.svg" },
    { id: "jasmine", name: "Jasmine Brooks", avatar: "/media/people/jasmine-brooks.svg" },
    { id: "marcus", name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.svg" },
    { id: "andre", name: "Andre Williams", avatar: "/media/people/andre-williams.svg" },
    { id: "chloe", name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.svg" },
    { id: "ava", name: "Ava Mitchell", avatar: "/media/people/ava-mitchell.svg" },
  ],
  summary: [
    {
      id: "s1",
      text: "Annual plans converted at 31% in the pricing test, against 22% for monthly, with trial starts flat.",
      quote: {
        speakerId: "chloe",
        at: 252,
        text: "Across 11,400 visitors the annual arm converts at 31 percent. Trial starts are flat, so we're not scaring anyone off.",
      },
    },
    {
      id: "s2",
      text: "Annual churn can't be read until next year, so 60-day refunds will stand in as the signal.",
      quote: {
        speakerId: "andre",
        at: 698,
        text: "We won't see real annual churn until next October. Refunds in the first 60 days are the best proxy we have.",
      },
    },
    {
      id: "s3",
      text: "The new billing toggle tested well, but the savings label read like a coupon on mobile.",
      quote: {
        speakerId: "jasmine",
        at: 1085,
        text: "Four of the six people on mobile read 'save 20%' as a coupon code, not as the annual discount.",
      },
    },
    {
      id: "s4",
      text: "Engineering can ship behind the pricing-v3 flag by November 4 if price IDs land this week.",
      quote: {
        speakerId: "nathan",
        at: 1607,
        text: "If finance gets us the new price IDs by Friday, Marcus can have it behind the flag by the fourth.",
      },
    },
  ],
  decisions: [
    {
      id: "d1",
      text: "Launch annual billing at 20% off, worded as two months free.",
      quote: { speakerId: "diane", at: 1880, text: "Let's go with two months free. Same discount, and nobody reads it as a coupon." },
    },
    {
      id: "d2",
      text: "Roll out to half of new visitors first, then everyone after two clean weeks.",
      quote: { speakerId: "diane", at: 2042, text: "Fifty percent of new traffic first. If refunds look normal for two weeks, we open it up." },
    },
    {
      id: "d3",
      text: "Existing monthly customers get an in-app offer instead of an email blast.",
      quote: {
        speakerId: "ava",
        at: 2235,
        text: "An in-app banner on the billing page will convert better than another email, and it's easier to target.",
      },
    },
  ],
  actionItems: [
    {
      id: "a1",
      text: "Create annual price IDs in Stripe for all three tiers",
      ownerId: "andre",
      due: "2026-10-30",
      quote: { speakerId: "andre", at: 1652, text: "I'll set up the three annual prices in Stripe and send the IDs over by Friday." },
    },
    {
      id: "a2",
      text: "Ship the billing toggle behind the pricing-v3 flag",
      ownerId: "marcus",
      due: "2026-11-04",
      quote: { speakerId: "marcus", at: 1694, text: "Once I have the IDs it's a day of work. I'll keep it behind pricing-v3 until we flip it." },
    },
    {
      id: "a3",
      text: "Rewrite the savings label as two months free on mobile",
      ownerId: "jasmine",
      due: "2026-10-29",
      quote: { speakerId: "jasmine", at: 1931, text: "I'll update the label in the toggle and the mobile sheet today or tomorrow." },
    },
    {
      id: "a4",
      text: "Build a 60-day refund dashboard for annual plans",
      ownerId: "chloe",
      due: "2026-11-06",
      quote: { speakerId: "chloe", at: 2310, text: "I can have a refund view for annual cohorts in Metabase by next Friday." },
    },
  ],
};

export const EMPTY_MEETING: MeetingSummaryMeeting = {
  ...MEETING,
  transcriptWords: 0,
  summary: [],
  decisions: [],
  actionItems: [],
};

/** Sizes the shell to its content and springs between heights, snapping on width changes. */
function useSize(dimension: "height" | "width", reduced: boolean) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const shell = outer.current;
    const content = inner.current;
    if (!shell || !content || typeof ResizeObserver === "undefined") return;
    const measure = () => (dimension === "height" ? content.offsetHeight : content.offsetWidth);
    const cross = () => (dimension === "height" ? content.offsetWidth : content.offsetHeight);
    let current = measure();
    let crossCurrent = cross();
    let controls: ReturnType<typeof animate> | undefined;
    const snap = () => {
      shell.style[dimension] = "";
      shell.style.overflow = "";
      controls = undefined;
    };
    const observer = new ResizeObserver(() => {
      const next = measure();
      const nextCross = cross();
      const widthChanged = dimension === "height" && nextCross !== crossCurrent;
      crossCurrent = nextCross;
      if (next === current) return;
      const from = controls ? shell.getBoundingClientRect()[dimension] : current;
      current = next;
      controls?.stop();
      if (reduced || widthChanged) snap();
      else {
        shell.style.overflow = "hidden";
        controls = animate(shell, { [dimension]: [from, next] }, { ...SPRING, onComplete: snap });
      }
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [dimension, reduced]);
  return { outer, inner };
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className={styles.spinner} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Checkbox({
  checked,
  onCheckedChange,
  label,
  reduced,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  reduced: boolean;
}) {
  const instant = { duration: 0 };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={styles.checkbox}
      data-checked={checked || undefined}
      onClick={() => onCheckedChange(!checked)}
    >
      <motion.span
        className={styles.checkFill}
        aria-hidden="true"
        initial={false}
        animate={{ opacity: +!!checked, scale: checked ? 1 : 0.6 }}
        transition={reduced ? instant : { duration: checked ? 0.16 : 0.12, ease: EASE }}
      />
      <svg className={styles.checkMark} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <motion.path
          d="M4.25 8.25 L6.75 10.75 L11.75 5.5"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: +!!checked, opacity: +!!checked }}
          transition={
            reduced
              ? instant
              : {
                  pathLength: { duration: checked ? 0.2 : 0.1, delay: 0.04 * +!!checked, ease: EASE },
                  opacity: { duration: checked ? 0.04 : 0.1, delay: 0.04 * +!!checked },
                }
          }
        />
      </svg>
    </button>
  );
}

function GoogleMeetIcon({ title = "Google Meet" }: { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} width={20} height={20}>
      <path fill="#EA4335" d="M5.53 2.13 0 7.75h5.53z" />
      <path fill="#FFBA00" d="M5.928 2.13v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36z" />
      <path
        fill="#00832D"
        d="M23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.12-7.468 6.19 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825z"
      />
      <path fill="#2684FC" d="M.038 8.15v7.7h5.53v-7.7z" />
      <path fill="#00AC47" d="M13.615 16.25H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65z" />
      <path fill="#0066DA" d="M.038 16.25c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z" />
    </svg>
  );
}

function ZoomIcon({ title = "Zoom" }: { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} width={20} height={20}>
      <rect width="24" height="24" rx="6.5" fill="#0B5CFF" />
      <rect x="4.6" y="7.6" width="10.4" height="8.8" rx="2.2" fill="#fff" />
      <path fill="#fff" d="m16.1 10.7 2.55-1.86c.42-.3.85-.08.85.44v5.44c0 .52-.43.74-.85.44l-2.55-1.86z" />
    </svg>
  );
}

function LinearIcon({ title = "Linear", size = 14 }: { title?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} width={size} height={size} aria-hidden="true">
      <path
        fill="#5E6AD2"
        d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"
      />
    </svg>
  );
}

function NotionIcon({ title = "Notion", size = 14 }: { title?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} width={size} height={size} aria-hidden="true">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

export const CLAUDE_MODEL = {
  name: "Claude Sonnet 5.5",
  icon: (
    <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label="Claude" width={14} height={14} aria-hidden="true">
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  ),
};

function PlatformIcon({ platform }: { platform: MeetingPlatform }) {
  if (platform === "google-meet") return <GoogleMeetIcon />;
  if (platform === "zoom") return <ZoomIcon />;
  return null;
}

function TargetIcon({ target, size = 14 }: { target: SendTarget; size?: number }) {
  return target === "linear" ? <LinearIcon size={size} /> : <NotionIcon size={size} />;
}

/** The action-item progress counter, rolling each digit as it changes. */
function Count({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <span className={styles.count}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={!reduced && { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: ENTER }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -2, transition: EXIT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A line that streams in chunk by chunk while the notes are being written. */
function Chunks({ text, chunks, tick }: { text: string; chunks?: Chunk[]; tick: number | null }) {
  if (tick === null || !chunks) return <>{text}</>;
  return (
    <>
      {chunks
        .filter((chunk) => chunk.tick <= tick)
        .map((chunk, index) => (
          <span className={styles.chunk} key={index}>
            {chunk.text}
          </span>
        ))}
    </>
  );
}

function Quote({ id, quote, speaker }: { id: string; quote: MeetingQuote; speaker?: MeetingAttendee }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [above, setAbove] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.getBoundingClientRect().bottom > window.innerHeight - 12) setAbove(true);
  }, []);
  return (
    <motion.div
      ref={ref}
      id={id}
      role="tooltip"
      className={styles.quote}
      data-above={above || undefined}
      initial={{ opacity: 0, y: above ? 3 : -3 }}
      animate={{ opacity: 1, y: 0, transition: ENTER }}
      exit={{ opacity: 0, transition: EXIT }}
    >
      <div className={styles.quoteHead}>
        {speaker ? <Avatar name={speaker.name} src={speaker.avatar} size="sm" className={styles.quoteAvatar} /> : null}
        <span className={styles.quoteName}>{speaker?.name ?? "Speaker"}</span>
        <span className={styles.quoteTime}>{timestamp(quote.at)}</span>
      </div>
      <p className={styles.quoteText}>{`“${quote.text}”`}</p>
    </motion.div>
  );
}

interface QuoteControl {
  active: string | null;
  enter: (id: string) => void;
  leave: () => void;
  focus: (id: string) => void;
  toggle: (id: string) => void;
}

function QuoteTimestamp({ id, quote, control, quoteId }: { id: string; quote: MeetingQuote; control: QuoteControl; quoteId: string }) {
  const open = control.active === id;
  return (
    <button
      type="button"
      className={styles.timestamp}
      aria-label={`Transcript quote at ${timestamp(quote.at)}`}
      aria-expanded={open}
      aria-describedby={open ? quoteId : undefined}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) control.focus(id);
      }}
      onBlur={control.leave}
      onClick={() => control.toggle(id)}
    >
      {timestamp(quote.at)}
    </button>
  );
}

function SendAction({
  item,
  target,
  state,
  onSend,
  reduced,
}: {
  item: MeetingActionItem;
  target: SendTarget;
  state?: SendState;
  onSend: () => void;
  reduced: boolean;
}) {
  const { outer, inner } = useSize("width", reduced);
  const name = TARGET_NAMES[target];
  const status = state?.status ?? "idle";
  const fade = {
    initial: !reduced && { opacity: 0 },
    animate: { opacity: 1, transition: ENTER },
    exit: { opacity: 0, transition: reduced ? { duration: 0 } : EXIT },
  };
  let content;
  if (status === "sent") {
    const reference = state?.result?.reference ?? (target === "linear" ? "Created" : "Added");
    const label = `Sent to ${name}${state?.result?.reference ? ` as ${state.result.reference}` : ""}`;
    const body = (
      <>
        <TargetIcon target={target} />
        <span className={styles.sentRef}>{reference}</span>
        <Check className={styles.sentCheck} size={12} strokeWidth={2.25} aria-hidden="true" />
      </>
    );
    content = (
      <motion.span className={styles.sentWrap} {...fade} key="sent">
        {state?.result?.url ? (
          <a className={styles.sent} href={state.result.url} target="_blank" rel="noreferrer" aria-label={`${label}, open in ${name}`}>
            {body}
          </a>
        ) : (
          <span className={styles.sent} role="status" aria-label={label}>
            {body}
          </span>
        )}
      </motion.span>
    );
  } else {
    const label = status === "failed" ? `Couldn't send to ${name}. Retry` : status === "sending" ? `Sending to ${name}` : `Send to ${name}`;
    content = (
      <motion.span className={styles.sentWrap} {...fade} key="button">
        <Tooltip content={label}>
          <Button
            variant="ghost"
            size="sm"
            className={styles.iconButton}
            aria-label={`${label}: ${item.text}`}
            aria-busy={status === "sending" || undefined}
            data-view={status}
            onClick={() => {
              if (status !== "sending") onSend();
            }}
          >
            <span className={styles.iconSwap}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span className={styles.iconSlot} data-view={status} key={status} {...fade}>
                  {status === "sending" ? <Spinner size={14} /> : status === "failed" ? <CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> : <TargetIcon target={target} />}
                </motion.span>
              </AnimatePresence>
            </span>
          </Button>
        </Tooltip>
      </motion.span>
    );
  }
  return (
    <div ref={outer} className={styles.sizer}>
      <div ref={inner} className={styles.sizerInner}>
        <AnimatePresence initial={false} mode="popLayout">
          {content}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function MeetingSummary({
  meeting,
  status: statusProp,
  error,
  autoPlay = true,
  streamIn = true,
  model = CLAUDE_MODEL,
  sendTargets = TARGETS,
  onSend,
  onActionItemChange,
  onRegenerate,
  className,
}: MeetingSummaryProps) {
  const data = meeting ?? MEETING;
  const isDefault = meeting === undefined && statusProp === undefined && onSend === undefined;
  const reduced = useReducedMotion() ?? false;
  const baseId = useId();
  const quoteId = `${baseId}-quote`;
  const rootRef = useRef<HTMLElement | null>(null);

  const [autoStatus, setAutoStatus] = useState<SummaryStatus>(autoPlay ? "summarizing" : "ready");
  const status = statusProp ?? autoStatus;
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reveal, setReveal] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, SendState>>({});
  const [announcement, setAnnouncement] = useState(status === "summarizing" ? "Summarizing transcript" : "");
  const [active, setActive] = useState<string | null>(null);

  const sentRef = useRef(sent);
  useLayoutEffect(() => {
    sentRef.current = sent;
  });
  const inFlight = useRef(new Set<AbortController>());
  const interacted = useRef(false);
  const autoSent = useRef(false);
  const autoChecked = useRef(false);
  const pinned = useRef(false);
  const enterTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);
  const ticket = useRef(141);

  const attendees = useMemo(() => new Map(data.attendees.map((person) => [person.id, person])), [data.attendees]);
  const plan = useMemo(() => planChunks(data), [data]);
  const when = meetingWhen(data.startsAt, data.durationMinutes);
  const { outer: bodyOuter, inner: bodyInner } = useSize("height", reduced);
  const done = useMemo(
    () => Object.fromEntries(data.actionItems.map((item) => [item.id, checked[item.id] ?? !!item.done])),
    [data.actionItems, checked],
  );

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (statusProp !== undefined || autoStatus !== "summarizing" || !visible) return;
    const timer = window.setTimeout(() => setAutoStatus("ready"), reduced ? 500 : 1000);
    return () => window.clearTimeout(timer);
  }, [statusProp, autoStatus, visible, reduced, run]);

  const [shownStatus, setShownStatus] = useState(status);
  if (shownStatus !== status) {
    setShownStatus(status);
    if (status === "summarizing") {
      setReveal(null);
      setAnnouncement("Summarizing transcript");
    } else if (status === "error") {
      setReveal(null);
      setAnnouncement(`Couldn't summarize this meeting. ${error ?? ""}`.trim());
    } else if (shownStatus === "summarizing") {
      const summary = `${data.summary.length} points, ${data.decisions.length} decisions, ${data.actionItems.length} action items`;
      setAnnouncement(plan.total ? `Summary ready: ${summary}` : "No transcript to summarize");
      setReveal(streamIn && !reduced && plan.total ? 0 : null);
    }
  }

  const streaming = reveal !== null;
  useEffect(() => {
    if (!streaming) return;
    const interval = window.setInterval(() => setReveal((tick) => (tick === null || tick >= plan.total + 5 ? null : tick + 1)), 34);
    return () => window.clearInterval(interval);
  }, [streaming, plan.total]);

  useEffect(
    () => () => {
      inFlight.current.forEach((controller) => controller.abort());
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  const sendItem = useCallback(
    async (item: MeetingActionItem, target: SendTarget) => {
      const key = `${item.id}:${target}`;
      const current = sentRef.current[key]?.status;
      if (current === "sending" || current === "sent") return;
      const name = TARGET_NAMES[target];
      setSent((state) => ({ ...state, [key]: { status: "sending" } }));
      setAnnouncement(`Sending to ${name}`);
      const controller = new AbortController();
      inFlight.current.add(controller);
      try {
        let result: SendState["result"];
        if (onSend) result = (await onSend(item, target, controller.signal)) ?? {};
        else {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(resolve, 820);
            controller.signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          });
          result = target === "linear" ? { reference: `PRC-${ticket.current++}` } : { reference: "Added" };
        }
        if (controller.signal.aborted) return;
        setSent((state) => ({ ...state, [key]: { status: "sent", result } }));
        const reference = result?.reference && target === "linear" ? ` as ${result.reference}` : "";
        setAnnouncement(`Sent "${item.text}" to ${name}${reference}.${onSend ? "" : " Simulated, nothing was sent."}`);
      } catch {
        if (controller.signal.aborted) return;
        setSent((state) => ({ ...state, [key]: { status: "failed" } }));
        setAnnouncement(`Couldn't send to ${name}. Try again.`);
      } finally {
        inFlight.current.delete(controller);
      }
    },
    [onSend],
  );

  const autoTarget = data.actionItems[1] ?? data.actionItems[0];
  useEffect(() => {
    if (!isDefault || streaming || status !== "ready" || autoSent.current || !visible || !sendTargets.includes("linear")) return;
    if (!autoTarget) return;
    const timer = window.setTimeout(() => {
      if (interacted.current || autoSent.current) return;
      autoSent.current = true;
      void sendItem(autoTarget, "linear");
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isDefault, streaming, status, visible, data.actionItems, sendTargets, sendItem, autoTarget]);

  const sentSecond = !!autoTarget && sent[`${autoTarget.id}:linear`]?.status === "sent";
  useEffect(() => {
    const first = data.actionItems[0];
    if (!isDefault || !sentSecond || autoChecked.current || !first || !visible) return;
    const timer = window.setTimeout(() => {
      if (interacted.current || autoChecked.current) return;
      autoChecked.current = true;
      setChecked((state) => ({ ...state, [first.id]: true }));
      setAnnouncement(`Done: ${first.text}`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isDefault, sentSecond, visible, data.actionItems]);

  const regenerate = () => {
    onRegenerate?.();
    inFlight.current.forEach((controller) => controller.abort());
    setSent({});
    setActive(null);
    if (statusProp === undefined) {
      setAutoStatus("summarizing");
      setRun((value) => value + 1);
    }
  };

  const control: QuoteControl = {
    active,
    enter: (id: string) => {
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(enterTimer.current);
      if (pinned.current && active !== id) pinned.current = false;
      if (active) setActive(id);
      else enterTimer.current = window.setTimeout(() => setActive(id), 260);
    },
    leave: () => {
      window.clearTimeout(enterTimer.current);
      if (pinned.current) return;
      leaveTimer.current = window.setTimeout(() => setActive(null), 90);
    },
    focus: (id: string) => {
      window.clearTimeout(leaveTimer.current);
      window.clearTimeout(enterTimer.current);
      setActive(id);
    },
    toggle: (id: string) => {
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(leaveTimer.current);
      const next = active === id && pinned.current;
      pinned.current = !next;
      setActive(next ? null : id);
    },
  };

  useEffect(() => {
    if (!active || !pinned.current) return;
    const dismiss = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(`[data-quote-row="${active}"]`)) return;
      pinned.current = false;
      setActive(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [active]);

  const pointVisible = (id: string) => reveal === null || (plan.chunks.get(id)?.[0]?.tick ?? 0) <= reveal;
  const pointComplete = (id: string) => {
    const chunks = plan.chunks.get(id);
    return reveal === null || (chunks?.[chunks.length - 1]?.tick ?? 0) < reveal;
  };
  const sectionVisible = (key: string) => reveal === null || (plan.sectionTick[key] ?? Infinity) <= reveal;

  const isEmpty = status === "ready" && plan.total === 0;
  const view = status === "summarizing" ? "loading" : status === "error" ? "error" : isEmpty ? "empty" : "notes";
  const completed = data.actionItems.filter((item) => done[item.id]).length;

  const markdown = (() => {
    const lines = [`# ${data.title}`, `${when.day}, ${when.range} (${data.durationMinutes} min)`];
    if (data.summary.length) lines.push("", "## Summary", ...data.summary.map((item) => `- ${item.text}`));
    if (data.decisions.length) lines.push("", "## Decisions", ...data.decisions.map((item) => `- ${item.text}`));
    if (data.actionItems.length) {
      lines.push(
        "",
        "## Action items",
        ...data.actionItems.map((item) => {
          const meta = [item.ownerId ? attendees.get(item.ownerId)?.name : undefined, item.due ? `due ${shortDate(item.due)}` : undefined].filter(Boolean).join(", ");
          return `- [${done[item.id] ? "x" : " "}] ${item.text}${meta ? ` (${meta})` : ""}`;
        }),
      );
    }
    return lines.join("\n");
  })();

  const faces = data.attendees.slice(0, 4);
  const extra = data.attendees.length - faces.length;
  const stateFade = {
    initial: !reduced && { opacity: 0 },
    animate: { opacity: 1, transition: ENTER },
    exit: { opacity: 0, transition: reduced ? { duration: 0 } : EXIT },
  };

  const quoteFor = (rowId: string, quote?: MeetingQuote) =>
    active === rowId && quote ? <Quote id={quoteId} quote={quote} speaker={attendees.get(quote.speakerId)} /> : null;

  const row = (item: MeetingPoint, marker: ReactNode) => {
    const rowId = `${baseId}-${item.id}`;
    const open = active === rowId && !!item.quote;
    return (
      <li
        className={cx(styles.point, streaming && styles.enter)}
        data-quote-row={rowId}
        data-active={open || undefined}
        key={item.id}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && item.quote && !streaming) control.enter(rowId);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") control.leave();
        }}
      >
        <span className={styles.marker} aria-hidden="true">
          {marker}
        </span>
        <span className={styles.pointText}>
          <Chunks text={item.text} chunks={plan.chunks.get(item.id)} tick={reveal} />
        </span>
        {item.quote ? (
          <span className={cx(styles.pointAside, !pointComplete(item.id) && styles.hidden)}>
            <QuoteTimestamp id={rowId} quote={item.quote} control={control} quoteId={quoteId} />
          </span>
        ) : null}
        <AnimatePresence>{quoteFor(rowId, item.quote)}</AnimatePresence>
      </li>
    );
  };

  return (
    <article
      ref={rootRef}
      className={cx(styles.root, className)}
      aria-label={`Meeting notes: ${data.title}`}
      aria-busy={status === "summarizing" || streaming}
      onPointerDown={() => {
        interacted.current = true;
      }}
      onKeyDown={(event) => {
        interacted.current = true;
        if (event.key === "Escape" && active) {
          pinned.current = false;
          setActive(null);
        }
      }}
    >
      <header className={styles.header}>
        <span className={styles.platform} aria-hidden={data.platform === "other" || undefined}>
          <PlatformIcon platform={data.platform} />
        </span>
        <div className={styles.heading}>
          <h2 className={styles.title}>{data.title}</h2>
          <p className={styles.when}>
            <span className={styles.srOnly}>{PLATFORM_NAMES[data.platform]}, </span>
            <span>{when.day}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span>{when.range}</span>
            <span className={styles.dot} aria-hidden="true" />
            <span>{data.durationMinutes} min</span>
          </p>
        </div>
        {data.attendees.length ? (
          <Tooltip content={data.attendees.map((person) => person.name).join(", ")}>
            <span
              className={styles.stack}
              tabIndex={0}
              role="group"
              aria-label={`${data.attendees.length} attendees: ${data.attendees.map((person) => person.name).join(", ")}`}
            >
              <span className={styles.stackFaces} aria-hidden="true">
                {faces.map((person) => (
                  <Avatar key={person.id} name={person.name} src={person.avatar} size="sm" className={styles.face} />
                ))}
              </span>
              {extra > 0 ? (
                <span className={styles.more} aria-hidden="true">
                  +{extra}
                </span>
              ) : null}
            </span>
          </Tooltip>
        ) : null}
      </header>
      <div ref={bodyOuter} className={styles.bodyOuter}>
        <div ref={bodyInner} className={styles.body}>
          <AnimatePresence initial={false} mode="popLayout">
            {view === "loading" ? (
              <motion.div className={styles.loading} key={`loading-${run}`} {...stateFade}>
                <Spinner />
                <TextShimmer className={styles.loadingLabel}>Summarizing transcript</TextShimmer>
              </motion.div>
            ) : null}
            {view === "error" ? (
              <motion.div className={styles.state} role="alert" key="error" {...stateFade}>
                <span className={cx(styles.stateIcon, styles.stateDanger)} aria-hidden="true">
                  <CircleAlert size={16} strokeWidth={1.75} />
                </span>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>Couldn&apos;t summarize this meeting</p>
                  <p className={styles.stateText}>{error ?? "The transcript didn't finish processing. Try again in a minute."}</p>
                  <Button variant="secondary" size="sm" className={styles.retry} onClick={regenerate}>
                    <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                    Try again
                  </Button>
                </div>
              </motion.div>
            ) : null}
            {view === "empty" ? (
              <motion.div className={styles.state} key="empty" {...stateFade}>
                <span className={styles.stateIcon} aria-hidden="true">
                  <MicOff size={16} strokeWidth={1.75} />
                </span>
                <div className={styles.stateCopy}>
                  <p className={styles.stateTitle}>No transcript to summarize</p>
                  <p className={styles.stateText}>
                    Transcription was off for this call. Turn it on in {data.platform === "other" ? "your meeting app" : PLATFORM_NAMES[data.platform]} to get notes
                    next time.
                  </p>
                </div>
              </motion.div>
            ) : null}
            {view === "notes" ? (
              <motion.div className={styles.notes} key={`notes-${run}`} {...stateFade}>
                {data.summary.length && sectionVisible("summary") ? (
                  <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${baseId}-summary`}>
                    <h3 id={`${baseId}-summary`} className={styles.sectionTitle}>
                      Summary
                    </h3>
                    <ul className={styles.list}>
                      {data.summary.filter((item) => pointVisible(item.id)).map((item) => row(item, <span className={styles.bullet} />))}
                    </ul>
                  </section>
                ) : null}
                {data.decisions.length && sectionVisible("decisions") ? (
                  <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${baseId}-decisions`}>
                    <h3 id={`${baseId}-decisions`} className={styles.sectionTitle}>
                      Decisions
                    </h3>
                    <ul className={styles.list}>
                      {data.decisions
                        .filter((item) => pointVisible(item.id))
                        .map((item) => row(item, <Check size={14} strokeWidth={1.75} />))}
                    </ul>
                  </section>
                ) : null}
                {data.actionItems.length && sectionVisible("actions") ? (
                  <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${baseId}-actions`}>
                    <div className={styles.sectionHead}>
                      <h3 id={`${baseId}-actions`} className={styles.sectionTitle}>
                        Action items
                      </h3>
                      <span className={cx(styles.progress, streaming && styles.hidden)}>
                        <Count value={completed} reduced={reduced} /> of {data.actionItems.length} done
                      </span>
                    </div>
                    <ul className={styles.list}>
                      {data.actionItems
                        .filter((item) => pointVisible(item.id))
                        .map((item) => {
                          const owner = item.ownerId ? attendees.get(item.ownerId) : undefined;
                          const rowId = `${baseId}-${item.id}`;
                          const open = active === rowId && !!item.quote;
                          const isDone = !!done[item.id];
                          return (
                            <li className={cx(styles.item, streaming && styles.enter)} data-quote-row={rowId} data-done={isDone || undefined} key={item.id}>
                              <span className={styles.checkCell}>
                                <Checkbox
                                  checked={isDone}
                                  label={item.text}
                                  reduced={reduced}
                                  onCheckedChange={(next) => {
                                    setChecked((state) => ({ ...state, [item.id]: next }));
                                    onActionItemChange?.(item, next);
                                    setAnnouncement(`${next ? "Done" : "Not done"}: ${item.text}`);
                                  }}
                                />
                              </span>
                              <div className={styles.itemBody}>
                                <span className={styles.itemText}>
                                  <span className={styles.strike}>
                                    <Chunks text={item.text} chunks={plan.chunks.get(item.id)} tick={reveal} />
                                  </span>
                                </span>
                                <div className={cx(styles.meta, !pointComplete(item.id) && styles.hidden)}>
                                  {owner ? (
                                    <span className={styles.owner}>
                                      <Avatar name={owner.name} src={owner.avatar} size="sm" className={styles.ownerAvatar} aria-hidden="true" />
                                      <span className={styles.ownerFull}>{owner.name}</span>
                                      <span className={styles.ownerShort} aria-hidden="true">
                                        {owner.name.split(" ")[0]}
                                      </span>
                                    </span>
                                  ) : null}
                                  {item.due ? (
                                    <span className={styles.due}>
                                      <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                                      <span>
                                        <span className={styles.srOnly}>Due </span>
                                        {shortDate(item.due)}
                                      </span>
                                    </span>
                                  ) : null}
                                  {item.quote ? (
                                    <span
                                      className={styles.metaQuote}
                                      onPointerEnter={(event) => {
                                        if (event.pointerType === "mouse") control.enter(rowId);
                                      }}
                                      onPointerLeave={(event) => {
                                        if (event.pointerType === "mouse") control.leave();
                                      }}
                                    >
                                      <QuoteTimestamp id={rowId} quote={item.quote} control={control} quoteId={quoteId} />
                                    </span>
                                  ) : null}
                                  {sendTargets.length ? (
                                    <span className={styles.sendGroup}>
                                      {sendTargets.map((target) => (
                                        <SendAction
                                          key={target}
                                          item={item}
                                          target={target}
                                          state={sent[`${item.id}:${target}`]}
                                          onSend={() => void sendItem(item, target)}
                                          reduced={reduced}
                                        />
                                      ))}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <AnimatePresence>{quoteFor(rowId, item.quote)}</AnimatePresence>
                            </li>
                          );
                        })}
                    </ul>
                  </section>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <footer className={styles.footer}>
        <p className={styles.credit}>
          {model ? (
            <>
              {model.icon ? <span className={styles.modelIcon}>{model.icon}</span> : null}
              <span className={styles.modelName}>{model.name}</span>
            </>
          ) : null}
          {data.transcriptWords ? (
            <>
              {model ? <span className={styles.dot} aria-hidden="true" /> : null}
              <span>{data.transcriptWords.toLocaleString("en-US")} words</span>
            </>
          ) : null}
        </p>
        <div className={styles.tools}>
          <CopyButton
            value={markdown}
            label="Copy notes as Markdown"
            iconOnly
            variant="plain"
            disabled={view !== "notes" || streaming}
            className={styles.tool}
          />
          <Tooltip content="Regenerate">
            <Button
              variant="ghost"
              size="sm"
              className={styles.iconButton}
              aria-label="Regenerate notes"
              disabled={status === "summarizing" || streaming}
              onClick={regenerate}
            >
              <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </footer>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </article>
  );
}

export default MeetingSummary;
