/**
 * Sample data for the MRR waterfall.
 *
 * Three months of plan snapshots and their movements on one side, a derived quarter on the other,
 * plus the geometry helpers that turn them into bars, links and labels. Swap `MONTHS` for rows from
 * your billing system; the totals, shares and statistics are all computed from them.
 */

export type MovementTone = "total" | "gain" | "loss";
export type Unit = "usd" | "pct";

export interface Movement {
  id: string;
  /** Full name, used in the panel heading and the table. */
  name: string;
  /** Abbreviated name, printed on the axis when space is tight. */
  axis: string;
  /** Shortest label, used when the chart is narrow. */
  short: string;
  tone: MovementTone;
}

/** Columns of the waterfall, in drawing order. */
export const MOVEMENTS: Movement[] = [
  { id: "start", name: "Starting MRR", axis: "Start", short: "Start", tone: "total" },
  { id: "new", name: "New business", axis: "New", short: "New", tone: "gain" },
  { id: "expansion", name: "Expansion", axis: "Expansion", short: "Exp.", tone: "gain" },
  { id: "reactivation", name: "Reactivation", axis: "Reactivation", short: "React.", tone: "gain" },
  { id: "contraction", name: "Contraction", axis: "Contraction", short: "Contr.", tone: "loss" },
  { id: "churn", name: "Churn", axis: "Churn", short: "Churn", tone: "loss" },
  { id: "end", name: "Ending MRR", axis: "End", short: "End", tone: "total" },
];

/** The five movements that move MRR up or down, in drawing order. */
export const MOVEMENT_IDS = ["new", "expansion", "reactivation", "contraction", "churn"] as const;

/** Plan tiers, coarsest first. */
const PLANS = ["Enterprise", "Scale", "Growth", "Starter"];

export interface PlanSplit {
  total: number;
  accounts: number;
  /** Amount and account count per tier, plus the remainder as the last pair. */
  plans: [number, number][];
}

export interface MovementDetail {
  /** Accounts that moved. */
  count: number;
  /** MRR that moved, in dollars. */
  total: number;
  /** Named accounts, each `[name, detail, amount]`, largest first. */
  top: [string, string, number][];
}

