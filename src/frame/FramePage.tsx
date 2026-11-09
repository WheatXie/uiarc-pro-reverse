import { useParams } from "react-router-dom";
import { demos } from "../previews";
import frames from "../data/frames.json";
import styles from "./frame.module.css";

interface FrameMeta {
  layout: string;
  width: string;
  canvas?: string;
}

const META = frames as Record<string, FrameMeta>;

/**
 * Renders a single demo inside the same shell the reference site uses for its preview frame,
 * so `node scripts/compare.mjs <slug>` can diff geometry and pixels against the live page.
 */
export default function FramePage() {
  const { slug = "" } = useParams();
  const demo = demos[slug];
  const meta = META[slug] ?? { layout: "center", width: "narrow" };
  // Frames that ship no canvas wrapper mount straight into the content column.
  const fullBleed = meta.layout === "app" || meta.layout === "scene" || meta.canvas === "none";
  const body = demo ? <demo.Component /> : <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14 }}>::not reconstructed:: {slug}</p>;

  return (
    <main className={styles.root} data-layout={meta.layout} data-width={meta.width} data-frame-root>
      <div className={styles.content}>
        {fullBleed ? (
          body
        ) : (
          <div className={styles.canvas} data-canvas={meta.canvas}>
            {body}
          </div>
        )}
      </div>
    </main>
  );
}
