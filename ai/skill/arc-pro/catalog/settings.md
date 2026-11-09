# Settings

## `cancel-flow` — Cancel flow (Pro, block)

A cancellation flow that answers each reason with a tailored offer and a calm hold-to-cancel.

When to use:
- Subscription cancellation in billing settings with a reason step and a retention offer.
- Flows that offer a discount, pause, or downgrade before confirming the cancel.

When not to use:
- Use dialog with hold-to-confirm for a one step destructive action without offers.
- Use plan-comparison when people are choosing a plan rather than leaving.

Keywords: react cancel subscription flow, churn prevention flow, cancellation survey, retention offer, pause subscription, cancel flow saas

Files: cancel-flow.module.css, cancel-flow.tsx, demo.tsx

## `invite-people` — Invite people (Pro, block)

Invite teammates with roles, bulk paste validation, a seat meter, and avatars that fly into a pending list.

When to use:
- Inviting several people at once by name or email, with a role for each.
- Plans with a seat limit where people should see the effect of an invite before sending.

When not to use:
- Use team-members to manage people who already joined.
- Use roles-permissions to edit what each role can do.

Keywords: react invite people, invite teammates form, email chip input, workspace invite, seat limit meter, invite by email, team invite with roles, paste email list

Files: demo.tsx, invite-people.module.css, invite-people.tsx

## `onboarding-survey` — Onboarding survey (Pro, block)

A post-signup onboarding survey where each question gets its own step of large option cards, picked with keys 1 to 4 and Enter. A short personalization checklist then ticks off and lands on an editable "You're all set" summary.

When to use:
- Post-signup personalization: role, team size and first action before the first screen.
- Short in-product surveys where every answer changes what someone sees next.

When not to use:
- Long forms with free text or many fields; use a regular form or import-wizard.
- Guided tours over the real interface; use onboarding-tour.

Keywords: onboarding survey, welcome survey, post signup, personalization, onboarding questions, role picker, team size, option cards, multi step form, typeform style, workspace setup, keyboard shortcuts

Files: demo.tsx, onboarding-survey.module.css, onboarding-survey.tsx

## `profile-page` — Profile page (Pro, block)

A user profile with cover, bio, stats, activity and project tabs, and an edit sheet that writes back into the page.

When to use:
- A person's own profile with an edit flow
- Public creator or member pages inside an app

When not to use:
- Account security or billing settings, use settings-page
- A directory of many people, use team-directory

Keywords: profile, user profile, account page, edit profile, cover photo, avatar, bio, activity tab, projects

Files: demo.tsx, profile-page.module.css, profile-page.tsx

## `roles-permissions` — Roles and permissions (Pro, block)

A permissions matrix with group toggles that ripple, role duplication and a review bar.

When to use:
- Workspace settings where admins edit what each role can do.
- Permission matrices with grouped permissions and a review step before saving.

When not to use:
- Use team-members to assign roles to people.
- Use switch rows in settings-page for a few on and off settings.

Keywords: react permissions matrix, roles and permissions ui, rbac settings, access control table, role editor, permission toggles

Files: demo.tsx, roles-permissions.module.css, roles-permissions.tsx

## `spend-alert` — Spend alert (Pro, block)

A budget and spend alert card where the threshold is set right on the live spend bar, with forecast, Email, Slack and PagerDuty toggles, a hard stop and a live preview of the Slack message the alert will post.

When to use:
- Letting a team set a monthly budget and alert threshold for metered spend.
- Showing how close current and forecast spend are to an alert line.

When not to use:
- Read-only usage reporting with no settings; use usage-forecast or usage-billing instead.
- Per-seat plans with no metered spend.

Keywords: spend alert, budget alert, billing threshold, usage alert, cost alert, ai spend, slack notification preview, pagerduty, hard stop, budget settings

Files: demo.module.css, demo.tsx, spend-alert.module.css, spend-alert.tsx

## `team-directory` — Team directory (Pro, block)

Searchable people, team filters, and a focused profile panel.

When to use:
- An internal directory where people search colleagues and copy contact details.
- Team pages with department filters and a profile pane.

When not to use:
- Use team-members to manage roles and invitations.
- Use team-showcase for a public, image-led team section.

Keywords: react team directory, employee directory, people search, staff directory ui, company directory, team list with profile

Files: demo.tsx, team-directory.module.css, team-directory.tsx

## `team-members` — Team members (Pro, block)

A members list where typed emails turn into chips and fly into pending invites as seats roll.

When to use:
- The team or workspace settings page of a SaaS app.
- Inviting several people at once by typing or pasting emails.

When not to use:
- Use team-directory for a browsable people directory.
- Use roles-permissions to define what each role can do.

Keywords: react team members, invite team members, member management, user roles table, invite by email, seat management, workspace members

Files: demo.tsx, team-members.module.css, team-members.tsx
