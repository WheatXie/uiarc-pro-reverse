# Pricing

## `checkout-live` · Live checkout (Pro, block)

A subscription checkout whose summary recomputes as you edit, then glides to the centre and unfolds into a receipt.

When to use:
- Upgrade from a free plan to a paid team plan.
- Paid signup where seats and add-ons change the price.

When not to use:
- A physical goods cart with shipping; use checkout-flow.
- Only showing totals without payment; use checkout-summary.

Keywords: checkout, subscription, billing, payment form, order summary, coupon, receipt, seats, saas upgrade

Files: checkout-live.module.css, checkout-live.tsx, demo.tsx

## `credit-topup` · Credit top-up (Pro, block)

A card for buying AI credits. It shows the balance with a 14 day usage chart and how many days are left, three preset packs with bonus badges, a custom amount slider with a live price, auto top-up with a threshold and the saved Visa or Mastercard. When you buy, the new balance rolls in like an odometer.

When to use:
- Selling prepaid AI credits or tokens with volume bonuses.
- A billing settings section where people also manage auto top-up and their card.

When not to use:
- Subscription plan changes with seats and billing cycles: use a plan picker or checkout-live.
- Collecting a new card number: use a card form or a hosted payment element, then pass the saved card here.

Keywords: credits, top up, buy credits, ai credits, prepaid, token balance, auto recharge, auto top-up, usage based billing, wallet, balance, odometer, rolling numbers, billing

Files: credit-topup.module.css, credit-topup.tsx, demo.tsx

## `delivery-tracker` · Delivery tracker (Pro, block)

A live order tracker whose marker glides between stops while the arrival time rolls.

When to use:
- Order status pages that follow a delivery from dispatch to door.
- Tracking screens with a live arrival time and an event history.

When not to use:
- Use timeline for a static list of past events.
- Use progress when a single percentage is enough.

Keywords: react delivery tracker, order tracking page, shipment status, courier tracking ui, package tracker, eta tracker

Files: delivery-tracker.module.css, delivery-tracker.tsx, demo.tsx

## `invoice-studio` · Invoice studio (Pro, block)

An editable invoice with live totals and a clear save flow.

When to use:
- Creating or editing an invoice or quote with line items.
- Forms that need a live subtotal and total as quantities and rates change.

When not to use:
- Use billing-overview to show past invoices and plan status.
- Use checkout-flow when the customer is paying.

Keywords: react invoice editor, invoice generator ui, line items form, quote builder, invoice form with totals, billing invoice component

Files: demo.tsx, invoice-studio.module.css, invoice-studio.tsx

## `product-detail` · Product detail (Pro, block)

A product page with a swipeable gallery, finish and size variants, add to bag that confirms in place, shipping, a reviews summary, and details.

When to use:
- Product pages with a few variants, a gallery, and reviews.
- Stores that want stock aware variants with a restock alert instead of a dead button.

When not to use:
- Products built from many options with live pricing; use product-configurator.
- Browsing many products; use product-listing.

Keywords: product detail, product page, pdp, ecommerce, gallery, variants, add to cart, reviews summary, shop

Files: demo.tsx, product-detail.module.css, product-detail.tsx

## `product-listing` · Product listing (Pro, block)

A storefront grid with price, color and size filters, a sort menu, hover photo swaps, and quick add with a size row.

When to use:
- A shop's collection or category page with a few dozen to a few hundred products.
- Catalogs where color and size are the main filters and a quick add saves a trip to the product page.

When not to use:
- One product with many options; use product-detail or product-configurator.
- Huge catalogs with faceted server search; keep the card and filter styles but fetch results from your search service.

Keywords: product listing, product grid, collection page, category page, ecommerce filters, price range, quick add, shop

Files: demo.tsx, product-listing.module.css, product-listing.tsx

## `seat-manager` · Seat manager (Pro, block)

A team seats and billing card where avatars and a seat meter show members, invites and open seats against what you pay for, a stepper rolls the prorated charge for today and the new monthly total live, and changes go through a confirm step before anyone is charged. Pending invites can be resent or revoked with undo, and when every seat is taken the card says so and offers to add one.

When to use:
- Letting a team admin add or remove paid seats with the price impact visible before paying.
- Showing seat usage against purchased seats, including invites that reserve a seat.

When not to use:
- Managing roles and permissions for many members: use a member table and link to this card for seats.
- Usage based or credit billing: use credit-topup or a usage meter instead.

Keywords: seat management, team seats, per seat billing, seat stepper, proration, prorated charge, pending invites, resend invite, revoke invite, seat limit, team billing, subscription quantity, stripe seats

Files: demo.tsx, seat-manager.module.css, seat-manager.tsx

## `wallet-card` · Wallet card (Pro, block)

A compact account view with balance, recent activity, and focused money actions.

When to use:
- A personal or business balance summary with quick send, deposit, swap, and buy actions.
- Dashboards that pair a balance with a small history chart and recent activity.

When not to use:
- Use billing-overview for subscription billing and invoices.
- Use wallet-stack for a stack of payment cards.

Keywords: react wallet card, crypto wallet ui, balance card, fintech dashboard card, send money ui, account balance chart, banking app component

Files: demo.module.css, demo.tsx, wallet-card.module.css, wallet-card.tsx
