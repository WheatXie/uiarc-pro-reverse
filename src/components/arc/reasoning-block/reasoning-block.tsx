"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, CircleAlert, Square } from "lucide-react";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../motion-tokens";
import styles from "./reasoning-block.module.css";

export type ReasoningStatus = "thinking" | "done" | "stopped" | "error";

export interface ReasoningStep {
  title?: string;
  text?: string;
}

export interface ReasoningModel {
  name: string;
  mark?: ReactNode;
}

export type ReasoningVariant = "card" | "plain";

export interface ReasoningBlockProps {
  /** Raw model output (markdown-ish) or pre-parsed steps. Omit both this and `status` to play the simulated session. */
  reasoning?: string | ReasoningStep[];
  status?: ReasoningStatus;
  /** Seconds spent thinking. Omitted while thinking, the block counts up on its own. */
  seconds?: number;
  model?: ReasoningModel;
  /** Controlled panel state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStop?: () => void;
  onRetry?: () => void;
  error?: string;
  variant?: ReasoningVariant;
  className?: string;
}

interface SimScene {
  model: string;
  steps: { title: string; text: string }[];
}

type SimPhase =
  | "wait"
  | "stream"
  | "pause"
  | "settle"
  | "reveal"
  | "rest"
  | "hold"
  | "stopped";

interface SimState {
  scene: number;
  step: number;
  words: number;
  ms: number;
  status: "thinking" | "done" | "stopped";
  phase: SimPhase;
  open: boolean;
  touched: boolean;
}

const SIM_SCENES: SimScene[] = [
  {
    model: "Claude Opus 5.5",
    steps: [
      {
        title: "Reading the webhook handler",
        text: "The handler in api/billing/webhook.ts verifies the signature, then calls fulfillOrder for every invoice.paid event. Nothing records which events were already handled, so a redelivered event runs the whole path a second time.",
      },
      {
        title: "Checking when Stripe retries",
        text: "Stripe redelivers an event when the endpoint times out or answers with an error. The logs for Oct 23 show fulfillOrder taking 11.4s on average, because the PDF receipt renders inline before the handler responds.",
      },
      {
        title: "Tracing the second charge",
        text: "All 37 double charges line up with a redelivery. Each retry calls createUsageCharge again with an idempotency key built from Date.now(), so Stripe sees a brand new request instead of a repeat.",
      },
      {
        title: "Choosing a fix",
        text: "Record event.id in processed_events inside the same transaction, derive the idempotency key from the invoice id, and move the receipt render to a queue so the handler answers in well under a second.",
      },
    ],
  },
  {
    model: "Claude Sonnet 5.5",
    steps: [
      {
        title: "Checking calendars",
        text: "Of the 14 people invited to the Zurich offsite, 11 are free on Nov 12. Priya Raman and Marco Bianchi are at KubeCon that week, and Lena Vogel is out until Nov 14.",
      },
      {
        title: "Comparing venue options",
        text: "Kraftwerk holds the main room until Oct 31 for CHF 4,200. Moving the date keeps the price, but it needs a fresh deposit of CHF 800 by Friday.",
      },
      {
        title: "Weighing the trade off",
        text: "Nov 19 works for all 14 people and the room is free that day. One extra week costs nothing and keeps Priya, who runs the roadmap session the offsite is built around.",
      },
      {
        title: "Drafting the answer",
        text: "Recommend Nov 19, name the three people Nov 12 would leave out, and offer to send the calendar update and the venue email together.",
      },
    ],
  },
  {
    model: "Claude Fable 5.1",
    steps: [
      {
        title: "Splitting churn by plan",
        text: "Team churn rose from 2.1% in August to 3.4% in September, while Pro and Enterprise stayed flat. The spike sits in one plan, not across the whole base.",
      },
      {
        title: "Lining it up with releases",
        text: "Seat based pricing shipped on Sep 9. Of the 61 Team accounts that cancelled, 44 had five or more inactive seats and saw their invoice grow by at least 30%.",
      },
      {
        title: "Reading the exit survey",
        text: "Price is the top reason at 52%, and 18 responses mention paying for seats nobody uses. Only 4 mention a competitor by name.",
      },
      {
        title: "Forming the answer",
        text: "The spike is mostly the pricing change landing on accounts with idle seats. Suggest removing seats inactive for 60 days automatically and emailing the 112 Team accounts that match the same pattern.",
      },
    ],
  },
];

const SIM_WORDS = SIM_SCENES.map((scene) => scene.steps.map((step) => step.text.split(" ")));

/** The first simulated session, reused by the demo for the settled and failed states. */
export const SIM_SCENE_STEPS = SIM_SCENES[0].steps;

const DEFAULT_MODEL: ReasoningModel = { name: "Claude Opus 5.5" };

const SPRING: Transition = { type: "spring", visualDuration: 0.26, bounce: 0 };
const STANDARD_EASE: [number, number, number, number] = [...motionTokens.ease.standard];
const ENTER_EASE: [number, number, number, number] = [...motionTokens.ease.enter];

const enterTransition: Transition = {
  duration: motionTokens.duration.fast,
  ease: ENTER_EASE,
};
const labelExit: Transition = { duration: 0.1, ease: STANDARD_EASE };

const panelTransition = (reduced: boolean): Transition =>
  reduced
    ? { duration: 0 }
    : {
        height: SPRING,
        opacity: { duration: motionTokens.duration.fast, ease: STANDARD_EASE },
      };

const joinClass = (...values: (string | false | undefined)[]) =>
  values.filter(Boolean).join(" ");

/** `42` → `42s`, `185` → `3m 5s`. */
function formatSeconds(value: number): string {
  const total = Math.max(0, Math.round(value));
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

/** Spoken form: `1 second`, `2 seconds`, `1 minute 5 seconds`. */
function spokenSeconds(value: number): string {
  const total = Math.max(1, Math.round(value));
  if (total < 60) return `${total} second${total === 1 ? "" : "s"}`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes} minute${minutes === 1 ? "" : "s"}${seconds ? ` ${seconds} seconds` : ""}`;
}

const paragraphs = (text?: string) => (text ? text.split(/\n{2,}/) : []);

const HEADING = /^(?:\*\*(.+?)\*\*:?|#{1,4}\s+(.+))\s*$/;
const HALF_HEADING = /^\*\*([^*\n]*)\*?$/;

/** Parses model output where a `**Title**` or `# Title` line opens a step and blank lines split steps. */
export function parseReasoning(input?: string | ReasoningStep[]): ReasoningStep[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter((step) => step.title || step.text);
  const steps: ReasoningStep[] = [];
  const blocks = input.replace(/\r\n/g, "\n").split(/\n{2,}/);
  blocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    const [first, ...rest] = trimmed.split("\n");
    const match =
      first.match(HEADING) ??
      (index !== blocks.length - 1 || rest.length ? null : first.match(HALF_HEADING));
    if (match) {
      steps.push({
        title: (match[1] ?? match[2] ?? "").trim(),
        text: rest.join(" ").trim(),
      });
      return;
    }
    const previous = steps[steps.length - 1];
    const body = trimmed.replace(/\n/g, " ");
    if (previous) {
      previous.text = previous.text ? `${previous.text}\n\n${body}` : body;
    } else {
      steps.push({ text: body });
    }
  });
  return steps;
}

