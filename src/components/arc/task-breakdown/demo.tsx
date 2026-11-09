import { TaskBreakdown } from "./task-breakdown";

export const meta = "Live · block";

/**
 * The frame starts the demo on sight: the goal in the input is broken into seven tasks, which
 * stream in three words at a time before the timeline settles on a ten-day early ship.
 */
export default function TaskBreakdownDemo() {
  return <TaskBreakdown />;
}
