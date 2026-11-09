"use client";

import { useSyncExternalStore } from "react";
import EvalSuite from "./eval-suite";

export const meta = "Live · block";

/* The reference frame page flattens the block's card below 959px (958 flat, 959 bordered), so the
   demo tracks the same boundary instead of hard-coding it. */
const QUERY = "(max-width: 958px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useFlatFrame() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * The live frame is the block on its own: the suite has not run yet, so the grid shows v11's
 * baseline cells and the case list opens on the regressions filter with the empty state.
 */
export default function EvalSuiteDemo() {
  return <EvalSuite flat={useFlatFrame()} />;
}