export interface MonthSource {
  id: string;
  label: string;
  long: string;
  range: string;
  from: string;
  to: string;
  start: PlanSplit;
  end: PlanSplit;
  moves: Record<string, MovementDetail>;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const integer = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** A plan snapshot; the last tier absorbs whatever the named tiers do not cover. */
function split(total: number, accounts: number, named: [number, number][]): PlanSplit {
  return {
    total,
    accounts,
    plans: [...named, [total - sum(named.map(([amount]) => amount)), accounts - sum(named.map(([, count]) => count))]],
  };
}

const july = split(412_380, 1241, [
  [151_200, 22],
  [137_760, 164],
  [96_880, 486],
]);
const august = split(430_800, 1276, [
  [156_900, 23],
  [144_120, 171],
  [101_450, 503],
]);
const september = split(442_080, 1287, [
  [158_300, 23],
  [149_660, 178],
  [105_230, 511],
]);
const october = split(465_650, 1337, [
  [167_400, 25],
  [157_980, 186],
  [110_820, 531],
]);

export const MONTHS: MonthSource[] = [
  {
    id: "jul",
    label: "Jul",
    long: "July 2025",
    range: "Jul 1 – 31, 2025",
    from: "Jul 1",
    to: "Jul 31",
    start: july,
    end: august,
    moves: {
      new: {
        count: 64,
        total: 18_640,
        top: [
          ["Halcyon Health", "Enterprise, annual", 4800],
          ["Kestrel Freight", "Scale, 60 seats", 1740],
          ["Juniper Legal", "Scale, 45 seats", 1310],
          ["Oakridge Schools", "Growth, 30 seats", 990],
        ],
      },
      expansion: {
        count: 41,
        total: 9870,
        top: [
          ["Brightwater Labs", "Growth to Scale", 1520],
          ["Tessellate", "Added 40 seats", 1160],
          ["Quillon Bank", "Added audit logs", 900],
          ["Pinecrest Realty", "Added 25 seats", 725],
        ],
      },
      reactivation: {
        count: 9,
        total: 2140,
        top: [
          ["Fathom Studio", "Back after 4 months, Growth", 597],
          ["Vireo Travel", "Back after 7 months, Growth", 398],
          ["Bramble Foods", "Back after 2 months, Starter", 245],
        ],
      },
      contraction: {
        count: 19,
        total: 4310,
        top: [
          ["Castor Mobility", "Scale to Growth", 1080],
          ["Sable Insurance", "Removed 30 seats", 870],
          ["Lattice Robotics", "Removed SSO add-on", 400],
        ],
      },
      churn: {
        count: 38,
        total: 7920,
        top: [
          ["Copperline Energy", "Moved to an in-house tool", 1990],
          ["Monarch Dental Group", "Budget cut", 1195],
          ["Wren & Wolfe", "Acquired by Rhodes Group", 796],
          ["Arbor & Finch", "Went back to spreadsheets", 398],
        ],
      },
    },
  },
  {
    id: "aug",
    label: "Aug",
    long: "August 2025",
    range: "Aug 1 – 31, 2025",
    from: "Aug 1",
    to: "Aug 31",
    start: august,
    end: september,
    moves: {
      new: {
        count: 52,
        total: 15_210,
        top: [
          ["Northpeak Logistics", "Enterprise, annual", 5200],
          ["Solace Clinics", "Scale, 50 seats", 1450],
          ["Harbor Cooperative", "Growth, 35 seats", 1040],
          ["Ember Coffee", "Growth, 20 seats", 597],
        ],
      },
      expansion: {
        count: 48,
        total: 12_460,
        top: [
          ["Halcyon Health", "Added 120 seats", 2400],
          ["Tessellate", "Growth to Scale", 1380],
          ["Kestrel Freight", "Added 30 seats", 870],
          ["Oakridge Schools", "Added data retention", 600],
        ],
      },
      reactivation: {
        count: 6,
        total: 1380,
        top: [
          ["Cobalt Studio", "Back after 6 months, Growth", 398],
          ["Ferris Outdoor", "Back after 3 months, Starter", 196],
        ],
      },
      contraction: {
        count: 26,
        total: 6040,
        top: [
          ["Quillon Bank", "Scale to Growth", 1660],
          ["Juniper Legal", "Removed 20 seats", 580],
          ["Brightwater Labs", "Removed audit logs", 450],
        ],
      },
      churn: {
        count: 47,
        total: 11_730,
        top: [
          ["Atlas Freightways", "Consolidated vendors", 3980],
          ["Sable Insurance", "Budget cut", 1470],
          ["Morrow Architects", "Moved to a competitor", 796],
          ["Tidewater Fitness", "Closed the business", 398],
        ],
      },
    },
  },
  {
    id: "sep",
    label: "Sep",
    long: "September 2025",
    range: "Sep 1 – 30, 2025",
    from: "Sep 1",
    to: "Sep 30",
    start: september,
    end: october,
    moves: {
      new: {
        count: 71,
        total: 21_950,
        top: [
          ["Granite Mutual", "Enterprise, annual", 6400],
          ["Orchard Health", "Scale, 80 seats", 2320],
          ["Pioneer Robotics", "Scale, 55 seats", 1595],
          ["Lark & Co", "Growth, 25 seats", 750],
        ],
      },
      expansion: {
        count: 36,
        total: 8730,
        top: [
          ["Northpeak Logistics", "Added 60 seats", 1200],
          ["Solace Clinics", "Growth to Scale", 1090],
          ["Halcyon Health", "Added SSO", 800],
        ],
      },
      reactivation: {
        count: 12,
        total: 3260,
        top: [
          ["Copperline Energy", "Back after 2 months, Scale", 1990],
          ["Arbor & Finch", "Back after 2 months, Growth", 398],
          ["Marlow Books", "Back after 9 months, Starter", 147],
        ],
      },
      contraction: {
        count: 15,
        total: 3480,
        top: [
          ["Kestrel Freight", "Removed 15 seats", 435],
          ["Harbor Cooperative", "Growth to Starter", 350],
          ["Pinecrest Realty", "Removed SSO add-on", 300],
        ],
      },
      churn: {
        count: 33,
        total: 6890,
        top: [
          ["Castor Mobility", "Moved to a competitor", 1020],
          ["Ember Coffee", "Budget cut", 597],
          ["Vireo Travel", "Seasonal pause", 398],
        ],
      },
    },
  },
];

/** Fold the three months into one quarter, merging accounts that moved more than once. */
function quarter(): MonthSource {
  const moves = Object.fromEntries(
    MOVEMENT_IDS.map((id) => {
      const merged = new Map<string, { amount: number; months: string[]; detail: string }>();
      MONTHS.forEach((month) => {
        month.moves[id].top.forEach(([name, detail, amount]) => {
          const existing = merged.get(name);
          if (existing) {
            existing.amount += amount;
            existing.months.push(month.label);
          } else {
            merged.set(name, { amount, months: [month.label], detail });
          }
        });
      });
      const named = sum(MONTHS.map((month) => month.moves[id].top.length));
      const top: [string, string, number][] = [...merged].map(([name, entry]) => [
        name,
        entry.months.length > 1 ? `${entry.months.join(" and ")} · ${entry.months.length} changes` : `${entry.months[0]} · ${entry.detail}`,
        entry.amount,
      ]);
      return [
        id,
        {
          count: sum(MONTHS.map((month) => month.moves[id].count)) - (named - merged.size),
          total: sum(MONTHS.map((month) => month.moves[id].total)),
          top,
        },
      ];
    }),
  );
  return {
    id: "q3",
    label: "Q3",
    long: "Q3 2025",
    range: "Jul 1 – Sep 30, 2025",
    from: "Jul 1",
    to: "Sep 30",
    start: july,
    end: october,
    moves: moves as Record<string, MovementDetail>,
  };
}

export const SOURCES: MonthSource[] = [...MONTHS, quarter()];

export interface Entry {
  key: string;
  name: string;
  detail: string;
  amount: number;
}

export interface Column extends Movement {
  amount: number;
  count: number;
  entries: Entry[];
}

export interface WaterfallStats {
  /** Change in MRR across the window. */
  netNew: number;
  /** That change as a percentage of the starting MRR. */
  growth: number;
  /** Revenue kept and expanded from the starting base, as a percentage. */
  nrr: number;
  /** Gains divided by losses. */
  quick: number;
}

export interface Waterfall {
  id: string;
  label: string;
  long: string;
  range: string;
  from: string;
  to: string;
  start: number;
  end: number;
  columns: Column[];
  /** Height of the running total after each column, for drawing the links. */
  levels: number[];
  stats: WaterfallStats;
}

/** The plan split of a snapshot, as panel entries. */
function planEntries({ plans }: PlanSplit): Entry[] {
  return plans.map(([amount, accounts], index) => ({ key: PLANS[index], name: PLANS[index], detail: `${integer.format(accounts)} accounts`, amount }));
}

/** The five biggest accounts behind a movement, with the remainder rolled into "Other accounts". */
function movementEntries(detail: MovementDetail): Entry[] {
  const biggest = [...detail.top].sort((a, b) => b[2] - a[2]).slice(0, 5);
  const entries: Entry[] = biggest.map(([name, description, amount]) => ({ key: name, name, detail: description, amount }));
  const rest = detail.count - biggest.length;
  if (rest > 0) {
    entries.push({ key: "rest", name: "Other accounts", detail: `${integer.format(rest)} accounts`, amount: detail.total - sum(biggest.map(([, , amount]) => amount)) });
  }
  return entries;
}

function build({ start, end, moves, ...period }: MonthSource): Waterfall {
  const columns: Column[] = MOVEMENTS.map((movement) => {
    if (movement.id === "start") return { ...movement, amount: start.total, count: start.accounts, entries: planEntries(start) };
    if (movement.id === "end") return { ...movement, amount: end.total, count: end.accounts, entries: planEntries(end) };
    const detail = moves[movement.id];
    return { ...movement, amount: detail.total, count: detail.count, entries: movementEntries(detail) };
  });
  const levels = [start.total];
  MOVEMENT_IDS.forEach((id) => levels.push(levels[levels.length - 1] + (id === "contraction" || id === "churn" ? -moves[id].total : moves[id].total)));
  const gains = moves.new.total + moves.expansion.total + moves.reactivation.total;
  const losses = moves.contraction.total + moves.churn.total;
  return {
    ...period,
    start: start.total,
    end: end.total,
    columns,
    levels,
    stats: {
      netNew: end.total - start.total,
      growth: ((end.total - start.total) / start.total) * 100,
      nrr: ((start.total + moves.expansion.total - losses) / start.total) * 100,
      quick: gains / losses,
    },
  };
}

export const WATERFALLS: Record<string, Waterfall> = Object.fromEntries(SOURCES.map((source) => [source.id, build(source)]));

export const PERIOD_OPTIONS = SOURCES.map((source) => ({ value: source.id, label: source.label }));

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "usd", label: "USD" },
  { value: "pct", label: "% of start" },
];

