"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import { ChevronDown, CornerDownLeft, Search, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./morph-nav.module.css";

export interface MorphNavLink {
  label: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
}

export interface MorphNavItem {
  value: string;
  label: string;
  href?: string;
  links?: MorphNavLink[];
  /** Link grid columns. Defaults to two when the panel has more than three links. */
  columns?: 1 | 2;
  feature?: ReactNode;
  footer?: ReactNode;
}

export interface MorphNavBrand {
  name: string;
  mark: ReactNode;
  href?: string;
}

export interface MorphNavAction {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface MorphNavSearchItem {
  label: string;
  description?: string;
  group?: string;
  icon?: ReactNode;
  href?: string;
  /** Extra words that should match the query without being visible. */
  keywords?: string;
}

export interface MorphNavSearch {
  placeholder?: string;
  items: MorphNavSearchItem[];
}

export interface MorphNavNavigateDetail {
  label: string;
  href?: string;
  section?: string;
}

export interface MorphNavProps {
  /** Top-level sections. An item without links or a feature renders as a plain link. */
  items: MorphNavItem[];
  brand?: MorphNavBrand;
  action?: MorphNavAction;
  search?: MorphNavSearch;
  /** Value of the active section; it gets the dot marker and `aria-current`. */
  current?: string;
  /** Shrinks the bar to `--bar-h: 46px` and hides the brand name. */
  compact?: boolean;
  /** Container width in pixels below which the sections collapse into one menu. */
  collapseBelow?: number;
  onNavigate?: (detail: MorphNavNavigateDetail) => void;
  label?: string;
  className?: string;
}

/** Springs are declared by visual duration so the feel is independent of the distance travelled. */
const spring = (visualDuration: number, bounce: number): Transition => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const SPRING_AREA = spring(0.44, 0.06);
const SPRING_AREA_BACK = spring(0.34, 0);
const SPRING_INDICATOR = spring(0.3, 0.04);
const SPRING_FACE = spring(0.4, 0);

const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const EASE_STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];

const MENU_FACE = "__menu";
const SEARCH_FACE = "__search";

const FACE_VARIANTS: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: 20 * direction,
    y: direction ? 0 : -4,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    transition: {
      x: SPRING_FACE,
      y: SPRING_FACE,
      opacity: { duration: 0.24, ease: EASE_ENTER, delay: 0.04 },
      filter: { duration: 0.26, ease: EASE_ENTER, delay: 0.04 },
    },
  },
  gone: (direction: number) => ({
    opacity: 0,
    x: -(20 * direction * 0.5),
    y: direction ? 0 : -2,
    filter: `blur(${motionTokens.blur.soft}px)`,
    transition: {
      x: SPRING_FACE,
      y: { duration: 0.14, ease: EASE_STANDARD },
      opacity: { duration: 0.12, ease: EASE_STANDARD },
      filter: { duration: 0.12, ease: EASE_STANDARD },
    },
  }),
};

/** The reduced-motion face keeps its own fade-only variant set so nothing slides. */
const FACE_VARIANTS_REDUCED: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.16 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

interface PanelFaceProps {
  id: string;
  direction: number;
  reduced: boolean | null;
  onSize: (id: string, width: number, height: number) => void;
  className?: string;
  children: ReactNode;
  onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

/**
 * A panel or the search bar, mounted inside AnimatePresence. It reports its own box after layout
 * so the surface around it can grow to exactly that height before the face is painted.
 */
function PanelFace({ id, direction, reduced, onSize, className, children, onClick }: PanelFaceProps) {
  const node = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    const report = () => onSize(id, element.offsetWidth, element.offsetHeight);
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, onSize]);

  return (
    <motion.div
      ref={node}
      className={[styles.face, className].filter(Boolean).join(" ")}
      data-face={id}
      custom={direction}
      variants={reduced ? FACE_VARIANTS_REDUCED : FACE_VARIANTS}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!present || undefined}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

