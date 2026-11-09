# Project board

> A living workflow board for moving work between stages.

- Type: Block
- Page: https://uiarc.dev/components/blocks/project-board
- Markdown: https://uiarc.dev/components/blocks/project-board/markdown

- Access: Arc Pro
- Registry id: `project-board`
- Source file: `registry/blocks/project-board/project-board.tsx`
- Built from: Button, Avatar, Motion
- Keywords: react kanban board, project board, task board, kanban component, accessible kanban, trello style board

Use this to track a focused set of work across stages. Connect its local card actions to your project data.

## When to use

- A compact kanban with a handful of tasks across fixed stages.
- Boards where moving tasks should be accessible through explicit buttons, not drag only.

## When not to use

- Use reorderable-list when order within one list matters more than stages.
- Use timeline for a dated sequence of events.
- Add drag and drop and virtualization, or use a dedicated board library, for large boards.

## Installation

Project board is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/project-board
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ProjectBoard } from "@/components/arc/blocks/project-board/project-board";

export function Board() {
  return (
    <ProjectBoard
      onTaskMove={(task) => updateTask(task.id, { stage: task.stage })}
    />
  );
}
```

## API reference

### ProjectBoard

A four-stage board (Planned, In progress, Review, Done) with a sprint progress bar, per-column counts, arrow buttons to move cards, an All work / My work filter, and an add task action. Tasks and owner portraits are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onTaskMove` | `(task: { id: string; title: string; stage: "Planned" \| "In progress" \| "Review" \| "Done" }) => void` | – | Called after a task moves to its new stage. |

## Accessibility

- Each card has explicit buttons labeled "Move <task> to <stage>" instead of drag only.
- Moves are announced in a visually hidden role="status" region.
- Each column is a section labelled "<stage>, <n> tasks"; the filter buttons use aria-pressed.

## Motion

- Cards travel between columns with a per-card layoutId on the gentle spring; new cards scale in from 0.98.
- The filter highlight glides between All work and My work, and the progress bar grows with scaleX.
- Reduced motion drops the layoutId and springs, so cards and bars change in place.

## Responsive behavior

- The four columns need 820px; narrower boards scroll horizontally with proximity snap to each column.
- Below 700px each column is up to 78vw wide, team avatars hide, and padding tightens; below 400px the add button becomes icon only.
- Moves use buttons, so touch never needs a drag gesture.

## Performance

- Cards move between columns with a per-card layoutId, which measures layout on each move.
- No virtualization; keep boards to dozens of cards rather than hundreds.

## Notes for AI

- Use for a compact kanban of a few tasks. For large boards add virtualization and drag and drop.
- Replace initialTasks, the stages list, and the owner portraits; addTask cycles through sample draft titles.
- Owner portraits render with next/image from lib/media.
- Wire onTaskMove to persist the stage change.

## Related

- [Reorderable list](https://uiarc.dev/components/reorderable-list/markdown): Organize items with direct drag and drop.
- [Sidebar: Workspace](https://uiarc.dev/components/blocks/sidebar/markdown): A product sidebar with a workspace switcher, live search, draggable favorites, and inline projects.
- [Avatar group](https://uiarc.dev/components/avatar-group/markdown): Show a team or set of contributors in a small space.
- [Filter toolbar](https://uiarc.dev/components/filter-toolbar/markdown): Keep collection filters close and easy to reset.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