/** What the account count in each column refers to. */
const COUNT_PHRASES: Record<string, string> = {
  start: "paying accounts on",
  new: "new accounts",
  expansion: "accounts expanded",
  reactivation: "accounts came back",
  contraction: "accounts downgraded",
  churn: "accounts cancelled",
  end: "paying accounts on",
};

/** "paying accounts on Jul 1", "new accounts", … */
export function countPhrase(column: Movement, period: Waterfall): string {
  if (column.id === "start") return `${COUNT_PHRASES.start} ${period.from}`;
  if (column.id === "end") return `${COUNT_PHRASES.end} ${period.to}`;
  return COUNT_PHRASES[column.id];
}

/** An empty path, used wherever a shape is not tall enough to draw. */
export const EMPTY_PATH = "M0 0";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const glyph = (tone: MovementTone) => (tone === "gain" ? "+" : tone === "loss" ? "−" : "");

/** Height of the plot, between 232 and 300 px depending on the container width. */
export const chartHeight = (width: number) => Math.round(clamp(0.44 * width, 232, 300));

/** Column band width and bar width for a given container width. */
export function bandGeometry(width: number) {
  const band = (width - 48) / 7;
  const bar = Math.round(clamp(0.56 * band, 12, 56));
  return { band, bar, left: (index: number) => Math.round(48 + band * index + (band - bar) / 2) };
}

