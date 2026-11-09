# Lightbox gallery

> A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/lightbox-gallery
- Markdown: https://uiarc.dev/components/lightbox-gallery/markdown
- Source file: `registry/components/lightbox-gallery/lightbox-gallery.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, gallery, lightbox, images, react lightbox, image gallery, masonry gallery, photo lightbox, fullscreen image viewer, zoomable gallery, next image gallery

## When to use

- Photo collections people browse and inspect up close, such as trips, portfolios, or listings.
- Mixed portrait and landscape sets that should keep their aspect ratios in a masonry grid.

## When not to use

- Use photo-grid for a square grid with pinch zoom between densities.
- Use carousel for a single inline row without a viewer.
- Use dialog to show one arbitrary piece of content.

## Installation

Lightbox gallery is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/lightbox-gallery
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LightboxGallery } from "@/components/arc/lightbox-gallery/lightbox-gallery";

const photos = [
  { src: "/trip/harbor.jpg", width: 1600, height: 1067, alt: "Boats in a harbor at dawn", title: "Harbor", caption: "May 2026" },
  { src: "/trip/alley.jpg", width: 1067, height: 1600, alt: "Narrow alley with lanterns", title: "Old town" },
  { src: "/trip/cliffs.jpg", width: 1600, height: 1200, alt: "Cliffs over the sea" },
];

export function TripPhotos() {
  return <LightboxGallery images={photos} label="Trip photos" minColumnWidth={180} />;
}
```

## API reference

### LightboxGallery

A masonry grid of photos that open in a fullscreen viewer. The tapped photo zooms out of its grid slot and flies back to the slot of whichever photo is showing when the viewer closes.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `images` (required) | `{ src: string; width: number; height: number; alt: string; title?: string; caption?: string }[]` | – | Photos in reading order. width and height are the intrinsic size, which sets the aspect ratio in the grid, zoom, and return flight. title and caption are the two caption lines. |
| `minColumnWidth` | `number` | `150` | Columns are added while each stays at least this wide, in px. There are always at least two. |
| `gap` | `number` | `8` | Gap between photos in px. |
| `label` | `string` | `"Photo gallery"` | Accessible name of the gallery and its viewer. |
| `className` | `string` | – | Class on the root region. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Open the focused photo in the viewer. |
| Arrow Left / Arrow Right | Previous or next photo in the viewer. |
| + / - / 0 | Zoom in, zoom out, or reset zoom. |
| Escape | Close the viewer; focus returns to the matching grid photo. |
| Tab | Cycles within the viewer's controls while it is open. |

## Accessibility

- The grid is a labelled region of buttons named like "Open Harbor, photo 1 of 3"; the viewer is a portalled role="dialog" with aria-modal and a focus trap, and focus starts on Close.
- Only the current slide is exposed to assistive tech, and a polite live counter reads "2 of 12" as photos change.
- Zoom is an aria-pressed toggle, previous and next are disabled at the ends, and the thumbnail strip marks the current photo with aria-current.

## Motion

- Opening flies the photo from its grid slot to fit the stage on a spring with a constant corner radius; closing flies it back to the current photo's slot while the backdrop fades.
- Drag down to dismiss with resistance, swipe between photos with momentum, and pinch, Ctrl+scroll, or double click to zoom around the pointer.
- Reduced motion skips the flight and swiping springs, fades the viewer in and out, and jumps zoom and slides into place.

## Responsive behavior

- Columns are computed from the gallery's own width and minColumnWidth, with at least two.
- Below 640px viewport width the side arrows hide and swipe navigates; pinch, drag to dismiss, and double tap zoom work on touch.

## Performance

- Grid images pass responsive sizes hints and viewer slides load lazily except the current one. Images are plain img elements unless ArcProvider sets an image component such as next/image.
- The grid is not virtualized, so paginate very large collections.
- With next/image set through ArcProvider, remote image hosts must be allowed in next.config.

## Notes for AI

- Use for a photo collection people browse and inspect up close, such as trips, portfolios, or listings. Use photo-grid for a grid without a fullscreen viewer, carousel for a single inline row with no zoom, and dialog to show one arbitrary piece of content.
- Always pass real width, height, and alt for every image so the masonry and flights keep aspect ratios; images render as plain img elements unless you pass next/image (or your own image component) through ArcProvider from @/components/arc/lib/arc-provider.

## Related

- [Photo grid](https://uiarc.dev/components/photo-grid/markdown): Pinch through zoom levels and open any photo straight from its cell.
- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.
- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.

## Also in galleries

- [Product gallery](https://uiarc.dev/components/product-gallery/markdown): A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.

## Guidance for AI tools

Lightbox gallery: A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
