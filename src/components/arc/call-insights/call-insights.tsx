"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  DollarSign,
  MessageSquareWarning,
  Pause,
  Play,
  RotateCcw,
  Swords,
  TriangleAlert,
} from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Checkbox } from "../checkbox/checkbox";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./call-insights.module.css";

/* -------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

export type CallMomentType = "pricing" | "competitor" | "objection";
export type DealRisk = "low" | "medium" | "high";
export type CallSide = "internal" | "external";

export interface CallDetails {
  /** Call title, one line, ellipsised. */
  title: string;
  /** Prospect or account name. Names the section and marks the header logo. */
  company: string;
  /** Mark drawn inside the 20px header tile, in `currentColor`. Falls back to the company initial. */
  logo?: ReactNode;
  /** Meeting platform name, e.g. `Zoom`. Dropped below 460px. */
  platform?: string;
  /** 14px platform mark, drawn beside the platform name. */
  platformMark?: ReactNode;
  /** Date label, e.g. `Oct 22, 2026`. */
  date: string;
  /** Call length in seconds; positions the moments and prints the `min` readout. */
  duration: number;
}

export interface CallSpeaker {
  id: string;
  name: string;
  /** Role line under the name in the quote well. Hidden below 460px. */
  title?: string;
  avatar?: string;
  /** `internal` is your team, `external` the prospect. Talk time groups internal first. */
  side: CallSide;
  /** Talk share on an arbitrary scale; normalised to 100 across every speaker. */
  talk: number;
}

export interface CallMoment {
  id: string;
  type: CallMomentType;
  /** Offset in seconds from the start of the call. */
  at: number;
  speakerId: string;
  quote: string;
  /** Clip length in seconds. The waveform and the seek slider use it as their maximum. */
  clip: number;
}

export interface CallNextStep {
  id: string;
  label: string;
  /** A speaker id; the row shows that person's avatar and first name. */
  ownerId: string;
  due: string;
  done?: boolean;
  /** Default true: an open step keeps the deal at risk when `risk` is derived. */
  risk?: boolean;
}

