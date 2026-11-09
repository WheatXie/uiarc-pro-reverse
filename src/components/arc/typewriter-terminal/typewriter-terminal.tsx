"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { Check, Pause, Play, RotateCcw, TriangleAlert, X } from "lucide-react";
import { CopyButton } from "../copy-button/copy-button";
import styles from "./typewriter-terminal.module.css";

export type TerminalTone = "default" | "muted" | "success" | "warning" | "danger" | "accent";

export type TerminalOutput =
  | string
  | { text: string; tone?: TerminalTone; delay?: number }
  | { kind: "progress"; label: string; duration?: number }
  | { kind: "task"; label: string; done?: string; duration?: number };

export interface TerminalStep {
  command: string;
  output?: TerminalOutput[];
  /** Changes the working directory shown in this prompt and every later one. */
  cwd?: string;
  /** Rest in seconds after the output. */
  pause?: number;
}

export interface TypewriterTerminalProps {
  /** The session in order. */
  steps?: TerminalStep[];
  /** Window title in the title bar. */
  title?: string;
  /** Working directory shown in the prompt until a step sets its own. */
  cwd?: string;
  /** Prompt symbol after the working directory. */
  symbol?: string;
  /** Multiplies the playback pace. At 1 the default session takes about sixteen seconds. */
  speed?: number;
  /** Holds playback where it is, easing to rest instead of stopping in one frame. */
  paused?: boolean;
  /** After a short rest the screen clears upward and the session plays again. */
  loop?: boolean;
  /** Visible rows. The window keeps this height and older lines scroll up. */
  rows?: number;
  /** Shows a copy button in the title bar that copies every command, one per line. */
  copyable?: boolean;
  /** Color of the caret, progress fills, spinners, links, and the scrubber. */
  accent?: string;
  /** Accessible name of the figure. */
  label?: string;
  /** Optional visible caption under the terminal, rendered as a figcaption. */
  caption?: ReactNode;
  /** Extra class on the root figure. */
  className?: string;
  /** Inline styles on the root figure. */
  style?: CSSProperties;
}

type TokenKind = "plain" | "string" | "op" | "env" | "program" | "flag" | "number" | "path";

interface Token {
  ch: string;
  kind: TokenKind;
}

interface PlannedText {
  kind: "text";
  text: string;
  tone: TerminalTone;
  t0: number;
}
interface PlannedProgress {
  kind: "progress";
  label: string;
  t0: number;
  t1: number;
}
interface PlannedTask {
  kind: "task";
  label: string;
  done?: string;
  t0: number;
  t1: number;
}
type PlannedOutput = PlannedText | PlannedProgress | PlannedTask;

interface PlannedStep {
  command: string;
  cwd: string;
  chars: Token[];
  times: number[];
  tPrompt: number;
  tEnter: number;
  outputs: PlannedOutput[];
}

interface Plan {
  steps: PlannedStep[];
  tFinal: number;
  finalCwd: string;
  end: number;
  clear0: number;
  loopEnd: number;
  marks: number[];
}

interface Engine {
  t: number;
  rate: number;
  rateV: number;
  last: number;
  frame: number;
  running: boolean;
  visible: boolean;
  scrubbing: boolean;
  seek: { from: number; to: number; start: number; dur: number } | null;
  scroll: number;
  scrollV: number;
  scrollGoal: number;
  scrollAim: number;
  sig: string;
  typing: boolean;
  lastTime: string;
  lastStep: number;
  ended: boolean;
}

const DEFAULT_STEPS: TerminalStep[] = [
  {
    command: "npx create-next-app@latest acme --ts --app",
    cwd: "~",
    output: [
      { text: "Creating a new Next.js app in ~/acme", tone: "muted" },
      { kind: "progress", label: "Installing dependencies", duration: 1.7 },
      { text: "Success! Created acme in 6.4s", tone: "success" },
    ],
  },
  {
    command: "cd acme && npx shadcn@latest add @uiarc/button",
    output: [
      { kind: "task", label: "Resolving @uiarc/button", done: "0.4s", duration: 0.7 },
      { kind: "task", label: "Writing components/button.tsx", done: "0.2s", duration: 0.5 },
      { text: "Added 2 files to registry/components", tone: "success" },
    ],
  },
  {
    command: "npm run dev",
    cwd: "~/acme",
    output: [
      { text: "Next.js 16.0 with Turbopack", tone: "muted", delay: 0.4 },
      "Local: http://localhost:3000",
      { text: "Ready in 812ms", tone: "success", delay: 0.5 },
    ],
  },
];

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

