# Special inputs

## `mention-input` · Mention input (Free, component)

A textarea with @people and #channel mentions that act as single tokens, with suggestions at the caret.

When to use:
- Comment and reply boxes where people are tagged with @ and should be notified by id.
- Chat or task composers that link #channels or projects inline.

When not to use:
- Use textarea for plain notes with no references.
- Use tag-input when the tokens are a separate list rather than part of a sentence.

Keywords: inputs, new, react mention input, at mention textarea, mentions autocomplete, tag people in comment, channel mention, slack style mentions, mention suggestions, textarea with mentions

Files: src/components/arc/mention-input/mention-input.module.css, src/components/arc/mention-input/mention-input.tsx

## `money-input` · Money input (Free, component)

A currency field with live grouping, stable width, rolling digits, and minor-unit output.

When to use:
- Payment, tip, transfer, or budget amounts entered by hand.
- Invoice and expense forms where the currency may change.

When not to use:
- Use number-field for quantities and non currency numbers.
- Use slider or price-ladder when people pick from a range rather than type.

Keywords: inputs, new, react money input, currency input, amount field, price input, cents input, currency selector, formatted number input, payment amount

Files: src/components/arc/money-input/money-input.module.css, src/components/arc/money-input/money-input.tsx

## `number-field` · Number field (Free, component)

Enter a bounded number with clear increment controls.

When to use:
- Bounded quantities like seats, items, or prices where the exact number matters.
- Values people nudge with steppers, arrow keys, or by dragging the label with scrub.

When not to use:
- Use slider when the approximate position matters more than the exact number.
- Use input for numeric strings like phone numbers or codes.

Keywords: field, numeric, react number input, number field, stepper input, quantity selector, numeric input with buttons, scrub input, odometer number input

Files: src/components/arc/number-field/number-field.module.css, src/components/arc/number-field/number-field.tsx

## `phone-input` · Phone input (Free, component)

A phone field with a country picker, formatting as you type, and E.164 output.

When to use:
- Sign up, checkout, and contact forms that need a phone number in E.164.
- International audiences where the country and calling code must be clear.

When not to use:
- Use input with type="tel" when you only store free text and never dial or text the number.
- Use otp-input for the verification code itself.

Keywords: inputs, new, react phone input, phone number field, country code picker, international phone input, e164 phone, phone number formatting, tel input with flag

Files: src/components/arc/phone-input/phone-input.module.css, src/components/arc/phone-input/phone-input.tsx

## `scrub-input` · Scrub input (Free, component)

A Figma-style number field: drag the label to scrub, or type values, units, and arithmetic.

When to use:
- Position, size, rotation, and opacity fields in an inspector panel.
- Dense settings where typing exact values and dragging both matter.

When not to use:
- Use number-field for a normal form with stepper buttons and a visible label.
- Use slider when the range and position matter more than the exact number.

Keywords: inputs, new, react scrub input, drag to change number, scrubbable number field, inspector input, figma number input, math expression input, unit input

Files: src/components/arc/scrub-input/scrub-input.module.css, src/components/arc/scrub-input/scrub-input.tsx

## `shortcut-recorder` · Shortcut recorder (Free, component)

Record key combinations into key caps, with conflict warnings, Kbd, and a searchable cheatsheet.

When to use:
- Settings pages where people remap keyboard shortcuts.
- A keyboard shortcut cheatsheet or help dialog, with ShortcutList.

When not to use:
- Use ShortcutKbd alone when shortcuts are fixed and only need to be shown.
- Use command-palette to let people run actions by name rather than bind keys.

Keywords: inputs, new, react shortcut recorder, keyboard shortcut input, hotkey recorder, keybinding editor, kbd component, keyboard shortcuts cheatsheet, record hotkey

Files: src/components/arc/shortcut-recorder/shortcut-recorder.module.css, src/components/arc/shortcut-recorder/shortcut-recorder.tsx

## `tag-input` · Tag input (Free, component)

Turn short text values into removable tags.

When to use:
- Free-form lists of short values like tags, keywords, or emails.
- Fields where people add values by pressing Enter or comma.

When not to use:
- Use multi-select or chip-group when values come from a fixed list.
- Use input for a single value.

Keywords: field, tags, react tag input, tags input, chip input, multi value input, email chips input, keyword input

Files: src/components/arc/tag-input/tag-input.module.css, src/components/arc/tag-input/tag-input.tsx
