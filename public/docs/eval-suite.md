# Eval suite

> Run an evaluation suite on a new version of an LLM feature against its baseline: results stream in case by case, and regressions and fixes are called out with the cases behind them.

- Type: Block
- Page: https://uiarc.dev/components/blocks/eval-suite
- Markdown: https://uiarc.dev/components/blocks/eval-suite/markdown

- Access: Arc Pro
- Registry id: `eval-suite`
- Source file: `registry/blocks/eval-suite/eval-suite.tsx`
- Built from: Button, Text shimmer
- Keywords: eval, evals, evaluation suite, llm evaluation, regression testing, llm judge, rubric, test cases, pass rate, baseline, prompt regression, model comparison, diff, ai quality, ci for prompts

Pass cases, candidate, baseline and run, which streams graded results, to show your own evals; with no props it runs a sample suite.

## When to use

- Regression testing an LLM feature before shipping a new prompt, model or agent version.
- CI style eval dashboards where people need the overall score, the per category picture and the exact cases that broke in one place.
- Triage of failing cases with an LLM judge: read both outputs, check the rubric, then accept the change or file an issue.

## When not to use

- Use prompt-studio to edit a prompt and try it on one test case at a time.
- Use model-arena for a blind side by side vote between models on a single prompt.
- Use agent-run to follow one agent run step by step rather than scoring a suite.
- Use token-inspector to look at token level probabilities of a single reply.

## Installation

Eval suite is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/eval-suite
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { EvalSuite } from "@/components/arc/blocks/eval-suite/eval-suite";

export function SupportAgentEvals({ suite, history }) {
  return (
    <EvalSuite
      suite={suite}
      runs={history}
      onRun={async function* (suite, { signal, started }) {
        const response = await fetch(`/api/evals/${suite.name}/runs`, { method: "POST", signal });
        for await (const event of readEvents(response)) {
          if (event.type === "started") started(event.caseId);
          if (event.type === "scored") yield event.result; // { caseId, outcome, output, scores, rationale, costUsd }
        }
      }}
      onTriage={async (caseId, action) => {
        if (action === "issue") return (await createIssue(caseId)).key; // "SUP-2481"
        await markExpected(caseId);
      }}
    />
  );
}

