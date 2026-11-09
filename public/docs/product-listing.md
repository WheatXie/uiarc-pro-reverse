# Product listing

> A storefront grid with price, color and size filters, a sort menu, hover photo swaps, and quick add with a size row.

- Type: Block
- Page: https://uiarc.dev/components/blocks/product-listing
- Markdown: https://uiarc.dev/components/blocks/product-listing/markdown

- Access: Arc Pro
- Registry id: `product-listing`
- Source file: `registry/blocks/product-listing/product-listing.tsx`
- Built from: Slider, Switch, Dropdown menu, Button, Animated counter
- Keywords: product listing, product grid, collection page, category page, ecommerce filters, price range, quick add, shop

Use this for a category or collection page. Pass products from your catalog, call your cart API in onAddToCart, and move filter state into the URL if you need shareable links.

## When to use

- A shop's collection or category page with a few dozen to a few hundred products.
- Catalogs where color and size are the main filters and a quick add saves a trip to the product page.

## When not to use

- One product with many options; use product-detail or product-configurator.
- Huge catalogs with faceted server search; keep the card and filter styles but fetch results from your search service.

## Installation

Product listing is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/product-listing
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ProductListing } from "@/components/arc/blocks/product-listing/product-listing";

export function CollectionPage({ products }) {
  return (
    <ProductListing
      title="Lighting"
      products={products}
      onAddToCart={(product, size) => cart.add(product.id, size)}
    />
  );
}
```

## API reference

### ProductListing

A storefront listing with a filter sidebar (dual price range, color swatches, sizes, in stock switch), a sort menu, and product cards that swap to a second photo on hover. Quick add opens a size row inside the card and the bag count rolls.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `products` | `ListingProduct[]` | `sample catalog` | Products to list. The price range bounds come from these prices, rounded to 10. |
| `colors` | `ListingColor[]` | `sample colors` | { id, name, swatch } for the color filter and the dots under each card. |
| `sizes` | `string[]` | `["S", "M", "L"]` | Size filter options. |
| `defaultSort` | `"featured" \| "newest" \| "price-asc" \| "price-desc"` | `"featured"` | Initial sort. Featured uses rank, newest uses added. |
| `onAddToCart` | `(product: ListingProduct, size: string) => void` | – | Called when a product is added from its card. Single size products add straight away. |
| `defaultCartCount` | `number` | `0` | Items already in the bag. |
| `currency` | `string` | `"USD"` | ISO currency for prices. |
| `locale` | `string` | `"en-US"` | Locale for price formatting. |
| `title` | `string` | `"Home goods"` | Collection heading. |
| `className` | `string` | – | Extra class on the root. |

### ListingProduct

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id, name, detail` (required) | `string` | – | Identity and a short line under the name, such as the material. |
| `price` (required) | `number` | – | Price in whole currency units. |
| `compareAt` | `number` | – | Previous price. Shows struck through beside the sale price. |
| `image, alt` (required) | `string` | – | Main photo and its description. |
| `hoverImage` | `string` | – | Second photo that crossfades in on hover inside the same 4:5 box, without zooming. |
| `colors, sizes` (required) | `string[]` | – | Color ids and sizes this product comes in. A product matches a filter when any of its values is selected. |
| `inStock` (required) | `boolean` | – | False shows Sold out in the card meta row and disables quick add. |
| `badge` | `string` | – | Short status text in the card meta row, such as New. Sale is already shown by compareAt. |
| `added, rank` (required) | `number` | – | Sort keys for newest and featured. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Move through filters, the sort menu, and each card's quick add. |
| Arrow keys | Move a price handle by 10, or move through sort options while the menu is open. |
| Enter / Space | Toggle a swatch or size, choose a sort option, or open quick add. |
| Escape | Close the sort menu, the size row, or the filter sheet. |

## Accessibility

- Price handles are native range inputs with labels and currency value text.
- Swatches and size chips are toggle buttons with aria-pressed and color names; the colors under each card are listed in an accessible label.
- The sort menu is a listbox popup with aria-activedescendant and returns focus to its button.
- Quick add names its product, the size row is a labelled group, and each addition is announced through a live region.
- On narrow widths the filters open in a modal sheet that takes focus and closes with Escape.

## Motion

- Cards reflow on a spring when filters or sort change; removed cards fade out and new ones fade in, all at the same size.
- Hover crossfades to the second photo inside the same fixed 4:5 box, with no zoom. Quick add rises into view on hover.
- Quick add, the size row, and Added swap in place inside one glass pill with a short blur.
- The bag icon tilts and the count rolls when something is added.
- Reduced motion drops the travel and layout animation and keeps opacity fades.

## Responsive behavior

- Above 900px a 232px filter sidebar sits beside a grid of cards at least 196px wide; from 640px to 900px the sidebar narrows to 208px.
- Below 640px the sidebar becomes a Filters button with an active count that opens a sheet from the left.
- Below 420px the sort button stretches to fill the toolbar. Quick add is always visible on touch screens.

## Performance

- Images use next/image with responsive sizes; the hover photo only loads its small size until shown.
- Layout animation runs on position only, with popLayout exits, so filtering stays smooth with dozens of cards.

## Notes for AI

- Use for category, collection, and search result pages. Pass products already scoped to the page; the block filters and sorts on the client.
- Put filter state in the URL if people share links; lift sort and filters into props when you do.
- Keep hoverImage a lifestyle or alternate angle shot at the same aspect ratio as the main image.

## Related

- [Product detail](https://uiarc.dev/components/blocks/product-detail/markdown): A product page with a swipeable gallery, finish and size variants, add to bag that confirms in place, shipping, a reviews summary, and details.
- [Cart drawer](https://uiarc.dev/components/blocks/cart-drawer/markdown): Products fly into the cart, counts roll, and a drawer handles quantities, shipping progress, and checkout.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
