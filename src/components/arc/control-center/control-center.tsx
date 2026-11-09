"use client";

/**
 * Control center: workspace quick settings that morph from a tile grid into a detail panel.
 *
 * Tiles toggle directly (Focus starts the first mode), the chevron opens a detail that shares
 * its layout with the tile it grew out of, the duration dial counts across twelve o'clock, and
 * both meters rubber-band past their limits before snapping back.
 */

import {
  Bell,
  BellOff,
  ChevronRight,
  MonitorUp,
  Presentation,
  Type,
  Volume1,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motionTokens } from "../motion-tokens";
import styles from "./control-center.module.css";

const { blur, duration, ease, spring } = motionTokens;
const ENTER = [...ease.enter] as [number, number, number, number];
/** Thumb travel: a short spring that never overshoots its 16px track. */
const THUMB_SPRING = { type: "spring", visualDuration: 0.3, bounce: 0 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Rubber-band resistance: the further past the limit, the less the overflow is worth. */
function rubber(overflow: number, room: number, factor = 0.55): number {
  const sign = Math.sign(overflow);
  const distance = Math.abs(overflow);
  return (distance * room * factor * sign) / (room + factor * distance);
}

const defaultFormatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export interface FocusMode {
  /** Stable id, echoed in `onStateChange` and used as the listbox key. */
  id: string;
  /** Label shown on the tile and in the mode strip. */
  label: string;
  /** Lucide icon rendered in the tile and the detail head. */
  icon: LucideIcon;
  /** One line under the mode strip, swapped with a blur when the mode changes. */
  description?: string;
  /** Minutes the dial starts at for this mode. */
  defaultMinutes?: number;
}

export interface ControlCenterChannel {
  /** Stable id, the key inside `state.channels`. */
  id: string;
  /** Row label. */
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Whether the channel starts on. Defaults to true. */
  defaultOn?: boolean;
}

export interface ControlCenterPerson {
  /** Stable id. */
  id: string;
  /** Full name; the first name is used in the summary line. */
  name: string;
  /** Avatar image url. */
  avatar: string;
}

export interface ControlCenterState {
  /** Running focus session, or null when the tile is off. */
  focus: { mode: string; minutes: number; until: string } | null;
  /** Master notifications switch. */
  notifications: boolean;
  /** Per-channel overrides, keyed by channel id. */
  channels: Record<string, boolean>;
  /** Presenting tile. */
  presenting: boolean;
  /** Alert volume, 0–100. */
  volume: number;
  /** Text size percentage, 85–130. */
  textSize: number;
}

export interface ControlCenterProps {
  /** Focus modes offered in the detail. The first one backs the tile when nothing is running. */
  focusModes: FocusMode[];
  /** Notification channels listed in the notifications detail. */
  channels: ControlCenterChannel[];
  /** People shown at the bottom of the notifications detail. */
  people?: ControlCenterPerson[];
  /** Starting alert volume, clamped to 0–100. Defaults to 60. */
  defaultVolume?: number;
  /** Starting text size percentage, clamped to 85–130. Defaults to 100. */
  defaultTextSize?: number;
  /** Formats a session end time for the tile and the dial. Defaults to en-US h:mm. */
  formatTime?: (date: Date) => string;
  /** Called with the whole state object after every change. */
  onStateChange?: (state: ControlCenterState) => void;
  /** Accessible name of the panel. Defaults to "Quick settings". */
  label?: string;
  /** Extra class names for the panel. */
  className?: string;
}

/** Icon that crossfades and scales when its `swapKey` changes. */
function IconSwap({ icon: Icon, swapKey, size = 20 }: { icon: LucideIcon; swapKey: string; size?: number }) {
  return (
    <span className={styles.swap} style={{ width: size, height: size }} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={swapKey}
          className={styles.swapPhase}
          initial={{ opacity: 0, scale: 0.7, filter: `blur(${blur.subtle}px)` }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            scale: 0.7,
            filter: `blur(${blur.subtle}px)`,
            transition: { duration: duration.instant },
          }}
          transition={{
            scale: spring.snappy,
            opacity: { duration: duration.fast },
            filter: { duration: duration.fast },
          }}
        >
          <Icon size={size} strokeWidth={1.75} />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Status line that rolls up and out whenever the text changes. */
function RollText({ text }: { text: ReactNode }) {
  return (
    <span className={styles.roll}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={typeof text === "string" ? text : undefined}
          className={styles.rollPhase}
          initial={{ opacity: 0, y: "0.6em", filter: `blur(${blur.subtle}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            y: "-0.6em",
            filter: `blur(${blur.subtle}px)`,
            transition: { duration: duration.instant },
          }}
          transition={{ duration: duration.standard, ease: ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface TileProps {
  id: string;
  icon: LucideIcon;
  iconKey: string;
  title: string;
  status: string;
  active: boolean;
  wide?: boolean;
  open: boolean;
  onPress: () => void;
  onExpand?: () => void;
  expandLabel?: string;
  registerExpand: (node: HTMLButtonElement | null) => void;
}

function Tile({ id, icon, iconKey, title, status, active, wide, open, onPress, onExpand, expandLabel, registerExpand }: TileProps) {
  return (
    <div className={styles.slot} data-wide={wide || undefined}>
      {!open && (
        <motion.div
          layoutId={`cc-${id}`}
          className={styles.tile}
          data-active={active || undefined}
          style={{ borderRadius: 22 }}
          whileTap={{ scale: 0.975 }}
          transition={spring.morph}
        >
          <button type="button" className={styles.tileMain} aria-pressed={active} onClick={onPress}>
            <motion.span layoutId={`cc-${id}-icon`} layout="position" className={styles.tileIcon}>
              <IconSwap icon={icon} swapKey={iconKey} />
            </motion.span>
            <span className={styles.tileText}>
              <motion.span layoutId={`cc-${id}-title`} layout="position" className={styles.tileTitle}>
                {title}
              </motion.span>
              <motion.span layout="position" className={styles.tileStatus}>
                <RollText text={status} />
              </motion.span>
            </span>
          </button>
          {onExpand && (
            <motion.button
              layoutId={`cc-${id}-action`}
              layout="position"
              ref={registerExpand}
              type="button"
              className={styles.tileExpand}
              aria-label={expandLabel}
              aria-haspopup="dialog"
              onClick={onExpand}
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}

interface SwitchRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

function SwitchRow({ checked, onChange, label, description }: SwitchRowProps) {
  const id = useId();
  const reduced = useReducedMotion() ?? false;
  const [pressed, setPressed] = useState(false);
  const stretch = useMotionValue(1);
  const previous = useRef(checked);

  // A tick of stretch on every toggle, so the thumb reads as a physical switch.
  useEffect(() => {
    if (previous.current === checked) return;
    previous.current = checked;
    if (reduced) return;
    const controls = animate(stretch, [1, 1.16, 1], {
      duration: 0.34,
      times: [0, 0.4, 1],
      ease: ["easeOut", "easeInOut"],
    });
    return () => controls.stop();
  }, [checked, reduced, stretch]);

  /** Held thumb swells sideways, so the track grows with it. */
  const swell = pressed && !reduced ? 5 : 0;

  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <span id={`${id}-label`} className={styles.rowLabel}>
          {label}
        </span>
        {description && <span className={styles.rowDescription}>{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        className={styles.switch}
        data-on={checked || undefined}
        onClick={() => onChange(!checked)}
        onPointerDown={(event) => {
          if (event.button === 0) setPressed(true);
        }}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onKeyDown={(event) => {
          if (event.key === " ") setPressed(true);
        }}
        onKeyUp={() => setPressed(false)}
        onBlur={() => setPressed(false)}
      >
        <motion.span
          className={styles.switchThumb}
          style={{ scaleX: stretch }}
          initial={false}
          animate={{ x: checked ? 16 - swell : 0, width: 18 + swell }}
          transition={reduced ? { duration: 0 } : { x: THUMB_SPRING, width: spring.snappy }}
        />
      </button>
    </div>
  );
}

interface MeterDrag {
  pointer: number;
  x: number;
  start: number;
  width: number;
  left: number;
  /** Space the track can travel before the panel edge, used to size the rubber band. */
  room: number;
  moved: boolean;
}

interface MeterProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  segments: number;
  format: (value: number) => string;
  icon: ReactNode;
  trailing?: (progress: MotionValue<number>) => ReactNode;
  onChange: (value: number) => void;
}

function Meter({ label, value, min, max, step, segments, format, icon, trailing, onChange }: MeterProps) {
  const id = useId();
  const range = max - min;
  const reduced = useReducedMotion() ?? false;
  const progress = useMotionValue((value - min) / range);
  const overshoot = useMotionValue(0);
  const press = useMotionValue(1);
  const width = useMotionValue(240);
  const drag = useRef<MeterDrag | null>(null);

  /** Past the ends the track stretches and shifts, translating drag into resistance. */
  const stretch = useTransform(() => 1 + Math.abs(overshoot.get()) / Math.max(1, width.get()));
  const shift = useTransform(overshoot, (value) => value / 2);
  const clipPath = useTransform(progress, (value) => `inset(0 ${(1 - clamp(value, 0, 1)) * 100}% 0 0)`);
  const readout = useTransform(progress, (value) => format(Math.round((min + clamp(value, 0, 1) * range) / step) * step));

  function setValue(raw: number) {
    const next = clamp(Math.round(raw / step) * step, min, max);
    onChange(next);
    if (reduced) progress.set((next - min) / range);
    else animate(progress, (next - min) / range, spring.snappy);
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    drag.current = null;
    animate(press, 1, spring.snappy);
    if (event.type !== "pointerup" && !state.moved) return;
    animate(overshoot, 0, { type: "spring", visualDuration: 0.4, bounce: 0 });
    const ratio = state.moved
      ? progress.get()
      : clamp((event.clientX - state.left) / state.width, 0, 1);
    setValue(min + ratio * range);
  }

  // Dragging writes the rounded value back out on every change, so callers see live updates.
  useMotionValueEvent(progress, "change", (next) => {
    const snapped = Math.round((min + clamp(next, 0, 1) * range) / step) * step;
    if (drag.current && snapped !== value) onChange(snapped);
  });

  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span className={styles.meterIcon} aria-hidden="true">
          {icon}
        </span>
        <span id={`${id}-label`} className={styles.meterLabel}>
          {label}
        </span>
        {trailing?.(progress)}
        <motion.span className={styles.meterValue} aria-hidden="true">
          {readout}
        </motion.span>
      </div>
      <motion.div
        className={styles.meterTrack}
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        style={{ scaleX: stretch, scaleY: press, x: shift }}
        onPointerDown={(event) => {
          if (drag.current || event.button !== 0) return;
          const box = event.currentTarget.getBoundingClientRect();
          const panel = event.currentTarget.closest("section");
          const panelBox = panel?.getBoundingClientRect();
          const style = panel ? getComputedStyle(panel) : null;
          const inset = style
            ? (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0)
            : 0;
          const room = panelBox
            ? Math.max(0, Math.min(box.left - panelBox.left, panelBox.right - box.right) - inset)
            : 6;
          event.currentTarget.setPointerCapture(event.pointerId);
          progress.stop();
          width.set(box.width);
          if (!reduced) animate(press, 1.18, spring.snappy);
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            start: progress.get(),
            width: box.width,
            left: box.left,
            room,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.pointer !== event.pointerId) return;
          const delta = event.clientX - state.x;
          if (!state.moved && Math.abs(delta) < 3) return;
          state.moved = true;
          const next = state.start + delta / state.width;
          progress.set(clamp(next, 0, 1));
          if (reduced) return;
          if (next < 0) overshoot.set(rubber(next * state.width, state.room));
          else if (next > 1) overshoot.set(rubber((next - 1) * state.width, state.room));
          else overshoot.set(0);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(event) => {
          const steps: Record<string, number> = {
            ArrowRight: step,
            ArrowUp: step,
            ArrowLeft: -step,
            ArrowDown: -step,
            PageUp: 4 * step,
            PageDown: -4 * step,
            Home: -Infinity,
            End: Infinity,
          };
          if (!(event.key in steps)) return;
          event.preventDefault();
          const delta = steps[event.key];
          if (delta === Infinity) setValue(max);
          else if (delta === -Infinity) setValue(min);
          else setValue(clamp(value + delta, min, max));
        }}
      >
        <span className={styles.meterSegments} aria-hidden="true">
          {Array.from({ length: segments }, (_, index) => (
            <span key={index} />
          ))}
        </span>
        <motion.span className={styles.meterSegments} data-fill aria-hidden="true" style={{ clipPath }}>
          {Array.from({ length: segments }, (_, index) => (
            <span key={index} />
          ))}
        </motion.span>
      </motion.div>
    </div>
  );
}

interface DialDrag {
  pointer: number;
  angle: number;
  raw: number;
}

const DIAL_MIN = 5;
const DIAL_MAX = 120;

interface DialProps {
  minutes: number;
  onChange: (minutes: number) => void;
  until: (minutes: number) => string;
}

function Dial({ minutes, onChange, until }: DialProps) {
  const angleValue = useMotionValue(minutes);
  const overshoot = useMotionValue(0);
  const reduced = useReducedMotion() ?? false;
  const drag = useRef<DialDrag | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const knob = useTransform(() => ((angleValue.get() + overshoot.get()) / DIAL_MAX) * 360);
  const arcLength = useTransform(angleValue, (value) => value / DIAL_MAX);
  const count = useTransform(angleValue, (value) => String(Math.round(value)));
  const untilText = useTransform(angleValue, (value) => `Until ${until(5 * Math.round(value / 5))}`);

  /** Pointer angle in degrees, measured clockwise from twelve o'clock. */
  function pointerAngle(event: { clientX: number; clientY: number }) {
    const rect = box.current!.getBoundingClientRect();
    return (
      ((180 * Math.atan2(event.clientX - (rect.left + rect.width / 2), -(event.clientY - (rect.top + rect.height / 2)))) / Math.PI +
        360) %
      360
    );
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    drag.current = null;
    const snapped = clamp(5 * Math.round(angleValue.get() / 5), DIAL_MIN, DIAL_MAX);
    animate(overshoot, 0, { type: "spring", visualDuration: 0.4, bounce: 0 });
    animate(angleValue, snapped, reduced ? { duration: 0 } : spring.snappy);
    onChange(snapped);
  }

  // External changes (mode switch) spring the dial over unless a finger owns it.
  useEffect(() => {
    if (drag.current) return;
    const controls = animate(angleValue, minutes, reduced ? { duration: 0 } : spring.snappy);
    return () => controls.stop();
  }, [minutes, angleValue, reduced]);

  useMotionValueEvent(angleValue, "change", (next) => {
    const snapped = clamp(5 * Math.round(next / 5), DIAL_MIN, DIAL_MAX);
    if (drag.current && snapped !== minutes) onChange(snapped);
  });

  const ticks = Array.from({ length: 24 }, (_, index) => index);

  return (
    <div
      ref={box}
      className={styles.dial}
      role="slider"
      tabIndex={0}
      aria-label="Session length"
      aria-valuemin={DIAL_MIN}
      aria-valuemax={DIAL_MAX}
      aria-valuenow={minutes}
      aria-valuetext={`${minutes} minutes, until ${until(minutes)}`}
      onPointerDown={(event) => {
        if (drag.current || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        angleValue.stop();
        drag.current = { pointer: event.pointerId, angle: pointerAngle(event), raw: angleValue.get() };
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state || state.pointer !== event.pointerId) return;
        const next = pointerAngle(event);
        let delta = next - state.angle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        state.angle = next;
        state.raw += (delta / 360) * DIAL_MAX;
        const limited = clamp(state.raw, DIAL_MIN, DIAL_MAX);
        angleValue.set(limited);
        if (!reduced) overshoot.set(rubber(state.raw - limited, 30, 0.4));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(event) => {
        const steps: Record<string, number> = {
          ArrowRight: 5,
          ArrowUp: 5,
          ArrowLeft: -5,
          ArrowDown: -5,
          PageUp: 15,
          PageDown: -15,
          Home: -DIAL_MAX,
          End: DIAL_MAX,
        };
        if (!(event.key in steps)) return;
        event.preventDefault();
        onChange(clamp(minutes + steps[event.key], DIAL_MIN, DIAL_MAX));
      }}
    >
      <svg className={styles.dialSvg} viewBox="0 0 200 200" aria-hidden="true">
        {ticks.map((index) => {
          const major = index % 3 === 0;
          const angle = (index / ticks.length) * Math.PI * 2;
          const inner = major ? 76 : 80;
          return (
            <line
              key={index}
              className={styles.dialTick}
              data-major={major || undefined}
              x1={100 + Math.sin(angle) * inner}
              y1={100 - Math.cos(angle) * inner}
              x2={100 + 86 * Math.sin(angle)}
              y2={100 - 86 * Math.cos(angle)}
            />
          );
        })}
        <circle className={styles.dialTrack} cx="100" cy="100" r="94" />
        <motion.circle
          className={styles.dialArc}
          cx="100"
          cy="100"
          r="94"
          style={{ pathLength: arcLength, rotate: -90 }}
        />
      </svg>
      <motion.div className={styles.dialKnobArm} style={{ rotate: knob }} aria-hidden="true">
        <span className={styles.dialKnob} />
      </motion.div>
      <div className={styles.dialCenter} aria-hidden="true">
        <span className={styles.dialCount}>
          <motion.span>{count}</motion.span>
          <span className={styles.dialUnit}>min</span>
        </span>
        <motion.span className={styles.dialUntil}>{untilText}</motion.span>
      </div>
    </div>
  );
}

/** "Aa" that scales with the text size meter. */
function TextPreview({ progress }: { progress: MotionValue<number> }) {
  const scale = useTransform(progress, (value) => (85 + 45 * clamp(value, 0, 1)) / 100);
  return (
    <span className={styles.textPreview} aria-hidden="true">
      <motion.span style={{ scale }}>Aa</motion.span>
    </span>
  );
}

export function ControlCenter({
  focusModes,
  channels,
  people = [],
  defaultVolume = 60,
  defaultTextSize = 100,
  formatTime = defaultFormatTime,
  onStateChange,
  label = "Quick settings",
  className,
}: ControlCenterProps) {
  const reduced = useReducedMotion() ?? false;
  const detailId = useId();
  const [state, setState] = useState<ControlCenterState>(() => ({
    focus: null,
    notifications: true,
    channels: Object.fromEntries(channels.map((channel) => [channel.id, channel.defaultOn ?? true])),
    presenting: false,
    volume: clamp(defaultVolume, 0, 100),
    textSize: clamp(defaultTextSize, 85, 130),
  }));
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    mode: focusModes[0]?.id ?? "",
    minutes: focusModes[0]?.defaultMinutes ?? 45,
    startedAt: 0,
  });
  const expandRefs = useRef<Record<string, HTMLButtonElement | null>>({ focus: null, notifications: null });
  const detailRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastOpen = useRef<string | null>(null);

  function update(patch: Partial<ControlCenterState>) {
    const next = { ...state, ...patch };
    setState(next);
    onStateChange?.(next);
  }

  const untilFrom = (minutes: number) => formatTime(new Date(draft.startedAt + 60_000 * minutes));

  function openDetail(id: string) {
    if (id === "focus") {
      const running = state.focus;
      const mode = focusModes.find((entry) => entry.id === running?.mode) ?? focusModes[0];
      setDraft({
        mode: mode?.id ?? "",
        minutes: running?.minutes ?? mode?.defaultMinutes ?? 45,
        startedAt: Date.now(),
      });
    }
    lastOpen.current = id;
    setOpen(id);
  }

  function closeDetail() {
    setOpen(null);
  }

  // Opening parks focus on Close; closing hands it back to the chevron that opened the detail.
  useEffect(() => {
    if (open) {
      closeRef.current?.focus({ preventScroll: true });
      return;
    }
    const previous = lastOpen.current;
    if (!previous) return;
    const frame = requestAnimationFrame(() => expandRefs.current[previous]?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const runningMode = focusModes.find((entry) => entry.id === state.focus?.mode);
  const activeMode = focusModes.find((entry) => entry.id === draft.mode) ?? focusModes[0];
  const focusIcon = (open === "focus" ? activeMode : (runningMode ?? focusModes[0]))?.icon ?? MonitorUp;
  const channelCount = channels.filter((channel) => state.channels[channel.id]).length;
  const volumeIcon = state.volume === 0 ? VolumeX : state.volume < 50 ? Volume1 : Volume2;
  const detailTransition = reduced ? { duration: duration.fast } : spring.morph;

  return (
    <MotionConfig reducedMotion="user" transition={spring.morph}>
      <section className={[styles.panel, className].filter(Boolean).join(" ")} aria-label={label} data-expanded={open ? "" : undefined}>
        <LayoutGroup>
          <div className={styles.grid} aria-hidden={!!open || undefined} inert={!!open || undefined}>
            <Tile
              id="focus"
              wide
              icon={focusIcon}
              iconKey={runningMode?.id ?? "off"}
              title={runningMode ? runningMode.label : "Focus"}
              status={state.focus ? `Until ${state.focus.until}` : "Off"}
              active={!!state.focus}
              open={open === "focus"}
              onPress={() => {
                if (state.focus) {
                  update({ focus: null });
                  return;
                }
                const mode = focusModes[0];
                if (!mode) return;
                update({
                  focus: {
                    mode: mode.id,
                    minutes: mode.defaultMinutes ?? 45,
                    until: formatTime(new Date(Date.now() + 60_000 * (mode.defaultMinutes ?? 45))),
                  },
                });
              }}
              onExpand={() => openDetail("focus")}
              expandLabel="Focus session settings"
              registerExpand={(node) => {
                expandRefs.current.focus = node;
              }}
            />
            <Tile
              id="notifications"
              icon={state.notifications ? Bell : BellOff}
              iconKey={state.notifications ? "on" : "off"}
              title="Notifications"
              status={state.notifications ? `${channelCount} of ${channels.length} channels` : "Paused"}
              active={state.notifications}
              open={open === "notifications"}
              onPress={() => update({ notifications: !state.notifications })}
              onExpand={() => openDetail("notifications")}
              expandLabel="Notification channels"
              registerExpand={(node) => {
                expandRefs.current.notifications = node;
              }}
            />
            <Tile
              id="presenting"
              icon={Presentation}
              iconKey="presenting"
              title="Presenting"
              status={state.presenting ? "Previews hidden" : "Off"}
              active={state.presenting}
              open={false}
              onPress={() => update({ presenting: !state.presenting })}
              registerExpand={() => {}}
            />
            <div className={styles.meters}>
              <Meter
                label="Alert volume"
                value={state.volume}
                min={0}
                max={100}
                step={1}
                segments={28}
                format={(value) => `${value}%`}
                icon={
                  <IconSwap
                    icon={volumeIcon}
                    swapKey={state.volume === 0 ? "mute" : state.volume < 50 ? "low" : "high"}
                    size={16}
                  />
                }
                onChange={(volume) => update({ volume })}
              />
              <Meter
                label="Text size"
                value={state.textSize}
                min={85}
                max={130}
                step={5}
                segments={28}
                format={(value) => `${value}%`}
                icon={<Type size={16} strokeWidth={1.75} />}
                trailing={(progress) => <TextPreview progress={progress} />}
                onChange={(textSize) => update({ textSize })}
              />
            </div>
          </div>
          <AnimatePresence>
            {open && (
              <motion.div
                key="scrim"
                className={styles.scrim}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.standard }}
                onClick={closeDetail}
                aria-hidden="true"
              />
            )}
            {open && (
              <motion.div
                key={open}
                ref={detailRef}
                layoutId={`cc-${open}`}
                className={styles.detail}
                role="dialog"
                aria-modal="true"
                aria-labelledby={detailId}
                style={{ borderRadius: 22 }}
                transition={detailTransition}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    closeDetail();
                    return;
                  }
                  if (event.key !== "Tab" || !detailRef.current) return;
                  const focusable = [...detailRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")];
                  if (!focusable.length) return;
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                  }
                }}
              >
                <div className={styles.detailHead}>
                  <motion.span
                    layoutId={`cc-${open}-icon`}
                    layout="position"
                    className={styles.tileIcon}
                    data-active={open === "focus" || state.notifications || undefined}
                  >
                    {open === "focus" ? (
                      <IconSwap icon={activeMode?.icon ?? MonitorUp} swapKey={draft.mode} />
                    ) : (
                      <IconSwap icon={state.notifications ? Bell : BellOff} swapKey={state.notifications ? "on" : "off"} />
                    )}
                  </motion.span>
                  <motion.h3 layoutId={`cc-${open}-title`} layout="position" id={detailId} className={styles.detailTitle}>
                    {open === "focus" ? "Focus" : "Notifications"}
                  </motion.h3>
                  <motion.button
                    layoutId={`cc-${open}-action`}
                    layout="position"
                    ref={closeRef}
                    type="button"
                    className={styles.close}
                    aria-label="Close"
                    onClick={closeDetail}
                  >
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                </div>
                <motion.div
                  layout="position"
                  className={styles.detailBody}
                  initial={{ opacity: 0, y: 10 * (reduced ? 0 : 1) }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      delay: 0.08 * (reduced ? 0 : 1),
                      duration: duration.standard,
                      ease: ENTER,
                    },
                  }}
                  exit={{ opacity: 0, transition: { duration: duration.instant } }}
                >
                  {open === "focus" ? (
                    <>
                      <div className={styles.modes} role="radiogroup" aria-label="Mode">
                        {focusModes.map((mode) => {
                          const checked = mode.id === draft.mode;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              role="radio"
                              aria-checked={checked}
                              className={styles.mode}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  mode: mode.id,
                                  minutes:
                                    current.mode === mode.id ? current.minutes : (mode.defaultMinutes ?? 45),
                                }))
                              }
                            >
                              {checked && (
                                <motion.span
                                  layoutId="cc-mode-highlight"
                                  className={styles.modeHighlight}
                                  transition={spring.morph}
                                />
                              )}
                              <span className={styles.modeLabel}>{mode.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className={styles.modeNote}>
                        <RollText text={activeMode?.description ?? ""} />
                      </p>
                      <Dial
                        minutes={draft.minutes}
                        until={untilFrom}
                        onChange={(minutes) => setDraft((current) => ({ ...current, minutes }))}
                      />
                      <div className={styles.actions}>
                        {state.focus && (
                          <button
                            type="button"
                            className={styles.secondary}
                            onClick={() => {
                              update({ focus: null });
                              closeDetail();
                            }}
                          >
                            End session
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.primary}
                          onClick={() => {
                            update({
                              focus: {
                                mode: draft.mode,
                                minutes: draft.minutes,
                                until: untilFrom(draft.minutes),
                              },
                            });
                            closeDetail();
                          }}
                        >
                          {state.focus ? "Update session" : "Start session"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <SwitchRow
                        label="All notifications"
                        description={state.notifications ? "Delivered as they arrive" : "Paused until you resume"}
                        checked={state.notifications}
                        onChange={(notifications) => update({ notifications })}
                      />
                      <div className={styles.channels} data-muted={!state.notifications || undefined}>
                        {channels.map((channel) => (
                          <SwitchRow
                            key={channel.id}
                            label={channel.label}
                            description={channel.description}
                            checked={state.channels[channel.id]}
                            onChange={(checked) =>
                              update({ channels: { ...state.channels, [channel.id]: checked } })
                            }
                          />
                        ))}
                      </div>
                      {people.length > 0 && (
                        <div className={styles.people}>
                          <span className={styles.avatars} aria-hidden="true">
                            {people.slice(0, 3).map((person) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={person.id} src={person.avatar} alt="" width={28} height={28} draggable={false} />
                            ))}
                          </span>
                          <span className={styles.peopleText}>
                            {people.map((person) => person.name.split(" ")[0]).join(", ")} can reach you during focus
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </section>
    </MotionConfig>
  );
}

export default ControlCenter;
