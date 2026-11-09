"use client";

/**
 * Share sheet: one shape that springs between a pill, a panel and a sent confirmation.
 *
 * The shape tracks the size of whichever face is mounted, so opening and closing reads as a single
 * surface changing state rather than three stacked cards. People fly from the recents row into the
 * recipient chips, the copy button resizes to its own label, and phones swap the inline panel for a
 * bottom sheet with a grabber you can throw away.
 */

import {
  Building2,
  Check,
  ChevronDown,
  Copy,
  Globe,
  Link2,
  Loader2,
  Lock,
  Mail,
  Share,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { motionTokens } from "../motion-tokens";
import styles from "./share-sheet.module.css";

const { blur, duration, ease, spring, stagger } = motionTokens;
const ENTER = [...ease.enter] as [number, number, number, number];
const STANDARD = [...ease.standard] as [number, number, number, number];

/** Motion's own spring solver, expressed as stiffness/damping so `animate()` can take it. */
function settleSpring(visual: number, bounce = 0) {
  const omega = (2 * Math.PI) / (1.2 * visual);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 } as const;
}

const GROW = settleSpring(0.48);
const SHRINK = settleSpring(0.38);
const CHIP = settleSpring(0.42);
const FLYER = settleSpring(0.5);
const LABEL = settleSpring(0.26);
const MANY = settleSpring(0.36);
const SHEET_IN = settleSpring(0.44);
const SHEET_OUT = settleSpring(0.32);
const COPY_SPRING = { type: "spring", visualDuration: 0.22, bounce: 0 } as const;

const VIEW_ORDER: Record<View, number> = { button: 0, panel: 1, sent: 2 };
const PHONE = "(max-width: 520px)";
const COPY_LABEL = { idle: "Copy", done: "Copied", error: "Retry" } as const;

type View = "button" | "panel" | "sent";
type CopyState = "idle" | "done" | "error";
type FocusTarget = "button" | "copy" | "done" | "access" | "option" | null;
type FaceSize = { w: number; h: number };
type FaceMap = Map<string, FaceSize>;

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readPhone = () => window.matchMedia(PHONE).matches;

/** "Emma", "Emma and Marcus", "Emma, Marcus, and 2 others". */
function describePeople(people: ShareSheetPerson[]): string {
  const first = people.map((person) => person.name.split(" ")[0]);
  if (first.length === 1) return people[0].name;
  if (first.length === 2) return `${first[0]} and ${first[1]}`;
  const rest = first.length - 2;
  return `${first[0]}, ${first[1]}, and ${rest} ${rest === 1 ? "other" : "others"}`;
}

async function writeClipboard(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

export interface ShareSheetPerson {
  /** Stable id, used for the chips and the flyer layer. */
  id: string;
  /** Full name; the first name is shown in the chip. */
  name: string;
  /** Avatar image url. */
  avatar: string;
}

export interface ShareSheetAccess {
  /** Value reported by `onCopy` and stored as the selected access. */
  value: string;
  /** Row label in the access list. */
  label: string;
  /** Second line under the label. */
  description: string;
  /** Icon shown in the trigger and the list. */
  icon: ReactNode;
}

export interface ShareSheetChannel {
  /** Stable id passed to `onChannel`. */
  id: string;
  /** Button label while idle. */
  label: string;
  /** Icon or glyph shown before the label. */
  icon: ReactNode;
  /** Label swapped in once the channel reports success. */
  doneLabel: string;
}

export interface ShareSheetProps {
  /** Document title shown in the panel header. */
  title: string;
  /** Link shown in the copy row and handed to the clipboard. */
  link: string;
  /** People offered in the recents row. */
  people: ShareSheetPerson[];
  /** Destinations listed under the access row. */
  access: ShareSheetAccess[];
  /** Direct-share buttons under the panel. */
  channels?: ShareSheetChannel[];
  /** Access value selected on first render. Defaults to the first option. */
  defaultAccess?: string;
  /** Called when Send is pressed with at least one recipient. */
  onSend?: (payload: { people: ShareSheetPerson[]; access: string }) => void | Promise<void>;
  /** Called per channel button; settle or throw to drive the button state. */
  onChannel?: (id: string) => void | Promise<void>;
  /** Called after the link lands on the clipboard, with the selected access value. */
  onCopy?: (access: string) => void;
  /** Trigger label. Defaults to "Share". */
  label?: string;
  /** Horizontal edge the shape grows from. Defaults to "end". */
  align?: "start" | "end" | "center";
  /** Below 520px, present the panel as a bottom sheet. Defaults to true. */
  sheetOnPhones?: boolean;
  /** Extra class names for the root. */
  className?: string;
}

const FACE_MOTION = {
  hidden: (direction: number) =>
    direction
      ? { opacity: 0, x: 32 * direction, scale: 1, filter: `blur(${blur.soft}px)` }
      : { opacity: 0, x: 0, scale: 0.94, filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      x: CHIP,
      scale: GROW,
      opacity: { duration: duration.standard - 0.02, ease: ENTER, delay: 0.05 },
      filter: { duration: duration.standard, ease: ENTER, delay: 0.05 },
      delayChildren: 0.05,
      staggerChildren: stagger.item,
    },
  },
  gone: (direction: number) =>
    direction
      ? {
          opacity: 0,
          x: -(32 * direction * 0.6),
          filter: `blur(${blur.soft}px)`,
          transition: {
            x: CHIP,
            opacity: { duration: duration.instant, ease: STANDARD },
            filter: { duration: duration.instant, ease: STANDARD },
          },
        }
      : {
          opacity: 0,
          scale: 0.96,
          filter: `blur(${blur.soft}px)`,
          transition: { duration: duration.instant, ease: STANDARD },
        },
};

