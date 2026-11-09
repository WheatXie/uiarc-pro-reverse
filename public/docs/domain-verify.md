# Domain verify

> A custom domain setup card where customers add a domain and copy the DNS records. A live checker then polls resolvers, marks each record valid, not found or misconfigured with a one-line fix, and finishes with the domain verified and the SSL certificate issued.

- Type: Block
- Page: https://uiarc.dev/components/blocks/domain-verify
- Markdown: https://uiarc.dev/components/blocks/domain-verify/markdown

- Access: Arc Pro
- Registry id: `domain-verify`
- Source file: `registry/blocks/domain-verify/domain-verify.tsx`
- Built from: Button, CopyButton, TextShimmer
- Keywords: custom domain, domain verification, dns records, cname, txt record, caa, ssl certificate, propagation, verify domain, sending domain, dkim, vercel domains, resend domains

Drop it into a project's domain settings and connect three async handlers to your backend. getRecords(domain, signal) returns the records the customer must create. verify(domain, records, { signal, attempt, run }) runs one check and returns per-record status plus how many regions have propagated. issueCertificate(domain, signal) returns { issuer, renews }. The card does the polling (pollInterval), aborts requests when the domain is removed or the component unmounts, and stops on "all valid" or on any "invalid" record. On an invalid record it shows `found` and `fix` under that row. Pass `provider` (name + mark) from your NS lookup, or null when you don't know it. Listen with onVerified, onRemove and onPhaseChange. With no props it plays a simulated flow until someone clicks or types inside it.

## When to use

- Letting customers serve an app, docs site, status page or storefront from their own domain.
- Verifying a sending domain for email (SPF, DKIM, DMARC) before turning on delivery.
- Any setup step where a person must copy values into a third party and wait for propagation.

## When not to use

- Buying or searching domains: use a search field with results instead.
- Managing many domains at once: use a table with one row per domain and open this card per domain.
- One-off copy of a single value: a copy-button next to the value is enough.

## Installation

Domain verify is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/domain-verify
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DomainVerify } from "@/components/arc/blocks/domain-verify/domain-verify";

export function DomainSettings({ projectId }: { projectId: string }) {
  return <DomainVerify
    defaultDomain=""
    provider={null}
    getRecords={(domain, signal) => fetch(`/api/projects/${projectId}/domains`, { method: "POST", body: JSON.stringify({ domain }), signal }).then(r => r.json())}
    verify={(domain, _records, { signal }) => fetch(`/api/projects/${projectId}/domains/${domain}/verify`, { signal }).then(r => r.json())}
    issueCertificate={(domain, signal) => fetch(`/api/projects/${projectId}/domains/${domain}/certificate`, { method: "POST", signal }).then(r => r.json())}
    onVerified={domain => console.log(`${domain} is live`)}
  />;
}
```

## API reference

### DomainVerify

Custom domain setup in one card. The customer enters a domain, copies the DNS records (type, name, value with copy buttons), and a live checker polls resolvers: each record shows not checked, checking, valid, not found or misconfigured with a one line fix, the footer reports propagation across regions, and the card finishes with the domain verified and the SSL certificate issued. With no props it plays a simulated flow, a Cloudflare proxied CNAME that gets fixed, and no DNS is queried.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultDomain` | `string` | `"app.acme.com"` | Prefilled domain. Pasted protocols, paths, ports and trailing dots are stripped before validation. |
| `title` | `string` | `"Custom domain"` | Card title. |
| `description` | `string` | `"Serve your workspace from a domain you own."` | One muted line under the title. |
| `provider` | `{ name: string; mark?: ReactNode } \| null` | `Cloudflare` | Detected DNS host, shown as "DNS hosted at {name}" with a 14px mark. Pass null to hide it. |
| `getRecords` | `(domain: string, signal: AbortSignal) => Promise<DnsRecord[]>` | – | Returns the records to create. Each record is { id, type, name, value, purpose? }. Defaults to a CNAME (an A record on an apex), an ownership TXT and a CAA for Let's Encrypt. |
| `verify` | `(domain: string, records: DnsRecord[], context: { signal: AbortSignal; attempt: number; run: number }) => Promise<VerifyResult>` | – | One DNS check. Return { records: RecordCheck[], regions: { propagated, total } }. A RecordCheck is { id, status: "valid" \| "missing" \| "invalid", detail?, found?, fix? }. The card polls while any record is missing, and stops on all valid or any invalid, showing `found` and `fix` under that row. |
| `issueCertificate` | `(domain: string, signal: AbortSignal) => Promise<{ issuer: string; renews: string }>` | – | Called once every record is valid. The domain row shows "Issuing SSL certificate" until it resolves. |
| `pollInterval` | `number` | `800 simulated, 5000 with verify` | Milliseconds between checks. |
| `autoPlay` | `boolean` | `true when no handlers are passed` | Plays add, verify, fix and verified by itself, pausing off screen. Any pointer or key press inside the card hands control to the person. |
| `onPhaseChange` | `(phase: "enter" \| "adding" \| "records" \| "checking" \| "invalid" \| "verified") => void` | – | Called on every phase change. |
| `onVerified` | `(domain: string, certificate: Certificate) => void` | – | Called after the certificate is issued. |
| `onRemove` | `(domain: string) => void` | – | Called when the domain is removed with the close button or when Add another starts over. |
| `className` | `string` | – | Extra class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the domain field, adds the domain (same as the Add domain button). |
| Tab | Moves through the remove button, each record's copy button and the footer action. |
| Space / Enter | Activates the focused copy, remove or footer button. |

