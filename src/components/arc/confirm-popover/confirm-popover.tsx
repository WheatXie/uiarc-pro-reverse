"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./confirm-popover.module.css";

/** Where the question is in its life: resting, asking, running, finished, or failed. */
export type ConfirmPopoverPhase = "idle" | "confirming" | "working" | "success" | "error";

/** Handed to `onConfirm` so the action can drive the bar and stop when the component unmounts. */
export interface ConfirmPopoverContext {
  /** Fill the Confirm button from 0 to 1 as the action reports progress. */
  setProgress: (value: number) => void;
  /** Aborted when the component unmounts, so the action can stop its work. */
  signal: AbortSignal;
}

export interface ConfirmPopoverProps {
  /** The trigger label, such as Delete project. */
  children: ReactNode;
  /** The question, such as Delete Atlas?. It names the dialog. */
  title: ReactNode;
  /** The consequence in one or two short sentences. It describes the dialog. */
  description?: ReactNode;
  /** A plain 16px icon before the trigger label. */
  icon?: ReactNode;
  /** A phrase to type before Confirm unlocks, such as the project name. Matching ignores case and outer spaces. Confirm fills in the tone color as the typed prefix matches, and a wrong submit shakes the card. */
  confirmText?: string;
  /** Label of the confirm button. */
  confirmLabel?: string;
  /** Label of the cancel button. */
  cancelLabel?: string;
  /** Label on the progress bar while onConfirm runs, followed by the percentage when progress is reported. */
  pendingLabel?: string;
  /** Shown with a check in the button's shape once onConfirm resolves. Keep it no longer than the trigger label so the width holds. */
  successLabel?: string;
  /** Heading of the failure. The rejection's message is shown under it. */
  errorTitle?: ReactNode;
  /** Label of the confirm button after a failure. */
  retryLabel?: string;
  /** danger tints the trigger and fills Confirm in the danger color. neutral uses the foreground, for serious but reversible actions. */
  tone?: "danger" | "neutral";
  /** Runs the action. ctx.setProgress(0 to 1) drives the bar; without it the bar sweeps. ctx.signal aborts if the component unmounts. A rejection shows the failure. */
  onConfirm?: (ctx: ConfirmPopoverContext) => void | Promise<unknown>;
  /** Called when the question is dismissed by Cancel, Escape or a press outside. */
  onCancel?: () => void;
  /** Called once the success state has been shown and the button is back at rest. */
  onDone?: () => void;
  /** Called with the rejection when onConfirm fails. */
  onError?: (error: unknown) => void;
  /** Controlled open state of the question. Pair with onOpenChange. */
  open?: boolean;
  /** Opens on mount when uncontrolled. */
  defaultOpen?: boolean;
  /** Called when the question opens, is dismissed, or closes after success. */
  onOpenChange?: (open: boolean) => void;
  /** Called with idle, confirming, working, success or error. */
  onPhaseChange?: (phase: ConfirmPopoverPhase) => void;
  /** Which edge of the button the card keeps. end grows toward the start, for buttons at the end of a row. The card shifts to stay 16px inside the window either way. */
  align?: "start" | "center" | "end";
  /** Grow downward, upward, or upward only when there is not room below. */
  side?: "bottom" | "top" | "auto";
  /** Width of the open card in px, never wider than the window less 32px. */
  width?: number;
  /** Milliseconds the success state holds before the button returns to rest. */
  resultDuration?: number;
  /** Disables the trigger. */
  disabled?: boolean;
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
}

/** Geometry of the surface: the button it starts from and the card it grows into. */
interface Geometry {
  /** Trigger width, the card's resting width. */
  tw: number;
  /** Trigger height, the card's resting height. */
  th: number;
  /** Trigger corner radius, the card's resting radius. */
  radius: number;
  /** Width of the open card. */
  w: number;
  /** Horizontal offset of the card from the trigger's left edge. */
  x: number;
  /** Grows upward from the trigger's bottom edge. */
  up: boolean;
  /** Keeps the trigger's right edge, growing toward the start. */
  right: boolean;
}

