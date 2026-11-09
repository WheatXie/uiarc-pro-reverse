"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Sparkles, Sun, TriangleAlert, Users } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./smart-scheduler.module.css";
import {
  findScheduleSlots,
  firstName,
  formatClock,
  formatHour,
  formatRange,
  inviteTitleFor,
  joinPeople,
  parseScheduleRequest,
  sampleDirectory,
  sampleOrganizer,
  sampleQuery,
  waitFor,
} from "./smart-scheduler-data";
import type {
  CalendarEvent,
  InvitePayload,
  SchedulePhase,
  SchedulePerson,
  ScheduleRequest,
  ScheduleSlot,
  TimeWindow,
} from "./smart-scheduler-data";

export type {
  CalendarEvent,
  InvitePayload,
  ScheduleConflict,
  ScheduleDay,
  SchedulePerson,
  SchedulePhase,
  ScheduleRange,
  ScheduleRequest,
  ScheduleSlot,
  TimeWindow,
} from "./smart-scheduler-data";
export { findScheduleSlots, parseScheduleRequest, sampleDirectory, sampleOrganizer } from "./smart-scheduler-data";

/** The shipped block eases every crossfade on this curve, and only the exit is shorter than the enter. */
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const enter = { duration: motionTokens.duration.fast, ease: easeStandard } as const;
const exit = { duration: .1, ease: easeStandard } as const;
/** The ranked-row highlight and the rows' height ride this spring: quick, never overshooting. */
const glide: Transition = { type: "spring", visualDuration: .24, bounce: 0 };

export interface SmartSchedulerProps {
  /** The request the field starts with, and the one autoplay types through. */
  defaultQuery?: string;
  placeholder?: string;
  organizer?: SchedulePerson;
  directory?: SchedulePerson[];
  /** Replaces the built-in parser: resolve the request, or throw an Error whose message is shown in the error state. */
  parse?: (query: string, signal: AbortSignal) => Promise<ScheduleRequest> | ScheduleRequest;
  /** Replaces the built-in ranking: return the slots to offer, best first. */
  findSlots?: (request: ScheduleRequest, signal: AbortSignal) => Promise<ScheduleSlot[]> | ScheduleSlot[];
  /** Called when the invite is sent. Without it the block simulates a send and says so. */
  onSend?: (invite: InvitePayload, signal: AbortSignal) => Promise<void> | void;
  onPick?: (slot: ScheduleSlot) => void;
  meetLink?: string;
  timeZone?: string;
  /** Drives the demo on its own. Defaults to on when nothing else is wired up. */
  autoPlay?: boolean;
  /**
   * Beat lengths of the demo script, in ms. Defaults are the shipped ones; a page that gets its
   * first screenshot on load can tighten the opening so the block is already on the beat the live
   * frame is photographed on.
   */
  pace?: SchedulerPace;
  className?: string;
}

/** Beat lengths of the demo script, in ms. */
export interface SchedulerPace {
  /** Idle beat before the script reads the request already in the field. */
  leadIn?: number;
  /** Reading beat, used when no `parse` prop is supplied. */
  parse?: number;
  /** Calendar check, used when no `findSlots` prop is supplied. */
  check?: number;
  /** Holds of the four hover beats, in ms: first slot, second, third, then the pick. */
  beats?: readonly number[];
}

const shippedPace = { leadIn: 1100, parse: 650, check: 850 } as const;
const shippedBeats = [900, 700, 700, 520] as const;

/** Four legs of the same request, read as chips under the field. */
interface ChipItem {
  key: string;
  node: ReactNode;
}

interface MarkProps {
  title?: string;
  className?: string;
}

function GoogleCalendarMark({ title = "Google Calendar", className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={className}>
      <path fill="#4285F4" d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
    </svg>
  );
}

