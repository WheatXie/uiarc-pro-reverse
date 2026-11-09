# AI answer

> One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-answer
- Markdown: https://uiarc.dev/components/blocks/ai-answer/markdown

- Access: Arc Pro
- Registry id: `ai-answer`
- Source file: `registry/blocks/ai-answer/ai-answer.tsx`
- Built from: Text shimmer, Hover card, Copy button, Tooltip, Popover
- Keywords: ai answer, answer engine, cited answer, citations, sources, streaming, reasoning, thinking, regenerate, feedback, follow-up questions, perplexity style, llm, markdown, answer page

Pass question and respond, an async generator that yields reasoning deltas, the sources, text deltas in markdown with [n] citations, and a done event. Throw to show the error state; the AbortSignal fires on Stop, a new question and unmount. Pass answer, sources and usage to render a stored answer at once, and wire onFeedback, onFollowUp and onShare. With no props it runs a scripted demo.

## When to use

- An answer page where one question gets one well formatted, cited answer that people read, copy and share.
- Docs and help center assistants that must show where each claim comes from.
- Internal knowledge search where the answer mixes prose, steps, a comparison table and code.

## When not to use

- Use ai-chat for a back and forth conversation with many turns kept on screen.
- Use research-run for long multi step research that plans searches and reads many sources before writing.
- Use ai-side-panel when the assistant sits next to a document or app the person is working in.
- Use ai-inline-edit to rewrite a selection in place rather than answer a question.

## Installation

AI answer is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-answer
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiAnswer, type AnswerEvent } from "@/components/arc/blocks/ai-answer/ai-answer";

// Wire a real model: forward your server's stream as AnswerEvents.
async function* respond({ question, mode, model, signal }) {
  const response = await fetch("/api/answer", { method: "POST", body: JSON.stringify({ question, mode, model: model.id }), signal });
  if (!response.ok) throw new Error("The model is busy. Try again in a moment.");
  for await (const event of readNdjson<AnswerEvent>(response.body!)) yield event;
}

export function AnswerPage() {
  return (
    <AiAnswer
      question="How do we roll out passkeys without locking anyone out?"
      respond={respond}
      onFeedback={feedback => track("answer_feedback", feedback)}
      onFollowUp={question => router.push(`/ask?q=${encodeURIComponent(question)}`)}
      onShare={({ version }) => `https://acme.dev/answers/42${version ? `?v=${version + 1}` : ""}`}
    />
  );
}

// Or show a stored answer without streaming.
<AiAnswer
  question="What should we measure before each rollout stage?"
  answer={[
    { type: "paragraph", text: "Measure whether people get in, not just whether they enroll. [1]" },
    { type: "list", ordered: true, items: ["Enrollment", "Passkey success", "Fallbacks"] },
  ]}
  sources={[{ id: "webdev", title: "Passkey form autofill", site: "web.dev", domain: "web.dev", url: "https://web.dev/articles/passkey-form-autofill" }]}
  usage={{ tokens: 1240, thoughtSeconds: 7, seconds: 18.4 }}
