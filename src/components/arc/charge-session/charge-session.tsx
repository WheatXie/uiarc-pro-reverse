"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { BatteryFull, RotateCcw, Square, Zap } from "lucide-react";
import styles from "./charge-session.module.css";

export type ChargeSessionPhase = "charging" | "stopped" | "complete";

export interface ChargeSessionSummary {
  /** Charge level as a percentage, one decimal. */
  charge: number;
  /** kWh added since the session started. */
  energy: number;
  cost: number;
  limit: number;
}

export interface ChargeSessionProps {
  title?: string;
  location?: string;
  /** Pack capacity in kWh. */
  capacity?: number;
  /** Peak power in kW. */
  maxPower?: number;
  /** Starting state of charge, in percent. */
  startCharge?: number;
  defaultLimit?: number;
  minLimit?: number;
  /** State of charge, in percent, where the taper starts. */
  taperAt?: number;
  /** Price per kWh. */
  rate?: number;
  currency?: string;
  locale?: string;
  /** Charge speed multiplier. */
  speed?: number;
  paused?: boolean;
  accent?: string;
  onStateChange?: (phase: ChargeSessionPhase, summary: ChargeSessionSummary) => void;
  onLimitChange?: (limit: number) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const CABLE = "M 84 176 C 140 238 168 120 212 120";
/** The nub sticks out this far past the charger body before the cable starts. */
const NUB_GAP = 32;
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

const PHASE_LABEL: Record<ChargeSessionPhase, string> = {
  charging: "Charging",
  stopped: "Stopped",
  complete: "Charged to limit",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Fraction of peak power the charger can deliver at a given state of charge. */
function powerAt(soc: number, taper: number) {
  if (soc < 0.1) return 0.62 + 0.38 * smooth(soc / 0.1);
  if (soc <= taper) return 1;
  return 0.06 + 0.94 * Math.exp(-3.2 * Math.pow((soc - taper) / Math.max(0.01, 1 - taper), 1.4));
}

/** Minutes to go from `soc` to `target`, integrated in 48 steps. */
function minutesTo(soc: number, target: number, capacity: number, maxPower: number, taper: number) {
  if (target <= soc) return 0;
  const step = (target - soc) / 48;
  let hours = 0;
  for (let index = 0; index < 48; index++) hours += step / powerAt(soc + step * (index + 0.5), taper);
  return (hours * capacity * 3600) / maxPower;
}

function formatDuration(minutes: number) {
  const value = minutes / 60;
  if (value < 1) return "Under 1 min";
  if (value < 59.5) return `${Math.round(value)} min`;
  const rounded = Math.round(value);
  return `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, "0")} min`;
}

function spokenDuration(minutes: number) {
  const value = Math.round(minutes / 60);
  if (value < 1) return "under a minute";
  if (value < 60) return `about ${value} minute${value === 1 ? "" : "s"}`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `about ${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} minute${rest === 1 ? "" : "s"}` : ""}`;
}

/** Point on the charging cable's cubic bezier. */
const cablePoint = (t: number): [number, number] => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [84 * a + 140 * b + 168 * c + 212 * d, 176 * a + 238 * b + 120 * c + 120 * d];
};

/** Arc-length table for the cable, so packets travel at a constant speed. */
const CABLE_ARC = (() => {
  const lengths = [0];
  let [prevX, prevY] = cablePoint(0);
  let total = 0;
  for (let index = 1; index <= 64; index++) {
    const [x, y] = cablePoint(index / 64);
    total += Math.hypot(x - prevX, y - prevY);
    lengths.push(total);
    prevX = x;
    prevY = y;
  }
  return { count: 64, lengths, total };
})();

function pointAlongCable(distance: number): [number, number] {
  const { count, lengths, total } = CABLE_ARC;
  if (distance <= 0) return cablePoint(0);
  if (distance < total) {
    let low = 0;
    let high = count;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] < distance) low = mid;
      else high = mid;
    }
    const mix = (low + (distance - lengths[low]) / (lengths[high] - lengths[low])) / count;
    return cablePoint(mix);
  }
  return [212 + (distance - total), 120];
}

const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const readReduced = () => window.matchMedia(REDUCE_QUERY).matches;
const readReducedOnServer = () => false;

type Animatable = Element & { style: CSSStyleDeclaration };

/** Write-once DOM cache: every frame touches the same nodes, so skip identical values. */
const writeCache = new WeakMap<Element, Record<string, string>>();

function write(element: Element | null, property: string, value: string) {
  if (!element) return;
  let seen = writeCache.get(element);
  if (!seen) {
    seen = {};
    writeCache.set(element, seen);
  }
  if (seen[property] === value) return;
  seen[property] = value;
  if (property === "text") element.textContent = value;
  else if (property.startsWith("--") || property === "transform" || property === "opacity")
    (element as Animatable).style.setProperty(property, value);
  else element.setAttribute(property, value);
}

const PACKETS = 18;

export function ChargeSession({
  title = "Fast charger 4",
  location = "Harbor Street hub, 150 kW",
  capacity = 77,
  maxPower = 150,
  startCharge = 34,
  defaultLimit = 80,
  minLimit = 50,
  taperAt = 50,
  rate = 0.42,
  currency = "USD",
  locale = "en-US",
  speed = 1,
  paused = false,
  accent,
  onStateChange,
  onLimitChange,
  label,
  className,
  style,
}: ChargeSessionProps) {
  const uid = useId().replace(/:/g, "");
  const reduced = useSyncExternalStore(subscribeReduced, readReduced, readReducedOnServer);

  const start = clamp(startCharge, 0, 99) / 100;
  const taper = clamp(taperAt, 10, 95) / 100;
  const lowLimit = clamp(Math.round(minLimit), 1, 100);
  const initialLimit = clamp(Math.round(defaultLimit), lowLimit, 100);

  const [phase, setPhase] = useState<ChargeSessionPhase>(() =>
    100 * start >= initialLimit ? "complete" : "charging",
  );
  const [announcement, setAnnouncement] = useState("");

  const money = useMemo(() => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
  }, [locale, currency]);

  const config = useRef({
    capacity,
    maxPower,
    taper,
    rate,
    speed,
    paused,
    reduced,
    money,
    start,
    lowLimit,
    onStateChange,
    onLimitChange,
  });

  useEffect(() => {
    config.current = {
      capacity,
      maxPower,
      taper,
      rate,
      speed,
      paused,
      reduced,
      money,
      start,
      lowLimit,
      onStateChange,
      onLimitChange,
    };
  });

  const state = useRef({
    soc: start,
    limit: initialLimit,
    level: phase === "charging" ? 1 : 0,
    mode: phase,
    pos: new Float32Array(PACKETS),
    alive: new Uint8Array(PACKETS),
    emit: 0,
    pulse: 0,
    seeded: false,
    visible: true,
    running: false,
    frame: 0,
    announceTimer: 0,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const frontRef = useRef<SVGLineElement>(null);
  const beyondRef = useRef<SVGRectElement>(null);
  const limitLineRef = useRef<SVGLineElement>(null);
  const ledRef = useRef<SVGRectElement>(null);
  const coreRef = useRef<SVGPathElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const socRef = useRef<HTMLSpanElement>(null);
  const curveAtRef = useRef<HTMLSpanElement>(null);
  const powerRef = useRef<HTMLElement>(null);
  const energyRef = useRef<HTMLElement>(null);
  const costRef = useRef<HTMLElement>(null);
  const timeLabelRef = useRef<HTMLElement>(null);
  const timeValueRef = useRef<HTMLElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<SVGRectElement>(null);
  const beyondPlotRef = useRef<SVGRectElement>(null);
  const plotLimitRef = useRef<SVGLineElement>(null);
  const packetRefs = useRef<Array<SVGCircleElement | null>>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  const curve = useMemo(() => {
    let line = "";
    for (let index = 0; index <= 200; index++) {
      const soc = index / 200;
      const y = 288 - 244 * powerAt(soc, taper);
      line += `${index ? "L" : "M"} ${(1e3 * soc).toFixed(1)} ${y.toFixed(1)} `;
    }
    return { line: line.trim(), area: `${line}L 1000 288 L 0 288 Z` };
  }, [taper]);

  const summary = useCallback((): ChargeSessionSummary => {
    const current = state.current;
    const settings = config.current;
    const added = Math.max(0, (current.soc - settings.start) * settings.capacity);
    return {
      charge: Math.round(current.soc * 1e3) / 10,
      energy: Math.round(added * 100) / 100,
      cost: Math.round(added * settings.rate * 100) / 100,
      limit: current.limit,
    };
  }, []);

  const paint = useCallback(() => {
    const current = state.current;
    const settings = config.current;
    const soc = current.soc;
    const limit = current.limit / 100;
    const power = settings.maxPower * powerAt(soc, settings.taper) * current.level;
    const added = Math.max(0, (soc - settings.start) * settings.capacity);
    const fillX = 244 + 728 * soc;
    const limitX = 244 + 728 * limit;

    write(fillRef.current, "width", (728 * soc).toFixed(2));
    write(frontRef.current, "x1", fillX.toFixed(2));
    write(frontRef.current, "x2", fillX.toFixed(2));
    write(frontRef.current, "opacity", soc > 0.005 ? (0.5 + 0.4 * current.pulse).toFixed(3) : "0");
    write(beyondRef.current, "x", limitX.toFixed(2));
    write(beyondRef.current, "width", Math.max(0, 972 - limitX).toFixed(2));
    write(limitLineRef.current, "x1", limitX.toFixed(2));
    write(limitLineRef.current, "x2", limitX.toFixed(2));
    write(ledRef.current, "opacity", (0.18 + 0.82 * current.level).toFixed(3));
    write(coreRef.current, "opacity", (0.55 * current.level).toFixed(3));
    write(handleRef.current, "--x", `${((limitX / 1e3) * 100).toFixed(3)}`);
    write(pillRef.current, "text", `${current.limit}%`);
    write(socRef.current, "text", `${Math.floor(100 * soc + 1e-6)}%`);
    write(curveAtRef.current, "text", `${Math.round(power)} kW at ${Math.floor(100 * soc + 1e-6)}%`);
    write(powerRef.current, "text", `${Math.round(power)} kW`);
    write(energyRef.current, "text", `${added.toFixed(1)} kWh`);
    write(costRef.current, "text", settings.money.format(added * settings.rate));
    write(timeLabelRef.current, "text", `Time to ${current.limit}%`);

    const remaining = minutesTo(soc, limit, settings.capacity, settings.maxPower, settings.taper);
    write(
      timeValueRef.current,
      "text",
      current.mode === "complete" ? "Done" : current.mode === "stopped" ? "Paused" : formatDuration(remaining),
    );

    const reached = 1e3 * soc;
    write(doneRef.current, "x", (1e3 * settings.start).toFixed(2));
    write(doneRef.current, "width", Math.max(0, reached - 1e3 * settings.start).toFixed(2));
    write(beyondPlotRef.current, "x", (1e3 * limit).toFixed(2));
    write(beyondPlotRef.current, "width", ((1 - limit) * 1e3).toFixed(2));
    write(plotLimitRef.current, "x1", (1e3 * limit).toFixed(2));
    write(plotLimitRef.current, "x2", (1e3 * limit).toFixed(2));

    const dotY = 288 - powerAt(soc, settings.taper) * current.level * 244;
    write(dotRef.current, "--x", (100 * soc).toFixed(3));
    write(dotRef.current, "--y", ((dotY / 300) * 100).toFixed(3));

    const head = CABLE_ARC.total + NUB_GAP;
    const end = head + 728 * soc - 6;
    for (let index = 0; index < PACKETS; index++) {
      const node = packetRefs.current[index];
      if (!node) continue;
      if (!current.alive[index]) {
        write(node, "opacity", "0");
        continue;
      }
      const distance = current.pos[index];
      const [x, y] = pointAlongCable(distance);
      write(node, "cx", x.toFixed(2));
      write(node, "cy", y.toFixed(2));
      write(node, "data-in", distance > head - 6 ? "in" : "out");
      write(node, "opacity", (smooth(distance / 28) * smooth((end - distance) / 26)).toFixed(3));
      write(node, "r", (5.5 - smooth((distance - CABLE_ARC.total) / NUB_GAP)).toFixed(2));
    }
  }, []);

  const seedPackets = useCallback(() => {
    const current = state.current;
    const end = CABLE_ARC.total + NUB_GAP + 728 * current.soc - 10;
    for (let index = 0; index < PACKETS; index++) {
      const distance = end - 20 - 64 * index;
      current.alive[index] = +(distance > 0);
      current.pos[index] = Math.max(0, distance);
    }
    current.emit = 0;
    current.seeded = true;
  }, []);

  const enterPhase = useCallback(
    (next: ChargeSessionPhase, message?: string) => {
      const current = state.current;
      if (current.mode === next) return;
      current.mode = next;
      setPhase(next);
      if (message) setAnnouncement(message);
      config.current.onStateChange?.(next, summary());
    },
    [summary],
  );

  const tick = useCallback(
    (dt: number) => {
      const current = state.current;
      const settings = config.current;
      const target = +(current.mode === "charging");
      const response = target > current.level ? 2.6 : 4.2;
      current.level += (target - current.level) * (1 - Math.exp(-dt * response));
      if (Math.abs(target - current.level) < 0.002) current.level = target;

      if (current.level > 0 && settings.speed > 0) {
        const power = settings.maxPower * powerAt(current.soc, settings.taper) * current.level;
        const limit = current.limit / 100;
        current.soc = Math.min(
          Math.max(limit, current.soc),
          current.soc + (power * dt * settings.speed * 40) / (3600 * settings.capacity),
        );
        if (current.mode === "charging" && current.soc >= limit - 1e-6) {
          current.soc = limit;
          const done = summary();
          enterPhase(
            "complete",
            `Charged to ${current.limit}%. ${done.energy.toFixed(1)} kWh added for ${settings.money.format(done.cost)}.`,
          );
        }
      }

      current.pulse *= Math.exp(-(5 * dt));
      if (current.pulse < 0.002) current.pulse = 0;

      const end = CABLE_ARC.total + NUB_GAP + 728 * current.soc - 6;
      const pace =
        300 * (0.4 + 0.6 * current.level) * Math.max(0.35, Math.min(1.4, settings.speed));
      current.emit += (dt * current.level * pace) / 64;

      let busy = false;
      for (let index = 0; index < PACKETS; index++) {
        if (!current.alive[index]) continue;
        if (current.pos[index] >= end - 1.5) {
          current.alive[index] = 0;
          current.pulse = Math.min(1, current.pulse + 0.4);
          continue;
        }
        const slow = 0.72 + 0.28 * smooth((end - current.pos[index]) / 90);
        const near = 0.45 + 0.55 * smooth(current.pos[index] / 60);
        current.pos[index] = Math.min(end, current.pos[index] + pace * slow * near * dt);
        busy = true;
      }

      while (current.emit >= 1) {
        current.emit -= 1;
        if (current.level < 0.08) continue;
        const free = current.alive.indexOf(0);
        if (free < 0) break;
        current.alive[free] = 1;
        current.pos[free] = 0;
        busy = true;
      }

      return busy || current.level > 0 || current.pulse > 0 || current.mode === "charging";
    },
    [enterPhase, summary],
  );

  const runLoop = useCallback(() => {
    const current = state.current;
    const settings = config.current;
    if (settings.reduced || settings.paused) {
      cancelAnimationFrame(current.frame);
      current.running = false;
      if (settings.reduced) {
        current.level = +(current.mode === "charging");
        if (current.mode === "charging") seedPackets();
        else current.alive.fill(0);
      }
      paint();
      return;
    }
    if (!current.seeded && current.mode === "charging") seedPackets();
    if (current.running || !current.visible) {
      paint();
      return;
    }
    current.running = true;
    let previous = 0;
    const frame = (time: number) => {
      const dt = previous ? Math.min(0.05, (time - previous) / 1e3) : 1 / 60;
      previous = time;
      const busy = tick(dt);
      paint();
      if (current.visible && busy && !config.current.paused && !config.current.reduced)
        current.frame = requestAnimationFrame(frame);
      else current.running = false;
    };
    current.frame = requestAnimationFrame(frame);
  }, [paint, seedPackets, tick]);

  useEffect(() => {
    runLoop();
  }, [runLoop, reduced, paused, speed, phase, capacity, maxPower, taper, rate, money]);

  useEffect(() => {
    const current = state.current;
    const node = rootRef.current;
    if (!node) return;
    let onScreen = true;
    const sync = () => {
      const visible = onScreen && document.visibilityState === "visible";
      if (visible === current.visible) return;
      current.visible = visible;
      if (visible) runLoop();
      else {
        cancelAnimationFrame(current.frame);
        current.running = false;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(current.frame);
      current.running = false;
      if (current.announceTimer) clearTimeout(current.announceTimer);
    };
  }, [runLoop]);

  const applyLimit = useCallback(
    (value: number, announce: boolean) => {
      const current = state.current;
      const settings = config.current;
      const next = clamp(Math.round(value), settings.lowLimit, 100);
      const changed = next !== current.limit;
      current.limit = next;
      const share = next / 100;
      if (changed) {
        if (current.mode === "complete" && share > current.soc + 0.004) {
          enterPhase("charging", `Charging resumed to ${next}%.`);
        } else if (current.mode === "charging" && share <= current.soc) {
          const done = summary();
          enterPhase(
            "complete",
            `Charged to ${Math.floor(100 * current.soc)}%. ${done.energy.toFixed(1)} kWh added for ${settings.money.format(done.cost)}.`,
          );
        }
        const remaining = minutesTo(current.soc, share, settings.capacity, settings.maxPower, settings.taper);
        const text = `Charge limit ${next}%${share > current.soc ? `, ${spokenDuration(remaining)} to go` : ""}`;
        write(handleRef.current, "aria-valuenow", String(next));
        write(handleRef.current, "aria-valuetext", text);
        paint();
        runLoop();
      }
      if (announce) {
        if (current.announceTimer) clearTimeout(current.announceTimer);
        current.announceTimer = window.setTimeout(() => {
          const remaining = minutesTo(
            current.soc,
            current.limit / 100,
            settings.capacity,
            settings.maxPower,
            settings.taper,
          );
          setAnnouncement(
            `Charge limit ${current.limit}%.${current.limit / 100 > current.soc ? ` ${spokenDuration(remaining)} to go at full power.` : ""}`,
          );
          config.current.onLimitChange?.(current.limit);
        }, 350);
      }
    },
    [enterPhase, paint, runLoop, summary],
  );

  const drag = useRef<{ id: number; left: number; width: number; kind: "hero" | "plot" } | null>(null);

  const limitFromPointer = (clientX: number) => {
    const box = drag.current;
    if (!box) return state.current.limit;
    const ratio = (clientX - box.left) / box.width;
    return box.kind === "hero" ? ((1e3 * ratio - 244) / 728) * 100 : 100 * ratio;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const kind = event.currentTarget.dataset.surface === "plot" ? "plot" : "hero";
    const box = event.currentTarget.getBoundingClientRect();
    drag.current = { id: event.pointerId, left: box.left, width: box.width, kind };
    event.currentTarget.setPointerCapture(event.pointerId);
    rootRef.current?.setAttribute("data-dragging", "");
    handleRef.current?.setAttribute("data-pointer", "");
    handleRef.current?.focus({ preventScroll: true, focusVisible: false });
    applyLimit(limitFromPointer(event.clientX), false);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    applyLimit(limitFromPointer(event.clientX), false);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    rootRef.current?.removeAttribute("data-dragging");
    applyLimit(state.current.limit, true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.currentTarget.removeAttribute("data-pointer");
    const current = state.current;
    const step = event.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current.limit + step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current.limit - step;
    else if (event.key === "PageUp") next = current.limit + 10;
    else if (event.key === "PageDown") next = current.limit - 10;
    else if (event.key === "Home") next = config.current.lowLimit;
    else if (event.key === "End") next = 100;
    if (next === null) return;
    event.preventDefault();
    applyLimit(next, true);
  };

  const restart = () => {
    const current = state.current;
    const settings = config.current;
    if (current.mode === "charging") {
      const done = summary();
      enterPhase(
        "stopped",
        `Charging stopped at ${Math.floor(100 * current.soc)}%. ${done.energy.toFixed(1)} kWh added for ${settings.money.format(done.cost)}.`,
      );
      return;
    }
    if (current.mode === "stopped") {
      if (current.limit / 100 <= current.soc + 0.004)
        enterPhase("complete", `Already at the ${current.limit}% limit. Raise the limit to keep charging.`);
      else enterPhase("charging", `Charging resumed to ${current.limit}%.`);
      return;
    }
    current.soc = settings.start;
    current.alive.fill(0);
    current.seeded = false;
    if (current.limit / 100 <= current.soc + 0.004)
      current.limit = Math.max(current.limit, Math.min(100, Math.ceil(100 * current.soc) + 20));
    write(handleRef.current, "aria-valuenow", String(current.limit));
    enterPhase("charging", `New session started at ${Math.floor(100 * current.soc)}%, charging to ${current.limit}%.`);
  };

  const live = 100 * start < initialLimit;
  const power = maxPower * powerAt(start, taper) * +live;
  const initialMinutes = minutesTo(start, initialLimit / 100, capacity, maxPower, taper);
  const limitShare = initialLimit / 100;
  const limitX = 244 + 728 * limitShare;
  const cells = Array.from({ length: 9 }, (_, index) => 244 + ((index + 1) / 10) * 728);
  const actionLabel =
    phase === "charging" ? "Stop charging" : phase === "stopped" ? "Resume charging" : "Start new session";
  const vars = { ...(accent ? { "--cs-accent": accent } : null), ...style } as CSSProperties;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label ?? title}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={vars}
      data-mode={phase}
    >
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h3 className={styles.title}>{title}</h3>
            {location ? <p className={styles.location}>{location}</p> : null}
          </div>
          <div className={styles.charge}>
            <span ref={socRef} className={styles.soc}>{`${Math.floor(100 * start + 1e-6)}%`}</span>
            <span className={styles.status} data-mode={phase}>
              {phase === "charging" ? (
                <Zap size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : phase === "stopped" ? (
                <Square size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <BatteryFull size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
              {PHASE_LABEL[phase]}
            </span>
          </div>
        </header>

        <div
          ref={heroRef}
          className={styles.hero}
          data-surface="hero"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <svg className={styles.heroSvg} viewBox="0 0 1000 240" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" className={styles.m1} />
                <stop offset=".3" className={styles.m2} />
                <stop offset=".55" className={styles.m3} />
                <stop offset=".8" className={styles.m4} />
                <stop offset="1" className={styles.m5} />
              </linearGradient>
              <clipPath id={`${uid}-pack`}>
                <rect x={244} y={32} width={728} height={176} rx={32} />
              </clipPath>
            </defs>
            <rect x={12} y={28} width={72} height={184} rx={18} fill={`url(#${uid}-metal)`} className={styles.post} />
            <rect x={28} y={46} width={40} height={24} rx={6} className={styles.screen} />
            <rect
              ref={ledRef}
              x={44}
              y={96}
              width={8}
              height={56}
              rx={4}
              className={styles.led}
              opacity={live ? 1 : 0.18}
            />
            <path d={CABLE} className={styles.cable} />
            <path ref={coreRef} d={CABLE} className={styles.core} opacity={0.55 * +live} />
            <rect x={72} y={166} width={18} height={20} rx={5} className={styles.holster} />
            <rect x={210} y={96} width={NUB_GAP + 10} height={48} rx={10} className={styles.nub} />
            <rect x={232} y={20} width={752} height={200} rx={44} className={styles.shell} />
            <g clipPath={`url(#${uid}-pack)`}>
              <rect x={244} y={32} width={728} height={176} className={styles.well} />
              <rect ref={fillRef} x={244} y={32} width={728 * start} height={176} className={styles.fill} />
              <rect
                ref={beyondRef}
                x={limitX}
                y={32}
                width={Math.max(0, 972 - limitX)}
                height={176}
                className={styles.beyond}
              />
              {cells.map((x) => (
                <line key={x} x1={x} x2={x} y1={46} y2={194} className={styles.cell} />
              ))}
              <line
                ref={frontRef}
                x1={244 + 728 * start}
                x2={244 + 728 * start}
                y1={32}
                y2={208}
                className={styles.front}
              />
            </g>
            <path d="M 276 25 H 940" className={styles.sheen} />
            <line ref={limitLineRef} x1={limitX} x2={limitX} y1={20} y2={220} className={styles.limitLine} />
            <g className={styles.packets}>
              {Array.from({ length: PACKETS }, (_, index) => (
                <circle
                  key={index}
                  ref={(node) => {
                    packetRefs.current[index] = node;
                  }}
                  cx={84}
                  cy={176}
                  r={5.5}
                  opacity={0}
                  data-in="out"
                  className={styles.packet}
                />
              ))}
            </g>
          </svg>
          <div
            ref={handleRef}
            className={styles.handle}
            role="slider"
            tabIndex={0}
            aria-label="Charge limit"
            aria-valuemin={lowLimit}
            aria-valuemax={100}
            aria-valuenow={initialLimit}
            aria-valuetext={`Charge limit ${initialLimit}%${limitShare > start ? `, ${spokenDuration(initialMinutes)} to go` : ""}`}
            aria-describedby={`${uid}-hint`}
            onKeyDown={onKeyDown}
            style={{ "--x": ((limitX / 1e3) * 100).toFixed(3) } as CSSProperties}
          >
            <span ref={pillRef} className={styles.pill}>{`${initialLimit}%`}</span>
          </div>
        </div>

        <div className={styles.lower}>
          <section className={styles.curve} aria-label="Charge curve">
            <div className={styles.curveHead}>
              <span className={styles.curveTitle}>Charge curve</span>
              <span ref={curveAtRef} className={styles.curveAt} aria-hidden="true">
                {`${Math.round(power)} kW at ${Math.floor(100 * start + 1e-6)}%`}
              </span>
            </div>
            <div
              ref={plotRef}
              className={styles.plot}
              data-surface="plot"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-hidden="true"
            >
              <svg
                className={styles.plotSvg}
                viewBox="0 0 1000 300"
                preserveAspectRatio="none"
                focusable="false"
              >
                <defs>
                  <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className={styles.areaTop} />
                    <stop offset="1" className={styles.areaBottom} />
                  </linearGradient>
                  <clipPath id={`${uid}-done`}>
                    <rect ref={doneRef} x={1e3 * start} y={0} width={0} height={300} />
                  </clipPath>
                </defs>
                <line x1={0} x2={1e3} y1={44} y2={44} className={styles.grid} />
                <line x1={0} x2={1e3} y1={166} y2={166} className={styles.grid} />
                <line x1={0} x2={1e3} y1={288} y2={288} className={styles.axis} />
                <rect
                  ref={beyondPlotRef}
                  x={1e3 * limitShare}
                  y={0}
                  width={(1 - limitShare) * 1e3}
                  height={288}
                  className={styles.curveBeyond}
                />
                <path d={curve.area} fill={`url(#${uid}-area)`} clipPath={`url(#${uid}-done)`} />
                <path d={curve.line} className={styles.curveLine} />
                <path d={curve.line} className={styles.curveDone} clipPath={`url(#${uid}-done)`} />
                <line
                  ref={plotLimitRef}
                  x1={1e3 * limitShare}
                  x2={1e3 * limitShare}
                  y1={14}
                  y2={288}
                  className={styles.curveLimit}
                />
              </svg>
              <span className={styles.yLabel} style={{ top: "14.666666666666666%" }}>
                {`${maxPower} kW`}
              </span>
              <span className={styles.xLabel} data-edge="start">
                0%
              </span>
              <span className={styles.xLabel} style={{ left: `${100 * taper}%` }}>
                {`${Math.round(100 * taper)}%`}
              </span>
              <span className={styles.xLabel} data-edge="end">
                100%
              </span>
              <span
                ref={dotRef}
                className={styles.dot}
                style={
                  {
                    "--x": (100 * start).toFixed(3),
                    "--y": (((288 - powerAt(start, taper) * +live * 244) / 300) * 100).toFixed(3),
                  } as CSSProperties
                }
              />
            </div>
          </section>

          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Power</dt>
              <dd ref={powerRef as React.RefObject<HTMLElement>}>{`${Math.round(power)} kW`}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Energy added</dt>
              <dd ref={energyRef as React.RefObject<HTMLElement>}>0.0 kWh</dd>
            </div>
            <div className={styles.stat}>
              <dt ref={timeLabelRef as React.RefObject<HTMLElement>}>{`Time to ${initialLimit}%`}</dt>
              <dd ref={timeValueRef as React.RefObject<HTMLElement>}>
                {live ? formatDuration(initialMinutes) : "Done"}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Cost</dt>
              <dd ref={costRef as React.RefObject<HTMLElement>}>{money.format(0)}</dd>
            </div>
          </dl>
        </div>

        <footer className={styles.footer}>
          <p id={`${uid}-hint`} className={styles.hint}>
            Drag across the pack or the curve to set the charge limit.
          </p>
          <button type="button" className={styles.action} onClick={restart} data-mode={phase}>
            <span className={styles.actionIcon} aria-hidden="true">
              {phase === "charging" ? (
                <Square size={14} strokeWidth={1.75} />
              ) : phase === "stopped" ? (
                <Zap size={16} strokeWidth={1.75} />
              ) : (
                <RotateCcw size={16} strokeWidth={1.75} />
              )}
            </span>
            <span className={styles.actionLabels}>
              {["Stop charging", "Resume charging", "Start new session"].map((text) => (
                <span
                  key={text}
                  className={styles.actionLabel}
                  data-active={text === actionLabel ? "" : undefined}
                  aria-hidden={text !== actionLabel || undefined}
                >
                  {text}
                </span>
              ))}
            </span>
          </button>
        </footer>
      </div>
      <p className={styles.sr} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default ChargeSession;