const FACE_REDUCED = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: duration.fast } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

const STAGGER_MOTION = {
  hidden: { opacity: 0, y: -6 },
  shown: { opacity: 1, y: 0, transition: { y: MANY, opacity: { duration: 0.22, ease: ENTER } } },
};

const STAGGER_REDUCED = { hidden: { opacity: 1 }, shown: { opacity: 1 } };

interface FaceProps {
  id: string;
  direction: number;
  reduced: boolean;
  onSize: (id: string, size: FaceSize) => void;
  className?: string;
  children: ReactNode;
}

/** One face of the shape; reports its own size and goes inert while it flies out. */
function Face({ id, direction, reduced, onSize, className, children }: FaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !present) return;
    const report = () => onSize(id, { w: node.offsetWidth, h: node.offsetHeight });
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onSize, present]);

  return (
    <motion.div
      ref={ref}
      className={[styles.face, className].filter(Boolean).join(" ")}
      data-face={id}
      custom={direction}
      variants={reduced ? FACE_REDUCED : FACE_MOTION}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
    >
      {children}
    </motion.div>
  );
}

interface ChipProps {
  person: ShareSheetPerson;
  source: { x: number; y: number; w: number; h: number; t: number } | undefined;
  reduced: boolean;
  hidden: boolean;
  onLand: (rect: { left: number; top: number; width: number; height: number }) => void;
  onRemove: () => void;
}

function Chip({ person, source, reduced, hidden, onLand, onRemove }: ChipProps) {
  const avatarRef = useRef<HTMLSpanElement>(null);
  const flown = useRef(false);
  const flying = !!source && !reduced;

  // First paint after the chip lands: mark its avatar as the flyer's target.
  useLayoutEffect(() => {
    const node = avatarRef.current;
    if (flown.current || !node || !source || reduced || performance.now() - source.t > 400) return;
    flown.current = true;
    const list = node.closest("[data-chips]");
    if (list) list.scrollLeft = list.scrollWidth;
    onLand(node.getBoundingClientRect());
  }, [onLand, reduced, source]);

  const first = person.name.split(" ")[0];

  return (
    <motion.li
      layout={!reduced && "position"}
      className={styles.chip}
      transition={MANY}
      exit={{
        opacity: 0,
        scale: reduced ? 1 : 0.8,
        transition: { duration: duration.instant, ease: STANDARD },
      }}
    >
      <motion.span
        className={styles.chipFill}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.18 * Number(flying) }}
      />
      <span ref={avatarRef} className={styles.chipAvatar} data-hidden={hidden || undefined} aria-hidden="true">
        <img src={person.avatar} alt="" width={40} height={40} />
      </span>
      <motion.span
        className={styles.chipName}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          x: MANY,
          opacity: { duration: 0.2, ease: ENTER },
          delay: 0.2 * Number(flying),
        }}
      >
        {first}
      </motion.span>
      <button type="button" className={styles.chipRemove} aria-label={`Remove ${person.name}`} onClick={onRemove}>
        <X size={12} strokeWidth={2} aria-hidden="true" />
      </button>
    </motion.li>
  );
}

