# Agent approvals

> One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.

- Type: Block
- Page: https://uiarc.dev/components/blocks/agent-approvals
- Markdown: https://uiarc.dev/components/blocks/agent-approvals/markdown

- Access: Arc Pro
- Registry id: `agent-approvals`
- Source file: `registry/blocks/agent-approvals/agent-approvals.tsx`
- Built from: Animated counter, Button, Dropdown menu, Kbd, Popover, Text shimmer
- Keywords: agent approvals, human in the loop, tool call approval, permission prompt, approve deny, always allow, agent permissions, rules, audit log, keyboard shortcuts, ai agent, mcp, guardrails, risk level, editable arguments

Pass requests and onDecide to connect your agent's permission flow; decisions can apply once or always. With no props it plays a sample queue.

## When to use

- Human in the loop control for agents that call tools with side effects: deploys, emails, database writes, payments and ticket changes.
- An approvals card in an agent console or side panel where one person reviews, edits and decides tool calls quickly, from the keyboard if they like.
- Products that let people turn repeated approvals into standing rules for one agent or a whole workspace.

## When not to use

- Use agent-run to follow one agent's steps and tool calls live, with an inline confirm inside the run.
- Use mcp-servers to connect tools and set their permissions up front rather than per call.
- Use agent-tasks or agent-orchestrator to plan and watch work across agents, not to gate individual tool calls.
- Use code-review when the thing to approve is a diff with comments.

## Installation

Agent approvals is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/agent-approvals
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AgentApprovals } from "@/components/arc/blocks/agent-approvals/agent-approvals";

export function ApprovalPrompt({ pending, rules }) {
  return (
    <AgentApprovals
      requests={pending}
      rules={rules}
      reviewer="Emma Collins"
      workspace="Northwind"
      onDecision={decision => fetch(`/api/approvals/${decision.requestId}`, { method: "POST", body: JSON.stringify(decision) }).then(response => {
        if (!response.ok) throw new Error("The agent did not get your decision. Nothing ran.");
      })}
      onRuleChange={({ type, rule }) => type === "added" ? saveRule(rule) : deleteRule(rule.id)}
    />
  );
}

