# Expand

## `accordion` · Accordion (Free, component)

Progressively reveal supporting information in place.

When to use:
- FAQ sections where only one answer should be open at a time.
- Settings or help pages that group long content under short, scannable questions.

When not to use:
- Use expandable-card for a single standalone disclosure such as a plan or order summary.
- Use tabs when sections are peer views that people switch between.

Keywords: disclosure, layout, react accordion, faq accordion, collapsible sections, animated accordion, radix accordion, expand collapse list, faq component

Files: registry/components/accordion/accordion.tsx, registry/components/accordion/accordion.module.css

## `expandable-card` · Expandable card (Free, component)

Give a dense card more room when requested.

When to use:
- A single summary card with optional details, like a plan, order, or log entry.
- Cards whose summary line updates and should roll changed words in place.

When not to use:
- Use accordion for a list of mutually exclusive sections.
- Use card when there is nothing to reveal.

Keywords: disclosure, layout, react expandable card, collapsible card, expand card animation, disclosure card, show more card, card with details

Files: registry/components/expandable-card/expandable-card.tsx, registry/components/expandable-card/expandable-card.module.css

## `expandable-text` · Expandable text (Free, component)

Long text clamped to a few lines with a soft fade that glides open with Read more and closes with Show less, shown only when the text overflows.

When to use:
- A list of user reviews or comments where some entries are long.
- A product, listing, or profile description that should not push the rest of the page down.

When not to use:
- Use accordion for a set of titled sections or an FAQ.
- Use expandable-card when the hidden part is structured content rather than running text.

Keywords: disclosure, text, motion, new, read more, show more, show less, truncate, line clamp, clamp, collapse text, expand text, see more, review, description, fade out text

Files: registry/components/expandable-text/expandable-text.tsx, registry/components/expandable-text/expandable-text.module.css

## `resizable-panels` · Resizable panels (Free, component)

Trade space between panes by dragging the divider between them.

When to use:
- Editor, mail, or dashboard layouts where people trade space between side-by-side panes.
- Sidebars that should collapse by dragging or flicking toward the edge.

When not to use:
- Use drawer for a panel that slides over the page.
- Use tabs when only one pane needs to be visible at a time.

Keywords: split view, resizable, panes, react resizable panels, resizable sidebar, draggable divider, split pane, collapsible panel, resizable layout

Files: registry/components/resizable-panels/resizable-panels.tsx, registry/components/resizable-panels/resizable-panels.module.css

## `scroll-area` · Scroll area (Free, component)

A native scroll container with thin overlay scrollbars and edge fades that appear only when content overflows.

When to use:
- Panels, sidebars, and popovers whose content can outgrow their box.
- Horizontal strips of cards or chips that need mouse-wheel scrolling and snap points.

When not to use:
- Use carousel when items should page one at a time with controls.
- Do not wrap the whole page; let the document scroll natively.

Keywords: disclosure, new, react scroll area, custom scrollbar, overlay scrollbar, scroll fade edges, horizontal scroll container, scroll snap container, scrollable panel

Files: registry/components/scroll-area/scroll-area.tsx, registry/components/scroll-area/scroll-area.module.css
