"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { CircleAlert, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./response-feedback.module.css";

export type FeedbackRating = "up" | "down";

export interface FeedbackEvent {
  /** `rating` fires on every thumb press, `details` when the note is submitted. */
  stage: "rating" | "details";
  rating: FeedbackRating | null;
  reasons: string[];
  comment: string;
  messageId: string;
}

export interface FeedbackHandlerOptions {
  signal: AbortSignal;
}

export type FeedbackHandler = (event: FeedbackEvent, options: FeedbackHandlerOptions) => void | Promise<void>;

export interface FeedbackActionsProps {
  /** Rendered before the thumbs — copy the reply, regenerate it, whatever belongs on that line. */
  leading?: ReactNode;
  onFeedback?: FeedbackHandler;
  messageId?: string;
  /** Controlled rating. Leave undefined to let the component own it. */
  rating?: FeedbackRating | null;
  defaultRating?: FeedbackRating | null;
  onRatingChange?: (rating: FeedbackRating | null) => void;
  negativeReasons?: string[];
  positiveReasons?: string[];
  allowComment?: boolean;
  commentPlaceholder?: string;
  commentMaxLength?: number;
  privacyNote?: ReactNode;
  thanksMessage?: ReactNode;
  thanksDuration?: number;
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export interface ResponseFeedbackModel {
  name: string;
  mark?: ReactNode;
}

export interface ResponseFeedbackProps extends Omit<FeedbackActionsProps, "leading"> {
  model?: ResponseFeedbackModel;
  /** The question above the reply. Pass null to drop it. */
  prompt?: ReactNode | null;
  children?: ReactNode;
  /** Copied text. Defaults to the sample reply when there is no children, null hides the button. */
  copyText?: string | null;
  onRegenerate?: () => void;
}

const NEGATIVE_REASONS = ["Inaccurate", "Not helpful", "Too long", "Unsafe", "Other"];
const POSITIVE_REASONS = ["Accurate", "Easy to follow", "Good examples", "Saved me time"];
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const PANEL_SPRING: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };

const DEFAULT_PROMPT = "Why did our orders query get slower after we added an index on created_at?";

const SAMPLE_REPLY = `Most likely the planner now prefers the new index for ORDER BY created_at, then filters status = 'paid' row by row. With 4.2M orders and only 3% paid, that walks most of the table.

- Run EXPLAIN (ANALYZE, BUFFERS) and look for an Index Scan on orders_created_at_idx with a large Rows Removed by Filter.
- Replace it with a composite index on (status, created_at), so the filter and the sort use one index.
- Run ANALYZE orders afterwards, so the planner sees fresh statistics.`;

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

/** Claude's starburst, drawn from the shipped path so the mark matches the product. */
function ClaudeMark({ label = "Claude" }: { label?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="#D97757" role="img" aria-label={label}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function Tick({ reduced }: { reduced: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: EASE, delay: 0.06 }}
      />
    </svg>
  );
}

interface ThumbProps {
  kind: FeedbackRating;
  active: boolean;
  expanded: boolean;
  controls: string;
  disabled: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onPress: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function Thumb({ kind, active, expanded, controls, disabled, buttonRef, onPress }: ThumbProps) {
  const Icon = kind === "up" ? ThumbsUp : ThumbsDown;
  const label = kind === "up" ? "Good response" : "Bad response";

  return (
    <Tooltip content={label}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.iconButton}
        data-active={active || undefined}
        aria-pressed={active}
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={expanded ? controls : undefined}
        disabled={disabled}
        onClick={onPress}
      >
        <span className={styles.thumb} aria-hidden="true">
          <Icon className={styles.thumbOutline} size={16} strokeWidth={1.75} />
          <Icon className={styles.thumbFill} size={16} strokeWidth={1.75} fill="currentColor" />
        </span>
      </button>
    </Tooltip>
  );
}

function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <div className={cx(styles.swap, className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: 2 * (reduced ? 0 : 1) }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Keeps the panel at its natural height while its content changes, so a wrapped chip row grows the
 * box smoothly instead of snapping.
 */
function usePanelHeight() {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    let animation: ReturnType<typeof animate> | undefined;
    const box = outer.current;
    const content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;

    let height = content.offsetHeight;
    let width = content.offsetWidth;
    const reset = () => {
      box.style.height = "";
      animation = undefined;
    };

    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight;
      const nextWidth = content.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? box.getBoundingClientRect().height : height;
      height = nextHeight;
      animation?.stop();
      if (reduced || widthChanged) {
        reset();
        return;
      }
      animation = animate(box, { height: [from, nextHeight] }, { ...PANEL_SPRING, onComplete: reset });
    });

    observer.observe(content);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduced]);

  return { outer, inner };
}

