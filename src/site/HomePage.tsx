import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Layout } from "../site/Layout";
import { blocks, components, proBlocks, proComponents } from "../site/catalog";
import styles from "../site/site.module.css";

export function HomePage() {
  return (
    <Layout>
      <div className={styles.home}>
        <div className={styles.homeInner}>
          <span className={styles.homeKicker}>
            <span className={styles.dot} aria-hidden="true" />
            {proComponents.length} Pro components · {proBlocks.length} Pro blocks
          </span>
          <h1 className={styles.homeTitle}>
            Every component
            <br />
            you keep rebuilding.
          </h1>
          <p className={styles.homeLede}>
            A copy-paste library of {components.length} components and {blocks.length} blocks — all {proComponents.length + proBlocks.length} Pro
            pieces reconstructed, animated, keyboard-complete, and shipped as source you own.
          </p>
          <div className={styles.homeActions}>
            <Link to="/components/emoji-picker" className={styles.primaryBtn}>
              Browse components
            </Link>
            <Link to="/pro" className={styles.ghostBtn}>
              Arc Pro
              <ArrowRight width={15} height={15} strokeWidth={1.75} />
            </Link>
          </div>

          <div className={styles.homeGrid}>
            {proComponents.map((item) => (
              <Link key={item.slug} to={`/components/${item.slug}`} className={styles.homeCard}>
                <span className={styles.homeCardTitle}>
                  {item.title}
                  <span className={styles.proBadge} style={{ marginLeft: "auto" }}>
                    Pro
                  </span>
                </span>
                <span className={styles.homeCardBody}>{item.description || "Pro component"}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
