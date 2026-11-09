# Keycap keyboard

> Mechanical keycaps that sink and light up as you type, with the text above the board.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/keycap-keyboard
- Markdown: https://uiarc.dev/components/keycap-keyboard/markdown
- Source file: `registry/components/keycap-keyboard/keycap-keyboard.tsx`
- Dependencies: lucide-react
- Keywords: special, keyboard, motion, new, mechanical keyboard, keycap animation, 3d keyboard react, keyboard component, typing animation, key press effect, virtual keyboard

## When to use

- Landing pages for keyboard-first products and developer tools.
- Onboarding that teaches shortcuts by lighting the keys they use.
- Playful empty states and easter eggs.

## When not to use

- Form input; use a real text field.
- On-screen keyboards for accessibility needs; use the platform's.

## Installation

Keycap keyboard is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/keycap-keyboard
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { KeycapKeyboard } from "@/components/arc/keycap-keyboard/keycap-keyboard";

export function TypeToTry() {
  return <KeycapKeyboard listen="window" placeholder="Type anything" />;
}

// Letters only
<KeycapKeyboard layout="letters" />

// A four key macro pad
<KeycapKeyboard rows={[["a", "r", "c", "backspace"]]} showOutput={false} />
```

## API reference

### KeycapKeyboard

A board of sculpted mechanical keycaps. Physical typing and clicks press the matching cap into its housing, bloom a faint light under it, and add the character to a wrapping text area above the board.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | – | Controlled text. |
| `defaultValue` | `string` | `""` | Initial text when uncontrolled. |
| `onValueChange` | `(value: string) => void` | – | Called with the new text after every key. |
| `layout` | `"compact" \| "letters"` | `"compact"` | Compact is a full 60% board with numbers, punctuation, and modifiers. Letters is three letter rows with shift, delete, and a space bar. |
| `rows` | `string[][]` | – | Custom rows that override layout. Single characters, plus "space", "backspace", "enter", "shift", "tab", and "caps". |
| `maxLength` | `number` | `280` | Longest text kept. Older characters drop off the start. |
| `listen` | `"focus" \| "window"` | `"focus"` | Where physical keys are heard. "window" listens across the page but ignores other text fields and shortcuts with Command, Control, or Alt. |
| `placeholder` | `string` | `"Start typing"` | Shown while the text is empty. |
| `showOutput` | `boolean` | `true` | Hides the typed text area when you render the value yourself. |
| `label` | `string` | `"Keyboard"` | Accessible name for the board. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Any printable key | Types the character and holds the matching cap down while the key is held. Caps match on physical position, so every layout lights the right cap. |
| Backspace | Deletes the last character; holding it repeats. |
| Enter | Starts a new line. |
| Shift, Tab, Caps, modifiers | Light their caps. Tab still moves focus. |
| Tab to a cap, then Enter or Space | Presses that cap as a button. Shift latches for the next character. |

## Accessibility

- Every cap is a real button named by its character or function (Space, Delete, Return, Shift).
- The typed text is a read-only, multiline textbox named Typed text; focusing it lets physical keys type in focus mode.
- Shortcuts with Command, Control, or Alt pass through untouched, and window mode never captures keys typed into other fields.

## Motion

- A cap drops 92% of its travel in 35ms on key down and returns in 200ms with a small lift past rest, so each press feels crisp.
- A faint light blooms on the board under the cap and fades over 700ms; fast typing leaves a soft trail.
- The caret holds still while you type and starts blinking again after 600ms idle. New characters fade in over 140ms.
- Reduced motion removes cap travel, character fades, and the blink; the light and legend color still respond.

## Responsive behavior

- One size unit comes from a container query so the widest row always fits, from 320px up to a 54px cap on wide screens.
- Travel, gaps, corner radii, and legends all scale from the same unit.
- Taps press caps on touch down; pointer capture keeps a cap down until the finger lifts.

## Performance

- Caps are memoized with stable props and never re-render while typing; a press flips one data attribute on one button.
- One native keydown and keyup listener on the window or the board. No layout reads on the key path.
- Travel and light are CSS transitions on transform and opacity only. A burst of 15 keys a second holds 16.7ms frames.
- The text area stays pinned to its newest line through column-reverse layout, with no scroll code.

## Notes for AI

- Use it as a playful hero or a try-it moment: keyboard-first products, typing tests, launch pages.
- listen="window" makes the page feel alive immediately; use "focus" when other inputs share the page.
- Pass rows to build a macro pad or a single word, such as [["a", "r", "c"]].
- It is not a replacement for a real text field in forms.

## Related

- [Shortcut recorder](https://uiarc.dev/components/shortcut-recorder/markdown): Record key combinations into key caps, with conflict warnings, Kbd, and a searchable cheatsheet.
- [Command palette](https://uiarc.dev/components/blocks/command-palette/markdown): A complete keyboard driven action surface with search, grouped results, and shortcuts.
- [Hold to confirm](https://uiarc.dev/components/hold-to-confirm/markdown): Confirm a destructive action by holding, not tapping.

## Also in type

- [Slot text](https://uiarc.dev/components/slot-text/markdown): Text and numbers that spin into their new value on staggered slot machine reels.
- [Sand text](https://uiarc.dev/components/sand-text/markdown): A headline made of sand that pours into the letters, crumbles where the cursor digs, and heals itself.
- [Typewriter terminal](https://uiarc.dev/components/typewriter-terminal/markdown): A terminal that types a scripted CLI session with a seeded human cadence, colors the shell syntax, and streams output lines, progress bars and spinners, with a scrubber, play/pause and replay controls.

## Guidance for AI tools

Keycap keyboard: Mechanical keycaps that sink and light up as you type, with the text above the board. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
