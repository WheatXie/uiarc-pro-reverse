"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, LayoutGroup, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  Calendar,
  LoaderCircle,
  MapPin,
  Link2,
  MessageSquare,
  Plus,
  Rocket,
  Share2,
  Star,
  ThumbsUp,
  X,
} from "lucide-react";
import { ArcImage } from "../lib/arc-provider";
import { avatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./profile-page.module.css";

/** A person's public profile details, the shape the edit sheet writes back. */
export interface ProfileDetails {
  name: string;
  handle: string;
  headline: string;
  location: string;
  website: string;
  bio: string;
  /** Avatar image URL. Without one the first letter of `name` is used. */
  avatar?: string;
  /** Cover image URL, cropped to the header band. */
  cover?: string;
  /** Human-readable join date, such as "March 2021". */
  joined: string;
}

/** One number in the stats row, formatted with `Intl.NumberFormat`. */
export interface ProfileStat {
  id: string;
  label: string;
  value: number;
}

export type ProfileActivityKind = "shipped" | "commented" | "reviewed" | "created" | "starred";

/** One line in the activity timeline. Items are grouped by `group`, in first-seen order. */
export interface ProfileActivity {
  id: string;
  kind: ProfileActivityKind;
  /** Verb shown before the target, such as "shipped" or "commented on". */
  action: string;
  target: string;
  /** Optional second line with the comment or summary. */
  detail?: string;
  /** Short relative or absolute timestamp, such as "2h" or "Sep 12". */
  time: string;
  group: string;
}

/** A collaborator face in a project card. */
export interface ProfileCollaborator {
  name: string;
  avatar?: string;
}

/** One card in the projects tab. */
export interface ProfileProject {
  id: string;
  name: string;
  description: string;
  cover?: string;
  /** Human-readable freshness, such as "Updated 2h ago". */
  updated: string;
  stars: number;
  starred?: boolean;
  visibility: "Public" | "Private";
  collaborators: ProfileCollaborator[];
}

export type ProfileTab = "activity" | "projects";

export interface ProfilePageProps {
  /** Profile details. Defaults to a sample profile. */
  profile?: ProfileDetails;
  /** Stats row values. */
  stats?: ProfileStat[];
  /** Timeline entries for the activity tab. */
  activity?: ProfileActivity[];
  /** Cards for the projects tab. */
  projects?: ProfileProject[];
  /** Controlled tab. Leave undefined to let the component manage it. */
  tab?: ProfileTab;
  /** Tab shown on first render when uncontrolled. Defaults to "activity". */
  defaultTab?: ProfileTab;
  /** Called whenever the active tab changes. */
  onTabChange?: (tab: ProfileTab) => void;
  /** Called with the next details when the sheet is submitted. Throw to keep the sheet open and show the message. */
  onSave?: (next: ProfileDetails) => void | Promise<void>;
  /** Called with the new state when a project star is toggled. */
  onStarChange?: (id: string, starred: boolean) => void;
  /** URL copied by the Share button. Defaults to `https://northwind.app/@<handle>`. */
  profileUrl?: string;
  /** Renders the "Edit profile" button and the edit sheet. Defaults to true. */
  editable?: boolean;
  className?: string;
}

const sampleProfile: ProfileDetails = {
  name: "Jasmine Brooks",
  handle: "jasmine",
  headline: "Design lead at Northwind",
  location: "Lisbon, Portugal",
  website: "jasminebrooks.design",
  bio: "I lead the design system team and care about calm interfaces, clear writing, and tools that stay out of the way. Previously at Linear and Figma.",
  avatar: avatar("jasmine-brooks"),
  cover: "/media/photos/lisbon-rooftops.jpg",
  joined: "March 2021",
};

const sampleStats: ProfileStat[] = [
  { id: "followers", label: "Followers", value: 2418 },
  { id: "following", label: "Following", value: 186 },
  { id: "shipped", label: "Shipped", value: 37 },
];

const collaborators: Record<string, ProfileCollaborator> = {
  emma: { name: "Emma Collins", avatar: avatar("emma-collins") },
  marcus: { name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
  chloe: { name: "Chloe Nguyen", avatar: avatar("chloe-nguyen") },
  daniel: { name: "Daniel Kim", avatar: avatar("daniel-kim") },
  olivia: { name: "Olivia Bennett", avatar: avatar("olivia-bennett") },
};

const sampleActivity: ProfileActivity[] = [
  {
    id: "a1",
    kind: "shipped",
    action: "shipped",
    target: "Tokens v4",
    detail: "Semantic color roles, dark mode surfaces, and new spacing steps.",
    time: "2h",
    group: "This week",
  },
  {
    id: "a2",
    kind: "commented",
    action: "commented on",
    target: "Checkout empty states",
    detail: "Let us keep the illustration out and lead with the action.",
    time: "Yesterday",
    group: "This week",
  },
  {
    id: "a3",
    kind: "reviewed",
    action: "approved",
    target: "Table density toggle",
    time: "Tue",
    group: "This week",
  },
  {
    id: "a4",
    kind: "created",
    action: "created",
    target: "Onboarding audit",
    detail: "A shared board for the first run review with research notes.",
    time: "Mon",
    group: "This week",
  },
  {
    id: "a5",
    kind: "starred",
    action: "starred",
    target: "Motion guidelines",
    time: "Sep 12",
    group: "Earlier",
  },
  {
    id: "a6",
    kind: "shipped",
    action: "shipped",
    target: "Icon set 2.0",
    detail: "412 icons redrawn on a 1.75px stroke.",
    time: "Sep 8",
    group: "Earlier",
  },
  {
    id: "a7",
    kind: "commented",
    action: "commented on",
    target: "Billing settings",
    time: "Sep 3",
    group: "Earlier",
  },
];

const sampleProjects: ProfileProject[] = [
  {
    id: "p1",
    name: "Northwind design system",
    description: "Tokens, components, and guidance used by every product team.",
    cover: "/media/photos/curved-facade.jpg",
    updated: "Updated 2h ago",
    stars: 342,
    starred: true,
    visibility: "Public",
    collaborators: [collaborators.emma, collaborators.marcus, collaborators.chloe],
  },
  {
    id: "p2",
    name: "Onboarding audit",
    description: "Research notes and flows for the new first run experience.",
    cover: "/media/photos/sunroom.jpg",
    updated: "Updated Monday",
    stars: 28,
    visibility: "Private",
    collaborators: [collaborators.daniel, collaborators.olivia],
  },
  {
    id: "p3",
    name: "Motion guidelines",
    description: "When things move, how fast, and why. Springs, easing, and reduced motion.",
    cover: "/media/photos/terracotta-waves.jpg",
    updated: "Updated Sep 12",
    stars: 191,
    visibility: "Public",
    collaborators: [collaborators.chloe],
  },
  {
    id: "p4",
    name: "Icon set 2.0",
    description: "A redrawn icon family on a consistent stroke and grid.",
    cover: "/media/photos/concert-hall.jpg",
    updated: "Updated Sep 8",
    stars: 87,
    visibility: "Public",
    collaborators: [collaborators.marcus, collaborators.emma],
  },
];

const editableFields = ["name", "headline", "location", "website", "bio"] as const;
const numberFormat = new Intl.NumberFormat("en-US");
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];
const noMotion = { duration: 0 };

const eventIcons: Record<ProfileActivityKind, ReactNode> = {
  shipped: <Rocket size={15} strokeWidth={1.75} />,
  commented: <MessageSquare size={15} strokeWidth={1.75} />,
  created: <Plus size={15} strokeWidth={1.75} />,
  reviewed: <ThumbsUp size={15} strokeWidth={1.75} />,
  starred: <Star size={15} strokeWidth={1.75} />,
};

/**
 * Keeps three labels stacked in one grid cell and animates the container width to whichever one is
 * visible, so the button does not jump when "Share" becomes "Copied".
 */
function CopyStack({ shown, reduced, children }: { shown: number; reduced: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    const spans = Array.from(ref.current?.children ?? []);
    const measure = () => setWidths(spans.map((span) => (span as HTMLElement).offsetWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    spans.forEach((span) => observer.observe(span));
    return () => observer.disconnect();
  }, []);
  const target = widths[shown];
  const width = useMotionValue<string | number>("auto");
  const seen = useRef(false);
  useLayoutEffect(() => {
    if (!target) return;
    if (!seen.current || reduced) {
      seen.current = true;
      width.jump(target);
      return;
    }
    const controls = animate(width, target, { type: "spring", visualDuration: 0.22, bounce: 0 });
    return () => controls.stop();
  }, [target, reduced, width]);
  return (
    <motion.span ref={ref} className={styles.copyStack} style={{ width }}>
      {children}
    </motion.span>
  );
}

/** The check that draws itself once the URL is on the clipboard. */
function CopiedCheck({ on, reduced }: { on: boolean; reduced: boolean }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M4 12l5 5L20 6"
        initial={false}
        animate={{ pathLength: on || reduced ? 1 : 0 }}
        transition={on ? { duration: 0.22, ease: [...motionTokens.ease.standard], delay: 0.04 } : { duration: 0, delay: 0.12 }}
      />
    </svg>
  );
}

/**
 * Profile page — cover, avatar, bio, stats, activity and project tabs, plus an edit sheet that
 * writes back into the page. Panels crossfade under a shared underline; the sheet slides in over a
 * scrim and traps focus until it closes.
 */
export function ProfilePage({
  profile: profileProp = sampleProfile,
  stats = sampleStats,
  activity = sampleActivity,
  projects = sampleProjects,
  tab,
  defaultTab = "activity",
  onTabChange,
  onSave,
  onStarChange,
  profileUrl,
  editable = true,
  className,
}: ProfilePageProps) {
  const reduced = !!useReducedMotion();
  const uid = useId();
  const [profile, setProfile] = useState(profileProp);
  const [ownTab, setOwnTab] = useState<ProfileTab>(defaultTab);
  const activeTab = tab ?? ownTab;
  const [editing, setEditing] = useState(false);
  const [flashed, setFlashed] = useState<string[]>([]);
  const [stars, setStars] = useState<Record<string, { on: boolean; count: number }>>(() =>
    Object.fromEntries(projects.map((project) => [project.id, { on: !!project.starred, count: project.stars }])),
  );
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const editButton = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const tabRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({ activity: null, projects: null });
  const panelContent = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | "auto">("auto");

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const node = panelContent.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setPanelHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const selectTab = (next: ProfileTab) => {
    if (tab === undefined) setOwnTab(next);
    onTabChange?.(next);
  };

  const copyUrl = profileUrl ?? `https://northwind.app/@${profile.handle}`;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
    later(() => setShareState("idle"), 1800);
  };

  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const save = async (next: ProfileDetails) => {
    if (onSave) await onSave(next);
    else await new Promise((resolve) => setTimeout(resolve, 700));
    const changed = editableFields.filter((field) => next[field] !== profile[field]);
    setProfile(next);
    setFlashed(changed);
    later(() => setFlashed([]), 1600);
    close();
  };

  const flashFor = (field: string) => (flashed.includes(field) ? styles.flash : undefined);
  const groups = [...new Set(activity.map((item) => item.group))];
  const tabs: { id: ProfileTab; label: string; count: number }[] = [
    { id: "activity", label: "Activity", count: activity.length },
    { id: "projects", label: "Projects", count: projects.length },
  ];

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: ProfileTab = activeTab === "activity" ? "projects" : "activity";
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <div className={styles.page} data-editing={editing || undefined}>
        <div className={styles.cover}>
          {profile.cover ? <ArcImage src={profile.cover} alt="" fill sizes="(max-width: 980px) 100vw, 980px" priority /> : null}
        </div>
        <header className={styles.identity}>
          <div className={styles.avatar}>
            {profile.avatar ? (
              <ArcImage src={profile.avatar} alt={profile.name} fill sizes="96px" />
            ) : (
              <span aria-hidden="true">{profile.name.slice(0, 1)}</span>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={share} aria-live="polite">
              <CopyStack shown={shareState === "copied" ? 1 : shareState === "failed" ? 2 : 0} reduced={reduced}>
                <span data-shown={shareState === "idle"}>
                  <Share2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  Share
                </span>
                <span data-shown={shareState === "copied"}>
                  <CopiedCheck on={shareState === "copied"} reduced={reduced} />
                  Copied
                </span>
                <span data-shown={shareState === "failed"}>
                  <X size={15} strokeWidth={1.75} aria-hidden="true" />
                  Failed
                </span>
              </CopyStack>
            </button>
            {editable ? (
              <button ref={editButton} type="button" className={styles.primary} onClick={() => setEditing(true)} aria-haspopup="dialog" aria-expanded={editing}>
                Edit profile
              </button>
            ) : null}
          </div>
          <div className={styles.names}>
            <h2 className={flashFor("name")}>{profile.name}</h2>
            <p>
              <span>@{profile.handle}</span>
              <span aria-hidden="true">·</span>
              <span className={flashFor("headline")}>{profile.headline}</span>
            </p>
          </div>
        </header>
        <div className={styles.body}>
          <aside className={styles.about} aria-label="About">
            {profile.bio ? <p className={[styles.bio, flashFor("bio")].filter(Boolean).join(" ")}>{profile.bio}</p> : null}
            <ul className={styles.meta}>
              {profile.location ? (
                <li className={flashFor("location")}>
                  <MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
                  {profile.location}
                </li>
              ) : null}
              {profile.website ? (
                <li className={flashFor("website")}>
                  <Link2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  <a href={`https://${profile.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ) : null}
              <li>
                <Calendar size={15} strokeWidth={1.75} aria-hidden="true" />
                Joined {profile.joined}
              </li>
            </ul>
            <dl className={styles.stats}>
              {stats.map((stat) => (
                <div key={stat.id}>
                  <dt>{stat.label}</dt>
                  <dd>{numberFormat.format(stat.value)}</dd>
                </div>
              ))}
            </dl>
          </aside>
          <section className={styles.main} aria-label="Profile content">
            <LayoutGroup id={uid}>
              <div className={styles.tabs} role="tablist" aria-label="Profile sections" onKeyDown={onTabKeyDown}>
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    ref={(node) => {
                      tabRefs.current[item.id] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`${uid}-${item.id}-tab`}
                    aria-selected={activeTab === item.id}
                    aria-controls={`${uid}-panel`}
                    tabIndex={activeTab === item.id ? 0 : -1}
                    className={styles.tab}
                    onClick={() => selectTab(item.id)}
                  >
                    {item.label}
                    <span className={styles.tabCount}>{item.count}</span>
                    {activeTab === item.id ? (
                      <motion.span layoutId="underline" className={styles.underline} transition={reduced ? noMotion : motionTokens.spring.morph} />
                    ) : null}
                  </button>
                ))}
              </div>
            </LayoutGroup>
            <motion.div
              id={`${uid}-panel`}
              role="tabpanel"
              aria-labelledby={`${uid}-${activeTab}-tab`}
              className={styles.panel}
              initial={false}
              animate={{ height: panelHeight }}
              transition={reduced ? noMotion : motionTokens.spring.smooth}
            >
              <div ref={panelContent} className={styles.panelContent}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: reduced ? 0 : motionTokens.duration.instant } }}
                    transition={reduced ? noMotion : { duration: motionTokens.duration.standard, ease: enterEase }}
                  >
                    {activeTab === "activity" ? (
                      <div className={styles.activity}>
                        {groups.map((group) => (
                          <div key={group} className={styles.group}>
                            <h3>{group}</h3>
                            <ol>
                              {activity
                                .filter((item) => item.group === group)
                                .map((item) => (
                                  <li key={item.id} className={styles.event}>
                                    <span className={styles.eventIcon} data-kind={item.kind} aria-hidden="true">
                                      {eventIcons[item.kind]}
                                    </span>
                                    <div className={styles.eventText}>
                                      <p>
                                        <span className={styles.muted}>
                                          {profile.name.split(" ")[0]} {item.action}
                                        </span>{" "}
                                        {item.target}
                                      </p>
                                      {item.detail ? <p className={styles.eventDetail}>{item.detail}</p> : null}
                                    </div>
                                    <time className={styles.time}>{item.time}</time>
                                  </li>
                                ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ul className={styles.projects}>
                        {projects.map((project) => {
                          const state = stars[project.id];
                          return (
                            <li key={project.id} className={styles.project}>
                              <div className={styles.projectCover}>
                                {project.cover ? <ArcImage src={project.cover} alt="" fill sizes="(max-width: 640px) 100vw, 320px" /> : null}
                              </div>
                              <div className={styles.projectBody}>
                                <div className={styles.projectHead}>
                                  <h4>{project.name}</h4>
                                  <span className={styles.visibility}>{project.visibility}</span>
                                </div>
                                <p>{project.description}</p>
                                <div className={styles.projectFoot}>
                                  <span className={styles.faces}>
                                    {project.collaborators.map((face) => (
                                      <span key={face.name} className={styles.face} title={face.name}>
                                        {face.avatar ? <ArcImage src={face.avatar} alt={face.name} fill sizes="22px" /> : face.name[0]}
                                      </span>
                                    ))}
                                  </span>
                                  <span className={styles.updated}>{project.updated}</span>
                                  <button
                                    type="button"
                                    className={styles.star}
                                    data-on={state.on}
                                    aria-pressed={state.on}
                                    aria-label={`${state.on ? "Unstar" : "Star"} ${project.name}, ${state.count} stars`}
                                    onClick={() => {
                                      const id = project.id;
                                      const next = !stars[id].on;
                                      setStars({
                                        ...stars,
                                        [id]: { on: next, count: stars[id].count + (next ? 1 : -1) },
                                      });
                                      onStarChange?.(id, next);
                                    }}
                                  >
                                    <motion.span
                                      key={String(state.on)}
                                      className={styles.starIcon}
                                      initial={!reduced && state.on ? { scale: 0.6 } : false}
                                      animate={{ scale: 1 }}
                                      transition={reduced ? noMotion : motionTokens.spring.snappy}
                                    >
                                      <Star size={14} strokeWidth={1.75} aria-hidden="true" />
                                    </motion.span>
                                    <span className={styles.starCount}>{numberFormat.format(state.count)}</span>
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
      <AnimatePresence>{editing ? <EditSheet key="sheet" initial={profile} reduced={reduced} onClose={close} onSave={save} /> : null}</AnimatePresence>
    </div>
  );
}

/** One labelled control in the edit sheet, with its validation message. */
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={styles.field} data-invalid={!!error || undefined}>
      <div className={styles.fieldHead}>
        <label htmlFor={id}>{label}</label>
        {hint ? <span>{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const websitePattern = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/;

/**
 * The edit sheet. Keeps its own draft so Cancel is free, validates on submit, and only hands the
 * result back through `onSave`; a thrown error surfaces in the footer and keeps the sheet open.
 */
function EditSheet({
  initial,
  reduced,
  onClose,
  onSave,
}: {
  initial: ProfileDetails;
  reduced: boolean;
  onClose: () => void;
  onSave: (next: ProfileDetails) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [formError, setFormError] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    const frame = requestAnimationFrame(() => nameInput.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dirty = editableFields.some((field) => draft[field] !== initial[field]);
  const nameError = draft.name.trim() ? undefined : "Add your name";
  const websiteError = draft.website && !websitePattern.test(draft.website.trim()) ? "Use a domain like example.com" : undefined;
  const invalid = !!(nameError || websiteError);

  const change = (field: keyof ProfileDetails) => (event: { target: { value: string } }) => {
    setDraft({ ...draft, [field]: field === "bio" ? event.target.value.slice(0, 200) : event.target.value });
    setFormError(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRevealed(true);
    if (invalid || !dirty || status === "saving") return;
    setStatus("saving");
    try {
      await onSave({ ...draft, name: draft.name.trim(), website: draft.website.trim() });
    } catch (error) {
      setStatus("idle");
      setFormError(error instanceof Error ? error.message : "Could not save. Try again.");
    }
  };

  return (
    <>
      <motion.div
        className={styles.scrim}
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionTokens.duration.standard, ease: standardEase }}
      />
      <motion.form
        ref={formRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab" || !formRef.current) return;
          const focusable = [...formRef.current.querySelectorAll<HTMLElement>("input, textarea, button:not(:disabled)")];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        noValidate
        initial={reduced ? { opacity: 0 } : { x: "100%" }}
        animate={{ x: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0, transition: { duration: motionTokens.duration.fast } } : { x: "100%", transition: { duration: motionTokens.duration.exit + 0.06, ease: standardEase } }}
        transition={reduced ? { duration: motionTokens.duration.fast } : motionTokens.spring.smooth}
      >
        <div className={styles.sheetHead}>
          <h3 id={titleId}>Edit profile</h3>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className={styles.sheetBody}>
          <Field id={`${fieldId}-name`} label="Name" error={revealed ? nameError : undefined}>
            <input
              ref={nameInput}
              id={`${fieldId}-name`}
              value={draft.name}
              onChange={change("name")}
              autoComplete="name"
              aria-invalid={revealed && !!nameError}
              aria-describedby={revealed && nameError ? `${fieldId}-name-error` : undefined}
            />
          </Field>
          <Field id={`${fieldId}-headline`} label="Headline">
            <input id={`${fieldId}-headline`} value={draft.headline} onChange={change("headline")} />
          </Field>
          <div className={styles.pair}>
            <Field id={`${fieldId}-location`} label="Location">
              <input id={`${fieldId}-location`} value={draft.location} onChange={change("location")} />
            </Field>
            <Field id={`${fieldId}-website`} label="Website" error={revealed ? websiteError : undefined}>
              <input
                id={`${fieldId}-website`}
                value={draft.website}
                onChange={change("website")}
                inputMode="url"
                aria-invalid={revealed && !!websiteError}
                aria-describedby={revealed && websiteError ? `${fieldId}-website-error` : undefined}
              />
            </Field>
          </div>
          <Field id={`${fieldId}-bio`} label="Bio" hint={`${200 - draft.bio.length} left`}>
            <textarea id={`${fieldId}-bio`} value={draft.bio} onChange={change("bio")} rows={5} />
          </Field>
        </div>
        <div className={styles.sheetFoot}>
          <AnimatePresence initial={false}>
            {formError ? (
              <motion.p role="alert" className={styles.formError} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {formError}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primary} disabled={!dirty || status === "saving"} aria-disabled={invalid || undefined}>
            <span className={styles.stack}>
              <span data-shown={status === "idle"}>Save changes</span>
              <span data-shown={status === "saving"}>
                <LoaderCircle size={15} strokeWidth={1.75} className={styles.spin} aria-hidden="true" />
                Saving
              </span>
            </span>
          </button>
        </div>
      </motion.form>
    </>
  );
}

export default ProfilePage;
