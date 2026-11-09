# Team showcase

> An image led team introduction with profiles that open in place.

- Type: Block
- Page: https://uiarc.dev/components/blocks/team-showcase
- Markdown: https://uiarc.dev/components/blocks/team-showcase/markdown

- Access: Arc Pro
- Registry id: `team-showcase`
- Source file: `registry/blocks/team-showcase/team-showcase.tsx`
- Built from: Avatar, Button, Motion
- Keywords: react team section, meet the team, team page, about us team grid, team profiles, staff showcase

Use this when people behind a product deserve a clear introduction. Supply accurate profiles, portraits, and destinations.

## When to use

- About or company pages that introduce the team with portraits.
- Sections that need one of four layouts: gallery, filmstrip, directory, or spotlight.

## When not to use

- Use team-directory for an internal, searchable people list.
- Use team-members for managing members and roles.
- Use testimonial-stage for quotes from customers.

## Installation

Team showcase is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/team-showcase
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TeamShowcase } from "@/components/arc/blocks/team-showcase/team-showcase";

export function About() {
  return (
    <TeamShowcase
      variant="spotlight"
      onPersonSelect={(person) => router.push("/team/" + person.id)}
    />
  );
}
```

## Examples

### Directory layout

```tsx
<TeamShowcase
  variant="directory"
  onPersonSelect={(person) => track("team_profile_open", { id: person.id })}
/>
```

## API reference

### TeamShowcase

An image-led team section in four layouts, with profiles that open in place and copyable sample contact details. People and portraits are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"gallery" \| "filmstrip" \| "directory" \| "spotlight"` | `"gallery"` | Layout of the section. |
| `onPersonSelect` | `(person: { id: string; name: string; role: string }) => void` | – | Called when a person is chosen. Receives the full sample person object. |

### TeamShowcaseReview

Demo wrapper with a SegmentedControl to switch variants. Use it for previews only.

No props.

## Accessibility

- Selection buttons use aria-pressed; the directory rows use aria-expanded with aria-controls.
- Profile changes are announced in aria-live regions.
- Copy buttons are labeled per person, such as "Copy Maya's email".

## Motion

- Profiles crossfade and expand in place when selection changes.
- Reduced motion removes offsets and height animation.

## Responsive behavior

- It is a container query root, so layouts adapt to the section width, not the viewport.
- At 760px container width the header stacks and details move under the photos.
- At 440px the gallery and filmstrip become horizontal snap scrollers and spotlight stacks the photo under the copy.

## Performance

- Portraits load through next/image with fill and per-layout sizes.
- The selected person is scrolled into view with a smooth scroll that becomes instant under reduced motion.

## Notes for AI

- Use on an about or company page to introduce the team.
- Replace the people array and portraits; remove the demo contact details if they should not be public.
- Render TeamShowcase with a fixed variant; TeamShowcaseReview exists for the docs preview.
- Composes Arc CopyButton and SegmentedControl.

## Related

- [Team directory](https://uiarc.dev/components/blocks/team-directory/markdown): Searchable people, team filters, and a focused profile panel.
- [Studio perspectives](https://uiarc.dev/components/blocks/testimonial-stage/markdown): Portrait led editorial stories with a focused reading state.
- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
