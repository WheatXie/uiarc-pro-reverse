# Image trail

> Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/image-trail
- Markdown: https://uiarc.dev/components/image-trail/markdown
- Source file: `registry/components/image-trail/image-trail.tsx`
- Dependencies: motion
- Keywords: special, media, cursor, new, image trail, cursor image trail, mouse trail photos, hover photo trail, portfolio hero effect, image cursor follow, react image trail

## When to use

- A portfolio or agency hero that should feel alive on first move.
- Travel, food, or product stories told through a sequence of photos.
- Launch pages that want an instantly playful surface.

## When not to use

- Use photo-grid or lightbox-gallery when people need to look at each photo.
- Use hover-image-list to preview one image per row in a list.
- Avoid it behind long text that people need to read.

## Installation

Image trail is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/image-trail
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ImageTrail } from "@/components/arc/image-trail/image-trail";

const images = [
  { src: "/photos/tram.jpg", alt: "A yellow tram in Lisbon" },
  { src: "/photos/rooftops.jpg", alt: "Terracotta rooftops" },
  { src: "/photos/sea.jpg", alt: "The sea at dusk" },
];

export function Hero() {
  return (
    <ImageTrail images={images} style={{ height: 420 }}>
      <h1>Lisbon, in passing</h1>
    </ImageTrail>
  );
}
```

## API reference

### ImageTrail

An area that leaves a trail of photos behind the pointer. Photos pop in at the pointer, lean toward the direction of travel, drift on with its momentum, and fade.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `images` (required) | `{ src: string; alt?: string }[]` | – | Photos shown in order along the trail. Pass small renditions; a photo is never shown larger than size. |
| `children` | `ReactNode` | – | Content laid over the trail, such as a headline. Links and buttons inside stay clickable. |
| `spacing` | `number` | `90` | Pointer travel between photos, in px. |
| `lifetime` | `number` | `700` | How long a photo stays before it fades, in ms. |
| `size` | `number` | `168` | Photo width in px. |
| `aspectRatio` | `number` | `4 / 5` | Photo width divided by height. |
| `maxTilt` | `number` | `10` | Largest lean in degrees at full pointer speed. |
| `poolSize` | `number` | `14` | How many photos can be on screen at once. |
| `intro` | `boolean` | `false` | Plays one short S-curve sweep of photos the first time the area scrolls into view, hinting at the effect. Skipped with reduced motion or once the pointer has moved in. |
| `disabled` | `boolean` | `false` | Stops new photos and gives touch scrolling back to the page. |
| `className` | `string` | – | Extra class on the root. Give the root a height. |
| `style` | `CSSProperties` | – | Inline styles on the root. |

## Accessibility

- Trail photos are decorative and aria-hidden; put anything people need in children.
- Children stay in normal reading order and remain interactive.
- The effect is pointer only and adds nothing a keyboard or screen reader user misses.

## Motion

- A new photo appears only after the pointer has travelled spacing px, and never faster than every 40ms, so the trail stays curated.
- Each photo enters on the shared spring curve from 60% scale, leans with horizontal speed plus a small fixed variation, then drifts along the pointer's path as it shrinks and fades.
- Photos are pooled DOM nodes animated with the Web Animations API on transform and opacity only.
- Reduced motion keeps the trail as a calm crossfade in place, with no scale, tilt, or drift, and wider spacing.

## Responsive behavior

- Works at any size; the demo drops to 360px tall and a smaller headline on phones.
- Touch drags draw the trail with the finger; taps do nothing.

## Performance

- A fixed pool of image nodes is reused, so a long trail never grows the DOM.
- Images are preloaded on mount. Animations run on the compositor through WAAPI.

## Notes for AI

- Choose it for portfolio, travel, or studio heroes where photos are the story.
- Pass 8 to 14 small images (about 384px wide) in a deliberate order; the trail shows them in sequence.
- Give the root a height. A white headline with mix-blend-mode: difference reads over the photos in both themes.
- The area sets touch-action: none so a finger drag draws the trail; keep it to a hero sized block, or set disabled on small screens if scrolling matters more.

## Related

- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.
- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

## Also in cursor

- [Dot grid](https://uiarc.dev/components/dot-grid/markdown): A dot field that bulges around the cursor like a lens and ripples from every click.
- [Gravity well](https://uiarc.dev/components/gravity-well/markdown): A grid of tiles that bends toward the cursor like spacetime, with a click that sends a shockwave through it.
- [Ink fluid](https://uiarc.dev/components/ink-fluid/markdown): A real time fluid simulation behind your hero: the cursor stirs soft ink that swirls, settles and fades; calm when left alone.

## Guidance for AI tools

Image trail: Moving the pointer leaves a curated trail of photos that pop in, lean, and fade away. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
