/**
 * Table of contents progress — Arc Pro component, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/65822.1a9886f842106c5c.js`) and its CSS module
 * (`_next/static/css/67e982881efb00eb.css`).
 *
 * Behaviour kept from the original:
 * - one polyline runs down the rows, bending through the lane of each level with a cubic S;
 * - the read part is the same path stroked with a dash equal to the travelled length, so the fill
 *   always meets a heading exactly when that heading is reached;
 * - the reading position is a section index plus the fraction through that section, measured from
 *   where a heading crosses the offset line to where the next one does, and animated on a
 *   critically damped spring (directly, and with instant jumps, under reduced motion);
 * - near the end of the article the reading line eases from the offset to the bottom edge, so the
 *   last short section is still reached when the scroll bottoms out;
 * - a marker rides the tip of the fill along the same points, knocking a hole in the fill mask;
 * - headings are links; arrows, Home and End move focus; choosing one scrolls smoothly and focuses
 *   the target heading without a second jump.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Check } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import styles from "./toc-progress.module.css";

export interface TocProgressItem {
  /** The id of the heading element in the article. */
  id: string;
  /** Text shown in the list; also the anchor text of the link. */
  label: string;
  /** Lane the line bends into, and the indent of the label. Defaults to 1. */
  level?: 1 | 2 | 3;
}

export interface TocProgressProps {
  /** Headings in document order, each `{ id, label, level?: 1 | 2 | 3 }`. */
  items: TocProgressItem[];
  /** The element that scrolls the article. Defaults to the nearest scrolling ancestor of the first heading, or the page when there is none. */
  scrollContainer?: RefObject<HTMLElement | null> | HTMLElement | null;
  /** Distance in px from the top of the scroll viewport at which a heading counts as reached, usually the height of a sticky header plus a little air. Heading scroll to this line when chosen. */
  offset?: number;
  /** The current heading, controlled. By default the current heading follows the reading position; the line keeps following the scroll either way. */
  activeId?: string;
  /** Called with the heading id when the marker reaches a new heading, while reading or while a chosen heading scrolls into place. */
  onActiveChange?: (id: string) => void;
  /** Called with the heading id when a heading in the list is chosen, before the article scrolls. Use it to update the URL hash or analytics. */
  onNavigate?: (id: string) => void;
  /** Reading time of the whole article in minutes. Defaults to an estimate from the words in the scroll container at 230 words a minute. */
  readingTime?: number;
  /** Heading above the list and the accessible name of the navigation. Pass an empty string to hide it. */
  title?: string;
  /** Shows the minutes left beside the title, rolling to each new value and ending on Finished with a check. */
  showTimeLeft?: boolean;
  /** Accessible name of the navigation when title is empty. */
  label?: string;
  /** Class on the root element. Set `--toc-accent` to recolor the read line and the marker. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
}

interface Point {
  x: number;
  y: number;
}

interface RowBox {
  top: number;
  height: number;
  lane: number;
}

interface TocGeometry {
  d: string;
  points: Point[];
  cumulative: number[];
  anchors: number[];
  total: number;
  height: number;
}

/** Horizontal lane of each heading level inside the 40px-wide line box. */
const LANES: Record<1 | 2 | 3, number> = { 1: 5, 2: 17, 3: 29 };

/** Critically damped follow of the reading position. */
const FOLLOW = { type: "spring", visualDuration: 0.28, bounce: 0 } as const;

const STEPS = 14;
const BEND = 7;

const noopSubscribe = () => () => {};

/** Builds the polyline, its cumulative lengths and the distance at which each heading sits. */
function buildGeometry(rows: RowBox[]): TocGeometry | null {
  if (!rows.length) return null;
  const points: Point[] = [];
  const anchors: number[] = [];
  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (last && last.x === x && last.y === y) return;
    points.push({ x, y });
  };

