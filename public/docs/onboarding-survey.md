# Onboarding survey

> A post-signup onboarding survey where each question gets its own step of large option cards, picked with keys 1 to 4 and Enter. A short personalization checklist then ticks off and lands on an editable "You're all set" summary.

- Type: Block
- Page: https://uiarc.dev/components/blocks/onboarding-survey
- Markdown: https://uiarc.dev/components/blocks/onboarding-survey/markdown

- Access: Arc Pro
- Registry id: `onboarding-survey`
- Source file: `registry/blocks/onboarding-survey/onboarding-survey.tsx`
- Built from: Button, Kbd, TextShimmer
- Keywords: onboarding survey, welcome survey, post signup, personalization, onboarding questions, role picker, team size, option cards, multi step form, typeform style, workspace setup, keyboard shortcuts

Drop it in right after sign-up and pass your own `questions` (two to four options each, with 16px icons or mono brand marks). Store picks from `onAnswer` as they happen. Put your real setup work in `personalize(answers, signal)`: the last checklist item waits for it, and if it rejects, the card shows the error with Try again. Route on with `onComplete(answers)`. `setupSteps` sets the checklist labels to match the answers. With no props it plays a sample run that stops on the first click or key press.

## When to use

- Post-signup personalization: role, team size and first action before the first screen.
- Short in-product surveys where every answer changes what someone sees next.
- Re-onboarding when a workspace changes plan or adds a team.

## When not to use

- Long forms with free text or many fields; use a regular form or import-wizard.
- Guided tours over the real interface; use onboarding-tour.
- A single choice inside a settings page; use radio-cards.

## Installation

Onboarding survey is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/onboarding-survey
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { OnboardingSurvey } from "@/components/arc/blocks/onboarding-survey/onboarding-survey";

export function Welcome() {
  return (
    <OnboardingSurvey
      questions={questions}
      onAnswer={(id, value) => analytics.track("onboarding_answer", { id, value })}
      personalize={async (answers, signal) => {
        await fetch("/api/workspace/personalize", { method: "POST", body: JSON.stringify(answers), signal });
      }}
      onComplete={() => router.push("/inbox")}
    />
  );
}
```

## API reference

### OnboardingSurvey

A post-signup survey card: one question per step on large option cards, a slim progress bar, keys 1 to 9 and Enter, then a personalization checklist that lands on an editable summary. With no props it plays a sample run until someone interacts.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `questions` | `OnboardingSurveyQuestion[]` | `onboardingSurveySampleQuestions` | One question per step: { id, title, description?, label?, options: { value, label, description?, icon? }[] }. Two to four options read best; label names the summary row. |
| `defaultAnswers` | `Record<string, string>` | – | Answers to start from, keyed by question id. Start over resets to these. |
| `setupSteps` | `string[] \| (answers) => string[]` | – | Checklist labels for the personalization step. Defaults to steps derived from the sample answers, or three generic steps for custom questions. |
| `personalize` | `(answers, signal: AbortSignal) => Promise<void>` | – | Your real setup work, started when the last question is answered. The last checklist item waits for it; a rejection shows its message with Try again. The signal aborts when the person goes back or the card unmounts. |
| `onAnswer` | `(questionId, value: string \| undefined, answers) => void` | – | Fires on every pick. value is undefined when a question is skipped. |
| `onComplete` | `(answers) => void \| Promise<void>` | – | Runs when the finish button is pressed; the button shows a spinner while a returned promise is pending. Without it the finish is simulated. |
| `autoPlay` | `boolean` | `true for the sample questions` | Plays a sample run (number key, then Enter) and loops. Stops for good on the first pointer or key press, pauses off screen and never runs with reduced motion. |
| `doneTitle` | `string` | `"You're all set"` | Title of the final step. |
| `doneDescription` | `string` | `"Your workspace is ready. Change any answer below."` | Line under the final title. |
| `finishLabel` | `string` | `"Open workspace"` | Label of the finish button. |
| `aria-label` | `string` | `"Onboarding survey"` | Accessible name of the card. |
| `className` | `string` | – | Extra class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| 1 to 9 | Pick the matching option on the current question. |
| Enter | Continue once an option is picked. |
| Arrow keys | Move between options in the radio group and pick as you go. |
| Tab | Move through the selected option, Skip, Back and the main action. |
| Space | Pick the focused option or press the focused button. |

## Accessibility

- Each question is a radiogroup labelled by its title; options are radios with aria-checked and aria-keyshortcuts, and one roving tab stop.
- The progress bar is a progressbar with a percentage value.
- A polite live region announces picks, the next question, setup progress and the result, including "Simulated, nothing was saved" in the demo.
- When a step changes, focus moves to the new step's selected or first option so keyboard flow never drops to the page.
- Checklist rows pair every state with an icon and text: a spinner, a check with a hidden Done label, or an alert with Failed.
- Hidden controls (Back on the first question, Skip after the last) keep their space but leave the tab order and accessibility tree.

## Motion

- Steps crossfade: the old step fades out in 100ms while the new one fades in over 160ms with a 2px rise.
- The stage springs to the incoming step's measured height with no bounce, so the footer glides instead of jumping.
- The progress fill scales from the left with a bounce-free spring; option checks and checklist icons swap with a short scale and fade.
- Number keys and Enter press their key caps and the main button for 150ms, so pointer and keyboard both get instant feedback.
- Reduced motion keeps the crossfades and end states, drops the rise, the height spring and the sample loop.

## Responsive behavior

- Up to 560px wide. Above 440px the options sit in a 2 by 2 grid of cards; below, each option becomes one compact row with icon, label, description and key.
- Labels and descriptions truncate with an ellipsis instead of wrapping, so every option keeps one height.
- Holds at 360px with 16px padding and no horizontal scroll; touch targets stay at least 40px tall.

## Performance

- One component with local state; only the current step is mounted, plus the outgoing one during its 100ms fade.
- The sample run uses a single timeout at a time and pauses when the card leaves the viewport.
- Brand marks are inline SVG; no images or network requests.

## Notes for AI

- Use right after sign-up to collect two to four answers that change the first screen. Keep each question to four options so keys 1 to 4 and the 2 by 2 grid hold.
- Pass personalize for the real work (create views, seed templates, invite flow) and keep setupSteps labels specific to the answers.
- Store answers from onAnswer as they come so a skipped or abandoned survey still informs the workspace.
- Option icons are 16px; lucide icons at strokeWidth 1.75 and mono brand marks in currentColor match the sample.

## Related

- [AI setup wizard](https://uiarc.dev/components/blocks/ai-setup-wizard/markdown): A three-step setup card for turning on an AI feature. You connect Notion, Google Drive, Confluence or Zendesk and watch each one sync. Then you pick the model, tone and guardrails, and ask a test question whose answer streams with numbered citations before you go live.
- [Invite people](https://uiarc.dev/components/blocks/invite-people/markdown): Invite teammates with roles, bulk paste validation, a seat meter, and avatars that fly into a pending list.
- [Login and sign up: Sign up](https://uiarc.dev/components/blocks/login/markdown): An account creation flow with field validation, password strength, and a clear completion state.
- [Radio cards](https://uiarc.dev/components/radio-cards/markdown): Selectable option cards with a sliding selection ring, price and description slots, and radio keyboard behavior.
- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
