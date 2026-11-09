# AI workflow

> A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/ai-workflow
- Markdown: https://uiarc.dev/components/ai-workflow/markdown
- Source file: `registry/components/ai-workflow/ai-workflow.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-popover
- Keywords: special, ai, new, workflow builder, automation, zapier, n8n, make, ai workflow, flow builder, trigger action, test run, integration, branch, claude, gmail, slack, linear

## When to use

- An automation or integrations page where people assemble a short trigger, AI step and action flow and want to test it in place.
- Onboarding or marketing surfaces that show how an AI step slots between real apps, with a working test run.
- Reviewing what an existing workflow does and seeing a sample run's outputs step by step.

## When not to use

- Large free-form graphs with many branches, loops or merges: use a canvas editor instead.
- Showing a single tool call or a live agent's steps: use tool-call or agent-run.
- Scheduling recurring agent jobs: use agent-routines.

## Installation

AI workflow is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-workflow
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { AiWorkflow, workflowSampleSteps } from "@/components/arc/ai-workflow/ai-workflow";
import type { WorkflowStep } from "@/components/arc/ai-workflow/ai-workflow";

export function SupportAutomation() {
  const [steps, setSteps] = useState<WorkflowStep[]>(workflowSampleSteps);
  return (
    <AiWorkflow
      title="Escalate urgent support email"
      steps={steps}
      onStepsChange={setSteps}
      autoPlay={false}
      onRunStep={async (step, { signal, previous }) => {
        const res = await fetch(`/api/workflows/test/${step.id}`, { method: "POST", body: JSON.stringify({ previous }), signal });
        if (!res.ok) throw new Error((await res.json()).message);
        return res.json();
      }}
    />
  );
}
```

## API reference

### AiWorkflow

