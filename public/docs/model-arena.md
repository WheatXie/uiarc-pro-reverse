# Model arena

> A blind side by side model comparison in one card: send one prompt to two models, watch both answers stream at the same pace, vote for the better one, then reveal which model wrote each.

- Type: Block
- Page: https://uiarc.dev/components/blocks/model-arena
- Markdown: https://uiarc.dev/components/blocks/model-arena/markdown

- Access: Arc Pro
- Registry id: `model-arena`
- Source file: `registry/blocks/model-arena/model-arena.tsx`
- Built from: Animated counter, Button, Popover, Switch, Text shimmer
- Keywords: model arena, llm comparison, blind test, side by side, model battle, ab test, human preference, vote, leaderboard, win rate, time to first token, tokens per second, latency, cost, streaming, claude, gpt, gemini

Use it for evals, demos or a feedback page. Pass models and respond to stream real answers per side, and onVote to record the choice; with no props it plays scripted answers.

## When to use

- Blind human preference tests between two models on the same prompt, such as an internal bake-off before switching providers.
- Prompt or model evaluation tools where people should judge answers without knowing which model wrote them.
- Showing latency, speed and cost differences between two models live, side by side, on a real prompt.

## When not to use

- Use model-picker to let someone choose one model for their own chat; this block compares answers, it does not set a default.
- Use eval-suite to score many prompts automatically against expected outputs rather than collecting one human vote at a time.
- Use model-router to explain or configure automatic routing between models.
- Use ai-chat for a single ongoing conversation with one model.

## Installation

Model arena is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/model-arena
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ModelArena, ArenaRunError } from "@/components/arc/blocks/model-arena/model-arena";

// Stream each model through your own endpoint. Yield text as it arrives.
async function* run(model, prompt, signal) {
  const response = await fetch("/api/arena", { method: "POST", body: JSON.stringify({ model: model.id, prompt }), signal });
  if (!response.ok) throw new ArenaRunError(response.status === 429 ? "Rate limited. Try again in a moment." : "The model did not respond.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield decoder.decode(value, { stream: true });
  }
}

