# Auth

## `login` · Login and sign up5, free and Pro variants (Free, block)

Sign in and sign up pages, from a compact code card to full screen split and immersive layouts.

Keywords: react sign in, passwordless login, email code login, magic code sign in, passkey login, sso buttons, otp login

## `magic-link` · Magic link (Pro, block)

A passwordless sign in card where an email with inline validation and typo fixes sends a magic link, and the card crossfades in place to a check your inbox step with a sealing envelope, Gmail and Outlook shortcuts and a resend countdown. Google and GitHub sign in sit above, with their real marks.

When to use:
- Passwordless sign in or sign up by email link, with optional Google and GitHub sign in.
- B2B products that want a work email gate with a clear what happens next screen.

When not to use:
- Password plus email sign in or MFA codes; use sign-in or a login block instead.
- One time codes typed into the app; use an OTP input flow.

Keywords: magic link, passwordless, email sign in, login, check your inbox, resend countdown, sign in with google, sign in with github, auth, open gmail

Files: src/components/arc/magic-link/demo.tsx, src/components/arc/magic-link/magic-link.module.css, src/components/arc/magic-link/magic-link.tsx

## `multi-step-form` · Multi-step form (Pro, block)

A guided form that presents one decision at a time and preserves progress.

When to use:
- Onboarding or intake flows split into a few short steps.
- Wizards that need Back and Continue, progress, and a success state out of the box.

When not to use:
- Use stepper when you only need the progress indicator.
- Use checkout-flow for full page flows.

Keywords: react multi step form, form wizard, step form, onboarding form, wizard component, multi page form

Files: src/components/arc/multi-step-form/demo.module.css, src/components/arc/multi-step-form/demo.tsx, src/components/arc/multi-step-form/multi-step-form.module.css, src/components/arc/multi-step-form/multi-step-form.tsx

## `onboarding-illustration` · Onboarding illustration (Pro, block)

A compact onboarding card whose line illustration morphs from folder to files, team, and badge.

When to use:
- A short first-run dialog in a document or workspace product.
- Onboarding with three or four steps that each need a simple picture.

When not to use:
- Use onboarding-checklist for tasks people complete over time.
- Use feature-illustration for a feature section on a marketing page.

Keywords: react onboarding, onboarding modal, welcome dialog, first run experience, onboarding steps illustration, animated svg onboarding

Files: src/components/arc/onboarding-illustration/demo.tsx, src/components/arc/onboarding-illustration/onboarding-illustration.module.css, src/components/arc/onboarding-illustration/onboarding-illustration.tsx

## `otp-input` · OTP input (Free, block)

A six digit verification flow with paste support and keyboard navigation.

When to use:
- Verification codes from email or SMS.
- Two-factor authentication code entry.

When not to use:
- Use password-field for secrets people type from memory.
- Use input for any other text.

Keywords: react otp input, verification code input, 2fa code input, pin input, one time code, sms code input

Files: src/components/arc/otp-input/otp-input.module.css, src/components/arc/otp-input/otp-input.tsx

## `two-factor-setup` · Two-factor setup (Pro, block)

A two-factor setup card where you scan a real, working authenticator QR code, type the 6-digit code into slots that move to the next box on their own, and save your backup codes before it turns on. Every step shares one fixed-size card, so it moves between steps with a short slide and never changes size.

When to use:
- Turning on authenticator app two-factor from account or workspace security settings.
- Enforced two-factor onboarding for admins after sign-in.

When not to use:
- SMS or email one-time codes only: use otp-input in a sign-in form.
- Passkeys or WebAuthn enrolment, which needs no QR or code step.

Keywords: two-factor authentication, 2fa setup, totp, authenticator app, qr code, google authenticator, 1password, backup codes, recovery codes, mfa enrolment, otp input, account security

Files: src/components/arc/two-factor-setup/demo.tsx, src/components/arc/two-factor-setup/two-factor-setup.module.css, src/components/arc/two-factor-setup/two-factor-setup.tsx
