"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Check, Circle, CircleAlert, CircleStop, FileText, RotateCcw, Square } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import Slider from "../slider/slider";
import Switch from "../switch/switch";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./tldr-toggle.module.css";

export type TldrMode = "full" | "summary" | "points";
export type TldrLength = 1 | 2 | 3 | 4 | 5;

export interface TldrArticle {
  title: string;
  source?: { name: string; mark?: ReactNode };
  author?: { name: string; avatar?: string };
  date?: string;
  readingTime?: string;
  paragraphs: { id: string; text: string }[];
}

export interface TldrModel {
  name: string;
  mark?: ReactNode;
}

export interface TldrSummaryRequest {
  mode: TldrMode;
  length: number;
  targetWords: number;
  pointCount: number;
  article: TldrArticle;
  signal: AbortSignal;
}

export interface TldrSummaryPoint {
  source: string;
  text: string;
}

export interface TldrSummaryResult {
  mode: TldrMode;
  length: number;
  text: string;
  points?: TldrSummaryPoint[];
  words: number;
}

export interface TldrToggleProps {
  article?: TldrArticle;
  /** Replace the simulated summarizer with a real one. Return a promise or an async iterable of chunks. */
  summarize?: (request: TldrSummaryRequest) => Promise<string | AsyncIterable<TldrChunk>> | AsyncIterable<TldrChunk>;
  model?: TldrModel;
  mode?: TldrMode;
  defaultMode?: TldrMode;
  onModeChange?: (mode: TldrMode) => void;
  length?: number;
  defaultLength?: number;
  onLengthChange?: (length: number) => void;
  onComplete?: (result: TldrSummaryResult) => void;
  onJump?: (paragraphId: string) => void;
  autoPlay?: boolean;
  simulated?: boolean;
  className?: string;
}

export type TldrChunk = { type: "text"; text: string } | { type: "point"; source: string };

const targets = [35, 60, 85, 100, 130];
const modes = [
  { value: "full", label: "Full" },
  { value: "summary", label: "Summary" },
  { value: "points", label: "Key points" },
];
const lengths = [1, 2, 3, 4, 5];
const chunkPlan = [4, 6, 3, 7, 5, 8, 4, 5, 6, 3];
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const enterFade = { duration: .16, ease: easeStandard } as const;
const exitFade = { duration: .1, ease: easeStandard } as const;

/* The article the preview summarizes, and the run of points its summary is built from. */
const article: TldrArticle = {
  title: "How we made sync 4x faster for the largest workspaces",
  source: {
    name: "Linear blog",
    mark: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" role="img" aria-label="Linear" aria-hidden="true">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
      </svg>
    ),
  },
  author: { name: "Olivia Bennett", avatar: "/media/people/olivia-bennett.svg" },
  date: "Oct 21, 2026",
  paragraphs: [
    {
      id: "cold-start",
      text: "Last spring our largest customers started to feel it. Workspaces with more than 400,000 issues took up to 11 seconds to become interactive on a cold start, and every reconnect after a laptop woke from sleep replayed thousands of changes the client already had. Sync was designed for teams of fifty. It was now serving companies of five thousand.",
    },
    {
      id: "root-cause",
      text: "The root cause was the bootstrap payload. On first load, the client downloaded a full snapshot of every issue, comment and project it could see, then applied changes on top. For a workspace with 400,000 issues that snapshot was 180 MB of JSON, and parsing it blocked the main thread long before anything appeared on screen.",
    },
    {
      id: "partial-bootstrap",
      text: "We replaced the snapshot with partial bootstrapping. The client now loads only the teams, views and issues the first screen needs, about 2 percent of a typical large workspace, and streams the rest in the background over the same connection. Anything else is fetched the first time a view asks for it, then kept in IndexedDB for the next visit.",
    },
    {
      id: "reconnects",
      text: "Reconnects now carry a sequence number per model instead of one global cursor. A client coming back online sends the last number it saw for each model, and the server returns only what changed since. A laptop that slept through the weekend catches up in about 300 milliseconds instead of replaying 40,000 changes.",
    },
    {
      id: "results",
      text: "The results held across every cohort we measured. Median time to interactive for the largest workspaces fell from 11.2 to 2.6 seconds, memory on first load dropped by 58 percent, and sync-related support tickets fell by two thirds in the month after the rollout finished on October 6.",
    },
    {
      id: "next",
      text: "Partial bootstrapping is now on for every workspace, with no setting to change. Next we are moving search indexing into a web worker, so typing in the command menu never waits on the network, and in November we are publishing the sync protocol docs for integration partners.",
    },
  ],
};

