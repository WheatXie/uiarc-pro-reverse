"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
  type Variants,
} from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./sunburst.module.css";

export interface SunburstNode {
  /** Stable identity. A node whose id survives a data change keeps its arcs and morphs in place, so give every node a unique id. */
  id: string;
  label: string;
  /** Leaves carry the measurement; a branch's value is the sum of its children. */
  value?: number;
  children?: SunburstNode[];
}

/** A hierarchy drawn as rings. Clicking a segment swings every arc around it as the new centre, the breadcrumb follows, and the centre label rolls to the new total. */
export interface SunburstProps {
  /** The root: `{ id, label, value?, children? }`. A branch's value is the sum of its children. */
  data: SunburstNode;
  /** Names the chart for assistive technology. */
  label: string;
  /** Formats the centre value, legend, tooltip, and table. */
  formatValue?: (value: number) => string;
  /** Rings shown around the centre at once. Fewer levels below a zoomed node fill the full radius. */
  depth?: number;
  /** Largest diameter in pixels. The chart scales down to fit its container. */
  size?: number;
  /** Controlled id of the node in the centre. */
  focus?: string;
  /** Initial centre when uncontrolled. Defaults to the root. */
  defaultFocus?: string;
  /** Called when a segment, breadcrumb, legend row, or the centre zooms. */
  onFocusChange?: (id: string) => void;
  /** Lists the children of the centre with values and shares, synced with the arcs. */
  legend?: boolean;
  /** Shown in the centre when the total is zero. */
  emptyLabel?: string;
  /** Extra class on the figure. */
  className?: string;
  ref?: Ref<HTMLElement>;
}

/** One node after partitioning: the share of the root it spans, its ring, and its place in the tree. */
interface ArcNode {
  id: string;
  label: string;
  value: number;
  depth: number;
  x0: number;
  x1: number;
  parent: string | null;
  children: string[];
  /** Index of the top-level branch this node belongs to, which picks its series hue. */
  branch: number;
  /** Labels from the first ring down, without the root. */
  path: string[];
}

/** What is drawn for one node right now: two turns of the circle and the ring it occupies, both interpolated. */
interface Live {
  a0: number;
  a1: number;
  d: number;
}

const { spring, ease, blur } = motionTokens;
const TAU = Math.PI * 2;

/**
 * Motion drops inherited velocity on time-defined springs, so the springs here are written as
 * stiffness and damping; retargeting mid-flight then eases from wherever the arcs already are.
 */
const physical = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }, restDelta = 5e-4) => {
  const root = TAU / (1.2 * visualDuration);
  return { type: "spring" as const, stiffness: root * root, damping: 2 * (1 - bounce) * root, restDelta, restSpeed: restDelta * 2 };
};
/** Zooms: quick, a hair of overshoot so the swing reads as movement rather than a fade. */
const ZOOM_SPRING = physical({ visualDuration: 0.62, bounce: 0.06 });
/** First paint: slower and critically damped, so the ring grows out of the centre once. */
const REVEAL_SPRING = physical({ visualDuration: 0.9, bounce: 0 });
const SNAPPY = physical(spring.snappy, 0.01);
/** The tooltip follows the pointer with the same settle as a press. */
const TOOLTIP_SPRING = { stiffness: SNAPPY.stiffness, damping: SNAPPY.damping, restDelta: 0.01 };

/** Top-level branches take the series palette; past four they fall back to ink so nothing repeats a hue. */
const colorOf = (node: ArcNode) =>
  node.branch < 4 ? `var(--series-${node.branch + 1})` : "color-mix(in oklab, var(--foreground) 34%, var(--surface))";

/** Each deeper ring mixes 70% of its branch hue into the surface, so nesting reads as lightness. */
const fillOf = (node: ArcNode) =>
  `color-mix(in oklab, ${colorOf(node)} ${Math.round(100 * Math.pow(0.7, Math.max(0, node.depth - 1)))}%, var(--surface))`;

const valueFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const shareFormat = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const numeric = (text: string) => Number(text.replace(/[^\d.-]/g, "")) || 0;

