# Agent gallery

> A marketplace card of AI agent templates where you filter by team, search by agent or app, preview a sample run and install an agent inline: choose a workspace, grant access app by app, and the card confirms with a check.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-gallery
- Markdown: https://uiarc.dev/components/blocks/agent-gallery/markdown

- Access: Arc Pro
- Registry id: `agent-gallery`
- Source file: `registry/blocks/agent-gallery/agent-gallery.tsx`
- Built from: Button
- Keywords: agent marketplace, agent templates, ai agents, agent gallery, integrations, install flow, oauth scopes, grant access, app directory, filter chips, search, claude, gpt, gemini, slack, hubspot, github

Drop <AgentGallery /> onto an agents or integrations page. With no props it shows 20 sample agents and simulates installs. To wire it up, pass `agents` (name, job, category, apps with mark and scope, model, rating, installs, optional three-step preview), `workspaces`, and an async `onInstall(agent, workspace, signal)`. If it rejects, the card shows "Could not connect" with Try again. The signal aborts on Cancel, Escape or unmount. Category, query and installed each work controlled or uncontrolled (`category`/`onCategoryChange`, `query`/`onQueryChange`, `installed`/`onInstalledChange`). `onOpen` opens an installed agent and `onPreview` is there for analytics.

## When to use

- An agents or integrations page where people browse and install ready made AI agents.
- Onboarding that suggests agent templates by team and installs one without leaving the page.
- A marketplace teaser on a dashboard or settings page.

## When not to use

- Configuring a single agent's prompt, tools or schedule: use a settings form or agent routines.
- Showing a running agent's progress: use agent status or tool call.
- Catalogs with hundreds of items that need pagination, sorting and facets: use a full page table or list.

## Installation

Agent gallery is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-gallery
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentGallery } from "@/components/arc/blocks/agent-gallery/agent-gallery";

// Sample catalog with simulated installs
<AgentGallery />

// Real installs
<AgentGallery
  agents={templates}
  workspaces={[{ id: "acme", name: "Acme", detail: "Business · 48 seats" }]}
  installed={installedIds}
  onInstalledChange={setInstalledIds}
  onInstall={async (agent, workspace, signal) => {
    const res = await fetch("/api/agents/install", {
      method: "POST",
      body: JSON.stringify({ agent: agent.id, workspace: workspace.id }),
      signal,
    });
    if (!res.ok) throw new Error("The workspace admin must approve this app.");
  }}
  onOpen={agent => router.push(`/agents/${agent.id}`)}
