# Gantt timeline

> A project timeline with draggable, resizable bars, dependency arrows that follow them, and animated zoom.

- Type: Block
- Page: https://uiarc.dev/components/blocks/gantt-timeline
- Markdown: https://uiarc.dev/components/blocks/gantt-timeline/markdown

- Access: Arc Pro
- Registry id: `gantt-timeline`
- Source file: `registry/blocks/gantt-timeline/gantt-timeline.tsx`
- Built from: Motion
- Keywords: react gantt chart, gantt timeline, project timeline, drag to reschedule, task dependencies, roadmap timeline, project planning chart, resizable task bars

Use this as a starting point and replace the sample data with your own.

## When to use

- Planning work across weeks or months where tasks depend on each other.
- Roadmaps that people reschedule by dragging, with undo and conflict warnings.
- Phase based plans where finished phases can be folded into a summary bar.

## When not to use

- Use project-board for status columns without dates.
- Use week-calendar for time slots within days.
- Use timeline for a read-only list of dated events.

## Installation

Gantt timeline is part of Arc Pro. The live preview is public; the source and install command need Pro.

### CLI with a Pro token

1. Create a token in your account and set it in the environment (or `.env.local`). Never commit it.

```bash
export ARC_PRO_TOKEN=arc_pro_...
```

2. Add the Pro registry to `components.json`:

```json
{
  "registries": {
    "@uiarc": "https://uiarc.dev/r/{name}.json",
    "@uiarc-pro": {
      "url": "https://uiarc.dev/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${ARC_PRO_TOKEN}"
      }
    }
  }
}
```

3. Install:

```bash
npx shadcn@latest add @uiarc-pro/gantt-timeline
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
"use client";

import { useState } from "react";
import { GanttTimeline } from "@/components/arc/blocks/gantt-timeline/gantt-timeline";
import type { GanttGroup, GanttTask } from "@/components/arc/blocks/gantt-timeline/gantt-timeline";

const groups: GanttGroup[] = [
  { id: "design", name: "Design" },
  { id: "build", name: "Build" },
];

const initial: GanttTask[] = [
  { id: "wires", name: "Wireframes", group: "design", start: "2026-10-05", end: "2026-10-09", progress: 1 },
  { id: "ui", name: "Visual design", group: "design", start: "2026-10-12", end: "2026-10-23", progress: 0.4, dependsOn: ["wires"] },
  { id: "api", name: "API", group: "build", start: "2026-10-12", end: "2026-10-30", progress: 0.2 },
  { id: "beta", name: "Beta", group: "build", start: "2026-11-02", end: "2026-11-02", milestone: true, dependsOn: ["ui", "api"] },
];

export function Roadmap() {
  const [tasks, setTasks] = useState(initial);
  return (
    <GanttTimeline
      title="Q4 roadmap"
      groups={groups}
      defaultTasks={initial}
      tasks={tasks}
      onTasksChange={(next, change) => {
        setTasks(next);
        if (change.kind === "move" || change.kind === "resize") {
          void fetch("/api/tasks/" + change.id, { method: "PATCH", body: JSON.stringify({ start: change.start, end: change.end }) });
        }
      }}
      today="2026-10-14"
      defaultCollapsed={[]}
    />
  );
}
```

## API reference

### GanttTimeline