/** Text that rises out of a soft blur when it is replaced, and leaves upward in the other direction. */
const rollVariants: Variants = {
  hidden: (direction: number) => ({ opacity: 0, y: `${0.35 * direction}em`, filter: `blur(${blur.soft}px)` }),
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.24, ease: [...ease.enter] } },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.35 * direction}em`,
    filter: `blur(${blur.subtle}px)`,
    transition: { duration: 0.14, ease: [...ease.standard] },
  }),
};
/** Reduced motion keeps the swap and drops the travel. */
const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

/** Splits a tree into arcs that each own a slice of the root's turn of the circle. */
function partition(data: SunburstNode) {
  const nodes = new Map<string, ArcNode>();
  const total = (node: SunburstNode): number =>
    node.children?.length ? node.children.reduce((sum, child) => sum + total(child), 0) : Math.max(0, node.value ?? 0);

  const walk = (node: SunburstNode, depth: number, x0: number, span: number, parent: string | null, branch: number, path: string[]) => {
    const value = total(node);
    const arc: ArcNode = {
      id: node.id,
      label: node.label,
      value,
      depth,
      x0,
      x1: x0 + span,
      parent,
      children: (node.children ?? []).map((child) => child.id),
      branch,
      path: [...path, node.label],
    };
    nodes.set(node.id, arc);
    let at = x0;
    (node.children ?? []).forEach((child, index) => {
      const share = value ? (total(child) / value) * span : 0;
      walk(child, depth + 1, at, share, node.id, depth === 0 ? index : branch, depth === 0 ? [] : arc.path);
      at += share;
    });
  };

  walk(data, 0, 0, 1, null, 0, []);
  return nodes;
}

/**
 * One annular sector between two turns, with the gap between neighbours cut as a constant number of
 * pixels on the outer and inner edge. A full turn is drawn as a closed ring so it never seams.
 */
function arcPath(cx: number, inner: number, outer: number, a0: number, a1: number) {
  if (outer - inner < 0.5) return "";
  const gapIn = 1 / Math.max(inner, 1) / TAU;
  const gapOut = 1 / outer / TAU;
  const full = a1 - a0 >= 0.9999;
  const start = full ? a0 : a0 + gapOut;
  const end = full ? a1 : a1 - gapOut;
  const backOut = full ? a0 : a0 + gapIn;
  const backIn = full ? a1 : a1 - gapIn;
  if (end - start <= 1e-4 || (!full && backIn - backOut <= 0)) return "";
  const at = (radius: number, turn: number) => {
    const angle = turn * TAU - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cx + radius * Math.sin(angle)).toFixed(2)}`;
  };
  if (full) {
    return `M${at(outer, 0)}A${outer} ${outer} 0 1 1 ${at(outer, 0.49999)}A${outer} ${outer} 0 1 1 ${at(outer, 0.99999)}ZM${at(inner, 0)}A${inner} ${inner} 0 1 0 ${at(inner, 0.50001)}A${inner} ${inner} 0 1 0 ${at(inner, 1e-5)}Z`;
  }
  return `M${at(outer, start)}A${outer.toFixed(2)} ${outer.toFixed(2)} 0 ${+(end - start > 0.5)} 1 ${at(outer, end)}L${at(inner, backIn)}A${inner.toFixed(2)} ${inner.toFixed(2)} 0 ${+(backIn - backOut > 0.5)} 0 ${at(inner, backOut)}Z`;
}

