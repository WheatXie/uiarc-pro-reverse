# Seat manager

> A team seats and billing card where avatars and a seat meter show members, invites and open seats against what you pay for, a stepper rolls the prorated charge for today and the new monthly total live, and changes go through a confirm step before anyone is charged. Pending invites can be resent or revoked with undo, and when every seat is taken the card says so and offers to add one.

- Type: Block
- Page: https://uiarc.dev/components/blocks/seat-manager
- Markdown: https://uiarc.dev/components/blocks/seat-manager/markdown

- Access: Arc Pro
- Registry id: `seat-manager`
- Source file: `registry/blocks/seat-manager/seat-manager.tsx`
- Built from: Button, Avatar, TextShimmer
- Keywords: seat management, team seats, per seat billing, seat stepper, proration, prorated charge, pending invites, resend invite, revoke invite, seat limit, team billing, subscription quantity, stripe seats

Put it in the seats or members section of a team billing page. Pass `purchased` (the subscription quantity), `members`, `invites`, `plan` ({ name, pricePerSeat, interval, currency, maxSeats }) and the real billing `period` so the proration matches your billing system. Then wire `updateSeats(quote, signal)`, `resendInvite` and `revokeInvite` to your backend. Revoke runs after the undo window closes. If `updateSeats` rejects with an Error, its message appears in the footer with a Try again button. `buildQuote` is exported so your server can check the same numbers, and `onQuoteChange` lets you swap in your billing system's own invoice preview if you need it.

## When to use

- Letting a team admin add or remove paid seats with the price impact visible before paying.
- Showing seat usage against purchased seats, including invites that reserve a seat.
- Handling the seat limit at the moment an admin hits it, with a one tap way to add a seat.

## When not to use

- Managing roles and permissions for many members: use a member table and link to this card for seats.
- Usage based or credit billing: use credit-topup or a usage meter instead.
- Plan comparison or upgrades between tiers: use a pricing table.

## Installation

Seat manager is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/seat-manager
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { SeatManager } from "@/components/arc/blocks/seat-manager/seat-manager";