## Accessibility

- The card is a labelled section; the records are a list labelled DNS records.
- A polite live region announces each step (added, checking, needs a fix, verified, certificate issued) and adds "Simulated, no DNS was queried" when no verify handler is passed.
- Status is never color alone: every record and the domain show an icon with a short label.
- The domain field is labelled, marks itself aria-invalid on a bad domain and is described by the footer status.
- Placeholder rows behind the empty state are inert, so their copy buttons are skipped by keyboard and screen readers.
- Each copy button has its own label, such as "Copy TXT value", and announces the copy.

## Motion

- Text and icon swaps are single crossfades: the old one fades out in 100ms, the new one fades in over 160ms with a 2px rise.
- Rows fade in over 160ms with a 40ms stagger when the records arrive. No row, column or slot changes size between states.
- When a fix hint wraps on a narrow card, the card eases to its measured height on a spring with no bounce.
- Checking rows show a steady spinner, and the footer label carries a calm shimmer while checks run.
- Reduced motion keeps every state and label, swaps instantly and stops the spinner. The demo loop pauses off screen.

## Responsive behavior

- Fills its container up to 680px and adapts with a container query, not the viewport.
- Below about 544px the header row hides and each record stacks: type, name and status on one line, the value with its copy button below, then the meta line.
- On narrow cards the domain meta shortens ("DNS at Cloudflare", "SSL by Let's Encrypt") so the status never collides.
- Long names and values truncate with an ellipsis and keep the full text in a title; copy always copies the full value.

## Performance

- Plain DOM and CSS; motion is limited to opacity and a measured height spring.
- Every poll is abortable: removing the domain, starting a new check or unmounting aborts the in-flight request and timer.
- The demo pauses its timers when the card is off screen.

## Notes for AI

- Use for custom domain, sending domain or verified domain setup in a SaaS settings page. Wire getRecords, verify and issueCertificate to your backend; keep verify a single check, the card handles polling and aborts.
- Return `missing` while a record is still propagating and `invalid` only when a conflicting value is found, with `found` and a one sentence `fix`.
- Pass `provider` from your DNS lookup (NS records) so the hint can name the provider; pass null when unknown.
- For email sending domains, return MX, SPF (TXT) and DKIM (CNAME or TXT) records from getRecords and set a title like "Sending domain".

## Related

- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Agent status](https://uiarc.dev/components/agent-status/markdown): A compact live status pill for a running AI agent: the agent's mark in a live ring, the current activity and an elapsed timer, opening into the steps so far.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
