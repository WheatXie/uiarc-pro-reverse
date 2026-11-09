# Toggles

## `billing-toggle` · Billing toggle (Free, component)

A monthly and yearly switch with a savings badge and prices that roll to the new amount.

When to use:
- The billing period switch at the top of a pricing page.
- Any price display that should roll to a new amount when a period or plan changes, using BillingPrice.

When not to use:
- Use segmented-control for switching views or filters with no pricing meaning.
- Use radio-group when options need descriptions or a vertical layout.

Keywords: inputs, new, react billing toggle, monthly yearly switch, pricing period toggle, annual billing discount, save 20 percent badge, animated price, pricing toggle

Files: src/components/arc/billing-toggle/billing-toggle.module.css, src/components/arc/billing-toggle/billing-toggle.tsx

## `checkbox` · Checkbox (Free, component)

A binary choice with a precise, legible state.

When to use:
- Independent on and off choices confirmed by a submit, such as accepting terms.
- Parent rows that show a partial selection through the indeterminate state.

When not to use:
- Use switch for settings that apply immediately.
- Use radio-group when only one option can be chosen.

Keywords: field, form, react checkbox, animated checkbox, indeterminate checkbox, radix checkbox, checkbox with description, terms checkbox

Files: src/components/arc/checkbox/checkbox.module.css, src/components/arc/checkbox/checkbox.tsx

## `radio-cards` · Radio cards (Free, component)

Selectable option cards with a sliding selection ring, price and description slots, and radio keyboard behavior.

When to use:
- Choices where each option needs a description, price, or estimate to decide.
- Plan, shipping, region, or size pickers inside checkout and setup flows.

When not to use:
- Use radio-group for short text-only options.
- Use segmented-control for two to four view modes that switch content instantly.

Keywords: inputs, new, react radio cards, selectable cards, radio card group, plan selector, shipping options, option cards, card radio buttons

Files: src/components/arc/radio-cards/radio-cards.module.css, src/components/arc/radio-cards/radio-cards.tsx

## `radio-group` · Radio group (Free, component)

Choose one option from a visible set.

When to use:
- Two to six mutually exclusive options that need descriptions, such as plans.
- Form choices that should submit natively through name.

When not to use:
- Use segmented-control for short inline view options.
- Use select for longer lists.

Keywords: field, choice, react radio group, radio buttons, radio cards, plan picker, animated radio, radio with description

Files: src/components/arc/radio-group/radio-group.module.css, src/components/arc/radio-group/radio-group.tsx

## `rating` · Rating (Free, component)

A simple, accessible way to capture a numeric opinion.

When to use:
- Collecting a 1 to N score in reviews or feedback forms.
- Displaying average scores, with readOnly and allowHalf.

When not to use:
- Use slider for continuous values.
- Use reactions for emoji feedback on content.

Keywords: input, feedback, react star rating, rating component, half star rating, review stars, accessible rating, 5 star rating

Files: src/components/arc/rating/rating.module.css, src/components/arc/rating/rating.tsx

## `segmented-control` · Segmented control (Free, component)

Switch between a small set of related views.

When to use:
- Two to five short view options like Day, Week, and Month.
- Toolbar toggles between layouts or modes that apply immediately.

When not to use:
- Use tabs when each option swaps a panel of content.
- Use radio-group in forms or when options need descriptions.

Keywords: control, choice, react segmented control, segmented button, toggle group, ios segmented control, view switcher, sliding pill toggle

Files: src/components/arc/segmented-control/segmented-control.module.css, src/components/arc/segmented-control/segmented-control.tsx

## `switch` · Switch (Free, component)

A tactile toggle for settings that take effect immediately.

When to use:
- Settings that take effect as soon as they are flipped, like notifications.
- Settings lists where each row is one on and off preference.

When not to use:
- Use checkbox when the choice waits for a submit button.
- Use segmented-control for a choice between named options.

Keywords: toggle, settings, react switch, toggle switch, ios toggle, radix switch, settings toggle, animated switch

Files: src/components/arc/switch/switch.module.css, src/components/arc/switch/switch.tsx

## `toggle-group` · Toggle group (Free, component)

A row of icon or text toggles, single or multiple: one pressed fill glides between options, or each fades in on its own and neighbours join, as in a formatting toolbar.

When to use:
- Formatting toolbars: bold, italic and underline as multiple, alignment as single.
- Compact view options on a canvas, map or editor, such as grid or list, or which layers to show.

When not to use:
- Use segmented-control for switching between views, ranges or tabs of content.
- Use checkbox or switch for settings in a form that are saved together.

Keywords: input, toggle, toolbar, new, toggle group, toggle buttons, formatting, bold italic underline, text alignment, icon buttons, pressed, multi select, button group

Files: src/components/arc/toggle-group/toggle-group.module.css, src/components/arc/toggle-group/toggle-group.tsx
