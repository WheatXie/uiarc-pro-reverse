/**
 * Sample data for the week calendar: four calendars and five weeks of events
 * around a fixed Monday (21 Sep 2026), the same fixtures the live demo shows.
 *
 * Days are counted from 1970-01-01 UTC and a day plus a wall-clock minute gives
 * a moment, so the calendar's mathematics never has to carry a Date around.
 * The time-zone helpers live here because the fixture generator and the view
 * both need them, and this keeps the component file focused on rendering.
 */

export interface CalendarSource {
  id: string;
  name: string;
  /** A built-in palette name (blue, green, violet, amber, rose, teal) or any CSS colour. */
  color: string;
  hidden?: boolean;
}

export interface Attendee {
  name: string;
  avatar?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  allDay?: boolean;
  location?: string;
  attendees?: Attendee[];
}

export const MINUTES_IN_DAY = 1440;

export const dayNumber = (year: number, month: number, day: number) =>
  Math.round(Date.UTC(year, month - 1, day) / 86_400_000);

export const dayOf = (minutes: number) => Math.floor(minutes / MINUTES_IN_DAY);

export const minuteOfDay = (minutes: number) =>
  ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

/** 0 is Sunday, matching Date#getDay and the weekStartsOn prop. */
export const weekdayOf = (day: number) => (((day + 4) % 7) + 7) % 7;

export const startOfWeek = (day: number, weekStartsOn: number) =>
  day - ((weekdayOf(day) - weekStartsOn + 7) % 7);

export const isWeekend = (day: number) => {
  const weekday = weekdayOf(day);
  return weekday === 0 || weekday === 6;
};

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone?: string) {
  const key = timeZone ?? "";
  const cached = zoneFormatters.get(key);
  if (cached) return cached;
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: undefined,
    });
  }
  zoneFormatters.set(key, formatter);
  return formatter;
}

/** The wall-clock time in `timeZone` as minutes since 1970-01-01 00:00 in that zone. */
export function wallMinutes(date: Date, timeZone?: string): number {
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  for (const part of zoneFormatter(timeZone).formatToParts(date)) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
    else if (part.type === "hour") hour = Number(part.value) % 24;
    else if (part.type === "minute") minute = Number(part.value);
  }
  return Math.round(Date.UTC(year, month - 1, day, hour, minute) / 60_000);
}

/** The instant at which the clocks in `timeZone` read `minutes`. */
export function instant(minutes: number, timeZone?: string): Date {
  let stamp = minutes * 60_000;
  for (let pass = 0; pass < 2; pass++) {
    const skew = wallMinutes(new Date(stamp), timeZone) - minutes;
    if (!skew) break;
    stamp -= skew * 60_000;
  }
  return new Date(stamp);
}

export const SAMPLE_CALENDARS: CalendarSource[] = [
  { id: "work", name: "Work", color: "blue" },
  { id: "meetings", name: "Team", color: "violet" },
  { id: "personal", name: "Personal", color: "green" },
  { id: "travel", name: "Travel", color: "amber" },
];

/** The week the demo opens on. */
export const SAMPLE_TODAY = new Date(Date.UTC(2026, 8, 24, 12));

const SAMPLE_WEEK = dayNumber(2026, 9, 21);