export interface CallInsightsProps {
  /** Header details. Defaults to a 34 minute Ramp evaluation on Zoom. */
  call?: CallDetails;
  /** Attendees, talk share and side. Defaults to four sample speakers. */
  speakers?: CallSpeaker[];
  /** Flagged pricing, competitor and objection moments. Defaults to five sample moments. */
  moments?: CallMoment[];
  /** AI summary. Streams in once the card first scrolls into view; an empty string shows the empty state. */
  summary?: string;
  /** Model credited next to the summary heading. Defaults to `Claude Sonnet 5.5`. */
  summaryModel?: string;
  /** Follow-ups with owners and due dates. Defaults to three sample steps. */
  nextSteps?: CallNextStep[];
  /** Fixed deal risk. When omitted it follows the open risk steps. */
  risk?: DealRisk;
  /**
   * Tours the moments and plays each clip while the card is on screen, until the first pointer or key press
   * inside it. Always off with reduced motion. Defaults to true.
   */
  autoPlay?: boolean;
  /** Moment selected first. Defaults to the first moment. */
  defaultMomentId?: string;
  /**
   * Wiring for a real audio player: seek to `moment.at`, resolve when playback can start, abort on the signal.
   * Without it loading is simulated and the status region says no audio plays.
   */
  loadClip?: (moment: CallMoment, signal: AbortSignal) => Promise<void>;
  /** Called when a moment is selected, by click, keyboard or the tour. */
  onMomentChange?: (moment: CallMoment) => void;
  /** Called when a next step is checked or unchecked. Persist it here. */
  onNextStepChange?: (step: CallNextStep, done: boolean) => void;
  /** Class on the root section. */
  className?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Sample data
 * ---------------------------------------------------------------------------------------------- */

const svgHidden = { "aria-hidden": true, focusable: false } as const;

/** Claude's spark, the model mark beside the summary heading. */
function ClaudeMark(props: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" {...svgHidden} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const sampleSpeakers: CallSpeaker[] = [
  {
    id: "ryan",
    name: "Ryan Sullivan",
    title: "Account executive",
    avatar: "/media/people/ryan-sullivan.svg",
    side: "internal",
    talk: 38,
  },
  {
    id: "hannah",
    name: "Hannah Walsh",
    title: "Solutions engineer",
    avatar: "/media/people/hannah-walsh.svg",
    side: "internal",
    talk: 14,
  },
  {
    id: "diane",
    name: "Diane Foster",
    title: "VP Finance, Ramp",
    avatar: "/media/people/diane-foster.svg",
    side: "external",
    talk: 31,
  },
  {
    id: "andre",
    name: "Andre Williams",
    title: "Data engineering lead, Ramp",
    avatar: "/media/people/andre-williams.svg",
    side: "external",
    talk: 17,
  },
];

const sampleMoments: CallMoment[] = [
  {
    id: "m1",
    type: "pricing",
    at: 401,
    speakerId: "diane",
    quote:
      "If we roll this out to all 400 seats in Q1, what does the per-seat price look like?",
    clip: 6,
  },
  {
    id: "m2",
    type: "competitor",
    at: 725,
    speakerId: "andre",
    quote:
      "We already run Fivetran for the warehouse sync, so you have to beat it on cost per connector.",
    clip: 7,
  },
  {
    id: "m3",
    type: "objection",
    at: 1050,
    speakerId: "andre",
    quote:
      "Security won't sign off without a SOC 2 Type II report and SSO through Okta.",
    clip: 5,
  },
  {
    id: "m4",
    type: "pricing",
    at: 1432,
    speakerId: "diane",
    quote: "If we commit to two years, can you hold the per-seat price flat?",
    clip: 5,
  },
  {
    id: "m5",
    type: "objection",
    at: 1754,
    speakerId: "diane",
    quote:
      "Migration is the real cost for us. We can't have broken dashboards during the close.",
    clip: 6,
  },
];

const sampleSummary =
  "Diane wants one pipeline in place before the Q1 close and asked for 400 seats on a two-year term at a flat per-seat price. Fivetran is the incumbent, so the deal turns on cost per connector and a migration that keeps dashboards live. Security needs SOC 2 Type II and Okta SSO before procurement starts.";

const sampleNextSteps: CallNextStep[] = [
  {
    id: "s1",
    label: "Send SOC 2 Type II report and Okta SSO guide",
    ownerId: "hannah",
    due: "Oct 23",
  },
  {
    id: "s2",
    label: "Draft a two-year, 400-seat proposal",
    ownerId: "ryan",
    due: "Oct 26",
  },
  {
    id: "s3",
    label: "Book a migration scoping session",
    ownerId: "andre",
    due: "Oct 28",
  },
];

const sampleCall: CallDetails = {
  title: "Data platform evaluation",
  company: "Ramp",
  logo: (
    <svg
      viewBox="51.4 -1.6 19 19"
      fill="currentColor"
      {...svgHidden}
      width={20}
      height={20}
    >
      <path d="M70.028 15.612v.07h-9.983v-.07c1.439-.82 2.432-1.654 3.327-2.526h4.1zm-2.473-13.11L65.027 0h-.074s.042 4.664-4.205 8.906c-4.156 4.15-9.046 4.16-9.046 4.16v.074l2.578 2.546s4.819.05 9.074-4.16c4.24-4.195 4.205-9.022 4.205-9.022z" />
    </svg>
  ),
  platform: "Zoom",
  platformMark: (
    <svg viewBox="0 0 24 24" {...svgHidden} width={14} height={14}>
      <rect width="24" height="24" rx="6.5" fill="#0B5CFF" />
      <rect x="4.6" y="7.6" width="10.4" height="8.8" rx="2.2" fill="#fff" />
      <path
        fill="#fff"
        d="m16.1 10.7 2.55-1.86c.42-.3.85-.08.85.44v5.44c0 .52-.43.74-.85.44l-2.55-1.86z"
      />
    </svg>
  ),
  date: "Oct 22, 2026",
  duration: 2052,
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
const pad = (value: number) => String(value).padStart(2, "0");
/** `mm:ss` for moment timestamps. */
const clock = (seconds: number) =>
  `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;
/** `m:ss` for the short clip readouts. */
const shortClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${pad(Math.floor(seconds % 60))}`;

const MOMENT_TYPES: Record<CallMomentType, { label: string; icon: ReactNode }> =
  {
    pricing: {
      label: "Pricing",
      icon: <DollarSign size={14} strokeWidth={1.75} aria-hidden="true" />,
    },
    competitor: {
      label: "Competitor",
      icon: <Swords size={14} strokeWidth={1.75} aria-hidden="true" />,
    },
    objection: {
      label: "Objection",
      icon: (
        <MessageSquareWarning size={14} strokeWidth={1.75} aria-hidden="true" />
      ),
    },
  };

const RISK_FACES: Record<DealRisk, { label: string; icon: ReactNode }> = {
  high: {
    label: "High risk",
    icon: <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  medium: {
    label: "Medium risk",
    icon: <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
  low: {
    label: "Low risk",
    icon: <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />,
  },
};

/**
 * The rule the card uses when `risk` is omitted, exported so a list view can show the same chip.
 * Steps with `risk: false` are ignored: no step open is low, every risk step open (and at least two) is high,
 * everything in between is medium.
 */
export function deriveRisk(
  steps: CallNextStep[],
  done: Record<string, boolean>,
): DealRisk {
  const riskSteps = steps.filter((step) => step.risk !== false);
  const open = riskSteps.filter((step) => !done[step.id]).length;
  if (open === 0) return "low";
  return open >= Math.max(2, riskSteps.length) ? "high" : "medium";
}

const BAR_COUNT = 52;

/** One deterministic waveform per moment, derived from its offset so the shape never shifts between renders. */
function waveform(seed: number): number[] {
  return Array.from({ length: BAR_COUNT }, (_, index) =>
    Math.max(
      0.22,
      Math.min(
        1,
        (0.55 *
          Math.sin(
            Math.PI * Math.min(1, (index / (BAR_COUNT - 1)) * 1.15 + 0.02),
          ) +
          0.35) *
          (0.45 +
            0.75 *
              Math.abs(
                Math.sin(0.9 * index + 1.7 * seed) *
                  Math.cos(0.37 * index + 0.6 * seed),
              )),
      ),
    ),
  );
}

/** Word counts, doubled per chunk: the summary streams 3 to 8 words at a time. */
const CHUNK_SIZES = [4, 6, 3, 7, 5, 8, 4, 6];

/** Splits on whitespace but keeps it, so the streamed chunks rejoin into the exact summary text. */
function chunkSummary(text: string): string[] {
  const parts = text.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let index = 0;
  let step = 0;
  while (index < parts.length) {
    const size = 2 * CHUNK_SIZES[step++ % CHUNK_SIZES.length];
    chunks.push(parts.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";
type SummaryState = "waiting" | "streaming" | "done";

const unknownSpeaker = (id: string): CallSpeaker => ({
  id,
  name: "Unknown speaker",
  side: "external",
  talk: 0,
});

function SectionHead({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={styles.sectionHead}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children ? <div className={styles.sectionMeta}>{children}</div> : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className={styles.spinner}
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeWidth="2"
      />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------------------------- */

export function CallInsights({
  call = sampleCall,
  speakers = sampleSpeakers,
  moments = sampleMoments,
  summary = sampleSummary,
  summaryModel = "Claude Sonnet 5.5",
  nextSteps = sampleNextSteps,
  risk,
  autoPlay = true,
  defaultMomentId,
  loadClip,
  onMomentChange,
  onNextStepChange,
  className,
}: CallInsightsProps) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  /** On screen now, and ever seen: the reveal, the summary stream and playback all wait on those two. */
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const speakerMap = useMemo(
    () => new Map(speakers.map((speaker) => [speaker.id, speaker])),
    [speakers],
  );
  const speakerOf = useCallback(
    (id: string) => speakerMap.get(id) ?? unknownSpeaker(id),
    [speakerMap],
  );

  /** Your team first, then the prospect; the share is normalised to 100 and the second colour is a 50% mix. */
  const talk = useMemo(() => {
    const total =
      speakers.reduce((sum, speaker) => sum + Math.max(0, speaker.talk), 0) ||
      1;
    const ordered = [
      ...speakers.filter((speaker) => speaker.side === "internal"),
      ...speakers.filter((speaker) => speaker.side === "external"),
    ];
    const seenTone = { internal: 0, external: 0 };
    const rows = ordered.map((speaker) => {
      const share = (Math.max(0, speaker.talk) / total) * 100;
      const nth =
        speaker.side === "internal" ? seenTone.internal++ : seenTone.external++;
      const base =
        speaker.side === "internal" ? "var(--series-1)" : "var(--series-2)";
      const color =
        nth === 0 ? base : `color-mix(in oklab, ${base} 50%, var(--surface))`;
      return { speaker, share, color };
    });
    const internal = Math.round(
      rows
        .filter((row) => row.speaker.side === "internal")
        .reduce((sum, row) => sum + row.share, 0),
    );
    return { rows, internal, external: 100 - internal };
  }, [speakers]);

  const [hoveredSpeaker, setHoveredSpeaker] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => defaultMomentId ?? moments[0]?.id,
  );
  const selected =
    moments.find((moment) => moment.id === selectedId) ?? moments[0];

  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  /** Whole seconds, the only value React re-renders for during playback. */
  const [displaySecond, setDisplaySecond] = useState(0);
  const positionRef = useRef(0);
  const waveRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const [tourOn, setTourOn] = useState(autoPlay);
  const tourEnabled = tourOn && !reduced && moments.length > 0;
  const tourRef = useRef(tourEnabled);
  useEffect(() => {
    tourRef.current = tourEnabled;
  }, [tourEnabled]);

  /** The first tour beat waits 2.2s, every later one 640ms. */
  const touredRef = useRef(false);
  /** Bumped on every selection so the tour timer re-arms for the new moment. */
  const [selectionTick, setSelectionTick] = useState(0);

  const seek = useCallback((seconds: number, clip: number) => {
    positionRef.current = seconds;
    waveRef.current?.style.setProperty(
      "--p",
      String(clip ? Math.min(1, seconds / clip) : 0),
    );
    const whole = Math.floor(seconds);
    setDisplaySecond((current) => (current === whole ? current : whole));
  }, []);

  const selectMoment = useCallback(
    (moment: CallMoment) => {
      controllerRef.current?.abort();
      window.clearTimeout(timeoutRef.current);
      seek(0, moment.clip);
      setPlayerState("idle");
      setSelectedId(moment.id);
      setSelectionTick((tick) => tick + 1);
      onMomentChange?.(moment);
    },
    [onMomentChange, seek],
  );

  const load = useCallback(
    async (moment: CallMoment) => {
      window.clearTimeout(timeoutRef.current);
      if (positionRef.current >= moment.clip) seek(0, moment.clip);
      if (positionRef.current > 0) {
        setPlayerState("playing");
        return;
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setPlayerState("loading");
      const request =
        loadClip ??
        ((_: CallMoment, signal: AbortSignal) =>
          new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(resolve, 260);
            signal.addEventListener(
              "abort",
              () => {
                window.clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          }));
      try {
        await request(moment, controller.signal);
      } catch {
        if (controller.signal.aborted) return;
        setPlayerState("error");
        setAnnouncement("The clip could not be loaded.");
        return;
      }
      if (controller.signal.aborted) return;
      setPlayerState("playing");
      setAnnouncement(
        `Playing the ${clock(moment.at)} clip from ${speakerOf(moment.speakerId).name}. Simulated, no audio.`,
      );
    },
    [loadClip, seek, speakerOf],
  );

  /** A finished clip rewinds, then hands over to the next moment while the tour is still running. */
  const finish = useCallback(
    (moment: CallMoment) => {
      setPlayerState("idle");
      timeoutRef.current = window.setTimeout(() => {
        seek(0, moment.clip);
        if (!tourRef.current || moments.length === 0) return;
        const index = moments.findIndex((entry) => entry.id === moment.id);
        selectMoment(moments[(index + 1) % moments.length]);
      }, 520);
    },
    [moments, seek, selectMoment],
  );

  // Playback: one CSS variable per frame, a React render only when the whole second changes.
  useEffect(() => {
    if (playerState !== "playing" || !inView || !selected) return;
    let frame = 0;
    let stamp = performance.now();
    const step = (now: number) => {
      const next = Math.min(
        selected.clip,
        positionRef.current + (now - stamp) / 1000,
      );
      stamp = now;
      seek(next, selected.clip);
      if (next >= selected.clip) finish(selected);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playerState, inView, selected, seek, finish]);

  // The tour: starts a clip after a beat, only while the card is on screen and nothing is selected yet.
  useEffect(() => {
    if (
      !tourEnabled ||
      !inView ||
      playerState !== "idle" ||
      !selected ||
      positionRef.current > 0
    )
      return;
    const timer = window.setTimeout(
      () => {
        touredRef.current = true;
        void load(selected);
      },
      touredRef.current ? 640 : 2200,
    );
    return () => window.clearTimeout(timer);
  }, [tourEnabled, inView, playerState, selected, load, selectionTick]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  // The first pointer or key press inside the card ends the tour for good.
  const stopTour = () => {
    if (tourOn) setTourOn(false);
  };

  const handleSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.type === "pointerdown")
      event.currentTarget.setPointerCapture(event.pointerId);
    else if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    if (!selected || playerState === "error" || playerState === "loading")
      return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - box.left) / box.width),
    );
    window.clearTimeout(timeoutRef.current);
    seek(ratio * selected.clip, selected.clip);
    if (playerState === "idle") setPlayerState("paused");
  };

  const wave = useMemo(
    () => (selected ? waveform(selected.at % 97) : waveform(1)),
    [selected],
  );

  const chunks = useMemo(() => chunkSummary(summary), [summary]);
  const [chunkCount, setChunkCount] = useState(0);
  const [streamState, setStreamState] = useState<SummaryState>("waiting");
  const summaryState: SummaryState = reduced ? "done" : streamState;
  const visibleChunks = reduced ? chunks.length : chunkCount;

  // A calm shimmer for 0.7s, then 3 to 8 words every 35ms; reduced motion skips straight to the full text.
  useEffect(() => {
    if (!summary || reduced || !seen) return;
    let interval = 0;
    let count = 0;
    const timeout = window.setTimeout(() => {
      setStreamState("streaming");
      interval = window.setInterval(() => {
        count += 1;
        setChunkCount(count);
        if (count >= chunks.length) {
          window.clearInterval(interval);
          setStreamState("done");
        }
      }, 35);
    }, 720);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [seen, reduced, summary, chunks]);

  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nextSteps.map((step) => [step.id, !!step.done])),
  );
  const currentRisk = risk ?? deriveRisk(nextSteps, done);
  const doneCount = nextSteps.filter((step) => done[step.id]).length;

  const toggleStep = (step: CallNextStep, checked: boolean) => {
    const next = { ...done, [step.id]: checked };
    setDone(next);
    onNextStepChange?.(step, checked);
    const nextRisk = risk ?? deriveRisk(nextSteps, next);
    setAnnouncement(
      `${checked ? "Done" : "Reopened"}: ${step.label}.${nextRisk !== currentRisk ? ` Deal risk is now ${nextRisk}.` : ""}`,
    );
  };

  const active = selected;
  const activeType = active ? MOMENT_TYPES[active.type] : undefined;
  const totalLabel = clock(call.duration);
  const minutes = Math.round(call.duration / 60);
  const shimmerLabel = `Summarizing ${minutes} min call`;
  const clipTotalLabel = active ? ` / ${shortClock(active.clip)}` : "";

  const playLabel =
    playerState === "playing"
      ? "Pause clip"
      : playerState === "loading"
        ? "Cancel loading"
        : playerState === "error"
          ? "Retry clip"
          : `Play clip at ${active ? clock(active.at) : "00:00"}`;

  return (
    <section
      ref={rootRef}
      className={cx(styles.root, className)}
      aria-label={`${call.company} call insights`}
      onPointerDownCapture={stopTour}
      onKeyDownCapture={stopTour}
    >
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>

      <header className={cx(styles.section, styles.header)} data-frame-keep="">
        <span className={styles.logo} role="img" aria-label={call.company}>
          {call.logo ?? call.company.slice(0, 1)}
        </span>
        <div className={styles.headText}>
          <h2 className={styles.title}>{call.title}</h2>
          <p className={styles.meta}>
            <span className={styles.company}>
              {call.company}
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            </span>
            {call.platformMark ? (
              <span
                className={styles.platform}
                role="img"
                aria-label={call.platform ?? "Meeting"}
              >
                {call.platformMark}
              </span>
            ) : null}
            {call.platform ? (
              <span className={styles.platformName}>{call.platform}</span>
            ) : null}
            {call.platform || call.platformMark ? (
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            ) : null}
            <span>{call.date}</span>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span className={styles.num}>{minutes} min</span>
          </p>
        </div>
        <div className={styles.headAside}>
          <span className={styles.risk} data-risk={currentRisk}>
            {(Object.keys(RISK_FACES) as DealRisk[]).map((level) => (
              <span
                key={level}
                className={styles.riskFace}
                data-active={level === currentRisk || undefined}
                aria-hidden={level !== currentRisk}
              >
                {RISK_FACES[level].icon}
                <span>{RISK_FACES[level].label}</span>
              </span>
            ))}
          </span>
          <span
            className={styles.attendees}
            role="img"
            aria-label={`${speakers.length} attendees: ${speakers.map((speaker) => speaker.name).join(", ")}`}
          >
            {speakers.slice(0, 4).map((speaker) => (
              <Avatar
                key={speaker.id}
                name={speaker.name}
                src={speaker.avatar}
                size="sm"
                className={styles.mini}
                aria-hidden="true"
              />
            ))}
          </span>
        </div>
      </header>

      <div className={styles.section} data-frame-keep="">
        <SectionHead title="Talk time">
          <span className={styles.num}>Your team {talk.internal}%</span>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span>
            {call.company} <span className={styles.num}>{talk.external}%</span>
          </span>
        </SectionHead>
        <div
          className={styles.bar}
          data-in={seen || reduced || undefined}
          role="img"
          aria-label={talk.rows
            .map((row) => `${row.speaker.name} ${Math.round(row.share)}%`)
            .join(", ")}
        >
          {talk.rows.map((row, index) => {
            const next = talk.rows[index + 1];
            return (
              <span
                key={row.speaker.id}
                className={styles.segment}
                data-dim={
                  hoveredSpeaker && hoveredSpeaker !== row.speaker.id
                    ? true
                    : undefined
                }
                data-side-break={
                  next && next.speaker.side !== row.speaker.side
                    ? true
                    : undefined
                }
                style={{ flexGrow: row.share, background: row.color }}
                onPointerEnter={() => setHoveredSpeaker(row.speaker.id)}
                onPointerLeave={() => setHoveredSpeaker(undefined)}
              />
            );
          })}
        </div>
        <ul className={styles.legend}>
          {talk.rows.map((row) => (
            <li
              key={row.speaker.id}
              className={styles.legendItem}
              data-dim={
                hoveredSpeaker && hoveredSpeaker !== row.speaker.id
                  ? true
                  : undefined
              }
              onPointerEnter={() => setHoveredSpeaker(row.speaker.id)}
              onPointerLeave={() => setHoveredSpeaker(undefined)}
            >
              <span
                className={styles.swatch}
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <span className={styles.legendName}>{row.speaker.name}</span>
              <span className={styles.legendShare}>
                {Math.round(row.share)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.section} data-frame-keep="">
        <SectionHead title="Key moments">
          <span className={styles.num}>{moments.length} flagged</span>
        </SectionHead>
        <div className={styles.track}>
          <span className={styles.rail} aria-hidden="true" />
          <span
            className={styles.railFill}
            aria-hidden="true"
            style={{
              transform: `scaleX(${active ? active.at / call.duration : 0})`,
            }}
          />
          <div
            className={styles.markers}
            role="radiogroup"
            aria-label="Key moments"
          >
            {moments.map((moment, index) => (
              <button
                key={moment.id}
                type="button"
                role="radio"
                data-marker={moment.id}
                aria-checked={moment.id === active?.id}
                tabIndex={moment.id === active?.id ? 0 : -1}
                aria-label={`${MOMENT_TYPES[moment.type].label} at ${clock(moment.at)}, ${speakerOf(moment.speakerId).name}`}
                className={styles.marker}
                style={{
                  left: `clamp(12px, ${(moment.at / call.duration) * 100}%, calc(100% - 12px))`,
                }}
                onClick={() => {
                  if (moment.id !== active?.id) selectMoment(moment);
                }}
                onKeyDown={(event) => {
                  const last = moments.length - 1;
                  const target =
                    event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? Math.min(last, index + 1)
                      : event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? Math.max(0, index - 1)
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? last
                            : -1;
                  if (target < 0) return;
                  event.preventDefault();
                  selectMoment(moments[target]);
                  rootRef.current
                    ?.querySelector<HTMLElement>(
                      `[data-marker="${moments[target].id}"]`,
                    )
                    ?.focus();
                }}
              >
                {MOMENT_TYPES[moment.type].icon}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.ticks} aria-hidden="true">
          <span className={styles.num}>00:00</span>
          <span className={styles.types}>
            {(Object.keys(MOMENT_TYPES) as CallMomentType[]).map((type) => (
              <span key={type} className={styles.type}>
                {MOMENT_TYPES[type].icon}
                {MOMENT_TYPES[type].label}
              </span>
            ))}
          </span>
          <span className={styles.num}>{totalLabel}</span>
        </div>

        <div className={styles.panel}>
          {active && activeType ? (
            <>
              <div className={styles.quotes}>
                {moments.map((moment) => {
                  const speaker = speakerOf(moment.speakerId);
                  const isActive = moment.id === active.id;
                  return (
                    <figure
                      key={moment.id}
                      className={styles.quote}
                      data-active={isActive || undefined}
                      aria-hidden={!isActive}
                    >
                      <figcaption className={styles.quoteHead}>
                        <Avatar
                          name={speaker.name}
                          src={speaker.avatar}
                          size="sm"
                          className={styles.mini}
                          aria-hidden="true"
                        />
                        <span className={styles.quoteName}>{speaker.name}</span>
                        {speaker.title ? (
                          <span className={styles.quoteRole}>
                            {speaker.title}
                          </span>
                        ) : null}
                        <span className={styles.quoteType}>
                          {MOMENT_TYPES[moment.type].icon}
                          <span>{MOMENT_TYPES[moment.type].label}</span>
                          <span className={styles.dot} aria-hidden="true">
                            ·
                          </span>
                          <span className={styles.num}>{clock(moment.at)}</span>
                        </span>
                      </figcaption>
                      <blockquote
                        className={styles.quoteText}
                      >{`“${moment.quote}”`}</blockquote>
                    </figure>
                  );
                })}
              </div>
              <div className={styles.player} data-state={playerState}>
                <button
                  type="button"
                  className={styles.play}
                  onClick={() => {
                    if (!active) return;
                    if (playerState === "playing") {
                      setPlayerState("paused");
                      setAnnouncement("Paused.");
                      return;
                    }
                    if (playerState === "loading") {
                      controllerRef.current?.abort();
                      setPlayerState("idle");
                      return;
                    }
                    if (playerState === "error") seek(0, active.clip);
                    void load(active);
                  }}
                  aria-label={playLabel}
                >
                  <span
                    className={styles.playFace}
                    data-active={
                      playerState === "idle" ||
                      playerState === "paused" ||
                      undefined
                    }
                  >
                    <Play
                      size={14}
                      strokeWidth={1.75}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={styles.playFace}
                    data-active={playerState === "playing" || undefined}
                  >
                    <Pause
                      size={14}
                      strokeWidth={1.75}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={styles.playFace}
                    data-active={playerState === "loading" || undefined}
                  >
                    <Spinner />
                  </span>
                  <span
                    className={styles.playFace}
                    data-active={playerState === "error" || undefined}
                  >
                    <RotateCcw
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <div className={styles.waveSlot}>
                  <div
                    ref={waveRef}
                    className={styles.wave}
                    role="slider"
                    tabIndex={playerState === "error" ? -1 : 0}
                    aria-label="Clip position"
                    aria-valuemin={0}
                    aria-valuemax={active.clip}
                    aria-valuenow={Math.min(displaySecond, active.clip)}
                    aria-valuetext={`${shortClock(displaySecond)} of ${shortClock(active.clip)}`}
                    onPointerDown={handleSeek}
                    onPointerMove={handleSeek}
                    onKeyDown={(event) => {
                      if (playerState === "error" || playerState === "loading")
                        return;
                      const delta =
                        event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? 1
                          : event.key === "ArrowLeft" ||
                              event.key === "ArrowDown"
                            ? -1
                            : 0;
                      const target = delta
                        ? positionRef.current + delta
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? active.clip - 0.01
                            : -1;
                      if (target < 0 && !delta) return;
                      event.preventDefault();
                      seek(
                        Math.min(active.clip - 0.01, Math.max(0, target)),
                        active.clip,
                      );
                      if (playerState === "idle") setPlayerState("paused");
                    }}
                  >
                    <span className={styles.bars} aria-hidden="true">
                      {wave.map((bar, index) => (
                        <span key={index} style={{ height: `${100 * bar}%` }} />
                      ))}
                    </span>
                    <span
                      className={cx(styles.bars, styles.played)}
                      aria-hidden="true"
                    >
                      {wave.map((bar, index) => (
                        <span key={index} style={{ height: `${100 * bar}%` }} />
                      ))}
                    </span>
                  </div>
                  <span
                    className={styles.clipError}
                    aria-hidden={playerState !== "error"}
                  >
                    <CircleAlert
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    Clip unavailable, try again
                  </span>
                </div>
                <span className={styles.clipTime}>
                  {shortClock(Math.min(displaySecond, active.clip))}
                  <span className={styles.clipTotal}>{clipTotalLabel}</span>
                </span>
              </div>
            </>
          ) : (
            <p className={styles.empty}>
              No key moments were flagged on this call.
            </p>
          )}
        </div>
      </div>

      <div className={styles.section} data-frame-keep="">
        <SectionHead
          title={
            <>
              <ClaudeMark width={14} height={14} className={styles.titleMark} />
              <span>Summary</span>
              <span className={styles.model}>{summaryModel}</span>
            </>
          }
        >
          {summary ? (
            <CopyButton
              value={summary}
              label="Copy summary"
              iconOnly
              variant="plain"
              className={styles.copy}
              disabled={summaryState !== "done"}
            />
          ) : null}
        </SectionHead>
        {summary ? (
          <div className={styles.summary} aria-busy={summaryState !== "done"}>
            <p className={styles.summaryGhost} aria-hidden="true">
              {summary}
            </p>
            <p
              className={styles.summaryText}
              aria-hidden={summaryState !== "done"}
            >
              {chunks.slice(0, visibleChunks).map((chunk, index) => (
                <span
                  key={index}
                  className={reduced ? undefined : styles.chunk}
                >
                  {chunk}
                </span>
              ))}
            </p>
            {summaryState === "done" ? null : (
              <p className={styles.srOnly}>Summarizing the call.</p>
            )}
            <span
              className={styles.thinking}
              data-active={summaryState === "waiting" || undefined}
              aria-hidden="true"
            >
              <TextShimmer active={summaryState === "waiting" && seen}>
                {shimmerLabel}
              </TextShimmer>
            </span>
          </div>
        ) : (
          <p className={styles.empty}>No summary for this call yet.</p>
        )}
      </div>

      <div className={styles.section} data-frame-keep="">
        <SectionHead title="Next steps">
          <span className={styles.num}>
            {doneCount} of {nextSteps.length} done
          </span>
        </SectionHead>
        {nextSteps.length ? (
          <ul className={styles.steps}>
            {nextSteps.map((step) => {
              const owner = speakerOf(step.ownerId);
              const checked = !!done[step.id];
              return (
                <li
                  key={step.id}
                  className={styles.step}
                  data-done={checked || undefined}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => toggleStep(step, next === true)}
                    aria-label={step.label}
                    className={styles.check}
                  />
                  <span className={styles.stepLabel}>{step.label}</span>
                  <span className={styles.owner} title={owner.name}>
                    <Avatar
                      name={owner.name}
                      src={owner.avatar}
                      size="sm"
                      className={styles.mini}
                      aria-hidden="true"
                    />
                    <span className={styles.ownerName}>
                      {owner.name.split(" ")[0]}
                    </span>
                    <span className={styles.srOnly}>
                      {`, owner ${owner.name}${owner.side === "external" ? `, ${call.company}` : ""}`}
                    </span>
                  </span>
                  <span className={styles.due}>
                    <span className={styles.srOnly}>due </span>
                    {step.due}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>No next steps yet.</p>
        )}
      </div>
    </section>
  );
}

export default CallInsights;
