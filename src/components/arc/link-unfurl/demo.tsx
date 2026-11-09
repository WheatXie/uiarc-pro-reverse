import { LinkUnfurl } from "./link-unfurl";
import styles from "./link-unfurl.module.css";

export const meta = "Live · component";

export default function LinkUnfurlDemo() {
  return (
    <div className={styles.demo}>
      <LinkUnfurl />
      <p className={styles.note}>
        Demo composer, nothing is sent. Paste any link, click a link to fold its card, or drag a card up.
      </p>
    </div>
  );
}
