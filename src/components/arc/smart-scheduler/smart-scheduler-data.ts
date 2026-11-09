/**
 * Sample data for the smart scheduler: an organizer, a directory, five weeks of busy blocks, day ranges, windows,
 * and the two pure helpers the block exposes (`parseScheduleRequest`, `findScheduleSlots`).
 * Times are minutes from midnight so ranking and formatting stay plain arithmetic.
 */

export type CalendarProvider = "google" | "outlook";

export interface SchedulePerson {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  calendar: CalendarProvider;
}

export interface CalendarEvent {
  start: number;
  end: number;
  title: string;
  tentative?: boolean;
}

/** A day the request can land on. `label` is what the block prints, so the sample never depends on the clock. */
export interface ScheduleDay {
  id: string;
  label: string;
}

export interface TimeWindow {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface ScheduleRange {
  label: string;
  detail: string;
  days: ScheduleDay[];
}

export interface ScheduleRequest {
  duration: number;
  people: SchedulePerson[];
  range: ScheduleRange;
  window: TimeWindow;
}

export interface ScheduleConflict {
  personId: string;
  title: string;
  tentative?: boolean;
}

export interface ScheduleSlot {
  id: string;
  day: ScheduleDay;
  start: number;
  end: number;
  reason: string;
  conflicts: ScheduleConflict[];
  /** Busy blocks per person for the slot's day, so the availability grid can draw every row from one object. */
  busy: Record<string, CalendarEvent[]>;
}

export interface ScoredSlot {
  score: number;
  slot: ScheduleSlot;
}

export type SchedulePhase = "idle" | "parsing" | "checking" | "slots" | "empty" | "error" | "invite" | "sending" | "sent";

export interface InvitePayload {
  title: string;
  slot: ScheduleSlot;
  organizer: SchedulePerson;
  people: SchedulePerson[];
  meetLink: string;
  timeZone: string;
}

export const sampleOrganizer: SchedulePerson = {
  id: "you",
  name: "Sofia Ramirez",
  avatar: "/media/people/sofia-ramirez.svg",
  email: "sofia@northwind.co",
  calendar: "google",
};

export const sampleDirectory: SchedulePerson[] = [
  { id: "maya", name: "Maya Chen", avatar: "/media/people/chloe-nguyen.svg", email: "maya@northwind.co", calendar: "google" },
  { id: "leo", name: "Leo Martins", avatar: "/media/people/mateo-alvarez.svg", email: "leo.martins@northwind.co", calendar: "outlook" },
  { id: "daniel", name: "Daniel Kim", avatar: "/media/people/daniel-kim.svg", email: "daniel.kim@northwind.co", calendar: "outlook" },
  { id: "hannah", name: "Hannah Walsh", avatar: "/media/people/hannah-walsh.svg", email: "hannah@northwind.co", calendar: "google" },
];

/** The query the block starts with, and the one autoplay types through. */
export const sampleQuery = "Find 30 min with Maya and Leo next week, mornings";

type DaySeed = { id: string; label: string; weekday: number };
const day = (id: string, label: string, weekday: number): DaySeed => ({ id, label, weekday });

const nextWeek = [
  day("2026-11-02", "Mon, Nov 2", 0),
  day("2026-11-03", "Tue, Nov 3", 1),
  day("2026-11-04", "Wed, Nov 4", 2),
  day("2026-11-05", "Thu, Nov 5", 3),
  day("2026-11-06", "Fri, Nov 6", 4),
];

const lastWeek = [
  day("2026-10-28", "Wed, Oct 28", 2),
  day("2026-10-29", "Thu, Oct 29", 3),
  day("2026-10-30", "Fri, Oct 30", 4),
];

/** Weekday index for every known day, so a busy table stays keyed by weekday rather than by date. */
const weekdayOf = new Map([...nextWeek, ...lastWeek].map(entry => [entry.id, entry.weekday]));

export const timeWindows: Record<"morning" | "afternoon" | "any", TimeWindow> = {
  morning: { id: "morning", label: "Mornings", start: 540, end: 720 },
  afternoon: { id: "afternoon", label: "Afternoons", start: 780, end: 1020 },
  any: { id: "any", label: "Any time", start: 540, end: 1020 },
};

/** Busy blocks per person, one row per weekday (Monday first). Minutes from midnight, 540 = 9 AM. */
const sampleBusy: Record<string, CalendarEvent[][]> = {
  you: [
    [{ start: 540, end: 630, title: "Ops weekly" }, { start: 660, end: 720, title: "Vendor review" }, { start: 840, end: 900, title: "Hiring sync" }, { start: 960, end: 990, title: "Budget check-in" }],
    [{ start: 540, end: 555, title: "Team standup" }, { start: 660, end: 705, title: "Hiring sync" }, { start: 810, end: 870, title: "Northwind QBR" }, { start: 960, end: 1020, title: "Focus time", tentative: true }],
    [{ start: 540, end: 555, title: "Team standup" }, { start: 660, end: 720, title: "Q4 planning" }, { start: 780, end: 840, title: "Lunch with Diane" }, { start: 900, end: 960, title: "Vendor review" }],
    [{ start: 540, end: 555, title: "Team standup" }, { start: 630, end: 690, title: "Customer call" }, { start: 840, end: 930, title: "Ops review" }],
    [{ start: 540, end: 720, title: "Offsite prep" }, { start: 840, end: 870, title: "Weekly wrap" }],
  ],
  maya: [
    [{ start: 600, end: 720, title: "Design review" }, { start: 780, end: 840, title: "Research sync" }, { start: 930, end: 990, title: "Portfolio review" }],
    [{ start: 540, end: 585, title: "Design crit" }, { start: 690, end: 720, title: "Lunch and learn" }, { start: 840, end: 900, title: "Figma office hours", tentative: true }, { start: 960, end: 990, title: "1:1 with Jasmine" }],
    [{ start: 630, end: 720, title: "User interviews" }, { start: 810, end: 900, title: "Workshop" }],
    [{ start: 540, end: 600, title: "Roadmap review" }, { start: 780, end: 810, title: "Design QA" }, { start: 900, end: 960, title: "User interviews" }],
    [{ start: 600, end: 660, title: "Design crit" }, { start: 780, end: 1020, title: "Focus time", tentative: true }],
  ],
  leo: [
    [{ start: 555, end: 585, title: "Platform standup" }, { start: 600, end: 690, title: "Incident review" }, { start: 780, end: 840, title: "Architecture review" }, { start: 900, end: 960, title: "On-call handoff" }],
    [{ start: 555, end: 585, title: "Platform standup" }, { start: 645, end: 690, title: "1:1 with Nathan" }, { start: 870, end: 930, title: "Hiring panel" }],
    [{ start: 555, end: 585, title: "Platform standup" }, { start: 600, end: 630, title: "Arch office hours", tentative: true }, { start: 840, end: 900, title: "Sprint planning" }],
    [{ start: 555, end: 585, title: "Platform standup" }, { start: 600, end: 630, title: "Security sync" }, { start: 810, end: 870, title: "Vendor demo", tentative: true }, { start: 960, end: 1020, title: "Deploy window" }],
    [{ start: 555, end: 585, title: "Platform standup" }, { start: 660, end: 720, title: "Demo day" }, { start: 900, end: 960, title: "Retro" }],
  ],
  daniel: [
    [{ start: 570, end: 600, title: "API review" }, { start: 840, end: 900, title: "Billing sync" }],
    [{ start: 600, end: 660, title: "Pairing" }, { start: 900, end: 960, title: "Postmortem" }],
    [{ start: 540, end: 600, title: "Backlog grooming" }, { start: 690, end: 720, title: "1:1 with Nathan" }],
    [{ start: 630, end: 690, title: "Load test" }, { start: 840, end: 870, title: "Billing sync" }],
    [{ start: 570, end: 630, title: "Demo prep" }, { start: 780, end: 840, title: "Retro" }],
  ],
  hannah: [
    [{ start: 540, end: 570, title: "Support triage" }, { start: 780, end: 870, title: "Customer onboarding" }],
    [{ start: 600, end: 630, title: "Support triage" }, { start: 840, end: 900, title: "Renewal call" }],
    [{ start: 540, end: 570, title: "Support triage" }, { start: 630, end: 690, title: "Health check" }],
    [{ start: 660, end: 720, title: "Customer onboarding" }, { start: 900, end: 960, title: "QBR prep" }],
    [{ start: 540, end: 570, title: "Support triage" }, { start: 660, end: 690, title: "Team sync" }],
  ],};

export const firstName = (person: SchedulePerson) => person.name.split(" ")[0];

/** "9 AM" — hour precision, for axis ticks and window bounds. */
export function formatHour(minutes: number) {
  const hour = Math.floor(minutes / 60);
  return `${((hour + 11) % 12) + 1} ${hour < 12 ? "AM" : "PM"}`;
}

/** "9:00 AM", or "9:00" when `suffix` is false. */
export function formatClock(minutes: number, suffix = true) {
  const hour = Math.floor(minutes / 60);
  return `${((hour + 11) % 12) + 1}:${String(minutes % 60).padStart(2, "0")}${suffix ? (hour < 12 ? " AM" : " PM") : ""}`;
}

/** Drops the suffix on the start time when both ends sit in the same half of the day: "10:00–10:30 AM". */
export function formatRange(start: number, end: number) {
  return start < 720 === end < 720 ? `${formatClock(start, false)}–${formatClock(end)}` : `${formatClock(start)}–${formatClock(end)}`;
}

/** "Maya, Leo" → "Maya and Leo". */
export function joinPeople(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

/** The default invite title: "Sync with Maya and Leo". */
export function inviteTitleFor(people: SchedulePerson[]) {
  const names = people.map(firstName);
  return `Sync with ${joinPeople(names)}`;
}

function abortable(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export { abortable as waitFor };

/**
 * Reads a plain-language request: duration (default 30, clamped to 15–240), people by first name, a day range
 * (tomorrow / this week / next week) and a time of day (morning / afternoon / any).
 */
export function parseScheduleRequest(query: string, directory: SchedulePerson[] = sampleDirectory): ScheduleRequest {
  const text = query.toLowerCase();
  let duration = 30;
  const amount = text.match(/(\d+(?:\.\d+)?)\s*(minutes|minute|mins|min|m\b|hours|hour|hrs|hr|h\b)/);
  if (amount) duration = Math.round(Number(amount[1]) * (amount[2].startsWith("h") ? 60 : 1));
  else if (/half an hour/.test(text)) duration = 30;
  else if (/\ban hour\b/.test(text)) duration = 60;
  duration = Math.min(Math.max(duration, 15), 240);

  const people = directory.filter(person => RegExp(`\\b${firstName(person).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
  if (!people.length) throw Error("Add who should join, for example “with Maya”.");

  const range: ScheduleRange = /tomorrow/.test(text)
    ? { label: "Tomorrow", detail: "Oct 28", days: lastWeek.slice(0, 1) }
    : /this week/.test(text)
      ? { label: "This week", detail: "Oct 28–30", days: lastWeek }
      : { label: "Next week", detail: "Nov 2–6", days: nextWeek };

  const window = /morning/.test(text) ? timeWindows.morning : /afternoon/.test(text) ? timeWindows.afternoon : timeWindows.any;
  return {
    duration,
    people,
    range: { ...range, days: range.days.map(({ id, label }) => ({ id, label })) },
    window,
  };
}

/**
 * Ranks every quarter hour in the window: later days score lower, each conflict costs 40 (22 when tentative),
 * a back-to-back block on either side costs 6, and off-half-hour starts cost 4. The best slot per day competes,
 * and the top three above 20 points come back.
 */
export function findScheduleSlots(request: ScheduleRequest, organizer: SchedulePerson = sampleOrganizer): ScheduleSlot[] {
  const everyone = [organizer, ...request.people];
  const possessive = (id: string) => id === organizer.id ? "your" : `${firstName(everyone.find(person => person.id === id) ?? organizer)}’s`;
  const scored: ScoredSlot[] = [];

  request.range.days.forEach((dayEntry, dayIndex) => {
    let best: ScoredSlot | undefined;
    const busy = Object.fromEntries(everyone.map(person => {
      const weekday = weekdayOf.get(dayEntry.id);
      return [person.id, weekday === undefined ? [] : (sampleBusy[person.id]?.[weekday] ?? [])];
    }));

    for (let start = request.window.start; start + request.duration <= request.window.end; start += 15) {
      let before: { id: string; block: CalendarEvent } | undefined;
      let after: { id: string; block: CalendarEvent } | undefined;
      const end = start + request.duration;
      const conflicts: ScheduleConflict[] = [];
      for (const person of everyone) {
        for (const block of busy[person.id]) {
          if (block.start < end && block.end > start) conflicts.push({ personId: person.id, title: block.title, tentative: block.tentative });
          else if (block.end <= start && block.end > start - 15) before ??= { id: person.id, block };
          else if (block.start >= end && block.start < end + 15) after ??= { id: person.id, block };
        }
      }

      let score = 100 - dayIndex;
      for (const conflict of conflicts) score -= conflict.tentative ? 22 : 40;
      if (before) score -= 6;
      if (after) score -= 6;
      if (start % 30 !== 0) score -= 4;

      const first = conflicts[0];
      const reason = first
        ? first.tentative
          ? `${possessive(first.personId)} ${first.title} is tentative`.replace(/^./, character => character.toUpperCase())
          : `Conflicts with ${possessive(first.personId)} ${first.title}`
        : before
          ? `Everyone free, right after ${possessive(before.id)} ${before.block.title}`
          : after
            ? `Everyone free, right before ${possessive(after.id)} ${after.block.title}`
            : "Everyone free, 15 min buffer";

      if (!best || score > best.score) {
        best = { score, slot: { id: `${dayEntry.id}-${start}`, day: dayEntry, start, end, reason, conflicts, busy } };
      }
    }
    if (best) scored.push(best);
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 3).filter(entry => entry.score > 20).map(entry => entry.slot);
}
