"use client";

import TypewriterTerminal from "./typewriter-terminal";
import styles from "./typewriter-terminal.module.css";

export const meta = "Live · component";

export default function TypewriterTerminalDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <TypewriterTerminal />
    </div>
  );
}
