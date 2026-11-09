# AI chat

> A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-chat
- Markdown: https://uiarc.dev/components/blocks/ai-chat/markdown

- Access: Arc Pro
- Registry id: `ai-chat`
- Source file: `registry/blocks/ai-chat/ai-chat.tsx`
- Built from: Button, Copy button, Hover card, Tooltip, Text shimmer
- Keywords: ai chat, chatbot, llm chat, assistant, streaming, markdown, reasoning, thinking, tool calls, citations, model switcher, regenerate, message versions, chat history, stop generating, claude, gpt, gemini

Use it as the main assistant screen of an app. Pass respond(messages, { signal, model }) as an async iterable of events (reasoning, tool, sources, text deltas, error) to stream a real model; Stop aborts the signal. initialMessages, history, models, suggestions, onFeedback, onModelChange and onNewChat wire it to your data. It fills its container; set --chat-height to embed it smaller and --chat-column for the conversation width.

## When to use

- A multi turn assistant inside a product page, drawer or dashboard card, with streaming answers, reasoning, tools and citations.
- Any place users need to retry, edit, rate or copy answers and switch models mid conversation.
- Prototyping an LLM feature: with no props it plays a realistic scripted conversation and answers new messages with simulated replies.

## When not to use

- Use ai-composer when you only need the prompt box with attachments, mentions and commands.
- Use ai-answer for a single question and a long, article like answer with sources.
- Use agent-run or research-run when the work is a multi step agent run with a plan and progress rather than a conversation.
- Use model-picker for a standalone model selector with pricing and context details.

## Installation

AI chat is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-chat
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiChat } from "@/components/arc/blocks/ai-chat/ai-chat";
import type { ChatRespond } from "@/components/arc/blocks/ai-chat/ai-chat";

// Map your API's stream onto chat events. Text can arrive in any chunk size; the chat paces it.
const respond: ChatRespond = async function* (messages, { signal, model }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ model: model.id, messages: messages.map(({ role, content }) => ({ role, content })) }),
    signal,
  });
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    yield { type: "text", delta: value };
  }
};

