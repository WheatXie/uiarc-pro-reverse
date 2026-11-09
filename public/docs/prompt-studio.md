# Prompt studio

> One card for editing, testing and shipping a prompt template: variables as chips with sample values, a test run against the chosen model, and versions you can compare and promote to production.

- Type: Block
- Page: https://uiarc.dev/components/blocks/prompt-studio
- Markdown: https://uiarc.dev/components/blocks/prompt-studio/markdown

- Access: Arc Pro
- Registry id: `prompt-studio`
- Source file: `registry/blocks/prompt-studio/prompt-studio.tsx`
- Built from: Avatar, Button, Copy button, Kbd, Popover
- Keywords: prompt studio, prompt editor, prompt template, prompt management, prompt versioning, llm playground, template variables, test cases, production prompt, promote to production, prompt diff, system prompt, model effort, streaming reply

Pass template, variables and versions to load your own prompt, run to call your model, and onPromote to ship a version; with no props it edits a sample support prompt.

## When to use

- A settings or admin page where a support lead or engineer tunes the prompt behind one AI feature and tests it on real cases.
- Prompt management that needs a compact version history with authors, a diff against an earlier version and a visible production pointer.
- Any LLM feature with template variables filled from records, such as a support reply, a summary or a classifier prompt.

## When not to use

- Use ai-chat for an end user conversation; this card edits templates, not messages.
- Use model-arena to compare the replies of several models side by side on one prompt.
- Use eval-suite to score a prompt across many cases with graders and pass rates.
- Use model-picker when the only job is choosing a model and effort.

## Installation

Prompt studio is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/prompt-studio
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PromptStudio } from "@/components/arc/blocks/prompt-studio/prompt-studio";

export function SupportPrompt({ prompt, cases }) {
  return (
    <PromptStudio
      name={prompt.name}
      versions={prompt.versions}
      productionId={prompt.productionId}
      variables={["customer_name", "order_id", "policy"]}
      testCases={cases}
      onRun={async function* (request, signal) {
        const response = await fetch("/api/prompt-run", { method: "POST", body: JSON.stringify(request), signal });
        const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          yield value;
        }
      }}
      onPromote={versionId => setProduction(prompt.id, versionId)}
    />
  );
}

