"use client";

import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import styles from "./cover-flow.module.css";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
/** Rubber band past an edge: the pull shrinks as you go, so the rail never tears away from the ends. */
const rubber = (value: number, tension = 0.6, damp = 0.55) => (value * tension * damp) / (tension + damp * Math.abs(value));

const emptySubscribe = () => () => {};
const always = () => true;

export interface CoverFlowItem {
  /** Stable key for the card and its tick. */
  id: string;
  /** Card caption and the spoken slide name. */
  title: string;
  /** Second caption line, such as the location. */
  subtitle?: string;
  /** Appended to the subtitle with a comma. */
  meta?: string;
  /** Image used on the card face and its mirror. */
  image: string;
  /** CSS object-position for the image, for tall images that need to crop high. */
  imagePosition?: string;
  /** Description read when the card is the front one. */
  alt?: string;
}

export interface CoverFlowProps {
  /** Cards in order. One card per item. */
  items: CoverFlowItem[];
  /** Accessible name of the carousel, and the prefix of the tick group's name. */
  label: string;
  /** Controlled front index. */
  index?: number;
  /** Initial front index when uncontrolled. */
  defaultIndex?: number;
  /** Called whenever the front card changes. */
  onIndexChange?: (index: number) => void;
  /** Custom caption, such as a title and a stacked meta row. */
  renderCaption?: (item: CoverFlowItem, index: number) => ReactNode;
  /** Extra class on the root. */
  className?: string;
}

interface Layout {
  reach: number;
  near: number;
  far: number;
}

interface Box {
  stage: number;
  card: number;
}

interface Drag {
  pointer: number;
  x: number;
  y: number;
  start: number;
  dragging: boolean;
  caught: boolean;
  samples: { t: number; p: number }[];
}

/** A spring tuned to the gesture: the stiffer the throw, the tighter the spring, and the velocity carries through. */
function springFor(delta: number, velocity: number, stiffness: number) {
  const inherited =
    Math.abs(delta) > 0.001 && Math.sign(delta) === Math.sign(velocity)
      ? Math.sign(velocity) * Math.min(Math.abs(velocity), stiffness * Math.abs(delta))
      : velocity;
  return { type: "spring" as const, stiffness: stiffness * stiffness, damping: 2 * stiffness, mass: 1, velocity: inherited, restDelta: 5e-4, restSpeed: 0.01 };
}

/** Pixels per second over the last hundred milliseconds of samples. */
function speedOf(samples: { t: number; p: number }[], time: number) {
  const recent = samples.filter(sample => time - sample.t < 100);
  if (recent.length < 2 || time - recent[recent.length - 1].t > 60) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return last.t > first.t ? ((last.p - first.p) / (last.t - first.t)) * 1000 : 0;
}

interface CardProps {
  item: CoverFlowItem;
  index: number;
  count: number;
  active: boolean;
  position: MotionValue<number>;
  layout: Layout;
  width: number;
  onPick: (index: number) => void;
}

