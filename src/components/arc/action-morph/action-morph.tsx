"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type AriaRole, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { ArrowLeft, Check, CornerDownLeft, LoaderCircle, Plus, TriangleAlert, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./action-morph.module.css";

export interface ActionMorphChoices {
  /** Small label above the segmented choices. */
  label: string;
  options: string[];
  defaultIndex?: number;
}

export interface ActionMorphComposer {
  title: string;
  placeholder: string;
  /** Multiline actions accept Mod+Enter instead of Enter. */
  multiline?: boolean;
  choices?: ActionMorphChoices;
  submitLabel: string;
  /** Announced once the submit promise resolves. */
  successLabel: string;
  /** Shown when submitting an empty draft. */
  emptyHint?: string;
}

export interface ActionMorphAction {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  /** Single letter; opens the composer straight from the menu. */
  shortcut?: string;
  composer: ActionMorphComposer;
}

export interface ActionMorphSubmit {
  action: string;
  text: string;
  choice?: string;
}

export interface ActionMorphProps {
  actions: ActionMorphAction[];
  /** Accessible name of the trigger button and the menu title. */
  label?: string;
  /** Rejects to keep the composer open and show an inline error. */
  onSubmit?: (submit: ActionMorphSubmit) => void | Promise<void>;
  /** Which corner of the container the trigger hugs. */
  corner?: "end" | "start";
  /** How long the success tick stays before returning to the plus. */
  resetAfter?: number;
  className?: string;
}

const MENU = "menu";
const FAB = "fab";

const { blur, stagger } = motionTokens;

function spring(visualDuration: number, bounce: number) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
}

const WIDE_SPRING = spring(0.46, 0);
const NARROW_SPRING = spring(0.38, 0);
const PILL_SPRING = spring(0.28, 0);
const FACE_X_SPRING = spring(0.4, 0);
const PRESS_SPRING = spring(0.2, 0);
const CHECK_SPRING = spring(0.36, 0);
const SHAKE_SPRING = { type: "spring" as const, stiffness: 900, damping: 57, velocity: -260 };

const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD_EASE = [...motionTokens.ease.standard] as [number, number, number, number];

/** Faces slide sideways in the direction the user is moving through the stack. */
const faceVariants: Variants = {
  hidden: (direction: number) =>
    direction
      ? { opacity: 0, x: 28 * direction, scale: 1, filter: `blur(${blur.soft}px)` }
      : { opacity: 0, x: 0, scale: 0.9, filter: `blur(${blur.soft}px)` },
  shown: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      x: FACE_X_SPRING,
      scale: WIDE_SPRING,
      opacity: { duration: 0.22, ease: ENTER_EASE, delay: 0.05 },
      filter: { duration: 0.24, ease: ENTER_EASE, delay: 0.05 },
      delayChildren: 0.06,
      staggerChildren: stagger.item,
    },
  },
  gone: (direction: number) =>
    direction
      ? {
          opacity: 0,
          x: -28 * direction * 0.7,
          filter: `blur(${blur.soft}px)`,
          transition: {
            x: FACE_X_SPRING,
            opacity: { duration: 0.12, ease: STANDARD_EASE },
            filter: { duration: 0.12, ease: STANDARD_EASE },
          },
        }
      : {
          opacity: 0,
          scale: 0.92,
          filter: `blur(${blur.soft}px)`,
          transition: { duration: 0.12, ease: STANDARD_EASE },
        },
};

/** Reduced motion keeps the faces in place and only cross-fades them. */
const stillVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.16 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { y: CHECK_SPRING, opacity: { duration: 0.2, ease: ENTER_EASE } },
  },
};

const stillRowVariants: Variants = {
  hidden: { opacity: 1 },
  shown: { opacity: 1 },
};

