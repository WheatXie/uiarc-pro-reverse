# AI setup wizard

> A three-step setup card for turning on an AI feature. You connect Notion, Google Drive, Confluence or Zendesk and watch each one sync. Then you pick the model, tone and guardrails, and ask a test question whose answer streams with numbered citations before you go live.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-setup-wizard
- Markdown: https://uiarc.dev/components/blocks/ai-setup-wizard/markdown

- Access: Arc Pro
- Registry id: `ai-setup-wizard`
- Source file: `registry/blocks/ai-setup-wizard/ai-setup-wizard.tsx`
- Built from: Button, SegmentedControl, Switch, TextShimmer
- Keywords: ai setup wizard, onboarding wizard, stepper, connect data sources, knowledge base sync, model picker, guardrails, test ai answer, citations, go live, ai feature onboarding, rag setup

Drop `<AiSetupWizard featureName="Ask Acme" />` into the first-run screen of your AI assistant or copilot. Connect your real sync job with `onConnect(source, report, signal)` and call `report(0..1)` as items arrive. Wire `onAsk(question, config, signal)` to your assistant so the test uses the unsaved config; it returns `{ text, citations }` with `[1]` markers in the text. `onGoLive(config, signal)` turns the feature on. `sources`, `models`, `tones`, `guardrails` and `suggestions` replace the sample content, and `onStepChange` and `onConfigChange` report progress. With no handlers it plays the simulated Ask Northwind flow in a loop, which stops on the first interaction. Set `autoPlay={false}` to turn the loop off.

## When to use

- Turning on an AI answers feature for a support, sales or internal knowledge team, like Intercom Fin, Zendesk AI or Notion Q&A.
- Onboarding admins to a copilot that needs data sources, a model choice and guardrails before it is enabled.
- A landing page or product tour section that shows the full setup in one short, looping clip.

## When not to use

- Configuring an agent's instructions, tools and files in depth: use agent-builder.
- Only choosing a model: use model-picker.
- A full conversation after setup: use ai-chat. The test step answers one question at a time.
- Monitoring a running agent: use agent-status.

## Installation

AI setup wizard is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-setup-wizard
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiSetupWizard } from "@/components/arc/blocks/ai-setup-wizard/ai-setup-wizard";

