/**
 * Sankey flow — Arc Pro component, reconstructed from the shipped preview runtime
 * (`captures/sankey-flow/chunk.js`, module 27296) and its CSS module (`styles.css`).
 *
 * Behaviour kept from the original:
 * - columns come from each node's distance from a source unless a node declares `column`; the
 *   layout packs every column against one shared scale, then relaxes the nodes six times towards
 *   the weighted centre of their counterparts so ribbons bend instead of crossing needlessly;
 * - ribbons are cubic bands drawn straight into the DOM as `d` attributes, so an animation frame
 *   never re-renders React — the layout, the traced share and the focus share are all interpolated
 *   and painted imperatively;
 * - hovering a node or a ribbon pours the share that passes through it through every column, end
 *   to end, and lights the ribbon in its source's hue; the tooltip follows the pointer and clamps
 *   inside the plot;
 * - particles drift along each ribbon on one canvas, capped at 34 per ribbon, and pause when the
 *   figure leaves the viewport;
 * - the plot is one focusable group with arrow-key traversal, a visually hidden table and a live
 *   region, and everything decorative is aria-hidden;
 * - below 420px the diagram turns upright, stages step down the plot and labels sit under each
 *   node; reduced motion jumps to the final layout and drops particles and the toggle.
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./sankey-flow.module.css";

export interface SankeyNode {
  /** Stable id, also the key links reference. */
  id: string;
  /** Name printed beside the node and in the tooltip. */
  label: string;
  /** Stage index. Omitted nodes sit at their distance from a source. */
  column?: number;
}

export interface SankeyLink {
  /** Id of the node the flow leaves. */
  source: string;
  /** Id of the node the flow enters. */
  target: string;
  /** Amount carried; links of zero or less are ignored. */
  value: number;
}

export interface SankeyFlowProps {
  /** Nodes in the order they stack within each column. */
  nodes: SankeyNode[];
  /** Flows between node ids. A node's value is the larger of what flows in and out. */
  links: SankeyLink[];
  /** Names the chart for assistive technology. */
  label: string;
  /** Stage names printed above each column. Hidden when a name would not fit, and in the upright layout. */
  columns?: string[];
  /** Unit after values in the tooltip and table, such as "people". */
  unit?: string;
  /** What the first column adds up to, used in shares such as "21% of signups". */
  totalLabel?: string;
  /** Formats node values, the tooltip, and the table. */
  formatValue?: (value: number) => string;
  /** Plot height in pixels. The upright layout below 420px wide uses at least 480. */
  height?: number;
  /** Controlled particles along the ribbons. */
  particles?: boolean;
  /** Initial particles state when uncontrolled. */
  defaultParticles?: boolean;
  /** Called when the built in toggle is pressed. */
  onParticlesChange?: (on: boolean) => void;
  /** Shows the Flow toggle under the plot. */
  particleToggle?: boolean;
  /** Shown when there are no positive links. */
  emptyLabel?: string;
  /** Extra class on the figure. */
  className?: string;
  /** The figure element. */
  ref?: Ref<HTMLElement>;
}

