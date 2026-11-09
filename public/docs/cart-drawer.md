# Cart drawer

> Products fly into the cart, counts roll, and a drawer handles quantities, shipping progress, and checkout.

- Type: Block
- Page: https://uiarc.dev/components/blocks/cart-drawer
- Markdown: https://uiarc.dev/components/blocks/cart-drawer/markdown

- Access: Arc Pro
- Registry id: `cart-drawer`
- Source file: `registry/blocks/cart-drawer/cart-drawer.tsx`
- Built from: Motion
- Keywords: react cart drawer, shopping cart drawer, add to cart animation, slide out cart, ecommerce cart, free shipping progress bar, swipe to remove cart item, promo code field

Use this as a starting point and replace the sample data with your own.

## When to use

- Product listings where people add several items and review them in a side cart.
- Stores that show a free shipping threshold and promo codes before checkout.
- Demos of an add to cart interaction with clear feedback on where the item went.

## When not to use

- Use checkout-flow for a full multi-step checkout with address and payment.
- Use checkout-summary when you only need the order summary and totals.
- Use drawer for a generic side panel that is not a cart.

## Installation

Cart drawer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/cart-drawer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CartDrawer } from "@/components/arc/blocks/cart-drawer/cart-drawer";

export function ShopPage() {
  return <CartDrawer />;
}
```

## API reference

### CartDrawer

A product grid with a slide-in cart. Adding an item arcs its photo into the cart button, lines can be swiped away, a free shipping bar fills, promo codes validate, and the checkout button folds into a confirmation disc. Products, prices, and the order are sample data; checkout is simulated. Also the default export.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter / Space | Adds a product, opens the cart, and runs the quantity, remove, and checkout buttons. |
| Escape | Closes the drawer, except while an order is being placed. Focus returns to the cart button. |
| Enter (promo field) | Applies the promo code. |

## Accessibility

- The cart button has aria-haspopup="dialog", aria-expanded, and a label with the item count. The drawer is role="dialog" with aria-modal and moves focus to its close button.
- The shop behind an open drawer is inert, and the drawer body is inert while an order is placing.
- Quantity steppers are labelled groups; the minus button becomes "Remove" at quantity one. Swipe to remove has button equivalents.
- The shipping bar is a role="progressbar"; an invalid promo sets aria-invalid and swaps the note under the field.
- Adds, removals, promo changes, and the placed order are announced in a polite live region.

## Motion

- The product photo flies along a quadratic arc into the cart over 780ms, shrinking and tilting; the badge count only changes when it lands, then the cart bumps and rings.
- The drawer slides in on a critically damped spring. Rows collapse in height when removed and the totals roll with AnimatedCounter.
- Swipe a row left past 110px, or flick it, to remove; short drags snap back with the release velocity.
- The checkout button shares a layoutId with the confirmation disc, then a checkmark draws in.
- Reduced motion skips the flight and the bump, disables row dragging, fades the drawer instead of sliding it, and zeroes the remaining springs.

## Responsive behavior

- The root is a size container. Above 640px the grid has three columns; at 640px and below it has two, with tighter padding.
- At 380px and below the cart label hides, prices stack under names, and the drawer fills the block with a 4px inset.
- Rows accept horizontal drag with direction lock, so vertical scrolling in the drawer still works on touch.

## Performance

- Each flight is driven by one motion value and transforms, not React state per frame; several flights can overlap.
- The drawer and scrim only mount while open; timers are cleared on unmount.
- Product images use next/image with sizes for 50vw on small screens and 260px otherwise.

## Notes for AI

- Use for an ecommerce page where adding to cart and reviewing the cart happen without leaving the grid.
- Replace PRODUCTS (with PhotoId images from @/components/arc/lib/media) and the FREE_SHIPPING, SHIPPING, and PROMO constants; swap the image source for your own URLs if needed.
- There are no props. Connect the add, setQty, remove, applyPromo, and checkout functions to your cart store and payment flow; checkout currently waits 1.3s and shows a sample receipt.
- Composes Arc Button and AnimatedCounter.

## Related

- [Checkout summary](https://uiarc.dev/components/blocks/checkout-summary/markdown): An order summary with a promo code that becomes a chip, discount and tax lines, and pay button states.
- [Drawer](https://uiarc.dev/components/drawer/markdown): A temporary side surface for focused work.
- [Swipe actions](https://uiarc.dev/components/swipe-actions/markdown): Reveal row actions with a swipe, or from the same actions in a menu.
- [Number field](https://uiarc.dev/components/number-field/markdown): Enter a bounded number with clear increment controls.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
