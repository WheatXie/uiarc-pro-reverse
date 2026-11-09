"use client";

import ApiKeys from "./api-keys";

export const meta = "Live · block";

/**
 * No props: the block ships its own five sample keys (live and test, one idle, one never used), every row closed and
 * the create button folded, which is exactly the state the live frame is photographed in.
 */
export default function ApiKeysDemo() {
  return <ApiKeys />;
}
