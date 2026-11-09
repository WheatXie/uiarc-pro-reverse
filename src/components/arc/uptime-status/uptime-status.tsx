"use client";

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Transition,
} from "motion/react";
import { Activity, ChevronDown, TriangleAlert } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import { Badge } from "../badge/badge";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./uptime-status.module.css";

/* ------------------------------------------------------------------ data */

/** How a single day (or incident) is rated. */
type Severity = "operational" | "degraded" | "outage";

/** One line in an incident's timeline. */
interface IncidentUpdate {
  id: string;
  status: string;
  time: string;
  body: string;
}

/** A postmortem entry, dated by its offset in the 90 day window. */
interface Incident {
  id: string;
  title: string;
  services: string[];
  severity: Severity;
  day: number;
  start: string;
  minutes: number;
  lead: { name: string; src: string };
  updates: IncidentUpdate[];
  ongoing?: boolean;
}

/** A monitored service, also the source of its latency series. */
interface Service {
  id: string;
  name: string;
  detail: string;
  base: number;
  spread: number;
  target: number;
}

interface DayStatus {
  status: Severity;
  minutes: number;
  incidents: Incident[];
}

interface LatencySeries {
  p50: number[];
  p95: number[];
}

const STATUS_LABEL: Record<Severity, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Major outage",
};

const STATUS_SCALE: Record<Severity, number> = {
  operational: 1,
  degraded: 0.64,
  outage: 0.34,
};

const SERVICES: Service[] = [
  { id: "api", name: "API", detail: "REST and GraphQL", base: 86, spread: 2.3, target: 400 },
  { id: "dashboard", name: "Dashboard", detail: "app.halden.example", base: 214, spread: 2, target: 1000 },
  { id: "webhooks", name: "Webhooks", detail: "Event delivery", base: 128, spread: 2.5, target: 750 },
  { id: "auth", name: "Auth", detail: "Sign-in, SSO and tokens", base: 58, spread: 2.1, target: 300 },
];

const EMMA = { name: "Emma Collins", src: "/media/people/emma-collins.svg" };

