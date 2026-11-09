# Content

## `activity-terrain` — Activity terrain (Pro, block)

A 3D terrain of hourly activity you can orbit, zoom, fly into and flatten into a heatmap.

When to use:
- Analytics or operations pages showing when a product is busiest across a week.
- Showcase dashboards where a 3D view of a 7 by 24 grid adds impact, with a flat heatmap fallback.

When not to use:
- Use activity-heatmap for a plain 2D grid that is easier to read.
- Use bar-chart for totals by day or hour.

Keywords: react 3d heatmap, activity terrain, 3d bar chart canvas, hourly activity chart, week by hour heatmap, canvas data visualization

Files: activity-terrain.module.css, activity-terrain.tsx, demo.tsx

## `cta-section` — CTA section (Free, block)

A call to action as a centered closing section, a split beside a setup card that completes itself, or a dismissible banner.

When to use:
- The last section of a landing page, asking for a trial or demo.
- An in-page prompt beside a product visual that shows the outcome.

When not to use:
- The first screen of a page. Use Hero section.
- Collecting an email. Use Newsletter signup.

Keywords: cta, call to action, cta section, banner, closing section, signup prompt, conversion, landing page

Files: registry/blocks/cta-section/cta-section.tsx, registry/blocks/cta-section/cta-section-data.ts, lib/media.ts, registry/blocks/cta-section/cta-section.module.css

## `newsletter-signup` — Newsletter signup (Free, block)

An email signup framed by a stack of past issues; subscribing drops the next issue, addressed to you, onto the front.

When to use:
- Collecting emails for a newsletter, digest, or changelog that has real issues to show.
- The end of a blog post or docs page.

When not to use:
- Account creation with a password. Use Signup form.
- Longer forms with several fields. Use Contact section.

Keywords: newsletter, email signup, subscribe, waitlist, email capture, mailing list, form, digest, issue

Files: registry/blocks/newsletter-signup/newsletter-signup.tsx, registry/blocks/newsletter-signup/newsletter-signup-data.ts, lib/media.ts, registry/blocks/newsletter-signup/newsletter-signup.module.css

## `site-footer` — Site footer (Free, block)

A website footer with link columns and newsletter, a minimal layout, and a large fading Arc mark.

When to use:
- The closing section of a marketing, docs, or product site.
- Footers that need a newsletter signup and a status link.

When not to use:
- Use a plain row with breadcrumb or links inside signed-in app screens.
- Use contact-section when the main goal is to start a conversation.

Keywords: react footer, site footer, footer with newsletter, footer link columns, minimal footer, marketing footer

Files: registry/blocks/site-footer/site-footer.tsx, registry/blocks/site-footer/site-footer.module.css

## `site-header` — Site header (Free, block)

A sticky website header that turns solid on scroll, with a gliding active link, mega menu panels, and a mobile sheet.

When to use:
- The top bar of a marketing site, landing page, or docs site.
- Product sites with grouped destinations that deserve a mega menu with a feature card.

When not to use:
- Use workspace-sidebar or sidebar-rail inside a signed-in app.
- Use morph-nav for a single-surface animated navigation with built-in search.

Keywords: react site header, marketing navbar, mega menu, responsive navbar, sticky header, mobile menu sheet, landing page header

Files: registry/blocks/site-header/site-header.tsx, registry/blocks/site-header/site-header.module.css, lib/media.ts
