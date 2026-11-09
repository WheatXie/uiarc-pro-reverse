"use client";

import FeatureVoting from "./feature-voting";

export const meta = "Live · block";

/**
 * Renders the sample board: five requests, 1,304 votes, and sample votes that keep arriving while the board
 * is on screen. Suggest a feature to see the duplicate check against the requests already there.
 */
export default function FeatureVotingDemo() {
  return <FeatureVoting />;
}
