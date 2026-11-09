# Semantic zoom

> An infinite-zoom map of a company that reveals teams, projects, tasks and people as you fly in.

- Type: Block
- Page: https://uiarc.dev/components/blocks/semantic-zoom
- Markdown: https://uiarc.dev/components/blocks/semantic-zoom/markdown

- Access: Arc Pro
- Registry id: `semantic-zoom`
- Source file: `registry/blocks/semantic-zoom/semantic-zoom.tsx`
- Keywords: react semantic zoom, infinite zoom canvas, zoomable org chart, zoom ui, portfolio map, canvas zoom and pan

Use this on a workspace or portfolio overview so people can move from the whole company to a single task without losing their place. Replace the seeded teams in zoom-data.ts with your own; layout, rollups and labels derive from it.

## When to use

- Workspace or portfolio overviews where people zoom from the whole company to one task.
- Hierarchical data where each zoom level should show different detail.

## When not to use

- Use tree-view for a plain hierarchy people scan and expand.
- Use project-board for working on tasks.
- Use customer-galaxy for flat data clustered by attributes.

## Installation

Semantic zoom is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/semantic-zoom
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SemanticZoom } from "@/components/arc/blocks/semantic-zoom/semantic-zoom";

export default function WorkspaceMap() {
  return (
    <section>
      <SemanticZoom />
    </section>
  );
}
```

## API reference

### SemanticZoom

An infinite zoom canvas map of a company that reveals teams, projects, tasks and people as you fly in, with breadcrumbs, a minimap and a guided tour. Takes no props; teams, projects, tasks and people are sample data in zoom-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Moves the cursor between nearby items. |
| Enter / Space | Flies into the item under the cursor. |
| Escape / Backspace | Flies out one level. |
| + / - | Zooms in or out. |
| 0 / Home | Fits the whole company. |

## Accessibility

- The stage is role="application" with a zoomable map roledescription, a text summary label and a keyboard hint.
- Breadcrumbs are a nav with aria-current="location" on the current level.
- The tour toggle uses aria-pressed, the side panel is labelled, and a polite live region announces moves.

## Motion

- The camera flies between levels on eased zooms, and detail fades in as each level gets large enough.
- Breadcrumbs, panel stats and people avatars enter with a blur rise or spring.
- Reduced motion is passed to the engine for instant camera moves, and UI transitions become instant.

## Responsive behavior

- From a 900px container the side panel sits beside the stage at 268px; below that it moves underneath, and below 600px the stage is 480px tall.
- Touch uses pinch to zoom and tap to fly in; the stage allows vertical page scroll until zoomed in.
- The mouse wheel always zooms over the stage, so leave page space around it for scrolling.

## Performance

- Draws on 2D canvases sized by ResizeObserver with devicePixelRatio capped at 2.
- The loop pauses offscreen via IntersectionObserver and in hidden tabs.

## Notes for AI

- Use on a workspace or portfolio overview so people can move from the whole company to a single task.
- Replace TEAMS, PROJECTS, TASKS and PEOPLE in zoom-data.ts; layout, rollups and labels derive from them.

## Related

- [Customer galaxy](https://uiarc.dev/components/blocks/customer-galaxy/markdown): 2,400 accounts as a drifting galaxy that spirals into clusters by plan, region or health.
- [Tree view](https://uiarc.dev/components/tree-view/markdown): Navigate nested folders and structured content.
- [Breadcrumb](https://uiarc.dev/components/breadcrumb/markdown): Show where a page sits in a hierarchy.
- [Layout morph](https://uiarc.dev/components/blocks/layout-morph/markdown): A 24 card gallery that flies between grid, masonry, list, fan, carousel and a 3D helix.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
