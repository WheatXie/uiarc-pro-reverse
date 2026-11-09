# Search results

> A faceted workspace search page with suggestions, facet counts that follow the query, filter chips, mixed doc, person and file results with highlighted matches, a gliding keyboard cursor and a preview pane.

- Type: Block
- Page: https://uiarc.dev/components/blocks/search-results
- Markdown: https://uiarc.dev/components/blocks/search-results/markdown

- Access: Arc Pro
- Registry id: `search-results`
- Source file: `registry/blocks/search-results/search-results.tsx`
- Built from: Checkbox, Slider, Bottom sheet, Filter toolbar, Segmented control, Empty state, Button, Avatar
- Keywords: search, search results, faceted search, filters, facets, highlight, keyboard navigation, skeleton, no results, workspace search, app shell

Render <SearchResults /> for the demo, or pass results (docs, people, files), teams, recentSearches and suggestedSearches, with onSearch and onOpen to wire it to a real index. Set latency={0} and swap results yourself when your fetch resolves.

## When to use

- A full search page for a workspace or knowledge base that returns several kinds of things at once.
- Search where people narrow by type, team, and date, and want to read a match before opening it.

## When not to use

- Use command-palette for quick jump to navigation from any screen.
- Use product-listing for a storefront grid filtered by price, color, and size.
- Use customers-table or sortable-data-table when results are records to compare in columns.

## Installation

Search results is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/search-results
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SearchResults } from "@/components/arc/blocks/search-results/search-results";

export function WorkspaceSearch({ items }: { items: SearchResult[] }) {
  return (
    <SearchResults
      results={items}
      workspace="Acme"
      defaultQuery=""
      latency={0}
      onSearch={query => track("search", { query })}
      onOpen={result => router.push(`/${result.kind}/${result.id}`)}
    />
  );
}
```

## API reference

### SearchResults

A faceted search results page for a workspace. A query bar with recent and suggested searches, a facet sidebar whose counts follow the query, a last edited range, active filter chips, and one list of mixed docs, people, and files with every match highlighted. A keyboard cursor glides through the results and a preview pane follows it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `results` | `SearchResult[]` | `sample workspace` | Everything that can be found. Each item is a doc ({ title, path, snippet, body, author, updated, readMinutes }), a person ({ person, title, role, snippet, email, location, owns }), or a file ({ title, ext, size, snippet, owner, updated, photo?, pages? }), all with an id and a team. |
| `teams` | `SearchTeam[]` | `teams` | Team facet options ({ id, label }) in display order. |
| `recentSearches` | `string[]` | – | Recent queries shown first in the suggestions. Runs are added to the front, up to five. |
| `suggestedSearches` | `string[]` | – | Suggested queries shown under recent ones and offered again when nothing matches. |
| `defaultQuery` | `string` | `"onboarding"` | Query shown and run on first render. |
| `defaultSort` | `"relevance" \| "newest" \| "title"` | `"relevance"` | Initial sort: best match, newest first, or A to Z. |
| `today` | `string` | `"2026-09-24"` | ISO day that relative dates and the edited range are measured from, so the server and client render the same labels. |
| `workspace` | `string` | `"Northwind"` | Workspace name used in the placeholder and the region label. |
| `latency` | `number` | `650` | Simulated query time in milliseconds while skeletons show. 0 shows results at once. |
| `onSearch` | `(query: string) => void` | – | Called each time a query runs, from Enter, a suggestion, a spelling fix, or an empty state suggestion. |
| `onOpen` | `(result: SearchResult) => void` | – | Called when the preview's primary action (Open doc, View profile, Download) completes. |
| `className` | `string` | – | Class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| / | Focuses the query from anywhere on the page, unless another field has focus. |
| Arrow down / Arrow up in the query | Moves through recent and suggested searches; with the list closed, Arrow down moves into the results. |
| Enter in the query | Runs the highlighted suggestion or the typed query. |
| Escape in the query | Closes the suggestions, then clears the text. |
| Arrow down / Arrow up, J / K | Moves the result cursor; Arrow up on the first result returns to the query. |
| Home / End | Jumps to the first or last result. |
| Enter / Space on a result | Opens it: the preview pane follows on wide layouts, and a sheet opens on narrow ones. |
| Escape in the results | Returns focus to the query. |

## Accessibility

- The query is a combobox with aria-activedescendant into a grouped listbox of recent and suggested searches.
- Results are one listbox with aria-activedescendant, so a screen reader hears each result's title, meta, and snippet as the cursor moves.
- Result counts and loading are announced in a polite status region; the results region sets aria-busy while skeletons show.
- Facets are fieldsets with legends; each option is a labeled checkbox, and options with no matches are disabled rather than hidden.
- The last edited range is a two thumb slider with named thumbs and month value text.
- Keyboard position shows through the gliding fill, never a focus ring. Highlights use mark elements, and matches are never shown by color alone.

## Motion

- One neutral fill glides between results on a no overshoot spring as the cursor moves, by keyboard or pointer.
- The result count rolls up when results grow and down when a filter narrows them, in tabular numerals.
- New result sets crossfade with a short rise; the preview pane crossfades per result. Skeletons share the result grid, so nothing shifts when results land.
- The suggestions menu scales in from the query bar; the chip row opens and closes its height on a smooth spring.
- Reduced motion removes travel and the skeleton pulse and keeps plain fades.

## Responsive behavior

- From 1120px wide the layout is facets, results, and a preview pane; below that the preview opens in a bottom sheet.
- Below 680px the facets move into a filters sheet with a sticky Clear all and Show results footer, and the query bar gains a Filters button with a count.
- Rows and sheet controls keep 44px touch targets; titles wrap to two lines and snippets clamp to two.
- Layout decisions use a container query, so the block adapts to its column, not the window.

## Performance

- Matching, sorting, and facet counts are memoized and run on the client for a few hundred items; move them to the server for larger indexes.
- Only transform and opacity animate; the preview pane width is measured once with a ResizeObserver.

## Notes for AI

- Map your index to the three result shapes; keep snippets to the sentence that contains the match, since highlighting reads the query terms.
- Facet counts are disjunctive within a group: each option counts what you would see if you added it. Keep that behavior when counts come from a server.
- Pass latency={0} and drive loading from your own fetch by swapping results when a query resolves.
- Photos in file results come from lib/media; replace them with real thumbnails.

## Related

- [Command palette](https://uiarc.dev/components/blocks/command-palette/markdown): A complete keyboard driven action surface with search, grouped results, and shortcuts.
- [Filter toolbar](https://uiarc.dev/components/filter-toolbar/markdown): Keep collection filters close and easy to reset.
- [Help center](https://uiarc.dev/components/blocks/help-center/markdown): A help center with instant search, topic cards, and popular articles that open into a readable article with an outline and feedback.
- [Product listing](https://uiarc.dev/components/blocks/product-listing/markdown): A storefront grid with price, color and size filters, a sort menu, hover photo swaps, and quick add with a size row.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
