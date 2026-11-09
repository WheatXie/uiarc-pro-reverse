# AI composer

> The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-composer
- Markdown: https://uiarc.dev/components/blocks/ai-composer/markdown

- Access: Arc Pro
- Registry id: `ai-composer`
- Source file: `registry/blocks/ai-composer/ai-composer.tsx`
- Built from: Tooltip, Text shimmer, Copy button, Dropdown menu
- Keywords: ai composer, chat input, prompt box, chat composer, message input, send button, stop generating, attachments, file upload, slash commands, mentions, model picker, effort, dictation, streaming, claude, assistant

Pass onSend(message, { signal }) and return an async iterable of text deltas; the block handles the fast streamed reveal, Stop (it aborts the signal), Retry and the progress ring. The message carries the text, mention and command tokens, attachments with their File, model, effort, webSearch and thinking. Without onSend it plays simulated replies; greeting, suggestions, models, placeholder and maxLength customize it.

## When to use

- The prompt box of an assistant, a coding agent or an in-product AI feature where people attach files, mention docs and pick a model.
- A new chat screen that should open on a greeting and suggestions, then show the first exchange.
- Any place that needs a streaming send and stop control with honest progress and keyboard first commands.

## When not to use

- Use ai-chat for a full conversation with history, message actions and a sidebar of chats.
- Use ai-inline-edit to rewrite a selection inside a document instead of chatting about it.
- Use voice-agent when speech is the main input and the reply is spoken.
- Use model-picker when the job is comparing and choosing models rather than sending a prompt.

## Installation

AI composer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-composer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiComposer, type ComposerMessage } from "@/components/arc/blocks/ai-composer/ai-composer";

async function* streamReply(message: ComposerMessage, signal: AbortSignal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ text: message.text, model: message.model, effort: message.effort, webSearch: message.webSearch, thinking: message.thinking }),
    signal,
  });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    yield value;
  }
}

export function Assistant() {
  return <AiComposer greeting="How can I help with checkout?" onSend={(message, { signal }) => streamReply(message, signal)} />;
}
```

## API reference

### AiComposer

The prompt box at the bottom of an AI app, shown on a minimal chat stage. One rounded surface holds an autosizing textarea and a toolbar: a plus menu to upload files or add them from Google Drive, GitHub or a screenshot, Web search and Extended thinking toggles, a model chip with the model's mark that opens five current models and an effort row, a dictation mic, and the send button. The send button is muted until there is something to send, shows an arrow when ready, and morphs into a stop square ringed by the reply's progress while it streams. Attachments upload in place with a progress ring that resolves into a check, long pastes become a pasted text chip, / opens commands and @ inserts a mention token. The empty state shows a greeting and three suggestions; sending lifts the message into a bubble and streams the reply below it.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSend` | `(message: ComposerMessage, options: { signal: AbortSignal }) => void \| Promise<void> \| AsyncIterable<string>` | – | Called with every sent message: { text, tokens, attachments, files, model, effort, webSearch, thinking }. Return an async iterable of text deltas to stream a real reply into the thread; Stop aborts `signal`. Return nothing and the preview plays a simulated reply and says so in its status region. |
| `greeting` | `string` | `"What should we work on?"` | Display heading of the new chat state, set in Geist. |
| `suggestions` | `Suggestion[]` | `sampleSuggestions` | Up to three starters under the composer, each { id, label, prompt, icon? } with icon "summary", "draft" or "bug". Choosing one fills the composer with its prompt; known commands and mentions in the prompt become tokens. |
| `models` | `ComposerModel[]` | `sampleModels` | Models in the model menu, each { id, name, short, note, mark, defaultEffort } with mark "claude", "openai" or "gemini". The chip shows `short`; the menu shows `name` and `note`. |
| `defaultModel` | `string` | – | Id of the model selected at first. Defaults to the first model, Claude Opus 5.5 in the sample. |
| `placeholder` | `string` | `"Ask anything, / for commands, @ to add context"` | Placeholder of the empty textarea. |
| `maxLength` | `number` | `4000` | Character limit. A ring counter appears at 80 percent, turns to the warning color at 95 percent, and sending stops above the limit. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | Sends the message. With the command or mention list open, inserts the highlighted option instead. |
| Shift + Enter | Adds a new line. The field grows to about eight lines, then scrolls. |
| / | At the start of a line, opens the command list: /summarize, /translate, /explain and /fix. |
| @ | After a space or at the start, opens the files and docs list. The choice is inserted as one atomic token. |
| Arrow up / Arrow down | Moves through the command or mention list while it is open; the textarea keeps focus. |
| Tab | Inserts the highlighted command or mention while the list is open; otherwise moves through the toolbar controls. |
| Escape | Closes the command or mention list, cancels dictation, or stops a running reply, in that order. |
| Backspace / Delete | Next to a token, removes the whole token at once. Arrow keys hop over a token instead of entering it. |
| Arrow left / Arrow right | In the model menu, moves along the effort row. Up and down move through the models. |

