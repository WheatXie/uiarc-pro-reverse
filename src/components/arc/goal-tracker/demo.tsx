import { GoalTracker } from "./goal-tracker";

export const meta = "Live · block";

/** The frame opens on the active quarter, with the sample check-in running itself once. */
export default function GoalTrackerDemo() {
  return <GoalTracker />;
}
