# Avatars

## `avatar` · Avatar (Free, component)

A compact identity marker for people and accounts.

When to use:
- Showing one person next to their name, comment, or record.
- Presence in a header or list, via the online or offline status dot.

When not to use:
- Use avatar-group for several people with an overflow count.
- Use user-menu when the avatar is the trigger for account actions.

Keywords: identity, people, react avatar, avatar component, user avatar with initials, profile picture, avatar with status, online indicator avatar

Files: src/components/arc/avatar/avatar.module.css, src/components/arc/avatar/avatar.tsx

## `avatar-group` · Avatar group (Free, component)

Show a team or set of contributors in a small space.

When to use:
- Showing who owns or edits something in a header, card, or table cell.
- Collaborator stacks where people join and leave while the page is open.

When not to use:
- Use avatar for a single person.
- Use a list or sortable-data-table when people need to see every name and role.

Keywords: identity, people, react avatar group, avatar stack, overlapping avatars, team members avatars, avatar overflow count, collaborators list

Files: src/components/arc/avatar-group/avatar-group.module.css, src/components/arc/avatar-group/avatar-group.tsx

## `badge` · Badge (Free, component)

A small label for status, category, or metadata.

When to use:
- Short statuses next to titles or in table cells, such as Live, Draft, or Failed.
- Counts or states that change in place and should morph instead of jump.

When not to use:
- Use alert or toast when the message needs a full sentence.
- Use chip-group when people toggle the values.

Keywords: label, status, react badge, status badge, status pill, animated badge, tag component, label pill, badge with icon

Files: src/components/arc/badge/badge.module.css, src/components/arc/badge/badge.tsx

## `presence-stack` · Presence stack (Pro, component)

Avatars of the people here now: joins pop in as the stack reflows, a counter rolls past the limit, dots show typing and idle, and hover fans it out with a gliding name label.

When to use:
- A document, board or design file header that shows who is here right now.
- A call or meeting roster where people come and go and some are talking or idle.

When not to use:
- Use avatar-group for a static list of owners, assignees or members that does not change while you look at it.
- Use live-cursors when you also need cursors and selections on a canvas; it includes its own small stack.

Keywords: data, avatar, realtime, new, presence, avatars, avatar stack, facepile, who is here, online, collaboration, multiplayer, typing indicator, idle, status, join, leave, overflow, roster

Files: src/components/arc/presence-stack/demo.tsx, src/components/arc/presence-stack/presence-stack.module.css, src/components/arc/presence-stack/presence-stack.tsx