export function FeedbackActions({
  messageId = "",
  rating,
  defaultRating = null,
  onRatingChange,
  onFeedback,
  negativeReasons = NEGATIVE_REASONS,
  positiveReasons = POSITIVE_REASONS,
  allowComment = true,
  commentPlaceholder = "Add details (optional)",
  commentMaxLength = 1000,
  privacyNote = "Shares this reply for review",
  thanksMessage,
  thanksDuration = 1600,
  leading,
  trailing,
  disabled = false,
  className,
}: FeedbackActionsProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const panelId = `${uid}-panel`;
  const headingId = `${uid}-heading`;

  const [internal, setInternal] = useState<FeedbackRating | null>(defaultRating);
  const value = rating !== undefined ? rating : internal;
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<FeedbackRating>("down");
  const [status, setStatus] = useState<"idle" | "sending" | "thanks" | "error">("idle");
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const upRef = useRef<HTMLButtonElement | null>(null);
  const downRef = useRef<HTMLButtonElement | null>(null);
  const firstChipRef = useRef<HTMLButtonElement | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);
  const thanksRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ratingCall = useRef<AbortController | null>(null);
  const submitCall = useRef<AbortController | null>(null);
  const thanksTimer = useRef<number | undefined>(undefined);
  const focusComment = useRef(false);
  const restoreFocus = useRef(false);
  const { outer, inner } = usePanelHeight();

  const simulated = !onFeedback;
  const note = thanksMessage ?? (simulated ? "Simulated, nothing was sent." : "It helps improve future replies.");
  const reasonsFor = direction === "down" ? negativeReasons : positiveReasons;

  useEffect(
    () => () => {
      ratingCall.current?.abort();
      submitCall.current?.abort();
      window.clearTimeout(thanksTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open || !focusComment.current) return;
    focusComment.current = false;
    (firstChipRef.current ?? commentRef.current)?.focus({ preventScroll: true });
  }, [open, direction]);

  useEffect(() => {
    if (status !== "thanks" || !restoreFocus.current) return;
    restoreFocus.current = false;
    thanksRef.current?.focus({ preventScroll: true });
  }, [status]);

  const thumbRef = (kind: FeedbackRating) => (kind === "up" ? upRef : downRef);

  const commitRating = (next: FeedbackRating | null) => {
    setInternal(next);
    onRatingChange?.(next);
    ratingCall.current?.abort();
    if (!onFeedback) return;
    const controller = new AbortController();
    ratingCall.current = controller;
    Promise.resolve()
      .then(() => onFeedback({ stage: "rating", rating: next, reasons: [], comment: "", messageId }, { signal: controller.signal }))
      .catch(() => {
        if (controller.signal.aborted) return;
        setInternal(value);
        onRatingChange?.(value);
        setAnnouncement("Couldn't save your rating. Try again.");
      });
  };

  const closePanel = (focus: boolean) => {
    submitCall.current?.abort();
    window.clearTimeout(thanksTimer.current);
    setOpen(false);
    if (focus) thumbRef(direction).current?.focus({ preventScroll: true });
  };

  const press = (kind: FeedbackRating, event: ReactMouseEvent<HTMLButtonElement>) => {
    submitCall.current?.abort();
    window.clearTimeout(thanksTimer.current);

    if (value === kind) {
      commitRating(null);
      setOpen(false);
      setAnnouncement(simulated ? "Rating removed. Simulated, nothing was sent." : "Rating removed.");
      return;
    }

    commitRating(kind);
    const nextOpen = kind === "down" ? negativeReasons.length > 0 || allowComment : positiveReasons.length > 0;
    setDirection(kind);
    setReasons([]);
    setComment("");
    setStatus("idle");
    setOpen(nextOpen);
    focusComment.current = nextOpen && kind === "down" && event.detail === 0;

    const label = kind === "up" ? "Marked as a good response." : "Marked as a bad response.";
    const prompt = nextOpen ? (kind === "down" ? " Tell us what went wrong." : " Tell us what was good, or skip.") : "";
    setAnnouncement(`${label}${prompt}${simulated ? " Simulated, nothing was sent." : ""}`);
  };

  const submittable = reasons.length > 0 || comment.trim().length > 0;

  const submit = (focus: boolean) => {
    if (status === "sending" || !submittable) return;
    window.clearTimeout(thanksTimer.current);
    submitCall.current?.abort();
    const controller = new AbortController();
    submitCall.current = controller;
    const event: FeedbackEvent = { stage: "details", rating: direction, reasons, comment: comment.trim(), messageId };

    setStatus("sending");
    setAnnouncement("Sending feedback.");

    const work = onFeedback
      ? Promise.resolve().then(() => onFeedback(event, { signal: controller.signal }))
      : new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, 700);
          controller.signal.addEventListener(
            "abort",
            () => {
              window.clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });

    work.then(
      () => {
        if (controller.signal.aborted) return;
        restoreFocus.current = focus || Boolean(panelRef.current?.contains(document.activeElement));
        setStatus("thanks");
        setAnnouncement(`Thanks for the feedback. ${typeof note === "string" ? note : ""}`.trim());
        thanksTimer.current = window.setTimeout(() => {
          const focused = Boolean(panelRef.current?.contains(document.activeElement));
          setOpen(false);
          if (focused) thumbRef(direction).current?.focus({ preventScroll: true });
        }, thanksDuration);
      },
      () => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setAnnouncement("Couldn't send your feedback. Try again.");
      },
    );
  };

  const chips = reasonsFor.length ? (
    <div className={styles.chips} role="group" aria-label={direction === "down" ? "Reasons" : "What was good"}>
      {reasonsFor.map((reason, index) => (
        <button
          key={reason}
          ref={index === 0 ? firstChipRef : undefined}
          type="button"
          className={styles.chip}
          aria-pressed={reasons.includes(reason)}
          disabled={status === "sending"}
          onClick={(event) => {
            if (status === "sending") return;
            const adding = !reasons.includes(reason);
            if (status === "error") setStatus("idle");
            setReasons((current) =>
              current.includes(reason) ? current.filter((item) => item !== reason) : reasonsFor.filter((item) => item === reason || current.includes(item)),
            );
            if (adding && reason === "Other" && event.detail > 0) commentRef.current?.focus({ preventScroll: true });
          }}
        >
          {reason}
        </button>
      ))}
    </div>
  ) : null;

  const error = (
    <span className={styles.error}>
      <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className={styles.errorText}>Couldn&apos;t send</span>
    </span>
  );

  const downForm = (
    <div className={styles.form} role="group" aria-labelledby={headingId}>
      <div className={styles.head}>
        <span id={headingId} className={styles.heading}>
          What went wrong?
        </span>
        <button type="button" className={styles.close} aria-label="Close feedback" onClick={(event) => closePanel(event.detail === 0)}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {chips}
      {allowComment ? (
        <textarea
          ref={commentRef}
          className={styles.comment}
          value={comment}
          maxLength={commentMaxLength}
          rows={2}
          aria-label="Feedback details"
          placeholder={reasons.includes("Other") ? "Tell us what went wrong" : commentPlaceholder}
          onChange={(event) => {
            setComment(event.target.value);
            if (status === "error") setStatus("idle");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit(true);
            }
          }}
        />
      ) : null}
      <div className={styles.footer}>
        <Swap id={status === "error" ? "error" : "note"} reduced={reduced} className={status === "error" ? undefined : styles.noteCell}>
          {status === "error" ? error : <span className={styles.note}>{privacyNote}</span>}
        </Swap>
        <div className={styles.footActions}>
          <Button
            variant="ghost"
            size="sm"
            className={cx(styles.action, styles.cancel)}
            onClick={(event) => closePanel(event.detail === 0)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            className={cx(styles.action, styles.submit)}
            loading={status === "sending"}
            disabled={!submittable && status !== "sending"}
            onClick={(event) => submit(event.detail === 0)}
          >
            {status === "error" ? "Try again" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );

  const upForm = (
    <div className={styles.form} role="group" aria-label="What was good?">
      <div className={styles.head}>
        <Swap id={status === "error" ? "error" : "label"} reduced={reduced}>
          {status === "error" ? (
            error
          ) : (
            <span className={styles.heading} aria-hidden="true">
              What was good?
            </span>
          )}
        </Swap>
        <Button
          variant={reasons.length ? "primary" : "ghost"}
          size="sm"
          className={cx(styles.action, styles.headAction, reasons.length > 0 && styles.submit)}
          loading={status === "sending"}
          onClick={(event) => (reasons.length ? submit(event.detail === 0) : closePanel(event.detail === 0))}
        >
          {status === "error" ? "Try again" : reasons.length ? "Send" : "Skip"}
        </Button>
      </div>
      {chips}
    </div>
  );

  const thanks = (
    <div ref={thanksRef} className={styles.thanks} tabIndex={-1}>
      <span className={styles.thanksIcon}>
        <Tick reduced={reduced} />
      </span>
      <span className={styles.thanksTitle}>Thanks for the feedback</span>
      <span className={styles.muted}>{note}</span>
    </div>
  );

  const panelKind = status === "thanks" ? "thanks" : direction;

  return (
    <div className={cx(styles.feedback, className)} data-rating={value ?? undefined}>
      <div className={styles.row}>
        <div className={styles.actions}>
          {leading}
          <Thumb
            kind="up"
            active={value === "up"}
            expanded={open && direction === "up"}
            controls={panelId}
            disabled={disabled}
            buttonRef={upRef}
            onPress={(event) => press("up", event)}
          />
          <Thumb
            kind="down"
            active={value === "down"}
            expanded={open && direction === "down"}
            controls={panelId}
            disabled={disabled}
            buttonRef={downRef}
            onPress={(event) => press("down", event)}
          />
        </div>
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            ref={panelRef}
            className={styles.panelClip}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closePanel(true);
              }
            }}
            initial={{ height: reduced ? "auto" : 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
            transition={reduced ? { duration: 0.12 } : { height: PANEL_SPRING, opacity: { duration: 0.16, ease: EASE } }}
          >
            <div className={styles.panelPad}>
              <div ref={outer} className={styles.panel}>
                <div ref={inner} className={styles.panelInner}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={panelKind}
                      className={styles.panelContent}
                      initial={{ opacity: 0, y: 2 * (reduced ? 0 : 1) }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.16, ease: EASE, delay: 0.04 }}
                    >
                      {status === "thanks" ? thanks : direction === "down" ? downForm : upForm}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

function SampleReply() {
  return (
    <Fragment>
      <p>
        Most likely the planner now prefers the new index for <code>ORDER BY created_at</code>, then filters{" "}
        <code>status = &apos;paid&apos;</code> row by row. With 4.2M orders and only 3% paid, that walks most of the table.
      </p>
      <ul>
        <li>
          Run <code>EXPLAIN (ANALYZE, BUFFERS)</code> and look for an Index Scan on <code>orders_created_at_idx</code> with a
          large Rows Removed by Filter.
        </li>
        <li>
          Replace it with a composite index on <code>(status, created_at)</code>, so the filter and the sort use one index.
        </li>
        <li>
          Run <code>ANALYZE orders</code> afterwards, so the planner sees fresh statistics.
        </li>
      </ul>
    </Fragment>
  );
}

export function ResponseFeedback({
  model = { name: "Claude Sonnet 5.5" },
  prompt,
  children,
  copyText,
  onRegenerate,
  className,
  ...rest
}: ResponseFeedbackProps) {
  const copy = copyText === undefined ? (children === undefined ? SAMPLE_REPLY : undefined) : (copyText ?? undefined);

  const leading = (
    <Fragment>
      {copy ? <CopyButton value={copy} label="Copy reply" iconOnly variant="plain" className={styles.copy} /> : null}
      {onRegenerate ? (
        <Tooltip content="Regenerate">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Regenerate reply"
            onClick={onRegenerate}
            disabled={rest.disabled}
          >
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      ) : null}
    </Fragment>
  );

  return (
    <article className={cx(styles.card, className)} aria-label={`Reply from ${model.name}`}>
      {prompt !== null ? (
        <div className={styles.prompt}>
          <p className={styles.bubble}>{prompt ?? DEFAULT_PROMPT}</p>
        </div>
      ) : null}
      <div className={styles.reply}>
        <div className={styles.author}>
          <span className={styles.mark} aria-hidden="true">
            {model.mark ?? <ClaudeMark />}
          </span>
          <span className={styles.modelName}>{model.name}</span>
        </div>
        <div className={styles.body}>{children ?? <SampleReply />}</div>
        <FeedbackActions {...rest} leading={leading} />
      </div>
    </article>
  );
}

export default ResponseFeedback;