## Accessibility

- The textarea is labeled Message and described by a hidden hint for Enter, Shift Enter, / and @. While a list is open it points at it with aria-controls and aria-activedescendant, and the list is a listbox of options grouped into Files and Docs.
- Tokens are drawn by a mirror under a transparent textarea, so the field stays a real textarea for screen readers, spellcheck, undo and IME input.
- The send button changes its accessible name with its state: Send message, Send after uploads finish, Send with the message over the limit, and Stop generating. It stays focusable while it cannot send and reports aria-disabled.
- Web search, Extended thinking and the mic are toggle buttons with aria-pressed; on state also shows in the accent fill and a tooltip, never color alone.
- Attachment chips name their remove control after the file, and a running upload's control reads Cancel upload. A failed file shows an icon and a short reason.
- A polite status region reports what happened: uploads finished, a long paste added as an attachment, the model and effort chosen, sent with a simulated reply, reply finished or stopped, and that dictation and the Drive, GitHub and screenshot actions are simulated.
- Menus come from Radix with focus moved in and returned on close; after picking an attach action focus returns to the textarea.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- The send arrow lifts out and a stop square scales in on the morph spring; a thin accent arc around the button fills with the reply, then fades as the button turns back into an arrow the moment the stream ends.
- Replies stream in chunks of whole words every 34ms on an animation frame clock, about 80 words a second, with catch-up when a live stream runs ahead. Each new chunk only fades in over 160ms; settled text is static, and the reply grows line by line on a short ease-out.
- A short Thinking shimmer covers the moment before the first token; with Extended thinking or Web search on, those steps shimmer instead and settle into Thought for 1s or Searched 6 sites.
- The sent message lifts into its bubble on the snappy spring while the composer glides from the center to the bottom on the smooth spring.
- Attachment chips scale in, their ring fills with the upload, and a check pops in before handing over to the remove control. The model chip springs to the width of its new label.
- Reduced motion keeps every state and announcement but drops travel: chunks appear without a fade, the waveform holds still, the ring does not spin, and panels change at once.

## Responsive behavior

- The block is a container: below 680px the tool chips fold into icon buttons with tooltips, below 560px the effort label leaves the model chip, and below 400px the model chip keeps only its mark and the counter keeps only its ring.
- At 320px every control stays in one toolbar row, attachment chips scroll sideways in their own row, and suggestions stack to full width.
- The command and mention list sits above the line being typed and stays inside the composer's width.

## Performance

- The reveal clock runs on requestAnimationFrame only while a reply is writing and skips renders when nothing changed; older chunks merge into one text node so the DOM stays small for long replies.
- The field height follows the mirror through a ResizeObserver instead of measuring scrollHeight on every keystroke.
- The dictation waveform writes bar transforms directly on animation frames without re-rendering React.
- Object URLs for image thumbnails are revoked when a chip is removed or the block unmounts.

## Notes for AI

- Wire `onSend` to your model endpoint and return an async iterable of text deltas; the block handles the reveal clock, Stop (through the AbortSignal), Retry and the progress ring. Throwing inside the iterable shows an error line under the reply.
- The message carries `tokens` (the commands and mentions in the text) and `attachments` (with the real File for picked, dropped or pasted files, and the pasted text for pasted chips), so the server can resolve context without parsing the text.
- Uploads, Google Drive, GitHub, screenshots and dictation are simulated in the preview. Replace the actions in composer.tsx with your own upload and picker calls; the chip model (status uploading, done, ready or error with progress) stays the same.
- Use only current models in `models`. The sample lists Claude Opus 5.5, Sonnet 5.5, Haiku 5.5, GPT-6.1 Sol and Gemini 4 Argon with their real marks.
- Keep the stage minimal. For a full thread with history, branching and message actions, use ai-chat and reuse this composer inside it.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
