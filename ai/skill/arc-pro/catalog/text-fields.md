# Text fields

## `expanding-search` · Expanding search (Free, component)

An icon that morphs into a search field with results beneath it.

When to use:
- Header or toolbar search where a full field would crowd the layout.
- Quick navigation across local items with grouped results and recent suggestions.

When not to use:
- Use search-field to filter a visible list in place.
- Use combobox to set a form value.

Keywords: search, field, motion, react expanding search, search icon expand, animated search bar, header search, search with results dropdown, collapsible search

Files: registry/components/expanding-search/expanding-search.tsx, registry/components/expanding-search/expanding-search.module.css

## `inline-edit` · Inline edit (Free, component)

Rename in place: the text becomes a field without moving.

When to use:
- Titles and descriptions read far more often than edited, like a project name.
- Single fields that save on their own with optimistic updates and rollback.

When not to use:
- Use input or textarea in a form when several fields save together.
- Use input when the field should always look editable.

Keywords: inline edit, rename, click to edit, react inline edit, editable text, inline editing, rename in place, optimistic save field

Files: registry/components/inline-edit/inline-edit.tsx, registry/components/inline-edit/inline-edit.module.css

## `input` · Input (Free, component)

A single line field with clear labels and useful states.

When to use:
- Any single-line text value in a form, such as name, email, or URL.
- Fields whose helper or error copy changes as the person types, where the message should reword in place.

When not to use:
- Use textarea for multi-line text.
- Use password-field, search-field, or number-field when the value has that shape.

Keywords: field, form, react input, text field, animated form input, input with error message, form field validation, labelled input, input helper text

Files: registry/components/input/input.tsx, registry/components/input/input.module.css

## `password-field` · Password field (Free, component)

Capture sensitive text with a visible reveal control.

When to use:
- Sign in forms and password confirmation fields.
- Any secret the person may want to check by revealing it.

When not to use:
- Use password-strength when creating or changing a password.
- Use input for non-secret values.

Keywords: field, security, react password input, show hide password, password toggle, password field with eye icon, login password field

Files: registry/components/password-field/password-field.tsx, registry/components/password-field/password-field.module.css

## `password-strength` · Password strength (Free, component)

Show how strong a new password is while it is typed.

When to use:
- Sign up and change password forms.
- Password rules that should check off live as the person types.

When not to use:
- Use password-field for sign in.
- Use progress for measurable progress unrelated to passwords.

Keywords: password, strength meter, validation, react password strength, password strength meter, password requirements checklist, new password field, password validation, signup password

Files: registry/components/password-strength/password-strength.tsx, registry/components/password-strength/password-strength.module.css

## `search-field` · Search field (Free, component)

A recognizable search entry point with clear affordances.

When to use:
- Filtering a visible list or table in place.
- Toolbar search where the query should be clearable with one click.

When not to use:
- Use expanding-search for compact header search with results.
- Use combobox when the search sets a form value.

Keywords: field, search, react search input, search field, search bar with clear button, filter input, list filter search

Files: registry/components/search-field/search-field.tsx, registry/components/search-field/search-field.module.css

## `textarea` · Textarea (Free, component)

A multiline field for notes, descriptions, and longer text.

When to use:
- Free-form multi-line text like bios, comments, or feedback.
- Fields with a live character count, which rolls its digits in the helper row.

When not to use:
- Use input for single-line values.
- Use inline-edit with multiline for a description edited in place on a page.

Keywords: field, form, react textarea, multi-line input, textarea with character count, animated textarea, comment field, form textarea

Files: registry/components/textarea/textarea.tsx, registry/components/textarea/textarea.module.css
