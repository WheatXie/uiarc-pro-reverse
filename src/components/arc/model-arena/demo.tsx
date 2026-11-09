/**
 * Model arena demo — the block mounts with its default pool of seven models and the three sample
 * prompts. It auto-starts the first scripted round when the card scrolls into view (Opus 5.5 vs
 * GPT-6.1 Sol on the SQL prompt), then the second and third rounds play out across the remaining
 * pairs; every vote reveals the two vendors and grows the leaderboard.
 */
import ModelArena from "./model-arena";

export const meta = "Live · block";

export default function ModelArenaDemo() {
  return <ModelArena />;
}