interface SankeyBox {
  id: string;
  label: string;
  column: number;
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface SankeyBand {
  id: string;
  source: string;
  target: string;
  value: number;
  sy: number;
  ty: number;
  w: number;
}

interface SankeyLayout {
  boxes: Map<string, SankeyBox>;
  bands: Map<string, SankeyBand>;
  columns: number;
  scale: number;
}

interface SankeyFocus {
  kind: "node" | "link";
  id: string;
}

interface SankeyShare {
  links: Map<string, number>;
  nodes: Map<string, number>;
}

interface SankeyTooltip {
  title: string;
  value: string;
  note: string;
  rows: [string, string][];
}

const VALUE_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const SHARE_FORMAT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

const NODE_GAP = 14;
const NODE_THICKNESS = 10;
/** Room between a node's bar and its label, which is also what the label gutter has to clear. */
const LABEL_GAP = NODE_THICKNESS + 12;

/** motion's `visualDuration` re-expressed as stiffness and damping, the way the original builds every spring. */
function springFrom({ visualDuration, bounce }: { visualDuration: number; bounce: number }, restDelta = 0.001) {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring" as const, stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, restDelta, restSpeed: 2 * restDelta };
}

const LAYOUT_SPRING = springFrom(motionTokens.spring.smooth);
const ENTER_SPRING = springFrom({ visualDuration: 0.95, bounce: 0 });
const FOCUS_SPRING = springFrom({ visualDuration: 0.34, bounce: 0 });
const TIP_SPRING = springFrom(motionTokens.spring.snappy, 0.01);
const TIP_FOLLOW = { stiffness: TIP_SPRING.stiffness, damping: TIP_SPRING.damping, restDelta: 0.01 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const linkKey = (link: { source: string; target: string }) => `${link.source}>${link.target}`;

/** A cubic band from the right edge of `x0` to the left edge of `x1`, `width` tall; swapped when upright. */
function bandPath(x0: number, x1: number, y0: number, y1: number, width: number, horizontal: boolean) {
  const mid = (x0 + x1) / 2;
  const point = (x: number, y: number) => (horizontal ? `${y.toFixed(2)},${x.toFixed(2)}` : `${x.toFixed(2)},${y.toFixed(2)}`);
  return `M${point(x0, y0)}C${point(mid, y0)} ${point(mid, y1)} ${point(x1, y1)}L${point(x1, y1 + width)}C${point(mid, y1 + width)} ${point(mid, y0 + width)} ${point(x0, y0 + width)}Z`;
}

/** Eased position along a ribbon whose control points sit at both ends. */
const alongBand = (from: number, to: number, t: number) => {
  const rest = 1 - t;
  return rest * rest * rest * from + 3 * rest * rest * t * from + 3 * rest * t * t * to + t * t * t * to;
};

/** Eased position along a ribbon whose control points sit in the middle of the gap. */
const alongGap = (from: number, to: number, t: number) => {
  const mid = (from + to) / 2;
  const rest = 1 - t;
  return rest * rest * rest * from + 3 * rest * rest * t * mid + 3 * rest * t * t * mid + t * t * t * to;
};

/**
 * Packs every column against one shared scale, then relaxes the nodes towards the weighted centre
 * of the nodes they flow into (one direction per pass) so long ribbons settle instead of crossing.
 */
function computeLayout(nodes: SankeyNode[], links: SankeyLink[], span: number, pack: number): SankeyLayout {
  const flows = links.filter(
    (link) => link.value > 0 && nodes.some((node) => node.id === link.source) && nodes.some((node) => node.id === link.target),
  );
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const link of flows) {
    outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + link.value);
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + link.value);
  }

  const declared = new Map<string, number>();
  const resolveColumn = (id: string, stack = new Set<string>()): number => {
    const column = nodes.find((node) => node.id === id)?.column;
    if (column !== undefined) return column;
    if (declared.has(id)) return declared.get(id) ?? 0;
    if (stack.has(id)) return 0;
    stack.add(id);
    const depths = flows.filter((link) => link.target === id).map((link) => resolveColumn(link.source, stack) + 1);
    const depth = depths.length ? Math.max(...depths) : 0;
    declared.set(id, depth);
    return depth;
  };
  for (const node of nodes) declared.set(node.id, resolveColumn(node.id));

  const columnCount = Math.max(1, ...[...declared.values()].map((column) => column + 1));
  const usable = pack - 4;
  const strength = (id: string) => Math.max(incoming.get(id) ?? 0, outgoing.get(id) ?? 0);
  const columns = Array.from({ length: columnCount }, (_, column) =>
    nodes.filter((node) => declared.get(node.id) === column && strength(node.id) > 0),
  );
  const gap = columnCount > 1 ? (span - NODE_THICKNESS) / (columnCount - 1) : 0;
  const scale = Math.min(
    ...columns
      .filter((column) => column.length)
      .map((column) => (usable - (column.length - 1) * NODE_GAP) / Math.max(1e-9, column.reduce((sum, node) => sum + strength(node.id), 0))),
  );

  const boxes = new Map<string, SankeyBox>();
  columns.forEach((column, index) => {
    let cursor = 4 + (usable - (column.reduce((sum, node) => sum + strength(node.id) * scale, 0) + (column.length - 1) * NODE_GAP)) / 2;
    for (const node of column) {
      const height = strength(node.id) * scale;
      boxes.set(node.id, {
        id: node.id,
        label: node.label,
        column: index,
        value: strength(node.id),
        x0: index * gap,
        x1: index * gap + NODE_THICKNESS,
        y0: cursor,
        y1: cursor + height,
      });
      cursor += height + NODE_GAP;
    }
  });

  const boxOf = (id: string): SankeyBox => {
    const box = boxes.get(id);
    if (!box) throw new Error(`Sankey flow has no box for node "${id}"`);
    return box;
  };
  const centre = (box: SankeyBox) => (box.y0 + box.y1) / 2;
  const settle = (column: SankeyNode[]) => {
    const stack = column.map((node) => boxOf(node.id));
    let floor = 4;
    for (const box of stack) {
      const height = box.y1 - box.y0;
      if (box.y0 < floor) {
        box.y0 = floor;
        box.y1 = floor + height;
      }
      floor = box.y1 + NODE_GAP;
    }
    let ceiling = pack;
    for (const box of [...stack].reverse()) {
      const height = box.y1 - box.y0;
      if (box.y1 > ceiling) {
        box.y1 = ceiling;
        box.y0 = ceiling - height;
      }
      ceiling = box.y0 - NODE_GAP;
    }
  };

  // Six passes, each weaker than the last, alternating between pulling nodes towards their sources
  // and towards their targets.
  for (let pass = 0, weight = 0.9; pass < 6; pass++, weight *= 0.7) {
    const sweeps: [1 | -1, SankeyNode[][]][] = [
      [1, columns.slice(1)],
      [-1, columns.slice(0, -1).reverse()],
    ];
    for (const [direction, sweep] of sweeps) {
      for (const column of sweep) {
        for (const node of column) {
          const box = boxOf(node.id);
          const related = flows.filter((link) => (direction === 1 ? link.target === node.id : link.source === node.id));
          const total = related.reduce((sum, link) => sum + link.value, 0);
          if (!total) continue;
          const pull =
            related.reduce((sum, link) => sum + centre(boxOf(direction === 1 ? link.source : link.target)) * link.value, 0) / total - centre(box);
          box.y0 += pull * weight;
          box.y1 += pull * weight;
        }
        settle(column);
      }
    }
  }

  // Ribbons leave their source in node order (sorted by where they land) and enter their target in
  // source order, so a column never shows two crossing stacks of the same hue.
  const bands = new Map<string, SankeyBand>();
  const sourceOffset = new Map<string, number>();
  const sorted = [...flows].sort(
    (a, b) => centre(boxOf(a.target)) - centre(boxOf(b.target)) || centre(boxOf(a.source)) - centre(boxOf(b.source)),
  );
  for (const link of sorted) {
    const source = boxOf(link.source);
    const offset = sourceOffset.get(link.source) ?? 0;
    sourceOffset.set(link.source, offset + link.value * scale);
    bands.set(linkKey(link), {
      id: linkKey(link),
      source: link.source,
      target: link.target,
      value: link.value,
      sy: source.y0 + offset,
      ty: 0,
      w: link.value * scale,
    });
  }
  const targetOffset = new Map<string, number>();
  for (const link of [...flows].sort((a, b) => centre(boxOf(a.source)) - centre(boxOf(b.source)))) {
    const target = boxOf(link.target);
    const offset = targetOffset.get(link.target) ?? 0;
    targetOffset.set(link.target, offset + link.value * scale);
    const band = bands.get(linkKey(link));
    if (band) band.ty = target.y0 + offset;
  }

  return { boxes, bands, columns: columnCount, scale };
}

