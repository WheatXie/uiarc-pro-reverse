# Menus

## `context-menu` · Context menu (Free, component)

Secondary actions kept close to the selected object.

When to use:
- Secondary actions on a file, card, or row where a visible menu button would add clutter.
- Desktop-style right-click menus that also open from the keyboard with Shift+F10 or the ContextMenu key.

When not to use:
- Use dropdown-menu when the actions deserve a visible trigger.
- Use swipe-actions for touch-first lists like an inbox.

Keywords: menu, action, react context menu, right click menu, custom context menu, file actions menu, shift f10 menu, animated context menu

Files: registry/components/context-menu/context-menu.tsx, registry/components/context-menu/context-menu.module.css

## `dropdown-menu` · Dropdown menu (Free, component)

A focused list of actions anchored to a trigger.

When to use:
- A list of commands behind a labelled button, such as Rename, Duplicate, and Delete.
- Row or card actions where a visible trigger is clearer than right-click.

When not to use:
- Use split-button when one command is the default.
- Use context-menu for right-click actions on content.

Keywords: menu, action, react dropdown menu, actions menu, menu button, radix dropdown menu, animated dropdown, more actions menu, kebab menu

Files: registry/components/dropdown-menu/dropdown-menu.tsx, registry/components/dropdown-menu/dropdown-menu.module.css

## `user-menu` · User menu (Free, component)

Your account, settings, theme, and sign out behind the avatar. Opens as a bottom sheet on phones.

When to use:
- The single account entry point in an app top bar.
- Menus that combine presence status, theme preference, account links, and sign out.

When not to use:
- Use dropdown-menu for generic command lists.
- Use theme-switch for a standalone light and dark toggle.

Keywords: motion, product, react user menu, account menu, avatar dropdown, profile menu, user menu with status, sign out menu, presence indicator

Files: registry/components/user-menu/user-menu.tsx, registry/components/user-menu/user-menu.module.css
