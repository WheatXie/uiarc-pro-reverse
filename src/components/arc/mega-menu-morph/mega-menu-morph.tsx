"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { Transition, Variants } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  BuildingComplex,
  ChevronDown,
  CreditCard,
  FileText,
  Heart,
  Layers,
  Menu,
  Newspaper,
  Package,
  Repeat,
  Rocket,
  Send,
  ShieldCheck,
  ShoppingBag,
  SquareTerminal,
  Store,
  Users,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./mega-menu-morph.module.css";

export interface MegaMenuLink {
  label: string;
  description?: string;
  icon?: ReactNode;
  href?: string;
  badge?: string;
}

export interface MegaMenuGroup {
  title?: string;
  links: MegaMenuLink[];
}

export interface MegaMenuFeature {
  title: string;
  description?: string;
  cta?: string;
  href?: string;
  media?: ReactNode;
}

export interface MegaMenuItem {
  value: string;
  label: string;
  href?: string;
  groups?: MegaMenuGroup[];
  feature?: MegaMenuFeature;
  footer?: ReactNode;
}

export interface MegaMenuBrand {
  name: string;
  href?: string;
  mark?: ReactNode;
}

export interface MegaMenuAction {
  label: string;
  href?: string;
  variant?: "primary" | "quiet";
  onClick?: () => void;
}

export interface MegaMenuNavigateDetail {
  label: string;
  href?: string;
  section?: string;
}

