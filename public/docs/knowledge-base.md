# Knowledge base

> A retrieval knowledge base in one card: add sources and watch them parse, chunk, embed and index, then test a question and see which chunks come back and why.

- Type: Block
- Page: https://uiarc.dev/components/blocks/knowledge-base
- Markdown: https://uiarc.dev/components/blocks/knowledge-base/markdown

- Access: Arc Pro
- Registry id: `knowledge-base`
- Source file: `registry/blocks/knowledge-base/knowledge-base.tsx`
- Built from: Button, Copy button, Dropdown menu, Popover, Segmented control, Select, Slider, Switch, Text shimmer
- Keywords: knowledge base, rag, retrieval, vector store, embeddings, chunking, ingestion, reranking, reranker, hybrid search, semantic search, document indexing, top k, similarity score, retrieval test, ai search

Pass sources, onAdd and search to connect your ingestion and retrieval; with no props it ingests sample sources and answers test queries.

## When to use

- Admin screens for a RAG or support assistant where people add documents, watch them index, and check what a question retrieves.
- Explaining or tuning chunking, hybrid search and reranking with a working test bench instead of a diagram.
- Debugging why an assistant answered from the wrong source by looking at scores, matches and neighbouring chunks.

## When not to use

- Use vector-search to illustrate how embeddings and nearest neighbours work; this block is the working product surface.
- Use document-extract to pull structured fields out of a single document.
- Use agent-memory to show what an agent remembers about a user or a project.
- Use ai-answer or research-run to show the cited answer a model writes from retrieved sources.

## Installation

Knowledge base is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/knowledge-base
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { KnowledgeBase } from "@/components/arc/blocks/knowledge-base/knowledge-base";

export function SupportKnowledge({ sources, upload, retry }) {
  return (
    <KnowledgeBase
      title="Support knowledge base"
      sources={sources}
      onAddSource={({ kind, file }) => upload(kind, file)}
      onRetrySource={retry}
      onQuery={async (query, settings) => {
        const res = await fetch("/api/retrieve", { method: "POST", body: JSON.stringify({ query, ...settings, candidates: 20 }) });
        if (!res.ok) throw new Error("The retriever did not respond");
        return res.json(); // [{ id, sourceId, text, location, similarity, relevance, before, after }]
      }}
    />
  );
}

// With no props the card runs a full simulation with sample documents.
<KnowledgeBase />
```

## API reference

### KnowledgeBase

A retrieval knowledge base in one card. The Sources view lists PDFs, Notion pages, Google Drive docs and website crawls, each with a four step ingestion pipeline (parse, chunk, embed, index) that fills as it runs while page, chunk and token counts climb. Add source and a drop zone bring in new sources that ingest live; a failed source names its reason and offers Retry. The Test retrieval view runs a query and lists the top k chunks with similarity bars and scores, highlighted matching words, the source and page. Turning on Rerank reorders the same results in place and shows how far each chunk moved, and opening a result shows the chunk between its neighbours. A settings popover holds chunk size, overlap, top k, hybrid search, reranking and the embedding model, and asks for a re-index when chunking changes.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Support knowledge base"` | Heading at the top of the card. |
| `sources` | `KnowledgeSource[]` | – | Live sources: { id, name, kind ("pdf" \| "notion" \| "drive" \| "web" \| "file"), pages, chunks, tokens, status, progress?, failedStep?, error?, note? }. status is "queued", "parse", "chunk", "embed", "index", "indexed" or "failed"; progress is 0 to 1 within the current step. Omit to run the built-in simulation with sample company documents. |
| `chunks` | `KnowledgeChunk[]` | – | Chunks the built-in retriever searches when onQuery is not set: { id, sourceId, index, location, text, overview? }. index orders chunks inside a source so neighbours can be shown. Defaults to the sample corpus in the simulation. |
| `settings` | `RetrievalSettings` | – | Controlled settings: { chunkSize, overlap, topK, hybrid, rerank, embeddingModel }. Pair with onSettingsChange. |
| `defaultSettings` | `Partial<RetrievalSettings>` | `{ chunkSize: 512, overlap: 64, topK: 4, hybrid: true, rerank: false, embeddingModel: "general-v2" }` | Starting settings when uncontrolled. |
| `onSettingsChange` | `(settings: RetrievalSettings) => void` | – | Called on every settings change, including the Rerank switch above the results. Overlap is clamped to half the chunk size. |
| `embeddingModels` | `{ value: string; label: string }[]` | `four generic sample models` | Options for the embedding model select. The text before the first comma also shows in the card summary. |
| `suggestions` | `string[]` | – | Questions offered before the first search. Defaults to sample questions for sources that are indexed, so a new suggestion appears when its source finishes. |
| `onQuery` | `(query: string, settings: RetrievalSettings) => Promise<RetrievedChunk[]> \| RetrievedChunk[]` | – | Runs a retrieval test. Return candidates ({ id, sourceId, text, location?, similarity, relevance?, before?, after? }), ideally more than top k so the reranker can pull one up. The card orders by similarity, or by relevance while Rerank is on, and slices to top k. Throw to show the error state. |
| `onAddSource` | `(request: { kind: SourceKind; file?: File }) => void` | – | Called by the Add source menu and for dropped or picked files. In the simulation the card also adds a sample source of that kind and ingests it. |
| `onRetrySource` | `(id: string) => void` | – | Called by Retry on a failed source. The simulation resumes from the failed step. |
| `onRemoveSource` | `(id: string) => void` | – | Called by Remove on a source that cannot be retried, such as an unsupported file type. |
| `onReindex` | `(settings: RetrievalSettings) => void` | – | Called by Re-index after chunk size, overlap or the embedding model changed. Search keeps using the current index until each source finishes. |
| `defaultView` | `"sources" \| "retrieval"` | `"sources"` | The view shown first. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through settings, Add source, the view switch, each Retry or Remove button and browse in Sources; and through the query field, Search, the Rerank switch and each result in Test retrieval. |
| Arrow left / Arrow right | On the view switch, moves between Sources and Test retrieval. On a settings slider, changes the value by one step; Shift moves a larger step. |
| Enter | In the query field, runs the search. On a suggestion, runs that question. On a result, opens or closes the chunk in context. |
| Escape | In the query field, clears the query and returns to suggestions. In the settings popover or the Add source menu, closes it and returns focus to its trigger. |
| Space | Toggles the Rerank, Hybrid search and Reranking switches and activates buttons. |

