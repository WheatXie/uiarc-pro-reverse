/**
 * Agent memory demo — reconstructed from the Pro preview chunk: the block mounts at its own
 * 640px width inside the centered frame, shows the two reference settings switched on, a 62%-full
 * capacity meter, one captured memory waiting to be filed, and the eleven sample entries in four
 * groups. Everything else (search, add, edit, forget with undo, pinning) is reachable from here.
 */
import { AgentMemory } from "./agent-memory";

export const meta = "Live · block";

export default function AgentMemoryDemo() {
  return <AgentMemory />;
}
