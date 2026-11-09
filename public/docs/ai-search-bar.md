# AI search bar

> A search card for an app or docs, where typing lists grouped results right away (Docs, Customers, Issues) and pressing Tab streams a short AI answer on top. The answer's numbered citations point to the results below it.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-search-bar
- Markdown: https://uiarc.dev/components/blocks/ai-search-bar/markdown

- Access: Arc Pro
- Registry id: `ai-search-bar`
- Source file: `registry/blocks/ai-search-bar/ai-search-bar.tsx`
- Built from: Kbd, TextShimmer
- Keywords: ai search, search bar, ask ai, command palette, docs search, instant search, grouped results, keyboard navigation, citations, streaming answer, algolia ask ai, mintlify search, linear search, combobox, rag

Pass `search(query, signal)` so it returns `AiSearchResult[]` (each with id, group, title, description, meta, icon or issue status), either directly or as a promise. Pass `answer({ query, results, signal })` as an async iterable: first yield `{ type: "sources", ids }`, then `{ type: "text", text }` pieces, where [n] cites ids[n - 1] and backticks render as inline code. To show the error state with Try again, throw. Wire `onSelect` to open a result and `onAsk` for analytics. Set `groups`, `recent`, `suggestions` and `model` to match your product. If you pass neither `search` nor `answer`, the card plays a scripted demo until someone touches it.

## When to use

- A product or docs search where people mix finding a page or record with asking a question.
- Support and success tools that search docs, customers and tickets in one place.
- A command bar or search dialog that should offer an AI answer without leaving the results.

## When not to use

- Use ai-answer for a full answer page with long formatted answers, follow ups and feedback.
- Use ai-chat for a back and forth conversation.
- Use ai-command for an action palette that runs commands rather than searches content.

## Installation

AI search bar is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-search-bar
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiSearchBar, type AiSearchAnswerEvent } from "@/components/arc/blocks/ai-search-bar/ai-search-bar";

async function search(query: string, signal: AbortSignal) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  return response.json(); // [{ id, group: "docs", title, description, meta }]
}

async function* answer({ query, results, signal }) {
  const response = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ query, ids: results.map(r => r.id) }), signal });
  if (!response.ok) throw new Error("The assistant is busy. Try again in a moment.");
  for await (const event of readNdjson<AiSearchAnswerEvent>(response.body!)) yield event;
}

