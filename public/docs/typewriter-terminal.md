# Typewriter terminal

> A terminal that types a scripted CLI session with a seeded human cadence, colors the shell syntax, and streams output lines, progress bars and spinners, with a scrubber, play/pause and replay controls.

- Type: Component (special)
- Access: Arc Pro
- Page: https://uiarc.dev/components/typewriter-terminal
- Markdown: https://uiarc.dev/components/typewriter-terminal/markdown
- Source file: `registry/components/typewriter-terminal/typewriter-terminal.tsx`
- Dependencies: motion, lucide-react
- Keywords: special, motion, terminal, new, typewriter, cli, install, command line, shell, typing animation, npm, developer tools, replay, scrubber

## When to use

- A landing page hero or install section for a developer tool, SDK, or CLI.
- Docs quick starts that show what each command prints before people run it.
- Changelog or launch posts that show a new command in action.

## When not to use

- Use code-block for commands and source that people need to read and copy without waiting.
- Use log-stream for real, live output from a running process.
- Use code-magic-move to show how a file changes between versions.

## Installation

Typewriter terminal is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/typewriter-terminal
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TypewriterTerminal } from "@/components/arc/typewriter-terminal/typewriter-terminal";

export function InstallHero() {
  return (
    <TypewriterTerminal
      title="Install"
      steps={[
        {
          command: "npm install @acme/sdk",
          output: [
            { kind: "progress", label: "Fetching packages", duration: 1.2 },
            { text: "Added 12 packages in 1.8s", tone: "success" },
          ],
        },
        {
          command: "npx acme login",
          output: [
            { kind: "task", label: "Opening the browser", done: "0.3s" },
            "Signed in as dana@acme.dev",
          ],
        },
      ]}
      rows={8}
    />
  );
}
```

## API reference

### TypewriterTerminal

A terminal window that types a scripted CLI session with a human cadence. Each command is colored as shell syntax while it is typed: the program, flags, strings, paths and packages, operators, and env assignments. Output streams in underneath as plain lines, progress bars that fill with a realistic stall, and spinners that resolve to a tick with a timing. The screen follows the newest line on a spring, and a scrubber under the window rewinds and replays the whole session, so the text untypes and retypes under your finger.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` | `{ command: string; output?: TypewriterTerminalOutput[]; cwd?: string; pause?: number }[]` | `A create-next-app, shadcn add, and npm run dev session` | The session in order. cwd changes the working directory shown in this prompt and every later one. pause is the rest in seconds after the output. |
| `TypewriterTerminalOutput` | `string \| { text, tone?, delay? } \| { kind: "progress", label, duration? } \| { kind: "task", label, done?, duration? }` | – | A string prints a plain line and an empty string a blank line. tone is default, muted, success, warning, danger, or accent; success, warning, and danger add a matching icon. URLs in text are shown as links. A progress line fills a bar with a percentage. A task shows a spinner, then a tick and its done text, such as 0.4s. |
| `title` | `string` | `"zsh"` | Window title in the title bar. |
| `cwd` | `string` | `"~"` | Working directory shown in the prompt until a step sets its own. |
| `symbol` | `string` | `"$"` | Prompt symbol after the working directory. |
| `speed` | `number` | `1` | Multiplies the playback pace. At 1 the default session takes about sixteen seconds. The cadence itself is seeded from the commands, so it is identical in every replay and on the server. |
| `paused` | `boolean` | `false` | Holds playback where it is, easing to rest instead of stopping in one frame. |
| `loop` | `boolean` | `true` | After a short rest the screen clears upward and the session plays again while the scrubber glides back to the start. When false, playback stops on the final prompt and the play button replays. |
| `rows` | `number` | `11` | Visible rows. The window keeps this height and older lines scroll up as the session grows. |
| `copyable` | `boolean` | `true` | Shows a copy button in the title bar that copies every command, one per line. |
| `accent` | `string` | – | Color of the caret, progress fills, spinners, links, and the scrubber. Defaults to the accent token. |
| `label` | `string` | `"Terminal session"` | Accessible name of the figure. |
| `caption` | `ReactNode` | – | Optional visible caption under the terminal, rendered as a figcaption. |
| `className` | `string` | – | Extra class on the root figure. |
| `style` | `CSSProperties` | – | Inline styles on the root figure. |

