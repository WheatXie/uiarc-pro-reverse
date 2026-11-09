"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ArrowUpRight, ChevronDown, CircleAlert, Globe, RotateCcw, SearchX } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./source-cards.module.css";

export type SourceMark = "github" | "mdn" | "stripe" | "vercel" | "wikipedia" | "stackoverflow";
export type SourceCardsStatus = "searching" | "done" | "error";

export interface SourceCardsSource {
  /** Result title, clamped to two lines on the card. */
  title: string;
  /** Absolute URL the card opens; its host also labels the card. */
  url: string;
  /** Stable key for the streamed card. Defaults to the URL plus its position. */
  id?: string;
  /** Publisher shown in the preview. Defaults to the name matching `mark`, else the host. */
  site?: string;
  /** Passage shown in the hover preview, clamped to four lines. */
  snippet?: string;
  /** Publication date shown at the end of the preview head. */
  published?: string;
  /** Brand glyph for the card row. Inferred from the host when omitted. */
  mark?: SourceMark;
  /** Custom glyph that replaces the brand mark. */
  icon?: ReactNode;
}

export interface SourceCardsProps {
  /** Results to show, in the order they stream in. */
  sources?: SourceCardsSource[];
  /** Search state. `searching` keeps the count rolling and the list busy. */
  status?: SourceCardsStatus;
  /** Expected result count while searching; also reserves that many slots. */
  total?: number;
  /** Query shown beside the status and announced while searching. */
  query?: string;
  /** Elapsed time in ms, shown as `1.8s` on a finished search. */
  duration?: number;
  /** Cards visible before the rest collapse into a stack. Defaults to 3. */
  max?: number;
  /** Controlled expanded state of the card list. */
  expanded?: boolean;
  /** Initial expanded state when uncontrolled. Defaults to false. */
  defaultExpanded?: boolean;
  /** Called when the list expands or collapses. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Controlled highlight; citation clicks write here when set. */
  highlighted?: number | null;
  /** Called when a citation highlights a source. */
  onHighlightChange?: (n: number | null) => void;
  /** Called when a card is chosen. Without it the card is a link that opens in a new tab. */
  onSourceClick?: (source: SourceCardsSource, n: number) => void;
  /** Adds a retry action to the failed and empty states. */
  onRetry?: () => void;
  /** Failure reason, shown after "Search failed". */
  error?: string;
  /** Hides the status row, keeping only the cards. Defaults to false. */
  hideStatus?: boolean;
  /** Answer text placed above the cards; citations inside it highlight a card. */
  children?: ReactNode;
  /** Accessible name of the card list. Defaults to "Sources". */
  label?: string;
  className?: string;
}

export interface SourceCitationProps {
  /** 1-based source index; matches the order of `sources`. */
  n: number;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export interface SourceCardsSimulationProps {
  /** Which search to play. Defaults to `live`. */
  scenario?: "live" | "error" | "empty";
  className?: string;
}

interface NormalizedSource {
  key: string;
  n: number;
  source: SourceCardsSource;
  host: string;
  domain: string;
  path: string;
  site: string;
  mark?: SourceMark;
}

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];

const SourceContext = createContext<{
  sources: NormalizedSource[];
  highlighted: number | null;
  highlight: (n: number | null) => void;
} | null>(null);

/** Host without the leading `www.`, falling back to a manual split for relative URLs. */
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

/** Registrable domain: keeps the last two labels, or three behind a two-letter suffix and a short second level. */
function domainOf(host: string) {
  const labels = host.split(".");
  if (labels.length <= 2 || /^\d+$/.test(labels[labels.length - 1])) return host;
  const three = labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3;
  return labels.slice(three ? -3 : -2).join(".");
}

