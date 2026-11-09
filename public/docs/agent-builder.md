# Agent builder

> A card for setting up an AI agent: an inline editable name, a model picker, instructions, tool toggles with real app marks, and knowledge files with upload progress. A Configure / Test switch opens a compact chat that answers with the tools you turned on, and Publish ships the setup with a saved or unsaved state.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-builder
- Markdown: https://uiarc.dev/components/blocks/agent-builder/markdown

- Access: Arc Pro
- Registry id: `agent-builder`
- Source file: `registry/blocks/agent-builder/agent-builder.tsx`
- Built from: Button, Segmented control, Switch, Text shimmer, Radix dropdown menu (radio items)
- Keywords: agent builder, configure ai agent, gpt builder, assistant settings, ai agent config, tools toggle, knowledge base upload, system prompt editor, test agent chat, publish agent, intercom fin, zapier agents

Drop it into the settings screen of a support, sales or ops agent. Pass defaultConfig (or a controlled config with onConfigChange) and publishedConfig from your server, so unsaved changes are measured against what is live. Wire onPublish(config, signal) to save the setup, onUpload(file, report, signal) to upload knowledge files with progress, and onSend(message, config, signal) to answer test messages with the unsaved setup. onSend returns { text, calls }, and each call's tool id must match an AgentTool id (or "knowledge") so its chip gets the right mark. models and tools take your own lists with 16px SVG marks. Leave any callback out and that part is simulated.

## When to use

- Letting customers configure their own AI agent inside your product, like Intercom Fin, Zapier agents or an OpenAI GPT builder.
- Internal admin screens where ops teams tune instructions, tools and knowledge for a support or billing agent.
- A product tour or landing section that shows how an agent is set up and tested in one place.

## When not to use

- Running or monitoring an agent in production: use agent-status or agent-routines.
- Approving actions an agent wants to take: use agent-approvals.
- A full chat product: use ai-chat. The Test view here is a compact preview, not a conversation app.
- Only choosing a model: use model-picker.

## Installation

Agent builder is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-builder
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentBuilder, sampleAgentConfig } from "@/components/arc/blocks/agent-builder/agent-builder";

