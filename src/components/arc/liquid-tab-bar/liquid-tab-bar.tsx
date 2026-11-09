"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { MotionStyle, MotionValue } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./liquid-tab-bar.module.css";

export interface LiquidTab {
  value: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
  badge?: number;
  badgeLabel?: string;
}

export interface LiquidTabBarProps {
  tabs: readonly LiquidTab[];
  value: string;
  onValueChange: (value: string) => void;
  /** `active` opens only the selected label, `always` keeps every label open, `none` is icons only. */
  labels?: "active" | "always" | "none";
  label?: string;
  id?: string;
  className?: string;
}

export const liquidTabId = (id: string, value: string) => `${id}-tab-${value}`;
export const liquidPanelId = (id: string, value: string) => `${id}-panel-${value}`;

const { spring } = motionTokens;

/** Motion ships duration/bounce; the lens needs real stiffness numbers, so convert once here. */
function springTo(visualDuration: number, bounce: number) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return {
    type: "spring" as const,
    stiffness: omega * omega,
    damping: 2 * (1 - bounce) * omega,
    mass: 1,
    restDelta: 5e-4,
    restSpeed: 0.02,
  };
}

const MORPH = springTo(spring.morph.visualDuration, spring.morph.bounce);
/** The outgoing label leaves at once; the incoming one only fades in as the lens arrives. */
const LABEL_OUT = { duration: 0.8 * motionTokens.duration.instant, ease: "easeOut" as const };
/** The lens leads the finger on the way out and trails it on the way back. */
const FOLLOW_OUT = springTo(0.07, 0);
const FOLLOW_BACK = springTo(0.2, 0);
const LEAN = springTo(spring.snappy.visualDuration, 0);
const LIFT = springTo(0.2, 0);
const JUMP = { duration: 0 } as const;
const RELEASE_LIFT = springTo(0.4, 0);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Rubber band: the further past the end, the harder it pulls back. */
const resist = (delta: number, tension = 0.45, give = 0.55) =>
  (delta * tension * give) / (tension + give * Math.abs(delta));

interface Layout {
  lefts: number[];
  widths: number[];
  total: number;
}

/** Slots sit 2px apart inside 4px of padding, so the bar always ends 4px past the last slot. */
function layoutOf(widths: readonly number[]): Layout {
  const lefts: number[] = [];
  let cursor = 4;
  for (const width of widths) {
    lefts.push(cursor);
    cursor += width + 2;
  }
  return { lefts, widths: [...widths], total: cursor - 2 + 4 };
}

/** Fractional index → interpolated slot, extrapolating past either end so the lens can lead a drag. */
function slotAt({ lefts, widths }: Layout, index: number) {
  const last = lefts.length - 1;
  if (last < 0) return { left: 4, width: 44 };
  if (index <= 0) return { left: lefts[0] + index * (widths[0] + 2), width: widths[0] };
  if (index >= last) return { left: lefts[last] + (index - last) * (widths[last] + 2), width: widths[last] };
  const whole = Math.floor(index);
  const fraction = index - whole;
  return {
    left: lefts[whole] + fraction * (lefts[whole + 1] - lefts[whole]),
    width: widths[whole] + fraction * (widths[whole + 1] - widths[whole]),
  };
}

/** Pixel offset → fractional index, matched by slot centres so a drag follows the finger. */
function indexAt({ lefts, widths }: Layout, offset: number) {
  const centres = lefts.map((left, index) => left + widths[index] / 2);
  const last = centres.length - 1;
  if (last <= 0) return 0;
  if (offset <= centres[0]) return (offset - centres[0]) / (centres[1] - centres[0]);
  if (offset >= centres[last]) return last + (offset - centres[last]) / (centres[last] - centres[last - 1]);
  for (let index = 0; index < last; index += 1) {
    if (offset <= centres[index + 1]) {
      return index + (offset - centres[index]) / (centres[index + 1] - centres[index]);
    }
  }
  return last;
}

const subscribeHydration = () => () => {};

function Digit({ digit, reduced }: { digit: number; reduced: boolean }) {
  return (
    <span className={styles.digit}>
      <motion.span
        className={styles.column}
        initial={false}
        animate={{ y: `${-(10 * digit)}%` }}
        transition={reduced ? JUMP : spring.snappy}
      >
        {"0123456789".split("").map((glyph) => (
          <span key={glyph}>{glyph}</span>
        ))}
      </motion.span>
    </span>
  );
}

