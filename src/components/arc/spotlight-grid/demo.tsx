"use client";

import SpotlightGrid from "./spotlight-grid";

export const meta = "Live · block";

/**
 * Renders the shipped marketing grid: hover a card for its live preview, then open it to try the tool
 * in place. The pointer light only follows a mouse; reduced motion drops it along with the preview timers.
 */
export default function SpotlightGridDemo() {
  return <SpotlightGrid />;
}