export interface ClaudeMarkProps {
  title?: string;
  mono?: boolean;
}

const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

export function ClaudeMark({
  title = "Claude",
  mono = false,
  ...rest
}: ClaudeMarkProps & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={mono ? "currentColor" : "#D97757"}
      role="img"
      aria-label={title}
      {...rest}
    >
      <path d={CLAUDE_PATH} />
    </svg>
  );
}

interface StreamTextProps {
  text: string;
  live?: boolean;
  enter?: boolean;
}

/** Streams text by keeping the already-rendered prefix and fading in whatever arrived since. */
function StreamText({ text, live, enter = false }: StreamTextProps) {
  const [state, setState] = useState(() => ({
    text,
    cuts: [{ at: 0, fade: Boolean(live && enter) }],
  }));
  let current = state;
  if (state.text !== text) {
    current =
      live && text.length > state.text.length && text.startsWith(state.text)
        ? { text, cuts: [...state.cuts, { at: state.text.length, fade: true }] }
        : { text, cuts: [{ at: 0, fade: Boolean(live && !state.text) }] };
    setState(current);
  }
  return (
    <Fragment>
      {current.cuts.map((cut, index) => {
        const slice = text.slice(cut.at, current.cuts[index + 1]?.at ?? text.length);
        return cut.fade ? (
          <span className={styles.chunk} key={index}>
            {slice}
          </span>
        ) : (
          <Fragment key={index}>{slice}</Fragment>
        );
      })}
    </Fragment>
  );
}

interface LiveTailProps {
  text: string;
  reduced: boolean;
}

