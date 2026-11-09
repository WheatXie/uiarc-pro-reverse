# Webhook tester

> A developer webhook tester where you pick an event, edit its JSON payload and send a signed test event. You watch it go from signed to sent to 200 OK in 184 ms, then read the response body, headers and exact request, and retry failed deliveries from a recent list.

- Type: Block
- Page: https://uiarc.dev/components/blocks/webhook-tester
- Markdown: https://uiarc.dev/components/blocks/webhook-tester/markdown

- Access: Arc Pro
- Registry id: `webhook-tester`
- Source file: `registry/blocks/webhook-tester/webhook-tester.tsx`
- Built from: Button, CopyButton, Kbd, TextShimmer
- Keywords: webhook tester, test webhook, send test event, webhook endpoint, signing secret, hmac signature, stripe webhook, json editor, request timeline, delivery log, retry webhook, developer settings, api, event payload

Put it on the Test endpoint screen of any product that sends webhooks. Pass your own `events` (type plus default payload), the endpoint's `secret` and an `onSend(request, signal)` that hands the signed request to your backend. Your backend does the real POST and resolves with `{ status, durationMs, headers, body }`, or with status 0 and an `error` when nothing came back. `onRetry` re-sends a failed delivery and falls back to onSend. `source` and `signatureHeader` replace the Stripe defaults with your own product's name, mark and header. With no props it simulates the endpoint and sends one sample event when it scrolls into view.

## When to use

- A developer settings page where customers test a webhook endpoint before going live.
- Integration onboarding that asks people to prove their handler returns 2xx and verifies signatures.
- Internal tools for replaying failed deliveries with a retry.

## When not to use

- Managing many endpoints, filters and event subscriptions: use the webhooks block and link here for testing one.
- A general HTTP client for arbitrary methods and headers: this always sends a signed POST with a JSON body.
- Live event logs with thousands of rows: the list is for a few recent attempts, not a paginated log.

## Installation

Webhook tester is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/webhook-tester
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { WebhookTester } from "@/components/arc/blocks/webhook-tester/webhook-tester";

