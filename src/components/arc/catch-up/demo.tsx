import { CatchUp, demoDigest } from "./catch-up";

export const meta = "Live · block";

/** The frame shows the digest at rest: 8 items, 142 updates, range "3 days". */
export default function CatchUpDemo() {
  return <CatchUp initialItems={demoDigest("3d")} />;
}