const model: TldrModel = {
  name: "Claude Haiku 5.5",
  mark: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" role="img" aria-label="Claude" aria-hidden="true" style={{ color: "#D97757" }}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  ),
};

const summaryPoints = [
  { priority: 1, text: "Linear made sync about 4x faster for its largest workspaces by replacing the full bootstrap snapshot with partial bootstrapping." },
  { priority: 5, text: "The old 180 MB snapshot blocked the main thread for up to 11 seconds in workspaces with 400,000 issues." },
  { priority: 3, text: "The client now loads only what the first screen needs, about 2 percent of the workspace, and streams the rest in the background." },
  { priority: 4, text: "Reconnects use a sequence number per model, so a laptop that slept all weekend catches up in about 300 ms instead of replaying 40,000 changes." },
  { priority: 2, text: "Median time to interactive fell from 11.2 to 2.6 seconds, and first-load memory dropped 58 percent." },
  { priority: 6, text: "Sync-related support tickets fell by two thirds after the rollout finished on October 6." },
  { priority: 7, text: "Next up: search indexing in a web worker, and public sync protocol docs for partners in November." },
];

const summaryCutoffs = [2, 3, 4, 5, 7];

const keyPoints = [
  { priority: 6, source: "cold-start", text: "Workspaces with over 400,000 issues took up to 11 seconds to become interactive on a cold start." },
  { priority: 4, source: "root-cause", text: "The old 180 MB JSON snapshot blocked the main thread before anything rendered." },
  { priority: 1, source: "partial-bootstrap", text: "Partial bootstrapping loads about 2 percent of a workspace up front and streams the rest in the background." },
  { priority: 3, source: "reconnects", text: "A sequence number per model lets a client that slept all weekend catch up in about 300 ms." },
  { priority: 2, source: "results", text: "Median time to interactive fell from 11.2 to 2.6 seconds for the largest workspaces." },
  { priority: 5, source: "results", text: "First-load memory dropped 58 percent and sync support tickets fell by two thirds." },
  { priority: 7, source: "next", text: "Search indexing moves to a web worker next, and the sync protocol docs open to partners in November." },
];

type GenStatus = "thinking" | "streaming" | "done" | "stopped" | "error";

interface Gen {
  id: number;
  key: string;
  mode: TldrMode;
  length: number;
  status: GenStatus;
  paras: string[][];
  points: { source: string; chunks: string[] }[];
  instant?: boolean;
  error?: string;
}

const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");
const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;
const abortError = () => new DOMException("The summary was stopped.", "AbortError");

