"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, frame, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Accessibility, Maximize, Minus, Plus, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import { photo } from "../lib/media";
import styles from "./seat-map.module.css";

/* ── data model ─────────────────────────────────────────────────────────── */

export type SeatStatus = "available" | "held" | "sold";
export type SeatAccess = "wheelchair" | "companion";

export interface Seat {
  id: string;
  section: string;
  row: string;
  number: number;
  x: number;
  y: number;
  rotate: number;
  tier: string;
  status: SeatStatus;
  access?: SeatAccess;
  note?: string;
}

export interface SeatSection {
  id: string;
  name: string;
  labelX: number;
  labelY: number;
}

export interface SeatRowLabel {
  id: string;
  row: string;
  x: number;
  y: number;
}

export interface SeatVenue {
  width: number;
  height: number;
  stage: string;
  stageLabel: { x: number; y: number };
  sections: SeatSection[];
  seats: Seat[];
  rows: SeatRowLabel[];
}

export interface SeatTier {
  id: string;
  name: string;
  price: number;
  color: string;
}

export interface SeatEvent {
  name: string;
  venue: string;
  date: string;
  image?: { src: string; alt: string };
}

export interface SeatMapProps {
  event?: SeatEvent;
  venue?: SeatVenue;
  tiers?: SeatTier[];
  maxSeats?: number;
  serviceFee?: number;
  currency?: string;
  holdMinutes?: number;
  defaultSelected?: string[];
  title?: string;
  onSelectionChange?: (seats: Seat[]) => void;
  onHold?: (seats: Seat[]) => Promise<unknown> | unknown;
  className?: string;
}

/* ── default hall ───────────────────────────────────────────────────────── */

export const seatTiers: SeatTier[] = [
  { id: "premium", name: "Premium", price: 148, color: "var(--series-1)" },
  { id: "stalls", name: "Stalls", price: 112, color: "var(--series-4)" },
  { id: "circle", name: "Circle", price: 86, color: "var(--series-2)" },
  { id: "side", name: "Side circle", price: 64, color: "var(--series-3)" },
];

