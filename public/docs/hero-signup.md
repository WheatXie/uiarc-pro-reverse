# Hero signup

> A full screen waitlist hero on a soft, drifting mesh gradient: the email field validates as you type and its button grows into the confirmation with your place in line.

- Type: Block
- Page: https://uiarc.dev/components/blocks/hero-signup
- Markdown: https://uiarc.dev/components/blocks/hero-signup/markdown

- Access: Arc Pro
- Registry id: `hero-signup`
- Source file: `registry/blocks/hero-signup/hero-signup.tsx`
- Built from: Gradient mesh, Input, Button
- Keywords: hero, waitlist, email signup, mesh gradient, early access, landing page, email capture, launch

Use this as the first section of a waitlist or early access page. Add the email in onSubscribe and return the place in line; reject with an Error to show its message with a retry. Signups in the preview are simulated.

## When to use

- Waitlists, early access, and launch pages where the email is the only ask.
- Pages that want a calm but alive first impression without product screenshots.

## When not to use

- Signup that needs a password, SSO choice, or consent up front; use Sign up form.
- A newsletter box further down the page; use Newsletter signup.

## Installation

Hero signup is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/hero-signup
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { HeroSignup } from "@/components/arc/blocks/hero-signup/hero-signup";

export function Hero() {
  return (
    <HeroSignup
      count={2140}
      onSubscribe={async email => {
        const res = await fetch("/api/waitlist", { method: "POST", body: JSON.stringify({ email }) });
        if (!res.ok) throw new Error("We couldn't save your spot");
        const { position } = await res.json();
        return position;
      }}
    />
  );
}
```

## API reference

### HeroSignup

A full screen landing hero built around one email field, on a soft mesh gradient tinted from the page accent. The field validates as you type, the button holds a spinner while the request runs, and on success the button grows across the field into the confirmation, where your place in line rolls in.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `ReactNode` | `"Close the month in an afternoon"` | Headline. A string rises in word by word on load. |
| `description` | `ReactNode` | – | One supporting line under the headline. |
| `placeholder` | `string` | `"you@company.com"` | Email field placeholder. |
| `buttonLabel` | `string` | `"Join waitlist"` | Submit label. |
| `shortButtonLabel` | `string` | `"Join"` | Submit label on very narrow layouts. |
| `footnote` | `ReactNode` | `"One email when your invite is ready. Nothing else."` | Quiet line under the field. Validation, a typo fix, a failure with retry, and the confirmation replace it in place. |
| `count` | `number` | `1283` | People already on the list. The social proof rolls up by one when the visitor joins. |
| `people` | `{ name: string; src: string }[]` | – | Portraits in the social proof stack. Up to five are shown. |
| `proof` | `(count: ReactNode) => ReactNode` | – | Social proof line. Receives the rolling count. |
| `hue` | `number` | – | Mesh hue in degrees. Defaults to the hue of the page accent, or a calm blue violet for the neutral accent. The palette stays pale and low in chroma in light mode and deep and calm in dark mode. |
| `onSubscribe` | `(email: string) => void \| number \| Promise<void \| number>` | – | Adds the email to the list. Resolve with the visitor's place in line, or nothing to use count + 1. Reject with an Error to show its message with Try again. Without it the preview simulates the request. |
| `onStateChange` | `(state: "idle" \| "submitting" \| "error" \| "success") => void` | – | Called on every state change, for analytics. |
| `className` | `string` | – | Extra class on the section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | Submits the email. The field shows send on mobile keyboards. |
| Tab | Moves from the field to the button, then to the inline actions under it: the typo fix, Try again, or Change email. |

## Accessibility

- A real form with a labeled type=email field, autocomplete=email, inputmode=email and enterkeyhint=send.
- Validation messages are specific (a missing @, an unfinished domain) and tied to the field with aria-describedby and aria-invalid; they appear after blur or submit, never while the first address is still being typed.
- Joining, success, and failure are announced through a polite status region; focus moves to the confirmation on success and back to the field on Change email.
- The button stays focusable while busy and ignores repeat submits, so a double press never joins twice.
- The field font is 16px on phones so iOS never zooms, and every target is at least 44px tall.

## Motion

- The headline rises in word by word once on load, followed by the supporting line, the field, and the social proof.
- Submitting crossfades the label into a spinner inside the same button, so nothing changes size.
- Success is one spatial transition: the button's shape grows across the whole field on a critically damped spring and becomes the confirmation, while the place in line rolls in digit by digit.
- The mesh drifts on a slow, seamless loop and blends into the new colors when the theme or accent changes. Reduced motion draws one still frame, removes the rise, the shake and the rolls, and swaps states instantly.

## Responsive behavior

- Fills exactly one screen: min-height is 100svh (100vh where unsupported), so mobile browser bars never hide the bottom, and the content is centered vertically.
- Works from 320px: the headline scales with the container, the button label shortens on very narrow widths, and the social proof stacks.
- The line under the field reserves its height, so a validation message or the confirmation never moves the content below.

## Performance

- The background is the Gradient mesh component in background mode: one WebGL triangle with a light shader grain, no editor chrome and no pointer handling.
- The loop stops while the hero is off screen or the tab is hidden. Without WebGL the same palette renders as CSS radial gradients.

## Notes for AI

- Choose this when the first section of a page exists to collect an email: a waitlist, early access, or a launch list.
- Wire onSubscribe to your API and return the real position; throw Errors with short human messages and the block handles busy, retry, and focus.
- In the preview, an address that contains fail shows the failure path once, so Try again can be tested.

## Related

- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.
- [Newsletter signup](https://uiarc.dev/components/blocks/newsletter-signup/markdown): An email signup framed by a stack of past issues; subscribing drops the next issue, addressed to you, onto the front.
- [CTA section](https://uiarc.dev/components/blocks/cta-section/markdown): A call to action as a centered closing section, a split beside a setup card that completes itself, or a dismissible banner.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