function OutlookMark({ title = "Microsoft Outlook", className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={className}>
      <rect x="7.5" y="3" width="16" height="18" rx="2" fill="#0078D4" />
      <path fill="#28A8EA" d="M7.5 10.6 15.5 15.4l8-4.8V19a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z" />
      <path fill="#50D9FF" d="M15.5 3h6a2 2 0 0 1 2 2v3.4h-8z" opacity=".55" />
      <rect x="0.5" y="6" width="12.5" height="12" rx="2" fill="#0A5CB0" />
      <ellipse cx="6.75" cy="12" rx="2.75" ry="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

function MeetMark({ title = "Google Meet", className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={className}>
      <path fill="#EA4335" d="M5.53 2.13 0 7.75h5.53z" />
      <path fill="#FFBA00" d="M5.928 2.13v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36z" />
      <path fill="#00832D" d="M23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.120-7.468 6.190 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825z" />
      <path fill="#2684FC" d="M.038 8.15v7.7h5.53v-7.7z" />
      <path fill="#00AC47" d="M13.615 16.25H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.020-.07 1.618-1.12 1.468-2.07v-2.51l-5.470-4.680v3.650z" />
      <path fill="#0066DA" d="M.038 16.25c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z" />
    </svg>
  );
}

function Avatar({ person, size = 20 }: { person: SchedulePerson; size?: number }) {
  const initials = person.name.split(" ").map(part => part[0]).join("").slice(0, 2);
  return person.avatar
    ? <img className={styles.avatar} src={person.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">{initials}</span>;
}

/** The provider mark next to a name: Google Calendar or Outlook, whichever that person's events come from. */
function ProviderMark({ person }: { person: SchedulePerson }) {
  if (person.calendar === "outlook") return <OutlookMark className={styles.mark} title="Outlook calendar" />;
  if (person.calendar === "google") return <GoogleCalendarMark className={styles.mark} />;
  return null;
}

/** "What was understood": one chip per leg of the request, or the reading hint while the request is parsed. */
function Chips({ phase, request }: { phase: SchedulePhase; request: ScheduleRequest | null }) {
  const items: ChipItem[] = request
    ? [
      {
        key: "duration",
        node: <>
          <Clock size={14} aria-hidden="true" />
          {request.duration} min
        </>,
      },
      {
        key: "people",
        node: <>
          <span className={styles.stack} aria-hidden="true">
            {request.people.slice(0, 3).map(person => <Avatar key={person.id} person={person} size={16} />)}
          </span>
          <span className={styles.truncate}>{request.people.map(firstName).join(", ")}</span>
        </>,
      },
      {
        key: "range",
        node: <>
          <CalendarDays size={14} aria-hidden="true" />
          {request.range.label}
          <span className={styles.chipDetail}>{request.range.detail}</span>
        </>,
      },
      {
        key: "window",
        node: <>
          <Sun size={14} aria-hidden="true" />
          {request.window.label}
          <span className={styles.chipDetail}>{formatHour(request.window.start)}–{formatHour(request.window.end)}</span>
        </>,
      },
    ]
    : [];

  return (
    <div className={styles.chips}>
      <AnimatePresence initial={false} mode="popLayout">
        {request
          ? <motion.ul key="chips" className={styles.chipList} aria-label="What was understood" exit={{ opacity: 0, transition: exit }}>
            {items.map((item, index) => (
              <motion.li key={item.key} className={styles.chip} initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: { ...enter, delay: .04 * index } }}>{item.node}</motion.li>
            ))}
          </motion.ul>
          : <motion.p
            key={phase === "parsing" ? "reading" : "hint"}
            className={styles.chipHint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: enter }}
            exit={{ opacity: 0, transition: exit }}
          >
            {phase === "parsing"
              ? <TextShimmer duration={1.2}>Reading your request</TextShimmer>
              : <><Users size={14} aria-hidden="true" />Duration, people, range and time of day</>}
          </motion.p>}
      </AnimatePresence>
    </div>
  );
}

