# Upgrade prompt

> An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/upgrade-prompt
- Markdown: https://uiarc.dev/components/upgrade-prompt/markdown
- Source file: `registry/components/upgrade-prompt/upgrade-prompt.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, saas, new, upgrade, paywall, upsell, limit reached, usage limit, credits, plan upgrade, pricing toggle, monthly yearly, conversion, nudge, out of credits, pro plan, billing

## When to use

- An AI product that hits a usage limit (credits, generations, seats) and needs a tasteful, conversion focused nudge.
- A paywall moment inside an app, in a dialog, popover or inline in place of the blocked result.
- Offering one next plan with a monthly and yearly price.

## When not to use

- Comparing several plans side by side: use a pricing table or plan picker.
- Buying prepaid credits without a plan change: use credit-topup.
- Passive usage reporting on a billing page: use a usage meter.

## Installation

Upgrade prompt is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/upgrade-prompt
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { UpgradePrompt } from "@/components/arc/upgrade-prompt/upgrade-prompt";

export function OutOfCredits({ workspace, onClose, retry }) {
  return (
    <UpgradePrompt
      used={workspace.credits.used}
      limit={workspace.credits.limit}
      resetsOn="Nov 1"
      onUpgrade={async (selection, signal) => {
        const res = await fetch("/api/billing/upgrade", { method: "POST", body: JSON.stringify(selection), signal });
        if (!res.ok) throw new Error((await res.json()).message ?? "Your card was declined. Try another card.");
      }}
      onUpgraded={() => workspace.refresh()}
      onContinue={() => { onClose(); retry(); }}
      onDismiss={() => { fetch("/api/nudges/upgrade/snooze", { method: "POST" }); onClose(); }}
    />
  );
}
```

## API reference

### UpgradePrompt

The upgrade nudge shown the moment someone hits a limit: what they used, a usage meter, the price with a monthly and yearly toggle, what the next plan unlocks, Upgrade and Maybe later. Upgrading rolls into a success state with the new limits; Maybe later shows a calm reminder with a way back. With no props it shows a Free workspace at 50 of 50 AI credits and simulates the upgrade.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `used` | `number` | `50` | How much of the limit is used. |
| `limit` | `number` | `50` | The current plan's limit. At or over it the meter reads Limit reached; below it, how many are left. |
| `unit` | `string` | `"AI credits"` | What is counted, plural, such as "AI credits", "seats" or "generations". Used in the title, meter and announcements. |
| `resetsOn` | `string` | `"Nov 1"` | When the current limit resets. Shown in the description and the Maybe later reminder. |
| `plan` | `UpgradePlan` | `Pro, $20 a month or $16 a month yearly, 2,000 credits` | { name, price: { monthly, yearly }, currency?, limit, features: { id, label }[], limits: { label, value }[] }. price.yearly is the per month price when billed yearly; the saving badge and the yearly charge derive from it. Feature labels and limit values take ReactNode, so inline marks work. |
| `interval` | `"monthly" \| "yearly"` | – | Billing interval, controlled. |
| `defaultInterval` | `"monthly" \| "yearly"` | `"yearly"` | Billing interval on mount when `interval` is left out. |
| `onIntervalChange` | `(interval) => void` | – | Called when the billing toggle changes. |
| `onUpgrade` | `(selection: UpgradeSelection, signal: AbortSignal) => Promise<void>` | – | Starts the upgrade with { plan, interval, amount, currency }, where amount is charged today. Resolve when the plan is active; reject with an Error and its message shows under the price with Try again. Aborted on unmount. Leave it out to simulate a 1.1s upgrade. |
| `onUpgraded` | `(selection: UpgradeSelection) => void` | – | Called once the upgrade succeeded, after the success state shows. |
| `onDismiss` | `() => void` | – | Called by Maybe later. Record the snooze here; the card shows a reminder with See Pro again. |
| `onContinue` | `() => void` | – | Called by Continue on the success state, usually to close the dialog and retry the blocked action. Leave it out and Continue resets the demo. |
| `title` | `ReactNode` | – | Replaces the limit title, such as "You've used all 3 seats". |
| `description` | `ReactNode` | – | Replaces the line under the title. |
| `className` | `string` | – | Extra class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the billing toggle, Maybe later and Upgrade, or Continue and See Pro again in the other states. |
| ArrowLeft / ArrowRight | Switches between Monthly and Yearly on the billing toggle. |
| Enter / Space | Activates the focused button. |

## Accessibility

- The card is a labelled section ("Upgrade to Pro") with a heading, so it reads well inside a dialog or popover.
- The usage bar is role="meter" with a value text such as "50 of 50 AI credits used".
- Status is an icon plus a label (Limit reached, 1,950 AI credits left), never color alone.
- A polite live region announces upgrading, success and errors. Without onUpgrade it says the upgrade is simulated and nothing was charged.
- The rolling price is aria-hidden with a plain text copy for screen readers. Inactive states are inert and hidden, so focus never lands on a faded panel.
- Upgrade stays focusable while processing (aria-busy) so keyboard focus is not lost.

