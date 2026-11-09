# Commerce

## `activity-feed` — Activity feed (Pro, block)

A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button, expandable details, and a mark all read sweep.

When to use:
- A workspace or project activity page for a team product.
- A dashboard panel that shows what changed since someone last looked.

When not to use:
- Use audit-log for compliance history that needs search, export, and exact timestamps.
- Use notification-center for a personal inbox opened from a bell.

Keywords: activity feed, team activity, timeline, recent activity, mark all read, new updates, live feed, diff, filters, grouped by day

Files: activity-feed.module.css, activity-feed.tsx, demo.tsx

## `help-center` — Help center (Pro, block)

A help center with instant search, topic cards, and popular articles that open into a readable article with an outline and feedback.

When to use:
- A public help center or knowledge base
- In-app help with searchable articles

When not to use:
- Developer API reference with a nav tree, use docs-sidebar
- A short FAQ on a marketing page, use faq-section

Keywords: help center, knowledge base, support, faq, search, instant search, articles, table of contents, was this helpful, docs

Files: demo.tsx, help-center-data.ts, help-center.module.css, help-center.tsx

## `inbox-triage` — Inbox triage (Pro, block)

Process a focused inbox with archive, snooze, and restore actions.

When to use:
- A queue of messages or requests that need archive, snooze, or restore decisions.
- Inboxes where rows expand in place to show details and actions.

When not to use:
- Use inbox-sidebar for mail navigation with folders and counts.
- Use notification-center for system notifications.

Keywords: react inbox, email triage ui, inbox component, archive snooze inbox, message list, mail app ui

Files: demo.tsx, inbox-triage.module.css, inbox-triage.tsx

## `seat-map` — Seat mapNew (Pro, block)

An event seat picker with a curved concert hall map, price tiers, zoom and pan, sold, held and wheelchair seats, and a live summary with fees and a hold countdown.

When to use:
- Reserved seating for concerts, theatre, sports and conferences where the buyer picks exact seats.
- Any spatial picker with priced places: tables in a restaurant plan, desks in an office, cabins on a deck.

When not to use:
- Use a quantity stepper with best available when seats are general admission or assigned by the box office.
- Use availability-picker for choosing times rather than places.

Keywords: seat map, seat picker, seat selection, venue map, event tickets, ticketing, theatre seating, concert tickets, price tiers, zoom and pan, pinch zoom, wheelchair seats, accessible seating, hold timer, checkout

Files: demo.tsx, seat-map.module.css, seat-map.tsx

## `support-conversation` — Support conversation (Pro, block)

A responsive message thread with useful quick replies and live feedback.

When to use:
- A support chat or ticket thread with quick replies and attachments.
- Help flows that should show a typing indicator and a resolve toggle.

When not to use:
- Use support-widget for a floating help launcher.
- Use ai-composer for a prompt input without a thread.

Keywords: react support chat, chat thread ui, customer support conversation, help desk chat, chat with typing indicator, ticket conversation

Files: demo.tsx, support-conversation.module.css, support-conversation.tsx

## `support-widget` — Support widget (Pro, block)

An in-app help launcher that grows into live article search, reading, and a chat with your team.

When to use:
- An in-app help launcher with article search, an article reader, and chat.
- SaaS products that want one help entry point mounted near the app root.

When not to use:
- Use support-conversation for a full page support chat.
- Use ai-composer for an AI prompt input without help articles.

Keywords: react support widget, help center widget, intercom style chat, in-app help launcher, customer support chat, help article search

Files: demo.tsx, support-widget-data.tsx, support-widget.module.css, support-widget.tsx
