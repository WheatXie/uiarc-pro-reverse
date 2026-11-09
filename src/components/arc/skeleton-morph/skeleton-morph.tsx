"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./skeleton-morph.module.css";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** One resolved block, shared with its MorphBlock children through context. */
interface MorphContextValue {
  loading: boolean;
  reduced: boolean;
  stagger: number;
  /** Registers a block node so siblings can sort themselves into reading order. */
  register: (node: HTMLElement) => () => void;
  /** How many sibling blocks come before this node in the document. */
  order: (node: HTMLElement | null) => number;
}

const MorphContext = createContext<MorphContextValue | null>(null);

const placeholderSpring = motionTokens.spring.smooth;
const shellSpring = motionTokens.spring.smooth;
const contentEase: [number, number, number, number] = [...motionTokens.ease.standard];

/** Numbers become px; strings (percentages, calc, auto) pass through untouched. */
const toSize = (value?: number | string) => (typeof value === "number" ? `${value}px` : value);

export interface SkeletonMorphProps {
  /** While true, blocks show their skeletons and the region is aria-busy. */
  loading: boolean;
  /** The loaded layout, with each visible piece wrapped in a MorphBlock. */
  children: ReactNode;
  /** Seconds between blocks as they resolve in reading order. */
  stagger?: number;
  /** Status text read by screen readers while loading. */
  loadingLabel?: string;
  /** The root element. Style it as the card so its border follows the eased height. */
  as?: ElementType;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

/**
 * A loading region whose skeleton blocks become the real content. It marks itself busy while
 * loading and eases to the new height when blocks change size.
 */
export function SkeletonMorph({
  loading,
  children,
  stagger = 0.04,
  loadingLabel = "Loading",
  as: Tag = "div",
  className,
  style,
}: SkeletonMorphProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const reduced = Boolean(useReducedMotion() && hydrated);

  const blocks = useRef(new Set<HTMLElement>());
  const register = useCallback((node: HTMLElement) => {
    blocks.current.add(node);
    return () => {
      blocks.current.delete(node);
    };
  }, []);
  const order = useCallback((node: HTMLElement | null) => {
    if (!node) return 0;
    let index = 0;
    for (const sibling of blocks.current) {
      if (sibling !== node && sibling.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) index += 1;
    }
    return index;
  }, []);

  const context = useMemo<MorphContextValue>(
    () => ({ loading, reduced, stagger, register, order }),
    [loading, order, reduced, register, stagger],
  );

  const innerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  // -1 means "no measurement yet": the shell keeps its natural height.
  const measured = useMotionValue(-1);
  const height = useTransform(measured, (value) => (value < 0 ? "auto" : `${value}px`));

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const shell = shellRef.current;
    if (!inner || !shell) return;
    let current = inner.offsetHeight;
    let running: AnimationPlaybackControls | null = null;
    const relax = () => {
      measured.jump(-1);
      delete shell.dataset.easing;
    };
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      if (next === current) return;
      const from = measured.get() < 0 ? current : measured.get();
      current = next;
      running?.stop();
      if (reduced || Math.abs(next - from) < 1) {
        relax();
      } else {
        // Pin the old height, then ease to the new one with the shell clipping while it moves.
        measured.jump(from);
        shell.dataset.easing = "";
        running = animate(measured, next, { ...shellSpring, onComplete: relax });
      }
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      running?.stop();
    };
  }, [reduced, measured]);

  return (
    <Tag className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-busy={loading || undefined}>
      <span className={styles.srOnly} role="status">
        {loading ? loadingLabel : ""}
      </span>
      <motion.div ref={shellRef} className={styles.shell} style={{ height }}>
        <div ref={innerRef} className={styles.inner}>
          <MorphContext.Provider value={context}>{children}</MorphContext.Provider>
        </div>
      </motion.div>
    </Tag>
  );
}

export type MorphBlockElement =
  | "div"
  | "span"
  | "p"
  | "li"
  | "section"
  | "article"
  | "header"
  | "footer"
  | "h2"
  | "h3"
  | "h4";

export interface MorphBlockProps {
  /** The loaded content. It is not rendered while loading. */
  children?: ReactNode;
  /** Skeleton width. */
  width?: number | string;
  /** Skeleton height. */
  height?: number | string;
  /** Skeleton corner radius. circle makes a round avatar placeholder. */
  radius?: number | string | "circle";
  /** Shows a text skeleton with this many lines; the last of several is shorter. */
  lines?: number;
  /** Line height of the text in px, so the skeleton is exactly as tall as the loaded text. */
  lineHeight?: number;
  /** The block element. */
  as?: MorphBlockElement;
  /** Extra class on the block. */
  className?: string;
  /** Inline styles on the block. */
  style?: CSSProperties;
}

