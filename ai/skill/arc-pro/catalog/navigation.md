# Navigation

## `breadcrumb` · Breadcrumb (Free, component)

Show where a page sits in a hierarchy.

When to use:
- Showing where a page sits in a hierarchy, such as Workspace, Settings, Billing.
- Client-side paths like a file browser, where crumbs call onClick instead of navigating.

When not to use:
- Use tree-view when people need to browse the whole hierarchy.
- Use tabs for switching between sibling views.

Keywords: navigation, wayfinding, react breadcrumb, breadcrumb navigation, animated breadcrumb, page path, nextjs breadcrumb, hierarchy navigation

Files: src/components/arc/breadcrumb/breadcrumb.module.css, src/components/arc/breadcrumb/breadcrumb.tsx

## `mega-menu-morph` · Mega menu morph (Pro, component)

A site header whose menus share one floating panel. Moving between sections morphs its size, slides the next menu in from that side and glides the caret under the new trigger, with hover intent, a safe triangle and an accordion sheet on narrow screens.

When to use:
- A marketing site header with product, solution, developer and company sections that each need a rich menu.
- A documentation or platform site whose top sections deserve descriptions, a featured story or a status line.

When not to use:
- Use morph-nav for a compact floating pill navigation with search built in.
- Use dropdown-menu for a single list of actions or links behind one button.

Keywords: navigation, menu, motion, new, mega menu, site header, navigation bar, navbar, dropdown, morphing dropdown, shared layout, stripe menu, hover intent, safe triangle, menu aim, caret, accordion menu, mobile menu, marketing header

Files: src/components/arc/mega-menu-morph/demo.tsx, src/components/arc/mega-menu-morph/mega-menu-morph.module.css, src/components/arc/mega-menu-morph/mega-menu-morph.tsx

## `pagination` · Pagination (Free, component)

Move through a long collection with clear bounds.

When to use:
- Paged server results and long tables.
- Lists where the page should live in the URL or state and fetch on change.

When not to use:
- Use carousel for browsing slides.
- Use timeline with maxHeight for a scrolling feed instead of pages.

Keywords: data, navigation, react pagination, pagination component, page numbers, table pagination, animated pagination, next previous pages

Files: src/components/arc/pagination/pagination.module.css, src/components/arc/pagination/pagination.tsx

## `tabs` · Tabs (Free, component)

Switch between related content in the same context.

When to use:
- Peer views of the same object, such as Overview, Activity, and Settings.
- Panels with different heights, where the container should spring between them.

When not to use:
- Use segmented-control for a compact value toggle not tied to panels.
- Use accordion for stacked sections people read in order.

Keywords: navigation, layout, react tabs, animated tabs, radix tabs, tab component, sliding tab indicator, scrollable tabs, tabs with animation

Files: src/components/arc/tabs/tabs.module.css, src/components/arc/tabs/tabs.tsx

## `toc-progress` · Table of contents progress (Pro, component)

A table of contents that reads along with you: a line bends through the nested headings, fills as you scroll, and carries a marker to the current section, with smooth jumps and a time-left countdown.

When to use:
- A documentation page, guide or blog post long enough that readers jump between sections.
- An engineering write up or policy where knowing how much is left helps readers commit to it.

When not to use:
- Use tabs when sections are alternatives rather than parts of one document.
- Use scroll-progress-ring for a compact overall progress indicator without navigation.

Keywords: navigation, scroll, motion, new, table of contents, toc, on this page, scroll spy, reading progress, scrollspy, article navigation, docs navigation, anchor links, section indicator, progress line, time left, reading time

Files: src/components/arc/toc-progress/demo.module.css, src/components/arc/toc-progress/demo.tsx, src/components/arc/toc-progress/toc-progress.module.css, src/components/arc/toc-progress/toc-progress.tsx
