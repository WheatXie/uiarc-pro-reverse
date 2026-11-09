"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { MotionStyle } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./glass-card.module.css";

export interface GlassCardProps {
  image: string;
  imageAlt: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Peak tilt in degrees at the card corners. `0` keeps the photo flat. */
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}

/** Soft enough to read as weight, quick enough that the card never feels loose in the hand. */
const TILT_SPRING = { stiffness: 260, damping: 24, mass: 0.6 };
const GLARE_SPRING = { stiffness: 200, damping: 30 };
/** Pointer starts off-canvas so the rim highlight is dark until the first move. */
const OFFSCREEN = -400;

export function GlassCard({
  image,
  imageAlt,
  title,
  subtitle,
  aside,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  tilt = 6,
  className,
  style,
}: GlassCardProps) {
  const reduced = Boolean(useReducedMotion());
  const id = useId();
  const detailId = `${id}-detail`;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const expanded = open ?? uncontrolledOpen;

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const gx = useMotionValue(OFFSCREEN);
  const gy = useMotionValue(OFFSCREEN);
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);
  const glare = useSpring(0, GLARE_SPRING);

  const rest = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
    glare.set(0);
  }, [rotateX, rotateY, glare]);

  // Opening lifts the card out of the pointer plane, so drop the tilt rather than freeze it mid-lean.
  useEffect(() => {
    if (expanded) rest();
  }, [expanded, rest]);

  const panelTransition = reduced ? { duration: 0 } : motionTokens.spring.morph;

  return (
    <motion.div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{ ...style, rotateX, rotateY, transformPerspective: 900 }}
      data-open={expanded || undefined}
      onPointerMove={(event) => {
        const root = rootRef.current;
        const panel = panelRef.current;
        if (!root || !panel || event.pointerType === "touch") return;
        const rootBox = root.getBoundingClientRect();
        const panelBox = panel.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (event.clientX - rootBox.left) / rootBox.width));
        const y = Math.min(1, Math.max(0, (event.clientY - rootBox.top) / rootBox.height));
        gx.set(event.clientX - panelBox.left);
        gy.set(event.clientY - panelBox.top);
        glare.set(1);
        if (reduced || expanded || tilt <= 0) return;
        rotateY.set((x - 0.5) * 2 * tilt);
        rotateX.set((0.5 - y) * 2 * tilt);
      }}
      onPointerLeave={rest}
      onClick={(event) => {
        const target = event.target as Element;
        if (target.closest("[data-glass-card-detail]") || target.closest("[data-glass-card-toggle]")) return;
        setOpen(!expanded);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !expanded) return;
        event.preventDefault();
        setOpen(false);
        headerRef.current?.focus();
      }}
    >
      <img src={image} alt={imageAlt} className={styles.image} draggable={false} />
      <div className={styles.scrim} aria-hidden="true" />
      <LayoutGroup id={id}>
        <motion.div
          ref={panelRef}
          layout
          transition={panelTransition}
          className={styles.panel}
          style={{ "--gx": gx, "--gy": gy, "--glare": glare, borderRadius: 22 } as MotionStyle}
        >
          <span className={styles.edge} aria-hidden="true" />
          <motion.button
            ref={headerRef}
            layout="position"
            transition={panelTransition}
            type="button"
            className={styles.header}
            data-glass-card-toggle
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setOpen(!expanded)}
          >
            <span className={styles.titles}>
              <span className={styles.title}>{title}</span>
              {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
            </span>
            {aside ? <span className={styles.aside}>{aside}</span> : null}
          </motion.button>
          <AnimatePresence initial={false} mode="popLayout">
            {expanded ? (
              <motion.div
                key="detail"
                id={detailId}
                layout="position"
                transition={panelTransition}
                className={styles.detail}
                data-glass-card-detail
                initial={
                  reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: `blur(${motionTokens.blur.soft}px)` }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: { ...motionTokens.spring.morph, delay: 0.06 },
                      }
                }
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: 6,
                        filter: `blur(${motionTokens.blur.subtle}px)`,
                        transition: {
                          duration: motionTokens.duration.instant,
                          ease: [...motionTokens.ease.standard],
                        },
                      }
                }
              >
                {children}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
    </motion.div>
  );
}

export default GlassCard;
