"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Blocks,
  BookOpen,
  ChartNoAxesColumn,
  CodeXml,
  FileText,
  LifeBuoy,
  Map as MapIcon,
  MessagesSquare,
  Newspaper,
  Rocket,
  ShieldCheck,
  Workflow,
  Wrench,
} from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import {
  MorphNav,
  type MorphNavItem,
  type MorphNavNavigateDetail,
  type MorphNavSearchItem,
} from "./morph-nav";
import styles from "./morph-nav.module.css";

export const meta = "Live · component";

const icon = { strokeWidth: 1.75 } as const;

const CRUMB: Record<string, string> = {
  product: "Product",
  solutions: "Solutions",
  resources: "Resources",
  pricing: "Pricing",
  Product: "Product",
  Solutions: "Solutions",
  Resources: "Resources",
  Company: "Pricing",
};

const CURRENT: Record<string, string> = {
  Product: "product",
  Solutions: "solutions",
  Resources: "resources",
  Company: "pricing",
};

const SEARCH_ITEMS: MorphNavSearchItem[] = [
  {
    label: "Planning",
    description: "Roadmaps, cycles, and dependencies",
    group: "Product",
    icon: <MapIcon {...icon} />,
    keywords: "roadmap cycle sprint",
  },
  {
    label: "Automations",
    description: "Rules that triage, assign, and remind",
    group: "Product",
    icon: <Workflow {...icon} />,
    keywords: "rules workflow",
  },
  {
    label: "Pricing",
    description: "Free, Team at $10, and Enterprise",
    group: "Company",
    icon: <ChartNoAxesColumn {...icon} />,
    keywords: "cost plan billing",
  },
  {
    label: "Documentation",
    description: "Guides and API reference",
    group: "Resources",
    icon: <BookOpen {...icon} />,
    keywords: "api docs help",
  },
  {
    label: "Changelog",
    description: "What shipped this week",
    group: "Resources",
    icon: <Newspaper {...icon} />,
    keywords: "release updates new",
  },
  {
    label: "Integrations",
    description: "GitHub, Slack, Figma, and 60 more",
    group: "Product",
    icon: <Blocks {...icon} />,
    keywords: "github slack figma",
  },
  {
    label: "Security",
    description: "SSO, audit logs, and data residency",
    group: "Product",
    icon: <ShieldCheck {...icon} />,
    keywords: "sso saml soc2 audit",
  },
  {
    label: "Engineering",
    description: "Ship on a steady, visible cadence",
    group: "Solutions",
    icon: <CodeXml {...icon} />,
  },
  {
    label: "Help center",
    description: "Answers from our support team",
    group: "Resources",
    icon: <LifeBuoy {...icon} />,
    keywords: "support contact",
  },
];

const SIZES = [
  { value: "full", label: "Full" },
  { value: "compact", label: "Compact" },
];

/** The installed lucide draws a newer pen-tool; the reference ships the older glyph, so the panel is
 *  path-identical only when this one is inlined (measured: live `M15.707 21.293…`, local
 *  `m18 13-.654-4.736…` inside a 17px box). */
