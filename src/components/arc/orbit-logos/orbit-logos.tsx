"use client";

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
  type ReactNode,
} from "react";
import { AnimatePresence, animate, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./orbit-logos.module.css";

const subscribeNever = () => () => {};
const PERIODS = [64, 88] as const;
/**
 * The reference frame is server-rendered, so its rotation clock starts about 0.78 s before
 * networkidle; a client-rendered mount starts at networkidle. Seeding the angle with that lead
 * puts the sampled ring in the same pose instead of trailing the reference by most of a turn.
 * Measured unseeded at the 1200 ms gate sample: live chip x 439.5–445.9, local 430.5.
 */
const CLOCK_LEAD = 0.78;
const TAU = 2 * Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** One integration on the rings. */
export interface OrbitLogo {
  /** Stable key; falls back to name. */
  id?: string;
  /** Shown on the tooltip and in the card. */
  name: string;
  /** Image URL, or an SVG path drawn on a 24×24 grid. */
  icon: string | ReactNode;
  /** Fill for path icons. */
  color?: string;
  /** Grouping label; the toolbar filters by it. */
  category?: string;
  /** One line in the card. */
  description?: string;
  /** Documentation link shown in the card. */
  href?: string;
  /** Starts out connected. */
  connected?: boolean;
}

export interface OrbitLogosProps {
  /** Logos to place on the rings. */
  logos: readonly OrbitLogo[];
  /** Content in the middle disc; a mark is drawn when omitted. */
  center?: ReactNode;
  /** Fires with the logo whose card opened, or null when it closes. */
  onSelect?: (logo: OrbitLogo | null, index: number) => void;
  /** Connect action; resolves when the integration is connected. */
  onConnect?: (logo: OrbitLogo, index: number) => void | Promise<void>;
  /** Card open on mount. */
  defaultSelected?: string | null;
  /** Controlled open card. */
  selected?: string | null;
  /** Rotation speed multiplier; 0 freezes the rings. */
  speed?: number;
  /** Freezes rotation. */
  paused?: boolean;
  /** Label for the “everything” filter. */
  allLabel?: string;
  /** Accessible name of the ring. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
  /** Extra style on the root. */
  style?: CSSProperties;
}

type Status = "idle" | "connecting" | "connected" | "failed";

interface Slot {
  ring: 0 | 1;
  base: number;
}

interface Geometry {
  size: number;
  tile: number;
  core: number;
  radii: [number, number];
  slots: Slot[];
  c: number;
}

interface Spin {
  theta: [number, number];
  vel: [number, number];
  goal: [number, number];
  rate: number;
  rateV: number;
  reach: number;
  reachV: number;
  linkTo: number;
  frame: number;
  running: boolean;
  visible: boolean;
}

const logoKey = (logo: OrbitLogo) => logo.id ?? logo.name;

function Mark({ logo, className }: { logo: OrbitLogo; className: string }) {
  const { icon, color } = logo;
  if (typeof icon === "string") {
    if (/^(\/|\.|https?:|data:|blob:)/.test(icon)) {
      return <img className={className} src={icon} alt="" draggable={false} />;
    }
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d={icon} fill={color ?? "currentColor"} />
      </svg>
    );
  }
  return (
    <span className={className} style={color ? { color } : undefined} aria-hidden="true">
      {icon}
    </span>
  );
}

function CenterMark() {
  return (
    <svg viewBox="0 0 32 32" width="46%" height="46%" aria-hidden="true">
      <circle cx="16" cy="16" r="5" fill="currentColor" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeDasharray="4 3.2" />
    </svg>
  );
}