// A version is plain text with {{variables}}.
const version = {
  id: "v4", label: "v4", createdAt: "2026-10-16T15:20:00Z", message: "Escalate when the policy falls short",
  author: { name: "Hannah Walsh", avatar: "/media/people/hannah-walsh.svg" },
  system: "You are a support agent for Fernwood. Follow this policy exactly: {{policy}}",
  user: "Reply to the latest message from {{customer_name}} about order {{order_id}}.",
};
```

## API reference

### PromptStudio

One card for editing, testing and shipping a prompt template. The header holds the prompt's name, a version chip (a menu of versions with compare, promote to production and undo) and a model chip (model and effort). System and User tabs show the template with {{variable}} placeholders as atomic chips, each variable in its own series color. A row of colored fields fills the variables from saved test cases, and Run streams the reply into a quiet panel at the foot with latency, tokens and cost. Compare turns the editor into an inline word diff.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `string` | `"Support reply"` | Name of the prompt, shown in the header. |
| `versions` | `PromptVersion[]` | `sampleVersions` | Saved versions, newest first. Each has id, label ("v4"), message, author ({ name, avatar? }), createdAt (ISO date) and the system and user text. |
| `versionId` | `string` | – | The version open in the editor; the chip shows its label. Defaults to the newest version. |
| `productionId` | `string \| null` | – | The version production serves; it carries the Production marker. Defaults to the open version. |
| `template` | `{ system: string; user: string }` | – | The draft the editor opens with. Defaults to the open version's text. |
| `variables` | `string[]` | – | Variable order for colors and fields: the first four take --series-1 to --series-4, then the colors repeat. Variables found in the text but not listed are added after. Defaults to the order they appear in the open version. |
| `testCases` | `PromptTestCase[]` | `sampleCases` | Saved test cases as { id, label, values }, where values maps a variable name to its value. The first case is loaded on mount. Keep labels short: the cases share one segmented control. |
| `models` | `PromptModel[]` | `studioModels` | Models for the model menu: id, name, short (chip label), mark ("claude" \| "openai" \| "gemini"), input and output price per million tokens, sample (marks illustrative prices) and defaultEffort. |
| `defaultModel` | `string` | `"claude-sonnet-5-5"` | Id of the model selected on first render. |
| `defaultEffort` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | – | Effort selected on first render. Defaults to the model's own default (high for Claude Sonnet 5.5). Choosing another model resets effort to that model's default. |
| `now` | `string \| number \| Date` | – | Reference moment for the relative dates in the version menu. Defaults to the current time, or to Oct 20, 2026 for the sample versions so the demo never ages. |
| `onRun` | `(request: PromptRunRequest, signal: AbortSignal) => Promise<string \| AsyncIterable<string>> \| AsyncIterable<string>` | – | Runs the prompt. The request carries the raw template, the rendered template, the values, model, effort, test case id and version id. Return the whole reply or an async iterable of text deltas; throw to show the error state with Retry. Stop aborts the signal. Without it, runs are simulated and labelled as such. |
| `onPromote` | `(versionId: string, previousId: string \| null) => void` | – | Called when a version is promoted to production, and again with the ids swapped when the promotion is undone. |
| `onTemplateChange` | `(template: { system: string; user: string }) => void` | – | Called with the draft after every edit, for autosave. |
| `className` | `string` | – | Class on the root element. |

### PromptEditor

The chip editor on its own, exported from prompt-editor.tsx. A plain text contenteditable where the string is the model: every edit is applied to the string and the DOM is rebuilt from it, so chips cannot be split and copy and paste keep the braces.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` (required) | `string` | – | The template text, with placeholders written as {{name}}. |
| `onChange` (required) | `(value: string) => void` | – | Called with the new text after every edit. Placeholders are normalized to {{name}} without inner spaces. |
| `variables` (required) | `string[]` | – | Names offered after typing {{. |
| `toneOf` (required) | `(name: string) => number` | – | Color slot (1 to 4) for a variable, read as --series-1 to --series-4. |
| `label` (required) | `string` | – | Accessible name of the text box. |
| `missing` | `string[]` | – | Variables without a value; their chips draw a dashed outline. |
| `activeVariable` | `string \| null` | – | A variable to light up, for example while its value field has focus. |
| `flash` | `{ name: string; at: number } \| null` | – | Flashes every chip of a variable once. Pass a new `at` to flash again, for example on each keystroke in its field. |
| `onChipClick` | `(name: string) => void` | – | Called when a chip is clicked. |
| `onSubmit` | `() => void` | – | Called on Mod+Enter. |
| `placeholder` | `string` | – | Shown while the text is empty. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Mod+Enter | Runs the prompt for the selected test case from anywhere in the card, including the editors and the variable fields. |
| {{ | In the editor, opens the list of known variables. Arrow up and down move, Enter or Tab inserts the variable as a chip, Escape closes the list. Typing a new name then }} creates a variable and a field for it. |
| Backspace, Delete | Remove a chip whole when the caret is beside it. Option or Ctrl with Backspace removes a word. |
| Mod+Z, Shift+Mod+Z | Undo and redo inside the editor. Typing within a short pause is one step. |
| Arrow left / Arrow right | On the System and User tabs, the test case control and the effort control, move the selection. |
| Arrow up / Arrow down | In the version menu and the model menu, move between rows and select them. |
| Escape | Closes an open menu. In compare mode, returns to editing. |
| Tab | Moves through the version chip, model chip, tabs, editor, each variable field, the test cases, Run, and Copy or Retry. |

## Accessibility

- The editor is a role="textbox" with aria-multiline and an accessible name per tab; while the {{ list is open it points at the list with aria-controls and at the highlighted option with aria-activedescendant.
- System and User are real tabs with tabpanels. The hidden panel is inert, so it leaves the tab order and the reading order.
- Every variable field has a visible label in its variable's color, paired with a colored dot. Clicking a chip focuses its field.
- Status is never color alone: the version chip says Production or Latest, the run status pairs an icon with Reply, Stopped or Run failed, and an empty variable's chips switch to a dashed outline.
- The diff uses ins and del elements with visually hidden Added and Removed prefixes, plus a visible + or minus sign before each change and a strikethrough on removals.
- Version rows and model rows are radios in a labelled group. The Production marker is text, and the menu's status line says which version production serves.
- Runs, results, errors, promotions, undos and compare mode are announced through one polite status region, including when a run is simulated.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring, inset on menu rows and segmented options.

## Motion

- Promoting a version glides the Production marker from its old row to the new one on the critically damped smooth spring, with no overshoot. Undo glides it back.
- The reply streams in chunks of three to six whole words every 40ms on a requestAnimationFrame clock, about 100 words a second, and a backlog widens the chunks. Each chunk only fades in over 150ms; settled text never moves. Thinking lasts 0.5 to 1.2 seconds by effort.
- The output panel follows its content's height on the smooth spring. A rerun holds the panel at its current height until the new reply is in, then settles, so nothing collapses and regrows.
- Labels that change (version state, model name, effort, run status, the footer) use one crossfade: the old label fades out in 100ms while the new one fades in from 2px over 160ms, and the chip width follows on a fast spring without bounce. No blur, no per-letter motion.
- Tab and test case highlights slide on a critically damped spring. Token counts roll their digits with tabular numerals in a fixed slot. Editing a value flashes its chips once.
- The working label uses a calm shimmer that stops on Reply, Stopped or Run failed.
- Reduced motion removes the glides, the chunk fade, the shimmer and every height animation while keeping each state, label and announcement.

## Responsive behavior

- The card is up to 760px wide and reads well from 320px. It uses container queries, so it adapts to its slot, not the viewport.
- Below 560px of container width the variable fields fall into two columns, and below 340px into one.
- Below 480px the test cases and Run each take a full row, and the model chip wraps under the title.
- System and User share one editor slot sized to the taller text, so switching tabs never changes the card's height.

## Performance

- The editor rebuilds a few dozen DOM nodes per keystroke from the string, well under a millisecond for prompt sized text.
- The word diff trims the shared start and end before its longest common subsequence pass, so typical edits compare a few dozen tokens.
- Streaming appends one chunk per tick and never re-renders earlier chunks; the clock stops when the reply is complete, stopped or failed.
- Only one run is active at a time; starting another cancels the first and aborts its signal.

## Notes for AI

- Choose it when a team edits a prompt template, tries it on saved cases and promotes a version to production, inside a product page or settings screen.
- Write placeholders as {{name}} in the system and user text. Pass `variables` to fix the color order; values in test cases are matched by name.
- Wire onRun to stream real replies. Return an async iterable of text deltas, or a promise of the full text, and respect the AbortSignal: Stop aborts it. The footer estimates tokens and cost from the model prices you pass.
- Keep onPromote as the source of truth: the card updates its own pointer optimistically and calls back, and Undo calls it again with the ids swapped.
- Model prices outside Anthropic in the sample list are illustrative. Pass your own models with real prices for cost estimates.
- Without props it renders the full demo: a Fernwood support reply prompt with four versions, v4 in production and three saved cases. Without onRun, the first run of the Past window case returns a simulated overload error so the retry path can be seen.

## Related

- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Model arena](https://uiarc.dev/components/blocks/model-arena/markdown): A blind side by side model comparison in one card: send one prompt to two models, watch both answers stream at the same pace, vote for the better one, then reveal which model wrote each.
- [Eval suite](https://uiarc.dev/components/blocks/eval-suite/markdown): Run an evaluation suite on a new version of an LLM feature against its baseline: results stream in case by case, and regressions and fixes are called out with the cases behind them.
- [AI inline edit](https://uiarc.dev/components/blocks/ai-inline-edit/markdown): A document you edit with AI in place: ⌘K on a selection, watch the rewrite stream in as a diff, accept each change, and Tab through ghost text.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
