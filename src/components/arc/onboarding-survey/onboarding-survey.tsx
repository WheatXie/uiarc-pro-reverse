"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type MotionProps } from "motion/react";
import {
  Building,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Code,
  Compass,
  CornerDownLeft,
  LayoutTemplate,
  Megaphone,
  RotateCcw,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./onboarding-survey.module.css";

/* ------------------------------------------------------------------ types */

/** One selectable answer. `icon` is any 16px node — the sample uses lucide glyphs and two brand marks. */
export interface OnboardingSurveyOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/** One screen of the survey. `label` names the answer in the done checklist; it falls back to `title`. */
export interface OnboardingSurveyQuestion {
  id: string;
  title: string;
  description?: string;
  label?: string;
  options: OnboardingSurveyOption[];
}

export type OnboardingSurveyAnswers = Record<string, string>;

export interface OnboardingSurveyProps {
  /** Screens to ask, in order. Defaults to the three sample questions. */
  questions?: OnboardingSurveyQuestion[];
  /** Answers the survey starts with; "Start over" clears back to these. */
  defaultAnswers?: OnboardingSurveyAnswers;
  /** Setup rows. Pass a function to derive them from the answers; the sample copy is used when omitted. */
  setupSteps?: string[] | ((answers: OnboardingSurveyAnswers) => string[]);
  /** Work that must finish before the last setup row ticks. Rejects to show the retry state. */
  personalize?: (answers: OnboardingSurveyAnswers, signal: AbortSignal) => Promise<void>;
  onAnswer?: (questionId: string, value: string | undefined, answers: OnboardingSurveyAnswers) => void;
  onComplete?: (answers: OnboardingSurveyAnswers) => void | Promise<void>;
  /** Plays the sample run by itself until the first interaction. Defaults to true for the sample questions. */
  autoPlay?: boolean;
  doneTitle?: string;
  doneDescription?: string;
  finishLabel?: string;
  "aria-label"?: string;
  className?: string;
}

type Phase = "question" | "setup" | "done";
type StepState = "pending" | "active" | "done" | "error";

/* ------------------------------------------------------------------ sample */

/** A 16px lucide glyph at the weight the block draws everything else. */
const glyph = (Glyph: typeof Code) => <Glyph size={16} strokeWidth={1.75} aria-hidden="true" />;

/** The shipped frame draws the newer four-path pen; the lucide in this repo still has the two-path one,
 *  so the design glyph is inlined with the frame's exact geometry instead of drifting 1.5px. */
const PenToolGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pen-tool" aria-hidden="true">
    <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" />
    <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" />
    <path d="m2.3 2.3 7.286 7.286" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const LinearMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
  </svg>
);

const GitHubMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

/** Three screens that exercise every option layout: icon rows, four-up keys, and a brand mark. */
export const onboardingSurveySampleQuestions: OnboardingSurveyQuestion[] = [
  {
    id: "role",
    label: "Role",
    title: "What's your role?",
    description: "We'll set up views and defaults for how you work.",
    options: [
      { value: "engineering", label: "Engineering", description: "Ship features and review code", icon: glyph(Code) },
      { value: "design", label: "Design", description: "Specs, reviews and handoff", icon: <PenToolGlyph /> },
      { value: "product", label: "Product", description: "Roadmaps and planning", icon: glyph(Compass) },
      { value: "marketing", label: "Marketing", description: "Launches and campaigns", icon: glyph(Megaphone) },
    ],
  },
  {
    id: "team",
    label: "Team size",
    title: "How big is your team?",
    description: "We'll size your workspace and seats to match.",
    options: [
      { value: "solo", label: "Just me", description: "Trying it out on my own", icon: glyph(User) },
      { value: "small", label: "2 to 10", description: "One small, fast team", icon: glyph(Users) },
      { value: "medium", label: "11 to 50", description: "A few teams, one workspace", icon: glyph(Building) },
      { value: "large", label: "51 or more", description: "Many teams and departments", icon: glyph(Building2) },
    ],
  },
  {
    id: "first",
    label: "First up",
    title: "What do you want to do first?",
    description: "We'll open your workspace right where you need it.",
    options: [
      {
        value: "linear",
        label: "Import from Linear",
        description: "Bring issues, cycles and labels",
        icon: <LinearMark />,
      },
      {
        value: "github",
        label: "Connect GitHub",
        description: "Link repos and pull requests",
        icon: <GitHubMark />,
      },
      { value: "invite", label: "Invite your team", description: "Send invites by email", icon: glyph(UserPlus) },
      { value: "template", label: "Start from a template", description: "Sprint, roadmap or bug triage", icon: glyph(LayoutTemplate) },
    ],
  },
];

