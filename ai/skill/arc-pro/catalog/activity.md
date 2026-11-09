# Activity

## `chat-thread` · Chat thread (Free, component)

A chat thread with grouped messages, reactions, read receipts, typing, and a composer with attachments.

When to use:
- Customer support or in-app messaging with read receipts and typing state.
- Team or DM threads that need reactions and image or file attachments.

When not to use:
- Use log-stream for streaming system or build output.
- Use timeline for an activity history rather than a two-way conversation.

Keywords: data, new, react chat, chat thread, messaging ui, support chat widget, chat bubbles, read receipts, typing indicator, message reactions, chat composer with attachments

Files: registry/components/chat-thread/chat-thread.tsx, registry/components/chat-thread/chat-thread.module.css

## `comment-thread` · Comment thread (Free, component)

Threaded comments with replies, reactions, mentions, inline edit, and resolve.

When to use:
- Review threads on documents, designs, tickets, or pull requests.
- Discussions that need replies, reactions, mentions, and a resolved state.

When not to use:
- Use chat-thread for real-time back-and-forth conversation.
- Use ai-chat for assistant conversations with streaming replies.

Keywords: data, new, react comment thread, threaded comments, comment replies, resolve thread, mentions in comments, comment reactions, review comments component

Files: registry/components/comment-thread/comment-thread.tsx, registry/components/comment-thread/comment-thread.module.css

## `timeline` · Timeline (Free, component)

Follow what happened, newest first, grouped by day.

When to use:
- Project history, audit logs, and deploy streams where recency matters.
- Live feeds where new updates slide in at the top.

When not to use:
- Use sortable-data-table when people sort or compare.
- Use stepper for progress through fixed steps.

Keywords: data, feed, activity, react timeline, activity feed, audit log, vertical timeline, event feed, changelog timeline

Files: registry/components/timeline/timeline.tsx, registry/components/timeline/timeline.module.css