## Accessibility

- The root is a figure named by label. The animated screen is hidden from assistive technology, and a visually hidden ordered list gives the full transcript: every command and what it printed.
- The scrubber is a real slider with role="slider", its value in seconds, and a value text that names the current step and command. Arrow keys and Page keys jump to the previous or next command, Home and End go to the start and end, and Space or K plays and pauses.
- Play, pause, and replay are real buttons with specific names. Seeking, pausing, and replaying are announced in a polite live region. Autoplay is not announced, so the loop never floods a screen reader.
- Status never relies on color alone: success, warning, and danger lines carry an icon, tasks show a tick, and progress shows a percentage.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring.

## Motion

- One rAF loop derives the whole screen from a single session time and writes attributes, text, transforms, and opacity straight to the DOM, only when a value changed. React does not render per frame.
- Typing follows a seeded human cadence: a short think before the first key, quick bursts inside words, small stalls on shifted keys and word breaks. The caret stays solid while keys land and blinks softly while it waits.
- Each output line rises a few pixels and fades in. Progress bars fill with a quick start, a stall around the middle, and a steady finish, with a tabular percentage. Spinners cycle braille frames and resolve to a tick.
- The screen follows the newest line on a critically damped spring, and only measures when the visible text changes. The top edge feathers lines away as they scroll off.
- Scrubbing is direct: the session follows the pointer exactly, text untypes and retypes, and a release within a few pixels of a command start settles onto it. Keyboard jumps and replay glide through time on an ease in out curve, so replay visibly rewinds the session.
- Play and pause ease the playback rate on a spring instead of stopping in one frame. The loop clears upward while the scrubber glides back, so it never jumps. The loop stops off screen and in hidden tabs. With reduced motion the finished session shows at once, the caret stops blinking, and the scrubber still jumps between steps.

## Responsive behavior

- The window fills its container and keeps a fixed height in rows. A container query drops the text to the small size and tightens padding below 560px, and hides the time readout below 400px.
- Long commands and output wrap character by character like a real terminal, and the screen still follows the newest line.
- The scrubber and buttons keep 44px touch targets at every width.

## Performance

- The session is compiled once per script into timings. Each frame only compares cached values, so an idle frame writes nothing.
- The loop rests when playback is paused and settled, off screen, and in hidden tabs.

## Notes for AI

- Use it for install instructions, CLI marketing, and quick starts where seeing the commands run sells the product.
- Keep commands real and copyable, since the copy button copies them verbatim. Keep each command under about fifty characters so it fits one line on wide screens; longer ones wrap.
- Two to four steps with two to four output lines each read best. Use tasks and progress lines for work that takes time, and one success line to end each step.
- Everything shown is a simulation. Say so if it could be read as a live session.

## Related

- [Code block](https://uiarc.dev/components/code-block/markdown): Present code with legible hierarchy and copy access.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.

## Also in type

- [Keycap keyboard](https://uiarc.dev/components/keycap-keyboard/markdown): Mechanical keycaps that sink and light up as you type, with the text above the board.
- [Slot text](https://uiarc.dev/components/slot-text/markdown): Text and numbers that spin into their new value on staggered slot machine reels.
- [Sand text](https://uiarc.dev/components/sand-text/markdown): A headline made of sand that pours into the letters, crumbles where the cursor digs, and heals itself.

## Guidance for AI tools

Typewriter terminal: A terminal that types a scripted CLI session with a seeded human cadence, colors the shell syntax, and streams output lines, progress bars and spinners, with a scrubber, play/pause and replay controls. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
