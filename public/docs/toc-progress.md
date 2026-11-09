# Table of contents progress

> A table of contents that reads along with you: a line bends through the nested headings, fills as you scroll, and carries a marker to the current section, with smooth jumps and a time-left countdown.

- Type: Component (disclosure)
- Access: Arc Pro
- Page: https://uiarc.dev/components/toc-progress
- Markdown: https://uiarc.dev/components/toc-progress/markdown
- Source file: `registry/components/toc-progress/toc-progress.tsx`
- Dependencies: motion, lucide-react
- Keywords: navigation, scroll, motion, new, table of contents, toc, on this page, scroll spy, reading progress, scrollspy, article navigation, docs navigation, anchor links, section indicator, progress line, time left, reading time

## When to use

- A documentation page, guide or blog post long enough that readers jump between sections.
- An engineering write up or policy where knowing how much is left helps readers commit to it.
- Any long article in its own scroll container, such as a help panel or a reader view.

## When not to use

- Use tabs when sections are alternatives rather than parts of one document.
- Use scroll-progress-ring for a compact overall progress indicator without navigation.
- Skip it for pages with fewer than four headings; a plain list of anchors is enough.

## Installation

Table of contents progress is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/toc-progress
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TocProgress } from "@/components/arc/toc-progress/toc-progress";

const headings = [
  { id: "overview", label: "Overview" },
  { id: "install", label: "Installation" },
  { id: "install-cli", label: "With the CLI", level: 2 },
  { id: "install-manual", label: "By hand", level: 2 },
  { id: "configure", label: "Configuration" },
] as const;

export function DocsPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <article>{children}</article>
      <aside className="toc">
        {/* Sticky header is 64px tall: headings count as reached just below it. */}
        <TocProgress items={[...headings]} offset={88} onNavigate={id => history.replaceState(null, "", `#${id}`)} />
      </aside>
    </div>
  );
}
```

## API reference

### TocProgress

A table of contents that reads along with you. A thin line runs down the headings and bends through their indentation with a smooth S between levels. The part you have read fills in with the accent as you scroll, section by section, and a marker rides the tip of the line, lighting each heading as it arrives. Choosing a heading scrolls the article there smoothly while the line traces the way, and the time left beside the title counts down, then reads Finished.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` (required) | `TocProgressItem[]` | – | Headings in document order, each { id, label, level?: 1 \| 2 \| 3 }. id is the id of the heading element in the article; level sets the lane the line bends into and the label indent. |
| `scrollContainer` | `RefObject<HTMLElement \| null> \| HTMLElement \| null` | – | The element that scrolls the article. Defaults to the nearest scrolling ancestor of the first heading, or the page when there is none. |
| `offset` | `number` | `96` | Distance in px from the top of the scroll viewport at which a heading counts as reached, usually the height of a sticky header plus a little air. Headings scroll to this line when chosen. |
| `activeId` | `string` | – | The current heading, controlled. By default the current heading follows the reading position; the line keeps following the scroll either way. |
| `onActiveChange` | `(id: string) => void` | – | Called with the heading id when the marker reaches a new heading, while reading or while a chosen heading scrolls into place. |
| `onNavigate` | `(id: string) => void` | – | Called with the heading id when a heading in the list is chosen, before the article scrolls. Use it to update the URL hash or analytics. |
| `readingTime` | `number` | – | Reading time of the whole article in minutes. Defaults to an estimate from the words in the scroll container at 230 words a minute. |
| `title` | `string` | `"On this page"` | Heading above the list and the accessible name of the navigation. Pass an empty string to hide it. |
| `showTimeLeft` | `boolean` | `true` | Shows the minutes left beside the title, rolling to each new value and ending on Finished with a check. |
| `label` | `string` | `"On this page"` | Accessible name of the navigation when title is empty. |
| `className` | `string` | – | Class on the root element. Set --toc-accent to recolor the read line and the marker. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the headings in the list; each is a link. |
| Arrow Down / Arrow Up | Moves focus to the next or previous heading in the list. |
| Home / End | Moves focus to the first or last heading in the list. |
| Enter | Scrolls the article to the heading and moves focus to it without a second scroll jump, so reading and tabbing continue from there. |

