# Two-factor setup

> A two-factor setup card where you scan a real, working authenticator QR code, type the 6-digit code into slots that move to the next box on their own, and save your backup codes before it turns on. Every step shares one fixed-size card, so it moves between steps with a short slide and never changes size.

- Type: Block
- Page: https://uiarc.dev/components/blocks/two-factor-setup
- Markdown: https://uiarc.dev/components/blocks/two-factor-setup/markdown

- Access: Arc Pro
- Registry id: `two-factor-setup`
- Source file: `registry/blocks/two-factor-setup/two-factor-setup.tsx`
- Built from: Button, Checkbox, Copy button
- Keywords: two-factor authentication, 2fa setup, totp, authenticator app, qr code, google authenticator, 1password, backup codes, recovery codes, mfa enrolment, otp input, account security

Use this as the authenticator app step in account or workspace security settings. Pass `secret` and `backupCodes` from your server, along with `issuer` and `account`. Wire `verifyCode(code, signal)` to your TOTP check: return true to continue or false to show the mismatch error. Turn two-factor on in `onEnable(signal)`; if it rejects, an inline error shows. Use `onDone` to go back to settings, `onCancel` to show a Cancel button, and `onStepChange` for analytics. Once you pass `verifyCode`, the simulated authenticator row and the local check go away.

## When to use

- Turning on authenticator app two-factor from account or workspace security settings.
- Enforced two-factor onboarding for admins after sign-in.
- Re-enrolling a new phone, with fresh backup codes.

## When not to use

- SMS or email one-time codes only: use otp-input in a sign-in form.
- Passkeys or WebAuthn enrolment, which needs no QR or code step.
- A full security settings page with sessions and password: use security-settings.

## Installation

Two-factor setup is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/two-factor-setup
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TwoFactorSetup } from "@/components/arc/blocks/two-factor-setup/two-factor-setup";

export function SecurityTwoFactor({ setup }: { setup: { secret: string; codes: string[] } }) {
  return (
    <TwoFactorSetup
      issuer="Acme"
      account="dana@acme.com"
      secret={setup.secret}
      backupCodes={setup.codes}
      verifyCode={async (code, signal) => {
        const res = await fetch("/api/2fa/verify", { method: "POST", body: JSON.stringify({ code }), signal });
        return res.ok;
      }}
      onEnable={signal => fetch("/api/2fa/enable", { method: "POST", signal }).then(() => undefined)}
      onDone={() => router.push("/settings/security")}
    />
  );
}
```

## API reference

### TwoFactorSetup

A three step authenticator app setup card: scan a real TOTP QR code (or copy the setup key), confirm a six digit code, save backup codes, then a final enabled state. With no props it is a working demo that checks real codes for its sample secret.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `issuer` | `string` | `"Northwind"` | Product name written into the otpauth URI and shown in the authenticator entry. |
| `account` | `string` | `"maya@northwind.io"` | Account label written into the otpauth URI, usually the email. |
| `secret` | `string` | `"QK7MR2XD5LVNA3WE"` | Base32 TOTP secret from your server. The QR code and grouped setup key are built from it. |
| `backupCodes` | `string[]` | `8 sample codes` | One-time recovery codes from your server, shown in a grid and used for Download and Copy. |
| `verifyCode` | `(code: string, signal: AbortSignal) => Promise<boolean>` | – | Checks the six digit code on your server. Resolve true to continue, false to show the mismatch error, reject to show a retry error. Without it the card verifies real TOTP codes for `secret` locally and shows a simulated authenticator entry you can click to fill the code. |
| `onEnable` | `(signal: AbortSignal) => Promise<void> \| void` | – | Called from Turn on after the person confirms they saved the codes. Persist two-factor here; reject to show an inline error. |
| `onCancel` | `() => void` | – | Shows a Cancel button on the first step. |
| `onDone` | `() => void` | – | Called from Done on the enabled state. Without it, Done restarts the demo. |
| `onStepChange` | `(step: "scan" \| "verify" \| "backup" \| "enabled") => void` | – | Fires whenever the step changes, for analytics or routing. |
| `addedLabel` | `string` | `"Added Oct 27, 2026"` | Date label for the authenticator row on the enabled state. |
| `className` | `string` | – | Class for the card root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| 0-9 | Types a digit and moves to the next slot. The sixth digit submits. |
| Backspace | Clears the slot, or the previous slot when this one is empty, and moves back. |
| Left / Right, Home / End | Moves between code slots. |
| Cmd/Ctrl + V | Pastes a full code into all six slots from any slot and submits. |
| Enter | Submits a complete code. |
| Tab | Moves through the setup key copy button, slots, checkbox, Download, Copy, Back and the primary action. |

## Accessibility

- The card is a labelled section; each step has its own heading, and inactive steps are inert and hidden from assistive tech.
- The QR code is an SVG with role img and a label naming the issuer and account; the setup key is selectable text with a copy button for people who cannot scan.
- Code slots are a labelled group with per-digit labels, autocomplete one-time-code on the first slot, and aria-invalid plus a role alert message on a mismatch.
- Errors use an icon and text, never color alone. A polite live region announces verification, downloads and whether anything was simulated.
- Moving to the verify step places focus in the first empty slot; the primary button keeps focus across steps.

## Motion

- All steps share one grid cell, so the card never changes size. The outgoing step fades in 100ms; the incoming one fades and slides 12px on a no-bounce spring (0.24s) in the direction of travel.
- Digits fade in with a 2px rise; the error state changes slot borders and swaps the hint for the message in one crossfade, with no shake.
- The countdown ring drains in sync with the real 30 second TOTP window using a negative animation delay and only ticks while the verify step is visible on screen.
- Progress segments fill on a 240ms ease-out; the done check draws itself once.
- Reduced motion keeps the crossfades and end states, drops the slide, the caret blink and the ring animation.

## Responsive behavior

- Fluid up to 34rem. Below a 460px card width the QR shrinks to 112px beside the copy, apps and setup key go full width, and backup codes move to two columns.
- Code slots shrink evenly down to a 360px viewport; the 44px checkbox hit area is offset so its square aligns with the text above.
- Container queries, so it adapts inside dialogs and side panels as well as pages.

## Performance

- The QR is encoded once per otpauth value and drawn as a single merged path plus three eyes.
- TOTP uses Web Crypto HMAC-SHA1; the clock ticks once per second only on the verify step and pauses off screen.

## Notes for AI

- Use for enabling authenticator app (TOTP) two-factor in account security settings. Pass the server-generated secret and backup codes; never generate secrets in the browser for production.
- Always pass verifyCode in production so the demo's simulated authenticator entry and local check are removed.
- Place it in a settings page or a dialog around 480 to 560px wide; it stacks the QR beside a narrower column below 460px.
- For pairing a device by scanning instead of typing a code, use qr-pairing; for a whole security page with password and sessions, use security-settings.

## Related

- [Security settings](https://uiarc.dev/components/blocks/security-settings/markdown): An account security page with guided two-factor setup, password change and active sessions.
- [OTP input](https://uiarc.dev/components/blocks/otp-input/markdown): A six digit verification flow with paste support and keyboard navigation.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Checkbox](https://uiarc.dev/components/checkbox/markdown): A binary choice with a precise, legible state.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