const TONE_ICON: Partial<Record<TerminalTone, ReactNode>> = {
  success: <Check size={14} strokeWidth={2} />,
  warning: <TriangleAlert size={14} strokeWidth={1.75} />,
  danger: <X size={14} strokeWidth={2} />,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
/** Ease out cubic, used for line fades. */
const easeOut = (value: number) => 1 - (1 - clamp(value)) ** 3;
/** Ease in out cubic, used for the clear and for seeking. */
const easeInOut = (value: number) => {
  const t = clamp(value);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
/** The progress bar starts fast, stalls around the middle, then finishes steadily. */
const PROGRESS_POINTS: [number, number][] = [
  [0, 0],
  [0.22, 0.34],
  [0.42, 0.5],
  [0.6, 0.55],
  [0.84, 0.9],
  [1, 1],
];
const progressAt = (value: number) => {
  const t = clamp(value);
  for (let index = 1; index < PROGRESS_POINTS.length; index += 1) {
    const [x0, y0] = PROGRESS_POINTS[index - 1];
    const [x1, y1] = PROGRESS_POINTS[index];
    if (t <= x1) return y0 + (y1 - y0) * smooth((t - x0) / (x1 - x0));
  }
  return 1;
};
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const noopSubscribe = () => () => {};

function hash(seed: string) {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 0x1000193);
  }
  return value >>> 0;
}

/** mulberry32: the typing cadence is identical on every replay and on the server. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

const TOKENIZE = /(\s+)|('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?)|(&&|\|\||[|;>]|<)|([^\s'"|;&<>]+)/g;

/** Split a command into shell-ish tokens so the typed text is colored as it lands. */
function tokenize(command: string): Token[] {
  const tokens: Token[] = [];
  let first = true;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TOKENIZE.source, "g");
  while ((match = pattern.exec(command))) {
    const [raw, space, quoted, operator, word] = match;
    let kind: TokenKind = "plain";
    if (space) {
      kind = "plain";
    } else if (quoted) {
      kind = "string";
    } else if (operator) {
      kind = "op";
      first = true;
    } else if (word) {
      if (first && /^[A-Za-z_][\w]*=/.test(word)) kind = "env";
      else if (first) {
        kind = "program";
        first = false;
      } else if (/^--?[\w-]/.test(word)) kind = "flag";
      else if (/^\d+(\.\d+)?$/.test(word)) kind = "number";
      else if (/[/@.~:]/.test(word)) kind = "path";
    }
    for (const ch of raw) tokens.push({ ch, kind });
  }
  return tokens;
}

