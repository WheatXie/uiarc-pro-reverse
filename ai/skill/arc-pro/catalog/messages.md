# Messages

## `alert` · Alert (Free, component)

A persistent message that helps people recover or continue.

When to use:
- Persistent, in-flow messages about a page or form, such as an expiring card.
- Status that changes over time, where one alert should morph between tones.

When not to use:
- Use toast or toast-stack for transient results of an action.
- Use empty-state when there is no content to show.

Keywords: status, message, react alert, alert banner, inline notification, warning message, animated alert, dismissible alert, callout

Files: src/components/arc/alert/alert.module.css, src/components/arc/alert/alert.tsx

## `announcement-bar` · Announcement bar (Free, component)

A top banner that rotates messages, counts down, and collapses smoothly when dismissed.

When to use:
- Site-wide promotions, launches, or maintenance notices at the top of every page.
- Rotating two to four short announcements in one slim bar.

When not to use:
- Use alert for a message tied to one section or form.
- Use toast for feedback on something the visitor just did.

Keywords: feedback, new, react announcement bar, top banner, promo banner, site notice bar, dismissible banner, rotating announcements, sale countdown banner

Files: src/components/arc/announcement-bar/announcement-bar.module.css, src/components/arc/announcement-bar/announcement-bar.tsx

## `cookie-consent` · Cookie consent (Free, component)

A consent bar that morphs into preferences and folds into a reopen button.

When to use:
- Asking for cookie or tracking consent on a marketing site or app.
- Sites that need per-category choices with a way to reopen them later.

When not to use:
- Use announcement-bar for a site-wide promotion or notice that needs no choice.
- Use toast for a one-off message that dismisses itself.

Keywords: feedback, new, react cookie consent, cookie banner, gdpr consent, cookie preferences, consent manager, privacy banner, tracking consent

Files: src/components/arc/cookie-consent/cookie-consent.module.css, src/components/arc/cookie-consent/cookie-consent.tsx

## `toast` · Toast (Free, component)

Brief confirmation for a completed background action.

When to use:
- A single success confirmation, like Changes saved, controlled with local state.
- Demos or small apps that do not need a toast queue.

When not to use:
- Use toast-stack for app-wide notifications with types, actions, updates, and stacking.
- Use alert for persistent messages that should stay in the page flow.

Keywords: status, message, react toast, toast notification, success toast, swipe to dismiss toast, animated toast, snackbar

Files: src/components/arc/toast/toast.module.css, src/components/arc/toast/toast.tsx

## `toast-stack` · Toast stack (Free, component)

Stack short results at the edge until you reach for them.

When to use:
- App-wide notifications for async results, errors, and undo.
- Loading toasts that morph into success or error when work finishes.

When not to use:
- Use toast for a single locally controlled confirmation.
- Use alert for persistent messages tied to a page.

Keywords: toast, notification, sonner, react toast stack, toast notifications, sonner alternative, stacked toasts, notification queue, promise toast, undo toast

Files: src/components/arc/toast-stack/toast-stack.module.css, src/components/arc/toast-stack/toast-stack.tsx

## `undo-toast` · Undo toast (Pro, component)

Archive or delete rows with a second chance: the gap closes, a countdown toast merges repeat actions, and Undo or ⌘Z puts every row back exactly where it was.

When to use:
- An inbox, notification list, task list or file list where archiving or deleting should be one click with a way back.
- Bulk triage, where people remove several items quickly and one toast should summarise them all.

When not to use:
- Irreversible destruction such as deleting a project or revoking keys; use confirm-popover so the consequence is stated first.
- General app notifications that are not tied to removing list items; use toast-stack.

Keywords: feedback, toast, undo, new, snackbar, archive, delete, trash, inbox, list, remove, restore, countdown, cmd z, ctrl z, optimistic, batch, gmail undo

Files: src/components/arc/undo-toast/demo.tsx, src/components/arc/undo-toast/undo-toast.module.css, src/components/arc/undo-toast/undo-toast.tsx
