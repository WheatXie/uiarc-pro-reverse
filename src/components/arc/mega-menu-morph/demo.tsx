"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Switch } from "../switch/switch";
import { motionTokens } from "../lib/motion-tokens";
import { MegaMenuMorph } from "./mega-menu-morph";
import type { MegaMenuNavigateDetail } from "./mega-menu-morph";
import styles from "./mega-menu-morph.module.css";

export const meta = "Live · morphing panel, keyboard ready";

const sectionNames: Record<string, string> = {
  products: "Products",
  solutions: "Solutions",
  developers: "Developers",
  company: "Company",
  pricing: "Pricing",
};

export function MegaMenuMorphDemo() {
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState("products");
  const [visit, setVisit] = useState<{ label: string; href?: string; section?: string } | null>(null);
  const [safeArea, setSafeArea] = useState(false);

  const visited = visit
    ? visit.section
      ? `${visit.label} in ${sectionNames[visit.section] ?? visit.section}`
      : visit.label
    : null;

  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.window}>
        <MegaMenuMorph
          current={current}
          onNavigate={(detail: MegaMenuNavigateDetail) => {
            setVisit(detail);
            if (detail.section) setCurrent(detail.section);
          }}
          showSafeArea={safeArea}
        />
        <div className={styles.page}>
          <h2 className={styles.title}>Get paid in 46 currencies, settle in yours</h2>
          <p className={styles.lead}>
            One integration for checkout, subscriptions and payouts, with fraud scoring and reconciliation built in.
          </p>
          <p className={styles.visit} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={visited ?? "none"}
                className={styles.visitText}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)` }
                }
                transition={reduced ? { duration: 0.1 } : motionTokens.spring.smooth}
              >
                {visited ? (
                  <>
                    Opened <strong>{visited}</strong>
                  </>
                ) : (
                  "Choose any destination in the header"
                )}
              </motion.span>
            </AnimatePresence>
          </p>
        </div>
      </div>
      <div className={styles.controls}>
        <Switch label="Show safe area" checked={safeArea} onCheckedChange={setSafeArea} />
        <span className={styles.hint}>
          Move diagonally from a menu into its links, or tab in and use the arrow keys
        </span>
      </div>
    </div>
  );
}

export default MegaMenuMorphDemo;