/** The two-line preview: follows the tail of the stream and springs new lines into view. */
function LiveTail({ text, reduced }: LiveTailProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const y = useMotionValue(0);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let controls: { stop: () => void } | null = null;
    let target = Math.max(0, inner.offsetHeight - outer.clientHeight);
    let width = inner.offsetWidth;
    const observer = new ResizeObserver(() => {
      const next = Math.max(0, inner.offsetHeight - outer.clientHeight);
      const wrapped = inner.offsetWidth !== width;
      width = inner.offsetWidth;
      const delta = next - target;
      target = next;
      setOverflow(next > 0);
      if (delta <= 0 || reduced || wrapped) return;
      controls?.stop();
      y.jump(y.get() + delta);
      inner.style.transform = `translateY(${y.get()}px)`;
      controls = animate(y, 0, { type: "spring", visualDuration: 0.24, bounce: 0 });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [reduced, y]);

  return (
    <div
      ref={outerRef}
      className={styles.liveSlot}
      data-overflow={overflow || undefined}
    >
      <motion.div ref={innerRef} className={styles.liveTail} style={{ y }}>
        <StreamText text={text} live />
      </motion.div>
    </div>
  );
}

interface CounterProps {
  seconds: number;
  reduced: boolean;
}

function Counter({ seconds, reduced }: CounterProps) {
  const label = formatSeconds(seconds);
  return (
    <span className={styles.counter} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={label}
          className={styles.counterValue}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : enterTransition }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: -4, transition: labelExit }
          }
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function createSim(scene: number): SimState {
  return {
    scene,
    step: 0,
    words: 0,
    ms: 0,
    status: "thinking",
    phase: "wait",
    open: false,
    touched: false,
  };
}

const nextWords = () => 3 + Math.floor(6 * Math.random());

interface TransitionPlan {
  delay: number;
  apply: (state: SimState) => SimState;
}

function planTransition(state: SimState): TransitionPlan | null {
  const words = SIM_WORDS[state.scene];
  const nextScene = (scene: number): SimState => createSim((scene + 1) % SIM_SCENES.length);
  switch (state.phase) {
    case "wait":
      return { delay: 900, apply: (s) => ({ ...s, phase: "stream", words: nextWords() }) };
    case "stream":
      return {
        delay: 30 + Math.floor(10 * Math.random()),
        apply: (s) => {
          const total = words[s.step].length;
          const count = Math.min(total, s.words + nextWords());
          if (count < total) return { ...s, words: count };
          if (s.step === words.length - 1) return { ...s, words: count, status: "done", phase: "settle" };
          return { ...s, words: count, phase: "pause" };
        },
      };
    case "pause":
      return {
        delay: 780,
        apply: (s) => ({ ...s, step: s.step + 1, words: nextWords(), phase: "stream" }),
      };
    case "settle":
      return {
        delay: 1100,
        apply: (s) => (s.touched ? { ...s, phase: "hold" } : { ...s, open: true, phase: "reveal" }),
      };
    case "reveal":
      return {
        delay: 4600,
        apply: (s) => (s.touched ? { ...s, phase: "hold" } : { ...s, open: false, phase: "rest" }),
      };
    case "rest":
      return { delay: 900, apply: (s) => (s.touched ? { ...s, phase: "hold" } : nextScene(s.scene)) };
    case "hold":
    case "stopped":
      if (state.open) return null;
      return {
        delay: state.phase === "stopped" ? 2800 : 2400,
        apply: (s) => (s.open ? s : nextScene(s.scene)),
      };
    default:
      return null;
  }
}

interface Simulation {
  steps: ReasoningStep[];
  status: SimState["status"];
  seconds: number;
  open: boolean;
  model: string;
  scene: number;
  toggle: () => void;
  stop: () => void;
}