const PEOPLE: Record<string, Attendee> = {
  "emma-collins": {
    name: "Emma Collins",
    avatar: "/media/people/emma-collins.svg",
  },
  "marcus-johnson": {
    name: "Marcus Johnson",
    avatar: "/media/people/marcus-johnson.svg",
  },
  "jasmine-brooks": {
    name: "Jasmine Brooks",
    avatar: "/media/people/jasmine-brooks.svg",
  },
  "olivia-bennett": {
    name: "Olivia Bennett",
    avatar: "/media/people/olivia-bennett.svg",
  },
  "sofia-ramirez": {
    name: "Sofia Ramirez",
    avatar: "/media/people/sofia-ramirez.svg",
  },
  "ryan-sullivan": {
    name: "Ryan Sullivan",
    avatar: "/media/people/ryan-sullivan.svg",
  },
  "hannah-walsh": {
    name: "Hannah Walsh",
    avatar: "/media/people/hannah-walsh.svg",
  },
  "chloe-nguyen": {
    name: "Chloe Nguyen",
    avatar: "/media/people/chloe-nguyen.svg",
  },
  "ava-mitchell": {
    name: "Ava Mitchell",
    avatar: "/media/people/ava-mitchell.svg",
  },
  "daniel-kim": { name: "Daniel Kim", avatar: "/media/people/daniel-kim.svg" },
  "jordan-reyes": {
    name: "Jordan Reyes",
    avatar: "/media/people/jordan-reyes.svg",
  },
  "mateo-alvarez": {
    name: "Mateo Alvarez",
    avatar: "/media/people/mateo-alvarez.svg",
  },
  "tyler-hayes": {
    name: "Tyler Hayes",
    avatar: "/media/people/tyler-hayes.svg",
  },
  "andre-williams": {
    name: "Andre Williams",
    avatar: "/media/people/andre-williams.svg",
  },
  "nathan-cole": {
    name: "Nathan Cole",
    avatar: "/media/people/nathan-cole.svg",
  },
  "diane-foster": {
    name: "Diane Foster",
    avatar: "/media/people/diane-foster.svg",
  },
};

const people = (...ids: string[]): Attendee[] => ids.map((id) => PEOPLE[id]);

/** Monday-morning standup, the one meeting that repeats every working day. */
const TEAM = people(
  "marcus-johnson",
  "sofia-ramirez",
  "chloe-nguyen",
  "daniel-kim",
  "emma-collins",
);

type TimedRow = [
  day: number,
  start: string,
  end: string,
  title: string,
  calendar: string,
  location?: string,
  attendees?: Attendee[],
];

type AllDayRow = [
  day: number,
  endDay: number,
  title: string,
  calendar: string,
  location?: string,
];

type PoolRow = [
  start: string,
  end: string,
  title: string,
  calendar: string,
  location?: string,
  attendees?: Attendee[],
];

