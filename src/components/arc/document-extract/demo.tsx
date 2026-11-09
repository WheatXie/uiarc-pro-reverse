import { DocumentExtract } from "./document-extract";
import styles from "./demo.module.css";

export const meta = "Live · block";

export default function DocumentExtractDemo() {
  return (
    <div className={styles.demo} data-canvas="bleed">
      <DocumentExtract flat />
    </div>
  );
}