export function AppSearch() {
  return (
    <AiSearchBar
      search={search}
      answer={answer}
      recent={recentSearches}
      suggestions={["How do I set up SAML SSO?", "How do I rotate an API key safely?"]}
      onSelect={result => router.push(result.href!)}
      onAsk={query => track("search_ask_ai", { query })}
    />
  );
}
```

## API reference

### AiSearchBar

One search card for an app or docs. Typing lists grouped results at once (Docs, Customers, Issues from Linear) with the matched words highlighted, and the arrow keys move through them. The first row is "Ask AI about ...": press Tab or click it and a short answer streams in its place, with numbered citations that match small number badges on the results below; hovering or focusing a citation lights its result, and clicking it jumps there. With an empty field it shows recent searches and suggested questions. The field, a fixed height body and a footer with key hints and the model never change size between states. With no props it plays a short scripted search and answer until touched.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `search` | `(query: string, signal: AbortSignal) => AiSearchResult[] \| Promise<AiSearchResult[]>` | – | Returns results for a query. Sync results show in the same frame; a promise keeps the previous list and swaps the search icon for a spinner until it resolves. Stop when `signal` aborts. Each result is { id, group, title, description?, meta?, icon?, status?, href? }. Defaults to a sample search over a developer platform's docs, customers and issues. |
| `answer` | `(request: AiSearchAnswerRequest) => AsyncIterable<AiSearchAnswerEvent>` | – | Streams the AI answer. The request has { query, results, signal } with the results on screen. Yield { type: "sources", ids } first, then { type: "text", text } pieces; [n] in the text cites ids[n - 1] and `code` spans render as inline code. Throw to show the error state with Try again. Defaults to a scripted demo that sends nothing. |
| `groups` | `AiSearchGroup[]` | `Docs, Customers, Issues` | Sections in order: { id, label, icon?, source? }. `icon` is the default 16px icon for results without one; `source` ({ name, mark? }) shows where a group comes from on the right of its heading. Results with an unknown group go under Other. |
| `recent` | `string[]` | `["webhook retries", "Figma", "AUTH-912"]` | Recent searches shown when the field is empty. Picking one fills the field. New searches and opened results are added for the session, three at most. |
| `suggestions` | `string[]` | – | Suggested questions shown when the field is empty. Picking one asks AI right away. The demo offers three. |
| `model` | `{ name: string; mark?: ReactNode }` | `Claude Sonnet 5.5` | The model named in the footer and on the answer, with its mark. |
| `placeholder` | `string` | `"Search docs, customers and issues"` | Placeholder in the empty field. |
| `autoPlay` | `boolean` | `true without search or answer` | Plays a scripted search, Tab and answer, then a suggested question, while on screen. Any pointer, key or focus inside the card stops it for good. Plays once with reduced motion. |
| `onSelect` | `(result: AiSearchResult) => void` | – | Called when a result is opened with Enter or a click. Without it the footer confirms the open and the status says it was simulated. |
| `onAsk` | `(query: string) => void` | – | Called when AI is asked, just before the answer streams. |
| `className` | `string` | – | Class on the card. It is 100% wide up to 640px. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow down / Arrow up | Moves through Ask AI and the results, or through recent searches and suggestions when the field is empty. Wraps at both ends and keeps the active row in view. |
| Enter | Opens the active result, fills the field with a recent search, asks a suggested question, or asks AI from the Ask AI row. |
| Tab | With text in the field and no answer yet, asks AI about it. Otherwise moves focus as usual: clear, copy and close on the answer, then each citation. |
| Escape | Closes the answer first, then clears the field. |
| Enter, Space | On a citation, jumps to its result and makes it active. |

## Accessibility

- The field is a combobox with aria-activedescendant, so focus stays in the field while the arrow keys move the active option. Results sit in a listbox with one labelled group per section; the Ask AI row is its own small listbox, and aria-controls names both.
- Each option has a full label: title, description, meta or issue status, and "cited as source n" once the answer cites it. The number badges are aria-hidden because the label carries them.
- The answer is a labelled region with aria-busy while it streams. A polite status region announces Asking AI, Answer ready with the source count, Answer closed, results opened and errors, and says Simulated when the demo stands in for a real model or link.
- Citations are buttons named "Source n: title"; focus lights the matching result just like hover. Highlights in titles are a visual aid only.
- Issue status is an icon plus a text label, never color alone. The error state shows an icon, the message and a Try again button.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Results update in the same frame as each keystroke with no animation, like a native search; the active row's background changes in 80ms.
- Switching between the empty view and results crossfades (out 100ms, in 160ms). The body has a fixed height, so the card never resizes.
- Asking AI crossfades the Ask AI row into the answer panel while the slot's height follows its content on a 240ms spring with no bounce.
- The status shimmers "Thinking" for about half a second, then "Writing", then settles to "4 sources". The answer streams on a requestAnimationFrame clock: every 34ms three to eight words commit together and fade in over 140ms, with no blur, travel or stagger.
- Number badges fade in on results as their citations arrive. Copy swaps its icon for a check in place.
- Reduced motion keeps the chunked arrival and every state but drops the fades, shimmer, pulse and the auto play loop.

## Responsive behavior

- The card is 100% wide up to 640px. Below about 520px the footer keeps only the Ask AI hint and the model, and below about 400px result descriptions hide so titles keep their room.
- Titles truncate after descriptions, which truncate first; meta stays right aligned in tabular numerals.
- The field uses 16px text so phones do not zoom on focus.

## Performance

- Streamed text is split into stable units, so each tick only appends a new span and earlier text never re-renders.
- One requestAnimationFrame loop runs only while an answer streams, and an aborted ask or a new query stops it and the request at once.
- Auto play pauses while the card is off screen or the tab is hidden.

## Notes for AI

- Choose it for in-app or docs search that should answer questions as well as find things: a support console, an admin app, a docs site, an internal knowledge base.
- Send `sources` before the text so badges can appear as citations stream. Cite only results the request carried; a cited id that is not on screen still shows its number but has nothing to jump to.
- Keep answers to two to four sentences; this is a search, not a chat. Link out to a full answer page (ai-answer) for longer replies.
- Results are grouped by `group` in the order of `groups`; return at most three to five per group so the answer and every section fit in the body.
- Brand marks and ARR figures are sample content. Pass your own `icon` per result; keep color brands in their colors and mono marks on currentColor.

## Related

- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [AI command](https://uiarc.dev/components/ai-command/markdown): A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
