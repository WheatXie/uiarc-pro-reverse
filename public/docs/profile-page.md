# Profile page

> A user profile with cover, bio, stats, activity and project tabs, and an edit sheet that writes back into the page.

- Type: Block
- Page: https://uiarc.dev/components/blocks/profile-page
- Markdown: https://uiarc.dev/components/blocks/profile-page/markdown

- Access: Arc Pro
- Registry id: `profile-page`
- Source file: `registry/blocks/profile-page/profile-page.tsx`
- Built from: Tabs, Avatar, Drawer, Input, Textarea, Button
- Keywords: profile, user profile, account page, edit profile, cover photo, avatar, bio, activity tab, projects

Use this for member or creator profiles. Load the profile, stats, activity, and projects from your API, save edits through onSave, and persist stars through onStarChange; saving in the preview is simulated.

## When to use

- A person's own profile with an edit flow
- Public creator or member pages inside an app
- Team member pages that show recent work

## When not to use

- Account security or billing settings, use settings-page
- A directory of many people, use team-directory
- A marketing team section, use team-showcase

## Installation

Profile page is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/profile-page
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { ProfilePage } from "@/components/arc/blocks/profile-page/profile-page";

export function Profile({ user, activity, projects }) {
  return (
    <ProfilePage
      profile={user}
      activity={activity}
      projects={projects}
      onSave={async next => {
        const res = await fetch("/api/me", { method: "PATCH", body: JSON.stringify(next) });
        if (!res.ok) throw new Error("Could not save your profile.");
      }}
    />
  );
}
```

## API reference

### ProfilePage

A full profile screen: cover photo, overlapping avatar, name and headline, an about column with bio, links, and stats, and Activity and Projects tabs. Edit profile slides a sheet in from the right edge; saving writes the changes back into the page and briefly highlights every field that changed.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `profile` | `ProfileDetails` | `sample profile` | Name, handle, headline, location, website, bio, avatar and cover image paths, and the joined label. |
| `stats` | `ProfileStat[]` | `sample stats` | Up to three counts shown under the bio, each with an id, label, and value. |
| `activity` | `ProfileActivity[]` | `sample activity` | Activity items with a kind (shipped, commented, created, reviewed, starred), action text, target, optional detail, time, and a group heading such as This week. |
| `projects` | `ProfileProject[]` | `sample projects` | Project cards with a cover image, description, visibility, collaborators, updated label, and star count. |
| `tab` | `"activity" \| "projects"` | – | Controlled tab. Pair with onTabChange. |
| `defaultTab` | `"activity" \| "projects"` | `"activity"` | Tab shown on mount when uncontrolled. |
| `onTabChange` | `(tab: ProfileTab) => void` | – | Called when the tab changes. |
| `onSave` | `(profile: ProfileDetails) => void \| Promise<void>` | – | Persists edited details. Throw an Error to keep the sheet open and show its message. Without it the preview simulates a save. |
| `onStarChange` | `(projectId: string, starred: boolean) => void` | – | Called when a project star is toggled. |
| `profileUrl` | `string` | `"https://northwind.app/@<handle>"` | Public link copied by Share. |
| `editable` | `boolean` | `true` | Shows Edit profile. Set false when someone views another person's profile. |
| `className` | `string` | – | Extra class on the root. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through Share, Edit profile, links, tabs, and project stars. |
| Arrow left / Arrow right | Switch between the Activity and Projects tabs. |
| Escape | Closes the edit sheet without saving and returns focus to Edit profile. |
| Enter | Saves the edit sheet from any single line field. |

## Accessibility

- Tabs use tablist, tab, and tabpanel roles with roving tab index and aria-controls.
- The edit sheet is a modal dialog with a labelled title; focus moves to the first field, stays inside while open, and returns to Edit profile on close.
- Validation errors are tied to their inputs with aria-describedby and aria-invalid; save errors use role alert.
- Star buttons expose aria-pressed and name the project and count. Share keeps its width while its label changes to Copied or Failed.

## Motion

- The tab underline travels between tabs on the morph spring; tab content fades up 6px.
- The edit sheet slides from the right edge on the smooth spring over a fading scrim, and leaves the same way faster.
- Saved fields glow once with the accent tint, and a new star pops with a small spring.
- Reduced motion swaps the slide for a fade, keeps the highlight, and removes travel.

## Responsive behavior

- Below 760px the about column stacks above the tabs; below 560px project cards go to one column.
- The cover shortens and the avatar shrinks on narrow screens; the edit sheet becomes full width.
- The screen height is min(760px, 100dvh) and the page scrolls inside it.

## Performance

- Only transform and opacity animate; images are lazy except the cover.
- The edit sheet mounts only while open.
- Activity and projects render as plain lists; paginate beyond a few hundred items.

## Notes for AI

- Choose this for a member, creator, or teammate profile inside a product. It is a full screen: the page scrolls inside the block so the sheet always covers the visible area.
- Load all data from your API and pass it in; the block owns only the edit draft and local star state.
- Set editable={false} for other people's profiles and replace the actions with Follow or Message in your own fork.
- Covers and avatars render with next/image; pass paths your image config allows.

## Related

- [Settings page](https://uiarc.dev/components/blocks/settings-page/markdown): Account settings with a gliding section nav and a save bar that morphs in as you edit.
- [Team directory](https://uiarc.dev/components/blocks/team-directory/markdown): Searchable people, team filters, and a focused profile panel.
- [Activity feed](https://uiarc.dev/components/blocks/activity-feed/markdown): A team activity feed grouped by day on a quiet avatar timeline, with a type filter, a live new updates button, expandable details, and a mark all read sweep.
- [Team members](https://uiarc.dev/components/blocks/team-members/markdown): A members list where typed emails turn into chips and fly into pending invites as seats roll.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
