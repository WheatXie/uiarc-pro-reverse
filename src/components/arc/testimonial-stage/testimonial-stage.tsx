"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { person, portrait } from "@/components/arc/lib/media";
import type { PersonId } from "@/components/arc/lib/media";
import styles from "./testimonial-stage.module.css";

const { spring, duration, ease, blur } = motionTokens;

/** Mutable copy of the shared enter curve; motion wants a tuple, not the `as const` one. */
const enterEase: [number, number, number, number] = [...ease.enter];

interface Perspective {
  id: PersonId;
  company: string;
  quote: string;
}

/** The three editorial stories the block ships with. */
const perspectives: Perspective[] = [
  {
    id: "emma-collins",
    company: "Northwind",
    quote:
      "Feature requests used to live in three inboxes. Now they land in one place, already grouped by theme, and our Monday triage takes ten minutes.",
  },
  {
    id: "marcus-johnson",
    company: "Halcyon",
    quote:
      "I link a trend in the pull request and the conversation is over. Nobody argues with a line that has been climbing for six weeks.",
  },
  {
    id: "sofia-ramirez",
    company: "Juniper Health",
    quote:
      "Support and product finally read the same numbers. When a customer asks for something twice, we see it the same day.",
  },
];

export interface TestimonialStageProps {
  /** Appended to the root section. */
  className?: string;
  /** Called when the active person changes. */
  onPerspectiveChange?: (perspective: { id: string; name: string }) => void;
  /**
   * Drops the block's own surface (border, radius, background) so it sits flush inside the
   * preview frame, which renders blocks flat. The reference frame applies exactly
   * `border: 0; border-radius: 0; box-shadow: none; background: transparent` inline.
   */
  flat?: boolean;
}

/**
 * Portrait-led stories with a tab list of people and a quote panel. Quotes and portraits are
 * sample data. Changing the tab, the arrows, or ArrowLeft / ArrowRight moves the reading state;
 * the portrait crossfades with a small scale settle while the quote fades in with a directional
 * shift and a brief blur. Reduced motion keeps the fades and drops the shift.
 */
export function TestimonialStage({
  className,
  onPerspectiveChange,
  flat = false,
}: TestimonialStageProps) {
  const reduced = !!useReducedMotion();
  const uid = useId();
  const [[index, direction], setStage] = useState<[number, number]>([0, 1]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const perspective = perspectives[index];
  const active = person(perspective.id);

  const goTo = useCallback(
    (next: number, nextDirection?: number) => {
      const target = (next + perspectives.length) % perspectives.length;
      if (target === index) return;
      setStage([target, nextDirection ?? (next > index ? 1 : -1)]);
      onPerspectiveChange?.({
        id: perspectives[target].id,
        name: person(perspectives[target].id).name,
      });
    },
    [index, onPerspectiveChange],
  );

  const onTabListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + perspectives.length) % perspectives.length;
    goTo(next, step);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      className={[styles.stage, className].filter(Boolean).join(" ")}
      aria-labelledby={`${uid}-title`}
      data-frame-flat={flat ? "" : undefined}
      style={
        flat
          ? {
              border: 0,
              borderRadius: 0,
              boxShadow: "none",
              background: "transparent",
            }
          : undefined
      }
    >
      <div className={styles.layout}>
        <div className={styles.imageColumn}>
          <AnimatePresence initial={false}>
            <motion.div
              key={perspective.id}
              className={styles.imageWrap}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reduced
                  ? { duration: duration.instant }
                  : {
                      opacity: {
                        duration: duration.considered,
                        ease: enterEase,
                      },
                      scale: { duration: duration.considered, ease: enterEase },
                    }
              }
            >
              <Image
                src={portrait(perspective.id)}
                alt={`Portrait of ${active.name}`}
                fill
                sizes="(max-width: 680px) 100vw, 480px"
                priority={index === 0}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.contentColumn}>
          <h2 id={`${uid}-title`} className={styles.title}>
            What teams say about Beacon
          </h2>

          <figure
            className={styles.quoteArea}
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-${perspective.id}`}
          >
            <div className={styles.quoteSlot}>
              <AnimatePresence initial={false}>
                <motion.blockquote
                  key={perspective.id}
                  className={styles.quote}
                  initial={
                    reduced
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          x: reduced ? 0 : 12 * direction,
                          filter: `blur(${blur.subtle}px)`,
                        }
                  }
                  animate={{
                    opacity: 1,
                    x: 0,
                    filter: "blur(0px)",
                    transitionEnd: { filter: "none" },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: reduced ? 0 : duration.fast },
                  }}
                  transition={
                    reduced
                      ? { duration: duration.instant }
                      : {
                          opacity: {
                            duration: duration.standard,
                            ease: enterEase,
                          },
                          filter: { duration: duration.standard },
                          x: spring.smooth,
                        }
                  }
                >
                  <p>“{perspective.quote}”</p>
                </motion.blockquote>
              </AnimatePresence>
            </div>

            <figcaption className={styles.author}>
              <AnimatePresence initial={false}>
                <motion.span
                  key={perspective.id}
                  className={styles.authorInner}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: { duration: duration.instant },
                  }}
                  transition={
                    reduced
                      ? { duration: duration.instant }
                      : {
                          duration: duration.standard,
                          ease: enterEase,
                          delay: 0.06,
                        }
                  }
                >
                  <span className={styles.authorName}>{active.name}</span>
                  <span className={styles.authorRole}>
                    {active.role}, {perspective.company}
                  </span>
                </motion.span>
              </AnimatePresence>
            </figcaption>
          </figure>

          <div className={styles.footer}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Quotes"
              onKeyDown={onTabListKeyDown}
            >
              {perspectives.map((entry, position) => {
                const selected = position === index;
                return (
                  <button
                    key={entry.id}
                    ref={(node) => {
                      tabRefs.current[position] = node;
                    }}
                    id={`${uid}-${entry.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${uid}-panel`}
                    aria-label={person(entry.id).name}
                    tabIndex={selected ? 0 : -1}
                    className={styles.tab}
                    onClick={() => goTo(position)}
                  >
                    <span className={styles.tabBar}>
                      {selected && (
                        <motion.span
                          layoutId={`${uid}-bar`}
                          className={styles.tabFill}
                          transition={reduced ? { duration: 0 } : spring.morph}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => goTo(index - 1, -1)}
                aria-label="Previous quote"
              >
                <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => goTo(index + 1, 1)}
                aria-label="Next quote"
              >
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialStage;
