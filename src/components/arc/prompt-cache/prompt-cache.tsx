"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CircleDashed,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  StepForward,
  TimerOff,
  TriangleAlert,
  Zap,
} from "lucide-react";
import Button from "../button/button";
import TextShimmer from "../text-shimmer/text-shimmer";
import Tooltip from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./prompt-cache.module.css";

const SERIES = ["var(--series-3)", "var(--series-2)", "var(--series-4)", "var(--series-1)"];

/** One reusable part of the prompt: the cacheable prefix is made of these. */
export interface PromptCacheSegment {
  id: string;
  label: string;
  tokens: number;
  color?: string;
}

/** One user turn appended after the cached prefix. */
export interface PromptCacheRequest {
  message: string;
  tokens: number;
  /** Idle time in seconds that passes before this request is sent. */
  gap?: number;
}

/** Per-million prices of the model the illustration prices against. */
export interface PromptCacheModel {
  name: string;
  mark?: ReactNode;
  inputPrice: number;
  cacheWritePrice: number;
  cacheReadPrice: number;
}

/** Time to first token, in seconds, for a request of the given shape. */
export type PromptCacheFirstToken = (input: { processed: number; cached: number }) => number;

export interface PromptCacheProps {
  segments?: PromptCacheSegment[];
  requests?: PromptCacheRequest[];
  model?: PromptCacheModel;
  /** Cache time to live, in seconds. */
  ttl?: number;
  /** Segment id the "change" button rewrites, which is what turns a hit into a partial hit. */
  changeSegment?: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  firstToken?: PromptCacheFirstToken;
  onRequest?: (result: PromptCacheRequestResult) => void;
  onExpire?: () => void;
  messageLabel?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

type RequestKind = "hit" | "partial" | "write";
type BoxMode = "empty" | "writing" | "reading" | "warm" | "expired";
type RowState = "run" | "done";

interface PromptCacheRequestResult {
  index: number;
  at: number;
  kind: RequestKind;
  breakAt: number;
  cachedTokens: number;
  writtenTokens: number;
  processedTokens: number;
  cost: number;
  uncachedCost: number;
  firstToken: number;
  uncachedFirstToken: number;
  changed: boolean;
  cold: boolean;
  message: string;
}

interface CacheState {
  versions: number[];
  expiresAt: number;
}

interface Timing {
  delay: number;
  dur: number;
}

interface RowView {
  result: PromptCacheRequestResult;
  state: RowState;
  timing: Timing[];
  showMark: boolean;
}

interface Flight {
  key: number;
  from: number;
  left: number;
  top: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  w1: number;
  h1: number;
}

interface BoxView {
  filled: boolean[];
  mode: BoxMode;
  readKey: number;
}

interface ViewState {
  round: number;
  rows: (RowView | null)[];
  box: BoxView;
  flight: Flight | null;
  caption: string;
  clearing: boolean;
}

type StageName = "ready" | "gap" | "run" | "settle" | "idle" | "expired" | "clear" | "stopped";

interface StageEvent {
  at: number;
  run: () => void;
}

interface Stage {
  name: StageName;
  slot: number;
  t: number;
  duration: number;
  events: StageEvent[];
  fired: number;
  tick?: (t: number, step: number) => void;
}

interface Engine {
  stage: Stage;
  S: number;
  roundAt: number;
  cache: CacheState | null;
  versions: number[];
  armed: boolean;
  stepping: boolean;
  playing: boolean;
  ring: number;
  flightKey: number;
  round: number;
  readKey: number;
  results: PromptCacheRequestResult[];
}

const CLAUDE_MARK_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

/** A weak Claude mark, so the model line reads as a model without shipping the brand asset. */
function DefaultModelMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="Claude"
      aria-hidden="true"
      focusable="false"
      style={{ color: "#D97757" }}
    >
      <path d={CLAUDE_MARK_PATH} />
    </svg>
  );
}

const DEFAULT_SEGMENTS: PromptCacheSegment[] = [
  { id: "tools", label: "Tools", tokens: 3800 },
  { id: "system", label: "System prompt", tokens: 2400 },
  { id: "documents", label: "Documents", tokens: 36200 },
  { id: "conversation", label: "Conversation", tokens: 6000 },
];

const DEFAULT_REQUESTS: PromptCacheRequest[] = [
  { message: "Which refunds are still pending this week?", tokens: 180 },
  { message: "Draft a reply to Northwind about their late refund", tokens: 240, gap: 42 },
  { message: "Summarize ticket 48213 and the attached invoice", tokens: 410, gap: 35 },
  { message: "Which customers asked about SSO in October?", tokens: 150, gap: 51 },
];

const DEFAULT_MODEL: PromptCacheModel = {
  name: "Claude Sonnet 5.5",
  mark: <DefaultModelMark />,
  inputPrice: 2,
  cacheWritePrice: 2.5,
  cacheReadPrice: 0.2,
};

const DEFAULT_FIRST_TOKEN: PromptCacheFirstToken = ({ processed, cached }) => 0.42 + processed / 40000 + cached / 500000;

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];

