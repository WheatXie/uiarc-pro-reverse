# Agent memory

> One card for what an assistant remembers about you: filter and search memories, edit or forget one in place, and turn saved memories and chat history on or off.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-memory
- Markdown: https://uiarc.dev/components/blocks/agent-memory/markdown

- Access: Arc Pro
- Registry id: `agent-memory`
- Source file: `registry/blocks/agent-memory/agent-memory.tsx`
- Built from: Avatar, Button, Switch, Text shimmer, Tooltip
- Keywords: memory, assistant memory, agent memory, saved memories, chat history, personalization, memory updated, remember, forget, undo, filter, settings, preferences, llm, ai, privacy, user profile

Pass memories and the onEdit, onForget and onToggle callbacks to wire your memory store; with no props it shows a sample set.

## When to use

- Settings for an assistant that remembers people across chats, where people need to see, filter, search, correct and delete what it knows.
- Showing the moment an assistant saves something from a chat, with a way to see where it was filed.
- Any small personal knowledge store grouped by kind, where each entry is a sentence with a source and an undoable delete.

## When not to use

- Use knowledge-base for documents and files an agent retrieves from, rather than short facts about the user.
- Use context-window to show what fills a single conversation's token budget, rather than what persists across chats.
- Use ai-chat for the conversation itself; this card only receives what the chat noted.
- Use agent-routines for scheduled instructions the agent runs, not facts it recalls.

## Installation

Agent memory is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-memory
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentMemory, type MemoryItem } from "@/components/arc/blocks/agent-memory/agent-memory";

export function MemorySettings({ memories, userId }: { memories: MemoryItem[]; userId: string }) {
  return (
    <AgentMemory
      memories={memories}
      captured={null}
      classify={text => fetch("/api/memory/classify", { method: "POST", body: text }).then(r => r.json()).then(r => r.group)}
      onChange={async (next, change) => {
        if (change.type === "forget") await deleteMemory(userId, change.memory.id);
        else await saveMemory(userId, change.memory); // throw to show the error in place
      }}
      onToggle={(setting, on) => updatePreference(userId, setting, on)}
    />
  );
}