/** A figure with its sign, ready for the rolling counter. */
export function figure(amount: number, tone: MovementTone, unit: Unit, start: number): { value: number; decimals?: number; prefix: string; suffix?: string; key: string } {
  const mark = glyph(tone);
  return unit === "pct"
    ? { value: (amount / start) * 100, decimals: 2, prefix: mark, suffix: "%", key: `pct${mark}` }
    : { value: amount, prefix: `${mark}$`, key: `usd${mark}` };
}

/** "+$55,800" or "−13.49% of starting MRR", for the screen reader copy. */
export function describeAmount(amount: number, tone: MovementTone, unit: Unit, start: number): string {
  return unit === "pct" ? `${glyph(tone)}${((amount / start) * 100).toFixed(2)}% of starting MRR` : `${glyph(tone)}${dollars.format(amount)}`;
}

/** The y axis for a period, padded around the running totals and snapped to a round step. */
export function axisScale(period: Waterfall, unit: Unit): { lo: number; hi: number; ticks: number[] } {
  const factor = unit === "pct" ? 100 / period.start : 1;
  const scaled = period.levels.map((level) => level * factor);
  const min = Math.min(...scaled);
  const max = Math.max(...scaled);
  const span = max - min;
  const lo = min - 0.6 * span;
  const hi = max + 0.06 * span;
  const decade = 10 ** Math.floor(Math.log10((hi - lo) / 8));
  let step = 50 * decade;
  for (const multiple of [1, 2, 2.5, 5, 10, 20]) {
    const candidate = decade * multiple;
    if (Math.ceil(hi / candidate) - Math.floor(lo / candidate) <= 8) {
      step = candidate;
      break;
    }
  }
  const bottom = Math.floor(lo / step) * step;
  const top = Math.ceil(hi / step) * step;
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, index) => +(bottom + index * step).toFixed(4));
  return { lo: bottom / factor, hi: top / factor, ticks };
}

/** Axis tick text: "$525k" or "112%". */
export const tickText = (value: number, unit: Unit) => (unit === "pct" ? `${value}%` : `$${+(value / 1e3).toFixed(1)}k`);

/** Bar label text; the narrow layout drops the unit to save room. */
export function barText(amount: number, tone: MovementTone, unit: Unit, start: number, tight: boolean): string {
  const mark = glyph(tone);
  return unit === "pct" ? `${mark}${((amount / Math.max(1e-6, start)) * 100).toFixed(1)}${tight ? "" : "%"}` : `${mark}${tight ? "" : "$"}${(amount / 1e3).toFixed(1)}k`;
}
