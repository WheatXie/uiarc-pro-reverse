# Feedback board

> A feature request board with a submit form that finds similar requests, upvotes, top and new sorting, status filters, and comments.

- Type: Block
- Page: https://uiarc.dev/components/blocks/feedback-board
- Markdown: https://uiarc.dev/components/blocks/feedback-board/markdown

- Access: Arc Pro
- Registry id: `feedback-board`
- Source file: `registry/blocks/feedback-board/feedback-board.tsx`
- Built from: Input, Textarea, Segmented control, Avatar, Animated counter
- Keywords: feedback board, feature requests, upvote, voting, ideas, product feedback, canny, suggestions

Use this to collect and rank feature requests. Save new requests with onSubmit, votes with onVote and comments with onComment, and set each status from your own admin tools.

## When to use

- A public or in app board where customers suggest and vote on features.
- Beta programs that need a lightweight place for requests and team replies.

## When not to use

- One to one support conversations; use support-conversation or support-widget.

## Installation

Feedback board is part of Arc Pro. The live preview is public; the source and install command need Pro.

### CLI with a Pro token

1. Create a token in your account and set it in the environment (or `.env.local`). Never commit it.

```bash
export ARC_PRO_TOKEN=arc_pro_...
```

2. Add the Pro registry to `components.json`:

```json
{
  "registries": {
    "@uiarc": "https://uiarc.dev/r/{name}.json",
    "@uiarc-pro": {
      "url": "https://uiarc.dev/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${ARC_PRO_TOKEN}"
      }
    }
  }
}
```

3. Install:

```bash
npx shadcn@latest add @uiarc-pro/feedback-board
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { FeedbackBoard } from "@/components/arc/blocks/feedback-board/feedback-board";

export function FeedbackPage({ requests, user }) {
  return (
    <FeedbackBoard
      defaultRequests={requests}
      currentUser={{ name: user.name, avatar: user.avatar }}
      onSubmit={draft => createRequest(draft)}
      onVote={(id, voted) => vote(id, voted)}
      onComment={(id, text) => comment(id, text)}
    />
  );
}
```

## API reference

### FeedbackBoard

A feature request board: post an idea, upvote with a rolling count, sort by top or new, filter by status, and expand a request in place to read and add comments. While a title is typed, similar requests appear so people vote instead of posting duplicates.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `requests` | `FeedbackRequest[]` | – | Controlled requests. Pair with onRequestsChange. |
| `defaultRequests` | `FeedbackRequest[]` | `sample requests` | Initial requests when uncontrolled. |
| `onRequestsChange` | `(requests: FeedbackRequest[]) => void` | – | Called with the full list after a vote, a new request, or a comment. |
| `onVote` | `(id: string, voted: boolean) => void` | – | Called after a vote is added or removed. |
| `onSubmit` | `(draft: { title, details, category }) => void` | – | Called with a new request once the title passes validation. The author's vote is added automatically. |
| `onComment` | `(id: string, text: string) => void` | – | Called when a comment is posted. |
| `statuses` | `{ id: FeedbackStatus; name: string }[]` | `Under review, Planned, In progress, Complete` | Status names for filters and tags. |
| `categories` | `string[]` | `["Feature", "Integration", "Improvement"]` | Category choices in the form. |
| `currentUser` | `{ name: string; avatar?: string }` | `{ name: "You" }` | Author of new requests and comments. |
| `defaultSort` | `"top" \| "new"` | `"top"` | Initial sort. |
| `title` | `string` | `"Feedback"` | Page heading. |
| `className` | `string` | – | Extra class on the root. |

### FeedbackRequest

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id, title, details, category` (required) | `string` | – | Request content. |
| `status` (required) | `"review" \| "planned" \| "progress" \| "done"` | – | Shown as a dot and label; filterable. |
| `votes` (required) | `number` | – | Vote count. |
| `voted` | `boolean` | – | Whether the current visitor voted. |
| `author` (required) | `{ name, avatar? }` | – | Who posted it. |
| `at, created` (required) | `string, number` | – | Display time and a sort key for New (higher is newer). |
| `comments` (required) | `{ id, author, text, at, team? }[]` | – | Comments. team marks replies from your team with a Team tag. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Move through New request, status filters, sort, and each request's vote and title. |
| Enter / Space | Toggle a vote, expand a request, or pick a filter. |
| Arrow left / Arrow right | Switch between Top and New. |
| Escape | Close the new request form. |

## Accessibility

- The form validates on submit with an inline error tied to the title through aria-describedby and aria-invalid.
- Votes are toggle buttons with aria-pressed and a label that names the request and count; changes and posts are announced.
- Request titles are buttons with aria-expanded that reveal details and comments in place.
- Status always pairs a dot with its name; filters and sort are radiogroups.

## Motion

- Voting hops the arrow and rolls the count. Rows keep their place while you vote and only re-rank when you change sort or filter, so nothing moves under the pointer.
- Sort and filter changes glide rows to their new order. A posted request lands at the top with a brief tint.
- The form, similar requests, errors, and expanded details open on a critically damped height spring.
- Reduced motion removes travel and height springs and keeps short fades.

## Responsive behavior

- Content sits in a centered 820px column under a frosted sticky header.
- Below 640px the toolbar stacks: status filters scroll sideways above the sort switch, and the form's category chips sit above a full width Post button.
- Vote boxes shrink slightly and the relative time hides on phones.

## Performance

- Sorting and filtering are memoized per change; only rows that move animate.
- The header blur is one backdrop filter; it falls back to a solid surface when transparency is reduced.

## Notes for AI

- Use to collect and rank feature requests from customers. Keep the admin side (status changes, merging) in your own tools and pass the result in.
- The similar requests check is a simple word match on the client. Swap it for server search when the board grows.
- Record votes per signed in user; the board tracks only the current visitor's vote.

## Related

- [Changelog feed](https://uiarc.dev/components/blocks/changelog-feed/markdown): Release notes you can filter, open in place, and scroll through month by month.
- [Support widget](https://uiarc.dev/components/blocks/support-widget/markdown): An in-app help launcher that grows into live article search, reading, and a chat with your team.
- [Activity feed](https://uiarc.dev/components/blocks/activity-feed/markdown): A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button, expandable details, and a mark all read sweep.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