const TIMED: TimedRow[] = [
  [0, "9:00", "9:15", "Team standup", "meetings", "Video call", TEAM],
  [0, "9:30", "11:30", "Focus: Q4 planning doc", "work"],
  [
    0,
    "12:00",
    "13:00",
    "Lunch with Sofia",
    "personal",
    "Tartine Manufactory",
    people("sofia-ramirez"),
  ],
  [
    0,
    "13:30",
    "14:00",
    "1:1 with Marcus",
    "meetings",
    "Marcus's desk",
    people("marcus-johnson"),
  ],
  [
    0,
    "14:00",
    "15:00",
    "Pricing sync",
    "work",
    "Juniper room",
    people("ava-mitchell", "tyler-hayes", "andre-williams"),
  ],
  [
    0,
    "14:00",
    "14:30",
    "Quick sync with Daniel",
    "meetings",
    "Video call",
    people("daniel-kim"),
  ],
  [
    0,
    "14:30",
    "15:15",
    "Hiring debrief",
    "meetings",
    "Atlas room",
    people("nathan-cole", "olivia-bennett"),
  ],
  [0, "18:00", "19:00", "Climbing gym", "personal", "Mission Cliffs"],
  [1, "9:00", "9:15", "Team standup", "meetings", "Video call", TEAM],
  [
    1,
    "10:00",
    "11:30",
    "Design review: onboarding",
    "work",
    "Atlas room, 4th floor",
    people("jasmine-brooks", "emma-collins", "chloe-nguyen", "marcus-johnson"),
  ],
  [
    1,
    "11:00",
    "11:30",
    "Portfolio chat with Mateo",
    "meetings",
    "Video call",
    people("mateo-alvarez"),
  ],
  [1, "13:00", "15:00", "Focus: prototype the new editor", "work"],
  [
    1,
    "15:00",
    "15:45",
    "Customer call: Northwind",
    "work",
    "Video call",
    people("hannah-walsh", "ryan-sullivan"),
  ],
  [1, "17:00", "17:45", "Dentist", "personal", "Valencia Dental"],
  [2, "8:00", "8:30", "Pack for New York", "personal"],
  [2, "9:00", "9:15", "Team standup", "meetings", "Video call", TEAM],
  [
    2,
    "9:30",
    "10:30",
    "Sprint planning",
    "meetings",
    "Juniper room",
    people("daniel-kim", "olivia-bennett", "marcus-johnson"),
  ],
  [
    2,
    "10:30",
    "11:30",
    "Roadmap review",
    "work",
    "Atlas room",
    people("diane-foster", "nathan-cole"),
  ],
  [
    2,
    "11:00",
    "12:00",
    "Interview: staff engineer",
    "meetings",
    "Juniper room",
    people("olivia-bennett"),
  ],
  [
    2,
    "12:30",
    "18:05",
    "Flight UA 1542 to New York",
    "travel",
    "SFO Terminal 3, gate F12",
  ],
  [3, "9:00", "9:15", "Team standup", "meetings", "Video call", TEAM],
  [
    3,
    "9:30",
    "12:00",
    "Offsite: strategy session",
    "work",
    "Brooklyn Navy Yard",
    people("diane-foster", "nathan-cole", "jasmine-brooks", "tyler-hayes"),
  ],
  [
    3,
    "12:00",
    "13:00",
    "Lunch with the leadership team",
    "personal",
    "Olmsted",
  ],
  [
    3,
    "13:00",
    "16:30",
    "Offsite: team workshops",
    "work",
    "Brooklyn Navy Yard",
    people("diane-foster", "sofia-ramirez", "andre-williams"),
  ],
  [
    3,
    "16:30",
    "17:00",
    "1:1 with Nathan",
    "meetings",
    "Walk along the pier",
    people("nathan-cole"),
  ],
  [
    3,
    "19:00",
    "21:00",
    "Dinner at Lilia",
    "personal",
    "567 Union Ave",
    people("jasmine-brooks", "tyler-hayes"),
  ],
  [4, "9:00", "9:15", "Team standup", "meetings", "Video call", TEAM],
  [
    4,
    "10:00",
    "12:00",
    "Offsite: wrap up and next steps",
    "work",
    "Brooklyn Navy Yard",
    people("diane-foster", "nathan-cole"),
  ],
  [
    4,
    "13:00",
    "13:30",
    "Metrics review",
    "work",
    "Video call",
    people("chloe-nguyen"),
  ],
  [
    4,
    "15:00",
    "21:30",
    "Flight UA 2210 to San Francisco",
    "travel",
    "JFK Terminal 7",
  ],
  [5, "8:00", "9:00", "Long run, Golden Gate Park", "personal"],
  [5, "9:30", "11:00", "Farmers market", "personal", "Ferry Building"],
  [
    6,
    "11:00",
    "12:30",
    "Brunch with Emma",
    "personal",
    "Zazie, Cole Valley",
    people("emma-collins"),
  ],
  [6, "17:00", "17:30", "Plan the week", "work"],
];

const ALL_DAY: AllDayRow[] = [
  [2, 4, "Hotel: The Wythe", "travel", "80 Wythe Ave, Brooklyn"],
  [3, 4, "Leadership offsite", "work", "Brooklyn Navy Yard"],
  [3, 3, "Mom's birthday", "personal"],
];

