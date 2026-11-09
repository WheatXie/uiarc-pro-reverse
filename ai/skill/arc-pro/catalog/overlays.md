# Overlays

## `bottom-sheet` — Bottom sheet (Free, component)

A sheet that rests at a peek or full height and follows your finger.

When to use:
- Mobile-first secondary tasks such as details, filters, or share options.
- Content that benefits from a peek height before expanding to nearly full screen.

When not to use:
- Use dialog for interrupting decisions on any screen size.
- Use drawer for side panels on wide desktop layouts.

Keywords: overlay, gesture, motion, react bottom sheet, mobile bottom sheet, draggable sheet, ios sheet, snap points sheet, detents, swipe up panel

Files: registry/components/bottom-sheet/bottom-sheet.tsx, registry/components/bottom-sheet/bottom-sheet.module.css

## `confirm-popover` — Confirm popover (Pro, component)

A destructive button that grows into a small confirmation card, with the consequence, optional type-to-confirm, progress on the Confirm button, and a check or error before folding back.

When to use:
- A danger zone in settings: delete project, transfer ownership, revoke a member.
- A row action in a table where a modal would lose the row's context.

When not to use:
- Reversible removals such as archiving; use undo-toast so the action is instant and recoverable.
- A one word inline confirmation in a toolbar; use confirm-morph, which morphs horizontally inside the button's row.

Keywords: overlay, confirm, motion, new, confirmation, popover, delete, destructive, danger zone, are you sure, type to confirm, progress, inline confirm, morph, revoke, remove, alertdialog

Files: confirm-popover.module.css, confirm-popover.tsx, demo.module.css, demo.tsx

## `dialog` — Dialog (Free, component)

A focused surface for decisions that need attention.

When to use:
- Confirmations and decisions that must interrupt, such as Delete project.
- Short forms like rename or invite that fit in one focused panel.

When not to use:
- Use drawer for long forms or detail panels that keep the page in context.
- Use bottom-sheet for mobile-first secondary tasks with snap heights.

Keywords: modal, overlay, react dialog, animated modal, radix dialog, confirm dialog, modal window, popup dialog

Files: registry/components/dialog/dialog.tsx, registry/components/dialog/dialog.module.css

## `drawer` — Drawer (Free, component)

A temporary side surface for focused work.

When to use:
- Side panels for filters, settings, or record details that keep the page in context.
- Forms that are too long for a dialog but should not leave the current view.

When not to use:
- Use dialog for short decisions and confirmations.
- Use bottom-sheet for mobile-first sheets with snap points.

Keywords: overlay, surface, react drawer, side panel, slide over panel, sheet component, draggable drawer, radix dialog drawer, filters drawer

Files: registry/components/drawer/drawer.tsx, registry/components/drawer/drawer.module.css

## `hover-card` — Hover card (Free, component)

Preview a person or link on hover or focus without leaving the page.

When to use:
- Previews of people behind mentions, avatars, or author names.
- Link or reference previews where the click must stay free for navigation.

When not to use:
- Use tooltip for a plain text label.
- Use popover when the content has buttons or inputs.

Keywords: preview, people, popover, react hover card, profile preview, user hover card, mention preview, link preview popup, radix hover card

Files: registry/components/hover-card/hover-card.tsx, registry/components/hover-card/hover-card.module.css

## `popover` — Popover (Free, component)

A small anchored surface for contextual information.

When to use:
- Click-opened panels with interactive content, like share settings or a small filter form.
- Non-modal helpers that should stay open while people interact with the rest of the page.

When not to use:
- Use tooltip for short hover labels.
- Use hover-card for read-only previews that open on hover.

Keywords: overlay, menu, react popover, radix popover, floating panel, click popover, animated popover, anchored popup

Files: registry/components/popover/popover.tsx, registry/components/popover/popover.module.css

## `share-access` — Share access (Pro, component)

A share panel: invite people as validated email chips with suggestions, change roles from a compact menu, remove with undo, switch link access and copy the link, with every change landing in place.

When to use:
- A Share button on a document, board or project that controls who can open it and what they can do.
- Inviting teammates by email with suggestions from a workspace directory.

When not to use:
- Use the invite-people block for inviting people to a whole workspace with seats and plans.
- Use copy-button alone when there is only a public link to share.

Keywords: overlay, sharing, permissions, new, share, access, invite, email chips, roles, can edit, can view, link sharing, copy link, collaborators, google docs share, popover

Files: demo.module.css, demo.tsx, share-access.module.css, share-access.tsx

## `tooltip` — Tooltip (Free, component)

Short supporting text for unfamiliar controls.

When to use:
- One-line labels on icon-only buttons in toolbars.
- Revealing the full text of truncated labels on hover or focus.

When not to use:
- Use popover for anything with links or controls inside.
- Use hover-card for rich previews such as a person or link.

Keywords: hint, overlay, react tooltip, radix tooltip, icon button tooltip, hover label, animated tooltip, tooltip component

Files: registry/components/tooltip/tooltip.tsx, registry/components/tooltip/tooltip.module.css