function depth(view: string) {
  if (view === FAB) return 0;
  if (view === MENU) return 1;
  return 2;
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

interface FaceProps {
  faceId: string;
  direction: number;
  reduced: boolean;
  onSize: (face: string, size: { w: number; h: number }) => void;
  className?: string;
  children: ReactNode;
  label?: string;
  role?: AriaRole;
}

function Face({ faceId, direction, reduced, onSize, className, children, label, role }: FaceProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || !mounted) return;
    const report = () => onSize(faceId, { w: node.offsetWidth, h: node.offsetHeight });
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [faceId, mounted, onSize]);

  return (
    <motion.div
      ref={nodeRef}
      className={[styles.face, className].filter(Boolean).join(" ")}
      data-face={faceId}
      custom={direction}
      role={role}
      aria-label={label}
      variants={reduced ? stillVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!mounted || undefined}
    >
      {children}
    </motion.div>
  );
}

function Glyph({ done, reduced }: { done: boolean; reduced: boolean }) {
  const [initialDone] = useState(done);

  return (
    <span className={styles.glyph} aria-hidden="true">
      <AnimatePresence initial={initialDone} mode="popLayout">
        {done ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.6, transition: { duration: 0.12 } }}
            transition={reduced ? { duration: 0.12 } : PRESS_SPRING}
          >
            <motion.path
              d="M5.5 12.5l4.2 4.2 8.8-9.2"
              initial={{ pathLength: Number(!reduced) }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.32 * Number(!reduced), ease: ENTER_EASE, delay: 0.12 * Number(!reduced) }}
            />
          </motion.svg>
        ) : (
          <motion.span
            key="plus"
            className={styles.plus}
            initial={{ opacity: 0, rotate: reduced ? 0 : -90, scale: reduced ? 1 : 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 45 * Number(!reduced), scale: reduced ? 1 : 0.6, transition: { duration: 0.12 } }}
            transition={reduced ? { duration: 0.12 } : CHECK_SPRING}
          >
            <Plus size={22} strokeWidth={1.75} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

interface Failure {
  id: number;
  text: string;
}

/**
 * One floating button that morphs between a trigger, an action menu and the
 * composer for whichever action was picked. The container animates its own
 * width, height and corner radius to the measured size of the current face, so
 * the shape grows out of the button instead of appearing next to it.
 */
export function ActionMorph({ actions, label = "Create", onSubmit, corner = "end", resetAfter = 1600, className }: ActionMorphProps) {
  const mounted = useMounted();
  const reduced = Boolean(useReducedMotion()) && mounted;
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<string>(FAB);
  const [direction, setDirection] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<number | null>(null);
  const [announce, setAnnounce] = useState({ id: 0, text: "" });

  const action = actions.find((entry) => entry.id === view);
  const composer = action?.composer;
  const draft = action ? (drafts[action.id] ?? "") : "";
  const choiceIndex = action && composer?.choices ? (choices[action.id] ?? composer.choices.defaultIndex ?? 0) : 0;

  const width = useMotionValue<string | number>("100%");
  const height = useMotionValue<string | number>("100%");
  const radius = useMotionValue<string | number>("50%");
  const scale = useMotionValue(1);

  const sizes = useRef(new Map<string, { w: number; h: number }>());
  const frame = useRef({ view: FAB, reduced: false, measured: false });
  const previous = useRef({ w: 0, h: 0 });

  const fit = useCallback(() => {
    const state = frame.current;
    const size = sizes.current.get(state.view);
    if (!size || !size.w) return;
    const nextRadius = state.view === FAB ? size.h / 2 : 24;
    const last = previous.current;
    if (Math.abs(last.w - size.w) < 0.5 && Math.abs(last.h - size.h) < 0.5 && state.measured) return;
    previous.current = size;
    if (!state.measured || state.reduced) {
      width.jump(size.w);
      height.jump(size.h);
      radius.jump(nextRadius);
      state.measured = true;
      return;
    }
    const springToUse = size.w * size.h >= last.w * last.h ? WIDE_SPRING : NARROW_SPRING;
    animate(width, size.w, springToUse);
    animate(height, size.h, springToUse);
    animate(radius, nextRadius, springToUse);
  }, [height, radius, width]);

  const measure = useCallback(
    (face: string, size: { w: number; h: number }) => {
      sizes.current.set(face, size);
      if (face === frame.current.view) fit();
    },
    [fit],
  );

  useLayoutEffect(() => {
    frame.current.view = view;
    frame.current.reduced = reduced;
    fit();
  }, [fit, reduced, view]);

  const go = (next: string) => {
    if (next === view) return;
    const from = depth(view);
    const to = depth(next);
    setDirection(from >= 1 && to >= 1 ? Math.sign(to - from) || 1 : 0);
    setFailure(null);
    setHover(null);
    setView(next);
  };

  const pendingFocus = useRef<string | null>(null);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === FAB) fabRef.current?.focus({ preventScroll: true });
    else if (target === "field") fieldRef.current?.focus({ preventScroll: true });
    else menuRef.current?.querySelector<HTMLElement>(`[data-action="${target}"]`)?.focus({ preventScroll: true });
  }, [view]);

  const openComposer = (id: string) => {
    pendingFocus.current = "field";
    go(id);
  };

  const back = () => {
    pendingFocus.current = view;
    go(MENU);
  };

  const close = useCallback((returnFocus = true) => {
    if (returnFocus && rootRef.current?.contains(document.activeElement)) pendingFocus.current = FAB;
    setDirection(0);
    setFailure(null);
    setHover(null);
    setView(FAB);
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(false), resetAfter);
    return () => window.clearTimeout(timer);
  }, [done, resetAfter]);

  const expanded = view !== FAB;

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, expanded]);

  const shake = useMotionValue(0);
  const shakeField = () => {
    if (reduced) return;
    animate(shake, 0, SHAKE_SPRING);
  };

  const attempt = useRef(0);
  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (!action || !composer || saving) return;
    const text = draft.trim();
    if (!text) {
      setFailure({ id: attempt.current, text: composer.emptyHint ?? "Write something first" });
      shakeField();
      fieldRef.current?.focus();
      return;
    }
    const token = ++attempt.current;
    setSaving(true);
    setFailure(null);
    try {
      await onSubmit?.({ action: action.id, text, choice: composer.choices?.options[choiceIndex] });
    } catch {
      if (token !== attempt.current) return;
      setSaving(false);
      setFailure({ id: attempt.current, text: "Couldn’t save. Try again." });
      shakeField();
      return;
    }
    if (token !== attempt.current) return;
    setSaving(false);
    setDrafts((current) => ({ ...current, [action.id]: "" }));
    if (rootRef.current?.contains(document.activeElement)) pendingFocus.current = FAB;
    setDone(true);
    setDirection(0);
    setView(FAB);
    setAnnounce((current) => ({ id: current.id + 1, text: composer.successLabel }));
  };

  const highlightY = useMotionValue(0);
  const highlightH = useMotionValue(0);
  const highlightOpacity = useMotionValue(0);

  useLayoutEffect(() => {
    const node = hover === null ? null : menuRef.current?.querySelector<HTMLElement>(`[data-index="${hover}"]`);
    if (node) {
      if (highlightOpacity.get() < 0.05 || reduced) {
        highlightY.jump(node.offsetTop);
        highlightH.jump(node.offsetHeight);
      } else {
        animate(highlightY, node.offsetTop, PILL_SPRING);
        animate(highlightH, node.offsetHeight, PILL_SPRING);
      }
      animate(highlightOpacity, 1, { duration: 0.12 * Number(!reduced), ease: ENTER_EASE });
    } else {
      animate(highlightOpacity, 0, { duration: 0.14 * Number(!reduced), ease: STANDARD_EASE });
    }
  }, [highlightH, highlightOpacity, highlightY, hover, reduced, view]);

  const press = () => animate(scale, 1, PRESS_SPRING);

  const menuTitleId = `${uid}-menu-title`;
  const composerTitleId = `${uid}-${view}-title`;
  const rowTransition = reduced ? stillRowVariants : rowVariants;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-corner={corner}
      data-view={view === FAB ? "fab" : view === MENU ? "menu" : "composer"}
      data-done={done || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (view === FAB) return;
        event.preventDefault();
        if (view === MENU) close();
        else if (!saving) back();
      }}
    >
      <motion.div className={styles.shape} style={{ width, height, borderRadius: radius, scale }}>
        <AnimatePresence initial={false} custom={direction}>
          {view === FAB && (
            <Face key="fab" faceId={FAB} direction={direction} reduced={reduced} onSize={measure} className={styles.fabFace}>
              <button
                ref={fabRef}
                type="button"
                className={styles.fab}
                aria-label={done ? `${label}. ${announce.text}` : label}
                aria-haspopup="menu"
                aria-expanded={false}
                onClick={() => {
                  pendingFocus.current = actions[0]?.id ?? null;
                  setDone(false);
                  go(MENU);
                }}
                onPointerDown={(event) => {
                  if (event.button === 0 && !reduced) animate(scale, 0.94, PRESS_SPRING);
                }}
                onPointerUp={press}
                onPointerLeave={press}
                onPointerCancel={press}
              >
                <Glyph done={done} reduced={reduced} />
              </button>
            </Face>
          )}

          {view === MENU && (
            <Face
              key={MENU}
              faceId={MENU}
              direction={direction}
              reduced={reduced}
              onSize={measure}
              className={styles.menuFace}
            >
              <motion.div className={styles.header} variants={rowTransition}>
                <p id={menuTitleId} className={styles.title}>
                  {label}
                </p>
                <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => close()}>
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </motion.div>
              <div
                ref={menuRef}
                className={styles.menu}
                role="menu"
                aria-labelledby={menuTitleId}
                onKeyDown={(event) => {
                  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitem']"));
                  const current = items.indexOf(document.activeElement as HTMLElement);
                  const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
                  let target: number | null = null;
                  if (event.key in step) target = current < 0 ? 0 : (current + step[event.key] + items.length) % items.length;
                  else if (event.key === "Home") target = 0;
                  else if (event.key === "End") target = items.length - 1;
                  else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
                    const match = actions.find((entry) => entry.shortcut?.toLowerCase() === event.key.toLowerCase());
                    if (match) {
                      event.preventDefault();
                      openComposer(match.id);
                    }
                    return;
                  }
                  if (target !== null) {
                    event.preventDefault();
                    items[target]?.focus();
                  }
                }}
                onPointerLeave={() => setHover(null)}
              >
                <motion.span
                  className={styles.highlight}
                  style={{ y: highlightY, height: highlightH, opacity: highlightOpacity }}
                  aria-hidden="true"
                />
                {actions.map((entry, index) => (
                  <motion.button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    className={styles.item}
                    data-index={index}
                    data-action={entry.id}
                    variants={rowTransition}
                    aria-keyshortcuts={entry.shortcut}
                    onClick={() => openComposer(entry.id)}
                    onPointerMove={(event) => {
                      if (event.pointerType === "mouse" && hover !== index) setHover(index);
                    }}
                    onFocus={() => setHover(index)}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      {entry.icon}
                    </span>
                    <span className={styles.itemText}>
                      <span className={styles.itemLabel}>{entry.label}</span>
                      {entry.description && <span className={styles.itemDescription}>{entry.description}</span>}
                    </span>
                    {entry.shortcut && (
                      <kbd className={styles.kbd} aria-hidden="true">
                        {entry.shortcut.toUpperCase()}
                      </kbd>
                    )}
                  </motion.button>
                ))}
              </div>
            </Face>
          )}

          {action && composer && (
            <Face
              key={action.id}
              faceId={action.id}
              direction={direction}
              reduced={reduced}
              onSize={measure}
              className={styles.composerFace}
            >
              <form
                className={styles.form}
                aria-labelledby={composerTitleId}
                onSubmit={submit}
                aria-busy={saving || undefined}
              >
                <motion.div className={styles.header} variants={rowTransition}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Back to actions"
                    onClick={back}
                    disabled={saving}
                  >
                    <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <p id={composerTitleId} className={styles.title}>
                    {composer.title}
                  </p>
                  <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => close()}>
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </motion.div>
                <motion.div variants={rowTransition} style={{ x: shake }}>
                  {composer.multiline ? (
                    <textarea
                      ref={(node) => {
                        fieldRef.current = node;
                      }}
                      className={`${styles.field} ${styles.textarea}`}
                      rows={3}
                      placeholder={composer.placeholder}
                      aria-label={composer.title}
                      value={draft}
                      readOnly={saving}
                      aria-invalid={Boolean(failure) || undefined}
                      aria-describedby={failure ? `${uid}-error` : undefined}
                      aria-keyshortcuts="Meta+Enter Control+Enter"
                      onChange={(event) => {
                        setDrafts((current) => ({ ...current, [action.id]: event.target.value }));
                        setFailure(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                    />
                  ) : (
                    <input
                      ref={(node) => {
                        fieldRef.current = node;
                      }}
                      className={styles.field}
                      type="text"
                      placeholder={composer.placeholder}
                      aria-label={composer.title}
                      value={draft}
                      readOnly={saving}
                      autoComplete="off"
                      aria-invalid={Boolean(failure) || undefined}
                      aria-describedby={failure ? `${uid}-error` : undefined}
                      onChange={(event) => {
                        setDrafts((current) => ({ ...current, [action.id]: event.target.value }));
                        setFailure(null);
                      }}
                    />
                  )}
                </motion.div>
                {composer.choices && (
                  <motion.div variants={rowTransition} className={styles.choiceBlock}>
                    <span id={`${uid}-choices`} className={styles.choiceLabel}>
                      {composer.choices.label}
                    </span>
                    <div
                      className={styles.choices}
                      role="radiogroup"
                      aria-labelledby={`${uid}-choices`}
                      style={{ "--count": composer.choices.options.length } as CSSProperties}
                      onKeyDown={(event) => {
                        const count = composer.choices?.options.length ?? 0;
                        const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
                        if (!(event.key in step)) return;
                        event.preventDefault();
                        const next = (choiceIndex + step[event.key] + count) % count;
                        setChoices((current) => ({ ...current, [action.id]: next }));
                        event.currentTarget.querySelectorAll<HTMLElement>("[role='radio']")[next]?.focus();
                      }}
                    >
                      {composer.choices.options.map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={index === choiceIndex}
                          tabIndex={index === choiceIndex ? 0 : -1}
                          className={styles.choice}
                          disabled={saving}
                          onClick={() => setChoices((current) => ({ ...current, [action.id]: index }))}
                        >
                          {index === choiceIndex && (
                            <motion.span
                              layoutId={`${uid}-choice-${action.id}`}
                              className={styles.choicePill}
                              transition={reduced ? { duration: 0 } : PILL_SPRING}
                              aria-hidden="true"
                            />
                          )}
                          <span className={styles.choiceText}>{option}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
                <motion.div variants={rowTransition} className={styles.footer}>
                  <span id={`${uid}-error`} className={styles.status} aria-live="polite">
                    <AnimatePresence initial={false} mode="popLayout">
                      {failure && (
                        <motion.span
                          key={failure.id}
                          className={styles.error}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={reduced ? { duration: 0.1 } : PILL_SPRING}
                        >
                          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                          {failure.text}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <button type="submit" className={styles.submit} aria-disabled={saving || undefined}>
                    <span className={styles.submitFace} data-on={!saving || undefined}>
                      {composer.submitLabel}
                      <CornerDownLeft size={14} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className={styles.submitFace} data-on={saving || undefined} aria-hidden={!saving}>
                      <LoaderCircle className={styles.spinner} size={16} strokeWidth={1.75} aria-hidden="true" />
                      Saving
                    </span>
                  </button>
                </motion.div>
              </form>
            </Face>
          )}
        </AnimatePresence>
      </motion.div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        <span key={announce.id}>{announce.text}</span>
      </span>
    </div>
  );
}

export default ActionMorph;
