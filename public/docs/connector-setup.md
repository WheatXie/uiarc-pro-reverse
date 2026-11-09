# Connector setup

> A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/connector-setup
- Markdown: https://uiarc.dev/components/connector-setup/markdown
- Source file: `registry/components/connector-setup/connector-setup.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, ai, new, connectors, integrations, connect apps, oauth, connect your tools, ai assistant settings, mcp connectors, slack integration, github integration, scopes, permissions, disconnect

## When to use

- An assistant's settings or onboarding step where people connect workspace apps.
- A first-run checklist that needs to show the OAuth handshake and first sync inline, without leaving the page.
- Reviewing which scopes an assistant holds per app and revoking them.

## When not to use

- Browsing dozens of integrations by category: use the integrations-grid block.
- Approving a single action the agent wants to take: use agent-approvals.
- Showing a tool the agent is calling right now: use tool-call.

## Installation

Connector setup is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/connector-setup
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ConnectorSetup } from "@/components/arc/connector-setup/connector-setup";

export function Integrations({ connectedIds }: { connectedIds: string[] }) {
  return (
    <ConnectorSetup
      defaultConnected={connectedIds}
      connect={async (app, { signal, report }) => {
        const popup = await openOAuthPopup(app.id, { signal });
        report({ phase: "authorizing" });
        const grant = await popup.result;
        report({ phase: "syncing", synced: 0 });
        const { total } = await startFirstSync(app.id, grant, { signal, onProgress: synced => report({ synced }) });
        return { account: grant.workspace, scopes: grant.scopes, synced: total };
      }}
      disconnect={(app, { signal }) => revokeGrant(app.id, { signal })}
      onConnectedChange={ids => saveConnectedApps(ids)}
    />
  );
}
```

## API reference

### ConnectorSetup

A "Connect your tools" card for an AI assistant. Each app connects inline through redirect, authorize and first sync with a progress line, then lists the scopes it granted with a Disconnect option. With no props it renders eight sample apps and plays a short scripted run.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `connectors` | `Connector[]` | `connectorSamples` | Apps to list: { id, name, description, mark, host?, account?, scopes?, sync?: { count, noun }, keywords? }. `mark` is a built-in id (slack, github, notion, google-drive, linear, jira, salesforce, hubspot) or your own 20px node. |
| `connected` | `string[]` | – | Controlled list of connected ids. |
| `defaultConnected` | `string[]` | `["github", "google-drive"] for the samples, [] otherwise` | Ids connected on mount when uncontrolled. |
| `onConnectedChange` | `(ids: string[]) => void` | – | Called with the new list after a connect or disconnect finishes. |
| `connect` | `(connector, { signal, report }) => Promise<ConnectResult \| void>` | – | Runs your real OAuth flow. Call report({ phase: "authorizing" }) and report({ phase: "syncing", synced }) as it advances; throw an Error to show its message with Retry; return { account?, scopes?, synced? } to finish. `signal` aborts on Cancel or unmount. Simulated when omitted. |
| `disconnect` | `(connector, { signal }) => Promise<void>` | – | Revokes access after the inline confirmation. Simulated when omitted. |
| `onConnect` | `(connector: Connector, result: ConnectResult) => void` | – | Called once a connection completes, with the account, scopes and sync count. |
| `onDisconnect` | `(connector: Connector) => void` | – | Called once access is revoked. |
| `assistantName` | `string` | `"Claude"` | Used in the description, the scopes heading and the footer. |
| `title` | `ReactNode` | `"Connect your tools"` | Card heading. |
| `description` | `ReactNode` | `"Let Claude search and act in the apps your team uses."` | Line under the heading. |
| `searchable` | `boolean` | `true` | Shows the search field. It matches name, description, account and keywords. |
| `searchPlaceholder` | `string` | `"Search apps"` | Placeholder for the search field. |
| `autoPlay` | `boolean` | `true for the samples without connect` | Plays a scripted run once the card is on screen: connect Slack, then a Salesforce attempt that needs admin approval and its retry. Stops at the first pointer or key press. |
| `footer` | `ReactNode` | – | Footer line under the list. Defaults to a short privacy note; pass null to hide it. |
| `className` | `string` | – | Class on the root card. |