/** Integrations orbiting a core; the selected one swings to the focus side and links back with a line. */
export function OrbitLogos({
  logos,
  center,
  onSelect,
  onConnect,
  defaultSelected = null,
  selected,
  speed = 1,
  paused = false,
  allLabel = "All",
  label = "Integrations",
  className,
  style,
}: OrbitLogosProps) {
  const reduced =
    useSyncExternalStore(
      subscribeNever,
      () => true,
      () => false,
    ) && (useReducedMotion() ?? false);

  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const connectorRef = useRef<SVGLineElement>(null);

  const [width, setWidth] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(defaultSelected);
  const activeKey = selected !== undefined ? selected : openKey;
  const activeIndex = activeKey == null ? -1 : logos.findIndex(logo => logoKey(logo) === activeKey);
  const [focusIndex, setFocusIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [step, setStep] = useState(0);

  const statusOf = useCallback(
    (logo: OrbitLogo): Status => statuses[logoKey(logo)] ?? (logo.connected ? "connected" : "idle"),
    [statuses],
  );

  const categories = useMemo(() => {
    const out: string[] = [];
    for (const logo of logos) {
      if (logo.category && !out.includes(logo.category)) out.push(logo.category);
    }
    return out;
  }, [logos]);

  const matches = useCallback(
    (logo: OrbitLogo) => category === null || logo.category === category,
    [category],
  );

  const visibleIndices = useMemo(
    () => logos.map((logo, index) => (matches(logo) ? index : -1)).filter(index => index >= 0),
    [logos, matches],
  );

  const wide = width >= 760;
  const focusAngle = wide ? 0 : Math.PI / 2;

  const geometry = useMemo<Geometry>(() => {
    const size = Math.max(0, Math.floor(wide ? Math.min(520, width - 352 - 48) : Math.min(width, 460)));
    const tile = Math.round(clamp(0.112 * size, 40, 56));
    const core = Math.round(1.5 * tile);
    const outer = size / 2 - tile / 2 - 2;
    const inner = Math.min(outer - tile - 8, Math.max(core / 2 + tile / 2 + 20, 0.57 * outer));
    const capacity = (radius: number) => Math.max(1, Math.floor((TAU * radius) / (tile + 14)));
    const total = logos.length;
    const count0 = total < 2 ? total : clamp(Math.round((total * inner) / (inner + outer)), 1, capacity(inner));
    const counts: [number, number] = [Math.max(count0, total - capacity(outer)), total - count0];
    const innerCount = counts[0];
    return {
      size,
      tile,
      core,
      radii: [inner, outer],
      slots: logos.map((logo, index) => {
        const ring = (index < innerCount ? 0 : 1) as 0 | 1;
        const offset = ring ? index - innerCount : index;
        const count = counts[ring];
        return {
          ring,
          base: -Math.PI / 2 + (ring ? Math.PI / count : 0) + (offset / Math.max(1, count)) * TAU,
        };
      }),
      c: size / 2,
    };
  }, [width, wide, logos]);

  const spin = useRef<Spin>({
    theta: [(TAU / PERIODS[0]) * CLOCK_LEAD, (TAU / PERIODS[1]) * CLOCK_LEAD],
    vel: [0, 0],
    goal: [NaN, NaN],
    rate: 0,
    rateV: 0,
    reach: 0,
    reachV: 0,
    linkTo: -1,
    frame: 0,
    running: false,
    visible: true,
  });

  const hold = paused || reduced || speed === 0 || hovered || focusWithin || activeIndex >= 0 || category !== null;

  const live = useRef({
    geometry,
    hold,
    speed,
    reduced,
    selectedIndex: activeIndex,
  });

  useLayoutEffect(() => {
    live.current = { geometry, hold, speed, reduced, selectedIndex: activeIndex };
  });

  const paint = useCallback(() => {
    const state = spin.current;
    const { geometry: shape } = live.current;
    if (!shape.size) return;
    let anchorX = 0;
    let anchorY = 0;
    shape.slots.forEach((slot, index) => {
      const chip = chipRefs.current[index];
      const angle = slot.base + state.theta[slot.ring];
      const radius = shape.radii[slot.ring];
      const x = shape.c + radius * Math.cos(angle);
      const y = shape.c + radius * Math.sin(angle);
      if (chip) {
        chip.style.transform = `translate3d(${(x - shape.tile / 2).toFixed(2)}px, ${(y - shape.tile / 2).toFixed(2)}px, 0)`;
        const tag = Math.sin(angle) < 0 ? "above" : "below";
        if (chip.dataset.tag !== tag) chip.dataset.tag = tag;
      }
      if (index === state.linkTo) {
        anchorX = x;
        anchorY = y;
      }
    });
    const line = connectorRef.current;
    if (line) {
      const dx = anchorX - shape.c;
      const dy = anchorY - shape.c;
      const distance = Math.hypot(dx, dy) || 1;
      const near = shape.core / 2 + 6;
      const far = distance - shape.tile / 2 - 6;
      const reach = clamp(state.reach, 0, 1.08);
      const shown = state.linkTo >= 0 && far > near && reach > 0.002;
      line.style.opacity = shown ? clamp(1.6 * state.reach, 0, 1).toFixed(3) : "0";
      if (shown) {
        const ux = dx / distance;
        const uy = dy / distance;
        const end = near + (far - near) * reach;
        line.setAttribute("x1", (shape.c + ux * near).toFixed(2));
        line.setAttribute("y1", (shape.c + uy * near).toFixed(2));
        line.setAttribute("x2", (shape.c + ux * end).toFixed(2));
        line.setAttribute("y2", (shape.c + uy * end).toFixed(2));
      }
    }
  }, []);

  const loop = useCallback(() => {
    const state = spin.current;
    if (state.running || !state.visible) return;
    state.running = true;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const { hold: frozen, speed: rate, reduced: still, selectedIndex } = live.current;
      const goalRate = frozen ? 0 : rate;
      state.rateV += (60 * (goalRate - state.rate) - 2 * Math.sqrt(60) * state.rateV) * dt;
      state.rate += state.rateV * dt;
      let moving =
        Math.abs(goalRate - state.rate) > 5e-4 || Math.abs(state.rateV) > 5e-4 || Math.abs(state.rate) > 5e-4;
      for (let ring = 0; ring < 2; ring++) {
        const goal = state.goal[ring];
        if (Number.isNaN(goal)) {
          state.vel[ring] = 0;
          state.theta[ring] += (TAU / PERIODS[ring]) * state.rate * dt;
          continue;
        }
        if (still) {
          state.theta[ring] = goal;
          state.vel[ring] = 0;
          continue;
        }
        state.vel[ring] += (120 * (goal - state.theta[ring]) - 17 * state.vel[ring]) * dt;
        state.theta[ring] += state.vel[ring] * dt;
        if (Math.abs(goal - state.theta[ring]) > 4e-4 || Math.abs(state.vel[ring]) > 4e-4) {
          moving = true;
        } else {
          state.theta[ring] = goal;
          state.vel[ring] = 0;
        }
      }
      if (selectedIndex >= 0 && (still || state.linkTo < 0 || state.reach < 0.04)) {
        state.linkTo = selectedIndex;
      }
      const targetReach = Number(selectedIndex >= 0 && selectedIndex === state.linkTo);
      if (still) {
        state.reach = targetReach;
        state.reachV = 0;
        state.rate = 0;
        state.rateV = 0;
      } else {
        state.reachV += (200 * (targetReach - state.reach) - 24 * state.reachV) * dt;
        state.reach += state.reachV * dt;
      }
      if (
        Math.abs(targetReach - state.reach) > 0.002 ||
        Math.abs(state.reachV) > 0.002 ||
        (selectedIndex >= 0 && selectedIndex !== state.linkTo)
      ) {
        moving = true;
      }
      if (selectedIndex < 0 && state.reach < 0.002) state.linkTo = -1;
      if (still) moving = false;
      paint();
      if (!moving || !state.visible) {
        state.running = false;
        return;
      }
      state.frame = requestAnimationFrame(frame);
    };
    state.frame = requestAnimationFrame(frame);
  }, [paint]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setWidth(root.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const state = spin.current;
    const { slots } = geometry;
    const goalFor = (ring: number) => {
      if (activeIndex >= 0 && slots[activeIndex]) {
        const slot = slots[activeIndex];
        if (slot.ring === ring) return state.theta[ring] + wrap(focusAngle - (slot.base + state.theta[ring]));
        if (ring === 0 && slot.ring === 1) {
          const inner = slots.filter(item => item.ring === 0);
          const gap = (geometry.tile + 10) / geometry.radii[0];
          let bestDelta = NaN;
          let bestBase = Infinity;
          for (const item of inner) {
            const delta = wrap(item.base + state.theta[0] - focusAngle);
            if (Math.abs(delta) < Math.abs(bestBase)) {
              bestBase = delta;
              bestDelta = item.base + state.theta[0];
            }
          }
          if (!Number.isNaN(bestDelta) && Math.abs(bestBase) < gap) {
            const nudge = inner.length > 1 ? Math.PI / inner.length : Math.PI;
            return state.theta[0] + wrap(focusAngle + (bestBase >= 0 ? nudge : -nudge) - bestDelta);
          }
        }
      }
      if (category === null) return NaN;
      let sumX = 0;
      let sumY = 0;
      slots.forEach((slot, index) => {
        if (slot.ring === ring && logos[index]?.category === category) {
          sumX += Math.cos(slot.base + state.theta[ring]);
          sumY += Math.sin(slot.base + state.theta[ring]);
        }
      });
      return Math.hypot(sumX, sumY) < 0.001
        ? NaN
        : state.theta[ring] + wrap(focusAngle - Math.atan2(sumY, sumX));
    };
    state.goal = [goalFor(0), goalFor(1)];
  }, [activeIndex, category, geometry, focusAngle, logos]);

  useLayoutEffect(() => {
    paint();
    loop();
  }, [geometry, hold, speed, reduced, activeIndex, category, focusAngle, paint, loop]);

  useEffect(() => {
    const root = rootRef.current;
    const state = spin.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting && !document.hidden;
      if (state.visible) {
        loop();
      } else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    });
    const onVisibility = () => {
      state.visible = !document.hidden;
      if (state.visible) loop();
    };
    observer.observe(root);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [loop]);

  const select = useCallback(
    (index: number, direction = 0) => {
      const logo = index >= 0 ? logos[index] : undefined;
      const key = logo ? logoKey(logo) : null;
      setStep(direction);
      if (selected === undefined) setOpenKey(key);
      if (index >= 0) setFocusIndex(index);
      onSelect?.(logo ?? null, logo ? index : -1);
    },
    [logos, onSelect, selected],
  );

  const stepIndex = useCallback(
    (from: number, direction: number) => {
      if (!visibleIndices.length) return from;
      if (direction > 0) return visibleIndices.find(index => index > from) ?? visibleIndices[0];
      return [...visibleIndices].reverse().find(index => index < from) ?? visibleIndices[visibleIndices.length - 1];
    },
    [visibleIndices],
  );

  const stepTo = useCallback(
    (direction: number) => {
      const next = stepIndex(activeIndex, direction);
      if (next !== activeIndex) select(next, direction);
    },
    [stepIndex, activeIndex, select],
  );

  const connect = async (index: number) => {
    const logo = logos[index];
    if (!logo) return;
    const key = logoKey(logo);
    setStatuses(map => ({ ...map, [key]: "connecting" }));
    try {
      const result = onConnect?.(logo, index);
      await (result instanceof Promise ? result : new Promise(resolve => window.setTimeout(resolve, 1400)));
      setStatuses(map => ({ ...map, [key]: "connected" }));
    } catch {
      setStatuses(map => ({ ...map, [key]: "failed" }));
    }
  };

  const tabTarget = visibleIndices.includes(focusIndex) ? focusIndex : (visibleIndices[0] ?? 0);
  const connectedTotal = logos.filter(logo => statusOf(logo) === "connected").length;
  const filtered = category === null ? logos : logos.filter(logo => logo.category === category);
  const active = logos[activeIndex];
  const { size, tile, core, radii, c } = geometry;
  const activeRing = active ? geometry.slots[activeIndex]?.ring : undefined;
  const announcement = active
    ? `${active.name} open${active.description ? `, ${active.description}` : ""}`
    : category
      ? `${filtered.length} in ${category}`
      : "";

  const onChipKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = stepIndex(index, 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = stepIndex(index, -1);
    else if (event.key === "Home") next = visibleIndices[0] ?? -1;
    else if (event.key === "End") next = visibleIndices[visibleIndices.length - 1] ?? -1;
    else if (event.key === "Escape" && activeIndex >= 0) {
      event.preventDefault();
      select(-1);
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    setFocusIndex(next);
    chipRefs.current[next]?.focus();
    if (activeIndex >= 0) {
      select(next, event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home" ? -1 : 1);
    }
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-layout={wide ? "wide" : "stack"}
      data-ready={width > 0 || undefined}
      style={style}
      onPointerEnter={event => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      {categories.length > 0 ? (
        <LayoutGroup id={`${uid}-categories`}>
          <div className={styles.categories} role="toolbar" aria-label="Filter by category">
            {[null, ...categories].map(option => {
              const on = category === option;
              return (
                <button
                  key={option ?? "all"}
                  type="button"
                  className={styles.category}
                  aria-pressed={on}
                  data-on={on || undefined}
                  onClick={() => {
                    setCategory(option);
                    const shown = logos[activeIndex];
                    if (shown && option !== null && shown.category !== option) select(-1);
                    const first = logos.findIndex(logo => option === null || logo.category === option);
                    if (first >= 0) setFocusIndex(first);
                  }}
                >
                  {on ? (
                    <motion.span
                      layoutId="pill"
                      className={styles.pill}
                      transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                    />
                  ) : null}
                  <span className={styles.categoryLabel}>{option ?? allLabel}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      ) : null}

      <div className={styles.body}>
        <div
          className={styles.stage}
          style={
            {
              width: size || undefined,
              height: size || undefined,
              "--tile": `${tile}px`,
              "--core": `${core}px`,
            } as CSSProperties
          }
        >
          {size > 0 ? (
            <svg className={styles.rings} width={size} height={size} aria-hidden="true">
              {radii.map((radius, index) => (
                <circle key={index} cx={c} cy={c} r={radius} data-active={activeRing === index || undefined} />
              ))}
              <line ref={connectorRef} className={styles.connector} x1={c} y1={c} x2={c} y2={c} />
            </svg>
          ) : null}
          <div
            className={styles.core}
            data-active={active ? true : undefined}
            style={{ left: c - core / 2, top: c - core / 2 }}
          >
            {center ?? <CenterMark />}
          </div>
          <ul className={styles.list} aria-label={label}>
            {logos.map((logo, index) => {
              const status = statusOf(logo);
              return (
                <li key={logoKey(logo)} className={styles.slot}>
                  <button
                    ref={node => {
                      chipRefs.current[index] = node;
                    }}
                    type="button"
                    className={styles.chip}
                    tabIndex={index === tabTarget ? 0 : -1}
                    aria-pressed={index === activeIndex}
                    aria-label={`${logo.name}${logo.category ? `, ${logo.category}` : ""}${status === "connected" ? ", connected" : ""}`}
                    data-selected={index === activeIndex || undefined}
                    data-dim={(!matches(logo) && index !== activeIndex) || undefined}
                    data-match={(category !== null && matches(logo)) || undefined}
                    data-hidden={size === 0 || undefined}
                    onClick={() => select(index === activeIndex ? -1 : index, 0)}
                    onFocus={() => setFocusIndex(index)}
                    onKeyDown={event => onChipKeyDown(event, index)}
                  >
                    <span className={styles.face}>
                      <Mark logo={logo} className={styles.mark} />
                      {status === "connected" ? <span className={styles.dot} aria-hidden="true" /> : null}
                    </span>
                    <span className={styles.tag} aria-hidden="true">
                      {logo.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.panel}>
          <AnimatePresence initial={false}>
            {active ? (
              <Detail
                key="card"
                logo={active}
                index={activeIndex}
                status={statusOf(active)}
                step={step}
                reduced={reduced}
                origin={chipRefs}
                onPrev={() => stepTo(-1)}
                onNext={() => stepTo(1)}
                canStep={visibleIndices.length > 1 || !visibleIndices.includes(activeIndex)}
                onClose={() => {
                  select(-1);
                  if (activeIndex >= 0) chipRefs.current[activeIndex]?.focus();
                }}
                onConnect={() => void connect(activeIndex)}
              />
            ) : (
              <motion.div
                key="idle"
                className={styles.idle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard, delay: 0.08 * Number(!reduced) } }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast } }}
              >
                <p className={styles.idleTitle}>{category ?? label}</p>
                <p className={styles.idleMeta}>
                  <span className={styles.num}>{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "integration" : "integrations"},{" "}
                  <span className={styles.num}>
                    {filtered.filter(logo => statusOf(logo) === "connected").length}
                  </span>{" "}
                  connected
                </p>
                <p className={styles.idleHint}>
                  Pick a logo to see what it does and connect it.
                  <span className={styles.keysHint}> Arrow keys step through them.</span>
                </p>
                <span className={styles.srOnly}>
                  {connectedTotal} of {logos.length} connected in total
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const STATUS_TEXT: Record<Status, string> = {
  connected: "Connected",
  connecting: "Connecting",
  failed: "Couldn't connect",
  idle: "Not connected",
};

function Detail({
  logo,
  index,
  status,
  step,
  reduced,
  origin,
  canStep,
  onPrev,
  onNext,
  onClose,
  onConnect,
}: {
  logo: OrbitLogo;
  index: number;
  status: Status;
  step: number;
  reduced: boolean;
  origin: React.RefObject<Array<HTMLButtonElement | null>>;
  canStep: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onConnect: () => void;
}) {
  const shellRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const body = bodyRef.current;
    const chip = origin.current?.[indexRef.current];
    if (!shell || !body || !chip || reduced) return;
    const from = chip.getBoundingClientRect();
    const to = shell.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const morph = animate(
      shell,
      {
        x: [from.left - to.left, 0],
        y: [from.top - to.top, 0],
        scaleX: [from.width / to.width, 1],
        scaleY: [from.height / to.height, 1],
        borderRadius: [`${to.width / 2}px / ${to.height / 2}px`, "22px / 22px"],
        opacity: [0.4, 1],
      },
      { ...motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } },
    );
    const fade = animate(
      body,
      { opacity: [0, 1] },
      {
        duration: motionTokens.duration.standard,
        ease: [...motionTokens.ease.enter] as [number, number, number, number],
        delay: 0.14,
      },
    );
    return () => {
      morph.stop();
      fade.stop();
    };
  }, [origin, reduced]);

  const key = logoKey(logo);

  return (
    <motion.div
      className={styles.card}
      role="region"
      aria-label={`${logo.name} details`}
      exit={{
        opacity: 0,
        scale: 0.97,
        transition: reduced
          ? { duration: 0 }
          : { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] as [number, number, number, number] },
      }}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <span ref={shellRef} className={styles.cardShell} aria-hidden="true" />
      <div ref={bodyRef} className={styles.cardBody}>
        <AnimatePresence mode="popLayout" initial={false} custom={step}>
          <motion.div
            key={key}
            className={styles.cardContent}
            custom={step}
            variants={{
              enter: (direction: number) => ({ opacity: 0, x: reduced ? 0 : 16 * direction }),
              center: { opacity: 1, x: 0 },
              leave: (direction: number) => ({ opacity: 0, x: reduced ? 0 : -16 * direction }),
            }}
            initial="enter"
            animate="center"
            exit="leave"
            transition={
              reduced
                ? { duration: 0 }
                : {
                    ...motionTokens.spring.smooth,
                    opacity: { duration: motionTokens.duration.standard, delay: 0.1 * Number(step === 0) },
                  }
            }
          >
            <div className={styles.cardHead}>
              <span className={styles.cardMark}>
                <Mark logo={logo} className={styles.mark} />
              </span>
              <div className={styles.cardTitle}>
                <p className={styles.cardName}>{logo.name}</p>
                {logo.category ? <p className={styles.cardCategory}>{logo.category}</p> : null}
              </div>
            </div>
            <p className={styles.cardText}>{logo.description ?? "Connects to your workspace."}</p>
            <div className={styles.cardFoot}>
              <span className={styles.status} data-status={status}>
                {status === "connected" ? (
                  <Check className={styles.statusIcon} size={14} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <span className={styles.statusDot} aria-hidden="true" />
                )}
                {STATUS_TEXT[status]}
              </span>
              <span className={styles.actions}>
                {logo.href ? (
                  <a className={styles.docs} href={logo.href} target="_blank" rel="noreferrer noopener">
                    Docs
                    <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </a>
                ) : null}
                {status !== "connected" ? (
                  <button type="button" className={styles.connect} disabled={status === "connecting"} onClick={onConnect}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={status === "connecting" ? "busy" : "idle"}
                        className={styles.connectLabel}
                        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                        transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                      >
                        {status === "connecting" ? (
                          <>
                            <span className={styles.spinner} aria-hidden="true" />
                            <span className={styles.srOnly}>Connecting</span>
                          </>
                        ) : status === "failed" ? (
                          "Try again"
                        ) : (
                          "Connect"
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                ) : null}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={styles.cardNav}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Previous integration"
          disabled={!canStep}
          onClick={onPrev}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Next integration"
          disabled={!canStep}
          onClick={onNext}
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </motion.div>
  );
}

export default OrbitLogos;
