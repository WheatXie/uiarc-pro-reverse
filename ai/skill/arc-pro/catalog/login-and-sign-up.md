# Login and sign up

## `billing-overview` — Billing overview (Pro, block)

A billing page where the plan card morphs into a picker and usage, invoices, and card follow.

When to use:
- The billing settings page of a SaaS app.
- Pages that show plan, usage, payment method, and invoices together.

When not to use:
- Use plan-comparison or usage-pricing on a public pricing page.
- Use cancel-flow for the cancellation journey.

Keywords: react billing page, subscription management, billing settings, invoice list, usage meters, change plan ui, saas billing

Files: billing-overview.module.css, billing-overview.tsx, demo.tsx

## `security-settings` — Security settings (Pro, block)

An account security page with guided two-factor setup, password change and active sessions.

When to use:
- The security tab of account settings with two-factor setup, password change, and sessions.
- Guided TOTP setup that walks through scan, verify, and backup codes.

When not to use:
- Use settings-page for general account and workspace settings.
- Use api-keys for managing developer tokens.

Keywords: react security settings, two factor setup, 2fa setup flow, totp qr code setup, active sessions list, change password form, backup codes

Files: demo.tsx, security-settings.module.css, security-settings.tsx

## `settings-command` — Settings command (Pro, block)

Workspace settings where a search field grows into a palette that flies you to any setting.

When to use:
- Workspace or account settings with several sections and many options.
- Admin consoles where support links people to a specific setting.

When not to use:
- Use settings-page for a short, paged profile form with a few fields per section.
- Use command-palette for app wide navigation and actions, not just settings.

Keywords: settings, preferences, search settings, command palette, jump to setting, unsaved changes, save bar, sticky nav, scroll spy, admin settings

Files: demo.tsx, settings-command-data.ts, settings-command.module.css, settings-command.tsx

## `settings-page` — Settings page (Pro, block)

Account settings with a gliding section nav and a save bar that morphs in as you edit.

When to use:
- Account or workspace settings with several sections.
- Forms that should show a save bar only when something changed.

When not to use:
- Use security-settings for sessions, two factor, and passwords.
- Use billing-overview for plan and invoice management.

Keywords: react settings page, account settings, settings form, unsaved changes bar, profile settings ui, save bar

Files: demo.tsx, settings-page.module.css, settings-page.tsx

## `usage-billing` — Usage billing (Pro, block)

A usage based billing dashboard with a projected spend line, meters against limits, alerts, and an upgrade that morphs into a confirm sheet.

When to use:
- A billing page for usage priced SaaS or infrastructure products.
- Admin dashboards where finance needs spend alerts and invoice history in one place.

When not to use:
- Use billing-overview for flat seat based plans without meters.
- Use plan-comparison or usage-pricing on a public pricing page.

Keywords: usage billing, metered billing, spend dashboard, projected spend, usage limits, spend alerts, budget alerts, invoice history, upgrade plan, proration

Files: demo.tsx, usage-billing.module.css, usage-billing.tsx
