# Link unfurl

> A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/link-unfurl
- Markdown: https://uiarc.dev/components/link-unfurl/markdown
- Source file: `registry/components/link-unfurl/link-unfurl.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, composer, link-preview, morph, motion, new, link preview, unfurl, open graph, og image, rich link, embed, url preview, chat input, slack, paste link

## When to use

- A message or comment composer where pasted links should show what they point to before sending.
- Product marketing that shows how a chat or notes app handles links.

## When not to use

- Use hover-card to preview a link someone reads, not writes.
- Use mention-input when the tokens are people or records rather than web links, and rich-text-editor for long formatted documents.

## Installation

Link unfurl is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/link-unfurl
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { LinkUnfurl, type LinkUnfurlPreview } from "@/components/arc/link-unfurl/link-unfurl";

export function ChannelComposer({ channel, post }: { channel: string; post: (text: string) => Promise<void> }) {
  return <LinkUnfurl
    label={`Message #${channel}`}
    placeholder={`Message #${channel}`}
    defaultValue=""
    samples={[]}
    autoPlay={false}
    resolve={async (url, signal) => {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`, { signal });
      return res.ok ? (await res.json()) as LinkUnfurlPreview : null;
    }}
    onSend={message => post(message.text)}
  />;
}
```

## API reference

### LinkUnfurl

A message composer that unfurls links. Paste an address and it becomes an inline link with a soft loading sweep; once the preview resolves, the favicon and title roll in and the link unrolls into a rich card with site, title, description, and image in one continuous morph. The card's corner grows out of the link itself, width first and height after, lifting on a shadow while it travels. Click the link, press the collapse button, or drag the card up to fold it back into the text; remove it to take the link out of the message.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | `"Message #lisbon-offsite"` | Accessible name of the message field. |
| `placeholder` | `string` | `"Message #lisbon-offsite"` | Shown while the message is empty. |
| `defaultValue` | `string` | `"Found a place for the offsite, take a look"` | Starting text of the message. |
| `samples` | `LinkUnfurlPreview[]` | – | Sample links offered as buttons under the field; the built in resolver answers with their previews. Once a sample is in the message its button shows or collapses its card. Pass an empty array to hide them. |
| `resolve` | `(url: string, signal: AbortSignal) => Promise<LinkUnfurlPreview \| null>` | – | Fetches the preview for a pasted address, usually from your own unfurl endpoint. Return null when there is none; the link then stays in the text without a card and can be clicked to try again. Without it, samples resolve by address and other links get a plain preview built from the address after a 1.15s simulated fetch. |
| `autoExpand` | `boolean` | `true` | Unfurls a card as soon as its preview resolves. When false the link only gains its favicon and title, and opens on click. |
| `autoPlay` | `boolean` | `true` | Pastes the first sample the first time the composer scrolls into view, unless someone has already interacted. |
| `speed` | `number` | `1` | Multiplier for the morph and the simulated fetch. |
| `paused` | `boolean` | `false` | Opens and folds cards instantly without the morph and turns autoplay off. |
| `accent` | `string` | – | Color of an unfurled link and its tie to its card. Defaults to the accent. |
| `sendLabel` | `string` | `"Send message"` | Accessible name of the send button. |
| `onSend` | `(message: LinkUnfurlMessage) => void \| Promise<unknown>` | – | Called on Enter or the send button with the text (links written out as addresses) and the resolved previews. Return a promise to hold the composer while it is pending; a rejection shows its message under the composer. On success the composer clears and the button confirms with a check. |
| `className` | `string` | – | Extra class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. |

## Accessibility

- The message is a contenteditable element with role="textbox", aria-multiline, a label, and a description of its keys. Pasting inserts plain text, and a pasted or typed address (followed by a space) becomes an atomic link that deletes as one unit.
- Keyboard: Enter sends, Shift+Enter adds a line, and Alt+Enter shows or collapses the preview of the link before the caret. Every card has a named collapse button and a named remove button, and its title is a real link.
- A folded card is inert and hidden from assistive technology, so only open previews are in the tab order.
- A polite live region announces a link being added and loading, the preview opening with its site and title, collapsing, removal, a failed preview, and the sent message. Send errors use role="alert".
- Loading is shown by the sweep and by muted text and a globe instead of a favicon, and announced, never by color alone.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Focused controls take a muted fill.

## Motion

- One rAF loop drives every card from a critically damped spring, writing only transforms, clip paths, opacity, and the plate size; React renders once per state change, never per frame.
- The card is clipped to the exact rectangle of its inline link, with the favicons aligned, and translated onto it. As the spring runs the clip widens first and deepens after, while the translation eases home, so the link reads as unrolling into the card. A plate under the card carries its border and a shadow that lifts only mid flight.
- The lane grows with the card's height on the same progress, so the toolbar below glides instead of jumping. The body fades in after the header, and the image settles from a slight zoom.
- When a preview resolves, the link's width morphs to fit the title while the title rolls up and the favicon pops in.
- Collapsing runs the same path backwards on a quicker spring. Dragging a card up folds it with the pointer; releasing past about 40% or with an upward flick folds it, otherwise it springs back.
- The loop sleeps once cards settle, and cards land instantly when the composer is offscreen or the tab is hidden; the loading sweep pauses with them. Reduced motion and paused open and fold cards instantly and show a still tint instead of the sweep.

## Responsive behavior

- The composer sizes itself from its own width with container queries: padding steps up from 560px, and the Try label hides below 360px so the sample buttons and send button stay on one row.
- Cards are at most 440px wide and fill narrower composers; images keep the 1.91 : 1 Open Graph ratio. Links truncate at 16em with the full title in the card and the accessible name.
- On touch only the card header drags, so the page still scrolls over the card body and image.

## Performance

- Each frame reads all geometry first and then writes, so the loop costs one layout pass. Nothing is created or removed while animating.
- Preview images are decoded before the card opens, so the morph never reveals an empty frame.

## Notes for AI

- Use it in chat, comments, and notes where links are shared and a preview helps people decide whether to open them.
- Unfurl on your server (Open Graph and oEmbed) and return site, title, description, image, and favicon through resolve. Honor the abort signal; it fires when the link is removed or the message is sent.
- The favicon slot in the link and the card are aligned on purpose; keep favicons square.
- Brand marks in the samples are sample content, not endorsements.

## Related

- [Mention input](https://uiarc.dev/components/mention-input/markdown): A textarea with @people and #channel mentions that act as single tokens, with suggestions at the caret.
- [Rich text editor](https://uiarc.dev/components/rich-text-editor/markdown): A lightweight editor with markdown shortcuts, a floating toolbar, a slash menu, and HTML and markdown output.
- [Hover card](https://uiarc.dev/components/hover-card/markdown): Preview a person or link on hover or focus without leaving the page.
- [Chat thread](https://uiarc.dev/components/chat-thread/markdown): A chat thread with grouped messages, reactions, read receipts, typing, and a composer with attachments.

## Also in surfaces

- [Sheet stack](https://uiarc.dev/components/sheet-stack/markdown): Nested sheets that stack with depth, drag to dismiss, and become stacked dialogs on wide screens.
- [Wallet stack](https://uiarc.dev/components/wallet-stack/markdown): Fan a stack of cards and lift one out to see its activity.
- [Control center](https://uiarc.dev/components/control-center/markdown): Workspace quick settings: tiles that morph into detail, a duration dial, and rubber-banded meters.
- [Holo card](https://uiarc.dev/components/holo-card/markdown): A member card that tilts toward you with a holographic foil and flips to its back.
- [Card to article](https://uiarc.dev/components/card-to-article/markdown): Story cards that open into full articles with one seamless morph and shrink back into their exact slot when dragged down.

## Guidance for AI tools

Link unfurl: A composer where pasting a URL shows a loading shimmer on the link, then unfurls it into a rich preview card with title, image and favicon in one morph, which can be collapsed back to the inline link or removed. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
