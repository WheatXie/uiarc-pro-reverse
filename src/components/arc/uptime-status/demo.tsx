import { UptimeStatus } from "./uptime-status";

export const meta = "Live · block";

/**
 * The frame shows the page as a visitor finds it: every service operational, the API selected in
 * the strip, and the most recent incident open in the timeline.
 */
export default function UptimeStatusDemo() {
  return <UptimeStatus flat />;
}
