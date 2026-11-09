"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, MotionValue, Transition } from "motion/react";
import { Archive, Check, CircleAlert, Trash2 } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./undo-toast.module.css";

/** One kind of removal: what the row button says, and the past tense the toast reports. */
export interface UndoAction {
  /** Button label and the verb used when a commit fails, such as Archive. */
  label: string;
  /** Past tense used in the toast, such as archived. */
  done: string;
  /** A 16px icon shown on the row button. */
  icon?: ReactNode;
}

/** A removed row plus where it sat, so undo can put it back in its old place. */
export interface UndoEntry<T> {
  /** Stable key of the item, from getKey. */
  key: string;
  /** The removal kind that was used. */
  kind: string;
  /** The item itself, so a callback can restore it without owning the list. */
  item: T;
  /** Index the item had in the list before it was removed. */
  index: number;
}

/** Handed to renderItem so a row can remove itself. */
export interface UndoRowContext {
  /** Remove this row. Defaults to the first key of actions. */
  remove: (kind?: string) => void;
  /** True while the row is folded away waiting for the countdown. */
  removed: boolean;
  /** Increments on every restore, so a row can flash when it comes back. */
  restoredAt: number;
}

/** Imperative handle, for lists that remove rows they do not render. */
export interface UndoToastHandle {
  /** Fold a row away and open or extend the toast. */
  remove: (key: string, kind?: string) => void;
  /** Put every pending row back. */
  undo: () => void;
  /** Commit the pending removal now instead of waiting out the countdown. */
  commit: () => void;
}

/** Where the toast is in its life. */
export type UndoToastPhase = "pending" | "undoing" | "restored" | "error";

/** Where a row is in its own life: awaiting undo, committed and gone, or mid-commit. */
type RowState = "pending" | "gone" | "committing";

/** The lead glyph: a countdown ring, a spinner, a check or a warning. */
type Lead = "ring" | "busy" | "done" | "error";

interface ToastState<T> {
  /** Monotonic id, so a stale timer can tell it no longer owns the toast. */
  id: number;
  phase: UndoToastPhase;
  entries: UndoEntry<T>[];
  /** Set when an undo was rejected, so the toast asks for a second press. */
  retry?: boolean;
}

/** Text for the toast face and the live region, keyed so the face can crossfade. */
interface ToastMessage {
  key: string;
  text: string;
  count?: number;
}

export interface UndoToastProps<T> {
  /** Controlled list. Pass it together with onItemsChange; the component never keeps its own copy while it is set. */
  items?: readonly T[];
  /** Uncontrolled seed, used when items is omitted. */
  defaultItems?: readonly T[];
  /** Called with the new list whenever a removal commits or an undo puts rows back. */
  onItemsChange?: (items: T[]) => void;
  /** Stable key for an item, such as its id. It keys the fold, the toast entries and the restore order. */
  getKey: (item: T) => string;
  /** The visible row. ctx.remove(kind) folds it away; ctx.removed is true while it is folded and ctx.restoredAt bumps on restore. */
  renderItem: (item: T, ctx: UndoRowContext) => ReactNode;
  /** Removal kinds, keyed by name. The first key is what ctx.remove() uses by default. Defaults to archive and delete. */
  actions?: Record<string, UndoAction>;
  /** Singular and plural nouns for the toast, such as conversation and conversations. */
  noun?: readonly [string, string];
  /** How long the countdown runs in ms, and how long an undo stays possible. */
  duration?: number;
  /** Called with the removed entries the moment a row folds, before the countdown ends. */
  onRemove?: (entries: UndoEntry<T>[]) => void;
  /** Runs when Undo is pressed. Awaited before the rows come back; a rejection keeps them removed. */
  onUndo?: (entries: UndoEntry<T>[]) => void | Promise<unknown>;
  /** Runs when the countdown ends, or on Escape. Awaited before the rows are dropped; a rejection brings them back and shows the error. */
  onCommit?: (entries: UndoEntry<T>[]) => void | Promise<unknown>;
  /** Binds ⌘Z / Ctrl+Z while a toast is pending, guarded against text fields. */
  undoShortcut?: boolean;
  /** Pauses the countdown while the pointer or focus is on the toast, and while the tab is hidden. */
  pauseOnHover?: boolean;
  /** Shown in place of the list when nothing is left. */
  empty?: ReactNode;
  /** Accessible name of the list, such as Conversations. */
  label?: string;
  /** container sits inside the component's box; viewport pins the toast to the bottom of the window. */
  toastPlacement?: "container" | "viewport";
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
  /** Imperative handle: remove, undo and commit. */
  ref?: Ref<UndoToastHandle>;
}

