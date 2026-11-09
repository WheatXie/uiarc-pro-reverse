# AI inline edit

> A document you edit with AI in place: ⌘K on a selection, watch the rewrite stream in as a diff, accept each change, and Tab through ghost text.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-inline-edit
- Markdown: https://uiarc.dev/components/blocks/ai-inline-edit/markdown

- Access: Arc Pro
- Registry id: `ai-inline-edit`
- Source file: `registry/blocks/ai-inline-edit/ai-inline-edit.tsx`
- Built from: Button
- Keywords: ai editor, inline edit, rewrite, diff, suggestions, autocomplete, ghost text, copilot, cmd k, notion ai, tab to accept, accept reject

Use this to add AI editing to a document or notes page. Pass onRequestEdit to call your model with the selection and instruction; suggestions in the preview are scripted.

## When to use

- Rewriting a selection: shorten, clarify, change tone or fix grammar in place.
- Inline autocomplete while writing documents or messages.
- Any AI suggestion that should be reviewed as a diff before it lands.

## When not to use

- Rich formatting such as headings, lists or links; the block edits plain paragraphs.
- Asking questions about a page; use ai-side-panel.
- A single prompt box without a document; use ai-composer.

## Installation

AI inline edit is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-inline-edit
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiInlineEdit } from "@/components/arc/blocks/ai-inline-edit/ai-inline-edit";

export function Notes({ doc }: { doc: EditorDocument }) {
  return (
    <AiInlineEdit
      defaultDocument={doc}
      onRequestEdit={async function* (request, signal) {
        const res = await fetch("/api/rewrite", { method: "POST", body: JSON.stringify(request), signal });
        const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) { const { value, done } = await reader.read(); if (done) return; yield value; }
      }}
      onSuggest={(request, signal) => fetch("/api/complete", { method: "POST", body: JSON.stringify(request), signal }).then(r => r.json())}
      onChange={saveDocument}
    />
  );
}
```

## API reference

### AiInlineEdit

A document you edit with AI in place. Select text and a small Edit bubble appears; Cmd or Ctrl + K opens a compact prompt anchored under the selection with quick actions and a free instruction. The rewrite streams in as an inline word diff: deletions strike through as the stream passes them, insertions develop in highlighted, and text the model has not reached yet waits dimmed. Review each change from its own mini toolbar or all at once, then undo. At the end of a paragraph, ghost text suggests how to continue and Tab accepts it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultDocument` | `EditorDocument` | `sample launch plan` | Title and plain text paragraphs to start from. |
| `onRequestEdit` | `(request: EditRequest, signal: AbortSignal) => AsyncIterable<string> \| Promise<string>` | `scriptedEdit` | Returns replacement text for the selection as streamed deltas or one string. The request carries the text, instruction, quick action id, surrounding text and paragraph index. Stop aborts signal. |
| `onSuggest` | `(request: CompletionRequest, signal: AbortSignal) => Promise<string \| null>` | `scriptedCompletion` | Returns ghost text to continue a paragraph from the caret, or null. Called after a short pause with the caret at the end of a paragraph; typing or moving on aborts it. |
| `actions` | `QuickAction[]` | `Shorten, Make clearer, Friendlier tone, More formal, Fix grammar` | Quick actions in the prompt, each with an id, label and the instruction it sends. |
| `onChange` | `(document: EditorDocument) => void` | – | Called after typing settles, an edit is applied, a completion is accepted, or undo and redo move. |
| `author` | `{ name: string; photo: string }` | `Chloe Nguyen` | The person shown in the header. The preview uses a local portrait from public/media/people. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Cmd/Ctrl + K | Opens the prompt on the selection, grown to whole words. With no selection it takes the sentence around the caret. Pressing it again closes the prompt. |
| Arrow Up / Arrow Down, Enter | In the prompt, move through the quick actions and run one. With text typed, the first option sends it as a free instruction. |
| Escape | Closes the prompt and restores the selection, stops a streaming edit, rejects all changes in review, or dismisses ghost text. |
| Tab | Accepts ghost text at the caret. In review, moves between changes. |
| Enter / Backspace | On a focused change, accepts or rejects it and moves to the next one. |
| Cmd/Ctrl + Enter | Accepts all remaining changes. |
| Cmd/Ctrl + Z, Shift + Cmd/Ctrl + Z | Undo and redo AI edits when focus is outside the text; while typing, the browser's own undo applies. |
| Enter, Backspace at a paragraph start | Split a paragraph at the caret, or join it with the one above. |

## Accessibility

- The editor is a labelled region; each paragraph is a native contenteditable, so caret movement, selection and screen reader editing work as usual.
- The prompt is a labelled dialog with a combobox input and a listbox of actions using aria-activedescendant.
- Each change in review is a focusable group named with what it does, such as Change "very careful" to "carefully", with Enter and Backspace to decide.
- Ghost text is aria-hidden and never part of the paragraph's text; the footer names the keys to accept or dismiss it.
- Streaming, review and applied states are announced with role status; failures use role alert with Try again. Deletions and insertions pair color with strike through and highlight.
- The block claims Cmd/Ctrl + K only while focus is inside it, so an app wide command menu still works elsewhere.

## Motion

- One floating layer carries the whole edit: it opens under the selection, morphs its size on the smooth spring from prompt to a Stop status bar to the review bar to an Applied receipt, and follows the diff as it grows.
- The rewrite is paced like any stream: buffered, drained on a frame loop that tracks the arrival rate, snapped to whole words. Inserted words develop in with opacity and a small blur that clears; deleted words have their strike drawn across as the stream passes them.
- While streaming, a short word matched far ahead is not trusted yet, so the diff only grows at the stream edge and never flickers between alignments.
- The active quick action is marked by a highlight that slides between rows on the snappy spring. Hunk toolbars fade up on hover or focus; a decided change settles with a brief tint.
- Accepted ghost text glows for a moment using the CSS highlight API, without touching the text.
- Reduced motion shows diffs, ghost text and the layer without fades, sweeps or morphs.

## Responsive behavior

- The page column stays at a comfortable reading width and tightens its gutters below 560px container width, where the title steps down.
- The prompt keeps to 320px or the page width, whichever is smaller, and is clamped inside the page; review bars wrap onto two lines when narrow.
- On touch, selecting text shows the Edit bubble, which opens the same prompt.

## Performance

- Paragraphs are uncontrolled contenteditables that render once, so typing never re-renders them and the caret never jumps.
- The word diff is a small dynamic program over the selection, recomputed only when the revealed suggestion moves by a word.
- Ghost text is a single non editable span appended at the caret; nothing else in the paragraph is touched.

## Notes for AI

- Choose this to add AI rewriting and autocomplete to a notes, docs or email editor where people must stay in control of every change.
- Return only the replacement for the selected text, not the whole paragraph; the block diffs it word by word against the selection.
- Stream deltas when you can; stopping keeps the words already shown as reviewable changes and leaves the rest of the original untouched.
- Keep completions short, one clause or sentence, and return null when unsure; they only appear with the caret at the end of a paragraph.
- An edit applies to one paragraph; a selection that spans paragraphs is clamped to the first one.

## Related

- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Rich text editor](https://uiarc.dev/components/rich-text-editor/markdown): A lightweight editor with markdown shortcuts, a floating toolbar, a slash menu, and HTML and markdown output.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
