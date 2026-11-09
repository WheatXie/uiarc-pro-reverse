# Dot grid

> A dot field that bulges around the cursor like a lens and ripples from every click.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/dot-grid
- Markdown: https://uiarc.dev/components/dot-grid/markdown
- Source file: `registry/components/dot-grid/dot-grid.tsx`
- Dependencies: motion
- Keywords: special, motion, new, dot grid, interactive dot background, dot field, magnetic dots, ripple background, hero background, canvas dots, lens effect

## When to use

- A landing page hero that should feel alive without video.
- A background for an empty state, a sign in panel, or a launch countdown.
- A playful section divider people can poke at.

## When not to use

- Behind dense text or data; the moving dots compete with reading.
- Use a static CSS dot pattern when no interaction is wanted.
- Avoid stacking several on one screen; one reactive background is enough.

## Installation

Dot grid is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/dot-grid
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DotGrid } from "@/components/arc/dot-grid/dot-grid";

export function Hero() {
  return (
    <DotGrid style={{ height: 480 }}>
      <h1>Interfaces with a pulse</h1>
    </DotGrid>
  );
}
```

## API reference

### DotGrid

A canvas field of dots that bulge away from the pointer like a lens, wobble back on a spring, and ripple outward from every click. Content placed inside sits on top and stays interactive.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `gap` | `number` | `22` | Distance between dots in px. Lower is denser. |
| `dotSize` | `number` | `1.4` | Dot radius in px at rest. |
| `radius` | `number` | `150` | Lens radius around the pointer in px. |
| `strength` | `number` | `16` | How far dots are pushed at the strongest point of the lens, in px. |
| `ripple` | `boolean` | `true` | Clicks and taps send a ripple through the field. |
| `fade` | `boolean` | `true` | Fades the field toward its edges. |
| `color` | `string` | – | Dot color at rest. Defaults to the strong border token. |
| `activeColor` | `string` | – | Color dots take under the lens and in ripples. Defaults to the accent token. |
| `children` | `ReactNode` | – | Content drawn over the field, such as a hero headline. |
| `className` | `string` | – | Class on the root. Give it a height or let children size it. |
| `style` | `CSSProperties` | – | Inline style on the root. |

## Accessibility

- The canvas is aria-hidden and not focusable; the field is decoration and adds nothing to the reading order.
- Children render as normal DOM above the canvas, so links and buttons keep their semantics and pointer events.
- With reduced motion dots never move; the lens only tints dots near the pointer and clicks do not ripple.

## Motion

- Each dot rides its own damped spring toward the lens and ripple offsets, so the field wobbles and settles instead of snapping.
- The lens peaks a third of the way out and fades to nothing at its rim, and it trails the pointer slightly and fades in and out.
- Ripples travel at about 620px per second, fade over 1.5s, and up to six can overlap.
- Dots under the lens and in a ripple grow and take the active color.

## Responsive behavior

- The grid rebuilds on resize and centers itself in the box.
- On touch screens the lens appears only while a finger is down, and every tap ripples.
- Device pixel ratio is capped at 2.

## Performance

- Dot state lives in typed arrays; resting dots draw in a single path fill.
- The loop stops when the pointer leaves and all dots settle, and pauses when the field is off screen.
- A 720 by 420 field at gap 22 is about 650 dots; gap 14 is about 1,600.

## Notes for AI

- Choose it as a hero or section background that reacts to the visitor.
- Put the headline and actions inside as children; the field listens to the pointer across the whole root.
- Raise gap for large areas and low powered devices; 22 to 32 suits full width heroes.
- Pass color and activeColor to match a brand; any CSS color works, including var() values resolved on the root.

## Related

- [Stretch refresh](https://uiarc.dev/components/stretch-refresh/markdown): Pull a feed down and a line stretches to tell you when to let go.

## Also in cursor

- [Image trail](https://uiarc.dev/components/image-trail/markdown): Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away.
- [Gravity well](https://uiarc.dev/components/gravity-well/markdown): A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it.
- [Ink fluid](https://uiarc.dev/components/ink-fluid/markdown): A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone.

## Guidance for AI tools

Dot grid: A dot field that bulges around the cursor like a lens and ripples from every click. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