const teamStep: Record<string, string> = {
  solo: "Setting up a personal workspace",
  small: "Adding seats for a team of 10",
  medium: "Adding seats for a team of 50",
  large: "Preparing team spaces and roles",
};

const firstStep: Record<string, string> = {
  linear: "Preparing your Linear import",
  github: "Getting GitHub ready to connect",
  invite: "Drafting your team invite",
  template: "Loading starter templates",
};

const roleStep: Record<string, string> = {
  engineering: "Creating Engineering views",
  design: "Creating Design views",
  product: "Creating Product views",
  marketing: "Creating Marketing views",
};

/** Setup copy for the sample run: one row per answer, then the shared tail. */
export function onboardingSurveySampleSteps(answers: OnboardingSurveyAnswers): string[] {
  return [
    roleStep[answers.role ?? ""] ?? "Creating your views",
    teamStep[answers.team ?? ""] ?? "Setting up your workspace",
    firstStep[answers.first ?? ""] ?? "Preparing your home screen",
    "Applying your preferences",
  ];
}

/** Copy for screens someone else authored: the answers mean nothing to it. */
const genericSteps = ["Saving your answers", "Setting up your workspace", "Applying your preferences"];

/* ------------------------------------------------------------------ atoms */

const join = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(" ");

const eased = [...motionTokens.ease.standard] as [number, number, number, number];
const stepVariants = (reduce: boolean): MotionProps["variants"] => ({
  initial: { opacity: 0, y: reduce ? 0 : 2 },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: eased, delay: .04 } },
  exit: { opacity: 0, transition: { duration: .1, ease: eased } },
});

/** The setup row spinner: a 6px arc turning once per 800ms. */
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.spinner} aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Draws itself on, one 0.28s stroke. Reduced motion gets the finished tick with no draw. */
function Tick({ reduce, size = 16 }: { reduce: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: .28, ease: eased, delay: .04 }}
      />
    </svg>
  );
}

/** The icon column on a setup row: pending, spinning, ticked or failed, crossfaded in place. */
function StepIcon({ state, reduce }: { state: StepState; reduce: boolean }) {
  return (
    <span className={styles.stepIcon} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className={styles.layer}
          data-state={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: .6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .6 }}
          transition={reduce ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}
        >
          {state === "active" ? <Spinner /> : null}
          {state === "done" ? <Tick reduce={reduce} /> : null}
          {state === "error" ? <CircleAlert size={16} strokeWidth={1.75} /> : null}
          {state === "pending" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
            </svg>
          ) : null}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Keyed crossfade for one line of changing copy — meta, description, note. */
