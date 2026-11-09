# AI side panel

> An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-side-panel
- Markdown: https://uiarc.dev/components/blocks/ai-side-panel/markdown

- Access: Arc Pro
- Registry id: `ai-side-panel`
- Source file: `registry/blocks/ai-side-panel/ai-side-panel.tsx`
- Built from: Button, Text shimmer, Tooltip
- Keywords: ai assistant, copilot, side panel, document assistant, suggested edits, word diff, apply and undo, context chips, ask about selection, streaming, bottom sheet, claude

Pass the page as blocks (headings, labelled paragraphs, tables) and respond({ prompt, page, selection, signal }), which returns { text, change? }; text can be a string or an async iterable of deltas, and change ({ blockId, after }) shows as a diff to approve. Persist edits in onApply and onUndo. It fills its container; set --side-panel-height to embed it smaller.

## When to use

- An assistant next to a document or record that can summarize it and propose edits.
- Copilot style help where edits must be approved, applied visibly and undone.
- Asking about a selected passage or table without leaving the page.

## When not to use

- A standalone conversation; use ai-chat.
- Rewriting a passage in place with no side panel; use ai-inline-edit.
- A single prompt box; use ai-composer.
- Showing an autonomous agent's steps; use agent-run.

## Installation

AI side panel is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-side-panel
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiSidePanel } from "@/components/arc/blocks/ai-side-panel/ai-side-panel";

export function SpecPage({ spec }) {
  return (
    <AiSidePanel
      page={spec}
      respond={async ({ prompt, page, selection, signal }) => {
        const res = await fetch("/api/assistant", {
          method: "POST",
          body: JSON.stringify({ prompt, page, selection }),
          signal,
        });
        const { text, change } = await res.json(); // change: { blockId, after: PageBlock }
        return { text, change };
      }}
      onApply={(change, page) => saveSpec(page)}
      onUndo={(change, page) => saveSpec(page)}
    />
  );
}

// Stream real tokens: return text as an async iterable of deltas.
async function* deltas(stream) {
  for await (const event of stream) if (event.type === "text") yield event.text;
}
```

## API reference

### AiSidePanel

An assistant docked beside a page that reads the page and edits it. The header shows the assistant, its model mark and context chips (This page, plus a selection you send over). Answers stream in fast chunks; an answer that changes the page brings a compact word diff with Apply and Discard. Apply sweeps a soft accent tint across the changed part of the page while the new text crossfades in, and an Undo pill appears above the composer. Selecting text in the page shows an Ask about selection button that adds it as a context chip. The panel collapses to the side with no bounce while the page reflows, and becomes a bottom sheet in containers narrower than 640px.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `PanelPage` | `sample spec` | The page the assistant reads and edits: { title, meta?, blocks }. Blocks are headings, paragraphs (with a label such as "Intro") and tables (label, columns, rows). The panel keeps its own copy and reports edits through onApply and onUndo; passing a new object resets it. |
| `respond` | `(request: PanelRequest) => PanelReply \| Promise<PanelReply>` | `scripted demo` | Answers a prompt. The request has { prompt, page, selection?, signal }; abort work when signal fires (Stop). Return { text, change? }: text is a string (streamed at about 95 words a second) or an AsyncIterable<string> of deltas from your model; change is { blockId, after } and shows as a diff to approve. Throw to show the error state with Retry. |
| `onApply` | `(change: AppliedChange, page: PanelPage) => void` | – | Called after Apply with the change (blockId, after and the before block it replaced) and the page after it. Persist the page here. |
| `onUndo` | `(change: AppliedChange, page: PanelPage) => void` | – | Called after Undo with the reverted change and the restored page. |
| `defaultOpen` | `boolean` | `true` | Whether the panel starts open. |
| `suggestions` | `string[]` | `["Summarize this page", "Tighten the intro", "Add an annual price column"]` | Suggestion chips in the empty thread. Unused ones follow each finished answer. |
| `assistant` | `{ name?: string; model?: string; mark?: ReactNode }` | `{ name: "Assistant", model: "Claude Sonnet 5.5", mark: Claude mark }` | Identity shown in the panel header, the reopen button and status messages. |
| `className` | `string` | – | Class on the root. It fills its container's width and the screen's height; set --side-panel-height to fit a smaller area and --side-panel-page (default 680px) for the page column width. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the page's Ask about selection button, the reopen button, the panel header, suggestions, change actions, the Undo pill and the composer. |
| Enter | Sends the message from the composer, or activates the focused chip or button. |
| Shift + Arrow keys | With caret browsing, extends a text selection in the page; releasing Shift shows Ask about selection. |
| Escape | Closes the panel from anywhere inside it and returns focus to the reopen button. |

## Accessibility

- The panel is a labelled complementary region; the close and reopen buttons report aria-expanded and aria-controls.
- A polite status region announces each step: reading the page, answer ready (and which part a change touches), applied with undo available, undone, discarded, stopped and errors.
- After Apply focus moves to the Undo pill; after Undo it returns to the card's Apply button; after Discard it moves to the composer.
- Diffs use real ins and del elements, so removed and added words are distinguishable without color.
- Every status pairs an icon with a label (Applied to the page, Discarded, Undone, Stopped, did not respond).
- In sheet mode the page behind is inert while the sheet is open.

## Motion

- Closing the panel narrows the dock on a critically damped spring (no bounce) while the panel slides out; the page column widens and the document glides to center.
- Answers stream in chunks of 3 to 8 words every 34ms on a requestAnimationFrame clock; each chunk fades in over 150ms and settled text never re-renders.
- Apply sweeps an accent tint across the changed block once, while the old text fades out in 100ms and the new text fades in over 180ms; the block height follows on a spring with no overshoot.
- Status swaps in the change card footer, chips and the Undo pill are single opacity crossfades in a fixed size slot, so nothing shifts.
- Reduced motion keeps every state, drops the chunk fade, the slide and the sweep travel, and only fades the tint.

## Responsive behavior

- From 640px the panel docks at 360px wide beside the page; the page keeps a readable 520px measure.
- Below 640px of container width the panel becomes a bottom sheet over the page with a soft scrim and a close button.
- Chips truncate the selection label; the full selected text is in the chip's title.

## Performance

- Only the dock width (or sheet position) animates during open and close; the page reflows once per frame.
- Streaming updates one answer; earlier chunks and turns do not re-render.
- The word diff is a small LCS over one block, computed on render.

## Notes for AI

- Choose this to add an assistant to a document, spec or record page where answers should become reviewable edits.
- Return edits as data ({ blockId, after }) rather than prose so people approve each change; every applied change can be undone.
- Pass the selection to your model; it carries the block id, its label and the selected text.
- Stream with an async iterable of text deltas; the panel paces the reveal and drains bursts quickly.
- The preview's scripted responder fails the first free form question it cannot answer once, to show the error state; real responders throw to show it.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [AI inline edit](https://uiarc.dev/components/blocks/ai-inline-edit/markdown): A document you edit with AI in place: ⌘K on a selection, watch the rewrite stream in as a diff, accept each change, and Tab through ghost text.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