function Badge({ count, reduced, inverted }: { count: number; reduced: boolean; inverted?: boolean }) {
  const text = count > 99 ? "99" : String(count);
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key="badge"
          className={styles.badge}
          data-inverted={inverted || undefined}
          aria-hidden="true"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, width: 10 + 7 * text.length }}
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.6, transition: { duration: motionTokens.duration.fast } }
          }
          transition={
            reduced
              ? { duration: motionTokens.duration.instant }
              : { ...spring.snappy, opacity: { duration: motionTokens.duration.fast } }
          }
        >
          {text.split("").map((glyph, index) => (
            <Digit key={text.length - index} digit={Number(glyph)} reduced={reduced} />
          ))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

interface TabSlotProps {
  tab: LiquidTab;
  open: MotionValue<number>;
  show: MotionValue<number>;
  labelWidth: number;
  labels: NonNullable<LiquidTabBarProps["labels"]>;
  inverted: boolean;
  reduced: boolean;
  selected: boolean;
  baseId: string;
  setRef: (node: HTMLButtonElement | null) => void;
  onClick: () => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onHover: () => void;
}

/** One tab, rendered twice: once as the real button and once as the inverted copy inside the lens. */
function TabSlot({
  tab,
  open,
  show,
  labelWidth,
  labels,
  inverted,
  reduced,
  selected,
  baseId,
  setRef,
  onClick,
  onPointerDown,
  onHover,
}: TabSlotProps) {
  const width = useTransform(open, (value) => (labels === "none" ? 44 : 44 + (10 + labelWidth) * value));
  const labelOpacity = useTransform(() => clamp((open.get() - 0.9) / 0.1, 0, 1) * show.get());
  const labelX = useTransform(open, (value) => (reduced ? 0 : -((1 - clamp(value, 0, 1)) * 4)));
  const badged = tab.badge !== undefined ? true : undefined;
  const showsLabel = labels === "always" || (labels === "active" && inverted);

  const content = (
    <>
      <span className={styles.icon}>
        {inverted ? (tab.activeIcon ?? <span className={styles.filled}>{tab.icon}</span>) : tab.icon}
      </span>
      {tab.badge !== undefined && (
        <span className={styles.badgeAnchor}>
          <Badge count={tab.badge} reduced={reduced} inverted={inverted} />
        </span>
      )}
      {showsLabel && (
        <motion.span className={styles.label} style={{ opacity: labelOpacity, x: labelX }}>
          {tab.label}
        </motion.span>
      )}
    </>
  );

  if (inverted) {
    return (
      <motion.span className={styles.tab} data-badged={badged} style={{ width }}>
        {content}
      </motion.span>
    );
  }

  const badgeSuffix = tab.badge ? `, ${tab.badgeLabel ?? tab.badge}` : "";
  return (
    <motion.button
      ref={setRef}
      type="button"
      role="tab"
      id={liquidTabId(baseId, tab.value)}
      aria-controls={liquidPanelId(baseId, tab.value)}
      aria-selected={selected}
      aria-label={`${tab.label}${badgeSuffix}`}
      tabIndex={selected ? 0 : -1}
      className={styles.tab}
      data-selected={selected || undefined}
      data-badged={badged}
      style={{ width }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover();
      }}
    >
      {content}
    </motion.button>
  );
}

interface DragSession {
  pointer: number;
  x: number;
  grab: number;
  last: number;
  dragging: boolean;
  direction: number;
  history: { t: number; p: number }[];
}

