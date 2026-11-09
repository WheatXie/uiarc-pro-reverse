"use client";

import { LayoutMorph } from "./layout-morph";

export const meta = "Live · block";

/**
 * The frame is the block itself: the gallery opens on the grid layout with the summary panel
 * showing totals, and the stage/panel frames are flattened the way the live preview injects them.
 */
export default function LayoutMorphDemo() {
  return <LayoutMorph flat />;
}
