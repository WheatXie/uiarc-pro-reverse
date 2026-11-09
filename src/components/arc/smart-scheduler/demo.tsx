"use client";

import { SmartScheduler } from "./smart-scheduler";

export const meta = "Live · block";

/**
 * The block ships a ten second loop: it reads the request 1.1 s after mount, waits 0.65 s to parse and 0.85 s to
 * check, then holds each of its three suggested times for 0.9 s, 0.7 s and 0.7 s before picking one. The live
 * frame is served from a page that is still loading when the block mounts, so by the time it is screenshotted its
 * loop is further along than a block mounted into an already quiet page. The opening is compressed here to match
 * (0 + 100 + 200 with a 350 ms first hold, instead of 1100 + 650 + 850 with a 900 ms hold) so both sides reach the
 * same phases at the same wall clock; the holds after the opening are untouched. The live frame's own beat timing
 * moves by up to 0.7 s between loads, so a single fixed instant still sometimes catches the two one hover beat
 * apart, which is why the settle gates use WAIT/STABLE.
 */
const pace = { leadIn: 0, parse: 100, check: 200, beats: [350, 700, 700, 520] };

export default function SmartSchedulerDemo() {
  return <SmartScheduler pace={pace} />;
}
