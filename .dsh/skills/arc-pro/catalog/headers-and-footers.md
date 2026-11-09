# Headers and footers

## `customer-galaxy` · Customer galaxy (Pro, block)

2,400 accounts as a drifting galaxy that spirals into clusters by plan, region or health.

When to use:
- Customer success or revenue pages to explore where MRR and risk concentrate.
- Showcase views that cluster thousands of accounts by plan, region, or health.

When not to use:
- Use customers-table when people need to find and act on specific accounts.
- Use semantic-zoom for hierarchical data like teams and projects.

Keywords: react data galaxy, customer visualization, canvas particle clusters, zoomable scatter, account explorer, mrr visualization

Files: src/components/arc/customer-galaxy/customer-galaxy.module.css, src/components/arc/customer-galaxy/customer-galaxy.tsx, src/components/arc/customer-galaxy/demo.tsx

## `layout-morph` · Layout morph (Pro, block)

A 24 card gallery that flies between grid, masonry, list, fan, carousel and a 3D helix.

When to use:
- Catalogue, portfolio, or team pages where people browse the same set in different layouts.
- Showcase galleries that fly between grid, masonry, list, fan, carousel, and a 3D helix.

When not to use:
- Use photo-grid for a simple gallery.
- Use carousel or cover-flow for one horizontal browsing style.

Keywords: react layout animation, gallery layout switcher, masonry to grid animation, 3d helix gallery, view mode toggle, morphing gallery

Files: src/components/arc/layout-morph/demo.tsx, src/components/arc/layout-morph/layout-morph.module.css, src/components/arc/layout-morph/layout-morph.tsx, src/components/arc/layout-morph/morph-data.ts

## `revenue-globe` · Revenue globe (Pro, block)

A dotted globe where live payments arc home to headquarters, with a replayable day.

When to use:
- Revenue or operations overviews showing where payments come from right now.
- Showcase pages where a live globe with arcs and a day timeline adds impact.

When not to use:
- Use a table or bar-chart when exact regional numbers matter more than the view.
- Use customer-galaxy to explore accounts rather than transactions.

Keywords: react globe, revenue globe, payments map animation, 3d globe canvas, live transactions map, dotted globe

Files: src/components/arc/revenue-globe/demo.tsx, src/components/arc/revenue-globe/revenue-globe.module.css, src/components/arc/revenue-globe/revenue-globe.tsx

## `semantic-zoom` · Semantic zoom (Pro, block)

An infinite-zoom map of a company that reveals teams, projects, tasks and people as you fly in.

When to use:
- Workspace or portfolio overviews where people zoom from the whole company to one task.
- Hierarchical data where each zoom level should show different detail.

When not to use:
- Use tree-view for a plain hierarchy people scan and expand.
- Use project-board for working on tasks.

Keywords: react semantic zoom, infinite zoom canvas, zoomable org chart, zoom ui, portfolio map, canvas zoom and pan

Files: src/components/arc/semantic-zoom/demo.tsx, src/components/arc/semantic-zoom/semantic-zoom.module.css, src/components/arc/semantic-zoom/semantic-zoom.tsx, src/components/arc/semantic-zoom/zoom-data.ts
