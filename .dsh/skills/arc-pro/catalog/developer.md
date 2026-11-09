# Developer

## `cart-drawer` · Cart drawer (Pro, block)

Products fly into the cart, counts roll, and a drawer handles quantities, shipping progress, and checkout.

When to use:
- Product listings where people add several items and review them in a side cart.
- Stores that show a free shipping threshold and promo codes before checkout.

When not to use:
- Use checkout-flow for a full multi-step checkout with address and payment.
- Use checkout-summary when you only need the order summary and totals.

Keywords: react cart drawer, shopping cart drawer, add to cart animation, slide out cart, ecommerce cart, free shipping progress bar, swipe to remove cart item, promo code field

Files: src/components/arc/cart-drawer/cart-drawer.module.css, src/components/arc/cart-drawer/cart-drawer.tsx, src/components/arc/cart-drawer/demo.module.css, src/components/arc/cart-drawer/demo.tsx

## `checkout-summary` · Checkout summary (Pro, block)

An order summary with a promo code that becomes a chip, discount and tax lines, and pay button states.

When to use:
- The last step before a hosted checkout such as a Stripe session redirect.
- A single product purchase with launch discounts or promo codes.

When not to use:
- Use checkout-flow when you collect shipping and card details in the page.
- Use cart-drawer for a cart with several items and quantities.

Keywords: react checkout summary, order summary, promo code field, coupon input, pay button states, checkout total, stripe checkout summary

Files: src/components/arc/checkout-summary/checkout-summary.module.css, src/components/arc/checkout-summary/checkout-summary.tsx, src/components/arc/checkout-summary/demo.tsx

## `plan-comparison` · Plan comparison (Free, block)

Compare meaningful differences between plans and billing periods.

When to use:
- Comparing two tiers side by side with a feature matrix.
- Pricing pages that switch between monthly and yearly prices.

When not to use:
- Use usage-pricing when price depends on seats or volume.
- Use segmented-control alone for a simple billing toggle.

Keywords: react pricing comparison, plan comparison table, pricing table, monthly yearly toggle, feature matrix, saas pricing page

Files: src/components/arc/blocks/plan-comparison/plan-comparison.module.css, src/components/arc/blocks/plan-comparison/plan-comparison.tsx

## `pricing-calculator` · Pricing calculator (Pro, block)

A seat slider and billing toggle drive plan cards with rolling prices and a moving recommended badge.

When to use:
- Per-seat pricing where showing the exact total for a team size helps people choose.
- Pricing pages with a monthly and yearly toggle and a visible yearly saving.

When not to use:
- Use usage-pricing when price depends on metered usage rather than seats.
- Use plan-comparison for a feature by feature table across plans.

Keywords: react pricing calculator, seat pricing slider, per seat pricing, pricing page, monthly yearly toggle, saas pricing plans, team size pricing, volume discount pricing

Files: src/components/arc/pricing-calculator/demo.tsx, src/components/arc/pricing-calculator/pricing-calculator.module.css, src/components/arc/pricing-calculator/pricing-calculator.tsx

## `usage-pricing` · Usage pricing (Pro, block)

A pricing calculator that finds your plan as you drag seats and traffic.

When to use:
- Pricing pages for plans priced by seats plus usage.
- Calculators that should recommend a plan as people move sliders.

When not to use:
- Use plan-comparison for a side by side table of fixed tiers.
- Use usage-forecast to project spend for an existing customer.

Keywords: react pricing calculator, usage based pricing, seat pricing slider, pricing page component, plan recommender, monthly yearly toggle, saas pricing

Files: src/components/arc/usage-pricing/demo.tsx, src/components/arc/usage-pricing/usage-pricing.module.css, src/components/arc/usage-pricing/usage-pricing.tsx

## `webhook-tester` · Webhook tester (Pro, block)

A developer webhook tester where you pick an event, edit its JSON payload and send a signed test event. You watch it go from signed to sent to 200 OK in 184 ms, then read the response body, headers and exact request, and retry failed deliveries from a recent list.

When to use:
- A developer settings page where customers test a webhook endpoint before going live.
- Integration onboarding that asks people to prove their handler returns 2xx and verifies signatures.

When not to use:
- Managing many endpoints, filters and event subscriptions: use the webhooks block and link here for testing one.
- A general HTTP client for arbitrary methods and headers: this always sends a signed POST with a JSON body.

Keywords: webhook tester, test webhook, send test event, webhook endpoint, signing secret, hmac signature, stripe webhook, json editor, request timeline, delivery log, retry webhook, developer settings, api, event payload

Files: src/components/arc/webhook-tester/demo.tsx, src/components/arc/webhook-tester/webhook-tester.module.css, src/components/arc/webhook-tester/webhook-tester.tsx