### ConnectorMark

The built-in app marks at any size, for use elsewhere in your settings UI.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `mark` (required) | `ConnectorMarkId \| ReactNode` | – | A built-in id or your own node. |
| `size` | `number` | `20` | Rendered size in px. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through search, each row's Connect, Cancel, Retry or Connected button, and the open details. |
| Enter / Space | Connects, cancels, retries, or opens and closes a connected app's access details. |
| Escape | Clears the search field, or backs out of the disconnect confirmation. |

## Accessibility

- The card is a labelled group with a real heading; the list is a ul with one li per app.
- A polite live region announces each step: connecting, connected with the sync count, failed with the reason, cancelled and disconnected. With the built-in simulation it adds "Simulated, nothing was sent."
- Status is never color alone: errors pair an alert icon with the message, connected apps show a check with the word Connected.
- The Connected button carries aria-expanded and aria-controls for the details region; Disconnect asks for confirmation and focuses the destructive button only after a deliberate press.
- Content that is fading out leaves the accessibility tree and stops taking clicks immediately.

## Motion

- Status lines and actions swap with one crossfade (out 100ms, in 160ms with a 2px rise) in a shared grid cell, so the row never reflows.
- Progress is a 2px hairline that eases between steps and tracks the sync count linearly; the count rolls in tabular numerals inside a width reserved for its final value.
- Details open with a bounce-free spring on measured height (visualDuration 0.24).
- The scripted run starts only once the card is on screen and stops at the first interaction. Reduced motion keeps every state and announcement but cuts the crossfades and height springs.

## Responsive behavior

- Fluid up to 520px and holds at 360px: names and status lines truncate with an ellipsis while marks and actions keep their size.
- Actions stay 32px tall with full-width rows of 60px, comfortable for touch.
- The details column aligns to the row's text at every width; the disconnect confirmation truncates its question before it wraps.

## Performance

- Pure React and CSS with a few Motion components; marks are inline SVG with no image requests.
- Only the row that is syncing re-renders per frame while its count rolls; other rows stay static.
- Search filters in memory; for hundreds of apps, filter on your side and pass the result as connectors.

## Notes for AI

- Use for onboarding or settings screens where a person grants an assistant access to third-party apps. Pass your own connectors; built-in marks cover Slack, GitHub, Notion, Google Drive, Linear, Jira, Salesforce and HubSpot.
- Wire connect to your OAuth popup or redirect handshake and call report() at each step so the row shows real progress; throw an Error with a short human message ("Needs admin approval") to show Retry.
- Write scopes as plain-language capabilities ("Post replies as Claude"), not raw OAuth scope strings.
- Keep it one card in a settings column. For a full marketplace grid of integrations use the integrations-grid block instead.

## Related

- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.

## Also in ai

- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
- [AI workflow](https://uiarc.dev/components/ai-workflow/markdown): A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.
- [Code suggestion](https://uiarc.dev/components/code-suggestion/markdown): An AI code edit suggestion where the model's proposed changes stream into a small editor panel as inline diff hunks, and you accept or reject each one, or all at once with Cmd+Enter. Accepted hunks fold into the file with a smooth height change.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [Image generation](https://uiarc.dev/components/image-generation/markdown): An image studio where each image forms on a dot matrix: a soft halftone wave breathes across the grid, the dots take the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp photo. One large canvas with a mono size label, a filmstrip of four variations, a prompt bar with model and ratio, and upscale with a sweeping dot band, vary or download, with real provider marks and a built-in simulation.
- [Dictation button](https://uiarc.dev/components/dictation-button/markdown): A chat composer with voice input, where the mic springs into a recording pill with a smooth live waveform, a timer, and cancel and insert buttons. Words stream into the field as you speak, muted until the recognizer settles them.
- [Speech player](https://uiarc.dev/components/speech-player/markdown): A read-aloud player for AI replies. The Read aloud button in the message's action row turns into a compact player with play, a scrubbable progress bar, speed and a voice picker, and a highlight follows the spoken word through the reply, karaoke style.
- [Meeting summary](https://uiarc.dev/components/meeting-summary/markdown): An AI meeting notes card: the header shows the Google Meet or Zoom mark, the attendees and the duration. Summary, Decisions and Action items stream in after a short summarizing pass. Hover any line to see the transcript quote it came from, then check off action items or send them to Linear or Notion.
- [Reply draft](https://uiarc.dev/components/reply-draft/markdown): An AI email reply drafter where Claude streams a reply under a received Gmail message. Quick replies steer a fresh draft, tone and length rewrite it with a single crossfade, and you can edit the finished draft before you insert it.
- [Agent handoff](https://uiarc.dev/components/agent-handoff/markdown): A support conversation where an AI assistant hands off to a person. When it transfers, a card shows the summary it passes to the team and the typical wait. The person then joins and takes over, and a thin timeline on the left marks each step.
- [PII redaction](https://uiarc.dev/components/pii-redaction/markdown): A guardrail card where personal data is redacted before the prompt reaches the model. Scan marks each name, email, phone number and card with its type and swaps it for a placeholder like [EMAIL_1]. The safe prompt travels to Claude, and the reply comes back with the original values put back for the person.
- [Response feedback](https://uiarc.dev/components/response-feedback/markdown): A feedback control for AI replies where thumbs down opens an inline panel with reason chips and an optional note, thumbs up fills and asks what was good, and a submit shows a short thank-you before folding back into the row.
- [LLM cost calculator](https://uiarc.dev/components/llm-cost-calculator/markdown): A pricing calculator for LLM workloads. Set tokens per request, requests per day and prompt caching, and eight current models re-rank by monthly cost. Bars glide and prices roll as you drag.
- [Provider keys](https://uiarc.dev/components/provider-keys/markdown): A settings card for bring-your-own-key AI products. Each provider row shows its real mark, the masked key, a status and when the key was last used. You can reveal a key for five seconds, copy, rotate or remove it with undo. Adding or rotating a key opens an inline form that checks the format as you type, then tests the connection before saving.
- [Generation stats](https://uiarc.dev/components/generation-stats/markdown): A live stats strip for a streaming LLM response where time to first token, speed with a sparkline, output tokens and cost count up in tabular numerals beside the model's real mark, then settle and open into a latency and token cost breakdown.
- [AI translate](https://uiarc.dev/components/ai-translate/markdown): A message card where picking a language streams the AI translation in place, sentence by sentence over the dimmed original, with a detected-language chip, a Show original toggle and a status line credited to the model's mark.
- [TL;DR toggle](https://uiarc.dev/components/tldr-toggle/markdown): An article card with a Full, Summary and Key points switch and a length slider. Switching streams an AI summary in place of the article as the card's height springs to fit, and each key point links back to the paragraph it came from, which gets scrolled to and highlighted.
- [Smart form fill](https://uiarc.dev/components/smart-form-fill/markdown): A paste-to-fill form card where AI reads an email signature or messy notes and fills a contact field by field. Each value flashes in with a confidence dot, its source lights up in the pasted text, low-confidence guesses ask for review, and Undo puts the old values back.
- [Enrich column](https://uiarc.dev/components/enrich-column/markdown): An AI enrichment column for a data table, where one prompt runs down every row and each cell shimmers while it works, then settles into a value with its source or a failure you can retry.
- [Ticket router](https://uiarc.dev/components/ticket-router/markdown): A support ticket router where messages from Gmail, Intercom, Slack and Zendesk come in one at a time. An AI classifier labels each one with intent, sentiment and confidence, and the ticket moves into a team lane with an assignee. Low confidence tickets wait in a review lane, and one click there routes them to the suggested team.
- [Ask your data](https://uiarc.dev/components/ask-your-data/markdown): A natural language to chart card: you ask a question, PostgreSQL streams into a collapsible, syntax highlighted panel, the query runs with a rolling row count, and the answer builds as stacked bars, lines or a table, with a one line insight streamed in underneath.
- [Agent cursor](https://uiarc.dev/components/agent-cursor/markdown): A live document where Claude edits like a collaborator. Its labeled cursor comes out of its avatar, selects a paragraph and streams in a rewrite, adds a heading and fixes a typo, while a teammate's cursor reads along. Changes stay tinted until someone accepts or undoes them from a floating review bar.
- [Provider status](https://uiarc.dev/components/provider-status/markdown): A status card for the AI providers your product depends on. Each row shows the provider's real mark, its health as an icon and label, p50 latency and a 30-day uptime bar with a tooltip for each day. An incident row expands into its timeline of updates, and the card checks again on a visible countdown.
- [Training run](https://uiarc.dev/components/training-run/markdown): A fine-tuning job card where a live train and validation loss curve draws across a fixed step axis that doubles as the epoch progress bar. It shows the learning rate, elapsed time, ETA and the latest evals and checkpoints, has Pause and Cancel while it runs, and ends in results with a Deploy button.
- [AI command](https://uiarc.dev/components/ai-command/markdown): A Cmd+K command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams inside the palette with numbered sources, and the next steps it suggests, like filing a Linear issue or opening a Notion doc, run straight from the list.
- [Starter prompts](https://uiarc.dev/components/starter-prompts/markdown): A greeting and a grid of starter cards for the empty state of an AI app. The cards are grouped into Write, Code, Analyze and Plan tabs, and a shuffle swaps them with a short staggered crossfade. Picking a card fills the composer, and cards that use a connected app show its mark (Gmail, GitHub, Notion, Linear, Google Calendar).
- [AI mascot](https://uiarc.dev/components/ai-mascot/markdown): A small assistant character, a soft pebble with pill eyes and a companion dot, that shows what the AI is doing. It breathes and glances when idle, leans in to listen, looks up while the dot orbits its head, reads along the line it writes, squints with a sparkle when done and shakes once with worried brows on an error.
- [Image reveal](https://uiarc.dev/components/image-reveal/markdown): An image generation canvas where a soft, blurred preview made from the image's own colors sharpens top to bottom behind a soft-edged band. It works the way ChatGPT, Midjourney and Gemini show images forming, with fine film grain, a translucent progress pill and calm queued and error states.
- [AI spark](https://uiarc.dev/components/ai-spark/markdown): A brand-quality animated spark mark. Four tapered rays and four lighter diagonals breathe at rest, ripple while thinking, pulse like a heartbeat while writing, then gather and settle when done. Every status change blends from the pose the mark is already in.
- [Pixel mascot](https://uiarc.dev/components/pixel-mascot/markdown): A pixel-art robot that shows what an AI assistant is doing. It idles, thinks, types, celebrates and errors in frame-stepped sprite animations, and stays crisp at every integer size from 24px to 192px.
- [Ghost mascot](https://uiarc.dev/components/ghost-mascot/markdown): A floating ghost mascot whose soft sheet ripples at the hem while it hovers. It blinks when idle, turns toward you to listen, fades a little translucent while thinking, draws a tiny pen line while writing, smiles with a sparkle when done and wobbles once on an error.
- [Cube mascot](https://uiarc.dev/components/cube-mascot/markdown): An isometric cube mascot where three shaded faces and a painted-on face show what the assistant is doing. It turns a quarter turn in eased steps while thinking, prints lines onto the floor while writing, settles with a sparkle when done, and shakes once on error.
- [Tone tuner](https://uiarc.dev/components/tone-tuner/markdown): A brand voice card where two sliders (formality and detail) and Friendly, Confident and Empathetic chips rewrite a customer reply. Each changed sentence crossfades in place, new words can be highlighted against the original, and Copy takes the current version.
- [Upgrade prompt](https://uiarc.dev/components/upgrade-prompt/markdown): An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.
- [Referral card](https://uiarc.dev/components/referral-card/markdown): A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.
- [Trial banner](https://uiarc.dev/components/trial-banner/markdown): A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.
- [Team switcher](https://uiarc.dev/components/team-switcher/markdown): A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.
- [Live visitors](https://uiarc.dev/components/live-visitors/markdown): A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.
- [Social proof toast](https://uiarc.dev/components/social-proof-toast/markdown): A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.
- [Install snippet](https://uiarc.dev/components/install-snippet/markdown): A "get started in 30 seconds" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.

## Guidance for AI tools

Connector setup: A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
