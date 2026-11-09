# Progress

## `countdown` · Countdown (Free, component)

A launch countdown with rolling digits that morphs into a live state at zero.

When to use:
- A launch page or event hero counting to a keynote.
- A compact deadline pill in a table row or banner.

When not to use:
- Use stopwatch for time counting up from a start.
- Use announcement-bar when the countdown sits inside a site-wide banner with a call to action.

Keywords: feedback, new, react countdown, countdown timer, launch countdown, event timer, digit roll animation, deadline timer, time zone countdown

Files: registry/components/countdown/countdown.tsx, registry/components/countdown/countdown.module.css

## `onboarding-checklist` · Onboarding checklist (Free, component)

Guide a new workspace through setup, one step at a time.

When to use:
- A one-time getting-started card with three to eight loosely ordered steps.
- Setup steps that run async actions, like Connect GitHub, and check off when they resolve.

When not to use:
- Use stepper when the order is strict and steps map to screens.
- Use multi-step-form when every step collects form input.

Keywords: onboarding, checklist, getting started, react onboarding checklist, getting started checklist, setup checklist, user onboarding, progress checklist, task list onboarding

Files: registry/components/onboarding-checklist/onboarding-checklist.tsx, registry/components/onboarding-checklist/onboarding-checklist.module.css

## `progress` · Progress (Free, component)

Show how much of a known task is complete.

When to use:
- Determinate progress for uploads, imports, or long tasks.
- Progress with a visible percentage and a check at completion, via showValue.

When not to use:
- Use skeleton while content is loading with no progress to report.
- Use usage-meter for quota against a limit, and gauge for dashboard metrics.

Keywords: status, loading, react progress bar, animated progress bar, upload progress, loading bar, percentage bar, progress indicator

Files: registry/components/progress/progress.tsx, registry/components/progress/progress.module.css

## `skeleton` · Skeleton (Free, component)

Reserve space while content is still loading.

When to use:
- Loading states for content whose shape is known, like a profile or comment.
- Swapping a placeholder into real content with a crossfade and height spring.

When not to use:
- Use progress when you can report a percentage.
- Use empty-state when loading finished and there is nothing to show.

Keywords: loading, status, react skeleton, skeleton loader, loading placeholder, content placeholder, shimmer loading, skeleton screen

Files: registry/components/skeleton/skeleton.tsx, registry/components/skeleton/skeleton.module.css

## `stepper` · Stepper (Free, component)

Show where a person is in a multi-step flow and what is done.

When to use:
- Showing position in a strict multi-step flow like checkout or account setup.
- Flows where people can jump back to completed steps, via onStepSelect.

When not to use:
- Use multi-step-form when you also want the step content, navigation, and success state.
- Use onboarding-checklist for loosely ordered tasks.

Keywords: motion, product, react stepper, step indicator, progress steps, wizard steps, checkout steps, vertical stepper, multi step progress

Files: registry/components/stepper/stepper.tsx, registry/components/stepper/stepper.module.css

## `usage-meter` · Usage meter (Free, component)

Show what fills an allowance and how close it is to the limit.

When to use:
- Quota against a fixed allowance, such as storage, seats, or API calls.
- Billing pages that should show what takes the space and how close the plan is to full.

When not to use:
- Use progress for task completion.
- Use bar-chart to compare categories without a limit.

Keywords: meter, usage, storage, react usage meter, storage usage bar, quota meter, plan limit indicator, segmented progress bar, billing usage

Files: registry/components/usage-meter/usage-meter.tsx, registry/components/usage-meter/usage-meter.module.css