export interface UndoToastRowProps {
  /** Row title. It is the bold line when the row is unread. Keep the subject inside it if you need one line with a lighter tail. */
  title: ReactNode;
  /** A 36px leading slot, usually an avatar or an icon. */
  leading?: ReactNode;
  /** The second line, in the secondary text color. */
  description?: ReactNode;
  /** Right-aligned time or count, hidden while the row is hovered or focused. */
  meta?: ReactNode;
  /** Buttons revealed on hover or focus, usually two UndoToastRowAction. */
  actions?: ReactNode;
  /** Keys handled while the row itself has focus, such as e, Backspace and Delete. */
  shortcuts?: Record<string, () => void>;
  /** Accessible name of the row, such as the person and the subject. */
  label?: string;
  /** Draws the title in medium weight. */
  unread?: boolean;
  /** Class on the row. */
  className?: string;
}

export interface UndoToastRowActionProps {
  /** Accessible name and tooltip. */
  label: string;
  /** A 16px icon. */
  icon?: ReactNode;
  /** Runs the removal. The click is kept from reaching the row. */
  onClick: () => void;
}

const FOCUSABLE =
  "button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const noop = () => {};

const subscribeNothing = () => noop;

const readPlatform = (): string =>
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "mac" : "other";

const defaultActions: Record<string, UndoAction> = {
  archive: {
    label: "Archive",
    done: "archived",
    icon: <Archive size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
  delete: {
    label: "Delete",
    done: "deleted",
    icon: <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />,
  },
};

const still: Transition = { duration: 0 };

/**
 * A list where removing a row is reversible. The row folds away, the gap closes, and one toast
 * carries the countdown: a ring that empties over the undo window, the seconds left, and Undo.
 * Removing another row while the toast is up merges into the same toast, restarts the countdown
 * and rolls the count. Undo or ⌘Z puts every row back in its old place, flashes it, and turns the
 * toast into a check for two seconds. Escape, or the end of the countdown, commits; the countdown
 * pauses while the pointer or focus rests on the toast and while the tab is hidden.
 */
export function UndoToast<T>({
  items,
  defaultItems,
  onItemsChange,
  getKey,
  renderItem,
  actions = defaultActions,
  noun = ["item", "items"] as const,
  duration = 6000,
  onRemove,
  onUndo,
  onCommit,
  undoShortcut = true,
  pauseOnHover = true,
  empty,
  label,
  toastPlacement = "container",
  className,
  style,
  ref,
}: UndoToastProps<T>) {
  const reduced = useReducedMotion() ?? false;
  const platform = useSyncExternalStore(subscribeNothing, readPlatform, () => "");
  const keyHint = undoShortcut && platform ? (platform === "mac" ? "⌘Z" : "Ctrl Z") : "";
  const keySpoken = undoShortcut && platform ? (platform === "mac" ? "Command Z" : "Control Z") : "";
  const uid = useId();

  const controlled = items !== undefined;
  const [localItems, setLocalItems] = useState<T[]>(() => [...(defaultItems ?? [])]);
  const list: readonly T[] = controlled ? items : localItems;

  const [states, setStates] = useState<Record<string, RowState>>({});
  const [restored, setRestored] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<ToastState<T> | null>(null);
  const [seconds, setSeconds] = useState(Math.ceil(duration / 1000));

  const listRef = useRef<HTMLUListElement>(null);
  const toastNodeRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const countdownRef = useRef<AnimationPlaybackControls | null>(null);
  const pausedRef = useRef(new Set<string>());
  const toastId = useRef(0);
  const restoreSeq = useRef(0);

  // Refs mirror the committed state so timers and callbacks never read a stale render.
  const itemsRef = useRef(list);
  const statesRef = useRef(states);
  const toastRef = useRef(toast);

  // Everything the callbacks close over, refreshed after each render.
  interface Latest {
    onItemsChange: UndoToastProps<T>["onItemsChange"];
    getKey: (item: T) => string;
    actions: Record<string, UndoAction>;
    duration: number;
    onRemove: UndoToastProps<T>["onRemove"];
    onUndo: UndoToastProps<T>["onUndo"];
    onCommit: UndoToastProps<T>["onCommit"];
    controlled: boolean;
    reduced: boolean;
  }
  const latest: Latest = { onItemsChange, getKey, actions, duration, onRemove, onUndo, onCommit, controlled, reduced };
  const latestRef = useRef(latest);
  useLayoutEffect(() => {
    latestRef.current = latest;
    itemsRef.current = list;
  });

  const progress = useMotionValue(1);
  const toastScale = useMotionValue(1);

  const syncSeconds = useCallback((value: number) => {
    setSeconds(Math.max(1, Math.ceil((value * latestRef.current.duration) / 1000 - 0.001)));
  }, []);

  useInsertionEffect(() => progress.on("change", syncSeconds), [progress, syncSeconds]);

  /** Patch the fold state of the rows. The ref is the source of truth, so rapid removes never race. */
  const updateStates = useCallback((producer: (current: Record<string, RowState>) => Record<string, RowState>) => {
    const next = producer(statesRef.current);
    statesRef.current = next;
    setStates(next);
  }, []);

  /** Show a toast, or clear it. hideAfter keeps an id check so a newer toast is not closed by an old timer. */
  const showToast = useCallback((next: ToastState<T> | null, hideAfter = 0) => {
    window.clearTimeout(toastTimer.current);
    toastRef.current = next;
    setToast(next);
    if (!next || !hideAfter) return;
    toastTimer.current = window.setTimeout(() => {
      if (toastRef.current?.id !== next.id) return;
      toastRef.current = null;
      setToast(null);
    }, hideAfter);
  }, []);

  // Fold state for a key that is no longer in the list has nothing left to describe.
  useEffect(() => {
    const live = new Set(list.map((item) => getKey(item)));
    const stale = Object.keys(statesRef.current).filter((key) => !live.has(key));
    if (!stale.length) return;
    updateStates((current) => {
      const next = { ...current };
      for (const key of stale) delete next[key];
      return next;
    });
  }, [list, getKey, updateStates]);

  const stopCountdown = useCallback(() => {
    countdownRef.current?.stop();
    countdownRef.current = null;
  }, []);

  /** Drop the rows for real and tell the owner. */
  const finalize = useCallback(
    (entries: UndoEntry<T>[]) => {
      const keys = new Set(entries.map((entry) => entry.key));
      const config = latestRef.current;
      updateStates((current) => {
        const next = { ...current };
        for (const key of keys) next[key] = "gone";
        return next;
      });
      const remaining = itemsRef.current.filter((item) => !keys.has(config.getKey(item)));
      if (!config.controlled) setLocalItems(remaining);
      config.onItemsChange?.(remaining);
    },
    [updateStates],
  );

  /** Put the rows back and stamp each one so its row can flash. */
  const revert = useCallback(
    (entries: UndoEntry<T>[]) => {
      const keys = entries.map((entry) => entry.key);
      const seq = ++restoreSeq.current;
      updateStates((current) => {
        const next = { ...current };
        for (const key of keys) delete next[key];
        return next;
      });
      setRestored((current) => {
        const next = { ...current };
        for (const key of keys) next[key] = seq;
        return next;
      });
    },
    [updateStates],
  );

  /** Keep the rows removed, or bring them back when the commit rejects. */
  const commit = useCallback(
    async (current: ToastState<T>) => {
      stopCountdown();
      const { entries } = current;
      if (toastRef.current?.id === current.id) showToast(null);
      updateStates((state) => {
        const next = { ...state };
        for (const entry of entries) next[entry.key] = "committing";
        return next;
      });
      try {
        await latestRef.current.onCommit?.(entries);
        finalize(entries);
      } catch {
        revert(entries);
        const live = toastRef.current;
        if (live && live.phase === "pending") return;
        showToast({ id: ++toastId.current, phase: "error", entries }, 4200);
      }
    },
    [finalize, revert, showToast, stopCountdown, updateStates],
  );

  /** Run the ring down to zero. rise carries a merged toast back up to a full window first. */
  const startCountdown = useCallback(
    (rise: boolean) => {
      stopCountdown();
      const current = toastRef.current;
      if (!current) return;
      const span = latestRef.current.duration / 1000;
      const run = () => {
        const controls = animate(progress, 0, {
          duration: Math.max(0.01, span * progress.get()),
          ease: "linear",
          onComplete: () => {
            const live = toastRef.current;
            if (live?.id === current.id) void commit(live);
          },
        });
        countdownRef.current = controls;
        if (pausedRef.current.size) controls.pause();
      };
      if (rise && !latestRef.current.reduced && progress.get() < 0.98) {
        const controls = animate(progress, 1, {
          ...motionTokens.spring.smooth,
          visualDuration: 0.36,
          onComplete: run,
        });
        countdownRef.current = controls;
        if (pausedRef.current.size) controls.pause();
        return;
      }
      progress.set(1);
      run();
    },
    [commit, progress, stopCountdown],
  );

  const pause = useCallback((reason: string) => {
    pausedRef.current.add(reason);
    countdownRef.current?.pause();
  }, []);

  const resume = useCallback((reason: string) => {
    pausedRef.current.delete(reason);
    if (pausedRef.current.size) return;
    if (toastRef.current?.phase !== "pending") return;
    countdownRef.current?.play();
  }, []);

  // A hidden tab pauses the window instead of burning it.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? pause("tab") : resume("tab"));
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, resume]);

  useEffect(
    () => () => {
      countdownRef.current?.stop();
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /** Move focus to the same control on the next row, else the previous one, else Undo. */
  const handoffFocus = useCallback((key: string) => {
    const container = listRef.current;
    const active = document.activeElement;
    if (!container || !(active instanceof HTMLElement)) return;
    const rows = [...container.querySelectorAll<HTMLLIElement>(":scope > li")];
    const index = rows.findIndex((row) => row.dataset.key === key);
    const row = rows[index];
    if (!row || !row.contains(active)) return;
    const slot = [...row.querySelectorAll<HTMLElement>(FOCUSABLE)].indexOf(active);
    const usable = (candidate: HTMLLIElement) =>
      candidate.dataset.key !== key && !statesRef.current[candidate.dataset.key ?? ""];
    const target = rows.slice(index + 1).find(usable) ?? rows.slice(0, index).reverse().find(usable);
    if (target) {
      const focusable = [...target.querySelectorAll<HTMLElement>(FOCUSABLE)];
      (focusable[slot] ?? focusable[0])?.focus({ preventScroll: true });
      return;
    }
    requestAnimationFrame(() => toastNodeRef.current?.querySelector("button")?.focus({ preventScroll: true }));
  }, []);

  /** Fold one row away and open or extend the toast. */
  const remove = useCallback(
    (key: string, kind?: string) => {
      const config = latestRef.current;
      if (statesRef.current[key]) return;
      const index = itemsRef.current.findIndex((item) => config.getKey(item) === key);
      if (index < 0) return;
      const entry: UndoEntry<T> = {
        key,
        kind: kind ?? Object.keys(config.actions)[0] ?? "remove",
        item: itemsRef.current[index],
        index,
      };
      handoffFocus(key);
      updateStates((current) => ({ ...current, [key]: "pending" }));
      config.onRemove?.([entry]);
      const live = toastRef.current;
      if (live?.phase === "pending") {
        showToast({ ...live, retry: false, entries: [...live.entries, entry] });
        if (!config.reduced) {
          animate(toastScale, 1, { type: "spring", stiffness: 700, damping: 51, velocity: 0.9 });
        }
        startCountdown(true);
        return;
      }
      showToast({ id: ++toastId.current, phase: "pending", entries: [entry] });
      startCountdown(false);
    },
    [handoffFocus, updateStates, showToast, startCountdown, toastScale],
  );

  /** Put every pending row back. */
  const undo = useCallback(async () => {
    const current = toastRef.current;
    if (!current || current.phase !== "pending") return;
    stopCountdown();
    const insideToast = !!toastNodeRef.current?.contains(document.activeElement) || document.activeElement === document.body;
    if (latestRef.current.onUndo) {
      showToast({ ...current, phase: "undoing" });
      try {
        await latestRef.current.onUndo(current.entries);
      } catch {
        if (toastRef.current?.id !== current.id) return;
        showToast({ ...current, phase: "pending", retry: true });
        startCountdown(false);
        return;
      }
    }
    revert(current.entries);
    const live = toastRef.current;
    if (live && live.id !== current.id) return;
    showToast({ ...current, phase: "restored", retry: false }, 2000);
    if (!insideToast) return;
    const first = [...current.entries].sort((a, b) => a.index - b.index)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLLIElement>(`:scope > li[data-key="${CSS.escape(first.key)}"]`);
      row?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    });
  }, [revert, showToast, startCountdown, stopCountdown]);

  const commitPending = useCallback(() => {
    const current = toastRef.current;
    if (current?.phase === "pending") void commit(current);
  }, [commit]);

  useImperativeHandle(ref, () => ({ remove, undo: () => void undo(), commit: commitPending }), [remove, undo, commitPending]);

  const pending = toast?.phase === "pending";

  // ⌘Z / Ctrl+Z, ignored while typing.
  useEffect(() => {
    if (!undoShortcut || !pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (event.key.toLowerCase() !== "z" || event.shiftKey || event.altKey || !meta) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
      ) {
        return;
      }
      event.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, undo, undoShortcut]);

  const message = toast ? describeToast(toast, actions, noun) : null;

  const visible = list.filter((item) => !states[getKey(item)]).length;

  const restoreOrder = new Map<string, number>();
  if (toast?.phase === "restored") {
    [...toast.entries]
      .sort((a, b) => a.index - b.index)
      .forEach((entry, position) => restoreOrder.set(entry.key, position));
  }

  const exitTransition: Transition = reduced ? still : motionTokens.spring.smooth;
  const face: Lead = toast
    ? toast.phase === "restored"
      ? "done"
      : toast.phase === "error"
        ? "error"
        : toast.phase === "undoing"
          ? "busy"
          : "ring"
    : "ring";
  const announcement = message
    ? toast?.phase === "pending"
      ? `${message.count ? `${message.count} ${message.text}` : message.text}. ${
          keySpoken ? `Press ${keySpoken} or the Undo button` : "Use the Undo button"
        } to undo.`
      : message.count
        ? `${message.count} ${message.text}`
        : message.text
    : "";

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
      <ul ref={listRef} className={styles.list} aria-label={label}>
        <AnimatePresence initial={false}>
          {list.map((item) => {
            const key = getKey(item);
            const removed = !!states[key];
            const shift = (restoreOrder.get(key) ?? 0) * motionTokens.stagger.item;
            const flashKey = restored[key] ?? 0;
            return (
              <motion.li
                key={key}
                data-key={key}
                className={styles.row}
                initial={{ height: 0 }}
                animate={removed ? { height: 0 } : { height: "auto" }}
                exit={{ height: 0, transition: exitTransition }}
                transition={
                  removed
                    ? { ...exitTransition, delay: reduced ? 0 : 0.05 }
                    : { ...exitTransition, delay: reduced ? 0 : shift }
                }
                aria-hidden={removed || undefined}
                inert={removed || undefined}
              >
                <motion.div
                  className={styles.rowInner}
                  initial={{ opacity: 0, x: reduced ? 0 : 28 }}
                  animate={
                    removed
                      ? {
                          opacity: 0,
                          x: reduced ? 0 : 28,
                          scale: reduced ? 1 : 0.985,
                          filter: reduced ? "blur(0px)" : `blur(${motionTokens.blur.subtle}px)`,
                        }
                      : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }
                  }
                  transition={
                    reduced
                      ? still
                      : removed
                        ? { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }
                        : {
                            ...motionTokens.spring.snappy,
                            delay: 0.06 + shift,
                            filter: { duration: 0.2, delay: 0.06 + shift },
                          }
                  }
                >
                  {flashKey ? <span key={flashKey} className={styles.flash} aria-hidden="true" /> : null}
                  {renderItem(item, {
                    remove: (kind) => remove(key, kind),
                    removed,
                    restoredAt: flashKey,
                  })}
                </motion.div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <AnimatePresence initial={false}>
        {visible === 0 && empty ? (
          <motion.div
            key="empty"
            className={styles.empty}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
            transition={reduced ? still : { ...motionTokens.spring.smooth, delay: 0.18 }}
          >
            {empty}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div id={uid} className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className={styles.toastLayer} data-placement={toastPlacement}>
        <AnimatePresence>
          {toast && message ? (
            <motion.div
              key="toast"
              className={styles.toastShell}
              initial={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: 18, scale: 0.94, filter: `blur(${motionTokens.blur.soft}px)` }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: 12,
                      scale: 0.96,
                      filter: `blur(${motionTokens.blur.subtle}px)`,
                      transition: { duration: motionTokens.duration.exit, ease: motionTokens.ease.exit },
                    }
              }
              transition={
                reduced ? { duration: motionTokens.duration.fast } : { ...motionTokens.spring.morph, filter: { duration: 0.24 } }
              }
            >
              <motion.div
                ref={toastNodeRef}
                className={styles.toast}
                data-phase={toast.phase}
                style={{ scale: toastScale }}
                role="group"
                aria-label="Undo"
                aria-describedby={uid}
                onPointerEnter={() => pauseOnHover && pause("hover")}
                onPointerLeave={() => resume("hover")}
                onFocus={() => pauseOnHover && pause("focus")}
                onBlur={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) return;
                  resume("focus");
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Escape" || toastRef.current?.phase !== "pending") return;
                  event.stopPropagation();
                  commitPending();
                }}
              >
                <span className={styles.lead} aria-hidden="true">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={face}
                      className={styles.leadFace}
                      data-lead={face}
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.5, rotate: face === "done" ? -45 : 0 }
                      }
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                      transition={reduced ? still : motionTokens.spring.snappy}
                    >
                      {face === "ring" ? (
                        <Countdown progress={progress} seconds={seconds} reduced={reduced} />
                      ) : face === "busy" ? (
                        <span className={styles.spinner} />
                      ) : face === "done" ? (
                        <Check size={16} strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className={styles.message}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={message.key}
                      className={styles.messageFace}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.subtle}px)` }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, filter: `blur(${motionTokens.blur.subtle}px)` }}
                      transition={reduced ? still : { ...motionTokens.spring.snappy, filter: { duration: 0.18 } }}
                    >
                      {message.count ? (
                        <>
                          <Rolling value={message.count} reduced={reduced} />
                          {" "}
                        </>
                      ) : null}
                      {message.text}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false}>
                  {toast.phase === "pending" || toast.phase === "undoing" ? (
                    <motion.button
                      key="undo"
                      type="button"
                      className={styles.undo}
                      disabled={toast.phase === "undoing"}
                      onClick={() => void undo()}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9, filter: `blur(${motionTokens.blur.subtle}px)` }
                      }
                      transition={reduced ? still : motionTokens.spring.snappy}
                      aria-keyshortcuts={undoShortcut ? "Meta+Z Control+Z" : undefined}
                    >
                      Undo
                      {keyHint ? (
                        <kbd className={styles.kbd} aria-hidden="true">
                          {keyHint}
                        </kbd>
                      ) : null}
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The ring that empties over the undo window, with the seconds left inside it. */
function Countdown({
  progress,
  seconds,
  reduced,
}: {
  progress: MotionValue<number>;
  seconds: number;
  reduced: boolean;
}) {
  return (
    <span className={styles.countdown}>
      <svg viewBox="0 0 24 24" className={styles.ring}>
        <circle cx={12} cy={12} r={10} className={styles.ringTrack} />
        <motion.circle cx={12} cy={12} r={10} className={styles.ringFill} style={{ pathLength: progress }} />
      </svg>
      <span className={styles.seconds}>
        <Rolling value={seconds} reduced={reduced} />
      </span>
    </span>
  );
}

/** One digit that rolls: the old one leaves upward while the new one rises into its place. */
function Rolling({ value, reduced }: { value: number; reduced: boolean }) {
  return (
    <span className={styles.roll}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className={styles.rollDigit}
          initial={reduced ? { opacity: 0 } : { y: "80%", opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { y: "-80%", opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
          transition={reduced ? still : motionTokens.spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A list row: leading slot, two lines, and a time that swaps for buttons on hover or focus. */
export function UndoToastRow({
  leading,
  title,
  description,
  meta,
  actions,
  shortcuts,
  label,
  unread,
  className,
}: UndoToastRowProps) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !shortcuts || event.metaKey || event.ctrlKey || event.altKey) return;
    const run = shortcuts[event.key] ?? shortcuts[event.key.toLowerCase()];
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <div
      className={[styles.item, className].filter(Boolean).join(" ")}
      data-unread={unread || undefined}
      tabIndex={0}
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={styles.trailing}>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
        {actions ? <span className={styles.actions}>{actions}</span> : null}
      </span>
    </div>
  );
}

/** A round icon button for a row's hover actions. It never triggers the row underneath. */
export function UndoToastRowAction({ label, icon, onClick }: UndoToastRowActionProps) {
  return (
    <button
      type="button"
      className={styles.rowAction}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {icon}
    </button>
  );
}

/**
 * The words for a toast, keyed so the face can crossfade between them. Three rows of one kind read
 * "3 conversations archived"; mixed kinds read "2 conversations archived, 1 conversation deleted".
 */
function describeToast<T>(
  toast: ToastState<T>,
  actions: Record<string, UndoAction>,
  noun: readonly [string, string],
): ToastMessage {
  const total = toast.entries.length;
  const counts = new Map<string, number>();
  for (const entry of toast.entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  const kinds = [...counts.entries()];
  const single = total === 1;
  const resolve = (kind: string): UndoAction => actions[kind] ?? { label: capitalize(kind), done: kind };

  if (toast.phase === "undoing") return { key: "undoing", text: "Restoring…" };
  if (toast.phase === "restored") {
    return single
      ? { key: "restored-1", text: `${capitalize(noun[0])} restored` }
      : { key: "restored-n", count: total, text: `${noun[1]} restored` };
  }
  if (toast.phase === "error") {
    const verb = kinds.length === 1 ? resolve(kinds[0][0]).label.toLowerCase() : "update";
    return single
      ? { key: "error-1", text: `Couldn't ${verb} ${noun[0]}` }
      : { key: "error-n", text: `Couldn't ${verb} ${total} ${noun[1]}` };
  }
  if (toast.retry) return { key: "retry", text: "Couldn't undo, try again" };
  if (kinds.length > 1) {
    return { key: "mixed", text: kinds.map(([kind, count]) => `${count} ${resolve(kind).done}`).join(", ") };
  }
  const done = resolve(kinds[0][0]).done;
  return single
    ? { key: `one-${kinds[0][0]}`, text: `${capitalize(noun[0])} ${done}` }
    : { key: `many-${kinds[0][0]}`, count: total, text: `${noun[1]} ${done}` };
}

export default UndoToast;
