# Gravity well

> A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/gravity-well
- Markdown: https://uiarc.dev/components/gravity-well/markdown
- Source file: `registry/components/gravity-well/gravity-well.tsx`
- Dependencies: motion
- Keywords: special, grid, physics, new, gravity, spacetime, magnetic, lens, shockwave, ripple, tiles, springs

## When to use

- A team, customer, or moodboard wall where playfulness is the point.
- Landing page sections that show breadth: many logos, avatars, or photos at once.

## When not to use

- Grids people must scan or click precisely, like file pickers; use a plain grid.
- Large collections; use infinite-moodboard or photo-grid.

## Installation

Gravity well is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/gravity-well
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { GravityWell } from "@/components/arc/gravity-well/gravity-well";

export function Team({ people }: { people: { name: string; src: string }[] }) {
  return (
    <GravityWell label="Team">
      {people.map(person => <img key={person.src} src={person.src} alt={person.name} />)}
    </GravityWell>
  );
}
```

## API reference

### GravityWell

A grid of tiles that bends toward the pointer like spacetime around a mass. Tiles near the well lean in, shrink, and dim on their own springs; a click sends a shockwave rolling outward through the grid.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` (required) | `ReactNode` | – | One tile per child. Photos, avatars, icons, or any small content. |
| `columns` | `number` | – | Fixed column count. Leave it out to fit as many columns as minTileSize allows. |
| `minTileSize` | `number` | `56` | Smallest tile width in px when columns is not set. |
| `gap` | `number` | `8` | Gap between tiles in px. |
| `radius` | `number` | `150` | Reach of the well in px. |
| `strength` | `number` | `1` | Pull strength from 0 to about 1.5. |
| `onPulse` | `(origin: { x: number; y: number }) => void` | – | Called when a click or key sends a shockwave, with its origin in px from the top left of the grid. |
| `label` | `string` | `"Gravity well"` | Accessible name for the grid. |
| `className` | `string` | – | Extra class on the root. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the grid and places the well on the current tile. |
| Arrow keys | Moves the well from tile to tile. |
| Home / End | Moves the well to the first or last tile. |
| Space or Enter | Sends a shockwave from the current tile. |

## Accessibility

- The root is a named group with aria-roledescription="gravity well". Tile content keeps its own semantics and alt text.
- Motion is decorative: tiles keep their grid slot and only move with transform, so reading order never changes.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. The well itself shows where keyboard focus is.

## Motion

- The well follows the pointer on a critically damped spring, and each tile follows the field on an underdamped spring, so fast moves leave a jelly wake.
- Tiles deeper in the well shrink, dim, and slide under their neighbours.
- A click drops a shockwave that travels at 900 px/s and rings each tile once as it passes.
- Reduced motion leaves the grid static.

## Responsive behavior

- Columns fit the width with minTileSize, or stay fixed with columns.
- Touch: a tap sends a shockwave and dragging pulls the well; vertical scroll keeps working.

## Performance

- One transform, opacity, and z-index write per tile per frame, with no layout reads during animation.
- The loop stops once every spring is at rest.

## Notes for AI

- Use a uniform set of square tiles, around 30 to 60. Content is wrapped in square cells; set object-fit: cover on images.
- Tie onPulse to something meaningful, like shuffling or selecting, or leave it as pure delight.

## Related

- [Dot grid](https://uiarc.dev/components/dot-grid/markdown): A dot field that bulges around the cursor like a lens and ripples from every click.
- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.

## Also in cursor

- [Image trail](https://uiarc.dev/components/image-trail/markdown): Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away.
- [Ink fluid](https://uiarc.dev/components/ink-fluid/markdown): A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone.

## Guidance for AI tools

Gravity well: A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
