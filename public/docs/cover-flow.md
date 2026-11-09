# Cover flow

> A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/cover-flow
- Markdown: https://uiarc.dev/components/cover-flow/markdown
- Source file: `registry/components/cover-flow/cover-flow.tsx`
- Dependencies: motion
- Keywords: special, cover flow, carousel, react cover flow, coverflow carousel, 3d carousel, album carousel, image rail, itunes cover flow

## When to use

- Six to twelve visual items where looking at one at a time is the point, such as albums, places, or collections.
- Showcase rails that should respond to drag, throw, and sideways trackpad scroll.

## When not to use

- Use carousel for general slides or content cards.
- Use photo-grid or lightbox-gallery for a large library.
- Use depth-cards for about three rich choices that open into detail.

## Installation

Cover flow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/cover-flow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CoverFlow } from "@/components/arc/cover-flow/cover-flow";

export function Hikes() {
  return (
    <CoverFlow
      label="Hikes for this fall"
      items={[
        { id: "ridge", title: "Ridge Loop", subtitle: "Mount Tam", meta: "8 km", image: "/hikes/ridge.jpg" },
        { id: "falls", title: "Cataract Falls", subtitle: "Marin", meta: "5 km", image: "/hikes/falls.jpg" },
      ]}
      onIndexChange={setIndex}
    />
  );
}
```

## API reference

### CoverFlow

A depth rail for browsing a short collection of images one at a time. The front card stands forward while the rest recede to either side, and each image drifts inside its frame as the rail moves.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `{ id: string; title: string; subtitle?: string; meta?: string; image: string; imagePosition?: string; alt?: string }[]` | – | Cards in order. alt defaults to the title. Generic: extra fields on your items are passed back to renderCaption. |
| `label` (required) | `string` | – | Accessible name of the carousel, such as "Hikes for this fall". |
| `index` | `number` | – | Controlled front card. Pair with onIndexChange. |
| `defaultIndex` | `number` | `0` | Initial front card when uncontrolled. |
| `onIndexChange` | `(index: number) => void` | – | Called when a different card settles in front, and while a drag passes over one. |
| `renderCaption` | `(item: T, index: number) => ReactNode` | – | Replaces the caption under the rail. It changes with the front card. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Steps one card while the rail has focus. |
| Home / End | Jumps to the first or last card. |

## Accessibility

- The root is labelled with aria-roledescription="carousel"; each card is a group with aria-roledescription="slide" and a label like "2 of 8: Ridge Loop".
- Cards away from the front are aria-hidden, and position ticks are labelled "Show <title>" with aria-current on the front one. Ticks are out of the tab order; the rail itself takes focus and handles the keys.
- The front card is announced in a polite live region.

## Motion

- Drag or throw the rail and it lands on the card its momentum reaches, on a spring tuned to the release speed; a quick flick always moves at least one card. The ends rubber-band.
- Sideways trackpad scrolls move the rail directly, then settle on a card with the swipe's momentum. Clicking a card beside the front one brings it forward.
- Cards scale, dim, turn toward the center, and recede with distance while each image drifts inside its frame; the caption rises in from the direction of travel.
- Reduced motion jumps between cards, turns off the drift and the turn, and keeps short fades. A drag past 40px or one trackpad swipe steps one card.

## Responsive behavior

- Cards size with the container at clamp(168px, 38cqw, 272px), so the rail scales from phones to wide sections.
- The stage uses touch-action pan-y, so vertical swipes still scroll the page and sideways ones move the rail.

## Performance

- Every card is rendered, but cards far from the front get visibility hidden; keep the collection to a few dozen at most.
- Transforms and image drift run on motion values, and one ResizeObserver reads the card width.

## Notes for AI

- Choose it for six to twelve visual items where one at a time is the point (places, albums, collections). Use carousel for general slides and photo-grid for a large library.
- Items are generic, so pass your own records and render extra fields through renderCaption.

## Related

- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Card stack](https://uiarc.dev/components/card-stack/markdown): Review a deck one card at a time, with a throw and an undo.
- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.

## Also in galleries

- [Product gallery](https://uiarc.dev/components/product-gallery/markdown): A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.
- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

## Guidance for AI tools

Cover flow: A depth rail of images you can throw, with soft grounded shadows and a quiet reflection. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