/** One card: the rail transform, the veil that darkens the side cards, and the mirrored floor reflection. */
function Card({ item, index, count, active, position, layout, width, onPick }: CardProps) {
  const { reach, near, far } = layout;
  const delta = useTransform(position, value => index - value);
  const transform = useTransform(delta, value => {
    const distance = Math.abs(value);
    const direction = Math.sign(value);
    const inner = Math.min(distance, 1);
    const outer = Math.max(0, distance - 1);
    const extra = Math.min(outer, reach - 1) + 0.35 * Math.max(0, distance - reach);
    const z = -width * (0.38 * inner + 0.14 * Math.min(outer, reach));
    return `translate3d(${round(direction * (near * inner + far * extra), 2)}px, 0, ${round(z, 2)}px) rotateY(${round(-direction * inner * 45, 2)}deg)`;
  });
  const opacity = useTransform(delta, value => round(clamp((reach + 0.7 - Math.abs(value)) / 0.7, 0, 1)));
  const depth = useTransform(delta, value => Math.round(100 - 10 * Math.abs(value)));
  const visibility = useTransform(delta, value => (Math.abs(value) > reach + 0.75 ? "hidden" : "visible"));
  const veil = useTransform(delta, value => {
    const distance = Math.abs(value);
    return round(0.42 * Math.min(distance, 1) + 0.16 * clamp(distance - 1, 0, reach));
  });
  const edgeOpacity = useTransform(delta, value => round(0.45 * clamp(Math.abs(value), 0, 1)));
  const edge = useTransform(delta, value => `linear-gradient(${value < 0 ? 90 : 270}deg, transparent 40%, oklch(0% 0 0 / .5))`);
  const reflection = useTransform(delta, value => round(1 - 0.45 * Math.min(Math.abs(value), 1)));

  return (
    <motion.div
      className={styles.card}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${item.title}`}
      aria-hidden={!active}
      data-active={active || undefined}
      style={{ transform, opacity, zIndex: depth, visibility }}
      onClick={() => onPick(index)}
    >
      <span className={styles.ambient} aria-hidden="true" />
      <motion.span className={styles.reflection} style={{ opacity: reflection }} aria-hidden="true">
        <img className={styles.image} src={item.image} alt="" draggable={false} decoding="async" style={{ objectPosition: item.imagePosition }} />
      </motion.span>
      <span className={styles.contact} aria-hidden="true" />
      <span className={styles.face}>
        <img
          className={styles.image}
          src={item.image}
          alt={active ? (item.alt ?? item.title) : ""}
          draggable={false}
          decoding="async"
          style={{ objectPosition: item.imagePosition }}
        />
        <motion.span className={styles.veil} style={{ opacity: veil }} aria-hidden="true" />
        <motion.span className={styles.edge} style={{ opacity: edgeOpacity, backgroundImage: edge }} aria-hidden="true" />
      </span>
    </motion.div>
  );
}

interface CaptionProps {
  index: number;
  position: MotionValue<number>;
  active: boolean;
  children: ReactNode;
}

/** One caption stacked in the same slot, so only the front one is legible. */
function CaptionItem({ index, position, active, children }: CaptionProps) {
  const opacity = useTransform(position, value => round(clamp((0.55 - Math.abs(index - value)) / 0.45, 0, 1)));
  const transform = useTransform(position, value => `translate3d(${round(18 * clamp(index - value, -1, 1), 2)}px, 0, 0)`);
  const visibility = useTransform(position, value => (0.56 > Math.abs(index - value) ? "visible" : "hidden"));

  return (
    <motion.div className={styles.captionItem} aria-hidden={!active} style={{ opacity, transform, visibility }}>
      {children}
    </motion.div>
  );
}

export function CoverFlow({
  items,
  label,
  index,
  defaultIndex = 0,
  onIndexChange,
  renderCaption,
  className,
}: CoverFlowProps) {
  const prefersReduced = useReducedMotion();
  const mounted = useSyncExternalStore(emptySubscribe, always, () => false);
  const reduced = Boolean(prefersReduced) && mounted;
  const count = items.length;
  const max = Math.max(0, count - 1);
  const [initial] = useState(() => clamp(Math.round(index ?? defaultIndex), 0, max));
  const [activeIndex, setActiveIndex] = useState(initial);
  const [box, setBox] = useState<Box>({ stage: 720, card: 232 });
  const [announcement, setAnnouncement] = useState("");

  const reach = box.stage >= 2.85 * box.card ? 2 : 1;
  const depth = 3.4 * box.card;
  const half = box.card / 2;
  const angle = (45 * Math.PI) / 180;
  const edgeZ = -box.card * (0.38 + 0.14 * (reach - 1)) + half * Math.sin(angle);
  const near = clamp(
    (((box.stage / 2 - Math.max(10, 0.05 * box.card)) * (depth - edgeZ)) / depth - half * Math.cos(angle)) / (1 + (reach - 1) * 0.46),
    0.4 * box.card,
    0.8 * box.card,
  );
  const layout: Layout = { reach, near, far: 0.46 * near };

  const position = useMotionValue(initial);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sizerRef = useRef<HTMLDivElement | null>(null);
  const target = useRef(initial);
  const settled = useRef(initial);
  const drag = useRef<Drag | null>(null);
  const skipPick = useRef(false);
  const animation = useRef<{ stop: () => void } | null>(null);
  const wheel = useRef({ timer: 0, samples: [] as { t: number; p: number }[] });
  const origin = useRef(initial);

  const announce = useCallback(
    (next: number, speak: boolean) => {
      if (next !== settled.current) {
        settled.current = next;
        setActiveIndex(next);
        onIndexChange?.(next);
      }
      if (speak && items[next]) setAnnouncement(`${items[next].title}, ${next + 1} of ${count}`);
    },
    [count, items, onIndexChange],
  );

  const moveTo = useCallback(
    (next: number, transition: ReturnType<typeof springFor>, speak = true) => {
      const clamped = clamp(next, 0, max);
      target.current = clamped;
      announce(clamped, speak);
      animation.current?.stop();
      if (reduced) position.jump(clamped);
      else animation.current = animate(position, clamped, transition);
    },
    [announce, max, position, reduced],
  );

  const step = useCallback(
    (direction: number, speak = true) => {
      const next = clamp(target.current + direction, 0, max);
      moveTo(next, springFor(next - position.get(), position.getVelocity(), 17), speak);
    },
    [max, moveTo, position],
  );

  /** Thrown or stepped: pick the card the gesture is heading for, then spring there. */
  const settle = useCallback(
    (velocity: number) => {
      const from = position.get();
      let next = clamp(Math.round(from + (velocity / 1000) * 0.997 / 0.0030000000000000027), 0, max);
      const start = Math.round(origin.current);
      if (Math.abs(velocity) > 1.6 && next === start) next = clamp(start + Math.sign(velocity), 0, max);
      const delta = next - from;
      const stiffness = Math.abs(delta) > 0.05 && Math.sign(delta) === Math.sign(velocity) ? clamp(Math.abs(velocity / delta), 8, 18) : 13;
      moveTo(next, springFor(delta, velocity, stiffness));
    },
    [max, moveTo, position],
  );

  const release = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const current = drag.current;
      if (!current || current.pointer !== event.pointerId) return;
      drag.current = null;
      stageRef.current?.removeAttribute("data-dragging");
      if (!current.dragging) {
        if (current.caught) settle(0);
        return;
      }
      skipPick.current = true;
      if (reduced) {
        const travel = event.clientX - current.x;
        if (Math.abs(travel) > 40 && event.type !== "pointercancel") step(travel < 0 ? 1 : -1);
        return;
      }
      settle(event.type === "pointercancel" ? 0 : speedOf(current.samples, event.timeStamp));
    },
    [reduced, settle, step],
  );

  const pick = (next: number) => {
    if (skipPick.current) {
      skipPick.current = false;
      return;
    }
    if (next !== target.current) moveTo(next, springFor(next - position.get(), position.getVelocity(), 17));
  };

  // The live handlers the wheel listener reads, so the listener can stay attached for the life of the stage.
  const live = useRef({ reduced, layout, max, settle, step, position });
  live.current = { reduced, layout, max, settle, step, position };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const sizer = sizerRef.current;
    if (!stage || !sizer) return;
    const measure = () => {
      const next = { stage: stage.clientWidth || 720, card: sizer.offsetWidth || 232 };
      setBox(current => (current.stage === next.stage && current.card === next.card ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, []);

  // A drag or a live wheel gesture owns the index until it lets go, so the ticks never flicker mid gesture.
  useInsertionEffect(
    () =>
      position.on("change", value => {
        if (drag.current?.dragging || wheel.current.timer) announce(clamp(Math.round(value), 0, max), false);
      }),
    [position, announce, max],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      const state = live.current;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || drag.current) return;
      event.preventDefault();
      const samples = wheel.current;
      animation.current?.stop();
      state.position.stop();
      if (state.reduced) {
        if (!samples.timer) state.step(event.deltaX > 0 ? 1 : -1);
        window.clearTimeout(samples.timer);
        samples.timer = window.setTimeout(() => {
          samples.timer = 0;
        }, 260);
        return;
      }
      const next = state.position.get() + event.deltaX / (1.4 * state.layout.near);
      const clamped = next < 0 ? Math.max(next, rubber(next)) : next > state.max ? Math.min(next, state.max + rubber(next - state.max)) : next;
      state.position.set(clamped);
      samples.samples.push({ t: event.timeStamp, p: clamped });
      if (samples.samples.length > 10) samples.samples.shift();
      window.clearTimeout(samples.timer);
      samples.timer = window.setTimeout(() => {
        const list = samples.samples;
        const last = list[list.length - 1];
        const first = list.find(sample => last.t - sample.t < 120) ?? last;
        const velocity = last.t > first.t ? ((last.p - first.p) / (last.t - first.t)) * 1000 : 0;
        samples.samples = [];
        samples.timer = 0;
        origin.current = state.position.get();
        state.settle(clamp(0.6 * velocity, -12, 12));
      }, 90);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => window.clearTimeout(wheel.current.timer), []);

  useEffect(() => {
    if (index === undefined) return;
    const next = clamp(Math.round(index), 0, max);
    if (next !== settled.current) moveTo(next, springFor(next - position.get(), position.getVelocity(), 17), false);
  }, [index, max, moveTo, position]);

  const thumb = useTransform(position, value => `translate3d(${round(16 * clamp(value, -0.4, max + 0.4), 2)}px, 0, 0)`);

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-roledescription="carousel"
      aria-label={label}
      data-reduced={reduced || undefined}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === "ArrowRight") step(1);
          else if (event.key === "ArrowLeft") step(-1);
          else if (event.key === "Home") moveTo(0, springFor(-position.get(), position.getVelocity(), 17));
          else if (event.key === "End") moveTo(max, springFor(max - position.get(), position.getVelocity(), 17));
          else return;
          event.preventDefault();
        }}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary || drag.current) return;
          skipPick.current = false;
          const caught = !reduced && position.isAnimating();
          if (caught) {
            animation.current?.stop();
            position.stop();
          }
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            start: position.get(),
            dragging: false,
            caught,
            samples: [{ t: event.timeStamp, p: position.get() }],
          };
          origin.current = position.get();
        }}
        onPointerMove={event => {
          const current = drag.current;
          if (!current || current.pointer !== event.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          if (!current.dragging) {
            if (6 > Math.abs(dx) || Math.abs(dx) < Math.abs(dy)) {
              if (Math.abs(dy) > 10) drag.current = null;
              return;
            }
            current.dragging = true;
            current.x = event.clientX;
            event.currentTarget.setPointerCapture(event.pointerId);
            stageRef.current?.setAttribute("data-dragging", "");
            return;
          }
          if (reduced) return;
          const next = current.start - (event.clientX - current.x) / near;
          const clamped = next < 0 ? rubber(next) : next > max ? max + rubber(next - max) : next;
          position.set(clamped);
          current.samples.push({ t: event.timeStamp, p: clamped });
          if (current.samples.length > 12) current.samples.shift();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onDragStart={event => event.preventDefault()}
      >
        <div ref={sizerRef} className={styles.sizer} aria-hidden="true" />
        {items.map((item, itemIndex) => (
          <Card
            key={item.id}
            item={item}
            index={itemIndex}
            count={count}
            active={itemIndex === activeIndex}
            position={position}
            layout={layout}
            width={box.card}
            onPick={pick}
          />
        ))}
      </div>
      <div className={styles.footer}>
        <div className={styles.caption}>
          {items.map((item, itemIndex) => (
            <CaptionItem key={item.id} index={itemIndex} position={position} active={itemIndex === activeIndex}>
              {renderCaption ? (
                renderCaption(item, itemIndex)
              ) : (
                <>
                  <p className={styles.title}>{item.title}</p>
                  {(item.subtitle || item.meta) && <p className={styles.subtitle}>{[item.subtitle, item.meta].filter(Boolean).join(", ")}</p>}
                </>
              )}
            </CaptionItem>
          ))}
        </div>
        <div className={styles.ticks} role="group" aria-label={`${label} position`}>
          {items.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              className={styles.tick}
              aria-label={`Show ${item.title}`}
              aria-current={itemIndex === activeIndex || undefined}
              tabIndex={-1}
              onClick={() => moveTo(itemIndex, springFor(itemIndex - position.get(), position.getVelocity(), 17))}
            />
          ))}
          <motion.span className={styles.thumb} style={{ transform: thumb }} aria-hidden="true" />
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}

export default CoverFlow;