// Offer what the assistant noted in the current chat as a "Memory updated" pill.
<AgentMemory captured={[{ note: "Noted: you prefer pnpm over npm", memory: { id: "m-pnpm", group: "preferences", text: "Prefers pnpm over npm in install commands" } }]} />
```

## API reference

### AgentMemory

One card for what an assistant remembers about you. The header shows how full memory is and two switches for saved memories and chat history. A row of filter pills (All, About you, Preferences, Projects, People) and a search button that widens into a field sit over the list, where each memory is one plain sentence; hovering or focusing a row reveals its source and the Edit and Forget actions in reserved space. A Memory updated pill from the current chat files its memory into the right group with a glide and a soft highlight, Forget leaves an undo bar with a countdown, and the field at the bottom sorts a typed memory into its group.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `memories` | `MemoryItem[]` | `sampleMemories` | The saved memories: { id, text, group, source, person? }. text is one sentence without a closing period; group is "about", "preferences", "projects" or "people"; source is { kind: "chat" \| "manual", date (ISO), href? } and reads From a chat or Added by you; person is { name, src? } and shows a small portrait. Newest first within a group. Passing a new array replaces what the card shows, so it can be controlled through onChange. |
| `captured` | `CapturedMemory[] \| null` | `sampleCaptured` | Memories the assistant just noted in the current chat: { note, memory }. The first one not yet filed shows as a Memory updated pill with its note, such as "Noted: you prefer pnpm over npm". Pressing it files the memory into its group (switching the filter or clearing the search first if needed), then the pill reads Saved to Preferences and folds away. Pass null or [] to hide the pill. |
| `onChange` | `(memories: MemoryItem[], change: MemoryChange) => void \| Promise<void>` | – | Called after every change with the full new list and what changed: { type: "capture" \| "add", memory }, { type: "edit", memory, previous } or { type: "forget", memory }. Reject from an add or an edit to show the message in place and keep the old state. Forgets are reported only after their undo window closes. Without it, edits simulate a short save. |
| `onToggle` | `(setting: "savedMemories" \| "chatHistory", on: boolean) => void` | – | Called when either switch changes. |
| `settings` | `{ savedMemories?: boolean; chatHistory?: boolean }` | `both on` | Starting values for the switches. With saved memories off the list dims under a short note and the pill is hidden; each switch's line below its title says what the current setting does. |
| `classify` | `(text: string) => MemoryGroupId \| Promise<MemoryGroupId>` | `guessGroup` | Sorts a typed memory into a group, for example with a model call. The default is a keyword guess that checks people first, then preferences, projects and finally about you, and the status region says the preview guessed with keywords. |
| `groups` | `MemoryGroup[]` | `memoryGroups` | The groups in filter order, each { id, label, empty } where empty is the line a filter shows when its group holds nothing. |
| `capacity` | `number` | `sampleCapacity` | Characters of memory the assistant can hold. The meter shows the share in use, turns to the warning color with an icon at 90%, and the add field refuses new memories when full. The sample sets it so the demo starts 62% full. |
| `assistantName` | `string` | `"Claude"` | The assistant's name in the subtitle and the notes. |
| `undoSeconds` | `number` | `5` | How long a forgotten memory can be restored. |
| `className` | `string` | – | Class on the outer wrapper. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the two switches, the selected filter pill, the search button, the Memory updated pill, each memory's Edit and Forget buttons (a row's source and actions appear while it has focus), and the add field. |
| Arrow left, Arrow right, Home, End | Move between the filter pills; only the selected pill is a tab stop. |
| Enter, Space | Press the focused control: toggle a switch, file the captured memory, start editing, forget, or restore with Undo. |
| Enter | In the edit field, saves; in the add field, sorts and adds the memory. Shift+Enter adds a line break while editing. |
| Escape | Cancels an edit, or closes the search and clears it. |

## Accessibility

- The card has a level two heading; in the All view and in search results each group has a level three heading with its count, and every group is a labelled group of list items.
- Switches are labelled by their visible titles and described by the line beneath; the meter is a meter role with a text value such as "62% full". Filter pills are toggle buttons with aria-pressed.
- Status is never color alone: the pill reads Memory updated, then Saved to Preferences with a check; the meter's warning pairs color with an icon; the add field shows Added to People with a check or an error with an icon; a paused list carries a note with an icon.
- Icon buttons name the memory they act on, such as "Forget memory: Prefers metric units and 24 hour times", and show a tooltip. Row actions stay visible on touch screens.
- Focus follows each change: into the edit field, back to Edit after saving or cancelling, onto Undo after Forget, back to Forget after Undo, into the search field when it opens and back to the search button when it closes, and to the selected filter when an Undo button times out.
- A polite status region announces captures, adds (including that the preview sorts with a keyword guess), saves, forgets with their undo window, restores, switch changes and the number of search matches.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring, and text fields show focus with their border.

## Motion

- Capture and add: a copy of the new row lifts off the pill or the field and glides to the row's place in its group on the smooth spring (0.4s, no bounce), moving only by transform, while the row's slot opens beneath it. The row's own text takes over as it lands, under a soft tint that fades over about a second. If the memory's group is filtered out or a search is open, the filter switches or the search clears first, then the copy flies.
- Filtering opens and closes groups and rows by height on a critically damped spring (0.32s, no bounce) with a quick fade, so the list closes its gap instead of jumping. The active pill's background glides to the new pill on a 0.26s spring without bounce.
- The search button widens into a field over the pills with a 240ms ease-out width transition while the pills fade out.
- A row swaps between reading, editing and the undo bar with one crossfade (100ms out, 160ms in) while its height follows on the smooth spring. A saved edit crossfades the old sentence into the new one. When the undo countdown ends, the bar folds away.
- Labels that change (a switch's line, the pill, the add status) crossfade in place with at most 2px of rise; the pill keeps its width with an invisible sizer, so nothing shifts. No per-letter, blurred or morphing text.
- The meter's percentage counts in tabular numerals inside a reserved width and the bar scales on the smooth spring. Sorting a typed memory shows a short shimmer on its status. The undo ring drains linearly.
- Reduced motion skips the flight, places heights and rows immediately, stops the shimmer and the ring, and keeps every state, focus move and announcement.

## Responsive behavior

- The card is at most 640px wide and centered; the list scrolls inside a 380px area that fades at an edge only while there is more to see.
- Below 440px of container width the inset tightens, the subtitle wraps under the title next to the meter, and the filter pills scroll sideways with an edge fade, keeping the selected pill in view.
- Row actions and sources show on hover and focus with a mouse and stay visible on touch screens; their space is always reserved, so text never shifts.
- The Memory updated pill truncates its note with an ellipsis on narrow cards; the full text is in its accessible name.

## Performance

- Heights animate through motion values and one ResizeObserver per row; the list's edge fade and the filter fades are toggled as attributes, without React renders per frame.
- The flight moves one absolutely positioned copy by transform; scrolling the list to the landing row runs on the same spring.
- Undo windows share one 200ms interval that runs only while something can be restored.
- Search is a plain substring filter; matches are marked by splitting the text, without regular expressions built from input.

## Notes for AI

- Use it as the memory page of an assistant's settings or in a side panel next to a chat. Pass captured={null} when capture happens in your real chat, or pass what the model just noted to offer it as a pill.
- Write memories as one plain third person sentence without a closing period, such as "Prefers metric units and 24 hour times". Keep them under 200 characters; the editor enforces it.
- Set source.kind to "chat" (reads From a chat) or "manual" (Added by you) with an ISO date; add href to link the source to the chat.
- For memories about a person, set group "people" and person { name, src } to show their portrait. Typed memories that name someone in lib/media get that portrait automatically.
- onChange receives the whole list, so you can store it as is, or act on change.type. Reject from add or edit to surface server errors in place. Forget is final only after undoSeconds, which is when onChange reports it.
- The sample shows Claude as the assistant; set assistantName for your own. Do not invent capture claims for real products.

## Related

- [AI chat](https://uiarc.dev/components/blocks/ai-chat/markdown): A full-screen AI chat where answers stream in as markdown with folding reasoning, tool chips and cited sources. People can switch chats and models, edit or retry a message into versions, rate replies and stop a reply mid-stream.
- [AI side panel](https://uiarc.dev/components/blocks/ai-side-panel/markdown): An assistant docked beside a page that reads it and edits it: ask about the page or a selected passage, review each edit as a word diff, and apply it with a tint sweep on the page and one-click undo.
- [Knowledge base](https://uiarc.dev/components/blocks/knowledge-base/markdown): A retrieval knowledge base in one card: add sources and watch them parse, chunk, embed and index, then test a question and see which chunks come back and why.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [MCP servers](https://uiarc.dev/components/blocks/mcp-servers/markdown): Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
