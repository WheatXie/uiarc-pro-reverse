import { ExplodedView } from "./exploded-view";

export const meta = "Live · block";

/** The frame sits at the top of the scroll: the screen assembled, first stop current, labels hidden. */
export default function ExplodedViewDemo() {
  return <ExplodedView flat />;
}
