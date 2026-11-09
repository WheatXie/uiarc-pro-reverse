# Team directory

> Searchable people, team filters, and a focused profile panel.

- Type: Block
- Page: https://uiarc.dev/components/blocks/team-directory
- Markdown: https://uiarc.dev/components/blocks/team-directory/markdown

- Access: Arc Pro
- Registry id: `team-directory`
- Source file: `registry/blocks/team-directory/team-directory.tsx`
- Built from: Input, Avatar, Button, Motion
- Keywords: react team directory, employee directory, people search, staff directory ui, company directory, team list with profile

Use this when people need to browse a team and find contact details. Replace the sample people and portraits with your own directory data.

## When to use

- An internal directory where people search colleagues and copy contact details.
- Team pages with department filters and a profile pane.

## When not to use

- Use team-members to manage roles and invitations.
- Use team-showcase for a public, image-led team section.
- Use customers-table for large tabular people data.

## Installation

Team directory is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/team-directory
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { TeamDirectory } from "@/components/arc/blocks/team-directory/team-directory";

export function PeoplePage() {
  const router = useRouter();
  return <TeamDirectory onPersonSelect={(person) => router.push("/people/" + person.id)} />;
}
```

## API reference

### TeamDirectory

A searchable people list with Design, Engineering, and Operations filters (each with a count), availability, and a profile pane with focus, location, time zone, and a copyable email. People and portraits are sample data in the file.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onPersonSelect` | `(person: { id: string; name: string; team: "Design" \| "Engineering" \| "Operations" }) => void` | – | Called when a person is chosen from the list. |

## Accessibility

- Filter buttons are a labelled group with aria-pressed; person rows are buttons with aria-pressed.
- Escape in the search field clears the query.
- The profile pane is polite live content, so selection changes are announced.
- Copy success and failure are announced through role="status".

## Motion

- The filter highlight and the row selection highlight glide with shared layoutIds on the morph spring.
- Filtered rows close their gaps with position layout animation and fade in or out.
- The profile pane fades up 4px when the person changes.
- Reduced motion removes layout animation and offsets and turns off CSS transitions.

## Responsive behavior

- Container queries on the block: below 640px the copy button becomes icon-only; below 500px the profile pane moves under the list; below 400px the header stacks, search fills the width, and filter counts hide.

## Performance

- Search and filters run in memory on every keystroke, and rows are not virtualized.
- For hundreds of people, filter on the server and paginate before passing data in.

## Notes for AI

- Use for an internal directory or team page where people need contact details.
- Replace the people array, the Team union, and portrait paths with your directory data.
- Composes Arc Avatar.

## Related

- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.
- [Team showcase](https://uiarc.dev/components/blocks/team-showcase/markdown): An image led team introduction with profiles that open in place.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Avatar](https://uiarc.dev/components/avatar/markdown): A compact identity marker for people and accounts.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