const brandMarks: Record<SourceMark, { d: string; fill?: string }> = {
  github: {
    d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  mdn: {
    d: "m21.538 1.1-6.745 21.8h-2.77L18.77 1.1ZM24 1.1v21.8h-2.462V1.1Zm-12 0v21.8H9.538V1.1Zm-2.462 0L2.77 22.9H0L6.746 1.1Z",
  },
  stripe: {
    fill: "#635BFF",
    d: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  },
  vercel: { d: "m12 1.608 12 20.784H0Z" },
  wikipedia: {
    d: "M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z",
  },
  stackoverflow: {
    fill: "#F58025",
    d: "M15.725 0l-1.72 1.277 6.39 8.588 1.716-1.277L15.725 0zm-3.94 3.418l-1.369 1.644 8.225 6.85 1.369-1.644-8.225-6.85zm-3.15 4.465l-.905 1.94 9.702 4.517.904-1.94-9.701-4.517zm-1.85 4.86l-.44 2.093 10.473 2.201.44-2.092-10.473-2.203zM1.89 15.47V24h19.19v-8.53h-2.133v6.397H4.021v-6.396H1.89zm4.265 2.133v2.13h10.66v-2.13H6.154Z",
  },
};

const markNames: Record<SourceMark, string> = {
  github: "GitHub",
  mdn: "MDN Web Docs",
  stripe: "Stripe Docs",
  vercel: "Vercel",
  wikipedia: "Wikipedia",
  stackoverflow: "Stack Overflow",
};

const hostMarks: [RegExp, SourceMark][] = [
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)developer\.mozilla\.org$/, "mdn"],
  [/(^|\.)stripe\.com$/, "stripe"],
  [/(^|\.)vercel\.com$/, "vercel"],
  [/(^|\.)wikipedia\.org$/, "wikipedia"],
  [/(^|\.)stackoverflow\.com$/, "stackoverflow"],
];

/** Brand glyph, custom glyph, or a monogram disc when the host is unknown. */
function SourceMark({ mark, icon, host, size = 14 }: { mark?: SourceMark; icon?: ReactNode; host: string; size?: number }) {
  if (icon)
    return (
      <span aria-hidden="true" style={{ display: "inline-grid", width: size, height: size, placeItems: "center", flex: "none" }}>
        {icon}
      </span>
    );
  if (!mark)
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", display: "block" }}>
        <circle cx="8" cy="8" r="8" fill="currentColor" opacity=".14" />
        <text x="8" y="11.4" textAnchor="middle" fontSize="9.5" fontWeight="500" fill="currentColor" fontFamily="inherit">
          {(host[0] ?? "?").toUpperCase()}
        </text>
      </svg>
    );
  const { d, fill } = brandMarks[mark];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", display: "block" }}>
      <path d={d} fill={fill ?? "currentColor"} />
    </svg>
  );
}

function normalize(source: SourceCardsSource, index: number): NormalizedSource {
  const host = hostOf(source.url);
  const mark = source.mark ?? hostMarks.find(([pattern]) => pattern.test(host))?.[1];
  let path = "";
  try {
    const parsed = new URL(source.url);
    path = parsed.pathname === "/" ? "" : decodeURIComponent(parsed.pathname);
  } catch {
    path = "";
  }
  return {
    key: source.id ?? `${source.url}#${index}`,
    n: index + 1,
    source,
    host,
    domain: domainOf(host),
    path,
    site: source.site ?? (mark ? markNames[mark] : host),
    mark,
  };
}

/** Inline citation that highlights its source card for 2.6 s, or keeps it highlighted while `highlighted` is controlled. */
export function SourceCitation({ n, onClick, className }: SourceCitationProps) {
  const context = useContext(SourceContext);
  const source = context?.sources[n - 1];
  const active = context?.highlighted === n;
  return (
    <button
      type="button"
      className={cx(styles.cite, className)}
      data-active={active || undefined}
      aria-label={source ? `Source ${n}: ${source.source.title}, ${source.host}` : `Source ${n}`}
      onClick={(event) => {
        context?.highlight(n);
        onClick?.(event);
      }}
    >
      {n}
    </button>
  );
}

/** Animates a wrapper's height when its content resizes, so streamed rows push the page instead of snapping. */
function useHeightTransition(reduced: boolean) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let controls: AnimationPlaybackControls | undefined;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    const reset = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      controls = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || widthChanged) {
        reset();
        return;
      }
      outer.style.overflow = "clip";
      outer.style.overflowClipMargin = "8px";
      controls = animate(outer, { height: [from, nextHeight] }, { type: "spring", visualDuration: 0.3, bounce: 0, onComplete: reset });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [reduced]);
  return { outerRef, innerRef };
}

