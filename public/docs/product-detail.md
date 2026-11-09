# Product detail

> A product page with a swipeable gallery, finish and size variants, add to bag that confirms in place, shipping, a reviews summary, and details.

- Type: Block
- Page: https://uiarc.dev/components/blocks/product-detail
- Markdown: https://uiarc.dev/components/blocks/product-detail/markdown

- Access: Arc Pro
- Registry id: `product-detail`
- Source file: `registry/blocks/product-detail/product-detail.tsx`
- Built from: Carousel, Radio group, Number field, Accordion, Button
- Keywords: product detail, product page, pdp, ecommerce, gallery, variants, add to cart, reviews summary, shop

Use this as the product page of a store. Pass the product with its finishes, sizes and stock, return your cart request from onAddToCart, and send back in stock alerts through onNotify.

## When to use

- Product pages with a few variants, a gallery, and reviews.
- Stores that want stock aware variants with a restock alert instead of a dead button.

## When not to use

- Products built from many options with live pricing; use product-configurator.
- Browsing many products; use product-listing.

## Installation

Product detail is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/product-detail
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ProductDetail } from "@/components/arc/blocks/product-detail/product-detail";

export function ProductPage({ product }) {
  return (
    <ProductDetail
      product={product}
      onAddToCart={selection => fetch("/api/cart", { method: "POST", body: JSON.stringify(selection) })}
      onNotify={selection => subscribeRestock(selection)}
    />
  );
}
```

## API reference

### ProductDetail

A product page with a swipeable gallery and thumbnails, finish and size variants, a quantity stepper, add to bag that confirms in place, shipping promises, a reviews summary, and a details accordion.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `product` | `DetailProduct` | `sample lamp` | The product with finishes, sizes, reviews, shipping lines, and detail sections. |
| `defaultFinish` | `string` | `first finish` | Initial finish id. |
| `defaultSize` | `string` | `first size` | Initial size id. |
| `onAddToCart` | `(selection: DetailSelection) => void \| Promise<void>` | – | Adds the selection. Return a promise to show Adding until it settles; a rejection shows Try again. Without it the preview simulates a short request. |
| `onNotify` | `(selection) => void` | – | Called when someone asks to be told when a sold out finish and size is back. |
| `onWishlistChange` | `(saved: boolean) => void` | – | Called when the heart is toggled. |
| `defaultCartCount` | `number` | `0` | Items already in the bag. |
| `maxQuantity` | `number` | `9` | Upper bound of the stepper. |
| `currency, locale` | `string` | `"USD", "en-US"` | Price formatting. |
| `className` | `string` | – | Extra class on the root. |

### DetailProduct

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id, name, collection, summary` (required) | `string` | – | Identity, breadcrumb collection, and a one or two sentence summary. |
| `finishes` (required) | `{ id, name, swatch, images }[]` | – | Each finish has its own photos; switching finish crossfades the gallery in place. |
| `sizes` (required) | `{ id, name, price, note?, soldOutIn? }[]` | – | Price per size. soldOutIn lists finish ids in which the size is out of stock. |
| `rating, reviewCount, distribution` (required) | `number, number, [5 numbers]` | – | Average, total, and counts for 5 to 1 stars. |
| `shipping` (required) | `{ title, text }[]` | – | Delivery, returns, and warranty lines. |
| `sections` (required) | `{ id, title, body }[]` | – | Accordion sections. The first opens by default. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | On the gallery, show the previous or next photo. In the finish and size groups, move the selection. |
| Tab | Move from the gallery to thumbnails, variants, the stepper, add to bag, and the accordion. |
| Enter / Space | Choose a thumbnail, toggle an accordion section, or add to bag. |

## Accessibility

- The gallery is a labelled carousel region with slide groups; hidden slides are aria-hidden and the counter is live.
- Finish and size are radiogroups with roving tab stops, like native radios. Sold out sizes stay selectable and say Sold out in text.
- Add to bag reports aria-busy while adding and announces the result; failures show Try again on the button itself.
- Accordion buttons sit in headings with aria-expanded and aria-controls.
- Review bars are hidden from assistive technology and each row carries a text label with its count.

## Motion

- The gallery follows the pointer 1:1, rubber-bands at the ends, projects the flick with momentum, and hands the release velocity to the spring.
- Changing finish crossfades each photo in place; the thumbnail ring slides between thumbnails.
- The price rolls when size changes. Add to bag morphs through Adding and Added to bag without changing width while the bag icon tilts and its count rolls.
- Review bars fill once when they scroll into view; accordion sections open on a critically damped height spring.
- Reduced motion jumps the gallery, removes travel and blur, and shows final bar widths.

## Responsive behavior

- Above 980px the gallery sticks beside the info column; from 680px to 980px both columns share the width equally.
- Below 680px everything stacks: a square gallery with a four up thumbnail row, then the info.
- Under 420px the reviews summary stacks above the bars. Gallery arrows appear on hover only; touch uses swipe.

## Performance

- The gallery drags one track with a motion value; only transform changes during a swipe.
- The first photo uses priority loading; the rest load lazily at the gallery's size.

## Notes for AI

- Use as the main product page. Put finish specific photos on each finish so the gallery always matches the chosen swatch.
- Return your cart request from onAddToCart so the button shows real pending and error states.
- Keep sections to three or four; long policies belong on their own page.

## Related

- [Product listing](https://uiarc.dev/components/blocks/product-listing/markdown): A storefront grid with price, color and size filters, a sort menu, hover photo swaps, and quick add with a size row.
- [Cart drawer](https://uiarc.dev/components/blocks/cart-drawer/markdown): Products fly into the cart, counts roll, and a drawer handles quantities, shipping progress, and checkout.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
