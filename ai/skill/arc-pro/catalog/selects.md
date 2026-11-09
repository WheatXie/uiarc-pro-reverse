# Selects

## `chip-group` · Chip group (Free, component)

Filter by a few facets with chips that morph as you pick them.

When to use:
- Facet filters people toggle often, like topics or categories.
- Single clearable choices shown as chips, via multiple={false}.

When not to use:
- Use multi-select when space is tight.
- Use checkbox in forms.

Keywords: chips, filter, toggle, react chip group, filter chips, toggle chips, tag filter, selectable chips, chip select

Files: src/components/arc/chip-group/chip-group.module.css, src/components/arc/chip-group/chip-group.tsx

## `combobox` · Combobox (Free, component)

Search and select from a list without leaving the field.

When to use:
- Single-choice fields with long lists, such as time zones or countries.
- Lists where people know the name and want to type, including aliases via keywords.

When not to use:
- Use select for a short list where typing adds nothing.
- Use multi-select when several values can be chosen.

Keywords: field, search, react combobox, autocomplete, searchable select, typeahead dropdown, filterable select, autocomplete input

Files: src/components/arc/combobox/combobox.module.css, src/components/arc/combobox/combobox.tsx

## `morph-select` · Morph select (Free, component)

A select whose trigger grows into the list, with a gliding highlight and type-ahead.

When to use:
- Form fields and property panels where one value is picked from a known list.
- Grouped lists like time zones, assignees, or projects, with optional icons and meta.

When not to use:
- Use combobox when users type free text or the list is very long and remote.
- Use multi-select when more than one value can be chosen.

Keywords: inputs, new, react select, animated select, morphing dropdown, listbox, select with search, grouped select, custom select component, type-ahead select

Files: src/components/arc/morph-select/morph-select.module.css, src/components/arc/morph-select/morph-select.tsx

## `multi-select` · Multi-select (Free, component)

Select several values while keeping the field readable.

When to use:
- Picking several values from a fixed list in a compact field, such as labels or assignees.
- Filters where the chosen values should show in the field with a +N overflow.

When not to use:
- Use chip-group when every option should stay visible.
- Use tag-input for free-form values.

Keywords: field, choice, react multi select, multiselect dropdown, select multiple options, multi select chips, tag select, checkbox dropdown

Files: src/components/arc/multi-select/multi-select.module.css, src/components/arc/multi-select/multi-select.tsx

## `select` · Select (Free, component)

A compact choice field with a keyboard friendly menu.

When to use:
- A short fixed list where typing is not needed, such as region or sort order.
- Form fields that should submit natively through Radix's hidden select via name.

When not to use:
- Use combobox for long or searchable lists.
- Use multi-select when several values can be chosen.

Keywords: field, form, react select, dropdown select, radix select, animated select, select menu, form select field

Files: src/components/arc/select/select.module.css, src/components/arc/select/select.tsx
