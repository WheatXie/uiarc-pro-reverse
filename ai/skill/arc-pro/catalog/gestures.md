# Gestures

## `hold-to-confirm` · Hold to confirm (Free, component)

Confirm a destructive action by holding, not tapping.

When to use:
- Destructive actions like delete or revoke where the consequence is already visible on screen.
- Replacing a confirm dialog with a deliberate press in compact settings rows.

When not to use:
- Use dialog when people need to read what will happen before confirming.
- Use button or action-button for safe, easily undone actions.

Keywords: hold, long press, confirm, react hold to confirm, press and hold button, long press delete, hold to delete, destructive action button, confirm without dialog

Files: src/components/arc/hold-to-confirm/hold-to-confirm.module.css, src/components/arc/hold-to-confirm/hold-to-confirm.tsx

## `reactions` · Reactions (Free, component)

Acknowledge a post in one tap, with counts that roll.

When to use:
- Lightweight acknowledgement on comments, posts, or release notes.
- Slack-style reaction pills with counts and a picker for new reactions.

When not to use:
- Use a reply field such as ai-composer when people need to say something specific.
- Use action-swap for a single like or follow toggle without counts.

Keywords: reactions, social, comments, react reactions, emoji reactions, reaction picker, like button with count, slack reactions, comment reactions

Files: src/components/arc/reactions/reactions.module.css, src/components/arc/reactions/reactions.tsx

## `swipe-actions` · Swipe actions (Free, component)

Reveal row actions with a swipe, or from the same actions in a menu.

When to use:
- Touch-first triage lists such as mail, notifications, or tasks.
- Rows with one or two quick actions per side, like Archive and Mark unread.

When not to use:
- Use context-menu or dropdown-menu for desktop-first tables.
- Use reorderable-list when rows need to be dragged vertically.

Keywords: swipe, gesture, list, react swipe actions, swipe to delete, swipe to archive, ios swipe row, swipeable list item, mobile list actions, swipe gesture list

Files: src/components/arc/swipe-actions/swipe-actions.module.css, src/components/arc/swipe-actions/swipe-actions.tsx