/** Groups words the way a model streams them, four to eight at a time. */
function chunk(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const out: string[] = [];
  for (let cursor = 0, step = 0; cursor < words.length; step += 1) {
    const size = chunkPlan[step % chunkPlan.length];
    out.push(words.slice(cursor, cursor + size).join(""));
    cursor += size;
  }
  return out;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function* streamText(source: string | { source: string; text: string }[], signal: AbortSignal) {
  let index = 0;
  const pace = (step: number) => wait(30 + ((7 * step) % 11), signal);
  if (typeof source === "string") {
    for (const piece of chunk(source)) {
      yield { type: "text" as const, text: piece };
      await pace(index++);
    }
    return;
  }
  for (const point of source) {
    yield { type: "point" as const, source: point.source };
    for (const piece of chunk(point.text)) {
      yield { type: "text" as const, text: piece };
      await pace(index++);
    }
  }
}

/** What the summary should say for a given mode and length, before it is chunked up. */
function planSummary(source: { mode: TldrMode; length: number; article: TldrArticle }) {
  const isSample = source.article.title === article.title;
  if (source.mode === "points") {
    const wanted = source.length + 2;
    if (isSample) {
      const keep = new Set(
        keyPoints
          .map((point) => point.priority)
          .sort((a, b) => a - b)
          .slice(0, wanted),
      );
      return keyPoints.filter((point) => keep.has(point.priority)).map(({ source: id, text }) => ({ source: id, text }));
    }
    return source.article.paragraphs.slice(0, wanted).map((paragraph) => ({ source: paragraph.id, text: firstSentence(paragraph.text) }));
  }
  if (isSample) {
    const cutoff = summaryCutoffs[source.length - 1] ?? 3;
    const lines = summaryPoints.filter((point) => point.priority <= cutoff).map((point) => point.text);
    if (cutoff < 5) return lines.join(" ");
    const split = lines.findIndex((line) => line.startsWith("Median"));
    return `${lines.slice(0, split).join(" ")}

${lines.slice(split).join(" ")}`;
  }
  const budget = targets[source.length - 1] ?? 60;
  const kept: string[] = [];
  for (const paragraph of source.article.paragraphs) {
    if (kept.length && countWords(kept.join(" ")) >= budget) break;
    kept.push(firstSentence(paragraph.text));
  }
  return kept.join(" ");
}

/** The built-in stand-in for a model call: thinks for a moment, then streams. */
export async function* simulateSummary(request: TldrSummaryRequest, options: { fail?: boolean; thinkMs?: number } = {}) {
  await wait(options.thinkMs ?? 700, request.signal);
  if (options.fail) throw new Error("The model did not respond in time.");
  yield* streamText(planSummary(request), request.signal);
}

function textOf(gen: Gen) {
  return gen.mode === "points"
    ? gen.points.map((point) => point.chunks.join("").trim()).filter(Boolean).join("\n")
    : gen.paras.map((para) => para.join("").trim()).filter(Boolean).join("\n\n");
}

/** The full article, with the paragraph a key point came from lit up while the page scrolls to it. */
function ArticleBody({ article: source, focus, reduced }: { article: TldrArticle; focus: { id: string; token: number } | null; reduced: boolean }) {
  const refs = useRef(new Map<string, HTMLParagraphElement>());
  const [lit, setLit] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    let clear = 0;
    const scroll = window.setTimeout(
      () => {
        const node = refs.current.get(focus.id);
        if (!node) return;
        node.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        node.focus({ preventScroll: true });
        setLit(focus.id);
        clear = window.setTimeout(() => setLit(null), 1800);
      },
      280 * (reduced ? 0 : 1),
    );
    return () => {
      window.clearTimeout(scroll);
      window.clearTimeout(clear);
    };
  }, [focus, reduced]);

  return (
    <div className={styles.article}>
      {source.paragraphs.map((paragraph) => (
        <p
          key={paragraph.id}
          ref={(node) => {
            if (node) refs.current.set(paragraph.id, node);
            else refs.current.delete(paragraph.id);
          }}
          className={styles.para}
          data-lit={lit === paragraph.id || undefined}
          tabIndex={-1}
        >
          {paragraph.text}
        </p>
      ))}
    </div>
  );
}

/**
 * An article that reads itself down to the point: the reader picks a length, the model streams a
 * summary or a set of key points, and every point can jump back to the paragraph it came from.
 * Leaving it alone drops it into the shortest useful mode; asking again shows the saved run.
 */
