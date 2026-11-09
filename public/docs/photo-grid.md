# Photo grid

> Pinch through zoom levels and open any photo straight from its cell.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/photo-grid
- Markdown: https://uiarc.dev/components/photo-grid/markdown
- Source file: `registry/components/photo-grid/photo-grid.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, photos, gallery, react photo grid, photo library, pinch to zoom grid, ios photos grid, image gallery with viewer, album grid, photo viewer

## When to use

- A browsable photo library or album where people zoom between column counts.
- Galleries that need favorites and a full-screen viewer with a filmstrip.
- Touch and trackpad users who expect pinch to change density.

## When not to use

- Use lightbox-gallery for a masonry layout that keeps each photo's aspect ratio.
- Use carousel for a short inline slideshow.
- Use image-compare for before and after pairs.

## Installation

Photo grid is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/photo-grid
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PhotoGrid, type GridPhoto } from "@/components/arc/photo-grid/photo-grid";

export function Album({ photos }: { photos: GridPhoto[] }) {
  return (
    <PhotoGrid
      title="September"
      photos={photos}
      defaultColumns={4}
      onFavoriteChange={(id, favorite) => saveFavorite(id, favorite)}
    />
  );
}
```

## API reference

### PhotoGrid

A photo library grid with pinch or button zoom between column counts, favorites, and a full-screen viewer that grows from the tapped cell.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `photos` (required) | `{ id: string; src: string; srcSet?: string; alt: string; width: number; height: number; title: string; detail?: string }[]` | – | Photos in order. width and height are the intrinsic size; detail is a short line in the viewer, such as the date. |
| `title` (required) | `string` | – | Names the library, such as a month or album. |
| `zoomLevels` | `number[]` | `[5, 3, 2]` | Column counts the zoom steps between. |
| `defaultColumns` | `number` | `3` | Initial column count. |
| `onColumnsChange` | `(columns: number) => void` | – | Called when the zoom level changes. |
| `defaultFavorites` | `string[]` | – | Ids favorited at mount. |
| `onFavoriteChange` | `(id: string, favorite: boolean) => void` | – | Called when a photo is favorited or unfavorited. |
| `onViewerChange` | `(id: string \| null) => void` | – | Called with the photo id when the viewer opens and null as it starts to close. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move focus between photos in the grid. |
| PageUp / PageDown / Home / End | Jump by three rows or to the first or last photo. |
| + / - | Zoom in or out a level around the focused photo. |
| Enter / Space | Opens the focused photo in the viewer. |
| ArrowLeft / ArrowRight / Home / End | In the viewer, change photo. |
| Escape | Closes the viewer. |

## Accessibility

- The grid is a labelled list of buttons named by each photo's alt text, with ", favorite" appended when favorited.
- Zoom buttons use aria-pressed; the viewer is a labelled dialog and its filmstrip is a slider with the photo title in aria-valuetext.
- Viewer changes are announced in a polite status region.

## Motion

- Pinch zoom scales live and reflows around the photo under the fingers; the viewer grows from the tapped cell and can be dragged down to dismiss.
- Counters and favorite icons roll or pop in with a short blur.
- Reduced motion removes layout travel and keeps fades.

## Responsive behavior

- Columns come from zoomLevels, not breakpoints; the root is a container and needs a height, with a 320px minimum.
- Below 480px the header and filmstrip shrink, previous and next buttons hide, and swipe or the filmstrip pages instead.
- Previous and next arrows are hidden on hover-less devices, where swipe is the main gesture.

## Performance

- The grid is not virtualized; every photo renders a thumbnail, so paginate very large libraries.
- The viewer only mounts photos near the current one, and passing srcSet keeps thumbnails light.
- The header and viewer use backdrop blur, which drops to solid surfaces under prefers-reduced-transparency.

## Notes for AI

- Choose it for a browsable photo library or album. Use carousel for a short slideshow and image-compare for before/after.
- Always pass width and height so the viewer and filmstrip can fit each photo without layout shift; pass srcSet for sharp thumbnails.

## Related

- [Carousel](https://uiarc.dev/components/carousel/markdown): Browse a row of slides by dragging, flicking, or arrowing through them.
- [Image compare](https://uiarc.dev/components/image-compare/markdown): Drag a divider across two images to see what changed.
- [Cover flow](https://uiarc.dev/components/cover-flow/markdown): A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.
- [Dialog](https://uiarc.dev/components/dialog/markdown): A focused surface for decisions that need attention.

## Also in galleries

- [Product gallery](https://uiarc.dev/components/product-gallery/markdown): A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.
- [Lightbox gallery](https://uiarc.dev/components/lightbox-gallery/markdown): A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

## Guidance for AI tools

Photo grid: Pinch through zoom levels and open any photo straight from its cell. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
