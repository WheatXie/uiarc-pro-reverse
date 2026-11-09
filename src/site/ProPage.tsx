import { Link } from "react-router-dom";
import { Layout } from "./Layout";
import { proBlocks, proComponents } from "./catalog";
import styles from "./site.module.css";

export function ProPage() {
  return (
    <Layout>
      <div className={styles.home}>
        <div className={styles.homeInner}>
          <span className={styles.homeKicker}>Arc Pro · $249 once</span>
          <h1 className={styles.homeTitle}>
            Every component
            <br />
            and block.
          </h1>
          <p className={styles.homeLede}>
            {proComponents.length} Pro components and {proBlocks.length} Pro blocks, all source-available, all keyboard-complete, all on the same token
            system as the free library.
          </p>
          <div className={styles.homeActions}>
            <Link to="/components/emoji-picker" className={styles.primaryBtn}>
              Start with the emoji picker
            </Link>
            <Link to="/components/blocks/metrics-dashboard" className={styles.ghostBtn}>
              See the blocks
            </Link>
          </div>
          <div className={styles.homeGrid}>
            {proComponents.map((item) => (
              <Link key={item.slug} to={`/components/${item.slug}`} className={styles.homeCard}>
                <span className={styles.homeCardTitle}>{item.title}</span>
                <span className={styles.homeCardBody}>{item.description || "Pro component"}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