export default function TldrToggle({
  article: source = article,
  summarize,
  model: engine = model,
  mode,
  defaultMode = "full",
  onModeChange,
  length,
  defaultLength = 2,
  onLengthChange,
  onComplete,
  onJump,
  autoPlay,
  simulated,
  className,
}: TldrToggleProps) {
  const reduced = !!useReducedMotion();
  const [modeState, setModeState] = useState<TldrMode>(defaultMode);
  const [lengthState, setLengthState] = useState<number>(defaultLength);
  const activeMode = mode ?? modeState;
  const activeLength = length ?? lengthState;
  const [sliderValue, setSliderValue] = useState(activeLength);
  const [committed, setCommitted] = useState(activeLength);
  if (committed !== activeLength) {
    setCommitted(activeLength);
    setSliderValue(activeLength);
  }
  const [lastWritten, setLastWritten] = useState<TldrMode>(activeMode === "points" ? "points" : "summary");
  if (activeMode !== "full" && activeMode !== lastWritten) setLastWritten(activeMode);

  const [gen, setGen] = useState<Gen | null>(null);
  const [nonce, setNonce] = useState(0);
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const cache = useRef(new Map<string, Gen>());
  const controller = useRef<AbortController | null>(null);
  const retried = useRef(false);
  const counter = useRef(0);
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clipOuter = useRef<HTMLDivElement | null>(null);
  const clipInner = useRef<HTMLDivElement | null>(null);

  const empty = source.paragraphs.length === 0;
  const auto = autoPlay ?? !summarize;
  const pretend = simulated ?? !summarize;
  const simNote = pretend ? " Simulated, nothing was sent." : "";

  const latest = useRef({ summarize, article: source, engine, onComplete, onModeChange, simNote });
  useLayoutEffect(() => {
    latest.current = { summarize, article: source, engine, onComplete, onModeChange, simNote };
  });

  const articleKey = `${source.title}\n${source.paragraphs.map((paragraph) => paragraph.id).join(",")}`;
  const keyRef = useRef(articleKey);

  const changeMode = (next: TldrMode) => {
    if (next === activeMode) return;
    if (mode === undefined) setModeState(next);
    latest.current.onModeChange?.(next);
  };

  // Springs the clip between body heights, so the card grows instead of jumping when a summary lands.
  useEffect(() => {
    const outer = clipOuter.current;
    const inner = clipInner.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    let running: ReturnType<typeof animate> | undefined;
    const clear = () => {
      outer.style.height = "";
      running = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = running ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      running?.stop();
      if (reduced || widthChanged) {
        clear();
        return;
      }
      outer.style.height = `${from}px`;
      const animation = animate(outer, { height: nextHeight }, motionTokens.spring.snappy);
      running = animation;
      void animation.then(() => {
        if (running === animation) clear();
      });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      running?.stop();
    };
  }, [reduced]);

  const saved = gen && gen.key === `${activeMode}:${activeLength}` ? gen : null;
  const genStatus: GenStatus = saved?.status ?? "thinking";
  const genText = saved ? textOf(saved) : "";
  const words = countWords(genText);
  const readingMode = activeMode === "full" ? lastWritten : activeMode;
  const articleWords = source.paragraphs.reduce((total, paragraph) => total + countWords(paragraph.text), 0);
  const readingTime = source.readingTime ?? `${Math.max(1, Math.ceil(articleWords / 230))} min read`;
  const bodyKey = activeMode === "full" ? "full" : empty ? "empty" : `${activeMode}:${activeLength}:${nonce}`;
  const stateKey = genStatus === "done" ? `done-${activeMode}` : genStatus;
  const kind = genStatus === "thinking" || genStatus === "streaming" ? "running" : genStatus === "error" ? "error" : "result";

  useEffect(() => {
    if (keyRef.current !== articleKey) {
      keyRef.current = articleKey;
      cache.current.clear();
    }
    if (activeMode === "full" || empty) return;
    const key = `${activeMode}:${activeLength}`;
    const cached = cache.current.get(key);
    if (cached && !retried.current) {
      setGen({ ...cached, instant: true });
      setAnnouncement(`Showing the saved ${activeMode === "points" ? "key points" : "summary"}.`);
      return;
    }
    retried.current = false;
    const stop = new AbortController();
    controller.current = stop;
    const { summarize: run, article: doc, engine: chosen } = latest.current;
    let current: Gen = {
      id: ++counter.current,
      key,
      mode: activeMode,
      length: activeLength,
      status: "thinking",
      paras: [[]],
      points: [],
    };
    setGen(current);
    setAnnouncement(`${activeMode === "points" ? "Finding key points" : "Summarizing"} with ${chosen.name}.`);

    const apply = (previous: Gen, next: TldrChunk): Gen => {
      if (next.type === "point") {
        return { ...previous, status: "streaming", points: [...previous.points, { source: next.source, chunks: [] }] };
      }
      if (previous.mode === "points") {
        const points = previous.points.length ? previous.points.slice() : [{ source: "", chunks: [] }];
        const last = points[points.length - 1];
        points[points.length - 1] = { ...last, chunks: [...last.chunks, next.text] };
        return { ...previous, status: "streaming", points };
      }
      const paras = previous.paras.slice();
      next.text.split(/\n{2,}/).forEach((part, index) => {
        if (index > 0) paras.push([]);
        if (part) {
          const tail = paras.length - 1;
          paras[tail] = [...paras[tail], part];
        }
      });
      return { ...previous, status: "streaming", paras };
    };

    void (async () => {
      try {
        const request: TldrSummaryRequest = {
          mode: activeMode,
          length: activeLength,
          targetWords: targets[activeLength - 1],
          pointCount: activeLength + 2,
          article: doc,
          signal: stop.signal,
        };
        const produced = run ? run(request) : simulateSummary(request);
        const stream =
          produced && typeof produced === "object" && Symbol.asyncIterator in produced
            ? (produced as AsyncIterable<TldrChunk>)
            : streamText(await (produced as Promise<string> | string), stop.signal);
        for await (const next of stream as AsyncIterable<TldrChunk>) {
          if (stop.signal.aborted) return;
          current = apply(current, next);
          setGen(current);
        }
        if (stop.signal.aborted) return;
        current = { ...current, status: "done" };
        cache.current.set(key, current);
        setGen(current);
        const text = textOf(current);
        const points =
          activeMode === "points" ? current.points.map((point) => ({ source: point.source, text: point.chunks.join("").trim() })) : undefined;
        setAnnouncement(
          `${activeMode === "points" ? `${plural(points?.length ?? 0, "key point")} ready.` : `Summary ready, ${plural(countWords(text), "word")}.`}${latest.current.simNote}`,
        );
        latest.current.onComplete?.({ mode: activeMode, length: activeLength, text, points, words: countWords(text) });
      } catch (error) {
        if (stop.signal.aborted) return;
        const message = error instanceof Error && error.message ? error.message : "Something went wrong.";
        current = { ...current, status: "error", error: message };
        setGen(current);
        setAnnouncement(`Couldn’t summarize. ${message}${latest.current.simNote}`);
      }
    })();

    return () => stop.abort();
  }, [activeMode, activeLength, nonce, empty, articleKey]);

  const isRunning = !!saved && saved.key === `${activeMode}:${activeLength}` && (saved.status === "thinking" || saved.status === "streaming");

  const stopRun = () => {
    if (!isRunning) return;
    controller.current?.abort();
    setGen((previous) =>
      previous && (previous.status === "thinking" || previous.status === "streaming") ? { ...previous, status: "stopped" } : previous,
    );
    setAnnouncement("Stopped. What arrived is kept.");
  };

  const regenerate = () => {
    retried.current = true;
    setNonce((value) => value + 1);
  };

  // Left alone, the card drops into the short version once it is mostly on screen.
  useEffect(() => {
    const node = rootRef.current;
    if (!auto || !node || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry?.isIntersecting || touched.current) return;
        timer = window.setTimeout(() => {
          if (touched.current) return;
          touched.current = true;
          observer.disconnect();
          setModeState((value) => (mode === undefined && value === "full" ? "summary" : value));
          latest.current.onModeChange?.("summary");
        }, 1000);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [auto, mode]);

  const showJump = isRunning;

  const body =
    activeMode === "full" ? (
      empty ? null : <ArticleBody article={source} focus={focus} reduced={reduced} />
    ) : (
      <div className={styles.gen}>
        <AnimatePresence initial={false}>
          {genStatus === "thinking" ? (
            <motion.span key="thinking" className={styles.thinking} exit={{ opacity: 0, transition: exitFade }}>
              <TextShimmer>{activeMode === "points" ? "Finding key points" : `Reading ${plural(source.paragraphs.length, "paragraph")}`}</TextShimmer>
            </motion.span>
          ) : null}
        </AnimatePresence>
        {activeMode === "summary" && saved
          ? (
              <div className={styles.summary}>
                {saved.paras
                  .filter((para) => para.length)
                  .map((para, index) => (
                    <p key={index}>
                      {saved.instant || reduced
                        ? para.join("")
                        : para.map((piece, pieceIndex) => (
                            <span key={pieceIndex} className={styles.chunk}>
                              {piece}
                            </span>
                          ))}
                    </p>
                  ))}
              </div>
            )
          : null}
        {activeMode === "points" && saved && saved.points.length > 0
          ? (
              <ul className={styles.points}>
                {saved.points.map((point, index) => {
                  const done = index < saved.points.length - 1 || saved.status === "done";
                  const paragraph = source.paragraphs.findIndex((item) => item.id === point.source) + 1;
                  return (
                    <li key={index} className={[styles.point, !reduced && styles.enter].filter(Boolean).join(" ")}>
                      <span className={styles.pointIcon} data-done={done || undefined} aria-hidden="true">
                        <Circle size={16} className={styles.pending} />
                        <Check size={16} className={styles.check} />
                      </span>
                      <span className={styles.pointText}>
                        {saved.instant || reduced
                          ? point.chunks.join("")
                          : point.chunks.map((piece, pieceIndex) => (
                              <span key={pieceIndex} className={styles.chunk}>
                                {piece}
                              </span>
                            ))}
                      </span>
                      {paragraph > 0 ? (
                        showJump ? (
                          <span className={styles.jumpSlot} aria-hidden="true">
                            ¶{paragraph}
                          </span>
                        ) : (
                          <Tooltip content="Show in article">
                            <button
                              type="button"
                              className={styles.jump}
                              aria-label={`Jump to paragraph ${paragraph}: ${point.chunks.join("").trim()}`}
                              onClick={() => {
                                const target = source.paragraphs.findIndex((item) => item.id === point.source);
                                onJump?.(point.source);
                                setFocus((value) => ({ id: point.source, token: (value?.token ?? 0) + 1 }));
                                setAnnouncement(`Showing paragraph ${target + 1} in the article.`);
                                changeMode("full");
                              }}
                            >
                              ¶{paragraph}
                            </button>
                          </Tooltip>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          : null}
        {genStatus === "error" ? (
          <div className={styles.error} role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <div className={styles.errorCopy}>
              <p className={styles.errorTitle}>Couldn’t {activeMode === "points" ? "find key points" : "summarize this article"}</p>
              <p className={styles.errorText}>
                {saved?.error}
                {pretend ? " Simulated, nothing was sent." : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onPointerDown={() => {
        touched.current = true;
      }}
      onKeyDown={(event) => {
        touched.current = true;
        if (event.key === "Escape" && isRunning) {
          event.preventDefault();
          stopRun();
        }
      }}
    >
      <article className={styles.card} aria-busy={isRunning || undefined}>
        <header className={styles.head}>
          {source.source ? (
            <div className={styles.source}>
              {source.source.mark ? <span className={styles.sourceMark}>{source.source.mark}</span> : null}
              <span className={styles.truncate}>{source.source.name}</span>
            </div>
          ) : null}
          <h3 className={styles.title}>{source.title}</h3>
          <div className={styles.byline}>
            {source.author ? (
              <>
                <Avatar name={source.author.name} src={source.author.avatar} size="sm" className={styles.avatar} />
                <span className={styles.author}>{source.author.name}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className={styles.truncate}>{[source.date, readingTime].filter(Boolean).join(" · ")}</span>
          </div>
        </header>
        <div className={styles.controls}>
          <SegmentedControl
            label="Reading mode"
            options={modes}
            value={activeMode}
            onValueChange={(next) => {
              touched.current = true;
              changeMode(next as TldrMode);
            }}
          />
          <div className={styles.length}>
            <Slider
              label="Length"
              value={sliderValue}
              min={1}
              max={5}
              step={1}
              marks={lengths}
              format={(value) => (readingMode === "points" ? plural(value + 2, "point") : `~${targets[value - 1]} words`)}
              disabled={activeMode === "full" || empty}
              onValueChange={setSliderValue}
              onValueCommit={(value) => {
                const next = Math.min(5, Math.max(1, Math.round(value)));
                touched.current = true;
                if (next === activeLength) return;
                if (length === undefined) setLengthState(next);
                onLengthChange?.(next);
              }}
            />
          </div>
        </div>
        <div ref={clipOuter} className={styles.clip}>
          <div ref={clipInner} className={styles.body}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={bodyKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: reduced ? { duration: 0 } : enterFade }}
                exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitFade }}
              >
                {empty ? (
                  <div className={styles.empty}>
                    <FileText size={16} aria-hidden="true" />
                    <span>Nothing to summarize yet</span>
                  </div>
                ) : (
                  body
                )}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {activeMode !== "full" && !empty ? (
                <motion.div key="foot" className={styles.foot} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enterFade }} exit={{ opacity: 0, transition: { duration: 0 } }}>
                  <div className={styles.status}>
                    {engine.mark ? <span className={styles.modelMark}>{engine.mark}</span> : null}
                    <span className={styles.modelName}>{engine.name}</span>
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.stateSlot}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={stateKey}
                          className={styles.state}
                          data-status={genStatus}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: enterFade }}
                          exit={{ opacity: 0, transition: exitFade }}
                        >
                          {genStatus === "thinking" ? "Thinking" : null}
                          {genStatus === "streaming" ? <TextShimmer>Writing</TextShimmer> : null}
                          {genStatus === "done" ? (
                            <>
                              <Check size={14} aria-hidden="true" />
                              {activeMode === "points" ? plural(saved?.points.length ?? 0, "point") : plural(words, "word")}
                            </>
                          ) : null}
                          {genStatus === "stopped" ? (
                            <>
                              <CircleStop size={14} aria-hidden="true" />
                              Stopped
                            </>
                          ) : null}
                          {genStatus === "error" ? (
                            <>
                              <CircleAlert size={14} aria-hidden="true" />
                              Failed
                            </>
                          ) : null}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={kind}
                        className={styles.actionSet}
                        data-kind={kind}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: enterFade }}
                        exit={{ opacity: 0, transition: exitFade }}
                      >
                        {kind === "running" ? (
                          <Button variant="ghost" size="sm" className={styles.action} onClick={stopRun}>
                            <Square size={10} fill="currentColor" aria-hidden="true" />
                            Stop
                          </Button>
                        ) : null}
                        {kind === "result" ? (
                          <>
                            <CopyButton
                              value={genText}
                              iconOnly
                              variant="plain"
                              label={activeMode === "points" ? "Copy key points" : "Copy summary"}
                              className={styles.iconAction}
                              disabled={!genText}
                            />
                            <Tooltip content="Regenerate">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`${styles.action} ${styles.iconAction}`}
                                onClick={regenerate}
                                aria-label="Regenerate"
                              >
                                <RotateCcw size={16} aria-hidden="true" />
                              </Button>
                            </Tooltip>
                          </>
                        ) : null}
                        {kind === "error" ? (
                          <Button variant="primary" size="sm" className={`${styles.action} ${styles.retry}`} onClick={regenerate}>
                            <RotateCcw size={14} aria-hidden="true" />
                            Try again
                          </Button>
                        ) : null}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </article>
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