// A case with a drilldown. Cases without input still score and list, without the side by side view.
const refundCase = {
  id: "refunds-02",
  category: "Refunds",
  title: "Refund after partial shipment",
  baseline: "pass",
  input: "Only 2 of my 3 items arrived (order #48213). Can I get my money back for that part?",
  expected: "Refund only the missing item, not the whole order.",
  baselineOutput: "I've refunded $34.00 for the candle set to your original payment method.",
  baselineScores: [5, 5, 4, 5], // one per rubric criterion
};
```

## API reference

### EvalSuite

One card for running an evaluation suite on a new version of an LLM feature against its baseline. The header names the feature, the candidate and baseline versions with their models, the case count and the judge model, with Run beside it. While the run streams, one row per category fills with a small cell per case (pass, fail or error, each with its own glyph), the score counts up next to the baseline with the delta in points, and each category bar fills with a ghost tick at the baseline value. Cost, time and a sparkline of the last runs sit in the summary. The case list filters to All, Failed, Regressions or Improved; opening a case shows the input, the expected behavior, the baseline and new outputs side by side with a word diff, and the judge's rubric scores and rationale, then lets you mark it as expected or open an issue.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `suite` | `EvalSuiteData` | `sampleSuite` | The suite: name, candidate { version, model }, baseline { version, model }, judge model, optional categories (row order), rubric (criteria the judge scores 1 to 5), cases and an estimate { costUsd, seconds } shown before the first run. A model is { name, brand?: "claude" \| "openai", mark?: ReactNode }. Each case has id, category, title and its baseline outcome; add input, expected, baselineOutput and baselineScores to give it a drilldown. |
| `runs` | `EvalRunRecord[]` | `sampleRuns` | Earlier runs, oldest first, each { id, label, score, date? } with the score in percent. The sparkline shows the last seven plus the current run, and rings the last one as the baseline. |
| `onRun` | `(suite: EvalSuiteData, context: { signal: AbortSignal; started: (caseId: string) => void }) => AsyncIterable<EvalCaseResult> \| Promise<EvalCaseResult[]>` | – | Runs the suite. Yield each EvalCaseResult { caseId, outcome, output?, scores?, rationale?, error?, costUsd? } as it is scored to fill the grid live, or resolve every result at once. Call started(caseId) to show a case as in flight. Stop aborts the signal. Throw to show the failed state with Try again. Without it, the run is simulated on eight workers and announced as simulated. |
| `onTriage` | `(caseId: string, action: "expected" \| "issue") => void \| string \| Promise<void \| string>` | – | Called by Mark as expected and Open issue. Return or resolve an issue key such as "SUP-2481" for an issue; reject to restore the buttons. Without it, triage is simulated and says so. |
| `defaultFilter` | `"all" \| "failed" \| "regressions" \| "improved"` | `"regressions"` | The filter the case list opens with. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Run, the run history, the case filter, each case row, Show more, and inside an open case the triage buttons. |
| Enter, Space | On Run, starts the run; while running the same button stops it. On a case row, opens or closes its drilldown. On Mark as expected or Open issue, triages the case and moves focus to Undo or the confirmation that replaces the buttons; Undo brings the buttons back with focus on the first. |
| Arrow left / Arrow right | On the case filter, moves between All, Failed, Regressions and Improved. On the run history, steps through the runs and reads out each version, score and date. |
| Home / End | On the case filter or the run history, jumps to the first or last item. |
| Escape | On the run history, returns the readout to the latest run. |

## Accessibility

- Each category row is one image with a full text summary (passed, failed, errors, not yet scored, percent and the change against the baseline), so the 120 cells never become 120 announcements.
- Outcomes never rely on color: pass, fail and error each have their own glyph, a regression is the only solid cell, and every list row spells out both outcomes in hidden text.
- Case rows with a drilldown are buttons with aria-expanded and aria-controls; the drilldown is a labelled region. Rows without one are plain text.
- The case filter is a radio group with roving focus. The run history is a slider whose value text names the run, its score and date.
- Run start, finish (score, delta, regressions, improvements), stop, failure and each triage are announced in a polite status region, including when a run or an issue is simulated.
- The score and every category percent count with tabular numerals; hidden text carries the final value so screen readers never read a number mid count.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Cells fill as results arrive: the background tints over 240ms and the glyph scales in from 40 percent with an ease out. Cases in flight breathe once a second.
- The score, category percents and cost count to their values on a critically damped spring, so a burst of results reads as one smooth count; a new run resets them at once.
- Bars fill with a clip-path tween and tint green or red only when the run finishes; the deltas fade up 3px at the same moment.
- The current run lands on the sparkline as a short drawn segment and a dot that scales in after it.
- Rows that appear mid run, the drilldown and Show more open on the smooth spring with no overshoot. The filter highlight glides on a critically damped spring and the list height follows the new filter.
- Run, Stop and Run again crossfade in place while the pill width follows the measured label.
- Reduced motion fills cells, numbers, bars and panels immediately, stops the breathing, and keeps every state and announcement.

## Responsive behavior

- The card is 760px wide at most. From 680px a category is one line: label, 24 cells and its bar; below that the cells move under the label, and below 480px they wrap into two rows of 12.
- Below 480px the header's model chips become a small aligned table (v12, v11 and Judge on the left, the model on the right) and the subtitle takes the full width under the title and Run.
- The summary goes from three columns to two at 620px and to one at 420px, with cost and time side by side.
- The two outputs share one frame split down the middle and stack below 560px; the drilldown labels move above their text. Below 480px each rubric row puts its name, score and change on one line with the bar under them.
- Case categories hide below 480px, triage tags keep only their icon, and titles truncate with the full title in hidden text.
- The filter drops its counts below 480px and tightens to fit 320px without scrolling.

## Performance

- Scores, counts and per category numbers are derived from one results map in memoized passes; cells only change attributes, and their fills are CSS transitions.
- Counting numbers write their text through a motion value, so the spring never re-renders React per frame.
- The word diff runs once per opened case and is memoized on the two outputs.
- The simulation uses timers on eight workers and clears them on stop and unmount.

## Notes for AI

- Use it when a team compares a candidate version of a prompt, model or agent against a baseline on a fixed suite and needs to know which cases regressed, not only the average.
- Score is the pass rate over all cases in percent; the delta compares it with the baseline pass rate computed from each case's baseline outcome. A regression is a case that passed on the baseline and does not pass now; improved is the reverse.
- Stream results from onRun as an async iterable for the live grid. Results may arrive in any order; the regression and improved lists keep arrival order while the run streams.
- Rubric scores are 1 to 5, one per suite.rubric criterion, for both baselineScores and result scores. The rubric bars reuse the category bar: new score as the fill, baseline as the ghost tick.
- When the two replies share little wording, the drilldown shows both in full without highlights instead of striking through the whole baseline.
- Model marks: pass brand "claude" or "openai" for the built-in marks, or any inline SVG as mark. The sample uses Claude Sonnet 5.5 against GPT-6 Luna with Claude Opus 5.5 as judge; costs and timings are sample values.

## Related

- [Prompt studio](https://uiarc.dev/components/blocks/prompt-studio/markdown): One card for editing, testing and shipping a prompt template: variables as chips with sample values, a test run against the chosen model, and versions you can compare and promote to production.
- [Model arena](https://uiarc.dev/components/blocks/model-arena/markdown): A blind side by side model comparison in one card: send one prompt to two models, watch both answers stream at the same pace, vote for the better one, then reveal which model wrote each.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