  rows.forEach((row, index) => {
    const center = row.top + row.height / 2;
    if (index === 0) push(row.lane, center);
    anchors.push(center);
    const next = rows[index + 1];
    if (!next) {
      push(row.lane, row.top + row.height - 4);
      return;
    }
    const nextCenter = next.top + next.height / 2;
    if (next.lane === row.lane) {
      push(row.lane, nextCenter);
      return;
    }
    const middle = (row.top + row.height + next.top) / 2;
    const bend = Math.min(BEND, (nextCenter - center) / 2 - 1);
    push(row.lane, middle - bend);
    for (let step = 1; step <= STEPS; step += 1) {
      const t = step / STEPS;
      const u = 1 - t;
      push(
        u * u * u * row.lane + 3 * u * u * t * row.lane + 3 * u * t * t * next.lane + t * t * t * next.lane,
        u * u * u * (middle - bend) + 3 * u * u * t * middle + 3 * u * t * t * middle + t * t * t * (middle + bend),
      );
    }
    push(next.lane, nextCenter);
  });

  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
  }
  const total = cumulative[cumulative.length - 1];
  const distances = anchors.map((y) => {
    const match = points.findIndex((point) => Math.abs(point.y - y) < 0.01);
    return match >= 0 ? cumulative[match] : 0;
  });
  distances.push(total);
  const d = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("");
  const last = rows[rows.length - 1];
  return { d, points, cumulative, anchors: distances, total, height: last.top + last.height };
}

/** Distance along the line for a reading position expressed in section units. */
function distanceAt(geometry: TocGeometry | null, value: number): number {
  if (!geometry) return 0;
  const index = Math.min(Math.floor(value), geometry.anchors.length - 2);
  if (index < 0) return 0;
  const fraction = Math.min(1, value - index);
  return geometry.anchors[index] + (geometry.anchors[index + 1] - geometry.anchors[index]) * fraction;
}

/** Point on the line at a given distance, interpolated between the two nearest vertices. */
function pointAt(geometry: TocGeometry, distance: number): Point {
  const { points, cumulative } = geometry;
  if (distance <= 0) return points[0];
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] < distance) low = middle + 1;
    else high = middle;
  }
  const index = Math.max(1, low);
  const from = points[index - 1];
  const to = points[index];
  const length = cumulative[index] - cumulative[index - 1] || 1;
  const ratio = Math.min(1, Math.max(0, (distance - cumulative[index - 1]) / length));
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