export function Arena() {
  return <ModelArena run={run} onVote={vote => saveVote(vote)} />;
}
```

## API reference

### ModelArena

A blind side by side comparison in one card. A single line prompt field with Run and three sample chips sends the same prompt to two models, and two slim panes stream their answers at the same pace inside a fixed height. Each pane header shows "Model A" or "Model B" with a small status (Thinking, Writing, Done), the first pane to finish earns a Finished first marker, and a quiet line under each pane rolls first token time, tokens per second and cost on tabular digits. When both answers land, the vote row offers A is better, Tie, B is better and Both bad. Voting reveals both models: the brand mark and name crossfade in where the letter stood while the label's width follows on a spring with no bounce, and the row becomes a one line result with Next round. A Leaderboard button opens a popover with the top five by win rate, which replays the latest vote as a smooth reorder. A Blind switch reveals names at any time, a pane that fails shows its error and a retry, and below 560px the panes become two tabs that keep both statuses in view.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `contestants` | `ArenaModel[]` | `arenaModels` | The pool each round draws its blind pair from. An ArenaModel has id, name, optional shortName for tabs, provider, an optional mark component with markColor for mono marks, price { input, output } in US dollars per million tokens, and an optional color for its leaderboard bar (a series token such as var(--series-2)). The default pool is Claude Opus 5.5, GPT-6.1 Sol, Gemini 4 Argon, Grok 4.7, Claude Sonnet 5.5, DeepSeek V4.1 Flash and Mistral Large 4; Anthropic prices are list prices and the others are sample values. |
| `prompts` | `ArenaPrompt[]` | `arenaPrompts` | Sample prompts shown as chips under the field, each { id, label, text }. The first one prefills the field, a chip fills and runs its prompt, and Next round moves to the next one. |
| `run` | `(model: ArenaModel, prompt: string, signal: AbortSignal) => AsyncIterable<ArenaStreamEvent>` | – | Streams one model's answer. Yield text deltas as strings, or objects { text?, inputTokens?, outputTokens? } to report the provider's usage; without usage, output tokens are estimated at four characters per token. Throw to fail the pane; throw an ArenaRunError with { retryable: false } to hide the retry. Stop when the signal aborts. Without run, the arena streams scripted sample answers at simulated speeds and says so in its live region. |
| `onVote` | `(vote: ArenaVote) => void` | – | Called once per vote with { round, prompt, models (model A, model B), choice ("a" \| "b" \| "tie" \| "bad"), winner, metrics }. Each metrics entry carries ttftMs, tokensPerSecond, totalMs, outputTokens and costUsd as measured from the stream. |
| `defaultBlind` | `boolean` | `true` | Hides model names and marks until a vote. The Blind switch flips it at any time. |
| `autoStart` | `boolean` | `true without run, false with run` | Runs the first round once the card scrolls into view. |
| `initialStandings` | `Record<string, { wins: number; ties: number; losses: number }>` | – | Starting records per model id, for a leaderboard loaded from your own store. Without it the leaderboard counts this session's votes from zero. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Leaderboard, the Blind switch, the prompt field, Run, the sample chips, each answer (a scrollable region), Retry where shown, and the vote buttons or Next round. |
| Enter | In the prompt field, runs the prompt. While the models are answering, Run becomes Stop. |
| Command Enter / Ctrl Enter | Runs the prompt from the field, Run or a chip. |
| Escape | Stops a run in progress from the prompt row, and closes the leaderboard popover, returning focus to its button. |
| Arrow left / Arrow right, Home, End | On the narrow layout's answer tabs, moves between model A and model B. |
| Arrow up, Page up, Home | Inside a focused answer, scrolls back and stops it following the stream; scrolling to the end follows again. |
| Enter, Space | On a vote button, records the vote and moves focus to Next round, which starts the next blind round and returns focus to Stop. |

## Accessibility

- Each pane is a labelled region ("Model A", or "Model A, Claude Opus 5.5" once revealed). Its answer is a focusable scroll region marked aria-busy while it streams.
- In blind mode no model name, mark or title reaches the page or the accessibility tree until the vote.
- Every status pairs an icon with a word: Thinking, Writing, Done, Finished first, Stopped, Failed. Color only reinforces it.
- A polite status region narrates the round: that a run started (and that the preview is simulated), which model finished first, that voting is open, the vote result with both real models, and a leaderboard reset.
- On narrow containers the panes use tab semantics: a tablist with aria-selected tabs, each controlling a tabpanel; the hidden panel leaves the tab order.
- The vote buttons form a labelled group. Leaderboard rows read their rank and win rate as text, the bars are hidden from assistive technology, and the Leaderboard button's name says when a vote has updated it.
- Run carries aria-keyshortcuts for its shortcut. Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring, inset inside scroll regions.

## Motion

- Answers stream in chunks of whole words every 30 to 40ms, each fading in over 160ms with no blur or travel, at the same pace in both panes; settled text never re-renders, and each answer follows its stream until the reader scrolls up.
- The reveal is one minimal crossfade: "Model A" fades out in 100ms while the brand mark and name fade in over 160ms from 2px below, and the label's measured width follows on a spring with no bounce. Status words and tab labels swap the same way; no character morph, blur or per letter motion anywhere.
- Working statuses shimmer with Text shimmer, and each status word mounts with its own shimmer so a change is a crossfade, never a morph inside the label.
- First token time counts live while the model thinks; speed and cost are sampled twice a second while it writes and roll on Animated counter digits, so each roll settles before the next.
- The vote row crossfades between waiting, voting and result while its height follows on the smooth spring. Run and Stop share one cell, so the button never changes width.
- Opening the leaderboard after a vote replays it: rows start at their earlier ranks and glide to the new ones on a critically damped spring while win rates roll and bars scale in each model's series color; ranks stay put while rows move. After the first vote, the bars grow from empty.
- Narrow tabs slide their highlight on a 220ms tween with no bounce, and the chosen pane fades in.
- Reduced motion keeps every state, label and announcement but shows chunks without fading, swaps labels instantly, reorders rows in place and stops the spinner and shimmer.

## Responsive behavior

- The card is up to 800px wide. From 560px the panes sit side by side; below that they become two tabs, each showing the model's name and status, so both statuses stay visible while you read one answer.
- Each answer scrolls inside a fixed height, so the card never grows while text streams. Code blocks scroll sideways inside the pane.
- Below 480px the Leaderboard button collapses to its icon with an accessible name, the shortcut hint hides, sample chips scroll sideways in one line, and the vote buttons form a two by two grid.

## Performance

- Streamed chunks are memoized spans that never re-render once shown, so long answers stay cheap.
- The first token clock ticks on animation frames only while a model thinks, and speed and cost are sampled twice a second only while it writes.
- Every stream has its own AbortController: Stop, a new prompt, Next round and Retry abort the work they replace, and the arena aborts everything on unmount.
- The leaderboard rows mount only while the popover is open. The simulation runs on requestAnimationFrame and pauses with the tab.

## Notes for AI

- Pass run to stream real models; it receives the ArenaModel, the prompt text and an AbortSignal. Timing (first token, speed) is measured from your stream on the client, so yield as soon as text arrives rather than buffering.
- Report the provider's usage by yielding { inputTokens, outputTokens } (with or without text) for exact cost; otherwise tokens are estimated from characters and cost uses the model's price.
- Throw from run to fail one pane; the other keeps streaming. ArenaRunError(message, { retryable: false }) hides the retry button.
- Persist votes in onVote. To show standings from earlier sessions, pass initialStandings keyed by model id; a tie counts as half a win and Both bad counts as a loss for each model.
- Give each model a color from --series-1 to --series-4 so providers read as families on the leaderboard; the default pool colors by provider.
- In blind mode cost and speed can hint at a model's identity; leave them for honest measurement, or pass the same price for every contestant if identity must stay fully hidden.
- Model names, marks and non-Anthropic prices in the default pool are sample content, not endorsements or published benchmarks.

## Related

- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Eval suite](https://uiarc.dev/components/blocks/eval-suite/markdown): Run an evaluation suite on a new version of an LLM feature against its baseline: results stream in case by case, and regressions and fixes are called out with the cases behind them.
- [Prompt studio](https://uiarc.dev/components/blocks/prompt-studio/markdown): One card for editing, testing and shipping a prompt template: variables as chips with sample values, a test run against the chosen model, and versions you can compare and promote to production.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
