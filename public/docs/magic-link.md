# Magic link

> A passwordless sign in card where an email with inline validation and typo fixes sends a magic link, and the card crossfades in place to a check your inbox step with a sealing envelope, Gmail and Outlook shortcuts and a resend countdown. Google and GitHub sign in sit above, with their real marks.

- Type: Block
- Page: https://uiarc.dev/components/blocks/magic-link
- Markdown: https://uiarc.dev/components/blocks/magic-link/markdown

- Access: Arc Pro
- Registry id: `magic-link`
- Source file: `registry/blocks/magic-link/magic-link.tsx`
- Built from: Button
- Keywords: magic link, passwordless, email sign in, login, check your inbox, resend countdown, sign in with google, sign in with github, auth, open gmail

Drop `<MagicLink />` on a sign in page or in a dialog. Connect `onSendLink(email, signal)` to your auth provider (Clerk, Supabase, Auth.js, Better Auth, WorkOS). It covers the first send and every resend. Throw from it to show the error state; when it resolves, the card moves to the inbox step. Connect `onProviderSignIn(provider, signal)` to the provider's social redirect. Set `appName` and `sender`, and use `validateEmail` to require a work domain. `providers={[]}` and `mailApps={[]}` hide the social buttons and the inbox shortcuts. `resendAfter` and `expiresInMinutes` set the countdown and the expiry copy. By default the inbox shortcuts open a Gmail search for the sender, or outlook.live.com / outlook.office.com depending on the address. Pass `onOpenMail` to change that.

## When to use

- Passwordless sign in or sign up by email link, with optional Google and GitHub sign in.
- B2B products that want a work email gate with a clear what happens next screen.
- Replacing a password form to cut sign in friction and reset requests.

## When not to use

- Password plus email sign in or MFA codes; use sign-in or a login block instead.
- One time codes typed into the app; use an OTP input flow.
- Full page marketing sign in layouts with imagery; use login-split.

## Installation

Magic link is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/magic-link
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { MagicLink } from "@/components/arc/blocks/magic-link/magic-link";
import { authClient } from "@/lib/auth-client";

