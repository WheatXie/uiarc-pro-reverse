# Feature voting

> A public feature request board where votes roll digit by digit and the button fills with the accent. Top, New and Trending reorder the rows with one smooth move. A built-in composer suggests similar requests as you type, so people vote instead of posting duplicates.

- Type: Block
- Page: https://uiarc.dev/components/blocks/feature-voting
- Markdown: https://uiarc.dev/components/blocks/feature-voting/markdown

- Access: Arc Pro
- Registry id: `feature-voting`
- Source file: `registry/blocks/feature-voting/feature-voting.tsx`
- Built from: Button, SegmentedControl, Avatar
- Keywords: feature voting, feature requests, upvote, roadmap, feedback board, canny, product feedback, duplicate detection, customer ideas, vote button

Pass your requests (votes, comments, status, createdAt, trend, tag with an optional Linear, Okta, Slack, Notion, GitHub or Figma mark, and recent voters) and wire onVote(id, voted, signal) and onSubmit(draft, signal) to your API. Both are optimistic and roll back if the promise rejects. Swap in findSimilar to check duplicates against your search index. Set onOpenRequest to make the titles open a detail page. Use disabled for signed-out visitors and loading for placeholder rows. With no props it renders a sample board with simulated live votes.

## When to use

- A public feature request page where customers vote and suggest ideas.
- An in-app Give feedback panel that shows what is planned and shipped.
- A customer portal that needs to deflect duplicate requests before they are posted.

## When not to use

- A full roadmap with columns per stage: use a kanban style board.
- One off feedback on a single page or screen: use a short feedback form.
- Release notes of what already shipped: use changelog-feed.

## Installation

Feature voting is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/feature-voting
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { FeatureVoting } from "@/components/arc/blocks/feature-voting/feature-voting";

