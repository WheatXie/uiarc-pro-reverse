# Sidebar

> App and docs sidebars: a folding rail, a workspace switcher, a mail shell, and a docs tree.

- Type: Block with 4 variants
- Page: https://uiarc.dev/components/blocks/sidebar
- Markdown: https://uiarc.dev/components/blocks/sidebar/markdown

Open a specific variant with `?variant=<id>`: `sidebar-rail`, `workspace-sidebar`, `inbox-sidebar`, `docs-sidebar`

## Variant: App rail

An app shell whose sidebar folds into an icon rail and slides in as a sheet on phones.

- Access: Arc Pro
- Registry id: `sidebar-rail`
- Source file: `registry/blocks/sidebar-rail/sidebar-rail.tsx`
- Built from: Tooltip, Avatar, Avatar group, Badge, Animated counter
- Keywords: react app shell, sidebar layout, collapsible sidebar, icon rail navigation, mobile nav sheet, dashboard layout, nested sidebar

Use this as the frame of a product app. Map the sections to your routes, send selection to your router, and persist the collapsed state per person; press [ to fold the rail.

### When to use

- The frame of a product app with a sidebar, breadcrumbs, and content area.
- Apps with nested nav groups that should fold into an icon rail.
- Shells that need a navigation sheet on narrow widths.

### When not to use

- Use workspace-sidebar when workspace switching and favorites matter more than the shell.
- Use docs-sidebar for documentation.
- Use breadcrumb on its own when the page already has navigation.

### Installation

Variant: App rail is part of Arc Pro. The live preview is public; the source and install command need Pro.

#### CLI with a Pro token

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
npx shadcn@latest add @uiarc-pro/sidebar-rail
```

#### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

### Usage

```tsx
import { SidebarRail } from "@/components/arc/blocks/sidebar-rail/sidebar-rail";

export default function AppShell() {
  return (
    <main>
      <SidebarRail />
    </main>
  );
}
```

### API reference

#### SidebarRail

An app shell with a sidebar that folds into an icon rail, nested nav groups, breadcrumbs, and a sheet on narrow widths. Sections and page content are sample data.

No props.

### Keyboard interactions

| Keys | Action |
| --- | --- |
| [ | Folds or unfolds the rail when focus is not in a text field, menu, or dialog. |
| Escape | Closes the navigation sheet on narrow widths. |

### Accessibility

- Nav rows set aria-current="page" on the active item and aria-expanded on groups.
- The narrow layout uses a Radix dialog sheet that moves focus to the current item when it opens.
- Rail icons show Radix tooltips with their labels, and section changes are announced in a status region.

### Motion

- The sidebar folds to a rail on a spring and nested groups expand by height.
- The breadcrumb rises into the new section name.
- Reduced motion makes folding and group changes instant.

### Responsive behavior

- Below 640px container width the sidebar is replaced by a menu button that opens a Radix dialog sheet, up to 288px wide.
- The sheet drags closed to the left, and a ResizeObserver closes it when the shell widens past 640px.
- Content rows drop the timestamp below 420px of content width.

### Performance

- The shell has a fixed 640px height and scrolls its content inside, so it does not reflow the page.
- Rail tooltips mount only while shown through Radix.

### Notes for AI

- Use as the frame of a product app.
- Map the sections to your routes, send selection to your router, and persist the collapsed state per person.
- Composes Arc tooltip, avatar, avatar-group, badge, and animated-counter.

### Related

- [Sidebar: Workspace](https://uiarc.dev/components/blocks/sidebar/markdown): A product sidebar with a workspace switcher, live search, draggable favorites, and inline projects.
- [Sidebar: Docs](https://uiarc.dev/components/blocks/sidebar/markdown): A docs layout with a live filtering nav tree, version switcher, and a gliding on this page outline.
- [Sidebar: Inbox](https://uiarc.dev/components/blocks/sidebar/markdown): A mail sidebar whose Compose button grows into a composer and whose folders take dropped mail.
- [Breadcrumb](https://uiarc.dev/components/breadcrumb/markdown): Show where a page sits in a hierarchy.
- [Tooltip](https://uiarc.dev/components/tooltip/markdown): Short supporting text for unfamiliar controls.

## Variant: Workspace

A product sidebar with a workspace switcher, live search, draggable favorites, and inline projects.

- Access: Arc Pro
- Registry id: `workspace-sidebar`
- Source file: `registry/blocks/workspace-sidebar/workspace-sidebar.tsx`
- Built from: Search field, Avatar, Animated counter, Text morph, Button
- Keywords: react sidebar, workspace switcher, collapsible sidebar, app sidebar navigation, icon rail sidebar, linear style sidebar, draggable favorites

Use this as the main navigation of a multi-workspace app. Load workspaces, favorites, and projects from your API, route through onNavigate, and persist order and new projects; creation in the preview is simulated.

### When to use

- The main navigation of a multi-workspace app.
- Sidebars with draggable favorites and inline project creation.
- Navigation that should collapse to an icon rail with the [ shortcut.

### When not to use

- Use sidebar-rail when you need the whole app shell with a mobile sheet.
- Use docs-sidebar for documentation trees.
- Use inbox-sidebar for mail folders and labels.

### Installation

Variant: Workspace is part of Arc Pro. The live preview is public; the source and install command need Pro.

#### CLI with a Pro token

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
npx shadcn@latest add @uiarc-pro/workspace-sidebar
```

#### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

### Usage

```tsx
import { WorkspaceSidebar } from "@/components/arc/blocks/workspace-sidebar/workspace-sidebar";
import { useRouter } from "next/navigation";

export function AppNav() {
  const router = useRouter();

  return (
    <WorkspaceSidebar
      onNavigate={({ workspace, id }) => router.push(`/${workspace}/${id}`)}
      onCollapsedChange={(collapsed) => localStorage.setItem("rail", String(collapsed))}
    />
  );
}
```

### API reference

#### WorkspaceSidebar

A product sidebar with a workspace switcher, live search, draggable favorites, inline project creation, and a collapsible icon rail. Workspaces, favorites, and projects are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `className` | `string` | – | Extra class on the root element. |
| `onNavigate` | `(target: { workspace: string; id: string; name: string }) => void` | – | Called when a favorite or project is opened. Connect it to your router. |
| `defaultCollapsed` | `boolean` | `false` | Start as the narrow icon rail. |
| `onCollapsedChange` | `(collapsed: boolean) => void` | – | Called when the sidebar collapses or expands, from the toggle or the [ shortcut. |

### Keyboard interactions

| Keys | Action |
| --- | --- |
| [ | Toggles the icon rail when focus is not in a text field, menu, or dialog. |
| Alt+Arrow Up / Down | Moves the focused favorite up or down. |
| Escape | Clears the search, or cancels a new project name. |

### Accessibility

- The workspace switcher is a Radix dropdown menu with full menu keyboard support.
- Favorites can be reordered by keyboard as well as by drag.
- The rail shortcut ignores inputs, menus, and dialogs so typing is never hijacked.

### Motion

- The sidebar width springs between full and rail, and favorites reorder with layout animation.
- New projects slide in and counts roll with the animated counter.
- Reduced motion is applied after hydration and makes width and reorder changes instant.

### Responsive behavior

- The open width is the --full custom property, 272px by default, and the rail is 64px.
- It has no mobile sheet; below 380px it only shortens to 660px, so pair it with drawer on phones.
- Favorites drag on the y axis with Reorder, and Alt+Arrow keys reorder without a pointer.

### Performance

- Width springs through one motion value, so collapsing does not re-render the lists.
- Lists are not virtualized; keep favorites and projects to a sidebar's worth of rows.

### Notes for AI

- Use as the main navigation of a multi-workspace app.
- Load workspaces, favorites, and projects from your API, route through onNavigate, and persist favorite order and new projects yourself.
- Composes Arc search-field, avatar, animated-counter, text-morph, and button.

### Related

- [Sidebar: App rail](https://uiarc.dev/components/blocks/sidebar/markdown): An app shell whose sidebar folds into an icon rail and slides in as a sheet on phones.
- [Sidebar: Inbox](https://uiarc.dev/components/blocks/sidebar/markdown): A mail sidebar whose Compose button grows into a composer and whose folders take dropped mail.
- [Sidebar: Docs](https://uiarc.dev/components/blocks/sidebar/markdown): A docs layout with a live filtering nav tree, version switcher, and a gliding on this page outline.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Reorderable list](https://uiarc.dev/components/reorderable-list/markdown): Organize items with direct drag and drop.

## Variant: Inbox

A mail sidebar whose Compose button grows into a composer and whose folders take dropped mail.

- Access: Arc Pro
- Registry id: `inbox-sidebar`
- Source file: `registry/blocks/inbox-sidebar/inbox-sidebar.tsx`
- Built from: Avatar, Animated counter, Tooltip, Button
- Keywords: react email client, inbox ui, mail sidebar, gmail clone, drag to folder, compose window, mail app layout

Use this as the shell of a mail or messaging app. Load folders, labels, and messages from your mail API, persist moves and stars through it, and connect Send and drafts to your outbox; sending and saving in the preview are simulated.

### When to use

- The shell of a mail or messaging app.
- Inboxes where messages are dragged onto folders.
- Mail clients with row quick actions and a compose window.

### When not to use

- Use inbox-triage for a focused one-at-a-time triage flow.
- Use notification-center for app notifications.
- Use workspace-sidebar for general app navigation.

### Installation

Variant: Inbox is part of Arc Pro. The live preview is public; the source and install command need Pro.

#### CLI with a Pro token

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
npx shadcn@latest add @uiarc-pro/inbox-sidebar
```

#### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

### Usage

```tsx
import { InboxSidebar } from "@/components/arc/blocks/inbox-sidebar/inbox-sidebar";

export default function MailPage() {
  return (
    <InboxSidebar
      onCollapsedChange={(collapsed) => localStorage.setItem("mail-rail", String(collapsed))}
    />
  );
}
```

### API reference

#### InboxSidebar

A mail shell with folders, labels, a message list you can drag onto folders, row quick actions, and a Compose button that grows into a composer. Folders, messages, and sending are simulated.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultCollapsed` | `boolean` | `false` | Start with the sidebar collapsed to its icon rail. |
| `onCollapsedChange` | `(collapsed: boolean) => void` | – | Called when the sidebar collapses or expands, from the toggle or the [ shortcut. |

### Keyboard interactions

| Keys | Action |
| --- | --- |
| [ | Toggles the icon rail when focus is not in a text field, menu, or dialog. |
| E | On a message row, archives or moves it with its quick action. |
| S | On a message row, toggles the star. |
| Cmd/Ctrl+Enter | Sends from the composer. |
| Escape | Closes the composer and saves a draft, or cancels a drag in progress. |

### Accessibility

- The composer is a role="dialog" labelled by its title.
- Moves, stars, and sends are announced through a polite status region, and rail icons have tooltips.
- Every drag action has a keyboard or menu alternative.

### Motion

- Compose grows into the composer through a shared layoutId, and unread counts roll.
- Dropped messages leave the list with layout animation while the target folder pulses.
- Reduced motion makes the morph and list changes instant.

### Responsive behavior

- Below 720px container width the sidebar is locked to its 64px icon rail; below 420px row labels are hidden.
- Dragging to folders works with a mouse only; touch uses the row menu and quick actions.

### Performance

- The shell is a fixed 660px tall and the message list is not virtualized; page long mailboxes.
- Sidebar width springs through one motion value, and a ResizeObserver detects the narrow layout.

### Notes for AI

- Use as the shell of a mail or messaging app.
- Load folders, labels, and messages from your mail API, persist moves and stars through it, and connect Send and drafts to your outbox.
- Composes Arc avatar, animated-counter, tooltip, and button.

### Related

- [Inbox triage](https://uiarc.dev/components/blocks/inbox-triage/markdown): Process a focused inbox with archive, snooze, and restore actions.
- [Sidebar: Workspace](https://uiarc.dev/components/blocks/sidebar/markdown): A product sidebar with a workspace switcher, live search, draggable favorites, and inline projects.
- [Sidebar: App rail](https://uiarc.dev/components/blocks/sidebar/markdown): An app shell whose sidebar folds into an icon rail and slides in as a sheet on phones.
- [Notification center](https://uiarc.dev/components/blocks/notification-center/markdown): A home for updates with read state, grouped information, and animated disclosure.
- [Swipe actions](https://uiarc.dev/components/swipe-actions/markdown): Reveal row actions with a swipe, or from the same actions in a menu.

## Variant: Docs

A docs layout with a live filtering nav tree, version switcher, and a gliding on this page outline.

- Access: Arc Pro
- Registry id: `docs-sidebar`
- Source file: `registry/blocks/docs-sidebar/docs-sidebar.tsx`
- Built from: Search field, Dropdown menu, Code block, Copy button, Badge, Avatar, Button
- Keywords: react docs layout, documentation sidebar, docs navigation, table of contents scroll spy, on this page outline, api docs template

Use this for product or API documentation. Load the tree and pages from your content source, route page changes through your router, and point the version switcher at your versioned builds.

### When to use

- Product or API documentation with a nav tree and page outline.
- Docs that need a version switcher and a filterable tree.
- Pages where the on this page outline should follow scroll.

### When not to use

- Use tree-view for a plain hierarchy outside a docs layout.
- Use sidebar-rail for app navigation.
- Use command-palette for global search across docs.

### Installation

Variant: Docs is part of Arc Pro. The live preview is public; the source and install command need Pro.

#### CLI with a Pro token

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
npx shadcn@latest add @uiarc-pro/docs-sidebar
```

#### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

### Usage

```tsx
import { DocsSidebar } from "@/components/arc/blocks/docs-sidebar/docs-sidebar";

export default function DocsPage() {
  return (
    <DocsSidebar
      defaultCollapsed={false}
      onCollapsedChange={(collapsed) => localStorage.setItem("docs-rail", String(collapsed))}
    />
  );
}
```

### API reference

#### DocsSidebar

A docs layout with a filterable nav tree, version switcher, page content with code blocks, and an on this page outline that tracks scroll. The tree, pages, and versions are sample content.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultCollapsed` | `boolean` | `false` | Start with the navigation collapsed to its icon rail. |
| `onCollapsedChange` | `(collapsed: boolean) => void` | – | Called when the navigation collapses or expands, from the toggle or the [ shortcut. |

### Keyboard interactions

| Keys | Action |
| --- | --- |
| [ | Toggles the icon rail when focus is not in a text field, menu, or dialog. |
| Arrow Up / Down, Home / End | Move through the nav tree. |
| Arrow Left / Right | Collapse or expand a nav group. |
| Enter | In the filter field, opens the first matching page. |
| Escape | Clears the filter. |

### Accessibility

- The rail toggle exposes aria-expanded and aria-keyshortcuts="[".
- Filter results are announced as a count in a polite status region.
- The nav tree supports arrow key movement from the search field into the list.

### Motion

- The outline indicator glides to the heading in view, and the sidebar folds to a rail on a spring.
- Nav groups expand by height as the filter opens matching branches.
- Reduced motion makes the glide and folds instant.

### Responsive behavior

- At 1000px container width and above the outline gets its own 200px column; below 740px it becomes a collapsible bar above the article.
- Below 620px the rail is dropped and the nav tree folds behind a menu button above the content.

### Performance

- Scroll spy is batched to one requestAnimationFrame per scroll, and ResizeObservers remeasure on width changes.
- The nav tree is not virtualized; very large trees rely on the filter.

### Notes for AI

- Use for product or API documentation.
- Load the tree and pages from your content source, route page changes through your router, and point the version switcher at your versioned builds.
- Composes Arc search-field, dropdown-menu, code-block, copy-button, badge, avatar, and button.

### Related

- [Tree view](https://uiarc.dev/components/tree-view/markdown): Navigate nested folders and structured content.
- [Sidebar: App rail](https://uiarc.dev/components/blocks/sidebar/markdown): An app shell whose sidebar folds into an icon rail and slides in as a sheet on phones.
- [Code block](https://uiarc.dev/components/code-block/markdown): Present code with legible hierarchy and copy access.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Command palette](https://uiarc.dev/components/blocks/command-palette/markdown): A complete keyboard driven action surface with search, grouped results, and shortcuts.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
