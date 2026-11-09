"use client";

import TeamDirectory from "./team-directory";

export const meta = "Live · block";

/**
 * The live frame renders the block with no props: the six sample people, Emma Collins selected,
 * the All filter active, and an empty search.
 */
export default function TeamDirectoryDemo() {
  return <TeamDirectory />;
}