/** Everyone's day at a glance: a row per calendar of busy blocks, with the chosen slot drawn as one column across them. */
function Availability({
  attendees,
  organizerId,
  slot,
  window,
  checking,
  calendars,
  timeZone,
}: {
  attendees: SchedulePerson[] | null;
  organizerId: string;
  slot: ScheduleSlot | null;
  window: TimeWindow | null | undefined;
  checking: boolean;
  calendars: number;
  timeZone: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const count = attendees?.length ?? 3;
  const span = window ? window.end - window.start : 180;
  const percentOf = (minutes: number) => window ? 100 * Math.min(Math.max((minutes - window.start) / span, 0), 1) : 0;

  const ticks: number[] = [];
  if (window) {
    const step = span > 240 ? 120 : 60;
    for (let minute = window.start; minute <= window.end; minute += step) ticks.push(minute);
  }

  const titleKey = checking ? "checking" : slot ? slot.day.id : "idle";
  /** The column jumps into place the first time a slot appears and glides on every later change. */
  const [hadSlot, setHadSlot] = useState(false);
  const justAppeared = Boolean(slot) && !hadSlot;
  if (Boolean(slot) !== hadSlot) setHadSlot(Boolean(slot));

  return (
    <section className={styles.availability} aria-label="Availability">
      <div className={styles.availHead}>
        <span className={styles.availTitle}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={titleKey}
              className={styles.availTitleText}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0, transition: enter }}
              exit={{ opacity: 0, transition: exit }}
            >
              {checking
                ? <TextShimmer duration={1.2}>{`Checking ${calendars} calendars`}</TextShimmer>
                : slot ? slot.day.label : "Availability"}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className={styles.availMeta}>{window ? `${formatHour(window.start)}–${formatHour(window.end)} ${timeZone}` : timeZone}</span>
      </div>
      <motion.div
        className={styles.rows}
        initial={false}
        animate={{ height: 24 * count + (count - 1) * 8 }}
        transition={reduced ? { duration: 0 } : glide}
      >
        {Array.from({ length: count }, (_, index) => {
          const person = attendees?.[index];
          const events = person && slot ? (slot.busy[person.id] ?? []) : [];
          return (
            <div key={person?.id ?? `row-${index}`} className={styles.row}>
              <div className={styles.person}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={person?.id ?? "placeholder"}
                    className={styles.personInner}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: enter }}
                    exit={{ opacity: 0, transition: exit }}
                  >
                    {person
                      ? <>
                        <Avatar person={person} />
                        <span className={styles.personName}>{person.id === organizerId ? "You" : firstName(person)}</span>
                        <ProviderMark person={person} />
                      </>
                      : <>
                        <span className={styles.avatarGhost} />
                        <span className={styles.nameGhost} />
                      </>}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div
                className={styles.track}
                role="img"
                aria-label={person && slot
                  ? `${person.id === organizerId ? "You" : person.name}: ${events.filter(event => window && event.end > window.start && event.start < window.end).map(event => `${event.title}${event.tentative ? " (tentative)" : ""}`).join(", ") || "free"}`
                  : "No calendar loaded"}
              >
                <AnimatePresence initial={false}>
                  {window && events.filter((event: CalendarEvent) => event.end > window.start && event.start < window.end).map(event => {
                    const clashes = slot !== null && event.start < slot.end && event.end > slot.start;
                    return (
                      <motion.span
                        key={`${slot?.day.id}-${event.start}-${event.title}`}
                        className={styles.busy}
                        data-tentative={event.tentative || undefined}
                        data-conflict={clashes || undefined}
                        title={`${event.title}${event.tentative ? ", tentative" : ""}`}
                        style={{ left: `calc(${percentOf(event.start)}% + 1px)`, width: `calc(${percentOf(event.end) - percentOf(event.start)}% - 2px)` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: enter }}
                        exit={{ opacity: 0, transition: exit }}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
        <div className={styles.columnLayer} aria-hidden="true">
          <motion.span
            className={styles.column}
            initial={false}
            animate={slot && window ? { left: `${percentOf(slot.start)}%`, width: `${percentOf(slot.end) - percentOf(slot.start)}%`, opacity: 1 } : { opacity: 0 }}
            transition={reduced || justAppeared ? { duration: 0, opacity: enter } : { left: glide, width: glide, opacity: enter }}
          />
        </div>
      </motion.div>
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((minute, index) => (
          <span
            key={minute}
            className={styles.tick}
            data-edge={index === 0 ? "start" : index === ticks.length - 1 ? "end" : undefined}
            style={{ left: `${percentOf(minute)}%` }}
          >
            {formatHour(minute)}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Three placeholder rows while calendars are being read, the same height as real ones so the panel never jumps. */
function SlotSkeleton() {
  return (
    <div className={styles.slotList} aria-hidden="true">
      <ul className={styles.slots}>
        {[0, 1, 2].map(index => (
          <li key={index} className={styles.skeletonRow}>
            <span className={styles.skeletonBar} style={{ width: `${46 - 6 * index}%` }} />
            <span className={styles.skeletonBar} data-short style={{ width: `${62 - 8 * index}%` }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The draft invite: title, time, Meet link, everyone invited, then send. */
function InviteView({
  title,
  onTitle,
  slot,
  people,
  organizer,
  meetLink,
  timeZone,
  phase,
  sendError,
  simulated,
  onBack,
  onSend,
}: {
  title: string;
  onTitle: (value: string) => void;
  slot: ScheduleSlot;
  people: SchedulePerson[];
  organizer: SchedulePerson;
  meetLink: string;
  timeZone: string;
  phase: SchedulePhase;
  sendError: string;
  simulated: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const sending = phase === "sending";
  const sent = phase === "sent";

  return (
    <div className={styles.invite}>
      <input
        className={styles.titleInput}
        value={title}
        onChange={event => onTitle(event.target.value)}
        aria-label="Invite title"
        disabled={sent}
      />
      <ul className={styles.details}>
        <li className={styles.detail}>
          <CalendarDays size={14} aria-hidden="true" />
          <span className={styles.truncate}>
            {slot.day.label} <span className={styles.dot}>·</span> {formatRange(slot.start, slot.end)} {timeZone}
          </span>
        </li>
        <li className={styles.detail}>
          <MeetMark className={styles.mark} />
          <span className={styles.truncate}>{meetLink}</span>
          <CopyButton
            value={`https://${meetLink.replace(/^https?:\/\//, "")}`}
            iconOnly
            variant="plain"
            label="Copy Meet link"
            className={styles.copy}
          />
        </li>
        <li className={styles.detail}>
          <span className={styles.stack} aria-hidden="true">
            {[organizer, ...people].slice(0, 4).map(person => <Avatar key={person.id} person={person} size={16} />)}
          </span>
          <span className={styles.truncate}>
            {people.map(person => person.name).join(", ")}
            <span className={styles.muted}> and you</span>
          </span>
        </li>
      </ul>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onBack} disabled={sending || sent}>
          <ChevronLeft size={16} aria-hidden="true" />
          Back
        </Button>
        <span className={styles.sendStatus}>
          <AnimatePresence initial={false} mode="popLayout">
            {sendError
              ? <motion.span
                key="error"
                className={styles.sendStatusInner}
                data-tone="warn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: enter }}
                exit={{ opacity: 0, transition: exit }}
              >
                <TriangleAlert size={14} aria-hidden="true" />
                <span className={styles.truncate}>{sendError}</span>
              </motion.span>
              : sent
                ? <motion.span
                  key="sent"
                  className={styles.sendStatusInner}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: enter }}
                  exit={{ opacity: 0, transition: exit }}
                >
                  <span className={styles.truncate}>
                    {simulated ? "Simulated, nothing was sent" : `Sent to ${people.length} ${people.length === 1 ? "guest" : "guests"}`}
                  </span>
                </motion.span>
                : null}
          </AnimatePresence>
        </span>
        <Button
          size="sm"
          className={styles.sendButton}
          loading={sending}
          aria-disabled={sent || undefined}
          onClick={sent ? undefined : onSend}
        >
          {sent
            ? <><Check size={16} aria-hidden="true" />Sent</>
            : "Send invite"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Schedules a meeting from one sentence: reads duration, people, a day range and a time of day, ranks the free
 * quarter hours across everyone's calendars, then drafts the invite. Left alone it runs the whole loop on its own.
 */
export function SmartScheduler({
  defaultQuery = sampleQuery,
  placeholder = "Find 30 min with Maya next week",
  organizer = sampleOrganizer,
  directory = sampleDirectory,
  parse,
  findSlots,
  onSend,
  onPick,
  meetLink = "meet.google.com/kfq-rvwp-zte",
  timeZone = "ET",
  autoPlay,
  pace,
  className,
}: SmartSchedulerProps) {
  const reduced = useReducedMotion() ?? false;
  const { leadIn = shippedPace.leadIn, parse: parseDelay = shippedPace.parse, check: checkDelay = shippedPace.check, beats = shippedBeats } = pace ?? {};
  const simulated = !parse && !findSlots && !onSend;

  const [auto, setAuto] = useState(autoPlay ?? simulated);
  const [query, setQuery] = useState(defaultQuery);
  const [phase, setPhase] = useState<SchedulePhase>("idle");
  const [request, setRequest] = useState<ScheduleRequest | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [inviteIndex, setInviteIndex] = useState<number | null>(null);
  const [inviteTitle, setInviteTitle] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [live, setLive] = useState("");
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  const search = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setPhase("parsing");
    setRequest(null);
    setSlots([]);
    setActive(null);
    setInviteIndex(null);
    setError("");
    setSendError("");
    setStep(0);
    setLive("Reading your request");

    try {
      const nextRequest = parse ? await parse(text, signal) : (await waitFor(parseDelay, signal), parseScheduleRequest(text, directory));
      if (signal.aborted) return;
      setRequest(nextRequest);
      setPhase("checking");
      setLive(`Read ${nextRequest.duration} min with ${joinPeople(nextRequest.people.map(firstName))}, ${nextRequest.range.label.toLowerCase()}, ${nextRequest.window.label.toLowerCase()}. Checking calendars.`);

      const found = findSlots ? await findSlots(nextRequest, signal) : (await waitFor(checkDelay, signal), findScheduleSlots(nextRequest, organizer));
      if (signal.aborted) return;
      const top = found.slice(0, 3);
      setSlots(top);
      setPhase(top.length ? "slots" : "empty");
      setLive(top.length
        ? `${top.length} times found. Best: ${top[0].day.label}, ${formatRange(top[0].start, top[0].end)}.`
        : "No time works for everyone in that range.");
    } catch (caught) {
      if (signal.aborted) return;
      const message = caught instanceof Error && caught.message ? caught.message : "Couldn’t read that request.";
      setError(message);
      setPhase("error");
      setLive(message);
    }
  }, [parse, findSlots, directory, organizer, parseDelay, checkDelay]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = useCallback((index: number) => {
    const slot = slots[index];
    if (!slot || !request) return;
    setInviteIndex(index);
    setActive(null);
    setSendError("");
    setInviteTitle(inviteTitleFor(request.people));
    setPhase("invite");
    setLive(`Draft invite for ${slot.day.label}, ${formatRange(slot.start, slot.end)}.`);
    onPick?.(slot);
  }, [slots, request, onPick]);

  const back = useCallback(() => {
    abortRef.current?.abort();
    setPhase("slots");
    setSendError("");
    setLive("Back to suggested times.");
  }, []);

  const send = useCallback(async () => {
    const slot = inviteIndex === null ? undefined : slots[inviteIndex];
    if (!slot || !request) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const invite: InvitePayload = {
      title: inviteTitle.trim() || inviteTitleFor(request.people),
      slot,
      organizer,
      people: request.people,
      meetLink,
      timeZone,
    };
    setPhase("sending");
    setSendError("");
    setLive("Sending invite");
    try {
      if (onSend) await onSend(invite, controller.signal);
      else await waitFor(800, controller.signal);
      if (controller.signal.aborted) return;
      setPhase("sent");
      const names = joinPeople(request.people.map(person => person.name));
      setLive(onSend ? `Invite sent to ${names}.` : `Invite sent to ${names}. Simulated, nothing was sent.`);
    } catch {
      if (controller.signal.aborted) return;
      setPhase("invite");
      setSendError("Couldn’t send. Try again.");
      setLive("The invite couldn’t be sent. Try again.");
    }
  }, [inviteIndex, slots, request, inviteTitle, organizer, meetLink, timeZone, onSend]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setQuery(defaultQuery);
    setPhase("idle");
    setRequest(null);
    setSlots([]);
    setActive(null);
    setInviteIndex(null);
    setInviteTitle("");
    setError("");
    setSendError("");
    setStep(0);
    setLive("");
  }, [defaultQuery]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** Play once on its own for people who ask their system for less motion, then hand control over. */
  useEffect(() => {
    if (reduced && auto && !autoRan.current) {
      autoRan.current = true;
      setAuto(false);
      void search(defaultQuery);
    }
  }, [reduced, auto, search, defaultQuery]);

  /** The demo script: one beat per phase, so the block shows parse, rank, pick and send without anyone touching it. */
  useEffect(() => {
    if (!auto || !visible || reduced) return;
    let delay = 0;
    let action: (() => void) | null = null;
    if (phase === "idle") {
      delay = leadIn;
      action = () => void search(query);
    } else if (phase === "slots") {
      const steps: (() => void)[] = [() => setActive(1), () => setActive(2), () => setActive(0), () => pick(0)];
      const hold = beats[step];
      if (hold !== undefined) {
        delay = hold;
        action = () => {
          steps[step]?.();
          setStep(value => value + 1);
        };
      }
    } else if (phase === "invite") {
      delay = 1300;
      action = () => void send();
    } else if (phase === "sent" || phase === "empty" || phase === "error") {
      delay = 2600;
      action = reset;
    }
    if (!action) return;
    const timer = window.setTimeout(action, delay);
    return () => window.clearTimeout(timer);
  }, [auto, visible, reduced, phase, step, query, search, pick, send, reset, leadIn, beats]);

  const stopAuto = () => {
    if (auto) setAuto(false);
  };

  const working = phase === "parsing" || phase === "checking";
  const inviting = phase === "invite" || phase === "sending" || phase === "sent";
  const activeSlot = inviting ? (inviteIndex ?? 0) : phase === "slots" ? (active ?? 0) : null;
  const shownSlot = activeSlot === null ? null : (slots[activeSlot] ?? null);
  const attendees = request ? [organizer, ...request.people] : null;
  const view = working ? "loading" : inviting ? "invite" : phase;
  const inviteSlot = inviteIndex === null ? null : (slots[inviteIndex] ?? null);

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerDown={stopAuto}
      onKeyDown={event => {
        stopAuto();
        if (event.key === "Escape" && phase === "invite") {
          event.preventDefault();
          back();
        }
      }}
    >
      <form
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          if (query.trim()) void search(query);
        }}
        role="search"
        aria-label="Schedule a meeting"
      >
        <div
          className={styles.field}
          onPointerDown={event => {
            if (event.target === event.currentTarget) {
              event.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          <Sparkles className={styles.fieldIcon} size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Describe the meeting"
            className={styles.input}
            value={query}
            placeholder={placeholder}
            onChange={event => {
              stopAuto();
              setQuery(event.target.value);
            }}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <Button type="submit" size="sm" className={styles.submit} loading={working} disabled={!query.trim()} aria-label="Find times">
            <ArrowUp size={16} aria-hidden="true" />
            <span className={styles.submitLabel}>Find times</span>
          </Button>
        </div>
      </form>

      <Chips phase={phase} request={request} />

      <Availability
        attendees={attendees}
        organizerId={organizer.id}
        slot={shownSlot}
        window={request?.window ?? null}
        checking={phase === "checking"}
        calendars={attendees?.length ?? 0}
        timeZone={timeZone}
      />

      <div className={styles.body}>
        <AnimatePresence initial={false}>
          <motion.div
            key={view}
            className={styles.view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: enter }}
            exit={{ opacity: 0, transition: exit }}
          >
            {view === "idle" && <p className={styles.hint}>Ranked times across everyone’s calendars appear here</p>}
            {view === "loading" && <SlotSkeleton />}
            {view === "slots" && (
              <div className={styles.slotList} onPointerLeave={() => setActive(null)}>
                <motion.div
                  className={styles.highlight}
                  aria-hidden="true"
                  initial={false}
                  animate={{ y: (activeSlot ?? 0) * 60 }}
                  transition={reduced ? { duration: 0 } : glide}
                />
                <ul className={styles.slots} aria-label="Suggested times">
                  {slots.map((slot, index) => (
                    <li key={slot.id}>
                      <button
                        ref={node => { slotRefs.current[index] = node; }}
                        type="button"
                        className={styles.slot}
                        data-active={activeSlot === index || undefined}
                        onPointerEnter={() => setActive(index)}
                        onFocus={() => setActive(index)}
                        onClick={() => pick(index)}
                        onKeyDown={event => {
                          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                          event.preventDefault();
                          const next = (index + (event.key === "ArrowDown" ? 1 : -1) + slots.length) % slots.length;
                          slotRefs.current[next]?.focus();
                        }}
                      >
                        <span className={styles.slotMain}>
                          <span className={styles.slotTop}>
                            <span className={styles.slotDay}>{slot.day.label}</span>
                            <span className={styles.slotTime}>{formatRange(slot.start, slot.end)}</span>
                          </span>
                          <span className={styles.slotReason} data-tone={slot.conflicts.length ? "warn" : "ok"}>
                            {slot.conflicts.length
                              ? <TriangleAlert size={14} aria-hidden="true" />
                              : <Check size={14} aria-hidden="true" />}
                            <span className={styles.truncate}>{slot.reason}</span>
                          </span>
                        </span>
                        <span className={styles.slotEnd}>
                          {index === 0 && <span className={styles.best}>Best</span>}
                          <ChevronRight className={styles.chevron} size={16} aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view === "empty" && (
              <div className={styles.state}>
                <p className={styles.stateTitle}>No time works for everyone</p>
                <p className={styles.stateText}>
                  {request ? `${request.duration} min, ${request.range.label.toLowerCase()}, ${request.window.label.toLowerCase()}` : "Try a wider range"}
                </p>
                {request && request.window.id !== "any" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const wider = defaultQuery.replace(/,?\s*\b(in the )?(mornings?|afternoons?)\b/gi, "").trim();
                      setQuery(wider);
                      void search(wider);
                    }}
                  >
                    Try any time of day
                  </Button>
                )}
              </div>
            )}
            {view === "error" && (
              <div className={styles.state}>
                <p className={styles.stateTitle}>
                  <TriangleAlert className={styles.warnIcon} size={14} aria-hidden="true" />
                  {error}
                </p>
                <p className={styles.stateText}>Try “{defaultQuery}”</p>
              </div>
            )}
            {view === "invite" && inviteSlot && request && (
              <InviteView
                title={inviteTitle}
                onTitle={setInviteTitle}
                slot={inviteSlot}
                people={request.people}
                organizer={organizer}
                meetLink={meetLink}
                timeZone={timeZone}
                phase={phase}
                sendError={sendError}
                simulated={simulated}
                onBack={back}
                onSend={() => void send()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
    </div>
  );
}

export default SmartScheduler;