/** Digit roll for the "Send to N people" label. */
function CountRoll({ value, reduced }: { value: number; reduced: boolean }) {
  const [current, setCurrent] = useState(value);
  const [direction, setDirection] = useState(1);
  if (value !== current) {
    setCurrent(value);
    setDirection(value > current ? 1 : -1);
  }
  return (
    <span className={styles.count}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={current}
          className={styles.countDigit}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: reduced ? 0 : `${70 * d}%`, opacity: 0 }),
            rest: { y: 0, opacity: 1 },
            exit: (d: number) => ({ y: reduced ? 0 : `${-70 * d}%`, opacity: 0 }),
          }}
          initial="enter"
          animate="rest"
          exit="exit"
          transition={reduced ? { duration: 0.1 } : { y: LABEL, opacity: { duration: 0.14 } }}
        >
          {current}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ShareSheet({
  title,
  link,
  people,
  access,
  channels = [],
  defaultAccess,
  onSend,
  onChannel,
  onCopy,
  label = "Share",
  align = "end",
  sheetOnPhones = true,
  className,
}: ShareSheetProps) {
  const uid = useId();
  const isPhone = useSyncExternalStore(subscribePhone, readPhone, () => false);
  const sheet = sheetOnPhones && isPhone;
  const reduced = useReducedMotion() ?? false;
  const [view, setView] = useState<View>("button");
  const [direction, setDirection] = useState(0);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<string, { x: number; y: number; w: number; h: number; t: number }>>({});
  const [flyers, setFlyers] = useState<
    { id: string; key: number; src: string; from: { x: number; y: number; w: number; h: number }; to: { x: number; y: number; w: number; h: number } }[]
  >([]);
  const [selectedAccess, setSelectedAccess] = useState(defaultAccess ?? access[0]?.value ?? "");
  const [accessOpen, setAccessOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [channelState, setChannelState] = useState<Record<string, "idle" | "busy" | "done" | "error">>({});
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [status, setStatus] = useState({ id: 0, text: "" });

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const accessRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<FocusTarget>(null);
  const sizers = useRef<Record<string, HTMLSpanElement | null>>({});
  const sizes = useRef<FaceMap>(new Map());
  const dragControls = useDragControls();

  const shapeW = useMotionValue<string | number>("100%");
  const shapeH = useMotionValue<string | number>("100%");
  const shapeRadius = useMotionValue<string | number>(9999);
  const sheetH = useMotionValue<string | number>("auto");
  const copyWidth = useMotionValue<string | number>("auto");

  const motionState = useRef({
    view: "button" as View,
    reduced: false,
    measured: false,
    settled: true,
    last: { w: 0, h: 0 },
    run: {} as object,
    sheet: false,
    sheetShown: false,
  });

  const announce = (text: string) => setStatus((current) => ({ id: current.id + 1, text }));

  const applySize = useCallback(
    (animated: boolean) => {
      const state = motionState.current;
      if (state.sheet) {
        const face = sizes.current.get("button");
        if (face?.w) {
          shapeW.jump(face.w);
          shapeH.jump(face.h);
          shapeRadius.jump(face.h / 2);
        }
        if (state.view === "button") {
          state.sheetShown = false;
          return;
        }
        const target = sizes.current.get(state.view);
        if (!target?.h) return;
        if (!state.sheetShown || state.reduced || (!animated && state.settled)) {
          sheetH.jump(target.h);
          state.sheetShown = true;
          return;
        }
        const run = {};
        state.run = run;
        state.settled = false;
        animate(sheetH, target.h, MANY).then(() => {
          if (state.run === run) state.settled = true;
        });
        return;
      }

      const size = sizes.current.get(state.view);
      if (!size || !size.w) return;
      const targetRadius = state.view === "button" ? size.h / 2 : state.view === "sent" ? 26 : 28;
      const previous = state.last;
      if (!animated && Math.abs(previous.w - size.w) < 0.5 && Math.abs(previous.h - size.h) < 0.5) return;
      state.last = size;
      if (!state.measured || state.reduced || (!animated && state.settled)) {
        shapeW.jump(size.w);
        shapeH.jump(size.h);
        shapeRadius.jump(targetRadius);
        state.measured = true;
        return;
      }
      const chosen = size.w * size.h >= previous.w * previous.h ? GROW : SHRINK;
      const run = {};
      state.run = run;
      state.settled = false;
      Promise.all([
        animate(shapeW, size.w, chosen),
        animate(shapeH, size.h, chosen),
        animate(shapeRadius, targetRadius, chosen),
      ]).then(() => {
        if (state.run === run) state.settled = true;
      });
    },
    [shapeH, shapeRadius, shapeW, sheetH],
  );

  const reportSize = useCallback(
    (id: string, size: FaceSize) => {
      sizes.current.set(id, size);
      if (id === motionState.current.view) applySize(false);
    },
    [applySize],
  );

  useLayoutEffect(() => {
    motionState.current.reduced = reduced;
  }, [reduced]);

  // Entering or leaving the phone layout drops every measurement: the faces change families.
  useLayoutEffect(() => {
    const state = motionState.current;
    if (state.sheet === sheet) return;
    Object.assign(state, {
      sheet,
      measured: false,
      settled: true,
      sheetShown: false,
      last: { w: 0, h: 0 },
    });
    applySize(false);
  }, [applySize, sheet]);

  useLayoutEffect(() => {
    if (motionState.current.view === view) return;
    motionState.current.view = view;
    applySize(true);
  }, [applySize, view]);

  const [copyWidths, setCopyWidths] = useState<Record<string, number>>({});

  // Copy button: measure all three labels, spring the face to the one in use.
  useLayoutEffect(() => {
    const nodes = Object.values(sizers.current).filter((node): node is HTMLSpanElement => !!node);
    if (!nodes.length) return;
    const measure = () =>
      setCopyWidths(
        Object.fromEntries(Object.entries(sizers.current).map(([key, node]) => [key, node?.offsetWidth ?? 0])),
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [view]);

  const targetCopyWidth = copyWidths[copyState];
  const copyMeasured = useRef(false);

  useLayoutEffect(() => {
    if (!targetCopyWidth) {
      copyMeasured.current = false;
      return;
    }
    if (!copyMeasured.current || reduced) {
      copyMeasured.current = true;
      copyWidth.jump(targetCopyWidth);
      return;
    }
    const controls = animate(copyWidth, targetCopyWidth, COPY_SPRING);
    return () => controls.stop();
  }, [copyWidth, reduced, targetCopyWidth]);

  // Focus follows the view: opening lands on the copy button, closing returns to the trigger.
  useLayoutEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    if (target === "option") {
      (panelRef.current ?? sheetRef.current)?.querySelector<HTMLElement>("[role='option'][aria-selected='true']")?.focus({ preventScroll: true });
      return;
    }
    const map: Record<Exclude<FocusTarget, "option" | null>, RefObject<HTMLElement | null>> = {
      button: triggerRef,
      copy: copyRef,
      done: doneRef,
      access: accessRef,
    };
    map[target as Exclude<FocusTarget, "option" | null>].current?.focus({ preventScroll: true });
  }, [accessOpen, view]);

  const close = useCallback(
    (refocus = true) => {
      const active = document.activeElement;
      if (refocus && (rootRef.current?.contains(active) || sheetRef.current?.contains(active))) pending.current = "button";
      if (view === "sent") {
        setRecipientIds([]);
        setSources({});
      }
      setDirection(0);
      setSendError(null);
      setHint(false);
      setView("button");
    },
    [view],
  );

  const go = (next: View) => {
    setDirection(VIEW_ORDER[view] >= 1 && VIEW_ORDER[next] >= 1 ? Math.sign(VIEW_ORDER[next] - VIEW_ORDER[view]) : 0);
    setView(next);
  };

  const isOpen = view !== "button";

  // Any pointer press outside the surface closes it without stealing focus back.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [close, isOpen]);

  // The bottom sheet owns the viewport while it is up.
  const sheetOpen = sheet && isOpen;
  useEffect(() => {
    if (!sheetOpen) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [sheetOpen]);

  const copyTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  async function copyLink() {
    window.clearTimeout(copyTimer.current);
    try {
      await writeClipboard(link);
      setCopyState("done");
      announce("Link copied");
      onCopy?.(selectedAccess);
    } catch {
      setCopyState("error");
      announce("Couldn't copy the link");
    }
    copyTimer.current = window.setTimeout(() => setCopyState("idle"), 1800);
  }

  async function sendToChannel(channel: ShareSheetChannel) {
    if (channelState[channel.id] === "busy") return;
    setChannelState((current) => ({ ...current, [channel.id]: "busy" }));
    let result: "done" | "error" = "done";
    try {
      await onChannel?.(channel.id);
    } catch {
      result = "error";
    }
    setChannelState((current) => ({ ...current, [channel.id]: result }));
    announce(result === "done" ? `${channel.label}: ${channel.doneLabel}` : `${channel.label} failed`);
    window.setTimeout(
      () => setChannelState((current) => (current[channel.id] === result ? { ...current, [channel.id]: "idle" } : current)),
      2000,
    );
  }

  function togglePerson(person: ShareSheetPerson, image: HTMLImageElement | null) {
    setSendError(null);
    setHint(false);
    if (recipientIds.includes(person.id)) {
      setRecipientIds((current) => current.filter((id) => id !== person.id));
      announce(`${person.name} removed`);
      return;
    }
    const rect = image?.getBoundingClientRect();
    if (rect) {
      setSources((current) => ({
        ...current,
        [person.id]: { x: rect.left, y: rect.top, w: rect.width, h: rect.height, t: performance.now() },
      }));
    }
    setRecipientIds((current) => [...current, person.id]);
    announce(`${person.name} added`);
  }

  const sendShake = useMotionValue(0);
  const sendAttempt = useRef(0);

  async function send() {
    if (sendBusy) return;
    if (!recipients.length) {
      setHint(true);
      announce("Pick someone to send to");
      if (!reduced) animate(sendShake, 0, { type: "spring", stiffness: 900, damping: 57, velocity: -260 });
      return;
    }
    const attempt = ++sendAttempt.current;
    setSendBusy(true);
    setSendError(null);
    try {
      await onSend?.({ people: recipients, access: selectedAccess });
    } catch {
      if (attempt !== sendAttempt.current) return;
      setSendBusy(false);
      setSendError("Couldn't send. Try again.");
      return;
    }
    if (attempt !== sendAttempt.current) return;
    setSendBusy(false);
    setAccessOpen(false);
    const active = document.activeElement;
    if (active && (panelRef.current?.contains(active) || sheetRef.current?.contains(active))) pending.current = "done";
    announce(`Sent to ${describePeople(recipients)}`);
    go("sent");
  }

  const recipients = recipientIds
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is ShareSheetPerson => !!person);
  const selected = access.find((option) => option.value === selectedAccess) ?? access[0];
  const content = reduced ? STAGGER_REDUCED : STAGGER_MOTION;
  const contentShift = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: "0.6em", filter: `blur(${blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduced
      ? { opacity: 0, transition: { duration: 0.08 } }
      : {
          opacity: 0,
          y: "-0.6em",
          filter: `blur(${blur.subtle}px)`,
          transition: { duration: duration.instant, ease: STANDARD },
        },
    transition: reduced
      ? { duration: duration.instant }
      : {
          y: LABEL,
          opacity: { duration: duration.fast, ease: ENTER },
          filter: { duration: duration.fast, ease: ENTER },
        },
  };
  const copyLabel = COPY_LABEL[copyState];

  const panelBody = (
    <div ref={panelRef} role="dialog" aria-labelledby={`${uid}-title`} className={styles.panelBody}>
      <div className={styles.flyers} aria-hidden="true">
        {flyers.map((flyer) => (
          <motion.img
            key={`${flyer.id}-${flyer.key}`}
            src={flyer.src}
            alt=""
            className={styles.flyer}
            style={{ left: flyer.to.x, top: flyer.to.y, width: flyer.to.w, height: flyer.to.h }}
            initial={{
              x: flyer.from.x + flyer.from.w / 2 - (flyer.to.x + flyer.to.w / 2),
              y: flyer.from.y + flyer.from.h / 2 - (flyer.to.y + flyer.to.h / 2),
              scale: flyer.from.w / flyer.to.w,
            }}
            animate={{ x: 0, y: 0, scale: 1 }}
            transition={FLYER}
            onAnimationComplete={() => setFlyers((current) => current.filter((entry) => entry !== flyer))}
          />
        ))}
      </div>
      <motion.div className={styles.header} variants={content}>
        <p id={`${uid}-title`} className={styles.title}>
          Share “{title}”
        </p>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => close()}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </motion.div>
      <motion.div className={styles.linkGroup} variants={content}>
        <div className={styles.linkRow}>
          <Link2 className={styles.muted} size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.link} title={link}>
            {link}
          </span>
          <button
            ref={copyRef}
            type="button"
            className={styles.copy}
            data-state={copyState}
            onClick={() => void copyLink()}
            aria-label={copyState === "idle" ? "Copy link" : undefined}
          >
            <motion.span className={styles.copyFace} style={{ width: copyWidth }}>
              {(["idle", "done", "error"] as const).map((state) => (
                <span
                  key={state}
                  ref={(node) => {
                    sizers.current[state] = node;
                  }}
                  className={styles.sizer}
                  aria-hidden="true"
                >
                  {COPY_LABEL[state]}
                </span>
              ))}
              <AnimatePresence initial={false}>
                <motion.span
                  key={copyState}
                  className={styles.copyLabel}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: reduced ? { duration: 0 } : { duration: 0.1, ease: STANDARD } }}
                  transition={reduced ? { duration: 0 } : { duration: duration.fast, ease: STANDARD }}
                >
                  {copyState === "done" ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <motion.path
                        d="M4 12l5 5L20 6"
                        initial={!reduced && { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.22, ease: STANDARD, delay: 0.04 }}
                      />
                    </svg>
                  ) : copyState === "error" ? (
                    <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  {copyLabel}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          </button>
        </div>
        <button
          ref={accessRef}
          type="button"
          className={styles.accessTrigger}
          aria-expanded={accessOpen}
          aria-controls={`${uid}-access`}
          onClick={() => {
            if (!accessOpen) pending.current = "option";
            setAccessOpen(!accessOpen);
          }}
        >
          <span className={styles.accessIcon} aria-hidden="true">
            {selected?.icon}
          </span>
          <span className={styles.accessText}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={selected?.value} className={styles.accessLines} {...contentShift}>
                <span className={styles.accessLabel}>{selected?.label}</span>
                <span className={styles.accessDescription}>{selected?.description}</span>
              </motion.span>
            </AnimatePresence>
          </span>
          <motion.span
            className={styles.muted}
            aria-hidden="true"
            initial={false}
            animate={{ rotate: accessOpen ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : LABEL}
          >
            <ChevronDown size={16} strokeWidth={1.75} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {accessOpen && (
            <motion.div
              id={`${uid}-access`}
              className={styles.accessList}
              role="listbox"
              aria-label="Who can open the link"
              onKeyDown={(event) => {
                const step: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
                if (!(event.key in step)) return;
                event.preventDefault();
                const options = [...event.currentTarget.querySelectorAll<HTMLElement>("[role='option']")];
                const index = options.indexOf(document.activeElement as HTMLElement);
                options[(index + step[event.key] + options.length) % options.length]?.focus();
              }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0, opacity: { duration: duration.instant } }
                  : { height: MANY, opacity: { duration: duration.exit, ease: ENTER } }
              }
            >
              <div className={styles.accessOptions}>
                {access.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === selectedAccess}
                    tabIndex={option.value === selectedAccess ? 0 : -1}
                    className={styles.accessOption}
                    onClick={() => {
                      setSelectedAccess(option.value);
                      pending.current = "access";
                      setAccessOpen(false);
                    }}
                  >
                    <span className={styles.accessIcon} aria-hidden="true">
                      {option.icon}
                    </span>
                    <span className={styles.accessLines}>
                      <span className={styles.accessLabel}>{option.label}</span>
                      <span className={styles.accessDescription}>{option.description}</span>
                    </span>
                    <Check className={styles.accessCheck} size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {channels.length > 0 && (
        <motion.div className={styles.channels} variants={content} role="group" aria-label="Share to">
          {channels.map((channel) => {
            const state = channelState[channel.id] ?? "idle";
            return (
              <button
                key={channel.id}
                type="button"
                className={styles.channel}
                data-state={state}
                aria-busy={state === "busy" || undefined}
                onClick={() => void sendToChannel(channel)}
              >
                <span className={styles.channelIcon} aria-hidden="true">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={state === "done" ? "done" : state === "busy" ? "busy" : "icon"}
                      className={styles.channelGlyph}
                      {...contentShift}
                    >
                      {state === "done" ? (
                        <Check size={16} strokeWidth={2} />
                      ) : state === "busy" ? (
                        <Loader2 className={styles.spinner} size={16} strokeWidth={1.75} />
                      ) : (
                        channel.icon
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className={styles.channelLabel}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={state === "done" ? "done" : state === "error" ? "error" : "idle"}
                      {...contentShift}
                    >
                      {state === "done" ? channel.doneLabel : state === "error" ? "Failed" : channel.label}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </button>
            );
          })}
        </motion.div>
      )}
      <motion.div className={styles.divider} variants={content} aria-hidden="true" />
      <motion.div className={styles.toBlock} variants={content} style={{ x: sendShake }}>
        <span id={`${uid}-to`} className={styles.sectionLabel}>
          Send to
        </span>
        <div className={styles.toRow} data-empty={!recipients.length || undefined}>
          <AnimatePresence>
            {!recipients.length && (
              <motion.span
                key="empty"
                className={styles.toEmpty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                data-hint={hint || undefined}
              >
                {hint ? "Pick someone to send to" : "Pick people below"}
              </motion.span>
            )}
          </AnimatePresence>
          <ul className={styles.chips} data-chips="" aria-labelledby={`${uid}-to`}>
            <AnimatePresence initial={false} mode="popLayout">
              {recipients.map((person) => (
                <Chip
                  key={person.id}
                  person={person}
                  source={sources[person.id]}
                  reduced={reduced}
                  hidden={flyers.some((flyer) => flyer.id === person.id)}
                  onLand={(rect) => {
                    const source = sources[person.id];
                    const body = panelRef.current?.getBoundingClientRect();
                    if (!source || !body) return;
                    const entry = {
                      id: person.id,
                      key: source.t,
                      src: person.avatar,
                      from: { x: source.x - body.left, y: source.y - body.top, w: source.w, h: source.h },
                      to: {
                        x: rect.left - body.left,
                        y: rect.top - body.top,
                        w: rect.width,
                        h: rect.height,
                      },
                    };
                    setFlyers((current) => [...current.filter((flyer) => flyer.id !== person.id), entry]);
                  }}
                  onRemove={() => togglePerson(person, null)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </motion.div>
      <motion.div className={styles.recents} variants={content} role="group" aria-label="Recent people">
        {people.map((person) => {
          const on = recipientIds.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              className={styles.person}
              aria-pressed={on}
              aria-label={person.name}
              data-on={on || undefined}
              onClick={(event: SyntheticEvent<HTMLButtonElement>) =>
                togglePerson(person, event.currentTarget.querySelector("img"))
              }
            >
              <span className={styles.personAvatar}>
                <img src={person.avatar} alt="" width={80} height={80} />
                <span className={styles.badge} aria-hidden="true">
                  <Check size={10} strokeWidth={3} />
                </span>
              </span>
              <span className={styles.personName} aria-hidden="true">
                {person.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </motion.div>
      <motion.div className={styles.footer} variants={content}>
        <AnimatePresence initial={false}>
          {sendError && (
            <motion.p
              key="error"
              className={styles.error}
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={reduced ? { duration: 0.1 } : MANY}
            >
              <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
              {sendError}
            </motion.p>
          )}
        </AnimatePresence>
        <button
          type="button"
          className={styles.send}
          data-empty={!recipients.length || undefined}
          aria-disabled={sendBusy || undefined}
          onClick={() => void send()}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={sendBusy ? "sending" : recipients.length ? "ready" : "empty"}
              className={styles.sendLabel}
              {...contentShift}
            >
              {sendBusy ? (
                <>
                  <Loader2 className={styles.spinner} size={16} strokeWidth={1.75} aria-hidden="true" />
                  Sending
                </>
              ) : recipients.length ? (
                <>
                  Send to&nbsp;
                  <CountRoll value={recipients.length} reduced={reduced} />
                  &nbsp;
                  {recipients.length === 1 ? "person" : "people"}
                </>
              ) : (
                "Send"
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </motion.div>
    </div>
  );

  const panelFace = (
    <Face id="panel" direction={direction} reduced={reduced} onSize={reportSize} className={styles.panel}>
      {panelBody}
    </Face>
  );

  const sentFace = (
    <Face id="sent" direction={direction} reduced={reduced} onSize={reportSize} className={styles.sent}>
      <div role="status" className={styles.sentBody}>
        <motion.div className={styles.stack} variants={content} aria-hidden="true">
          {recipients.slice(0, 3).map((person, index) => (
            <motion.span
              key={person.id}
              className={styles.stackAvatar}
              style={{ zIndex: 3 - index }}
              initial={!reduced && { x: -10 * index, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ x: LABEL, opacity: { duration: 0.2 }, delay: 0.1 + 0.05 * index }}
            >
              <img src={person.avatar} alt="" width={64} height={64} />
            </motion.span>
          ))}
          {recipients.length > 3 && (
            <span className={`${styles.stackAvatar} ${styles.more}`}>+{recipients.length - 3}</span>
          )}
          <motion.span
            className={styles.sentCheck}
            initial={!reduced && { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...LABEL, delay: 0.22 }}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M5.5 12.5l4.2 4.2 8.8-9.2"
                initial={!reduced && { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: ENTER, delay: 0.3 }}
              />
            </svg>
          </motion.span>
        </motion.div>
        <motion.p className={styles.sentTitle} variants={content}>
          Sent to {recipients.length ? describePeople(recipients) : "your team"}
        </motion.p>
        <motion.p className={styles.sentMeta} variants={content}>
          {selected?.label} · {selected?.description.toLowerCase()}
        </motion.p>
        <motion.div className={styles.sentActions} variants={content}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={() => {
              pending.current = "copy";
              announce("Back to sharing. Nothing was sent.");
              go("panel");
            }}
          >
            Undo
          </button>
          <button ref={doneRef} type="button" className={styles.doneButton} onClick={() => close()}>
            Done
          </button>
        </motion.div>
      </div>
    </Face>
  );

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-align={align}
      data-view={sheet ? "button" : view}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || view === "button") return;
        event.preventDefault();
        if (accessOpen) {
          pending.current = "access";
          setAccessOpen(false);
          return;
        }
        close();
      }}
    >
      <span className={`${styles.pill} ${styles.ghost}`} aria-hidden="true">
        <Share size={16} strokeWidth={1.75} />
        {label}
      </span>
      <motion.div className={styles.shape} style={{ width: shapeW, height: shapeH, borderRadius: shapeRadius }}>
        <AnimatePresence initial={false} custom={direction}>
          {(view === "button" || sheet) && (
            <Face key="button" id="button" direction={direction} reduced={reduced} onSize={reportSize}>
              <button
                ref={triggerRef}
                type="button"
                className={`${styles.pill} ${styles.trigger}`}
                aria-haspopup="dialog"
                aria-expanded={sheet && isOpen}
                onClick={() => {
                  if (view === "button") {
                    pending.current = "copy";
                    setSendError(null);
                    go("panel");
                  } else {
                    close();
                  }
                }}
              >
                <Share size={16} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            </Face>
          )}
          {!sheet && view === "panel" && panelFace}
          {!sheet && view === "sent" && sentFace}
        </AnimatePresence>
      </motion.div>
      {sheet &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="scrim"
                className={styles.scrim}
                aria-hidden="true"
                style={{ pointerEvents: isOpen ? "auto" : "none" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? duration.instant : duration.standard, ease: STANDARD }}
              />
            )}
            {isOpen && (
              <motion.div
                key="sheet"
                ref={sheetRef}
                className={styles.sheet}
                initial={reduced ? { opacity: 0 } : { y: "110%" }}
                animate={reduced ? { opacity: 1 } : { y: 0 }}
                exit={reduced ? { opacity: 0, transition: { duration: duration.instant } } : { y: "110%", transition: SHEET_OUT }}
                transition={reduced ? { duration: duration.fast } : SHEET_IN}
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 1 }}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  const height = sheetRef.current?.offsetHeight ?? 400;
                  if (info.offset.y > Math.min(120, height / 3) || info.velocity.y > 600) close();
                }}
              >
                <div className={styles.grabber} aria-hidden="true" onPointerDown={(event) => dragControls.start(event)} />
                <motion.div className={styles.sheetFaces} style={{ height: sheetH }}>
                  <AnimatePresence initial={false} custom={direction}>
                    {view === "panel" && panelFace}
                    {view === "sent" && sentFace}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      <span className={styles.srOnly} role="status" aria-live="polite">
        <span key={status.id}>{status.text}</span>
      </span>
    </div>
  );
}

export default ShareSheet;
