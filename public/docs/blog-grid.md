# Blog grid

> A blog index with a featured post, category filter, post cards, pagination and an in-place reader.

- Type: Block
- Page: https://uiarc.dev/components/blocks/blog-grid
- Markdown: https://uiarc.dev/components/blocks/blog-grid/markdown

- Access: Free, open source
- Registry id: `blog-grid`
- Source file: `registry/blocks/blog-grid/blog-grid.tsx`
- Built from: Avatar, Pagination
- Keywords: blog grid, blog index, article list, news page, blog cards, featured post, category filter, react blog template

Use this as the index of a blog, journal or news page. Load posts from your CMS into blog-grid-data.ts or the posts prop, pass getHref to link each card to its article route, and keep category and page in your URL through the controlled props.

## When to use

- A marketing site blog or journal index.
- Resource hubs with a few categories and a featured story.

## When not to use

- Use changelog-page for release notes with versions.
- Use a data table for large archives that need sorting and search.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/blog-grid
pnpm dlx shadcn@latest add @uiarc/blog-grid
yarn dlx shadcn@latest add @uiarc/blog-grid
bunx --bun shadcn@latest add @uiarc/blog-grid
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/blog-grid.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/blog-grid/blog-grid.tsx`

   The source is in the registry item: https://uiarc.dev/r/blog-grid.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { BlogGrid } from "@/components/arc/blocks/blog-grid/blog-grid";

export function BlogIndex({ posts }: { posts: BlogPost[] }) {
  return (
    <BlogGrid
      posts={posts}
      categories={["Product", "Design", "Engineering", "Company"]}
      getHref={post => `/blog/${post.id}`}
    />
  );
}
```

## API reference

### BlogGrid

A blog index: title, category filter with a gliding highlight, a large featured post, a responsive card grid and pagination. Without getHref, cards open an in-place reader whose image morphs out of the card.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `posts` | `BlogPost[]` | `sample posts` | Posts to list. Sorted newest first by date. |
| `categories` | `string[]` | – | Filter labels in order. "All" is added in front. |
| `title` | `string` | `"Journal"` | Section heading. |
| `description` | `string` | – | Line under the heading. Pass an empty string to hide it. |
| `category` | `string` | – | Active category, or "All" (controlled). |
| `defaultCategory` | `string` | `"All"` | Initial category when uncontrolled. |
| `onCategoryChange` | `(category: string) => void` | – | Called when a filter is picked. The page resets to 1. |
| `page` | `number` | – | One based page (controlled). |
| `defaultPage` | `number` | `1` | Initial page when uncontrolled. |
| `onPageChange` | `(page: number) => void` | – | Called from the page numbers and the previous and next buttons. |
| `pageSize` | `number` | `6` | Cards per page below the featured post. |
| `showFeatured` | `boolean` | `true` | Shows the post marked featured (or the newest) of the current filter as a large card on page one. |
| `getHref` | `(post: BlogPost) => string` | – | Link for each post. When set, cards are plain links and the in-place reader is off. |
| `onPostOpen` | `(post: BlogPost) => void` | – | Called when a post opens, for analytics or routing. |
| `className` | `string` | – | Extra class on the section. |

### BlogPost

One post.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id, also the fallback hash link. |
| `title` (required) | `string` | – | Card and reader title. |
| `excerpt` (required) | `string` | – | Two line summary on cards, the lead paragraph in the reader. |
| `category` (required) | `string` | – | Must match one of categories to be filterable. |
| `date` (required) | `string` | – | ISO date (YYYY-MM-DD). |
| `readTime` (required) | `number` | – | Minutes to read. |
| `author` (required) | `{ name: string; avatar?: string; role?: string }` | – | Byline. |
| `image` | `{ src: string; alt: string }` | – | Cover image. Cards crop it to 3:2. |
| `body` | `string[]` | – | Paragraphs for the in-place reader. |
| `featured` | `boolean` | – | Prefer this post for the featured slot. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through filters, cards, and pagination. |
| Enter | Opens the focused post, or picks the focused filter or page. |
| Space | Picks the focused filter or page. |

## Accessibility

- Filters are buttons with aria-pressed; pagination is a nav with aria-current on the active page.
- Each card is one link with the title, excerpt and byline as its content, so screen readers announce it once.
- The reader moves focus to its back button, and closing returns focus to the card you opened.
- Images carry real alt text; author avatars are decorative.

## Motion

- The filter and page highlights glide on the morph spring.
- Filtering crossfades the grid with a short rise; paging slides it in the direction of travel.
- Opening a post morphs the card image into the reader hero, and back on close.
- Card images zoom 3% on hover (fine pointers only).
- Reduced motion swaps travel and morphs for plain fades.

## Responsive behavior

- Three columns above 900px, two to 540px, then one.
- The featured post stacks its image above the text below 680px.
- Filters scroll sideways on phones; Previous and Next collapse to arrows.

## Performance

- Only one page of cards renders at a time; images below the fold load lazily.
- Transitions animate transform and opacity only.

## Notes for AI

- Choose this for a blog, journal, news or resources index.
- Pass getHref for real article routes; leave it out for a self-contained demo or a small site that reads posts in place.
- Drive category and page from the URL with the controlled props so the index is linkable.

## Related

- [Changelog feed](https://uiarc.dev/components/blocks/changelog-feed/markdown): Release notes you can filter, open in place, and scroll through month by month.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.
- [Pagination](https://uiarc.dev/components/pagination/markdown): Move through a long collection with clear bounds.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
