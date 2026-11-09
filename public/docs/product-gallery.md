# Product gallery

> A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/product-gallery
- Markdown: https://uiarc.dev/components/product-gallery/markdown
- Source file: `registry/components/product-gallery/product-gallery.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, new, react product gallery, product image zoom, ecommerce gallery, image magnifier, variant picker, color and size selector, product detail page, fullscreen image viewer

## When to use

- Product detail pages with several photos per color and a size picker.
- Stores where shoppers need to zoom into fabric, texture, or small print.
- Variants that sell out per color and should be struck through, not hidden.

## When not to use

- Use lightbox-gallery for a photo grid that opens into a viewer, with no variants.
- Use carousel for marketing slides or cards.
- Use photo-grid for a masonry of images without a main photo.

## Installation

Product gallery is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/product-gallery
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { ProductGallery } from "@/components/arc/product-gallery/product-gallery";
import Button from "@/components/arc/button/button";

export function ProductPage() {
  const [size, setSize] = useState<string | null>(null);
  return (
    <ProductGallery
      label="Field jacket"
      colors={[
        { value: "olive", label: "Olive", swatch: "#6b6a4a", images: [{ src: "/jacket/olive-1.jpg", alt: "Olive jacket, front" }, { src: "/jacket/olive-2.jpg", alt: "Olive jacket, back" }] },
        { value: "navy", label: "Navy", swatch: "#27304a", images: [{ src: "/jacket/navy-1.jpg", alt: "Navy jacket, front" }] },
      ]}
      sizes={[
        { value: "s", label: "S" },
        { value: "m", label: "M", soldOut: ["navy"] },
        { value: "l", label: "L" },
      ]}
      size={size}
      onSizeChange={setSize}
      header={<><h1>Field jacket</h1><p>$240</p></>}
      footer={<Button disabled={!size}>Add to bag</Button>}
    />
  );
}
```

## API reference

### ProductGallery

A product media gallery with a hover magnifier, a thumbnail rail, swipe on touch, a fullscreen zoom viewer, and a color and size picker.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `colors` (required) | `ProductGalleryColor[]` | – | Colors: { value, label, swatch, images, soldOut? }. Each carries its own images: { src, alt, srcSet? }. |
| `sizes` | `ProductGallerySize[]` | – | Sizes: { value, label, soldOut? }. soldOut is true for every color or a list of color values. |
| `color` | `string` | – | Controlled color value. |
| `defaultColor` | `string` | – | Starting color when uncontrolled. Defaults to the first color. |
| `onColorChange` | `(color: string) => void` | – | Called when a swatch is chosen. |
| `size` | `string \| null` | – | Controlled size value, or null for none. |
| `defaultSize` | `string \| null` | `null` | Starting size when uncontrolled. |
| `onSizeChange` | `(size: string \| null) => void` | – | Called when a size is chosen or cleared, including when a color change sells it out. |
| `index` | `number` | – | Controlled index of the photo on show. |
| `defaultIndex` | `number` | `0` | Starting photo when uncontrolled. |
| `onIndexChange` | `(index: number) => void` | – | Called when the photo changes. |
| `zoom` | `number` | `2.4` | Magnification of the hover lens and the fullscreen zoom. |
| `magnifier` | `boolean` | `true` | Turns the hover lens on or off. |
| `aspectRatio` | `number` | `4 / 5` | Aspect ratio of the main photo and thumbnails, as width / height. |
| `label` | `string` | `"Product photos"` | Product name, used to name the gallery and its viewer. |
| `header` | `ReactNode` | – | Content above the picker, such as the name and price. |
| `footer` | `ReactNode` | – | Content under the picker, such as add to bag. |
| `className` | `string` | – | Class on the root. |
| `ref` | `Ref<HTMLDivElement>` | – | The root element. |

### isSoldOut

Whether a size is sold out in a given color.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `size` (required) | `ProductGallerySize` | – | The size entry. |
| `color` (required) | `string` | – | The color value. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowLeft / ArrowRight | Steps photos on the main photo, the thumbnail rail, and in the viewer. |
| Arrow keys / Home / End | Move and select within the thumbnail rail, swatches, and sizes; sold-out sizes are skipped. |
| Enter / Space | Opens the fullscreen viewer from the main photo. |
| Escape | Zooms out in the viewer, then closes it and returns focus to the photo. |
| Tab | Cycles within the viewer's buttons while it is open. |

## Accessibility

- The main photo is a button labelled with the photo's alt text, its position, and Open fullscreen.
- Thumbnails are a tablist; swatches and sizes are radiogroups with roving tabindex, and sold-out sizes use aria-disabled.
- The viewer is a modal dialog that focuses Close on open, traps Tab, locks body scroll, and announces the photo count politely.
- Every image needs a meaningful alt; thumbnails and the lens are decorative copies.

## Motion

- The photo track springs to the photo on show and follows a finger one to one, with rubber-band edges; one flick moves one photo.
- The lens rides a spring behind the pointer; rail, swatch, and size highlights glide to the active option.
- The viewer grows out of the photo's own rectangle with counter-scaled corners and returns to it on close; zoom scales on a spring and pans after the pointer.
- Changing color crossfades every photo from a blur. Reduced motion jumps the track, lens, and zoom, and replaces the viewer flight with a fade.

## Responsive behavior

- The root is a container: photos and details sit side by side above 680px, stack at 680px and below, and the rail moves under the photo at 520px and below.
- On touch screens (hover: none) the photo shows dots and a permanent expand icon; the lens is mouse only.
- The viewer frame sizes to fit the viewport at the photo's ratio, with 12px padding under 640px and 48px above; it refits on resize.

## Performance

- Only the photo on show loads eagerly; the rest and every thumbnail are lazy with async decoding.
- Each highlight (rail, swatches, sizes) and the stage run one ResizeObserver; the lens reuses the current image at zoom size.
- The viewer is portaled to the body only while open.

## Notes for AI

- Use on a product detail page. Put the name, price, and reviews in header and purchase buttons in footer.
- Give each color its own photos; if a size is sold out in the new color, the selection clears through onSizeChange.
- Photos are plain img tags; pass optimized src and srcSet URLs. Set magnifier={false} for photos without fine detail.
- For a general photo grid with a lightbox use lightbox-gallery; for a simple slide rotation use carousel.

## Related

- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Radio group](https://uiarc.dev/components/radio-group/markdown): Choose one option from a visible set.

## Also in galleries

- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.

## Guidance for AI tools

Product gallery: A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