export function SupportAgentSettings() {
  return (
    <AgentBuilder
      defaultConfig={sampleAgentConfig}
      onPublish={async (config, signal) => {
        const response = await fetch("/api/agents/billing", { method: "PUT", body: JSON.stringify(config), signal });
        if (!response.ok) throw new Error("Server rejected the config");
      }}
      onSend={async (message, config, signal) => {
        const response = await fetch("/api/agents/billing/test", { method: "POST", body: JSON.stringify({ message, config }), signal });
        return response.json(); // { text, calls: [{ tool: "stripe", label: "Searched customers", result: "2 charges" }] }
      }}
    />
  );
}
```

## API reference

### AgentBuilder

Configure an AI agent in one card: an inline editable name over its workspace and version, a model picker, instructions with a character count, tools as toggle rows, and knowledge files with upload progress. A Configure / Test switch swaps the body for a compact chat that answers with the configured model and tools, and Publish ships the config with an unsaved, publishing, failed and published state. With no props it plays the Lumen billing assistant sample with simulated uploads, replies and publishing.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `config` | `AgentConfig` | – | Controlled config: { name, tint, modelId, instructions, tools, files }. tint (1 to 4) colors the agent's mark beside its replies in Test. Pair with onConfigChange. |
| `defaultConfig` | `AgentConfig` | `sampleAgentConfig` | Starting config when uncontrolled. Passing it turns off the sample's auto upload. |
| `onConfigChange` | `(config: AgentConfig) => void` | – | Called with the next config on every edit, toggle, model change and file update. |
| `publishedConfig` | `AgentConfig` | – | The config that is live now. Unsaved changes are measured against it, so reverting an edit clears the unsaved state. Defaults to the starting config. |
| `models` | `AgentModel[]` | `defaultModels` | Models in the picker: { id, name, note?, mark? }. Defaults to Claude Sonnet 5.5, Claude Opus 5.5, Claude Haiku 5.5, GPT-6.1 Sol and Gemini 4 Argon with their marks. |
| `tools` | `AgentTool[]` | `defaultTools` | Tools the agent can be given: { id, name, description, mark? }. Defaults to Gmail, Slack, Linear, Notion, Google Calendar and Stripe. |
| `onPublish` | `(config: AgentConfig, signal: AbortSignal) => Promise<void>` | – | Saves and ships the config. Resolve to bump the version and show the published state; reject to show "Couldn't publish". Simulated when left out. |
| `onUpload` | `(file: File, report: (progress: number) => void, signal: AbortSignal) => Promise<void>` | – | Uploads one knowledge file. Call report with 0 to 1 as bytes go out; reject with an Error to mark the row failed with its message and a retry button. The signal aborts when the row is removed. Simulated when left out (files over 20 MB fail). |
| `onSend` | `(message: string, config: AgentConfig, signal: AbortSignal) => Promise<TestReply>` | – | Answers a Test message. Return { text, calls?: { tool, label, result? }[] }; calls render as tool chips with the tool's mark before the reply streams. Defaults to simulateReply, which follows the enabled tools. |
| `version` | `number` | `12` | Published version shown under the name. Counts up after each successful publish. |
| `workspace` | `string` | `"Lumen support"` | Short line under the name, such as the workspace or team. |
| `maxInstructions` | `number` | `2000` | Instruction length limit. The count turns to the warning color past 90%. |
| `accept` | `string` | `".pdf,.md,.txt,.csv,.docx,.html"` | Accepted file types for the knowledge file picker. |
| `mode` | `"configure" \| "test"` | – | Controlled view. Pair with onModeChange. |
| `defaultMode` | `"configure" \| "test"` | `"configure"` | Starting view when uncontrolled. |
| `onModeChange` | `(mode: AgentBuilderMode) => void` | – | Called when the Configure / Test switch changes. |
| `className` | `string` | – | Extra class on the card. |

### simulateReply

The built in reply function used when onSend is left out. Matches billing, bug and booking requests and changes its answer and tool calls to the tools that are on, so it is useful for demos and tests.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `message` (required) | `string` | – | The test message. |
| `config` (required) | `AgentConfig` | – | The current config. Disabled tools are never called. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the name, view switch, model picker, instructions, each tool switch, file actions and Publish. The hidden view is inert and skipped. |
| Arrow keys | Move between Configure and Test on the view switch, and between models in the open picker. |
| Enter / Space | Opens the model picker, chooses a model, toggles a tool, and presses buttons. |
| Escape | Closes the model picker and returns focus to it. In the name, restores the name from before editing. |
| Enter (in the name) | Finishes editing the name. |
| Enter (in Test) | Sends the message. While a reply runs, the send button becomes Stop. |

## Accessibility

- The card is a labelled section; the name field, instructions and every tool switch have labels, and the tool row text is part of the switch label so the whole row is clickable.
- The model picker is a Radix menu with radio items, so the selected model is announced as checked.
- Upload progress uses role="progressbar" with a value; failed uploads show an icon and the error message, never color alone.
- Status changes (published, upload done or failed, reply ready) go to a polite live region, and simulated actions say so: "Simulated, nothing was deployed".
- The inactive view is inert and aria-hidden, so screen readers and the Tab key only reach what is visible.

## Motion

- Configure and Test crossfade in the same box (100ms out, 160ms in); Test overlays Configure, so the card never changes size.
- Text swaps (model name, version, footer status, reply meta) are a single crossfade with a 2px rise. No blur or scramble.
- Test replies: a short Thinking shimmer, tool chips that shimmer while running and reveal their result in place, then fast chunked streaming of three to six words every 34ms, each chunk only fading in.
- Added and removed files animate their measured height with a bounce free spring; switches and the segmented control use the shared bounce free presets.
- Reduced motion drops the rises, height animation and streaming (replies appear whole) but keeps every state and status change.

## Responsive behavior

- Fills its container up to 640px. Below 480px the padding drops to 16px and the model picker narrows; the agent name, tool descriptions and file names truncate with an ellipsis. The Configure / Test switch stays beside the name down to 300px of card width, then takes its own row.
- Holds up at 360px without horizontal scroll; the Test view scrolls its own thread and keeps the composer pinned.
- Tool rows and buttons are at least 28px tall targets inside 52px rows for touch.

## Performance

- Plain DOM and CSS; motion only animates opacity, small transforms and the height of added or removed file rows.
- The sample upload starts only once the card is on screen. Text shimmers pause off screen.
- Streaming appends one chunk every 34ms; each chunk is its own span so earlier text never re-renders its animation.

## Notes for AI

- Use it for the settings screen of a support, sales or ops agent: one card that holds the whole config with a built in test loop.
- Wire onPublish to persist the config and onSend to call your agent runtime with the unsaved config, so people can test before they publish.
- Pass publishedConfig from the server so the unsaved state compares against what is live; files still uploading or failed do not count as changes.
- Tool ids in TestReply.calls must match AgentTool ids (or "knowledge" for a file lookup) so the chips get the right mark.
- Keep marks 16px square SVGs; mono marks should use currentColor so they follow the theme.

## Related

- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
