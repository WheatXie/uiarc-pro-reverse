# Tool call

> A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/tool-call
- Markdown: https://uiarc.dev/components/tool-call/markdown
- Source file: `registry/components/tool-call/tool-call.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, ai, new, tool call, tool use, function call, agent transcript, ai chat, used tools, approval, human in the loop, retry, tool result, mcp, agent, llm tools, inline approval

## When to use

- Showing what tools an AI agent used inside a chat or agent transcript, with the arguments and results one click away.
- Human in the loop actions where a call must be allowed or denied inline before it runs, such as posting a message or writing to a database.
- Making failures recoverable in place: a timed out query with its reason and a Retry button.
- Debug and audit views where developers need to copy exact tool inputs and outputs.

## When not to use

- Use agent-run for a full multi step run with a plan, a timeline and live logs rather than inline rows in a message.
- Use agent-approvals for a queue of pending approvals across many agents and runs.
- Use research-run when the work is mostly web research with sources and a streamed report.
- Use mcp-servers to manage which tools an agent can reach, not to show individual calls.

## Installation

Tool call is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/tool-call
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ToolCall, ToolCallGroup } from "@/components/arc/tool-call/tool-call";

// One call on its own
<ToolCall
  tool="github"
  title="Searched issues in arc-ui/web"
  titles={{ running: "Searching issues in arc-ui/web" }}
  status="success"
  input={{ repo: "arc-ui/web", query: "is:open label:release-blocker" }}
  output={{ type: "list", items: [{ lead: "#1284", title: "Checkout button stays disabled after a coupon is removed", tag: "checkout" }] }}
  durationMs={1180}
/>

// Every call from one assistant turn, wired to your agent loop
export function ToolCalls({ calls, working, agent }) {
  return (
    <ToolCallGroup
      calls={calls}
      active={working}
      onApprove={call => agent.approve(call.id)}
      onDeny={call => agent.deny(call.id)}
      onRetry={call => agent.retry(call.id)}
    />
  );
}
```

## API reference

### ToolCall

One inline tool call for an agent or chat transcript: the tool's mark, a verb phrase, quiet meta and a status icon. Clicking the row springs it open into Input (the arguments) and Output (a readable result), each with a copy button. Awaiting approval it shows inline Allow and Deny; on an error it shows the reason and Retry. With no props it renders a sample GitHub search.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | – | Stable id for the call. A group uses it as the React key, so a call that changes status keeps its row and its open state. |
| `tool` | `"github" \| "linear" \| "postgres" \| "slack" \| "gmail" \| "web" \| { name: string; mark: ReactNode }` | – | Which tool ran. The built in ids draw the real brand mark (web draws a globe for web search); a custom tool passes its own name and a 16px mark. |
| `title` | `string` | – | The settled verb phrase, such as "Searched issues in arc-ui/web". Keep it to one line; it truncates. |
| `titles` | `Partial<Record<ToolCallStatus, string>>` | – | Phrasing per status, such as { running: "Searching issues in arc-ui/web", approval: "Post a summary to #release" }. Falls back to title. |
| `status` | `"running" \| "success" \| "error" \| "approval" \| "denied"` | – | Running shimmers the title with a spinner; success shows a check, the summary and the duration; error shows the reason and Retry; approval shows Allow and Deny on an accent outline; denied shows that the call never ran. |
| `input` | `Record<string, ToolCallValue>` | – | The arguments the model passed, shown as a mono key and value list with a copy button. |
| `output` | `{ type: "list"; items } \| { type: "table"; columns; rows } \| { type: "json"; value } \| { type: "text"; text }` | – | What came back. Lists show a number, a title and a tag per row; tables and JSON (with a syntax tint) fold after five rows or ten lines behind "Show 18 more lines". Copy gives JSON, lines or tab separated rows. |
| `summary` | `string` | – | Quiet meta before the duration, such as "4 results". Derived from the output when left out (results, rows, fields). |
| `message` | `string` | – | One line under the title: the error reason, or what allowing the call will do. |
| `durationMs` | `number` | – | How long the call took, shown as 640ms or 1.2s with tabular numerals. The group header shows the total. |
| `defaultOpen` | `boolean` | `false` | Opens the Input and Output panel on first render. |
| `open` | `boolean` | – | Controls the panel. Pair with onOpenChange. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the row is opened or closed. |
| `onApprove` | `() => void` | – | Allow on a call awaiting approval. Update status yourself (usually to running, then success). Without it the preview simulates the call and says so to assistive technology. |
| `onDeny` | `() => void` | – | Deny on a call awaiting approval. Without it the call is marked denied locally. |
| `onRetry` | `() => void` | – | Retry on a failed call. Without it the preview simulates a successful retry. |
| `renderOutput` | `(call: ToolCallData) => ReactNode \| undefined` | – | Draws a custom result for a successful call inside the Output well, such as a chart or a file preview. Return undefined to fall back to the built in view. |
| `className` | `string` | – | Class on the call's outer element. |