/** Centre label and metadata crossfade between values instead of snapping. */
function Swap({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false} custom={1}>
        <motion.span
          key={text}
          className={styles.swapText}
          custom={1}
          variants={reduced ? fadeVariants : rollVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * The centre total rolls digit by digit. The roll holds the width of its own hidden sizer so the
 * ring never reflows while digits are leaving, and morphs that width when the new value needs more room.
 */
function Rolling({ text, reduced }: { text: string; reduced: boolean }) {
  const sizer = useRef<HTMLSpanElement>(null);
  const width = useMotionValue<number | "auto">("auto");
  const [shown, setShown] = useState({ text, direction: 1 });
  if (shown.text !== text) setShown({ text, direction: numeric(text) < numeric(shown.text) ? -1 : 1 });

  useLayoutEffect(() => {
    const node = sizer.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let last: string | null = null;
    const observer = new ResizeObserver(() => {
      const next = node.offsetWidth;
      if (last === null || last === node.textContent || reduced) width.jump(next);
      else animate(width, next, spring.morph);
      last = node.textContent;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, width]);

  const characters = [...text];
  const variants = reduced ? fadeVariants : rollVariants;

  return (
    <motion.span className={styles.roll} style={{ width }}>
      <span ref={sizer} className={styles.sizer} aria-hidden="true">
        {text}
      </span>
      <span className={styles.digits}>
        <AnimatePresence mode="popLayout" initial={false} custom={shown.direction} anchorX="right">
          {characters.map((character, index) => (
            <motion.span
              key={`p${characters.length - index}`}
              className={styles.digit}
              custom={shown.direction}
              variants={variants}
              initial="hidden"
              animate="shown"
              exit="gone"
            >
              <AnimatePresence mode="popLayout" initial={false} custom={shown.direction} anchorX="right">
                <motion.span
                  key={character}
                  className={styles.digit}
                  custom={shown.direction}
                  variants={variants}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  {character}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
    </motion.span>
  );
}

export function Sunburst({
  data,
  label,
  formatValue = valueFormat.format,
  depth = 3,
  size = 340,
  focus,
  defaultFocus,
  onFocusChange,
  legend = true,
  emptyLabel = "No data yet",
  ref,
  className,
}: SunburstProps) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && hydrated;

  const figure = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const paths = useRef(new Map<string, SVGPathElement>());
  const labels = useRef(new Map<string, SVGTextElement>());
  useImperativeHandle(ref, () => figure.current as HTMLElement);

  const inView = useInView(figure, { once: true, amount: 0.3 });
  const [width, setWidth] = useState(0);
  // Arc labels are sized against the ring's rendered width, which the ring itself may shrink below `size`.
  useLayoutEffect(() => {
    const node = ring.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const signature = JSON.stringify(data);
  const nodes = useMemo(() => partition(data), [signature]);
  const root = nodes.get(data.id) as ArcNode;

  const [localFocus, setLocalFocus] = useState(defaultFocus ?? data.id);
  const focusId = focus ?? localFocus;
  // A leaf cannot be the centre: focusing one falls back to the root, as if the zoom never happened.
  const centred = nodes.get(focusId)?.children.length ? (nodes.get(focusId) as ArcNode) : root;
  const zoomTo = (id: string) => {
    if (focus === undefined) setLocalFocus(id);
    onFocusChange?.(id);
  };

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const hovered = hoverId ? (nodes.get(hoverId) ?? null) : null;
  /** Only segments inside the centre's own wedge can be highlighted, and only within `depth` rings. */
  const active =
    hovered &&
    hovered.depth > centred.depth &&
    hovered.depth <= centred.depth + depth &&
    hovered.x0 >= centred.x0 - 1e-9 &&
    hovered.x1 <= centred.x1 + 1e-9
      ? hovered
      : null;

  const flat = useMemo(() => [...nodes.values()].filter((node) => node.depth > 0), [nodes]);
  const current = useRef(new Map<string, Live>());

  const half = size / 2;
  const outerMax = half - 2;
  const innerMin = 0.36 * outerMax;
  const deepest = (node: ArcNode): number =>
    node.children.length ? 1 + Math.max(...node.children.map((id) => deepest(nodes.get(id) as ArcNode))) : 0;
  const levels = Math.max(1, Math.min(depth, deepest(centred)));
  const maxLevel = useRef(levels);
  /** The radius a ring starts at; rings re-share the band as levels appear or run out. */
  const levelRadius = useCallback(
    (level: number, count = maxLevel.current) => innerMin + ((outerMax - innerMin) / count) * (level - 1),
    [innerMin, outerMax],
  );
  const relative = useCallback((node: ArcNode, base: ArcNode) => {
    const span = base.x1 - base.x0 || 1;
    return {
      a0: clamp((node.x0 - base.x0) / span, 0, 1),
      a1: clamp((node.x1 - base.x0) / span, 0, 1),
      d: node.depth - base.depth,
    };
  }, []);

  /** The highlighted segment and its ancestors up to the centre: the path back out. */
  const lineage = useMemo(() => {
    const ids = new Set<string>();
    let node: ArcNode | undefined = active ?? undefined;
    while (node && node.depth > centred.depth) {
      ids.add(node.id);
      node = node.parent ? nodes.get(node.parent) : undefined;
    }
    return ids;
  }, [active, centred, nodes]);

  /**
   * Arcs are painted by writing path attributes straight to the DOM: 60 frames of a full tree is far
   * more work for React than for the browser, and only the paths themselves change.
   */
  const paint = useCallback(() => {
    for (const node of flat) {
      const path = paths.current.get(node.id);
      const live = current.current.get(node.id);
      if (!path || !live) continue;
      const opacity = clamp(live.d, 0, 1) * clamp(maxLevel.current + 1 - live.d, 0, 1);
      const inner = Math.max(innerMin, levelRadius(live.d));
      const outer = Math.max(inner, Math.min(outerMax, levelRadius(live.d + 1)));
      path.setAttribute("d", opacity > 0.01 ? arcPath(half, inner + 1, outer - 1, live.a0, live.a1) : "");
      path.style.opacity = String(opacity);
      // A sliver under a pixel wide is decoration; it must not swallow hover from its neighbours.
      path.style.pointerEvents = opacity > 0.6 && live.a1 - live.a0 > 0.002 ? "auto" : "none";

      const text = labels.current.get(node.id);
      if (!text) continue;
      const turn = (live.a0 + live.a1) / 2;
      const angle = turn * TAU - Math.PI / 2;
      const radius = (inner + outer) / 2;
      const x = half + radius * Math.cos(angle);
      const y = half + radius * Math.sin(angle);
      const degrees = 360 * turn;
      text.setAttribute("x", x.toFixed(1));
      text.setAttribute("y", y.toFixed(1));
      // Labels read outward from the centre, flipping on the left half so none of them run upside down.
      text.setAttribute(
        "transform",
        `rotate(${(degrees > 90 && degrees < 270 ? degrees - 180 : degrees).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`,
      );
      const room = (live.a1 - live.a0) * TAU * radius;
      const needed = (text.getComputedTextLength?.() ?? 40) + 14;
      text.style.opacity = opacity > 0.9 && room >= needed && outer - inner >= 18 ? "1" : "0";
    }
  }, [half, flat, innerMin, outerMax, levelRadius]);

  const flight = useRef<ReturnType<typeof animate> | null>(null);
  const ready = inView || reduced;

  // One spring drives every arc from where it is on screen to its place around the new centre.
  useEffect(() => {
    if (!ready) return;
    const target = new Map(flat.map((node) => [node.id, relative(node, centred)] as const));
    const first = current.current.size === 0;
    const from = new Map(
      flat.map((node) => {
        const live = current.current.get(node.id);
        const goal = target.get(node.id) as Live;
        return [node.id, live ?? (first ? { a0: 0, a1: 0, d: goal.d } : { a0: goal.a0, a1: goal.a0, d: goal.d })] as const;
      }),
    );
    for (const id of [...current.current.keys()]) if (!nodes.has(id)) current.current.delete(id);

    flight.current?.stop();
    const startLevel = maxLevel.current;
    const settle = () => {
      maxLevel.current = levels;
      for (const [id, goal] of target) current.current.set(id, goal);
      paint();
    };
    if (reduced) {
      settle();
      return;
    }
    flight.current = animate(0, 1, {
      ...(first ? REVEAL_SPRING : ZOOM_SPRING),
      onUpdate: (progress) => {
        maxLevel.current = startLevel + (levels - startLevel) * progress;
        for (const [id, goal] of target) {
          const before = from.get(id) as Live;
          current.current.set(id, {
            a0: before.a0 + (goal.a0 - before.a0) * progress,
            a1: before.a1 + (goal.a1 - before.a1) * progress,
            d: before.d + (goal.d - before.d) * progress,
          });
        }
        paint();
      },
      onComplete: settle,
    });
    return () => flight.current?.stop();
  }, [ready, centred.id, nodes, reduced, levels, flat, paint, relative]);

  useLayoutEffect(paint);

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const followX = useSpring(tipX, TOOLTIP_SPRING);
  const followY = useSpring(tipY, TOOLTIP_SPRING);
  const placed = useRef(false);

  // The tooltip sits beside the pointer, or beside the segment when the highlight came from the keyboard,
  // and flips to the other side rather than leave the ring.
  useLayoutEffect(() => {
    const node = tooltip.current;
    const box = ring.current;
    if (!node || !box || !active) {
      placed.current = false;
      return;
    }
    const areaWidth = box.clientWidth;
    const areaHeight = box.clientHeight;
    const scale = areaWidth / size;
    let x = pointer?.x;
    let y = pointer?.y;
    if (x === undefined || y === undefined) {
      const spot = relative(active, centred);
      const angle = ((spot.a0 + spot.a1) / 2) * TAU - Math.PI / 2;
      const radius = (levelRadius(spot.d, levels) + levelRadius(spot.d + 1, levels)) / 2;
      x = (half + radius * Math.cos(angle)) * scale;
      y = (half + radius * Math.sin(angle)) * scale;
    }
    const ownWidth = node.offsetWidth;
    const ownHeight = node.offsetHeight;
    let left = x + 14;
    if (left + ownWidth > areaWidth) left = x - 14 - ownWidth;
    let top = y - ownHeight - 14;
    if (top < 0) top = y + 14;
    tipX.set(clamp(left, 0, Math.max(0, areaWidth - ownWidth)));
    tipY.set(clamp(top, 0, Math.max(0, areaHeight - ownHeight)));
    if (!placed.current || reduced) {
      followX.jump(tipX.get());
      followY.jump(tipY.get());
    }
    placed.current = true;
  });

  const parts = centred.children.map((id) => nodes.get(id) as ArcNode).filter(Boolean);
  const empty = !root.value;

  const legendBox = useRef<HTMLDivElement>(null);
  const legendList = useRef<HTMLUListElement>(null);
  const legendHeight = useMotionValue<number | "auto">("auto");
  // When the legend sits beside the ring its height is fixed to its content, so the ring does not jump
  // as rows come and go; when it wraps underneath it is free to size itself.
  useLayoutEffect(() => {
    const list = legendList.current;
    const box = legendBox.current;
    if (!list || !box || typeof ResizeObserver === "undefined") return;
    let seen = false;
    const observer = new ResizeObserver(() => {
      const height = list.offsetHeight;
      if (ring.current && box.offsetLeft < ring.current.offsetLeft + ring.current.offsetWidth) {
        if (seen && !reduced && legendHeight.get() !== "auto") animate(legendHeight, height, spring.smooth);
        else legendHeight.jump(height);
      } else legendHeight.jump("auto");
      seen = true;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [reduced, legendHeight, legend, empty]);

  const trail: ArcNode[] = [];
  for (let node: ArcNode | undefined = centred; node; node = node.parent ? nodes.get(node.parent) : undefined) trail.unshift(node);

  const shown = active ?? centred;
  const parentOf = (node: ArcNode) => (node.parent ? (nodes.get(node.parent) as ArcNode) : node);
  const shareOf = (node: ArcNode, base: ArcNode) => (base.value ? node.value / base.value : 0);
  const describe = (node: ArcNode) =>
    `${node.path.join(", ")}, ${formatValue(node.value)}, ${shareFormat.format(shareOf(node, parentOf(node)))} of ${parentOf(node).label}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const siblings = active?.parent ? (nodes.get(active.parent) as ArcNode).children.map((id) => nodes.get(id) as ArcNode) : parts;
    const index = active ? siblings.findIndex((node) => node.id === active.id) : -1;
    const go = (id?: string | null) => {
      if (!id) return;
      event.preventDefault();
      setPointer(null);
      setHoverId(id);
    };
    if (event.key === "ArrowRight") go(siblings[(index + 1) % siblings.length]?.id ?? parts[0]?.id);
    else if (event.key === "ArrowLeft") go(siblings[(index - 1 + siblings.length) % siblings.length]?.id ?? parts[parts.length - 1]?.id);
    else if (event.key === "ArrowDown")
      go(
        active && active.children.length && active.depth < centred.depth + depth
          ? active.children[0]
          : active
            ? undefined
            : parts[0]?.id,
      );
    else if (event.key === "ArrowUp") go(active?.parent && active.parent !== centred.id ? active.parent : undefined);
    else if (event.key === "Enter" || event.key === " ") {
      if (active?.children.length) {
        event.preventDefault();
        zoomTo(active.id);
        setHoverId(active.children[0]);
      }
    } else if (event.key === "Escape" || event.key === "Backspace") {
      if (centred.parent) {
        event.preventDefault();
        zoomTo(centred.parent);
        setHoverId(centred.id);
      } else if (hoverId) {
        event.preventDefault();
        setHoverId(null);
      }
    }
  };

  return (
    <figure
      ref={figure}
      className={[styles.figure, className].filter(Boolean).join(" ")}
      aria-label={label}
      data-legend={legend || undefined}
    >
      <nav className={styles.crumbs} aria-label={`${label} path`}>
        <ol className={styles.crumbList}>
          <AnimatePresence initial={false} mode="popLayout">
            {trail.map((node, index) => (
              <motion.li
                key={node.id}
                className={styles.crumb}
                layout={reduced ? false : "position"}
                initial={{ opacity: 0, x: reduced ? 0 : -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduced ? 0 : -6, transition: { duration: 0.12 } }}
                transition={{ ...spring.smooth }}
              >
                {index > 0 && (
                  <span className={styles.crumbSep} aria-hidden="true">
                    /
                  </span>
                )}
                {index < trail.length - 1 ? (
                  <button type="button" className={styles.crumbButton} onClick={() => zoomTo(node.id)}>
                    {node.label}
                  </button>
                ) : (
                  <span className={styles.crumbCurrent} aria-current="location">
                    {node.label}
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </nav>
      <div className={styles.body}>
        <div
          ref={ring}
          className={styles.ring}
          style={{ width: size }}
          data-active={active ? true : undefined}
          role="group"
          tabIndex={empty ? -1 : 0}
          aria-roledescription="sunburst"
          aria-label={`${label}, ${centred.label}. Arrow keys move between segments, Enter zooms in, Escape zooms out.`}
          onKeyDown={onKeyDown}
          onBlur={() => setHoverId(null)}
          onPointerLeave={() => {
            setHoverId(null);
            setPointer(null);
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible") && !hoverId) setHoverId(parts[0]?.id ?? null);
          }}
        >
          <svg className={styles.svg} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
            <circle
              className={styles.track}
              cx={half}
              cy={half}
              r={(innerMin + outerMax) / 2}
              strokeWidth={outerMax - innerMin}
            />
            {flat.map((node) => (
              <path
                key={node.id}
                ref={(element) => {
                  if (element) paths.current.set(node.id, element);
                  else paths.current.delete(node.id);
                }}
                className={styles.arc}
                data-active={active?.id === node.id || undefined}
                data-lineage={(lineage.has(node.id) && active?.id !== node.id) || undefined}
                data-dim={(active !== null && !lineage.has(node.id)) || undefined}
                style={{ "--fill": fillOf(node), "--hue": colorOf(node) } as CSSProperties}
                onPointerMove={(event: PointerEvent<SVGPathElement>) => {
                  if (event.pointerType !== "mouse") return;
                  const box = ring.current?.getBoundingClientRect();
                  if (box) setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
                  setHoverId(node.id);
                }}
                onClick={() => {
                  if (node.children.length) zoomTo(node.id);
                  else if (node.parent && node.parent !== centred.id) zoomTo(node.parent);
                }}
              />
            ))}
            {flat.map((node) => (
              <text
                key={node.id}
                ref={(element) => {
                  if (element) labels.current.set(node.id, element);
                  else labels.current.delete(node.id);
                }}
                className={styles.arcLabel}
                data-dim={(active !== null && !lineage.has(node.id)) || undefined}
                fontSize={width ? (11 * size) / width : 11}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {node.label}
              </text>
            ))}
          </svg>
          <button
            type="button"
            className={styles.center}
            style={{ width: `${((2 * innerMin - 8) / size) * 100}%` }}
            disabled={!centred.parent}
            onClick={() => centred.parent && zoomTo(centred.parent)}
            aria-label={centred.parent ? `Back to ${(nodes.get(centred.parent) as ArcNode).label}` : centred.label}
            tabIndex={-1}
          >
            <span className={styles.centerLabel}>
              <Swap text={empty ? emptyLabel : shown.label} reduced={reduced} />
            </span>
            {!empty && (
              <span className={styles.centerValue}>
                <Rolling text={formatValue(shown.value)} reduced={reduced} />
              </span>
            )}
            {!empty && (
              <span className={styles.centerMeta}>
                <Swap
                  text={
                    active
                      ? `${shareFormat.format(shareOf(active, centred))} of ${centred.parent ? centred.label : "total"}`
                      : centred.parent
                        ? `${shareFormat.format(shareOf(centred, root))} of total`
                        : `${parts.length} ${parts.length === 1 ? "group" : "groups"}`
                  }
                  reduced={reduced}
                />
              </span>
            )}
          </button>
          <motion.div
            ref={tooltip}
            className={styles.tooltip}
            style={{ x: reduced ? (tipX as MotionValue<number>) : followX, y: reduced ? (tipY as MotionValue<number>) : followY }}
            aria-hidden="true"
          >
            {active && (
              <>
                <p className={styles.tipTitle}>{active.path.slice(0, -1).join(" / ") || root.label}</p>
                <p className={styles.tipValue}>
                  <span className={styles.tipName}>{active.label}</span>
                  <span className={styles.tipAmount}>{formatValue(active.value)}</span>
                </p>
                <p className={styles.tipNote}>
                  {parentOf(active).id === root.id
                    ? `${shareFormat.format(shareOf(active, root))} of total`
                    : `${shareFormat.format(shareOf(active, parentOf(active)))} of ${parentOf(active).label}, ${shareFormat.format(shareOf(active, root))} of total`}
                </p>
              </>
            )}
          </motion.div>
        </div>
        {legend && !empty && (
          <motion.div ref={legendBox} className={styles.legendBox} style={{ height: legendHeight }}>
            <ul ref={legendList} className={styles.legend} aria-label={`${centred.label}, parts`}>
              <AnimatePresence initial={false} mode="popLayout">
                {parts.map((node, index) => (
                  <motion.li
                    key={node.id}
                    layout={reduced ? false : "position"}
                    initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { delay: reduced ? 0 : 0.03 * index, duration: 0.24, ease: [...ease.enter] },
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  >
                    <button
                      type="button"
                      className={styles.row}
                      data-active={lineage.has(node.id) || undefined}
                      data-dim={(active !== null && !lineage.has(node.id)) || undefined}
                      aria-label={`${describe(node)}${node.children.length ? ". Zoom in" : ""}`}
                      onClick={() => {
                        if (node.children.length) zoomTo(node.id);
                      }}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== "mouse") return;
                        setPointer(null);
                        setHoverId(node.id);
                      }}
                      onPointerLeave={() => setHoverId(null)}
                      onFocus={(event) => {
                        if (!event.currentTarget.matches(":focus-visible")) return;
                        setPointer(null);
                        setHoverId(node.id);
                      }}
                      onBlur={() => setHoverId(null)}
                      style={{ "--fill": fillOf(node), "--hue": colorOf(node) } as CSSProperties}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <span className={styles.rowLabel}>{node.label}</span>
                      <span className={styles.rowValue} aria-hidden="true">
                        <Rolling text={formatValue(node.value)} reduced={reduced} />
                      </span>
                      <span className={styles.rowShare} aria-hidden="true">
                        {shareFormat.format(shareOf(node, centred))}
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </div>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {active ? describe(active) : `${centred.label}, ${formatValue(centred.value)}`}
      </p>
      {!empty && (
        <div className={styles.srOnly}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                <th scope="col">Path</th>
                <th scope="col">Value</th>
                <th scope="col">Share of parent</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((node) => (
                <tr key={node.id}>
                  <th scope="row">{node.path.join(" / ")}</th>
                  <td>{formatValue(node.value)}</td>
                  <td>{shareFormat.format(shareOf(node, parentOf(node)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export default Sunburst;
