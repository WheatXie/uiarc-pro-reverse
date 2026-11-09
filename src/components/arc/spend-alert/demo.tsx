import { SpendAlert } from "./spend-alert";
import styles from "./demo.module.css";

export const meta = "Live · block";

/** The frame shows the card at rest: $5,000 budget, 80% threshold, Email and Slack on, nothing saved yet. */
export default function SpendAlertDemo() {
  return <SpendAlert className={styles.card} />;
}
