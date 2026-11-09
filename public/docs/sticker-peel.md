# Sticker peel

> Peel stickers off a surface with a real curl, move them around, and stick them back down.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/sticker-peel
- Markdown: https://uiarc.dev/components/sticker-peel/markdown
- Source file: `registry/components/sticker-peel/sticker-peel.tsx`
- Dependencies: motion
- Keywords: special, motion, new, sticker peel, peel effect, sticker drag, page curl, laptop stickers, draggable stickers, react sticker, peel off animation

## When to use

- A personal or team page where people arrange badges, achievements, or brand stickers.
- A launch or marketing moment that invites people to play with the product's marks.
- A reward screen where earned stickers are placed on a surface.

## When not to use

- Use reorderable-list or a sortable grid when the order of items carries meaning.
- Use note-stack for content people need to read and rearrange.
- Avoid it on dense work screens; it is a delight surface, not an input.

## Installation

Sticker peel is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/sticker-peel
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { StickerPeel } from "@/components/arc/sticker-peel/sticker-peel";
import type { StickerPlacement } from "@/components/arc/sticker-peel/sticker-peel";

const stickers = [
  { id: "ship", label: "Ship it sticker", shape: "pill" as const, x: .3, y: .35, rotate: -6, content: <span className="ship">Ship it</span> },
  { id: "hello", label: "Hello sticker", shape: "circle" as const, x: .68, y: .6, rotate: 8, content: <span className="hello">hello</span> },
];

export function Lid() {
  const [positions, setPositions] = useState<Record<string, StickerPlacement>>();
  return <StickerPeel className="lid" stickers={stickers} positions={positions} onPositionsChange={setPositions} label="Laptop lid" />;
}
```

## API reference

### StickerPeel

A surface of stickers. Hovering lifts the nearest corner a few pixels, pulling folds the sticker back along a real fold with its backing showing, pulling far enough peels it off to carry around, and letting go settles it back down.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `stickers` (required) | `StickerPeelItem[]` | – | The stickers, each with an id, label, content, starting center (x and y from 0 to 1), optional rotate in degrees, and shape. |
| `positions` | `Record<string, StickerPlacement>` | – | Controlled placements by id. Each is { x, y, rotate } with x and y from 0 to 1. |
| `onPositionsChange` | `(positions: Record<string, StickerPlacement>) => void` | – | Called once a sticker settles somewhere new, with every placement. Works with or without positions. |
| `label` | `string` | `"Stickers"` | Accessible name of the surface. |
| `children` | `ReactNode` | – | Content drawn on the surface under the stickers. |
| `className` | `string` | – | Class on the surface. Give it a size and background here. |
| `style` | `CSSProperties` | – | Inline style on the surface. |

### StickerPeelItem

One sticker.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id, used as the key in positions. |
| `label` (required) | `string` | – | Accessible name, such as "Arc logo sticker". |
| `content` (required) | `ReactNode` | – | The printed face inside the white die cut border. Give it a fixed size. |
| `x` (required) | `number` | – | Starting center across the surface, from 0 to 1. |
| `y` (required) | `number` | – | Starting center down the surface, from 0 to 1. |
| `rotate` | `number` | `0` | Starting rotation in degrees. |
| `shape` | `"circle" \| "rounded" \| "pill"` | `"rounded"` | Outline of the die cut. The peel starts from the real edge of this shape. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves between stickers. Leaving a sticker you are carrying sticks it down. |
| Enter / Space | Picks the focused sticker up, or sticks it down where it is. |
| Arrow keys | Moves a sticker you are carrying by 10px, or 40px with Shift. |
| Escape | Puts a carried sticker back where it was picked up. |

## Accessibility

- The surface is a labelled group; each sticker is a button with aria-roledescription="sticker", its label, and aria-pressed while carried.
- A visually hidden description explains the keyboard path, and a polite status region announces peeled off, picked up, stuck down, and put back.
- Sticker artwork is aria-hidden; the label carries the meaning.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The lift and shadow of a carried sticker show which one is active.

## Motion

- The peel is a real fold: the pulled part is mirrored across the fold line with clip-path and foreshortened a touch, showing a plain paper backing with one soft shade at the bend and a light shadow that always falls downward.
- Circles peel from the point of the rim nearest the pointer; rounded shapes and pills peel from a corner along its diagonal. The fold may lean at most 35 degrees, so it is always a short, clean corner.
- Hovering with a mouse lifts the nearest corner a few pixels past the outline. Moving to another corner lays the first one flat before lifting the next.
- All springs are critically damped: the paper trails the finger slightly and settles without overshoot, bounce, or swing.
- It comes off once the fold passes the middle, sooner on a quick tug, or once the hand has clearly carried it away. It then rises 3% with a soft shadow and follows the hand at its own angle.
- Dropping lands it exactly where it is on screen and the shadow fades in 200ms. Grabbing it again while it settles catches it in place.
- Reduced motion skips the peel and hover lift; pressing picks the sticker up directly and it follows the pointer 1:1.

## Responsive behavior

- Placements are fractions of the surface, so the arrangement scales with its container and survives resizes.
- Touch drags use pointer capture with touch-action none on stickers only, so the page still scrolls from the surface.
- Carried stickers rubber-band at the surface edges and are clamped inside on drop, accounting for their angle.

## Performance

- Peel geometry is written straight to clip-path and transform on three elements per sticker from motion value events, with no React render per frame.
- Body movement and lift are motion values on transform only; nothing runs per frame while stickers are at rest.

## Notes for AI

- Choose it for one playful, tactile moment: a profile page, a launch page, a team wall, or a collectible badge shelf.
- Give each sticker content a fixed size; the die cut border and shape are added for you.
- Store onPositionsChange output to persist the arrangement, and pass it back as positions.
- Changing positions from outside, such as a reset, glides each sticker to its new spot.
- Keep it under about a dozen stickers so the surface stays readable.

## Related

- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.

## Also in playful

- [Page curl](https://uiarc.dev/components/page-curl/markdown): A small magazine you read by dragging page corners, with a real fold, lit curl, and flick to turn.
- [Orbit logos](https://uiarc.dev/components/orbit-logos/markdown): An integrations showcase with brand logos orbiting your product mark on tilted rings. Hover or focus one to rest the orbit, draw a connection, and see what it does.
- [Prize wheel](https://uiarc.dev/components/prize-wheel/markdown): A referral or promo prize wheel you flick to spin, with real angular momentum, a flexible pointer that ticks against each peg, weighted segments set by the host, a slow suspenseful settle, and the won segment lifting into a reward card with a copyable code.

## Guidance for AI tools

Sticker peel: Peel stickers off a surface with a real curl, move them around, and stick them back down. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
