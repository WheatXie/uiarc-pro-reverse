# Layout morph

> A 24 card gallery that flies between grid, masonry, list, fan, carousel and a 3D helix.

- Type: Block
- Page: https://uiarc.dev/components/blocks/layout-morph
- Markdown: https://uiarc.dev/components/blocks/layout-morph/markdown

- Access: Arc Pro
- Registry id: `layout-morph`
- Source file: `registry/blocks/layout-morph/layout-morph.tsx`
- Keywords: react layout animation, gallery layout switcher, masonry to grid animation, 3d helix gallery, view mode toggle, morphing gallery

Use this for a catalogue, portfolio or team page where people browse the same set in different ways. Replace ITEMS in morph-data.ts with your own; layouts, captions, the open view and the numbers derive from it.

## When to use

- Catalogue, portfolio, or team pages where people browse the same set in different layouts.
- Showcase galleries that fly between grid, masonry, list, fan, carousel, and a 3D helix.

## When not to use

- Use photo-grid for a simple gallery.
- Use carousel or cover-flow for one horizontal browsing style.
- Use lightbox-gallery when opening a full size image is the main job.

## Installation

Layout morph is part of Arc Pro. The live preview is public; the source and install command need Pro. It uses local image assets, so it is not in the registry: copy the source from the Manual tab while signed in, or read it with the Arc MCP server and a Pro token.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LayoutMorph } from "@/components/arc/blocks/layout-morph/layout-morph";

export default function CataloguePage() {
  return (
    <main>
      <LayoutMorph />
    </main>
  );
}
```

## API reference

### LayoutMorph

A 24 card gallery that flies between grid, masonry, list, fan, carousel and a 3D helix, with an open view for each card. Takes no props; cards are sample data in ITEMS in morph-data.ts, using images from other blocks and public portraits.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys / Home / End | On the view switch, picks the next, previous, first or last layout. |
| Arrow left / Arrow right | On a card, switches to the previous or next layout and keeps that card in focus. |
| Arrow up / Arrow down / Home / End | Moves focus between cards. |
| Enter | Opens the focused card. |
| Escape | Closes the open card. |

## Accessibility

- The view switch is a role="radiogroup" with roving tabindex and labelled icon options.
- The stage is a group with a gallery roledescription whose label explains the keys.
- The open card is a role="dialog"; the gallery behind it is hidden and the closed dialog is inert.

## Motion

- Cards fly between layouts on springs, staggered outward from the chosen origin.
- Opening a card morphs it into the detail view.
- Reduced motion is passed to the engine and MotionConfig uses the user setting.

## Responsive behavior

- Below a 720px container the layout tabs become icon-only and the stage is 540px tall, shrinking to 500px and 460px below 480px and 360px.
- In scrolling layouts the stage takes touch-action none; wheel only rotates the ring for horizontal or shift scrolls.

## Performance

- Cards are DOM elements moved with transforms, and the ring layouts spin one camera transform per frame instead of every card.
- The loop pauses offscreen via IntersectionObserver and in hidden tabs; keep the set near the 24 sample cards.

## Notes for AI

- Use for a catalogue, portfolio or team page where people browse the same set in different ways.
- Replace ITEMS in morph-data.ts with your own photos and profiles; layouts, captions and totals derive from it.
- The save action in the open view is local state; connect it to your favourites API if needed.

## Related

- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.
- [Card stack](https://uiarc.dev/components/card-stack/markdown): Review a deck one card at a time, with a throw and an undo.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