/** Rows the generator sprinkles over the weeks on either side of the demo week. */
const POOL: PoolRow[] = [
  [
    "10:00",
    "11:00",
    "Product review",
    "work",
    "Atlas room",
    people("sofia-ramirez", "daniel-kim"),
  ],
  [
    "11:30",
    "12:00",
    "1:1 with Chloe",
    "meetings",
    "Video call",
    people("chloe-nguyen"),
  ],
  ["13:00", "15:00", "Focus: deep work", "work"],
  [
    "14:00",
    "14:45",
    "Partner sync",
    "meetings",
    "Video call",
    people("jordan-reyes"),
  ],
  [
    "15:30",
    "16:30",
    "Research readout",
    "work",
    "Juniper room",
    people("emma-collins", "olivia-bennett"),
  ],
  [
    "12:00",
    "13:00",
    "Lunch with Daniel",
    "personal",
    "Souvla, Hayes Valley",
    people("daniel-kim"),
  ],
  [
    "9:30",
    "10:30",
    "Roadmap grooming",
    "meetings",
    "Juniper room",
    people("marcus-johnson", "sofia-ramirez"),
  ],
  ["18:00", "19:00", "Pilates", "personal", "Mission studio"],
  ["10:30", "12:00", "Spec writing", "work"],
  [
    "14:30",
    "15:30",
    "Interview: product designer",
    "meetings",
    "Juniper room",
    people("olivia-bennett"),
  ],
];

const parseTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

function weekEvents(
  weekStart: number,
  timeZone: string | undefined,
  rows: TimedRow[],
  allDayRows: AllDayRow[],
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  rows.forEach(
    ([day, start, end, title, calendarId, location, attendees], index) => {
      events.push({
        id: `w${weekStart}-${index}`,
        title,
        calendarId,
        location,
        attendees,
        start: instant(
          (weekStart + day) * MINUTES_IN_DAY + parseTime(start),
          timeZone,
        ),
        end: instant(
          (weekStart + day) * MINUTES_IN_DAY + parseTime(end),
          timeZone,
        ),
      });
    },
  );
  allDayRows.forEach(([day, endDay, title, calendarId, location], index) => {
    events.push({
      id: `w${weekStart}-a${index}`,
      title,
      calendarId,
      location,
      allDay: true,
      start: instant((weekStart + day) * MINUTES_IN_DAY, timeZone),
      end: instant(
        (weekStart + Math.max(day, endDay) + 1) * MINUTES_IN_DAY,
        timeZone,
      ),
    });
  });
  return events;
}

/** A deterministic cascade, so every generated week looks the same on every load. */
function random(seed: number) {
  let state = seed + 0x6d2b79f5;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 0x100000000;
  };
}

function generatedWeek(weekStart: number) {
  const next = random(weekStart);
  const rows: TimedRow[] = [0, 1, 2, 3, 4].map((day) => [
    day,
    "9:00",
    "9:15",
    "Team standup",
    "meetings",
    "Video call",
    TEAM,
  ]);
  for (let day = 0; day < 5; day++) {
    const used = new Set<number>();
    for (let slot = 1 + Math.floor(3 * next()); slot > 0; slot--) {
      const pick = Math.floor(next() * POOL.length);
      if (used.has(pick)) continue;
      used.add(pick);
      rows.push([day, ...POOL[pick]]);
    }
  }
  if (next() > 0.4)
    rows.push([
      5,
      "9:30",
      "11:00",
      "Farmers market",
      "personal",
      "Ferry Building",
    ]);
  if (next() > 0.5)
    rows.push([6, "9:00", "10:30", "Long run", "personal", "Golden Gate Park"]);
  const allDay: AllDayRow[] =
    next() > 0.6
      ? [[Math.floor(5 * next()), 0, "Company holiday", "work"]]
      : [];
  return { rows, allDay };
}

/**
 * The demo's event set: four weeks either side of the sample week, so stepping
 * through the calendar always lands on a populated week.
 */
export function sampleEvents(timeZone?: string, weeks = 4): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let offset = -weeks; offset <= weeks; offset++) {
    const weekStart = SAMPLE_WEEK + offset * 7;
    const { rows, allDay } =
      weekStart === SAMPLE_WEEK
        ? { rows: TIMED, allDay: ALL_DAY }
        : generatedWeek(weekStart);
    events.push(...weekEvents(weekStart, timeZone, rows, allDay));
  }
  return events;
}