function useSimulation(enabled: boolean, active: boolean): Simulation {
  const [state, setState] = useState<SimState>(() => createSim(0));

  useEffect(() => {
    if (!enabled || !active) return;
    const plan = planTransition(state);
    if (!plan) return;
    const timeout = window.setTimeout(() => {
      setState((current) => {
        const next = plan.apply(current);
        return current.status === "thinking" ? { ...next, ms: current.ms + plan.delay } : next;
      });
    }, plan.delay);
    return () => window.clearTimeout(timeout);
  }, [enabled, active, state]);

  const steps = useMemo<ReasoningStep[]>(() => {
    if (state.phase === "wait") return [];
    const scene = SIM_SCENES[state.scene];
    return scene.steps.slice(0, state.step + 1).map((step, index) =>
      index < state.step
        ? { title: step.title, text: step.text }
        : {
            title: step.title,
            text: SIM_WORDS[state.scene][index].slice(0, state.words).join(" "),
          },
    );
  }, [state.scene, state.step, state.words, state.phase]);

  return {
    steps,
    status: state.status,
    seconds: Math.floor(state.ms / 1000),
    open: state.open,
    model: SIM_SCENES[state.scene].model,
    scene: state.scene,
    toggle: () => setState((current) => ({ ...current, open: !current.open, touched: true })),
    stop: () =>
      setState((current) =>
        current.status === "thinking" ? { ...current, status: "stopped", phase: "stopped" } : current,
      ),
  };
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    if (document.hidden) update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function useElapsed(status: ReasoningStatus, seconds?: number): number | undefined {
  const [state, setState] = useState<{ status: ReasoningStatus; elapsed?: number }>(() => ({
    status,
    elapsed: status === "thinking" ? 0 : undefined,
  }));
  let current = state;
  if (state.status !== status) {
    current = { status, elapsed: status === "thinking" ? 0 : state.elapsed };
    setState(current);
  }
  useEffect(() => {
    if (seconds !== undefined || status !== "thinking") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - started) / 1000);
      setState((previous) => (previous.elapsed === elapsed ? previous : { ...previous, elapsed }));
    }, 250);
    return () => window.clearInterval(timer);
  }, [status, seconds]);
  return seconds ?? current.elapsed;
}

interface PanelProps {
  steps: ReasoningStep[];
  status: ReasoningStatus;
  error?: string;
  reduced: boolean;
}

