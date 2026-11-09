# MCP servers

> Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.

- Type: Block
- Page: https://uiarc.dev/components/blocks/mcp-servers
- Markdown: https://uiarc.dev/components/blocks/mcp-servers/markdown

- Access: Arc Pro
- Registry id: `mcp-servers`
- Source file: `registry/blocks/mcp-servers/mcp-servers.tsx`
- Built from: Animated counter, Avatar, Button, Input, Search field, Segmented control, Switch, Text shimmer
- Keywords: mcp, model context protocol, mcp servers, tools, integrations, connectors, agent tools, tool definitions, context budget, token cost, oauth, tool discovery, permissions, always allow reads, ai agent settings

Pass servers with onToggle and onConnect to wire your MCP client; with no props it shows sample servers with real marks.

## When to use

- Settings for an agent or AI assistant that connects to MCP servers: which servers it has, which tools are on and what they cost in context.
- Onboarding a new integration with a directory, sign in and tool discovery in one place.
- Keeping tool definitions inside a context budget by switching off tools the agent does not need.

## When not to use

- Use agent-approvals to approve or deny individual tool calls while the agent runs.
- Use context-window to show everything in the context window, not only tool definitions.
- Use agent-run to follow an agent's steps and tool calls live.
- Use knowledge-base to manage documents an agent retrieves from, rather than tools it calls.

## Installation

MCP servers is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/mcp-servers
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { McpServers } from "@/components/arc/blocks/mcp-servers/mcp-servers";

export function AgentTools({ servers, directory }) {
  return (
    <McpServers
      servers={servers}
      directory={directory}
      budget={8000}
      clientName="Northwind agent"
      account={{ name: "Emma Collins", email: "emma@northwind.dev", avatar: "/media/people/emma-collins.svg" }}
      onToggleTool={(serverId, toolId, enabled) => saveTool(serverId, toolId, enabled)}
      onPermissionChange={(serverId, permission) => savePermission(serverId, permission)}
      onConnect={async ({ kind, serverId, endpoint }) => {
        if (kind !== "url" && kind !== "retry") await openOAuthWindow(serverId);
        const response = await fetch(`/api/mcp/${serverId}/tools`, { method: "POST", body: JSON.stringify({ endpoint }) });
        if (!response.ok) throw new Error("The server closed the connection during tools/list.");
        return response.json(); // [{ id, name, access, tokens }]
      }}
      onRemove={serverId => fetch(`/api/mcp/${serverId}`, { method: "DELETE" })}
    />
  );
}