function Swap({ id, children, className, reduce }: { id: string; children: ReactNode; className?: string; reduce: boolean }) {
  return (
    <span className={join(styles.swap, className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className={styles.swapText}
          initial={{ opacity: 0, y: reduce ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: eased, delay: .04 } }}
          exit={{ opacity: 0, transition: { duration: .1, ease: eased } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A shortcut cap: the key cap sits on a 1px ledge and presses into it. */
function Kbd({ pressed, children }: { pressed: boolean; children: ReactNode }) {
  return (
    <kbd className={join(styles.kbd, styles.kbdSm)}>
      <kbd className={styles.key} data-pressed={pressed || undefined}>{children}</kbd>
    </kbd>
  );
}

/* ------------------------------------------------------------------ block */

/**
 * A three-screen onboarding survey whose sample run answers itself until the first interaction, then
 * hands over: pick with a click, a number key or the arrow keys, watch a setup checklist resolve, and
 * land on a recap whose rows jump back to their question.
 */
export function OnboardingSurvey({
  questions = onboardingSurveySampleQuestions,
  defaultAnswers = {},
  setupSteps,
  personalize,
  onAnswer,
  onComplete,
  autoPlay,
  doneTitle = "You're all set",
  doneDescription = "Your workspace is ready. Change any answer below.",
  finishLabel = "Open workspace",
  "aria-label": ariaLabel = "Onboarding survey",
  className,
}: OnboardingSurveyProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const count = questions.length;
  const [phase, setPhase] = useState<Phase>("question");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingSurveyAnswers>(() => ({ ...defaultAnswers }));
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [interacted, setInteracted] = useState(false);
  const [inView, setInView] = useState(false);
  const [loop, setLoop] = useState(0);
  const rootRef = useRef<HTMLElement>(null);
  const armed = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finishTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* Stage height: the sheet springs to the next step's height instead of snapping the page. */
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: ReturnType<typeof animate> | undefined;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    const clear = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      animation = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      animation?.stop();
      if (reduce || resized) {
        clear();
        return;
      }
      outer.style.overflow = "hidden";
      animation = animate(outer, { height: [from, nextHeight] }, { ...motionTokens.spring.smooth, visualDuration: .28, onComplete: clear });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduce]);

  const question = questions[index];
  const answer = question ? answers[question.id] : undefined;
  const current = questions[Math.min(index, count - 1)];

  const steps = useMemo(() => (typeof setupSteps === "function" ? setupSteps(answers) : setupSteps ?? (questions === onboardingSurveySampleQuestions ? onboardingSurveySampleSteps(answers) : genericSteps)), [answers, questions, setupSteps]);

  const stepKey = phase === "question" ? `q${index}` : phase;

  const progress = phase === "question" ? (index + 1) / (count + 1) : phase === "setup" ? (count + doneCount / Math.max(steps.length, 1)) / (count + 1) : 1;
  const gate = (autoPlay ?? questions === onboardingSurveySampleQuestions) && !interacted && inView && !reduce;

  const flash = (key: string) => {
    clearTimeout(pressTimer.current);
    setPressed(key);
    pressTimer.current = setTimeout(() => setPressed(null), 150);
  };

  const select = (value: string | undefined) => {
    if (!question) return;
    const next = { ...answers };
    if (value === undefined) delete next[question.id];
    else next[question.id] = value;
    setAnswers(next);
    onAnswer?.(question.id, value, next);
    const label = question.options.find((option) => option.value === value)?.label;
    if (label) setLive(`${label} selected`);
  };

  const beginSetup = () => {
    setDoneCount(0);
    setError(null);
    setPhase("setup");
    setRunKey((key) => key + 1);
    setLive("Personalizing your workspace");
  };

  const advance = () => {
    if (phase !== "question") return;
    if (index < count - 1) {
      setIndex(index + 1);
      setLive(`Question ${index + 2} of ${count}: ${questions[index + 1].title}`);
      return;
    }
    beginSetup();
  };

  const restart = () => {
    clearTimeout(finishTimer.current);
    setPhase("question");
    setIndex(0);
    setAnswers({ ...defaultAnswers });
    setDoneCount(0);
    setError(null);
    setNote(null);
    setBusy(false);
    setLive(`Question 1 of ${count}: ${questions[0]?.title ?? ""}`);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    if (onComplete) {
      try {
        await onComplete(answers);
      } finally {
        setBusy(false);
      }
      return;
    }
    finishTimer.current = setTimeout(() => {
      setBusy(false);
      setNote("Simulated. Your app would open the workspace here.");
      setLive("Simulated, nothing was saved or opened.");
    }, 600);
  };

  const skip = () => {
    if (phase !== "question" || !question) return;
    const next = { ...answers };
    delete next[question.id];
    setAnswers(next);
    onAnswer?.(question.id, undefined, next);
    advance();
  };

  /* Keyboard, autoplay and the setup run all read handlers through refs, so a timer fired at a stale
     render still advances the survey the way the user just set it up. */
  const actions = useRef({ select, advance, restart, flash });
  useEffect(() => {
    actions.current = { select, advance, restart, flash };
  });

  const runtime = useRef({ personalize, answers, steps });
  useEffect(() => {
    runtime.current = { personalize, answers, steps };
  });

  /* The setup run: fixed beats, so the checklist always reads at a walking pace and the last row
     waits for real work (an import, an invite) instead of a timer. */
  useEffect(() => {
    if (phase !== "setup") return;
    const controller = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });
    const promise = runtime.current.personalize ? runtime.current.personalize(runtime.current.answers, controller.signal) : Promise.resolve();
    promise.catch(() => undefined);
    (async () => {
      try {
        const list = runtime.current.steps;
        for (let row = 0; row < list.length; row += 1) {
          await sleep(520);
          if (row === list.length - 1) await promise;
          if (stopped) return;
          setDoneCount(row + 1);
        }
        await sleep(420);
        if (stopped) return;
        setPhase("done");
        setLive(runtime.current.personalize ? "You're all set." : "You're all set. Simulated, nothing was saved.");
      } catch (reason) {
        if (stopped) return;
        setError(reason instanceof Error && reason.message ? reason.message : "Check your connection and try again.");
        setLive("Setup didn't finish.");
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
      timers.forEach(clearTimeout);
    };
  }, [phase, runKey]);

  /* The sample run. Two loops trade answers, so the demo never repeats the same beat twice in a row. */
  useEffect(() => {
    if (!gate) return;
    const script = [[0, 2, 0], [1, 1, 3]][loop % 2];
    const options = current?.options ?? [];
    if (phase === "question" && !answer) {
      const timer = setTimeout(() => {
        const choice = Math.min(script[index] ?? 0, options.length - 1);
        const option = options[choice];
        if (!option) return;
        actions.current.flash(String(choice + 1));
        actions.current.select(option.value);
      }, index === 0 ? 900 : 620);
      return () => clearTimeout(timer);
    }
    if (phase === "question" && answer) {
      const timer = setTimeout(() => {
        actions.current.flash("enter");
        actions.current.advance();
      }, 560);
      return () => clearTimeout(timer);
    }
    if (phase === "done") {
      const timer = setTimeout(() => {
        setLoop((value) => value + 1);
        actions.current.restart();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [gate, phase, index, answer, loop, current]);

  /* Off screen the sample pauses, so a long page never spends its animation budget on a hidden block. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: .35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  /* Focus follows the step only when the user was already inside the block — a click elsewhere is not
     yanked back here. */
  useEffect(() => {
    if (!armed.current) return;
    const root = rootRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => {
      const step = root.querySelector<HTMLElement>(`[data-step="${stepKey}"]`);
      const active = document.activeElement;
      const outside = !active || !root.contains(active) || Boolean(active.closest("[data-step]") && !step?.contains(active));
      if (!outside) return;
      (step?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ?? root).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [stepKey]);

  useEffect(() => () => {
    clearTimeout(pressTimer.current);
    clearTimeout(finishTimer.current);
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    setInteracted(true);
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as Element | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const radio = target?.closest<HTMLElement>('[role="radio"]');
    if (phase === "question" && question && /^[1-9]$/.test(event.key)) {
      const choice = Number(event.key) - 1;
      const option = question.options[choice];
      if (!option) return;
      event.preventDefault();
      flash(String(choice + 1));
      select(option.value);
      // Only a keypress that already sat on a radio hands focus along; a number typed from the card
      // itself selects without yanking focus into the grid.
      if (radio) {
        requestAnimationFrame(() => {
          rootRef.current?.querySelector<HTMLElement>(`[data-step="${stepKey}"] [data-index="${choice}"]`)?.focus();
        });
      }
      return;
    }
    if (event.key === "Enter") {
      if (target?.closest("button") && !radio) return;
      if (phase === "question" && answer !== undefined && !event.repeat) {
        event.preventDefault();
        flash("enter");
        advance();
      }
      return;
    }
    if (!radio || phase !== "question" || !question) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const size = question.options.length;
    const at = Number(radio.dataset.index ?? 0);
    const next = (at + (back ? size - 1 : 1)) % size;
    const option = question.options[next];
    if (!option) return;
    select(option.value);
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-step="${stepKey}"] [data-index="${next}"]`)?.focus();
    });
  };

  const canGoBack = (phase === "question" && index > 0) || (phase === "setup" && error !== null) || phase === "done";
  const backLabel = phase === "done" ? "Start over" : "Back";
  const ctaLabel = phase === "question" ? "Continue" : phase === "setup" ? (error ? "Try again" : "Setting up") : finishLabel;
  const meta = phase === "question" ? `Question ${index + 1} of ${count}` : phase === "setup" ? (error ? "Setup paused" : "Setting up") : "Ready";
  const titleId = `${uid}-title`;

  const onCta = () => {
    if (phase === "question") {
      advance();
      return;
    }
    if (phase === "setup") {
      if (error) beginSetup();
      return;
    }
    void finish();
  };

  return (
    <section
      ref={rootRef}
      className={join(styles.root, className)}
      aria-label={ariaLabel}
      tabIndex={-1}
      onPointerDown={() => setInteracted(true)}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        armed.current = true;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) armed.current = false;
      }}
    >
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <motion.div
          className={styles.progressFill}
          animate={{ scaleX: progress }}
          transition={reduce ? { duration: 0 } : { type: "spring", visualDuration: .4, bounce: 0 }}
        />
      </div>

      <div className={styles.meta}>
        <Swap id={meta} className={styles.metaText} reduce={reduce}>{meta}</Swap>
        <button
          type="button"
          className={join(styles.skip, phase === "question" ? "" : styles.hidden)}
          tabIndex={phase === "question" ? 0 : -1}
          aria-hidden={phase === "question" ? undefined : true}
          disabled={phase !== "question"}
          onClick={skip}
        >
          Skip
        </button>
      </div>

      <div ref={outerRef} className={styles.stageClip}>
        <div ref={innerRef} className={styles.stage}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={stepKey} data-step={stepKey} className={styles.step} variants={stepVariants(reduce)} initial="initial" animate="animate" exit="exit">
              {phase === "question" && question ? (
                <>
                  <div className={styles.head}>
                    <h3 id={titleId} className={styles.title}>{question.title}</h3>
                    {question.description ? <p className={styles.description}>{question.description}</p> : null}
                  </div>
                  <div className={styles.options} role="radiogroup" aria-labelledby={titleId}>
                    {question.options.map((option, position) => {
                      const checked = answer === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          data-index={position}
                          tabIndex={checked || (answer === undefined && position === 0) ? 0 : -1}
                          aria-keyshortcuts={String(position + 1)}
                          className={styles.option}
                          onClick={() => select(option.value)}
                        >
                          <span className={styles.optionIcon} aria-hidden="true">{option.icon}</span>
                          <span className={styles.optionKey} aria-hidden="true">
                            <AnimatePresence mode="popLayout" initial={false}>
                              {checked ? (
                                <motion.span
                                  key="check"
                                  className={styles.layer}
                                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: .6 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: .6 }}
                                  transition={reduce ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}
                                >
                                  <span className={styles.check}><Check size={12} strokeWidth={2.5} aria-hidden="true" /></span>
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="key"
                                  className={styles.layer}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: motionTokens.duration.instant }}
                                >
                                  <Kbd pressed={pressed === String(position + 1)}>{position + 1}</Kbd>
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                          <span className={styles.optionLabel}>{option.label}</span>
                          {option.description ? <span className={styles.optionDescription}>{option.description}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {phase === "setup" ? (
                <>
                  <div className={styles.head}>
                    <h3 id={titleId} className={styles.title}>
                      <TextShimmer active={!error}>Personalizing your workspace</TextShimmer>
                    </h3>
                    <p className={styles.description}>
                      <Swap id={error ?? "idle"} reduce={reduce}>{error ?? "This takes a few seconds."}</Swap>
                    </p>
                  </div>
                  <ol className={styles.list} aria-label="Setup progress">
                    {steps.map((row, position) => {
                      const state: StepState = error ? (position < doneCount ? "done" : "error") : position < doneCount ? "done" : position === doneCount ? "active" : "pending";
                      return (
                        <li key={row} className={styles.row} data-state={state}>
                          <StepIcon state={state} reduce={reduce} />
                          <span className={styles.rowLabel}>{row}</span>
                          <span className={styles.rowStatus}>{state === "error" ? "Failed" : null}{state === "done" ? <span className={styles.srOnly}>Done</span> : null}</span>
                        </li>
                      );
                    })}
                  </ol>
                </>
              ) : null}

              {phase === "done" ? (
                <>
                  <div className={styles.head}>
                    <h3 id={titleId} className={join(styles.title, styles.doneTitle)}>
                      <span className={styles.doneMark}><Tick reduce={reduce} size={18} /></span>
                      {doneTitle}
                    </h3>
                    <p className={styles.description}>
                      <Swap id={note ?? "done"} reduce={reduce}>{note ?? doneDescription}</Swap>
                    </p>
                  </div>
                  <ul className={styles.list} aria-label="Your answers">
                    {questions.map((item, position) => {
                      const chosen = item.options.find((option) => option.value === answers[item.id]);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={styles.summary}
                            aria-label={`Change ${(item.label ?? item.title).toLowerCase()}, currently ${chosen?.label ?? "skipped"}`}
                            onClick={() => {
                              setPhase("question");
                              setIndex(position);
                              setNote(null);
                              setLive(`Question ${position + 1} of ${count}: ${questions[position].title}`);
                            }}
                          >
                            <span className={styles.summaryName}>{item.label ?? item.title}</span>
                            <span className={join(styles.summaryValue, chosen ? "" : styles.skipped)}>
                              {chosen?.icon ? (
                                <span className={styles.summaryIcon} aria-hidden="true">
                                  {chosen.icon}
                                </span>
                              ) : null}
                              <span className={styles.summaryText}>{chosen?.label ?? "Skipped"}</span>
                            </span>
                            <ChevronRight size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.footer}>
        <Button
          variant="ghost"
          size="sm"
          className={join(styles.back, canGoBack ? "" : styles.hidden)}
          tabIndex={canGoBack ? 0 : -1}
          aria-hidden={canGoBack ? undefined : true}
          disabled={!canGoBack}
          onClick={() => {
            if (phase === "done") {
              restart();
              return;
            }
            if (phase === "setup") {
              setPhase("question");
              setIndex(count - 1);
              setError(null);
              return;
            }
            setIndex(Math.max(0, index - 1));
            setLive(`Question ${index} of ${count}: ${questions[index - 1]?.title ?? ""}`);
          }}
        >
          {phase === "done" ? <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> : <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />}
          {backLabel}
        </Button>
        <Button
          size="sm"
          className={styles.cta}
          data-pressed={pressed === "enter" ? "" : undefined}
          disabled={phase === "question" && answer === undefined}
          loading={(phase === "setup" && !error) || busy}
          aria-keyshortcuts={phase === "question" ? "Enter" : undefined}
          onClick={onCta}
        >
          {ctaLabel}
          {phase === "question" ? <CornerDownLeft size={14} strokeWidth={1.75} className={styles.enter} aria-hidden="true" /> : null}
        </Button>
      </div>

      <p className={styles.srOnly} aria-live="polite" role="status">{live}</p>
    </section>
  );
}

export default OnboardingSurvey;