export function SupportChat() {
  return <AiChat respond={respond} onFeedback={(message, value) => track("reply_feedback", { id: message.id, value })} />;
}
```

## API reference

### AiChat

A focused AI chat card. A slim header holds the conversation title (a menu of recent chats), a model chip with a compact model menu and a New chat button. The thread scrolls inside the card and follows new text while it streams. User turns are quiet right aligned bubbles that can be copied or edited; assistant turns are unboxed, with a small model mark, a "Thought for 4s" line that folds open, tool chips that open their searches, sources or query, and markdown answers with lists, inline code, code blocks with copy and numbered citations that preview their source on hover. Copy, retry and feedback appear on hover, and an edit or retry adds a version shown as a "2 / 2" switcher. The composer autosizes, takes attachments and turns its send button into Stop while a reply streams. Empty, thinking, streaming, stopped and error states are all built in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `respond` | `(messages: AiChatMessage[], options: { signal: AbortSignal; model: ChatModel }) => AsyncIterable<ChatStreamEvent>` | – | Streams one reply for the messages on screen. Yield { type: "reasoning", delta }, { type: "reasoning-end", seconds? }, { type: "tool", tool } (upserted by id), { type: "sources", sources } and { type: "text", delta }; the reply ends when the iterable finishes. Throw or yield { type: "error", message } to fail it with a Retry. Stop aborts the signal. Without it the chat answers with scripted, simulated replies. |
| `models` | `ChatModel[]` | `sampleModels` | Models in the header menu: { id, name, note?, mark, color? }. The mark is any SVG component; color tints a mono mark. Samples are Claude Opus 5.5, Claude Sonnet 5.5, GPT-6.1 Sol, Gemini 4 Argon and Mistral Large 4. |
| `defaultModel` | `string` | – | Id of the model selected first. Defaults to the first model. |
| `initialMessages` | `AiChatMessage[]` | – | The open conversation, alternating user and assistant messages. Assistant messages can carry model, reasoning, thoughtFor, tools, sources and status. A trailing user message is answered when the card first scrolls into view. |
| `title` | `string` | – | Title of the open conversation. Defaults to one taken from its first message. |
| `history` | `AiChatHistoryItem[]` | – | Earlier conversations in the title menu: { id, title, group?, messages }. Each opens settled at its latest message and keeps its own scroll position. Defaults to sample chats only in the simulated preview. |
| `suggestions` | `ChatSuggestion[]` | `sampleSuggestions` | Up to three prompts in the empty state: { label, prompt?, icon? } where icon is "database", "timer", "activity" or "search". |
| `greeting` | `string` | `"What are we working on?"` | Heading of the empty state. |
| `placeholder` | `string` | `"Ask anything"` | Composer placeholder. |
| `autoPlay` | `boolean` | – | Plays a two turn scripted conversation once the card is in view. Defaults to true only without respond and initialMessages. Typing, sending or switching chats stops it. |
| `onFeedback` | `(message: AiChatMessage, value: "up" \| "down" \| null) => void` | – | Called when a reply is rated or the rating is cleared. Without it the preview records the rating locally and announces it as simulated. |
| `onModelChange` | `(model: ChatModel) => void` | – | Called when a model is picked. New replies use it; earlier replies keep the mark of the model that wrote them. |
| `onNewChat` | `() => void` | – | Called by the New chat button and menu item. |
| `className` | `string` | – | Class on the root. It fills its container's width and the screen's height; set --chat-height to fit a smaller area and --chat-column (default 760px) for the width of the conversation column. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the composer, sends the message. In the edit field, sends the edited message as a new version. |
| Shift + Enter | Adds a new line in the composer or the edit field. |
| Escape | In the composer, stops a streaming reply. In the edit field, cancels the edit. In a menu, closes it and returns focus to its chip. |
| Tab | Moves through the chat menu, model chip, New chat, each message's actions, reasoning and tool toggles, citations and the composer controls. |
| Arrow up / Arrow down | Moves through the chat and model menus; Enter or Space picks the highlighted row. |

## Accessibility

- The card is a labelled section. Each turn is an article; a reply that is still thinking or streaming sets aria-busy.
- A polite status region announces when a reply starts, finishes, stops or fails, model and chat changes, copy results and feedback. In the preview every scripted reply and rating is announced as simulated.
- The reasoning line and tool chips are buttons with aria-expanded and aria-controls. Citations are links named "Source 2: title, domain" and open a read only preview on hover or keyboard focus.
- Icon buttons carry specific names (Copy, Retry, Good response, Bad response, Edit, Attach files, Send message or Stop reply), and the thumbs expose aria-pressed.
- Status is never color alone: errors pair an icon with "Reply failed" and the message, a stopped reply says Stopped, and a failed tool shows an alert icon with its summary.
- The version switcher is a labelled group ("Version 2 of 2") with Previous and Next buttons.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Answers stream in chunks of three or four whole words every 34ms on a requestAnimationFrame clock (about 90 to 120 words per second). Each chunk is its own span that fades in once over 150ms; nothing already on screen re-renders, moves or blurs, and list markers and code fences never appear before their first word.
- Thinking and running tools use a calm text shimmer that stops when they finish. Labels such as Thinking to "Thought for 4s", tool states, the model chip and the title swap with one crossfade (100ms out, 160ms in from 2px) while the box follows the measured width on a critically damped spring.
- Reasoning, tool details and attachments fold open by height on a spring with no bounce. Switching versions or opening the editor glides the turn to its new height and fades the new content in.
- While stuck to the bottom the thread follows new lines on a soft lerp, so text glides up instead of jumping a line at a time. Scrolling up releases it and shows a jump to latest button.
- Switching chats crossfades the thread (out in 100ms, in over 160ms from 4px), restores that chat's scroll position and never replays finished replies. Menus fade and scale from their trigger.
- Reduced motion drops the chunk fade, travel and smooth scrolling and keeps every state, label and announcement.

## Responsive behavior

- It fills the screen: the header spans the full width while the conversation and composer stay in one centered column (760px by default, set --chat-column). Set --chat-height to embed it in a smaller area. It works from 320px wide.
- Padding, bubble width and the source list adapt to the card's own width through container queries, so it fits a sidebar as well as a page.
- The header title truncates before the model chip and New chat button move; code blocks scroll sideways inside themselves.
- On touch screens message actions are always visible instead of appearing on hover.

## Performance

- Turns are memoized; while a reply streams only that turn re-renders, once per 34ms tick.
- Streaming text is parsed from the revealed slice each tick with a small linear parser, and settles into plain strings 240ms after the last chunk.
- The stream is aborted on Stop, on a new message and on unmount, and the reveal clock only runs while a reply is streaming.

## Notes for AI

- Use it when the conversation itself is the product surface: support, internal assistants, docs Q&A or a copilot card. Wire `respond` to your API and map its stream to events; yield text deltas in whatever size they arrive, because the reveal clock paces them.
- Markdown support is deliberately small: paragraphs, ordered and bulleted lists, short headings, **bold**, `inline code`, fenced code blocks and [n] citations that index into the sources event (1 based). Keep answers in that subset.
- Send sources before the text that cites them. A citation with no matching source renders as a plain number.
- Tools are upserted by id: yield the same id with status "running", then "done" or "error", plus a short summary such as "4 sources" or "40,213,880 rows". Give a tool `sources` for a search or `input` and `output` for a query.
- Messages passed to `respond` follow the visible branch only. An edit or retry adds a version, and later turns belong to the version they followed.
- Real model names and marks are sample content. Use only models you actually offer.

## Related

- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
