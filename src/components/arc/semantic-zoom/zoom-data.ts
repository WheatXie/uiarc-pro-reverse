export type Health = "on-track" | "at-risk" | "off-track";
export type Status = "done" | "review" | "progress" | "todo" | "blocked";

/** Node kinds in the map tree: 0 company, 1 team, 2 project, 3 task, 4 person. */
export type NodeKind = 0 | 1 | 2 | 3 | 4;

export interface Person {
  name: string;
  first: string;
  initials: string;
  role: string;
  portrait?: string;
}

export interface TaskSeed {
  title: string;
}

export interface ProjectSeed {
  name: string;
  brief: string;
  health: Health;
  due: number;
  done: number;
  blocker: string;
  tasks: string[];
}

export interface TeamSeed {
  name: string;
  lead: number;
  members: number[];
  mission: string;
  cols: number;
  rows: number;
  x: number;
  y: number;
  cw: number;
  projects: ProjectSeed[];
}

export interface MapNode {
  id: number;
  kind: NodeKind;
  parent: number;
  children: number[];
  x: number;
  y: number;
  w: number;
  h: number;
  ref: number;
  name: string;
}

export interface Team {
  id: number;
  name: string;
  lead: number;
  mission: string;
  members: number[];
  projects: number[];
}

export interface Project {
  id: number;
  team: number;
  name: string;
  brief: string;
  health: Health;
  due: number;
  lead: number;
  blocker: string;
  tasks: number[];
  people: number[];
}

export interface Task {
  id: number;
  project: number;
  title: string;
  base: Status;
  assignee: number;
  due: number;
  points: number;
  comments: number;
  checklist: string[];
  baseChecks: boolean[];
}

export const KIND_LABEL = ["Company", "Team", "Project", "Task", "Person"] as const;

export const STATUS_LABEL: Record<Status, string> = {
  done: "Done",
  review: "In review",
  progress: "In progress",
  todo: "To do",
  blocked: "Blocked",
};

export const HEALTH_LABEL: Record<Health, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};

