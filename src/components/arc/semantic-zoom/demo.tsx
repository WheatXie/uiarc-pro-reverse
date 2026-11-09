"use client";

import { SemanticZoom } from "./semantic-zoom";

export const meta = "Live · block";

/**
 * The frame is the block itself: the map opens fitted to the whole studio and flies in on click,
 * from the arrow keys, or on its own if you take the tour.
 */
export default function SemanticZoomDemo() {
  return <SemanticZoom />;
}