export function RoadmapBoard({ requests, user }) {
  return (
    <FeatureVoting
      requests={requests}
      currentUser={{ name: user.name, src: user.avatarUrl }}
      onVote={async (id, voted, signal) => {
        const response = await fetch(`/api/requests/${id}/vote`, { method: voted ? "POST" : "DELETE", signal });
        if (!response.ok) throw new Error("Vote not saved");
      }}
      onSubmit={async (draft, signal) => {
        const response = await fetch("/api/requests", { method: "POST", body: JSON.stringify(draft), signal });
        if (!response.ok) throw new Error("Request not posted");
        return response.json();
      }}
      onOpenRequest={id => router.push(`/roadmap/${id}`)}
    />
  );
}
```

## API reference

### FeatureVoting

A public feature request board in one card. Each row has a vote button whose count rolls digit by digit and fills with the accent when you vote, the request title, a status chip (Under review, Planned, In progress, Shipped) drawn as an icon plus label, the area or integration with its real mark (Linear, Okta, Slack, Notion, GitHub, Figma) and a comment count. Hovering a vote button shows a small card with the latest voters' faces and names. Top, New and Trending reorder the rows with one bounce free move; rows never reorder on their own, so nothing jumps under the pointer. Suggest a feature opens an inline composer that lists similar requests as you type, each with a Vote button so people vote instead of posting a duplicate. A footer line confirms every action, and the sample board drops in live votes from other customers while it is on screen.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `requests` | `FeatureRequest[]` | `sample board` | Requests on the board: { id, title, status?: "review" \| "planned" \| "progress" \| "shipped", votes, comments, createdAt (ISO date, for New), trend? (votes in the last 7 days, for Trending), tag?: { label, mark? }, voters?: { name, src? }[] (latest first), voted? }. A new array replaces the board and re-applies the current sort. |
| `title` | `string` | `"Feature requests"` | Heading of the card. |
| `description` | `string` | `"Vote on what we build next. We read every request."` | One muted line under the heading. |
| `defaultSort` | `"top" \| "new" \| "trending"` | `"top"` | Sort applied on mount. |
| `onSortChange` | `(sort: FeatureSort) => void` | – | Called when someone picks Top, New or Trending. Use it to persist the choice or refetch. |
| `onVote` | `(id: string, voted: boolean, signal: AbortSignal) => void \| Promise<void>` | – | Called after the optimistic vote or unvote. Reject to roll it back with an error line. The signal aborts when the same request is toggled again. Without it, votes are simulated and the footer says so. |
| `onSubmit` | `(draft: { title, details }, signal: AbortSignal) => Promise<FeatureRequest \| void>` | – | Posts a new request. Resolve with the saved request, or nothing to add the draft as Under review with your vote. Reject to keep the composer open with an error. Without it, posting is simulated (700ms). |
| `findSimilar` | `(query: string, requests: FeatureRequest[]) => FeatureRequest[]` | `findSimilarRequests` | Duplicate finder used while typing a title. The default ranks by shared words, prefixes and a few synonyms (sso, login, okta). Swap in a search API or embeddings lookup; the first three results show. |
| `onOpenRequest` | `(id: string) => void` | – | Turns each title into a button, for opening the request's detail page or comment thread. |
| `currentUser` | `{ name: string; src?: string }` | `Nathan Cole` | The signed in person. Shown first, as You, in the voters card after they vote. |
| `live` | `boolean` | `true for the sample board` | Drops in a vote from another customer every few seconds while the card is visible. Off with reduced motion. |
| `loading` | `boolean` | `false` | Shows four placeholder rows at the same row height. |
| `disabled` | `boolean` | `false` | Turns voting and suggesting off, for signed out visitors. Counts and statuses stay readable. |
| `className` | `string` | – | Class on the root element. |

### findSimilarRequests

The built in duplicate finder, exported for server side checks: findSimilarRequests(query, requests, limit = 3).

No props.

### sortRequests

Returns request ids in Top, New or Trending order: sortRequests(requests, sort).

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Suggest a feature, the sort control, then each vote button (and title, when onOpenRequest is set). |
| Enter / Space | Votes or removes your vote on the focused request. Focusing a vote button with the keyboard shows its voters. |
| Arrow keys | Move between Top, New and Trending inside the sort control. |
| Enter | In the title field, posts the request. Cmd or Ctrl + Enter posts from the details field. |
| Escape | Closes the composer and returns focus to Suggest a feature. |

## Accessibility

- Vote buttons are toggle buttons (aria-pressed) labelled with the request and its count, for example Vote for SAML single sign-on with Okta, 351 votes.
- Statuses are always an icon plus a word, never color alone.
- Every vote, duplicate vote and new post is announced through a polite status region; simulated actions say Simulated, nothing was sent.
- The similar requests list is linked to the title field with aria-describedby, and each Vote button names the request it votes for.
- The voters card is decorative (aria-hidden); the same count is in the vote button's label.

## Motion

- Counts roll only the digits that change, up for a vote and down for an unvote, in tabular numerals so widths never shift.
- Sorting moves rows with one 240ms bounce free spring on transform. Rows never reorder on a live vote, so nothing moves under the pointer.
- The composer, the similar requests list and a newly posted row open by animating their measured height; everything below glides instead of jumping.
- The vote chevron nudges up 3px once when you vote. A new or chosen row gets a brief accent wash.
- Footer messages crossfade. With reduced motion, rolls, moves and folds cut to their end state and live votes stop.

## Responsive behavior

- One column card from 320px up. Below 440px the button reads Suggest and padding tightens; below 360px the integration tag hides.
- Titles and the footer truncate with an ellipsis; row height never changes.
- The voters card appears on hover with a mouse and on keyboard focus; touch skips it.

## Performance

- Renders every request; paginate or virtualize past about 50 rows.
- Duplicate detection runs locally on each keystroke and is linear in the number of requests.
- The live vote timer pauses when the card is off screen or the tab is hidden.

## Notes for AI

- Use for a public or in-app feature request board, roadmap feedback widget or customer voice page.
- Wire onVote and onSubmit to your API; both are optimistic and roll back on rejection.
- Pass findSimilar backed by your search index or embeddings to catch duplicates across thousands of requests.
- Keep the card between 360 and 760px; for a full kanban roadmap with columns, use a dedicated roadmap layout instead.
- Set disabled for signed out visitors and render your own sign in prompt next to the card.

## Related

- [Feedback board](https://uiarc.dev/components/blocks/feedback-board/markdown): A feature request board with a submit form that finds similar requests, upvotes, top and new sorting, status filters, and comments.
- [Changelog feed](https://uiarc.dev/components/blocks/changelog-feed/markdown): Release notes you can filter, open in place, and scroll through month by month.
- [AI feature launch](https://uiarc.dev/components/blocks/ai-feature-launch/markdown): An in-product launch card for an AI feature. A looping mini demo plays above a three-step tour (inline rewrite, thread summary, ask your workspace), with benefit rows, an admin-gated "Enable for my workspace" switch, and Try it now and Learn more actions.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
