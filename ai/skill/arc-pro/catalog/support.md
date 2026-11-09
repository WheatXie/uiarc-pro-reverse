# Support

## `availability-picker` · Availability picker (Pro, block)

Find a meeting time across people and see the choice come together.

When to use:
- Picking a meeting time that works for several attendees.
- Booking flows that show a few days and open slots with a confirmation step.

When not to use:
- Use calendar or date-picker to pick a single date.
- Use time-picker for a free time input.

Keywords: react availability picker, meeting time picker, group scheduling, calendly style picker, time slot picker, book a meeting ui

Files: availability-picker.module.css, availability-picker.tsx, demo.tsx

## `feature-voting` · Feature voting (Pro, block)

A public feature request board where votes roll digit by digit and the button fills with the accent. Top, New and Trending reorder the rows with one smooth move. A built-in composer suggests similar requests as you type, so people vote instead of posting duplicates.

When to use:
- A public feature request page where customers vote and suggest ideas.
- An in-app Give feedback panel that shows what is planned and shipped.

When not to use:
- A full roadmap with columns per stage: use a kanban style board.
- One off feedback on a single page or screen: use a short feedback form.

Keywords: feature voting, feature requests, upvote, roadmap, feedback board, canny, product feedback, duplicate detection, customer ideas, vote button

Files: demo.tsx, feature-voting.module.css, feature-voting.tsx

## `file-upload` · File upload (Free, block)

A complete file selection flow with constraints, progress, and error feedback.

When to use:
- Uploading files with per-file progress, retry, and remove.
- Attachments that must be validated by type and size before upload.

When not to use:
- Use file-dropzone when you only need to pick files without upload state.
- Use import-mapper when uploaded data needs column mapping.

Keywords: react file upload, drag and drop upload, upload progress, file dropzone, multiple file upload, upload with retry

Files: registry/components/file-upload/file-upload.tsx, registry/components/file-upload/file-upload.module.css

## `media-player` · Media player (Pro, block)

An audio player with a living playlist and complete playback controls.

When to use:
- A small audio collection such as a podcast, sample pack, or playlist.
- Pages that need a full player with seek, skip, volume, and a track list.

When not to use:
- Use now-playing for a compact now playing widget.
- Use transcript-studio when the audio needs a synced transcript.

Keywords: react audio player, music player component, podcast player, playlist player, custom audio controls, media player ui

Files: demo.tsx, media-player.module.css, media-player.tsx

## `project-board` · Project board (Pro, block)

A living workflow board for moving work between stages.

When to use:
- A compact kanban with a handful of tasks across fixed stages.
- Boards where moving tasks should be accessible through explicit buttons, not drag only.

When not to use:
- Use reorderable-list when order within one list matters more than stages.
- Use timeline for a dated sequence of events.

Keywords: react kanban board, project board, task board, kanban component, accessible kanban, trello style board

Files: demo.tsx, project-board.module.css, project-board.tsx

## `week-calendar` · Week calendar (Pro, block)

A week calendar where you drag to create, move, and resize events, with color coded calendars, day and agenda views, and swipes on phones.

When to use:
- Scheduling and planning screens where people create, move and resize time blocks across a week.
- Team or personal calendars that need several color coded calendars, all day events and an agenda on phones.

When not to use:
- Use month-calendar for a month overview with events per day.
- Use calendar or date-picker to pick a date, and time-picker for a single time.

Keywords: react week calendar, drag and drop calendar, google calendar clone, scheduler component, time blocking calendar, event scheduler, react calendar with time zones

Files: demo.tsx, week-calendar-data.ts, week-calendar.module.css, week-calendar.tsx