## Accessibility

- The card is a labelled section. Each pipeline is a progressbar with the overall percent and a value text that names the step, such as Embed, step 3 of 4, or Failed at embed.
- Status never relies on color: indexed rows show a check with a label, failed rows an alert icon with the reason in text, and working rows a named step and a percent.
- Each result is a button with aria-expanded and aria-controls; its similarity or reranker score and any rank change (for example, Up 2 after reranking, was 3) are in its accessible name.
- Matching words are wrapped in mark elements, so assistive technology can report highlighted text.
- Ingestion milestones, failures, search results, reranking and simulated actions are announced through one polite status region; simulated uploads say that files stay in the browser.
- Icon-only controls (settings, clear query) have specific names. The settings toggles are full labels, so the text toggles the switch too.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Turning on Rerank shows a short reranking state, then moves each result to its new rank with a critically damped layout animation (no bounce) while score bars and numbers roll to the reranker's values and a rank change fades in.
- Opening a result springs its height open: the previous chunk slides in above, the excerpt grows from two lines to the full chunk, and the next chunk slides in below, all on the smooth spring.
- Pipeline segments fill from a single animation-frame clock while counts climb; the meta line crossfades when a step changes. Active labels use a finite text shimmer that settles when the step ends.
- New sources open in at the top of the list on a height spring; removed ones close their gap. Views crossfade without moving.
- Reduced motion places results, heights and values immediately, stops the spinner and the skeleton pulse, and keeps every label and announcement.

## Responsive behavior

- The card is container aware: from about 720px down to 320px it keeps one column, with no horizontal scroll.
- Below 560px the pipeline moves under each source name at full width, step labels drop, the page or path beside a result shortens, and the chunk-in-context rail moves inline.
- Below 440px the gutters tighten, the header actions wrap under the title, meta lines wrap instead of truncating, and the indexing summary beside the view switch hides.
- Long source names truncate with the full name in a title; failure reasons always wrap so they stay readable.

## Performance

- The simulation advances all sources from one requestAnimationFrame loop that only runs while something is queued or working.
- Scores and counts roll through motion values without React re-renders; excerpt heights are measured once with a ResizeObserver and only re-measured when their width changes.
- The local retriever scores a few dozen chunks with plain string matching; real deployments pass onQuery and skip it.

## Notes for AI

- Pass sources from your ingestion job and update status and progress as events arrive; the card only renders them when sources is set. Leave sources unset for a self-running demo.
- Return more candidates than top k from onQuery (for example 20) with both similarity and relevance. That is what lets the reranker pull a chunk up from below the cut, which is the point of the comparison.
- Scores are expected between 0 and 1. Map cosine similarity or a reranker logit into that range before returning it.
- Give each result before and after neighbours (or index plus a chunks prop) so opening a result can show it in context.
- location is free text: a page such as "p. 3" for documents, a heading for Notion, or a path for a crawled site.
- The embedding model labels are generic placeholders. Replace them with the models your stack actually uses.

## Related

- [Vector search](https://uiarc.dev/components/vector-search/markdown): Documents drop onto a tilted embedding plane and fold into points that cluster by topic; the index links neighbours, a query is typed, embedded and lowered onto the plane, a signal hops along the graph toward it, and a widening ring lights the nearest documents with connecting lines, similarity scores and a ranked list.
- [Document extraction](https://uiarc.dev/components/blocks/document-extract/markdown): Turns a document into typed data with a model and shows where every value came from: fields fill in as the page is read, and hovering a value lights its source on the PDF.
- [Agent memory](https://uiarc.dev/components/blocks/agent-memory/markdown): One card for what an assistant remembers about you: filter and search memories, edit or forget one in place, and turn saved memories and chat history on or off.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [MCP servers](https://uiarc.dev/components/blocks/mcp-servers/markdown): Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