export function TurnOnAnswers() {
  return (
    <AiSetupWizard
      featureName="Ask Acme"
      onConnect={async (source, report, signal) => {
        const job = await startSync(source.id, { signal });
        for await (const progress of job.progress()) report(progress);
      }}
      onAsk={(question, config, signal) => askAssistant(question, config, { signal })}
      onGoLive={config => saveAssistant({ ...config, enabled: true })}
    />
  );
}
```

## API reference

### AiSetupWizard

A three step card for turning on an AI feature. Step 1 connects data sources (Notion, Google Drive, Confluence, Zendesk) with a live sync count and a progress line per row. Step 2 picks the model from three cards, a tone and three guardrail switches. Step 3 asks a test question; the answer streams in fast chunks with numbered citations that match the connected sources. Go live shows a drawn check and a summary of the setup, and the header flips from Draft to Live. With no props it plays the Ask Northwind support assistant sample end to end and loops until someone interacts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `featureName` | `string` | `"Ask Northwind"` | The AI feature being turned on. Used in the title ("Set up Ask Northwind") and the confirmation. |
| `audience` | `string` | `"Answers for 48 agents in Northwind support"` | One muted line under the title, such as who gets the feature. |
| `logo` | `ReactNode` | `<NorthwindMark />` | The company or product mark left of the title, drawn at 24px. Defaults to the Northwind sample mark; pass null to hide it. |
| `sources` | `WizardSource[]` | `defaultSources` | Sources for step 1: { id, name, description, count, unit, mark? }. Four fit the card. Defaults to Notion, Google Drive, Confluence and Zendesk with their marks. |
| `models` | `WizardModel[]` | `defaultModels` | Three model cards: { id, name, shortName?, note?, mark? }. Defaults to Claude Sonnet 5.5, GPT-6.1 Sol and Gemini 4 Argon. |
| `tones` | `WizardOption[]` | `defaultTones` | Tone options for the segmented control: { value, label }. Defaults to Concise, Friendly and Formal. |
| `guardrails` | `WizardGuardrail[]` | `defaultGuardrails` | Up to three switches: { id, label, defaultOn? }. Defaults to citing sources, handing off when unsure and redacting personal data. |
| `suggestions` | `string[]` | `defaultSuggestions` | Up to three sample questions offered in step 3 before the first test. |
| `defaultModelId` | `string` | – | The model selected at the start. Defaults to the first model. |
| `defaultTone` | `string` | – | The tone selected at the start. Defaults to the first tone. |
| `onConnect` | `(source: WizardSource, report: (progress: number) => void, signal: AbortSignal) => Promise<void>` | – | Connects and syncs one source. The row shows Connecting until the first report call, then the synced count and a progress line. Resolve when the sync is done; reject with an Error to show its message on the row with a Retry button. Simulated when left out. |
| `onAsk` | `(question: string, config: WizardConfig, signal: AbortSignal) => Promise<WizardAnswer>` | – | Answers a test question with the current config. Return { text, citations: { sourceId, title }[] } and write [1], [2] into text in citation order. The signal aborts when the person presses Stop. Simulated when left out. |
| `onGoLive` | `(config: WizardConfig, signal: AbortSignal) => Promise<void>` | – | Turns the feature on. Resolve to show the confirmation; reject to show the error in the footer with Try again. Simulated when left out. |
| `onStepChange` | `(step: number) => void` | – | Called with 0, 1 or 2 for the steps and 3 for the live confirmation. |
| `onConfigChange` | `(config: WizardConfig) => void` | – | Called with { sources, modelId, tone, guardrails } whenever a source finishes syncing or a setting changes. |
| `autoPlay` | `boolean` | – | Plays the whole flow on its own and loops, pausing off screen. The first pointer or key press inside the card stops it. Defaults to true when none of onConnect, onAsk or onGoLive is passed; always off with reduced motion. |
| `className` | `string` | – | Extra class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the stepper, row actions, settings, the composer and the footer buttons. |
| Arrow keys | Move between model cards and select the focused one (radio group). |
| Space | Toggles the focused guardrail switch. |
| Enter | Asks the typed question, or stops an answer that is streaming. |

## Accessibility

- The stepper is an ordered list of buttons; the current step has aria-current="step" and completed steps say so. Steps not reached yet are disabled.
- Model cards are a radiogroup with roving focus; each radio is labelled with the full model name and note.
- A polite status region announces step changes, finished syncs, answers and going live, and says when the sample is simulated.
- Status is never color alone: synced rows show a check and "Synced", errors an alert icon and text, the header a Draft or Live label with its icon.
- Focus stays on the footer button across steps because the same button changes its label; Back keeps its space when hidden so nothing shifts.

## Motion

- Steps slide 32px horizontally with a bounce free spring (visualDuration .24) and an opacity crossfade, inside a fixed height viewport, so the card never changes size.
- Stepper bars fill with scaleX and glyphs crossfade from number to check. Row meta, footer meta and status labels swap with one crossfade (100ms out, 160ms in, 2px rise).
- Answers stream three to six words every 34ms and each chunk only fades in; citations fade in after the stream with a 40ms stagger.
- The confirmation draws its circle and check with pathLength. Reduced motion drops travel, drawing and streaming (answers appear whole) and turns off the self playing demo.

## Responsive behavior

- Fills its container up to 600px. Below 480px the padding drops to 16px, stepper labels shorten to one word and model names may wrap to two lines.
- Below 400px the footer meta hides and only Back and the primary button remain; citation source names hide and titles truncate.
- Holds up at 360px with no horizontal scroll; the step viewport keeps one height at every width.

## Performance

- Plain DOM and CSS; motion animates opacity, small transforms and scaleX only.
- The self playing loop only counts time while the card is on screen (IntersectionObserver) and stops for good on the first interaction.
- Streaming appends one chunk span every 34ms with a CSS fade, so earlier text never re-renders its animation.

## Notes for AI

- Use it as the first run setup for an AI assistant, copilot or answer engine inside a SaaS product, where admins choose data, behavior and test before turning it on.
- Wire onConnect to your sync job and call report as it progresses; onAsk should call the real assistant with the config so the test reflects unsaved settings.
- Citation sourceIds must match WizardSource ids so the marks line up. Keep the answer under about 320 characters so it fits without scrolling.
- Marks are 20px square SVGs in rows and 14px in citations, and the header logo is 24px; mono marks should use currentColor so they follow the theme.
- Tabular figures are applied only to spans that hold nothing but a number (sync counts, percentages, citation numbers), so model names like GPT-6.1 keep normal spacing.
- Pass autoPlay={false} when embedding with real handlers if you also leave one of them out.

## Related

- [Agent builder](https://uiarc.dev/components/blocks/agent-builder/markdown): A card for setting up an AI agent: an inline editable name, a model picker, instructions, tool toggles with real app marks, and knowledge files with upload progress. A Configure / Test switch opens a compact chat that answers with the tools you turned on, and Publish ships the setup with a saved or unsaved state.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
