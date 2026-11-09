"use client";

import { TeamShowcaseReview } from "./team-showcase";

export const meta = "Live · block";

/**
 * The frame is the review shell: a SegmentedControl over the four layouts with the gallery
 * selected, so the captured state is the portrait row plus Emma Collins' profile.
 */
export default function TeamShowcaseDemo() {
  return <TeamShowcaseReview />;
}
