"use client";

import SearchResults from "./search-results";

export const meta = "Live · block";

/**
 * The shipped block mounts with the Northwind corpus already searched: the query is "onboarding",
 * the result set has settled, and the first match is selected so the preview is filled. The block
 * measures itself — facets sit beside the list and the preview at 1120px and wider — and runs its
 * own simulated latency on every new search. Rendering it with no props is the exact state the live
 * frame is photographed in.
 */
export default function SearchResultsDemo() {
  return <SearchResults />;
}