A compact, Linear-style automation builder card with an AI step. Steps are 32px rows on one 1px hairline rail: a trigger (New email in Gmail), an AI step (Classify with Claude Sonnet 5.5), a branch (Route by label) whose paths switch with small tabs, and actions (Post to #support in Slack, Create Linear issue). Test run glides a small accent dot down each connector while the line behind it fills; each step crossfades to Running with a shimmering activity line, then shows its duration and an inline output preview in small muted text (the email, the label with a streamed reason, the posted message, the created issue). The untaken path is marked Skipped. A failing step shows its error and Retry, which resumes the run from that step. Steps are added from a command menu (search field, compact rows with real app marks and number shortcuts) and removed with a small button. With no props it plays the sample flow, simulated, and says so.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `"Escalate urgent support email"` | Workflow name in the header. |
| `description` | `string` | `"Runs on every new email to support@northwind.dev"` | One line of context under the name. |
| `steps` | `WorkflowStep[]` | – | Controlled steps. Pair with onStepsChange so adding and removing keep working. Each step has id, kind ("trigger" \| "ai" \| "action" \| "branch"), app (a built-in id or { name, mark }), title, and optional detail, activity, output, durationMs and error. A branch carries paths: { id, label, steps }[] and must be the last top-level step. |
| `defaultSteps` | `WorkflowStep[]` | `workflowSampleSteps` | Initial steps when uncontrolled. Pass [] for the empty state, which lists the catalog's triggers as compact rows. |
| `onStepsChange` | `(steps: WorkflowStep[]) => void` | – | Called after a step is added or removed. New steps land at the end of the flow, or at the end of the visible path when the flow ends in a branch. |
| `catalog` | `WorkflowCatalogItem[]` | `workflowSampleCatalog` | Entries for the add step command menu: the same shape as a step without id. Triggers are offered in the empty state; everything else goes in the menu. Pass [] to hide the menu. |
| `onRunStep` | `(step: WorkflowStep, context: { signal: AbortSignal; previous: Record<string, WorkflowOutput>; attempt: number }) => Promise<WorkflowOutput \| void>` | – | Runs one step for real and returns its output. Throw to fail the step with the error message. A branch returns { type: "route", pathId } to pick its path. The signal aborts on Stop, a new run or unmount. Without it, runs are simulated from each step's sample output and durationMs. |
| `onRunComplete` | `(result: { status: "passed" \| "failed"; durationMs: number; outputs: Record<string, WorkflowOutput>; failedStepId?: string }) => void` | – | Called when a test run passes or stops on a failed step. |
| `loading` | `boolean` | `false` | Shows three skeleton steps while your flow loads. Test run and the add menu are unavailable. |
| `autoPlay` | `boolean` | `true` | Plays a test run once the card is in view and repeats it after a short pause until someone presses or types inside the card. Nothing is scheduled while the card is off screen. |
| `editable` | `boolean` | `true` | Shows the add step menu and the remove buttons. Triggers cannot be removed. |
| `className` | `string` | – | Class on the root section. |

### WorkflowOutput

The output preview union a step can return, rendered inline in small muted text under the step, aligned with its title.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `email` | `{ type: "email"; from: string; address?: string; subject: string; preview: string }` | – | Sender, subject on one line and a two line preview. |
| `label` | `{ type: "label"; label: string; confidence?: number; reason?: string }` | – | A hairline label with a status dot, confidence (0 to 1) in monospace, and a reason that streams in fast chunks. |
| `route` | `{ type: "route"; pathId: string; note?: string }` | – | Which branch path ran. |
| `message` | `{ type: "message"; channel: string; author: string; text: string }` | – | A posted chat message. |
| `record` | `{ type: "record"; id: string; title: string; meta?: string }` | – | A created or updated record: an issue key, a row, a ticket or a page. |
| `text` | `{ type: "text"; text: string }` | – | Free text such as a drafted reply, streamed in fast chunks. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Test run (or Stop), each step's remove button, the branch path tabs, Retry on a failed step, and the Add step button. |
| Enter / Space | Starts or stops a test run, removes a step, retries a failed step, or opens the add step menu. |
| Arrow keys | Move between paths in the branch tabs (Home and End jump to the ends). In the open menu, Up and Down move the highlighted row. |
| Type | Filters the add step menu by step title, app or detail. |
| Enter (menu) | Adds the highlighted step and closes the menu. |
| 1 to 9 (menu) | With an empty search, adds the step with that shortcut. |
| Escape | Closes the add step menu and returns focus to its trigger. |

## Accessibility

- The card is a labelled section with aria-busy while a run is in progress or steps are loading; steps are an ordered list, and each branch path is its own labelled list.
- Every step title carries its app and status for screen readers ("Create Linear issue, Linear, Done in 700ms"). Status is shown as an icon plus a short label, never color alone.
- A polite live region announces run start, each step's result, failures with their message, and the outcome, including "Simulated, nothing was sent" when no onRunStep is wired.
- The add step menu is a combobox: the search field owns focus and points at the highlighted option with aria-activedescendant; options are a listbox. Branch paths are a radio group with roving focus.
- Remove buttons are named per step ("Remove Create Linear issue") and are hidden only visually on hover devices until the row is hovered or the button is focused.
- Brand marks are decorative next to the visible step title; marks whose brand color is near black draw in currentColor so they keep contrast in dark mode.

## Motion

- A test run moves one thing at a time: a 5px accent dot glides down the next connector in 240ms while the line behind it fills, then the step crossfades to Running (icon and label) and its detail line crossfades to a shimmering activity line.
- Everything is bounce-free and 100 to 240ms. Output previews and added or removed steps open and close on measured height with a critically damped spring (visualDuration 0.22, bounce 0); switching paths crossfades the lists (100ms out, 160ms in) while the container height follows, and the tab highlight slides on the same spring.
- Status labels crossfade in a fixed 72px slot, so titles never shift. Reasons and drafts stream five words every 34ms, each chunk only fading in, with the final layout reserved from the first frame.
- The add step menu fades and settles in 150 to 180ms with no spring overshoot; filtering animates the list to its new measured height.
- Autoplay pauses while the card is off screen and stops for good after the first press or key inside the card.
- Reduced motion drops the traveling dot, line growth and height animation; states, outputs and the live region stay the same.

## Responsive behavior

- Fills its container up to 640px. Above 480px each step is one 32px row with the detail inline after the title; below that rows grow to 44px and stack the detail under the title, the status slot narrows to 64px and the header wraps to two lines.
- The empty state's trigger rows drop their detail text below 480px of card width.
- Remove buttons are always visible on touch screens and appear on hover or focus with a fine pointer.

## Performance

- One state update per step change; the rail and dot animate transform and opacity in CSS, and previews animate measured height only.
- Streaming renders the whole text once and toggles chunk opacity, so it never reflows. Autoplay timers stop off screen via IntersectionObserver.
- Marks are inline SVG with no network requests.

## Notes for AI

- Pick this to show or edit an automation that mixes app triggers, an LLM step and app actions, such as triage, routing or enrichment flows, inside a product settings page or onboarding.
- Wire onRunStep to a test endpoint and return the WorkflowOutput union so previews render; throw to show the failure state with Retry. Keep autoPlay off in real products.
- Use only current model names in AI step titles (Claude Sonnet 5.5, GPT-6.1 Sol, Gemini 4 Argon). Built-in app ids: gmail, slack, linear, claude, notion, sheets, hubspot, zendesk, github, stripe, branch; pass { name, mark } for anything else.
- One branch per flow, as the last top-level step. For multi-agent graphs or a run log, choose agent-orchestrator or agent-run instead.

## Related

- [Agent run](https://uiarc.dev/components/blocks/agent-run/markdown): A single card that follows one AI coding agent through a task: steps stream in with the live one shimmering, tool calls open in place, and the agent stops on a two-file diff for you to approve or send back before it writes. When the run ends, the steps fold into one line and a result shows the files changed, the checks that passed and a pull request button.
- [Agent plan](https://uiarc.dev/components/agent-plan/markdown): The plan an agent writes before it acts: edit, reorder or add steps while it is a draft, then watch it work through them as a live checklist.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Agent routines](https://uiarc.dev/components/blocks/agent-routines/markdown): Scheduled agents in one card: each routine reads as a sentence with its schedule, next run countdown, connectors and destination, and opens smoothly to edit or run it now.
- [Connector setup](https://uiarc.dev/components/connector-setup/markdown): A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.
- [Agent orchestrator](https://uiarc.dev/components/blocks/agent-orchestrator/markdown): A lead agent splits a goal into a plan, fans the subtasks out to parallel worker lanes and merges what comes back, with each lane's model, progress and result in view.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Agent timeline](https://uiarc.dev/components/agent-timeline/markdown): A compact timeline of one orchestrated agent run: the orchestrator and its subagents share a time axis, handoffs draw in between rows, and a playhead replays thinking, tool calls and waiting while the header counts time, tokens and cost. Hover a span for what it did, or click it to trace its handoff path.
- [Context window](https://uiarc.dev/components/context-window/markdown): An AI context window as a grid of 200 cells: the system prompt, tools, files, summary and messages fill it in order, a threshold row marks where compaction starts, and sending a message, attaching a file or compacting shows exactly how much still fits.
- [Reasoning block](https://uiarc.dev/components/reasoning-block/markdown): The collapsible thinking block of an AI reply. While the model thinks, a shimmering label counts the seconds and the latest reasoning streams underneath. When it finishes, it folds to "Thought for 7s" and opens to show the full reasoning as calm steps with headings.
- [Source cards](https://uiarc.dev/components/source-cards/markdown): A row of cited sources under an AI answer where cards stream in with real site marks while the model searches, the overflow collapses into a stack of favicons, hovering lifts a preview with the passage, and an inline [n] citation highlights its card.
- [Model card](https://uiarc.dev/components/model-card/markdown): A model details card where switching models rolls every price, limit and score in place, a token slider estimates monthly cost live, and benchmark bars show each model's rank on hover. Compare crossfades to a side-by-side table against any rival with the better values marked, and the card never changes size.
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

AI workflow: A Linear-style AI workflow card where a Gmail trigger, a Claude step, a branch and Slack and Linear actions sit on one hairline rail, and a test run glides down it, opening each step's output inline. Steps are added from a compact command menu with real app marks. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