/** Human typing cadence: a think before the first key, bursts inside words, small stalls on shifts. */
function charTimes(tokens: Token[], seed: string, lead: number) {
  const random = seeded(hash(seed));
  const offsets: number[] = [];
  let total = 0;
  let hold = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const ch = tokens[index].ch;
    const previous = tokens[index - 1]?.ch ?? " ";
    let step = 0.048 * (0.6 + 0.8 * random());
    if (hold > 0) {
      step *= 0.55;
      hold -= 1;
    } else if (random() < 0.14) {
      hold = 2 + Math.floor(3 * random());
    }
    if (previous === " ") step += 0.045 + 0.05 * random();
    if (/[@_"'&|>A-Z:~]/.test(ch)) step += 0.035;
    if (/[-/.]/.test(ch)) step += 0.018;
    if (ch === " " && random() < 0.18) step += 0.12 + 0.12 * random();
    total += step;
    offsets.push(total);
  }
  return offsets.map((offset) => offset + lead);
}

function buildPlan(steps: TerminalStep[], startCwd: string): Plan {
  let cursor = 0.3;
  let cwd = startCwd;
  const planned: PlannedStep[] = steps.map((step, index) => {
    if (step.cwd) cwd = step.cwd;
    const chars = tokenize(step.command);
    const tPrompt = cursor;
    const lead = index === 0 ? 0.7 : 0.45;
    const times = charTimes(chars, `${step.command}${index}`, tPrompt + lead);
    const tEnter = (times[times.length - 1] ?? tPrompt + lead) + 0.34;
    let outputCursor = tEnter + 0.16;
    const outputs = (step.output ?? []).map((output, outputIndex): PlannedOutput => {
      const item = typeof output === "string" ? { kind: "text" as const, text: output } : output;
      if ("kind" in item && item.kind === "progress") {
        const t0 = outputCursor;
        const t1 = t0 + (item.duration ?? 1.4);
        outputCursor = t1 + 0.1;
        return { kind: "progress", label: item.label, t0, t1 };
      }
      if ("kind" in item && item.kind === "task") {
        const t0 = outputCursor;
        const t1 = t0 + (item.duration ?? 0.8);
        outputCursor = t1 + 0.08;
        return { kind: "task", label: item.label, done: item.done, t0, t1 };
      }
      const text = item as { text: string; tone?: TerminalTone; delay?: number };
      const t0 = outputCursor + (text.delay ?? 0.07 * (outputIndex !== 0 ? 1 : 0));
      outputCursor = t0 + 0.07;
      return { kind: "text", text: text.text, tone: text.tone ?? "default", t0 };
    });
    cursor = outputCursor + (step.pause ?? 0.75);
    return { command: step.command, cwd, chars, times, tPrompt, tEnter, outputs };
  });

  const tFinal = planned.length ? cursor : 0;
  const end = tFinal + 0.2;
  return {
    steps: planned,
    tFinal,
    finalCwd: cwd,
    end,
    clear0: end + 2.6,
    loopEnd: end + 2.6 + 0.8,
    marks: planned.map((step) => step.tPrompt),
  };
}

/** Renders URLs inside output text as links. */
function withLinks(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, index) =>
    index % 2 ? (
      <span key={index} className={styles.link}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: styles.plain,
  string: styles.string,
  op: styles.op,
  env: styles.env,
  program: styles.program,
  flag: styles.flag,
  number: styles.number,
  path: styles.path,
};

export function TypewriterTerminal({
  steps = DEFAULT_STEPS,
  title,
  cwd = "~",
  symbol = "$",
  speed = 1,
  paused = false,
  loop = true,
  rows = 11,
  copyable = true,
  accent,
  label = "Terminal session",
  caption,
  className,
  style,
}: TypewriterTerminalProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const reduced = Boolean(useReducedMotion()) && mounted;

  const [userPaused, setUserPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const playing = !paused && !userPaused && !ended;

  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scrubber = useRef<HTMLDivElement>(null);
  const trackFill = useRef<HTMLSpanElement>(null);
  const thumbRail = useRef<HTMLSpanElement>(null);
  const clockLabel = useRef<HTMLSpanElement>(null);

  const plan = useMemo(() => buildPlan(steps, cwd), [steps, cwd]);
  const cache = useRef(new WeakMap<Element, Record<string, string>>());
  const engine = useRef<Engine>({
    t: 0,
    rate: 0,
    rateV: 0,
    last: 0,
    frame: 0,
    running: false,
    visible: true,
    scrubbing: false,
    seek: null,
    scroll: 0,
    scrollV: 0,
    scrollGoal: 0,
    scrollAim: 0,
    sig: "",
    typing: false,
    lastTime: "",
    lastStep: -2,
    ended: false,
  });
  const pointer = useRef<{ left: number; width: number; id: number } | null>(null);

  /** Only touch the DOM when a value actually changed. */
  const write = useCallback((element: Element | null, key: string, value: string | null) => {
    if (!element) return;
    const map = cache.current;
    let record = map.get(element);
    if (!record) {
      record = {};
      map.set(element, record);
    }
    const next = value ?? "\0";
    if (record[key] === next) return;
    record[key] = next;
    if (key.startsWith("@")) {
      (element as HTMLElement | SVGElement).style.setProperty(key.slice(1), value ?? "");
      return;
    }
    if (key === "#text") {
      element.textContent = value ?? "";
      return;
    }
    if (value === null) element.removeAttribute(key);
    else element.setAttribute(key, value);
  }, []);

  const stepAt = useCallback(
    (seconds: number) => {
      let found = -1;
      plan.marks.forEach((mark, index) => {
        if (seconds >= mark - 0.001) found = index;
      });
      return found;
    },
    [plan.marks],
  );

  const current = useRef<{ playing: boolean; speed: number; loop: boolean; reduced: boolean; plan: Plan }>({
    playing,
    speed,
    loop,
    reduced,
    plan,
  });

  const render = useCallback(
    (time: number, dt: number, force: boolean) => {
      const { plan: active } = current.current;
      const state = engine.current;
      const body = content.current;
      const window = viewport.current;
      if (!body || !window) return;
      const lines = body.querySelectorAll<HTMLElement>("[data-line]");
      const visibleTime = time >= active.clear0 ? active.end : time;
      let cursor = 0;
      let shown = 0;
      let typed = 0;
      let typing = false;

      for (const step of active.steps) {
        const line = lines[cursor];
        cursor += 1;
        const on = visibleTime >= step.tPrompt;
        write(line, "data-on", on ? "" : null);
        if (on) shown += 1;
        const fade = easeOut((visibleTime - step.tPrompt) / 0.22);
        write(line, "@opacity", fade >= 1 ? "" : fade.toFixed(3));

        let landed = 0;
        while (landed < step.times.length && step.times[landed] <= visibleTime) landed += 1;
        const cmd = line?.querySelector<HTMLElement>("[data-cmd]");
        if (cmd) {
          const spans = cmd.children;
          for (let index = 0; index < spans.length; index += 1) {
            write(spans[index], "data-on", index < landed ? "" : null);
          }
          const caret = on && visibleTime < step.tEnter;
          write(cmd, "data-caret", caret ? "" : null);
          if (caret) {
            typed = landed;
            typing =
              landed > 0 && visibleTime - step.times[landed - 1] < 0.45 && landed < step.times.length;
          }
        }

        for (const output of step.outputs) {
          const outLine = lines[cursor];
          cursor += 1;
          const shownNow = visibleTime >= output.t0;
          write(outLine, "data-on", shownNow ? "" : null);
          if (!shownNow) continue;
          shown += 1;
          const outputFade = easeOut((visibleTime - output.t0) / 0.22);
          write(outLine, "@opacity", outputFade >= 1 ? "" : outputFade.toFixed(3));
          write(
            outLine,
            "@transform",
            outputFade >= 1 ? "" : `translate3d(0, ${((1 - outputFade) * 5).toFixed(2)}px, 0)`,
          );
          if (output.kind === "progress") {
            const progress = (visibleTime - output.t0) / (output.t1 - output.t0);
            const eased = progressAt(progress);
            write(
              outLine.querySelector("[data-fill]"),
              "@transform",
              `translate3d(${((eased - 1) * 100).toFixed(3)}%, 0, 0)`,
            );
            write(outLine.querySelector("[data-pct]"), "#text", `${Math.round(100 * eased)}%`);
            write(outLine, "data-done", progress >= 1 ? "" : null);
          } else if (output.kind === "task") {
            const done = visibleTime >= output.t1;
            write(outLine, "data-done", done ? "" : null);
            if (!done) {
              write(
                outLine.querySelector("[data-spin]"),
                "#text",
                SPIN[Math.floor((visibleTime - output.t0) / 0.08) % SPIN.length],
              );
            }
          }
        }
      }

      const finalLine = lines[cursor];
      const finalOn = visibleTime >= active.tFinal && active.steps.length > 0;
      write(finalLine, "data-on", finalOn ? "" : null);
      write(
        finalLine,
        "@opacity",
        finalOn && visibleTime - active.tFinal < 0.22
          ? easeOut((visibleTime - active.tFinal) / 0.22).toFixed(3)
          : "",
      );
      if (finalOn) shown += 1;
      write(root.current, "data-typing", typing ? "" : null);

      const signature = `${shown}|${typed}`;
      if (signature !== state.sig) {
        state.sig = signature;
        state.scrollGoal = Math.max(0, body.offsetHeight - window.clientHeight);
      }
      if (force || time < 0.05) {
        state.scroll = state.scrollAim = state.scrollGoal;
        state.scrollV = 0;
      } else {
        state.scrollAim += (state.scrollGoal - state.scrollAim) * (1 - Math.exp(-22 * dt));
        const pull = 169 * (state.scrollAim - state.scroll) - 26 * state.scrollV;
        state.scrollV += pull * dt;
        state.scroll += state.scrollV * dt;
        if (
          Math.abs(state.scrollGoal - state.scroll) < 0.05 &&
          Math.abs(state.scrollV) < 0.05
        ) {
          state.scroll = state.scrollAim = state.scrollGoal;
          state.scrollV = 0;
        }
      }

      const clear = time >= active.clear0 ? easeInOut((time - active.clear0) / 0.8) : 0;
      write(body, "@transform", `translate3d(0, ${(-state.scroll - 18 * clear).toFixed(2)}px, 0)`);
      write(body, "@opacity", clear > 0 ? (1 - clear).toFixed(3) : "");

      const progress =
        time >= active.clear0 ? 1 - easeInOut((time - active.clear0) / 0.8) : clamp(time / active.end);
      write(trackFill.current, "@transform", `scaleX(${progress.toFixed(4)})`);
      write(thumbRail.current, "@transform", `translate3d(${(100 * progress).toFixed(3)}cqw, 0, 0)`);

      const seconds = progress * active.end;
      const label$ = `${clock(seconds)} / ${clock(active.end)}`;
      if (label$ !== state.lastTime) {
        state.lastTime = label$;
        write(clockLabel.current, "#text", label$);
        write(scrubber.current, "aria-valuenow", String(Math.round(seconds)));
      }
      const index = stepAt(seconds);
      if (index !== state.lastStep) {
        state.lastStep = index;
        write(
          scrubber.current,
          "aria-valuetext",
          index < 0 ? "Start" : `Step ${index + 1} of ${active.steps.length}: ${active.steps[index].command}`,
        );
      }
    },
    [stepAt, write],
  );

  const startLoop = useRef<() => void>(() => {});

  const run = useCallback(() => {
    const state = engine.current;
    if (state.running || !state.visible || current.current.reduced) return;
    state.running = true;
    state.last = performance.now();

    const frame = (now: number) => {
      const { playing: isPlaying, speed: pace, loop: looping } = current.current;
      const active = current.current.plan;
      const dt = Math.min(0.05, (now - state.last) / 1000);
      state.last = now;

      if (state.seek) {
        const progress = (now - state.seek.start) / (1000 * state.seek.dur);
        state.t = state.seek.from + (state.seek.to - state.seek.from) * easeInOut(progress);
        if (progress >= 1) {
          state.t = state.seek.to;
          state.seek = null;
        }
      } else if (state.scrubbing) {
        state.rate = 0;
        state.rateV = 0;
      } else {
        const target = isPlaying ? Math.max(0, pace) : 0;
        const pull = 144 * (target - state.rate) - 24 * state.rateV;
        state.rateV += pull * dt;
        state.rate += state.rateV * dt;
        if (Math.abs(target - state.rate) < 0.001 && Math.abs(state.rateV) < 0.001) {
          state.rate = target;
          state.rateV = 0;
        }
        state.t += dt * state.rate;
        if (state.t >= active.loopEnd) {
          if (looping) {
            state.t -= active.loopEnd;
            state.scroll = 0;
            state.scrollAim = 0;
            state.scrollV = 0;
            state.sig = "";
          } else {
            state.t = active.loopEnd;
            state.rate = 0;
            state.rateV = 0;
            if (!state.ended) {
              state.ended = true;
              setEnded(true);
            }
          }
        } else if (!looping && state.t >= active.clear0) {
          state.t = active.clear0 - 1e-4;
          state.rate = 0;
          state.rateV = 0;
          if (!state.ended) {
            state.ended = true;
            setEnded(true);
          }
        }
      }

      render(state.t, dt, false);

      const settled =
        !state.seek &&
        !state.scrubbing &&
        state.rate === 0 &&
        !(isPlaying && pace > 0 && !state.ended) &&
        state.scroll === state.scrollGoal;
      if (settled || !state.visible) {
        state.running = false;
        return;
      }
      state.frame = requestAnimationFrame(frame);
    };

    state.frame = requestAnimationFrame(frame);
  }, [render]);

  useLayoutEffect(() => {
    startLoop.current = run;
  }, [run]);

  useLayoutEffect(() => {
    current.current = { playing, speed, loop, reduced, plan };
  }, [playing, speed, loop, reduced, plan]);

  useLayoutEffect(() => {
    const state = engine.current;
    cache.current = new WeakMap();
    state.sig = "";
    state.lastTime = "";
    state.lastStep = -2;
    if (reduced) {
      state.t = plan.end;
      state.seek = null;
      render(state.t, 0, true);
      return;
    }
    if (state.t > plan.loopEnd) state.t = 0;
    render(state.t, 0, true);
    run();
  }, [plan, reduced, render, run]);

  useEffect(() => {
    if (reduced) return;
    run();
  }, [playing, speed, reduced, run]);

  useEffect(() => {
    const element = root.current;
    const state = engine.current;
    if (!element) return;
    let onScreen = true;
    const sync = () => {
      state.visible = onScreen && !document.hidden;
      if (state.visible) startLoop.current();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    const resize = new ResizeObserver(() => {
      state.sig = "";
      if (current.current.reduced || !state.running) render(state.t, 0, true);
    });
    if (content.current) resize.observe(content.current);
    return () => {
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [render]);

  const describe = useCallback(
    (seconds: number) => {
      const index = stepAt(seconds);
      return index < 0 ? "Start of the session" : `Step ${index + 1} of ${plan.steps.length}: ${plan.steps[index].command}`;
    },
    [plan.steps.length, stepAt],
  );

  const seek = useCallback(
    (target: number, duration: number) => {
      const state = engine.current;
      const value = clamp(target, 0, plan.end);
      if (state.ended && value < plan.end) {
        state.ended = false;
        setEnded(false);
      }
      if (current.current.reduced || duration <= 0) {
        state.seek = null;
        state.t = value;
        render(state.t, 0, true);
        return;
      }
      state.seek = {
        from: state.t >= plan.clear0 ? plan.end : state.t,
        to: value,
        start: performance.now(),
        dur: duration,
      };
      state.rate = 0;
      state.rateV = 0;
      run();
    },
    [plan.clear0, plan.end, render, run],
  );

  const replay = () => {
    const state = engine.current;
    const from = state.t >= plan.clear0 ? plan.end : state.t;
    state.ended = false;
    setEnded(false);
    setUserPaused(false);
    setAnnouncement("Replaying from the start");
    seek(0, Math.min(1.1, 0.35 + 0.05 * from));
  };

  const toggle = () => {
    if (ended) {
      replay();
      return;
    }
    setUserPaused((value) => !value);
    setAnnouncement(playing ? "Paused" : "Playing");
  };

  const scrubTo = (clientX: number) => {
    const rect = track.current;
    const state = engine.current;
    if (!rect) return;
    state.t = clamp((clientX - rect.getBoundingClientRect().left) / rect.getBoundingClientRect().width) * plan.end;
    state.seek = null;
    if (state.ended && state.t < plan.end) {
      state.ended = false;
      setEnded(false);
    }
    render(state.t, 1 / 60, false);
    run();
  };

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    const state = engine.current;
    if (!active || active.id !== event.pointerId) return;
    pointer.current = null;
    state.scrubbing = false;
    root.current?.removeAttribute("data-scrubbing");
    const head = (state.t / plan.end) * active.width;
    let target: number | null = null;
    for (const mark of [...plan.marks, plan.end]) {
      if (Math.abs((mark / plan.end) * active.width - head) < 12) target = mark;
    }
    if (target !== null && Math.abs(target - state.t) > 0.001) seek(target, 0.28);
    else run();
    setAnnouncement(describe(target ?? state.t));
  };

  const commands = steps.map((step) => step.command).join("\n");
  const rootStyle: CSSProperties = {
    ...style,
    ...(accent ? ({ "--tt-accent": accent } as CSSProperties) : null),
    "--tt-rows": rows,
  } as CSSProperties;

  const prompt = (value: string) => (
    <>
      <span className={styles.cwd}>{value}</span>
      <span className={styles.symbol}>{symbol}</span>
    </>
  );

  return (
    <figure
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      aria-label={label}
      data-reduced={reduced ? "" : undefined}
    >
      <div className={styles.window}>
        <div className={styles.bar}>
          <span className={styles.lights} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className={styles.title}>{title ?? "zsh"}</span>
          <span className={styles.barEnd}>
            {copyable && steps.length > 0 && (
              <CopyButton value={commands} label="Copy commands" iconOnly variant="plain" />
            )}
          </span>
        </div>
        <div ref={viewport} className={styles.viewport} aria-hidden="true">
          <div ref={content} className={styles.content}>
            {plan.steps.map((step, index) => (
              <div className={styles.group} key={`s${index}`}>
                <div data-line className={styles.promptLine}>
                  {prompt(step.cwd)}
                  <span data-cmd className={styles.cmd}>
                    {step.chars.map((char, position) => (
                      <span key={position} className={TOKEN_CLASS[char.kind]}>
                        {char.ch}
                      </span>
                    ))}
                  </span>
                </div>
                {step.outputs.map((output, position) =>
                  output.kind === "progress" ? (
                    <div key={position} data-line className={`${styles.out} ${styles.progress}`}>
                      <span className={styles.progressLabel}>{output.label}</span>
                      <span className={styles.bar2}>
                        <span data-fill className={styles.fill} />
                      </span>
                      <span data-pct className={styles.pct}>
                        0%
                      </span>
                    </div>
                  ) : output.kind === "task" ? (
                    <div key={position} data-line className={`${styles.out} ${styles.task}`}>
                      <span className={styles.glyph}>
                        <span data-spin className={styles.spin}>
                          {SPIN[0]}
                        </span>
                        <Check className={styles.tick} size={14} strokeWidth={2} />
                      </span>
                      <span>{output.label}</span>
                      {output.done && <span className={styles.took}>{output.done}</span>}
                    </div>
                  ) : (
                    <div key={position} data-line className={styles.out} data-tone={output.tone}>
                      {TONE_ICON[output.tone] && <span className={styles.glyph}>{TONE_ICON[output.tone]}</span>}
                      <span className={styles.text}>
                        {output.text === "" ? " " : withLinks(output.text)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ))}
            <div className={styles.group}>
              <div data-line className={styles.promptLine}>
                {prompt(plan.finalCwd)}
                <span data-cmd data-caret className={styles.cmd} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        {!reduced && (
          <button
            type="button"
            className={styles.button}
            onClick={toggle}
            aria-label={ended ? "Replay session" : playing ? "Pause typing" : "Play typing"}
          >
            <span className={styles.icon} data-show={playing ? "" : undefined}>
              <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className={styles.icon} data-show={playing ? undefined : ""}>
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </button>
        )}
        <div
          ref={scrubber}
          className={styles.scrubber}
          role="slider"
          tabIndex={0}
          aria-label="Session position"
          aria-valuemin={0}
          aria-valuemax={Math.round(plan.end)}
          aria-valuenow={0}
          aria-valuetext="Start"
          onPointerDown={(event) => {
            const rail = track.current;
            if (event.button !== 0 || !rail) return;
            const box = rail.getBoundingClientRect();
            pointer.current = { left: box.left, width: Math.max(1, box.width), id: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
            engine.current.scrubbing = true;
            root.current?.setAttribute("data-scrubbing", "");
            scrubber.current?.focus({ preventScroll: true });
            scrubTo(event.clientX);
          }}
          onPointerMove={(event) => {
            if (pointer.current?.id !== event.pointerId) return;
            scrubTo(event.clientX);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(event) => {
            const state = engine.current;
            const at = state.t >= plan.clear0 ? plan.end : state.seek ? state.seek.to : state.t;
            const stops = [...plan.marks, plan.end];
            let target: number | null = null;
            if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "PageDown") {
              target = stops.find((stop) => stop > at + 0.05) ?? plan.end;
            } else if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "PageUp") {
              target = [...stops].reverse().find((stop) => stop < at - 0.3) ?? 0;
            } else if (event.key === "Home") {
              target = 0;
            } else if (event.key === "End") {
              target = plan.end;
            } else if (event.key === " " || event.key === "k") {
              event.preventDefault();
              toggle();
              return;
            }
            if (target !== null) {
              event.preventDefault();
              seek(target, 0.42);
              setAnnouncement(describe(target));
            }
          }}
        >
          <div ref={track} className={styles.track}>
            <span ref={trackFill} className={styles.trackFill} />
            {plan.marks.slice(1).map((mark, index) => (
              <span key={index} className={styles.mark} style={{ left: `${(mark / plan.end) * 100}%` }} />
            ))}
            <span ref={thumbRail} className={styles.thumbRail}>
              <span className={styles.thumb} />
            </span>
          </div>
        </div>
        <span ref={clockLabel} className={styles.clock} aria-hidden="true">
          {`0:00 / ${clock(plan.end)}`}
        </span>
        {!reduced && (
          <button type="button" className={styles.button} onClick={replay} aria-label="Replay from the start">
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>

      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      <ol className={styles.srOnly}>
        {plan.steps.map((step, index) => (
          <li key={index}>
            {`Command: ${step.command}. `}
            {step.outputs
              .map((output) =>
                output.kind === "text"
                  ? output.text
                  : output.kind === "progress"
                    ? `${output.label}, complete.`
                    : `${output.label}, done.`,
              )
              .filter(Boolean)
              .join(" ")}
          </li>
        ))}
      </ol>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </figure>
  );
}

export default TypewriterTerminal;