export function SignInPage() {
  return (
    <MagicLink
      appName="Halden"
      sender="login@halden.app"
      onSendLink={async (email, signal) => {
        const res = await fetch("/api/auth/magic-link", {
          method: "POST",
          body: JSON.stringify({ email, redirectTo: "/dashboard" }),
          signal,
        });
        if (!res.ok) throw new Error("Send failed");
      }}
      onProviderSignIn={provider => authClient.signIn.social({ provider, callbackURL: "/dashboard" })}
      validateEmail={email => /@(gmail|yahoo)\./i.test(email) ? "Use your work email" : null}
      termsHref="/terms"
      privacyHref="/privacy"
    />
  );
}
```

## API reference

### MagicLink

A passwordless sign in card. Google and GitHub buttons sit above an email field with inline validation and a typo check ("Did you mean maya@gmail.com?"). Send magic link shows a spinner, then the card crossfades in place to Check your inbox: an envelope seals the letter, the address and expiry are shown, Open Gmail and Open Outlook jump to the inbox, a resend countdown ticks in tabular numerals and Use a different email goes back with the field focused. Both steps share one grid cell and one footer hairline, so the card never changes size. With no props every send is simulated.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `appName` | `string` | `"Halden"` | Your product's name, used in the title ("Sign in to Halden") and the card's accessible name. |
| `sender` | `string` | `"login@halden.app"` | The address the link comes from. Shown on the inbox step and used by Open Gmail to search for the email. |
| `defaultEmail` | `string` | `""` | Prefills the email field, for example from a previous session or an invite. |
| `emailLabel` | `string` | `"Work email"` | The label above the email field. |
| `providers` | `("google" \| "github")[]` | `["google", "github"]` | Social sign in buttons, in order, with their real marks. One provider spans the row. Pass [] to hide the buttons and the divider. |
| `mailApps` | `("gmail" \| "outlook")[]` | `["gmail", "outlook"]` | Inbox shortcuts on the Check your inbox step. Pass [] to hide them. |
| `resendAfter` | `number` | `30` | Seconds before the link can be sent again. The countdown restarts after every resend. |
| `expiresInMinutes` | `number` | `15` | How long the link stays valid. Display only; enforce it on the server. |
| `onSendLink` | `(email: string, signal: AbortSignal) => Promise<void> \| void` | – | Sends the magic link, for the first send and every resend. Throw to show "We couldn't send the link" (or Retry resend). The signal aborts when the person goes back or the card unmounts. Leave it out to simulate a send; nothing is sent and a status message says so. |
| `onProviderSignIn` | `(provider: "google" \| "github", signal: AbortSignal) => Promise<void> \| void` | – | Starts a social sign in, usually a redirect to your auth provider. The button shows a spinner until it settles; throw to show an inline error. Leave it out to simulate one. |
| `onOpenMail` | `(app: "gmail" \| "outlook", email: string) => void` | – | Handles the inbox shortcuts. By default Gmail opens a search for the sender in a new tab, and Outlook opens outlook.live.com for personal addresses or outlook.office.com for work ones. |
| `validateEmail` | `(email: string) => string \| null \| undefined` | – | Extra validation after the format check, such as allowing only company domains. Return the error message to show, or nothing to accept. |
| `termsHref` | `string` | `"#"` | Link to your terms in the footer. |
| `privacyHref` | `string` | `"#"` | Link to your privacy policy in the footer. |
| `className` | `string` | – | Class on the root wrapper, which spans its container and centers the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Google, GitHub, the email field, Send magic link and the footer links; on the inbox step through the inbox shortcuts, Use a different email and Resend. |
| Enter | Submits the email field. On a typo hint, pressing Enter again sends to the address as typed. |
| Space / Enter | Activates the focused button, including the suggested address in a typo hint. |

## Accessibility

- The card is a labelled region ("Sign in to Halden"); the hidden step is inert, so it leaves the tab order and the accessibility tree.
- Focus follows the step: the Check your inbox heading takes focus when the link is sent, and Use a different email returns focus to the field with the address selected.
- The field has a real label, autocomplete="email" and an email keyboard on touch. Errors set aria-invalid, are linked with aria-describedby and announced as alerts, and carry an icon as well as color.
- A polite live region announces sends, resends and simulated actions ("Simulated, nothing was sent").
- Resend stays focusable during the countdown (aria-disabled), so focus never drops when a resend starts.

## Motion

- Steps crossfade in one grid cell: the old step fades out in 100ms, the new one fades in over 200ms with a 4px rise. Nothing resizes.
- The envelope plays once per send in about 0.8s: the letter drops in, the flap folds shut, a success check settles. It replays on every resend. No bounce, no loop.
- Messages under the field and resend labels swap with a single opacity crossfade inside reserved space; the countdown digits change in place in tabular numerals.
- Reduced motion drops the rise and the envelope travel and renders its sealed end state, keeping the crossfades short.

## Responsive behavior

- Fills its container up to 400px. Under 480px the padding and corner radius step down.
- Provider and inbox buttons stay in two equal columns down to 320px; long addresses truncate with an ellipsis and keep the full value in a tooltip.
- Touch targets are 44px buttons and 32px footer links; the email field opens the email keyboard.

## Performance

- Both steps stay mounted (the hidden one inert), so switching never measures or reflows the card.
- The countdown ticks every 250ms only while it runs and stops at zero. The envelope is one small inline SVG.
- Brand marks are inline SVG; no images or network requests.

## Notes for AI

- Use for passwordless email sign in or sign up. Wire onSendLink to your auth provider (Clerk, Supabase, Auth.js, Better Auth, WorkOS) and onProviderSignIn to its social redirect.
- Throw from onSendLink to show the error state; resolve to advance to the inbox step. Pass the AbortSignal to fetch.
- Keep it centered on a plain page or in a dialog; it is a self-contained card about 400px wide.
- Hide social sign in with providers={[]} for B2B email-only flows, and use validateEmail to require a work domain.

## Related

- [Login and sign up: Email code](https://uiarc.dev/components/blocks/login/markdown): A sign in card that morphs from email to a six digit code to your account.
- [Login and sign up: Centered](https://uiarc.dev/components/blocks/login/markdown): A passkey-first login card on a quiet ring backdrop that morphs through email and code.
- [Login and sign up: Split](https://uiarc.dev/components/blocks/login/markdown): A full screen split login: an email-first form that morphs into a password step beside a photo.
- [Input](https://uiarc.dev/components/input/markdown): A single line field with clear labels and useful states.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
