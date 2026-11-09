"use client";

export interface Person {
  name: string;
  src: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  minutes: number;
  /** Already formatted: the byline prints it as written. */
  updated: string;
  author: Person;
  /** One line under the title in the list, and matched by search. */
  summary: string;
  intro: string;
  steps: string[];
  note: string;
  /** Extra words that should find this article but never appear in it. */
  keywords: string;
}

export interface DemoExport {
  name: string;
  detail: string;
  status: string;
  ok: boolean;
}

const ava: Person = { name: "Ava Mitchell", src: "/media/people/ava-mitchell.svg" };
const marcus: Person = { name: "Marcus Johnson", src: "/media/people/marcus-johnson.svg" };
const sofia: Person = { name: "Sofia Ramirez", src: "/media/people/sofia-ramirez.svg" };
const emma: Person = { name: "Emma Collins", src: "/media/people/emma-collins.svg" };
const jasmine: Person = { name: "Jasmine Brooks", src: "/media/people/jasmine-brooks.svg" };

/** The engineer on the other side of the conversation, and the two people behind her in the avatar stack. */
export const supportEngineer = ava;
export const supportTeam = [ava, marcus, sofia];

export const helpArticles: HelpArticle[] = [
  {
    id: "export-missing",
    title: "Why didn’t my scheduled export arrive?",
    category: "Troubleshooting",
    minutes: 2,
    updated: "Sep 18, 2026",
    author: sofia,
    summary: "Check the run history, the recipient list, and your email provider’s spam filter.",
    intro: "Most missing exports come from a paused schedule, a changed data source, or a filter at the recipient’s email provider.",
    steps: [
      "Open Exports, then History, and find the run.",
      "If it says Paused, fix the error it shows and choose Resume.",
      "If it says Delivered, ask the recipient to check spam and allow exports@harbor.example.",
      "Choose Run now to send a fresh copy while you wait.",
    ],
    note: "History keeps 90 days of runs, with the file size and who received each copy.",
    keywords: "missing email failed paused not arrived spam csv pdf",
  },
  {
    id: "schedule-export",
    title: "Schedule a recurring export",
    category: "Exports",
    minutes: 3,
    updated: "Sep 12, 2026",
    author: emma,
    summary: "Send any report as a CSV or PDF every day, week, or month.",
    intro: "Scheduled exports run in your workspace time zone and send a fresh copy of the report to everyone on the list.",
    steps: [
      "Open the report and choose Export, then Schedule.",
      "Pick CSV or PDF and how often it should run.",
      "Add recipients. People outside your workspace get a secure download link.",
      "Choose Save schedule. The first export runs at the next 6:00.",
    ],
    note: "An export that fails twice in a row pauses on its own, so nobody receives an empty file.",
    keywords: "csv pdf email send weekly daily monthly time zone report",
  },
  {
    id: "okta-sso",
    title: "Set up single sign-on with Okta",
    category: "Security",
    minutes: 5,
    updated: "Aug 30, 2026",
    author: jasmine,
    summary: "Connect Okta over SAML 2.0 and require it for your whole workspace.",
    intro: "You need Owner access in Harbor and admin access in Okta. Setup takes about ten minutes.",
    steps: [
      "In Okta, add a SAML 2.0 app and paste Harbor’s ACS URL and entity ID.",
      "Download the Okta metadata XML file.",
      "In Harbor, open Settings, then Security, and upload the file under Single sign-on.",
      "Sign in once with your own account, then turn on Require SSO.",
    ],
    note: "Keep one owner on password sign-in until everyone has signed in with SSO at least once.",
    keywords: "sso saml login sign in okta identity security",
  },
  {
    id: "roles",
    title: "Invite teammates and choose roles",
    category: "Workspace",
    minutes: 2,
    updated: "Sep 4, 2026",
    author: sofia,
    summary: "Owners, editors, and viewers, and what each of them can change.",
    intro: "Everyone you invite takes a seat, except viewers on the Growth and Scale plans.",
    steps: [
      "Open Settings, then Members, and choose Invite.",
      "Enter one or more email addresses.",
      "Pick a role: Owner, Editor, or Viewer.",
      "Choose Send invites. Invitations expire after 7 days.",
    ],
    note: "Only owners can change billing, security settings, or another owner’s role.",
    keywords: "invite seat seats member team permission viewer editor owner",
  },
  {
    id: "change-plan",
    title: "Change your plan or billing cycle",
    category: "Billing",
    minutes: 2,
    updated: "Sep 9, 2026",
    author: emma,
    summary: "Upgrades are prorated right away. Downgrades take effect at renewal.",
    intro: "Any owner can change the plan. The new limits apply the moment an upgrade goes through.",
    steps: [
      "Open Settings, then Billing, and choose Change plan.",
      "Pick a plan and monthly or yearly billing.",
      "Review the prorated amount, then confirm.",
    ],
    note: "Yearly billing costs 20% less and keeps your price for twelve months.",
    keywords: "upgrade downgrade seats price yearly monthly subscription plan billing",
  },
  {
    id: "invoices",
    title: "Download invoices and receipts",
    category: "Billing",
    minutes: 1,
    updated: "Jul 22, 2026",
    author: jasmine,
    summary: "Every invoice since your first payment, as a PDF you can forward.",
    intro: "Invoices are issued on your renewal date and show your VAT ID once you add it.",
    steps: [
      "Open Settings, then Billing, then Invoices.",
      "Choose Download next to any invoice.",
      "To have them sent automatically, add an address under Billing contacts.",
    ],
    note: "Need a different company name or address on past invoices? Ask us and we’ll reissue them.",
    keywords: "invoice receipt vat tax pdf billing",
  },
  {
    id: "postgres",
    title: "Connect a Postgres database",
    category: "Data sources",
    minutes: 4,
    updated: "Sep 15, 2026",
    author: jasmine,
    summary: "Use read-only credentials, allow Harbor’s IP addresses, and keep SSL on.",
    intro: "Harbor only reads from your database, so a read-only user is all it needs.",
    steps: [
      "Create a read-only user for Harbor in your database.",
      "Allow connections from 34.120.18.7 and 34.120.18.9.",
      "In Harbor, open Data sources, choose Add, then Postgres, and enter the host and credentials.",
      "Keep Require SSL on and choose Test connection.",
    ],
    note: "When a password changes, update it here too. Exports that read from the source pause until you do.",
    keywords: "postgres database sql connection warehouse ssl ip password",
  },
  {
    id: "slow-dashboard",
    title: "Speed up a slow dashboard",
    category: "Troubleshooting",
    minutes: 3,
    updated: "Aug 26, 2026",
    author: sofia,
    summary: "Cached queries, row limits, and when to split one dashboard into two.",
    intro: "A dashboard loads as fast as its slowest chart. Start by finding that one.",
    steps: [
      "Open the dashboard and choose Performance to see each chart’s query time.",
      "Turn on caching for charts that don’t need live data.",
      "Add a date filter so charts read fewer rows.",
      "Move charts slower than 5 seconds to a dashboard of their own.",
    ],
    note: "Dashboards with more than 25 charts load in pages of 10.",
    keywords: "slow performance cache loading speed dashboard",
  },
  {
    id: "public-link",
    title: "Share a dashboard with a public link",
    category: "Sharing",
    minutes: 2,
    updated: "Sep 2, 2026",
    author: emma,
    summary: "Links can expire, ask for a password, and hide your filters.",
    intro: "Anyone with a public link can view the dashboard without a Harbor account.",
    steps: [
      "Open the dashboard and choose Share.",
      "Turn on Public link.",
      "Set an expiry date and, if you like, a password.",
      "Copy the link. You can turn it off at any time.",
    ],
    note: "Owners can turn off public links for the whole workspace under Settings, then Security.",
    keywords: "share link public password embed dashboard",
  },
  {
    id: "api-key",
    title: "Create and rotate API keys",
    category: "Developers",
    minutes: 3,
    updated: "Aug 19, 2026",
    author: jasmine,
    summary: "Give each integration its own key and rotate it without downtime.",
    intro: "Keys belong to the workspace, not to a person, so they keep working when someone leaves.",
    steps: [
      "Open Settings, then API keys, and choose Create key.",
      "Name it after the integration and pick its scopes.",
      "Copy the secret now. It is shown only once.",
      "To rotate, create a new key, update the integration, then revoke the old one.",
    ],
    note: "Keys that haven’t been used for 90 days are flagged in the list.",
    keywords: "api key token secret developer rotate revoke integration",
  },
];

/** What the help center shows before anyone types: the five articles people open most. */
export const popularArticleIds = ["export-missing", "schedule-export", "okta-sso", "roles", "change-plan"];

/** Questions the widget offers once the conversation has started. */
export const defaultSuggestions = ["Our Churned accounts export didn’t arrive", "Can we add two more seats?"];

/** The page behind the widget, so the floating launcher has something to sit over. */
export const demoExports: DemoExport[] = [
  { name: "Weekly revenue summary", detail: "PDF · Mondays at 6:00", status: "Delivered Sep 21", ok: true },
  { name: "Churned accounts", detail: "CSV · Daily at 6:00", status: "Paused Sep 21", ok: false },
  { name: "Wholesale orders", detail: "CSV · Fridays at 6:00", status: "Delivered Sep 18", ok: true },
  { name: "Board metrics pack", detail: "PDF · 1st of the month", status: "Delivered Sep 1", ok: true },
];