### ToolCallGroup

Several calls from one assistant turn under a quiet header, "Used 4 tools", with an overlapping stack of the tools' marks and the total duration. Opening it staggers the rows in; while the agent works the header reads "Using 3 tools" with a shimmer. A call that needs a decision opens a closed group, and the group folds itself away once every call has finished unless the person has opened or closed anything.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `calls` | `ToolCallData[]` | `four settled sample calls` | The calls in order, each with id, tool, title, status and optional titles, input, output, summary, message and durationMs. Append to the array as the agent starts new calls; each new row grows in. |
| `active` | `boolean` | `any call running` | The agent is still working in this turn, so the header keeps saying "Using" between calls instead of flickering to "Used". |
| `defaultOpen` | `boolean` | `open while any call is running, waiting or failed` | Whether the list is open on first render. A finished transcript starts folded. |
| `open` | `boolean` | – | Controls the list. Pair with onOpenChange. Calls that need a decision only open the group on their own when it is uncontrolled. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the header is toggled or the group folds itself. |
| `autoCollapse` | `boolean` | `true` | Folds the list 450ms after every call has finished, so the answer reads right under "Used 4 tools". Skipped once the person has opened or closed the group or any row. |
| `onApprove` | `(call: ToolCallData) => void` | – | Allow on a call awaiting approval. |
| `onDeny` | `(call: ToolCallData) => void` | – | Deny on a call awaiting approval. |
| `onRetry` | `(call: ToolCallData) => void` | – | Retry on a failed call. |
| `renderOutput` | `(call: ToolCallData) => ReactNode \| undefined` | – | Custom result renderer applied to every successful call in the group. |
| `className` | `string` | – | Class on the group's outer element. |

### ToolCallData

The shape of one call, shared by ToolCall props and ToolCallGroup calls.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable id for the call. A group uses it as the React key, so a call that changes status keeps its row and its open state. |
| `tool` (required) | `"github" \| "linear" \| "postgres" \| "slack" \| "gmail" \| "web" \| { name: string; mark: ReactNode }` | – | Which tool ran. The built in ids draw the real brand mark (web draws a globe for web search); a custom tool passes its own name and a 16px mark. |
| `title` (required) | `string` | – | The settled verb phrase, such as "Searched issues in arc-ui/web". Keep it to one line; it truncates. |
| `titles` | `Partial<Record<ToolCallStatus, string>>` | – | Phrasing per status, such as { running: "Searching issues in arc-ui/web", approval: "Post a summary to #release" }. Falls back to title. |
| `status` (required) | `"running" \| "success" \| "error" \| "approval" \| "denied"` | – | Running shimmers the title with a spinner; success shows a check, the summary and the duration; error shows the reason and Retry; approval shows Allow and Deny on an accent outline; denied shows that the call never ran. |
| `input` | `Record<string, ToolCallValue>` | – | The arguments the model passed, shown as a mono key and value list with a copy button. |
| `output` | `{ type: "list"; items } \| { type: "table"; columns; rows } \| { type: "json"; value } \| { type: "text"; text }` | – | What came back. Lists show a number, a title and a tag per row; tables and JSON (with a syntax tint) fold after five rows or ten lines behind "Show 18 more lines". Copy gives JSON, lines or tab separated rows. |
| `summary` | `string` | – | Quiet meta before the duration, such as "4 results". Derived from the output when left out (results, rows, fields). |
| `message` | `string` | – | One line under the title: the error reason, or what allowing the call will do. |
| `durationMs` | `number` | – | How long the call took, shown as 640ms or 1.2s with tabular numerals. The group header shows the total. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the group header, each call row, a row's Allow, Deny or Retry buttons, and inside an open row its copy buttons and the show more control. |
| Enter, Space | On the group header, opens or closes the list. On a call row, opens or closes Input and Output. On Allow, Deny, Retry, copy and show more, activates them. |

## Accessibility