## Accessibility

- The list is a nav landmark named by the title, with an ordered list of links whose href points at each heading, so it works as plain anchors before hydration.
- The current heading carries aria-current="location"; read, current and upcoming headings also differ in text contrast, never by the line alone.
- Choosing a heading gives the target heading tabindex="-1" if it has none and focuses it with preventScroll, so screen reader and keyboard users land where the article scrolled.
- The line, the fill and the marker are one SVG hidden from assistive technology. The time left is plain text beside the title and is not announced on every change.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. A focused heading shows a quiet fill.

## Motion

- The reading position is a section index plus how far through that section you are, from where its heading crosses the offset line to where the next one does. It follows the scroll on a critically damped spring, so a wheel step glides instead of jumping and the marker never points past the section you are in.
- Each section fills the stretch of line from its heading to the next, bends included, so the fill always meets a heading exactly when that heading is reached. The marker rides the tip of the fill along the same points the line is drawn from.
- Near the end of the article the reading line eases from the offset down to the bottom edge of the viewport, so short last sections are still reached when the scroll bottoms out.
- A chosen heading scrolls smoothly and the line traces there through every section in between. If the heading cannot reach the top because the article ends, it stays current until the reader scrolls on.
- Heading colors change over 240ms. The time left rolls up to its new value with a short blur, on the snappy spring, and ends on Finished.
- With reduced motion the fill and marker follow the scroll directly, chosen headings jump into place, colors change at once and the time left crossfades.

## Responsive behavior

- The list takes the width of its column and labels wrap; the line follows each row's measured height, so wrapped labels keep the bends between rows.
- Rows, the line and the heading positions are re-measured with ResizeObserver whenever the list, the article or the scroll container resizes, including font loading and images.
- Works with the page scroll or any scroll container, including one inside a preview frame or a dialog.
- Touch targets are the full row width; on narrow screens place the component above the article.

## Performance

- Scroll handling is passive and does arithmetic on cached heading positions; layout is read only when something resizes.
- The line is a single polyline path and its fill is the same path with a stroke dash, animated through motion values; the marker is one transform. React renders only when the current heading or the rounded time left changes.
- Keep items to a few dozen headings; the line is rebuilt in one pass when the list resizes.

## Notes for AI

- Use it beside long form content with real headings: documentation pages, engineering write ups, guides, policies and changelogs. Pass the heading ids that already exist in the article.
- Keep to two levels for most articles, three at most; the line bends at every level change, so alternating levels on every row makes it zigzag.
- Set offset to the height of any sticky header plus 16 to 32px, and use the same value as scroll-margin-top on the headings for anchor links.
- When the article scrolls inside its own container, pass scrollContainer; otherwise it finds the nearest scrolling ancestor of the first heading, or the page.
- Pass readingTime when you already know it; the default estimate counts every word in the scroll container, including code.
- Put it in a sticky aside on wide screens. On phones, show it above the article or in a sheet rather than beside it.

## Related

- [Sidebar: Docs](https://uiarc.dev/components/blocks/sidebar/markdown): A docs layout with a live filtering nav tree, version switcher, and a gliding on this page outline.
- [Tabs](https://uiarc.dev/components/tabs/markdown): Switch between related content in the same context.

## Also in navigation

- [Breadcrumb](https://uiarc.dev/components/breadcrumb/markdown): Show where a page sits in a hierarchy.
- [Pagination](https://uiarc.dev/components/pagination/markdown): Move through a long collection with clear bounds.
- [Mega menu morph](https://uiarc.dev/components/mega-menu-morph/markdown): A site header whose menus share one floating panel. Moving between sections morphs its size, slides the next menu in from that side and glides the caret under the new trigger, with hover intent, a safe triangle and an accordion sheet on narrow screens.

## Guidance for AI tools

Table of contents progress: A table of contents that reads along with you: a line bends through the nested headings, fills as you scroll, and carries a marker to the current section, with smooth jumps and a time-left countdown. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