export interface MegaMenuMorphProps {
  items?: MegaMenuItem[];
  brand?: MegaMenuBrand;
  actions?: MegaMenuAction[];
  /** Controlled open section. `null` closes the panel. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** The section the visitor is currently browsing, marked with `aria-current`. */
  current?: string;
  openDelay?: number;
  closeDelay?: number;
  /** `auto` collapses into the sheet as soon as the bar no longer fits. */
  collapseBelow?: number | "auto";
  /** Debug overlay for the hover safe area. */
  showSafeArea?: boolean;
  onNavigate?: (detail: MegaMenuNavigateDetail) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Mounted client-side only: the disclosure must not report interactive state before hydration. */
const neverChanges = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

const defaultItems: MegaMenuItem[] = [
  {
    value: "products",
    label: "Products",
    groups: [
      {
        title: "Payments",
        links: [
          { label: "Checkout", description: "Hosted pages in 46 currencies", icon: <CreditCard aria-hidden="true" />, href: "#checkout" },
          { label: "Billing", description: "Subscriptions, usage and invoices", icon: <Repeat aria-hidden="true" />, href: "#billing" },
          { label: "Terminal", description: "In person payments on any reader", icon: <Store aria-hidden="true" />, href: "#terminal" },
        ],
      },
      {
        title: "Operations",
        links: [
          { label: "Payouts", description: "Pay sellers and contractors daily", icon: <Send aria-hidden="true" />, href: "#payouts", badge: "New" },
          { label: "Risk", description: "Fraud scoring trained on your traffic", icon: <ShieldCheck aria-hidden="true" />, href: "#risk" },
          { label: "Reports", description: "Reconcile every payout to the cent", icon: <FileText aria-hidden="true" />, href: "#reports" },
        ],
      },
    ],
    feature: {
      title: "Instant payouts in the EU",
      description: "Sellers in 27 countries now get paid in seconds, weekends included.",
      cta: "Read the announcement",
      href: "#instant-payouts",
    },
  },
  {
    value: "solutions",
    label: "Solutions",
    groups: [
      {
        title: "By stage",
        links: [
          { label: "Startups", icon: <Rocket aria-hidden="true" />, href: "#startups" },
          { label: "Enterprises", icon: <BuildingComplex aria-hidden="true" />, href: "#enterprises" },
          { label: "Platforms", icon: <Layers aria-hidden="true" />, href: "#platforms" },
        ],
      },
      {
        title: "By industry",
        links: [
          { label: "Software", icon: <Package aria-hidden="true" />, href: "#software" },
          { label: "Marketplaces", icon: <Users aria-hidden="true" />, href: "#marketplaces" },
          { label: "Retail", icon: <ShoppingBag aria-hidden="true" />, href: "#retail" },
        ],
      },
    ],
  },
  {
    value: "developers",
    label: "Developers",
    groups: [
      {
        title: "Documentation",
        links: [
          { label: "Quickstart", description: "Take a first payment in 10 minutes", icon: <Zap aria-hidden="true" />, href: "#quickstart" },
          { label: "API reference", description: "Every endpoint, with live examples", icon: <BookOpen aria-hidden="true" />, href: "#api" },
        ],
      },
      {
        title: "Tools",
        links: [
          { label: "CLI", description: "Replay webhooks from your terminal", icon: <SquareTerminal aria-hidden="true" />, href: "#cli" },
          { label: "Webhooks", description: "Signed events with automatic retries", icon: <Webhook aria-hidden="true" />, href: "#webhooks" },
        ],
      },
    ],
    footer: (
      <span className={styles.status}>
        <span className={styles.statusDot} aria-hidden="true" />
        All systems normal
        <span className={styles.statusMeta}>API uptime 99.998% over 90 days</span>
      </span>
    ),
  },
  {
    value: "company",
    label: "Company",
    groups: [
      {
        links: [
          { label: "About", icon: <Heart aria-hidden="true" />, href: "#about" },
          { label: "Customers", icon: <Users aria-hidden="true" />, href: "#customers" },
          { label: "Careers", icon: <Briefcase aria-hidden="true" />, href: "#careers", badge: "12 open roles" },
          { label: "Press", icon: <Newspaper aria-hidden="true" />, href: "#press" },
        ],
      },
    ],
    footer: <span className={styles.footerNote}>Offices in Zurich, Lisbon and New York</span>,
  },
  { value: "pricing", label: "Pricing", href: "#pricing" },
];

const defaultBrand: MegaMenuBrand = {
  name: "Tally",
  href: "#home",
  mark: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="5" fill="currentColor" />
      <path d="M6.5 7.5h7M10 7.5v6" stroke="var(--background)" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
};

const defaultActions: MegaMenuAction[] = [
  { label: "Sign in", href: "#sign-in" },
  { label: "Start now", href: "#start", variant: "primary" },
];

/** Motion tokens are arrays; `motion` wants a bezier tuple. */
const ease = [...motionTokens.ease.standard] as [number, number, number, number];

/**
 * Duration → spring, using motion's own conversion so a `visualDuration` here settles in the same
 * wall time as the shared presets.
 */
const spring = (visualDuration: number, bounce: number): Transition => {
  const omega = (2 * Math.PI) / (1.2 * visualDuration);
  return { type: "spring", stiffness: omega * omega, damping: 2 * (1 - bounce) * omega, mass: 1 };
};

const growSpring = spring(0.42, 0);
const shrinkSpring = spring(0.36, 0);
const slideSpring = spring(0.4, 0);
const highlightSpring = spring(0.32, 0);
const panelSpring = spring(0.42, 0);

const faceVariants: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: 36 * direction,
    filter: `blur(${motionTokens.blur.subtle}px)`,
  }),
  shown: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      x: panelSpring,
      opacity: { duration: motionTokens.duration.standard, ease, delay: 0.05 },
      filter: { duration: motionTokens.duration.standard, ease, delay: 0.05 },
    },
  },
  gone: (direction: number) => ({
    opacity: 0,
    x: -(36 * direction * 0.6),
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: {
      x: panelSpring,
      opacity: { duration: motionTokens.duration.fast, ease },
      filter: { duration: motionTokens.duration.fast, ease },
    },
  }),
};

const quietFaceVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.14 } },
  gone: { opacity: 0, transition: { duration: 0.1 } },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

const hasPanel = (item: MegaMenuItem) => Boolean(item.groups?.length || item.feature);

interface FaceSize {
  w: number;
  h: number;
  footer: number;
}

interface Point {
  x: number;
  y: number;
}

interface PointerSample extends Point {
  t: number;
}