- The group header and every call row are real buttons with aria-expanded and aria-controls; a row's name reads the tool, the verb phrase and the status, such as "GitHub: Searched issues in arc-ui/web Done, 4 results, 1.2s".
- Status is never color alone: each status has its own icon shape (spinner, check, alert, shield, ban), failed and waiting calls show a reason line, and the row name spells the status out.
- Each call announces its status changes through a polite live region, including that the preview only simulates an action when no handler is passed.
- Allow, Deny and Retry are labelled with the call they act on, such as "Allow: Post a summary to #release".
- The input list is a description list; tables keep table semantics with column headers. Folded rows and lines are hidden from assistive technology until shown.
- Copy buttons confirm success or failure in place and through a live region, without changing width.
- Pointer focus draws no ring; keyboard focus shows Arc's shared ring, inset inside rows so it is never clipped.

## Motion

- Opening a row, opening the group and showing more lines animate height on the critically damped smooth spring, with a short opacity fade; chevrons turn on the shared CSS spring.
- Opening the group staggers its rows in 20ms apart with a 6px settle. Rows appended by a live run grow in from zero height instead, so nothing below them jumps.
- A row's height follows its content on the same spring when a reason line or wrapped actions appear, so a status change never resizes in one frame.
- Status icons trade places with a snappy scale and fade; the success check draws itself once. The running title uses the text shimmer and settles to solid when the call finishes.
- The mark stack widens on the morph spring as a new tool joins, so the header label glides instead of jumping.
- Reduced motion removes the stagger, spinner rotation, shimmer travel and springs. Panels, rows and statuses change immediately and every label, announcement and focus path stays.

## Responsive behavior

- Rows are container aware: below 440px the meta keeps only the duration, the reason line wraps, and Allow, Deny and Retry move under the reason so the title keeps its width.
- Under 440px the Input and Output panel drops its title indent and uses the full row width; wide JSON and tables scroll inside their own well, never the page.
- Rows are 40px tall and inline actions grow to 32px on touch screens. The whole row is the tap target for opening it.

## Performance

- Folded outputs use fixed row heights, so folding and unfolding never measures the DOM.
- Input and Output mount only while a row is open; a closed group unmounts its rows.
- Height follows content through one ResizeObserver per row, and width changes from the container cut straight to the new height without animating.
- No dependencies beyond motion and lucide-react; brand marks are inline SVG.

## Notes for AI

