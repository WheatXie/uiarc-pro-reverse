# Pickers

## `calendar` · Calendar (Free, component)

Browse dates in a clear, compact month view.

When to use:
- Inline date picking where the month should stay visible, such as booking pages.
- Picking one date with blocked days via minDate, maxDate, and disabledDates.

When not to use:
- Use date-picker for a form field that opens a calendar popover.
- Use time-picker for times of day.

Keywords: date, field, react calendar, date calendar, month calendar, inline date picker, booking calendar, animated calendar

Files: src/components/arc/calendar/calendar.module.css, src/components/arc/calendar/calendar.tsx

## `color-picker` · Color picker (Free, component)

A swatch that grows into a picker with format morphing, eyedropper, saved swatches, and contrast readout.

When to use:
- Theme editors and brand settings where users choose an exact color.
- Design tools that need hex, RGB, HSL, and OKLCH input plus opacity.

When not to use:
- Use segmented-control or radio-group when the choice is between a few fixed colors.
- Use input for a plain hex field with no visual picking.

Keywords: inputs, new, react color picker, hex color input, oklch color picker, hsl picker, eyedropper, color contrast checker, color swatches, alpha color picker

Files: src/components/arc/color-picker/color-picker.module.css, src/components/arc/color-picker/color-picker.tsx

## `date-picker` · Date picker (Free, component)

Choose a date without losing context.

When to use:
- A date field in a form, such as a start or due date.
- Dates with limits or blocked days, shown in a locale format.

When not to use:
- Use calendar inline when the grid should stay visible.
- Use time-picker for times, and pair it with this for a full timestamp.

Keywords: date, field, react date picker, datepicker, date input with calendar, calendar popover, form date field, animated date picker

Files: src/components/arc/date-picker/date-picker.module.css, src/components/arc/date-picker/date-picker.tsx

## `date-range-picker` · Date range picker (Free, component)

A range picker that grows from its trigger into two months with presets and a stretching range highlight.

When to use:
- Analytics and reporting filters that need presets like Last 7 days or This quarter.
- Booking or leave requests where a start and end day are picked together.

When not to use:
- Use date-picker for a single date.
- Use calendar when the month should stay visible on the page.

Keywords: inputs, new, react date range picker, date range, calendar range selection, analytics date filter, start and end date, date presets, booking date picker

Files: src/components/arc/date-range-picker/date-range-picker.module.css, src/components/arc/date-range-picker/date-range-picker.tsx

## `emoji-picker` · Emoji picker (Pro, component)

A full emoji picker with instant search, scroll-synced categories, skin tones, recently used emoji, and a virtualized, keyboard-navigable grid.

When to use:
- Message composers, comment boxes, and chat inputs.
- Choosing an emoji for a status, a project, a page icon, or a label.

When not to use:
- Use reactions for a small, fixed set of quick responses on a post or comment.
- Use combobox or a select when the choices are a short, known list.

Keywords: input, picker, emoji, new, emoji picker, emoji keyboard, smiley, emoticon, skin tone, recent emoji, frequently used, chat, composer, insert emoji, reaction picker

Files: src/components/arc/emoji-picker/demo.module.css, src/components/arc/emoji-picker/demo.tsx, src/components/arc/emoji-picker/emoji-data.ts, src/components/arc/emoji-picker/emoji-picker.module.css, src/components/arc/emoji-picker/emoji-picker.tsx

## `time-picker` · Time picker (Free, component)

Choose a time with sensible keyboard behavior.

When to use:
- Picking a time of day at a fixed interval, such as meetings or reminders.
- Fields that show 12-hour times but store 24-hour HH:mm values.

When not to use:
- Use date-picker for dates, pairing the two for a timestamp.
- Use time-dial for a more tactile, showcase time selection.

Keywords: time, field, react time picker, time select, time input, meeting time picker, 12 hour time picker, time dropdown

Files: src/components/arc/time-picker/time-picker.module.css, src/components/arc/time-picker/time-picker.tsx