export function TeamBilling({ team }: { team: Team }) {
  return <SeatManager
    workspace={team.name}
    plan={{ name: "Pro", pricePerSeat: 16, interval: "month", maxSeats: 25 }}
    purchased={team.seats}
    members={team.members.map(m => ({ id: m.id, name: m.name, avatar: m.imageUrl }))}
    invites={team.invites.map(i => ({ id: i.id, email: i.email, invitedBy: i.inviter, note: i.sentAgo }))}
    period={{ start: team.periodStart, end: team.periodEnd }}
    paymentMethod={{ brand: "Visa", last4: team.cardLast4 }}
    updateSeats={(quote, signal) => fetch("/api/billing/seats", { method: "POST", body: JSON.stringify({ seats: quote.target }), signal }).then(r => { if (!r.ok) throw new Error("Your card was declined. Nothing was charged."); })}
    resendInvite={(invite, signal) => fetch(`/api/invites/${invite.id}/resend`, { method: "POST", signal }).then(() => undefined)}
    revokeInvite={(invite, signal) => fetch(`/api/invites/${invite.id}`, { method: "DELETE", signal }).then(() => undefined)}
  />;
}
```

## API reference

### SeatManager

Team seats and billing in one card. Avatars and a seat meter show members, pending invites and open seats against what is purchased; a stepper changes the seat count while the prorated charge for today and the new recurring total roll live; pending invites can be resent or revoked with undo; and Update seats asks for a confirm step before paying. When every seat is taken it says so and offers one tap to add a seat. With no props it plays a simulated loop on a Pro workspace, and nothing is charged or sent.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `workspace` | `string` | `"Halcyon"` | Workspace name shown under the title. |
| `plan` | `{ name: string; pricePerSeat: number; interval?: "month" \| "year"; currency?: string; maxSeats?: number }` | `Pro, $16 per seat per month, up to 25 seats` | Plan badge, seat price in major units, billing interval, ISO currency and the seat cap. The plus button stops at maxSeats and explains why. |
| `purchased` | `number` | `12` | Seats paid for right now. Becomes the new count after a successful update. |
| `members` | `{ id: string; name: string; avatar?: string }[]` | `10 sample members` | Members holding a seat. The first four show as avatars, the rest as a +N count. |
| `memberCount` | `number` | `members.length` | Total members when `members` is only a sample for the avatars. |
| `invites` | `{ id: string; email: string; invitedBy?: string; note?: string }[]` | `2 sample invites` | Pending invites. Each reserves a seat until accepted or revoked. `note` is a short muted suffix such as "2 days ago". |
| `period` | `{ start: Date \| string; end: Date \| string }` | `Oct 18 to Nov 18 2026` | Current billing period. Added seats are prorated by the days left; the new total starts at `end`. |
| `now` | `Date` | `new Date() (Oct 27 2026 in the demo)` | "Today" for proration. |
| `paymentMethod` | `{ brand: string; last4: string } \| null` | `Visa ending 4242` | Named in the footer and the confirm step. Pass null to hide it. |
| `receiptEmail` | `string` | `"billing@halcyon.so"` | Named in the done message. |
| `updateSeats` | `(quote: SeatQuote, signal: AbortSignal) => Promise<void>` | – | Applies the change. SeatQuote is { current, target, delta, dueToday, nextTotal, daysLeft, periodDays, renewsOn }. Reject with an Error and its message shows in the footer with Try again. |
| `resendInvite` | `(invite: SeatInvite, signal: AbortSignal) => Promise<void>` | – | Sends the invite email again. The button shows a spinner, then Sent. |
| `revokeInvite` | `(invite: SeatInvite, signal: AbortSignal) => Promise<void>` | – | Called when the undo window closes. Reject to put the invite back. |
| `undoSeconds` | `number` | `3` | How long Undo stays on a revoked invite. |
| `onQuoteChange` | `(quote: SeatQuote) => void` | – | Called whenever the stepper changes the quote. |
| `onSeatsChange` | `(seats: number, quote: SeatQuote) => void` | – | Called after a change is applied. |
| `onPhaseChange` | `(phase: "idle" \| "confirm" \| "saving" \| "done" \| "error") => void` | – | Called on every footer phase change. |
| `autoPlay` | `boolean` | `true when no handlers are passed` | Plays add three seats, pay, resend and revoke on a loop, pausing off screen. Any pointer or key press inside the card hands control to the person. |
| `className` | `string` | – | Extra class on the card. |

### buildQuote

The proration math the card uses, exported so a server can check the same numbers: buildQuote(current, target, plan, period, now) returns a SeatQuote. Added seats cost delta x price x daysLeft / periodDays, rounded to cents; removals cost nothing today and apply at renewal.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the stepper buttons, the seat count, invite actions and the footer buttons. |
| Arrow up / Arrow down | On the seat count (a spinbutton), adds or removes one seat. Arrow right and left do the same. |
| Page up / Page down | On the seat count, changes by five seats within the limits. |
| Home / End | On the seat count, jumps to the fewest seats allowed (members plus invites) or the plan maximum. |
| Space / Enter | Activates the focused button. Focus moves to Pay when the confirm step opens and back to Update seats after Back or a successful update. |

## Accessibility

- The card is a labelled section. The seat count is a spinbutton with min, max, value and a spoken value such as "15 seats".
- The seat meter is a single image with a full text label (used, members, invited, open, being added); the legend repeats the counts in text, so color is never the only signal.
- Limits stay explained, not silent: pressing past the minimum or the plan cap keeps the button focusable (aria-disabled) and shows why in the notice line.
- A polite live region announces review, update, resend, revoke and undo, and adds "Simulated, nothing was charged" (or sent) when no handlers are passed.
- Rolling numbers render the real value for screen readers and hide the digit strips.
- Every invite action has its own label, such as "Revoke invite to kai.tanaka@halcyon.so".

## Motion

- Numbers roll: each digit is a 0 to 9 strip that slides 240ms on an ease-out, with tabular numerals in a right-aligned slot so nothing shifts.
- Seat cells grow in from zero width and shrink out on a 240ms spring with no bounce; neighbours glide to make room.
- Text, icon and button swaps are single crossfades: old out in 100ms, new in over 160ms with a 2px rise.
- A revoked invite crossfades to an undo row, then collapses its measured height on a bounce-free spring.
- Press and hold on plus or minus repeats after 380ms, then every 70ms.
- Reduced motion keeps every state and number, swaps instantly and drops the rolls and cell growth. The demo loop pauses off screen.

## Responsive behavior

- Fills its container up to 560px and adapts with a container query, not the viewport.
- Below about 460px the padding tightens, the quote rows drop their muted notes and the legend hides the new seats item, which the notice line already states.
- Emails, notes and footer text truncate with an ellipsis; amounts and counts never wrap.
- Past 40 seats the meter groups cells into one segment per kind so it stays readable.

## Performance

- Plain DOM and CSS; digit rolls are CSS transforms and cell growth is a flex-grow spring.
- Every request is abortable and aborted on unmount; timers are cleared on unmount.
- The demo loop pauses when the card is off screen.

## Notes for AI

- Use for the seats or members section of a team billing page in any per-seat SaaS. Pass the subscription quantity as purchased and the real billing period so proration matches your processor.
- Proration here is a simple daily estimate. If your processor computes it (Stripe upcoming invoice preview), call it in onQuoteChange and pass the result to your confirm copy, or replace the numbers server side before charging.
- Pending invites hold seats, so the minimum is members plus invites. Revoking frees a seat at once with undo; the revoke handler runs after the undo window.
- Reject updateSeats with a human sentence ("Your card was declined. Nothing was charged."); it is shown verbatim with Try again.

## Related

- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Credit top-up](https://uiarc.dev/components/blocks/credit-topup/markdown): A card for buying AI credits. It shows the balance with a 14 day usage chart and how many days are left, three preset packs with bonus badges, a custom amount slider with a live price, auto top-up with a threshold and the saved Visa or Mastercard. When you buy, the new balance rolls in like an odometer.
- [Button](https://uiarc.dev/components/button/markdown): A clear, responsive action with quiet secondary states.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.
- [Checkout summary](https://uiarc.dev/components/blocks/checkout-summary/markdown): An order summary with a promo code that becomes a chip, discount and tax lines, and pay button states.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
