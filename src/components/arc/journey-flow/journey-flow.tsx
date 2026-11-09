"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./journey-flow.module.css";

/* ------------------------------------------------------------------ data */

type NodeKind = "step" | "exit" | "goal";

interface FlowNode {
  id: string;
  name: string;
  /** Column in the five-stage layout. */
  col: number;
  kind: NodeKind;
  note: string;
}

const NODES: FlowNode[] = [
  { id: "visited", name: "Visited", col: 0, kind: "step", note: "Opened the product site in August" },
  { id: "signed-up", name: "Signed up", col: 1, kind: "step", note: "Created an account" },
  { id: "bounced", name: "Bounced", col: 1, kind: "exit", note: "Left without creating an account" },
  { id: "onboarded", name: "Onboarded", col: 2, kind: "step", note: "Finished the setup checklist" },
  { id: "dropped", name: "Dropped", col: 2, kind: "exit", note: "Left before setup was finished" },
  { id: "activated", name: "Activated", col: 3, kind: "step", note: "Shared a first project in week one" },
  { id: "stalled", name: "Stalled", col: 3, kind: "exit", note: "No second session in week one" },
  { id: "paid", name: "Paid", col: 4, kind: "goal", note: "Started a paid plan" },
  { id: "free", name: "Free", col: 4, kind: "exit", note: "Stayed on the free plan" },
];

const STAGES = ["Visit", "Account", "Setup", "First week", "Plan"];
const LAST_COLUMN = STAGES.length - 1;

interface Link {
  /** Index into NODES of the source and target. */
  s: number;
  t: number;
}

const LINKS: Link[] = [
  { s: 0, t: 1 },
  { s: 0, t: 2 },
  { s: 1, t: 3 },
  { s: 1, t: 4 },
  { s: 3, t: 5 },
  { s: 3, t: 6 },
  { s: 5, t: 7 },
  { s: 5, t: 8 },
  { s: 6, t: 7 },
  { s: 6, t: 8 },
];

interface Channel {
  id: string;
  label: string;
  /** Users on each link, in LINKS order. */
  values: number[];
}

const ACQUISITION: Channel[] = [
  { id: "organic", label: "Organic", values: [2863, 5563, 2172, 691, 1394, 778, 463, 931, 41, 737] },
  { id: "ads", label: "Paid ads", values: [1294, 4858, 823, 471, 409, 414, 148, 261, 9, 405] },
  { id: "referral", label: "Referral", values: [1118, 1269, 957, 161, 722, 235, 331, 391, 28, 207] },
];

const CHANNELS: Channel[] = [
  { id: "all", label: "All users", values: LINKS.map((_, index) => ACQUISITION.reduce((sum, channel) => sum + channel.values[index], 0)) },
  ...ACQUISITION,
];

const numberFormat = new Intl.NumberFormat("en-US");
const formatCount = (value: number) => numberFormat.format(Math.round(value));
const formatShare = (share: number) => `${(100 * share).toFixed(1)}%`;

/* -------------------------------------------------------------- geometry */

interface Totals {
  inSum: number[];
  outSum: number[];
  totals: number[];
}

/** Users arriving at and leaving each node, plus the larger of the two, which sizes the node. */
function totalsFor(values: number[]): Totals {
  const inSum = NODES.map(() => 0);
  const outSum = NODES.map(() => 0);
  LINKS.forEach((link, index) => {
    outSum[link.s] += values[index];
    inSum[link.t] += values[index];
  });
  return { inSum, outSum, totals: NODES.map((_, index) => Math.max(inSum[index], outSum[index])) };
}

