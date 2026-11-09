import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Copy, RotateCw, X } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import styles from "./prize-wheel.module.css";

export type PrizeWheelSegment = {
  id?: string;
  label: string;
  detail?: string;
  code?: string;
  weight?: number;
  featured?: boolean;
};

export type PrizeWheelLabels = {
  spin?: string;
  again?: string;
  done?: string;
  copy?: string;
  copied?: string;
  copyFailed?: string;
  odds?: string;
  hint?: string;
  weak?: string;
};

export type PrizeWheelProps = {
  /**
   * Prizes clockwise from the top, two to twelve. `label` is drawn on the wheel (keep it to about
   * 14 characters), `detail` and `code` appear in the reward card, `weight` is the relative chance
   * (defaults to 1), and `featured` marks the rare top prize with the accent.
   */
  segments?: PrizeWheelSegment[];
  /** Heading beside the wheel before the first spin. */
  title?: string;
  /** One line under the heading. */
  description?: string;
  /** Visible words for localization: hub label, Spin again, locked hub label, copy states, odds heading, gesture hints. */
  labels?: PrizeWheelLabels;
  /**
   * Returns the winning index when a spin starts, such as a result your server already drew.
   * Without it the wheel draws by weight in the browser, which suits a demo but not a real prize.
   */
  pickWinner?: (segments: PrizeWheelSegment[]) => number;
  /** Called once when the wheel comes to rest on a prize. */
  onResult?: (segment: PrizeWheelSegment, index: number) => void;
  /** Allows a single spin. The wheel locks on the prize, the hub reads Claimed, and Spin again is hidden. */
  once?: boolean;
  /** Equal slices, or slice angles proportional to weight so the wheel itself shows the odds. */
  sizing?: "equal" | "weight";
  /** Shows the list of prizes with their chance beside the wheel. */
  showOdds?: boolean;
  /** Multiplies the slow idle drift before a spin. 0 holds the wheel still. */
  speed?: number;
  /** Holds the idle drift. A spin the visitor starts still runs to the end. */
  paused?: boolean;
  /** Color of the pointer, the featured prize, the charge ring, and the won segment. Defaults to the accent token. */
  accent?: string;
  /** Accessible name of the component. The wheel image adds every prize and its chance. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
};

/* -------------------------------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------------------------------- */

/** Eight launch rewards: the demo's prize set, and the fallback whenever fewer than two segments
 *  are passed. Chances are read straight off the weights (30 / 12 / 18 / 1 / 20 / 14 / 3 / 2). */
const DEFAULT_SEGMENTS: PrizeWheelSegment[] = [
  { label: "10% off", detail: "Off your first year of Pro", code: "SPIN-10OFF", weight: 30 },
  { label: "Free month", detail: "One month of Pro on us", code: "SPIN-FREEMONTH", weight: 12 },
  { label: "20% off", detail: "Off your first year of Pro", code: "SPIN-20OFF", weight: 18 },
  {
    label: "Lifetime Pro",
    detail: "Pro for life, every future update included",
    code: "SPIN-LIFETIME",
    weight: 1,
    featured: true,
  },
  { label: "15% off", detail: "Off your first year of Pro", code: "SPIN-15OFF", weight: 20 },
  { label: "Extra seat", detail: "One more teammate, free for a year", code: "SPIN-SEAT", weight: 14 },
  { label: "2x credits", detail: "Double referral credit for 90 days", code: "SPIN-2XCREDIT", weight: 3 },
  { label: "Priority help", detail: "Replies within four hours for a year", code: "SPIN-PRIORITY", weight: 2 },
];

const DEFAULT_LABELS: Required<PrizeWheelLabels> = {
  spin: "Spin",
  again: "Spin again",
  done: "Claimed",
  copy: "Copy code",
  copied: "Copied",
  copyFailed: "Copy failed",
  odds: "Odds",
  hint: "Flick the wheel, or hold Spin to wind it up.",
  weak: "A little faster. Flick and let go to spin.",
};

const subscribeNothing = () => () => undefined;

const TAU = 2 * Math.PI;
/** Exponential ramp used by the hub and by Spin again, so the wheel takes a few frames to reach
 *  full speed instead of jumping to it. A flick passes 0 and starts at the velocity it was given. */
const SPIN_RAMP = 0.07;
/** Degrees the wheel drifts per second while nothing is happening. */
const DRIFT = 0.075;
/** Charging the hub eases the wheel back by this much at full wind-up. */
const CHARGE_BACK = 0.24;
/** Seconds to fill the hub ring. */
const CHARGE_TIME = 1.1;
/** Pointer spring: stiffness and damping, integrated in substeps of at most 1/... of a peg gap. */
const SPRING = 1000;
const DAMPING = 15;
const SPRING_LIMIT = 0.6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;
const pointOn = (angle: number, radius: number): [number, number] => [
  200 + radius * Math.sin(angle),
  200 - radius * Math.cos(angle),
];
/** Chances print as whole percents, one decimal at most: 0.3 -> "30%", 0.012 -> "1.2%". */
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

/** Half-width of the plane the pointer capsule sweeps at the wheel's rim, from the peg radius. */
const PEG_ANGLE = Math.asin(0.23809523809523808);

/**
 * The pointer is a tapered capsule: a 6.5 unit cap at the pivot end, a 13 unit round body 21 units
 * from the pivot, and a 3 unit nose that reaches 28 units out. Drawn in the wheel's own 400 unit
 * view box and rotated about (200 7), so it ticks against the pegs at r=170.
 */
const POINTER_PATH = (() => {
  const capX = 6.5 * Math.cos(PEG_ANGLE);
  const capY = 7 + 6.5 * Math.sin(PEG_ANGLE);
  const noseX = 1.5 * Math.cos(PEG_ANGLE);
  const noseY = 28 + 1.5 * Math.sin(PEG_ANGLE);
  return (
    `M${round2(200 - capX)} ${round2(capY)}` +
    `A6.5 6.5 0 1 1 ${round2(200 + capX)} ${round2(capY)}` +
    `L${round2(200 + noseX)} ${round2(noseY)}` +
    `A1.5 1.5 0 0 1 ${round2(200 - noseX)} ${round2(noseY)}Z`
  );
})();

/* -------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

type Mode = "idle" | "charge" | "spin" | "coast" | "drag";
type Phase = "idle" | "spinning" | "won";
type CopyState = "idle" | "copied" | "failed";
type Hint = "hint" | "weak";

type Span = { start: number; end: number };

type Geometry = {
  /** Normalized chance per segment, straight from the weights. */
  odds: number[];
  /** Arc bounds in radians, clockwise from the top. */
  arcs: Span[];
  /** Peg angles: one peg sits on every divider at r=170. */
  pegs: number[];
};

