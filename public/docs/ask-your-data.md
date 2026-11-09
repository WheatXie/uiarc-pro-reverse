# Ask your data

> A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ask-your-data
- Markdown: https://uiarc.dev/components/ask-your-data/markdown
- Source file: `registry/components/ask-your-data/ask-your-data.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, ask your data, text to sql, natural language query, nl2sql, ai analytics, chart, postgresql, sql generation, stacked bar chart, line chart, data table, insight, bi, self serve analytics

## When to use

- Letting people ask product or business questions in plain words and see a chart, with the SQL one click away to verify or copy.
- Embedding an analytics answer in a dashboard card, an admin page or an AI assistant's result view.
- Teaching or auditing text to SQL, where showing the generated query builds trust.

## When not to use

- Use bar-chart or line-chart when the query is fixed and there is no question to ask.
- Use tool-call to show a database query as one step inside a longer agent transcript.
- Use sql-editor when people write and tune queries by hand.

## Installation

Ask your data is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ask-your-data
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AskYourData } from "@/components/arc/ask-your-data/ask-your-data";

// Self playing preview with sample data
<AskYourData />

// Wired to your model and a read only database role
export function Explore() {
  return (
    <AskYourData
      source={{ name: "analytics", dialect: "PostgreSQL" }}
      generateSql={(question, { signal }) => streamSql(question, { signal })} // AsyncIterable<string>
      runQuery={async (sql, { signal, onProgress }) => {
        const res = await fetch("/api/query", { method: "POST", body: JSON.stringify({ sql }), signal });
        if (!res.ok) throw new Error(await res.text()); // shows the database error
        const { rows, ms } = await res.json();
        onProgress(rows.length, rows.length);
        return {
          title: "Weekly signups by plan",
          categories: weeksOf(rows),
          series: seriesByPlan(rows),
          rowCount: rows.length,
          durationMs: ms,
        };
      }}
      onResult={(result, { sql }) => saveToHistory(result.title, sql)}
    />
  );
}
```

## API reference

### AskYourData

Natural language to chart in one card. A question field with the data source, a collapsible Generated SQL panel where PostgreSQL streams in with syntax tints, a running state with a rolling row count, then a result that builds as stacked bars, lines or a table, with a legend, a hover and keyboard readout, and a streamed one line insight. With no props it asks "Weekly signups by plan since August" against sample data once it scrolls into view.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | – | Controlled question text. Pair with onQuestionChange. |
| `defaultQuestion` | `string` | `"Weekly signups by plan since August"` | Starting question when uncontrolled; autoRun asks it. |
| `onQuestionChange` | `(question: string) => void` | – | Called as the person types or picks a suggestion. |
| `placeholder` | `string` | `"Ask a question about your data"` | Placeholder for the empty field. |
| `source` | `{ name: string; dialect?: string; mark?: ReactNode }` | `{ name: "analytics", dialect: "PostgreSQL" }` | The database the question runs against. The name shows in the field and the empty state; the dialect leads the SQL meta. |
| `suggestions` | `string[]` | `three sample questions` | Questions offered in the empty state and after a question that matches no data. Pass [] to hide them. |
| `generateSql` | `(question, { signal, source }) => Promise<string \| AsyncIterable<string>> \| string \| AsyncIterable<string>` | – | Writes SQL for the question. Return the whole string and the card streams it in four words a tick at a fixed final size, or return an async iterable of chunks from your model and the panel grows with them. Respect signal: Stop aborts it. Without it a sample model answers. |
| `runQuery` | `(sql, { signal, onProgress, question }) => Promise<AskYourDataResult>` | – | Runs the SQL (read only) and returns a chart ready result. Call onProgress(rowsScanned, totalRows?) to roll the count in the running state; passing the total reserves its width. Throw to show the database error. Without it sample data answers. |
| `onResult` | `(result: AskYourDataResult, details: { question: string; sql: string }) => void` | – | Called once a result is charted, for saving the question to a dashboard or logging. |
| `onError` | `(error: unknown, details: { question: string; stage: "sql" \| "query" }) => void` | – | Called when writing or running fails. Not called when the person stops a run. |
| `chart` | `"bar" \| "line" \| "table"` | – | Controlled view. Pair with onChartChange. |
| `defaultChart` | `"bar" \| "line" \| "table"` | `"bar"` | View for results that do not set result.chart. |
| `onChartChange` | `(chart: "bar" \| "line" \| "table") => void` | – | Called when the person switches the view. |
| `autoRun` | `boolean` | `true without generateSql` | Asks the starting question once the card is 35% on screen. Off by default when you wire a real model. |
| `keepSqlOpen` | `boolean` | `false` | Keeps the SQL panel open after the query starts instead of folding it away. Once the person opens or closes the panel, their choice wins. |
| `className` | `string` | – | Class on the card. |

### AskYourDataResult