/>
```

## API reference

### AiAnswer

One AI answer in a calm app view. A slim top bar carries the thread title, New thread and Share. The question sits above a reasoning row that shimmers "Thinking" and settles to "Thought for 9s", which opens a short reasoning summary, and a sources row with a stack of small site marks that opens into source cards. The answer streams in chunks with headings, numbered lists, a comparison table, a code block with copy and inline citations; hovering or focusing a citation shows its source and softly lights the exact sentence it supports and the matching card. Under the answer: copy, regenerate (Try again, More concise, More detailed, Switch model), thumbs up, thumbs down with a reason, a share link, a version switcher after regenerating, the model line with tokens and time, and three related questions. A docked composer asks follow-ups and turns into Stop while an answer streams.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | `"How do we roll out passkeys without locking anyone out?"` | The question. Leave it out for the demo. An empty string, with no `answer`, shows the empty state with suggestions. |
| `answer` | `AnswerBlock[]` | – | A finished answer to show at once, without streaming. Blocks are { type: "paragraph" \| "heading", text }, { type: "list", ordered?, items }, { type: "table", columns, rows } and { type: "code", code, language?, filename? }. Inline text supports **bold**, `code` and [n] citations. |
| `sources` | `AnswerSource[]` | – | Sources for a finished answer, numbered in order: [1] in the text is the first. Each is { id, title, site, domain, url, date?, snippet?, icon? }; `icon` is the site's mark (about 16px, brand colors kept), and the domain's first letter stands in without one. |
| `reasoning` | `string` | – | Reasoning summary for a finished answer, shown under "Thought for". Paragraphs split on blank lines. |
| `usage` | `{ tokens?: number; thoughtSeconds?: number; seconds?: number }` | – | Usage for a finished answer, shown on the model line and the reasoning row. |
| `followUps` | `string[]` | – | Related questions under the answer. The demo offers three from its script. |
| `suggestions` | `string[]` | – | Questions offered in the empty state. The demo offers its four sample questions; with `respond` the default is none. |
| `title` | `string` | – | Title in the top bar. Defaults to the question. |
| `model` | `AnswerModel` | `Claude Opus 5.5` | The model that writes the answer: { id, name, mark? }. The mark shows at 14px on the model line. |
| `models` | `AnswerModel[]` | `Claude Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1` | Models offered under Regenerate, Switch model. The first is the default when `model` is not set. |
| `respond` | `(request: AnswerRequest) => AsyncIterable<AnswerEvent>` | – | Streams an answer from your model. The request has { question, mode, model, previous?, signal }; mode is "answer", "retry", "concise", "detailed" or "model". Yield { type: "reasoning", text }, { type: "sources", sources }, { type: "thought", seconds }, { type: "text", text } (markdown) and { type: "done", tokens?, seconds?, followUps? }. Throw to show the error state; stop when `signal` aborts. Without it, a scripted demo answers four sample questions. |
| `onFeedback` | `(feedback: AnswerFeedback) => void` | – | Called with { value: "up" \| "down" \| null, reason?, question, answer, model, version } on thumbs up, on thumbs down after a reason is picked, and with null when feedback is taken back. |
| `onFollowUp` | `(question: string) => void` | – | Called when a question is asked from the composer, a related question or a suggestion, just before its answer streams. |
| `onShare` | `(info: { question: string; answer: string; version?: number }) => string \| Promise<string>` | – | Returns the link that Share copies. `version` is set for the action bar link and undefined for the thread link in the top bar. Without it, a sample example.com link is copied and the status says so. |
| `className` | `string` | – | Class on the root element. The root fills the viewport height by default; set a height here to embed it. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through New thread, Share, the reasoning and sources rows, the source cards, each citation, the table and code regions, code Copy, the action bar, the related questions and the composer. |
| Enter, Space | On the reasoning or sources row, opens or closes it. On a citation, opens the source in a new tab; focusing it already shows the source card and lights its sentence and card. |
| Enter | In the composer, sends the question. Shift+Enter adds a line. |
| Arrow up / Arrow down | In the Regenerate menu, moves between options; Arrow right opens Switch model and Arrow left closes it. |
| Escape | Closes the Regenerate menu, the reason picker or a citation card and returns focus to its trigger. |

## Accessibility

- The block is a labelled region named by the question, with aria-busy while an answer streams. A polite status region announces Thinking, Writing the answer, Answer ready, Answer stopped or the error.
- Action results (copied, link copied, feedback sent, version shown) go to a second polite live region; the share links say when the preview copies a sample link.
- The reasoning and sources rows are buttons with aria-expanded and aria-controls; closed panels are inert, so their content leaves the tab order.
- Citations are links named "Source n: title, site"; the source card opens on keyboard focus as well as hover, and a lit sentence is a visual aid only, never the only cue.
- The comparison table keeps header cells with scope, and the table and code scroll inside focusable, labelled regions on narrow screens.
- Status is never color alone: copied shows a drawn check, errors an icon and text, feedback a filled glyph with aria-pressed, and stopped or failed answers a note with a Try again button.
- Asking a related question moves focus to the new question heading; New thread moves focus to the composer.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- "Thinking" uses the Arc text shimmer for about a second and settles to solid text as "Thought for 9s" when the first words arrive.
- The answer streams in chunks on a requestAnimationFrame clock: about every 34ms, three to eight words commit at once and fade in over 160ms on a plain ease-out, with no blur, travel or stagger. A steady pace of about a hundred words a second plus catch-up drains bursts, so a full answer lands in two to four seconds. Settled text never re-renders or reflows.
- Headings, list items, table rows and code lines appear as their text arrives; a line or row waits for its newline, so containers never pop in half built.
- The reasoning and sources panels open on the smooth spring; source cards fade in 20ms apart, at most six steps. Hovering the sources row fans the mark chips apart on the CSS spring.
- Regenerating or switching versions crossfades the answer while its height springs to the new length, and the version number rolls up or down.
- Copy and Share morph their icon (a drawn check) and label in place without changing width; Send turns into Stop in the same spot.
- Reduced motion keeps the chunked arrival but drops every fade, roll, fan and spring, and keeps all states and announcements.

## Responsive behavior

- The reading column caps at about 704px with even gutters that shrink to 16px on phones; the question scales between 22px and 28px with the container.
- Source cards form a two column grid in a wide column and a snap scrolling row on phones, faded at the trailing edge with a mask; a citation that lights an off screen card scrolls it into view.
- The table and code scroll horizontally inside their frames; the action bar wraps its model line under the actions.
- The top bar truncates the title and keeps Share; the composer stays docked at the bottom and grows to six lines.

## Performance

- Streamed markdown is parsed into numbered units that stay stable as text arrives, so each commit only appends new spans and earlier text never re-renders.
- One requestAnimationFrame loop per answer paces the reveal and commits at most every 34ms; it stops as soon as the answer is on screen.
- Finished versions render whole without the reveal, and the answer body is memoized against hover changes outside its sentences.

## Notes for AI

- Choose it for a single answer page with sources: help centers, internal search, docs assistants, answer engines. It shows one question at a time; asking another replaces it.
- Stream markdown in `text` events: paragraphs, ### headings, 1. and - lists, pipe tables and fenced code (```js filename.js). Inline **bold**, `code` and [n] citations work everywhere; [n] points at sources[n - 1].
- Send `sources` early, during reasoning, so the stack fills while the model thinks. Send `thought` with the thinking duration when the first text is ready; without it the time to first text is used.
- Brand marks are sample content. Pass your own `icon` per source; keep color brands in their colors and mono brands on currentColor.
- Regenerate keeps every version in memory for the session and calls `respond` with mode and the previous answer as markdown, so your prompt can ask for a shorter, longer or different answer.
- The demo compresses time: thinking plays in about a second and the reported thinking time and duration are what the simulated model would have taken.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