const INCIDENTS: Incident[] = [
  {
    id: "api-errors",
    title: "Elevated error rates on the API",
    services: ["api"],
    severity: "outage",
    day: 84,
    start: "09:12",
    minutes: 23,
    lead: { name: "Ava Mitchell", src: "/media/people/ava-mitchell.svg" },
    updates: [
      {
        id: "r",
        status: "Resolved",
        time: "09:58",
        body: "Error rates have been normal for 20 minutes. Pool limits are raised on every cluster and saturation now pages on call.",
      },
      {
        id: "m",
        status: "Monitoring",
        time: "09:35",
        body: "A fix is deployed and errors are falling. We are watching the us-east-1 cluster.",
      },
      {
        id: "d",
        status: "Identified",
        time: "09:21",
        body: "A connection pool limit on the primary database rejected new requests during a traffic peak.",
      },
      {
        id: "i",
        status: "Investigating",
        time: "09:12",
        body: "Some API requests in us-east-1 return 503 errors.",
      },
    ],
  },
  {
    id: "dashboard-slow",
    title: "Dashboard charts loading slowly",
    services: ["dashboard"],
    severity: "degraded",
    day: 70,
    start: "14:05",
    minutes: 72,
    lead: { name: "Marcus Johnson", src: "/media/people/marcus-johnson.svg" },
    updates: [
      {
        id: "r",
        status: "Resolved",
        time: "15:17",
        body: "Chart queries are back to their usual speed after the reporting index finished rebuilding.",
      },
      {
        id: "d",
        status: "Identified",
        time: "14:40",
        body: "A reporting index was rebuilt during business hours, which slowed chart queries.",
      },
      {
        id: "i",
        status: "Investigating",
        time: "14:05",
        body: "Analytics charts take up to 20 seconds to load.",
      },
    ],
  },
  {
    id: "webhook-retries",
    title: "Webhook retries paused",
    services: ["webhooks"],
    severity: "degraded",
    day: 57,
    start: "03:40",
    minutes: 38,
    lead: { name: "Sofia Ramirez", src: "/media/people/sofia-ramirez.svg" },
    updates: [
      {
        id: "r",
        status: "Resolved",
        time: "04:18",
        body: "Every queued retry has been delivered. No events were lost.",
      },
      {
        id: "d",
        status: "Identified",
        time: "03:52",
        body: "A stuck worker stopped the retry queue. Retries resume after a restart.",
      },
      {
        id: "i",
        status: "Investigating",
        time: "03:40",
        body: "Failed deliveries are not being retried.",
      },
    ],
  },
  {
    id: "saml-failures",
    title: "SAML sign-in failures",
    services: ["auth"],
    severity: "outage",
    day: 42,
    start: "11:26",
    minutes: 17,
    lead: { name: "Jasmine Brooks", src: "/media/people/jasmine-brooks.svg" },
    updates: [
      {
        id: "r",
        status: "Resolved",
        time: "11:43",
        body: "Sign-in works again for every identity provider after we rolled back a certificate change.",
      },
      {
        id: "i",
        status: "Investigating",
        time: "11:26",
        body: "People who sign in with SAML see an invalid signature error.",
      },
    ],
  },
  {
    id: "api-latency",
    title: "Increased API and webhook latency",
    services: ["api", "webhooks"],
    severity: "degraded",
    day: 14,
    start: "18:02",
    minutes: 46,
    lead: EMMA,
    updates: [
      {
        id: "r",
        status: "Resolved",
        time: "18:48",
        body: "Latency is back within target. The tenant now has its own cache partition.",
      },
      {
        id: "d",
        status: "Identified",
        time: "18:15",
        body: "One tenant saturated the shared cache in eu-west-1.",
      },
      {
        id: "i",
        status: "Investigating",
        time: "18:02",
        body: "API responses and webhook deliveries are slower than usual.",
      },
    ],
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WINDOW_START = Date.UTC(2026, 5, 25);

const dayDate = (day: number) => new Date(WINDOW_START + 86_400_000 * day);
const shortDate = (day: number) => {
  const date = dayDate(day);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
};
const fullDate = (day: number) => `${WEEKDAYS[dayDate(day).getUTCDay()]}, ${shortDate(day)}`;

const SEVERITY_LEVEL: Record<Severity, number> = { operational: 0, degraded: 1, outage: 2 };

const uptimeOf = (day: DayStatus) => Math.round((1 - day.minutes / 1440) * 10_000) / 100;

const clockOf = (slot: number) => {
  const minutes = (900 + 30 * slot) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const stampOf = (slot: number) => `${slot < 18 ? "Sep 21" : "Sep 22"}, ${clockOf(slot)} UTC`;

const AXIS_SLOTS = [6, 18, 30, 42];

/** Deterministic latency series per service: 48 half-hours of p50 and p95. */
const SERIES: Record<string, LatencySeries> = Object.fromEntries(
  SERVICES.map((service, index) => {
    let seed = (0x135283a + 7919 * index) >>> 0;
    const random = () => {
      let value = (seed = (seed + 0x6d2b79f5) >>> 0);
      value = Math.imul(value ^ (value >>> 15), 1 | value);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
    };
    const p50: number[] = [];
    const p95: number[] = [];
    let drift = 0;
    for (let slot = 0; slot < 48; slot++) {
      const wave = Math.sin((((15 + slot / 2) % 24) - 9) / 24 * Math.PI * 2);
      drift = 0.6 * drift + (random() - 0.5) * 0.1;
      const median = service.base * (1 + 0.14 * wave + drift);
      const tail =
        median *
        (service.spread + 0.3 * Math.max(0, wave) + (random() - 0.5) * 0.4 + 0.6 * Number(random() > 0.92));
      p50.push(Math.round(median));
      p95.push(Math.round(tail));
    }
    return [service.id, { p50, p95 }];
  }),
);

/** Webhooks carries a two-slot spike used whenever the demo simulates an incident. */
const SPIKED: LatencySeries = (() => {
  const p50 = [...SERIES.webhooks.p50];
  const p95 = [...SERIES.webhooks.p95];
  for (const [slot, median, tail] of [
    [46, 2.7, 4],
    [47, 3.4, 5.1],
  ]) {
    p50[slot] = Math.round(p50[slot] * median);
    p95[slot] = Math.round(p95[slot] * tail);
  }
  return { p50, p95 };
})();

const PLOT_HEIGHT = 174;
const yFor = (value: number, top: number) => 12 + (1 - value / Math.max(1, top)) * PLOT_HEIGHT;
const lerpSeries = (from: number[], to: number[], progress: number) =>
  to.map((value, index) => from[index] + (value - from[index]) * progress);
const round2 = (value: number) => Math.round(100 * value) / 100;

/* --------------------------------------------------------------- geometry */

/** Fritsch–Carlson tangents, so the curve never overshoots a data point. */
function tangentsFor(values: number[], spacing: number) {
  const count = values.length;
  const slopes = values.slice(1).map((value, index) => (value - values[index]) / spacing);
  const tangents = Array<number>(count).fill(0);
  for (let index = 1; index < count - 1; index++) {
    const before = slopes[index - 1];
    const after = slopes[index];
    tangents[index] =
      (Math.sign(before) + Math.sign(after)) * Math.min(Math.abs(before), Math.abs(after), 0.25 * Math.abs(before + after));
  }
  tangents[0] = (3 * slopes[0] - tangents[1]) / 2;
  tangents[count - 1] = (3 * slopes[count - 2] - tangents[count - 2]) / 2;
  return tangents;
}

function curvePath(values: number[], tangents: number[], spacing: number, reverse: boolean, command: string) {
  const count = values.length;
  const handle = spacing / 3;
  const direction = reverse ? -1 : 1;
  const xAt = (index: number) => 44 + index * spacing;
  const at = (index: number) => (reverse ? count - 1 - index : index);
  let path = `${command}${round2(xAt(at(0)))} ${round2(values[at(0)])}`;
  for (let step = 1; step < count; step++) {
    const previous = at(step - 1);
    const current = at(step);
    path += `C${round2(xAt(previous) + direction * handle)} ${round2(values[previous] + direction * tangents[previous] * handle)} ${round2(xAt(current) - direction * handle)} ${round2(values[current] - direction * tangents[current] * handle)} ${round2(xAt(current))} ${round2(values[current])}`;
  }
  return path;
}

interface ChartGeometry {
  p50: string;
  p95: string;
  band: string;
  hoverX: number;
  dot50: number;
  dot95: number;
  label50: number;
  label95: number;
  targetY: number;
}

function buildChart(values: number[], top: number, width: number, hover: number, target: number): ChartGeometry {
  const spacing = Math.max(40, width - 44 - 36) / 47;
  const head = values.slice(0, 48).map((value) => yFor(value, top));
  const tail = values.slice(48).map((value) => yFor(value, top));
  const headTangents = tangentsFor(head, spacing);
  const tailTangents = tangentsFor(tail, spacing);
  const p95 = curvePath(tail, tailTangents, spacing, false, "M");
  const slot = Math.max(0, Math.min(47, Math.round(hover)));
  let label95 = tail[47];
  let label50 = head[47];
  if (label50 - label95 < 14) {
    const middle = (label50 + label95) / 2;
    label95 = middle - 7;
    label50 = middle + 7;
  }
  const floor = 12 + PLOT_HEIGHT;
  if (label50 > floor - 2) {
    label95 -= label50 - floor + 2;
    label50 = floor - 2;
  }
  return {
    p50: curvePath(head, headTangents, spacing, false, "M"),
    p95,
    band: `${p95}${curvePath(head, headTangents, spacing, true, "L")}Z`,
    hoverX: Math.round(44 + slot * spacing) + 0.5,
    dot50: head[slot],
    dot95: tail[slot],
    label50,
    label95,
    targetY: Math.round(yFor(target, top)) + 0.5,
  };
}

/* ------------------------------------------------------------------ utils */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const serviceName = (id: string) => SERVICES.find((service) => service.id === id)?.name ?? id;
const minutesLabel = (minutes: number) => `${minutes} minute${minutes === 1 ? "" : "s"}`;
const numberFormat = new Intl.NumberFormat("en-US");

const { spring, duration, ease } = motionTokens;
const easeEnter = [...ease.enter] as [number, number, number, number];
const easeStandard = [...ease.standard] as [number, number, number, number];
const TIP_SPRING: Transition = { visualDuration: 0.16, bounce: 0 };

/** Jump when the reader asked for less motion, otherwise animate. */
function settle(value: MotionValue<number>, target: number, transition: Transition, reduce: boolean) {
  if (reduce) {
    value.jump(target);
    return;
  }
  if (value.get() !== target || value.isAnimating()) animate(value, target, transition);
}

function useContainerWidth(initial: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const node = ref.current;
    if (!node || "u" < typeof ResizeObserver) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/* -------------------------------------------------------------- fragments */

function SwapText({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={styles.swapText}
      aria-hidden={!present || undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.3em" }}
      animate={{ opacity: 1, y: "0em" }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, y: "-0.25em", transition: { duration: duration.fast, ease: easeStandard } }
      }
      transition={reduce ? { duration: 0 } : { duration: duration.standard, ease: easeEnter }}
    >
      {children}
    </motion.span>
  );
}

/** One line of copy that lifts in and out when its text changes. */
function Swap({ text, className }: { text: string; className?: string }) {
  const reduce = !!(useReducedMotion());
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <SwapText key={text} reduce={reduce}>
          {text}
        </SwapText>
      </AnimatePresence>
    </span>
  );
}

/** The 8×14 bar from the legend, filled to the height of the status. */
function Mark({ status }: { status: Severity }) {
  const height = Math.round(14 * STATUS_SCALE[status]);
  return (
    <svg
      className={styles.mark}
      data-status={status}
      width="8"
      height="14"
      viewBox="0 0 8 14"
      aria-hidden="true"
    >
      <rect x="0" y={14 - height} width="8" height={height} rx="1.5" />
    </svg>
  );
}

const CHECK_STROKES = [
  [6.1, 10.3, 8.8, 13],
  [8.8, 13, 14, 7.4],
];
const ALERT_STROKES = [
  [10, 14.1, 10, 14.1],
  [10, 5.8, 10, 10.9],
];

/** The status disc; its two strokes morph between a check and an exclamation. */
function Glyph({ degraded }: { degraded: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg className={styles.glyph} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" />
      {(degraded ? ALERT_STROKES : CHECK_STROKES).map(([x1, y1, x2, y2], index) => (
        <motion.line
          key={index}
          initial={false}
          animate={{ x1, y1, x2, y2 }}
          transition={reduce ? { duration: 0 } : { ...spring.morph, delay: 0.04 * index }}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ panel */

interface UptimePanelProps {
  incidents: Incident[];
  selected: string;
  onSelect: (id: string) => void;
  flat: boolean;
}

interface HoverInfo {
  service: string;
  day: number;
  width: number;
}

function UptimePanel({ incidents, selected, onSelect, flat }: UptimePanelProps) {
  const reduce = !!(useReducedMotion());
  const headId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const [ hover, setHover ] = useState<HoverInfo | null>(null);
  const [ announce, setAnnounce ] = useState("");
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const springX = useSpring(tipX, TIP_SPRING);
  const springY = useSpring(tipY, TIP_SPRING);

  const dataset = useMemo(
    () =>
      SERVICES.map((service) => {
        const days: DayStatus[] = Array.from({ length: 90 }, () => ({
          status: "operational",
          minutes: 0,
          incidents: [],
        }));
        for (const incident of incidents) {
          if (!incident.services.includes(service.id)) continue;
          const day = days[incident.day];
          day.minutes += incident.minutes;
          day.incidents.push(incident);
          if (SEVERITY_LEVEL[incident.severity] > SEVERITY_LEVEL[day.status]) day.status = incident.severity;
        }
        return {
          service,
          days,
          uptime: Math.round((1 - days.reduce((total, day) => total + day.minutes, 0) / 129_600) * 10_000) / 100,
          ongoing: incidents.some((incident) => incident.ongoing && incident.services.includes(service.id)),
        };
      }),
    [ incidents ],
  );

  const hovered = hover ? dataset.find((entry) => entry.service.id === hover.service) : undefined;
  const hoveredDay = hovered && hover ? hovered.days[hover.day] : undefined;

  function inspect(entry: (typeof dataset)[number], day: number, target: HTMLElement, x: number, verbose: boolean) {
    const panel = panelRef.current;
    if (!panel) return;
    const panelBox = panel.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const width = Math.min(256, panelBox.width - 16);
    const left = Math.round(clamp(targetBox.left - panelBox.left + x - width / 2, 8, panelBox.width - width - 8));
    const top = Math.round(targetBox.top - panelBox.top - 8);
    tipX.set(left);
    tipY.set(top);
    if (!hover) {
      springX.jump(left);
      springY.jump(top);
    }
    setHover({ service: entry.service.id, day, width });
    if (verbose) {
      const dayStatus = entry.days[day];
      const listed = dayStatus.incidents.map((incident) => `${incident.title}, ${minutesLabel(incident.minutes)}`).join(". ");
      setAnnounce(
        `${fullDate(day)}: ${STATUS_LABEL[dayStatus.status]}, ${uptimeOf(dayStatus).toFixed(2)}% uptime. ${listed || "No incidents recorded."}`,
      );
    }
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      aria-labelledby={headId}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <div className={styles.panelHead}>
        <div>
          <h3 id={headId}>Uptime</h3>
          <p>Last 90 days · select a service to chart it</p>
        </div>
        <ul className={styles.legend} aria-label="Legend">
          {(["operational", "degraded", "outage"] as const).map((status) => (
            <li key={status}>
              <Mark status={status} />
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.rows}>
        {dataset.map((entry) => (
          <ServiceRow
            key={entry.service.id}
            {...entry}
            selected={entry.service.id === selected}
            hover={hover?.service === entry.service.id ? hover.day : null}
            reduce={reduce}
            onSelect={() => onSelect(entry.service.id)}
            onInspect={(day, target, x, verbose) => inspect(entry, day, target, x, verbose)}
            onLeave={() => setHover(null)}
          />
        ))}
      </div>

      <div className={styles.axis} aria-hidden="true">
        <span>{shortDate(0)}</span>
        <span>Today</span>
      </div>

      <AnimatePresence>
        {hover && hovered && hoveredDay ? (
          <motion.div
            key="tip"
            className={styles.tip}
            aria-hidden="true"
            style={{ x: reduce ? tipX : springX, y: reduce ? tipY : springY, width: hover.width }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: duration.instant, ease: easeStandard } }}
            transition={reduce ? { duration: 0 } : { duration: duration.fast, ease: easeEnter }}
          >
            <div className={styles.tipHead}>
              <span>
                {hovered.service.name} · {fullDate(hover.day)}
              </span>
              <span className={styles.num}>{uptimeOf(hoveredDay).toFixed(2)}%</span>
            </div>
            <div className={styles.tipStatus}>
              <Mark status={hoveredDay.status} />
              {STATUS_LABEL[hoveredDay.status]}
            </div>
            {hoveredDay.incidents.length ? (
              <ul className={styles.tipList}>
                {hoveredDay.incidents.map((incident) => (
                  <li key={incident.id}>
                    <span>{incident.title}</span>
                    <span className={styles.num}>{incident.minutes} min</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.tipEmpty}>No incidents recorded</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------- row */

interface ServiceRowProps {
  service: Service;
  days: DayStatus[];
  uptime: number;
  ongoing: boolean;
  selected: boolean;
  hover: number | null;
  reduce: boolean;
  onSelect: () => void;
  onInspect: (day: number, target: HTMLElement, x: number, verbose: boolean) => void;
  onLeave: () => void;
}

function ServiceRow({
  service,
  days,
  uptime,
  ongoing,
  selected,
  hover,
  reduce,
  onSelect,
  onInspect,
  onLeave,
}: ServiceRowProps) {
  const descriptionId = useId();
  const [ stripRef, stripWidth ] = useContainerWidth(640);

  const bars = useMemo(() => {
    const gap = stripWidth < 420 ? 1 : 2;
    const slot = (stripWidth + gap) / 90;
    return Array.from({ length: 90 }, (_, index) => {
      const x = Math.round(index * slot);
      return { x, w: Math.max(1, Math.round((index + 1) * slot - gap) - x) };
    });
  }, [ stripWidth ]);

  const radius = stripWidth / 90 > 4 ? 1.5 : 0.75;
  const incidentNotes = days.flatMap((day, index) =>
    day.incidents.length ? [ `${shortDate(index)} ${STATUS_LABEL[day.status].toLowerCase()}, ${minutesLabel(day.minutes)}` ] : [],
  );
  const description = `${uptime.toFixed(2)}% uptime. ${incidentNotes.length ? `Incidents: ${incidentNotes.join("; ")}.` : "No incidents."} Use the arrow keys to inspect each day.`;
  const hoveredDay = hover === null ? null : days[hover];

  function inspect(day: number, verbose: boolean) {
    const node = stripRef.current;
    if (!node) return;
    const scale = node.getBoundingClientRect().width / stripWidth;
    onInspect(day, node, (bars[day].x + bars[day].w / 2) * scale, verbose);
  }

  function dayAt(clientX: number, target: HTMLElement) {
    const box = target.getBoundingClientRect();
    return clamp(Math.floor(((clientX - box.left) / box.width) * 90), 0, 89);
  }

  return (
    <div className={styles.row} data-selected={selected || undefined}>
      {selected ? (
        <motion.span
          layoutId="service-highlight"
          className={styles.rowHighlight}
          transition={reduce ? { duration: 0 } : spring.morph}
          aria-hidden="true"
        />
      ) : null}
      <button type="button" className={styles.rowHead} aria-pressed={selected} onClick={onSelect}>
        <span className={styles.rowName}>
          {service.name}
          <span className={styles.rowDetail}>{service.detail}</span>
        </span>
        {ongoing ? (
          <Badge size="sm" tone="warning" icon={<TriangleAlert size={12} strokeWidth={2} />}>
            Degraded
          </Badge>
        ) : (
          <span className={styles.srOnly}>Operational</span>
        )}
        <span className={styles.rowUptime}>
          <span className={styles.num}>
            <AnimatedCounter value={uptime} decimals={2} suffix="%" />
          </span>
          <span className={styles.rowUptimeLabel}>uptime</span>
        </span>
      </button>

      <div
        ref={stripRef}
        className={styles.strip}
        tabIndex={0}
        role="group"
        aria-label={`${service.name}, daily status for the last 90 days`}
        aria-describedby={descriptionId}
        data-active={hoveredDay ? "" : undefined}
        onPointerMove={(event) => inspect(dayAt(event.clientX, event.currentTarget), false)}
        onPointerDown={(event) => inspect(dayAt(event.clientX, event.currentTarget), false)}
        onPointerLeave={onLeave}
        onBlur={onLeave}
        onClick={onSelect}
        onKeyDown={(event) => {
          const from = hover ?? 89;
          const moves: Record<string, number> = {
            ArrowLeft: from - 1,
            ArrowRight: from + 1,
            PageUp: from - 7,
            PageDown: from + 7,
            Home: 0,
            End: 89,
          };
          if (event.key === "Escape") return onLeave();
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
            return;
          }
          if (event.key in moves) {
            event.preventDefault();
            inspect(clamp(moves[event.key], 0, 89), true);
          }
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) inspect(hover ?? 89, true);
        }}
      >
        <svg width="100%" height={34} viewBox={`0 0 ${stripWidth} 34`} preserveAspectRatio="none" aria-hidden="true">
          <g transform="matrix(1 0 0 -1 0 34)">
            <Bars days={days} bars={bars} radius={radius} reduce={reduce} />
            {hoveredDay && hover !== null ? (
              <rect
                className={styles.bar}
                data-status={hoveredDay.status}
                data-lit=""
                x={bars[hover].x}
                y={0}
                width={bars[hover].w}
                height={Math.round(34 * STATUS_SCALE[hoveredDay.status])}
                rx={radius}
              />
            ) : null}
          </g>
        </svg>
        <span id={descriptionId} className={styles.srOnly}>
          {description}
        </span>
      </div>
    </div>
  );
}

interface BarsProps {
  days: DayStatus[];
  bars: { x: number; w: number }[];
  radius: number;
  reduce: boolean;
}

const Bars = memo(function Bars({ days, bars, radius, reduce }: BarsProps) {
  return (
    <g className={styles.bars}>
      {days.map((day, index) => (
        <motion.rect
          key={index}
          className={styles.bar}
          data-status={day.status}
          x={bars[index].x}
          y={0}
          width={bars[index].w}
          rx={radius}
          initial={false}
          animate={{ height: Math.round(34 * STATUS_SCALE[day.status]) }}
          transition={reduce ? { duration: 0 } : spring.morph}
        />
      ))}
    </g>
  );
});

/* ------------------------------------------------------------------ chart */

function GridLine({
  value,
  top,
  width,
  reduce,
}: {
  value: number;
  top: MotionValue<number>;
  width: number;
  reduce: boolean;
}) {
  const y = useTransform(top, (max): number => Math.round(12 + (1 - value / Math.max(1, max)) * PLOT_HEIGHT) + 0.5);
  const opacity = useTransform(y, (line): number =>
    clamp(1 - Math.max(6 - line, line - (12 + PLOT_HEIGHT) - 1, 0) / 12, 0, 1),
  );
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: duration.fast } }}
      transition={{ duration: reduce ? 0 : duration.standard, ease: easeEnter }}
    >
      <motion.g style={{ y, opacity }}>
        <line className={value === 0 ? styles.baseline : styles.gridline} x1={44} x2={width - 36} y1={0} y2={0} />
        <text className={styles.axisLabel} x={34} y={0} dy=".32em" textAnchor="end">
          {numberFormat.format(value)}
        </text>
      </motion.g>
    </motion.g>
  );
}

function ReadoutValue({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <dd>
      <span className={styles.num}>{rolling ? <AnimatedCounter value={value} /> : numberFormat.format(value)}</span>
      <span className={styles.unit}>ms</span>
    </dd>
  );
}

interface ResponsePanelProps {
  service: Service;
  phase: "operational" | "degraded" | "recovered";
}

function ResponsePanel({ service, phase }: ResponsePanelProps) {
  const reduce = !!(useReducedMotion());
  const headId = useId();
  const data = service.id === "webhooks" && phase !== "operational" ? SPIKED : SERIES[service.id];
  const all = useMemo(() => [...data.p50, ...data.p95], [ data ]);

  const scale = useMemo(() => {
    const max = 1.08 * Math.max(...data.p95, service.target);
    const step = [50, 100, 200, 250, 500, 1000, 2000].find((candidate) => max / candidate <= 5) ?? 2000;
    const top = Math.ceil(max / step) * step;
    return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) };
  }, [ data, service.target ]);

  const [ chartRef, width ] = useContainerWidth(560);
  const [ hover, setHover ] = useState<number | null>(null);
  const [ announce, setAnnounce ] = useState("");
  const fade = useMotionValue(1);
  const seriesFrom = useMotionValue(all);
  const seriesTo = useMotionValue(all);
  const topValue = useMotionValue(scale.top);
  const targetValue = useMotionValue(service.target);
  const widthValue = useMotionValue(560);
  const hoverValue = useMotionValue(-1);

  useEffect(() => {
    widthValue.set(width);
  }, [ width, widthValue ]);

  useEffect(() => {
    settle(topValue, scale.top, spring.smooth, reduce);
    settle(targetValue, service.target, spring.smooth, reduce);
    if (seriesTo.get() !== all) {
      if (!reduce) seriesFrom.set(lerpSeries(seriesFrom.get(), seriesTo.get(), fade.get()));
      seriesTo.set(all);
      if (reduce) {
        seriesFrom.set(all);
        fade.jump(1);
      } else {
        fade.jump(0);
        animate(fade, 1, spring.smooth);
      }
    }
  }, [ all, scale.top, service.target, reduce, seriesFrom, seriesTo, fade, topValue, targetValue ]);

  const geometry = useTransform(() =>
    buildChart(lerpSeries(seriesFrom.get(), seriesTo.get(), fade.get()), topValue.get(), widthValue.get(), hoverValue.get(), targetValue.get()),
  );
  const path50 = useTransform(geometry, (value) => value.p50);
  const path95 = useTransform(geometry, (value) => value.p95);
  const bandPath = useTransform(geometry, (value) => value.band);
  const crossX = useTransform(geometry, (value) => value.hoverX);
  const dot50 = useTransform(geometry, (value) => value.dot50);
  const dot95 = useTransform(geometry, (value) => value.dot95);
  const label50 = useTransform(geometry, (value) => value.label50);
  const label95 = useTransform(geometry, (value) => value.label95);
  const targetY = useTransform(geometry, (value) => value.targetY);

  function inspect(slot: number | null, verbose = false) {
    hoverValue.set(slot ?? -1);
    setHover(slot);
    if (verbose && slot !== null) {
      setAnnounce(`${stampOf(slot)}: p50 ${data.p50[slot]} ms, p95 ${data.p95[slot]} ms.`);
    }
  }

  function slotAt(clientX: number, target: HTMLElement) {
    const box = target.getBoundingClientRect();
    return clamp(
      Math.round((((clientX - box.left) * width) / Math.max(1, box.width) - 44) / (Math.max(40, width - 44 - 36) / 47)),
      0,
      47,
    );
  }

  const active = hover ?? 47;
  const peak = data.p95.indexOf(Math.max(...data.p95));
  const summary = `${service.name} response time over the last 24 hours. Latest p50 ${data.p50[47]} ms and p95 ${data.p95[47]} ms. Highest p95 ${numberFormat.format(data.p95[peak])} ms at ${clockOf(peak)} UTC. Target p95 ${numberFormat.format(service.target)} ms.`;

  return (
    <section className={styles.panel} aria-labelledby={headId}>
      <div className={styles.chartHead}>
        <div>
          <h3 id={headId}>Response time</h3>
          <Swap className={styles.chartSub} text={`${service.name} · last 24 hours`} />
        </div>
        <span className={styles.stamp}>{hover === null ? "Latest, 14:30 UTC" : stampOf(hover)}</span>
      </div>

      <dl className={styles.readout}>
        <div>
          <dt>
            <i className={styles.swatch} data-series="p95" />
            p95
          </dt>
          <ReadoutValue value={data.p95[active]} rolling={hover === null} />
        </div>
        <div>
          <dt>
            <i className={styles.swatch} data-series="p50" />
            p50
          </dt>
          <ReadoutValue value={data.p50[active]} rolling={hover === null} />
        </div>
        <div>
          <dt>
            <i className={styles.swatch} data-series="target" />
            p95 target
          </dt>
          <ReadoutValue value={service.target} rolling />
        </div>
      </dl>

      <div
        ref={chartRef}
        className={styles.chart}
        tabIndex={0}
        role="group"
        aria-label={`${service.name} response time chart. Use the arrow keys to inspect each half hour.`}
        onPointerMove={(event) => inspect(slotAt(event.clientX, event.currentTarget))}
        onPointerDown={(event) => inspect(slotAt(event.clientX, event.currentTarget))}
        onPointerLeave={() => inspect(null)}
        onBlur={() => inspect(null)}
        onKeyDown={(event) => {
          const from = hover ?? 47;
          const moves: Record<string, number> = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: 47 };
          if (event.key === "Escape") return inspect(null);
          if (event.key in moves) {
            event.preventDefault();
            inspect(clamp(moves[event.key], 0, 47), true);
          }
        }}
      >
        <svg width="100%" height={216} viewBox={`0 0 ${width} 216`} role="img" aria-label={summary}>
          <AnimatePresence initial={false}>
            {scale.ticks.map((tick) => (
              <GridLine key={tick} value={tick} top={topValue} width={width} reduce={reduce} />
            ))}
          </AnimatePresence>
          {AXIS_SLOTS.map((slot) => (
            <text
              key={slot}
              className={styles.axisLabel}
              x={44 + (slot * Math.max(40, width - 44 - 36)) / 47}
              y={208}
              textAnchor="middle"
            >
              {clockOf(slot)}
            </text>
          ))}
          <motion.path className={styles.band} d={bandPath} />
          <motion.line className={styles.target} x1={44} x2={width - 36} y1={targetY} y2={targetY} />
          <motion.path className={styles.p50} d={path50} />
          <motion.path className={styles.p95} d={path95} />
          <motion.text className={styles.endLabel} x={width - 36 + 8} y={label95} dy=".32em">
            p95
          </motion.text>
          <motion.text className={styles.endLabel} x={width - 36 + 8} y={label50} dy=".32em">
            p50
          </motion.text>
          {hover !== null ? (
            <g>
              <motion.line className={styles.cross} x1={crossX} x2={crossX} y1={12} y2={12 + PLOT_HEIGHT} />
              <motion.circle className={styles.dot} data-series="p50" cx={crossX} cy={dot50} r={3.5} />
              <motion.circle className={styles.dot} data-series="p95" cx={crossX} cy={dot95} r={4} />
            </g>
          ) : null}
        </svg>
      </div>

      <div className={styles.srOnly}>
        <table>
          <caption>{service.name} response time in milliseconds, last 24 hours</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">p50</th>
              <th scope="col">p95</th>
            </tr>
          </thead>
          <tbody>
            {data.p50.map((value, index) => (
              <tr key={index}>
                <th scope="row">{stampOf(index)}</th>
                <td>{value}</td>
                <td>{data.p95[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

/* -------------------------------------------------------------- incidents */

function IncidentList({
  incidents,
  open,
  onToggle,
}: {
  incidents: Incident[];
  open: string[];
  onToggle: (id: string) => void;
}) {
  const reduce = !!(useReducedMotion());
  const headId = useId();
  const collapse: Transition = reduce
    ? { duration: 0 }
    : { ...spring.smooth, opacity: { duration: duration.standard, ease: easeEnter } };

  return (
    <section className={styles.panel} aria-labelledby={headId}>
      <div className={styles.panelHead}>
        <div>
          <h3 id={headId}>Incidents</h3>
          <p className={styles.countLine}>
            <span className={styles.num}>
              <AnimatedCounter value={incidents.length} />
            </span>
            {" in the last 90 days"}
          </p>
        </div>
      </div>
      <ol className={styles.incidents}>
        <AnimatePresence initial={false}>
          {incidents.map((incident) => (
            <motion.li
              key={incident.id}
              className={styles.incidentItem}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapse}
            >
              <IncidentRow
                incident={incident}
                open={open.includes(incident.id)}
                onToggle={() => onToggle(incident.id)}
                collapse={collapse}
                reduce={reduce}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

function IncidentRow({
  incident,
  open,
  onToggle,
  collapse,
  reduce,
}: {
  incident: Incident;
  open: boolean;
  onToggle: () => void;
  collapse: Transition;
  reduce: boolean;
}) {
  const bodyId = useId();
  const when = incident.day === 89 ? "Today" : shortDate(incident.day);
  const lasted = incident.ongoing ? `${incident.minutes} min so far` : `${incident.minutes} min`;

  return (
    <div className={styles.incident}>
      <button
        type="button"
        className={styles.incidentHead}
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={onToggle}
      >
        <Mark status={incident.severity} />
        <span className={styles.incidentText}>
          <span className={styles.incidentTitle}>{incident.title}</span>
          <Swap
            className={styles.incidentMeta}
            text={`${STATUS_LABEL[incident.severity]} · ${when} at ${incident.start} UTC · ${lasted} · ${incident.services.map(serviceName).join(", ")}`}
          />
        </span>
        {incident.ongoing ? (
          <Badge size="sm" tone="warning" icon={<Activity size={12} strokeWidth={2} />}>
            Investigating
          </Badge>
        ) : (
          <span className={styles.resolved}>Resolved</span>
        )}
        <motion.span
          className={styles.chevron}
          initial={false}
          animate={{ rotate: 180 * Number(open) }}
          transition={reduce ? { duration: 0 } : spring.snappy}
        >
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={bodyId}
            className={styles.incidentBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={collapse}
          >
            <ol className={styles.updates} aria-label="Updates, newest first">
              <AnimatePresence initial={false}>
                {incident.updates.map((update, index) => (
                  <motion.li
                    key={update.id}
                    className={styles.updateItem}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={collapse}
                  >
                    <div
                      className={styles.update}
                      data-tone={
                        update.status === "Resolved"
                          ? "success"
                          : incident.ongoing && index === 0
                            ? "warning"
                            : undefined
                      }
                    >
                      <p className={styles.updateHead}>
                        <span>{update.status}</span>
                        <time className={styles.num}>{update.time} UTC</time>
                      </p>
                      <p className={styles.updateBody}>{update.body}</p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
            <p className={styles.lead}>
              <Avatar name={incident.lead.name} src={incident.lead.src} size="sm" />
              <span>
                {incident.lead.name} {incident.ongoing ? "is leading" : "led"} the response
              </span>
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

/** Props for {@link UptimeStatus}. */
export interface UptimeStatusProps {
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
}

type Phase = "operational" | "degraded" | "recovered";

const flatStyle: CSSProperties = { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" };

/** A status page: a service strip, a latency chart and a 90 day incident log. */
export function UptimeStatus({ flat = false }: UptimeStatusProps) {
  const titleId = useId();
  const [ phase, setPhase ] = useState<Phase>("operational");
  const [ selected, setSelected ] = useState("api");
  const [ open, setOpen ] = useState<string[]>([ "api-errors" ]);
  const [ announce, setAnnounce ] = useState("");

  const incidents = useMemo(() => {
    const simulated = (() => {
      if (phase === "operational") return null;
      const updates: IncidentUpdate[] = [
        {
          id: "i",
          status: "Investigating",
          time: "14:32",
          body: "Deliveries to endpoints in eu-west-1 arrive up to 6 minutes late. No events have been dropped.",
        },
      ];
      if (phase === "recovered") {
        updates.unshift({
          id: "r",
          status: "Resolved",
          time: "14:51",
          body: "The delivery queue was scaled out and the backlog has drained. Late events arrived in order.",
        });
      }
      return {
        id: "sim-webhooks",
        title: "Delayed webhook deliveries",
        services: [ "webhooks" ],
        severity: "degraded" as Severity,
        day: 89,
        start: "13:58",
        minutes: phase === "recovered" ? 53 : 34,
        lead: EMMA,
        updates,
        ongoing: phase === "degraded",
      };
    })();
    return simulated ? [ simulated, ...INCIDENTS ] : INCIDENTS;
  }, [ phase ]);

  const service = SERVICES.find((entry) => entry.id === selected) ?? SERVICES[0];
  const degraded = phase === "degraded";
  const detail =
    phase === "degraded"
      ? "Webhook deliveries slowed at 13:58 UTC"
      : phase === "recovered"
        ? "Webhooks recovered at 14:51 UTC"
        : "Updated Sep 22 at 14:32 UTC";

  function cycle() {
    if (phase === "operational") {
      setPhase("degraded");
      setSelected("webhooks");
      setOpen((current) => [ "sim-webhooks", ...current.filter((id) => id !== "sim-webhooks") ]);
      setAnnounce("Incident started. Webhooks is degraded.");
      return;
    }
    if (phase === "degraded") {
      setPhase("recovered");
      setAnnounce("Incident resolved. All systems operational.");
      return;
    }
    setPhase("operational");
    setOpen((current) => current.filter((id) => id !== "sim-webhooks"));
    setAnnounce("Reset. The incident was removed.");
  }

  return (
    <section
      className={styles.root}
      aria-labelledby={titleId}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? flatStyle : undefined}
    >
      <header className={styles.status} data-state={degraded ? "degraded" : "operational"}>
        <Glyph degraded={degraded} />
        <div className={styles.statusText}>
          <h2 id={titleId} className={styles.title}>
            <Swap text={degraded ? "Degraded performance" : "All systems operational"} />
          </h2>
          <p className={styles.statusDetail}>
            <span>Halden status</span>
            <span aria-hidden="true">·</span>
            <Swap text={detail} />
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={cycle}>
          {phase === "operational" ? "Simulate incident" : phase === "degraded" ? "Simulate resolution" : "Reset demo"}
        </Button>
      </header>

      <UptimePanel incidents={incidents} selected={selected} onSelect={setSelected} flat={flat} />

      <div className={styles.lower}>
        <ResponsePanel service={service} phase={phase} />
        <IncidentList
          incidents={incidents}
          open={open}
          onToggle={(id) => setOpen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [ ...current, id ]))}
        />
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}

export default UptimeStatus;
