"use client";
import { EnrichColumn } from "./enrich-column";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function EnrichColumnDemo() {
  return <div className={styles.demo}><EnrichColumn/></div>;
}
