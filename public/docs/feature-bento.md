# Feature bento

> A six cell feature bento where small, real product UI acts each feature out on hover.

- Type: Block
- Page: https://uiarc.dev/components/blocks/feature-bento
- Markdown: https://uiarc.dev/components/blocks/feature-bento/markdown

- Access: Arc Pro
- Registry id: `feature-bento`
- Source file: `registry/blocks/feature-bento/feature-bento.tsx`
- Built from: Motion
- Keywords: bento, bento grid, feature grid, features section, landing page, product features, marketing section

Use this as the features section of a landing page. Edit the cells and illustration content in feature-bento-data.ts, or pass your own visual per cell.

## When to use

- A landing page features section that should show the product rather than list it.
- Launch pages where each capability has one clear, demonstrable behavior.

## When not to use

- Long feature lists or comparison tables. Use Plan comparison.
- A guided walkthrough with order. Use Scroll story.
- Cards that open into detail. Use Spotlight grid.

## Installation

Feature bento is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/feature-bento
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { FeatureBento } from "@/components/arc/blocks/feature-bento/feature-bento";

export function Features() {
  return (
    <FeatureBento
      title="Everything your team needs"
      features={[
        { id: "sync", title: "Edit together", description: "See who is here and what they change.", visual: "sync", size: "wide" },
        { id: "search", title: "Find anything", description: "One menu for every page and person.", visual: "command", size: "tall" },
        { id: "insights", title: "Clear numbers", description: "Trends next to the work that moved them.", visual: "chart" },
        { id: "rules", title: "Automations", description: "Route, enrich, and notify on their own.", visual: "flow" },
        { id: "access", title: "Access", description: "Roles for every workspace.", visual: "permissions", size: "half" },
        { id: "versions", title: "History", description: "Rewind to any moment.", visual: "history", size: "half" },
      ]}
    />
  );
}
```

## API reference

### FeatureBento

A six cell feature grid in varied sizes. Each cell pairs a short title and sentence with a small piece of real product UI that acts the feature out.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Built for the way teams actually work"` | Section heading. |
| `description` | `string` | – | One or two sentences under the heading. Pass an empty string to hide it. |
| `features` | `BentoFeature[]` | `bentoFeatures` | The cells, in reading order. Six read best. Each has id, title, description, visual, and optional size and href. |
| `features[].visual` (required) | `"sync" \| "command" \| "chart" \| "flow" \| "permissions" \| "history"` | – | Which built-in illustration to draw: a live doc, a command menu, a bar chart, an automation, role switches, or a version scrubber. |
| `features[].size` | `"regular" \| "wide" \| "tall" \| "half"` | `"regular"` | On wide screens: wide spans two thirds, tall spans two rows, half spans half a row, regular a third. |
| `features[].href` | `string` | – | Makes the title a link that covers the whole cell. |
| `visuals` | `Partial<Record<string, ReactNode>>` | – | Replaces an illustration by feature id, for your own screenshot or component. |
| `className` | `string` | – | Extra class on the section. |

## Accessibility

- The section is labelled by its heading; each cell is a list item with a real h3 and paragraph.
- Illustrations are aria-hidden: they repeat what the title and sentence already say.
- With href, the title is the only link and its hit area stretches over the cell, so there is one tab stop per cell.
- Focusing a linked cell plays its illustration, the same as hovering it.

## Motion

- Cells rise 14px and fade in once as they enter view, staggered by column.
- With a mouse, hovering a cell acts its feature out: a cursor drags a selection while another types, a palette highlight glides to its match, the latest bar lifts and takes the accent, steps check off along a filling line, a switch flips and saves, a scrubber slides back and the text swaps to that version.
- Hover in uses the shared spring curve with small sequenced delays; hover out returns quickly with no delays.
- On touch screens each cell plays once when it scrolls into view and stays in its end state.
- Only transform and opacity animate, plus two tiny typing reveals. Reduced motion jumps straight to each state.

## Responsive behavior

- Six columns from 880px container width, two columns from 560px, one column below.
- The tall cell spans two rows in both multi column layouts, so the grid stays gap free.
- Illustrations cap their width and center, so they read at 320px.
- Hover effects are gated to fine pointers; touch plays each cell on view instead.

## Performance

- Illustrations are plain DOM and CSS transitions keyed on data attributes; no animation loop runs.
- One IntersectionObserver per cell, disconnected after the first view.
- Three 22px avatars are the only images.

## Notes for AI

- Use as the main features section of a landing page, directly under the hero.
- Keep titles to one line and descriptions to one sentence; the illustrations carry the detail.
- Replace sample strings inside the illustrations through bentoSamples in feature-bento-data.ts, or swap a whole cell's visual with the visuals prop.
- Keep six cells: wide, tall, two regular, two half. Other counts work but lose the rhythm.

## Related

- [Spotlight grid](https://uiarc.dev/components/blocks/spotlight-grid/markdown): A feature grid where light follows the pointer, cards play live demos, and a click morphs a card into its detail.
- [Scroll story](https://uiarc.dev/components/blocks/scroll-story/markdown): A feature section where scrolling the copy drives a pinned product view through each step.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
