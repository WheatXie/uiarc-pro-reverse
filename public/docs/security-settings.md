# Security settings

> An account security page with guided two-factor setup, password change and active sessions.

- Type: Block
- Page: https://uiarc.dev/components/blocks/security-settings
- Markdown: https://uiarc.dev/components/blocks/security-settings/markdown

- Access: Arc Pro
- Registry id: `security-settings`
- Source file: `registry/blocks/security-settings/security-settings.tsx`
- Built from: Button, Badge, Checkbox, Copy button, Hold to confirm, OTP input, Password field, Password strength
- Keywords: react security settings, two factor setup, 2fa setup flow, totp qr code setup, active sessions list, change password form, backup codes

Use this as the security tab of account settings. Connect Verify to your TOTP check, the backup codes to your generator, Update password to your password endpoint, and Revoke and Sign out to your session API.

## When to use

- The security tab of account settings with two-factor setup, password change, and sessions.
- Guided TOTP setup that walks through scan, verify, and backup codes.

## When not to use

- Use settings-page for general account and workspace settings.
- Use api-keys for managing developer tokens.
- Use audit-log for the history of security events.

## Installation

Security settings is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/security-settings
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SecuritySettings } from "@/components/arc/blocks/security-settings/security-settings";

export default function SecurityTab() {
  return (
    <section>
      <SecuritySettings />
    </section>
  );
}
```

## API reference

### SecuritySettings

An account security page with guided two-factor setup (scan, verify, backup codes), password change with strength meter, and active sessions you can revoke. Account, setup key, demo code (246810), backup codes and initialSessions are sample data in security-settings.tsx.

No props.

## Accessibility

- Password errors render in a role="alert" linked with aria-describedby and aria-invalid; the field uses autoComplete="current-password".
- After revoking a session, focus moves to the neighbouring Revoke button or the sessions heading.
- A polite live region announces saves, verification and session changes.

## Motion

- Two-factor steps advance along a rail with a gliding marker, and sections expand with a height spring.
- Reduced motion uses instant transitions and skips height animation.

## Responsive behavior

- Below a 640px container backup codes drop to two columns.
- Below 560px the QR code stacks above the setup key and section padding tightens.

## Performance

- Sections are plain DOM with height springs when expanding; there is no loop or observer cost.
- The session list is not virtualized, which is fine for the handful of sessions an account normally has.

## Notes for AI

- Use as the security tab of account settings.
- Verification, backup code download, password update and session revoke are simulated with timers; replace them with your TOTP check, code generator, password endpoint and session API.
- Replace the in-file ACCOUNT, SETUP_KEY, QR pattern and initialSessions with real data from props or a fetch.
- Composes Arc Button, Badge, Checkbox, Copy button, Hold to confirm, OTP input, Password field and Password strength.

## Related

- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Password strength](https://uiarc.dev/components/password-strength/markdown): Show how strong a new password is while it is typed.
- [OTP input](https://uiarc.dev/components/blocks/otp-input/markdown): A six digit verification flow with paste support and keyboard navigation.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
