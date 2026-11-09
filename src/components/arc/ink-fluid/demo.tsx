"use client";

import { Button } from "../button/button";
import { InkFluid } from "./ink-fluid";
import styles from "./ink-fluid.module.css";

export const meta = "Live · component";

export default function InkFluidDemo() {
  return (
    <div className={styles.demo}>
      <InkFluid className={styles.hero}>
        <div className={styles.copy}>
          <h2 className={styles.title}>Ship interfaces that feel alive</h2>
          <p className={styles.lede}>Components with motion that explains every change.</p>
          <div className={styles.actions}>
            <Button size="md">Get started</Button>
            <Button size="md" variant="ghost">
              Browse components
            </Button>
          </div>
        </div>
      </InkFluid>
    </div>
  );
}