function Spinner() {
  return (
    <svg className={styles.spinner} width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** A number that rolls 5 px in the direction it changed, with tabular width reserved for its digits. */
function RollingValue({ value, reduced }: { value: number; reduced: boolean }) {
  const text = String(value);
  return (
    <span className={styles.roll} style={{ minWidth: `${text.length}ch` }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          className={styles.rollValue}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -5 }}
          transition={{ duration: reduced ? 0.1 : 0.16, ease: easeEnter }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function SourceCards({
  sources = [],
  status = "done",
  total,
  query,
  duration,
  max = 3,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  highlighted,
  onHighlightChange,
  onSourceClick,
  onRetry,
  error,
  hideStatus = false,
  children,
  label = "Sources",
  className,
}: SourceCardsProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const items = useMemo(() => sources.map(normalize), [sources]);
  const count = items.length;
  const searching = status === "searching";
  const visibleMax = Math.max(1, max);

  const [openState, setOpenState] = useState(defaultExpanded);
  const open = expanded ?? openState;
  const setOpen = useCallback(
    (next: boolean) => {
      if (expanded === undefined) setOpenState(next);
      onExpandedChange?.(next);
    },
    [expanded, onExpandedChange],
  );

  const [internalHighlight, setInternalHighlight] = useState<{ n: number | null; at: number }>({ n: null, at: 0 });
  const active = highlighted !== undefined ? highlighted : internalHighlight.n;
  const highlight = useCallback(
    (n: number | null) => {
      if (highlighted === undefined) setInternalHighlight((state) => ({ n, at: state.at + 1 }));
      onHighlightChange?.(n);
      if (n !== null && n > visibleMax && n <= count && !open) setOpen(true);
    },
    [highlighted, onHighlightChange, visibleMax, count, open, setOpen],
  );
  useEffect(() => {
    if (highlighted !== undefined || internalHighlight.n === null) return;
    const timer = window.setTimeout(() => setInternalHighlight((state) => ({ ...state, n: null })), 2600);
    return () => window.clearTimeout(timer);
  }, [highlighted, internalHighlight]);

  // Arrival animation runs on the first frame after mount so the server-rendered list does not jump.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const [preview, setPreview] = useState<{ n: number; align: "start" | "end"; side: "top" | "bottom" } | null>(null);
  const timers = useRef<{ open?: number; close?: number; lastClosed: number }>({ lastClosed: 0 });
  const clearTimers = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  };
  const placement = (n: number, element: HTMLElement) => {
    const container = root.current;
    const rect = element.getBoundingClientRect();
    const bounds = container?.getBoundingClientRect() ?? rect;
    return {
      n,
      align: (rect.left - bounds.left + 304 > bounds.width + 1 ? "end" : "start") as "start" | "end",
      side: (rect.top < 220 ? "bottom" : "top") as "top" | "bottom",
    };
  };
  const openPreview = (n: number, element: HTMLElement, stamp: number, immediate = false) => {
    clearTimers();
    const instant = preview !== null || stamp - timers.current.lastClosed < 400;
    if (immediate || instant) setPreview(placement(n, element));
    else timers.current.open = window.setTimeout(() => setPreview(placement(n, element)), 320);
  };
  const closePreview = (delay = 80) => {
    clearTimers();
    timers.current.close = window.setTimeout(() => {
      setPreview(null);
      timers.current.lastClosed = performance.now();
    }, delay);
  };
  useEffect(() => () => clearTimers(), []);

  const slotCount = searching ? Math.max(count, total ?? visibleMax) : count;
  const shown = open ? items : items.slice(0, visibleMax);
  const filled = open ? slotCount : Math.min(slotCount, visibleMax);
  const overflow = open ? [] : items.slice(visibleMax);
  const hasStack = !open && slotCount > visibleMax;
  const canExpand = count > visibleMax && (!searching || open);
  const isEmpty = !searching && status !== "error" && count === 0;
  const showGrid = filled > 0 || hasStack;

  const answerHeight = useHeightTransition(reduced);
  const gridHeight = useHeightTransition(reduced);

  const kind: "searching" | "error" | "empty" | "done" = searching
    ? "searching"
    : status === "error"
      ? "error"
      : isEmpty
        ? "empty"
        : "done";
  const liveText =
    kind === "searching"
      ? `Searching${query ? ` for ${query}` : ""}`
      : kind === "error"
        ? `Search failed. ${error ?? ""}`.trim()
        : kind === "empty"
          ? "No sources found"
          : `${count} ${count === 1 ? "source" : "sources"} found`;
  const slotExit = { opacity: 0, transition: { duration: 0.12, ease: easeEnter } };
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.1 } },
    transition: { duration: 0.16, ease: easeEnter },
  };

  const glyph =
    kind === "searching" ? (
      <Spinner />
    ) : kind === "error" ? (
      <CircleAlert size={14} strokeWidth={1.75} />
    ) : kind === "empty" ? (
      <SearchX size={14} strokeWidth={1.75} />
    ) : (
      <Globe size={14} strokeWidth={1.75} />
    );
  const statusLabel =
    kind === "searching" ? (
      <>
        <TextShimmer className={styles.shimmer}>Searching</TextShimmer>
        {total !== undefined || count > 0 ? (
          <span className={styles.statusCount}>
            <RollingValue value={count} reduced={reduced} />
            {total !== undefined ? <> of {Math.max(total, count)}</> : " found"}
          </span>
        ) : null}
      </>
    ) : kind === "error" ? (
      <span>Search failed</span>
    ) : kind === "empty" ? (
      <span>No sources found</span>
    ) : (
      <span>
        <RollingValue value={count} reduced={reduced} /> {count === 1 ? "source" : "sources"}
      </span>
    );
  const detail = kind === "error" ? error : kind === "done" ? (duration !== undefined ? `${(duration / 1e3).toFixed(1)}s` : undefined) : query;

  const action =
    kind === "error" && onRetry ? (
      <Button key="retry" variant="secondary" size="sm" className={styles.action} onClick={onRetry}>
        <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
        Retry
      </Button>
    ) : kind === "empty" && onRetry ? (
      <Button key="again" variant="secondary" size="sm" className={styles.action} onClick={onRetry}>
        <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
        Search again
      </Button>
    ) : canExpand ? (
      <button key="toggle" type="button" className={styles.toggle} aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(!open)}>
        <span className={styles.toggleLabel}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={open ? "less" : "all"} {...fade}>
              {open ? "Show fewer" : `Show all ${count}`}
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronDown size={14} strokeWidth={1.75} className={styles.toggleIcon} aria-hidden="true" />
      </button>
    ) : null;

  const context = useMemo(() => ({ sources: items, highlighted: active, highlight }), [items, active, highlight]);

  return (
    <SourceContext.Provider value={context}>
      <div
        ref={root}
        className={cx(styles.root, className)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && preview) {
            event.stopPropagation();
            setPreview(null);
          }
        }}
      >
        <span className={styles.srOnly} aria-live="polite">
          {liveText}
        </span>
        {hideStatus ? null : (
          <div className={styles.header}>
            <div className={styles.statusLine} data-status={kind}>
              <span className={styles.statusIcon} aria-hidden="true">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span key={kind} className={styles.statusGlyph} {...fade}>
                    {glyph}
                  </motion.span>
                </AnimatePresence>
              </span>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span key={kind} className={styles.statusText} {...fade}>
                  <span className={styles.statusLabel}>{statusLabel}</span>
                  {detail ? (
                    <span className={styles.statusDetail}>
                      <span aria-hidden="true">·</span> {detail}
                    </span>
                  ) : null}
                </motion.span>
              </AnimatePresence>
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              {action ? (
                <motion.span key={kind === "error" || kind === "empty" ? kind : "toggle"} className={styles.headerAction} {...fade}>
                  {action}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        )}
        {children !== undefined ? (
          <div ref={answerHeight.outerRef}>
            <div ref={answerHeight.innerRef} className={styles.answer}>
              {children}
            </div>
          </div>
        ) : null}
        <div ref={gridHeight.outerRef}>
          <div ref={gridHeight.innerRef}>
            <AnimatePresence initial={false}>
              {showGrid ? (
                <motion.ul
                  key="grid"
                  id={`${id}-list`}
                  className={styles.grid}
                  aria-label={label}
                  aria-busy={searching || undefined}
                  style={{ "--sc-cols": visibleMax + 1 } as CSSProperties}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    {Array.from({ length: filled }, (_, index) => {
                      const item = shown[index];
                      const cardPreview = item && preview?.n === item.n ? preview : null;
                      return (
                        <motion.li key={`slot-${index}`} className={styles.slot} data-open={cardPreview ? "" : undefined} exit={slotExit}>
                          <AnimatePresence initial={false}>
                            {item ? null : (
                              <motion.span
                                key="skeleton"
                                className={styles.skeleton}
                                aria-hidden="true"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                transition={{ duration: 0.16 }}
                              >
                                <span className={styles.skeletonTop}>
                                  <span className={styles.bar} style={{ width: 14 }} />
                                  <span className={styles.bar} style={{ width: "44%" }} />
                                </span>
                                <span className={styles.bar} style={{ width: "88%" }} />
                                <span className={styles.bar} style={{ width: "62%" }} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {item ? (
                            <Card
                              key={item.key}
                              item={item}
                              highlighted={active === item.n}
                              enter={entered}
                              reduced={reduced}
                              describedBy={cardPreview ? `${id}-preview-${item.n}` : undefined}
                              onSourceClick={onSourceClick}
                              handlers={{
                                onPointerEnter: (event) => {
                                  if (event.pointerType === "mouse") openPreview(item.n, event.currentTarget, event.timeStamp);
                                },
                                onPointerLeave: (event) => {
                                  if (event.pointerType === "mouse") closePreview();
                                },
                                onFocus: (event) => {
                                  if (event.currentTarget.matches(":focus-visible"))
                                    openPreview(item.n, event.currentTarget, event.timeStamp, true);
                                },
                                onBlur: () => closePreview(0),
                              }}
                            />
                          ) : null}
                          <AnimatePresence>
                            {cardPreview && item ? (
                              <Preview key="preview" id={`${id}-preview-${item.n}`} item={item} placement={cardPreview} reduced={reduced} />
                            ) : null}
                          </AnimatePresence>
                        </motion.li>
                      );
                    })}
                    {hasStack ? (
                      <motion.li key="stack" className={styles.slot} exit={slotExit}>
                        <AnimatePresence initial={false}>
                          {overflow.length ? null : (
                            <motion.span
                              key="skeleton"
                              className={styles.skeleton}
                              aria-hidden="true"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0, transition: { duration: 0.12 } }}
                              transition={{ duration: 0.16 }}
                            >
                              <span className={styles.skeletonTop}>
                                <span className={cx(styles.bar, styles.barMarks)} />
                              </span>
                              <span className={styles.bar} style={{ width: "46%" }} />
                              <span className={styles.bar} style={{ width: "70%" }} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {overflow.length ? (
                          <motion.button
                            type="button"
                            className={cx(styles.card, styles.stack)}
                            aria-expanded={false}
                            aria-controls={`${id}-list`}
                            aria-label={`Show ${overflow.length} more ${overflow.length === 1 ? "source" : "sources"}: ${overflow.map((item) => item.site).join(", ")}`}
                            initial={entered ? { opacity: 0 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.18, ease: easeEnter }}
                            onClick={() => setOpen(true)}
                          >
                            <span className={styles.stackMarks} aria-hidden="true">
                              <AnimatePresence initial={false}>
                                {overflow.slice(0, 3).map((item, index) => (
                                  <motion.span
                                    key={item.key}
                                    className={styles.stackMark}
                                    style={{ zIndex: 3 - index }}
                                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", visualDuration: 0.22, bounce: 0 }}
                                  >
                                    <SourceMark mark={item.mark} icon={item.source.icon} host={item.host} size={12} />
                                  </motion.span>
                                ))}
                              </AnimatePresence>
                            </span>
                            <span className={styles.stackText}>
                              <span className={styles.stackCount}>
                                +<RollingValue value={overflow.length} reduced={reduced} /> more
                              </span>
                              <span className={styles.stackSites}>
                                {[...new Set(overflow.map((item) => item.site.split(" · ")[0]))].join(", ")}
                              </span>
                            </span>
                          </motion.button>
                        ) : null}
                      </motion.li>
                    ) : null}
                  </AnimatePresence>
                </motion.ul>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </SourceContext.Provider>
  );
}

interface CardHandlers {
  onPointerEnter: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => void;
  onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
}

function Card({
  item,
  highlighted,
  enter,
  reduced,
  describedBy,
  onSourceClick,
  handlers,
}: {
  item: NormalizedSource;
  highlighted: boolean;
  enter: boolean;
  reduced: boolean;
  describedBy?: string;
  onSourceClick?: (source: SourceCardsSource, n: number) => void;
  handlers: CardHandlers;
}) {
  const { source, n, host } = item;
  const body = (
    <>
      <span className={styles.cardTop}>
        <span className={styles.cardMark}>
          <SourceMark mark={item.mark} icon={source.icon} host={host} />
        </span>
        <span className={styles.domain}>{item.domain}</span>
        <span className={cx(styles.chip, styles.cardChip)} aria-hidden="true">
          {n}
        </span>
      </span>
      <span className={styles.cardTitle}>{source.title}</span>
    </>
  );
  const shared = {
    className: styles.card,
    "data-highlighted": highlighted || undefined,
    "aria-describedby": describedBy,
    initial: enter ? (reduced ? { opacity: 0 } : { opacity: 0, y: 4 }) : false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, ease: easeEnter },
    ...handlers,
  };
  return onSourceClick ? (
    <motion.button type="button" {...shared} aria-label={`${n}. ${source.title}, ${host}`} onClick={() => onSourceClick(source, n)}>
      {body}
    </motion.button>
  ) : (
    <motion.a {...shared} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${n}. ${source.title}, ${host}, opens in a new tab`}>
      {body}
    </motion.a>
  );
}

function Preview({
  id,
  item,
  placement,
  reduced,
}: {
  id: string;
  item: NormalizedSource;
  placement: { align: "start" | "end"; side: "top" | "bottom" };
  reduced: boolean;
}) {
  const offset = placement.side === "top" ? 4 : -4;
  return (
    <motion.div
      id={id}
      role="tooltip"
      className={styles.preview}
      data-side={placement.side}
      data-align={placement.align}
      style={{ transformOrigin: `${placement.align === "start" ? "left" : "right"} ${placement.side === "top" ? "bottom" : "top"}` }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: offset, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.16, ease: easeEnter }}
    >
      <span className={styles.previewHead}>
        <SourceMark mark={item.mark} icon={item.source.icon} host={item.host} size={16} />
        <span className={styles.previewSite}>{item.site}</span>
        {item.source.published ? <span className={styles.previewDate}>{item.source.published}</span> : null}
      </span>
      <span className={styles.previewTitle}>{item.source.title}</span>
      {item.source.snippet ? <span className={styles.previewSnippet}>{item.source.snippet}</span> : null}
      <span className={styles.previewUrl}>
        <span className={styles.previewPath}>
          {item.host}
          {item.path}
        </span>
        <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </motion.div>
  );
}

const sampleSources: SourceCardsSource[] = [
  {
    title: "Check the webhook signatures",
    url: "https://docs.stripe.com/webhooks/signature",
    published: "Oct 9, 2026",
    snippet:
      "Stripe signs every webhook event it sends by including a signature in the Stripe-Signature header. Verify it with constructEvent, the raw request body and your endpoint's secret before you trust the payload.",
  },
  {
    title: "Request: text() method",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Request/text",
    published: "Sep 18, 2026",
    snippet:
      "The text() method of the Request interface reads the request body and returns it as a promise that resolves with a string. The body is always decoded using UTF-8.",
  },
  {
    title: 'constructEvent throws "No signatures found" in App Router',
    url: "https://github.com/stripe/stripe-node/issues/2241",
    site: "GitHub · stripe/stripe-node",
    published: "Oct 21, 2026",
    snippet:
      "The body had already been parsed with request.json(), so the string passed to constructEvent no longer matched the signed bytes. Switching to await request.text() fixed it on Next.js 16.",
  },
  {
    title: "Stripe webhook signature verification failed in a Next.js route handler",
    url: "https://stackoverflow.com/questions/79184412/stripe-webhook-signature-verification-failed-nextjs",
    published: "Oct 3, 2026",
    snippet:
      "Accepted answer: do not parse the body. Read it as text, pass the string and the stripe-signature header to constructEvent, and use the whsec_ secret for this endpoint, not your API key.",
  },
  {
    title: "Handling Stripe webhooks in Vercel Functions",
    url: "https://vercel.com/guides/stripe-webhooks-vercel-functions",
    published: "Aug 27, 2026",
    snippet:
      "Run the route on the Node.js runtime, read the raw body, verify the event and respond with a 2xx before doing slow work. Queue anything longer so the delivery never times out.",
  },
  {
    title: "HMAC",
    url: "https://en.wikipedia.org/wiki/HMAC",
    published: "Oct 12, 2026",
    snippet:
      "In cryptography, an HMAC is a specific type of message authentication code involving a cryptographic hash function and a secret cryptographic key. It verifies both the data integrity and the authenticity of a message.",
  },
  {
    title: "Receive Stripe events in your webhook endpoint",
    url: "https://docs.stripe.com/webhooks",
    published: "Oct 9, 2026",
    snippet:
      "In live mode, Stripe retries undelivered events with exponential backoff for up to three days. Return a successful status code quickly, before any complex logic that could cause a timeout.",
  },
];

type AnswerUnit = string | { code: string } | { cite: number };

const sampleAnswer: AnswerUnit[] = [
  "Stripe signs the exact bytes it sends, so read the raw body with ",
  { code: "await request.text()" },
  " before anything parses it ",
  { cite: 1 },
  { cite: 2 },
  ". ",
  "Calling ",
  { code: "request.json()" },
  " first re-serializes the payload, the HMAC no longer matches and ",
  { code: "constructEvent" },
  " throws ",
  { cite: 3 },
  { cite: 4 },
  ". ",
  "Pass that string with the ",
  { code: "stripe-signature" },
  " header and the endpoint's ",
  { code: "whsec_" },
  " secret, keep the route on the Node.js runtime and return a 2xx quickly, since Stripe retries failed deliveries for up to three days ",
  { cite: 5 },
  { cite: 7 },
  ". ",
  "The signature itself is an HMAC-SHA256 of the timestamp and payload ",
  { cite: 6 },
  ".",
];

const sampleNote = "Sample sources. Simulated search, nothing was fetched.";
const easeChunk = [...motionTokens.ease.standard] as [number, number, number, number];

function Answer({ units, chunks }: { units: AnswerUnit[]; chunks: number[] }) {
  return (
    <p className={styles.answerText}>
      {chunks.map((end, index) => {
        const start = index === 0 ? 0 : chunks[index - 1];
        return (
          <span key={index} className={styles.chunk}>
            {units.slice(start, end).map((unit, offset) => {
              const key = start + offset;
              return typeof unit === "string" ? (
                <Fragment key={key}>{unit}</Fragment>
              ) : "code" in unit ? (
                <code key={key} className={styles.code}>
                  {unit.code}
                </code>
              ) : (
                <SourceCitation key={key} n={unit.cite} />
              );
            })}
          </span>
        );
      })}
    </p>
  );
}

/** Self-playing demo: streams a search, answers with citations, opens the stack, then loops until the visitor interacts. */
export function SourceCardsSimulation({ scenario = "live", className }: SourceCardsSimulationProps) {
  const reduced = useReducedMotion() ?? false;
  const panel = useRef<HTMLDivElement>(null);
  const units = useMemo<AnswerUnit[]>(
    () => sampleAnswer.flatMap<AnswerUnit>((unit) => (typeof unit === "string" ? [...(unit.match(/\S+\s*|\s+/g) ?? [])] : [unit])),
    [],
  );
  const [mode, setMode] = useState(scenario);
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<SourceCardsStatus>("searching");
  const [chunks, setChunks] = useState<number[] | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(sampleNote);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [restarting, setRestarting] = useState(false);
  const interrupted = useRef(false);
  const clearHighlight = useRef<number | undefined>(undefined);
  const question = useHeightTransition(reduced);
  const body = useHeightTransition(reduced);
  const [previous, setPrevious] = useState(scenario);

  if (scenario !== previous) {
    setPrevious(scenario);
    setMode(scenario);
    setRun((value) => value + 1);
  }

  useEffect(() => {
    const node = panel.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, reduced ? Math.min(ms, 400) : ms));
      });
    const reset = () => {
      setCount(0);
      setStatus("searching");
      setChunks(null);
      setHighlighted(null);
      setExpanded(false);
      setDuration(undefined);
      setNote(sampleNote);
    };
    interrupted.current = false;
    void (async () => {
      let looped = false;
      do {
        reset();
        if (looped && (await wait(380), cancelled)) return;
        setRestarting(false);
        looped = true;
        const started = performance.now();
        if ((await wait(420), cancelled)) return;
        if (mode === "empty") {
          if ((await wait(1500), cancelled)) return;
          setStatus("done");
          return;
        }
        const limit = mode === "error" ? 2 : sampleSources.length;
        for (let n = 1; n <= limit; n++) {
          setCount(n);
          if (await wait(n <= 3 ? 300 : 220), cancelled) return;
        }
        if (mode === "error") {
          if ((await wait(520), cancelled)) return;
          setStatus("error");
          return;
        }
        setDuration(performance.now() - started);
        setStatus("done");
        if ((await wait(320), cancelled)) return;
        const visible: number[] = [];
        for (let end = 0; end < units.length && !cancelled; ) {
          end = Math.min(units.length, end + 3 + Math.floor(5 * Math.random()));
          visible.push(end);
          setChunks([...visible]);
          await wait(34);
        }
        if (
          cancelled ||
          (await wait(1100), cancelled || interrupted.current) ||
          (setHighlighted(2), await wait(1500), cancelled || interrupted.current) ||
          (setHighlighted(6), setExpanded(true), await wait(1800), cancelled || interrupted.current) ||
          (setHighlighted(null), await wait(240), setExpanded(false), await wait(3600), cancelled || interrupted.current)
        )
          return;
        setRestarting(true);
        await wait(200);
      } while (!cancelled && !interrupted.current);
    })();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [inView, run, mode, units, reduced]);

  useEffect(() => () => window.clearTimeout(clearHighlight.current), []);

  const sources = sampleSources.slice(0, count);
  const prompt =
    mode === "empty"
      ? "Where is the changelog for our internal billing-sync service?"
      : "Why does my Stripe webhook fail signature verification in a Next.js route handler?";

  return (
    <div
      ref={panel}
      className={[styles.panel, className].filter(Boolean).join(" ")}
      onPointerDown={() => {
        interrupted.current = true;
      }}
      onKeyDown={() => {
        interrupted.current = true;
      }}
    >
      <div ref={question.outerRef} className={styles.questionBox}>
        <div ref={question.innerRef} className={styles.question}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={prompt}
              className={styles.questionText}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: easeChunk }}
            >
              {prompt}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <motion.div className={styles.body} initial={false} animate={{ opacity: restarting ? 0 : 1 }} transition={{ duration: restarting ? 0.18 : 0.2, ease: easeChunk }}>
        <SourceCards
          sources={sources}
          status={status}
          total={mode === "live" ? sampleSources.length : mode === "error" ? 7 : undefined}
          query={mode === "empty" ? "billing-sync service changelog" : "stripe webhook signature verification next.js route handler"}
          duration={duration}
          error="The search provider timed out after 8s."
          expanded={expanded}
          onExpandedChange={setExpanded}
          highlighted={highlighted}
          onHighlightChange={(n) => {
            setHighlighted(n);
            window.clearTimeout(clearHighlight.current);
            if (n !== null) clearHighlight.current = window.setTimeout(() => setHighlighted(null), 2600);
          }}
          onSourceClick={(source, n) => {
            setHighlighted(n);
            window.clearTimeout(clearHighlight.current);
            clearHighlight.current = window.setTimeout(() => setHighlighted(null), 2600);
            setNote(`Would open ${hostOf(source.url)}. Simulated, nothing was opened.`);
          }}
          onRetry={() => {
            interrupted.current = false;
            setMode("live");
            setRun((value) => value + 1);
          }}
        >
          {chunks ? <Answer units={units} chunks={chunks} /> : null}
        </SourceCards>
      </motion.div>
      <p className={styles.note} aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={note}
            className={styles.noteText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: easeChunk }}
          >
            {note}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}

const demoOptions = [
  { value: "live", label: "Live" },
  { value: "error", label: "Failed" },
  { value: "empty", label: "No results" },
];

/** Preview: the same search played three ways, so the empty and failed states are one click away. */
export function SourceCardsDemo() {
  const [scenario, setScenario] = useState("live");
  return (
    <div className={styles.demo}>
      <SegmentedControl options={demoOptions} value={scenario} onValueChange={setScenario} label="Search scenario" />
      <SourceCardsSimulation scenario={scenario as "live" | "error" | "empty"} />
    </div>
  );
}

export default SourceCards;