/** Token counts: 34800 -> "34.8K", 1200000 -> "1.2M". */
function formatTokens(value: number) {
  const n = Math.max(0, value);
  return n >= 1000000 ? `${+(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : `${Math.round(n)}`;
}

const formatMoney = (value: number) => `$${Math.max(0, value).toFixed(4)}`;
const formatPrice = (value: number) => `$${value.toFixed(2)}`;
const formatSeconds = (value: number) => `${Math.max(0, value).toFixed(2)}s`;
const formatClock = (value: number) => {
  const total = Math.max(0, Math.ceil(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const formatRatio = (value: number) => `${+value.toFixed(2)}x`;
const formatPercent = (value: number) => `${Math.round(Math.abs(value))}%`;
const formatSpeed = (value: number) => `${value.toFixed(1)}x`;

/** 300 -> "5 minutes"; the header wants the singular form ("5 minute cache"). */
function formatTtl(seconds: number, short = false) {
  const unit = (count: number, name: string) => `${+count.toFixed(1)} ${name}${count === 1 || short ? "" : "s"}`;
  return seconds >= 3600 && seconds % 900 === 0
    ? unit(seconds / 3600, "hour")
    : seconds >= 60 && seconds % 15 === 0
      ? unit(seconds / 60, "minute")
      : unit(seconds, "second");
}

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const noopSubscribe = () => () => {};

interface SimulationInput {
  cache: CacheState | null;
  versions: number[];
  at: number;
  roundAt: number;
  index: number;
  request: PromptCacheRequest;
  segments: PromptCacheSegment[];
  model: PromptCacheModel;
  ttl: number;
  changed: boolean;
  firstToken: PromptCacheFirstToken;
}

/** Work out what one request reads, what it writes and what it costs. */
function simulate({ cache, versions, at, roundAt, index, request, segments, model, ttl, changed, firstToken }: SimulationInput) {
  const live = cache && at < cache.expiresAt ? cache : null;
  let matched = 0;
  if (live) {
    while (matched < segments.length && live.versions[matched] === versions[matched]) matched += 1;
  }
  const prefixTokens = segments.reduce((total, segment) => total + segment.tokens, 0);
  const cachedTokens = segments.slice(0, matched).reduce((total, segment) => total + segment.tokens, 0);
  const writtenTokens = prefixTokens - cachedTokens;
  const processed = Math.max(0, request.tokens);
  const result: PromptCacheRequestResult = {
    index,
    at: at - roundAt,
    kind: matched === segments.length ? "hit" : matched === 0 ? "write" : "partial",
    breakAt: matched,
    cachedTokens,
    writtenTokens,
    processedTokens: writtenTokens + processed,
    cost: (cachedTokens * model.cacheReadPrice + writtenTokens * model.cacheWritePrice + processed * model.inputPrice) / 1e6,
    uncachedCost: ((prefixTokens + processed) * model.inputPrice) / 1e6,
    firstToken: firstToken({ processed: writtenTokens + processed, cached: cachedTokens }),
    uncachedFirstToken: firstToken({ processed: prefixTokens + processed, cached: 0 }),
    changed,
    cold: !live,
    message: request.message,
  };
  return { result, cache: { versions: [...versions], expiresAt: at + ttl } as CacheState };
}

function Swap({ id, children, reduced, className }: { id: string; children: ReactNode; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.12 : 0.16, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface CountUpProps {
  value: number | null;
  from?: number;
  format: (value: number) => string;
  reduced: boolean;
  className?: string;
}

/** Writes into a text node so the tween never re-renders React. */
function CountUp({ value, from, format, reduced, className }: CountUpProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef<number | null>(null);
  const [initial] = useState(() => (value == null ? "–" : format(value)));

  useLayoutEffect(() => {
    const node = hostRef.current?.firstChild;
    if (!node) return;
    if (value == null) {
      currentRef.current = null;
      node.nodeValue = "–";
      return;
    }
    const start = currentRef.current ?? from ?? 0;
    if (reduced || start === value) {
      currentRef.current = value;
      node.nodeValue = format(value);
      return;
    }
    const begin = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - begin) / 420);
      const next = start + (value - start) * (1 - (1 - progress) ** 3);
      currentRef.current = next;
      (node as Text).nodeValue = format(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    node.nodeValue = format(start);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, from, format, reduced]);

  return (
    <span ref={hostRef} className={className} data-empty={value == null || undefined}>
      {initial}
    </span>
  );
}

function Glyph({ playing }: { playing: boolean }) {
  return (
    <span className={styles.glyph} aria-hidden="true">
      <Play data-on={!playing} />
      <Pause data-on={playing} />
    </span>
  );
}

function statusNode(row: RowView | null) {
  if (!row) return { id: "queued", node: null };
  const { result, state } = row;
  if (state === "run") {
    const label = result.kind === "hit" ? "Reading cache" : "Processing";
    return { id: `run-${label}`, node: <TextShimmer className={styles.shimmer}>{label}</TextShimmer> };
  }
  if (result.kind === "hit") {
    return {
      id: "hit",
      node: (
        <>
          <Zap className={styles.statusIcon} data-tone="success" aria-hidden="true" />
          Cache hit
        </>
      ),
    };
  }
  if (result.kind === "partial") {
    return {
      id: "partial",
      node: (
        <>
          <TriangleAlert className={styles.statusIcon} data-tone="warning" aria-hidden="true" />
          Partial hit
        </>
      ),
    };
  }
  return {
    id: "write",
    node: (
      <>
        <PenLine className={styles.statusIcon} data-tone="info" aria-hidden="true" />
        Cache write
      </>
    ),
  };
}

export function PromptCache({
  segments = DEFAULT_SEGMENTS,
  requests = DEFAULT_REQUESTS,
  model = DEFAULT_MODEL,
  ttl = 300,
  changeSegment = "system",
  autoPlay = true,
  loop = true,
  speed = 1,
  firstToken = DEFAULT_FIRST_TOKEN,
  onRequest,
  onExpire,
  messageLabel = "New message",
  title = "Prompt cache",
  className,
  style,
}: PromptCacheProps) {
  const reduced = !!useReducedMotion();
  const list = useMemo(() => requests.slice(0, 4), [requests]);
  const count = Math.max(1, list.length);
  const segmentCount = segments.length;
  const changeIndex = changeSegment == null ? -1 : segments.findIndex((segment) => segment.id === changeSegment);
  const changeTarget = changeIndex >= 0 ? segments[changeIndex] : null;
  const prefixTokens = segments.reduce((total, segment) => total + segment.tokens, 0);

  const weights = useMemo(() => {
    const raw = [
      ...segments.map((segment) => Math.sqrt(Math.max(1, segment.tokens))),
      Math.sqrt(Math.max(1, ...list.map((request) => request.tokens))),
    ];
    const total = raw.reduce((sum, value) => sum + value, 0);
    return raw.map((value) => Math.max(value, 0.045 * total));
  }, [segments, list]);
  const prefixWeight = weights.slice(0, segmentCount).reduce((sum, value) => sum + value, 0);
  const offsets = useMemo(() => {
    let running = 0;
    return weights.slice(0, segmentCount).map((weight) => {
      const offset = running / prefixWeight;
      running += weight;
      return offset;
    });
  }, [weights, segmentCount, prefixWeight]);
  const colorOf = (index: number) => segments[index]?.color ?? SERIES[index % SERIES.length];
  const configKey = JSON.stringify([
    segments.map((segment) => [segment.id, segment.tokens]),
    list.map((request) => [request.tokens, request.gap ?? 0]),
    ttl,
    model.inputPrice,
    model.cacheReadPrice,
    model.cacheWritePrice,
  ]);
  const ttlText = formatTtl(ttl);
  const writeRatio = formatRatio(model.cacheWritePrice / model.inputPrice);
  const readRatio = formatRatio(model.cacheReadPrice / model.inputPrice);
  const introCaption = `Every request repeats the same ${formatTokens(prefixTokens)} token prefix. Only the new message at the end changes.`;

  const captionFor = useCallback(
    (result: PromptCacheRequestResult, phase: "run" | "done") => {
      const segment = segments[result.breakAt];
      if (result.kind === "hit") {
        return phase === "run"
          ? `Request ${result.index + 1} matches the cached prefix, so it reads it instead of processing it.`
          : `Cache hit. ${formatTokens(result.cachedTokens)} tokens read at ${readRatio} the price. Only ${formatTokens(result.processedTokens)} new tokens processed.`;
      }
      if (result.kind === "partial") {
        return phase === "run"
          ? `The ${lowerFirst(segment.label)} changed, so request ${result.index + 1} matches the cache only up to it.`
          : `Partial hit. ${formatTokens(result.cachedTokens)} tokens came from the cache; ${formatTokens(result.writtenTokens)} from the ${lowerFirst(segment.label)} on were processed again.`;
      }
      if (phase === "run") {
        return result.cold
          ? `Request ${result.index + 1} processes all ${formatTokens(result.processedTokens)} tokens and writes the prefix to the cache.`
          : `The ${lowerFirst(segment.label)} changed, so nothing matches and request ${result.index + 1} processes everything.`;
      }
      return `Cache write. The prefix stays cached for ${ttlText} and cost ${writeRatio} the input price to store.`;
    },
    [segments, readRatio, writeRatio, ttlText],
  );

  const configRef = useRef({
    segments,
    list,
    model,
    ttl,
    firstToken,
    onRequest,
    onExpire,
    loop,
    speed,
    reduced,
    weights,
    changeIndex,
    count,
    captionFor,
    introCaption,
    ttlText,
  });
  useLayoutEffect(() => {
    configRef.current = {
      segments,
      list,
      model,
      ttl,
      firstToken,
      onRequest,
      onExpire,
      loop,
      speed,
      reduced,
      weights,
      changeIndex,
      count,
      captionFor,
      introCaption,
      ttlText,
    };
  });

  const initialView = useCallback(
    (): ViewState => ({
      round: 0,
      rows: list.map(() => null),
      box: { filled: segments.map(() => false), mode: "empty", readKey: 0 },
      flight: null,
      caption: "",
      clearing: false,
    }),
    [list, segments],
  );

  const [view, setView] = useState<ViewState>(initialView);
  const [playing, setPlaying] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const ringArcRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const ttlRef = useRef<HTMLSpanElement>(null);

  const registerTtl = useCallback((node: HTMLSpanElement | null) => {
    if (node) {
      ttlRef.current = node;
    } else if (ttlRef.current && !ttlRef.current.isConnected) {
      ttlRef.current = null;
    }
  }, []);

  const engineRef = useRef<Engine>({
    stage: { name: "ready", slot: 0, t: 0, duration: 700, events: [], fired: 0 },
    S: 0,
    roundAt: 0,
    cache: null,
    versions: [],
    armed: false,
    stepping: false,
    playing: false,
    ring: 0,
    flightKey: 0,
    round: 0,
    readKey: 0,
    results: [],
  });

  const setPlayingBoth = useCallback((next: boolean) => {
    engineRef.current.playing = next;
    setPlaying(next);
  }, []);

  /** Ring + TTL readout are painted imperatively so the clock never re-renders the tree. */
  const syncRing = useCallback((elapsed = 0) => {
    const engine = engineRef.current;
    const { ttl: life, reduced: still } = configRef.current;
    const left = engine.cache ? Math.max(0, engine.cache.expiresAt - engine.S) : 0;
    const ratio = life > 0 ? left / life : 0;
    if (ratio > engine.ring && elapsed > 0 && !still) {
      engine.ring += (ratio - engine.ring) * (1 - Math.exp(-elapsed / 70));
    } else {
      engine.ring = ratio;
    }
    const arc = ringArcRef.current;
    if (arc) {
      arc.style.strokeDashoffset = String(1 - engine.ring);
      arc.style.opacity = engine.ring > 0.003 ? "1" : "0";
    }
    if (ringRef.current) ringRef.current.dataset.low = String(left > 0 && ratio < 0.2);
    const label = ttlRef.current;
    if (label) {
      const text = formatClock(left);
      if (label.textContent !== text) label.textContent = text;
    }
  }, []);

  const patchBox = useCallback((update: (box: BoxView) => BoxView) => {
    setView((current) => ({ ...current, box: update(current.box) }));
  }, []);

  const expire = useCallback(() => {
    const engine = engineRef.current;
    engine.cache = null;
    setView((current) => ({
      ...current,
      box: { ...current.box, filled: current.box.filled.map(() => false), mode: "expired" },
      caption: "The cache expired. The next request writes the prefix again.",
    }));
    configRef.current.onExpire?.();
    if (engine.stepping) setAnnouncement("The cache expired.");
  }, []);

  /** Measure the source row and the cache box so the ghost can fly between them. */
  const launchFlight = useCallback((slot: number, from: number) => {
    const root = rootRef.current;
    const engine = engineRef.current;
    if (!root) return;
    const last = configRef.current.segments.length - 1;
    const measure = (pick: (segment: number) => string) => {
      const source = root.querySelector(pick(from))?.getBoundingClientRect();
      const target = root.querySelector(pick(last))?.getBoundingClientRect();
      return source && target ? { left: source.left, top: source.top, width: target.right - source.left, height: source.height } : null;
    };
    const row = measure((segment) => `[data-row="${slot}"] [data-seg="${segment}"]`);
    const box = measure((segment) => `[data-box-seg="${segment}"]`);
    if (!row || !box) return;
    const base = root.getBoundingClientRect();
    engine.flightKey += 1;
    const flight: Flight = {
      key: engine.flightKey,
      from,
      left: row.left - base.left - root.clientLeft,
      top: row.top - base.top - root.clientTop,
      width: row.width,
      height: row.height,
      dx: box.left - row.left,
      dy: box.top - row.top,
      w1: box.width,
      h1: box.height,
    };
    setView((current) => ({ ...current, flight }));
  }, []);

  const beginStage = useCallback(
    (name: StageName, slot = 0) => {
      const engine = engineRef.current;
      const config = configRef.current;
      const still = config.reduced;
      const stage: Stage = { name, slot, t: 0, duration: 0, events: [], fired: 0 };
      engine.stage = stage;

      if (name === "ready") {
        stage.duration = 700 * Number(!still);
        return;
      }

      if (name === "gap") {
        const gap = slot === 0 ? 0 : Math.max(0, config.list[slot]?.gap ?? 40);
        const start = engine.S;
        stage.duration = gap && !still ? 560 : 0;
        stage.tick = (t) => {
          const progress = stage.duration ? 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t / stage.duration))) / 2 : 1;
          engine.S = start + gap * progress;
          if (engine.cache && engine.S >= engine.cache.expiresAt) expire();
        };
        return;
      }

      if (name === "run") {
        if (slot === 0) engine.roundAt = engine.S;
        const changed = engine.armed && config.changeIndex >= 0;
        if (changed) {
          engine.versions = engine.versions.map((version, index) => (index === config.changeIndex ? version + 1 : version));
          engine.armed = false;
          setArmed(false);
        }
        const warm = !!engine.cache && engine.S < engine.cache.expiresAt;
        const { result, cache } = simulate({
          cache: engine.cache,
          versions: engine.versions,
          at: engine.S,
          roundAt: engine.roundAt,
          index: slot,
          request: config.list[slot],
          segments: config.segments,
          model: config.model,
          ttl: config.ttl,
          changed,
          firstToken: config.firstToken,
        });
        engine.results[slot] = result;
        const breakAt = result.breakAt;
        const total = config.weights.reduce((sum, value) => sum + value, 0);
        const width = (index: number) => Math.max(120, (1100 * config.weights[index]) / total);
        const timing: Timing[] = config.weights.map(() => ({ delay: 0, dur: 0 }));
        let cursor = result.kind === "hit" ? 280 : breakAt > 0 ? 240 : 220 * Number(warm);
        for (let index = breakAt; index < segmentCount; index += 1) {
          timing[index] = { delay: cursor, dur: width(index) };
          cursor += width(index);
        }
        const newMessageAt = cursor;
        timing[segmentCount] = { delay: cursor, dur: width(segmentCount) };
        const end = cursor + width(segmentCount);
        const row: RowView = {
          result,
          state: still ? "done" : "run",
          timing,
          showMark: changed && warm && result.kind !== "hit",
        };
        setView((current) => ({
          ...current,
          rows: current.rows.map((entry, index) => (index === slot ? row : entry)),
          caption: config.captionFor(result, "run"),
        }));

        if (still) {
          engine.cache = cache;
          patchBox((box) => ({ ...box, filled: box.filled.map(() => true), mode: "warm" }));
          return;
        }

        if (result.kind === "hit") {
          engine.readKey += 1;
          const readKey = engine.readKey;
          patchBox((box) => ({ ...box, mode: "reading", readKey }));
          stage.duration = Math.max(520, end) + 60;
          stage.events.push({ at: 200, run: () => { engine.cache = cache; } });
          stage.events.push({ at: stage.duration, run: () => patchBox((box) => ({ ...box, mode: "warm" })) });
          return;
        }

        if (warm) {
          stage.events.push({
            at: 140 * Number(breakAt > 0),
            run: () => patchBox((box) => ({ ...box, filled: box.filled.map((on, index) => index < breakAt && on), mode: "writing" })),
          });
        }
        stage.events.push({
          at: newMessageAt,
          run: () => {
            if (!warm) patchBox((box) => ({ ...box, mode: "writing" }));
            launchFlight(slot, breakAt);
          },
        });
        stage.events.push({
          at: newMessageAt + 460,
          run: () => {
            engine.cache = cache;
            setView((current) => ({
              ...current,
              flight: null,
              box: { ...current.box, filled: current.box.filled.map(() => true), mode: "warm" },
            }));
          },
        });
        stage.duration = Math.max(end, newMessageAt + 460) + 60;
        return;
      }

      if (name === "settle") {
        const manual = engineRef.current.stepping;
        stage.duration = still ? 1400 * Number(!manual) : manual ? 460 : 900;
        const result = engineRef.current.results[slot];
        setView((current) => ({
          ...current,
          rows: current.rows.map((entry, index) => (index === slot && entry ? { ...entry, state: "done" } : entry)),
          caption: result ? config.captionFor(result, "done") : current.caption,
        }));
        if (result) {
          config.onRequest?.(result);
          if (manual) setAnnouncement(`${config.captionFor(result, "done")} Simulated.`);
        }
        return;
      }

      if (name === "idle") {
        if (!engineRef.current.cache) {
          stage.duration = 0;
          return;
        }
        const rate = still ? Number.POSITIVE_INFINITY : config.ttl / 4200;
        let announced = false;
        stage.duration = Number.POSITIVE_INFINITY;
        stage.tick = (_t, step) => {
          if (!announced) {
            announced = true;
            setView((current) => ({
              ...current,
              caption: `No new requests. The cache expires ${config.ttlText} after its last use.`,
            }));
          }
          engineRef.current.S = Number.isFinite(rate) ? engineRef.current.S + step * rate : (engineRef.current.cache?.expiresAt ?? engineRef.current.S);
          if (engineRef.current.cache && engineRef.current.S >= engineRef.current.cache.expiresAt) {
            expire();
            stage.duration = 0;
          }
        };
        return;
      }

      if (name === "expired") {
        stage.duration = 1700 * Number(config.loop);
        return;
      }

      if (name === "clear") {
        stage.duration = 280 * Number(!still);
        setView((current) => ({ ...current, clearing: true }));
        return;
      }

      if (name === "stopped") {
        stage.duration = Number.POSITIVE_INFINITY;
        setPlayingBoth(false);
      }
    },
    [expire, patchBox, launchFlight, setPlayingBoth, segmentCount],
  );

  const advance = useCallback(() => {
    const engine = engineRef.current;
    const { name, slot } = engine.stage;
    if (name === "ready") return beginStage("gap", 0);
    if (name === "gap") return beginStage("run", slot);
    if (name === "run") return beginStage("settle", slot);
    if (name === "settle") {
      if (engine.stepping) {
        engine.stepping = false;
        setStepping(false);
      }
      return slot + 1 < configRef.current.count ? beginStage("gap", slot + 1) : beginStage("idle");
    }
    if (name === "idle") return beginStage("expired");
    if (name === "expired") return configRef.current.loop ? beginStage("clear") : beginStage("stopped");
    if (name === "clear") {
      engine.round += 1;
      engine.results = [];
      const round = engine.round;
      setView((current) => ({
        ...current,
        round,
        rows: current.rows.map(() => null),
        clearing: false,
        box: current.box.mode === "expired" ? { ...current.box, mode: "empty" } : current.box,
      }));
      return beginStage("gap", 0);
    }
    return undefined;
  }, [beginStage]);

  const stepEngine = useCallback(
    (elapsed: number) => {
      const engine = engineRef.current;
      if (!engine.playing && !engine.stepping) return;
      engine.stage.t += elapsed;
      let step = elapsed;
      for (let guard = 0; guard < 12; guard += 1) {
        const stage = engine.stage;
        while (stage.fired < stage.events.length && stage.t >= stage.events[stage.fired].at) {
          stage.events[stage.fired].run();
          stage.fired += 1;
        }
        stage.tick?.(Math.min(stage.t, stage.duration), step);
        if (stage.t < stage.duration) break;
        const overflow = stage.t - stage.duration;
        const wasStepping = engine.stepping;
        advance();
        if ((wasStepping && !engine.stepping) || engine.stage === stage) break;
        engine.stage.t = Number.isFinite(overflow) ? overflow : 0;
        step = 0;
      }
      syncRing(elapsed);
    },
    [advance, syncRing],
  );

  const running = (playing || stepping) && visible;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(64, now - previous) * Math.max(0, configRef.current.speed);
      previous = now;
      stepEngine(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, stepEngine]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              onScreen = !!entry?.isIntersecting;
              update();
            },
            { rootMargin: "80px" },
          );
    observer?.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const resetRun = useCallback(
    (warm: boolean) => {
      const engine = engineRef.current;
      const config = configRef.current;
      engine.S = 0;
      engine.roundAt = 0;
      engine.cache = null;
      engine.versions = config.segments.map(() => 0);
      engine.armed = false;
      engine.stepping = false;
      engine.ring = 0;
      engine.round += 1;
      engine.results = [];
      setArmed(false);
      setStepping(false);

      if (warm) {
        let cache: CacheState | null = null;
        const rows = config.list.map((request, index) => {
          if (index) engine.S += Math.max(0, request.gap ?? 40);
          const { result, cache: next } = simulate({
            cache,
            versions: engine.versions,
            at: engine.S,
            roundAt: 0,
            index,
            request,
            segments: config.segments,
            model: config.model,
            ttl: config.ttl,
            changed: false,
            firstToken: config.firstToken,
          });
          cache = next;
          engine.results[index] = result;
          return {
            result,
            state: "done" as RowState,
            timing: config.weights.map(() => ({ delay: 0, dur: 0 })),
            showMark: false,
          };
        });
        engine.cache = cache;
        beginStage("idle");
        const last = rows[rows.length - 1]?.result;
        setView({
          round: engine.round,
          rows,
          box: { filled: config.segments.map(() => true), mode: "warm", readKey: 0 },
          flight: null,
          caption: last ? config.captionFor(last, "done") : config.introCaption,
          clearing: false,
        });
      } else {
        beginStage("ready");
        setView({
          round: engine.round,
          rows: config.list.map(() => null),
          box: { filled: config.segments.map(() => false), mode: "empty", readKey: 0 },
          flight: null,
          caption: config.introCaption,
          clearing: false,
        });
      }
      syncRing();
    },
    [beginStage, syncRing],
  );

  useEffect(() => {
    resetRun(reduced);
    setPlayingBoth(autoPlay && !reduced);
  }, [reduced, configKey, autoPlay, resetRun, setPlayingBoth]);

  useLayoutEffect(() => {
    syncRing();
  }, [view.box.mode, syncRing]);

  const doneResults = view.rows.filter((row): row is RowView => !!row && row.state === "done").map((row) => row.result);
  const totalCost = doneResults.reduce((sum, result) => sum + result.cost, 0);
  const totalUncached = doneResults.reduce((sum, result) => sum + result.uncachedCost, 0);
  const saving = doneResults.length && totalUncached ? (1 - totalCost / totalUncached) * 100 : null;
  const hits = doneResults.filter((result) => result.kind === "hit");
  const hitTime = hits.length ? hits.reduce((sum, result) => sum + result.firstToken, 0) / hits.length : null;
  const uncachedHitTime = hits.length ? hits.reduce((sum, result) => sum + result.uncachedFirstToken, 0) / hits.length : null;
  const speedUp = hitTime && uncachedHitTime ? uncachedHitTime / hitTime : null;
  const costRises = saving != null && saving < 0;
  const cachedTokens = segments.reduce((sum, segment, index) => sum + (view.box.filled[index] ? segment.tokens : 0), 0);

  const boxStatus = (() => {
    switch (view.box.mode) {
      case "writing":
        return { id: "writing", node: <TextShimmer className={styles.shimmer}>Writing</TextShimmer> };
      case "reading":
        return { id: "reading", node: <TextShimmer className={styles.shimmer}>Reading</TextShimmer> };
      case "warm":
        return {
          id: "warm",
          node: (
            <span>
              Expires in <span ref={registerTtl} className={styles.tabular}>{formatClock(ttl)}</span>
            </span>
          ),
        };
      case "expired":
        return {
          id: "expired",
          node: (
            <>
              <TimerOff className={styles.statusIcon} data-tone="warning" aria-hidden="true" />
              Expired
            </>
          ),
        };
      default:
        return {
          id: "empty",
          node: (
            <>
              <CircleDashed className={styles.statusIcon} aria-hidden="true" />
              Empty
            </>
          ),
        };
    }
  })();

  const segmentStyle = (index: number, extra: Record<string, string | number> = {}): CSSProperties =>
    ({ flexGrow: weights[index], "--c": index < segmentCount ? colorOf(index) : "var(--pc-new)", ...extra }) as CSSProperties;
  const vars = (input: Record<string, string | number>): CSSProperties => input as CSSProperties;

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={vars({ "--pc-rate": Math.max(0.1, speed), ...style } as Record<string, string | number>)}
      aria-label={`${title}, simulated with sample prices`}
      data-paused={!running || speed <= 0 || undefined}
      data-clearing={view.clearing || undefined}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.model}>
            <span className={styles.modelName}>
              {model.mark ? <span className={styles.modelMark}>{model.mark}</span> : null}
              {model.name}
            </span>
            <span className={styles.modelTtl}>{formatTtl(ttl, true)} cache</span>
          </p>
        </div>
        <div className={styles.controls}>
          <Tooltip content={playing ? "Pause" : "Play"}>
            <Button
              variant="secondary"
              size="sm"
              className={styles.iconButton}
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => {
                const engine = engineRef.current;
                if (playing) {
                  setPlayingBoth(false);
                  setAnnouncement("Paused.");
                  return;
                }
                if (engine.stage.name === "stopped") resetRun(false);
                engine.stepping = false;
                setStepping(false);
                setPlayingBoth(true);
              }}
            >
              <Glyph playing={playing} />
            </Button>
          </Tooltip>
          <Tooltip content="Send the next request">
            <Button
              variant="secondary"
              size="sm"
              className={styles.iconButton}
              aria-label="Send the next request"
              onClick={() => {
                const engine = engineRef.current;
                setPlayingBoth(false);
                if (engine.stage.name === "stopped") resetRun(false);
                engine.stepping = true;
                setStepping(true);
                const { name, slot } = engine.stage;
                if (name === "ready") beginStage("gap", 0);
                else if (name === "idle" || name === "expired") beginStage("clear");
                else if (name === "settle") beginStage(slot + 1 < count ? "gap" : "clear", slot + 1);
              }}
            >
              <StepForward aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="Reset">
            <Button
              variant="secondary"
              size="sm"
              className={styles.iconButton}
              aria-label="Reset"
              onClick={() => {
                resetRun(false);
                setAnnouncement("Reset. The cache is empty.");
              }}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </header>

      <ul className={styles.legend} aria-label="Prompt segments">
        {segments.map((segment, index) => (
          <li key={segment.id} className={styles.legendItem}>
            <span className={styles.swatch} style={vars({ "--c": colorOf(index) })} aria-hidden="true" />
            <span>{segment.label}</span>
            <span className={styles.legendTokens}>{formatTokens(segment.tokens)}</span>
          </li>
        ))}
        <li className={styles.legendItem}>
          <span className={styles.swatch} style={vars({ "--c": "var(--pc-new)" })} aria-hidden="true" />
          <span>{messageLabel}</span>
        </li>
      </ul>

      <div className={styles.main}>
        <div className={styles.stack}>
          <div className={styles.columns} aria-hidden="true">
            <span className={styles.keys}>
              <span className={styles.legendItem}>
                <span className={styles.keySolid} />
                Processed
              </span>
              <span className={styles.legendItem}>
                <span className={styles.keyCached} />
                From cache
              </span>
            </span>
            <span className={styles.metricHead}>Processed</span>
            <span className={styles.metricHead}>Input cost</span>
            <span className={styles.metricHead}>First token</span>
          </div>
          <ol className={styles.rows} aria-label="Requests">
            {view.rows.map((row, index) => {
              const status = statusNode(row);
              const before = index > 0 ? view.rows[index - 1] : null;
              const previous = before && before.state === "done" ? before.result : null;
              const settled = row && row.state === "done" ? row.result : null;
              const breakAt = row?.result.breakAt ?? 0;
              const screenReader = (() => {
                if (!row || row.state !== "done") return `Request ${index + 1}: not sent yet.`;
                const result = row.result;
                const kind =
                  result.kind === "hit"
                    ? "cache hit"
                    : result.kind === "partial"
                      ? `partial hit, changed at the ${lowerFirst(segments[result.breakAt].label)}`
                      : "cache write";
                return `Request ${index + 1} at ${formatClock(result.at)}${result.message ? `, "${result.message}"` : ""}: ${kind}. ${formatTokens(result.cachedTokens)} tokens read from the cache, ${formatTokens(result.processedTokens)} processed. Input cost ${formatMoney(result.cost)}, first token in ${formatSeconds(result.firstToken)}.`;
              })();
              return (
                <li key={index} className={styles.row} data-row={index} data-state={row ? row.state : "queued"} data-kind={row?.result.kind}>
                  <span className={styles.srOnly}>{screenReader}</span>
                  <div className={styles.rowHead} aria-hidden="true">
                    <span className={styles.rowTitle}>Request {index + 1}</span>
                    <span className={styles.rowTime}>{row ? formatClock(row.result.at) : ""}</span>
                    <Swap id={`${view.round}-${status.id}`} reduced={reduced} className={styles.rowStatus}>
                      {status.node}
                    </Swap>
                  </div>
                  <div className={styles.bar} aria-hidden="true">
                    <div className={styles.prefix} style={{ flexGrow: prefixWeight }}>
                      {segments.map((segment, segmentIndex) => {
                        const mode = row ? (segmentIndex < breakAt ? "cached" : "process") : "empty";
                        const timing = row?.timing[segmentIndex];
                        return (
                          <span
                            key={segment.id}
                            className={styles.seg}
                            data-seg={segmentIndex}
                            data-mode={mode}
                            style={segmentStyle(segmentIndex, {
                              "--d": `${timing?.delay ?? 0}ms`,
                              "--t": `${timing?.dur ?? 0}ms`,
                              "--l": offsets[segmentIndex],
                            })}
                          >
                            <span className={styles.clip}>
                              <span className={styles.fill} />
                              {row?.state === "run" && mode === "cached" && !reduced ? <span className={styles.band} /> : null}
                            </span>
                            {row?.showMark && segmentIndex === breakAt ? <span className={styles.mark} style={vars({ "--m": "140ms" })} /> : null}
                          </span>
                        );
                      })}
                    </div>
                    <span
                      className={styles.seg}
                      data-mode={row ? "process" : "empty"}
                      style={segmentStyle(segmentCount, {
                        "--d": `${row?.timing[segmentCount]?.delay ?? 0}ms`,
                        "--t": `${row?.timing[segmentCount]?.dur ?? 0}ms`,
                      })}
                    >
                      <span className={styles.clip}>
                        <span className={styles.fill} />
                      </span>
                    </span>
                  </div>
                  <span className={styles.metric} aria-hidden="true">
                    <CountUp value={settled?.processedTokens ?? null} from={previous?.processedTokens} format={formatTokens} reduced={reduced} className={styles.metricValue} />
                  </span>
                  <span className={styles.metric} aria-hidden="true">
                    <CountUp value={settled?.cost ?? null} from={previous?.cost} format={formatMoney} reduced={reduced} className={styles.metricValue} />
                  </span>
                  <span className={styles.metric} aria-hidden="true">
                    <CountUp value={settled?.firstToken ?? null} from={previous?.firstToken} format={formatSeconds} reduced={reduced} className={styles.metricValue} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.box} data-mode={view.box.mode} role="group" aria-label="Cache">
          <div className={styles.boxHead}>
            <span ref={ringRef} className={styles.ring} aria-hidden="true">
              <svg viewBox="0 0 36 36">
                <circle className={styles.ringTrack} cx="18" cy="18" r="15" />
                <circle
                  ref={ringArcRef}
                  className={styles.ringArc}
                  cx="18"
                  cy="18"
                  r="15"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1}
                />
              </svg>
            </span>
            <span className={styles.boxTitle}>
              <span className={styles.boxName}>Cache</span>
              <Swap id={boxStatus.id} reduced={reduced} className={styles.boxStatus}>
                {boxStatus.node}
              </Swap>
            </span>
          </div>
          <div className={styles.boxBar} aria-hidden="true">
            {segments.map((segment, index) => (
              <span
                key={segment.id}
                className={styles.boxSeg}
                data-box-seg={index}
                data-on={view.box.filled[index] ?? false}
                style={vars({ flexGrow: weights[index], "--c": colorOf(index), "--l": offsets[index], "--i": segmentCount - 1 - index })}
              >
                <span className={styles.clip}>
                  <span className={styles.boxFill} />
                  {view.box.mode === "reading" && view.box.filled[index] && !reduced ? <span key={view.box.readKey} className={styles.band} /> : null}
                </span>
              </span>
            ))}
          </div>
          <span className={styles.boxTokens}>
            <CountUp value={cachedTokens} format={formatTokens} reduced={reduced} className={styles.tabular} /> tokens cached
          </span>
          <div className={styles.pricing}>
            <dl className={styles.prices}>
              <div className={styles.price}>
                <dt>Input</dt>
                <dd>{formatPrice(model.inputPrice)}</dd>
              </div>
              <div className={styles.price}>
                <dt>Cache write</dt>
                <dd>{formatPrice(model.cacheWritePrice)}</dd>
              </div>
              <div className={styles.price}>
                <dt>Cache read</dt>
                <dd>{formatPrice(model.cacheReadPrice)}</dd>
              </div>
            </dl>
            <p className={styles.priceNote}>Per million tokens</p>
          </div>
        </div>

        {view.flight ? (
          <span
            key={view.flight.key}
            className={styles.ghost}
            aria-hidden="true"
            style={vars({
              left: view.flight.left,
              top: view.flight.top,
              width: view.flight.width,
              height: view.flight.height,
              "--dx": `${view.flight.dx}px`,
              "--dy": `${view.flight.dy}px`,
              "--w1": `${view.flight.w1}px`,
              "--h1": `${view.flight.h1}px`,
              "--fly": "460ms",
            })}
          >
            {segments.slice(view.flight.from).map((segment, index) => {
              const at = (view.flight?.from ?? 0) + index;
              return (
                <span key={segment.id} className={styles.ghostSeg} style={vars({ flexGrow: weights[at], "--c": colorOf(at) })}>
                  <span className={styles.ghostSolid} />
                </span>
              );
            })}
          </span>
        ) : null}
      </div>

      <Swap id={view.caption || introCaption} reduced={reduced} className={styles.caption}>
        {view.caption || introCaption}
      </Swap>

      <footer className={styles.footer}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <CountUp value={saving == null ? null : Math.abs(saving)} format={formatPercent} reduced={reduced} className={styles.statValue} />
            <Swap id={costRises ? "higher" : "lower"} reduced={reduced} className={styles.statLabel}>
              {costRises ? "higher input cost" : "lower input cost"}
            </Swap>
            <span className={styles.statDetail}>
              {saving != null ? `${formatMoney(totalCost)} vs ${formatMoney(totalUncached)} uncached` : "No requests yet"}
            </span>
          </div>
          <div className={styles.stat}>
            <CountUp value={speedUp} format={formatSpeed} reduced={reduced} className={styles.statValue} />
            <span className={styles.statLabel}>faster first token</span>
            <span className={styles.statDetail}>
              {hitTime && uncachedHitTime
                ? `${formatSeconds(hitTime)} vs ${formatSeconds(uncachedHitTime)} on cache hits`
                : "No cache hits yet"}
            </span>
          </div>
        </div>
        {changeTarget ? (
          <Button
            variant="secondary"
            size="sm"
            className={styles.change}
            aria-pressed={armed}
            onClick={() => {
              const engine = engineRef.current;
              engine.armed = !engine.armed;
              setArmed(engine.armed);
              if (!changeTarget) return;
              const warm = !!engine.cache && engine.S < engine.cache.expiresAt;
              const caption = engine.armed
                ? warm
                  ? `Edited the ${lowerFirst(changeTarget.label)}. The next request matches the cache only up to it.`
                  : `Edited the ${lowerFirst(changeTarget.label)}. The cache is empty, so the next request processes everything anyway.`
                : `Kept the ${lowerFirst(changeTarget.label)} as it was.`;
              setView((current) => ({ ...current, caption }));
              setAnnouncement(caption);
              if (engine.armed && warm && playing && engine.stage.name === "idle") beginStage("clear");
            }}
          >
            <PenLine aria-hidden="true" />
            Change the {lowerFirst(changeTarget.label)}
          </Button>
        ) : null}
      </footer>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default PromptCache;
