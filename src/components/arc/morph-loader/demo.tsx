"use client";

import { useEffect, useId, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { MorphLoader, type MorphLoaderStatus, type MorphLoaderVariant } from "./morph-loader";
import styles from "./demo.module.css";

export const meta = "Live · component";

const SHAPES: { value: MorphLoaderVariant; label: string }[] = [
  { value: "dots", label: "Dots" },
  { value: "bars", label: "Bars" },
  { value: "ring", label: "Ring" },
  { value: "square", label: "Square" },
];

export default function MorphLoaderDemo() {
  const reduced = Boolean(useReducedMotion());
  const [variant, setVariant] = useState<MorphLoaderVariant>("dots");
  const [status, setStatus] = useState<MorphLoaderStatus>("loading");
  const groupId = useId();

  useEffect(() => {
    if (status === "loading") return;
    const timer = window.setTimeout(() => setStatus("loading"), 1700);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <MorphLoader
          variant={variant}
          status={status}
          size={72}
          successLabel="Published"
          errorLabel="Publish failed"
        />
      </div>
      <div className={styles.controls}>
        <LayoutGroup id={groupId}>
          <div className={styles.segment} role="radiogroup" aria-label="Loader shape">
            {SHAPES.map(shape => {
              const active = shape.value === variant;
              return (
                <button
                  key={shape.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={styles.option}
                  onClick={() => {
                    setVariant(shape.value);
                    setStatus("loading");
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="morph-loader-demo-thumb"
                      className={styles.thumb}
                      transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
                    />
                  )}
                  <span className={styles.optionLabel}>{shape.label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            disabled={status !== "loading"}
            onClick={() => setStatus("success")}
          >
            Succeed
          </button>
          <button
            type="button"
            className={styles.action}
            disabled={status !== "loading"}
            onClick={() => setStatus("error")}
          >
            Fail
          </button>
        </div>
      </div>
    </div>
  );
}