// One pending request
const request = {
  id: "req-deploy-web",
  agent: { id: "deploy", name: "Deploy agent", model: "Claude Opus 5.5", provider: "anthropic" },
  tool: { id: "vercel.deploy", name: "Vercel", action: "Deploy to production", brand: "vercel" },
  title: "Run `vercel deploy --prod`",
  summary: "Deploy northwind-web to production",
  reason: "The preview passed all 214 checks and the release window opened at 14:00.",
  args: [
    { key: "project", label: "Project", value: "northwind-web", mono: true },
    { key: "commit", label: "Commit", value: "8f3c2a1", mono: true, editable: false },
    { key: "target", label: "Target", value: "production", mono: true },
  ],
  risk: "high",
  requestedAt: "2026-10-20T14:30:00",
};
```

## API reference

### AgentApprovals

One approval card for agents. The request on top of the queue reads like an inline permission prompt: the agent's name with its model's mark, how long ago it asked, the tool's real mark with the call in plain words (Run vercel deploy --prod, Send an email with Gmail), the agent's one line reason, the arguments as a key and value list whose values can be edited in place, and the risk as an icon plus Low, Medium or High. Deny, Approve (Enter) and an Always allow menu (this agent, or any agent in the workspace) decide it. The other pending requests wait below as one line rows; clicking a row brings it into focus, and a decision slides the next one up. Always allow sends a rule chip up into the Rules button, whose count rolls, and other waiting requests the new rule covers resolve themselves with a short note. A quiet Rules popover lists the rules with remove buttons, and Resolved expands in place into a log of who decided what and when.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `requests` | `ApprovalRequest[]` | `sample queue` | Pending tool calls in queue order: { id, agent: { id, name, model, provider?: "anthropic" \| "openai" \| "google" }, tool: { id, name, action, brand? }, title, summary, reason, args, risk: "low" \| "medium" \| "high", requestedAt (ISO) }. The first one is in focus. Ids added to a later array join the end of the queue. Leave unset for the simulated demo. |
| `rules` | `ApprovalRule[]` | `sample rules` | Always-allow rules that already skip the ask: { id, tool, scope: "agent" \| "workspace", agent?: { id, name }, createdBy?, createdAt? }. A rule covers a request with the same tool id, and the same agent when its scope is agent. |
| `resolved` | `ResolvedEntry[]` | `sample log` | Earlier decisions for the log, newest first: { id, agentName, tool, summary, outcome: "approved" \| "denied" \| "allowed", edited?, decidedBy, decidedAt }. |
| `reviewer` | `string` | `"Emma Collins"` | The person deciding. Recorded as decidedBy in each decision and in the log. |
| `workspace` | `string` | `"Northwind"` | Workspace name for the workspace-wide Always allow option and the rules list. |
| `title` | `string` | `"Approvals"` | Heading of the card. |
| `onDecision` | `(decision: ApprovalDecision) => void \| Promise<unknown>` | – | Called for every decision with { requestId, outcome, args (edits applied), edited, ruleId?, decidedBy, decidedAt }, including requests a new rule covered (outcome "allowed"). Return a promise to keep the request in its sending state; a rejection shows the error with Retry and Deny, using the Error's message when it has one. Without it, delivery is simulated and the card says so. |
| `onRuleChange` | `(change: { type: "added" \| "removed"; rule: ApprovalRule }) => void` | – | Called when Always allow adds a rule or one is removed from the Rules popover. Persist rules here. |
| `className` | `string` | – | Class on the root element. |

### ApprovalRequest

One pending tool call.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | – | The call in plain words, shown large. Wrap code in backticks to set it in the mono face, for example "Run `vercel deploy --prod`" or "`UPDATE` 1,284 rows in PostgreSQL". |
| `summary` | `string` | – | A short label for the queue row and the log, for example "Deploy northwind-web to production". |
| `reason` | `string` | – | The agent's one line reason for the call. |
| `tool` | `ApprovalTool` | – | { id, name, action, brand? }. id is the permission rules match on (vercel.deploy); action names the permission in the rules list (Deploy to production); brand picks a built-in mark: vercel, gmail, postgresql, linear, github, sentry or stripe. |
| `args` | `ApprovalArgument[]` | – | The arguments as rows: { key, label, value, editable? (default true), mono?, multiline? }. Editable values turn into a field on click; multiline ones edit in a growing textarea. |
| `risk` | `"low" \| "medium" \| "high"` | – | Shown as a shield icon in the success, warning or danger color plus the word. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| j / k | Bring the next or previous pending request into focus. |
| a or Enter | Approve the request in focus. Enter approves while focus is on the card, not on a button or field. |
| d | Deny the request in focus. |
| Enter / Escape | In an argument field, Enter saves and Escape restores the value (Command or Control with Enter in a multiline field). Focus returns to the value. |
| Tab | Moves through the Rules button, the editable values, Deny, Always allow and Approve, the queue rows and the Resolved toggle. |
| Arrow keys, Escape | Inside the Always allow menu and the Rules popover, move between items and close, with focus back on the trigger. |

## Accessibility

- The request in focus is a group named by its title, inside a region that takes focus after each decision, so the shortcuts keep working when the buttons that were pressed leave.
- Shortcuts answer anywhere in the card, and after a click in it left focus on the page, but stay quiet in fields, the menu and the popover, so typing an edited value never approves anything.
- Risk is a shield icon in its status color plus the word Low, Medium or High (with risk added for screen readers). Outcomes in the card and the log are an icon plus a word: Approved, Denied, Allowed by rule, Not sent.
- Every decision, edit, new rule, removed rule and failure is announced in a polite status region, and the demo says that nothing reached a real agent.
- Editable values are buttons named with their label, value and Edit; edited rows add a hidden "edited" to the label and a named Restore button.
- Queue rows are buttons with the agent, the summary and the risk in their name. The Resolved toggle carries aria-expanded and aria-controls.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- Bringing a queued request into focus is one crossfade of the request (the old one fades out in 100ms, the new one fades in over 200ms from 3px) while the card's height follows on a critically damped spring and the row closes its gap. Nothing bounces.
- After a decision the next request slides up: it rises 14px into place on the same spring as its row collapses below.
- Always allow sends a small rule chip from the menu up into the Rules button on an ease-in-out path, then the button's count rolls and a faint accent wash fades out of it. Covered rows swap their risk for Allowed by rule with one crossfade and collapse a moment later.
- Sending shows a calm text shimmer that stops when the agent answers. The pending, rules and resolved counts roll with tabular numerals.
- Reduced motion drops travel, the chip flight and the shimmer: requests, rows and labels change in place with every state, focus move and announcement kept.

## Responsive behavior

- One card up to 640px wide that fills narrower containers; it holds without horizontal scroll from 320px up.
- Below a 540px container the shortcut hints and the agent names in the queue hide, since touch is the likely input there.
- Below 440px the model name and the word risk drop out of the meta line, argument labels sit above their values, the Enter key cap leaves the Approve button and queue rows keep the marks, the summary and a short status.
- Long titles wrap, while row summaries and log entries truncate with the full text still in their accessible names or titles.

## Performance

- Only the request in focus renders its arguments and actions; queued requests are one row each.
- Timers for simulated delivery, settling and rule matches are tracked and cleared on unmount, and async callbacks read the latest state from a ref instead of re-subscribing.
- The relative times share one 15 second clock through useSyncExternalStore, so the card re-renders a few times a minute at most.
- Height changes are measured with one ResizeObserver per animated slot and animate only that slot.

## Notes for AI

- Write title as the call itself in a few words and summary as a short row label. Backticks in title render code in the mono face.
- Use real agent and model names and set provider so the right mark shows (anthropic, openai or google); any other value shows a neutral bot mark.
- Give each permission a stable tool id (vercel.deploy, gmail.send). Rules match on it, so several requests for the same permission are covered by one rule.
- Keep the reason to one line in the agent's voice and put anything a person might change into args. Mark values that must not change with editable: false.
- onDecision receives the edited argument values. Apply those, not the originals, and keep edited in your audit trail.
- Always allow both approves the request in focus and creates the rule; requests the rule then covers arrive through onDecision with outcome "allowed" and the rule id.
- Return a rejected promise from onDecision to show the error state; the Error's message is shown to the person.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent tasks](https://uiarc.dev/components/blocks/agent-tasks/markdown): A home for background coding agents: start a task on a repository and branch, watch each card move from queued to running to ready for review, and open a pull request from the result.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [MCP servers](https://uiarc.dev/components/blocks/mcp-servers/markdown): Manage the MCP servers that give an agent its tools: see what the enabled tools cost in context, connect or pause a server, and switch single tools on or off.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
