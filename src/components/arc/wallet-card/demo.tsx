"use client";

import WalletCard from "./wallet-card";
import styles from "./demo.module.css";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: the card opens on the main wallet with the balance counting up,
 * the 1M history, four actions and three recent entries, so the wallet switch, the scrubber and every panel
 * are reachable without interaction.
 */
export default function WalletCardDemo() {
  return <WalletCard className={styles.flat} />;
}
