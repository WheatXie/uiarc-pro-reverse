# Presence stack

> Avatars of the people here now: joins pop in as the stack reflows, a counter rolls past the limit, dots show typing and idle, and hover fans it out with a gliding name label.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/presence-stack
- Markdown: https://uiarc.dev/components/presence-stack/markdown
- Source file: `registry/components/presence-stack/presence-stack.tsx`
- Dependencies: motion, @radix-ui/react-popover
- Keywords: data, avatar, realtime, new, presence, avatars, avatar stack, facepile, who is here, online, collaboration, multiplayer, typing indicator, idle, status, join, leave, overflow, roster

## When to use

- A document, board or design file header that shows who is here right now.
- A call or meeting roster where people come and go and some are talking or idle.
- Any realtime surface where joins, leaves and typing should be felt, not just counted.

## When not to use

- Use avatar-group for a static list of owners, assignees or members that does not change while you look at it.
- Use live-cursors when you also need cursors and selections on a canvas; it includes its own small stack.
- Use a plain count for very large rooms, such as a livestream with thousands of viewers.

## Installation

Presence stack is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/presence-stack
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { PresenceStack, type PresencePerson } from "@/components/arc/presence-stack/presence-stack";

export function DocumentHeader({ doc, me }: { doc: Doc; me: User }) {
  // From your realtime layer: Liveblocks, PartyKit, Supabase Realtime or your own socket.
  const others = useOthers();
  const people: PresencePerson[] = [
    { id: me.id, name: me.name, src: me.avatar, status: "active" },
    ...others.map(other => ({
      id: other.id,
      name: other.name,
      src: other.avatar,
      status: other.typing ? "typing" : other.idle ? "idle" : "active",
      detail: other.section ? `Editing ${other.section}` : undefined,
    })),
  ];

  return (
    <header className="flex items-center justify-between">
      <h1>{doc.title}</h1>
      <PresenceStack people={people} selfId={me.id} align="end" onPersonSelect={person => followCursor(person.id)} />
    </header>
  );
}
```

## API reference

### PresenceStack

Overlapping avatars of the people here now. A person joining pops into their slot on a spring while the others slide to make room; someone leaving shrinks away and the gap closes. Past max the rest collapse into a +N counter that rolls up or down. Each face carries a status: a green dot for active, a dimmed portrait with a grey dot for idle, and a dot that stretches into a tiny typing indicator while they type. Hover or keyboard focus never moves the stack; one name label glides between the faces, its width following each name on a spring. Clicking opens a list of everyone with what they are doing.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `people` (required) | `readonly PresencePerson[]` | – | Everyone here now, in display order: { id, name, src?, status?: "active" \| "idle" \| "typing", detail? }. Add, remove, reorder or change a status and the stack animates to match. Ids key the avatars, so the same person keeps their place. |
| `max` | `number` | `4` | Faces shown before the rest collapse into the +N counter. |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Avatar diameter: 28, 36 or 44px. The overlap, status dot and label scale with it. |
| `align` | `"start" \| "end"` | `"start"` | The side the stack is anchored to. The component reserves the width of a full stack; with end the faces sit against the right edge and grow to the left, which suits a header next to a Share button. |
| `selfId` | `string` | – | Id of the person using the app. Marked (you) in the hover label and the list. |
| `label` | `string` | `"People here now"` | Accessible name of the stack button. The count of people is added to it. |
| `heading` | `string` | `"Here now"` | Heading of the list, shown with a rolling count. |
| `open` | `boolean` | – | Whether the list of everyone is open. Pass with onOpenChange to control it. |
| `defaultOpen` | `boolean` | `false` | Initial open state when uncontrolled. |
| `onOpenChange` | `(open: boolean) => void` | – | Called when the list opens or closes, from a click, Escape or a click outside. |
| `onPersonSelect` | `(person: PresencePerson) => void` | – | Makes each row in the list a button, for example to follow that person's cursor or jump to where they are. The list closes after a pick. |
| `announce` | `boolean` | `true` | Announces joins and leaves in a polite live region, such as Emma Collins joined. |
| `className` | `string` | – | Class on the root element. |
| `style` | `CSSProperties` | – | Inline styles on the root element. Set --presence-ring to the color behind the stack so the cut out rings match it. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Focuses the stack. It stays in place; arrow keys name each face. |
| Arrow Left / Arrow Right | Moves the name label from face to face while the stack has focus. |
| Enter / Space | Opens the list of everyone; focus moves into it. |
| Tab (in the list) | Moves between rows when onPersonSelect makes them buttons. |
| Escape | Closes the list and returns focus to the stack. |

## Accessibility

- The stack is one button named with the label and the count, such as People here now, 6 people, with aria-haspopup and aria-expanded from the popover.
- The faces, status marks and hover label are decorative; the list repeats every name with their status or detail in text, so nothing depends on color or on the typing animation.
- Joins and leaves are announced in a polite live region. Status changes are not announced to avoid chatter; they are in the list.
- The list is a labelled dialog from Radix Popover: focus moves in on open, Escape and a click outside close it, and focus returns to the stack.
- Rows are plain content unless onPersonSelect is set, then each is a button named with the person and what they are doing.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Keyboard focus shows through the name label, which arrow keys move between faces.

## Motion

- Faces are positioned with transforms only. Reflow after a join or leave rides the smooth spring, so a burst of changes blends into one movement instead of queueing.
- A joining face pops in from 40 percent scale on the morph spring, with a hint of overshoot; a leaving face shrinks and fades in 160ms while its neighbours already close the gap.
- The +N counter rolls the way it moved: up for more people, down for fewer. Its number is nudged into the visible part of the chip.
- Hover keeps the 68 percent overlap and never spreads the stack; the hovered face lifts 2px, and one name label glides between faces on the morph spring while its width follows the new name. The label takes its first width at once so it never grows from nothing.
- The status dot scales into a small typing pill whose three dots rise in turn; idle dims the portrait with a fade.
- The list opens from the stack with a short scale and fade; rows expand and collapse in height as people come and go, and the count and detail lines roll.
- With reduced motion every change applies at once: no pop, slide, roll or bouncing dots, and the list simply appears.

## Responsive behavior

- The stack reserves its rest width, so it fits beside a title even at 320px. Hover never changes its width, so it never pushes content.
- On touch there is no hover; a tap opens the list, which carries the same names and statuses.
- The list is 288px wide and stays inside the viewport with collision padding; it scrolls past about six rows.

## Performance

- Only transforms and opacity animate for the stack. Photos render at the exact size, as plain img elements unless ArcProvider sets an image component such as next/image.
- Motion springs are interruptible and stop when settled; nothing runs at rest except the three typing dots, which are a compositor animation and stop with reduced motion.
- Diffing joins and leaves for the live region is a single pass over the ids per update.

## Notes for AI

- Use it wherever a realtime app shows who else is here: a document or board header, a call roster, a shared dashboard.
- Map your presence data to people on every change and pass the whole array; do not animate anything yourself. Keep ids stable across updates.
- Put the current user first and pass selfId so the label and list say (you). Put the most recently active people next so they stay visible before the +N counter.
- Use align="end" in a right aligned header. The component reserves the width of max faces plus the counter so neighbours never shift as people join.
- Use detail for the specific place, such as Editing Pricing; it falls back to Active now, Idle or Typing.
- Set --presence-ring on the component to the surface color behind it so the rings around faces and dots cut out cleanly.

## Related

- [Avatar group](https://uiarc.dev/components/avatar-group/markdown): Show a team or set of contributors in a small space.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.
- [Popover](https://uiarc.dev/components/popover/markdown): A small anchored surface for contextual information.

## Also in avatars

- [Badge](https://uiarc.dev/components/badge/markdown): A small label for status, category, or metadata.

## Guidance for AI tools

Presence stack: Avatars of the people here now: joins pop in as the stack reflows, a counter rolls past the limit, dots show typing and idle, and hover fans it out with a gliding name label. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
