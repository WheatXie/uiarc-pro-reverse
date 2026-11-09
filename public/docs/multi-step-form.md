# Multi-step form

> A guided form that presents one decision at a time and preserves progress.

- Type: Block
- Page: https://uiarc.dev/components/blocks/multi-step-form
- Markdown: https://uiarc.dev/components/blocks/multi-step-form/markdown

- Access: Arc Pro
- Registry id: `multi-step-form`
- Source file: `registry/components/multi-step-form/multi-step-form.tsx`
- Built from: Input, Progress, Button
- Keywords: react multi step form, form wizard, step form, onboarding form, wizard component, multi page form

Use it when a form needs distinct steps. Keep the number of steps small and provide a clear completion action.

## When to use

- Onboarding or intake flows split into a few short steps.
- Wizards that need Back and Continue, progress, and a success state out of the box.

## When not to use

- Use stepper when you only need the progress indicator.
- Use checkout-flow for full page flows.
- Use onboarding-checklist for tasks done outside a form.

## Installation

Multi-step form is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/multi-step-form
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MultiStepForm } from "@/components/arc/multi-step-form/multi-step-form";

export function Onboarding() {
  return (
    <MultiStepForm
      steps={[
        { id: "account", title: "Account", content: <AccountFields /> },
        { id: "team", title: "Team", description: "Who will you work with?", content: <TeamFields /> },
        { id: "plan", title: "Plan", content: <PlanFields /> },
      ]}
      onComplete={saveOnboarding}
    />
  );
}
```

## API reference

### MultiStepForm

A wizard that shows one fieldset per step with a progress list, Back and Continue actions, and a success state after the last step.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` (required) | `FormStep[]` | – | Steps in order. Renders nothing when empty. |
| `onComplete` | `() => void` | – | Called when the last step is submitted. |
| `nextLabel` | `string` | `"Continue"` | Submit label on every step except the last. |
| `completeLabel` | `string` | `"Finish"` | Submit label on the last step. |
| `initialStep` | `number` | `0` | Zero-based starting step, clamped to the range. |

### FormStep

Step type: { id: string; title: string; description?: string; content: ReactNode }. title becomes the fieldset legend and the progress label.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | Submits the step (native form submit), advancing or finishing. |
| Tab | Moves through step fields and the Back and Continue buttons. |

## Accessibility

- Each step is a fieldset with a legend, and focus moves to the new legend (or the success heading) after navigation.
- Progress is a labelled nav with aria-current=step, plus a visually hidden aria-live line announcing Step 2 of 3.
- The success state is role=status. Native required and pattern constraints in step content block submit before the step advances.

## Motion

- Steps slide 20px in the direction of travel while the shell springs to the new step's height.
- Completed markers draw a check, the step count rolls, and the submit button's width springs when the label changes.
- Reduced motion swaps steps, heights, and labels instantly.

## Responsive behavior

- The progress list scrolls horizontally when steps overflow.
- Below 420px the progress header stacks with the step count on top and padding tightens.

## Performance

- Only the active step is rendered, so keep field values in parent state.
- The shell springs to each step's height; step content is otherwise untouched.

## Notes for AI

- Use for onboarding or intake flows split into a few short steps. Use stepper for a standalone progress indicator and checkout-flow for full page flows.
- Step content is rendered only while active, so keep field values in parent state; validation beyond native constraints is up to you.

## Related

- [Stepper](https://uiarc.dev/components/stepper/markdown): Show where a person is in a multi-step flow and what is done.
- [Login and sign up: Sign up](https://uiarc.dev/components/blocks/login/markdown): An account creation flow with field validation, password strength, and a clear completion state.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