/**
 * One piece of the layout. It is a size-matched skeleton while loading; on resolve the placeholder
 * stretches to the content's measured box and fades while the content sharpens in, in place.
 */
export function MorphBlock({
  children,
  width = "100%",
  height,
  radius = 6,
  lines,
  lineHeight = 20,
  as: Tag = "div",
  className,
  style,
}: MorphBlockProps) {
  const context = useContext(MorphContext);
  if (!context) throw Error("MorphBlock must be used inside SkeletonMorph");
  const { loading, reduced, stagger, register, order } = context;

  const blockRef = useRef<HTMLElement | null>(null);
  const placeholderRef = useRef<HTMLSpanElement>(null);

  useEffect(() => (blockRef.current ? register(blockRef.current) : undefined), [register]);

  const [shown, setShown] = useState(!loading);
  // Going back to loading is immediate: skeletons replace the content on the same frame.
  if (loading && shown) setShown(false);
  const resolved = shown && !loading;

  useEffect(() => {
    if (loading) return;
    const delay = reduced ? 0 : order(blockRef.current) * stagger * 1000;
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [loading, order, reduced, stagger]);

  const circle = radius === "circle";
  const lineCount = lines ?? 0;
  const boxWidth = toSize(width) ?? "100%";
  const boxHeight = toSize(height) ?? (lineCount ? `${lineCount * lineHeight}px` : "12px");
  const lastSize = useRef({ width: boxWidth, height: boxHeight });

  useLayoutEffect(() => {
    lastSize.current = { width: boxWidth, height: boxHeight };
  }, [boxWidth, boxHeight]);

  useLayoutEffect(() => {
    const block = blockRef.current;
    const placeholder = placeholderRef.current;
    if (!block || !placeholder) return;
    if (!resolved) {
      const reset = animate(
        placeholder,
        { width: "100%", height: "100%", x: 0, y: 0, opacity: 1 },
        { duration: 0 },
      );
      return () => reset.stop();
    }
    if (reduced) {
      const fade = animate(placeholder, { opacity: [1, 0] }, { duration: motionTokens.duration.instant });
      return () => fade.stop();
    }
    // Measure the content, then re-measure the block wearing the skeleton box, so the placeholder
    // can start exactly where the skeleton sat and stretch into the content's box.
    const content = block.getBoundingClientRect();
    const { width: inlineWidth, height: inlineHeight } = block.style;
    block.dataset.state = "skeleton";
    block.style.width = lastSize.current.width;
    block.style.height = lastSize.current.height;
    const skeleton = block.getBoundingClientRect();
    block.dataset.state = "content";
    block.style.width = inlineWidth;
    block.style.height = inlineHeight;
    const stretch = animate(
      placeholder,
      {
        width: [skeleton.width, content.width],
        height: [skeleton.height, content.height],
        x: [skeleton.left - content.left, 0],
        y: [skeleton.top - content.top, 0],
        opacity: [1, 0],
      },
      {
        width: placeholderSpring,
        height: placeholderSpring,
        x: placeholderSpring,
        y: placeholderSpring,
        opacity: { duration: 0.38, ease: contentEase, delay: 0.06 },
      },
    );
    return () => stretch.stop();
  }, [reduced, resolved]);

  const size = resolved ? {} : { width: boxWidth, height: boxHeight };
  const placeholderStyle = {
    borderRadius: circle ? 9999 : lineCount ? 0 : toSize(radius),
    "--line": `${lineHeight}px`,
  } as CSSProperties;

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        blockRef.current = node;
      }}
      className={[styles.block, className].filter(Boolean).join(" ")}
      data-state={resolved ? "content" : "skeleton"}
      style={{ ...style, ...size }}
    >
      {resolved && (
        <motion.div
          className={styles.content}
          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: reduced ? motionTokens.duration.instant : 0.34, ease: contentEase }}
        >
          {children}
        </motion.div>
      )}
      <span
        ref={placeholderRef}
        className={styles.placeholder}
        aria-hidden="true"
        data-lines={lineCount || undefined}
        style={placeholderStyle}
      >
        {lineCount > 0 &&
          Array.from({ length: lineCount }, (_, index) => (
            <span
              key={index}
              className={styles.line}
              data-last={(index === lineCount - 1 && lineCount > 1) || undefined}
            />
          ))}
      </span>
    </Tag>
  );
}

export default SkeletonMorph;
