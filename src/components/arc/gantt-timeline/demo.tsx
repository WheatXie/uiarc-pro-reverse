"use client";

import GanttTimeline from "./gantt-timeline";

export const meta = "Live · block";

/**
 * The captured plan as it ships: Week zoom, Discovery folded, scrolled so today sits about a third in.
 * Drag a bar or one of its edges and the status line reports the change; Undo steps back through the last
 * twenty moves, Reset restores this starting plan.
 */
export default function GanttTimelineDemo() {
  return <GanttTimeline />;
}
