"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
  type Transition,
} from "motion/react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import SegmentedControl from "../segmented-control/segmented-control";
import { avatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./budget-variance.module.css";

/* ------------------------------------------------------------------ types */

/** One reporting window: the segmented switch label plus the copy that frames the figures. */
export interface BudgetPeriod {
  id: string;
  label: string;
  description: string;
  phrase: string;
}

/** A single budget line, with plan and actual amounts keyed by period id. */
export interface BudgetLine {
  id: string;
  name: string;
  budget: Record<string, number>;
  actual: Record<string, number>;
}

/** The person accountable for a department. */
export interface BudgetOwner {
  name: string;
  avatar?: string;
}

/** A department and the lines its total is summed from. */
export interface BudgetDepartment {
  id: string;
  name: string;
  owner: BudgetOwner;
  lines: readonly BudgetLine[];
}

type VarianceTone = "plan" | "over" | "under";

interface Figures {
  budget: number;
  actual: number;
  variance: number;
  share: number;
  ratio: number;
  tone: VarianceTone;
}

export interface BudgetVarianceProps {
  /**
   * Departments with an `id`, a `name`, an `owner` (`{ name, avatar? }`) and budget lines.
   * Each line has an `id`, a `name`, and `budget` and `actual` amounts keyed by period id.
   * Department figures and the total are summed from the lines.
   */
  departments?: readonly BudgetDepartment[];
  /**
   * Reporting windows for the switch, each with an `id`, a short `label`, a `description`
   * shown under the title and a `phrase` for screen reader sentences ("in the third quarter").
   */
  periods?: readonly BudgetPeriod[];
  /** Id of the window shown first. Defaults to the first period. */
  defaultPeriod?: string;
  /** Id of the department open on first render. Pass `null` to start with every department closed. */
  defaultExpanded?: string | null;
  /**
   * Qualitative band edges as shares of budget: the tolerance window sits between the two
   * values and anything past the second reads as over budget.
   */
  ranges?: readonly [number, number];
  /** Share of budget a variance has to clear before it stops counting as "on plan". */
  onPlanThreshold?: number;
  /** Symbol prefixed to every amount. */
  currency?: string;
  /** Heading above the table. */
  title?: string;
  /** Replaces the period description under the title. */
  description?: string;
  /** Called with the new period id when the reporting window changes. */
  onPeriodChange?: (periodId: string) => void;
  /**
   * Called when a department opens or closes. Opening one closes the one that was open,
   * which is reported first.
   */
  onDepartmentToggle?: (departmentId: string, open: boolean) => void;
  className?: string;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
}

/* ------------------------------------------------------------------- data */

export const budgetPeriods: readonly BudgetPeriod[] = [
  {
    id: "month",
    label: "Month",
    description: "September 2026",
    phrase: "in September",
  },
  {
    id: "quarter",
    label: "Quarter",
    description: "Q3 2026, July to September",
    phrase: "in the third quarter",
  },
  {
    id: "ytd",
    label: "Year to date",
    description: "January to September 2026",
    phrase: "so far this year",
  },
];
/** Nine months of plan and actuals, folded into the three reporting windows. */
function line(
  id: string,
  name: string,
  plan: number | readonly number[],
  ratios: readonly number[],
): BudgetLine {
  const budget = Array.from({ length: 9 }, (_, index) =>
    typeof plan === "number" ? plan : plan[index],
  );
  const actual = budget.map((value, index) => 10 * Math.round((value * ratios[index]) / 10));
  const sum = (values: readonly number[], from: number) =>
    values.slice(from).reduce((total, value) => total + value, 0);
  return {
    id,
    name,
    budget: { month: budget[8], quarter: sum(budget, 6), ytd: sum(budget, 0) },
    actual: { month: actual[8], quarter: sum(actual, 6), ytd: sum(actual, 0) },
  };
}
export const budgetDepartments: readonly BudgetDepartment[] = [
  {
    id: "engineering",
    name: "Engineering",
    owner: { name: "Nathan Cole", avatar: avatar("nathan-cole") },
    lines: [
      line(
        "eng-salaries",
        "Salaries and benefits",
        [98e4, 98e4, 995e3, 1005e3, 1005e3, 102e4, 102e4, 1035e3, 1035e3],
        [0.98, 0.97, 0.99, 0.98, 0.96, 0.97, 0.96, 0.95, 0.96],
      ),
      line(
        "eng-cloud",
        "Cloud infrastructure",
        182e3,
        [1.01, 1.03, 1.04, 1.06, 1.08, 1.11, 1.13, 1.16, 1.19],
      ),
      line(
        "eng-contractors",
        "Contractors",
        96e3,
        [0.92, 1.08, 1.12, 0.88, 0.94, 1.02, 1.06, 1.1, 0.97],
      ),
      line(
        "eng-tools",
        "Software and tools",
        48e3,
        [1, 1, 1.02, 1.02, 1.03, 1.03, 1.05, 1.05, 1.06],
      ),
      line(
        "eng-travel",
        "Travel",
        12e3,
        [0.62, 0.8, 0.74, 1.1, 0.7, 0.66, 0.58, 0.9, 1.24],
      ),
    ],
  },
  {
    id: "sales",
    name: "Sales",
    owner: { name: "Tyler Hayes", avatar: avatar("tyler-hayes") },
    lines: [
      line(
        "sales-comp",
        "Salaries and commissions",
        612e3,
        [0.94, 0.97, 1.04, 0.96, 1, 1.07, 0.98, 1.02, 1.09],
      ),
      line(
        "sales-events",
        "Travel and client events",
        64e3,
        [0.78, 0.9, 1.12, 1.05, 1.14, 0.96, 0.84, 0.88, 1.18],
      ),
      line(
        "sales-tools",
        "Sales tools",
        38e3,
        [1, 1, 1, 1.01, 1.01, 1.01, 1.01, 1.01, 1.01],
      ),
      line(
        "sales-referrals",
        "Partner referrals",
        42e3,
        [0.6, 0.72, 0.81, 0.9, 0.77, 0.95, 0.88, 1.14, 1.26],
      ),
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    owner: { name: "Ava Mitchell", avatar: avatar("ava-mitchell") },
    lines: [
      line(
        "mkt-paid",
        "Paid acquisition",
        24e4,
        [0.86, 0.9, 0.95, 0.92, 0.97, 1.01, 0.88, 0.84, 0.9],
      ),
      line(
        "mkt-salaries",
        "Salaries and benefits",
        186e3,
        [0.99, 0.99, 1, 1, 0.98, 0.98, 0.97, 0.97, 0.97],
      ),
      line(
        "mkt-events",
        "Events and sponsorships",
        [6e4, 6e4, 9e4, 6e4, 6e4, 11e4, 6e4, 6e4, 14e4],
        [0.7, 0.82, 1.06, 0.74, 0.9, 1.02, 0.8, 0.96, 0.93],
      ),
      line(
        "mkt-content",
        "Content and design",
        58e3,
        [0.9, 0.94, 0.88, 1.02, 0.97, 0.91, 0.95, 0.92, 0.89],
      ),
      line(
        "mkt-tools",
        "Marketing tools",
        22e3,
        [1, 1, 1, 1, 1.04, 1.04, 1.04, 1.04, 1.04],
      ),
    ],
  },
  {
    id: "customer-success",
    name: "Customer success",
    owner: { name: "Hannah Walsh", avatar: avatar("hannah-walsh") },
    lines: [
      line(
        "cs-salaries",
        "Salaries and benefits",
        292e3,
        [0.99, 1, 1, 1.01, 1.02, 1.02, 1.03, 1.03, 1.04],
      ),
      line(
        "cs-onboarding",
        "Onboarding services",
        44e3,
        [1.1, 1.14, 1.08, 1.2, 1.16, 1.22, 1.18, 1.24, 1.29],
      ),
      line(
        "cs-tools",
        "Support tooling",
        26e3,
        [1, 1, 1, 1, 1, 1.08, 1.08, 1.08, 1.08],
      ),
      line(
        "cs-training",
        "Training",
        9e3,
        [0.4, 0.66, 0.9, 0.52, 0.7, 1.1, 0.44, 0.6, 0.82],
      ),
    ],
  },
  {
    id: "product",
    name: "Product and design",
    owner: {
      name: "Jasmine Brooks",
      avatar: avatar("jasmine-brooks"),
    },
    lines: [
      line(
        "pd-salaries",
        "Salaries and benefits",
        342e3,
        [0.97, 0.98, 0.98, 0.99, 0.99, 1, 1, 1.01, 1.01],
      ),
      line(
        "pd-research",
        "Research panels",
        18e3,
        [0.7, 1.2, 0.85, 0.9, 1.3, 0.6, 0.75, 1.1, 0.88],
      ),
      line(
        "pd-tools",
        "Design tools",
        11e3,
        [1, 1, 1, 1, 1, 1, 0.96, 0.96, 0.96],
      ),
    ],
  },
  {
    id: "finance-legal",
    name: "Finance and legal",
    owner: {
      name: "Andre Williams",
      avatar: avatar("andre-williams"),
    },
    lines: [
      line(
        "fl-salaries",
        "Salaries and benefits",
        152e3,
        [1, 1, 1, 1, 1, 1, 1.01, 1.01, 1.01],
      ),
      line(
        "fl-legal",
        "Legal counsel",
        55e3,
        [0.8, 0.9, 1.6, 1.2, 0.85, 0.9, 1.4, 1.1, 1.36],
      ),
      line(
        "fl-audit",
        "Audit and tax",
        [3e4, 3e4, 9e4, 3e4, 3e4, 3e4, 3e4, 3e4, 3e4],
        [0.9, 0.95, 1.12, 0.8, 0.85, 0.9, 0.92, 0.86, 0.9],
      ),
      line(
        "fl-insurance",
        "Insurance",
        31e3,
        [1, 1, 1, 1, 1, 1, 1.03, 1.03, 1.03],
      ),
    ],
  },
  {
    id: "people",
    name: "People",
    owner: { name: "Sofia Ramirez", avatar: avatar("sofia-ramirez") },
    lines: [
      line(
        "ppl-recruiting",
        "Recruiting",
        68e3,
        [0.9, 0.82, 0.76, 0.88, 0.7, 0.64, 0.72, 0.6, 0.58],
      ),
      line(
        "ppl-offsites",
        "Offsites and culture",
        [18e3, 18e3, 18e3, 18e3, 7e4, 18e3, 18e3, 18e3, 7e4],
        [0.6, 0.7, 0.8, 0.5, 1.04, 0.7, 0.66, 0.8, 1.08],
      ),
      line(
        "ppl-benefits",
        "Benefits administration",
        21e3,
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
      ),
      line(
        "ppl-learning",
        "Learning budget",
        14e3,
        [0.5, 0.62, 0.8, 0.7, 0.74, 0.9, 0.66, 0.78, 0.84],
      ),
    ],
  },
];
/* ---------------------------------------------------------------- helpers */

/** Turns a plan/actual pair into the figures every row, total and sentence reads from. */
function figures(budget: number, actual: number, threshold: number): Figures {
  const variance = actual - budget;
  const share = budget > 0 ? variance / budget : 0;
  const tone: VarianceTone = Math.abs(share) < threshold ? "plan" : share > 0 ? "over" : "under";
  return { budget, actual, variance, share, ratio: budget > 0 ? actual / budget : 0, tone };
}

/** `$4.20M` / `$182.0k` / `$960`, with an explicit sign when asked for. */
function amount(value: number, currency: string, signed = false): string {
  const absolute = Math.abs(value);
  const sign = signed && Math.round(absolute) !== 0 ? (value > 0 ? "+" : "−") : "";
  const magnitude =
    absolute >= 999_500
      ? `${(absolute / 1e6).toFixed(2)}M`
      : absolute >= 1_000
        ? `${(absolute / 1e3).toFixed(1)}k`
        : `${Math.round(absolute)}`;
  return `${sign}${currency}${magnitude}`;
}

const TONE_LABEL: Record<VarianceTone, string> = { over: "over", under: "under", plan: "on plan" };

/** The sentence a screen reader hears in place of the bullet chart. */
function sentence(name: string, value: Figures, currency: string, phrase: string): string {
  const variance = amount(Math.abs(value.variance), currency);
  const verdict =
    value.tone === "plan"
      ? "on plan"
      : `${variance} ${value.tone} budget, ${Math.abs(Math.round(value.share * 1000) / 10).toFixed(1)}%${value.tone === "over" ? ", unfavorable" : ", favorable"}`;
  return `${name}: ${amount(value.actual, currency)} spent of ${amount(value.budget, currency)} ${phrase}, ${verdict}.`;
}

/** A motion value that springs to `value`, or jumps straight there when motion is reduced. */
function useAnimatedValue(value: number, reduce: boolean) {
  const animated = useMotionValue(value);

  useEffect(() => {
    if (reduce) {
      animated.jump(value);
      return;
    }
    const controls = animate(animated, value, motionTokens.spring.smooth);
    return () => controls.stop();
  }, [animated, reduce, value]);

  return animated;
}

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  reduce: boolean;
  className?: string;
}

/**
 * A number the browser writes from a motion value, so the spring never re-renders the tree.
 * The first paint is already the final string, which keeps SSR and hydration identical.
 */
function AnimatedNumber({ value, format, reduce, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [initial] = useState(() => format(value));
  const animated = useAnimatedValue(value, reduce);
  const formatter = useRef(format);

  useEffect(() => {
    formatter.current = format;
  });

  useEffect(() => {
    const update = (latest: number) => {
      if (ref.current) ref.current.textContent = formatter.current(latest);
    };
    update(animated.get());
    return animated.on("change", update);
  }, [animated]);

  return (
    <span ref={ref} className={className}>
      {initial}
    </span>
  );
}

interface BulletProps {
  ratio: number;
  scaleMax: number;
  ranges: readonly [number, number];
  reduce: boolean;
  size: "total" | "department" | "line";
}

/** One bullet chart: tolerance bands, the actual bar and the budget tick, all static except the bar. */
function Bullet({ ratio, scaleMax, ranges, reduce, size }: BulletProps) {
  const fill = useAnimatedValue(Math.min(ratio, scaleMax) / scaleMax, reduce);
  const pct = (value: number) => `${(Math.min(value, scaleMax) / scaleMax) * 100}%`;

  return (
    <span
      className={styles.bullet}
      data-size={size}
      style={{ "--target": pct(1) } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.track}>
        <span className={styles.band} style={{ left: 0, width: pct(ranges[0]) }} />
        <span
          className={styles.band}
          data-band="tolerance"
          style={{ left: pct(ranges[0]), width: `calc(${pct(ranges[1])} - ${pct(ranges[0])})` }}
        />
        <span className={styles.band} data-band="over" style={{ left: pct(ranges[1]), right: 0 }} />
        <Bar fill={fill} />
        <span className={styles.overClip}>
          <Bar fill={fill} over />
        </span>
      </span>
      <span className={styles.tick} />
    </span>
  );
}

function Bar({ fill, over }: { fill: MotionValue<number>; over?: boolean }) {
  return (
    <motion.span
      className={styles.bar}
      data-over={over || undefined}
      style={{ scaleX: fill }}
    />
  );
}

interface VarianceProps {
  value: Figures;
  currency: string;
  threshold: number;
  reduce: boolean;
  large?: boolean;
}

/** The signed amount plus its share of budget, both springing to their new value. */
function Variance({ value, currency, threshold, reduce, large }: VarianceProps) {
  return (
    <span className={styles.variance} data-tone={value.tone} data-large={large || undefined}>
      <AnimatedNumber
        value={value.variance}
        format={latest => amount(latest, currency, true)}
        reduce={reduce}
        className={styles.varianceAmount}
      />
      <AnimatedNumber
        value={value.share}
        format={latest => {
          const rounded = Math.round(latest * 1000) / 10;
          const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
          const tone = Math.abs(latest) < threshold ? "plan" : latest > 0 ? "over" : "under";
          return `${sign}${Math.abs(rounded).toFixed(1)}% ${TONE_LABEL[tone]}`;
        }}
        reduce={reduce}
        className={styles.varianceShare}
      />
    </span>
  );
}

const DEFAULT_RANGES: readonly [number, number] = [0.9, 1.1];

/**
 * Budget against actual spend for one reporting window, department by department.
 *
 * Each department is a disclosure row: its heading button carries the whole verdict as its
 * accessible name, and opening it grows the line items out underneath. Bars spring on a window
 * change while their tolerance bands and the budget tick stay put, so only the comparison moves.
 */
export function BudgetVariance({
  departments = budgetDepartments,
  periods = budgetPeriods,
  defaultPeriod,
  defaultExpanded = "engineering",
  ranges = DEFAULT_RANGES,
  onPlanThreshold = 0.005,
  currency = "$",
  title = "Budget vs actual",
  description,
  onPeriodChange,
  onDepartmentToggle,
  className,
  flat = false,
}: BudgetVarianceProps) {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const [period, setPeriod] = useState(() =>
    periods.some(entry => entry.id === defaultPeriod) ? (defaultPeriod as string) : (periods[0]?.id ?? ""),
  );
  const [open, setOpen] = useState<string | null>(() =>
    defaultExpanded && departments.some(entry => entry.id === defaultExpanded) ? defaultExpanded : null,
  );
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const current = periods.find(entry => entry.id === period) ?? periods[0];
  const phrase = current?.phrase ?? "";

  /* The axis grows to the worst month of any line, so a single blow-out never clips. */
  const scaleMax = useMemo(() => {
    let max = Math.max(1.2, ranges[1] + 0.1);
    for (const department of departments) {
      for (const lineItem of department.lines) {
        for (const entry of periods) {
          const budget = lineItem.budget[entry.id] ?? 0;
          if (budget > 0) max = Math.max(max, (lineItem.actual[entry.id] ?? 0) / budget);
        }
      }
    }
    return Math.ceil(10 * max - 1e-9) / 10;
  }, [departments, periods, ranges]);

  const rows = useMemo(
    () =>
      departments.map(department => {
        const lines = department.lines.map(lineItem => ({
          item: lineItem,
          figures: figures(
            lineItem.budget[period] ?? 0,
            lineItem.actual[period] ?? 0,
            onPlanThreshold,
          ),
        }));
        const budget = lines.reduce((total, entry) => total + entry.figures.budget, 0);
        const actual = lines.reduce((total, entry) => total + entry.figures.actual, 0);
        return { department, lines, figures: figures(budget, actual, onPlanThreshold) };
      }),
    [departments, onPlanThreshold, period],
  );

  const totals = useMemo(
    () =>
      figures(
        rows.reduce((total, row) => total + row.figures.budget, 0),
        rows.reduce((total, row) => total + row.figures.actual, 0),
        onPlanThreshold,
      ),
    [onPlanThreshold, rows],
  );

  const ticks = [0, 0.5, 1].filter(tick => tick <= scaleMax);
  const spring: Transition = reduce ? { duration: 0 } : motionTokens.spring.smooth;
  const leave: Transition = reduce
    ? { duration: 0 }
    : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] as [number, number, number, number] };

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={`${uid}-title`}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={`${uid}-title`} className={styles.title}>
              {title}
            </h2>
            <p className={styles.description}>{description ?? current?.description}</p>
          </div>
          {periods.length > 1 && (
            <SegmentedControl
              className={styles.switch}
              label="Reporting period"
              options={periods.map(entry => ({ value: entry.id, label: entry.label }))}
              value={period}
              onValueChange={next => {
                if (next === period) return;
                setPeriod(next);
                onPeriodChange?.(next);
                const nextPeriod = periods.find(entry => entry.id === next);
                let budget = 0;
                let actual = 0;
                for (const department of departments) {
                  for (const lineItem of department.lines) {
                    budget += lineItem.budget[next] ?? 0;
                    actual += lineItem.actual[next] ?? 0;
                  }
                }
                setAnnouncement(
                  nextPeriod
                    ? `Showing ${nextPeriod.description}. ${sentence(
                        "Total operating spend",
                        figures(budget, actual, onPlanThreshold),
                        currency,
                        nextPeriod.phrase,
                      )}`
                    : "",
                );
              }}
            />
          )}
        </header>

        {rows.length === 0 ? (
          <p className={styles.empty}>
            No departments have a budget for this period yet. Add a budget line to compare it with
            actual spend.
          </p>
        ) : (
          <div className={styles.table}>
            <div className={`${styles.grid} ${styles.head}`} aria-hidden="true">
              <span className={styles.colName}>Department</span>
              <span className={styles.axis} style={{ "--target": `${100 / scaleMax}%` } as CSSProperties}>
                {ticks.map(tick => (
                  <span
                    key={tick}
                    className={styles.axisTick}
                    data-edge={tick === 0 ? "start" : undefined}
                    style={{ left: `${(tick / scaleMax) * 100}%` }}
                  >
                    {`${Math.round(100 * tick)}%`}
                  </span>
                ))}
              </span>
              <span className={styles.colNum}>Actual</span>
              <span className={styles.colNum}>Budget</span>
              <span className={styles.colNum}>Variance</span>
              <span className={styles.spacer} />
            </div>

            <div className={styles.totalItem}>
              <div className={`${styles.grid} ${styles.total}`} aria-hidden="true">
                <span className={styles.name}>
                  <span className={styles.nameText}>
                    <span className={styles.primary}>Total operating spend</span>
                    <span className={styles.secondary} data-show="wide">
                      {rows.length} departments
                    </span>
                    <span className={styles.secondary} data-show="narrow">
                      <AnimatedNumber value={totals.actual} format={latest => amount(latest, currency)} reduce={reduce} />
                      {" of "}
                      <AnimatedNumber value={totals.budget} format={latest => amount(latest, currency)} reduce={reduce} />
                    </span>
                  </span>
                </span>
                <span className={styles.chart}>
                  <Bullet ratio={totals.ratio} scaleMax={scaleMax} ranges={ranges} reduce={reduce} size="total" />
                </span>
                <AnimatedNumber
                  value={totals.actual}
                  format={latest => amount(latest, currency)}
                  reduce={reduce}
                  className={`${styles.num} ${styles.lead}`}
                />
                <AnimatedNumber
                  value={totals.budget}
                  format={latest => amount(latest, currency)}
                  reduce={reduce}
                  className={`${styles.num} ${styles.muted}`}
                />
                <Variance value={totals} currency={currency} threshold={onPlanThreshold} reduce={reduce} large />
                <span className={styles.spacer} />
              </div>
              <p className={styles.srOnly}>{sentence("Total operating spend", totals, currency, phrase)}</p>
            </div>

            <ul ref={listRef} className={styles.list}>
              {rows.map(({ department, lines, figures: departmentFigures }, index) => {
                const isOpen = open === department.id;
                const panelId = `${uid}-${department.id}-lines`;
                return (
                  <li key={department.id} className={styles.group} data-open={isOpen ? "" : undefined}>
                    <h3 className={styles.rowHeading}>
                      <button
                        type="button"
                        data-row
                        className={`${styles.grid} ${styles.row}`}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={sentence(department.name, departmentFigures, currency, phrase)}
                        onClick={() => {
                          const next = open === department.id ? null : department.id;
                          if (open && open !== department.id) onDepartmentToggle?.(open, false);
                          setOpen(next);
                          onDepartmentToggle?.(department.id, next === department.id);
                        }}
                        onKeyDown={event => {
                          const buttons = Array.from(
                            listRef.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [],
                          );
                          const last = buttons.length - 1;
                          const target =
                            event.key === "ArrowDown"
                              ? Math.min(last, index + 1)
                              : event.key === "ArrowUp"
                                ? Math.max(0, index - 1)
                                : event.key === "Home"
                                  ? 0
                                  : event.key === "End"
                                    ? last
                                    : -1;
                          if (target < 0) return;
                          event.preventDefault();
                          buttons[target]?.focus();
                        }}
                      >
                        <span className={styles.name}>
                          <Avatar
                            name={department.owner.name}
                            src={department.owner.avatar}
                            size="sm"
                            className={styles.avatar}
                            aria-hidden="true"
                          />
                          <span className={styles.nameText}>
                            <span className={styles.primary}>{department.name}</span>
                            <span className={styles.secondary} data-show="wide">
                              {department.owner.name}
                            </span>
                            <span className={styles.secondary} data-show="narrow">
                              <AnimatedNumber
                                value={departmentFigures.actual}
                                format={latest => amount(latest, currency)}
                                reduce={reduce}
                              />
                              {" of "}
                              <AnimatedNumber
                                value={departmentFigures.budget}
                                format={latest => amount(latest, currency)}
                                reduce={reduce}
                              />
                            </span>
                          </span>
                        </span>
                        <span className={styles.chart}>
                          <Bullet
                            ratio={departmentFigures.ratio}
                            scaleMax={scaleMax}
                            ranges={ranges}
                            reduce={reduce}
                            size="department"
                          />
                        </span>
                        <AnimatedNumber
                          value={departmentFigures.actual}
                          format={latest => amount(latest, currency)}
                          reduce={reduce}
                          className={styles.num}
                        />
                        <AnimatedNumber
                          value={departmentFigures.budget}
                          format={latest => amount(latest, currency)}
                          reduce={reduce}
                          className={`${styles.num} ${styles.muted}`}
                        />
                        <Variance
                          value={departmentFigures}
                          currency={currency}
                          threshold={onPlanThreshold}
                          reduce={reduce}
                        />
                        <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-label={`${department.name} budget lines`}
                          className={styles.panel}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1, transition: spring }}
                          exit={{ height: 0, opacity: 0, transition: leave }}
                        >
                          <ul className={styles.lines}>
                            {lines.map(({ item, figures: lineFigures }) => (
                              <li key={item.id} className={styles.lineItem}>
                                <div className={`${styles.grid} ${styles.line}`} aria-hidden="true">
                                  <span className={styles.name}>
                                    <span className={styles.nameText}>
                                      <span className={styles.primary}>{item.name}</span>
                                      <span className={styles.secondary} data-show="narrow">
                                        <AnimatedNumber
                                          value={lineFigures.actual}
                                          format={latest => amount(latest, currency)}
                                          reduce={reduce}
                                        />
                                        {" of "}
                                        <AnimatedNumber
                                          value={lineFigures.budget}
                                          format={latest => amount(latest, currency)}
                                          reduce={reduce}
                                        />
                                      </span>
                                    </span>
                                  </span>
                                  <span className={styles.chart}>
                                    <Bullet
                                      ratio={lineFigures.ratio}
                                      scaleMax={scaleMax}
                                      ranges={ranges}
                                      reduce={reduce}
                                      size="line"
                                    />
                                  </span>
                                  <AnimatedNumber
                                    value={lineFigures.actual}
                                    format={latest => amount(latest, currency)}
                                    reduce={reduce}
                                    className={styles.num}
                                  />
                                  <AnimatedNumber
                                    value={lineFigures.budget}
                                    format={latest => amount(latest, currency)}
                                    reduce={reduce}
                                    className={`${styles.num} ${styles.muted}`}
                                  />
                                  <Variance
                                    value={lineFigures}
                                    currency={currency}
                                    threshold={onPlanThreshold}
                                    reduce={reduce}
                                  />
                                  <span className={styles.spacer} />
                                </div>
                                <span className={styles.srOnly}>{sentence(item.name, lineFigures, currency, phrase)}</span>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            <div className={styles.legend} aria-hidden="true">
              <span className={styles.legendItem}>
                <i className={styles.keyBar} />
                Actual
              </span>
              <span className={styles.legendItem}>
                <i className={styles.keyTick} />
                Budget
              </span>
              <span className={styles.legendItem}>
                <i className={styles.keyOver} />
                Over budget
              </span>
              <span className={styles.legendItem}>
                <i className={styles.keyBand} />
                {Math.round(100 * ranges[0])} to {Math.round(100 * ranges[1])}% of budget
              </span>
            </div>
          </div>
        )}

        <p className={styles.srOnly} role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </section>
  );
}

export default BudgetVariance;
