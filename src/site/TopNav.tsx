import { Link, useLocation } from "react-router-dom";
import { Search, Sun } from "lucide-react";
import styles from "./site.module.css";

const NAV = [
  { label: "Components", to: "/components/button", match: "/components" },
  { label: "Blocks", to: "/components/blocks/metrics-dashboard", match: "/components/blocks" },
  { label: "Docs", to: "/docs/introduction", match: "/docs" },
  { label: "Pricing", to: "/pro", match: "/pro" },
  { label: "Try the demo", to: "/components/emoji-picker", match: "/demo" },
];

export function TopNav() {
  const { pathname } = useLocation();
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            a
          </span>
          Arc
        </Link>
        <nav style={{ display: "flex", height: "100%" }}>
          {NAV.map((item) => {
            const active = item.match === "/components/blocks" ? pathname.startsWith("/components/blocks") : pathname.startsWith(item.match) && !pathname.startsWith("/components/blocks");
            return (
              <Link key={item.label} to={item.to} className={styles.navLink} data-active={active || undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.topbarSpacer} />
        <button type="button" className={styles.searchPill}>
          <Search width={14} height={14} strokeWidth={1.75} aria-hidden="true" />
          Search
          <span className={styles.kbd}>⌘K</span>
        </button>
        <button type="button" className={styles.appearance}>
          Appearance
          <Sun width={15} height={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <Link to="/pro" className={styles.getPro}>
          Get Pro
        </Link>
        <span className={styles.signIn}>Sign in</span>
      </div>
    </header>
  );
}
