# Contact section

> A validated contact form that morphs into a confirmation, support channels, and office cards with local times.

- Type: Block
- Page: https://uiarc.dev/components/blocks/contact-section
- Markdown: https://uiarc.dev/components/blocks/contact-section/markdown

- Access: Free, open source
- Registry id: `contact-section`
- Source file: `registry/blocks/contact-section/contact-section.tsx`
- Built from: Motion
- Keywords: react contact form, contact section, contact page, office hours time zones, support channels, validated contact form

Use this as a starting point and replace the sample data with your own.

## When to use

- Contact pages and sections on marketing sites.
- Sales or support pages that list several channels with response times.
- Companies with offices in several time zones.

## When not to use

- Use support-widget for an in-app help launcher.
- Use signup-form or login blocks for account flows.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/contact-section
pnpm dlx shadcn@latest add @uiarc/contact-section
yarn dlx shadcn@latest add @uiarc/contact-section
bunx --bun shadcn@latest add @uiarc/contact-section
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/contact-section.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/contact-section/contact-section.tsx`

   The source is in the registry item: https://uiarc.dev/r/contact-section.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { ContactSection } from "@/components/arc/blocks/contact-section/contact-section";

export function Contact() {
  return (
    <ContactSection
      title="Talk to us"
      topics={["Sales", "Support"]}
      onSubmit={async message => {
        const response = await fetch("/api/contact", { method: "POST", body: JSON.stringify(message) });
        if (!response.ok) throw new Error("Could not send");
      }}
    />
  );
}
```

## API reference

### ContactSection

A contact section in three layouts: a validated form that springs into a confirmation, a list of channels with detail, or offices with live local times and open status.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"form" \| "channels" \| "offices"` | `"form"` | Layout. |
| `title` | `string` | – | Section heading. |
| `description` | `string` | – | One line under the heading. |
| `topics` | `string[]` | `["Sales", "Support", "Partnerships", "Press"]` | Topics offered in the form as a radio group of chips. |
| `onSubmit` | `(message: { name; email; topic; message }) => void \| Promise<void>` | – | Called with a valid message. Reject to keep the form and show an error; resolve to show the confirmation. |
| `channels` | `{ value; label; meta; icon?; detail: ReactNode }[]` | `contactExampleChannels` | Ways to reach you for the channels variant. |
| `channel` | `string` | – | Selected channel (controlled). |
| `defaultChannel` | `string` | – | Initial channel when uncontrolled. |
| `onChannelChange` | `(value: string) => void` | – | Called when the channel changes. |
| `offices` | `{ city; timeZone; address: string[]; email?; hours?: [number, number] }[]` | `contactExampleOffices` | Offices. timeZone is an IANA zone; hours default to 9 to 18 local time. |
| `className` | `string` | – | Extra class on the section. |

### ContactSectionBlock

Default export: a preview with a layout switcher. Messages are simulated and never sent.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `ContactSectionVariant` | `"form"` | Initial variant. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move between topic chips, which form a radio group. |

## Accessibility

- Fields use labelled Arc Input and Textarea; errors appear after the first submit and update as you type.
- A failed send shows a role="alert" message and keeps the form.
- Office open status is written out, not shown by color alone.

## Motion

- The form card springs into the confirmation; faces slide along one axis in the direction of travel out of a soft blur.
- The topic highlight glides between chips.
- Reduced motion swaps faces without travel.

## Responsive behavior

- Container queries: below 820px the form layout stacks and the channel list becomes a horizontal scrolling row; below 520px field rows stack and the submit button fills the width.

## Performance

- The offices variant re-renders every 15 seconds to keep local times live; other variants have no timers.

## Notes for AI

- Without onSubmit the form only simulates sending; always wire it in production.
- Offices compute local time and open status with Intl.DateTimeFormat in each timeZone.
- Composes Arc Input, Textarea, Button, CopyButton, SegmentedControl, and Avatar.

## Related

- [Login and sign up: Sign up](https://uiarc.dev/components/blocks/login/markdown): An account creation flow with field validation, password strength, and a clear completion state.
- [Support widget](https://uiarc.dev/components/blocks/support-widget/markdown): An in-app help launcher that grows into live article search, reading, and a chat with your team.
- [FAQ section](https://uiarc.dev/components/blocks/faq-section/markdown): FAQs as an accordion, a topic rail, or a searchable list that highlights matches.
- [Site footer](https://uiarc.dev/components/blocks/site-footer/markdown): A website footer with link columns and newsletter, a minimal layout, and a large fading Arc mark.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
