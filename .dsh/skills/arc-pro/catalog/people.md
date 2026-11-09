# People

## `api-keys` · API keys (Pro, block)

API key management where Create key unfolds into its form and each secret is shown once.

When to use:
- The developer settings page of an API product.
- Key management with scopes, environments, and a one-time secret reveal.

When not to use:
- Use webhooks for event endpoints and signing secrets.
- Use integrations for OAuth connections to other apps.

Keywords: react api keys, api key management, developer settings, create api key, revoke api key, secret reveal, token management

Files: src/components/arc/api-keys/api-keys.module.css, src/components/arc/api-keys/api-keys.tsx, src/components/arc/api-keys/demo.tsx

## `domain-verify` · Domain verify (Pro, block)

A custom domain setup card where customers add a domain and copy the DNS records. A live checker then polls resolvers, marks each record valid, not found or misconfigured with a one-line fix, and finishes with the domain verified and the SSL certificate issued.

When to use:
- Letting customers serve an app, docs site, status page or storefront from their own domain.
- Verifying a sending domain for email (SPF, DKIM, DMARC) before turning on delivery.

When not to use:
- Buying or searching domains: use a search field with results instead.
- Managing many domains at once: use a table with one row per domain and open this card per domain.

Keywords: custom domain, domain verification, dns records, cname, txt record, caa, ssl certificate, propagation, verify domain, sending domain, dkim, vercel domains, resend domains

Files: src/components/arc/domain-verify/demo.tsx, src/components/arc/domain-verify/domain-verify.module.css, src/components/arc/domain-verify/domain-verify.tsx

## `env-variables` · Environment variables (Pro, block)

An environment variables and secrets manager with masked values, per-environment scope toggles, .env paste import with duplicate and invalid key warnings, write-only sensitive values, an environment diff by fingerprint, and a redeploy banner.

When to use:
- A settings screen where developers manage configuration and secrets across development, preview, and production.
- Onboarding a project by pasting an existing .env file and scoping it to environments in one step.

When not to use:
- Use api-keys for creating, scoping, and revoking access tokens that your product issues to its users.
- Use a plain form for a handful of fixed settings that are not per environment.

Keywords: environment variables, env, dotenv, .env, secrets, config, configuration, vercel, netlify, deploy, redeploy, preview, production, development, sensitive, masked, diff, compare environments, developer settings

Files: src/components/arc/env-variables/demo.tsx, src/components/arc/env-variables/env-variables.module.css, src/components/arc/env-variables/env-variables.tsx

## `integrations` · Integrations (Pro, block)

An integrations directory where Connect morphs to Connected and the filters recount as you go.

When to use:
- Settings or marketplace pages for third party connections.
- Directories with search, category filters, and Connect buttons.

When not to use:
- Use webhooks for outgoing event endpoints.
- Use api-keys for developer credentials.

Keywords: react integrations page, app marketplace, connect apps ui, integrations directory, oauth connect button, third party integrations

Files: src/components/arc/integrations/demo.tsx, src/components/arc/integrations/integrations.module.css, src/components/arc/integrations/integrations.tsx

## `webhooks` · Webhooks (Pro, block)

A webhooks console with delivery history, a payload inspector and retries that roll the rate.

When to use:
- A developer settings page for webhook endpoints, delivery history, and retries.
- Consoles that need a payload and headers inspector next to the delivery list.

When not to use:
- Use api-keys for managing tokens.
- Use audit-log for account activity rather than outgoing events.

Keywords: react webhooks dashboard, webhook endpoints ui, webhook delivery logs, retry webhook, payload inspector, developer settings webhooks

Files: src/components/arc/webhooks/demo.tsx, src/components/arc/webhooks/webhooks.module.css, src/components/arc/webhooks/webhooks.tsx