export const CHECKLIST_POOL = [
  "Write the spec",
  "Agree on scope",
  "Build behind a flag",
  "Add tests",
  "Review with the team",
  "QA on staging",
  "Update the docs",
  "Ship to 10%",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(offset: number): string {
  const date = new Date(Date.UTC(2026, 8, 22 + offset));
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function person(name: string, role: string, portrait?: string): Person {
  const parts = name.split(" ");
  return {
    name,
    first: parts[0],
    initials: (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(),
    role,
    portrait,
  };
}

export const PEOPLE: Person[] = [
  person(
    "Jasmine Brooks",
    "Engineering lead",
    "/media/people/jasmine-brooks.svg",
  ),
  person("Emma Collins", "Design lead", "/media/people/emma-collins.svg"),
  person(
    "Marcus Johnson",
    "Growth lead",
    "/media/people/marcus-johnson.svg",
  ),
  person("Ava Mitchell", "Mobile lead", "/media/people/ava-mitchell.svg"),
  person("Sofia Ramirez", "Data lead", "/media/people/sofia-ramirez.svg"),
  person("Nathan Cole", "Staff engineer", "/media/people/nathan-cole.svg"),
  person("Daniel Kim", "Backend engineer", "/media/people/daniel-kim.svg"),
  person(
    "Olivia Bennett",
    "Site reliability engineer",
    "/media/people/olivia-bennett.svg",
  ),
  person("Aiko Tanaka", "Security engineer"),
  person(
    "Chloe Nguyen",
    "Product designer",
    "/media/people/chloe-nguyen.svg",
  ),
  person("Ben Okafor", "Product designer"),
  person(
    "Hannah Walsh",
    "Content designer",
    "/media/people/hannah-walsh.svg",
  ),
  person(
    "Mateo Alvarez",
    "Growth engineer",
    "/media/people/mateo-alvarez.svg",
  ),
  person(
    "Ryan Sullivan",
    "Lifecycle marketer",
    "/media/people/ryan-sullivan.svg",
  ),
  person(
    "Andre Williams",
    "Data analyst",
    "/media/people/andre-williams.svg",
  ),
  person("Tyler Hayes", "iOS engineer", "/media/people/tyler-hayes.svg"),
  person("Mei Lin", "Android engineer"),
  person(
    "Jordan Reyes",
    "Mobile QA engineer",
    "/media/people/jordan-reyes.svg",
  ),
  person("Nina Petrov", "Analytics engineer"),
  person("Elif Kaya", "Data scientist"),
  person("Diane Foster", "Data engineer", "/media/people/diane-foster.svg"),
];

export const TEAMS: TeamSeed[] = [
  {
    name: "Platform",
    lead: 0,
    members: [0, 5, 6, 7, 8],
    mission:
      "Billing, identity and the infrastructure under every request.",
    cols: 3,
    rows: 2,
    x: 0,
    y: 0,
    cw: 200,
    projects: [
      {
        name: "Billing v2",
        brief: "Move invoicing onto the new usage ledger.",
        health: "at-risk",
        due: 23,
        done: 0.42,
        blocker: "the ledger schema review with finance",
        tasks: [
          "Backfill invoices into the ledger",
          "Dual-write usage events",
          "Proration for mid-cycle upgrades",
          "Tax lines for EU customers",
          "Invoice PDF renderer",
          "Dunning email retries",
          "Reconcile Stripe payouts",
          "Migrate legacy coupons",
          "Load test month-end close",
          "Finance sign-off on totals",
        ],
      },
      {
        name: "SSO for enterprise",
        brief: "SAML and SCIM for Enterprise workspaces.",
        health: "on-track",
        due: 30,
        done: 0.43,
        blocker: "",
        tasks: [
          "SAML metadata upload",
          "SCIM user provisioning",
          "Group to role mapping",
          "Just-in-time accounts",
          "Enforce SSO setting",
          "Okta integration test",
          "Admin audit events",
        ],
      },
      {
        name: "Edge caching",
        brief: "Serve published pages from 30 edge regions.",
        health: "on-track",
        due: 12,
        done: 0.67,
        blocker: "",
        tasks: [
          "Cache key design",
          "Purge on publish",
          "Stale-while-revalidate headers",
          "Regional failover drill",
          "Cache hit dashboard",
          "Roll out to 10% of workspaces",
        ],
      },
      {
        name: "Postgres 17 upgrade",
        brief: "Upgrade the primary cluster with zero downtime.",
        health: "on-track",
        due: 8,
        done: 0.72,
        blocker: "",
        tasks: [
          "Replica on Postgres 17",
          "Replication lag alerts",
          "Extension compatibility",
          "Cutover runbook",
          "Rehearse cutover on staging",
          "Book maintenance window",
          "Retire old primary",
        ],
      },
      {
        name: "Audit log export",
        brief: "Stream audit events to customer SIEM tools.",
        health: "off-track",
        due: 41,
        done: 0.13,
        blocker: "the event schema sign-off from security",
        tasks: [
          "Event schema v1",
          "Splunk connector",
          "Datadog connector",
          "Retention settings",
          "Export screen in admin",
          "Backfill 90 days of events",
          "Signed delivery with HMAC",
          "Rate limits per workspace",
        ],
      },
      {
        name: "Rate limiting",
        brief: "Fair usage limits for the public API.",
        health: "on-track",
        due: 19,
        done: 0.5,
        blocker: "",
        tasks: [
          "Token bucket per key",
          "Document 429 responses",
          "Burst allowance for Enterprise",
          "Limit headers on responses",
          "Usage alert at 80%",
          "Shadow mode rollout",
        ],
      },
    ],
  },
  {
    name: "Product design",
    lead: 1,
    members: [1, 9, 10, 11],
    mission: "The design system and every first-run experience.",
    cols: 2,
    rows: 2,
    x: 704,
    y: 0,
    cw: 200,
    projects: [
      {
        name: "Design system 3.0",
        brief: "New tokens, dark mode and 40 rebuilt components.",
        health: "on-track",
        due: 27,
        done: 0.56,
        blocker: "",
        tasks: [
          "Color tokens in OKLCH",
          "Dark mode surfaces",
          "Button and input specs",
          "Table component",
          "Motion guidelines",
          "Icon set at 1.75 stroke",
          "Figma library release",
          "Migration guide",
          "Deprecate v2 components",
        ],
      },
      {
        name: "Onboarding redesign",
        brief: "First project in under five minutes.",
        health: "at-risk",
        due: 16,
        done: 0.38,
        blocker: "the template picker API from Platform",
        tasks: [
          "Map current drop-off",
          "Welcome checklist",
          "Template picker",
          "Invite teammates step",
          "Empty state artwork",
          "Usability test with 8 teams",
          "Copy review",
          "A/B test plan",
        ],
      },
      {
        name: "Mobile navigation",
        brief: "One tab bar for iOS and Android.",
        health: "on-track",
        due: 34,
        done: 0.33,
        blocker: "",
        tasks: [
          "Audit current navigation",
          "Tab bar prototype",
          "Search entry point",
          "Gesture spec",
          "Handoff to Mobile",
          "Accessibility review",
        ],
      },
      {
        name: "Accessibility audit",
        brief: "WCAG 2.2 AA across the web app.",
        health: "on-track",
        due: 44,
        done: 0.29,
        blocker: "",
        tasks: [
          "Keyboard paths in editor",
          "Screen reader labels",
          "Contrast in charts",
          "Reduced motion pass",
          "Focus order in dialogs",
          "Report for customers",
          "Fix list for Q4",
        ],
      },
    ],
  },
  {
    name: "Growth",
    lead: 2,
    members: [2, 12, 13, 14],
    mission: "Trials, pricing and the first 30 days.",
    cols: 2,
    rows: 2,
    x: 1192,
    y: 0,
    cw: 200,
    projects: [
      {
        name: "Pricing page test",
        brief: "Test annual-first pricing with 50% of visitors.",
        health: "on-track",
        due: 9,
        done: 0.71,
        blocker: "",
        tasks: [
          "Hypothesis and metrics",
          "Annual toggle design",
          "Experiment flag",
          "Stripe price IDs",
          "QA in five currencies",
          "Launch to 50%",
          "Readout doc",
        ],
      },
      {
        name: "Referral program",
        brief: "A free month for every team that joins.",
        health: "at-risk",
        due: 25,
        done: 0.25,
        blocker: "legal review of the referral terms",
        tasks: [
          "Reward rules",
          "Referral link service",
          "Fraud checks",
          "Invite page",
          "Credit on invoice",
          "Legal review of terms",
          "Launch email",
          "Referral dashboard",
        ],
      },
      {
        name: "Lifecycle emails",
        brief: "Rewrite the first 30 days of email.",
        health: "on-track",
        due: 14,
        done: 0.57,
        blocker: "",
        tasks: [
          "Audit current sends",
          "Day 1 welcome",
          "Day 3 template nudge",
          "Day 7 invite reminder",
          "Day 14 trial ending",
          "Plain text versions",
          "Unsubscribe center",
        ],
      },
      {
        name: "Trial conversion",
        brief: "Lift trial to paid from 18% to 24%.",
        health: "on-track",
        due: 38,
        done: 0.33,
        blocker: "",
        tasks: [
          "Cohort analysis of trials",
          "Paywall moments",
          "In-app upgrade prompt",
          "Sales assist for large teams",
          "Trial extension flow",
          "Win-back offer",
        ],
      },
    ],
  },
  {
    name: "Mobile",
    lead: 3,
    members: [3, 15, 16, 17],
    mission: "Northstar on iOS and Android.",
    cols: 4,
    rows: 1,
    x: 0,
    y: 588,
    cw: 208,
    projects: [
      {
        name: "Offline mode",
        brief: "Edit projects offline and sync later.",
        health: "at-risk",
        due: 31,
        done: 0.25,
        blocker: "sync conflict rules from Platform",
        tasks: [
          "Local database schema",
          "Sync conflict rules",
          "Queue writes offline",
          "Offline banner",
          "Attachment caching",
          "Conflict resolution screen",
          "Airplane mode test plan",
          "Beta for 500 people",
        ],
      },
      {
        name: "iOS widgets",
        brief: "Today and project widgets for the home screen.",
        health: "on-track",
        due: 11,
        done: 0.67,
        blocker: "",
        tasks: [
          "Widget sizes",
          "Timeline provider",
          "Deep links into projects",
          "Lock screen widget",
          "App Store screenshots",
          "Release notes",
        ],
      },
      {
        name: "Android performance",
        brief: "Cold start under 1.5 seconds.",
        health: "on-track",
        due: 20,
        done: 0.5,
        blocker: "",
        tasks: [
          "Baseline profiles",
          "Lazy load the editor",
          "Trace cold start",
          "Reduce APK size",
          "Image cache tuning",
          "Play Console vitals review",
        ],
      },
      {
        name: "Notification settings",
        brief: "Per-project push notification controls.",
        health: "off-track",
        due: 6,
        done: 0.29,
        blocker: "the preferences API migration",
        tasks: [
          "Settings screen",
          "Server-side preferences",
          "Quiet hours",
          "Digest mode",
          "Migrate old settings",
          "Permission prompt timing",
          "QA on 12 devices",
        ],
      },
    ],
  },
  {
    name: "Data and insights",
    lead: 4,
    members: [4, 18, 19, 20],
    mission: "Metrics everyone trusts.",
    cols: 3,
    rows: 1,
    x: 952,
    y: 588,
    cw: 208,
    projects: [
      {
        name: "Usage analytics",
        brief: "Show workspace admins who uses what.",
        health: "on-track",
        due: 18,
        done: 0.5,
        blocker: "",
        tasks: [
          "Event tracking plan",
          "Daily active members chart",
          "Feature adoption table",
          "CSV export",
          "Admin permissions",
          "Loading and empty states",
          "Help center article",
          "Beta feedback review",
        ],
      },
      {
        name: "Revenue dashboard",
        brief: "One trusted view of MRR for leadership.",
        health: "on-track",
        due: 10,
        done: 0.67,
        blocker: "",
        tasks: [
          "MRR definition",
          "Subscription models in dbt",
          "Expansion and churn split",
          "Board deck export",
          "Reconcile with finance",
          "Data freshness alert",
        ],
      },
      {
        name: "Churn model",
        brief: "Flag at-risk accounts two months early.",
        health: "at-risk",
        due: 36,
        done: 0.25,
        blocker: "labelled churn data from Customer success",
        tasks: [
          "Feature set",
          "Label historical churn",
          "Train baseline model",
          "Calibration check",
          "Score accounts nightly",
          "Surface scores in the CRM",
          "Review with success team",
          "Model card",
        ],
      },
    ],
  },
];

/* --------------------------------------------------------------------------------------------
 * The map tree, built once at module load.
 *
 * The reference builds this eagerly from the seed data with a mulberry32 stream, so every task
 * status, due date, point estimate and checklist is a pure function of the literals above. The
 * generator is kept (rather than the expanded result) so the numbers stay identical to the live
 * block: the call order of `random()` is what pins them.
 * ------------------------------------------------------------------------------------------ */

export const ROOT_W = 1648;
export const ROOT_H = 910;

export const NODES: MapNode[] = [
  {
    id: 0,
    kind: 0,
    parent: -1,
    children: [],
    x: 0,
    y: 0,
    w: ROOT_W,
    h: ROOT_H,
    ref: 0,
    name: "Northstar Studio",
  },
];

export const TEAMS_LIST: Team[] = [];
export const PROJECTS: Project[] = [];
export const TASKS: Task[] = [];
export const TEAM_NODES: number[] = [];
export const PROJECT_NODES: number[] = [];
export const TASK_NODES: number[] = [];

let seed = 0x135283a;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
}

function addNode(spec: Omit<MapNode, "id" | "children">): number {
  const node: MapNode = { ...spec, id: NODES.length, children: [] };
  NODES.push(node);
  NODES[spec.parent].children.push(node.id);
  return node.id;
}

TEAMS.forEach((team, teamIndex) => {
  const record: Team = {
    id: teamIndex,
    name: team.name,
    lead: team.lead,
    mission: team.mission,
    members: team.members,
    projects: [],
  };
  TEAMS_LIST.push(record);

  const teamW = 40 + team.cols * team.cw + (team.cols - 1) * 16;
  const teamH = 84 + 218 * team.rows + (team.rows - 1) * 16 + 20;
  const teamNode = addNode({
    kind: 1,
    parent: 0,
    x: team.x,
    y: team.y,
    w: teamW,
    h: teamH,
    ref: teamIndex,
    name: team.name,
  });
  TEAM_NODES.push(teamNode);

  team.projects.forEach((seedProject, projectIndex) => {
    const projectId = PROJECTS.length;
    const project: Project = {
      id: projectId,
      team: teamIndex,
      name: seedProject.name,
      brief: seedProject.brief,
      health: seedProject.health,
      due: seedProject.due,
      lead: team.members[projectIndex % team.members.length],
      blocker: seedProject.blocker,
      tasks: [],
      people: [],
    };
    PROJECTS.push(project);
    record.projects.push(projectId);

    const projectX = team.x + 20 + (projectIndex % team.cols) * (team.cw + 16);
    const projectY = team.y + 84 + 234 * Math.floor(projectIndex / team.cols);
    const projectNode = addNode({
      kind: 2,
      parent: teamNode,
      x: projectX,
      y: projectY,
      w: team.cw,
      h: 218,
      ref: projectId,
      name: seedProject.name,
    });
    PROJECT_NODES.push(projectNode);

    const total = seedProject.tasks.length;
    const shipped = Math.round(total * seedProject.done);
    const blockedRun = seedProject.health === "off-track" ? 2 : seedProject.health === "at-risk" ? 1 : 0;
    const tileW = (team.cw - 24 - 8) / 3;

    seedProject.tasks.forEach((title, taskIndex) => {
      const remaining = taskIndex - shipped;
      const runLength = total - shipped > 3 ? 2 : 1;
      const status: Status =
        remaining < 0
          ? "done"
          : remaining === 0 && total - shipped > 3
            ? "review"
            : remaining <= runLength
              ? "progress"
              : remaining <= runLength + blockedRun
                ? "blocked"
                : "todo";

      const pool = team.members;
      const assignee = taskIndex === 0 ? project.lead : pool[Math.floor(random() * pool.length)];
      const due =
        status === "done"
          ? -3 - (shipped - taskIndex) * 3 - Math.floor(3 * random())
          : Math.max(
              1,
              Math.round(((remaining + 1) / (total - shipped)) * seedProject.due) - Math.floor(3 * random()),
            );
      const checkCount = 3 + Math.floor(3 * random());
      const offset = Math.floor(random() * (CHECKLIST_POOL.length - checkCount + 1));
      const checklist = CHECKLIST_POOL.slice(offset, offset + checkCount);
      const checked =
        status === "done"
          ? checkCount
          : status === "review"
            ? checkCount - 1
            : status === "progress"
              ? Math.max(1, Math.floor(checkCount / 2))
              : status === "blocked"
                ? 1
                : 0;
      const taskId = TASKS.length;

      TASKS.push({
        id: taskId,
        project: projectId,
        title,
        base: status,
        assignee,
        due,
        points: [1, 2, 3, 5, 8][Math.floor(5 * random())],
        comments: Math.floor(13 * random()),
        checklist,
        baseChecks: checklist.map((_, index) => index < checked),
      });
      project.tasks.push(taskId);

      TASK_NODES.push(
        addNode({
          kind: 3,
          parent: projectNode,
          x: projectX + 12 + (taskIndex % 3) * (tileW + 4),
          y: projectY + 60 + 32 * Math.floor(taskIndex / 3),
          w: tileW,
          h: 28,
          ref: taskId,
          name: title,
        }),
      );
    });

    const involved = [project.lead, ...project.tasks.map((taskId) => TASKS[taskId].assignee)];
    project.people = involved.filter((personId, index) => involved.indexOf(personId) === index).slice(0, 5);
    project.people.forEach((personId, index) =>
      addNode({
        kind: 4,
        parent: projectNode,
        x: projectX + 12 + 19 * index,
        y: projectY + 190,
        w: 16,
        h: 16,
        ref: personId,
        name: PEOPLE[personId].name,
      }),
    );
  });
});

export const TEAM_COUNT = TEAMS_LIST.length;
export const PROJECT_COUNT = PROJECTS.length;
export const TASK_COUNT = TASKS.length;
