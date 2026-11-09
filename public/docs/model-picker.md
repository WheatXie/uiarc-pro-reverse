# Model picker

> A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.

- Type: Block
- Page: https://uiarc.dev/components/blocks/model-picker
- Markdown: https://uiarc.dev/components/blocks/model-picker/markdown

- Access: Arc Pro
- Registry id: `model-picker`
- Source file: `registry/blocks/model-picker/model-picker.tsx`
- Keywords: model picker, model selector, llm model switcher, ai model dropdown, reasoning effort, claude, gpt, gemini, choose model, ai settings

Drop it into a composer or settings row. Pass models, value and onChange to control the selection, and effort with onEffortChange for reasoning models; with no props it shows a sample lineup of current models.

## When to use

- Choosing the model and effort for a chat, an agent or a playground.
- A default model setting with a short review of what the chosen model costs and how much context it takes.

## When not to use

- Comparing two models' answers side by side; use model-arena.
- A full prompt box with attachments and tools; use ai-composer, which has its own model chip.
- Choosing from a plain list of options with no descriptions; use the select or dropdown-menu component.

## Installation

Model picker is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/model-picker
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ModelPicker } from "@/components/arc/blocks/model-picker/model-picker";

export function ComposerModel({ model, setModel, effort, setEffort }) {
  return (
    <ModelPicker
      value={model}
      onValueChange={id => setModel(id)}
      effort={effort}
      onEffortChange={setEffort}
      featured={["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]}
      showSummary={false}
    />
  );
}
```

## API reference

### ModelPicker

A model picker for an AI product. One quiet pill names the current model and its effort and opens a short menu: the featured models with a one line description each, an Effort submenu for reasoning models and every other model under More models, grouped by provider. Choosing a model closes the menu, the pill morphs to the new model, and the review underneath updates its description, context window, prices and effort. On phones the submenus open as pages inside the menu with a Back row.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `models` | `PickerModel[]` | `sampleModels` | The catalog. Each model has id (the API id the picker reports), name, provider, blurb (the short menu line), description, context, maxOutput, price { input, output } in USD per 1M tokens, released, and optional tag, effort { levels, default }, mark and color. Anthropic prices in the sample are real; every other price and limit is a sample value. |
| `providers` | `PickerProvider[]` | `sampleProviders` | Providers in the order More models groups them, each { id, name, mark, color? }. A model without its own mark uses its provider's. |
| `featured` | `string[]` | `["claude-opus-5-5", "claude-sonnet-5-5", "gpt-6.1-sol", "gemini-4-argon"]` | Model ids listed at the top of the menu, in order. Every other model sits under More models. With your own models and no featured list, the first four are featured. |
| `value` | `string` | – | The chosen model id (controlled). |
| `defaultValue` | `string` | – | The first chosen model when uncontrolled. Defaults to the first featured model. |
| `onValueChange` | `(id: string, model: PickerModel) => void` | – | Called when someone picks a model. |
| `effort` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | – | Effort for the chosen model (controlled). A level the model does not accept snaps to the nearest level it does. |
| `defaultEffort` | `Effort` | – | The first effort when uncontrolled. Defaults to the chosen model's own default. |
| `onEffortChange` | `(effort: Effort) => void` | – | Called when the effort changes, including when a new model snaps it to a level it accepts. |
| `open` | `boolean` | – | Whether the menu is open (controlled). |
| `defaultOpen` | `boolean` | `false` | Opens the menu on first render. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the menu opens or closes. |
| `showSummary` | `boolean` | `true` | Shows the review under the pill: description, context, input and output price, effort, and a short confirmation after each change. Turn it off to use the pill alone, for example inside a composer toolbar. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter, Space, Arrow down | On the pill, opens the menu and focuses the current model. |
| Arrow up / Arrow down | Moves through the models and rows. The highlight follows. |
| Type a letter | Jumps to the next model whose name starts with it. |
| Enter, Space | Chooses the highlighted model or effort and closes the menu. |
| Arrow right / Arrow left | Opens and closes the Effort and More models submenus, or their pages on phones. |
| Escape | Closes the menu and returns focus to the pill. |

## Accessibility

- Built on the Radix dropdown menu: the featured models, the effort levels and the other models are radio groups, so a screen reader announces each as checked or not.
- The pill's name includes the current model and effort, for example "Model: Claude Opus 5.5, medium effort. Change model".
- Each change is announced through a polite status region, and the review under the pill is a labelled section.
- Brand marks are decorative next to the model name and hidden from assistive technology.
- Focus returns to the pill when the menu closes. A pointer choice does not draw the keyboard focus ring; keyboard use keeps Arc's shared ring.

## Motion

- The menu opens from the pill edge with a short offset, a slight scale and a quick fade, and reverses from where it is if closed mid-open.
- One highlight glides between rows on the snappy spring for the pointer and jumps for the keyboard, so moving through the list never flickers.
- On a change, the pill's mark and name crossfade and the pill width springs to the new name, so it never snaps.
- The review's values crossfade in place with no character morphing; every slot keeps its height.
- On phones, moving between menu pages slides the content a few pixels and the menu height springs to the new page.
- Reduced motion swaps everything in place and keeps every state and announcement.

## Responsive behavior

- The pill truncates long names inside narrow toolbars and keeps its chevron visible.
- Below 640px the Effort and More models submenus become pages inside the same menu with a Back row, so nothing opens off screen.
- Long lists scroll inside the menu, and the review's four values fold into a two by two grid under 400px.

## Performance

- The menu mounts only while open. The highlight is one element per menu surface, moved with transforms.
- The pill width is measured with a ResizeObserver and animated once per change.

## Notes for AI

- Use it wherever a person chooses which model answers: a composer toolbar, a settings row or an API playground. Keep the featured list short (three to five) and put the rest under More models.
- Pass blurb as a few words on what the model is for; it is the only line under the name in the menu. Put the longer sentence in description for the review.
- Only models with an effort field show the Effort row. Effort levels are per model, and a level the new model does not accept snaps to the nearest one it does.
- Show real prices only for models you have verified. The sample marks non-Anthropic prices as sample values.

## Related

- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Model arena](https://uiarc.dev/components/blocks/model-arena/markdown): A blind side by side model comparison in one card: send one prompt to two models, watch both answers stream at the same pace, vote for the better one, then reveal which model wrote each.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Dropdown menu](https://uiarc.dev/components/dropdown-menu/markdown): A focused list of actions anchored to a trigger.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