export function LiquidTabBar({
  tabs,
  value,
  onValueChange,
  labels = "active",
  label = "Sections",
  id,
  className,
}: LiquidTabBarProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced) && hydrated;

  const count = tabs.length;
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const drag = useRef<DragSession | null>(null);
  const consumedClick = useRef(false);

  const [labelWidths, setLabelWidths] = useState<number[]>([]);
  const [held, setHeld] = useState(false);

  const [openMap] = useState(() => new Map<string, MotionValue<number>>());
  const [showMap] = useState(() => new Map<string, MotionValue<number>>());

  const initialOpen = (index: number) =>
    labels === "always" || (labels === "active" && index === selectedIndex) ? 1 : 0;

  const openValues = tabs.map((tab, index) => {
    let open = openMap.get(tab.value);
    if (!open) {
      open = motionValue(initialOpen(index));
      openMap.set(tab.value, open);
    }
    return open;
  });

  const showValues = tabs.map((tab, index) => {
    let show = showMap.get(tab.value);
    if (!show) {
      show = motionValue(initialOpen(index));
      showMap.set(tab.value, show);
    }
    return show;
  });

  const from = useMotionValue(selectedIndex);
  const to = useMotionValue(selectedIndex);
  const lean = useMotionValue(0);
  const lift = useMotionValue(0);

  const slotWidth = (index: number, open: number) =>
    labels === "none" ? 44 : 44 + (10 + (labelWidths[index] ?? 0)) * clamp(open, 0, 1);

  const currentLayout = () => layoutOf(openValues.map((open, index) => slotWidth(index, open.get())));

  /** Two edges, one clipping window: what is between them is the lens, what is outside stays glass. */
  const clipPath = useTransform(() => {
    const layout = layoutOf(openValues.map((open, index) => slotWidth(index, open.get())));
    const startIndex = from.get();
    const endIndex = to.get();
    const hover = lean.get();
    const raised = lift.get();
    const left = slotAt(layout, Math.min(startIndex, endIndex) + Math.min(hover, 0));
    const right = slotAt(layout, Math.max(startIndex, endIndex) + Math.max(hover, 0));
    const outset = 2 * raised;
    return `inset(${round2(4 + outset)}px ${round2(layout.total - (right.left + right.width) + outset)}px ${round2(4 + outset)}px ${round2(left.left + outset)}px round ${round2(20 - outset)}px)`;
  });

  const width = useTransform(() => layoutOf(openValues.map((open, index) => slotWidth(index, open.get()))).total);

  function select(index: number, focus = false) {
    const tab = tabs[index];
    if (!tab) return;
    if (focus) tabRefs.current[index]?.focus({ preventScroll: true });
    if (tab.value !== value) onValueChange(tab.value);
  }

  function hoverTo(index: number | null) {
    if (reduced || drag.current?.dragging) return;
    const target = index === null ? 0 : 0.14 * clamp(index - selectedIndex, -1, 1);
    animate(lean, target, LEAN);
  }

  function offsetOf(clientX: number) {
    return clientX - (barRef.current?.getBoundingClientRect().left ?? 0);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const session = drag.current;
    if (!session || session.pointer !== event.pointerId) return;
    drag.current = null;
    animate(lift, 0, RELEASE_LIFT);
    if (!session.dragging) return;
    setHeld(false);
    consumedClick.current = true;

    // Velocity from the last 90 ms of travel, projected forward with the same 0.993 friction the lens uses.
    const recent = session.history.filter((entry) => event.timeStamp - entry.t < 90);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const velocity =
      first && last && last.t > first.t && event.timeStamp - last.t < 60
        ? ((last.p - first.p) / (last.t - first.t)) * 1000
        : 0;
    let projected = clamp(
      Math.round(session.last + ((velocity / 1000) * 0.993) / (1 - 0.993)),
      0,
      count - 1,
    );
    // A flick always moves at least one tab, even when the projection lands back where it started.
    if (projected === selectedIndex && Math.abs(velocity) > 4) {
      projected = clamp(selectedIndex + Math.sign(velocity), 0, count - 1);
    }
    animate(from, projected, { ...MORPH, velocity: from.getVelocity() });
    animate(to, projected, { ...MORPH, velocity: to.getVelocity() });
    select(projected);
  }

  // Label widths decide the open slot, so measure them before paint and only re-render on a real change.
  useLayoutEffect(() => {
    const measure = () => {
      const widths = measureRefs.current.slice(0, count).map((node) => Math.ceil(node?.offsetWidth ?? 0));
      setLabelWidths((previous) =>
        previous.length === widths.length && previous.every((entry, index) => entry === widths[index])
          ? previous
          : widths,
      );
    };
    measure();
    // Web fonts land after the first paint; measure again so the open slot matches the real glyph widths.
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
    };
  }, [count, tabs]);

  useEffect(() => {
    tabs.forEach((tab, index) => {
      const open = openMap.get(tab.value);
      if (!open) return;
      const target = labels === "always" || (labels === "active" && index === selectedIndex) ? 1 : 0;
      if (reduced) open.jump(target);
      else animate(open, target, MORPH);
      const show = showMap.get(tab.value);
      // The label appears only once the lens has almost arrived, so it never rides in on a half-open slot.
      if (show) {
        if (reduced || target === 1) show.jump(target);
        else animate(show, 0, LABEL_OUT);
      }
    });

    if (reduced) lean.jump(0);
    else animate(lean, 0, LEAN);

    if (drag.current?.dragging) return;
    if (reduced) {
      from.jump(selectedIndex);
      to.jump(selectedIndex);
      return;
    }
    animate(from, selectedIndex, MORPH);
    animate(to, selectedIndex, MORPH);
  }, [selectedIndex, labels, lean, from, openMap, reduced, to, showMap, tabs]);

  const renderSlots = (inverted: boolean) =>
    tabs.map((tab, index) => (
      <TabSlot
        key={tab.value}
        tab={tab}
        open={openValues[index]}
        show={showValues[index]}
        labelWidth={labelWidths[index] ?? 0}
        labels={labels}
        inverted={inverted}
        reduced={reduced}
        selected={index === selectedIndex}
        baseId={baseId}
        setRef={(node) => {
          if (!inverted) tabRefs.current[index] = node;
        }}
        onClick={() => {
          if (consumedClick.current) {
            consumedClick.current = false;
            return;
          }
          select(index);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          consumedClick.current = false;
          if (index !== selectedIndex) {
            hoverTo(index);
            return;
          }
          if (reduced) return;
          const at = indexAt(currentLayout(), offsetOf(event.clientX));
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            grab: at - (from.get() + to.get()) / 2,
            last: at,
            dragging: false,
            direction: 0,
            history: [{ t: event.timeStamp, p: at }],
          };
          animate(lift, 1, LIFT);
          animate(lean, 0, LEAN);
        }}
        onHover={() => hoverTo(index)}
      />
    ));

  const barStyle = {
    "--liquid-pad": "4px",
    "--liquid-gap": "2px",
    "--liquid-height": "40px",
    "--liquid-slot": "44px",
    width,
  } as MotionStyle;

  return (
    <motion.div
      ref={barRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={[styles.bar, className].filter(Boolean).join(" ")}
      style={barStyle}
      data-held={held || undefined}
      data-reduced={reduced || undefined}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
        let next: number;
        if (event.key in step) next = (selectedIndex + step[event.key] + count) % count;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = count - 1;
        else return;
        event.preventDefault();
        select(next, true);
      }}
      onPointerMove={(event) => {
        const session = drag.current;
        if (!session || session.pointer !== event.pointerId) return;
        if (!session.dragging) {
          if (Math.abs(event.clientX - session.x) < 5) return;
          session.dragging = true;
          setHeld(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const raw = indexAt(currentLayout(), offsetOf(event.clientX)) - session.grab;
        const next = raw < 0 ? resist(raw) : raw > count - 1 ? count - 1 + resist(raw - count + 1) : raw;
        const delta = next - session.last;
        if (Math.abs(delta) > 0.002) session.direction = Math.sign(delta);
        session.last = next;
        session.history.push({ t: event.timeStamp, p: next });
        if (session.history.length > 8) session.history.shift();
        animate(from, next, session.direction < 0 ? FOLLOW_OUT : FOLLOW_BACK);
        animate(to, next, session.direction > 0 ? FOLLOW_OUT : FOLLOW_BACK);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => hoverTo(null)}
    >
      <div className={styles.row}>{renderSlots(false)}</div>
      <motion.div className={styles.lens} style={{ clipPath }} aria-hidden="true">
        <div className={styles.row}>{renderSlots(true)}</div>
      </motion.div>
      <div className={styles.measure} aria-hidden="true">
        {tabs.map((tab, index) => (
          <span
            key={tab.value}
            ref={(node) => {
              measureRefs.current[index] = node;
            }}
            className={styles.label}
            data-badged={tab.badge !== undefined || undefined}
          >
            {tab.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export default LiquidTabBar;
