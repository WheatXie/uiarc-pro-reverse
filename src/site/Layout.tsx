import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import styles from "./site.module.css";

export function Layout({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className={styles.shell}>
      <TopNav />
      <div className={styles.frame}>
        <Sidebar />
        <div className={styles.contentRow}>
          <main className={styles.main}>{children}</main>
          {rail ? <div className={styles.rail}>{rail}</div> : null}
        </div>
      </div>
    </div>
  );
}