A project timeline with tasks grouped by phase. Drag a bar to move it or its edges to change dates, snapped to whole days. Dependency arrows re-route as bars move and turn red when a task starts before one it depends on ends. Zoom glides between day, week, and month. Also the default export.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"App relaunch"` | Heading in the toolbar and the section's accessible name. |
| `groups` | `GanttGroup[]` | `GROUPS` | Phases in display order. Each task's group field refers to a group id. |
| `tasks` | `GanttTask[]` | – | Controlled tasks. Pair with onTasksChange. |
| `defaultTasks` | `GanttTask[]` | `TASKS` | Starting tasks when uncontrolled. Also sets the calendar range once on mount and is what Reset restores. |
| `onTasksChange` | `(tasks: GanttTask[], change: GanttChange) => void` | – | Called after a move, resize, undo, or reset with the full list and what changed. |
| `today` | `string` | `"2026-09-23"` | ISO date that places the today line and the initial scroll. |
| `zoom` | `GanttZoom` | – | Controlled zoom: "day", "week", or "month". |
| `defaultZoom` | `GanttZoom` | `"week"` | Starting zoom when uncontrolled. |
| `onZoomChange` | `(zoom: GanttZoom) => void` | – | Called when the zoom control changes. |
| `collapsed` | `string[]` | – | Controlled ids of folded groups. |
| `defaultCollapsed` | `string[]` | `["discovery"]` | Groups folded on first render when uncontrolled. |
| `onCollapsedChange` | `(ids: string[]) => void` | – | Called when a group is folded or unfolded. |
| `className` | `string` | – | Extra class on the root section. |

### GanttTask

Exported type. { id: string; name: string; group: string; start: string; end: string; progress?: number; assignee?: PersonId; dependsOn?: string[]; milestone?: boolean }. Dates are ISO days and end is inclusive; a milestone uses start only. progress runs from 0 to 1.

No props.

### GanttGroup

Exported type. { id: string; name: string }.

No props.

### GanttChange

Exported type passed to onTasksChange. { id: string; start: string; end: string; kind: "move" | "resize" | "undo" | "reset" }.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves into the chart; one bar is tabbable at a time. |
| Arrow Down / Arrow Up | Moves focus to the next or previous visible bar and scrolls it into view. |
| Alt + Arrow Left / Right | Moves the focused task by one day. |
| Alt + Shift + Arrow Left / Right | Changes the focused task's end date by one day. |
| Enter / Space | Selects or deselects the focused bar, highlighting its dependency arrows. |
| Escape | Clears the selection. |

## Accessibility

- Bars are role="button" with aria-roledescription "Task bar" or "Milestone", aria-pressed for selection, and a label with name, dates, percent done, and a warning when a dependency is violated.
- Every bar is described by hidden text that explains the Alt and Alt Shift shortcuts.
- Folded rows are aria-hidden and inert; group toggles carry aria-expanded.
- The zoom control is a group of aria-pressed buttons. The footer status is role="status" and reports each change and conflict.
- The calendar header, grid lines, arrows, and summary bars are aria-hidden.

## Motion

- Bars, arrows, group summaries, and task rows read the same motion values, so they move together without drifting.
- After a drag, the bar springs to the snapped day from its release velocity; a dashed snap target and a date label show while dragging.
- Shortening past one day resists with a soft rubber band instead of stopping.
- Zoom animates the day scale on a spring while keeping the middle of the view fixed; the header tiers crossfade.
- Folding a group slides its rows up into the group row and fades them.
- Reduced motion jumps bars, rows, scale, and scroll to their targets and removes the crossfades.

## Responsive behavior

- When the scroller is under 560px wide, the sticky task column narrows from 248px to 132px.
- Bars under 96px wide hide their name and bars under 36px hide their percentage, through container queries on each bar.
- The chart scrolls horizontally, and dragging near either edge scrolls the view along with the bar.
- Below 480px viewport width the root padding and task row indent shrink.

## Performance

- Drag, zoom, and row folding update motion values; React re-renders only on commit and when the snapped day changes.
- Each dependency arrow recomputes its path from motion values every frame while something moves; keep plans in the tens of tasks.
- The header and grid lines render one element per day at day zoom, so very long ranges add DOM weight.

## Notes for AI

- Use for project plans with phases, dependencies, and drag to reschedule.
- The calendar range is computed once on mount from defaultTasks and today, starting on a Monday with a week before and three weeks after. In controlled mode pass defaultTasks as well, or the calendar spans the sample data.
- onTasksChange reports each move or resize as ISO start and end dates; persist change.id with those dates. Undo keeps the last 20 changes.
- Assignee avatars come from @/components/arc/lib/media PersonId portraits; tasks without one show a plain marker.
- Dependency conflicts are shown, not prevented. Validate on the server if a violation must be blocked.

## Related

- [Project board](https://uiarc.dev/components/blocks/project-board/markdown): A living workflow board for moving work between stages.
- [Week calendar](https://uiarc.dev/components/blocks/week-calendar/markdown): A week calendar where you drag to create, move, and resize events, with color coded calendars, day and agenda views, and swipes on phones.
- [Timeline](https://uiarc.dev/components/timeline/markdown): Follow what happened, newest first, grouped by day.
- [Tree table](https://uiarc.dev/components/tree-table/markdown): A table with nested rows, tri-state selection, hierarchy-preserving sort, and lazy-loaded children.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