/>
```

## API reference

### AgentGallery

A card that lists AI agent templates by team, with search, a sample run preview and an inline install flow (choose workspace, grant access per app, installed). With no props it shows 20 sample agents and simulates installs.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `agents` | `AgentTemplate[]` | `defaultAgents` | The catalog. Each agent has an id, name, one line job, category, apps (name, mark, scope), model (name, mark), rating, installs and an optional three step preview. |
| `categories` | `string[]` | `["Sales", "Support", "Engineering", "Marketing", "Ops"]` | Filter chips, in order. Agents show under the chip that matches their category. |
| `category` | `string` | – | The selected category. Pair with onCategoryChange. |
| `defaultCategory` | `string` | `categories[0]` | The first selected category when uncontrolled. |
| `onCategoryChange` | `(category: string) => void` | – | Called when a chip is chosen, including from the empty state's "Show in" button. |
| `query` | `string` | – | The search text. Pair with onQueryChange. Matches name, job, app names and model within the selected category. |
| `defaultQuery` | `string` | `""` | The first search text when uncontrolled. |
| `onQueryChange` | `(query: string) => void` | – | Called on every search edit and when search is cleared. |
| `workspaces` | `AgentWorkspace[]` | `defaultWorkspaces` | Workspaces offered on the first install step ({ id, name, detail? }). With a single workspace that step is skipped. |
| `installed` | `string[]` | – | Ids of installed agents. Installed cards show a check and offer Open instead of Install. Pair with onInstalledChange. |
| `defaultInstalled` | `string[]` | `[]` | Installed ids when uncontrolled. |
| `onInstalledChange` | `(installed: string[]) => void` | – | Called with the new list after an install completes. |
| `onInstall` | `(agent, workspace, signal: AbortSignal) => Promise<void>` | – | Runs the real install after the person grants access. Reject to show the error state with Try again. The signal aborts on Cancel, Escape or when the card leaves the list. Leave it out to simulate a 1.2s install. |
| `onPreview` | `(agent: AgentTemplate) => void` | – | Called when a card opens its sample run, for analytics. |
| `onOpen` | `(agent: AgentTemplate) => void` | – | Opens an installed agent, for example its settings page. |
| `title` | `string` | `"Agent templates"` | Heading of the card. |
| `description` | `string` | – | One line under the heading. Pass an empty string to hide it. |
| `className` | `string` | – | Extra class on the root section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through search, the selected chip and each card's actions. Focus inside a card reveals Preview and Install. |
| Arrow keys | Move between team chips, and between workspaces on the first install step. |
| Home / End | Jump to the first or last team chip. |
| Escape | In search, clears the text. Inside an install or preview, returns the card to its summary; while connecting, cancels the install. |
| Enter / Space | Activates the focused chip, workspace or button. |

## Accessibility

- The root is a labelled section; chips are a radiogroup with a roving tab stop, and workspaces are a second radiogroup.
- Each card is an article named after the agent. App marks are hidden from assistive tech and replaced by a sentence ("Connects to HubSpot, Slack and Gmail"); rating and installs are read as full words.
- After every step change made by the person, focus moves to the new step's main control, so keyboard users never fall back to the page. A leaving step is inert.
- A polite live region announces result counts, connect progress, errors and the installed result; without onInstall it adds "Simulated, nothing was connected".
- Status is never color alone: connected apps show a check, errors show an icon with "Could not connect", installed cards show a check with "Installed".

## Motion

- Filtering: removed cards fade out in 90ms and pop out of flow; remaining cards glide to their new cells on a critically damped spring (0.3s, no bounce), and the grid's height springs to the new row count.
- The chip highlight slides between chips on a 0.24s spring with no bounce. Text never animates layout.
- Card steps crossfade in place inside a fixed 176px card (out 100ms, in 160ms with 2px rise), so nothing changes size between states.
- Granting access connects apps one by one (340ms apart): a spinner, then a check that scales in without overshoot. The install button keeps its width while loading.
- Hover reveal of Preview and Install is a 160ms opacity and 2px rise. Touch screens show them permanently.
- Reduced motion keeps every end state and feedback but drops travel, staggers and the layout glide.

## Responsive behavior

- Uses container queries: two columns from 600px of card width, one column below. The header stacks the search under the title below 560px.
- Team chips scroll sideways inside their row on narrow screens; the page never scrolls horizontally. Tested at 360px, 390px and desktop.
- On touch screens Preview and Install stay visible since there is no hover.

## Performance

- Filtering is a memoized pass over the catalog; only visible cards render.
- Height animation reads one ResizeObserver; resizes jump instead of animating.
- No timers run while idle; the connect sequence uses abortable timeouts cleared on cancel or unmount.

## Notes for AI

- Pass real marks as ReactNode (inline SVG at 16px). Mono marks should draw with currentColor so they follow the theme.
- Keep job lines to one sentence of about 60 characters; the card reserves two lines and clamps the rest.
- Each app's scope is the plain language permission shown on the grant step. Keep it short and honest ("Draft email for your review").
- The card is a fixed height so the grid never jitters: preview shows the first three steps, the grant step fits three apps, and more than two workspaces scroll inside the step.
- onInstall should throw an Error with a short message; it is announced to screen readers after "could not be installed".

## Related

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