/** Cross-fades between sections, keeps the panel sized to whichever one is showing. */
function Face({
  id,
  direction,
  reduced,
  onSize,
  active,
  children,
}: {
  id: string;
  direction: number;
  reduced: boolean;
  onSize: (id: string, size: FaceSize) => void;
  active: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !isPresent) return;
    const measure = () => {
      const body = node.querySelector<HTMLElement>("[data-mm-body]");
      const footerElement = node.querySelector<HTMLElement>("[data-mm-footer]");
      const footer = footerElement?.offsetHeight ?? 0;
      onSize(id, { w: node.offsetWidth, h: (body?.offsetHeight ?? 0) + footer, footer });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [id, onSize, isPresent]);

  return (
    <motion.div
      ref={ref}
      className={styles.face}
      custom={direction}
      variants={reduced ? quietFaceVariants : faceVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      inert={!isPresent || undefined}
      data-mm-active={active && isPresent ? "" : undefined}
    >
      {children}
    </motion.div>
  );
}

function FaceContent({
  item,
  onPick,
}: {
  item: MegaMenuItem;
  onPick: (event: ReactPointerEvent<HTMLAnchorElement> | React.MouseEvent<HTMLAnchorElement>, detail: MegaMenuNavigateDetail) => void;
}) {
  return (
    <>
      <div className={styles.faceBody} data-mm-body="">
        {item.groups?.map((group, groupIndex) => (
          <div className={styles.group} key={group.title ?? groupIndex}>
            {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
            <ul className={styles.links} data-dense={group.links.every((link) => !link.description) || undefined}>
              {group.links.map((link) => (
                <li key={link.label}>
                  <a
                    className={styles.link}
                    href={link.href ?? "#"}
                    data-mm-link=""
                    onClick={(event) => onPick(event, { label: link.label, href: link.href, section: item.value })}
                  >
                    {link.icon ? <span className={styles.linkIcon}>{link.icon}</span> : null}
                    <span className={styles.linkText}>
                      <span className={styles.linkLabel}>
                        {link.label}
                        {link.badge ? <span className={styles.badge}>{link.badge}</span> : null}
                      </span>
                      {link.description ? <span className={styles.linkDescription}>{link.description}</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {item.feature ? (
          <a
            className={styles.feature}
            href={item.feature.href ?? "#"}
            data-mm-link=""
            onClick={(event) => onPick(event, { label: item.feature?.title ?? "", href: item.feature?.href, section: item.value })}
          >
            {item.feature.media ? (
              <span className={styles.featureMedia}>{item.feature.media}</span>
            ) : (
              <span className={styles.featureArt} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            )}
            <span className={styles.featureTitle}>{item.feature.title}</span>
            {item.feature.description ? <span className={styles.featureDescription}>{item.feature.description}</span> : null}
            {item.feature.cta ? (
              <span className={styles.featureCta}>
                {item.feature.cta}
                <ArrowRight aria-hidden="true" />
              </span>
            ) : null}
          </a>
        ) : null}
      </div>
      {item.footer ? (
        <div className={styles.faceFooter} data-mm-footer="">
          {item.footer}
        </div>
      ) : null}
    </>
  );
}

export function MegaMenuMorph({
  items = defaultItems,
  brand = defaultBrand,
  actions = defaultActions,
  value,
  defaultValue = null,
  onValueChange,
  current,
  openDelay = 90,
  closeDelay = 240,
  collapseBelow = "auto",
  showSafeArea = false,
  onNavigate,
  label = "Main",
  className,
  style,
}: MegaMenuMorphProps) {
  const mounted = useMounted();
  const reduced = Boolean(useReducedMotion()) && mounted;
  const uid = useId();

  const controlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(defaultValue);
  const openValue: string | null = controlled ? (value as string | null) : uncontrolledValue;
  const setOpenValue = useCallback(
    (next: string | null) => {
      if (!controlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const [hot, setHot] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const safeAreaRef = useRef<SVGPolygonElement>(null);

  const triggers = useRef(new Map<string, HTMLElement>());
  const sizes = useRef(new Map<string, FaceSize>());
  const openRef = useRef<string | null>(openValue);
  const measuredOnce = useRef(false);
  const timers = useRef<{ open?: number; close?: number; aim?: number }>({});
  const trail = useRef<PointerSample[]>([]);
  const openStartedAt = useRef(0);
  const wantsFocus = useRef(false);
  const lastMeasure = useRef(-Infinity);
  const wasCollapsed = useRef(false);
  const hotRef = useRef<string | null>(null);

  const markHot = (next: string | null) => {
    hotRef.current = next;
    setHot(next);
  };

  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const footerHeight = useMotionValue(0);
  const caretX = useMotionValue(0);
  const highlightX = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightOpacity = useMotionValue(0);
  const transformOrigin = useMotionTemplate`${caretX}px 0px`;

  const panelItems = items.filter(hasPanel);
  const indexOfValue = (value: string | null) => items.findIndex((item) => item.value === value);

  const clearTimer = useCallback((key: "open" | "close" | "aim") => {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = undefined;
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      window.clearTimeout(pending.open);
      window.clearTimeout(pending.close);
      window.clearTimeout(pending.aim);
    };
  }, []);

  const place = useCallback(
    (id: string, immediate: boolean) => {
      const root = rootRef.current;
      const trigger = triggers.current.get(id);
      const size = sizes.current.get(id);
      if (!root || !trigger || !size) return;
      const available = root.clientWidth;
      const nextWidth = Math.min(size.w, available - 16);
      const center = trigger.offsetLeft + (trackRef.current?.offsetLeft ?? 0) + trigger.offsetWidth / 2;
      const nextX = clamp(center - nextWidth / 2, 8, available - 8 - nextWidth);
      const nextCaret = clamp(center - nextX, 26, nextWidth - 26);

      if (immediate) lastMeasure.current = performance.now();
      const measuring = performance.now() - lastMeasure.current < 200;

      if (immediate || measuring || reduced) {
        const snap = () => {
          for (const [motionValue, next] of [
            [x, nextX],
            [width, nextWidth],
            [height, size.h],
            [footerHeight, size.footer],
            [caretX, nextCaret],
          ] as const) {
            motionValue.stop();
            motionValue.set(next);
          }
        };
        snap();
        // A face measured before its fonts settle reports a narrower width; re-snap once more.
        if (immediate)
          requestAnimationFrame(() => {
            if (openRef.current === id && width.get() !== nextWidth) snap();
          });
        return;
      }

      animate(width, nextWidth, nextWidth >= width.get() ? growSpring : shrinkSpring);
      const heightTransition = size.h >= height.get() ? growSpring : shrinkSpring;
      animate(height, size.h, heightTransition);
      animate(footerHeight, size.footer, heightTransition);
      animate(x, nextX, slideSpring);
      animate(caretX, nextCaret, slideSpring);
    },
    [caretX, footerHeight, height, reduced, width, x],
  );

  const onSize = useCallback(
    (id: string, size: FaceSize) => {
      sizes.current.set(id, size);
      if (openRef.current === id) {
        place(id, !measuredOnce.current);
        measuredOnce.current = true;
      }
    },
    [place],
  );

  const setOpen = useCallback(
    (next: string | null) => {
      const previous = openRef.current;
      if (next === previous) return;
      if (next && previous) setDirection(Math.sign(indexOfValue(next) - indexOfValue(previous)));
      else setDirection(0);
      openRef.current = next;
      setOpenValue(next);
      if (next && sizes.current.has(next)) {
        place(next, !measuredOnce.current);
        measuredOnce.current = true;
      }
    },
    [items, place, setOpenValue],
  );

  const setOpenRef = useRef(setOpen);
  useLayoutEffect(() => {
    setOpenRef.current = setOpen;
  });

  useLayoutEffect(() => {
    if (openRef.current === openValue) return;
    const previous = openRef.current;
    openRef.current = openValue;
    if (openValue && previous) setDirection(Math.sign(indexOfValue(openValue) - indexOfValue(previous)));
    if (openValue && sizes.current.has(openValue)) {
      place(openValue, !measuredOnce.current);
      measuredOnce.current = true;
    }
    // Mirrors the shipped effect: it only reacts to the resolved open value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openValue]);

  const highlightValue = hot ?? (collapsed ? null : openValue);

  useLayoutEffect(() => {
    const element = highlightValue ? triggers.current.get(highlightValue) : undefined;
    if (!element) {
      animate(highlightOpacity, 0, { duration: 0.18, ease });
      return;
    }
    if (!(highlightOpacity.get() > 0.35) || reduced) {
      highlightX.stop();
      highlightWidth.stop();
      highlightX.set(element.offsetLeft);
      highlightWidth.set(element.offsetWidth);
      animate(highlightOpacity, 1, { duration: 0.16 * (reduced ? 0 : 1), ease });
      return;
    }
    animate(highlightOpacity, 1, { duration: 0.12, ease });
    animate(highlightX, element.offsetLeft, highlightSpring);
    animate(highlightWidth, element.offsetWidth, highlightSpring);
  }, [highlightValue, collapsed, reduced, highlightOpacity, highlightWidth, highlightX]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const check = () => {
      const available = root.clientWidth;
      const needed = measureRef.current?.offsetWidth ?? 0;
      const next = collapseBelow === "auto" ? needed > available : available < collapseBelow;
      if (next !== wasCollapsed.current) {
        wasCollapsed.current = next;
        setCollapsed(next);
        setHot(null);
        if (next) setOpenRef.current(null);
        else setSheetOpen(false);
      } else if (openRef.current) {
        place(openRef.current, true);
      }
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(root);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [collapseBelow, place]);

  const closeSoon = (delay = closeDelay) => {
    clearTimer("open");
    clearTimer("aim");
    if (openRef.current && !timers.current.close) {
      timers.current.close = window.setTimeout(() => {
        timers.current.close = undefined;
        setOpen(null);
      }, delay);
    }
  };

  const cancelClose = () => clearTimer("close");

  const side = (a: Point, b: Point, c: Point) =>
    (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);

  /**
   * Safe-area test: is the pointer travelling through the triangle between the panel's top edge
   * and where it entered the bar? If so, crossing the bar's dead zone should not close the panel.
   */
  const aimSafe = () => {
    const panel = panelRef.current;
    const root = rootRef.current;
    const samples = trail.current;
    if (!panel || !root || samples.length < 2) return false;
    const last = samples[samples.length - 1];
    const recent = samples.find((sample) => last.t - sample.t < 120) ?? samples[0];
    if (Math.hypot(last.x - recent.x, last.y - recent.y) < 3) return false;
    const box = panel.getBoundingClientRect();
    const left = { x: box.left - 4, y: box.top };
    const right = { x: box.right + 4, y: box.top };
    if (last.y < recent.y - 1) return false;
    const first = side(last, recent, left);
    const second = side(last, left, right);
    const third = side(last, right, recent);
    const negative = first < -1 || second < -1 || third < -1;
    const positive = first > 1 || second > 1 || third > 1;
    return !(negative && positive);
  };

  const drawSafeArea = () => {
    const polygon = safeAreaRef.current;
    const panel = panelRef.current;
    const root = rootRef.current;
    const samples = trail.current;
    if (!polygon || !root) return;
    if (!panel || !openRef.current || !samples.length) {
      polygon.setAttribute("points", "");
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const last = samples[samples.length - 1];
    const recent = samples.find((sample) => last.t - sample.t < 120) ?? last;
    polygon.setAttribute(
      "points",
      `${recent.x - rootBox.left},${recent.y - rootBox.top} ${panelBox.left - 4 - rootBox.left},${panelBox.top - rootBox.top} ${panelBox.right + 4 - rootBox.left},${panelBox.top - rootBox.top}`,
    );
    polygon.dataset.aiming = aimSafe() ? "true" : "false";
  };

  const pick = (event: { preventDefault: () => void }, detail: MegaMenuNavigateDetail) => {
    if (onNavigate) {
      event.preventDefault();
      onNavigate(detail);
    }
    clearTimer("open");
    clearTimer("close");
    clearTimer("aim");
    setOpen(null);
    setSheetOpen(false);
  };

  const triggerElements = () => items.map((item) => triggers.current.get(item.value)).filter((element): element is HTMLElement => Boolean(element));

  const activeLinks = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-mm-active] [data-mm-link]") ?? []);

  const focusLink = (which: "first" | "last") => {
    const links = activeLinks();
    if (!links.length) return false;
    (which === "first" ? links[0] : links[links.length - 1]).focus();
    return true;
  };

  useEffect(() => {
    if (!openValue || !wantsFocus.current) return;
    const frame = requestAnimationFrame(() => {
      if (wantsFocus.current && focusLink("first")) wantsFocus.current = false;
    });
    return () => cancelAnimationFrame(frame);
  });

  useEffect(() => {
    if (!openValue && !sheetOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
        setSheetOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sheetOpen) {
        setSheetOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[data-mm-toggle]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openValue, sheetOpen, setOpen]);

  const opened = items.find((item) => item.value === openValue && hasPanel(item));
  const panelId = `${uid}-menu`;

  const renderBrand = (inMeasure: boolean) => (
    <a
      className={styles.brand}
      href={brand.href ?? "#"}
      tabIndex={inMeasure ? -1 : undefined}
      onClick={(event) => {
        if (!inMeasure) pick(event, { label: brand.name, href: brand.href });
      }}
    >
      {brand.mark ? <span className={styles.brandMark}>{brand.mark}</span> : null}
      <span className={styles.brandName}>{brand.name}</span>
    </a>
  );

  const renderActions = (inMeasure: boolean, list: MegaMenuAction[] = actions) =>
    list.map((action) => (
      <a
        key={action.label}
        className={action.variant === "primary" ? styles.primary : styles.quiet}
        href={action.href ?? "#"}
        tabIndex={inMeasure ? -1 : undefined}
        onPointerEnter={inMeasure ? undefined : () => closeSoon()}
        onClick={(event) => {
          if (inMeasure) return;
          action.onClick?.();
          pick(event, { label: action.label, href: action.href });
        }}
      >
        {action.label}
      </a>
    ));

  const primaryActions = actions.filter((action) => action.variant === "primary");

  const handleTriggerPointerEnter = (item: MegaMenuItem, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    markHot(item.value);
    cancelClose();
    if (!hasPanel(item)) {
      if (openRef.current) closeSoon(150);
      return;
    }
    if (openRef.current) {
      const target = item.value;
      clearTimer("aim");
      const attempt = (startedAt: number) => {
        if (openRef.current === target || hotRef.current !== target) return;
        const elapsed = performance.now() - startedAt;
        if (aimSafe() && elapsed < 320) {
          timers.current.aim = window.setTimeout(() => attempt(startedAt), 60);
          return;
        }
        setOpen(target);
      };
      attempt(performance.now());
      return;
    }
    clearTimer("open");
    timers.current.open = window.setTimeout(() => {
      timers.current.open = undefined;
      openStartedAt.current = performance.now();
      setOpen(item.value);
    }, openDelay);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLElement>, item: MegaMenuItem) => {
    const list = triggerElements();
    const index = list.indexOf(event.currentTarget);
    const focusAt = (next: number) => {
      const element = list[(next + list.length) % list.length];
      element?.focus();
      const owner = items.find((entry) => triggers.current.get(entry.value) === element);
      if (openRef.current && owner) setOpen(hasPanel(owner) ? owner.value : null);
    };
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case "ArrowDown":
        if (!hasPanel(item)) break;
        event.preventDefault();
        wantsFocus.current = true;
        if (openRef.current !== item.value) setOpen(item.value);
        else focusLink("first");
        break;
      case "Tab":
        if (!event.shiftKey && openRef.current === item.value && hasPanel(item)) {
          event.preventDefault();
          focusLink("first");
        }
        break;
      case "Escape":
        if (openRef.current) {
          event.preventDefault();
          setOpen(null);
        }
        break;
      default:
        break;
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const links = activeLinks();
    const index = links.indexOf(document.activeElement as HTMLElement);
    const trigger = openRef.current ? triggers.current.get(openRef.current) : undefined;
    const focusAt = (next: number) => {
      event.preventDefault();
      links[clamp(next, 0, links.length - 1)]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        focusAt(index + 1);
        break;
      case "ArrowUp":
        if (index <= 0) {
          event.preventDefault();
          trigger?.focus();
        } else focusAt(index - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(links.length - 1);
        break;
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        const from = panelItems.findIndex((item) => item.value === openRef.current);
        const next = panelItems[(from + step + panelItems.length) % panelItems.length];
        if (!next) break;
        wantsFocus.current = true;
        setOpen(next.value);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(null);
        trigger?.focus();
        break;
      case "Tab": {
        if (event.shiftKey && index === 0) {
          event.preventDefault();
          trigger?.focus();
          break;
        }
        if (!event.shiftKey && index === links.length - 1) {
          event.preventDefault();
          const list = triggerElements();
          const next = trigger ? list[list.indexOf(trigger) + 1] : undefined;
          setOpen(null);
          (next ?? trigger)?.focus();
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      data-collapsed={collapsed || undefined}
      data-open={(opened && !collapsed) || sheetOpen || undefined}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        const samples = trail.current;
        samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
        while (samples.length > 12 || (samples.length > 2 && event.timeStamp - samples[0].t > 240)) samples.shift();
        if (showSafeArea) drawSafeArea();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        markHot(null);
        closeSoon();
      }}
      onPointerEnter={cancelClose}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next && rootRef.current?.contains(next)) && openRef.current && next) setOpen(null);
      }}
    >
      <nav className={styles.bar} aria-label={label}>
        {renderBrand(false)}
        {collapsed ? (
          <div className={styles.actions}>
            {renderActions(false, primaryActions)}
            <button
              type="button"
              className={styles.toggle}
              data-mm-toggle=""
              aria-expanded={sheetOpen}
              aria-controls={`${uid}-sheet`}
              aria-label={sheetOpen ? "Close menu" : "Open menu"}
              onClick={() => setSheetOpen(!sheetOpen)}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={sheetOpen ? "close" : "open"}
                  className={styles.toggleIcon}
                  initial={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, rotate: sheetOpen ? -45 : 45, scale: 0.7 }
                  }
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, rotate: sheetOpen ? 45 : -45, scale: 0.7 }
                  }
                  transition={reduced ? { duration: 0.1 } : motionTokens.spring.snappy}
                >
                  {sheetOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        ) : (
          <>
            <div
              ref={trackRef}
              className={styles.track}
              onPointerLeave={() => markHot(null)}
            >
              <motion.span
                className={styles.highlight}
                aria-hidden="true"
                style={{ x: highlightX, width: highlightWidth, opacity: highlightOpacity }}
              />
              <ul className={styles.items}>
                {items.map((item) => {
                  const panel = hasPanel(item);
                  const expanded = openValue === item.value && panel;
                  const shared = {
                    ref: (element: HTMLElement | null) => {
                      if (element) triggers.current.set(item.value, element);
                      else triggers.current.delete(item.value);
                    },
                    className: styles.item,
                    "data-hot": hot === item.value || expanded || undefined,
                    "data-current": current === item.value || undefined,
                    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => handleTriggerPointerEnter(item, event),
                    onPointerLeave: () => {
                      if (hotRef.current === item.value) markHot(null);
                      if (!openRef.current) clearTimer("open");
                    },
                    onFocus: () => markHot(item.value),
                    onBlur: () => {
                      if (hotRef.current === item.value) markHot(null);
                    },
                    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => handleTriggerKeyDown(event, item),
                  };
                  return (
                    <li key={item.value}>
                      {panel ? (
                        <button
                          type="button"
                          {...shared}
                          aria-expanded={expanded}
                          aria-controls={expanded ? panelId : undefined}
                          onClick={(event) => {
                            clearTimer("open");
                            cancelClose();
                            const pointerClick = event.detail > 0 && hotRef.current === item.value;
                            if (
                              openRef.current === item.value &&
                              pointerClick &&
                              performance.now() - openStartedAt.current < 450
                            )
                              return;
                            setOpen(openRef.current === item.value ? null : item.value);
                          }}
                        >
                          {item.label}
                          <ChevronDown className={styles.chevron} aria-hidden="true" />
                        </button>
                      ) : (
                        <a
                          {...shared}
                          href={item.href ?? "#"}
                          aria-current={current === item.value ? "page" : undefined}
                          onClick={(event) => pick(event, { label: item.label, href: item.href, section: item.value })}
                        >
                          {item.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={styles.actions} onPointerEnter={() => closeSoon()}>
              {renderActions(false)}
            </div>
          </>
        )}
      </nav>

      <div ref={measureRef} className={styles.measure} aria-hidden="true" inert>
        {renderBrand(true)}
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={item.value}>
              <span className={styles.item}>
                {item.label}
                {hasPanel(item) ? <ChevronDown className={styles.chevron} /> : null}
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>{renderActions(true)}</div>
      </div>

      <AnimatePresence
        onExitComplete={() => {
          measuredOnce.current = false;
        }}
      >
        {opened && !collapsed ? (
          <motion.div
            key="panel"
            ref={panelRef}
            id={panelId}
            className={styles.panel}
            style={{ x, width, height, transformOrigin, top: "calc(var(--mm-bar-h) + 10px)" }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: reduced
                ? { duration: 0.12 }
                : { opacity: { duration: motionTokens.duration.fast, ease }, default: panelSpring },
            }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.1 } }
                : { opacity: 0, y: -4, scale: 0.985, transition: { duration: motionTokens.duration.exit, ease } }
            }
            onPointerEnter={cancelClose}
            onKeyDown={handlePanelKeyDown}
          >
            <div className={styles.surface} aria-hidden="true">
              <motion.div className={styles.band} style={{ height: footerHeight }} />
            </div>
            <motion.span className={styles.caret} aria-hidden="true" style={{ x: caretX }} />
            <div className={styles.clip}>
              <AnimatePresence initial={false} custom={direction}>
                <Face
                  key={opened.value}
                  id={opened.value}
                  direction={direction}
                  reduced={reduced}
                  onSize={onSize}
                  active
                >
                  <FaceContent item={opened} onPick={pick} />
                </Face>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showSafeArea && !collapsed ? (
        <svg className={styles.safeArea} aria-hidden="true">
          <polygon ref={safeAreaRef} points="" />
        </svg>
      ) : null}

      <AnimatePresence>
        {collapsed && sheetOpen ? (
          <motion.div
            key="sheet"
            id={`${uid}-sheet`}
            className={styles.sheet}
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { height: motionTokens.spring.smooth, opacity: { duration: 0.18, ease } }
            }
          >
            <motion.ul
              className={styles.sheetList}
              initial="hidden"
              animate="shown"
              variants={{
                hidden: {},
                shown: {
                  transition: {
                    staggerChildren: reduced ? 0 : motionTokens.stagger.item,
                    delayChildren: 0.04 * (reduced ? 0 : 1),
                  },
                },
              }}
            >
              {items.map((item) => {
                const panel = hasPanel(item);
                const expanded = sheetSection === item.value;
                return (
                  <motion.li
                    key={item.value}
                    className={styles.sheetItem}
                    variants={{
                      hidden: reduced ? { opacity: 0 } : { opacity: 0, y: -6 },
                      shown: { opacity: 1, y: 0, transition: reduced ? { duration: 0.1 } : panelSpring },
                    }}
                  >
                    {panel ? (
                      <>
                        <button
                          type="button"
                          className={styles.sheetRow}
                          aria-expanded={expanded}
                          aria-controls={`${uid}-${item.value}`}
                          data-current={current === item.value || undefined}
                          onClick={() => setSheetSection(expanded ? null : item.value)}
                        >
                          {item.label}
                          <ChevronDown className={styles.chevron} aria-hidden="true" />
                        </button>
                        <AnimatePresence initial={false}>
                          {expanded ? (
                            <motion.div
                              key="body"
                              id={`${uid}-${item.value}`}
                              role="region"
                              aria-label={item.label}
                              className={styles.sheetBody}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={
                                reduced
                                  ? { duration: 0 }
                                  : { height: motionTokens.spring.smooth, opacity: { duration: 0.2, ease } }
                              }
                            >
                              <div className={styles.sheetGroups}>
                                {item.groups?.map((group, groupIndex) => (
                                  <div className={styles.sheetGroup} key={group.title ?? groupIndex}>
                                    {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
                                    <ul className={styles.sheetLinks}>
                                      {group.links.map((link) => (
                                        <li key={link.label}>
                                          <a
                                            className={styles.sheetLink}
                                            href={link.href ?? "#"}
                                            onClick={(event) =>
                                              pick(event, { label: link.label, href: link.href, section: item.value })
                                            }
                                          >
                                            {link.icon ? <span className={styles.linkIcon}>{link.icon}</span> : null}
                                            <span className={styles.linkLabel}>{link.label}</span>
                                            {link.badge ? <span className={styles.badge}>{link.badge}</span> : null}
                                          </a>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                                {item.feature ? (
                                  <a
                                    className={styles.sheetFeature}
                                    href={item.feature.href ?? "#"}
                                    onClick={(event) =>
                                      pick(event, {
                                        label: item.feature?.title ?? "",
                                        href: item.feature?.href,
                                        section: item.value,
                                      })
                                    }
                                  >
                                    <span className={styles.featureTitle}>{item.feature.title}</span>
                                    {item.feature.cta ? (
                                      <span className={styles.featureCta}>
                                        {item.feature.cta}
                                        <ArrowRight aria-hidden="true" />
                                      </span>
                                    ) : null}
                                  </a>
                                ) : null}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </>
                    ) : (
                      <a
                        className={styles.sheetRow}
                        href={item.href ?? "#"}
                        data-current={current === item.value || undefined}
                        aria-current={current === item.value ? "page" : undefined}
                        onClick={(event) => pick(event, { label: item.label, href: item.href, section: item.value })}
                      >
                        {item.label}
                      </a>
                    )}
                  </motion.li>
                );
              })}
              {actions.some((action) => action.variant !== "primary") ? (
                <motion.li
                  className={styles.sheetActions}
                  variants={{
                    hidden: { opacity: 0 },
                    shown: { opacity: 1, transition: { duration: 0.2 } },
                  }}
                >
                  {renderActions(false, actions.filter((action) => action.variant !== "primary"))}
                </motion.li>
              ) : null}
            </motion.ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default MegaMenuMorph;