What runQuery returns, shaped for the chart.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` (required) | `string` | – | Chart title, such as "Weekly signups by plan". |
| `subtitle` | `string` | – | Quiet line under the title, such as "Aug 3 to Oct 25 · 1,284 signups". |
| `categories` (required) | `string[]` | – | X axis labels in order, such as week starts. Labels thin out on narrow cards. |
| `series` (required) | `{ id: string; label: string; values: number[]; color?: string }[]` | – | One entry per plan, region or metric, with one value per category. Colors default to --series-1 through --series-4. |
| `stacked` | `boolean` | `true` | Series add up: bars stack, and the legend, tooltip and table show totals. Set false for rates and averages; bars then group side by side. |
| `legendValue` | `"sum" \| "last" \| "none"` | `"sum" when stacked, else "none"` | What follows each legend label: the series total for flows like signups, the latest value for levels like MRR, or nothing. |
| `chart` | `"bar" \| "line" \| "table"` | – | View to open on for this result. |
| `categoryLabel` | `string` | `"Category"` | Header of the table's first column, such as "Week". |
| `formatValue` | `(value: number) => string` | `en-US grouping` | Formats axis ticks, legend totals, tooltip and table cells, such as $258k or 3.9%. |
| `insight` | `string` | – | One or two sentences that read the chart. Streams in under it with its final height reserved. |
| `rowCount` | `number` | – | Rows the query returned, shown in the SQL meta as "48 rows". |
| `durationMs` | `number` | – | Query time, shown as 214ms or 1.2s. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the question field, asks the question. While writing or running, the same button stops the run. |
| Escape | In the question field, stops a run in progress. |
| Tab | Moves through the field, Ask, the Generated SQL row, Copy SQL, the code block (scrollable), the chart switch, the chart, and suggestions or Try again. |
| Enter, Space | On the Generated SQL row, opens or closes the SQL. |
| Left, Right, Home, End | On the chart, moves the readout between categories; on the chart switch, changes the view. |
| Escape (chart) | Clears the chart readout. |

## Accessibility

- A polite live region narrates the run: writing SQL, running the query, then the chart title, row count and insight. Without generateSql and runQuery it adds "Simulated with sample data, nothing was queried."
- Status is never color alone: a spinner, a drawn check, an alert or a stop glyph sits beside a text label in the SQL row and the stage header.
- The SQL row is a real button with aria-expanded and aria-controls, labelled with its title and meta, such as "Generated SQL, PostgreSQL · 48 rows · 214ms". Text not yet streamed is hidden from assistive technology.
- The chart is a focusable group: arrow keys move a readout that is announced, such as "Aug 10: Free 61, Pro 26, Team 10, Enterprise 2, total 99". The table view keeps real table semantics with column and row headers.
- The stage sets aria-busy while working. Text fields get no focus ring by design; the field border shifts to the accent on focus, and every other control uses Arc's shared keyboard ring.

## Motion

- SQL streams four tokens every 34ms, each chunk only fading in over 140ms. The full query is laid out invisibly first, so the panel holds its final size and nothing below moves.
- The SQL panel opens and folds on a 300ms bounce free spring; it folds once the query starts, before the chart builds, so only one region moves at a time.
- Bars rise from the baseline in 320ms with at most 180ms of stagger; lines draw in 460ms. Switching views crossfades (100ms out, 160ms in) in a fixed area.
- Header text and the SQL meta crossfade as single lines with a 2px settle. The row count rolls in tabular numerals in reserved width.
- The insight streams four words a tick with its two lines reserved. Reduced motion shows SQL and insight whole, drops the bar rise, line draw, spinner and breathing skeleton, and keeps every state and announcement. Loops pause off screen.

## Responsive behavior

- Container aware: below 520px the source keeps only its icon, the chart switch moves into the result above the legend at full width, and the stage grows to fit wrapped legend and insight lines.
- X axis labels thin out to keep 46px apart, wide SQL lines and tables scroll inside their own wells, and the tooltip flips to whichever side of the column has room.
- Touch: tap or drag across the chart to read values; vertical scrolling still passes through.

## Performance

- Charts are plain SVG measured with one ResizeObserver, no chart library. Text and hairlines are drawn at device pixels, so they stay crisp at any width.
- The SQL tokenizer is a single regular expression pass, memoized per query. The SQL panel and every view mount only while shown.
- Rows scanned updates come through onProgress; batch them to a few per second for very fast queries.

## Notes for AI

- Use it for self serve analytics inside a product: a question box on a dashboard, a metrics page, or an admin console. Wire generateSql to your model with the schema in the prompt and runQuery to a read only role with a statement timeout.
- Return the SQL as an async iterable of model chunks for true streaming, or a whole string for the paced reveal. Always honour signal so Stop really cancels both steps.
- Shape rows into categories and series in runQuery. Keep series to four or fewer for the default palette; set stacked false for rates or averages so totals are not shown.
- Let the model write the insight from the returned rows, one or two sentences with concrete numbers. Do not invent numbers that are not in the result.
- Throw from runQuery with the database message to show it verbatim in the error state with Try again.

## Related

- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Bar chart](https://uiarc.dev/components/bar-chart/markdown): Compare one measure across days and scrub any bar for its value.
- [Line chart](https://uiarc.dev/components/line-chart/markdown): A multi-series line chart with a gliding crosshair, legend toggles, and paths that morph between ranges.
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

Ask your data: A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
