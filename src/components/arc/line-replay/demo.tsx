import { LineReplay } from "./line-replay";

export const meta = "Live · block";

/** The frame parks the playhead at the end of the day, so every moment is settled and the last one is called out. */
export default function LineReplayDemo() {
  return <LineReplay />;
}
