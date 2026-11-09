"use client";

/**
 * Model training — an Arc Pro component.
 *
 * A batch of labeled samples leaves the training set, runs forward through a small
 * neural net, the error flows backward and strengthens the edges that helped, the
 * loss curve descends over the epochs, then a held-out evaluation turns green.
 *
 * Everything that animates is a single rAF clock (`CLOCK.time`), sampled through one
 * `draw()` pass that writes only the attributes that actually changed, so the loop
 * stays allocation-light and the DOM diffs clean.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play } from "lucide-react";

import styles from "./model-training.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const readReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const readReducedMotionOnServer = () => false;

/* ------------------------------------------------------------------ */
/* timeline                                                            */
/* ------------------------------------------------------------------ */

type Span = { s: number; d: number };

const STEPS: readonly string[] = ["Batch", "Forward pass", "Backprop", "Epochs", "Evaluate"];
const CLASSES: readonly [string, string] = ["Positive", "Negative"];

const STEP_STARTS: readonly number[] = [0, 3.2, 6.2, 9.2, 16.35];
const STEP_STILLS: readonly number[] = [2.9, 4.75, 7.8, 14, 20.45];
const CYCLE = 21.45;
const INTRO_END = 0.8;

const batches: Span[] = [{ s: 1, d: 1.5 }];
const forward: Span[][] = [[], [], []];
const backward: Span[][] = [[], [], []];

for (let layer = 0; layer < 3; layer += 1) {
  forward[layer].push({ s: 3.4 + 0.9 * layer, d: 0.8 });
  backward[layer].push({ s: 6.4 + 0.9 * (2 - layer), d: 0.8 });
}

for (let index = 0; index < 5; index += 1) {
  const start = 9.2 + 1.35 * index;
  batches.push({ s: start, d: 0.46 });
  for (let layer = 0; layer < 3; layer += 1) {
    forward[layer].push({ s: start + 0.46 + 0.2 * layer, d: 0.38 });
    backward[layer].push({ s: start + 1.04 + 0.15 * (2 - layer), d: 0.36 });
  }
}

const heldOutBatch: Span = { s: 16.55, d: 0.9 };

for (let layer = 0; layer < 3; layer += 1) {
  forward[layer].push({ s: 17.55 + 0.5 * layer, d: 0.55 });
}

const BACKPROP_START = forward[2][0].s + forward[2][0].d;
const EVAL_WINDOW: readonly [number, number] = [
  forward[0][forward[0].length - 1].s,
  forward[2][forward[2].length - 1].s + forward[2][forward[2].length - 1].d,
];

/** End times of every pulse that lights a node column, per column. */
const forwardEnds: number[][] = [
  [...batches, heldOutBatch].map((span) => span.s + span.d),
  ...forward.map((list) => list.map((span) => span.s + span.d)),
];

/** Rings for backprop: end of each pulse, and the start times for the output column. */
const backwardEnds: number[][] = [
  backward[0].map((span) => span.s + span.d),
  backward[1].map((span) => span.s + span.d),
  backward[2].map((span) => span.s + span.d),
  backward[2].map((span) => span.s),
];

/* ------------------------------------------------------------------ */
/* math                                                                */
/* ------------------------------------------------------------------ */

type Point = readonly [number, number];
type Curve = readonly [Point, Point, Point, Point];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const wrap = (value: number, span: number) => ((value % span) + span) % span;

const smoothstep = (from: number, to: number, value: number) => {
  const eased = clamp((value - from) / (to - from));
  return eased * eased * (3 - 2 * eased);
};

const smootherstep = (value: number) => {
  const x = clamp(value);
  return x * x * x * (x * (6 * x - 15) + 10);
};

const easeOutCubic = (value: number) => 1 - (1 - clamp(value)) ** 3;
const fadeWindow = (value: number) => clamp(Math.min(value / 0.14, (1 - value) / 0.14));
const n2 = (value: number) => value.toFixed(2);

const lerp = (from: Point, to: Point, t: number): Point => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
];

