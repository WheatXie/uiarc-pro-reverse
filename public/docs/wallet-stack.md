# Wallet stack

> Fan a stack of cards and lift one out to see its activity.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/wallet-stack
- Markdown: https://uiarc.dev/components/wallet-stack/markdown
- Source file: `registry/components/wallet-stack/wallet-stack.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, wallet, cards, react wallet, credit card stack, apple wallet ui, payment cards component, card stack animation, fintech card ui

## When to use

- A few payment cards, passes, or memberships where people open one to see its balance and activity.
- Fintech or wallet screens that want a physical card metaphor with realistic materials.

## When not to use

- Use card-stack for generic swipeable content that is not a card wallet.
- Use a plain list or data-grid for many accounts.
- Use expandable-card when one card just needs to grow in place.

## Installation

Wallet stack is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/wallet-stack
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { WalletStack } from "@/components/arc/wallet-stack/wallet-stack";

export function Cards() {
  return (
    <WalletStack
      cards={[
        { id: "debit", issuer: "Northbank", product: "Everyday debit", lastFour: "4821", holder: "Ada Lovelace", expires: "09/29", variant: "metal",
          balance: 2480.5, balanceLabel: "Available",
          transactions: [{ id: "t1", merchant: "Blue Bottle", detail: "Coffee · Today", amount: -6.5 }] },
        { id: "travel", issuer: "Northbank", product: "Travel credit", lastFour: "0917", holder: "Ada Lovelace", expires: "03/28", variant: "color", tint: "oklch(42% .15 262)",
          balance: 812.4, balanceLabel: "Spent this month", transactions: [] },
      ]}
      onSelectedChange={card => console.log(card?.id)}
    />
  );
}
```

## API reference

### WalletStack

A stack of payment cards with real materials and depth: brushed metal, a guilloche black card, frosted glass, and deep color, each with an EMV chip, contactless mark, embossed number, and a light that follows the pointer or device tilt. Hover to fan the stack, drag or use the arrow keys to cycle cards, and choose a card to lift it into its balance and recent activity.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `cards` (required) | `{ id: string; issuer: string; product: string; lastFour: string; holder: string; variant?: "metal" \| "black" \| "glass" \| "color"; tint?: string; expires?: string; network?: ReactNode; image?: string; balance: number; balanceLabel: string; transactions: { id: string; merchant: string; detail: string; amount: number; icon?: ReactNode; avatar?: string }[] }[]` | – | Cards in stack order, the first in front. variant picks the material (metal by default); tint is any CSS color for the color variant; expires shows as Valid thru; network replaces the built-in fictional Halo mark, or null hides it; image is optional artwork under the finish. Amounts are negative for spending and positive for money in; avatar replaces the icon for transfers between people. The older finish field still works: paper maps to metal, graphite to black, clay and photo to color. |
| `label` | `string` | `"Wallet"` | Heading above the stack, also its accessible name. |
| `currency` | `string` | `"USD"` | ISO currency code for balances and amounts. |
| `locale` | `string` | `"en-US"` | Locale for number formatting. |
| `onSelectedChange` | `(card: WalletStackCard \| null) => void` | – | Called with the opened card, or null when it goes back into the stack. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Down or Right brings the next card to the front, Up or Left the previous one. While a card is open they switch the open card. Home and End jump to the first and last card. |
| Enter / Space | Opens the front card into its balance and activity, or puts the open card back. |
| Escape | Puts the open card back into the stack and returns focus to it. |

## Accessibility

- The stack is a labelled group with a described keyboard hint. Only the front card is in the tab order (roving tabindex); each card is a button named by issuer, product, last four digits, position, and balance, with aria-expanded while open.
- The masked digits and decorative artwork are hidden from assistive technology; only the last four digits are read.
- The activity region is inert until a card is open; the header switches from the card count to an All cards button that closes it.
- Cycling and opening are announced in a polite live region, and focus returns to the card when it goes back into the stack.

## Motion

- Every card's transform is one pure function of a continuous stack position, the open amount, and the fan amount, so springs, drags, and interruptions all move the same shape. Z order never changes, so cards never pop over one another.
- Hovering fans the stack upward on a no-overshoot spring; the hovered card rises out of the fan and its shadow deepens. The front card tilts up to 5 degrees and a specular highlight follows the pointer, or device tilt on phones that report it.
- Dragging down pushes the front card into the pocket at the bottom and brings the next one forward one to one under the pointer; dragging up pulls it back. A flick lands where its momentum projects, one card at a time, with rubber banding past the first and last card.
- Choosing a card lifts it to the top on one critically damped spring while the others tuck into the pocket; its balance counts up and three transactions stagger in. Pull the open card down to put it back, or flick it.
- Only transform and opacity animate: shadows fade their opacity, the light moves a pre-painted layer. MotionConfig and a reduced motion branch remove travel, tilt, and the light; state changes apply instantly.

## Responsive behavior

- The wallet is min(100%, 18.5rem) wide. Cards keep the ID-1 ratio of 85.6 by 53.98 and every detail is sized in container units, so the card scales as one object; the stage height follows the card height.
- The stage uses touch-action pan-x, so a vertical drag cycles cards while horizontal page gestures still work. An open card switches to touch-action none so it can be pulled down by touch.
- Pointer tilt and the fan react to mouse only; on phones that report device orientation the light follows the tilt of the device instead.

## Performance

- Position, open amount, fan, and stage size are motion values, so gestures and springs never re-render React; the stage is measured once before paint and on resize.
- Only transform and opacity animate. Shadows and the specular light are painted once and faded or moved; the stage clips vertically instead of masking so the glass card's backdrop blur stays cheap and correct.
- Every card renders its artwork and transactions; keep the stack to a handful of cards.

## Notes for AI

- Choose it for a few payment cards, passes, or memberships where people open one at a time to see its activity. Use card-stack for generic swipeable content and a plain list for many accounts.
- Pass fully shaped cards including balanceLabel and transactions, and a variant per card so the materials read as different cards. Selection is managed internally and reported through onSelectedChange.
- The network mark is fictional. Never pass real card numbers; only lastFour is shown.

## Related

- [Card stack](https://uiarc.dev/components/card-stack/markdown): Review a deck one card at a time, with a throw and an undo.
- [Expandable card](https://uiarc.dev/components/expandable-card/markdown): Give a dense card more room when requested.

## Also in surfaces

- [Sheet stack](https://uiarc.dev/components/sheet-stack/markdown): Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.
- [Control center](https://uiarc.dev/components/control-center/markdown): Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.
- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.
- [Link unfurl](https://uiarc.dev/components/link-unfurl/markdown): A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

## Guidance for AI tools

Wallet stack: Fan a stack of cards and lift one out to see its activity. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
