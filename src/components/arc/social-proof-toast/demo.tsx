import { SocialProofToast } from "./social-proof-toast";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function SocialProofToastDemo() {
  return (
    <div className={styles.demo}>
      <SocialProofToast prefill={2} interval={3200} />
    </div>
  );
}