- Use ToolCallGroup for the tool calls of one assistant turn and ToolCall for a single call shown on its own. Render the group between the assistant's intro sentence and its answer.
- Append calls to the array as the agent starts them and change status in place; keep ids stable. Pass active while the agent is still working so the header does not flicker between calls.
- Give each call a past tense title and a present tense titles.running, and for approval calls an imperative titles.approval ("Post a summary to #release") plus a message saying what allowing will do.
- Pick the output type that reads best: list for search results and issues, table for SQL rows, json for structured API responses, text for a sent message or a short log. Use renderOutput for anything richer.
- Approve, deny and retry handlers should update the call's status; the component never changes status itself when a handler is passed. Without handlers it simulates locally, which suits previews only.
- Brand marks are sample content and never imply endorsement. For tools without a built in mark pass { name, mark } with a 16px inline SVG.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Agent loop](https://uiarc.dev/components/agent-loop/markdown): An illustration of the agent loop: gather context, take action, verify, repeat, with a bright head circling three stations around the model.
- [Research run](https://uiarc.dev/components/blocks/research-run/markdown): Deep research that plans searches, reads sources with their marks, and streams a cited answer where every chip lights up the sentence it supports.
- [MCP servers](https://uiarc.dev/components/blocks/mcp-servers/markdown): Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [Image generation](https://uiarc.dev/components/image-generation/markdown): An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.
- [Dictation button](https://uiarc.dev/components/dictation-button/markdown): A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.
- [Speech player](https://uiarc.dev/components/speech-player/markdown): A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.
- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.
- [Reply draft](https://uiarc.dev/components/reply-draft/markdown): An AI email reply drafter where Claude streams a reply under a received Gmail message. Quick replies steer a fresh draft, tone and length rewrite it with a single crossfade, and you can edit the finished draft before you insert it.
- [Agent handoff](https://uiarc.dev/components/agent-handoff/markdown): A support conversation where an AI assistant hands off to a person. When it transfers, a card shows the summary it passes to the team and the typical wait. The person then joins and takes over, and a thin timeline on the left marks each step.
- [PII redaction](https://uiarc.dev/components/pii-redaction/markdown): A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.
- [Response feedback](https://uiarc.dev/components/response-feedback/markdown): A feedback control for AI replies where thumbs down opens an inline panel with reason chips and an optional note, thumbs up fills and asks what was good, and a submit shows a short thank-you before folding back into the row.
- [LLM cost calculator](https://uiarc.dev/components/llm-cost-calculator/markdown): A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.
- [Provider keys](https://uiarc.dev/components/provider-keys/markdown): A settings card for bring-your-own-key AI products. Each provider row shows its real mark, the masked key, a status and when the key was last used. You can reveal a key for five seconds, copy, rotate or remove it with undo. Adding or rotating a key opens an inline form that checks the format as you type, then tests the connection before saving.
- [Generation stats](https://uiarc.dev/components/generation-stats/markdown): A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.
- [AI translate](https://uiarc.dev/components/ai-translate/markdown): A message card where picking a language streams the AI translation in place, sentence by sentence over the dimmed original, with a detected-language chip, a Show original toggle and a status line credited to the model's mark.
- [TL;DR toggle](https://uiarc.dev/components/tldr-toggle/markdown): An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.
- [Connector setup](https://uiarc.dev/components/connector-setup/markdown): A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.
- [Smart form fill](https://uiarc.dev/components/smart-form-fill/markdown): A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.
- [Enrich column](https://uiarc.dev/components/enrich-column/markdown): An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.
- [Ticket router](https://uiarc.dev/components/ticket-router/markdown): A support ticket router where messages from Gmail, Intercom, Slack and Zendesk come in one at a time. An AI classifier labels each one with intent, sentiment and confidence, and the ticket moves into a team lane with an assignee. Low confidence tickets wait in a review lane, and one click there routes them to the suggested team.
- [Ask your data](https://uiarc.dev/components/ask-your-data/markdown): A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.
- [Agent cursor](https://uiarc.dev/components/agent-cursor/markdown): A live document where Claude edits like a collaborator. Its labeled cursor comes out of its avatar, selects a paragraph and streams in a rewrite, adds a heading and fixes a typo, while a teammate's cursor reads along. Changes stay tinted until someone accepts or undoes them from a floating review bar.
- [Provider status](https://uiarc.dev/components/provider-status/markdown): A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.
- [Training run](https://uiarc.dev/components/training-run/markdown): A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.
- [AI command](https://uiarc.dev/components/ai-command/markdown): A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.
- [Starter prompts](https://uiarc.dev/components/starter-prompts/markdown): A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).
- [AI mascot](https://uiarc.dev/components/ai-mascot/markdown): A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.
- [Image reveal](https://uiarc.dev/components/image-reveal/markdown): An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.
- [AI spark](https://uiarc.dev/components/ai-spark/markdown): A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.
- [Pixel mascot](https://uiarc.dev/components/pixel-mascot/markdown): A pixel-art robot that shows what an AI assistant is doing. It idles, thinks, types, celebrates and errors in frame-stepped sprite animations, and stays crisp at every integer size from 24px to 192px.
- [Ghost mascot](https://uiarc.dev/components/ghost-mascot/markdown): A floating ghost mascot whose soft sheet ripples at the hem while it hovers. It blinks when idle, turns toward you to listen, fades a little translucent while thinking, draws a tiny pen line while writing, smiles with a sparkle when done and wobbles once on an error.
- [Cube mascot](https://uiarc.dev/components/cube-mascot/markdown): An isometric cube mascot where three shaded faces and a painted-on face show what the assistant is doing. It turns a quarter turn in eased steps while thinking, prints lines onto the floor while writing, settles with a sparkle when done, and shakes once on error.
- [Tone tuner](https://uiarc.dev/components/tone-tuner/markdown): A brand voice card where two sliders (formality and detail) and Friendly, Confident and Empathetic chips rewrite a customer reply. Each changed sentence crossfades in place, new words can be highlighted against the original, and Copy takes the current version.
- [Upgrade prompt](https://uiarc.dev/components/upgrade-prompt/markdown): An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.
- [Referral card](https://uiarc.dev/components/referral-card/markdown): A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.
- [Trial banner](https://uiarc.dev/components/trial-banner/markdown): A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.
- [Team switcher](https://uiarc.dev/components/team-switcher/markdown): A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.
- [Live visitors](https://uiarc.dev/components/live-visitors/markdown): A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.
- [Social proof toast](https://uiarc.dev/components/social-proof-toast/markdown): A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.
- [Install snippet](https://uiarc.dev/components/install-snippet/markdown): A "get started in 30 seconds" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.

## Guidance for AI tools

Tool call: A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