/** Cubic Bézier evaluated with de Casteljau, so the pulse rides the drawn path exactly. */
const bezier = (curve: Curve, t: number): Point => {
  const a = lerp(curve[0], curve[1], t);
  const b = lerp(curve[1], curve[2], t);
  const c = lerp(curve[2], curve[3], t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
};

const pathOf = (curve: Curve) =>
  `M${n2(curve[0][0])} ${n2(curve[0][1])}C${n2(curve[1][0])} ${n2(curve[1][1])} ${n2(curve[2][0])} ${n2(
    curve[2][1],
  )} ${n2(curve[3][0])} ${n2(curve[3][1])}`;

const withThousands = (value: number) => Math.round(value).toLocaleString("en-US");

/** Stable pseudo-random in [0, 1) — the reference's sine hash, so the net looks identical. */
const noise = (seed: number) => {
  const value = 43758.5453 * Math.sin(12.9898 * seed + 78.233);
  return value - Math.floor(value);
};

const activeSpan = (spans: readonly Span[], time: number) => {
  for (const span of spans) if (time >= span.s && time <= span.s + span.d) return span;
  return null;
};

/** Progress since the last entry of `times` that has already happened, normalised by `span`. */
const sinceLast = (times: readonly number[], time: number, span = 0.6) => {
  let last = -Infinity;
  for (const at of times) if (at <= time && at > last) last = at;
  const progress = (time - last) / span;
  return progress >= 0 && progress < 1 ? progress : -1;
};

const stepIndexAt = (time: number) => {
  let index = 0;
  for (let i = 0; i < STEP_STARTS.length; i += 1) if (time >= STEP_STARTS[i]) index = i;
  return index;
};

/** Training loss: exponential descent plus a deterministic wobble that dies out. */
const lossAt = (progress: number, from: number, to: number) => {
  const descent = (Math.exp(-4.2 * progress) - Math.exp(-4.2)) / (1 - Math.exp(-4.2));
  const wobble =
    0.045 *
    (from - to) *
    (0.5 + 0.5 * Math.sin(41 * progress) * Math.sin(13 * progress + 1)) *
    4 *
    progress *
    (1 - progress);
  return to + (from - to) * descent + wobble;
};

/* ------------------------------------------------------------------ */
/* props                                                               */
/* ------------------------------------------------------------------ */

export type ModelTrainingLabels = {
  training?: string;
  heldOut?: string;
  unit?: string;
  input?: string;
  hidden?: string;
  output?: string;
  loss?: string;
  epoch?: string;
  evaluation?: string;
  waiting?: string;
  running?: string;
  passed?: string;
  noBatch?: string;
};

export type ModelTrainingProps = {
  /** Output class names, positive first. */
  classes?: [string, string];
  /** Input features per sample, clamped to 2–5. */
  inputs?: number;
  /** Hidden layer sizes, clamped to 2–6 each. */
  hidden?: [number, number];
  samples?: number;
  heldOutSamples?: number;
  batchSize?: number;
  epochs?: number;
  lossFrom?: number;
  lossTo?: number;
  accuracy?: number;
  target?: number;
  labels?: ModelTrainingLabels;
  steps?: readonly string[];
  defaultStep?: number;
  caption?: boolean;
  controls?: boolean;
  speed?: number;
  paused?: boolean;
  accent?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

type Plate = { x: number; y: number; w: number; h: number };

type Edge = {
  a: number;
  i: number;
  j: number;
  curve: Curve;
  init: number;
  target: number;
};

type Layout = {
  w: number;
  h: number;
  narrow: boolean;
  D: number;
  SD: number;
  sheetW: number;
  sheetH: number;
  train: Point;
  held: Point;
  trainLabelY: number;
  heldLabelY: number;
  xs: number[];
  ys: number[][];
  cy: number;
  r: number;
  plates: Plate[];
  labelY: number;
  edges: Edge[];
  classX: number;
  barW: number;
};

const buildLayout = (width: number, layers: readonly number[]): Layout => {
  const narrow = width < 480;
  const plate = narrow ? 4 : 5;
  const step = narrow ? 4 : 5;
  const sheetW = Math.round(narrow ? 64 : clamp(0.15 * width, 76, 100));
  const sheetH = Math.round(sheetW * (narrow ? 0.64 : 0.68));
  const rows = Math.max(...layers);
  const rowGap = narrow ? 36 : 44;
  const nodeR = narrow ? 5.5 : 6.5;
  const padV = narrow ? 16 : 20;
  const plateW = narrow ? 22 : 28;

  let height: number;
  let train: Point;
  let held: Point;
  let left: number;
  let cy: number;

  if (narrow) {
    const top = 4 + 3 * step;
    train = [2 + sheetW / 2, top + sheetH / 2];
    held = [2 + 1.5 * sheetW + 3 * step + 28, top + sheetH / 2];
    cy = Math.round(top + sheetH + 40 + 34 + ((rows - 1) / 2) * rowGap + padV);
    left = plateW / 2 + 4;
    height = Math.round(cy + ((rows - 1) / 2) * rowGap + padV + 30);
  } else {
    height = 316;
    const stack = 3 * step + sheetH + 40;
    const gap = (height - 2 * stack) / 3;
    train = [2 + sheetW / 2, gap + 3 * step + sheetH / 2];
    held = [2 + sheetW / 2, 2 * gap + stack + 2 * step + sheetH / 2];
    left = 2 + sheetW + 3 * step + clamp(0.1 * width, 44, 80);
    cy = Math.round(height / 2 - 10);
  }

  const span = width - (narrow ? 78 : 112);
  const xs = [0, 1, 2, 3].map((index) => left + ((span - left) * index) / 3);
  const ys = layers.map((count) =>
    Array.from({ length: count }, (_, index) => cy + (index - (count - 1) / 2) * rowGap),
  );
  const plates: Plate[] = layers.map((count, index) => ({
    x: xs[index] - plateW / 2,
    y: cy - ((count - 1) / 2) * rowGap - padV,
    w: plateW,
    h: (count - 1) * rowGap + 2 * padV,
  }));
  const labelY = cy + ((rows - 1) / 2) * rowGap + padV + 20;

  const edges: Edge[] = [];
  let seed = 0;
  for (let layer = 0; layer < 3; layer += 1) {
    for (let from = 0; from < layers[layer]; from += 1) {
      for (let to = 0; to < layers[layer + 1]; to += 1) {
        const start: Point = [xs[layer] + nodeR + 1, ys[layer][from]];
        const end: Point = [xs[layer + 1] - nodeR - 1, ys[layer + 1][to]];
        const bend = (end[0] - start[0]) * 0.5;
        const init = 0.2 + 0.16 * noise(3 * seed + 1);
        const roll = noise(7 * seed + 5);
        const target = roll > 0.72 ? 0.78 + 0.22 * noise(seed + 11) : 0.06 + 0.3 * roll;
        edges.push({
          a: layer,
          i: from,
          j: to,
          curve: [start, [start[0] + bend, start[1]], [end[0] - bend, end[1]], end],
          init,
          target,
        });
        seed += 1;
      }
    }
  }

  const classX = xs[3] + plateW / 2 + step + (narrow ? 7 : 10);

  return {
    w: width,
    h: height,
    narrow,
    D: step,
    SD: step,
    sheetW,
    sheetH,
    train,
    held,
    trainLabelY: train[1] + sheetH / 2 + 18,
    heldLabelY: held[1] + sheetH / 2 + 18,
    xs,
    ys,
    cy,
    r: nodeR,
    plates,
    labelY,
    edges,
    classX,
    barW: Math.max(40, Math.min(84, width - classX - 4)),
  };
};

type Chart = {
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  pts: Point[];
  cum: number[];
  d: string;
};

const buildChart = (width: number, from: number, to: number): Chart => {
  const right = width - 10;
  const scale = 1.08 * Math.max(from, to);
  const pts: Point[] = [];
  for (let index = 0; index <= 72; index += 1) {
    const t = index / 72;
    pts.push([2 + t * (right - 2), 10 + (1 - lossAt(t, from, to) / scale) * 82]);
  }
  const lengths = [0];
  for (let index = 1; index < pts.length; index += 1) {
    lengths.push(
      lengths[index - 1] +
        Math.hypot(pts[index][0] - pts[index - 1][0], pts[index][1] - pts[index - 1][1]),
    );
  }
  const total = lengths[lengths.length - 1] || 1;
  return {
    w: width,
    h: 112,
    left: 2,
    right,
    top: 10,
    bottom: 92,
    pts,
    cum: lengths.map((value) => value / total),
    d: pts.map((point, index) => `${index ? "L" : "M"}${n2(point[0])} ${n2(point[1])}`).join(""),
  };
};

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

type Bucket = {
  edge: (SVGPathElement | null)[];
  grad: (SVGPathElement | null)[];
  dot: (SVGCircleElement | null)[];
  act: (SVGCircleElement | null)[][];
  ring: (SVGCircleElement | null)[][];
  sheet: (SVGGElement | null)[];
  heldSheet: (SVGGElement | null)[];
  outVal: (SVGTextElement | null)[];
  outBar: (SVGRectElement | null)[];
  outRow: (SVGGElement | null)[];
  stats: HTMLDivElement | null;
  loss: HTMLSpanElement | null;
  lossMeta: HTMLSpanElement | null;
  epoch: HTMLSpanElement | null;
  line: SVGPathElement | null;
  head: SVGCircleElement | null;
  val: SVGGElement | null;
  evalRow: HTMLDivElement | null;
  acc: HTMLSpanElement | null;
  spin: SVGCircleElement | null;
  check: SVGPathElement | null;
  step: (HTMLButtonElement | null)[];
  stepFill: (HTMLSpanElement | null)[];
  caption: HTMLSpanElement | null;
  captionStage: HTMLSpanElement | null;
};

type Clock = {
  time: number;
  rate: number;
  rateV: number;
  frame: number;
  running: boolean;
  visible: boolean;
  started: boolean;
  atStill: boolean;
  ticked: boolean;
  cache: Map<Element, Record<string, string>>;
};

type SceneRef = {
  g: Layout | null;
  chart: Chart | null;
  hold: boolean;
  goal: number;
  reduced: boolean;
  captions: readonly string[];
  stepNames: readonly string[];
  lossFrom: number;
  lossTo: number;
  accuracy: number;
  epochCount: number;
  nm: Required<ModelTrainingLabels>;
};

const DEFAULT_LABELS: Required<ModelTrainingLabels> = {
  training: "Training set",
  heldOut: "Held-out set",
  unit: "reviews",
  input: "Input",
  hidden: "Hidden",
  output: "Output",
  loss: "Loss",
  epoch: "Epoch",
  evaluation: "Evaluation",
  waiting: "Waiting",
  running: "Running",
  passed: "Passed",
  noBatch: "Waiting for a batch",
};

export function ModelTraining({
  classes = CLASSES as [string, string],
  inputs = 3,
  hidden = [4, 4],
  samples = 12800,
  heldOutSamples = 1600,
  batchSize = 32,
  epochs = 12,
  lossFrom = 0.69,
  lossTo = 0.08,
  accuracy = 94.2,
  target = 90,
  labels,
  steps = STEPS,
  defaultStep,
  caption = true,
  controls = true,
  speed = 1,
  paused = false,
  accent,
  label,
  className,
  style,
}: ModelTrainingProps) {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readReducedMotionOnServer,
  );

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const [stageWidth, setStageWidth] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);

  const names = useMemo<Required<ModelTrainingLabels>>(
    () => ({
      training: labels?.training ?? DEFAULT_LABELS.training,
      heldOut: labels?.heldOut ?? DEFAULT_LABELS.heldOut,
      unit: labels?.unit ?? DEFAULT_LABELS.unit,
      input: labels?.input ?? DEFAULT_LABELS.input,
      hidden: labels?.hidden ?? DEFAULT_LABELS.hidden,
      output: labels?.output ?? DEFAULT_LABELS.output,
      loss: labels?.loss ?? DEFAULT_LABELS.loss,
      epoch: labels?.epoch ?? DEFAULT_LABELS.epoch,
      evaluation: labels?.evaluation ?? DEFAULT_LABELS.evaluation,
      waiting: labels?.waiting ?? DEFAULT_LABELS.waiting,
      running: labels?.running ?? DEFAULT_LABELS.running,
      passed: labels?.passed ?? DEFAULT_LABELS.passed,
      noBatch: labels?.noBatch ?? DEFAULT_LABELS.noBatch,
    }),
    [labels],
  );

  const classNames: [string, string] = [classes[0] ?? CLASSES[0], classes[1] ?? CLASSES[1]];

  const layerKey = [
    clamp(Math.round(inputs), 2, 5),
    clamp(Math.round(hidden[0] ?? 4), 2, 6),
    clamp(Math.round(hidden[1] ?? 4), 2, 6),
    2,
  ].join(",");
  const layers = useMemo(() => layerKey.split(",").map(Number), [layerKey]);

  const stepNames = useMemo(() => STEPS.map((step, index) => steps[index] ?? step), [steps]);
  const epochCount = Math.max(1, Math.round(epochs));

  const layout = useMemo(
    () => (stageWidth > 0 ? buildLayout(stageWidth, layers) : null),
    [stageWidth, layers],
  );

  const chart = useMemo(
    () => (chartWidth > 0 ? buildChart(chartWidth, lossFrom, lossTo) : null),
    [chartWidth, lossFrom, lossTo],
  );

  const captions = useMemo(
    () => [
      `A batch of ${batchSize} labeled ${names.unit} leaves the training set. Each feature feeds one input.`,
      "Signals flow forward through each layer and the network guesses a label.",
      "The error flows backward and nudges every weight, strengthening the connections that helped.",
      `Batch after batch for ${epochCount} epochs, the loss falls from ${lossFrom.toFixed(2)} to ${lossTo.toFixed(2)}.`,
      `The ${names.heldOut.toLowerCase()} was never trained on. It scores ${accuracy.toFixed(1)}%, above the ${target}% target, so the model passes.`,
    ],
    [batchSize, names.unit, names.heldOut, epochCount, lossFrom, lossTo, accuracy, target],
  );

  const bucket = useRef<Bucket>({
    edge: [],
    grad: [],
    dot: [],
    act: [[], [], [], []],
    ring: [[], [], [], []],
    sheet: [],
    heldSheet: [],
    outVal: [],
    outBar: [],
    outRow: [],
    stats: null,
    loss: null,
    lossMeta: null,
    epoch: null,
    line: null,
    head: null,
    val: null,
    evalRow: null,
    acc: null,
    spin: null,
    check: null,
    step: [],
    stepFill: [],
    caption: null,
    captionStage: null,
  }).current;

  const activeStep = clamp(Math.round(defaultStep ?? 0), 0, 4);

  const clock = useRef<Clock>({
    time: activeStep === 0 ? 0 : STEP_STARTS[activeStep],
    rate: Number.NaN,
    rateV: 0,
    frame: 0,
    running: false,
    visible: true,
    started: false,
    atStill: false,
    ticked: false,
    cache: new Map(),
  }).current;

  const hold = paused || !playing || speed === 0;
  const goalRate = speed * (hovered ? 0.6 : 1);

  const scene = useRef<SceneRef>({
    g: layout,
    chart,
    hold,
    goal: goalRate,
    reduced,
    captions,
    stepNames,
    lossFrom,
    lossTo,
    accuracy,
    epochCount,
    nm: names,
  });

  useLayoutEffect(() => {
    scene.current = {
      g: layout,
      chart,
      hold,
      goal: goalRate,
      reduced,
      captions,
      stepNames,
      lossFrom,
      lossTo,
      accuracy,
      epochCount,
      nm: names,
    };
  });

  /** Attribute writer: skips unchanged values, writes text nodes in place. */
  const put = useCallback((el: Element | null, key: string, value: string) => {
    if (!el) return;
    const cache = clock.cache;
    let entry = cache.get(el);
    if (!entry) {
      entry = {};
      cache.set(el, entry);
    }
    if (entry[key] === value) return;
    entry[key] = value;
    if (key === "text") {
      const first = el.firstChild;
      if (first && first.nodeType === 3 && !first.nextSibling) (first as CharacterData).data = value;
      else el.textContent = value;
      return;
    }
    if (key.startsWith("--")) {
      (el as HTMLElement).style.setProperty(key, value);
      return;
    }
    el.setAttribute(key, value);
  }, [clock]);

  const draw = useCallback(
    (rawTime: number) => {
      const { g: geo, chart: plot, lossFrom: from, lossTo: to, accuracy: acc, epochCount: epochsTotal, nm, captions: lines, stepNames: labelsForSteps } =
        scene.current;
      const els = bucket;
      const time = wrap(rawTime, CYCLE);
      const index = stepIndexAt(time);
      const intro = time < INTRO_END;
      const opening = intro && time < 0.35;

      const trainingProgress = (() => {
        if (time < INTRO_END) return 1;
        let progress = 0.03 * smoothstep(backward[0][0].s + 0.1, backward[0][0].s + backward[0][0].d, time);
        for (let batch = 0; batch < 5; batch += 1) {
          const start = 9.2 + 1.35 * batch;
          progress += 0.194 * smoothstep(start + 1.04, start + 1.04 + 0.66, time);
        }
        return progress;
      })();

      const settled = !intro && time >= BACKPROP_START;
      let positive = 0.5;
      if (intro) positive = 0.5 + 0.47 * (1 - smoothstep(0.05, 0.75, time));
      else {
        positive = 0.5 + 0.02 * smoothstep(BACKPROP_START, BACKPROP_START + 0.3, time) + 0.42 * trainingProgress;
        const evaluate = EVAL_WINDOW[1];
        positive += (0.97 - positive) * smoothstep(evaluate, evaluate + 0.3, time);
      }

      if (geo) {
        const strength = [0, 1, 2].map((layer) => {
          if (time < INTRO_END) return 1 - smoothstep(0.05, 0.75, time);
          let value = 0.12 * smoothstep(backward[layer][0].s + 0.1, backward[layer][0].s + backward[layer][0].d, time);
          for (let batch = 1; batch <= 5; batch += 1) {
            const span = backward[layer][batch];
            value += 0.176 * smoothstep(span.s, span.s + span.d, time);
          }
          return value;
        });

        geo.edges.forEach((edge, edgeIndex) => {
          const weight = edge.init + (edge.target - edge.init) * strength[edge.a];
          put(els.edge[edgeIndex], "stroke-width", n2(0.6 + 1.7 * weight));
          put(els.edge[edgeIndex], "stroke-opacity", n2(0.3 + 0.7 * weight));
          put(els.edge[edgeIndex], "--k", n2(clamp((weight - 0.55) / 0.35)));

          const base = 0.45 + 0.55 * weight;
          const outbound = activeSpan(forward[edge.a], time);
          if (outbound) {
            const t = (time - outbound.s) / outbound.d;
            const point = bezier(edge.curve, smootherstep(t));
            put(els.dot[edgeIndex], "transform", `translate(${n2(point[0])} ${n2(point[1])})`);
            put(els.dot[edgeIndex], "opacity", n2(base * fadeWindow(t)));
          } else put(els.dot[edgeIndex], "opacity", "0");

          const inbound = activeSpan(backward[edge.a], time);
          if (inbound) {
            const t = (time - inbound.s) / inbound.d;
            put(els.grad[edgeIndex], "stroke-dashoffset", (-(1 - 1.2 * smootherstep(t))).toFixed(4));
            put(els.grad[edgeIndex], "opacity", n2(base * fadeWindow(t)));
          } else put(els.grad[edgeIndex], "opacity", "0");
        });

        const confidence = clamp((positive - 0.56) / 0.3);
        for (let layer = 0; layer < 4; layer += 1) {
          const pulse = sinceLast(forwardEnds[layer], time, 0.7);
          const lit = pulse >= 0 ? Math.min(1, pulse / 0.12) * (1 - pulse) ** 1.5 : 0;
          const ringProgress = sinceLast(backwardEnds[layer], time, 0.6);
          for (let node = 0; node < geo.ys[layer].length; node += 1) {
            const winner = layer === 3 && node === 0 ? 0.85 * confidence : 0;
            put(els.act[layer][node], "opacity", n2(Math.max(winner, 0.9 * clamp(lit))));
            if (ringProgress >= 0) {
              put(els.ring[layer][node], "r", n2(geo.r + 7 * easeOutCubic(ringProgress)));
              put(els.ring[layer][node], "opacity", n2(0.7 * (1 - ringProgress) ** 2));
            } else put(els.ring[layer][node], "opacity", "0");
          }
        }

        const anchor: Point = [geo.xs[0], geo.cy];
        const stack = (
          sheetEls: (SVGGElement | null)[],
          spans: readonly Span[],
          fromPoint: Point,
          trail: number,
          lift: number,
        ) => {
          let total = 0;
          for (const span of spans) total += smoothstep(span.s, span.s + span.d, time);
          if (intro) total = 0;
          const offset = total - Math.floor(total);
          const curve: Curve = geo.narrow
            ? [fromPoint, [fromPoint[0], fromPoint[1] + 70], [anchor[0] + 30, anchor[1] - 80], anchor]
            : [
                fromPoint,
                [fromPoint[0] + 60, fromPoint[1] + lift],
                [anchor[0] - 40, anchor[1] + 0.6 * lift],
                anchor,
              ];
          sheetEls.forEach((el, order) => {
            const lag = order - offset;
            if (lag < 0) {
              const t = -lag;
              const point = bezier(curve, t);
              put(el, "transform", `translate(${n2(point[0])} ${n2(point[1])}) scale(${(1 - 0.66 * t).toFixed(3)})`);
              put(el, "opacity", n2(1 - smoothstep(0.55, 0.98, t)));
              put(el, "data-front", "true");
            } else {
              const x = fromPoint[0] + lag * geo.SD;
              const y = fromPoint[1] - lag * geo.SD;
              put(el, "transform", `translate(${n2(x)} ${n2(y)})`);
              put(el, "opacity", n2(lag > trail ? clamp(trail + 1 - lag) : 1));
              put(el, "data-front", lag < 0.5 ? "true" : "false");
            }
          });
        };

        stack(els.sheet, batches, geo.train, 3, geo.narrow ? 0 : -34);
        stack(els.heldSheet, [heldOutBatch], geo.held, 2, geo.narrow ? 0 : 30);

        const shares = [positive, 1 - positive];
        for (let row = 0; row < 2; row += 1) {
          put(els.outVal[row], "text", shares[row].toFixed(2));
          put(els.outBar[row], "width", n2(Math.max(0.5, geo.barW * shares[row])));
          put(els.outRow[row], "data-win", row === 0 && confidence > 0.5 ? "true" : "false");
        }
      }

      const lossValue = lossAt(trainingProgress, from, to);
      const statsOpacity = intro
        ? time < 0.35
          ? 1 - smoothstep(0, 0.35, time)
          : 0.4 * smoothstep(0.35, 0.8, time)
        : settled
          ? 0.4 + 0.6 * smoothstep(BACKPROP_START, BACKPROP_START + 0.3, time)
          : 0.4;

      put(els.stats, "--o", n2(statsOpacity));
      put(els.loss, "text", opening ? to.toFixed(2) : settled ? lossValue.toFixed(2) : from.toFixed(2));
      put(
        els.lossMeta,
        "text",
        opening || settled ? `Started at ${from.toFixed(2)}` : nm.noBatch,
      );
      put(
        els.epoch,
        "text",
        opening ? String(epochsTotal) : settled ? String(Math.max(1, Math.ceil(epochsTotal * trainingProgress - 1e-6))) : "0",
      );

      if (plot) {
        const eased = clamp(trainingProgress) * (plot.pts.length - 1);
        const at = Math.min(plot.pts.length - 2, Math.floor(eased));
        const frac = eased - at;
        const point = lerp(plot.pts[at], plot.pts[at + 1], frac);
        const along = plot.cum[at] + (plot.cum[at + 1] - plot.cum[at]) * frac;
        const lineOpacity = intro ? 1 - smoothstep(0, 0.5, time) : settled ? smoothstep(BACKPROP_START, BACKPROP_START + 0.25, time) : 0;

        put(els.line, "stroke-dasharray", `${Math.max(0.0005, along).toFixed(4)} 2`);
        put(els.line, "opacity", n2(lineOpacity));
        put(els.head, "transform", `translate(${n2(point[0])} ${n2(point[1])})`);

        const headFade = intro ? 1 - smoothstep(0, 0.5, time) : smoothstep(19.15, 19.5, time);
        put(els.head, "opacity", n2(lineOpacity * (1 - headFade)));
        put(els.val, "opacity", n2(headFade));
      }

      const state = opening ? "passed" : intro || time < 16.55 ? "waiting" : time < 19.15 ? "running" : "passed";
      put(els.evalRow, "data-state", state);
      put(
        els.evalRow,
        "--o",
        n2(intro ? (time < 0.35 ? 1 - smoothstep(0, 0.35, time) : smoothstep(0.35, 0.8, time)) : 1),
      );

      const shown =
        state === "passed"
          ? acc
          : state === "running"
            ? acc * easeOutCubic((time - EVAL_WINDOW[0]) / (EVAL_WINDOW[1] - EVAL_WINDOW[0]))
            : 0;
      put(els.acc, "text", state === "waiting" ? "" : `${shown.toFixed(1)}%`);
      if (state === "running") put(els.spin, "transform", `rotate(${n2((360 * time) % 360)} 12 12)`);
      put(els.check, "stroke-dashoffset", n2(opening ? 0 : 1 - smoothstep(19.15, 19.55, time)));

      for (let step = 0; step < 5; step += 1) {
        const stepState = step < index ? "done" : step === index ? "current" : "todo";
        const end = step < 4 ? STEP_STARTS[step + 1] : CYCLE;
        const start = step === 0 ? 0.8 : STEP_STARTS[step];
        const fill =
          intro && !scene.current.hold && false
            ? 0
            : intro && !clock.atStill
              ? 1 - smootherstep(time / 0.8)
              : step < index
                ? 1
                : step > index
                  ? 0
                  : clock.atStill
                    ? 1
                    : clamp((time - start) / (end - start));
        put(els.step[step], "data-state", stepState);
        put(els.step[step], "aria-current", stepState === "current" ? "step" : "false");
        put(els.stepFill[step], "--s", n2(fill));
      }

      put(els.caption, "text", lines[index] ?? "");
      put(els.captionStage, "text", `${labelsForSteps[index] ?? ""}. `);
    },
    [bucket, clock, put],
  );

  const start = useCallback(() => {
    const state = clock;
    if (state.running || !state.visible || scene.current.hold || scene.current.reduced) return;
    state.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      const { hold: holding, reduced: still, goal } = scene.current;
      if (holding || still || !state.visible) {
        state.running = false;
        return;
      }
      const delta = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (Number.isNaN(state.rate)) state.rate = goal;
      state.rateV += (40 * (goal - state.rate) - 2 * Math.sqrt(40) * state.rateV) * delta;
      state.rate += state.rateV * delta;
      state.time += delta * state.rate;
      state.atStill = false;
      state.ticked = true;
      draw(state.time);
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
  }, [clock, draw]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const plot = chartRef.current;
    if (!stage || !plot) return;
    const measure = () => {
      setStageWidth(Math.floor(stage.clientWidth));
      setChartWidth(Math.floor(plot.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const state = clock;
    state.cache = new Map();
    const fallback = defaultStep === undefined ? 4 : activeStep;
    if (!state.started && (hold || reduced)) {
      state.time = STEP_STILLS[fallback];
      state.atStill = true;
    }
    state.started = true;
    if (reduced && !state.atStill) {
      state.time = state.ticked
        ? STEP_STILLS[stepIndexAt(wrap(state.time, CYCLE))]
        : STEP_STILLS[fallback];
      state.atStill = true;
    }
    draw(state.time);
    start();
  }, [reduced, hold, goalRate, layout, chart, captions, stepNames, draw, start, defaultStep, activeStep, clock]);

  useEffect(() => {
    const figure = rootRef.current;
    const state = clock;
    if (!figure) return;
    const observer = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting && !document.hidden;
      if (state.visible) start();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    });
    const onVisibility = () => {
      state.visible = !document.hidden;
      if (state.visible) start();
      else {
        cancelAnimationFrame(state.frame);
        state.running = false;
      }
    };
    observer.observe(figure);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [clock, start]);

  const description =
    label ??
    `Model training. Batches of ${batchSize} labeled ${names.unit} feed a small neural network with ${layers[0]} inputs, two hidden layers and a ${classNames[0].toLowerCase()} or ${classNames[1].toLowerCase()} output. Signals flow forward to a prediction, the error flows backward and strengthens the useful connections, and over ${epochCount} epochs the loss falls from ${lossFrom.toFixed(2)} to ${lossTo.toFixed(2)}. A held-out set then scores ${accuracy.toFixed(1)}% against a ${target}% target and the evaluation passes.`;

  const rootStyle: CSSProperties = {
    ...(accent ? ({ "--mt-accent": accent } as CSSProperties) : null),
    ...style,
  };

  const hover = (key: string) => ({
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType === "mouse") setHovered(key);
    },
    onPointerLeave: () => setHovered((current) => (current === key ? null : current)),
  });

  let tag: { text: string; x: number; y: number; align: string } | null = null;
  if (layout && hovered) {
    if (hovered === "train") {
      tag = {
        text: `${withThousands(samples)} labeled ${names.unit}, batches of ${batchSize}`,
        x: layout.train[0] - layout.sheetW / 2,
        y: layout.trainLabelY + (layout.narrow ? 42 : 40),
        align: "start",
      };
    } else if (hovered === "held") {
      tag = {
        text: `${withThousands(heldOutSamples)} ${names.unit} it never trains on`,
        x: layout.narrow
          ? layout.held[0] + layout.sheetW / 2 + 3 * layout.SD
          : layout.held[0] - layout.sheetW / 2,
        y: layout.narrow
          ? layout.heldLabelY + 42
          : layout.held[1] - layout.sheetH / 2 - 2 * layout.SD - 8,
        align: layout.narrow ? "end" : "start",
      };
    } else {
      const layer = Number(hovered.slice(1));
      tag = {
        text:
          layer === 0
            ? `${layers[0]} features per sample`
            : layer === 3
              ? `Softmax over ${classNames[0].toLowerCase()} and ${classNames[1].toLowerCase()}`
              : `${layers[layer]} units, ReLU, ${layers[layer - 1] * layers[layer]} weights in`,
        x: layout.xs[layer],
        y: layout.plates[layer].y - layout.D - 8,
        align: layer === 3 ? "end" : layer === 0 && layout.narrow ? "start" : "center",
      };
      if (tag.align === "end") tag.x = layout.xs[layer] + layout.plates[layer].w / 2;
      if (tag.align === "start") tag.x = layout.xs[layer] - layout.plates[layer].w / 2;
    }
  }

  const sheet = (index: number, isHeldOut: boolean) => {
    if (!layout) return null;
    const width = layout.sheetW;
    const height = layout.sheetH;
    const x = -width / 2;
    const y = -height / 2;
    const bars = Array.from({ length: layers[0] }, (_, bar) => ({
      y: y + ((bar + 1) / (layers[0] + 1)) * height,
      w: (width - 22) * [0.78, 0.92, 0.56, 0.7, 0.84][bar],
    }));
    return (
      <g
        ref={(node) => {
          (isHeldOut ? bucket.heldSheet : bucket.sheet)[index] = node;
        }}
        className={styles.sheet}
        data-held={isHeldOut || undefined}
        opacity={0}
        key={`${isHeldOut ? "h" : "t"}-${index}`}
      >
        <rect
          className={styles.sheetRect}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={layout.narrow ? 6 : 9}
        />
        {bars.map((bar, barIndex) => (
          <rect
            key={barIndex}
            className={barIndex === 0 ? styles.sheetBarStrong : styles.sheetBar}
            x={x + 11}
            y={bar.y - 1.75}
            width={bar.w}
            height={3.5}
            rx={1.75}
          />
        ))}
      </g>
    );
  };

  return (
    <figure
      ref={(node) => {
        rootRef.current = node;
      }}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-ready={(layout && chart ? true : undefined) || undefined}
    >
      <div className={styles.body}>
        <div className={styles.diagram} role="img" aria-label={description}>
          <div
            ref={stageRef}
            className={styles.stage}
            data-hover={hovered ?? undefined}
            style={layout ? { height: layout.h } : undefined}
          >
            {layout && (
              <svg
                className={styles.svg}
                viewBox={`0 0 ${layout.w} ${layout.h}`}
                width={layout.w}
                height={layout.h}
                aria-hidden="true"
              >
                {layout.plates.map((plate, index) => (
                  <g className={styles.plate} data-on={hovered === `l${index}` || undefined} key={`plate-${index}`}>
                    <rect
                      className={styles.back}
                      x={plate.x + layout.D}
                      y={plate.y - layout.D}
                      width={plate.w}
                      height={plate.h}
                      rx={plate.w / 2}
                    />
                    <rect
                      className={styles.face}
                      x={plate.x}
                      y={plate.y}
                      width={plate.w}
                      height={plate.h}
                      rx={plate.w / 2}
                    />
                  </g>
                ))}
                {layout.edges.map((edge, index) => (
                  <path
                    key={`edge-${index}`}
                    ref={(node) => {
                      bucket.edge[index] = node;
                    }}
                    className={styles.edge}
                    data-a={edge.a}
                    data-b={edge.a + 1}
                    d={pathOf(edge.curve)}
                    strokeWidth={0.6 + 1.7 * edge.init}
                    strokeOpacity={0.3 + 0.7 * edge.init}
                  />
                ))}
                {layout.edges.map((edge, index) => (
                  <path
                    key={`grad-${index}`}
                    ref={(node) => {
                      bucket.grad[index] = node;
                    }}
                    className={styles.grad}
                    d={pathOf(edge.curve)}
                    pathLength={1}
                    strokeDasharray="0.2 2"
                    strokeDashoffset={-1}
                    opacity={0}
                  />
                ))}
                {layout.edges.map((edge, index) => (
                  <circle
                    key={`dot-${index}`}
                    ref={(node) => {
                      bucket.dot[index] = node;
                    }}
                    className={styles.dot}
                    r={layout.narrow ? 2.5 : 3}
                    opacity={0}
                  />
                ))}
                {layout.ys.map((column, layer) =>
                  column.map((cy, node) => (
                    <g key={`node-${layer}-${node}`}>
                      <circle
                        ref={(el) => {
                          bucket.ring[layer][node] = el;
                        }}
                        className={styles.ring}
                        cx={layout.xs[layer]}
                        cy={cy}
                        r={layout.r}
                        opacity={0}
                      />
                      <circle className={styles.node} cx={layout.xs[layer]} cy={cy} r={layout.r} />
                      <circle
                        ref={(el) => {
                          bucket.act[layer][node] = el;
                        }}
                        className={styles.act}
                        cx={layout.xs[layer]}
                        cy={cy}
                        r={layout.r - 2}
                        opacity={0}
                      />
                    </g>
                  )),
                )}
                {layout.xs.map((x, layer) => (
                  <text
                    key={`lab-${layer}`}
                    className={styles.layerLabel}
                    x={x}
                    y={layout.labelY}
                    textAnchor="middle"
                  >
                    {layer === 0 ? names.input : layer === 3 ? names.output : names.hidden}
                  </text>
                ))}
                {classNames.map((name, index) => {
                  const cy = layout.ys[3][index];
                  return (
                    <g
                      key={`out-${index}`}
                      ref={(el) => {
                        bucket.outRow[index] = el;
                      }}
                      className={styles.outRow}
                      data-win="false"
                    >
                      <text className={styles.outName} x={layout.classX} y={layout.narrow ? cy - 4 : cy - 5}>
                        {name}
                      </text>
                      <text
                        ref={(el) => {
                          bucket.outVal[index] = el;
                        }}
                        className={styles.outVal}
                        x={layout.narrow ? layout.classX : layout.classX + layout.barW}
                        y={layout.narrow ? cy + 11 : cy - 5}
                        textAnchor={layout.narrow ? "start" : "end"}
                      >
                        0.50
                      </text>
                      {!layout.narrow && (
                        <>
                          <rect
                            className={styles.outTrack}
                            x={layout.classX}
                            y={cy + 3}
                            width={layout.barW}
                            height={3}
                            rx={1.5}
                          />
                          <rect
                            ref={(el) => {
                              bucket.outBar[index] = el;
                            }}
                            className={styles.outBar}
                            x={layout.classX}
                            y={cy + 3}
                            width={layout.barW / 2}
                            height={3}
                            rx={1.5}
                          />
                        </>
                      )}
                    </g>
                  );
                })}
                <text
                  className={styles.stackName}
                  x={layout.train[0] - layout.sheetW / 2}
                  y={layout.trainLabelY}
                >
                  {names.training}
                </text>
                <text
                  className={styles.stackMeta}
                  x={layout.train[0] - layout.sheetW / 2}
                  y={layout.trainLabelY + 15}
                >
                  {`${withThousands(samples)} ${names.unit}`}
                </text>
                <text
                  className={styles.stackName}
                  x={layout.held[0] - layout.sheetW / 2}
                  y={layout.heldLabelY}
                >
                  {names.heldOut}
                </text>
                <text
                  className={styles.stackMeta}
                  x={layout.held[0] - layout.sheetW / 2}
                  y={layout.heldLabelY + 15}
                >
                  {`${withThousands(heldOutSamples)} ${names.unit}`}
                </text>
                {[3, 2, 1, 0].map((index) => sheet(index, true))}
                {[4, 3, 2, 1, 0].map((index) => sheet(index, false))}
                <rect
                  className={styles.hit}
                  x={layout.train[0] - layout.sheetW / 2 - 2}
                  y={layout.train[1] - layout.sheetH / 2 - 3 * layout.SD}
                  width={layout.sheetW + 3 * layout.SD + 4}
                  height={layout.sheetH + 3 * layout.SD + 40}
                  {...hover("train")}
                />
                <rect
                  className={styles.hit}
                  x={layout.held[0] - layout.sheetW / 2 - 2}
                  y={layout.held[1] - layout.sheetH / 2 - 2 * layout.SD}
                  width={layout.sheetW + 3 * layout.SD + 4}
                  height={layout.sheetH + 2 * layout.SD + 40}
                  {...hover("held")}
                />
                {layout.plates.map((plate, index) => (
                  <rect
                    key={`hit-${index}`}
                    className={styles.hit}
                    x={plate.x - 12}
                    y={plate.y - layout.D - 4}
                    width={plate.w + layout.D + 24}
                    height={plate.h + layout.D + 8}
                    {...hover(`l${index}`)}
                  />
                ))}
              </svg>
            )}
            {tag && (
              <div
                key={hovered ?? undefined}
                className={styles.tagWrap}
                data-align={tag.align}
                style={{ transform: `translate(${n2(tag.x)}px, ${n2(tag.y)}px)` }}
              >
                <span className={styles.tag}>{tag.text}</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.panel} aria-hidden="true">
          <div
            ref={(el) => {
              bucket.stats = el;
            }}
            className={styles.stats}
          >
            <span className={styles.stat}>
              <span className={styles.statLabel}>{names.loss}</span>
              <span
                ref={(el) => {
                  bucket.loss = el;
                }}
                className={styles.statValue}
              >
                {lossFrom.toFixed(2)}
              </span>
              <span
                ref={(el) => {
                  bucket.lossMeta = el;
                }}
                className={styles.statMeta}
              >
                {names.noBatch}
              </span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>{names.epoch}</span>
              <span className={styles.statValue}>
                <span
                  ref={(el) => {
                    bucket.epoch = el;
                  }}
                >
                  0
                </span>
              </span>
              <span className={styles.statMeta}>of {epochCount}</span>
            </span>
          </div>
          <div ref={chartRef} className={styles.chart}>
            {chart && (
              <svg viewBox={`0 0 ${chart.w} ${chart.h}`} width={chart.w} height={chart.h}>
                {[0, 0.5, 1].map((fraction) => (
                  <line
                    key={fraction}
                    className={fraction === 1 ? styles.axis : styles.grid}
                    x1={chart.left}
                    x2={chart.right}
                    y1={chart.top + fraction * (chart.bottom - chart.top)}
                    y2={chart.top + fraction * (chart.bottom - chart.top)}
                  />
                ))}
                <text className={styles.tick} x={chart.left} y={chart.h - 4}>
                  1
                </text>
                <text className={styles.tick} x={chart.right} y={chart.h - 4} textAnchor="end">
                  {epochCount}
                </text>
                <path
                  ref={(el) => {
                    bucket.line = el;
                  }}
                  className={styles.line}
                  d={chart.d}
                  pathLength={1}
                  strokeDasharray="0.0005 2"
                  opacity={0}
                />
                <circle
                  ref={(el) => {
                    bucket.head = el;
                  }}
                  className={styles.head}
                  r={3.5}
                  opacity={0}
                />
                <g
                  ref={(el) => {
                    bucket.val = el;
                  }}
                  opacity={0}
                >
                  <circle
                    className={styles.valDot}
                    cx={chart.right}
                    cy={
                      chart.top +
                      (1 - (1.4 * lossTo) / (1.08 * Math.max(lossFrom, lossTo))) *
                        (chart.bottom - chart.top)
                    }
                    r={3.5}
                  />
                  <text
                    className={styles.valText}
                    x={chart.right - 8}
                    y={
                      chart.top +
                      (1 - (1.4 * lossTo) / (1.08 * Math.max(lossFrom, lossTo))) *
                        (chart.bottom - chart.top) -
                      7
                    }
                    textAnchor="end"
                  >
                    Val {(1.4 * lossTo).toFixed(2)}
                  </text>
                </g>
              </svg>
            )}
          </div>
          <div
            ref={(el) => {
              bucket.evalRow = el;
            }}
            className={styles.evalRow}
            data-state="waiting"
          >
            <svg className={styles.evalMark} viewBox="0 0 24 24">
              <circle className={styles.evalTrack} cx={12} cy={12} r={10.5} />
              <circle
                ref={(el) => {
                  bucket.spin = el;
                }}
                className={styles.evalSpin}
                cx={12}
                cy={12}
                r={10.5}
                pathLength={1}
                strokeDasharray="0.26 1"
              />
              <path
                ref={(el) => {
                  bucket.check = el;
                }}
                className={styles.evalCheck}
                d="M7.5 12.4l3 3 6-6.4"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1}
              />
            </svg>
            <span className={styles.evalText}>
              <span className={styles.evalName}>{names.evaluation}</span>
              <span className={styles.evalMeta}>Target {target}%</span>
            </span>
            <span className={styles.evalRight}>
              <span
                ref={(el) => {
                  bucket.acc = el;
                }}
                className={styles.evalValue}
              />
              <span className={styles.evalTags}>
                <span className={styles.evalTag} data-kind="waiting">
                  {names.waiting}
                </span>
                <span className={styles.evalTag} data-kind="running">
                  {names.running}
                </span>
                <span className={styles.evalTag} data-kind="passed">
                  {names.passed}
                </span>
              </span>
            </span>
          </div>
        </div>
      </div>
      {controls && (
        <div className={styles.controls}>
          {!reduced && (
            <button
              type="button"
              className={styles.play}
              onClick={() => {
                const state = clock;
                if (!playing && state.atStill) {
                  const time = wrap(state.time, CYCLE);
                  const index = stepIndexAt(time);
                  state.time = state.time - time + (index === 0 ? 0.8 : STEP_STARTS[index]);
                  state.atStill = false;
                }
                setPlaying((value) => !value);
              }}
              aria-label={playing && !paused ? "Pause the training run" : "Play the training run"}
            >
              {playing && !paused ? (
                <Pause aria-hidden="true" strokeWidth={1.75} />
              ) : (
                <Play aria-hidden="true" strokeWidth={1.75} />
              )}
            </button>
          )}
          <ol className={styles.steps} aria-label="Training stages">
            {stepNames.map((step, index) => (
              <li className={styles.stepItem} key={`${step}${index}`}>
                <button
                  type="button"
                  ref={(el) => {
                    bucket.step[index] = el;
                  }}
                  className={styles.step}
                  data-state={index === activeStep ? "current" : index < activeStep ? "done" : "todo"}
                  onClick={() => {
                    const state = clock;
                    const base = CYCLE * Math.floor(state.time / CYCLE);
                    const { hold: holding, reduced: still } = scene.current;
                    state.atStill = holding || still;
                    state.time = base + (state.atStill ? STEP_STILLS[index] : index === 0 ? 0.8 : STEP_STARTS[index]);
                    draw(state.time);
                  }}
                  aria-label={`Stage ${index + 1}, ${step}`}
                >
                  <span className={styles.stepLabel}>
                    <span className={styles.stepNumber}>{index + 1}</span>
                    <span className={styles.stepName}>{step}</span>
                  </span>
                  <span className={styles.track}>
                    <span
                      ref={(el) => {
                        bucket.stepFill[index] = el;
                      }}
                      className={styles.trackFill}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {caption && (
        <figcaption className={styles.caption} aria-hidden="true">
          <span>
            <span
              ref={(el) => {
                bucket.captionStage = el;
              }}
              className={styles.captionStage}
            />
            <span
              ref={(el) => {
                bucket.caption = el;
              }}
            >
              {captions[activeStep]}
            </span>
          </span>
        </figcaption>
      )}
    </figure>
  );
}

export default ModelTraining;