export function EndpointTest({ endpointId }: { endpointId: string }) {
  return (
    <WebhookTester
      defaultEndpoint="https://api.acme.com/webhooks/billing"
      secret={signingSecret}
      onSend={async (request, signal) => {
        const res = await fetch(`/api/endpoints/${endpointId}/test`, { method: "POST", body: JSON.stringify(request), signal });
        return res.json(); // { status, durationMs, headers, body }
      }}
    />
  );
}
```

## API reference

### WebhookTester

A developer webhook tester in one card. The request side has the endpoint URL, an event type select, the signing secret with reveal and copy, and a JSON payload editor with syntax tint, line numbers, validation and Format. Send test event signs the body with real HMAC SHA-256, runs a request timeline (signed, sent, 200 OK in 184 ms) and shows the response body, response headers and the exact request in tabs. Recent deliveries list every attempt with a status chip; failed ones have Retry. With no props it simulates the endpoint and sends one sample event when it scrolls into view.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultEndpoint` | `string` | `"https://api.northwind.dev/webhooks/stripe"` | Endpoint the test events go to. https is required, except http on localhost. |
| `onEndpointChange` | `(url: string) => void` | – | Called as the endpoint field is edited. |
| `events` | `{ type: string; payload: unknown }[]` | `five Stripe events (invoice.paid, customer.created, customer.subscription.updated, checkout.session.completed, payment_intent.payment_failed)` | Event types in the select. Choosing one loads its payload (an object, pretty printed, or a JSON string kept as is) into the editor. |
| `defaultEvent` | `string` | `the first event` | Event selected on first render. |
| `secret` | `string` | `a sample whsec_ secret` | The endpoint's signing secret. Shown masked with the prefix visible; the body is signed in the browser as HMAC SHA-256 of `${timestamp}.${body}`. |
| `defaultDeliveries` | `WebhookDelivery[]` | `five sample deliveries, two failed` | Deliveries shown on first render, newest first. Each has id, event, time, request ({ url, event, body, headers, timestamp, signature }) and response. The first one is selected. |
| `onSend` | `(request: WebhookTestRequest, signal: AbortSignal) => Promise<WebhookTestResponse>` | – | Sends the signed test event, usually through your backend. Resolve with { status, durationMs, headers?, body? }, or status 0 with error (and timedOut) when nothing came back; a rejection is shown as a failed delivery. Without it every delivery is simulated and the status line says so. |
| `onRetry` | `(delivery: WebhookDelivery, signal: AbortSignal) => Promise<WebhookTestResponse>` | – | Re-sends a failed delivery with a fresh timestamp and signature. Defaults to onSend with the same body. |
| `source` | `{ name: string; mark: ReactNode }` | `{ name: "Stripe", mark: <StripeMark /> }` | Who sends the events, shown in the header as a 16px mark and "Signed test events from Stripe". |
| `signatureHeader` | `string` | `"stripe-signature"` | Name of the header that carries t=…,v1=… in the request. |
| `autoPlay` | `boolean` | `true without onSend` | Sends one event about a second after the card first scrolls half into view, unless someone has already interacted with it. |
| `className` | `string` | – | Class on the card. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Mod+Enter | Sends the test event from the payload editor or anywhere in the endpoint field (Enter also works in the endpoint field). |
| Enter | In the payload editor, starts a new line that keeps the current indentation, and indents after { or [. |
| ArrowLeft / ArrowRight, Home / End | Move between the Body, Headers and Request tabs. |
| Tab | Moves through endpoint, event, reveal, copy, payload, Format, Send, tabs, copy, the response panel and each delivery with its Retry. |

## Accessibility

- Every field has a visible label; the payload textarea is labelled with the event type and reports aria-invalid when the JSON does not parse, with the line named in the footer.
- The signing secret is hidden from assistive technology until revealed; the reveal button is a toggle with aria-pressed and a label that says what it will do.
- Response tabs follow the tabs pattern with roving tabindex; the panel is focusable so long bodies can be scrolled from the keyboard.
- Delivery rows are buttons labelled with event, status and time, and mark the selected one with aria-current. Status chips pair an icon and a code or word, never color alone.
- A polite live region announces each send and its outcome, and adds "Simulated, nothing was sent" when no onSend is wired.

## Motion

- The timeline runs signed, sent, response: icons crossfade, the connector fills left to right and a small dot travels along it while the request is in flight, looping on the last leg until the response arrives.
- Text swaps (node labels, status chips, hints, the reveal icon) are a single crossfade: 100ms out, 160ms in with a 2px rise, in fixed slots so nothing shifts.
- A new delivery fades in at the top while the rows below glide down with a bounce free spring; the response panel crossfades between tabs and deliveries.
- Reduced motion keeps every end state and status change, drops the traveling dot, the fills and the glides, and slows the spinner.

## Responsive behavior

- Two columns from 680px of container width, stacked below; the payload editor stretches to match the response column when side by side.
- At 360px the delivery time hides and long event names truncate with an ellipsis; nothing scrolls horizontally except a long payload line inside the editor.
- Every target is at least 28px tall, and rows are 40px.

## Performance

- Highlighting is a single regex pass over the payload on each keystroke; fine for typical webhook bodies (under a few hundred lines).
- Signing uses WebCrypto (crypto.subtle) and falls back to a placeholder where it is unavailable, such as a non secure context.
- The traveling dot is a transform only animation and stops when no request is in flight; the autoplay observer disconnects after its single run.

## Notes for AI

- Use for the Test endpoint screen of a product that sends webhooks (billing, auth, email, CI): pass your own events and payloads, the endpoint's secret and an onSend that calls your backend, which performs the real POST and returns status, timing, headers and body.
- Never send the request from the browser to a customer endpoint; the request object is meant for your server, which can verify it re-signs identically.
- For a non Stripe product pass source (your product name and mark) and signatureHeader, such as "webhook-signature".
- Card is 760px max and splits into request and response columns from 680px; below that it stacks.

## Related

- [Webhooks](https://uiarc.dev/components/blocks/webhooks/markdown): A webhooks console with delivery history, a payload inspector and retries that roll the rate.
- [API keys](https://uiarc.dev/components/blocks/api-keys/markdown): API key management where Create key unfolds into its form and each secret is shown once.
- [Tool call](https://uiarc.dev/components/tool-call/markdown): A tool call row for agent transcripts: the tool's mark and the call in plain words, a live state while it runs, and the input and output a click away, with approval and retry when needed.
- [Copy button](https://uiarc.dev/components/copy-button/markdown): Copy a value with immediate confirmation.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
