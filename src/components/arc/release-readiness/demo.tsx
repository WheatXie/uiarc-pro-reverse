import { ReleaseReadiness } from "./release-readiness";

export const meta = "Live · block";

/** The frame shows the checklist at rest: 1 of 4 checks done, notify on, release button locked. */
export default function ReleaseReadinessDemo() {
  return <ReleaseReadiness flat />;
}