export function MorphNav({
  items,
  brand,
  action,
  search,
  current,
  compact = false,
  collapseBelow = 720,
  onNavigate,
  label = "Main",
  className,
}: MorphNavProps) {
  const reduced = useReducedMotion();
  const id = useId();
  const panelId = `${id}-panel`;
  const resultsId = `${id}-results`;

  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const searchBar = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);

  const [mode, setMode] = useState<"nav" | "search">("nav");
  const [openValue, setOpenValue] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const [narrow, setNarrow] = useState(false);

  const menuItem = useMemo<MorphNavItem>(() => ({ value: MENU_FACE, label: "Menu" }), []);
  const sections = narrow ? [menuItem] : items;
  const hasPanel = (item: MorphNavItem) =>
    item.value === MENU_FACE || !!item.links?.length || !!item.feature;

  const openKey = mode === "search" ? SEARCH_FACE : openValue;
  const openIndex = sections.findIndex((item) => item.value === openValue);
  const openItem = openIndex >= 0 ? sections[openIndex] : null;

  const results = useMemo(() => {
    const pool = search?.items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return pool.slice(0, 5);
    return pool
      .map((item) => {
        const labelText = item.label.toLowerCase();
        const rank = labelText.startsWith(needle)
          ? 3
          : labelText.includes(needle)
            ? 2
            : +!!`${item.description ?? ""} ${item.group ?? ""} ${item.keywords ?? ""}`
                .toLowerCase()
                .includes(needle);
        return { item, rank };
      })
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 6)
      .map((entry) => entry.item);
  }, [query, search]);

  const activeIndex = Math.min(activeResult, Math.max(0, results.length - 1));

  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const radius = useMotionValue(28);

  // Measurements arrive from three observers (bar, container, face). The surface animation needs all
  // of them, so every report lands in refs and one microtask folds them into a single transition.
  const sizes = useRef({
    nav: { w: 0, h: 0 },
    search: { w: 0, h: 0 },
    panel: null as { id: string; w: number; h: number } | null,
  });
  const phase = useRef({
    panelKey: null as string | null,
    mode: "nav" as "nav" | "search",
    reduced: false,
    ready: false,
  });
  const drawn = useRef({ w: 0, h: 0, r: 0 });
  const running = useRef({ settled: true });
  const forced = useRef(false);
  const queued = useRef(false);

  const resize = useCallback(() => {
    queued.current = false;
    const state = phase.current;
    const measured = sizes.current;
    const box = state.mode === "search" ? measured.search : measured.nav;
    if (!box.w || !measured.nav.h) return;
    const face = state.panelKey && measured.panel?.id === state.panelKey ? measured.panel : null;
    const next = {
      w: Math.max(box.w, face?.w ?? 0),
      h: measured.nav.h + (face?.h ?? 0),
      r: face ? 22 : measured.nav.h / 2,
    };
    const previous = drawn.current;
    const changed =
      Math.abs(next.w - previous.w) > 0.5 ||
      Math.abs(next.h - previous.h) > 0.5 ||
      Math.abs(next.r - previous.r) > 0.5;
    const instant = forced.current;
    forced.current = false;
    if (!changed) return;
    drawn.current = next;
    // The first paint, reduced motion and a fully settled surface jump; everything else springs, so
    // opening a panel never waits for the surface to finish growing before showing its content.
    if (!state.ready || state.reduced || (!instant && running.current.settled)) {
      width.jump(next.w);
      height.jump(next.h);
      radius.jump(next.r);
      const element = surface.current;
      if (element) {
        element.style.width = `${next.w}px`;
        element.style.height = `${next.h}px`;
        element.style.borderRadius = `${next.r}px`;
      }
      phase.current.ready = true;
      return;
    }
    const settle = next.w * next.h >= previous.w * previous.h ? SPRING_AREA : SPRING_AREA_BACK;
    const token = { settled: false };
    running.current = token;
    Promise.all([
      animate(width, next.w, settle),
      animate(height, next.h, settle),
      animate(radius, next.r, settle),
    ]).then(() => {
      token.settled = true;
    });
  }, [height, radius, width]);

  const schedule = useCallback(
    (force = false) => {
      if (force) forced.current = true;
      if (queued.current) return;
      queued.current = true;
      queueMicrotask(resize);
    },
    [resize],
  );

  const reportFace = useCallback(
    (faceId: string, faceWidth: number, faceHeight: number) => {
      sizes.current.panel = { id: faceId, w: faceWidth, h: faceHeight };
      schedule(true);
    },
    [schedule],
  );

  useLayoutEffect(() => {
    phase.current.panelKey = openKey;
    phase.current.mode = mode;
    phase.current.reduced = !!reduced;
    schedule(true);
  }, [mode, openKey, reduced, schedule]);

  useLayoutEffect(() => {
    const barNode = bar.current;
    const searchNode = searchBar.current;
    const container = root.current;
    if (!barNode || !container) return;
    const measure = () => {
      sizes.current.nav = { w: barNode.offsetWidth, h: barNode.offsetHeight };
      if (searchNode) sizes.current.search = { w: searchNode.offsetWidth, h: searchNode.offsetHeight };
      setNarrow(container.offsetWidth < collapseBelow);
      schedule();
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    [barNode, container, searchNode].forEach((node) => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [collapseBelow, schedule]);

  const highlightX = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightOpacity = useMotionValue(0);
  const highlightIndex = hover ?? (openIndex >= 0 ? openIndex : null);

  useLayoutEffect(() => {
    const target =
      highlightIndex === null
        ? null
        : track.current?.querySelector<HTMLElement>(`[data-index="${highlightIndex}"]`) ?? null;
    if (!target) {
      animate(highlightOpacity, 0, { duration: 0.16 * (reduced ? 0 : 1), ease: EASE_STANDARD });
      return;
    }
    const left = target.offsetLeft;
    const targetWidth = target.offsetWidth;
    if (highlightOpacity.get() < 0.05 || reduced) {
      highlightX.jump(left);
      highlightWidth.jump(targetWidth);
    } else {
      animate(highlightX, left, SPRING_INDICATOR);
      animate(highlightWidth, targetWidth, SPRING_INDICATOR);
    }
    animate(highlightOpacity, 1, { duration: 0.14 * (reduced ? 0 : 1), ease: EASE_ENTER });
  }, [highlightIndex, highlightOpacity, highlightWidth, highlightX, reduced, narrow, compact]);

  // Hover intent: opening waits for the pointer to settle, closing waits longer so a diagonal move
  // across the bar does not flicker every panel on the way to the one you meant.
  const timers = useRef<{ open?: number; leave?: number }>({});
  const clearTimers = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.leave);
  };

  useEffect(() => () => clearTimers(), []);

  const focusToken = useRef<string | null>(null);
  const openedAt = useRef(0);
  const isOpen = openValue !== null;

  useEffect(() => {
    if (isOpen) openedAt.current = performance.now();
  }, [isOpen]);

  const changeOpen = (value: string | null) => {
    if (value === openValue) return;
    const from = sections.findIndex((item) => item.value === openValue);
    const to = sections.findIndex((item) => item.value === value);
    setDirection(openValue && value && from >= 0 && to >= 0 ? Math.sign(to - from) : 0);
    setOpenValue(value);
  };

  // Collapsing or expanding the bar changes what the indices mean, so every open panel is dropped
  // in the same render that swaps the section list.
  const [layoutKey, setLayoutKey] = useState(`${compact}-${narrow}`);
  if (layoutKey !== `${compact}-${narrow}`) {
    setLayoutKey(`${compact}-${narrow}`);
    setOpenValue(null);
    setHover(null);
  }

  const close = useCallback(
    (token?: "trigger" | "search-button") => {
      clearTimers();
      if (token === "trigger" && openValue) focusToken.current = `${id}-trigger-${openValue}`;
      if (token === "search-button") focusToken.current = "search-button";
      setOpenValue(null);
      setMode("nav");
      setHover(null);
    },
    [id, openValue],
  );

  const navigate = (detail: MorphNavNavigateDetail) => {
    onNavigate?.(detail);
    close();
  };

  useLayoutEffect(() => {
    const token = focusToken.current;
    if (!token) return;
    focusToken.current = null;
    const container = root.current;
    if (!container) return;
    if (token === "input") input.current?.focus({ preventScroll: true });
    else if (token === "search-button") searchButton.current?.focus({ preventScroll: true });
    else if (token === "panel")
      container
        .querySelector<HTMLElement>(`[data-face="${openKey}"] :is(a[href], button)`)
        ?.focus({ preventScroll: true });
    else document.getElementById(token)?.focus({ preventScroll: true });
  }, [mode, openKey]);

  const active = isOpen || mode === "search";

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node | null)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active, close]);

  /** Pointing at the brand or the tools leaves the section list, so close what it opened. */
  const leaveSections = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(timers.current.open);
    setHover(null);
    if (openValue) changeOpen(null);
  };

  const openResult = (item?: MorphNavSearchItem) => {
    if (!item) return;
    focusToken.current = "search-button";
    navigate({ label: item.label, href: item.href, section: item.group });
  };

  const renderLink = (link: MorphNavLink, section: string, dense = false) => (
    <li key={link.label}>
      {link.href ? (
        <a
          className={styles.link}
          data-dense={dense || undefined}
          href={link.href}
          onClick={() => onNavigate?.({ label: link.label, href: link.href, section })}
        >
          {link.icon && (
            <span className={styles.linkIcon} aria-hidden="true">
              {link.icon}
            </span>
          )}
          <span className={styles.linkText}>
            <span className={styles.linkLabel}>{link.label}</span>
            {!dense && link.description && (
              <span className={styles.linkDescription}>{link.description}</span>
            )}
          </span>
        </a>
      ) : (
        <button
          type="button"
          className={styles.link}
          data-dense={dense || undefined}
          onClick={() => onNavigate?.({ label: link.label, href: link.href, section })}
        >
          {link.icon && (
            <span className={styles.linkIcon} aria-hidden="true">
              {link.icon}
            </span>
          )}
          <span className={styles.linkText}>
            <span className={styles.linkLabel}>{link.label}</span>
            {!dense && link.description && (
              <span className={styles.linkDescription}>{link.description}</span>
            )}
          </span>
        </button>
      )}
    </li>
  );

  const renderPanel = (item: MorphNavItem) => {
    if (item.value === MENU_FACE) {
      return (
        <div className={styles.menu}>
          {items.map((section) =>
            section.links?.length ? (
              <div key={section.value} className={styles.menuGroup}>
                <p className={styles.menuHeading}>{section.label}</p>
                <ul className={styles.links} data-columns="1">
                  {section.links.map((link) => renderLink(link, section.value, true))}
                </ul>
              </div>
            ) : (
              <ul key={section.value} className={styles.links} data-columns="1">
                {renderLink({ label: section.label, href: section.href }, section.value, true)}
              </ul>
            ),
          )}
        </div>
      );
    }
    const columns = item.columns ?? ((item.links?.length ?? 0) > 3 ? 2 : 1);
    return (
      <>
        <div className={styles.panelBody}>
          {!!item.links?.length && (
            <ul className={styles.links} data-columns={columns}>
              {item.links.map((link) => renderLink(link, item.value))}
            </ul>
          )}
          {item.feature && <div className={styles.feature}>{item.feature}</div>}
        </div>
        {item.footer && <div className={styles.footer}>{item.footer}</div>}
      </>
    );
  };

  if (!items.length) return null;

  return (
    <nav
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={label}
      data-compact={compact || undefined}
      data-narrow={narrow || undefined}
      data-open={openKey ? "" : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (mode === "search") {
          event.preventDefault();
          close("search-button");
          return;
        }
        if (openValue) {
          event.preventDefault();
          close("trigger");
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next && !event.currentTarget.contains(next) && openValue) {
          setOpenValue(null);
          setHover(null);
        }
      }}
      onPointerEnter={() => window.clearTimeout(timers.current.leave)}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        window.clearTimeout(timers.current.open);
        setHover(null);
        if (openValue) timers.current.leave = window.setTimeout(() => changeOpen(null), 180);
      }}
    >
      <motion.div
        ref={surface}
        className={styles.surface}
        style={{ width, height, borderRadius: radius }}
      >
        <motion.div
          ref={bar}
          className={styles.bar}
          inert={mode === "search" || undefined}
          initial={false}
          animate={
            mode === "nav"
              ? { opacity: 1, scale: 1, filter: "blur(0px)" }
              : reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, filter: `blur(${motionTokens.blur.soft}px)` }
          }
          transition={
            reduced
              ? { duration: 0.12 }
              : mode === "nav"
                ? {
                    opacity: { duration: 0.22, ease: EASE_ENTER, delay: 0.06 },
                    filter: { duration: 0.24, ease: EASE_ENTER, delay: 0.06 },
                    scale: SPRING_AREA,
                  }
                : { duration: 0.14, ease: EASE_STANDARD }
          }
        >
          {brand && (
            <button
              type="button"
              className={styles.brand}
              onPointerEnter={leaveSections}
              onClick={() => navigate({ label: brand.name, href: brand.href })}
            >
              <span className={styles.brandMark} aria-hidden="true">
                {brand.mark}
              </span>
              <span className={styles.brandName}>
                <span>{brand.name}</span>
              </span>
            </button>
          )}

          <div ref={track} className={styles.track}>
            <motion.span
              className={styles.highlight}
              style={{ x: highlightX, width: highlightWidth, opacity: highlightOpacity }}
              aria-hidden="true"
            />
            {sections.map((item, index) => {
              const expandable = hasPanel(item);
              const expanded = openValue === item.value;
              const currentSection = current === item.value;
              const shared = {
                id: `${id}-trigger-${item.value}`,
                className: styles.item,
                "data-index": index,
                "data-current": currentSection || undefined,
                onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
                  if (event.pointerType !== "mouse") return;
                  window.clearTimeout(timers.current.leave);
                  window.clearTimeout(timers.current.open);
                  setHover(index);
                  const target = sections[index];
                  if (!hasPanel(target)) {
                    if (openValue) changeOpen(null);
                    return;
                  }
                  if (openValue) changeOpen(target.value);
                  else timers.current.open = window.setTimeout(() => changeOpen(target.value), 60);
                },
                onFocus: () => setHover(index),
                onBlur: () => setHover((value) => (value === index ? null : value)),
                onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
                  const target = sections[index];
                  const stops = Array.from(
                    track.current?.querySelectorAll<HTMLElement>("[data-index]") ?? [],
                  );
                  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
                  if (event.key in step || event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? sections.length - 1
                          : (index + step[event.key] + sections.length) % sections.length;
                    stops[next]?.focus();
                    setHover(next);
                    if (openValue) changeOpen(hasPanel(sections[next]) ? sections[next].value : null);
                    return;
                  }
                  if (
                    (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") &&
                    hasPanel(target)
                  ) {
                    event.preventDefault();
                    if (openValue === target.value) {
                      root.current
                        ?.querySelector<HTMLElement>(
                          `[data-face="${target.value}"] :is(a[href], button)`,
                        )
                        ?.focus({ preventScroll: true });
                      return;
                    }
                    focusToken.current = "panel";
                    changeOpen(target.value);
                  }
                },
              };
              return !expandable && item.href ? (
                <a
                  key={item.value}
                  {...shared}
                  href={item.href}
                  aria-current={currentSection ? "page" : undefined}
                  onClick={() => navigate({ label: item.label, href: item.href, section: item.value })}
                >
                  <span>{item.label}</span>
                </a>
              ) : (
                <button
                  key={item.value}
                  type="button"
                  {...shared}
                  aria-current={currentSection ? "page" : undefined}
                  aria-expanded={expandable ? expanded : undefined}
                  aria-controls={expandable && expanded ? panelId : undefined}
                  onClick={(event) => {
                    if (!hasPanel(item)) {
                      navigate({ label: item.label, href: item.href, section: item.value });
                      return;
                    }
                    if (openValue === item.value) {
                      if (event.timeStamp - openedAt.current > 400) changeOpen(null);
                      return;
                    }
                    changeOpen(item.value);
                  }}
                >
                  <span>{item.label}</span>
                  {expandable && (
                    <motion.span
                      className={styles.chevron}
                      aria-hidden="true"
                      initial={false}
                      animate={{ rotate: 180 * (expanded ? 1 : 0) }}
                      transition={reduced ? { duration: 0 } : SPRING_INDICATOR}
                    >
                      <ChevronDown size={14} strokeWidth={1.75} />
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.tools} onPointerEnter={leaveSections}>
            {search && (
              <button
                ref={searchButton}
                type="button"
                className={styles.tool}
                aria-label="Search"
                onClick={() => {
                  clearTimers();
                  setOpenValue(null);
                  setHover(null);
                  setQuery("");
                  setActiveResult(0);
                  setDirection(0);
                  focusToken.current = "input";
                  setMode("search");
                }}
              >
                <Search size={17} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
            {action &&
              (action.href ? (
                <a className={styles.action} href={action.href} onClick={action.onClick}>
                  {action.icon}
                  <span>{action.label}</span>
                </a>
              ) : (
                <button type="button" className={styles.action} onClick={action.onClick}>
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
          </div>
        </motion.div>

        {search && (
          <motion.div
            ref={searchBar}
            className={styles.searchBar}
            inert={mode !== "search" || undefined}
            initial={false}
            animate={
              mode === "search"
                ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                : reduced
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, filter: `blur(${motionTokens.blur.soft}px)` }
            }
            transition={
              reduced
                ? { duration: 0.12 }
                : mode === "search"
                  ? {
                      opacity: { duration: 0.22, ease: EASE_ENTER, delay: 0.07 },
                      filter: { duration: 0.24, ease: EASE_ENTER, delay: 0.07 },
                      scale: SPRING_AREA,
                    }
                  : { duration: 0.12, ease: EASE_STANDARD }
            }
          >
            <Search
              className={styles.searchIcon}
              size={18}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              ref={input}
              className={styles.input}
              type="text"
              role="combobox"
              aria-label="Search"
              aria-expanded={mode === "search"}
              aria-controls={resultsId}
              aria-autocomplete="list"
              aria-activedescendant={
                mode === "search" && results.length ? `${resultsId}-${activeIndex}` : undefined
              }
              placeholder={search.placeholder ?? "Search"}
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveResult(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (results.length)
                    setActiveResult(
                      (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + results.length) %
                        results.length,
                    );
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  openResult(results[activeIndex]);
                }
              }}
            />
            <button
              type="button"
              className={styles.tool}
              aria-label="Close search"
              onClick={() => close("search-button")}
            >
              <X size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
        )}

        <AnimatePresence initial={false} custom={direction}>
          {mode === "search" && search && (
            <PanelFace
              key={SEARCH_FACE}
              id={SEARCH_FACE}
              direction={0}
              reduced={reduced}
              onSize={reportFace}
              className={styles.resultsFace}
            >
              <p className={styles.resultsHeading} aria-live="polite">
                {query.trim()
                  ? results.length
                    ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                    : `No results for “${query.trim()}”`
                  : "Suggested"}
              </p>
              <ul
                id={resultsId}
                className={styles.results}
                role="listbox"
                aria-label="Search results"
              >
                {results.map((item, index) => (
                  <li
                    key={`${item.group}-${item.label}`}
                    id={`${resultsId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={styles.result}
                    onPointerMove={() => {
                      if (index !== activeIndex) setActiveResult(index);
                    }}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => openResult(item)}
                  >
                    {item.icon && (
                      <span className={styles.linkIcon} aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span className={styles.linkText}>
                      <span className={styles.linkLabel}>{item.label}</span>
                      {item.description && (
                        <span className={styles.linkDescription}>{item.description}</span>
                      )}
                    </span>
                    {item.group && <span className={styles.resultGroup}>{item.group}</span>}
                    <CornerDownLeft
                      className={styles.resultEnter}
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            </PanelFace>
          )}

          {mode === "nav" && openItem && hasPanel(openItem) && (
            <PanelFace
              key={openItem.value}
              id={openItem.value}
              direction={direction}
              reduced={reduced}
              onSize={reportFace}
              onClick={(event) => {
                const target = (event.target as HTMLElement).closest("a, button");
                if (!target || !event.currentTarget.contains(target) || !openValue) return;
                if (event.currentTarget.contains(document.activeElement)) {
                  focusToken.current = `${id}-trigger-${openValue}`;
                } else {
                  focusToken.current = null;
                }
                setOpenValue(null);
                setHover(null);
              }}
            >
              <div
                id={panelId}
                role="region"
                aria-labelledby={`${id}-trigger-${openItem.value}`}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  const stops = Array.from(
                    event.currentTarget.querySelectorAll<HTMLElement>(":is(a[href], button)"),
                  );
                  const index = stops.indexOf(document.activeElement as HTMLElement);
                  if (index < 0) return;
                  event.preventDefault();
                  if (event.key === "ArrowUp" && index === 0 && openValue) {
                    document.getElementById(`${id}-trigger-${openValue}`)?.focus();
                    return;
                  }
                  stops[
                    Math.min(stops.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))
                  ]?.focus();
                }}
              >
                {renderPanel(openItem)}
              </div>
            </PanelFace>
          )}
        </AnimatePresence>
      </motion.div>
    </nav>
  );
}

export default MorphNav;