export const seatEvent: SeatEvent = {
  name: "Lena Ostrova plays the Nocturnes",
  venue: "Harbour Hall, main auditorium",
  date: "Sat 14 Nov, 7:30 pm",
  image: { src: photo("concert-hall").src, alt: "" },
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const round2 = (value: number) => Math.round(100 * value) / 100;

const SECTION_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M"];
const CIRCLE_ROWS = ["A", "B", "C", "D", "E", "F"];
const CIRCLE_RADIUS = 236 + 21.5 * SECTION_ROWS.length + 34;

interface SectionSpec {
  id: string;
  name: string;
  from: number;
  to: number;
  rows: string[];
  radius: number;
  tier: (rowIndex: number) => string;
  demand: (rowIndex: number) => number;
  accessible?: "left" | "right";
  restricted?: "left" | "right";
}

const SECTION_SPECS: SectionSpec[] = [
  { id: "stalls-left", name: "Stalls left", from: -41, to: -15.5, rows: SECTION_ROWS, radius: 236, tier: () => "stalls", demand: rowIndex => 0.5 - 0.02 * rowIndex, accessible: "left" },
  { id: "stalls-centre", name: "Stalls centre", from: -12.5, to: 12.5, rows: SECTION_ROWS, radius: 236, tier: rowIndex => (rowIndex < 6 ? "premium" : "stalls"), demand: rowIndex => 0.66 - 0.025 * rowIndex },
  { id: "stalls-right", name: "Stalls right", from: 15.5, to: 41, rows: SECTION_ROWS, radius: 236, tier: () => "stalls", demand: rowIndex => 0.48 - 0.02 * rowIndex, accessible: "right" },
  { id: "circle-left", name: "Circle left", from: -44, to: -17, rows: CIRCLE_ROWS, radius: CIRCLE_RADIUS, tier: () => "side", demand: () => 0.22, restricted: "left" },
  { id: "circle-centre", name: "Circle centre", from: -14.5, to: 14.5, rows: CIRCLE_ROWS, radius: CIRCLE_RADIUS, tier: () => "circle", demand: rowIndex => 0.44 - 0.03 * rowIndex },
  { id: "circle-right", name: "Circle right", from: 17, to: 44, rows: CIRCLE_ROWS, radius: CIRCLE_RADIUS, tier: () => "side", demand: () => 0.2, restricted: "right" },
];

const mulberry32 = (seed: number) => () => {
  let t = (seed = (seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
};

function buildVenue(): SeatVenue {
  const random = mulberry32(1411);
  const sections: SeatSection[] = [];
  const rows: SeatRowLabel[] = [];
  const seats: Seat[] = [];

  for (const spec of SECTION_SPECS) {
    const centre = (spec.from + spec.to) / 2;
    const labelRadius = spec.radius + (spec.rows.length - 1) * 21.5 + 30;
    sections.push({
      id: spec.id,
      name: spec.name,
      labelX: round2(500 + labelRadius * Math.sin(radians(centre))),
      labelY: round2(-128 + labelRadius * Math.cos(radians(centre))),
    });

    spec.rows.forEach((row, rowIndex) => {
      const radius = spec.radius + 21.5 * rowIndex;
      const count = Math.floor((radius * radians(spec.to - spec.from)) / 20.5);
      const step = 20.5 / radius;
      const start = radians(centre) - (step * (count - 1)) / 2;
      const lastRow = rowIndex === spec.rows.length - 1;
      // Sold runs: once a seat is sold the next one is likely sold too.
      let inRun = false;
      let heldLeft = 0;

      for (let index = 0; index < count; index++) {
        let access: SeatAccess | undefined;
        const angle = start + index * step;
        const number = index + 1;

        if (lastRow && spec.accessible) {
          const fromEdge = spec.accessible === "right" ? index : count - 1 - index;
          if (fromEdge < 2) access = "wheelchair";
          else if (fromEdge === 2) access = "companion";
        }

        const demand = spec.demand(rowIndex);
        inRun = inRun ? random() < 0.74 : random() < 0.55 * demand;
        let status: SeatStatus = inRun ? "sold" : "available";
        if (!inRun && heldLeft === 0 && random() < 0.035) heldLeft = 2 + Math.floor(3 * random());
        if (heldLeft > 0 && !inRun) {
          status = "held";
          heldLeft--;
        }
        if (access && status === "sold" && random() < 0.6) status = "available";

        const aisle = index === 0 || index === count - 1;
        const restricted = spec.restricted === "left" ? index < 2 : spec.restricted === "right" && index > count - 3;
        const note =
          access === "wheelchair"
            ? "Wheelchair space, step free from the foyer"
            : access === "companion"
              ? "Companion seat next to a wheelchair space"
              : restricted
                ? "Restricted view of the stage edge"
                : aisle
                  ? "Aisle seat"
                  : undefined;

        seats.push({
          id: `${spec.id}-${row}-${number}`,
          section: spec.id,
          row,
          number,
          x: round2(500 + radius * Math.sin(angle)),
          y: round2(-128 + radius * Math.cos(angle)),
          rotate: round2(-(180 * angle) / Math.PI),
          tier: spec.tier(rowIndex),
          status,
          access,
          note,
        });
      }

      if (spec.id.endsWith("-left") || spec.id.endsWith("-right")) {
        const angle = spec.id.endsWith("-left") ? radians(spec.from) - 14 / radius : radians(spec.to) + 14 / radius;
        rows.push({
          id: `${spec.id}-${row}`,
          row,
          x: round2(500 + radius * Math.sin(angle)),
          y: round2(-128 + radius * Math.cos(angle)),
        });
      }
    });
  }

  const stageAngle = radians(27);
  const point = (radius: number, angle: number) => `${round2(500 + radius * Math.sin(angle))} ${round2(-128 + radius * Math.cos(angle))}`;

  return {
    width: 1000,
    height: 560,
    stage: `M ${point(204, -stageAngle)} A 204 204 0 0 0 ${point(204, stageAngle)} L ${point(150, stageAngle)} A 150 150 0 0 1 ${point(150, -stageAngle)} Z`,
    stageLabel: { x: 500, y: round2(49) },
    sections,
    seats,
    rows,
  };
}

export const seatVenue: SeatVenue = buildVenue();

export const seatDefaultSelection: string[] = (() => {
  const row = seatVenue.seats.filter(seat => seat.section === "stalls-centre" && seat.row === "G");
  for (let index = Math.floor(row.length / 2); index < row.length - 1; index++) {
    if (row[index].status === "available" && row[index + 1].status === "available") return [row[index].id, row[index + 1].id];
  }
  return [];
})();

/* ── helpers ────────────────────────────────────────────────────────────── */

const { spring, duration, ease } = motionTokens;
const cameraSpring = { ...spring.smooth, visualDuration: 0.52 };

const easeEnter = [...ease.enter] as [number, number, number, number];
const easeExit = [...ease.exit] as [number, number, number, number];
const easeStandard = [...ease.standard] as [number, number, number, number];

/** Blocks sit flush inside the frame: the frame owns the edges, so the block drops its own. */
const FLATTEN = { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } as const;

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boundsOf(seats: Seat[], padding: number): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const seat of seats) {
    x0 = Math.min(x0, seat.x);
    y0 = Math.min(y0, seat.y);
    x1 = Math.max(x1, seat.x);
    y1 = Math.max(y1, seat.y);
  }
  return { x0: x0 - padding, y0: y0 - padding, x1: x1 + padding, y1: y1 + padding };
}

const seatName = (seat: Pick<Seat, "row" | "number">) => `Row ${seat.row}, seat ${seat.number}`;

/* ── seat glyph ─────────────────────────────────────────────────────────── */

function Swatch({ color, kind = "seat" }: { color?: string; kind?: "seat" | "selected" | "held" | "sold" | "wheelchair" }) {
  return (
    <svg className={styles.swatch} viewBox="-8 -8 16 16" width={16} height={16} aria-hidden="true" data-kind={kind} style={color ? ({ "--seat": color } as CSSProperties) : undefined}>
      {kind === "wheelchair" ? <rect x={-7} y={-7} width={14} height={14} rx={4} /> : <rect x={-7} y={-6} width={14} height={12} rx={4} />}
      {kind === "selected" ? <path d="M-3.4 .2 L-1.1 2.5 L3.5 -2.3" /> : null}
      {kind === "held" ? <circle r={1.9} /> : null}
      {kind === "wheelchair" ? <Accessibility x={-5} y={-5} width={10} height={10} strokeWidth={2.4} /> : null}
    </svg>
  );
}

interface SeatGlyphProps {
  seat: Seat;
  color: string;
  label: string;
  selected: boolean;
  dimmed: boolean;
  active: boolean;
  tabbable: boolean;
}

const SeatGlyph = memo(function SeatGlyph({ seat, color, label, selected, dimmed, active, tabbable }: SeatGlyphProps) {
  const wheelchair = seat.access === "wheelchair";
  return (
    <g
      data-seat={seat.id}
      role="checkbox"
      aria-checked={selected}
      aria-disabled={seat.status !== "available" || undefined}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      className={styles.seat}
      data-status={seat.status}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      data-active={active || undefined}
      transform={`translate(${seat.x} ${seat.y}) rotate(${seat.rotate})`}
      style={{ "--seat": color } as CSSProperties}
    >
      <rect className={styles.hit} x={-10.25} y={-10.75} width={20.5} height={21.5} />
      <rect className={styles.halo} x={-10} y={-9.75} width={20} height={19.5} rx={6.5} />
      {wheelchair ? (
        <rect className={styles.seatBody} x={-7.5} y={-7.5} width={15} height={15} rx={4} />
      ) : (
        <rect className={styles.seatBody} x={-7} y={-6} width={14} height={12} rx={4} />
      )}
      <g transform={`rotate(${-seat.rotate})`} className={styles.glyphs}>
        {seat.status === "held" ? <circle className={styles.heldDot} r={1.9} /> : null}
        {wheelchair ? <Accessibility className={styles.wheel} x={-5} y={-5} width={10} height={10} strokeWidth={2.4} aria-hidden="true" /> : null}
        <path className={styles.check} d="M-3.4 .2 L-1.1 2.5 L3.5 -2.3" />
      </g>
    </g>
  );
});

/* ── component ──────────────────────────────────────────────────────────── */

export function SeatMap({
  event = seatEvent,
  venue = seatVenue,
  tiers = seatTiers,
  maxSeats = 6,
  serviceFee = 4.5,
  currency = "USD",
  holdMinutes = 10,
  defaultSelected = seatDefaultSelection,
  title = "Your seats",
  onSelectionChange,
  onHold,
  className,
}: SeatMapProps) {
  const uid = useId();
  const reduceMotion = !!useReducedMotion();

  const money = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    [currency],
  );
  const moneyExact = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency }), [currency]);
  const currencySymbol = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0).find(part => part.type === "currency")?.value ?? "",
    [currency],
  );

  const tierById = useMemo(() => new Map(tiers.map(tier => [tier.id, tier])), [tiers]);
  const seatById = useMemo(() => new Map(venue.seats.map(seat => [seat.id, seat])), [venue.seats]);
  const sectionName = useMemo(() => new Map(venue.sections.map(section => [section.id, section.name])), [venue.sections]);
  const bounds = useMemo(() => {
    const box = boundsOf(venue.seats, 30);
    return { ...box, y0: Math.min(box.y0, venue.stageLabel.y - 44) };
  }, [venue.seats, venue.stageLabel.y]);

  const rowIndex = useMemo(() => {
    const rows = new Map<string, Seat[]>();
    const order = new Map<string, string[]>();
    for (const seat of venue.seats) {
      const key = `${seat.section}|${seat.row}`;
      if (!rows.has(key)) {
        rows.set(key, []);
        order.set(seat.section, [...(order.get(seat.section) ?? []), seat.row]);
      }
      rows.get(key)!.push(seat);
    }
    rows.forEach(list => list.sort((a, b) => a.number - b.number));
    return { rows, order };
  }, [venue.seats]);

  const [selection, setSelection] = useState<string[]>(() =>
    defaultSelected.filter(id => seatById.get(id)?.status === "available").slice(0, maxSeats),
  );
  const [active, setActive] = useState<string | null>(
    () => selection[0] ?? venue.seats.find(seat => seat.status === "available")?.id ?? null,
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [svgFocused, setSvgFocused] = useState(false);
  const [highlightTier, setHighlightTier] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"fit" | "mid" | "max">("fit");
  const [hold, setHold] = useState<{ status: "idle" | "holding" | "held" | "error"; endsAt: number }>({ status: "idle", endsAt: 0 });
  const [now, setNow] = useState(0);

  const selectedIds = useMemo(() => new Set(selection), [selection]);
  const selectedSeats = useMemo(() => selection.map(id => seatById.get(id)).filter((seat): seat is Seat => !!seat), [selection, seatById]);
  const locked = hold.status === "holding" || hold.status === "held";

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  });
  const firstSelection = useRef(true);
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false;
      return;
    }
    onSelectionChangeRef.current?.(selectedSeats);
  }, [selectedSeats]);

  /* camera */
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const fitViewRef = useRef({ x: 0, y: 0, s: 1 });
  const maxScaleRef = useRef(4);
  const camX = useMotionValue(0);
  const camY = useMotionValue(0);
  const camS = useMotionValue(1);
  const tipSeatRef = useRef<Seat | null>(null);

  const fitTo = useCallback((box: Bounds, max = maxScaleRef.current) => {
    const { w, h } = sizeRef.current;
    const scale = clamp(Math.min((w - 32) / (box.x1 - box.x0), (h - 32) / (box.y1 - box.y0)), fitViewRef.current.s, max);
    return {
      s: scale,
      x: w / 2 - ((box.x0 + box.x1) / 2) * scale,
      y: h / 2 - ((box.y0 + box.y1) / 2) * scale,
    };
  }, []);

  const constrain = useCallback(
    (view: { x: number; y: number; s: number }) => {
      const { w, h } = sizeRef.current;
      const s = clamp(view.s, fitViewRef.current.s, maxScaleRef.current);
      const axis = (value: number, viewport: number, low: number, high: number) => {
        const span = (high - low) * s;
        if (span <= viewport - 32) return (viewport - span) / 2 - low * s;
        return clamp(value, viewport - 16 - high * s, 16 - low * s);
      };
      return { s, x: axis(view.x, w, bounds.x0, bounds.x1), y: axis(view.y, h, bounds.y0, bounds.y1) };
    },
    [bounds],
  );

  const positionTip = useCallback(() => {
    const tip = tipRef.current;
    const seat = tipSeatRef.current;
    if (!tip || !seat) return;
    const scale = camS.get();
    const x = camX.get() + seat.x * scale;
    const y = camY.get() + seat.y * scale;
    const below = y < 96;
    const half = tip.offsetWidth / 2;
    const left = clamp(x, half + 8, sizeRef.current.w - half - 8);
    const gap = 9 * Math.max(0.7, scale) + 6;
    tip.style.transform = `translate(${left.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${below ? "0%" : "-100%"}) translateY(${below ? gap : -gap}px)`;
    tip.toggleAttribute("data-below", below);
  }, [camS, camX, camY]);

  const levelRef = useRef<"fit" | "mid" | "max">("fit");

  const applyCamera = useCallback(() => {
    const world = worldRef.current;
    if (!world || !sizeRef.current.w) return;
    world.setAttribute("transform", `translate(${camX.get().toFixed(2)} ${camY.get().toFixed(2)}) scale(${camS.get().toFixed(4)})`);
    const labels = labelsRef.current;
    const scale = camS.get();
    if (labels) {
      labels.style.setProperty("--label-size", `${(clamp(12 * scale, 9, 13) / scale).toFixed(2)}px`);
      labels.style.setProperty("--row-size", `${(clamp(9 * scale, 7.5, 11) / scale).toFixed(2)}px`);
      labels.style.setProperty("--row-opacity", 9 * scale < 5.5 ? "0" : "1");
      labels.style.setProperty("--label-opacity", 12 * scale < 7 ? "0" : "1");
    }
    positionTip();
    const next: "fit" | "mid" | "max" = scale <= 1.01 * fitViewRef.current.s ? "fit" : scale >= 0.99 * maxScaleRef.current ? "max" : "mid";
    if (next !== levelRef.current) {
      levelRef.current = next;
      setLevel(next);
    }
  }, [positionTip, camS, camX, camY]);

  useEffect(() => {
    const schedule = () => frame.render(applyCamera);
    const stops = [camX.on("change", schedule), camY.on("change", schedule), camS.on("change", schedule)];
    return () => stops.forEach(stop => stop());
  }, [camX, camY, camS, applyCamera]);

  const jumpTo = useCallback(
    (view: { x: number; y: number; s: number }) => {
      camX.jump(view.x);
      camY.jump(view.y);
      camS.jump(view.s);
      applyCamera();
    },
    [camS, camX, camY, applyCamera],
  );

  const moveTo = useCallback(
    (view: { x: number; y: number; s: number }) => {
      const next = constrain(view);
      if (reduceMotion) jumpTo(next);
      else {
        animate(camX, next.x, cameraSpring);
        animate(camY, next.y, cameraSpring);
        animate(camS, next.s, cameraSpring);
      }
    },
    [constrain, jumpTo, reduceMotion, camS, camX, camY],
  );

  const stopCamera = useCallback(() => {
    camX.stop();
    camY.stop();
    camS.stop();
  }, [camS, camX, camY]);

  const zoomBy = useCallback(
    (factor: number, cx: number, cy: number, animated: boolean) => {
      const scale = camS.get();
      const x = camX.get();
      const y = camY.get();
      const next = clamp(scale * factor, fitViewRef.current.s, maxScaleRef.current);
      const view = { s: next, x: cx - ((cx - x) / scale) * next, y: cy - ((cy - y) / scale) * next };
      if (animated) moveTo(view);
      else jumpTo(constrain(view));
    },
    [constrain, moveTo, jumpTo, camS, camX, camY],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const svg = svgRef.current;
    if (!viewport || !svg) return;
    const measure = () => {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      if (!w || !h || (w === sizeRef.current.w && h === sizeRef.current.h)) return;
      const shouldFit = !sizeRef.current.w || levelRef.current === "fit";
      sizeRef.current = { w, h };
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      fitViewRef.current = { x: 0, y: 0, s: 0 };
      const fit = fitTo(bounds, Infinity);
      fitViewRef.current = fit;
      maxScaleRef.current = Math.max(4 * fit.s, 44 / 20.5);
      stopCamera();
      jumpTo(shouldFit ? fit : constrain({ x: camX.get(), y: camY.get(), s: camS.get() }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitTo, constrain, bounds, jumpTo, camS, stopCamera, camX, camY]);

  /* messages */
  const noticeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announce = useCallback((text: string, flash = true) => {
    setMessage(text);
    if (flash) {
      setNotice(current => ({ id: (current?.id ?? 0) + 1, text }));
      clearTimeout(noticeTimeout.current);
      noticeTimeout.current = setTimeout(() => setNotice(null), 2800);
    }
  }, []);
  useEffect(() => () => clearTimeout(noticeTimeout.current), []);

  const describeSeat = useCallback((seat: Seat) => `${seatName(seat)}, ${sectionName.get(seat.section) ?? ""}`, [sectionName]);

  const toggleSeat = useCallback(
    (id: string) => {
      const seat = seatById.get(id);
      if (!seat) return;
      setActive(id);
      if (locked) {
        announce("Release your hold to change seats.");
        return;
      }
      if (seat.status === "sold") {
        announce(`${seatName(seat)} is sold.`);
        return;
      }
      if (seat.status === "held") {
        announce(`${seatName(seat)} is on hold for another buyer.`);
        return;
      }
      if (selectedIds.has(id)) {
        setSelection(current => current.filter(item => item !== id));
        announce(`Removed ${describeSeat(seat)}.`, false);
        return;
      }
      if (selection.length >= maxSeats) {
        announce(`You can choose up to ${maxSeats} seats. Remove one to pick another.`);
        return;
      }
      setSelection(current => [...current, id]);
      if (hold.status === "error") setHold({ status: "idle", endsAt: 0 });
      const tier = tierById.get(seat.tier);
      announce(`Added ${describeSeat(seat)}, ${tier ? money.format(tier.price) : ""}. ${selection.length + 1} of ${maxSeats} seats.`, false);
    },
    [describeSeat, hold.status, locked, maxSeats, money, announce, seatById, selection.length, selectedIds, tierById],
  );

  const removeSeat = useCallback(
    (id: string) => {
      const seat = seatById.get(id);
      if (!seat || locked) return;
      setSelection(current => current.filter(item => item !== id));
      announce(`Removed ${describeSeat(seat)}.`, false);
    },
    [describeSeat, locked, announce, seatById],
  );

  const centreOn = useCallback(
    (seat: Seat, always = false) => {
      const { w, h } = sizeRef.current;
      const scale = camS.get();
      const x = camX.get() + seat.x * scale;
      const y = camY.get() + seat.y * scale;
      if (!always && x > 48 && x < w - 48 && y > 48 && y < h - 48) return;
      moveTo({ s: scale, x: w / 2 - seat.x * scale, y: h / 2 - seat.y * scale });
    },
    [moveTo, camS, camX, camY],
  );

  const focusSeat = useCallback(
    (id: string) => {
      setActive(id);
      const node = svgRef.current?.querySelector<SVGGElement>(`[data-seat="${CSS.escape(id)}"]`);
      node?.focus({ preventScroll: true });
      const seat = seatById.get(id);
      if (seat) centreOn(seat);
    },
    [centreOn, seatById],
  );

  const neighbour = useCallback(
    (seat: Seat, key: string): Seat | null => {
      const row = rowIndex.rows.get(`${seat.section}|${seat.row}`) ?? [];
      const index = row.findIndex(item => item.id === seat.id);
      const closest = (list: Seat[]) =>
        list.reduce<Seat | null>((best, candidate) => {
          const distance = Math.hypot(candidate.x - seat.x, candidate.y - seat.y);
          return !best || distance < Math.hypot(best.x - seat.x, best.y - seat.y) ? candidate : best;
        }, null);
      if (key === "Home") return row[0] ?? null;
      if (key === "End") return row[row.length - 1] ?? null;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        const direction = key === "ArrowLeft" ? -1 : 1;
        if (row[index + direction]) return row[index + direction];
        return closest(
          venue.seats.filter(
            candidate =>
              candidate.section !== seat.section &&
              candidate.row === seat.row &&
              (candidate.x - seat.x) * direction > 0 &&
              Math.hypot(candidate.x - seat.x, candidate.y - seat.y) < 140,
          ),
        );
      }
      const rows = rowIndex.order.get(seat.section) ?? [];
      const position = rows.indexOf(seat.row);
      const direction = key === "ArrowUp" ? -1 : 1;
      const nextRow = rows[position + direction];
      return closest(
        nextRow
          ? (rowIndex.rows.get(`${seat.section}|${nextRow}`) ?? [])
          : venue.seats.filter(
              candidate =>
                candidate.section !== seat.section &&
                (candidate.y - seat.y) * direction > 12 &&
                Math.abs(candidate.x - seat.x) < 160,
            ),
      );
    },
    [rowIndex, venue.seats],
  );

  const zoomCentre = useCallback(
    (factor: number) => {
      zoomBy(factor, sizeRef.current.w / 2, sizeRef.current.h / 2, true);
    },
    [zoomBy],
  );

  const fitAll = useCallback(() => moveTo(fitViewRef.current), [moveTo]);

  /* pointers */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    moved: false,
    start: { x: 0, y: 0, s: 1 },
    origin: { x: 0, y: 0 },
    distance: 0,
    mid: { x: 0, y: 0 },
    type: "mouse",
  });
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  const localPoint = (clientX: number, clientY: number) => {
    const box = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };

  const resetGesture = () => {
    const list = [...pointers.current.values()];
    const state = gesture.current;
    state.start = { x: camX.get(), y: camY.get(), s: camS.get() };
    if (list.length >= 2) {
      state.distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      state.mid = { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 };
    } else if (list.length === 1) {
      state.origin = list[0];
    }
  };

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    if (gesture.current.moved) suppressClick.current = true;
    if (pointers.current.size > 0) resetGesture();
    else setDragging(false);
  };

  const wheelHint = useRef(0);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        const stamp = performance.now();
        if (stamp - wheelHint.current > 3200) {
          wheelHint.current = stamp;
          announce("Pinch, or hold Ctrl or ⌘ while scrolling, to zoom.", true);
        }
        return;
      }
      event.preventDefault();
      stopCamera();
      const box = viewport.getBoundingClientRect();
      zoomBy(Math.exp(-(0.012 * event.deltaY)), event.clientX - box.left, event.clientY - box.top, false);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [announce, stopCamera, zoomBy]);

  const bySection = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const seat of venue.seats) map.set(seat.section, [...(map.get(seat.section) ?? []), seat]);
    return map;
  }, [venue.seats]);

  const leftByTier = useMemo(() => {
    const counts = new Map<string, number>();
    for (const seat of venue.seats) {
      if (seat.status !== "available" || selectedIds.has(seat.id)) continue;
      counts.set(seat.tier, (counts.get(seat.tier) ?? 0) + 1);
    }
    return counts;
  }, [selectedIds, venue.seats]);

  const tipId = hovered ?? (keyboardMode && svgFocused ? active : null);
  const tipSeat = tipId ? (seatById.get(tipId) ?? null) : null;
  const [shownTip, setShownTip] = useState<Seat | null>(null);
  if (tipSeat && tipSeat !== shownTip) setShownTip(tipSeat);
  useLayoutEffect(() => {
    if (!shownTip) return;
    tipSeatRef.current = shownTip;
    positionTip();
  }, [positionTip, shownTip]);

  const tickets = selectedSeats.reduce((total, seat) => total + (tierById.get(seat.tier)?.price ?? 0), 0);
  const fees = selectedSeats.length * serviceFee;
  const allTogether =
    selectedSeats.length < 2 ||
    (() => {
      const first = selectedSeats[0];
      if (!selectedSeats.every(seat => seat.section === first.section && seat.row === first.row)) return false;
      const numbers = selectedSeats.map(seat => seat.number).sort((a, b) => a - b);
      return numbers[numbers.length - 1] - numbers[0] === numbers.length - 1;
    })();

  useEffect(() => {
    if (hold.status !== "held") return;
    const tick = () => {
      const stamp = Date.now();
      setNow(stamp);
      if (stamp >= hold.endsAt) {
        setHold({ status: "idle", endsAt: 0 });
        setMessage("Your hold expired. The seats are back on sale.");
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold]);

  const remaining = Math.max(0, Math.ceil((hold.endsAt - now) / 1000));
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  const placeHold = async () => {
    if (!selectedSeats.length || locked) return;
    setHold({ status: "holding", endsAt: 0 });
    try {
      if (onHold) await onHold(selectedSeats);
      else await new Promise(resolve => setTimeout(resolve, 900));
      const endsAt = Date.now() + holdMinutes * 60_000;
      setNow(Date.now());
      setHold({ status: "held", endsAt });
      setMessage(`${selectedSeats.length} ${selectedSeats.length === 1 ? "seat" : "seats"} held for ${holdMinutes} minutes.`);
    } catch {
      setHold({ status: "error", endsAt: 0 });
      setMessage("Those seats could not be held. Try again.");
    }
  };

  const holdLabel =
    hold.status === "held" ? "Seats held" : hold.status === "error" ? "Try again" : selectedSeats.length === 0 ? "Choose seats" : `Hold ${selectedSeats.length} ${selectedSeats.length === 1 ? "seat" : "seats"}`;

  const ariaLabel = useCallback(
    (seat: Seat) => {
      const tier = tierById.get(seat.tier);
      const detail =
        seat.status === "sold" ? "Sold" : seat.status === "held" ? "On hold for another buyer" : `${tier?.name ?? ""}, ${tier ? money.format(tier.price) : ""}`;
      return `${seatName(seat)}, ${sectionName.get(seat.section) ?? ""}. ${detail}${seat.note ? `. ${seat.note}` : ""}`;
    },
    [money, sectionName, tierById],
  );

  const seatLabels = useMemo(() => new Map(venue.seats.map(seat => [seat.id, ariaLabel(seat)])), [ariaLabel, venue.seats]);

  const itemTransition = reduceMotion ? { duration: 0 } : cameraSpring;
  const itemExit = reduceMotion ? { duration: 0 } : { duration: duration.exit, ease: easeExit };
  const titleId = `${uid}-title`;
  const hintId = `${uid}-hint`;

  return (
    <section className={join(styles.root, className)} style={FLATTEN} data-frame-flat="" aria-labelledby={`${uid}-event`}>
      <header className={styles.header}>
        {event.image ? <img className={styles.thumb} src={event.image.src} alt={event.image.alt} width={88} height={88} /> : null}
        <div className={styles.headText}>
          <h2 id={`${uid}-event`} className={styles.eventName}>
            {event.name}
          </h2>
          <p className={styles.eventMeta}>
            <span>{event.date}</span>
            <span aria-hidden="true" className={styles.dot} />
            <span>{event.venue}</span>
          </p>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.mapColumn}>
          <div className={styles.tiers} role="group" aria-label="Highlight a price">
            {tiers.map(tier => (
              <button
                key={tier.id}
                type="button"
                className={styles.tier}
                aria-pressed={highlightTier === tier.id}
                onClick={() => {
                  const next = highlightTier === tier.id ? null : tier.id;
                  setHighlightTier(next);
                  if (!next) {
                    fitAll();
                    return;
                  }
                  const matching = venue.seats.filter(seat => seat.tier === next);
                  if (matching.length) moveTo(fitTo(boundsOf(matching, 26), 2 * fitViewRef.current.s));
                  const left = matching.filter(seat => seat.status === "available" && !selectedIds.has(seat.id)).length;
                  setMessage(`${tierById.get(next)?.name ?? ""} highlighted, ${left} seats available.`);
                }}
                style={{ "--seat": tier.color } as CSSProperties}
              >
                <Swatch color={tier.color} />
                <span className={styles.tierName}>{tier.name}</span>
                <span className={styles.tierPrice}>{money.format(tier.price)}</span>
                <span className={styles.tierLeft}>{leftByTier.get(tier.id) ?? 0} left</span>
              </button>
            ))}
          </div>

          <div
            ref={viewportRef}
            className={styles.viewport}
            data-level={level}
            data-dragging={dragging || undefined}
            data-filtered={highlightTier ? "" : undefined}
            onPointerDown={event => {
              if (event.button !== 0 || (event.target as Element).closest("button")) return;
              setKeyboardMode(false);
              stopCamera();
              pointers.current.set(event.pointerId, localPoint(event.clientX, event.clientY));
              gesture.current.type = event.pointerType;
              if (pointers.current.size === 1) gesture.current.moved = false;
              resetGesture();
            }}
            onPointerMove={event => {
              if (!pointers.current.has(event.pointerId)) return;
              pointers.current.set(event.pointerId, localPoint(event.clientX, event.clientY));
              const list = [...pointers.current.values()];
              const state = gesture.current;
              if (list.length >= 2) {
                const distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
                const mid = { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 };
                const scale = clamp(state.start.s * (distance / Math.max(1, state.distance)), fitViewRef.current.s, maxScaleRef.current);
                const offsetX = (state.mid.x - state.start.x) / state.start.s;
                const offsetY = (state.mid.y - state.start.y) / state.start.s;
                state.moved = true;
                jumpTo(constrain({ s: scale, x: mid.x - offsetX * scale, y: mid.y - offsetY * scale }));
                return;
              }
              const dx = list[0].x - state.origin.x;
              const dy = list[0].y - state.origin.y;
              if (!state.moved && Math.hypot(dx, dy) < 5) return;
              if (!state.moved) {
                state.moved = true;
                viewportRef.current?.setPointerCapture(event.pointerId);
                setDragging(true);
                setHovered(null);
              }
              jumpTo(constrain({ s: state.start.s, x: state.start.x + dx, y: state.start.y + dy }));
            }}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onPointerLeave={() => {
              if (!dragging) setHovered(null);
            }}
          >
            <svg
              ref={svgRef}
              className={styles.svg}
              viewBox={`0 0 ${venue.width} ${venue.height}`}
              role="group"
              aria-label={`Seat map, ${event.venue}`}
              aria-describedby={hintId}
              data-keyboard={keyboardMode || undefined}
              onKeyDown={event => {
                setKeyboardMode(true);
                const seat = active ? seatById.get(active) : null;
                const key = event.key;
                if (key === "+" || key === "=") {
                  event.preventDefault();
                  zoomCentre(1.5);
                  return;
                }
                if (key === "-" || key === "_") {
                  event.preventDefault();
                  zoomCentre(1 / 1.5);
                  return;
                }
                if (key === "0") {
                  event.preventDefault();
                  fitAll();
                  return;
                }
                if (!seat) return;
                if (key === "Enter" || key === " ") {
                  event.preventDefault();
                  toggleSeat(seat.id);
                  return;
                }
                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) {
                  event.preventDefault();
                  const next = neighbour(seat, key);
                  if (next) focusSeat(next.id);
                }
              }}
              onClick={event => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                const hit = (event.target as Element).closest("[data-seat]") as SVGGElement | null;
                const id = hit?.dataset.seat;
                if (!id) return;
                const seat = seatById.get(id);
                const scale = camS.get();
                if (gesture.current.type === "touch" && event.detail > 0 && 20.5 * scale < 36 && seat) {
                  const nextScale = Math.min(maxScaleRef.current, 44 / 20.5);
                  const { w, h } = sizeRef.current;
                  moveTo({ s: nextScale, x: w / 2 - seat.x * nextScale, y: h / 2 - seat.y * nextScale });
                  setActive(id);
                  setMessage("Zoomed in. Tap a seat to choose it.");
                  return;
                }
                toggleSeat(id);
              }}
              onFocus={() => setSvgFocused(true)}
              onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSvgFocused(false);
              }}
              onPointerOver={event => {
                if (event.pointerType !== "mouse" || dragging) return;
                setHovered((event.target as Element).closest("[data-seat]")?.getAttribute("data-seat") ?? null);
              }}
            >
              <g ref={worldRef}>
                <path className={styles.stage} d={venue.stage} />
                <g ref={labelsRef} aria-hidden="true">
                  <text className={styles.stageLabel} x={venue.stageLabel.x} y={venue.stageLabel.y} textAnchor="middle" dominantBaseline="middle">
                    Stage
                  </text>
                  {venue.sections.map(section => (
                    <text key={`label-${section.id}`} className={styles.sectionLabel} x={section.labelX} y={section.labelY} textAnchor="middle" dominantBaseline="middle">
                      {section.name}
                    </text>
                  ))}
                  {venue.rows.map(label => (
                    <text key={label.id} className={styles.rowLabel} x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                      {label.row}
                    </text>
                  ))}
                </g>
                {venue.sections.map(section => (
                  <g key={section.id} role="group" aria-label={section.name}>
                    {(bySection.get(section.id) ?? []).map(seat => (
                      <SeatGlyph
                        key={seat.id}
                        seat={seat}
                        color={tierById.get(seat.tier)?.color ?? "var(--text-muted)"}
                        label={seatLabels.get(seat.id) ?? ""}
                        selected={selectedIds.has(seat.id)}
                        dimmed={!!highlightTier && seat.tier !== highlightTier}
                        active={active === seat.id}
                        tabbable={active === seat.id}
                      />
                    ))}
                  </g>
                ))}
              </g>
            </svg>

            <div ref={tipRef} className={styles.tip} data-open={tipSeat ? "" : undefined} aria-hidden="true">
              {shownTip
                ? (() => {
                    const tier = tierById.get(shownTip.tier);
                    const isSelected = selectedIds.has(shownTip.id);
                    return (
                      <>
                        <span className={styles.tipTitle}>{seatName(shownTip)}</span>
                        <span className={styles.tipMeta}>
                          {sectionName.get(shownTip.section)}
                          {tier && !sectionName.get(shownTip.section)?.includes(tier.name) ? `, ${tier.name}` : ""}
                        </span>
                        <span className={styles.tipPrice} data-status={shownTip.status}>
                          {shownTip.status === "sold" ? "Sold" : shownTip.status === "held" ? "On hold" : isSelected ? `Selected, ${tier ? money.format(tier.price) : ""}` : tier ? money.format(tier.price) : ""}
                        </span>
                        {shownTip.note ? <span className={styles.tipNote}>{shownTip.note}</span> : null}
                      </>
                    );
                  })()
                : null}
            </div>

            <AnimatePresence>
              {notice ? (
                <motion.p
                  key={notice.id}
                  className={styles.notice}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, transition: itemExit }}
                  transition={reduceMotion ? { duration: 0 } : cameraSpring}
                >
                  {notice.text}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <div className={styles.zoom} role="group" aria-label="Zoom">
              <button type="button" className={styles.zoomButton} aria-label="Zoom in" disabled={level === "max"} onClick={() => zoomCentre(1.6)}>
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button type="button" className={styles.zoomButton} aria-label="Zoom out" disabled={level === "fit"} onClick={() => zoomCentre(0.625)}>
                <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.zoomButton}
                aria-label="Show the whole hall"
                disabled={level === "fit"}
                onClick={() => {
                  setHighlightTier(null);
                  fitAll();
                }}
              >
                <Maximize size={15} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className={styles.legend} aria-label="Seat key">
            <li>
              <Swatch kind="selected" />
              Selected
            </li>
            <li>
              <Swatch kind="held" />
              On hold
            </li>
            <li>
              <Swatch kind="sold" />
              Sold
            </li>
            <li>
              <Swatch kind="wheelchair" color="var(--text-secondary)" />
              Wheelchair space
            </li>
          </ul>

          <p id={hintId} className={styles.srOnly}>
            Use the arrow keys to move between seats, Home and End for the ends of a row, Enter or Space to choose a seat, plus and minus to zoom, and 0 to show the whole hall.
          </p>
        </div>

        <aside className={styles.summary} aria-labelledby={titleId}>
          <div className={styles.summaryHead}>
            <h3 id={titleId} className={styles.summaryTitle}>
              {title}
            </h3>
            <span className={styles.count} data-full={selectedSeats.length >= maxSeats || undefined}>
              {selectedSeats.length} of {maxSeats}
            </span>
          </div>

          <div className={styles.listArea}>
            <AnimatePresence initial={false}>
              {selectedSeats.length === 0 ? (
                <motion.p
                  key="empty"
                  className={styles.empty}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : duration.instant } }}
                  transition={reduceMotion ? { duration: 0 } : { duration: duration.standard, ease: easeEnter }}
                >
                  Pick seats on the map. Tap a price above to see where it sits.
                </motion.p>
              ) : null}
            </AnimatePresence>

            <ul className={styles.list}>
              <AnimatePresence initial={false}>
                {selectedSeats.map(seat => {
                  const tier = tierById.get(seat.tier);
                  return (
                    <motion.li
                      key={seat.id}
                      className={styles.itemWrap}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0, transition: itemExit }}
                      transition={itemTransition}
                    >
                      <div className={styles.item}>
                        <button
                          type="button"
                          className={styles.itemMain}
                          onClick={() => {
                            const target = seatById.get(seat.id);
                            if (!target) return;
                            setActive(target.id);
                            centreOn(target, true);
                          }}
                          aria-label={`Show ${seatName(seat)}, ${sectionName.get(seat.section)} on the map`}
                        >
                          <Swatch color={tier?.color} />
                          <span className={styles.itemText}>
                            <span className={styles.itemName}>{seatName(seat)}</span>
                            <span className={styles.itemMeta}>
                              {sectionName.get(seat.section)}
                              {seat.access === "wheelchair" ? ", wheelchair space" : ""}
                            </span>
                          </span>
                          <span className={styles.itemPrice}>{tier ? money.format(tier.price) : ""}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`Remove ${seatName(seat)}, ${sectionName.get(seat.section)}`}
                          disabled={locked}
                          onClick={() => removeSeat(seat.id)}
                        >
                          <X size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <AnimatePresence initial={false}>
              {!allTogether ? (
                <motion.p
                  key="apart"
                  className={styles.apart}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0, transition: itemExit }}
                  transition={itemTransition}
                >
                  <span className={styles.apartInner}>These seats are not all together.</span>
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <dl className={styles.totals}>
            <div className={styles.totalRow}>
              <dt>Tickets</dt>
              <dd>
                <AnimatedCounter value={tickets} prefix={currencySymbol} decimals={2} />
              </dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Service fee</dt>
              <dd>
                <AnimatedCounter value={fees} prefix={currencySymbol} decimals={2} />
              </dd>
            </div>
            <div className={join(styles.totalRow, styles.grand)}>
              <dt>Total</dt>
              <dd>
                <AnimatedCounter value={tickets + fees} prefix={currencySymbol} decimals={2} />
              </dd>
            </div>
          </dl>

          <div className={styles.actions}>
            <Button className={styles.holdButton} variant="primary" loading={hold.status === "holding"} disabled={selectedSeats.length === 0 || hold.status === "held"} onClick={placeHold}>
              {holdLabel}
            </Button>
            <div className={styles.status}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={hold.status === "held" ? "held" : hold.status === "error" ? "error" : "idle"}
                  className={styles.statusInner}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : { duration: duration.instant, ease: easeStandard } }}
                  transition={reduceMotion ? { duration: 0 } : { duration: duration.standard, ease: easeEnter }}
                >
                  {hold.status === "held" ? (
                    <>
                      <span>
                        Held for <span className={styles.timer}>{countdown}</span>. Checkout is simulated.
                      </span>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          setHold({ status: "idle", endsAt: 0 });
                          setMessage("Hold released. You can change your seats.");
                        }}
                      >
                        Release
                      </button>
                    </>
                  ) : hold.status === "error" ? (
                    <span className={styles.error}>Those seats could not be held. Try again.</span>
                  ) : (
                    <span className={styles.statusQuiet}>{moneyExact.format(serviceFee)} service fee per ticket</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </aside>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}

export default SeatMap;