function Panel({ steps, status, error, reduced }: PanelProps) {
  const thinking = status === "thinking";
  const [initialCounts] = useState(() => steps.map((step) => paragraphs(step.text).length));
  return (
    <div className={styles.panel}>
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const current = thinking && index === steps.length - 1;
          const fresh = thinking && index >= initialCounts.length;
          return (
            <li className={styles.step} data-current={current || undefined} key={index}>
              <span className={joinClass(styles.dot, fresh && styles.chunk)} aria-hidden="true" />
              {step.title ? (
                <h4 className={joinClass(styles.stepTitle, fresh && styles.chunk)}>{step.title}</h4>
              ) : null}
              {paragraphs(step.text).map((text, paragraph) => (
                <p className={styles.para} key={paragraph}>
                  <StreamText
                    text={text}
                    live={thinking}
                    enter={fresh || paragraph >= (initialCounts[index] ?? 0)}
                  />
                </p>
              ))}
            </li>
          );
        })}
      </ol>
      <AnimatePresence initial={false}>
        {thinking ? null : (
          <motion.div
            key={status}
            className={styles.foot}
            data-status={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : enterTransition}
          >
            <span className={styles.footIcon} aria-hidden="true">
              {status === "done" ? (
                <Check size={14} strokeWidth={2} />
              ) : status === "stopped" ? (
                <Square size={9} strokeWidth={0} fill="currentColor" />
              ) : (
                <CircleAlert size={14} strokeWidth={1.75} />
              )}
            </span>
            <span className={styles.footText}>
              {status === "done"
                ? "Done"
                : status === "stopped"
                  ? "Stopped before finishing"
                  : (error ?? "The connection dropped before the model finished.")}
            </span>
            <CopyButton
              value={steps
                .map((step) => [step.title, step.text].filter(Boolean).join("\n"))
                .join("\n\n")}
              label="Copy reasoning"
              iconOnly
              variant="plain"
              className={styles.copy}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReasoningBlock({
  reasoning,
  status,
  seconds,
  model,
  open,
  defaultOpen = false,
  onOpenChange,
  onStop,
  onRetry,
  error,
  variant = "card",
  className,
}: ReasoningBlockProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion() ?? false;
  const inView = useInView(rootRef, { margin: "80px" });
  const visible = usePageVisible();
  const simulate = reasoning === undefined && status === undefined;
  const sim = useSimulation(simulate, inView && visible);
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const panelId = `${baseId}-panel`;
  const parsed = useMemo(() => parseReasoning(reasoning), [reasoning]);

  const resolvedStatus: ReasoningStatus = simulate ? sim.status : (status ?? "done");
  const elapsed = useElapsed(resolvedStatus, seconds);
  const resolvedSeconds = simulate ? sim.seconds : elapsed;
  const steps = simulate ? sim.steps : parsed;
  const resolvedModel = simulate ? { name: sim.model } : (model ?? DEFAULT_MODEL);
  const [openState, setOpenState] = useState(defaultOpen);
  const isOpen = simulate ? sim.open : (open ?? openState);
  const expandable = steps.length > 0;
  const thinking = resolvedStatus === "thinking";
  const stopHandler = simulate ? sim.stop : onStop;
  const last = steps[steps.length - 1];
  const tailText = (last && (last.text || last.title)) || "";
  const showTail = thinking && !isOpen && Boolean(tailText);

  const announcement =
    resolvedStatus === "thinking"
      ? `${resolvedModel.name} is thinking`
      : resolvedStatus === "done"
        ? resolvedSeconds !== undefined
          ? `Thought for ${spokenSeconds(resolvedSeconds)}`
          : "Finished thinking"
        : resolvedStatus === "stopped"
          ? "Stopped thinking"
          : "Thinking interrupted";

  const label =
    resolvedStatus === "thinking" ? (
      <>
        <TextShimmer className={styles.shimmer}>Thinking</TextShimmer>
        {resolvedSeconds !== undefined ? <Counter seconds={resolvedSeconds} reduced={reduced} /> : null}
      </>
    ) : resolvedStatus === "done" ? (
      <span className={styles.labelText}>
        {resolvedSeconds !== undefined
          ? `Thought for ${formatSeconds(Math.max(1, resolvedSeconds))}`
          : "Thought process"}
      </span>
    ) : resolvedStatus === "stopped" ? (
      <span className={styles.labelText}>
        {resolvedSeconds ? `Stopped after ${formatSeconds(resolvedSeconds)}` : "Stopped thinking"}
      </span>
    ) : (
      <>
        <CircleAlert className={styles.alert} size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.labelText}>Thinking interrupted</span>
      </>
    );

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${resolvedModel.name} reasoning`}
      className={joinClass(styles.root, className)}
      data-variant={variant}
      data-status={resolvedStatus}
      data-open={isOpen || undefined}
    >
      <div className={styles.top} data-expandable={expandable || undefined}>
        {expandable ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-labelledby={labelId}
            onClick={() => {
              if (!expandable) return;
              if (simulate) {
                sim.toggle();
                return;
              }
              if (open === undefined) setOpenState(!isOpen);
              onOpenChange?.(!isOpen);
            }}
          />
        ) : null}
        <div className={styles.head}>
          <span className={styles.mark} aria-hidden="true">
            {resolvedModel.mark ?? (
              <ClaudeMark width={18} height={18} title={resolvedModel.name} />
            )}
          </span>
          <span className={styles.label} id={labelId}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={resolvedStatus}
                className={styles.labelInner}
                initial={{ opacity: 0, y: 2 * Number(!reduced) }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: reduced ? { duration: 0 } : enterTransition,
                }}
                exit={{ opacity: 0, transition: reduced ? { duration: 0 } : labelExit }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className={styles.actions}>
            <AnimatePresence initial={false} mode="popLayout">
              {thinking && stopHandler ? (
                <motion.span
                  key="stop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: enterTransition }}
                  exit={{ opacity: 0, transition: labelExit }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.action}
                    onClick={stopHandler}
                  >
                    <Square size={10} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                    Stop
                  </Button>
                </motion.span>
              ) : null}
              {resolvedStatus === "error" && onRetry ? (
                <motion.span
                  key="retry"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: enterTransition }}
                  exit={{ opacity: 0, transition: labelExit }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.action}
                    onClick={onRetry}
                  >
                    Retry
                  </Button>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
          {expandable ? (
            <ChevronDown
              className={styles.chevron}
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
        <AnimatePresence initial={false}>
          {showTail ? (
            <motion.div
              key="tail"
              className={styles.liveClip}
              aria-hidden="true"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{
                height: 0,
                opacity: 0,
                transition: reduced ? { duration: 0 } : { height: SPRING, opacity: labelExit },
              }}
              transition={panelTransition(reduced)}
            >
              <div className={styles.live}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={`${simulate ? sim.scene : 0}-${steps.length}`}
                    className={styles.liveLayer}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: reduced ? { duration: 0 } : enterTransition }}
                    exit={{ opacity: 0, transition: reduced ? { duration: 0 } : labelExit }}
                  >
                    <LiveTail text={tailText} reduced={reduced} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && expandable ? (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={labelId}
            aria-busy={thinking || undefined}
            className={styles.panelClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{
              height: 0,
              opacity: 0,
              transition: reduced ? { duration: 0 } : { height: SPRING, opacity: labelExit },
            }}
            transition={panelTransition(reduced)}
          >
            <Panel steps={steps} status={resolvedStatus} error={error} reduced={reduced} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {simulate ? `${announcement}. Simulated, nothing was sent to a model.` : announcement}
      </span>
    </div>
  );
}

export default ReasoningBlock;
