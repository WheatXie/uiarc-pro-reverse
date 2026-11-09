import { ToneTuner } from "./tone-tuner";
import styles from "./demo.module.css";

export const meta = "Live · component";

/** The card tunes the sample billing reply with simulated rewrites and tours its presets on screen. */
export default function ToneTunerDemo() {
  return (
    <div className={styles.demo}>
      <ToneTuner />
    </div>
  );
}
