# App shell

## `command-palette` · Command palette (Free, block)

A complete keyboard driven action surface with search, grouped results, and shortcuts.

When to use:
- App-wide command search opened with Cmd or Ctrl plus K.
- Jumping to pages, creating items, and running actions from one input.

When not to use:
- Use combobox to pick a value inside a form.
- Use dropdown-menu for a short list of actions.

Keywords: react command palette, cmd k menu, command menu, spotlight search, cmdk alternative, keyboard command palette, quick actions

Files: src/components/arc/command-palette/command-palette.module.css, src/components/arc/command-palette/command-palette.tsx

## `empty-states` · Empty states (Free, block)

Four empty states in one illustration whose shapes morph between scenes as you switch tabs.

When to use:
- A reference for no results, offline, inbox zero, and 404 moments with one shared illustration style.
- Extracting one scene as a richer empty state for a key screen.

When not to use:
- Use empty-state for a simple empty state with an icon, text, and action.
- Use onboarding-illustration for first-run screens that teach the product.

Keywords: react empty state, empty state illustration, no results state, offline state, 404 page illustration, inbox zero, morphing svg illustration

Files: src/components/arc/blocks/empty-states/empty-states-art.ts, src/components/arc/blocks/empty-states/empty-states.module.css, src/components/arc/blocks/empty-states/empty-states.tsx

## `notification-center` · Notification center (Free, block)

A home for updates with read state, grouped information, and animated disclosure.

When to use:
- A bell in the app header with an unread badge and an inbox of recent updates.
- Notifications people can mark read, expand, and dismiss in bulk.

When not to use:
- Use toast-stack for transient messages that should disappear.
- Use inbox-triage for a full-page inbox.

Keywords: react notification center, notification bell, notification dropdown, inbox popover, unread notifications, activity feed popover

Files: src/components/arc/notification-center/notification-center.module.css, src/components/arc/notification-center/notification-center.tsx

## `page-header` · Page header (Free, block)

A project page header that folds into a compact bar as you scroll, with tabs whose counts roll.

When to use:
- The top of a project, repository, or record page with breadcrumbs, status, people, and tabs.
- Detail pages with long content where the header should fold into a compact bar as people scroll.

When not to use:
- Use tabs and breadcrumb on their own when the page only needs navigation, not status and people.
- Use workspace-sidebar for app-level navigation between sections.

Keywords: react page header, project header, sticky header on scroll, condensing header, record header with tabs, breadcrumb header, page title with actions

Files: src/components/arc/blocks/page-header/page-header.module.css, src/components/arc/blocks/page-header/page-header.tsx

## `search-results` · Search results (Pro, block)

A faceted workspace search page with suggestions, facet counts that follow the query, filter chips, mixed doc, person and file results with highlighted matches, a gliding keyboard cursor and a preview pane.

When to use:
- A full search page for a workspace or knowledge base that returns several kinds of things at once.
- Search where people narrow by type, team, and date, and want to read a match before opening it.

When not to use:
- Use command-palette for quick jump to navigation from any screen.
- Use product-listing for a storefront grid filtered by price, color, and size.

Keywords: search, search results, faceted search, filters, facets, highlight, keyboard navigation, skeleton, no results, workspace search, app shell

Files: src/components/arc/search-results/demo.tsx, src/components/arc/search-results/search-results.module.css, src/components/arc/search-results/search-results.tsx

## `selection-toolbar` · Selection toolbar (Pro, block)

A contextual batch action surface that appears when items are selected.

When to use:
- Bulk actions for checkbox-selectable tables or grids.
- Floating bars that appear only while items are selected.

When not to use:
- Use dropdown-menu for per-row actions.

Keywords: react selection toolbar, bulk actions bar, floating action bar, selected items toolbar, table bulk actions, multi select actions

Files: src/components/arc/selection-toolbar/demo.module.css, src/components/arc/selection-toolbar/demo.tsx, src/components/arc/selection-toolbar/selection-toolbar.module.css, src/components/arc/selection-toolbar/selection-toolbar.tsx

## `sidebar` · SidebarPro4 (Pro, block)

App and docs sidebars: a folding rail, a workspace switcher, a mail shell, and a docs tree.

Keywords: react app shell, sidebar layout, collapsible sidebar, icon rail navigation, mobile nav sheet, dashboard layout, nested sidebar

Files: src/components/arc/sidebar/demo.tsx, src/components/arc/sidebar/sidebar.module.css, src/components/arc/sidebar/sidebar.tsx
