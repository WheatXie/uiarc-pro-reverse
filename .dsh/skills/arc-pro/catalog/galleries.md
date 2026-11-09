# Galleries

## `cover-flow` · Cover flow (Pro, special)

A depth rail of images you can throw, with soft grounded shadows and a quiet reflection.

When to use:
- Six to twelve visual items where looking at one at a time is the point, such as albums, places, or collections.
- Showcase rails that should respond to drag, throw, and sideways trackpad scroll.

When not to use:
- Use carousel for general slides or content cards.
- Use photo-grid or lightbox-gallery for a large library.

Keywords: special, cover flow, carousel, react cover flow, coverflow carousel, 3d carousel, album carousel, image rail, itunes cover flow

Files: src/components/arc/cover-flow/cover-flow.module.css, src/components/arc/cover-flow/cover-flow.tsx, src/components/arc/cover-flow/demo.tsx

## `lightbox-gallery` · Lightbox gallery (Pro, special)

A masonry grid where photos zoom from their slot into a viewer you can swipe, pinch, and drag away.

When to use:
- Photo collections people browse and inspect up close, such as trips, portfolios, or listings.
- Mixed portrait and landscape sets that should keep their aspect ratios in a masonry grid.

When not to use:
- Use photo-grid for a square grid with pinch zoom between densities.
- Use carousel for a single inline row without a viewer.

Keywords: special, gallery, lightbox, images, react lightbox, image gallery, masonry gallery, photo lightbox, fullscreen image viewer, zoomable gallery, next image gallery

Files: src/components/arc/lightbox-gallery/demo.module.css, src/components/arc/lightbox-gallery/demo.tsx, src/components/arc/lightbox-gallery/lightbox-gallery.module.css, src/components/arc/lightbox-gallery/lightbox-gallery.tsx

## `photo-grid` · Photo grid (Pro, special)

Pinch through zoom levels and open any photo straight from its cell.

When to use:
- A browsable photo library or album where people zoom between column counts.
- Galleries that need favorites and a full-screen viewer with a filmstrip.

When not to use:
- Use lightbox-gallery for a masonry layout that keeps each photo's aspect ratio.
- Use carousel for a short inline slideshow.

Keywords: special, photos, gallery, react photo grid, photo library, pinch to zoom grid, ios photos grid, image gallery with viewer, album grid, photo viewer

Files: src/components/arc/photo-grid/demo.tsx, src/components/arc/photo-grid/photo-grid-data.ts, src/components/arc/photo-grid/photo-grid.module.css, src/components/arc/photo-grid/photo-grid.tsx

## `product-gallery` · Product gallery (Pro, special)

A product gallery with a hover magnifier, gliding thumbnails, and color and size variants that crossfade photos.

When to use:
- Product detail pages with several photos per color and a size picker.
- Stores where shoppers need to zoom into fabric, texture, or small print.

When not to use:
- Use lightbox-gallery for a photo grid that opens into a viewer, with no variants.
- Use carousel for marketing slides or cards.

Keywords: special, new, react product gallery, product image zoom, ecommerce gallery, image magnifier, variant picker, color and size selector, product detail page, fullscreen image viewer

Files: src/components/arc/product-gallery/demo.tsx, src/components/arc/product-gallery/product-gallery.module.css, src/components/arc/product-gallery/product-gallery.tsx
