# Research run

> Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.

- Type: Block
- Page: https://uiarc.dev/components/blocks/research-run
- Markdown: https://uiarc.dev/components/blocks/research-run/markdown

- Access: Arc Pro
- Registry id: `research-run`
- Source file: `registry/blocks/research-run/research-run.tsx`
- Built from: Button
- Keywords: deep research, answer engine, citations, sources, streaming, perplexity, search, llm, ai answer, follow up, research agent

Use this to show an AI research or search answer. Replace the scripted run in research-run-data.ts with events from your search and model pipeline.

## When to use

- An answer engine or deep research feature that searches, reads and cites.
- Internal knowledge search where people must verify each claim.
- Any long streamed answer that benefits from visible sources and follow ups.

## When not to use

- Open ended conversation without sources; use ai-chat.
- An agent that edits files or runs tools; use agent-run.
- A single answer with sources inside another page; use ai-answer.

## Installation

Research run is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/research-run
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ResearchRun, type ResearchEvent } from "@/components/arc/blocks/research-run/research-run";

export function Research() {
  return (
    <ResearchRun
      autoStart={false}
      onAsk={async function* (question, history, signal) {
        const res = await fetch("/api/research", { method: "POST", body: JSON.stringify({ question, history }), signal });
        // Your server streams newline delimited ResearchEvent JSON.
        for await (const event of readJsonLines<ResearchEvent>(res.body!)) yield event;
      }}
    />
  );
}
```

## API reference

### ResearchRun

A deep research surface. The question is planned into sub-queries that search in parallel, sources gather in a rail with their real marks and a ring that fills while each one is read, and the steps fold into one line such as Researched for 7s, 12 sources. The answer then streams in word by word with citation chips: hovering a chip lights the sentence it supports and its source, clicking one brings the source into view. Follow ups append a new turn; any run can be stopped, rerun and copied with its sources.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | `sample question` | The first question. It runs on mount when autoStart is on. |
| `autoStart` | `boolean` | `true` | Starts the first question on mount. Off opens on an empty state with suggestions. |
| `onAsk` | `(question: string, history: ResearchTurn[], signal: AbortSignal) => AsyncIterable<ResearchEvent>` | `scriptedResearch` | Runs one turn and yields plan, search, searched, source, read, text, followUps and done events as they happen. Stop aborts signal. `[n]` in text cites the nth source event of the turn. |
| `suggestions` | `string[]` | `three questions` | Questions offered in the empty state. |
| `pace` | `number` | `70` | Reveal pace in characters per second before the arrival rate is known; after that the reveal follows the stream. |
| `onComplete` | `(turn: ResearchTurn) => void` | – | Called when a turn finishes, with its question and answer markdown. |
| `title` | `string` | – | Header title. Defaults to the first question, shown once it scrolls under the header. |
| `className` | `string` | – | Class on the root element. |

### ResearchSource

A source event's payload: id, title, domain, url, and optional logo (URL of a monochrome mark drawn in the text color; the domain's first letter stands in without one), snippet and date.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | Sends the question in the composer; Shift + Enter adds a line. |
| Escape | Stops the running research from the composer. |
| Tab | Moves through the steps toggle, citation chips, actions, follow ups and source rows. A focused chip lights its sentence and source like hover. |
| Enter / Space | On a chip, brings its source into view and flashes it; on a source row, opens its summary and link. |
| Arrow Up / Page Up / Home | Inside the thread, releases the pin to the newest line, like scrolling up. |

## Accessibility

- The block is a labelled region; each turn is an article named by its question, and the sources rail is a labelled complementary region.
- The answer is marked aria-busy while it streams; a polite live region announces once when it is ready or stopped, with the source count, instead of every word.
- Citation chips are buttons named with the source number and title. Reading progress is exposed as text on each source number, such as Reading, 60 percent.
- The steps toggle and source rows report aria-expanded; collapsed panels are inert.
- Copy, Stop and Rerun keep their width while their labels change, and state never relies on color alone.

## Motion

- Streamed text is buffered and drained on a requestAnimationFrame loop at a rate that follows the measured arrival rate, scaled by how full the buffer is and eased so bursts bend the pace instead of kinking it. Reveal snaps to whole words.
- Each commit becomes its own chunk span that develops in once, opacity with a 1.5px blur that clears, and never renders again, so earlier lines never re-split or replay. Lists, headings and chips appear already formatted; a half received citation or marker waits for its first word.
- Before the first word a quiet shimmer reads Writing the answer in the exact place the first line lands. A small dot appears at the end only when the stream stalls, and leaves with the last word.
- The thread eases toward the newest line while you are at the bottom. Scrolling up releases it and a Jump to latest pill springs in above the composer.
- Sub-queries stagger in, their spinners turn into checks on the snappy spring, and source marks pop into each query row. Source rows open with a height spring; the research steps collapse on the smooth spring as the answer starts.
- The action row is reserved from the start: Stop and a live word count cross fade into Copy, Rerun and the time and token readout, so nothing below moves.
- Reduced motion reveals whole word chunks without fades or blur, stops shimmer and spinners, and snaps panels and scrolling.

## Responsive behavior

- From 880px container width the sources sit in their own scrolling rail beside the thread. Below that they fold into a strip of marks under the question that opens into the list, so the streaming text stays the last thing on screen.
- Below 520px sub-query rows drop their counts and marks, the question steps down a size, and gutters tighten.
- Layout follows the block's container, not the viewport.

## Performance

- Only the chunk being revealed renders; earlier chunks are memoized, so long answers stay cheap. Hover state reaches chips and sentences through one small style rule instead of re-rendering the answer.
- The pacing loop runs only while buffered text remains and commits to React only when the word boundary moves.
- Source marks are CSS masks over small SVGs, tinted by the text color.

## Notes for AI

- Choose this for search or deep research answers where people need to see what was read and check claims against sources.
- Emit sources before the text that cites them, numbered in arrival order, and send `[n]` right after the sentence it supports; the block attaches each chip to that sentence.
- Keep the answer to the supported markdown subset: paragraphs, ### headings, - and 1. lists, **bold**, `code`, fenced code and [n] citations.
- Stop keeps exactly the words already on screen and drops the buffered rest; rerun replaces the last turn in place.
- Pass a logo URL per source for a monochrome mark; brand marks in the preview are sample content from Simple Icons, not endorsements.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
