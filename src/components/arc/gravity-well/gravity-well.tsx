"use client";

import {
  Children,
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import styles from "./gravity-well.module.css";

/** Critically damped: the well follows the pointer without overshoot. */
const WELL_STIFFNESS = 320;
const WELL_DAMPING = 2 * Math.sqrt(WELL_STIFFNESS);

/** Tile springs are underdamped so fast moves leave a jelly wake. */
const TILE_STIFFNESS = 190;
const TILE_DAMPING = 15;

/** Shockwave travel speed, px/s. */
const WAVE_SPEED = 900;

const subscribe = () => () => {};

interface Pulse {
  x: number;
  y: number;
  start: number;
  hit: Uint8Array;
}

export interface GravityWellProps {
  /** One tile per child. Photos, avatars, icons, or any small content. */
  children: ReactNode;
  /** Fixed column count. Leave it out to fit as many columns as `minTileSize` allows. */
  columns?: number;
  /** Smallest tile width in px when `columns` is not set. */
  minTileSize?: number;
  /** Gap between tiles in px. */
  gap?: number;
  /** Reach of the well in px. */
  radius?: number;
  /** Pull strength, from 0 to about 1.5. */
  strength?: number;
  /** Called when a click or key sends a shockwave, with its origin in px from the top left of the grid. */
  onPulse?: (origin: { x: number; y: number }) => void;
  /** Accessible name for the grid. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

/**
 * A grid of tiles that bends toward the pointer like spacetime around a mass. Tiles near the well
 * lean in, shrink and dim on their own springs; a click sends a shockwave rolling outward through
 * the grid.
 */
export function GravityWell({
  children,
  columns,
  minTileSize = 56,
  gap = 8,
  radius = 150,
  strength = 1,
  onPulse,
  label = "Gravity well",
  className,
  style,
}: GravityWellProps) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reduceMotion = useReducedMotion();
  const still = Boolean(reduceMotion) && hydrated;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  /** Latest motion props for the imperative loop. */
  const config = useRef({ radius, strength, onPulse });

  useEffect(() => {
    config.current = { radius, strength, onPulse };
  });

  const items = Children.toArray(children);
  const count = items.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = tiles.current.slice(0, count).filter((node): node is HTMLDivElement => Boolean(node));
    const total = nodes.length;

    const ox = new Float32Array(total); // tile centre x
    const oy = new Float32Array(total); // tile centre y
    const dx = new Float32Array(total); // offset x
    const dy = new Float32Array(total); // offset y
    const vx = new Float32Array(total); // offset velocity x
    const vy = new Float32Array(total); // offset velocity y
    const scale = new Float32Array(total).fill(1);
    const scaleVelocity = new Float32Array(total);
    const ring = new Float32Array(total);

    const pulses: Pulse[] = [];
    let frame = 0;
    let last = 0;
    let destroyed = false;

    const well = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      presence: 0,
      target: 0,
      placed: false,
    };
    let keyIndex = Math.floor(total / 2);

    const measure = () => {
      for (let index = 0; index < total; index += 1) {
        const node = nodes[index];
        ox[index] = node.offsetLeft + node.offsetWidth / 2;
        oy[index] = node.offsetTop + node.offsetHeight / 2;
      }
    };

    const schedule = () => {
      if (frame || destroyed) return;
      frame = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const { radius: reach, strength: pull } = config.current;
      const reachSq = reach * reach;

      well.vx += ((well.tx - well.x) * WELL_STIFFNESS - well.vx * WELL_DAMPING) * dt;
      well.vy += ((well.ty - well.y) * WELL_STIFFNESS - well.vy * WELL_DAMPING) * dt;
      well.x += well.vx * dt;
      well.y += well.vy * dt;
      well.presence += (well.target - well.presence) * (1 - Math.exp(-(7 * dt)));
      if (Math.abs(well.target - well.presence) < 0.002) well.presence = well.target;

      let alive =
        well.presence !== well.target || Math.hypot(well.tx - well.x, well.ty - well.y) > 0.1;

      // Retire waves that have travelled past 12 radii.
      for (let index = pulses.length - 1; index >= 0; index -= 1) {
        if (((now - pulses[index].start) / 1000) * WAVE_SPEED >= 12 * reach) pulses.splice(index, 1);
      }
      if (pulses.length) alive = true;

      for (let index = 0; index < total; index += 1) {
        const relX = well.x - ox[index];
        const relY = well.y - oy[index];
        const distSq = relX * relX + relY * relY;
        const lean = still ? 0 : Math.exp(-distSq / (2 * reachSq)) * well.presence * pull;
        const sink = still ? 0 : Math.exp(-distSq / reachSq) * well.presence * Math.min(1.2, pull);
        const targetX = 0.36 * relX * lean;
        const targetY = 0.36 * relY * lean;
        const targetScale = 1 - 0.46 * sink;

        for (const pulse of pulses) {
          if (pulse.hit[index]) continue;
          const awayX = ox[index] - pulse.x;
          const awayY = oy[index] - pulse.y;
          const away = Math.hypot(awayX, awayY) || 1;
          if (!still && ((now - pulse.start) / 1000) * WAVE_SPEED < away) continue;
          pulse.hit[index] = 1;
          const falloff = Math.exp(-away / (3.2 * reach));
          if (!still) {
            const impulse = 720 * falloff;
            vx[index] += (awayX / away) * impulse;
            vy[index] += (awayY / away) * impulse;
            scaleVelocity[index] -= 3.2 * falloff;
          }
          ring[index] = Math.max(ring[index], Math.min(1, 1.4 * falloff));
        }

        vx[index] += ((targetX - dx[index]) * TILE_STIFFNESS - TILE_DAMPING * vx[index]) * dt;
        vy[index] += ((targetY - dy[index]) * TILE_STIFFNESS - TILE_DAMPING * vy[index]) * dt;
        scaleVelocity[index] +=
          ((targetScale - scale[index]) * TILE_STIFFNESS - TILE_DAMPING * scaleVelocity[index]) * dt;
        dx[index] += vx[index] * dt;
        dy[index] += vy[index] * dt;
        scale[index] += scaleVelocity[index] * dt;

        if (
          Math.abs(vx[index]) + Math.abs(vy[index]) > 0.02 ||
          Math.abs(targetX - dx[index]) + Math.abs(targetY - dy[index]) > 0.02 ||
          Math.abs(scaleVelocity[index]) > 0.001 ||
          Math.abs(targetScale - scale[index]) > 5e-4
        )
          alive = true;

        nodes[index].style.transform = `translate3d(${dx[index].toFixed(2)}px, ${dy[index].toFixed(2)}px, 0) scale(${scale[index].toFixed(4)})`;
        nodes[index].style.opacity = (1 - 0.38 * sink).toFixed(3);
        nodes[index].style.zIndex = String(10 - Math.round(9 * sink));

        if (ring[index] > 0) {
          ring[index] = ring[index] < 0.01 ? 0 : ring[index] * Math.exp(-(5 * dt));
          nodes[index].style.setProperty("--gravity-well-ring", ring[index].toFixed(3));
          if (ring[index]) alive = true;
        }
      }

      if (alive) schedule();
      else last = 0;
    };

    const toLocal = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const moveWell = (x: number, y: number, snap: boolean) => {
      well.tx = x;
      well.ty = y;
      if (snap || !well.placed) {
        well.x = x;
        well.y = y;
        well.vx = 0;
        well.vy = 0;
        well.placed = true;
      }
    };

    const pulse = (x: number, y: number) => {
      pulses.push({ x, y, start: performance.now(), hit: new Uint8Array(total) });
      if (pulses.length > 4) pulses.shift();
      config.current.onPulse?.({ x, y });
      schedule();
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = toLocal(event);
      moveWell(point.x, point.y, well.presence < 0.02);
      well.target = 1;
      schedule();
    };

    const onPointerLeave = () => {
      well.target = 0;
      schedule();
    };

    const onPointerDown = (event: PointerEvent) => {
      const point = toLocal(event);
      moveWell(point.x, point.y, well.presence < 0.02);
      well.target = 1;
      pulse(point.x, point.y);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") onPointerLeave();
    };

    const moveTo = (index: number) => {
      keyIndex = Math.max(0, Math.min(total - 1, index));
      moveWell(ox[keyIndex], oy[keyIndex], well.presence < 0.02);
      well.target = 1;
      schedule();
    };

    /** Number of tiles in the first row, for the up/down step. */
    const rowLength = () => {
      let index = 0;
      while (index < total && oy[index] === oy[0]) index += 1;
      return Math.max(1, index);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const delta: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -rowLength(),
        ArrowDown: rowLength(),
        Home: -total,
        End: total,
      };
      const step = delta[event.key];
      if (step !== undefined) {
        event.preventDefault();
        moveTo(keyIndex + step);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (well.presence < 0.02) moveTo(keyIndex);
        pulse(ox[keyIndex], oy[keyIndex]);
      }
    };

    const onFocus = (event: FocusEvent) => {
      if (event.target === root && root.matches(":focus-visible")) moveTo(keyIndex);
    };

    const onBlur = () => {
      well.target = 0;
      schedule();
    };

    measure();
    const observer = new ResizeObserver(() => {
      measure();
      schedule();
    });
    observer.observe(root);

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerLeave);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("focus", onFocus);
    root.addEventListener("blur", onBlur);

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerLeave);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focus", onFocus);
      root.removeEventListener("blur", onBlur);
      for (const node of nodes) {
        node.style.transform = "";
        node.style.opacity = "";
        node.style.zIndex = "";
        node.style.removeProperty("--gravity-well-ring");
      }
    };
  }, [count, still]);

  const rootStyle: CSSProperties & { "--gravity-well-min": string } = {
    "--gravity-well-min": `${minTileSize}px`,
    gap,
    ...(columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : {}),
    ...style,
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      role="group"
      aria-label={label}
      aria-roledescription="gravity well"
      tabIndex={0}
    >
      {items.map((child, index) => (
        <div
          key={index}
          ref={node => {
            tiles.current[index] = node;
          }}
          className={styles.tile}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export default GravityWell;
