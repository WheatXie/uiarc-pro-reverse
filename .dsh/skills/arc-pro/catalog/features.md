# Features

## `changelog-feed` · Changelog feed (Free, block)

Release notes you can filter, open in place, and scroll through month by month.

When to use:
- A product changelog or release notes page grouped by month.
- Release notes with type filters such as features, fixes, and improvements.

When not to use:
- Use timeline for a short vertical list of events without filters.
- Use accordion for plain expandable content that is not dated.

Keywords: react changelog, release notes page, changelog component, product updates feed, what's new page, changelog with filters

Files: src/components/arc/blocks/changelog-feed/changelog-feed.module.css, src/components/arc/blocks/changelog-feed/changelog-feed.tsx

## `faq-section` · FAQ section (Free, block)

FAQs as an accordion, a topic rail, or a searchable list that highlights matches.

When to use:
- FAQ sections on pricing, product, and support pages.
- Long FAQs that benefit from categories or live search.

When not to use:
- Use accordion for generic collapsible content that is not a question list.
- Use a docs page when answers need code, images, or long structure.

Keywords: react faq section, faq accordion, searchable faq, faq with categories, frequently asked questions component

Files: src/components/arc/blocks/faq-section/faq-section.module.css, src/components/arc/blocks/faq-section/faq-section.tsx

## `stats-band` · Stats band (Free, block)

Headline numbers that count up in view, each with a tiny visual that proves it and a context line on hover, plain or in a hairline grid.

When to use:
- Marketing pages that back a claim with a few numbers.
- About and investor pages with headline metrics.

When not to use:
- Live product metrics with trends. Use Metric card or Metrics dashboard.
- More than four numbers. Split them or use a table.

Keywords: stats, statistics, numbers, count up, counter, metrics band, social proof, kpi

Files: src/components/arc/blocks/stats-band/stats-band-data.ts, src/components/arc/blocks/stats-band/stats-band-world.ts, src/components/arc/blocks/stats-band/stats-band.module.css, src/components/arc/blocks/stats-band/stats-band.tsx

## `testimonial-stage` · Studio perspectives (Pro, block)

Portrait led editorial stories with a focused reading state.

When to use:
- Testimonials or editorial stories where the person's portrait matters.
- Landing sections that rotate through a few quotes on demand.

When not to use:
- Use logo-marquee when logos are enough social proof.
- Use carousel for many short testimonials.

Keywords: react testimonial section, testimonial slider, customer quotes, testimonials with photos, review showcase, quote carousel

Files: src/components/arc/testimonial-stage/demo.tsx, src/components/arc/testimonial-stage/testimonial-stage.module.css, src/components/arc/testimonial-stage/testimonial-stage.tsx