const still: Transition = { duration: 0 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const normalize = (value: string) => value.trim().toLowerCase();

/**
 * A destructive button that asks in place. Pressing it grows the button itself, as one surface, into
 * a small floating card that states the consequence, with Cancel and Confirm and an optional phrase
 * to type first. Confirm is also the progress bar: it widens as Cancel folds away and fills with the
 * action's progress, its label inverting exactly at the fill edge. On success the card folds back
 * into the button's shape with a check; on failure it stays open, shakes once and shows the error
 * with Try again. Escape and a press outside cancel; focus moves into the card and back to the button.
 */
export function ConfirmPopover({
  children,
  icon,
  title,
  description,
  confirmText,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  pendingLabel = "Deleting",
  successLabel = "Deleted",
  errorTitle = "That didn't work",
  retryLabel = "Try again",
  tone = "danger",
  onConfirm,
  onCancel,
  onDone,
  onError,
  open,
  defaultOpen = false,
  onOpenChange,
  onPhaseChange,
  align = "start",
  side = "auto",
  width = 320,
  resultDuration = 1600,
  disabled,
  className,
  style,
}: ConfirmPopoverProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = `${uid}-desc`;
  const fieldId = `${uid}-input`;

  const [phase, setPhase] = useState<ConfirmPopoverPhase>(defaultOpen ? "confirming" : "idle");
  const [mounted, setMounted] = useState(defaultOpen);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [errorText, setErrorText] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController>(null);
  const runId = useRef(0);
  const resultTimer = useRef<number | undefined>(undefined);
  const restoreFocus = useRef(false);
  const lastOpen = useRef(open);

  const fill = useMotionValue(0);
  const shakeX = useMotionValue(0);
  const surfaceX = useMotionValue(0);
  const shift = useMotionValue(0);

  const counterX = useTransform(surfaceX, (value) => -value);
  const panelX = useTransform(() => shift.get() - surfaceX.get());
  const clip = useTransform(fill, (value) => `inset(0 ${clamp01(1 - clamp01(value)) * 100}% 0 0)`);

  const shake = useCallback(() => {
    if (reduced) return;
    animate(shakeX, [0, -7, 6, -4, 3, -1, 0], { duration: 0.42, ease: motionTokens.ease.standard });
  }, [reduced, shakeX]);

  const changePhase = useCallback(
    (next: ConfirmPopoverPhase) => {
      setPhase(next);
      onPhaseChange?.(next);
    },
    [onPhaseChange],
  );

  /** Measure the trigger and work out where the card grows, before it is painted. */
  const measure = useCallback((): Geometry | null => {
    const node = triggerRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const cardWidth = Math.max(rect.width, Math.min(width, viewportWidth - 32));
    const offset = Math.min(
      Math.max(align === "end" ? rect.width - cardWidth : align === "center" ? (rect.width - cardWidth) / 2 : 0, 16 - rect.left),
      viewportWidth - 16 - cardWidth - rect.left,
    );
    const right = Math.abs(offset - (rect.width - cardWidth)) < 0.5 && offset < 0;
    const up = side === "top" || (side === "auto" && viewportHeight - rect.bottom < 280 && rect.top > viewportHeight - rect.bottom);
    return {
      tw: rect.width,
      th: rect.height,
      radius: parseFloat(getComputedStyle(node).borderTopLeftRadius) || 14,
      w: cardWidth,
      x: right ? 0 : offset,
      up,
      right,
    };
  }, [align, side, width]);

  const panelOpen = phase === "confirming" || phase === "working" || phase === "error";

  const show = useCallback(() => {
    const next = measure();
    if (!next) return;
    window.clearTimeout(resultTimer.current);
    setGeometry(next);
    shift.set(next.x);
    setTyped("");
    setErrorText("");
    setProgress(null);
    setMounted(true);
    changePhase("confirming");
    fill.set(confirmText ? 0 : 1);
  }, [confirmText, fill, measure, shift, changePhase]);

  const dismiss = useCallback(
    (returnFocus = true) => {
      restoreFocus.current = returnFocus;
      if (returnFocus && rootRef.current?.contains(document.activeElement)) {
        surfaceRef.current?.focus({ preventScroll: true });
      }
      changePhase("idle");
    },
    [changePhase],
  );

  const cancel = useCallback(() => {
    if (phase !== "confirming" && phase !== "error") return;
    lastOpen.current = false;
    onCancel?.();
    onOpenChange?.(false);
    dismiss();
  }, [dismiss, onCancel, onOpenChange, phase]);

  // Give focus back to the trigger only once the card has folded into it.
  useEffect(() => {
    if (mounted) return;
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [mounted]);

  // Unmount a beat after the card has folded back, so the faces can fade out.
  useEffect(() => {
    if (phase !== "idle" || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 900);
    return () => window.clearTimeout(timer);
  }, [phase, mounted]);

  // Controlled open state, applied after the trigger has painted.
  useEffect(() => {
    if (open === undefined || open === lastOpen.current) return;
    lastOpen.current = open;
    const frame = requestAnimationFrame(() => {
      if (open && !panelOpen) show();
      else if (!open && (phase === "confirming" || phase === "error")) dismiss(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, panelOpen, phase, show, dismiss]);

  // Track the card's natural height while it is open; the surface springs to it.
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node || !panelOpen) return;
    setPanelHeight(node.offsetHeight);
    const observer = new ResizeObserver(() => setPanelHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [panelOpen, mounted]);

  // Keep the card inside the window on resize.
  useEffect(() => {
    if (!panelOpen) return;
    const onResize = () => {
      const next = measure();
      if (!next) return;
      setGeometry(next);
      shift.set(next.x);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [panelOpen, measure, shift]);

  // Focus moves into the card: the phrase field when there is one, otherwise Cancel.
  useEffect(() => {
    if (phase !== "confirming") return;
    const frame = requestAnimationFrame(() => (inputRef.current ?? cancelRef.current)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // A press outside the root cancels.
  useEffect(() => {
    if (phase !== "confirming" && phase !== "error") return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return;
      cancel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [phase, cancel]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(resultTimer.current);
    },
    [],
  );

  const unlocked = !confirmText || normalize(typed) === normalize(confirmText);

  const onType = (value: string) => {
    setTyped(value);
    if (!confirmText) return;
    const target = normalize(confirmText);
    const candidate = value.trimStart().toLowerCase();
    let matched = 0;
    while (matched < candidate.length && matched < target.length && candidate[matched] === target[matched]) matched += 1;
    const share = matched === candidate.length || normalize(value) === target ? matched / target.length : 0;
    animate(fill, share, reduced ? still : motionTokens.spring.snappy);
  };

  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (phase === "working") return;
    if (!unlocked) {
      shake();
      inputRef.current?.focus();
      return;
    }
    const run = ++runId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorText("");
    setProgress(null);
    animate(fill, 0, reduced ? still : { ...motionTokens.spring.smooth, visualDuration: 0.3 });
    changePhase("working");
    surfaceRef.current?.focus({ preventScroll: true });
    try {
      await onConfirm?.({
        setProgress: (value) => {
          if (runId.current !== run) return;
          const next = clamp01(value);
          setProgress(next);
          animate(fill, next, reduced ? still : motionTokens.spring.smooth);
        },
        signal: controller.signal,
      });
      if (runId.current !== run) return;
      await animate(fill, 1, reduced ? still : { ...motionTokens.spring.smooth, visualDuration: 0.25 });
      changePhase("success");
      onOpenChange?.(false);
      lastOpen.current = false;
      resultTimer.current = window.setTimeout(() => {
        const active = document.activeElement;
        restoreFocus.current = active === document.body || !!rootRef.current?.contains(active);
        changePhase("idle");
        onDone?.();
      }, resultDuration);
    } catch (error) {
      if (runId.current !== run || controller.signal.aborted) return;
      onError?.(error);
      setErrorText(error instanceof Error ? error.message : typeof error === "string" ? error : "");
      animate(fill, 1, reduced ? still : motionTokens.spring.smooth);
      changePhase("error");
      shake();
      requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    }
  };

  const animateTo = geometry
    ? panelOpen
      ? { width: geometry.w, height: panelHeight || geometry.th, x: geometry.x, borderRadius: 22 }
      : { width: geometry.tw, height: geometry.th, x: 0, borderRadius: geometry.radius }
    : undefined;

  const shapeTransition: Transition = reduced ? still : panelOpen ? motionTokens.spring.morph : { ...motionTokens.spring.smooth, visualDuration: 0.36 };

  const shape = panelOpen ? "panel" : phase === "success" ? "success" : "trigger";

  const faceTransition = (delay = 0): Transition =>
    reduced ? { duration: motionTokens.duration.fast } : { ...motionTokens.spring.snappy, delay, filter: { duration: 0.2, delay } };

  const announcement =
    phase === "confirming"
      ? ""
      : phase === "working"
        ? `${pendingLabel}${progress !== null ? `, ${Math.round(progress * 100)} percent` : ""}`
        : phase === "success"
          ? successLabel
          : phase === "error"
            ? `${typeof errorTitle === "string" ? errorTitle : "Failed"}. ${errorText}`
            : "";

  const confirmTextShown = phase === "working" ? `${pendingLabel}…` : phase === "error" ? retryLabel : confirmLabel;

  const onSurfaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")].filter(
      (node) => !node.closest("[inert]"),
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const label = (shown: string) => (
    <span className={styles.confirmLabel}>
      <span>{shown}</span>
      {phase === "working" && progress !== null ? <span className={styles.percent}>{Math.round(progress * 100)}%</span> : null}
    </span>
  );

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-tone={tone} data-phase={phase}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => {
          if (disabled || panelOpen) return;
          lastOpen.current = true;
          show();
          onOpenChange?.(true);
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        data-hidden={mounted || undefined}
        tabIndex={mounted ? -1 : undefined}
      >
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{children}</span>
      </button>
      {mounted && geometry ? (
        <motion.div
          ref={surfaceRef}
          className={styles.surface}
          data-shape={shape}
          data-up={geometry.up || undefined}
          data-right={geometry.right || undefined}
          role={panelOpen ? "alertdialog" : undefined}
          aria-modal={panelOpen ? false : undefined}
          aria-labelledby={panelOpen ? titleId : undefined}
          aria-describedby={panelOpen ? descriptionId : undefined}
          aria-busy={phase === "working" || undefined}
          tabIndex={-1}
          style={{ x: surfaceX }}
          initial={{ width: geometry.tw, height: geometry.th, x: 0, borderRadius: geometry.radius }}
          animate={animateTo}
          transition={shapeTransition}
          onAnimationComplete={() => {
            if (phase === "idle") setMounted(false);
          }}
          onKeyDown={onSurfaceKeyDown}
        >
          <AnimatePresence initial={false}>
            {shape === "trigger" ? (
              <motion.span
                key="trigger"
                className={styles.faceTrigger}
                style={{ width: geometry.tw, height: geometry.th, x: counterX }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={faceTransition(0.08)}
                aria-hidden="true"
              >
                {icon ? <span className={styles.icon}>{icon}</span> : null}
                <span>{children}</span>
              </motion.span>
            ) : null}
            {shape === "success" ? (
              <motion.span
                key="success"
                className={styles.faceSuccess}
                style={{ width: geometry.tw, height: geometry.th, x: counterX }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: `blur(${motionTokens.blur.soft}px)` }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={faceTransition(0.1)}
              >
                <motion.span
                  className={styles.check}
                  initial={!reduced && { scale: 0.4, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={reduced ? still : { ...motionTokens.spring.morph, delay: 0.12 }}
                >
                  <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                </motion.span>
                <span>{successLabel}</span>
              </motion.span>
            ) : null}
            {shape === "panel" ? (
              <motion.div
                key="panel"
                ref={panelRef}
                className={styles.panel}
                data-up={geometry.up || undefined}
                style={{ width: geometry.w, x: panelX }}
                initial={
                  reduced ? { opacity: 0 } : { opacity: 0, y: geometry.up ? 6 : -6, filter: `blur(${motionTokens.blur.soft}px)` }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        filter: `blur(${motionTokens.blur.subtle}px)`,
                        transition: { duration: motionTokens.duration.instant },
                      }
                }
                transition={faceTransition(0.06)}
              >
                <motion.form className={styles.form} onSubmit={submit} style={{ x: shakeX }} noValidate>
                  <div className={styles.copy}>
                    <h2 id={titleId} className={styles.title}>
                      {title}
                    </h2>
                    {description ? (
                      <p id={descriptionId} className={styles.description}>
                        {description}
                      </p>
                    ) : null}
                  </div>
                  {confirmText ? (
                    <div className={styles.field}>
                      <label htmlFor={fieldId} className={styles.fieldLabel}>
                        Type <span className={styles.phrase}>{confirmText}</span> to confirm
                      </label>
                      <input
                        ref={inputRef}
                        id={fieldId}
                        className={styles.input}
                        value={typed}
                        onChange={(event) => onType(event.target.value)}
                        placeholder={confirmText}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={phase === "working"}
                        aria-invalid={(typed.length > 0 && !unlocked) || undefined}
                      />
                    </div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {phase === "error" ? (
                      <motion.div
                        key="error"
                        className={styles.errorWrap}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={reduced ? still : motionTokens.spring.smooth}
                      >
                        <p className={styles.error} role="alert">
                          <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                          <span>
                            <span className={styles.errorTitle}>{errorTitle}</span>
                            {errorText ? <span className={styles.errorText}>{errorText}</span> : null}
                          </span>
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <div className={styles.actions}>
                    <motion.span
                      className={styles.cancelSlot}
                      initial={false}
                      animate={
                        phase === "working"
                          ? { flexGrow: 0, opacity: 0, marginRight: 0 }
                          : { flexGrow: 1, opacity: 1, marginRight: 8 }
                      }
                      transition={reduced ? still : motionTokens.spring.smooth}
                      inert={phase === "working"}
                    >
                      <button ref={cancelRef} type="button" className={styles.cancel} onClick={cancel}>
                        {cancelLabel}
                      </button>
                    </motion.span>
                    <button
                      ref={confirmRef}
                      type="submit"
                      className={styles.confirm}
                      data-locked={!unlocked || undefined}
                      data-working={phase === "working" || undefined}
                      data-indeterminate={(phase === "working" && progress === null) || undefined}
                      aria-disabled={!unlocked || phase === "working" || undefined}
                    >
                      {label(confirmTextShown)}
                      <motion.span className={styles.fill} style={{ clipPath: clip }} aria-hidden="true">
                        {label(confirmTextShown)}
                      </motion.span>
                      {phase === "working" && progress === null ? <span className={styles.sweep} aria-hidden="true" /> : null}
                    </button>
                  </div>
                </motion.form>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export default ConfirmPopover;