interface StackedNode {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface StackedLink {
  x0: number;
  x1: number;
  sy: number;
  ty: number;
  w: number;
}

interface Layout {
  nodes: StackedNode[];
  links: StackedLink[];
}

/** Stack the nodes of each column top-down, then hang every band off its source and target offsets. */
function layoutFor(values: number[], width: number, height: number): Layout {
  const { totals } = totalsFor(values);
  const scale = Math.max(0, height - 40 - 34 - 44) / Math.max(1, totals[0]);
  const columnGap = Math.max(0, width - 8) / (STAGES.length - 1);
  const cursors = STAGES.map(() => 40);
  const nodes = NODES.map((node, index) => {
    const x0 = Math.round(node.col * columnGap);
    const y0 = cursors[node.col];
    const y1 = y0 + Math.max(2, totals[index] * scale);
    cursors[node.col] = y1 + 44;
    return { x0, x1: x0 + 8, y0, y1 };
  });
  const sourceOffsets = nodes.map(node => node.y0);
  const targetOffsets = nodes.map(node => node.y0);
  const links = LINKS.map((link, index) => {
    const w = values[index] * scale;
    const sy = sourceOffsets[link.s];
    const ty = targetOffsets[link.t];
    sourceOffsets[link.s] += w;
    targetOffsets[link.t] += w;
    return { x0: nodes[link.s].x1, x1: nodes[link.t].x0, sy, ty, w };
  });
  return { nodes, links };
}

/** A ribbon: two horizontal edges joined by mirrored cubic curves. */
function ribbonPath(x0: number, x1: number, sy: number, ty: number, w: number): string {
  const mid = (x0 + x1) / 2;
  return `M${x0.toFixed(2)} ${sy.toFixed(2)}C${mid.toFixed(2)} ${sy.toFixed(2)} ${mid.toFixed(2)} ${ty.toFixed(2)} ${x1.toFixed(2)} ${ty.toFixed(2)}V${(ty + w).toFixed(2)}C${mid.toFixed(2)} ${(ty + w).toFixed(2)} ${mid.toFixed(2)} ${(sy + w).toFixed(2)} ${x0.toFixed(2)} ${(sy + w).toFixed(2)}Z`;
}

const chartHeight = (width: number) => (width < 480 ? 340 : width < 720 ? 372 : 404);

const SPRING_VALUES = { ...motionTokens.spring.morph, visualDuration: 0.62 };
const SPRING_SHOWN = { ...motionTokens.spring.smooth, visualDuration: 0.62, delay: 0.06 };
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type Target = { kind: "link"; i: number } | { kind: "node"; i: number };

const sameTarget = (a: Target | null, b: Target | null) => !!a && !!b && a.kind === b.kind && a.i === b.i;
const nodeName = (index: number) => NODES[index].name.toLowerCase();

/** Count label beside a node: a share of visitors once there is room for it. */
function nodeCount(index: number, totals: number[], width: number): string {
  return width >= 600 && index > 0 ? `${formatCount(totals[index])} · ${Math.round((totals[index] / totals[0]) * 100)}%` : formatCount(totals[index]);
}

function nodeLabelTransform(index: number, node: StackedNode, width: number): string {
  const x = NODES[index].col === LAST_COLUMN ? node.x1 : node.x0;
  const y = width < 600 && NODES[index].id === "free" ? node.y1 + 34 : node.y0;
  return `translate(${x} ${y.toFixed(2)})`;
}

/**
 * Highlight every band that carries the hovered or selected cohort: forward from the target column
 * and backward from the source column, each step scaling by the share of users that keeps going.
 */
function traceShares(values: number[], target: Target | null): number[] {
  const shares = LINKS.map(() => 0);
  if (!target) return shares;
  const { inSum, outSum } = totalsFor(values);
  const forward = NODES.map(() => 0);
  const backward = NODES.map(() => 0);
  let fromColumn: number;
  let toColumn: number;
  if (target.kind === "node") {
    forward[target.i] = backward[target.i] = 1;
    fromColumn = toColumn = NODES[target.i].col;
  } else {
    const link = LINKS[target.i];
    shares[target.i] = 1;
    forward[link.t] = values[target.i] / (inSum[link.t] || 1);
    backward[link.s] = values[target.i] / (outSum[link.s] || 1);
    fromColumn = NODES[link.t].col;
    toColumn = NODES[link.s].col;
  }
  for (let column = fromColumn + 1; column < STAGES.length; column++) {
    NODES.forEach((node, index) => {
      if (node.col !== column) return;
      LINKS.forEach((link, linkIndex) => {
        if (link.t === index) forward[index] += (values[linkIndex] / (inSum[index] || 1)) * forward[link.s];
      });
    });
  }
  for (let column = toColumn - 1; column >= 0; column--) {
    NODES.forEach((node, index) => {
      if (node.col !== column) return;
      LINKS.forEach((link, linkIndex) => {
        if (link.s === index) backward[index] += (values[linkIndex] / (outSum[index] || 1)) * backward[link.t];
      });
    });
  }
  LINKS.forEach((link, index) => {
    if (NODES[link.s].col >= fromColumn) shares[index] = forward[link.s];
    else if (NODES[link.t].col <= toColumn) shares[index] = backward[link.t];
  });
  return shares;
}

/* ------------------------------------------------------------ fragments */

/** Text that swaps with a short rise, keeping its footprint while the old copy leaves. */
function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className={className ?? styles.swap}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }}
        transition={reduced ? { duration: motionTokens.duration.fast } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * Digits roll in place: the rendered width is measured from a hidden copy and the strip translates
 * so the new digit lands on the same baseline. Punctuation fades instead.
 */
function RollingNumber({ value, className }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  const chars = Array.from(value);
  const sizer = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const node = sizer.current;
    if (!node) return;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span className={[styles.rolling, className].filter(Boolean).join(" ")}>
      <span className={styles.srOnly}>{value}</span>
      <span ref={sizer} className={styles.sizer} aria-hidden="true">
        {value}
      </span>
      <motion.span
        className={styles.glyphs}
        aria-hidden="true"
        initial={false}
        animate={{ width }}
        transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {chars.map((char, index) => {
            const place = chars.length - index;
            if (!/\d/.test(char)) {
              return (
                <motion.span
                  key={`s${place}${char}`}
                  className={styles.glyph}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                  transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
                >
                  {char}
                </motion.span>
              );
            }
            return (
              <motion.span
                key={`d${place}`}
                className={styles.digit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
              >
                <motion.span
                  className={styles.strip}
                  initial={false}
                  animate={{ y: `${-10 * Number(char)}%` }}
                  transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: (place - 1) * 0.02 }}
                >
                  {DIGITS.map(digit => (
                    <span key={digit}>{digit}</span>
                  ))}
                </motion.span>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </motion.span>
    </span>
  );
}

interface PanelRowModel {
  label: string;
  count: number;
  share: number;
}

interface PanelGroupModel {
  heading: string;
  empty: string;
  rows: (PanelRowModel | null)[];
}

interface PanelModel {
  key: string;
  title: string;
  note: string;
  count: number;
  share: number;
  caption: string;
  groups: PanelGroupModel[];
}

/** One breakdown row; an empty row keeps the grid height while its label is absent. */
function BreakdownRow({ row, empty }: { row: PanelRowModel | null; empty: string }) {
  const reduced = useReducedMotion();
  const label = row ? row.label : empty;
  return (
    <li className={styles.row} data-empty={!row || undefined} aria-hidden={(!row && !empty) || undefined}>
      <span className={styles.rowLabel}>
        <Swap id={label || "blank"}>{label || "\u00a0"}</Swap>
      </span>
      <span className={styles.rowCount}>
        <RollingNumber value={row ? formatCount(row.count) : ""} />
      </span>
      <span className={styles.rowShare}>
        <RollingNumber value={row ? formatShare(row.share) : ""} />
      </span>
      <span className={styles.track}>
        <motion.span
          className={styles.bar}
          initial={false}
          animate={{ scaleX: row ? row.share : 0 }}
          transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
        />
      </span>
    </li>
  );
}

/* ------------------------------------------------------------ component */

export interface JourneyFlowProps {
  /** Appended to the root element. */
  className?: string;
}

/**
 * A Sankey of user journeys across funnel stages. A channel switch morphs every band, hovering a
 * step or band traces that cohort through the whole journey with a tooltip, and selecting a step
 * pins its breakdown in a side panel with rolling counts. Nodes, links and channel counts are the
 * sample data above.
 */
export function JourneyFlow({ className }: JourneyFlowProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();

  const [channel, setChannel] = useState(0);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<Target | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [roving, setRoving] = useState(0);
  const [tableOpen, setTableOpen] = useState(false);

  const height = chartHeight(width);
  const { label: channelLabel, values } = CHANNELS[channel];

  // Bands carry three motion values each: the live width, a delayed copy for the node sizes, and how
  // much of the band is traced. The SVG is written imperatively so a frame never re-renders React.
  const flowsRef = useRef<{ vals: MotionValue<number>[]; shown: MotionValue<number>[]; trace: MotionValue<number>[] } | null>(null);
  if (flowsRef.current === null) {
    flowsRef.current = {
      vals: CHANNELS[0].values.map(value => motionValue(value)),
      shown: CHANNELS[0].values.map(value => motionValue(value)),
      trace: LINKS.map(() => motionValue(0)),
    };
  }
  const flows = flowsRef.current;
  const tooltipX = useMotionValue(0);
  const tooltipY = useMotionValue(0);
  const chartOpacity = useMotionValue(1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dom = useRef({
    base: [] as (SVGPathElement | null)[],
    trace: [] as (SVGPathElement | null)[],
    src: [] as (SVGRectElement | null)[],
    dst: [] as (SVGRectElement | null)[],
    node: [] as (SVGRectElement | null)[],
    label: [] as (SVGGElement | null)[],
    count: [] as (SVGTextElement | null)[],
    button: [] as (HTMLButtonElement | null)[],
    hit: [] as (HTMLSpanElement | null)[],
  });
  const size = useRef({ width: 720, height: chartHeight(720) });
  /** Node index whose button has keyboard focus; the tooltip follows it. */
  const focusedNode = useRef<number | null>(null);
  const frameHandle = useRef(0);

  /** Write the current layout into the captured SVG nodes. */
  const draw = useCallback(() => {
    const { width: w, height: h } = size.current;
    const refs = dom.current;
    const layout = layoutFor(
      flows.vals.map(value => Math.max(0, value.get())),
      w,
      h,
    );
    const writeRect = (node: SVGRectElement | null, x: number, y: number, rectHeight: number) => {
      if (!node) return;
      node.setAttribute("x", String(x));
      node.setAttribute("y", y.toFixed(2));
      node.setAttribute("height", Math.max(0, rectHeight).toFixed(2));
    };

    layout.links.forEach((link, index) => {
      const { s, t } = LINKS[index];
      refs.base[index]?.setAttribute("d", ribbonPath(link.x0, link.x1, link.sy, link.ty, Math.max(link.w, 0.75)));
      const traced = link.w * Math.min(1, Math.max(0, flows.trace[index].get()));
      refs.trace[index]?.setAttribute("d", traced > 0.02 ? ribbonPath(link.x0, link.x1, link.sy, link.ty, traced) : "M0 0");
      writeRect(refs.src[index], layout.nodes[s].x0, link.sy, traced);
      writeRect(refs.dst[index], layout.nodes[t].x0, link.ty, traced);
    });

    const shownTotals = totalsFor(flows.shown.map(value => value.get())).totals;
    layout.nodes.forEach((node, index) => {
      const nodeHeight = node.y1 - node.y0;
      const hitHeight = Math.max(14, nodeHeight + 6);
      writeRect(refs.node[index], node.x0, node.y0, nodeHeight);
      refs.label[index]?.setAttribute("transform", nodeLabelTransform(index, node, w));
      const label = nodeCount(index, shownTotals, w);
      const count = refs.count[index];
      if (count && count.textContent !== label) count.textContent = label;
      const button = refs.button[index];
      if (button) button.style.transform = `translate(${node.x0}px, ${node.y0.toFixed(2)}px)`;
      const hit = refs.hit[index];
      if (hit) {
        hit.style.height = `${hitHeight.toFixed(2)}px`;
        hit.style.top = `${((nodeHeight - hitHeight) / 2).toFixed(2)}px`;
      }
    });

    // The tooltip follows the keyboard focus, if any, inside the bounds of the chart.
    const focused = focusedNode.current;
    if (focused !== null) {
      const node = layout.nodes[focused];
      const x = node.x1 + 14 + 212 > w ? node.x0 - 14 - 212 : node.x1 + 14;
      tooltipX.set(Math.min(Math.max(x, 0), Math.max(0, w - 212)));
      tooltipY.set(Math.min(Math.max(node.y0 - 8, 0), Math.max(0, h - 112)));
    }
  }, [flows, tooltipX, tooltipY]);

  const scheduleDraw = useCallback(() => {
    if (frameHandle.current) return;
    frameHandle.current = requestAnimationFrame(() => {
      frameHandle.current = 0;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    const stop = [...flows.vals, ...flows.shown, ...flows.trace].map(value => value.on("change", scheduleDraw));
    return () => {
      stop.forEach(unsubscribe => unsubscribe());
      if (frameHandle.current) cancelAnimationFrame(frameHandle.current);
      frameHandle.current = 0;
    };
  }, [flows, scheduleDraw]);

  useLayoutEffect(() => {
    size.current = { width, height };
    draw();
  }, [draw, width, height, channel]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A channel switch morphs the bands; the shown copies trail a beat behind so the node sizes settle last.
  useEffect(() => {
    const target = CHANNELS[channel].values;
    if (reduced) {
      flows.vals.forEach((value, index) => value.jump(target[index]));
      flows.shown.forEach((value, index) => value.jump(target[index]));
      return;
    }
    const controls = [
      ...flows.vals.map((value, index) => animate(value, target[index], SPRING_VALUES)),
      ...flows.shown.map((value, index) => animate(value, target[index], SPRING_SHOWN)),
    ];
    return () => controls.forEach(control => control.stop());
  }, [flows, channel, reduced]);

  const trace = useMemo(
    () => traceShares(values, hover ?? (selected === null ? null : { kind: "node", i: selected })),
    [values, hover, selected],
  );

  useEffect(() => {
    if (reduced) {
      flows.trace.forEach((value, index) => value.jump(trace[index]));
      return;
    }
    const controls = flows.trace.map((value, index) => animate(value, trace[index], motionTokens.spring.snappy));
    return () => controls.forEach(control => control.stop());
  }, [flows, trace, reduced]);

  const layout = useMemo(() => layoutFor(values, width, height), [values, width, height]);
  const { totals } = totalsFor(values);
  const tracing = hover !== null || selected !== null;

  const highlighted = NODES.map(
    (_, index) =>
      sameTarget(hover ?? (selected === null ? null : { kind: "node", i: selected }), { kind: "node", i: index }) ||
      LINKS.some((link, linkIndex) => trace[linkIndex] > 1e-4 && (link.s === index || link.t === index)),
  );

  /** Hover card for the band or node under the pointer. */
  const tooltip = hover
    ? (() => {
        if (hover.kind === "link") {
          const { s, t } = LINKS[hover.i];
          const count = values[hover.i];
          return {
            title: `${NODES[s].name} → ${NODES[t].name}`,
            count,
            rows: [
              [`Share of ${nodeName(s)}`, formatShare(count / totals[s])],
              ["Share of visitors", formatShare(count / totals[0])],
            ] as [string, string][],
          };
        }
        const index = hover.i;
        const count = totals[index];
        if (index === 0) {
          return {
            title: NODES[index].name,
            count,
            rows: LINKS.flatMap((link, linkIndex) => (link.s === index ? [[NODES[link.t].name, formatShare(values[linkIndex] / count)]] : [])) as [string, string][],
          };
        }
        const sources = LINKS.filter(link => link.t === index).map(link => link.s);
        const sourceTotal = sources.reduce((sum, source) => sum + totals[source], 0);
        return {
          title: NODES[index].name,
          count,
          rows: [
            [`Share of ${nodeName(sources.length === 1 ? sources[0] : 3)}`, formatShare(count / sourceTotal)],
            ["Share of visitors", formatShare(count / totals[0])],
          ] as [string, string][],
        };
      })()
    : null;

  /** The side panel: an overview of paid plans, or the selected step's neighbours. */
  const panel: PanelModel = (() => {
    const visits = totals[0];
    if (selected === null) {
      return {
        key: "overview",
        title: channelLabel,
        note: "Select a step to see where its users came from and went next",
        count: totals[7],
        share: totals[7] / visits,
        caption: "of visitors started a paid plan",
        groups: [
          {
            heading: "Largest drop-offs",
            empty: "",
            rows: [
              { label: "Bounced after visiting", count: totals[2], share: totals[2] / visits },
              { label: "Dropped during setup", count: totals[4], share: totals[4] / totals[1] },
            ],
          },
          {
            heading: "Plan after setup",
            empty: "",
            rows: [
              { label: "Paid", count: totals[7], share: totals[7] / totals[3] },
              { label: "Free", count: totals[8], share: totals[8] / totals[3] },
            ],
          },
        ],
      };
    }
    const count = totals[selected];
    const neighbours = (side: "s" | "t") => {
      const matches = LINKS.map((link, index) => ({ link, index })).filter(({ link }) => (side === "s" ? link.t : link.s) === selected);
      return [0, 1].map(position => {
        const match = matches[position];
        if (!match) return null;
        const other = side === "s" ? match.link.s : match.link.t;
        return { label: NODES[other].name, count: values[match.index], share: values[match.index] / count };
      });
    };
    return {
      key: NODES[selected].id,
      title: NODES[selected].name,
      note: NODES[selected].note,
      count,
      share: count / visits,
      caption: "of visitors",
      groups: [
        { heading: "Came from", empty: "Journey starts here", rows: neighbours("s") },
        { heading: "Went to", empty: "Journey ends here", rows: neighbours("t") },
      ],
    };
  })();

  const guideGap = Math.max(0, width - 8) / LAST_COLUMN;
  const baseline = Math.round(height - 34 + 10) + 0.5;

  const summary = `Journey flow for ${channelLabel.toLowerCase()}: ${formatCount(totals[0])} visited. ${formatCount(totals[1])} signed up and ${formatCount(totals[2])} bounced. ${formatCount(totals[3])} onboarded and ${formatCount(totals[4])} dropped during setup. ${formatCount(totals[5])} activated and ${formatCount(totals[6])} stalled. ${formatCount(totals[7])} started a paid plan and ${formatCount(totals[8])} stayed free.`;

  function chooseChannel(next: number) {
    if (next === channel) return;
    setChannel(next);
    // Reduced motion keeps the diagram still and fades the new one in.
    if (reduced) {
      chartOpacity.jump(0.35);
      animate(chartOpacity, 1, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] });
    }
  }

  /** Put the tooltip next to the pointer, flipping sides when it would leave the chart. */
  function placeTooltip(clientX: number, clientY: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { width: w, height: h } = size.current;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    tooltipX.set(Math.min(Math.max(x + 14 + 212 > w ? x - 14 - 212 : x + 14, 0), Math.max(0, w - 212)));
    tooltipY.set(Math.min(Math.max(y + 16 + 112 > h ? y - 16 - 112 : y + 16, 0), Math.max(0, h - 112)));
  }

  function enterTarget(event: ReactPointerEvent, target: Target) {
    if (event.pointerType === "touch") return;
    focusedNode.current = null;
    placeTooltip(event.clientX, event.clientY);
    setHover(target);
  }

  function leaveTarget(event: ReactPointerEvent, target: Target) {
    if (event.pointerType === "touch") return;
    setHover(current => (sameTarget(current, target) ? null : current));
  }

  function togglePinned(event: ReactPointerEvent, target: Target) {
    if (event.pointerType !== "touch") return;
    focusedNode.current = null;
    placeTooltip(event.clientX, event.clientY);
    setHover(current => (sameTarget(current, target) ? null : target));
  }

  /** Arrow keys walk the node columns; the nearest node in the next column keeps the cursor near its row. */
  function handleNodeKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const inColumn = (column: number) => NODES.map((node, nodeIndex) => (node.col === column ? nodeIndex : -1)).filter(nodeIndex => nodeIndex >= 0);
    let next = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const column = inColumn(NODES[index].col);
      next = column[column.indexOf(index) + (event.key === "ArrowDown" ? 1 : -1)] ?? -1;
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const y = (nodeIndex: number) => layout.nodes[nodeIndex].y0;
      next = inColumn(NODES[index].col + (event.key === "ArrowRight" ? 1 : -1)).reduce(
        (best, candidate) => (best < 0 || Math.abs(y(candidate) - y(index)) < Math.abs(y(best) - y(index)) ? candidate : best),
        -1,
      );
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = NODES.length - 1;
    else if (event.key === "Escape" && selected !== null) {
      event.preventDefault();
      setSelected(null);
      return;
    } else return;
    event.preventDefault();
    if (next >= 0) dom.current.button[next]?.focus();
  }

  return (
    <section className={[styles.flow, className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={`${id}-title`} className={styles.title}>
            Journeys to a paid plan
          </h2>
          <p className={styles.subtitle}>
            <RollingNumber className={styles.subtitleCount} value={formatCount(totals[0])} /> visits in August, followed from first session to plan
          </p>
        </div>

        <div role="radiogroup" aria-label="Acquisition channel" className={styles.segments}>
          {CHANNELS.map((option, index) => (
            <button
              key={option.id}
              ref={node => {
                segmentRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={index === channel}
              tabIndex={index === channel ? 0 : -1}
              className={styles.segment}
              onClick={() => chooseChannel(index)}
              onKeyDown={event => {
                const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                if (!step) return;
                event.preventDefault();
                const next = (index + step + CHANNELS.length) % CHANNELS.length;
                chooseChannel(next);
                segmentRefs.current[next]?.focus();
              }}
            >
              {index === channel && (
                <motion.span
                  layoutId={`${id}-segment`}
                  className={styles.segmentThumb}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                />
              )}
              <span className={styles.segmentLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      </header>

      <p className={styles.srOnly} aria-live="polite">
        {`${channelLabel}: ${formatCount(totals[0])} visits and ${formatCount(totals[7])} paid plans.`}
      </p>

      <div className={styles.body}>
        <div className={styles.chartArea}>
          <div
            ref={wrapRef}
            className={styles.chartWrap}
            style={{ height, "--hit-w": `${Math.min(Math.max(guideGap - 10, 44), 92)}px` } as CSSProperties}
            onPointerMove={event => {
              if (event.pointerType !== "touch" && focusedNode.current === null) placeTooltip(event.clientX, event.clientY);
            }}
          >
            <motion.svg
              className={styles.chart}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={summary}
              data-tracing={tracing || undefined}
              style={{ opacity: chartOpacity }}
            >
              <rect
                className={styles.backdrop}
                width={width}
                height={height}
                onClick={() => {
                  focusedNode.current = null;
                  setHover(null);
                  setSelected(null);
                }}
              />

              <g aria-hidden="true">
                {STAGES.map((stage, index) => {
                  const x = Math.round(index * guideGap + 4) + 0.5;
                  return <line key={stage} className={styles.guide} x1={x} x2={x} y1={40} y2={baseline} />;
                })}
                <line className={styles.guide} x1={0} x2={width} y1={baseline} y2={baseline} />
                {STAGES.map((stage, index) => (
                  <text
                    key={stage}
                    className={styles.stage}
                    data-end={index === LAST_COLUMN || undefined}
                    x={index === LAST_COLUMN ? Math.round(index * guideGap) + 8 : Math.round(index * guideGap)}
                    y={height - 6}
                  >
                    {width < 440 && stage === "First week" ? "Week 1" : stage}
                  </text>
                ))}
              </g>

              <g>
                {layout.links.map((link, index) => (
                  <path
                    key={index}
                    ref={node => {
                      dom.current.base[index] = node;
                    }}
                    className={styles.ribbon}
                    data-exit={NODES[LINKS[index].t].kind === "exit" || undefined}
                    data-goal={NODES[LINKS[index].t].kind === "goal" || undefined}
                    d={ribbonPath(link.x0, link.x1, link.sy, link.ty, Math.max(link.w, 0.75))}
                    onPointerEnter={event => enterTarget(event, { kind: "link", i: index })}
                    onPointerLeave={event => leaveTarget(event, { kind: "link", i: index })}
                    onPointerUp={event => togglePinned(event, { kind: "link", i: index })}
                  />
                ))}
              </g>

              <g aria-hidden="true">
                {LINKS.map((_, index) => (
                  <path
                    key={index}
                    ref={node => {
                      dom.current.trace[index] = node;
                    }}
                    className={styles.trace}
                  />
                ))}
              </g>

              <g aria-hidden="true">
                {layout.nodes.map((node, index) => (
                  <rect
                    key={index}
                    ref={element => {
                      dom.current.node[index] = element;
                    }}
                    className={styles.node}
                    data-kind={NODES[index].kind}
                    x={node.x0}
                    y={node.y0}
                    width={8}
                    height={node.y1 - node.y0}
                    rx={1}
                  />
                ))}
                {LINKS.map((_, index) => (
                  <g key={index}>
                    <rect
                      ref={element => {
                        dom.current.src[index] = element;
                      }}
                      className={styles.overlay}
                      x={0}
                      y={0}
                      width={8}
                      height={0}
                      rx={1}
                    />
                    <rect
                      ref={element => {
                        dom.current.dst[index] = element;
                      }}
                      className={styles.overlay}
                      x={0}
                      y={0}
                      width={8}
                      height={0}
                      rx={1}
                    />
                  </g>
                ))}
              </g>

              <g aria-hidden="true">
                {layout.nodes.map((node, index) => (
                  <g
                    key={index}
                    ref={element => {
                      dom.current.label[index] = element;
                    }}
                    className={styles.label}
                    data-on={!tracing || highlighted[index] || undefined}
                    data-end={NODES[index].col === LAST_COLUMN || undefined}
                    transform={nodeLabelTransform(index, node, width)}
                  >
                    {(width >= 440 || NODES[index].kind === "exit") && (
                      <text className={styles.labelName} y={-20}>
                        {NODES[index].name}
                      </text>
                    )}
                    <text
                      ref={element => {
                        dom.current.count[index] = element;
                      }}
                      className={styles.labelCount}
                      y={-7}
                    >
                      {nodeCount(index, totals, width)}
                    </text>
                  </g>
                ))}
              </g>
            </motion.svg>

            <div role="toolbar" aria-label="Journey steps" className={styles.nodeLayer}>
              {layout.nodes.map((node, index) => {
                const nodeHeight = node.y1 - node.y0;
                const hitHeight = Math.max(14, nodeHeight + 6);
                return (
                  <button
                    key={NODES[index].id}
                    ref={element => {
                      dom.current.button[index] = element;
                    }}
                    type="button"
                    className={styles.nodeButton}
                    data-end={NODES[index].col === LAST_COLUMN || undefined}
                    tabIndex={roving === index ? 0 : -1}
                    aria-pressed={selected === index}
                    aria-label={`${NODES[index].name}: ${formatCount(totals[index])} users, ${formatShare(totals[index] / totals[0])} of visitors. ${NODES[index].note}.`}
                    style={{ transform: `translate(${node.x0}px, ${node.y0.toFixed(2)}px)` }}
                    onPointerEnter={event => enterTarget(event, { kind: "node", i: index })}
                    onPointerLeave={event => leaveTarget(event, { kind: "node", i: index })}
                    onFocus={event => {
                      setRoving(index);
                      if (!event.currentTarget.matches(":focus-visible")) return;
                      focusedNode.current = index;
                      setHover({ kind: "node", i: index });
                      draw();
                    }}
                    onBlur={() => {
                      if (focusedNode.current !== index) return;
                      focusedNode.current = null;
                      setHover(current => (sameTarget(current, { kind: "node", i: index }) ? null : current));
                    }}
                    onClick={() => setSelected(current => (current === index ? null : index))}
                    onKeyDown={event => handleNodeKey(event, index)}
                  >
                    <span className={styles.hitLabel} />
                    <span
                      ref={element => {
                        dom.current.hit[index] = element;
                      }}
                      className={styles.hitNode}
                      style={{ height: `${hitHeight.toFixed(2)}px`, top: `${((nodeHeight - hitHeight) / 2).toFixed(2)}px` }}
                    />
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {tooltip && hover && (
                <motion.div
                  key="tip"
                  className={styles.tooltip}
                  aria-hidden="true"
                  style={{ x: tooltipX, y: tooltipY }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: motionTokens.duration.instant }}
                >
                  <Swap id={`${hover.kind}${hover.i}-${channel}`} className={styles.tipBody}>
                    <span className={styles.tipTitle}>{tooltip.title}</span>
                    <span className={styles.tipCount}>{formatCount(tooltip.count)} users</span>
                    {tooltip.rows.map(([label, value]) => (
                      <span key={label} className={styles.tipRow}>
                        <span>{label}</span>
                        <b>{value}</b>
                      </span>
                    ))}
                  </Swap>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Step breakdown">
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>
              <Swap id={panel.key + panel.title}>{panel.title}</Swap>
            </h3>
            <AnimatePresence initial={false}>
              {selected !== null && (
                <motion.button
                  key="clear"
                  type="button"
                  className={styles.clear}
                  aria-label="Clear selected step"
                  onClick={() => {
                    setSelected(null);
                    dom.current.button[selected]?.focus();
                  }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
                >
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                  Clear
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <p className={styles.panelNote}>
            <Swap id={panel.note}>{panel.note}</Swap>
          </p>
          <p className={styles.bigNumber}>
            <RollingNumber value={formatCount(panel.count)} />
          </p>
          <p className={styles.caption}>
            <RollingNumber value={formatShare(panel.share)} />
            <Swap id={panel.caption} className={styles.inlineSwap}>
              {panel.caption}
            </Swap>
          </p>
          <div className={styles.groups}>
            {panel.groups.map(group => (
              <div key={group.heading} className={styles.group}>
                <h4 className={styles.groupHeading}>
                  <Swap id={group.heading}>{group.heading}</Swap>
                </h4>
                <ul className={styles.rows}>
                  {group.rows.map((row, index) => (
                    <BreakdownRow key={index} row={row} empty={index === 0 ? group.empty : ""} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.tableToggle} aria-expanded={tableOpen} aria-controls={`${id}-table`} onClick={() => setTableOpen(open => !open)}>
          Flow table
          <motion.span
            className={styles.chevron}
            animate={{ rotate: 180 * +!!tableOpen }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
          >
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {tableOpen && (
          <motion.div
            key="table"
            id={`${id}-table`}
            className={styles.tableWrap}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
          >
            <table className={styles.table}>
              <caption>Flows for {channelLabel.toLowerCase()}, August</caption>
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Users</th>
                  <th scope="col">Share of step</th>
                </tr>
              </thead>
              <tbody>
                {LINKS.map((link, index) => (
                  <tr key={index}>
                    <td>{NODES[link.s].name}</td>
                    <td>{NODES[link.t].name}</td>
                    <td>{formatCount(values[index])}</td>
                    <td>{formatShare(values[index] / totals[link.s])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default JourneyFlow;
