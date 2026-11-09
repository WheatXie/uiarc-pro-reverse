# Glass

## `glass-card` — Glass card (Pro, special)

A glass info panel over a photo whose rim catches a pointer-following highlight while the card tilts; tap to morph it into a detail sheet.

When to use:
- Profile, host, or creator cards on a landing page or in a discovery grid.
- A featured product or stay where the photo sells and the details can wait for a tap.

When not to use:
- Dense grids of many cards; tilt and glass on every tile gets busy. Use card.
- Cards that should open a full page; use card-to-article.

Keywords: special, glass, card, new, glass card, glassmorphism card, profile card, tilt card, specular highlight, frosted glass, expandable card, shared layout

Files: demo.tsx, glass-card.module.css, glass-card.tsx

## `glass-menu` — Glass menu (Pro, special)

A glass action menu whose trigger morphs into the panel, with a highlight pill that glides between rows, one in-place submenu, and full keyboard support.

When to use:
- Actions for a photo, file, or card shown over an image or a colorful canvas.
- A title menu in an editor or viewer, where the title itself opens the actions.

When not to use:
- Plain settings pages with no imagery behind the menu. Use dropdown-menu on a neutral surface.
- Navigation between pages. Use morph-nav or tabs.

Keywords: special, glass, menu, new, glass menu, dropdown, context menu, action menu, liquid glass, frosted, shared layout, morph, submenu

Files: demo.tsx, glass-menu-data.ts, glass-menu.module.css, glass-menu.tsx

## `glass-segmented` — Glass segmented (Pro, special)

A glass segmented control whose liquid indicator stretches between segments and can be dragged and flung.

When to use:
- Switching the view of a photo, map, or media surface.
- A compact filter over imagery, such as day, week, month on a hero chart.

When not to use:
- Plain forms on neutral surfaces. Use segmented-control.
- More than five options or long labels. Use tabs or a select.

Keywords: special, glass, input, new, segmented control, liquid glass, toggle group, tabs, gooey indicator, stretch, frosted, drag

Files: demo.tsx, glass-segmented-data.ts, glass-segmented.module.css, glass-segmented.tsx

## `glass-tabbar` — Glass tab bar (Pro, special)

A floating Liquid Glass tab bar that refracts what scrolls beneath it, with a glass lens that glides, magnifies and can be dragged between tabs, and an optional search bubble; it compacts on scroll down.

When to use:
- Mobile web apps and PWAs with three to five top level sections and one global action such as search.
- Content feeds where the bar should step aside while reading and come back on scroll up.

When not to use:
- Desktop layouts with many sections; use a sidebar or morph-nav.
- Switching views inside a card; use segmented-control or tabs.

Keywords: special, glass, navigation, new, liquid glass, glass tab bar, floating tab bar, bottom navigation, mobile tab bar, ios tab bar, refraction, lens indicator, draggable tab indicator, collapsing tab bar, hide on scroll, glassmorphism navigation

Files: demo.tsx, glass-tabbar.module.css, glass-tabbar.tsx