/** Mutable animation state. Every frame reads and writes this object, never React state, so a spin
 *  costs zero renders until it lands. */
type Anim = {
  theta: number;
  omega: number;
  mode: Mode;
  lastDir: number;
  phi: number;
  phiV: number;
  spinT: number;
  spinDur: number;
  spinFrom: number;
  spinDist: number;
  spinDir: number;
  spinRamp: number;
  winner: number;
  charge: number;
  chargeBase: number;
  grabTheta: number;
  grabAngle: number;
  grabAcc: number;
  samples: { t: number; theta: number }[];
  frame: number;
  last: number;
  visible: boolean;
  cache: Map<Element, Record<string, string>>;
};

/** Snapshot of everything the loop reads from props and derived state, refreshed every render. */
type Params = {
  segments: PrizeWheelSegment[];
  geometry: Geometry;
  pickWinner: PrizeWheelProps["pickWinner"];
  onResult: PrizeWheelProps["onResult"];
  once: boolean;
  speed: number;
  paused: boolean;
  reduced: boolean;
  phase: Phase;
  labels: Required<PrizeWheelLabels>;
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

/**
 * The idle loop runs for as long as the wheel is visible, not reduced and not paused, so the demo
 * is never quite still. `mode` has to be idle too: a spin or a drag already owns the loop.
 */
const drifts = (params: Params, mode: Mode) =>
  !params.reduced && !params.paused && params.speed > 0 && params.phase === "idle" && mode === "idle";

/** Capsule-to-peg contact: half the angular width the pointer is blocked across when a peg is
 *  `radius` away from the pivot. Pegs outside 26.1 units of reach are behind the pointer's tip. */
function contactHalfAngle(radius: number): number {
  if (radius <= 21) {
    const cap = 10.1 - (radius / 21) * 5;
    return radius > cap ? Math.asin(cap / radius) : Math.PI / 2;
  }
  if (radius >= 26.1) return 0;
  return Math.acos(clamp((radius * radius + 441 - 26.01) / (2 * radius * 21), -1, 1));
}

/** Copy to the clipboard, falling back to the old selection trick when the async API is missing
 *  or blocked. Throws when neither path works so the card can show Copy failed. */
async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    /* fall through to the selection path */
  }

  const active = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i)) : [];
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  field.remove();
  if (selection) {
    selection.removeAllRanges();
    ranges.forEach((range) => selection.addRange(range));
  }
  active?.focus?.({ preventScroll: true });
  if (!copied) throw new Error("Copy failed");
}

/** Wedge outline: the two radii and the rim arc, with the large-arc flag for slices past 180°. */
function wedgePath(start: number, end: number) {
  const [x1, y1] = pointOn(start, 162);
  const [x2, y2] = pointOn(end, 162);
  const large = +(end - start > Math.PI);
  return `M200 200L${round2(x1)} ${round2(y1)}A162 162 0 ${large} 1 ${round2(x2)} ${round2(y2)}Z`;
}