## Motion

- The usage bar fills once when it scrolls into view and settles to the new limit after the upgrade on a 0.5s bounce-free spring, moved with transform so its rounded end never stretches.
- The price rolls digit by digit between monthly and yearly on a 0.28s spring, in tabular numerals so nothing shifts.
- Title, description, meter label and counts crossfade: 100ms out, 160ms in with a 2px rise. Panels fade the same way with a 4px rise.
- Every variant and panel shares one grid cell, so the card never changes size between offer, processing, error, success and reminder, and the buttons stay in place.
- Reduced motion: the bar and price jump to their values; crossfades become plain fades.

## Responsive behavior

- Fluid up to 440px. Below 420px viewport width padding drops to 20px.
- At very narrow widths the billing toggle wraps under the price; feature lines stay single line.
- Buttons sit side by side at every width: Maybe later at its natural width, Upgrade filling the rest.

## Performance

- No timers or loops while idle; the only timeout is the simulated upgrade.
- The meter and price animate transforms only, through motion values, so there are no re-renders while they move.
- Two inline SVG marks, about 4 KB.

## Notes for AI

- Show it at the moment of value: when an action is blocked by the limit, not on page load. Put it in a dialog or popover anchored to the blocked control.
- Keep the three features concrete and specific to what the person was just doing (more credits, the better model, no waiting).
- The price is display only. Charge the plan and interval on the server; amount in the selection is for confirmation copy.
- Pass onContinue to close the prompt and retry the blocked action, so upgrading feels like it unblocked them.
- Snooze the nudge in onDismiss so it does not reappear on every blocked action.

## Related

- [Credit top-up](https://uiarc.dev/components/blocks/credit-topup/markdown): A card for buying AI credits. It shows the balance with a 14 day usage chart and how many days are left, three preset packs with bonus badges, a custom amount slider with a live price, auto top-up with a threshold and the saved Visa or Mastercard. When you buy, the new balance rolls in like an odometer.
- [Usage meter](https://uiarc.dev/components/usage-meter/markdown): Show what fills an allowance and how close it is to the limit.
- [Live checkout](https://uiarc.dev/components/blocks/checkout-live/markdown): A subscription checkout whose summary recomputes as you edit, then glides to the centre and unfolds into a receipt.
- [Segmented control](https://uiarc.dev/components/segmented-control/markdown): Switch between a small set of related views.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.

## Also in ai

- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
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
- [Connector setup](https://uiarc.dev/components/connector-setup/markdown): A "Connect your tools" card for an AI assistant. Each app connects inline: it redirects, authorizes and runs a first sync with a progress hairline, then lists the scopes it was granted and offers Disconnect with an inline confirm.
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
- [Referral card](https://uiarc.dev/components/referral-card/markdown): A give-and-get referral card where people copy or share their invite link, invite friends by email as chips, and watch invites move from invited to signed up to earned, with the credit total counting up and a milestone reward unlocking.
- [Trial banner](https://uiarc.dev/components/trial-banner/markdown): A trial status banner where a ring counts down the days left, the copy names what the workspace loses, and the upgrade path is one click away. It comes as a slim banner, a sidebar card or a header pill. It shifts to a warning tone in the last days, has expired and upgraded states, and folds into the pill when dismissed or snoozed.
- [Team switcher](https://uiarc.dev/components/team-switcher/markdown): A workspace switcher like Linear, Vercel or Slack. The trigger shows the current workspace's logo and plan. The menu has search, your role in each workspace and a Cmd+1 to 9 shortcut for each, and lets you create or join a workspace inline. A highlight glides between rows, and switching crossfades the trigger through a short loading state.
- [Live visitors](https://uiarc.dev/components/live-visitors/markdown): A realtime visitors card where the live count rolls digit by digit, new arrivals ping in on a dotted world map, the top pages reorder with bars, and signups and upgrades tick in with country flags.
- [Social proof toast](https://uiarc.dev/components/social-proof-toast/markdown): A stack of social proof notifications for landing and pricing pages, where recent trials, upgrades and verified purchases from people and companies arrive every few seconds. The stack pauses and fans out on hover, and visitors can dismiss any toast.
- [Install snippet](https://uiarc.dev/components/install-snippet/markdown): A "get started in 30 seconds" card where framework tabs, three numbered steps and highlighted snippets take a developer from install to first event. Generate key wipes a fresh API key into the placeholder in place.

## Guidance for AI tools

Upgrade prompt: An upgrade nudge for the moment someone hits a limit. It shows a usage meter at 50 of 50 AI credits, a rolling price with a monthly and yearly toggle, three concrete unlocks with real model marks, and Upgrade or Maybe later. Upgrading leads into a success state with the new limits, and the card never changes size between states. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
