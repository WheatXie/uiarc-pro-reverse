# Tables

## `code-block` · Code block (Free, component)

Present code with legible hierarchy and copy access.

When to use:
- Documentation snippets and install commands with a copy button.
- Long files that should collapse to a few lines with Show all, via maxLines.

When not to use:
- Use copy-button alone for a one-line value such as an API key.
- Use text-stream for code arriving from an AI response in progress.

Keywords: content, developer, react code block, syntax highlighting, code snippet component, copy code block, collapsible code, code viewer

Files: src/components/arc/code-block/code-block.module.css, src/components/arc/code-block/code-block.tsx

## `filter-toolbar` · Filter toolbar (Free, component)

Keep collection filters close and easy to reset.

When to use:
- Faceted filtering above tables and lists, with removable chips.
- Adding filters through a two step field then value menu.

When not to use:
- Use chip-group for a fixed set of toggles.
- Use search-field for free text search.

Keywords: data, filter, react filter toolbar, filter chips, add filter menu, faceted filters, filter bar, removable chips, table filters

Files: src/components/arc/filter-toolbar/filter-toolbar.module.css, src/components/arc/filter-toolbar/filter-toolbar.tsx

## `json-viewer` · JSON viewer (Free, component)

A collapsible JSON tree with search, paging for long arrays, and copy value or path.

When to use:
- Inspecting a JSON payload in a developer dashboard, such as webhooks or API logs.
- Large nested objects where search and copy path save time.

When not to use:
- Use code-block to show JSON as formatted source for copying whole.
- Use tree-view for folders, navigation, or other non-JSON hierarchies.

Keywords: data, new, react json viewer, json tree, json inspector, collapsible json, json explorer, copy json path, search json, api response viewer

Files: src/components/arc/json-viewer/json-viewer.module.css, src/components/arc/json-viewer/json-viewer.tsx

## `reorderable-list` · Reorderable list (Free, component)

Organize items with direct drag and drop.

When to use:
- Short user-ordered lists such as priorities or a playlist.
- Lists that must be reorderable by keyboard as well as by drag.

When not to use:
- Use sortable-data-table when order comes from a column.
- Use swipe-actions when rows need quick actions rather than reordering.

Keywords: data, interaction, react reorderable list, drag and drop list, sortable list, drag to reorder, keyboard reorder, framer motion reorder

Files: src/components/arc/reorderable-list/reorderable-list.module.css, src/components/arc/reorderable-list/reorderable-list.tsx

## `sortable-data-table` · Sortable data table (Free, component)

Compare structured records with sortable columns.

When to use:
- Tabular records people sort and select, such as projects, invoices, or users.
- Tables that need Shift-click range selection and a count line with Clear.

When not to use:
- Use data-grid when people edit cells like a spreadsheet.
- Use timeline for chronological activity.

Keywords: data, table, react data table, sortable table, table with row selection, animated table sort, responsive table, checkbox table

Files: src/components/arc/sortable-data-table/sortable-data-table.module.css, src/components/arc/sortable-data-table/sortable-data-table.tsx

## `tree-table` · Tree table (Free, component)

A table with nested rows, tri-state selection, hierarchy-preserving sort, and lazy-loaded children.

When to use:
- File or folder listings with size, owner, and modified columns.
- Budgets, org charts, or accounts where totals roll up through nested rows.

When not to use:
- Use tree-view for navigation trees without columns.
- Use data-grid or sortable-data-table for flat records.

Keywords: data, new, react tree table, treegrid, nested table rows, expandable table, hierarchical data table, tri-state checkbox tree, lazy load tree rows, file tree table

Files: src/components/arc/tree-table/tree-table.module.css, src/components/arc/tree-table/tree-table.tsx

## `tree-view` · Tree view (Free, component)

Navigate nested folders and structured content.

When to use:
- Files, folders, and nested categories people expand and select.
- Side panels next to code-block or a detail view where selection drives content.

When not to use:
- Use accordion for a few collapsible sections of content.
- Use breadcrumb to show the path to the current page.

Keywords: data, navigation, react tree view, file tree, file explorer component, nested tree, folder tree, treeview keyboard navigation

Files: src/components/arc/tree-view/tree-view.module.css, src/components/arc/tree-view/tree-view.tsx
