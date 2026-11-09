# Docks and tabs

## `action-morph` · Action morph (Pro, special)

A floating button that morphs into a quick-action menu, then an inline form, then back with a check.

When to use:
- Quick capture of tasks, notes, or comments without leaving the page.
- Apps with a few frequent create actions that deserve a persistent button.

When not to use:
- Use dialog or drawer for longer forms with several fields.
- Use dropdown-menu when actions run immediately and need no input.

Keywords: special, new, react floating action button, fab menu, quick actions, morphing fab, inline composer, speed dial, quick create button

Files: action-morph.module.css, action-morph.tsx, demo.tsx

## `dock` · Dock (Pro, special)

A floating tool dock with a gliding label, a springy selection, and trays that grow out of it.

When to use:
- A floating tool or mode switcher, such as the tools of a canvas or whiteboard editor.
- Toolbars where related tools share one slot and open a tray, like shape variants.

When not to use:
- Use segmented-control for two to four inline options.
- Use action-button for one-off actions that do not stay selected.

Keywords: special, dock, toolbar, react dock, floating toolbar, tool switcher, canvas toolbar, macos dock, toolbar with tray, reorderable toolbar

Files: demo.tsx, dock.module.css, dock.tsx

## `liquid-tab-bar` · Liquid tab bar (Pro, special)

Tabs with a lens selection that slides between them, swaps labels cleanly, and fills in icons as it passes.

When to use:
- Switching between a handful of peer sections with icons, such as an app's main areas.
- Bottom or top bars on mobile-style layouts where the selection should feel physical.

When not to use:
- Use tabs for text-only panels inside a page.
- Use segmented-control for compact filters or view toggles.

Keywords: special, tabs, navigation, react tab bar, liquid glass tabs, animated tab bar, ios tab bar, bottom navigation, tab bar with badges, gooey tabs

Files: demo.tsx, liquid-tab-bar.module.css, liquid-tab-bar.tsx

## `morph-nav` · Morph nav (Pro, special)

A navigation bar that morphs into rich menus, search, and a compact state as one surface.

When to use:
- The top navigation of a marketing or product site with a few sections that each hold several destinations.
- Headers where search should grow out of the bar instead of opening a separate modal.

When not to use:
- Use liquid-tab-bar for an app-style switcher between a handful of peer sections.
- Use tabs for switching views inside a page.

Keywords: special, navigation, morph, tabs, react navigation bar, react morph nav, mega menu, animated navbar, site header with dropdown, navbar with search, stripe style navigation

Files: demo.tsx, morph-nav.module.css, morph-nav.tsx

## `orbit-menu` · Orbit menu (Pro, special)

Hold a button and its actions orbit out, ready to pick with a drag.

When to use:
- Three to six quick actions on one object, such as a note or photo.
- Touch-first surfaces where press, drag, and release should fire an action in one gesture.

When not to use:
- Use dropdown-menu or context-menu for longer or text-heavy lists.
- Use dock for tools that stay selected.

Keywords: special, motion, react radial menu, orbit menu, fan menu, arc menu, floating action menu, press and drag menu, circular menu

Files: demo.tsx, orbit-menu.module.css, orbit-menu.tsx

## `share-sheet` · Share sheet (Pro, special)

A Share button that opens into a panel with copy link, access level, channels, and people to send to.

When to use:
- A Share button on a document, design, or board header where people share often.
- Sharing flows that combine copy link, access level, and sending to a few recent people.

When not to use:
- Use copy-button when all you need is to copy a URL.
- Use dialog when sharing needs a full form, such as roles per person or an email search.

Keywords: special, new, react share sheet, share button, share dialog, copy link, share with people, link access level, morphing share panel, share to slack

Files: demo.module.css, demo.tsx, share-sheet.module.css, share-sheet.tsx
