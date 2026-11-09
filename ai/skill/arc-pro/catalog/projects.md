# Projects

## `feature-bento` · Feature bento (Pro, block)

A six cell feature bento where small, real product UI acts each feature out on hover.

When to use:
- A landing page features section that should show the product rather than list it.
- Launch pages where each capability has one clear, demonstrable behavior.

When not to use:
- Long feature lists or comparison tables. Use Plan comparison.
- A guided walkthrough with order. Use Scroll story.

Keywords: bento, bento grid, feature grid, features section, landing page, product features, marketing section

Files: demo.tsx, feature-bento.module.css, feature-bento.tsx

## `feedback-board` · Feedback board (Pro, block)

A feature request board with a submit form that finds similar requests, upvotes, top and new sorting, status filters, and comments.

When to use:
- A public or in app board where customers suggest and vote on features.
- Beta programs that need a lightweight place for requests and team replies.

When not to use:
- One to one support conversations; use support-conversation or support-widget.

Keywords: feedback board, feature requests, upvote, voting, ideas, product feedback, canny, suggestions

Files: demo.tsx, feedback-board.module.css, feedback-board.tsx

## `goal-tracker` · Goal tracker (Pro, block)

A team goals card where objectives open into key results with owners, confidence and progress bars. A weekly check-in updates a value, confidence and note in place, fills the bar and recalculates the objective, and a quarter selector steps from last quarter's final scores to next quarter's planning.

When to use:
- Showing a team's quarterly objectives and key results with owners and confidence.
- Collecting a lightweight weekly check-in (value, confidence, note) without leaving the page.

When not to use:
- A single KPI with a trend line; use a metric or stat card.
- Task or project tracking with assignees and due dates; use a task list or kanban block.

Keywords: okr, goals, objectives, key results, goal tracker, check-in, progress bar, quarterly goals, confidence, lattice, team goals

Files: demo.tsx, goal-tracker.module.css, goal-tracker.tsx

## `hero-section` · Hero section (Free, block)

Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.

When to use:
- The first section of a SaaS landing page, when the product screen is the pitch (Screenshot).
- Developer tools, automation, and infrastructure products, where showing the product working is the pitch (Workflow).

When not to use:
- Use page-header for titles inside app screens.
- Use hero-signup when the goal is collecting an email in the first section.

Keywords: react hero section, saas hero, landing page hero, hero with dashboard screenshot, mesh gradient hero, workflow hero, perspective screenshot hero

Files: registry/blocks/hero-section/hero-section.tsx, registry/blocks/hero-section/hero-section.module.css, registry/blocks/hero-section/hero-content.tsx, registry/blocks/hero-section/hero-content.module.css, registry/blocks/hero-section/hero-motion.ts, registry/blocks/hero-section/hero-mesh.tsx, registry/blocks/hero-section/hero-mesh.module.css, registry/blocks/hero-section/hero-cadence.tsx, registry/blocks/hero-section/hero-cadence.module.css, registry/blocks/hero-section/hero-relay.tsx, registry/blocks/hero-section/hero-relay.module.css, registry/blocks/hero-section/hero-lumen.tsx, registry/blocks/hero-section/hero-lumen.module.css, registry/blocks/hero-section/hero-lumen-data.ts, lib/media.ts

## `hero-signup` · Hero signup (Pro, block)

A full screen waitlist hero on a soft, drifting mesh gradient: the email field validates as you type and its button grows into the confirmation with your place in line.

When to use:
- Waitlists, early access, and launch pages where the email is the only ask.
- Pages that want a calm but alive first impression without product screenshots.

When not to use:
- Signup that needs a password, SSO choice, or consent up front; use Sign up form.
- A newsletter box further down the page; use Newsletter signup.

Keywords: hero, waitlist, email signup, mesh gradient, early access, landing page, email capture, launch

Files: demo.tsx, gradient-mesh.module.css, gradient-mesh.tsx, hero-signup.module.css, hero-signup.tsx

## `kanban-board` · Kanban board (Pro, block)

A kanban board where cards lift, tilt and spring into the slot that opens for them, with swimlanes and live WIP limits.

When to use:
- A team board where cards move between statuses.
- Pipelines where ordering within a stage matters.

When not to use:
- Scheduling on dates; use gantt-timeline or week-calendar.
- Read only status summaries; use a table.

Keywords: kanban, board, drag and drop, swimlanes, wip limit, task board, pipeline, issue tracker

Files: demo.tsx, kanban-board.module.css, kanban-board.tsx

## `scroll-story` · Scroll story (Pro, block)

A feature section where scrolling the copy drives a pinned product view through each step.

When to use:
- Marketing pages that walk through a product in a few steps as people scroll.
- Feature sections where a pinned product view should change with the copy.

When not to use:
- Use scroll-highlight for a single paragraph that reveals with scroll.
- Use chaos-to-order for one before and after switch.

Keywords: react scroll story, scrollytelling, sticky scroll section, scroll driven animation, product walkthrough on scroll, apple style scroll section

Files: demo.tsx, scroll-story.module.css, scroll-story.tsx

## `smart-scheduler` · Smart scheduler (Pro, block)

A scheduling card where one sentence like "Find 30 min with Maya and Leo next week, mornings" is read into chips. The three best slots are then ranked across everyone's Google Calendar and Outlook calendars, with an availability strip per person and conflicts called out. Picking a slot opens a draft invite with a Google Meet link, ready to send.

When to use:
- A scheduling assistant inside a CRM, recruiting tool, or team app that books internal meetings from one sentence.
- Showing why a time was suggested: who is free, what conflicts, and what is tentative.

When not to use:
- Public booking pages where guests pick from your open times; use availability-picker or booking-pill.
- Browsing or editing a full calendar; use week-calendar or month-calendar.

Keywords: ai scheduling, natural language scheduling, find a time, meeting scheduler, availability, free busy, calendar assistant, google calendar, outlook, google meet, invite, booking

Files: demo.tsx, smart-scheduler-data.ts, smart-scheduler.module.css, smart-scheduler.tsx

## `spotlight-grid` · Spotlight grid (Pro, block)

A feature grid where light follows the pointer, cards play live demos, and a click morphs a card into its detail.

When to use:
- A product landing page section that shows four features with live, hands-on previews.
- Developer tool marketing where a small working demo explains a feature better than copy.

When not to use:
- Use use-case-gallery for a browsable set of customer or use case stories.
- Use expandable-card when you need a single card that expands, not a whole feature grid.

Keywords: react spotlight grid, feature grid, bento grid, interactive feature section, landing page features, card spotlight hover, expanding feature cards, shared layout card morph

Files: demo.tsx, spotlight-grid.module.css, spotlight-grid.tsx

## `task-breakdown` · Task breakdown (Pro, block)

A goal input where AI breaks one sentence into a plan: tasks stream in with estimates, owners and dependencies, and a live timeline shows whether the deadline holds. Reorder, edit or regenerate any task, then send the plan to Linear or Jira with progress for each issue and links.

When to use:
- Turning a goal or brief into a scoped project plan inside a PM, CRM or internal tool.
- Exporting AI drafted work to Linear or Jira with a review step before anything is created.

When not to use:
- Showing an agent working through steps live; use agent-plan.
- A full backlog or board with many projects; use a dedicated table or kanban.

Keywords: task breakdown, ai project plan, goal to tasks, linear export, jira export, estimates, critical path, timeline, drag reorder, ai planning, work breakdown

Files: demo.tsx, task-breakdown.module.css, task-breakdown.tsx
