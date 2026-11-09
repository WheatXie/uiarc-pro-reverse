# Help center

> A help center with instant search, topic cards, and popular articles that open into a readable article with an outline and feedback.

- Type: Block
- Page: https://uiarc.dev/components/blocks/help-center
- Markdown: https://uiarc.dev/components/blocks/help-center/markdown

- Access: Arc Pro
- Registry id: `help-center`
- Source file: `registry/blocks/help-center/help-center.tsx`
- Built from: Search field, Command palette, Card, Button
- Keywords: help center, knowledge base, support, faq, search, instant search, articles, table of contents, was this helpful, docs

Use this as a self serve support site or in-app help. Load categories and articles from your CMS, pass a server search through search if you have one, and record votes through onFeedback; contact in the preview is simulated.

## When to use

- A public help center or knowledge base
- In-app help with searchable articles
- Support portals that deflect tickets with good answers

## When not to use

- Developer API reference with a nav tree, use docs-sidebar
- A short FAQ on a marketing page, use faq-section
- Live chat with support, use support-conversation

## Installation

Help center is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/help-center
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { HelpCenter } from "@/components/arc/blocks/help-center/help-center";

export function Help({ articles, categories }) {
  return (
    <HelpCenter
      brand="Acme"
      articles={articles}
      categories={categories}
      onArticleOpen={article => router.replace(`/help/${article.id}`)}
      onFeedback={(id, helpful, comment) => fetch("/api/help/feedback", { method: "POST", body: JSON.stringify({ id, helpful, comment }) })}
    />
  );
}
```

## API reference

### HelpCenter

A help center app. The home screen leads with a large instant search, then topic cards, popular articles, and a contact card. Results appear under the field as you type with the matching words highlighted. Articles open in a reading view with breadcrumbs, a sticky on this page outline that follows your scroll, a feedback question, and related articles.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `articles` | `HelpArticle[]` | `sample articles` | Articles with id, title, categoryId, summary, updated label, reading minutes, popular flag, and sections of paragraphs and optional steps. |
| `categories` | `HelpCategory[]` | `sample categories` | Topics with id, name, description, and an icon key: start, billing, team, integrations, security, or troubleshooting. |
| `brand` | `string` | `"Northwind"` | Name in the top bar. |
| `heading` | `string` | `"How can we help?"` | Heading above the big search. |
| `suggestions` | `string[]` | `["invoice", "single sign-on", "slack"]` | Quick searches under the big search field. |
| `defaultArticleId` | `string` | – | Opens this article on mount, for deep links. |
| `search` | `(query: string, articles: HelpArticle[]) => HelpArticle[]` | `searchArticles` | Ranks results. The default requires every word and ranks title matches above summary and body matches. |
| `onFeedback` | `(articleId: string, helpful: boolean, comment?: string) => void \| Promise<void>` | – | Records a vote and the optional comment. |
| `onContact` | `() => void \| Promise<void>` | – | Opens your support channel. Without it the preview simulates a sent request. |
| `onArticleOpen` | `(article: HelpArticle) => void` | – | Called when an article opens, for routing or analytics. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow down / Arrow up | Move through search results. |
| Enter | Opens the highlighted result. |
| Escape | Clears the search, then leaves the field. |
| Tab | Moves through topics, articles, the outline, and feedback. |

## Accessibility

- Search is a combobox with a listbox of options and aria-activedescendant; the result count is announced politely.
- Articles use real headings; outline links move focus to their section heading and mark the current one with aria-current.
- Breadcrumbs are a labelled navigation; the feedback area announces its thank you politely.
- Topic icons are decorative; every card is a button named by its text.

## Motion

- Results drop in from the field with a short fade and scale; they are never animated while you arrow through them.
- Views slide 16px in the direction of travel, deeper to the right and back to the left.
- The outline bar follows the section you are reading on the snappy spring; clicking a section scrolls smoothly.
- Feedback states crossfade and the card resizes on the smooth spring. Reduced motion uses fades and instant scrolling.

## Responsive behavior

- Topic cards go from one to two to three columns.
- The compact search moves into the top bar once you leave the home screen.
- The screen height is min(760px, 100dvh) and the page scrolls inside it.

## Performance

- Search runs in memory on every keystroke; switch to a server search past a few thousand articles.
- Scroll tracking uses one passive listener and reads section positions only while scrolling.

## Notes for AI

- Choose this for a self serve support site, a docs style help area, or an in-app help screen.
- Wire a server search through search when you have many articles; keep the combobox and highlight behavior.
- Article sections are plain text paragraphs and steps; render your CMS rich text inside the prose container if you need links or images.
- The outline appears from 860px of width; below that the article reads as one column.

## Related

- [Sidebar: Docs](https://uiarc.dev/components/blocks/sidebar/markdown): A docs layout with a live filtering nav tree, version switcher, and a gliding on this page outline.
- [FAQ section](https://uiarc.dev/components/blocks/faq-section/markdown): FAQs as an accordion, a topic rail, or a searchable list that highlights matches.
- [Support widget](https://uiarc.dev/components/blocks/support-widget/markdown): An in-app help launcher that grows into live article search, reading, and a chat with your team.
- [Support conversation](https://uiarc.dev/components/blocks/support-conversation/markdown): A responsive message thread with useful quick replies and live feedback.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