const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/**
 * A Sankey diagram with smooth ribbons, values on every node, and fine particles drifting along
 * each flow. Hovering a node or ribbon pours the share of every flow that passes through it, end to
 * end. Sources wear the series palette derived from the accent, and a trace pours in its source's hue.
 */
export function SankeyFlow({
  nodes,
  links,
  label,
  columns,
  unit = "",
  totalLabel = "the total",
  formatValue = (value) => VALUE_FORMAT.format(value),
  height = 340,
  particles,
  defaultParticles = true,
  onParticlesChange,
  particleToggle = true,
  emptyLabel = "No flows yet",
  ref,
  className,
}: SankeyFlowProps) {
  const hydrated = useHydrated();
  const reduced = !!useReducedMotion() && hydrated;

  const figureRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inksRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  // The handle is the figure itself, the way the original forwards its own ref.
  useImperativeHandle<HTMLElement, HTMLElement>(ref, () => figureRef.current as HTMLElement, []);

  const entered = useInView(figureRef, { once: true, amount: 0.3 });
  const onScreen = useInView(figureRef, { amount: 0 });

  // The plot measures itself; the whole layout is a function of that width.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [flowing, setFlowing] = useState(defaultParticles);
  const particlesOn = (particles ?? flowing) && !reduced;

  const signature = JSON.stringify([nodes, links]);
  // The last column labels to its right, in a gutter wide enough for its widest name and value.
  const reserve = clamp(
    6.6 *
      Math.max(
        0,
        ...nodes
          .filter((node) => links.some((link) => link.target === node.id) && !links.some((link) => link.source === node.id))
          .map((node) =>
            Math.max(
              node.label.length,
              formatValue(
                links.filter((link) => link.target === node.id).reduce((sum, link) => sum + link.value, 0),
              ).length + 1,
            ),
          ),
      ) +
      14,
    48,
    120,
  );
  const horizontal = width > 0 && width < 420;
  const chartHeight = horizontal ? Math.max(height, 480) : height;

  const layout = useMemo<SankeyLayout | null>(
    () => (width ? (horizontal ? computeLayout(nodes, links, chartHeight - 40, width) : computeLayout(nodes, links, Math.max(120, width - reserve), height)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature stands in for the data
    [signature, width, height, reserve, horizontal, chartHeight],
  );
  const empty = !layout || layout.bands.size === 0;

  // The layout on screen, plus the pausable layout animation that walks towards the target layout.
  const shownRef = useRef<SankeyLayout | null>(null);
  const shareRef = useRef<SankeyShare>({ links: new Map(), nodes: new Map() });
  const [hovered, setHovered] = useState<SankeyFocus | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const focus: SankeyFocus | null =
    hovered && layout && (hovered.kind === "node" ? layout.boxes.has(hovered.id) : layout.bands.has(hovered.id)) ? hovered : null;

  const reserveRef = useRef(reserve);
  const horizontalRef = useRef(horizontal);
  useLayoutEffect(() => {
    reserveRef.current = reserve;
    horizontalRef.current = horizontal;
  });

  // Ribbons, nodes and labels are painted straight into the DOM from the animated layout, so a
  // frame of the spring never costs a render.
  const paint = useCallback(() => {
    const current = shownRef.current;
    if (!current) return;
    const upright = horizontalRef.current;
    const collect = <T extends Element,>(root: Element | null, attribute: string) =>
      new Map([...(root?.querySelectorAll<T>(`[${attribute}]`) ?? [])].map((element) => [element.getAttribute(attribute), element] as const));
    const bandNodes = collect(svgRef.current, "data-band");
    const glowNodes = collect(svgRef.current, "data-glow");
    const nodeNodes = collect(svgRef.current, "data-node");
    const nodeGlowNodes = collect(svgRef.current, "data-node-glow");
    const labelNodes = collect<HTMLElement>(labelsRef.current, "data-label");

    for (const [id, band] of current.bands) {
      const source = current.boxes.get(band.source);
      const target = current.boxes.get(band.target);
      if (!source || !target) continue;
      bandNodes.get(id)?.setAttribute("d", band.w > 0.05 ? bandPath(source.x1, target.x0, band.sy, band.ty, band.w, upright) : "");
      const lit = (shareRef.current.links.get(id) ?? 0) * current.scale;
      glowNodes.get(id)?.setAttribute("d", lit > 0.05 ? bandPath(source.x1, target.x0, band.sy, band.ty, Math.min(band.w, lit), upright) : "");
    }

    const writeRect = (element: Element | undefined, box: SankeyBox, length: number) => {
      if (!element) return;
      element.setAttribute("x", (upright ? box.y0 : box.x0).toFixed(2));
      element.setAttribute("y", (upright ? box.x0 : box.y0).toFixed(2));
      element.setAttribute("width", (upright ? Math.max(0, length) : NODE_THICKNESS).toFixed(2));
      element.setAttribute("height", (upright ? NODE_THICKNESS : Math.max(0, length)).toFixed(2));
    };
    const gap = current.columns > 1 && current.boxes.size ? Math.max(...[...current.boxes.values()].map((box) => box.x0)) / (current.columns - 1) : 0;

    for (const [id, box] of current.boxes) {
      const length = box.y1 - box.y0;
      writeRect(nodeNodes.get(id), box, length);
      writeRect(nodeGlowNodes.get(id), box, Math.min(length, (shareRef.current.nodes.get(id) ?? 0) * current.scale));
      const element = labelNodes.get(id);
      if (!element) continue;
      if (upright) {
        element.style.transform = `translate(${box.y0.toFixed(1)}px, ${(box.x1 + 6).toFixed(1)}px)`;
        element.style.maxWidth = `${Math.max(24, length + NODE_GAP - 6)}px`;
        element.dataset.size = length >= 22 ? "tall" : "none";
      } else {
        element.style.transform = `translate(${(box.x1 + 7).toFixed(1)}px, ${((box.y0 + box.y1) / 2).toFixed(1)}px) translateY(-50%)`;
        element.style.maxWidth = `${Math.max(24, box.column === current.columns - 1 ? reserveRef.current - 9 : gap - LABEL_GAP)}px`;
        element.dataset.size = length >= 30 ? "tall" : length >= 13 ? "short" : "none";
      }
    }
  }, []);

  const layoutAnim = useRef<ReturnType<typeof animate> | null>(null);
  const lastSignature = useRef("");
  const lastTouched = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!layout || (!entered && !reduced)) return;
    const previous = shownRef.current;
    const first = !previous;
    // Nodes grow out of their centre on first paint, and out of their previous column on a data change.
    const startBoxes = new Map<string, SankeyBox>(
      [...layout.boxes].map(([id, box]): [string, SankeyBox] => {
        const before = previous?.boxes.get(id);
        if (before) return [id, before];
        const middle = (box.y0 + box.y1) / 2;
        const y = first ? box.y0 + (box.y1 - box.y0) / 2 : middle;
        return [id, { ...box, y0: y, y1: y }];
      }),
    );
    const startBands = new Map<string, SankeyBand>(
      [...layout.bands].map(([id, band]): [string, SankeyBand] => {
        const before = previous?.bands.get(id);
        return [id, before ?? { ...band, w: 0, sy: band.sy + (first ? band.w / 2 : 0), ty: band.ty + (first ? band.w / 2 : 0) }];
      }),
    );
    const startScale = previous?.scale ?? layout.scale;
    const sameData = lastSignature.current === signature;
    lastSignature.current = signature;

    if (reduced || (sameData && !first)) {
      shownRef.current = layout;
      paint();
      return;
    }

    layoutAnim.current = animate(0, 1, {
      ...(first ? ENTER_SPRING : LAYOUT_SPRING),
      onUpdate: (progress) => {
        shownRef.current = {
          columns: layout.columns,
          scale: startScale + (layout.scale - startScale) * progress,
          boxes: new Map<string, SankeyBox>(
            [...layout.boxes].map(([id, box]): [string, SankeyBox] => {
              const from = startBoxes.get(id) ?? box;
              return [
                id,
                {
                  ...box,
                  x0: from.x0 + (box.x0 - from.x0) * progress,
                  x1: from.x1 + (box.x1 - from.x1) * progress,
                  y0: from.y0 + (box.y0 - from.y0) * progress,
                  y1: from.y1 + (box.y1 - from.y1) * progress,
                },
              ];
            }),
          ),
          bands: new Map<string, SankeyBand>(
            [...layout.bands].map(([id, band]): [string, SankeyBand] => {
              const from = startBands.get(id) ?? band;
              return [id, { ...band, sy: from.sy + (band.sy - from.sy) * progress, ty: from.ty + (band.ty - from.ty) * progress, w: from.w + (band.w - from.w) * progress }];
            }),
          ),
        };
        paint();
      },
      onComplete: () => {
        shownRef.current = layout;
        paint();
      },
    });
    return () => layoutAnim.current?.stop();
  }, [layout, entered, reduced, paint, signature]);

  useLayoutEffect(() => paint());

  // Tracing walks each column once: forward it carries the share that reaches a node, backwards the
  // share that leaves it, and a lit ribbon is the smaller of the two.
  useEffect(() => {
    if (!layout) return;
    const next = computeShare(focus, layout);
    const from = shareRef.current;
    const linkKeys = new Set([...from.links.keys(), ...next.links.keys()]);
    const nodeKeys = new Set([...from.nodes.keys(), ...next.nodes.keys()]);
    lastTouched.current?.stop();
    if (reduced) {
      shareRef.current = next;
      paint();
      return;
    }
    lastTouched.current = animate(0, 1, {
      ...FOCUS_SPRING,
      onUpdate: (progress) => {
        shareRef.current = {
          links: new Map<string, number>(
            [...linkKeys].map((id) => [id, (from.links.get(id) ?? 0) + ((next.links.get(id) ?? 0) - (from.links.get(id) ?? 0)) * progress]),
          ),
          nodes: new Map<string, number>(
            [...nodeKeys].map((id) => [id, (from.nodes.get(id) ?? 0) + ((next.nodes.get(id) ?? 0) - (from.nodes.get(id) ?? 0)) * progress]),
          ),
        };
        paint();
      },
      onComplete: () => {
        shareRef.current = next;
        paint();
      },
    });
    return () => lastTouched.current?.stop();
  }, [focus?.kind, focus?.id, layout, paint, reduced]);

  // Particles: one canvas, positions kept between frames so a ribbon keeps its drift on re-render.
  const drift = useRef(new Map<string, { t: number; lane: number }[]>());
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !particlesOn || !onScreen || !layout || !width) {
      const context = canvas?.getContext("2d");
      context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(chartHeight * ratio);
    for (const [id, band] of layout.bands) {
      const source = layout.boxes.get(band.source);
      const target = layout.boxes.get(band.target);
      if (!source || !target) continue;
      const count = clamp(Math.round((band.w * (target.x0 - source.x1)) / 520), 1, 34);
      const dots = drift.current.get(id) ?? [];
      while (dots.length < count) dots.push({ t: Math.random(), lane: 0.12 + 0.76 * Math.random() });
      dots.length = count;
      drift.current.set(id, dots);
    }

    let inks = { ink: "#888", accent: "#888" };
    let frames = 0;
    let lastFrame = performance.now();
    const readInks = () => {
      const node = inksRef.current;
      if (!node) return;
      const computed = getComputedStyle(node);
      inks = { ink: computed.color, accent: computed.backgroundColor };
    };
    readInks();

    let frame = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (++frames % 30 === 0) readInks();
      const current = shownRef.current;
      if (current) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, chartHeight);
        const tracing = shareRef.current.links.size > 0 && [...shareRef.current.links.values()].some((value) => value > 0);
        for (const [id, band] of current.bands) {
          const source = current.boxes.get(band.source);
          const target = current.boxes.get(band.target);
          const dots = drift.current.get(id);
          if (!source || !target || !dots || band.w < 0.5) continue;
          const span = Math.max(1, target.x0 - source.x1);
          const lit = band.w ? Math.min(1, ((shareRef.current.links.get(id) ?? 0) * current.scale) / band.w) : 0;
          for (const dot of dots) {
            dot.t = (dot.t + (46 * delta) / span) % 1;
            const t = dot.t;
            const x = alongGap(source.x1, target.x0, t);
            const y = alongBand(band.sy, band.ty, t) + band.w * dot.lane;
            const px = horizontal ? y : x;
            const py = horizontal ? x : y;
            const poured = dot.lane <= lit;
            context.globalAlpha = (tracing ? (poured ? 0.95 : 0.08) : 0.42) * Math.min(1, 8 * t, (1 - t) * 8);
            context.fillStyle = tracing && poured ? inks.accent : inks.ink;
            context.beginPath();
            context.arc(px, py, 1.15, 0, 2 * Math.PI);
            context.fill();
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [particlesOn, onScreen, layout, width, chartHeight, horizontal]);

  // The tooltip is measured after every render, so it never overflows the plot.
  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipTargetX = useSpring(tipX, TIP_FOLLOW);
  const tipTargetY = useSpring(tipY, TIP_FOLLOW);
  const tipShown = useRef(false);
  useLayoutEffect(() => {
    const node = tooltipRef.current;
    if (!node || !focus || !layout) {
      tipShown.current = false;
      return;
    }
    let x = pointer?.x;
    let y = pointer?.y;
    if (x === undefined || y === undefined) {
      let anchorX: number;
      let anchorY: number;
      if (focus.kind === "node") {
        const box = layout.boxes.get(focus.id);
        if (!box) return;
        anchorX = box.x1;
        anchorY = (box.y0 + box.y1) / 2;
      } else {
        const band = layout.bands.get(focus.id);
        const source = band ? layout.boxes.get(band.source) : undefined;
        const target = band ? layout.boxes.get(band.target) : undefined;
        if (!band || !source || !target) return;
        anchorX = (source.x1 + target.x0) / 2;
        anchorY = (band.sy + band.ty) / 2 + band.w / 2;
      }
      x = horizontal ? anchorY : anchorX;
      y = horizontal ? anchorX : anchorY;
    }
    const boxWidth = node.offsetWidth;
    const boxHeight = node.offsetHeight;
    let left = x + 14;
    if (left + boxWidth > width) left = x - 14 - boxWidth;
    let top = y - boxHeight - 14;
    if (top < 0) top = y + 14;
    tipX.set(clamp(left, 0, Math.max(0, width - boxWidth)));
    tipY.set(clamp(top, 0, Math.max(0, chartHeight - boxHeight)));
    if (!tipShown.current || reduced) {
      tipTargetX.jump(tipX.get());
      tipTargetY.jump(tipY.get());
    }
    tipShown.current = true;
  });

  const pointAt = (event: ReactPointerEvent<Element>) => {
    const box = plotRef.current?.getBoundingClientRect();
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : null;
  };
  const targetOf = (event: ReactPointerEvent<Element>): SankeyFocus | null => {
    const element = event.target instanceof Element ? event.target.closest("[data-band], [data-node]") : null;
    if (!element) return null;
    const band = element.getAttribute("data-band");
    return band ? { kind: "link", id: band } : { kind: "node", id: element.getAttribute("data-node") ?? "" };
  };

  // The first four source nodes wear the series palette; everything downstream is neutral.
  const palette = useMemo(
    () =>
      new Map<string, number>(
        layout
          ? nodes
              .filter((node) => layout.boxes.get(node.id)?.column === 0)
              .slice(0, 4)
              .map((node, index): [string, number] => [node.id, index])
          : [],
      ),
    [layout, nodes],
  );
  const byColumn = useMemo(() => {
    if (!layout) return [];
    const buckets: SankeyBox[][] = Array.from({ length: layout.columns }, () => []);
    for (const box of layout.boxes.values()) buckets[box.column].push(box);
    return buckets.map((bucket) => bucket.sort((a, b) => a.y0 - b.y0));
  }, [layout]);

  const withUnit = (value: number) => `${formatValue(value)}${unit ? ` ${unit}` : ""}`;
  const total = layout ? [...layout.boxes.values()].filter((box) => box.column === 0).reduce((sum, box) => sum + box.value, 0) : 0;
  const labelOf = (id: string) => nodes.find((node) => node.id === id)?.label ?? id;
  const bandsOf = (id: string, side: "source" | "target") =>
    layout ? [...layout.bands.values()].filter((band) => band[side] === id).sort((a, b) => b.value - a.value) : [];

  // ---- tooltip model -------------------------------------------------------------------------
  let live: SankeyTooltip | null = null;
  if (focus && layout) {
    if (focus.kind === "node") {
      const box = layout.boxes.get(focus.id);
      if (box) {
        const out = bandsOf(box.id, "source");
        const into = bandsOf(box.id, "target");
        const rows: [string, string][] = (out.length ? out : into).slice(0, 4).map((band) => [
          `${out.length ? "to" : "from"} ${labelOf(out.length ? band.target : band.source)}`,
          SHARE_FORMAT.format(band.value / (box.value || 1)),
        ]);
        live = {
          title: box.label,
          value: withUnit(box.value),
          note: `${SHARE_FORMAT.format(box.value / (total || 1))} of ${totalLabel}`,
          rows,
        };
      }
    } else {
      const band = layout.bands.get(focus.id);
      const source = band ? layout.boxes.get(band.source) : undefined;
      const target = band ? layout.boxes.get(band.target) : undefined;
      if (band && source && target) {
        live = {
          title: `${source.label} to ${target.label}`,
          value: withUnit(band.value),
          note: `${SHARE_FORMAT.format(band.value / (source.value || 1))} of ${source.label}, ${SHARE_FORMAT.format(band.value / (target.value || 1))} of ${target.label}`,
          rows: [],
        };
      }
    }
  }
  // Keep the last tooltip mounted while it fades out.
  const [lastTip, setLastTip] = useState<SankeyTooltip | null>(live);
  const liveKey = live ? JSON.stringify(live) : "";
  if (live && liveKey !== (lastTip ? JSON.stringify(lastTip) : "")) setLastTip(live);
  const tooltip = live ?? lastTip;
  const announcement = live ? `${live.title}, ${live.value}. ${live.note}. ${live.rows.map((row) => `${row[1]} ${row[0]}`).join(", ")}` : "";

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!layout || empty) return;
    if (event.key === "Escape" && focus) {
      event.preventDefault();
      setHovered(null);
      return;
    }
    const current = focus?.kind === "node" ? layout.boxes.get(focus.id) : undefined;
    let next: SankeyBox | undefined;
    if (current) {
      if (event.key === (horizontal ? "ArrowRight" : "ArrowDown") || event.key === (horizontal ? "ArrowLeft" : "ArrowUp")) {
        const column = byColumn[current.column];
        const index = column.indexOf(current);
        next = column[clamp(index + (event.key === (horizontal ? "ArrowRight" : "ArrowDown") ? 1 : -1), 0, column.length - 1)];
      } else if (event.key === (horizontal ? "ArrowDown" : "ArrowRight") || event.key === (horizontal ? "ArrowUp" : "ArrowLeft")) {
        const column = byColumn[current.column + (event.key === (horizontal ? "ArrowDown" : "ArrowRight") ? 1 : -1)];
        if (column?.length) {
          const middle = (current.y0 + current.y1) / 2;
          next = column.reduce((best, box) => (Math.abs((box.y0 + box.y1) / 2 - middle) < Math.abs((best.y0 + best.y1) / 2 - middle) ? box : best));
        }
      } else if (event.key === "Home") {
        next = byColumn[0]?.[0];
      } else if (event.key === "End") {
        next = byColumn[byColumn.length - 1]?.[0];
      }
    } else {
      next = ["ArrowRight", "ArrowDown", "ArrowUp", "ArrowLeft", "Home"].includes(event.key) ? byColumn[0]?.[0] : undefined;
    }
    if (!next) return;
    event.preventDefault();
    setPointer(null);
    setHovered({ kind: "node", id: next.id });
  };

  const stageColumns = layout?.columns ?? columns?.length ?? 0;

  return (
    <figure ref={figureRef} className={[styles.figure, className].filter(Boolean).join(" ")} aria-label={label}>
      {!!columns?.length && !horizontal && (
        <div className={styles.stages} aria-hidden="true">
          {columns.map((name, index) => {
            const step = stageColumns > 1 ? (Math.max(120, width - reserve) - 10) / (stageColumns - 1) : 0;
            const room = index === stageColumns - 1 ? step / 2 + reserve : step - 8;
            return (
              <span key={name} className={styles.stage} data-hidden={6.6 * name.length > room || undefined} style={{ left: index * step }}>
                {name}
              </span>
            );
          })}
        </div>
      )}
      <div
        className={styles.chart}
        data-focus={focus ? focus.kind : undefined}
        data-glow={focus ? palette.get(focus.kind === "node" ? focus.id : (layout?.bands.get(focus.id)?.source ?? "")) : undefined}
      >
        <div
          ref={plotRef}
          className={styles.plot}
          style={{ height: chartHeight }}
          role="group"
          tabIndex={empty ? -1 : 0}
          aria-roledescription="flow diagram"
          aria-label={`${label}. Arrow keys move between stages and nodes, Escape clears.`}
          onKeyDown={handleKeyDown}
          onBlur={() => setHovered(null)}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            setHovered(null);
            setPointer(null);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse" && focus) setPointer(pointAt(event));
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible") && !focus && byColumn[0]?.[0]) setHovered({ kind: "node", id: byColumn[0][0].id });
          }}
        >
          <span ref={inksRef} className={styles.inks} aria-hidden="true" />
          <svg
            ref={svgRef}
            className={styles.svg}
            width="100%"
            height={chartHeight}
            aria-hidden="true"
            focusable="false"
            onPointerOver={(event) => {
              const target = targetOf(event);
              if (!target || event.pointerType !== "mouse") return;
              setPointer(pointAt(event));
              setHovered(target);
            }}
            onPointerDown={(event) => {
              const target = targetOf(event);
              if (!target || event.pointerType === "mouse") return;
              setPointer(pointAt(event));
              setHovered((current) => (current && target && current.id === target.id ? null : target));
            }}
          >
            <g>
              {layout &&
                [...layout.bands.values()].map((band) => (
                  <path
                    key={band.id}
                    data-band={band.id}
                    className={styles.band}
                    data-slot={palette.get(band.source)}
                    data-lit={(focus?.kind === "link" && focus.id === band.id) || undefined}
                  />
                ))}
            </g>
            <g className={styles.glows}>
              {layout &&
                [...layout.bands.values()].map((band) => <path key={band.id} data-glow={band.id} className={styles.glow} />)}
            </g>
            {layout &&
              [...layout.boxes.values()].map((box) => (
                <g key={box.id}>
                  <rect data-node={box.id} className={styles.node} data-slot={palette.get(box.id)} rx={2.5} />
                  <rect data-node-glow={box.id} className={styles.nodeGlow} rx={2.5} />
                </g>
              ))}
          </svg>
          <canvas ref={canvasRef} className={styles.canvas} style={{ width: "100%", height: chartHeight }} aria-hidden="true" data-on={particlesOn || undefined} />
          <div ref={labelsRef} className={styles.labels} aria-hidden="true">
            {layout &&
              [...layout.boxes.values()].map((box) => (
                <div key={box.id} data-label={box.id} className={styles.nodeLabel} data-lit={(focus?.kind === "node" && focus.id === box.id) || undefined}>
                  <span className={styles.nodeName}>{box.label}</span>
                  <span className={styles.nodeValue}>{formatValue(box.value)}</span>
                </div>
              ))}
          </div>
          <motion.div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ x: reduced ? tipX : tipTargetX, y: reduced ? tipY : tipTargetY }}
            data-on={!!live || undefined}
            aria-hidden="true"
          >
            {tooltip && (
              <>
                <p className={styles.tipTitle}>{tooltip.title}</p>
                <p className={styles.tipValue}>{tooltip.value}</p>
                <p className={styles.tipNote}>{tooltip.note}</p>
                {tooltip.rows.map(([name, share]) => (
                  <p key={name} className={styles.tipRow}>
                    <span>{name}</span>
                    <span className={styles.tipShare}>{share}</span>
                  </p>
                ))}
              </>
            )}
          </motion.div>
          {empty && width > 0 && <p className={styles.message}>{emptyLabel}</p>}
        </div>
      </div>
      {particleToggle && !reduced && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.flowToggle}
            aria-pressed={particlesOn}
            onClick={() => {
              const next = !particlesOn;
              if (particles === undefined) setFlowing(next);
              onParticlesChange?.(next);
            }}
          >
            <span className={styles.flowIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Flow
          </button>
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {!empty && layout && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Value</th>
                <th scope="col">Share of source</th>
              </tr>
            </thead>
            <tbody>
              {[...layout.bands.values()].map((band) => (
                <tr key={band.id}>
                  <th scope="row">{labelOf(band.source)}</th>
                  <td>{labelOf(band.target)}</td>
                  <td>{withUnit(band.value)}</td>
                  <td>{SHARE_FORMAT.format(band.value / (layout.boxes.get(band.source)?.value || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

/**
 * Walks every column once: forward with the share of each flow that reaches a node, backwards with
 * the share that leaves it. A ribbon carries the smaller of the two, so a traced journey is lit end
 * to end instead of fading where another source merges in.
 */
function computeShare(focus: SankeyFocus | null, layout: SankeyLayout): SankeyShare {
  const linksShare = new Map<string, number>();
  const nodesShare = new Map<string, number>();
  if (!focus) return { links: linksShare, nodes: nodesShare };

  const all = [...layout.bands.values()];
  const trace = focus.kind === "link" ? layout.bands.get(focus.id) : undefined;
  if (focus.kind === "link" && !trace) return { links: linksShare, nodes: nodesShare };

  const entering = (id: string) => all.filter((band) => band.target === id);
  const leaving = (id: string) => all.filter((band) => band.source === id);
  const sum = (bands: SankeyBand[]) => bands.reduce((total, band) => total + band.value, 0);
  const ordered = [...layout.boxes.values()].sort((a, b) => a.column - b.column);
  const isTraced = (id: string) => focus.kind === "node" && focus.id === id;
  const reach = new Map<string, number>();
  const leaveShare = new Map<string, number>();

  if (trace) {
    linksShare.set(trace.id, trace.value);
    nodesShare.set(trace.source, trace.value);
    nodesShare.set(trace.target, trace.value);
  } else {
    reach.set(focus.id, 1);
    leaveShare.set(focus.id, 1);
    nodesShare.set(focus.id, layout.boxes.get(focus.id)?.value ?? 0);
  }

  for (const box of ordered) {
    if (isTraced(box.id)) continue;
    const arriving = entering(box.id).reduce((total, band) => total + (band === trace ? band.value : band.value * (reach.get(band.source) ?? 0)), 0);
    if (!arriving) continue;
    for (const band of entering(box.id)) {
      if (band !== trace && reach.get(band.source)) linksShare.set(band.id, band.value * (reach.get(band.source) ?? 0));
    }
    reach.set(box.id, arriving / (sum(entering(box.id)) || 1));
    nodesShare.set(box.id, Math.max(nodesShare.get(box.id) ?? 0, arriving));
  }

  for (const box of [...ordered].reverse()) {
    if (isTraced(box.id)) continue;
    const departing = leaving(box.id).reduce((total, band) => total + (band === trace ? band.value : band.value * (leaveShare.get(band.target) ?? 0)), 0);
    if (!departing) continue;
    for (const band of leaving(box.id)) {
      if (band !== trace && leaveShare.get(band.target)) linksShare.set(band.id, band.value * (leaveShare.get(band.target) ?? 0));
    }
    leaveShare.set(box.id, departing / (sum(entering(box.id)) || sum(leaving(box.id)) || 1));
    nodesShare.set(box.id, Math.max(nodesShare.get(box.id) ?? 0, departing));
  }

  return { links: linksShare, nodes: nodesShare };
}

export default SankeyFlow;