// One server
const github = {
  id: "github",
  name: "GitHub",
  brand: "github",
  transport: "remote",
  endpoint: "https://api.githubcopilot.com/mcp/",
  status: "connected",
  permission: "allow-reads",
  tools: [
    { id: "search_code", name: "search_code", access: "read", tokens: 420, enabled: true },
    { id: "create_pull_request", name: "create_pull_request", access: "write", tokens: 640, enabled: true },
    { id: "merge_pull_request", name: "merge_pull_request", access: "write", tokens: 360, enabled: false },
  ],
};
```

## API reference

### McpServers

Manages the MCP (Model Context Protocol) servers that give an agent its tools. The header shows what the enabled tool definitions cost in context ("18 tools · 6.4k tokens of context") over a bar with one segment per server and a budget that turns the overflow amber. Each server row has its real mark, a status with icon and label (Connected, Needs sign in, Error), the transport (Remote or Local), how many tools are on and their token cost. Expanding a row lists its tools with a switch, a read or write label and a per tool token cost, the default for tool calls (Ask every time or Always allow reads), the endpoint and Remove. Toggling a tool rolls the numbers and resizes its segment. Add server opens a sheet inside the card with a searchable directory and a custom URL field. Choosing a server runs the connect flow in the same sheet: a labelled, simulated authorize screen, then discovering tools as they arrive, then the new server slides into the top of the list. Servers that need sign in reconnect through the same sheet, servers in error retry in place, and Remove comes with Undo.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `servers` | `McpServer[]` | `sample servers` | The agent's servers: { id, name, brand?, transport: "remote" \| "local", endpoint?, status: "connected" \| "needs-auth" \| "error", error?, permission?: "ask" \| "allow-reads", scopes?, tools: McpTool[] }. Only enabled tools of connected servers count toward context. Leave unset for the simulated demo; passing a new array replaces the list. |
| `directory` | `McpDirectoryEntry[]` | `sample directory` | What Add server offers: { id, name, brand?, description (one line), transport, endpoint?, auth: "oauth" \| "none", scopes?, tools }. OAuth entries show the authorize step first. Entries whose id is already in the list read Added. |
| `budget` | `number` | `8000` | Tokens of context you are willing to spend on tool definitions. The bar spans the budget; past it the bar rescales, the overflow turns amber and the label says how far over it is. |
| `title` | `string` | `"MCP servers"` | Heading of the card. |
| `clientName` | `string` | `"Northwind agent"` | Your agent's name on the authorize screen. |
| `account` | `{ name: string; email: string; avatar?: string }` | `Emma Collins` | The signed in person shown on the authorize screen. |
| `onToggleTool` | `(serverId: string, toolId: string, enabled: boolean) => void` | – | Called when a tool is switched on or off in a server's list. |
| `onConnect` | `(request: McpConnectRequest) => void \| McpTool[] \| Promise<void \| McpTool[]>` | – | Called when a server connects, with { kind: "directory" \| "url" \| "reconnect" \| "retry", serverId, name, transport, endpoint? }. For OAuth servers it runs when Authorize is pressed, so open your consent window here. Resolve with the tools the server reported (enabled is optional; reads default on, writes off); resolve with nothing to use the directory's tools. A rejection shows the error with Try again, using the error's message. Without it, the whole flow is simulated. |
| `onRemove` | `(serverId: string) => void` | – | Called once a removal's undo window closes (about 6 seconds, paused while the pointer or focus rests on the bar), or when another remove starts. |
| `onPermissionChange` | `(serverId: string, permission: "ask" \| "allow-reads") => void` | – | Called when a server's default for tool calls changes. |
| `className` | `string` | – | Class on the root element. |

### McpTool

One tool a server reports.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | – | Stable id, usually the tool name. |
| `name` | `string` | – | The name the model sees, for example create_issue. Shown in the mono face. |
| `access` | `"read" \| "write"` | – | Read tools only fetch; write tools change something. Shown as an icon and a word, and used by Always allow reads. |
| `tokens` | `number` | – | Tokens the tool's name, description and input schema take in context. Count them with your provider's token counting endpoint. |
| `enabled` | `boolean` | – | Whether the tool is loaded into the agent's context. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter, Space | On a server row, opens or closes its tools. On a tool switch, turns the tool on or off. |
| Arrow down / Arrow up | Moves between server rows. Home and End jump to the first and last row. |
| Arrow left / Arrow right | Changes the default for tool calls in an open row. |
| Command or Control + Z | Undoes the last remove while the Undo bar shows. |
| Arrow down / Arrow up in the sheet | Moves from the search field into the directory and between entries, and back up to the field. |
| Escape | Closes the sheet and returns focus to what opened it. Tab stays inside the sheet while it is open. |

## Accessibility

- Each server row is a button with aria-expanded and aria-controls, named with the server, its status, transport, tools on and token cost.
- Status is an icon in its semantic color plus a word (Connected, Needs sign in, Error, Connecting), never color alone. Read and write tools carry an eye or pen icon and the word; below 400px the word stays for screen readers only.
- The context bar is a meter with a value text such as "6,400 of 8,000 budgeted tokens", and over budget adds how far over it is beside a warning icon.
- Every tool switch is named with the tool, its access and its token cost, and the tool name is its label, so clicking the name toggles it.
- The sheet is a modal dialog: the card behind it is inert, Tab is trapped inside, Escape closes it, and focus moves to the search field, the Authorize button or the step heading as the flow advances.
- Toggles, permission changes, connects, failures, removes and undo are announced in a polite status region, and the simulated authorize screen says plainly that no account is contacted.
- When a row's action button disappears (Retry, Sign in) or a row is removed, focus moves to that row or its neighbour so keyboard users never land on the page body.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Toggling a tool rolls the tool count and token numbers with tabular digits, and its server's segment resizes on a critically damped spring.
- Hovering or focusing a server highlights its segment in the first series color and dims the others.
- Rows open and close their tools on a smooth height spring with a short fade; the chevron turns.
- The sheet rises from the card's bottom edge over a scrim, without overshoot. Steps cross fade with an 18px shift in the direction of the flow.
- Discovered tools arrive one by one with a 4px fade in, under a calm shimmer on "Discovering tools" that settles into "Found 5 tools".
- A new server slides into the top of the list as its height opens, with a brief accent tint that fades out. Removed rows close their gap, and Undo opens them again in place.
- Status labels and actions cross fade (about 100ms out, 160ms in). No text morphs or per letter motion.
- Reduced motion drops travel, height animation and the shimmer: content appears in place with every state, focus move and announcement kept.

## Responsive behavior

- Fills its container up to 720px. Rows keep one line of name and one of status at every width.
- Below a 520px container the tool list drops its indent, "5 of 6 tools" shortens to "5 of 6" and the sheet rises higher.
- Below 400px the tool count leaves the row (the token cost stays), read and write show as icons, and the permission control wraps under its label.
- While the sheet is open the card grows to at least 600px so the directory has room, and scrolls its bottom edge into view if needed. Holds without horizontal scroll from 320px up.

## Performance

- Only the open row renders its tools; the others are one button each.
- The meter and counters derive from the server list on render; there is no separate state to keep in sync.
- Simulated delays and the undo window use tracked timers that clear on unmount, and an abandoned discovery is ignored through a run ticket.

## Notes for AI

- Use real server names and pick a brand so the real mark shows: github, linear, notion, slack, sentry, stripe, postgresql, figma, vercel, supabase, cloudflare, googledrive, atlassian, datadog, hubspot, asana, posthog, airtable, docker, zendesk, intercom, gmail, googlecalendar. Leave brand unset for the generic MCP mark.
- Measure tokens per tool from the tool's JSON definition with your provider's token counter. Typical definitions take 150 to 700 tokens.
- Mark every tool read or write honestly: Always allow reads lets read tools run without asking, so a tool that changes data must be write.
- Set status "needs-auth" when a token expired or was revoked, and "error" with a short error string when tools/list failed. Neither counts toward context until it connects again.
- Return the discovered tools from onConnect so the sheet shows what the server really reported. Throw an Error with a readable message to show the failure state.
- The endpoints, token counts and directory in the demo are sample values.

## Related

- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [AI composer](https://uiarc.dev/components/blocks/ai-composer/markdown): The prompt box at the bottom of an AI app: files upload in place, / opens commands, @ inserts mentions, a model and effort menu sits in the toolbar, and the send button turns into a stop control ringed by the reply's progress.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.
- [Knowledge base](https://uiarc.dev/components/blocks/knowledge-base/markdown): A retrieval knowledge base in one card: add sources and watch them parse, chunk, embed and index, then test a question and see which chunks come back and why.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
