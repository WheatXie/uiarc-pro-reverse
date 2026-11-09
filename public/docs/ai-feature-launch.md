# AI feature launch

> An in-product launch card for an AI feature. A looping mini demo plays above a three-step tour (inline rewrite, thread summary, ask your workspace), with benefit rows, an admin-gated "Enable for my workspace" switch, and Try it now and Learn more actions.

- Type: Block
- Page: https://uiarc.dev/components/blocks/ai-feature-launch
- Markdown: https://uiarc.dev/components/blocks/ai-feature-launch/markdown

- Access: Arc Pro
- Registry id: `ai-feature-launch`
- Source file: `registry/blocks/ai-feature-launch/ai-feature-launch.tsx`
- Built from: Button, Switch, Text shimmer
- Keywords: ai feature launch, introducing ai, feature announcement, launch modal, whats new, product tour, onboarding tour, enable ai, workspace setting, admin toggle, rollout, announcement card, notion ai, linear launch, pagination dots

Show it once when a member first opens the product after an AI feature ships, inline or inside a Dialog. Wire `onEnabledChange(enabled, signal)` to your settings endpoint. The switch shows the new value while the save runs. Toggling again aborts the signal and reverts, and a rejection shows an error note. Set `canManage` from the viewer's role, and `onTry` / `onLearnMore` to open the feature and the docs. To replace the tour, pass `steps`. Each `demo` can be a function of the loop time in ms, so pausing, looping, freezing between steps and reduced motion all work without timers.

## When to use

- Announcing a new AI feature inside the product, with a tour of what it does and a switch to turn it on for the workspace.
- Admin-gated rollouts where an admin enables AI for everyone and members can still try it.
- A what's new modal or popover that needs to look polished in a launch clip.

## When not to use

- Multi-step configuration with real inputs (models, data sources): use ai-setup-wizard.
- Ongoing activation tasks: use onboarding-checklist.
- A long changelog or release notes page: render the entries as a page instead.

## Installation

AI feature launch is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/ai-feature-launch
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { AiFeatureLaunch } from "@/components/arc/blocks/ai-feature-launch/ai-feature-launch";

export function AiLaunch({ workspace, isAdmin }: { workspace: { name: string; members: number; aiEnabled: boolean }; isAdmin: boolean }) {
  return (
    <AiFeatureLaunch
      workspaceName={workspace.name}
      memberCount={workspace.members}
      canManage={isAdmin}
      defaultEnabled={workspace.aiEnabled}
      onEnabledChange={async (enabled, signal) => {
        const res = await fetch("/api/workspace/ai", { method: "PATCH", body: JSON.stringify({ enabled }), signal });
        if (!res.ok) throw new Error("Could not save");
      }}
      onTry={() => router.push("/editor?ai=1")}
      onLearnMore={() => window.open("/docs/ai", "_blank")}
    />
  );
}
```

## API reference

### AiFeatureLaunch

An in-product launch card for an AI feature: a looping mini demo, a three-step tour with dots, three benefit rows per step, a workspace switch with an admin note, and Try it now and Learn more actions. With no props it plays a simulated tour of inline rewrite, thread summary and workspace search, and every action says that it was simulated.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` | `LaunchStep[]` | `rewrite, summarize, ask` | Tour steps: { id, title, description, benefits, demo?, posterTime? }. The card is always as tall as its tallest step, so switching steps never resizes it. |
| `step` | `number` | – | Controlled step index. Pair with onStepChange. |
| `defaultStep` | `number` | `0` | Starting step when uncontrolled. |
| `onStepChange` | `(index: number) => void` | – | Called when the step changes from the dots, the arrow keys or autoplay. |
| `autoPlay` | `boolean` | `true` | Advances to the next step after each preview loop. Stops for good on any interaction, waits while the pointer is over the card, and is off with reduced motion. |
| `stepDuration` | `number` | `6400` | Length of one preview loop in milliseconds. The active dot fills over this time while autoplay runs. |
| `workspaceName` | `string` | `"Halcyon"` | Workspace named in the saved and simulated announcements. |
| `memberCount` | `number` | `48` | Members the setting applies to, used in the note and the pending label. |
| `canManage` | `boolean` | `true` | When false the switch is disabled and the note says only admins can change it, while Try it now still works. |
| `enabled` | `boolean` | – | Controlled workspace setting. |
| `defaultEnabled` | `boolean` | `false` | Starting setting when uncontrolled. |
| `onEnabledChange` | `(enabled: boolean, signal: AbortSignal) => Promise<void> \| void` | – | Saves the setting. The switch shows the new value while it runs and the note shimmers; toggling again aborts the signal and reverts; a rejection reverts and shows an error note. Leave it out to simulate a 0.9s save. |
| `onTry` | `(signal: AbortSignal) => Promise<void> \| void` | – | Primary action, for example opening the editor with the feature focused. The button shows a spinner while the promise runs. Simulated when omitted. |
| `onLearnMore` | `() => void` | – | Secondary action, for example opening the docs or a changelog entry. Simulated when omitted. |
| `modelName` | `string` | `"Claude Sonnet 5.5"` | Model credited in the footer ("Runs on ..."). |
| `modelMark` | `ReactNode` | `Claude mark` | 14px mark before the model name. |
| `enableLabel` | `string` | `"Enable for my workspace"` | Switch label. |
| `tryLabel` | `string` | `"Try it now"` | Primary action label. |
| `learnMoreLabel` | `string` | `"Learn more"` | Secondary action label. |
| `className` | `string` | – | Extra class on the root card. |

