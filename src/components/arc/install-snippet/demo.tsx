import InstallSnippet from "./install-snippet";
import styles from "./install-snippet.module.css";

export const meta = "Live · component";

export default function Demo() {
  return <div className={styles.demo}>
    <InstallSnippet />
  </div>;
}