/**
 * The copy button stacks its three faces in one grid cell and animates the visible one, so the
 * button keeps a fixed width while the label changes. Measuring the faces once (and on resize)
 * gives that width without hard-coding word lengths.
 */
function CopyStack({ shown, children }: { shown: number; children: ReactNode }) {
  const stackRef = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);

  useLayoutEffect(() => {
    const faces = Array.from(stackRef.current?.children ?? []);
    const measure = () => setWidths(faces.map((face) => (face as HTMLElement).offsetWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    faces.forEach((face) => observer.observe(face));
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={stackRef} className={styles.copyStack} style={widths[shown] ? { width: widths[shown] } : undefined}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * PrizeWheel
 * ---------------------------------------------------------------------------------------------- */

/**
 * A promo or referral prize wheel with real momentum. Flick the wheel and it keeps the angular
 * velocity you gave it, or hold the metal Spin hub to wind the wheel back while an accent ring
 * fills, then let go to throw it. A flexible pointer bends against every peg and snaps back with
 * a small wobble, the wheel slows into a long, suspenseful settle, and it lands on a segment drawn
 * by weight. The won segment fills with the accent and lifts into a reward card with a copyable
 * code, while the odds list beside the wheel shows every prize with its chance.
 *
 * All motion runs through one rAF loop that writes `transform` and `stroke-dashoffset` straight to
 * the DOM: React state only changes when a spin starts, lands, or the copy button reports back.
 */
export function PrizeWheel({
  segments: segmentProp,
  title = "Spin for a reward",
  description = "Every spin wins something. Your code works at checkout.",
  labels: labelProp,
  pickWinner,
  onResult,
  once = false,
  sizing = "equal",
  showOdds = true,
  speed = 1,
  paused = false,
  accent,
  label = "Prize wheel",
  className,
  style,
}: PrizeWheelProps) {
  // Hydration-safe mounted flag: reduced motion is only trusted once the DOM owns the tree, so the
  // server and the first client render agree.
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && mounted;
  const uid = useId().replace(/:/g, "");

  const segments = useMemo(() => {
    const list = (segmentProp ?? DEFAULT_SEGMENTS).slice(0, 12);
    return list.length >= 2 ? list : DEFAULT_SEGMENTS;
  }, [segmentProp]);

  const labels = { ...DEFAULT_LABELS, ...labelProp };

  /** Slice geometry. Equal sizing splits the circle evenly; weight sizing makes each slice
   *  proportional to its chance but keeps a floor of 1.2% so a rare prize stays clickable. */
  const geometry = useMemo<Geometry>(() => {
    const weights = segments.map((segment) => Math.max(0, segment.weight ?? 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const odds = weights.map((weight) => weight / total);
    const fractions = segments.map((_, index) =>
      sizing === "weight" ? Math.max(odds[index], 0.012) : 1 / segments.length,
    );
    const starts = fractions.map((_, index) => fractions.slice(0, index).reduce((sum, part) => sum + part, 0));
    const spans = fractions.map((fraction, index) => ({ start: starts[index], end: starts[index] + fraction }));
    const scale = TAU / fractions.reduce((sum, part) => sum + part, 0);
    const arcs = spans.map((span) => ({ start: span.start * scale, end: span.end * scale }));
    return { odds, arcs, pegs: arcs.map((arc) => arc.start) };
  }, [segments, sizing]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [won, setWon] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<number | null>(null);
  const [reveal, setReveal] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [hint, setHint] = useState<Hint>("hint");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /** Last pointer press on the hub, so the click that follows a pointer release does not spin twice. */
  const releaseAt = useRef(-1e9);
  const stageBox = useRef<DOMRect | null>(null);
  const flight = useRef<{ stop: () => void } | null>(null);

  const anim = useRef<Anim>({
    theta: 0,
    omega: 0,
    mode: "idle",
    lastDir: 1,
    phi: 0,
    phiV: 0,
    spinT: 0,
    spinDur: 1,
    spinFrom: 0,
    spinDist: 0,
    spinDir: 1,
    spinRamp: 0,
    winner: 0,
    charge: 0,
    chargeBase: 0,
    grabTheta: 0,
    grabAngle: 0,
    grabAcc: 0,
    samples: [],
    frame: 0,
    last: 0,
    visible: true,
    cache: new Map<Element, Record<string, string>>(),
  });

  const params = useRef<Params>({
    segments,
    geometry,
    pickWinner,
    onResult,
    once,
    speed,
    paused,
    reduced,
    phase,
    labels,
  });

  useLayoutEffect(() => {
    params.current = { segments, geometry, pickWinner, onResult, once, speed, paused, reduced, phase, labels };
  });

  /**
   * Write once: the loop runs at 60fps and most frames only move three values, so a per-element
   * cache keeps the DOM out of the hot path. `css:` names set a style property, anything else is
   * an attribute; custom properties start with `--` as usual.
   */
  const write = useCallback((el: Element | null | undefined, name: string, value: string) => {
    if (!el) return;
    const cache = anim.current.cache;
    let entry = cache.get(el);
    if (!entry) {
      entry = {};
      cache.set(el, entry);
    }
    if (entry[name] === value) return;
    entry[name] = value;
    if (name.startsWith("css:")) (el as HTMLElement | SVGElement).style.setProperty(name.slice(4), value);
    else if (name.startsWith("--")) (el as HTMLElement).style.setProperty(name, value);
    else el.setAttribute(name, value);
  }, []);

  /** Paint the three animated nodes: wheel angle, pointer flap angle, hub charge ring. */
  const paint = useCallback(() => {
    const state = anim.current;
    const degrees = Math.round(((180 * state.theta) / Math.PI) * 1e3) / 1e3;
    write(rotorRef.current, "css:transform", `rotate(${degrees}deg)`);

    const flap = Math.round(((180 * state.phi) / Math.PI) * 100) / 100;
    write(flapRef.current, "css:transform", `rotate(${flap}deg)`);

    // pathLength=1 makes the ring a fraction: full at 1, empty at 0 while charging.
    const ring = state.mode === "charge" ? Math.round((1 - state.charge) * 1e3) / 1e3 : 1;
    write(ringRef.current, "css:stroke-dashoffset", String(ring));
  }, [write]);

  /** Announce the landing once the wheel stops: prize name, then the code spelled out. */
  const land = useCallback((index: number) => {
    const { segments: list, onResult: report } = params.current;
    const segment = list[index];
    setPhase("won");
    setWon(index);
    setLastWon(index);
    setReveal((count) => count + 1);
    setCopyState("idle");
    setAnnouncement(
      `You won ${segment.label}.${segment.code ? ` Your code is ${segment.code.split("").join(" ")}.` : ""}`,
    );
    report?.(segment, index);
  }, []);

  /**
   * One physics step. Rotation is integrated per mode; the pointer flap is a stiff, lightly damped
   * spring run in substeps small enough that no peg can be tunnelled through, and every peg within
   * reach pushes the flap out to its contact half-angle before the velocity is rebuilt.
   */
  const advance = useCallback(
    (dt: number) => {
      const state = anim.current;
      const current = params.current;
      const previousTheta = state.theta;

      switch (state.mode) {
        case "idle": {
          if (drifts(current, state.mode)) state.theta += DRIFT * current.speed * dt;
          break;
        }
        case "charge": {
          // Wind-up: the ring fills over ~1.1s while the wheel eases back a quarter radian.
          state.charge = Math.min(1, state.charge + dt / CHARGE_TIME);
          const eased = state.charge * state.charge * (3 - 2 * state.charge);
          state.theta = state.chargeBase - CHARGE_BACK * eased;
          break;
        }
        case "spin": {
          state.spinT += dt;
          const ramp = state.spinRamp;
          // The ramp subtracts the first moments of a first-order response from the clock, so the
          // wheel eases into full speed instead of snapping to it. A flick passes 0 and uses raw time.
          const progress = Math.min(
            1,
            (ramp > 0 ? state.spinT - ramp * (1 - Math.exp(-state.spinT / ramp)) : state.spinT) / state.spinDur,
          );
          // Cubic ease-out: 1 - (1 - t)^3, the deceleration the settle is tuned around.
          state.theta = state.spinFrom + state.spinDir * state.spinDist * (1 - Math.pow(1 - progress, 3));
          if (progress >= 1) {
            state.mode = "idle";
            land(state.winner);
          }
          break;
        }
        case "coast": {
          // A weak flick keeps whatever is left of it and bleeds off exponentially.
          state.omega *= Math.exp(-1.9 * dt);
          state.theta += state.omega * dt;
          if (Math.abs(state.omega) < 0.05) state.mode = "idle";
          break;
        }
        default:
          break;
      }

      if (state.mode !== "drag") {
        state.omega = dt > 0 ? (state.theta - previousTheta) / dt : 0;
        if (Math.abs(state.omega) > 1e-4) state.lastDir = Math.sign(state.omega);
      }

      if (current.reduced) {
        state.phi = 0;
        state.phiV = 0;
        return;
      }

      const pegs = current.geometry.pegs;
      const travelled = state.theta - previousTheta;
      const steps = clamp(Math.ceil((170 * Math.abs(travelled)) / 1.5), 4, 40);
      const step = dt / steps;

      for (let index = 1; index <= steps; index += 1) {
        const at = previousTheta + (travelled * index) / steps;
        const phiBefore = state.phi;
        state.phiV += (-SPRING * state.phi - DAMPING * state.phiV) * step;
        state.phi += state.phiV * step;

        let hit = false;
        for (const peg of pegs) {
          const angle = peg + at;
          const y = 200 - 170 * Math.cos(angle) - 7;
          if (y > 26.1) continue;
          const x = 170 * Math.sin(angle);
          const half = contactHalfAngle(Math.hypot(x, y));
          if (!half) continue;
          const contact = Math.atan2(-x, y);
          const delta = state.phi - contact;
          if (Math.abs(delta) >= half) continue;
          // Bend the flap to the edge of contact on the side it came from, so it visibly rides the
          // peg and then snaps back once the peg has passed.
          const side = delta > 0 ? 1 : delta < 0 ? -1 : -state.lastDir;
          state.phi = contact + side * half;
          hit = true;
        }

        if (hit && step > 0) state.phiV = clamp((state.phi - phiBefore) / step, -9, 9);
        if (Math.abs(state.phi) > SPRING_LIMIT) {
          state.phi = SPRING_LIMIT * Math.sign(state.phi);
          if (state.phiV * state.phi > 0) state.phiV *= -0.25;
        }
      }
    },
    [land],
  );

  /* The frame body is rebuilt every render so it always closes over the newest callbacks, while the
     loop itself is started and cancelled by the effects below. */
  const tickRef = useRef<(now: number) => void>(() => undefined);

  useLayoutEffect(() => {
    tickRef.current = (now) => {
      const state = anim.current;
      const dt = state.last ? Math.min(0.034, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      advance(dt);
      paint();
      const alive =
        (state.mode !== "idle" ||
          drifts(params.current, state.mode) ||
          Math.abs(state.phi) > 0.002 ||
          Math.abs(state.phiV) > 0.01) &&
        state.visible;
      if (alive) {
        state.frame = requestAnimationFrame((next) => tickRef.current(next));
      } else {
        state.frame = 0;
        state.last = 0;
      }
    };
  });

  const start = useCallback(() => {
    const state = anim.current;
    if (state.frame || !state.visible) return;
    state.last = 0;
    state.frame = requestAnimationFrame((now) => tickRef.current(now));
  }, []);

  /** Pause offscreen and in background tabs; resume straight away when the wheel is back. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let onscreen = true;

    const sync = () => {
      const state = anim.current;
      state.visible = onscreen && document.visibilityState === "visible";
      if (state.visible) start();
      else if (state.frame) {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
        state.last = 0;
      }
    };

    const observer = new IntersectionObserver((entries) => {
      onscreen = entries.some((entry) => entry.isIntersecting);
      sync();
    });

    observer.observe(root);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      const state = anim.current;
      if (state.frame) cancelAnimationFrame(state.frame);
      state.frame = 0;
    };
  }, [start]);

  // Prop changes that alter the gate (drift paused, speed, reduced motion, phase) restart the loop.
  useEffect(() => {
    start();
  }, [start, paused, speed, reduced, phase]);

  /**
   * Start a spin. `velocity` is radians per second (a flick passes what the pointer measured, the
   * hub passes 9 + 19 * charge); `ramp` is the spin-up constant, 0 for a flick.
   *
   * The landing angle is solved backwards: place the pointer inside the winning wedge with a margin
   * at both edges, then add whole turns until the decayed distance has at least two turns of travel.
   */
  const spin = useCallback(
    (velocity: number, ramp = SPIN_RAMP) => {
      const current = params.current;
      const state = anim.current;
      if (current.once && current.phase === "won") return;

      const count = current.segments.length;
      let winner = 0;
      if (current.pickWinner) {
        const picked = Math.round(current.pickWinner(current.segments));
        winner = Number.isFinite(picked) ? clamp(picked, 0, count - 1) : 0;
      } else {
        // Weighted draw: walk the cumulative odds and take the first bucket that crosses zero.
        let ticket = Math.random();
        winner = count - 1;
        for (let index = 0; index < count; index += 1) {
          if ((ticket -= current.geometry.odds[index]) <= 0) {
            winner = index;
            break;
          }
        }
      }

      const arc = current.geometry.arcs[winner];
      const length = arc.end - arc.start;
      const margin = Math.min(0.42 * length, Math.max(0.12 * length, 0.07));
      const target = arc.start + margin + Math.random() * Math.max(0, length - 2 * margin);
      const strength = clamp(Math.abs(velocity), 4.5, 28);
      const direction = velocity < 0 ? -1 : 1;
      // Distance from the current angle to the target, in the spin direction, plus whole turns.
      const offset = (((direction * (-target - state.theta)) % TAU) + TAU) % TAU;
      const seconds = clamp(3.8 + 0.12 * strength, 4.2, 7.2);
      const laps = Math.max(2, Math.round(((strength * seconds) / 3 - offset) / TAU));
      const distance = offset + laps * TAU;

      setPhase("spinning");
      setWon(null);
      setHint("hint");
      setAnnouncement("Spinning");

      if (current.reduced) {
        // Reduced motion: no tumble. Jump to the result and reveal it immediately.
        state.theta += direction * distance;
        state.mode = "idle";
        paint();
        land(winner);
        return;
      }

      state.mode = "spin";
      state.winner = winner;
      state.spinT = 0;
      state.spinFrom = state.theta;
      state.spinDist = distance;
      state.spinDir = direction;
      state.spinRamp = ramp;
      state.spinDur = clamp((3 * distance) / strength, 3.2, 10);
      start();
    },
    [start, land, paint],
  );

  /** Pointer down on the hub: wind the wheel back. A finished wheel starts over from idle. */
  const beginCharge = () => {
    const state = anim.current;
    if (phase === "spinning" || (once && phase === "won") || state.mode === "spin" || state.mode === "charge") return;
    if (phase === "won") {
      setPhase("idle");
      setWon(null);
    }
    state.mode = "charge";
    state.charge = 0;
    state.chargeBase = state.theta;
    start();
  };

  /** Release the hub: remember when, so the click that follows is ignored, then throw. */
  const endCharge = () => {
    const state = anim.current;
    if (state.mode !== "charge") return;
    releaseAt.current = performance.now();
    const charge = state.charge;
    state.mode = "idle";
    spin(9 + 19 * charge);
  };

  /** A cancelled press (pointercancel, blur) must not throw the wheel; let it coast out instead. */
  const abortCharge = () => {
    const state = anim.current;
    if (state.mode !== "charge") return;
    state.mode = "coast";
    state.omega = 0.8;
    start();
  };

  /** Angle of a point around the wheel centre, or null inside the dead zone at the middle. */
  const angleAt = (clientX: number, clientY: number) => {
    const box = stageBox.current;
    if (!box) return null;
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    const dx = clientX - centreX;
    const dy = clientY - centreY;
    if (Math.hypot(dx, dy) < 0.1 * box.width) return null;
    return Math.atan2(dx, -dy);
  };

  const onGripDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = anim.current;
    if (event.button !== 0 || phase === "spinning" || (once && phase === "won") || state.mode === "spin") return;
    stageBox.current = stageRef.current?.getBoundingClientRect() ?? null;
    const angle = angleAt(event.clientX, event.clientY);
    if (angle === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (phase === "won") {
      setPhase("idle");
      setWon(null);
    }
    state.mode = "drag";
    state.omega = 0;
    state.grabTheta = state.theta;
    state.grabAngle = angle;
    state.grabAcc = 0;
    state.samples = [{ t: event.timeStamp, theta: state.theta }];
    start();
  };

  const onGripMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = anim.current;
    if (state.mode !== "drag") return;
    const angle = angleAt(event.clientX, event.clientY);
    if (angle === null) return;

    // Shortest signed step between the two pointer angles, so crossing the seam does not jump.
    let step = (angle - state.grabAngle + Math.PI) % TAU;
    if (step < 0) step += TAU;
    state.grabAcc += step - Math.PI;
    state.grabAngle = angle;
    state.theta = state.grabTheta + state.grabAcc;

    // Release velocity comes from the last 100ms of samples only, so a pause before letting go
    // counts as a slow flick rather than the speed reached mid-drag.
    const now = event.timeStamp;
    state.samples.push({ t: now, theta: state.theta });
    while (state.samples.length > 2 && now - state.samples[0].t > 100) state.samples.shift();
    const first = state.samples[0];
    state.omega = now > first.t ? ((state.theta - first.theta) / (now - first.t)) * 1000 : 0;
    start();
  };

  const onGripUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = anim.current;
    if (state.mode !== "drag") return;
    const last = state.samples[state.samples.length - 1];
    const velocity = last && event.timeStamp - last.t < 80 ? state.omega : 0;
    if (Math.abs(velocity) >= 4.5) {
      state.mode = "idle";
      spin(clamp(velocity, -28, 28), 0);
      return;
    }
    state.mode = "coast";
    state.omega = velocity;
    if (Math.abs(state.theta - state.grabTheta) > 0.35) setHint("weak");
    start();
  };

  /**
   * Reward card flight: the card lifts out of the drawn segment under the pointer (the wheel is
   * drawn from the top, and the winning wedge's centre sits at 25.7% of the stage height) and
   * springs into the slot, growing from 18% and fading in.
   */
  useLayoutEffect(() => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!reveal || !card || !stage) return;
    const reset = () => {
      card.style.transform = "";
      card.style.opacity = "";
    };
    reset();
    if (reduced) return;

    const stageBox = stage.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const fromX = stageBox.left + stageBox.width / 2 - (cardBox.left + cardBox.width / 2);
    const fromY = stageBox.top + 0.257 * stageBox.height - (cardBox.top + cardBox.height / 2);

    const animation = animate(
      card,
      { x: [fromX, 0], y: [fromY, 0], scale: [0.18, 1], opacity: [0, 1] },
      { type: "spring", visualDuration: 0.62, bounce: 0.14 },
    );
    flight.current = animation;
    animation.then(reset, reset);
    return () => {
      animation.stop();
      reset();
      if (flight.current === animation) flight.current = null;
    };
  }, [reveal, reduced]);

  // Dropping the winner (a fresh spin, a drag) clears the card back to the slot baseline.
  useLayoutEffect(() => {
    if (won !== null || !flight.current) return;
    flight.current.stop();
    flight.current = null;
    if (cardRef.current) {
      cardRef.current.style.transform = "";
      cardRef.current.style.opacity = "";
    }
  }, [won]);

  const copyCode = async (code: string) => {
    try {
      await copyText(code);
      setCopyState("copied");
      setAnnouncement("Code copied");
    } catch {
      setCopyState("failed");
      setAnnouncement("Copy failed. Select the code and copy it manually.");
    }
  };

  // The copy label returns to idle on its own; the timer is the only reason this state clears.
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const locked = once && phase === "won";
  const spinning = phase === "spinning";
  const cardSegment = won !== null ? segments[won] : null;
  const shownSegment = cardSegment ?? segments[lastWon ?? 0] ?? segments[0];
  const wheelLabel = `${label}. ${segments.length} prizes: ${segments
    .map((segment, index) => `${segment.label}, ${percent(geometry.odds[index])} chance`)
    .join("; ")}.`;
  const rootStyle = {
    ...style,
    ...(accent ? { "--pw-accent": accent } : null),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-phase={phase}
      role="group"
      aria-label={label}
    >
      <div className={styles.layout}>
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.shadow} aria-hidden="true" />

          {/* The wheel itself is one draggable image: the pointer angle is measured around its centre. */}
          <div
            className={styles.grip}
            data-locked={locked || spinning || undefined}
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            role="img"
            aria-label={wheelLabel}
          >
            <div ref={rotorRef} className={styles.rotor}>
              <svg viewBox="0 0 400 400" className={styles.svg} aria-hidden="true">
                {segments.map((segment, index) => {
                  const arc = geometry.arcs[index];
                  const middle = (180 * ((arc.start + arc.end) / 2)) / Math.PI;
                  const span = arc.end - arc.start;
                  return (
                    <g
                      className={styles.wedge}
                      data-alt={index % 2 === 1 || undefined}
                      data-featured={segment.featured || undefined}
                      data-won={won === index || undefined}
                      key={segment.id ?? `${segment.label}-${index}`}
                    >
                      <path d={wedgePath(arc.start, arc.end)} />
                      {span > 0.2 && (
                        <text
                          x={200}
                          y={52}
                          transform={`rotate(${round2(middle)} 200 200) rotate(-90 200 52)`}
                          textAnchor="end"
                          dominantBaseline="central"
                        >
                          {segment.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {geometry.pegs.map((angle, index) => {
                  const [x, y] = pointOn(angle, 162);
                  return (
                    <line
                      className={styles.divider}
                      x1={200}
                      y1={200}
                      x2={round2(x)}
                      y2={round2(y)}
                      key={`d${index}`}
                    />
                  );
                })}
                <circle className={styles.faceEdge} cx={200} cy={200} r={162} />
                <circle className={styles.rim} cx={200} cy={200} r={170} strokeWidth={16} />
                <circle className={styles.rimEdge} cx={200} cy={200} r={177.5} />
                {geometry.pegs.map((angle, index) => {
                  const [x, y] = pointOn(angle, 170);
                  return (
                    <g className={styles.peg} key={`p${index}`}>
                      <circle cx={round2(x)} cy={round2(y)} r={3.6} />
                      <circle className={styles.pegShine} cx={round2(x - 0.9)} cy={round2(y - 0.9)} r={1.2} />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Static sheen above the wheel, and the pointer flap that the loop rotates. */}
          <svg viewBox="0 0 400 400" className={styles.overlay} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-sheen`} x1="0.15" y1="0" x2="0.85" y2="1">
                <stop offset="0" className={styles.sheenHi} />
                <stop offset="0.45" className={styles.sheenLo} />
                <stop offset="1" className={styles.sheenMid} />
              </linearGradient>
            </defs>
            <circle cx={200} cy={200} r={170} fill="none" stroke={`url(#${uid}-sheen)`} strokeWidth={16} />
            <g ref={flapRef} className={styles.flap}>
              <path className={styles.pointer} d={POINTER_PATH} />
              <circle className={styles.pivot} cx={200} cy={7} r={2.6} />
            </g>
          </svg>

          <button
            type="button"
            className={styles.hub}
            aria-disabled={spinning || locked || undefined}
            aria-describedby={`${uid}-hint`}
            aria-label={locked ? labels.done : spinning ? "Spinning" : "Spin the wheel"}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              beginCharge();
            }}
            onPointerUp={endCharge}
            onPointerCancel={abortCharge}
            onLostPointerCapture={endCharge}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (!event.repeat) beginCharge();
            }}
            onKeyUp={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              endCharge();
            }}
            onBlur={abortCharge}
            onClick={() => {
              // A press already threw the wheel on release; ignore the click that follows it.
              if (performance.now() - releaseAt.current < 500) return;
              if (spinning || locked || anim.current.mode === "spin") return;
              spin(16);
            }}
          >
            <svg viewBox="0 0 100 100" className={styles.hubRing} aria-hidden="true">
              <circle ref={ringRef} cx="50" cy="50" r="46" pathLength={1} />
            </svg>
            <span className={styles.hubLabel}>{locked ? labels.done : labels.spin}</span>
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.slot}>
            {/* One hidden copy of every card keeps the slot at the tallest card's height, so the
                reveal never reflows the page. */}
            {segments.map((segment, index) => (
              <div
                className={`${styles.card} ${styles.sizer}`}
                aria-hidden="true"
                inert
                key={`s-${segment.id ?? `${segment.label}-${index}`}`}
              >
                <p className={styles.cardPrize}>{segment.label}</p>
                {segment.detail && <p className={styles.cardDetail}>{segment.detail}</p>}
                {segment.code && (
                  <div className={styles.code}>
                    <span className={styles.codeText}>{segment.code}</span>
                    <span className={styles.copy}>
                      <span className={styles.copyFace} data-on>
                        <Copy size={16} strokeWidth={1.75} />
                        {labels.copy}
                      </span>
                    </span>
                  </div>
                )}
                {!once && (
                  <span className={styles.again}>
                    <RotateCw size={16} strokeWidth={1.75} />
                    {labels.again}
                  </span>
                )}
              </div>
            ))}

            <div className={styles.idle} data-hidden={!!cardSegment || undefined} aria-hidden={!!cardSegment || undefined}>
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.description}>{description}</p>
              <p id={`${uid}-hint`} className={styles.hint} data-weak={hint === "weak" || undefined}>
                {hint === "weak" ? labels.weak : labels.hint}
              </p>
            </div>

            <div
              ref={cardRef}
              className={styles.card}
              data-show={!!cardSegment || undefined}
              aria-hidden={!cardSegment || undefined}
              inert={!cardSegment}
            >
              <p className={styles.cardPrize}>{shownSegment.label}</p>
              {shownSegment.detail && <p className={styles.cardDetail}>{shownSegment.detail}</p>}
              {shownSegment.code && (
                <div className={styles.code}>
                  <span className={styles.codeText}>{shownSegment.code}</span>
                  <button
                    type="button"
                    className={styles.copy}
                    data-state={copyState}
                    onClick={() => copyCode(shownSegment.code ?? "")}
                    aria-label={
                      copyState === "copied" ? labels.copied : copyState === "failed" ? labels.copyFailed : `${labels.copy} ${shownSegment.code}`
                    }
                  >
                    <CopyStack shown={copyState === "copied" ? 1 : 2 * Number(copyState === "failed")}>
                      <span className={styles.copyFace} data-on={copyState === "idle" || undefined}>
                        <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                        {labels.copy}
                      </span>
                      <span className={styles.copyFace} data-on={copyState === "copied" || undefined}>
                        <svg
                          width={16}
                          height={16}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.75}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={styles.copyCheck}
                          aria-hidden="true"
                        >
                          <path d="M4 12l5 5L20 6" pathLength={1} />
                        </svg>
                        {labels.copied}
                      </span>
                      <span className={styles.copyFace} data-on={copyState === "failed" || undefined}>
                        <X size={16} strokeWidth={1.75} aria-hidden="true" />
                        {labels.copyFailed}
                      </span>
                    </CopyStack>
                  </button>
                </div>
              )}
              {!once && (
                <button
                  type="button"
                  className={styles.again}
                  onClick={() => {
                    if (once) return;
                    // Spin again throws a little harder than a plain click, so it never feels the same.
                    spin(14 + 8 * Math.random());
                  }}
                >
                  <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
                  {labels.again}
                </button>
              )}
            </div>
          </div>

          {showOdds && (
            <div className={styles.odds}>
              <p className={styles.oddsTitle}>{labels.odds}</p>
              <ul className={styles.oddsList}>
                {segments.map((segment, index) => (
                  <li
                    className={styles.oddsRow}
                    data-featured={segment.featured || undefined}
                    data-won={won === index || undefined}
                    key={segment.id ?? `${segment.label}-${index}`}
                  >
                    <span className={styles.oddsLabel}>{segment.label}</span>
                    <span className={styles.oddsValue}>{percent(geometry.odds[index])}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default PrizeWheel;