### LaunchStep

One step of the tour.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `id` (required) | `string` | – | Stable key. |
| `title` (required) | `string` | – | Step title, sentence case, one line. |
| `description` (required) | `string` | – | One sentence under the title. |
| `benefits` (required) | `{ icon: LucideIcon; label: string }[]` | – | Up to three rows with a 16px icon. Keep labels under about 45 characters. |
| `demo` | `ReactNode \| ((time: number) => ReactNode)` | – | The preview in the stage. A function gets the loop time in milliseconds, so a mini demo is a pure function of time that pauses, loops and freezes for free. Return the start state at 0 and near the end of the loop so it repeats seamlessly. |
| `posterTime` | `number` | `60% of stepDuration` | Loop time shown as a still frame with reduced motion. Pick the most telling moment. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the active tour dot, the workspace switch, Learn more and Try it now. |
| ArrowLeft / ArrowRight | On the dots, moves to the previous or next step and stops autoplay. |
| Home / End | On the dots, jumps to the first or last step. |
| Space | Toggles the workspace switch. Pressing it again while saving cancels the save. |
| Enter / Space | Activates a dot or an action button. |

## Accessibility

- The card is a labelled section whose name follows the current step title. Only the active step is exposed; hidden steps are aria-hidden and inert.
- The preview stage is decorative (aria-hidden): the title, description and benefits carry the same message as text.
- Dots are buttons named "Step 2 of 3: Catch up on any thread" with aria-current="step" and a roving tab stop.
- The switch is labelled by its visible label and described by the admin note. Saving, cancelled, saved, error and simulated results are announced in a polite live region.
- Status is never color alone: the saved note pairs a check with "On for all 48 members", the error note pairs an alert icon with text.
- Autoplay stops on the first interaction and waits while the pointer is over the card, so nobody loses a step they are reading.

## Motion

- One shared loop clock drives the mini demo, the dot fill and autoplay, so they never drift. It pauses off screen.
- Step changes are a single crossfade: the old step fades out in 100ms, the new one fades in over 160ms and rises 2px. All steps share one grid cell, so the card never changes height.
- Mini demos stream text in chunks of three words every 40ms, each chunk only fading in; thinking labels shimmer for under a second.
- The active dot widens on a bounce-free spring (0.24s) and fills linearly with the loop.
- Reduced motion: no autoplay or loops, each step shows a still frame at posterTime, and feedback (notes, spinner) stays.

## Responsive behavior

- Fills its container up to 520px. Below 440px (container query) the actions span the width and the model credit centers under them.
- The mini demo panel caps at 380px inside the stage and truncates long lines with an ellipsis, so it holds at 360px.
- Dots have 24px tall hit areas; the switch keeps the Arc switch's touch size.

## Performance

- The active demo re-renders on a 40ms grid (about 25 renders a second) while visible; leaving demos freeze and unmount.
- Inactive step copy stays mounted for the height reservation but is hidden and inert.
- Three inline SVG marks and three 20px avatars; no images in the copy.

## Notes for AI

- Use it once, the first time a member opens the product after an AI feature ships; persist dismissal yourself (put it in a Dialog or a popover and close it from onTry).
- Swap the default steps for your own: write each demo as a pure function of time using the loop time argument rather than timers, so pause, loop and reduced motion work automatically.
- Wire onEnabledChange to a real settings endpoint and respect the AbortSignal; set canManage from the viewer's role.
- Keep three steps with three benefits each; the card is designed for 360 to 520px.

## Related

- [AI setup wizard](https://uiarc.dev/components/blocks/ai-setup-wizard/markdown): A three-step setup card for turning on an AI feature. You connect Notion, Google Drive, Confluence or Zendesk and watch each one sync. Then you pick the model, tone and guardrails, and ask a test question whose answer streams with numbered citations before you go live.
- [Onboarding checklist](https://uiarc.dev/components/onboarding-checklist/markdown): Guide a new workspace through setup, one step at a time.
- [Catch up](https://uiarc.dev/components/blocks/catch-up/markdown): A catch me up digest for when you return, where one button reads Slack, Linear, GitHub and Gmail for the range you pick and streams back a short ranked summary: Needs you, Decisions made, Shipped and FYI. Each item is one sentence with its source mark, people and a jump link, and marking items as read clears them with a smooth collapse.
- [Ghost text](https://uiarc.dev/components/ghost-text/markdown): An inline AI autocomplete where muted ghost text continues your sentence exactly at the caret and Tab turns it solid in place. Cmd+Right takes it one word at a time, Escape fades it away, and a calm chip shows the model behind it.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Switch](https://uiarc.dev/components/switch/markdown): A tactile toggle for settings that take effect immediately.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
