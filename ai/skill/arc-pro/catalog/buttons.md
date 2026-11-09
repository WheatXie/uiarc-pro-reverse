# Buttons

## `action-button` · Action button (Free, component)

A compact button for frequent toolbar actions.

When to use:
- A single async commit such as Save, Publish, or Submit where the result should appear on the button.
- Call-to-action buttons where a trailing arrow invites the next step.

When not to use:
- Use button with loading for plain form submits that do not need a success state.
- Use action-swap when the control toggles between lasting states.

Keywords: action, toolbar, react action button, async button, submit button with success state, save button animation, loading to success button, cta button with arrow, publish button

Files: registry/components/action-button/action-button.tsx, registry/components/action-button/action-button.module.css

## `action-swap` · Action swap (Free, component)

Swap an action label while preserving its place and intent.

When to use:
- One control that cycles through related states, like Follow and Following or Send and Sent.
- Toggles that run async work on press and should show a working phase and a failure message in place.

When not to use:
- Use action-button for a single save or publish that ends in a success tick.
- Use button when the label never changes state.

Keywords: action, motion, react toggle button, follow button, state cycling button, action swap, morphing button, send button animation, async toggle button

Files: registry/components/action-swap/action-swap.tsx, registry/components/action-swap/action-swap.module.css

## `button` · Button (Free, component)

A clear, responsive action with quiet secondary states.

When to use:
- Any single action on a page, form, or dialog, such as Save, Continue, or Cancel.
- Actions whose label changes in place, like Save to Saved, where the width should spring instead of jump.

When not to use:
- Use action-button when the button itself should show pending and success states after an async commit.
- Use split-button when one default action has two to five close variants.

Keywords: action, control, react button, animated button, loading button, button with spinner, button press animation, morphing button label, primary button

Files: registry/components/button/button.tsx, registry/components/button/button.module.css

## `button-group` · Button group (Free, component)

Related actions joined into one surface with hairline dividers: a hover highlight glides between segments, the pressed one answers in place, and an attached menu can close the row.

When to use:
- A small set of related actions on the same object, shown together in a header, toolbar or card footer.
- Compact tool clusters such as zoom out, the current level and zoom in, or stacked map controls.

When not to use:
- Use toggle-group or segmented-control when the segments are options that stay selected.
- Use split-button when there is one main action and a few variants of it.

Keywords: action, group, toolbar, new, button group, joined buttons, action group, segmented buttons, button bar, attached buttons, zoom controls, more actions, dropdown, split, actions

Files: registry/components/button-group/button-group.tsx, registry/components/button-group/button-group.module.css

## `confirm-morph` · Confirm morph (Free, component)

A destructive button that morphs into an inline confirmation, a spinner, and a result with undo.

When to use:
- Deleting a selection in a table or file list, right where the button sits.
- Revoking access, removing a member, or discarding a draft.

When not to use:
- Use dialog when the consequence needs more than one line, or when typing a name to confirm is required.
- Use action-button for safe async actions that need no question.

Keywords: actions, new, react confirm button, inline confirmation, delete confirmation button, confirm delete without modal, undo button, two step button, destructive action button

Files: registry/components/confirm-morph/confirm-morph.tsx, registry/components/confirm-morph/confirm-morph.module.css

## `copy-button` · Copy button (Free, component)

Copy a value with immediate confirmation.

When to use:
- Next to API keys, install commands, links, or code snippets.
- Icon-only copy controls in dense rows, with an accessible label.

When not to use:
- Use split-button when copying has alternatives, such as Copy link and Copy as Markdown.
- Use code-block for full code samples, which include their own copy control.

Keywords: action, utility, react copy button, copy to clipboard, copy button animation, clipboard button, copy code button, copied feedback

Files: registry/components/copy-button/copy-button.tsx, registry/components/copy-button/copy-button.module.css, lib/use-copy-feedback.ts

## `expanding-button-group` · Expanding button group (Free, component)

Icon buttons in a compact group: the one you point at or focus grows to reveal its label while its neighbours slide aside, and an action confirms in place.

When to use:
- A compact action bar on a message, file, or card where space is tight but labels should be one glance away.
- Toolbars where actions finish in place and deserve a confirmation without a toast, such as Archive or Copy link.

When not to use:
- Use toggle-group or segmented-control when the buttons select a value instead of running an action.
- Use plain labelled buttons when there are only one or two actions and space allows; hiding labels then costs clarity.

Keywords: action, group, toolbar, new, button group, icon buttons, expanding, reveal label, hover label, action bar, message actions, file actions, confirm in place, morph, pill

Files: registry/components/expanding-button-group/expanding-button-group.tsx, registry/components/expanding-button-group/expanding-button-group.module.css

## `floating-button-group` · Floating button group (Free, component)

Separate soft buttons in a quiet tray, with one shared highlight that morphs from button to button as you move, and a pressed state that settles in place.

When to use:
- A floating editor or canvas toolbar with undo, redo, share and present.
- A selection toolbar that appears over text or objects.

When not to use:
- Use toggle-group for formatting toggles or alignment where the choice stays pressed.
- Use segmented-control to switch between views.

Keywords: action, group, toolbar, new, button group, floating toolbar, action bar, editor toolbar, selection toolbar, tools rail, hover highlight, shared highlight, icon buttons

Files: registry/components/floating-button-group/floating-button-group.tsx, registry/components/floating-button-group/floating-button-group.module.css

## `icon-morph` · Icon morph (Free, component)

Icons that morph between states: menu to close, play to pause, copy to check, and more.

When to use:
- Icon buttons that toggle between two states, such as a hamburger menu or a play control.
- Copy and add actions that should confirm with a check in place.

When not to use:
- Use copy-button for a complete copy-to-clipboard control with its own feedback.
- Use theme-switch for a labelled light and dark toggle wired to the page theme.

Keywords: actions, new, react icon morph, animated icon, hamburger to close, play pause morph, copy check icon, sun moon toggle icon, like heart animation, morphing svg icon

Files: registry/components/icon-morph/icon-morph.tsx, registry/components/icon-morph/icon-morph.module.css

## `split-button` · Split button (Free, component)

A primary action with a menu of nearby alternatives.

When to use:
- One default action with a few close variants, like Merge with Squash and Rebase.
- Export or share actions where one format is the usual pick and others sit behind the chevron.

When not to use:
- Use dropdown-menu when there is no default action and every option is equal.
- Use button when there are no alternatives.

Keywords: action, menu, react split button, button with dropdown, split button menu, merge button, dropdown button, primary action with options

Files: registry/components/split-button/split-button.tsx, registry/components/split-button/split-button.module.css

## `theme-switch` · Theme switcher (Free, component)

Four smooth ways to move between light and dark appearance.

When to use:
- A single light and dark toggle in an app or marketing top bar.
- Pages that want to run their own view transition from the button's position.

When not to use:
- Use user-menu when theme choice, including system, belongs inside an account menu.
- Use theme-switch-rise for quiet product chrome, or theme-switch-eclipse for a dramatic showcase change.

Keywords: theme, appearance, motion, react theme switch, dark mode toggle, light dark switch, theme toggle button, view transition theme, sun moon toggle

Files: registry/components/theme-switch/theme-switch.tsx, registry/components/theme-switch/theme-switch.module.css