/** Nearest ancestor that actually scrolls vertically. */
function findScrollingAncestor(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

function isRefObject(value: RefObject<HTMLElement | null> | HTMLElement): value is RefObject<HTMLElement | null> {
  return "current" in value;
}

export function TocProgress({
  items,
  scrollContainer,
  offset = 96,
  activeId,
  onActiveChange,
  onNavigate,
  readingTime,
  title = "On this page",
  showTimeLeft = true,
  label,
  className,
  style,
}: TocProgressProps) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && hydrated;
  const titleId = useId();
  const maskId = `toc-knockout-${useId().replace(/[^\w-]/g, "")}`;

  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<SVGGElement>(null);
  const maskMarkerRef = useRef<SVGCircleElement>(null);
  const geometryRef = useRef<TocGeometry | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const positionsRef = useRef<number[]>([]);
  const targetRef = useRef<number | null>(null);
  const recomputeRef = useRef<() => void>(() => {});

  const [geometry, setGeometry] = useState<TocGeometry | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(readingTime ?? null);
  const [fraction, setFraction] = useState(0);

  const progress = useMotionValue(0);
  const distance = useTransform(progress, (value) => distanceAt(geometryRef.current, value));
  const dash = useTransform(distance, (value) => `${value.toFixed(2)} 100000`);
  const lineOpacity = useTransform(progress, (value) => +(value > 0.001));

  const count = items.length;
  const levels = useMemo(() => items.map((item) => item.level ?? 1), [items]);
  const index = activeId !== undefined ? Math.max(0, items.findIndex((item) => item.id === activeId)) : currentIndex;

  /* The line is rebuilt from the measured rows whenever the list resizes. */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const next = buildGeometry(
        rowRefs.current.slice(0, count).map((row, position) => ({
          top: row?.offsetTop ?? 0,
          height: row?.offsetHeight ?? 0,
          lane: LANES[levels[position]],
        })),
      );
      geometryRef.current = next;
      setGeometry(next);
      progress.set(progress.get());
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count, levels, progress]);

  /* Reading position from the scroll offset of the container. */
  useEffect(() => {
    const firstHeading = items[0] ? document.getElementById(items[0].id) : null;
    const provided = scrollContainer ? (isRefObject(scrollContainer) ? scrollContainer.current : scrollContainer) : null;
    const viewport = provided ?? findScrollingAncestor(firstHeading);
    viewportRef.current = viewport;

    const measure = () => {
      const base = viewport
        ? viewport.getBoundingClientRect().top - viewport.scrollTop + viewport.clientTop
        : -window.scrollY;
      let last = 0;
      positionsRef.current = items.map((item) => {
        const node = document.getElementById(item.id);
        if (node) last = node.getBoundingClientRect().top - base;
        return last;
      });
      if (readingTime === undefined) {
        const words = ((viewport ?? document.body).textContent ?? "").trim().split(/\s+/).length;
        setMinutes(Math.max(1, Math.round(words / 230)));
      }
      update(true);
    };

    const update = (immediate = false) => {
      const box = viewport
        ? {
            top: viewport.scrollTop,
            height: viewport.clientHeight,
            max: viewport.scrollHeight - viewport.clientHeight,
            end: viewport.scrollHeight,
          }
        : {
            top: window.scrollY,
            height: window.innerHeight,
            max: document.documentElement.scrollHeight - window.innerHeight,
            end: document.documentElement.scrollHeight,
          };
      const stops = positionsRef.current;
      if (!stops.length) return;

      const remaining = Math.max(0, box.max - box.top);
      const usable = Math.max(0, box.height - offset);
      /* Near the end the reading line eases down to the bottom edge. */
      const ease = usable > 0 && remaining < usable ? 1 - remaining / usable : 0;
      const line = box.top + offset + usable * ease * ease;

      let value = 0;
      if (line >= stops[0]) {
        let stop = stops.length - 1;
        while (stop > 0 && stops[stop] > line) stop -= 1;
        const start = stops[stop];
        const next = stop + 1 < stops.length ? stops[stop + 1] : box.end;
        value = Math.min(stops.length, stop + Math.min(1, Math.max(0, (line - start) / Math.max(1, next - start))));
      }

      /* A chosen heading is the ceiling until the reader scrolls on. */
      const ceiling = targetRef.current;
      if (ceiling !== null && value > ceiling + 1) value = ceiling;
      if (immediate || reduced) {
        progress.stop();
        progress.set(value);
      } else {
        animate(progress, value, FOLLOW);
      }
    };

    const onScroll = () => update();
    const onIntent = () => {
      if (targetRef.current === null) return;
      targetRef.current = null;
      update();
    };

    const target: HTMLElement | Window = viewport ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    const intents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const intent of intents) target.addEventListener(intent, onIntent, { passive: true });
    recomputeRef.current = () => update();

    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(viewport?.firstElementChild ?? document.body);
      if (viewport) observer.observe(viewport);
    }
    measure();

    return () => {
      target.removeEventListener("scroll", onScroll);
      for (const intent of intents) target.removeEventListener(intent, onIntent);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [items, scrollContainer, offset, readingTime, reduced, progress]);

  const onActiveChangeRef = useRef(onActiveChange);
  const lastIndexRef = useRef(0);
  useLayoutEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  });

  const placeMarker = useCallback((value: number) => {
    const current = geometryRef.current;
    const marker = markerRef.current;
    if (!current || !marker) return;
    const point = pointAt(current, distanceAt(current, value));
    const transform = `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`;
    marker.setAttribute("transform", transform);
    maskMarkerRef.current?.setAttribute("transform", transform);
  }, []);

  const onProgressChange = useCallback(
    (value: number) => {
      placeMarker(value);
      const next = Math.min(count - 1, Math.max(0, Math.floor(value + 0.002)));
      if (lastIndexRef.current !== next) {
        lastIndexRef.current = next;
        setCurrentIndex(next);
        onActiveChangeRef.current?.(items[next]?.id ?? "");
      }
      setFraction(count ? Math.min(1, value / count) : 0);
    },
    [count, items, placeMarker],
  );

  useMotionValueEvent(progress, "change", onProgressChange);
  useLayoutEffect(() => {
    placeMarker(progress.get());
  }, [geometry, placeMarker, progress]);

  const minutesLeft =
    minutes === null ? null : fraction >= 0.999 ? 0 : Math.max(1, Math.ceil(minutes * (1 - fraction)));
  const timeText = minutesLeft === null ? "" : minutesLeft === 0 ? "Finished" : `${minutesLeft} min left`;

  const navigate = (event: ReactMouseEvent<HTMLAnchorElement>, item: TocProgressItem, position: number) => {
    event.preventDefault();
    onNavigate?.(item.id);
    const heading = document.getElementById(item.id);
    if (!heading) return;
    const viewport = viewportRef.current;
    targetRef.current = position;
    const top = (positionsRef.current[position] ?? 0) - offset + 1;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (viewport) viewport.scrollTo({ top, behavior });
    else window.scrollTo({ top, behavior });
    recomputeRef.current();
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(listRef.current?.querySelectorAll("a") ?? []);
    const active = document.activeElement;
    const position = active instanceof HTMLAnchorElement ? links.indexOf(active) : -1;
    if (position < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : position + (event.key === "ArrowDown" ? 1 : -1);
    links[Math.min(links.length - 1, Math.max(0, next))]?.focus();
  };

  return (
    <nav
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      aria-label={title ? undefined : (label ?? "On this page")}
      aria-labelledby={title ? titleId : undefined}
    >
      {title || showTimeLeft ? (
        <div className={styles.head}>
          {title ? (
            <p id={titleId} className={styles.title}>
              {title}
            </p>
          ) : null}
          {showTimeLeft && minutesLeft !== null ? (
            <span className={styles.time} data-done={minutesLeft === 0 || undefined}>
              <AnimatePresence initial={false}>
                <motion.span
                  key={timeText}
                  className={styles.timeText}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 7, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: -7, filter: `blur(${motionTokens.blur.subtle}px)` }
                  }
                  transition={reduced ? { duration: 0.12 } : motionTokens.spring.snappy}
                >
                  {minutesLeft === 0 ? <Check aria-hidden="true" /> : null}
                  {timeText}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className={styles.body}>
        {geometry ? (
          <svg
            className={styles.line}
            width={40}
            height={geometry.height}
            viewBox={`0 0 40 ${geometry.height}`}
            aria-hidden="true"
          >
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={-8}
              y={-8}
              width={56}
              height={geometry.height + 16}
            >
              <rect x={-8} y={-8} width={56} height={geometry.height + 16} fill="#fff" />
              <circle ref={maskMarkerRef} r={5.5} fill="#000" />
            </mask>
            <g mask={`url(#${maskId})`}>
              <path className={styles.track} d={geometry.d} />
              <motion.path
                className={styles.progress}
                d={geometry.d}
                style={{ strokeDasharray: dash, opacity: lineOpacity }}
              />
            </g>
            <g ref={markerRef}>
              <circle r={3.5} className={styles.markerDot} />
            </g>
          </svg>
        ) : null}
        <ol ref={listRef} className={styles.list} onKeyDown={onListKeyDown}>
          {items.map((item, position) => (
            <li
              key={item.id}
              ref={(node) => {
                rowRefs.current[position] = node;
              }}
              className={styles.row}
              data-level={levels[position]}
              data-state={position < index ? "read" : position === index ? "current" : "ahead"}
            >
              <a
                href={`#${item.id}`}
                className={styles.link}
                aria-current={position === index ? "location" : undefined}
                onClick={(event) => navigate(event, item, position)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export default TocProgress;
