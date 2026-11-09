# Newsletter signup

> An email signup framed by a stack of past issues; subscribing drops the next issue, addressed to you, onto the front.

- Type: Block
- Page: https://uiarc.dev/components/blocks/newsletter-signup
- Markdown: https://uiarc.dev/components/blocks/newsletter-signup/markdown

- Access: Free, open source
- Registry id: `newsletter-signup`
- Source file: `registry/blocks/newsletter-signup/newsletter-signup.tsx`
- Built from: Segmented control
- Keywords: newsletter, email signup, subscribe, waitlist, email capture, mailing list, form, digest, issue

Use this to collect newsletter or waitlist emails. Pass onSubscribe to call your email provider and throw on failure; subscribing in the preview is simulated.

## When to use

- Collecting emails for a newsletter, digest, or changelog that has real issues to show.
- The end of a blog post or docs page.

## When not to use

- Account creation with a password. Use Signup form.
- Longer forms with several fields. Use Contact section.
- A launch waitlist at the top of a page. Use Hero signup.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/newsletter-signup
pnpm dlx shadcn@latest add @uiarc/newsletter-signup
yarn dlx shadcn@latest add @uiarc/newsletter-signup
bunx --bun shadcn@latest add @uiarc/newsletter-signup
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/newsletter-signup.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/newsletter-signup/newsletter-signup.tsx`

   The source is in the registry item: https://uiarc.dev/r/newsletter-signup.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { NewsletterSignup } from "@/components/arc/blocks/newsletter-signup/newsletter-signup";

export function Newsletter() {
  return (
    <NewsletterSignup
      variant="card"
      onSubscribe={async email => {
        const response = await fetch("/api/subscribe", { method: "POST", body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error("Subscribe failed");
      }}
    />
  );
}
```

## API reference

### NewsletterSignup

A newsletter signup framed by the newsletter itself: a stack of recent issues. Subscribing drops the next issue, addressed to the new reader, onto the front of the stack. Inline section or card.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"inline" \| "card"` | `"inline"` | inline puts the copy and form beside the issue stack; card is a self-contained card with the stack in a tray on top. |
| `title` | `string` | – | Heading. Each variant has sample copy. |
| `description` | `string` | – | One sentence on what people get and how often. |
| `placeholder` | `string` | `"you@company.com"` | Email field placeholder. |
| `buttonLabel` | `string` | `"Subscribe"` | Submit button label. |
| `privacyNote` | `ReactNode` | `"No tracking pixels. Unsubscribe with one click."` | Line under the form about frequency and privacy. |
| `privacyLink` | `{ label: string; href: string } \| null` | – | Link after the note. Pass null to hide it. |
| `publication` | `NewsletterPublication \| null` | – | The issue stack: { name, upcoming, recent }. Each issue has a number, a date, a subject, and up to three stories with a thumbnail and read time. Pass null for the form alone. |
| `readers` | `{ count: number; faces: string[] } \| null` | – | Reader count and up to three faces, under the stack or at the foot of the card. The count ticks up by one on success. Pass null to hide. |
| `onSubscribe` | `(email: string) => void \| Promise<void>` | – | Called with a valid, trimmed email. Resolve to show success; reject to show an error and keep the email. |
| `className` | `string` | – | Extra class on the section. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Enter | In the email field, submits the form. The phone keyboard shows a send key. |
| Tab | Moves from the field to the button, the privacy link, and after success to "Use a different email". |

## Accessibility

- The email field has a visually hidden label, type email, inputmode email, autocomplete email, and aria-invalid when the address is wrong.
- The line under the field is its description: privacy note, error, or confirmation. Errors use role alert; the line is a polite live region and names the address the link went to.
- Validation starts when the field loses focus with text in it, then updates as you type. On an invalid submit, focus stays in the field.
- While sending, the button sets aria-busy and aria-disabled and ignores repeat submits. On success, focus moves to "Use a different email", which restores the form and refocuses the field.
- Only the front issue is exposed to assistive technology; the issues behind it and the thumbnails are hidden as decoration.

## Motion

- On success the next issue, addressed to you, rises onto the front of the stack while the others step back and the oldest drops away. It is one no-overshoot spring, and opacity resolves fast so two issues never read through each other.
- The reader count rolls up by one, and "including you" fades in after it.
- An invalid or failed submit shakes the field a few pixels and tints its border; the message swaps in place of the note.
- Every message, button label, and issue has its space reserved, so nothing below the form moves between states.
- Reduced motion places the issues at once with a short fade, removes the shake and the roll, and keeps the check and labels as quick fades.

## Responsive behavior

- Inline puts the stack under the copy and form below 860px container width.
- Below 400px read times hide and an addressed issue shows the recipient instead of the date.
- When the form is narrower than 300px the field and button separate and stack, both full width.
- The card is at most 460px wide; its tray crops the stack and fades it out at the edge.

## Performance

- Issue thumbnails and faces use next/image at their rendered size.
- Motion is transform and opacity only; no layout animation.
- No network code: bring your own onSubscribe.

## Notes for AI

- Pass onSubscribe and throw on failure; the component handles validation, busy, error, retry, and success states.
- Give it your own publication so the stack shows real past issues. Use short subjects and story titles; titles clamp at two lines.
- Keep the privacy note honest and specific.
- Use inline between page sections; use card in a sidebar, at the end of a post, or centered in a footer band.
- Edit newsletter-signup-data.ts for copy, issues, and reader faces.

## Related

- [CTA section](https://uiarc.dev/components/blocks/cta-section/markdown): A call to action as a centered closing section, a split beside a setup card that completes itself, or a dismissible banner.
- [Site footer](https://uiarc.dev/components/blocks/site-footer/markdown): A website footer with link columns and newsletter, a minimal layout, and a large fading Arc mark.
- [Contact section](https://uiarc.dev/components/blocks/contact-section/markdown): A validated contact form that morphs into a confirmation, support channels, and office cards with local times.
- [Login and sign up: Sign up](https://uiarc.dev/components/blocks/login/markdown): An account creation flow with field validation, password strength, and a clear completion state.
- [Hero signup](https://uiarc.dev/components/blocks/hero-signup/markdown): A full screen waitlist hero on a soft, drifting mesh gradient: the email field validates as you type and its button grows into the confirmation with your place in line.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