function PenToolIcon() {
  return (
    <svg
      className="lucide lucide-pen-tool"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" />
      <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" />
      <path d="m2.3 2.3 7.286 7.286" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x=".5" y=".5" width="25" height="25" rx="8" fill="currentColor" />
      <path
        d="M8 17.5V8.5h9M8 13h6.5"
        stroke="var(--background)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface Hero {
  label: string;
  section?: string;
}

/**
 * The reference frame mounts the minimal variant (a bare bar over a 440px stage, status line and the
 * bar-size switch), so that is the default here; pass `minimal={false}` for the scrolling page.
 */
export default function MorphNavDemo({ minimal = true }: { minimal?: boolean }) {
  const reduced = useReducedMotion();
  const [hero, setHero] = useState<Hero>({ label: "Plan the quarter without the spreadsheet" });
  const [opened, setOpened] = useState<{ label: string } | null>(null);
  const [compact, setCompact] = useState(false);

  const navigate = (detail: MorphNavNavigateDetail) => {
    setHero(detail);
    setOpened(detail);
  };

  const [items] = useState<MorphNavItem[]>(() => [
    {
      value: "product",
      label: "Product",
      links: [
        {
          label: "Planning",
          description: "Roadmaps, cycles, and dependencies",
          icon: <MapIcon {...icon} />,
        },
        {
          label: "Docs",
          description: "Specs that stay in sync with the work",
          icon: <FileText {...icon} />,
        },
        {
          label: "Insights",
          description: "Cycle time and throughput by team",
          icon: <ChartNoAxesColumn {...icon} />,
        },
        {
          label: "Automations",
          description: "Rules that triage, assign, and remind",
          icon: <Workflow {...icon} />,
        },
        {
          label: "Integrations",
          description: "GitHub, Slack, Figma, and 60 more",
          icon: <Blocks {...icon} />,
        },
        {
          label: "Security",
          description: "SSO, audit logs, and data residency",
          icon: <ShieldCheck {...icon} />,
        },
      ],
      feature: (
        <button
          type="button"
          className={styles.story}
          onClick={() => navigate({ label: "Fieldwork 4.0", section: "product" })}
        >
          <img
            className={styles.storyImage}
            src="/media/specials/morph-nav-studio.jpg"
            alt=""
            width={640}
            height={420}
            sizes="216px"
          />
          <span className={styles.storyTitle}>Fieldwork 4.0 is here</span>
          <span className={styles.storyMeta}>Plan, write, and ship from one place</span>
        </button>
      ),
      footer: (
        <button
          type="button"
          className={styles.footerLink}
          onClick={() => navigate({ label: "Changelog", section: "resources" })}
        >
          <span>Automations can now run on a schedule</span>
          <ArrowRight size={14} {...icon} aria-hidden="true" />
        </button>
      ),
    },
    {
      value: "solutions",
      label: "Solutions",
      columns: 1,
      links: [
        {
          label: "Engineering",
          description: "Ship on a steady, visible cadence",
          icon: <CodeXml {...icon} />,
        },
        {
          label: "Product design",
          description: "Critique, handoff, and QA in one loop",
          icon: <PenToolIcon />,
        },
        {
          label: "Operations",
          description: "Requests with clear owners and dates",
          icon: <Wrench {...icon} />,
        },
        {
          label: "Startups",
          description: "Free for your first year",
          icon: <Rocket {...icon} />,
        },
      ],
      feature: (
        <button
          type="button"
          className={styles.story}
          onClick={() => navigate({ label: "Brightline customer story", section: "solutions" })}
        >
          <img
            className={styles.storyImage}
            src="/media/specials/morph-nav-team.jpg"
            alt=""
            width={640}
            height={420}
            sizes="232px"
          />
          <span className={styles.storyTitle}>How Brightline cut planning time by 40%</span>
          <span className={styles.quoteBy}>
            <img
              className={styles.avatar}
              src="/media/specials/morph-nav-rachel.svg"
              alt=""
              width={48}
              height={48}
            />
            <span>Rachel Adams, VP of Engineering</span>
          </span>
        </button>
      ),
    },
    {
      value: "resources",
      label: "Resources",
      columns: 1,
      links: [
        {
          label: "Documentation",
          description: "Guides and API reference",
          icon: <BookOpen {...icon} />,
        },
        {
          label: "Changelog",
          description: "What shipped this week",
          icon: <Newspaper {...icon} />,
        },
        {
          label: "Community",
          description: "12,400 teams trading notes",
          icon: <MessagesSquare {...icon} />,
        },
        {
          label: "Help center",
          description: "Answers from our support team",
          icon: <LifeBuoy {...icon} />,
        },
      ],
      feature: (
        <button
          type="button"
          className={styles.story}
          onClick={() => navigate({ label: "A calm planning week", section: "resources" })}
        >
          <img
            className={styles.storyImage}
            src="/media/specials/morph-nav-guide.jpg"
            alt=""
            width={640}
            height={420}
            sizes="232px"
          />
          <span className={styles.storyTitle}>A calm planning week</span>
          <span className={styles.storyMeta}>Guide · 12 min read</span>
        </button>
      ),
    },
    { value: "pricing", label: "Pricing" },
  ]);

  const current = hero.section ? CURRENT[hero.section] ?? hero.section : undefined;
  const crumb = hero.section ? CRUMB[hero.section] ?? hero.section : undefined;

  const bar = (
    <MorphNav
      items={items}
      brand={{ name: "Fieldwork", mark: <BrandMark /> }}
      current={current}
      compact={compact}
      search={{ placeholder: "Search Fieldwork", items: SEARCH_ITEMS }}
      action={{ label: "Start free", onClick: () => navigate({ label: "Create your workspace" }) }}
      onNavigate={navigate}
      label="Fieldwork"
      collapseBelow={620}
    />
  );

  if (minimal) {
    return (
      <div className={styles.minimalDemo}>
        <div className={`${styles.stage} ${styles.minimal}`}>
          <div className={styles.navSlot}>{bar}</div>
        </div>
        <p className={styles.status} aria-live="polite">
          {opened ? `Opened ${opened.label}` : "Hover a section or press search"}
        </p>
        <SegmentedControl
          label="Bar size"
          options={SIZES}
          value={compact ? "compact" : "full"}
          onValueChange={(value) => setCompact(value === "compact")}
        />
      </div>
    );
  }

  return (
    <div className={styles.stage}>
      <div
        className={styles.viewport}
        onScroll={(event) => {
          const scrolled = event.currentTarget.scrollTop > 24;
          if (scrolled !== compact) setCompact(scrolled);
        }}
      >
        <div className={styles.navSlot}>{bar}</div>
        <main className={styles.page}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.header
              key={`${hero.section}-${hero.label}`}
              className={styles.hero}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: 0.14 } }
              }
              transition={reduced ? { duration: 0.15 } : motionTokens.spring.smooth}
            >
              {hero.section && <p className={styles.crumb}>{crumb}</p>}
              <h3 className={styles.title}>{hero.label}</h3>
              <p className={styles.lede}>
                {hero.section
                  ? hero.label
                  : "Fieldwork keeps roadmaps, specs, and status in one calm workspace."}
              </p>
            </motion.header>
          </AnimatePresence>
          <div className={styles.grid}>
            <section className={styles.block}>
              <h4>Roadmaps that stay honest</h4>
              <p>Cycles close on their own dates, and slipped work carries its history with it.</p>
            </section>
            <section className={styles.block}>
              <h4>Specs next to the work</h4>
              <p>Docs link to the issues they describe, so a changed scope shows up in both.</p>
            </section>
            <section className={styles.block}>
              <h4>Status without meetings</h4>
              <p>Weekly updates draft themselves from what actually moved.</p>
            </section>
            <section className={styles.block}>
              <h4>Built for large teams</h4>
              <p>SSO, audit logs, and granular roles for teams of 50 to 5,000.</p>
            </section>
          </div>
          <div className={styles.spacer} aria-hidden="true" />
        </main>
      </div>
    </div>
  );
}
