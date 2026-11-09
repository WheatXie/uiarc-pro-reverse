"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./card-to-article.module.css";

/** One story: the card art, its caption, and the article that opens out of it. */
export interface ArticleItem {
  /** Stable id, used as the React key and the open-article value. */
  id: string;
  /** Pill drawn on the photo, e.g. `Case study`. */
  tag?: string;
  /** Headline over the photo and the `h2` of the open article. */
  title: string;
  /** Small read-time line under the title. */
  meta?: string;
  /** Card and hero image; keep the same ratio as `aspectRatio`. */
  image: string;
  /** Describes the photo inside the open article. The card image is decorative. */
  imageAlt: string;
  /** Article content, rendered under the hero when the card is open. */
  body: ReactNode;
}

export interface CardToArticleProps {
  /** Every story in the grid. */
  items: ArticleItem[];
  /** Id of the open article. Leave it out for uncontrolled use. */
  value?: string | null;
  /** Initially open article when uncontrolled. */
  defaultValue?: string | null;
  /** Called when an article opens or closes. */
  onValueChange?: (id: string | null) => void;
  /** Ratio of the card and of the article hero. They match, so the morph is a pure scale. */
  aspectRatio?: number;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /** Extra class on the root. */
  className?: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SheetState {
  id: string;
  box: Box;
  open: boolean;
}

const OPEN_LAYOUT: Transition = { type: "spring", visualDuration: 0.52, bounce: 0 };
const CLOSE_LAYOUT: Transition = { type: "spring", visualDuration: 0.44, bounce: 0 };
const INSTANT_LAYOUT: Transition = { duration: 0 };

const noopSubscribe = () => () => {};
const readClient = () => true;
const readServer = () => false;

function Hero({
  item,
  titleId,
  onPointerDown,
}: {
  item: ArticleItem;
  titleId?: string;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const Title = titleId ? "h2" : "span";
  return (
    <div className={styles.hero} onPointerDown={onPointerDown}>
      <img className={styles.image} src={item.image} alt={titleId ? item.imageAlt : ""} draggable={false} />
      <span className={styles.scrim} aria-hidden="true" />
      {item.tag ? <span className={styles.tag}>{item.tag}</span> : null}
      <span className={styles.caption}>
        <Title id={titleId} className={styles.title}>
          {item.title}
        </Title>
        {item.meta ? <span className={styles.meta}>{item.meta}</span> : null}
      </span>
    </div>
  );
}

/**
 * A grid of story cards; a card opens into a full scrolling article with a shared element morph and
 * closes back into its slot.
 */
export function CardToArticle({
  items,
  value,
  defaultValue = null,
  onValueChange,
  aspectRatio = 4 / 3,
  closeLabel = "Close article",
  className,
}: CardToArticleProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const mounted = useSyncExternalStore(noopSubscribe, readClient, readServer);
  const reduced = !!useReducedMotion() && mounted;
  const controlled = value !== undefined;

  const [internal, setInternal] = useState<string | null>(defaultValue);
  const active = controlled ? value : internal;

  const [sheet, setSheet] = useState<SheetState | null>(null);
  const slotRefs = useRef(new Map<string, HTMLLIElement>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const pull = useMotionValue(0);
  const liftScale = useTransform(pull, (distance) => 1 - Math.min(distance, 480) / 1500);
  const liftY = useTransform(pull, (distance) => 0.3 * Math.min(distance, 480));
  const progress = useMotionValue(0);

  const measure = useCallback((id: string, fromCard = false): Box | null => {
    const node = fromCard ? cardRefs.current.get(id) : slotRefs.current.get(id);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }, []);

  const setValue = useCallback(
    (id: string | null) => {
      if (!controlled) setInternal(id);
      onValueChange?.(id);
    },
    [controlled, onValueChange],
  );

  // Derived state: the sheet follows the open value.
  const [lastActive, setLastActive] = useState<string | null>(null);
  if (active !== lastActive) {
    setLastActive(active);
    if (active) {
      setSheet({ id: active, box: { top: 0, left: 0, width: 0, height: 0 }, open: false });
    } else if (sheet) {
      setSheet({ ...sheet, open: false });
    }
  }

  // Opening: measure the card, then flip `open` on the next frame so the layout animation starts
  // from the card's own box.
  useLayoutEffect(() => {
    if (!sheet || sheet.open || !active || sheet.id !== active) return;
    if (sheet.box.width === 0) {
      const box = measure(sheet.id, true);
      if (box) setSheet({ ...sheet, box });
      return;
    }
    const frame = requestAnimationFrame(() => setSheet((state) => (state && state.id === active ? { ...state, open: true } : state)));
    return () => cancelAnimationFrame(frame);
  }, [active, sheet, measure]);

  // Closing: re-measure the slot so the sheet lands flush in it.
  useLayoutEffect(() => {
    if (!sheet || sheet.open || active) return;
    const box = measure(sheet.id);
    if (box && (box.top !== sheet.box.top || box.left !== sheet.box.left || box.width !== sheet.box.width)) {
      setSheet({ ...sheet, box });
    }
  }, [active, sheet, measure]);

  // Page scroll is locked while the article is open, keeping the scrollbar's space.
  const layerMounted = !!sheet;
  useEffect(() => {
    if (!layerMounted) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const previous = { overflow: root.style.overflow, padding: root.style.paddingRight };
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.padding;
    };
  }, [layerMounted]);

  const close = useCallback(() => {
    if (!active) return;
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    animate(pull, 0, reduced ? INSTANT_LAYOUT : CLOSE_LAYOUT);
    setValue(null);
  }, [active, pull, reduced, setValue]);

  /** Unmounts the layer and hands focus back to the card it came from. */
  const settleClosed = useCallback((id: string) => {
    const card = cardRefs.current.get(id);
    progress.set(0);
    setSheet((state) => (state && !state.open && state.id === id ? null : state));
    requestAnimationFrame(() => card?.focus({ preventScroll: true }));
  }, [progress]);

  const openId = sheet?.open ? sheet.id : null;
  useEffect(() => {
    if (openId) closeRef.current?.focus({ preventScroll: true });
  }, [openId]);

  // Fallback for the case where the layout animation never reports (a hidden tab, reduced motion).
  const closingId = !sheet || sheet.open || active ? null : sheet.id;
  useEffect(() => {
    if (!closingId) return;
    const timer = window.setTimeout(() => settleClosed(closingId), 1100 * Number(!reduced));
    return () => window.clearTimeout(timer);
  }, [closingId, reduced, settleClosed]);

  /** Releases the pull: past a threshold (or with a downward flick) it closes, otherwise it springs back. */
  const release = useCallback(
    (velocity: number) => {
      const distance = pull.get();
      if (distance > 120 || (distance > 24 && velocity > 0.6)) close();
      else animate(pull, 0, { type: "spring", visualDuration: 0.38, bounce: 0, velocity: -(1000 * velocity) });
    },
    [close, pull],
  );

  // Pull to dismiss: touch on the sheet, wheel past the top with a trackpad.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !openId) return;
    let wheelTimer = 0;
    let touch: { y: number; at: number; lastY: number; lastAt: number; pulling: boolean } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      touch = { y, at: event.timeStamp, lastY: y, lastAt: event.timeStamp, pulling: false };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const delta = y - touch.y;
      if (!touch.pulling && scroller.scrollTop <= 0 && delta > 4) {
        touch.pulling = true;
        touch.y = y;
      }
      if (!touch.pulling) return;
      event.preventDefault();
      touch.lastAt = event.timeStamp;
      touch.lastY = y;
      pull.set(Math.max(0, y - touch.y));
    };
    const onTouchEnd = (event: TouchEvent) => {
      const state = touch;
      touch = null;
      if (!state?.pulling) return;
      const velocity = (state.lastY - state.y) / Math.max(1, state.lastAt - state.at);
      release(Math.max(0, pull.get() > 0 ? velocity : 0) * Number(event.type !== "touchcancel"));
    };
    const onWheel = (event: WheelEvent) => {
      if (scroller.scrollTop > 0) return;
      if (event.deltaY >= 0 && pull.get() === 0) return;
      event.preventDefault();
      pull.set(Math.max(0, pull.get() - 0.6 * event.deltaY));
      window.clearTimeout(wheelTimer);
      if (pull.get() > 120) {
        close();
        return;
      }
      wheelTimer = window.setTimeout(() => release(0), 140);
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(wheelTimer);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [openId, pull, release, close]);

  const openItem = sheet ? items.find((item) => item.id === sheet.id) ?? null : null;
  const isOpen = !!sheet?.open;
  const closedBox: CSSProperties =
    sheet && !isOpen
      ? { top: sheet.box.top, left: sheet.box.left, width: sheet.box.width, height: sheet.box.height }
      : {};
  const layoutTransition = reduced ? INSTANT_LAYOUT : isOpen ? OPEN_LAYOUT : CLOSE_LAYOUT;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onHeroPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const startY = event.clientY;
    const hero = event.currentTarget;
    let last = { y: startY, at: event.timeStamp };
    let previous = last;
    hero.setPointerCapture(event.pointerId);
    const onMove = (move: PointerEvent) => {
      previous = last;
      last = { y: move.clientY, at: move.timeStamp };
      pull.set(Math.max(0, move.clientY - startY));
    };
    const onUp = () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerup", onUp);
      hero.removeEventListener("pointercancel", onUp);
      release(Math.max(0, (last.y - previous.y) / Math.max(1, last.at - previous.at)));
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerup", onUp);
    hero.addEventListener("pointercancel", onUp);
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={{ "--ratio": aspectRatio } as CSSProperties}>
      <ul className={styles.grid}>
        {items.map((item) => (
          <li
            key={item.id}
            ref={(node) => {
              if (node) slotRefs.current.set(item.id, node);
              else slotRefs.current.delete(item.id);
            }}
            className={styles.slot}
          >
            <button
              type="button"
              ref={(node) => {
                if (node) cardRefs.current.set(item.id, node);
                else cardRefs.current.delete(item.id);
              }}
              className={styles.card}
              data-away={sheet?.id === item.id || undefined}
              aria-haspopup="dialog"
              aria-expanded={active === item.id}
              onClick={() => setValue(item.id)}
            >
              <Hero item={item} />
            </button>
          </li>
        ))}
      </ul>
      {mounted && sheet && openItem && sheet.box.width > 0
        ? createPortal(
            <div className={styles.layer} style={{ "--ratio": aspectRatio } as CSSProperties}>
              <motion.div
                className={styles.backdrop}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: Number(isOpen) }}
                transition={
                  reduced
                    ? { duration: motionTokens.duration.instant }
                    : { duration: isOpen ? 0.32 : 0.26, ease: [...motionTokens.ease.standard] as [number, number, number, number] }
                }
                onClick={close}
              />
              <motion.div className={styles.lift} style={{ scale: liftScale, y: liftY }}>
                <motion.div
                  ref={sheetRef}
                  layout
                  transition={{ layout: layoutTransition }}
                  onLayoutAnimationComplete={() => {
                    if (!sheet || sheet.open || active) return;
                    settleClosed(sheet.id);
                  }}
                  className={styles.sheet}
                  data-open={isOpen || undefined}
                  style={{ ...closedBox, borderRadius: isOpen ? 32 : 26 }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`${uid}-title`}
                  onKeyDown={onKeyDown}
                >
                  <motion.span className={styles.progress} style={{ scaleX: progress }} aria-hidden="true" />
                  <div
                    ref={scrollerRef}
                    className={styles.scroller}
                    onScroll={() => {
                      const scroller = scrollerRef.current;
                      if (!scroller) return;
                      const max = scroller.scrollHeight - scroller.clientHeight;
                      progress.set(max > 0 ? scroller.scrollTop / max : 0);
                    }}
                  >
                    <motion.div layout transition={{ layout: layoutTransition }} className={styles.heroWrap}>
                      <Hero item={openItem} titleId={`${uid}-title`} onPointerDown={onHeroPointerDown} />
                    </motion.div>
                    <motion.div
                      className={styles.body}
                      layout="position"
                      initial={false}
                      animate={isOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 * Number(!reduced) }}
                      transition={
                        isOpen
                          ? {
                              layout: layoutTransition,
                              delay: 0.14 * Number(!reduced),
                              duration: 0.36,
                              ease: [...motionTokens.ease.standard] as [number, number, number, number],
                            }
                          : { layout: layoutTransition, duration: motionTokens.duration.instant }
                      }
                    >
                      {openItem.body}
                    </motion.div>
                  </div>
                  <motion.button
                    ref={closeRef}
                    type="button"
                    className={styles.close}
                    aria-label={closeLabel}
                    onClick={close}
                    layout="position"
                    initial={false}
                    animate={isOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                    transition={
                      isOpen
                        ? {
                            layout: layoutTransition,
                            delay: 0.18 * Number(!reduced),
                            type: "spring",
                            visualDuration: 0.3,
                            bounce: 0,
                          }
                        : { layout: layoutTransition, duration: 0.1 }
                    }
                  >
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                </motion.div>
              </motion.div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default CardToArticle;
