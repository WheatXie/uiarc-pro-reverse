"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion, type Transition } from "motion/react";
import { ArrowUp, Check, CircleAlert, CircleCheck, GripVertical, ListTodo, Pencil, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./task-breakdown.module.css";

/* ------------------------------------------------------------------ types */

/** Someone a task can be assigned to. */
export interface TaskOwner {
  /** Stable person id, referenced by a draft's `ownerId`. */
  id: string;
  /** Full name, shown in the row tooltip and to screen readers. */
  name: string;
  /** Portrait URL; initials are drawn when it is missing. */
  avatar?: string;
}

/** One task in the plan. The array order is the list order. */
export interface TaskDraft {
  /** Stable id, referenced by other tasks in `dependsOn`. */
  id: string;
  /** What the task is. */
  title: string;
  /** Work in working days, in steps of 0.5. */
  estimate: number;
  /** Owner id; unassigned when missing. */
  ownerId?: string;
  /** Ids of the tasks that must finish first. */
  dependsOn?: string[];
}

/** A tracker the plan can be sent to. */
export type TaskTarget = "linear" | "jira";

export interface TaskBreakdownProps {
  /** Goal shown in the input on first render. */
  defaultGoal?: string;
  /** Tasks to open with. The block then starts ready and does not auto start. */
  defaultTasks?: readonly TaskDraft[];
  /** People tasks can be assigned to. */
  owners?: readonly TaskOwner[];
  /** Breaks a goal into tasks. Rows stream in as soon as it resolves. */
  generate?: (goal: string, signal: AbortSignal) => Promise<TaskDraft[]>;
  /** Rewrites one task. Return the fields to replace; the id and, unless returned, dependencies are kept. */
  regenerate?: (task: TaskDraft, context: { goal: string; tasks: TaskDraft[] }, signal: AbortSignal) => Promise<Partial<Omit<TaskDraft, "id">>>;
  /** Creates one issue, called once per task in list order. A rejection marks that row failed. */
  createIssue?: (target: TaskTarget, task: TaskDraft, signal: AbortSignal) => Promise<{ key: string; url: string }>;
  /** Trackers offered in the footer. The first one is the primary button. */
  targets?: readonly TaskTarget[];
  /** First working day of the plan. Weekends are skipped. */
  startDate?: Date | string;
  /** Ship-by date, drawn as the marker and used for the early or late label. */
  deadline?: Date | string;
  /** Model named in the footer next to the Claude mark. */
  model?: string;
  /** Run the breakdown once when the block scrolls into view. */
  autoStart?: boolean;
  /** Called after every edit, reorder or regeneration. */
  onTasksChange?: (tasks: TaskDraft[]) => void;
  /** Called once every task has an issue, keyed by task id. */
  onSent?: (target: TaskTarget, issues: Record<string, { key: string; url: string }>) => void;
  /** Class on the root card. */
  className?: string;
}

/* ------------------------------------------------------------------- data */

const demoGoal = "Launch usage-based billing by Dec 1";

const demoOwners: readonly TaskOwner[] = [
  { id: "andre", name: "Andre Williams", avatar: "/media/people/andre-williams.svg" },
  { id: "daniel", name: "Daniel Kim", avatar: "/media/people/daniel-kim.svg" },
  { id: "olivia", name: "Olivia Bennett", avatar: "/media/people/olivia-bennett.svg" },
  { id: "marcus", name: "Marcus Johnson", avatar: "/media/people/marcus-johnson.svg" },
  { id: "chloe", name: "Chloe Nguyen", avatar: "/media/people/chloe-nguyen.svg" },
  { id: "ava", name: "Ava Mitchell", avatar: "/media/people/ava-mitchell.svg" },
  { id: "sofia", name: "Sofia Ramirez", avatar: "/media/people/sofia-ramirez.svg" },
];

const demoTasks: readonly TaskDraft[] = [
  { id: "t1", title: "Define billable metrics and price tiers with finance", estimate: 2, ownerId: "andre" },
  { id: "t2", title: "Emit usage events from the API gateway", estimate: 5, ownerId: "daniel", dependsOn: ["t1"] },
  { id: "t3", title: "Create Stripe meters and metered prices", estimate: 3, ownerId: "olivia", dependsOn: ["t1"] },
  { id: "t4", title: "Build the usage page in billing settings", estimate: 6, ownerId: "marcus", dependsOn: ["t2"] },
  { id: "t5", title: "Backfill October usage and reconcile invoices", estimate: 3, ownerId: "chloe", dependsOn: ["t2", "t3"] },
  { id: "t6", title: "Update the pricing page and customer emails", estimate: 2, ownerId: "ava", dependsOn: ["t1"] },
  { id: "t7", title: "Dry-run a billing cycle on 20 accounts", estimate: 3, ownerId: "sofia", dependsOn: ["t4", "t5"] },
];

/** The simulated rewrite for each sample task, cycled one at a time. */
const variants: Record<string, Partial<Omit<TaskDraft, "id">>[]> = {
  t1: [{ title: "Agree on metered units and overage pricing", estimate: 1.5, ownerId: "andre" }],
  t2: [{ title: "Stream metered API calls to the usage pipeline", estimate: 4, ownerId: "daniel" }],
  t3: [{ title: "Map plans to Stripe meters with a sandbox test", estimate: 2.5, ownerId: "olivia" }],
  t4: [{ title: "Ship a live usage chart with spend alerts", estimate: 5, ownerId: "marcus" }],
  t5: [{ title: "Replay October events and diff against invoices", estimate: 4, ownerId: "chloe" }],
  t6: [{ title: "Announce the new pricing to existing workspaces", estimate: 1.5, ownerId: "ava" }],
  t7: [{ title: "Shadow-bill 20 accounts and review every invoice", estimate: 2, ownerId: "sofia" }],
};

/** Simulated issue numbering per tracker. */
const trackers: Record<TaskTarget, { prefix: string; first: number; url: (key: string) => string }> = {
  linear: { prefix: "BIL", first: 241, url: key => `https://linear.app/northwind/issue/${key}` },
  jira: { prefix: "PAY", first: 318, url: key => `https://northwind.atlassian.net/browse/${key}` },
};

const targetNames: Record<TaskTarget, string> = { linear: "Linear", jira: "Jira" };

/* ---------------------------------------------------------------- helpers */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SETTLE: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const FLING = { bounceStiffness: 700, bounceDamping: 60 };
const SKELETON_WIDTHS = [72, 54, 64, 48, 68, 58, 44];
const ROW_HEIGHT = 44;

const cx = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).join(" ");

/** Snapshot of the 7 reserved rows so the card never changes height. */
const RESERVED_ROWS = 7;

/** Whether a date is a weekday. */
const isWorkday = (date: Date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;

/** UTC midnight of the date's local year, month and day. */
function dayStart(input: Date | string) {
  const date = new Date(input);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** Adds working days, skipping weekends. Always advances at least one day. */
function addWorkdays(from: Date | string, days: number) {
  let date = dayStart(from);
  let left = Math.max(1, Math.ceil(days));
  for (;;) {
    if (isWorkday(date)) left -= 1;
    if (left <= 0) return date;
    date = new Date(date.getTime() + 86_400_000);
  }
}

/** "Nov 17" for a date, read in UTC so the label never shifts with the visitor's zone. */
const formatDate = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "2d" or "1.5d". */
const formatEffort = (days: number) => `${Number.isInteger(days) ? days : days.toFixed(1)}d`;

/** Working days between two dates, inclusive. */
function workdaysBetween(from: Date | string, to: Date | string) {
  let count = 0;
  for (let stamp = dayStart(from).getTime(); stamp <= dayStart(to).getTime(); stamp += 86_400_000) {
    if (isWorkday(new Date(stamp))) count += 1;
  }
  return count;
}

/**
 * Walks the dependency graph once and returns each task's earliest start and finish in days, the
 * whole plan's critical path and its length. Missing or circular dependencies are treated as free.
 */
function schedule(tasks: readonly TaskDraft[]) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const start = new Map<string, number>();
  const finish = new Map<string, number>();
  const previous = new Map<string, string | undefined>();
  const visiting = new Set<string>();

  const walk = (id: string): number => {
    const cached = finish.get(id);
    if (cached !== undefined) return cached;
    const task = byId.get(id);
    if (!task || visiting.has(id)) return 0;
    visiting.add(id);
    let latest = 0;
    let from: string | undefined;
    for (const dependency of task.dependsOn ?? []) {
      if (!byId.has(dependency)) continue;
      const end = walk(dependency);
      if (end > latest) {
        latest = end;
        from = dependency;
      }
    }
    visiting.delete(id);
    start.set(id, latest);
    finish.set(id, latest + task.estimate);
    previous.set(id, from);
    return latest + task.estimate;
  };

  tasks.forEach(task => walk(task.id));

  let span = 0;
  let end: string | undefined;
  for (const task of tasks) {
    const candidate = finish.get(task.id) ?? 0;
    if (candidate > span) {
      span = candidate;
      end = task.id;
    }
  }

  const critical: string[] = [];
  for (let id = end; id; id = previous.get(id)) critical.unshift(id);

  return { span, effort: tasks.reduce((total, task) => total + task.estimate, 0), start, finish, critical };
}

/** A number, label or mark that crossfades in place when its key changes. */
function Swap({
  swapKey,
  children,
  className,
  reduced,
}: {
  swapKey: string | number;
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE } }}
          exit={{ opacity: 0, y: 0, transition: { duration: 0.1, ease: EASE } }}
          key={swapKey}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A 20px face: the portrait when there is one, initials otherwise. */
function OwnerFace({ owner }: { owner?: TaskOwner }) {
  if (!owner) {
    return (
      <span className={cx(styles.avatar, styles.avatarEmpty)} title="Unassigned">
        <span className={styles.srOnly}>Unassigned</span>
      </span>
    );
  }
  const initials = owner.name
    .split(" ")
    .map(part => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span className={styles.avatar} title={owner.name}>
      {owner.avatar ? <img src={owner.avatar} alt="" draggable={false} /> : <span aria-hidden="true">{initials}</span>}
      <span className={styles.srOnly}>Owner {owner.name}</span>
    </span>
  );
}

/** The Claude mark used in the footer. */
function ClaudeMark({ className, ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Claude" {...rest} className={className}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/** The Linear mark. */
function LinearMark({ className, ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Linear" {...rest} className={className}>
      <path
        fill="#5E6AD2"
        d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"
      />
    </svg>
  );
}

/** The Jira mark. */
function JiraMark({ className, ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Jira" {...rest} className={className}>
      <path
        fill="var(--tb-jira, #0052CC)"
        d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"
      />
    </svg>
  );
}

/** The tracker's mark, sized by the footer. */
function TargetMark({ target }: { target: TaskTarget }) {
  return target === "linear" ? <LinearMark className={styles.mark} aria-hidden="true" /> : <JiraMark className={styles.mark} aria-hidden="true" />;
}

/* ------------------------------------------------------------------- row */

interface RowProps {
  task: TaskDraft;
  index: number;
  count: number;
  owner?: TaskOwner;
  dep?: { text: string; blocked: boolean };
  revealed: number;
  streaming: boolean;
  busy: boolean;
  locked: boolean;
  editing: boolean;
  issue?: { key: string; url: string } | "creating" | "failed";
  simulated: boolean;
  reduced: boolean;
  onEdit: () => void;
  onSave: (patch: { title: string; estimate: number }) => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onMove: (direction: -1 | 1) => void;
  onHover: (hovering: boolean) => void;
  onRetry: () => void;
  onIssueClick: (key: string) => void;
}

/** One task row: grip, index, title, dependencies, estimate, owner and the action slot. */
function Row({
  task,
  index,
  count,
  owner,
  dep,
  revealed,
  streaming,
  busy,
  locked,
  editing,
  issue,
  simulated,
  reduced,
  onEdit,
  onSave,
  onCancel,
  onRegenerate,
  onMove,
  onHover,
  onRetry,
  onIssueClick,
}: RowProps) {
  const controls = useDragControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ title: task.title, estimate: String(task.estimate) });
  const complete = revealed === Number.POSITIVE_INFINITY;
  const skeleton = revealed === 0;
  const draggable = !locked && !editing && complete;

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const beginEdit = () => {
    setDraft({ title: task.title, estimate: String(task.estimate) });
    onEdit();
  };

  const save = () => {
    const estimate = Math.min(60, Math.max(0.5, Math.round(2 * (Number(draft.estimate) || task.estimate)) / 2));
    onSave({ title: draft.title.trim() || task.title, estimate });
  };

  const onKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  const words = task.title.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  if (!complete && !skeleton) {
    for (let at = 0; at < Math.min(revealed, words.length); at += 3) chunks.push(words.slice(at, at + 3).join(" "));
  }

  let titleNode: ReactNode;
  if (skeleton) titleNode = <span className={styles.skeleton} style={{ width: `${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}%` }} aria-hidden="true" />;
  else if (editing)
    titleNode = (
      <input
        ref={inputRef}
        className={styles.titleInput}
        value={draft.title}
        aria-label={`Task ${index + 1} title`}
        onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
        onKeyDown={onKey}
      />
    );
  else if (complete)
    titleNode = busy ? (
      <span className={styles.titleText}>
        <TextShimmer>{task.title}</TextShimmer>
      </span>
    ) : (
      <Swap swapKey={task.title} reduced={reduced} className={styles.titleSwap}>
        <span className={styles.titleText} onDoubleClick={locked ? undefined : beginEdit}>
          {task.title}
        </span>
      </Swap>
    );
  else
    titleNode = (
      <span className={styles.titleText}>
        {chunks.map((chunk, at) => (
          <span className={styles.chunk} key={at}>
            {at ? " " : ""}
            {chunk}
          </span>
        ))}
      </span>
    );

  let slotKey: string;
  let slot: ReactNode;
  if (issue === "creating") {
    slotKey = "creating";
    slot = (
      <span className={styles.slotStatus}>
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.srOnly}>Creating</span>
      </span>
    );
  } else if (issue === "failed") {
    slotKey = "failed";
    slot = (
      <button type="button" className={cx(styles.iconButton, styles.failed)} onClick={onRetry} aria-label={`Retry creating task ${index + 1}`} title="Failed, retry">
        <CircleAlert aria-hidden="true" />
      </button>
    );
  } else if (issue) {
    slotKey = issue.key;
    slot = (
      <a
        className={styles.issueKey}
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        onClick={
          simulated
            ? event => {
                event.preventDefault();
                onIssueClick(issue.key);
              }
            : undefined
        }
      >
        {issue.key}
      </a>
    );
  } else if (editing) {
    slotKey = "editing";
    slot = (
      <span className={styles.actions} data-visible="true">
        <button type="button" className={styles.iconButton} onMouseDown={event => event.preventDefault()} onClick={save} aria-label="Save task">
          <Check aria-hidden="true" />
        </button>
        <button type="button" className={styles.iconButton} onMouseDown={event => event.preventDefault()} onClick={onCancel} aria-label="Cancel editing">
          <X aria-hidden="true" />
        </button>
      </span>
    );
  } else {
    slotKey = "actions";
    slot = (
      <span className={styles.actions} data-visible={busy || undefined}>
        <button
          type="button"
          className={styles.iconButton}
          disabled={locked || busy || !complete}
          onClick={onRegenerate}
          aria-label={`Regenerate task ${index + 1}`}
          title="Regenerate"
        >
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          disabled={locked || busy || !complete}
          onClick={beginEdit}
          aria-label={`Edit task ${index + 1}`}
          title="Edit"
        >
          <Pencil aria-hidden="true" />
        </button>
      </span>
    );
  }

  const metaVisible = complete || (!skeleton && revealed >= words.length);

  return (
    <Reorder.Item
      as="li"
      value={task}
      dragListener={false}
      dragControls={controls}
      drag={draggable ? "y" : false}
      layout="position"
      className={cx(styles.row, editing && styles.editing, busy && styles.busy)}
      transition={reduced ? { duration: 0 } : SETTLE}
      dragTransition={FLING}
      tabIndex={undefined}
      whileDrag={{ zIndex: 2, boxShadow: "var(--shadow-floating)", backgroundColor: "var(--surface-raised)" }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      aria-busy={busy || (!complete && streaming) || undefined}
    >
      <button
        type="button"
        className={styles.grip}
        data-grip={task.id}
        disabled={!draggable}
        tabIndex={draggable ? 0 : -1}
        aria-label={`Reorder ${task.title}, position ${index + 1} of ${count}. Use the up and down arrow keys.`}
        onPointerDown={event => {
          if (!draggable) return;
          event.preventDefault();
          controls.start(event);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
      >
        <GripVertical aria-hidden="true" />
      </button>
      <span className={styles.index} aria-hidden="true">
        {index + 1}
      </span>
      <span className={styles.title}>{titleNode}</span>
      <motion.span
        className={styles.meta}
        initial={false}
        animate={{ opacity: metaVisible ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.16, ease: EASE }}
      >
        <span className={cx(styles.dep, dep?.blocked && styles.blocked)}>
          {dep ? (
            <Swap swapKey={dep.text} reduced={reduced}>
              {dep.blocked ? <CircleAlert className={styles.depIcon} aria-hidden="true" /> : <ArrowUp className={styles.depIcon} aria-hidden="true" />}
              <span className={styles.depText}>{dep.text}</span>
            </Swap>
          ) : null}
        </span>
        <span className={styles.estimate}>
          {editing ? (
            <input
              className={styles.estimateInput}
              inputMode="decimal"
              value={draft.estimate}
              aria-label={`Task ${index + 1} estimate in days`}
              onChange={event => setDraft(current => ({ ...current, estimate: event.target.value.replace(/[^0-9.]/g, "") }))}
              onKeyDown={onKey}
            />
          ) : (
            <Swap swapKey={task.estimate} reduced={reduced}>
              {formatEffort(task.estimate)}
            </Swap>
          )}
        </span>
        <Swap swapKey={owner?.id ?? "none"} reduced={reduced} className={styles.owner}>
          <OwnerFace owner={owner} />
        </Swap>
      </motion.span>
      <span className={styles.slot}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            className={styles.slotItem}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
            key={slotKey}
          >
            {slot}
          </motion.span>
        </AnimatePresence>
      </span>
    </Reorder.Item>
  );
}

/**
 * A goal input that turns one sentence into a plan: tasks stream in with estimates, owners and
 * dependencies, and a timeline shows whether the deadline holds. Reorder, edit or regenerate any
 * task, then send the plan to Linear or Jira with a spinner per row and a link to each issue.
 */
export function TaskBreakdown({
  defaultGoal = demoGoal,
  defaultTasks,
  owners = demoOwners,
  generate,
  regenerate,
  createIssue,
  targets = ["linear", "jira"],
  startDate = "2026-10-27T12:00:00",
  deadline = "2026-12-01T12:00:00",
  model = "Claude Sonnet 5.5",
  autoStart,
  onTasksChange,
  onSent,
  className,
}: TaskBreakdownProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const sectionRef = useRef<HTMLElement>(null);

  const [goal, setGoal] = useState(defaultGoal);
  const [tasks, setTasks] = useState<TaskDraft[]>(() => (defaultTasks ? [...defaultTasks] : []));
  const [phase, setPhase] = useState<Phase>(defaultTasks?.length ? "ready" : "idle");
  const [reveal, setReveal] = useState({ row: 0, words: 0 });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, { key: string; url: string } | "creating" | "failed">>({});
  const [sendingTo, setSendingTo] = useState<TaskTarget | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const planAbort = useRef<AbortController | null>(null);
  const sendAbort = useRef<AbortController | null>(null);
  const rowAborts = useRef(new Map<string, AbortController>());
  const seeded = useRef(new Map<string, { title: string; estimate: number; ownerId?: string }>());
  const variantCursor = useRef(new Map<string, number>());
  const started = useRef(false);

  const simulated = !generate;
  const simulatedIssues = !createIssue;
  const ownerMap = useMemo(() => new Map(owners.map(owner => [owner.id, owner])), [owners]);
  /** Disabled actions keep their label but take no new work. */
  const canSend = phase === "ready" && tasks.length > 0 && !editingId && !Object.keys(busy).length;

  /** Runs the plan: abort whatever is in flight, then stream the generated tasks in. */
  const breakDown = useCallback(async () => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    planAbort.current?.abort();
    rowAborts.current.forEach(controller => controller.abort());
    rowAborts.current.clear();
    const controller = new AbortController();
    planAbort.current = controller;
    setEditingId(null);
    setBusy({});
    setIssues({});
    setSendingTo(null);
    setTasks([]);
    setPhase("thinking");
    setAnnouncement("Planning tasks");
    try {
      const next = generate
        ? await generate(trimmed, controller.signal)
        : await pause(900, controller.signal).then<TaskDraft[]>(() => demoTasks.map(task => ({ ...task })));
      if (controller.signal.aborted) return;
      seeded.current = new Map(next.map(task => [task.id, { title: task.title, estimate: task.estimate, ownerId: task.ownerId }]));
      variantCursor.current.clear();
      setTasks(next);
      if (reduced || !next.length) {
        setReveal({ row: next.length, words: 0 });
        setPhase(next.length ? "ready" : "idle");
        setAnnouncement(`${next.length} tasks drafted${simulated ? ". Simulated sample plan" : ""}`);
      } else {
        setReveal({ row: 0, words: 0 });
        setPhase("streaming");
      }
    } catch (error) {
      if (isAbort(error)) return;
      setPhase("error");
      setAnnouncement("Could not draft tasks. Try again.");
    }
  }, [generate, goal, reduced, simulated]);

  /* Rows land three words at a time, one row after another. */
  useEffect(() => {
    if (phase !== "streaming") return;
    let cursor = { row: 0, words: 0 };
    const timer = setInterval(() => {
      const task = tasks[cursor.row];
      const next = cursor.words + 3;
      const after = !task || next >= task.title.split(/\s+/).filter(Boolean).length + 3 ? { row: cursor.row + 1, words: 0 } : { row: cursor.row, words: next };
      cursor = after;
      setReveal(after);
      if (after.row >= tasks.length) {
        clearInterval(timer);
        setPhase("ready");
        setAnnouncement(`${tasks.length} tasks drafted${simulated ? ". Simulated sample plan" : ""}`);
      }
    }, 36);
    return () => clearInterval(timer);
  }, [phase, tasks, simulated]);

  /* Auto start once the card is properly on screen. */
  const runOnSight = autoStart ?? !defaultTasks?.length;
  useEffect(() => {
    const node = sectionRef.current;
    if (!runOnSight || started.current || !node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();
        timer = window.setTimeout(() => void breakDown(), 500);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [runOnSight, breakDown]);

  useEffect(
    () => () => {
      planAbort.current?.abort();
      sendAbort.current?.abort();
      rowAborts.current.forEach(controller => controller.abort());
    },
    [],
  );

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (phase === "ready") onTasksChange?.(tasks);
  }, [tasks]);

  const indexOf = (id: string) => tasks.findIndex(task => task.id === id);

  /** Rewrites one task in place, keeping its id and dependencies unless the rewrite returns new ones. */
  const reroll = async (id: string) => {
    const task = tasks.find(entry => entry.id === id);
    if (!task) return;
    const controller = new AbortController();
    rowAborts.current.get(id)?.abort();
    rowAborts.current.set(id, controller);
    setBusy(current => ({ ...current, [id]: true }));
    setAnnouncement(`Regenerating task ${indexOf(id) + 1}`);
    try {
      let patch: Partial<Omit<TaskDraft, "id">>;
      if (regenerate) patch = await regenerate(task, { goal, tasks }, controller.signal);
      else {
        await pause(760, controller.signal);
        const options = [seeded.current.get(id), ...(variants[id] ?? [])].filter(Boolean) as Partial<Omit<TaskDraft, "id">>[];
        const cursor = ((variantCursor.current.get(id) ?? 0) + 1) % Math.max(1, options.length);
        variantCursor.current.set(id, cursor);
        patch = options[cursor] ?? {};
      }
      const { id: ignored, ...fields } = patch as Partial<TaskDraft> & { id?: string };
      void ignored;
      setTasks(current => current.map(entry => (entry.id === id ? { ...entry, ...fields, dependsOn: fields.dependsOn ?? entry.dependsOn } : entry)));
      setAnnouncement(`Task ${indexOf(id) + 1} rewritten${regenerate ? "" : ". Simulated"}`);
    } catch (error) {
      if (!isAbort(error)) setAnnouncement(`Could not regenerate task ${indexOf(id) + 1}`);
    } finally {
      if (rowAborts.current.get(id) === controller) rowAborts.current.delete(id);
      setBusy(current => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  /** One issue per task, in list order; a rejection marks just that row failed. */
  const create = async (target: TaskTarget, task: TaskDraft, index: number, signal: AbortSignal) => {
    if (createIssue) return createIssue(target, task, signal);
    await pause(220, signal);
    const tracker = trackers[target];
    const key = `${tracker.prefix}-${tracker.first + index}`;
    return { key, url: tracker.url(key) };
  };

  const send = async (target: TaskTarget, only?: string[]) => {
    sendAbort.current?.abort();
    const controller = new AbortController();
    sendAbort.current = controller;
    setEditingId(null);
    setSendingTo(target);
    setPhase("sending");
    const next = only ? { ...issues } : {};
    if (!only) setIssues({});
    setAnnouncement(`Creating ${tasks.length} issues in ${targetNames[target]}`);
    for (const [index, task] of tasks.entries()) {
      if (only && !only.includes(task.id)) continue;
      next[task.id] = "creating";
      setIssues({ ...next });
      try {
        next[task.id] = await create(target, task, index, controller.signal);
      } catch (error) {
        if (isAbort(error)) return;
        next[task.id] = "failed";
      }
      setIssues({ ...next });
    }
    const created = Object.fromEntries(Object.entries(next).filter(([, value]) => typeof value === "object")) as Record<string, { key: string; url: string }>;
    const count = Object.keys(created).length;
    setPhase("sent");
    setAnnouncement(
      count === tasks.length
        ? `${count} issues created in ${targetNames[target]}${simulatedIssues ? ". Simulated, nothing was sent" : ""}`
        : `${count} of ${tasks.length} issues created. ${tasks.length - count} failed`,
    );
    if (count === tasks.length) onSent?.(target, created);
  };

  const revealedRows = phase === "streaming" ? tasks.slice(0, reveal.row) : tasks;
  const plan = useMemo(() => schedule(revealedRows), [revealedRows]);
  const start = useMemo(() => new Date(startDate), [startDate]);
  const totalWorkdays = useMemo(() => workdaysBetween(startDate, deadline), [startDate, deadline]);
  const scale = Math.max(totalWorkdays + 4, plan.span);
  const shipDate = plan.span ? addWorkdays(start, plan.span) : null;
  const slack = totalWorkdays - Math.ceil(plan.span);
  const late = plan.span > 0 && slack < 0;
  const createdCount = Object.values(issues).filter(value => typeof value === "object").length;
  const failedIds = Object.entries(issues)
    .filter(([, value]) => value === "failed")
    .map(([id]) => id);
  const working = phase === "thinking" || phase === "streaming";
  const locked = phase === "sending" || phase === "sent" || working;
  const editable = phase === "ready" && tasks.length > 0 && !editingId && !Object.keys(busy).length;
  const reservedRows = Math.max(RESERVED_ROWS, tasks.length);
  const focusedCritical = hoveredId && plan.critical.includes(hoveredId) ? hoveredId : null;

  const totals =
    phase === "thinking" ? (
      <TextShimmer>Planning tasks</TextShimmer>
    ) : revealedRows.length ? (
      <span className={styles.totals}>
        <span className={styles.total}>
          <Swap swapKey={revealedRows.length} reduced={reduced} className={styles.num}>
            {revealedRows.length}
          </Swap>{" "}
          {revealedRows.length === 1 ? "task" : "tasks"}
        </span>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.total}>
          <Swap swapKey={plan.effort} reduced={reduced} className={styles.num}>
            {formatEffort(plan.effort)}
          </Swap>
          {" effort"}
        </span>
      </span>
    ) : (
      <span className={styles.muted}>No tasks yet</span>
    );

  const ship = shipDate
    ? late
      ? { key: `late-${formatDate(shipDate)}`, icon: <CircleAlert aria-hidden="true" />, text: `Ships ${formatDate(shipDate)}, ${-slack}d late`, tone: styles.warning }
      : { key: `ok-${formatDate(shipDate)}-${slack}`, icon: <CircleCheck aria-hidden="true" />, text: `Ships ${formatDate(shipDate)}, ${slack}d early`, tone: styles.success }
    : { key: "none", icon: null, text: `Due ${formatDate(new Date(deadline))}`, tone: styles.muted };

  /* Footer status: the model, send progress, or the result. */
  let statusKey: string;
  let status: ReactNode;
  if (phase === "sending" && sendingTo) {
    statusKey = "sending";
    status = (
      <>
        <TargetMark target={sendingTo} />
        <span className={styles.footerText}>
          Creating{" "}
          <Swap swapKey={Math.min(createdCount + 1, tasks.length)} reduced={reduced} className={styles.num}>
            {Math.min(createdCount + 1, tasks.length)}
          </Swap>{" "}
          of {tasks.length} in {targetNames[sendingTo]}
        </span>
      </>
    );
  } else if (phase === "sent" && sendingTo) {
    const all = !failedIds.length;
    statusKey = all ? "sent" : "partial";
    status = (
      <>
        {all ? (
          <CircleCheck className={cx(styles.statusIcon, styles.success)} aria-hidden="true" />
        ) : (
          <CircleAlert className={cx(styles.statusIcon, styles.warning)} aria-hidden="true" />
        )}
        <span className={styles.footerText}>{all ? `${createdCount} issues created in ${targetNames[sendingTo]}` : `${createdCount} of ${tasks.length} created`}</span>
      </>
    );
  } else {
    statusKey = "model";
    status = (
      <>
        <ClaudeMark className={cx(styles.mark, styles.claude)} aria-hidden="true" />
        <span className={styles.footerText}>{model}</span>
      </>
    );
  }

  /* Footer actions: start over plus retry or open, otherwise one send button per tracker. */
  let actionsKey: string;
  let actions: ReactNode;
  if (phase === "sent" && sendingTo) {
    actionsKey = failedIds.length ? "retry" : "done";
    actions = (
      <>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            sendAbort.current?.abort();
            setIssues({});
            setSendingTo(null);
            setPhase(tasks.length ? "ready" : "idle");
            setAnnouncement("Plan unlocked for editing");
          }}
        >
          Start over
        </Button>
        {failedIds.length ? (
          <Button size="sm" variant="primary" onClick={() => void send(sendingTo, failedIds)}>
            <RotateCcw aria-hidden="true" />
            Retry failed
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setAnnouncement(
                simulatedIssues ? `Simulated, the ${targetNames[sendingTo]} project was not opened` : `Open the project in ${targetNames[sendingTo]}`,
              )
            }
          >
            <TargetMark target={sendingTo} />
            <span>
              <span className={styles.long}>Open in </span>
              {targetNames[sendingTo]}
            </span>
          </Button>
        )}
      </>
    );
  } else {
    actionsKey = "send";
    actions = targets.map((target, at) => (
      <Button
        key={target}
        size="sm"
        variant={at === 0 ? "primary" : "secondary"}
        disabled={!editable && (phase !== "sending" || sendingTo !== target)}
        loading={phase === "sending" && sendingTo === target}
        onClick={() => void send(target)}
        aria-label={`Send to ${targetNames[target]}`}
      >
        <TargetMark target={target} />
        <span>
          <span className={styles.long}>Send to </span>
          {targetNames[target]}
        </span>
      </Button>
    ));
  }

  return (
    <section ref={sectionRef} className={cx(styles.root, className)} aria-labelledby={`${uid}-goal-label`}>
      <form
        className={styles.goal}
        onSubmit={event => {
          event.preventDefault();
          if (working) {
            planAbort.current?.abort();
            if (phase === "streaming") {
              const kept = tasks.slice(0, reveal.row);
              setTasks(kept);
              setReveal({ row: kept.length, words: 0 });
              setPhase(kept.length ? "ready" : "idle");
              setAnnouncement(`Stopped with ${kept.length} tasks`);
            } else {
              setPhase("idle");
              setAnnouncement("Stopped");
            }
          } else void breakDown();
        }}
      >
        <label id={`${uid}-goal-label`} htmlFor={`${uid}-goal`} className={styles.srOnly}>
          Goal
        </label>
        <Sparkles className={styles.goalIcon} aria-hidden="true" />
        <input
          id={`${uid}-goal`}
          className={styles.goalInput}
          value={goal}
          placeholder="Paste a goal, like Launch usage-based billing by Dec 1"
          autoComplete="off"
          spellCheck={false}
          disabled={phase === "sending"}
          onChange={event => setGoal(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant={working ? "secondary" : "primary"}
          disabled={phase === "sending" || (!working && !goal.trim())}
        >
          {working ? (
            <>
              <Square className={styles.stopIcon} aria-hidden="true" />
              Stop
            </>
          ) : (
            "Break down"
          )}
        </Button>
      </form>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLeft}>{totals}</span>
          <Swap swapKey={ship.key} reduced={reduced} className={cx(styles.ship, ship.tone)}>
            {ship.icon}
            <span className={styles.shipText}>{ship.text}</span>
          </Swap>
        </div>
        <div
          className={styles.track}
          role="img"
          aria-label={
            shipDate
              ? `Critical path of ${formatEffort(plan.span)} ships ${formatDate(shipDate)}, deadline ${formatDate(new Date(deadline))}`
              : "Timeline empty"
          }
        >
          <div className={styles.rail}>
            <AnimatePresence initial={false}>
              {plan.critical.map(id => {
                const from = ((plan.start.get(id) ?? 0) / scale) * 100;
                const width = (((plan.finish.get(id) ?? 0) - (plan.start.get(id) ?? 0)) / scale) * 100;
                return (
                  <motion.span
                    className={cx(styles.segment, late && styles.segmentLate, focusedCritical && focusedCritical !== id && styles.segmentDim)}
                    initial={{ left: `${from}%`, width: "0%", opacity: 1 }}
                    animate={{ left: `${from}%`, width: `${width}%`, opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={reduced ? { duration: 0 } : SETTLE}
                    key={id}
                  />
                );
              })}
            </AnimatePresence>
            <span className={styles.deadline} style={{ left: `${(totalWorkdays / scale) * 100}%` }} aria-hidden="true" />
          </div>
          <div className={styles.axis} aria-hidden="true">
            <span>{formatDate(addWorkdays(start, 1))}</span>
            <span className={styles.deadlineLabel} style={{ left: `${(totalWorkdays / scale) * 100}%` }}>
              {formatDate(new Date(deadline))}
            </span>
          </div>
        </div>
      </div>

      <motion.div
        className={styles.listArea}
        initial={false}
        animate={{ height: ROW_HEIGHT * reservedRows + 8 }}
        transition={reduced ? { duration: 0 } : SETTLE}
      >
        <AnimatePresence initial={false}>
          {(phase === "idle" || phase === "error") && !tasks.length ? (
            <motion.div
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              key={phase}
            >
              {phase === "error" ? (
                <>
                  <CircleAlert className={cx(styles.emptyIcon, styles.warning)} aria-hidden="true" />
                  <span>Could not draft tasks</span>
                  <Button size="sm" variant="secondary" onClick={() => void breakDown()}>
                    <RotateCcw aria-hidden="true" />
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <ListTodo className={styles.emptyIcon} aria-hidden="true" />
                  <span>Tasks, estimates and owners appear here</span>
                  <span className={styles.muted}>Paste a goal and press Break down</span>
                </>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {phase === "thinking" ? (
          <ol className={styles.list} aria-hidden="true">
            {Array.from({ length: RESERVED_ROWS }, (ignored, at) => (
              <li className={cx(styles.row, styles.skeletonRow)} key={at}>
                <span className={styles.grip} />
                <span className={styles.index}>{at + 1}</span>
                <span className={styles.title}>
                  <span className={styles.skeleton} style={{ width: `${SKELETON_WIDTHS[at]}%` }} />
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {tasks.length > 0 ? (
          <Reorder.Group
            as="ol"
            axis="y"
            values={tasks}
            onReorder={next => {
              if (!locked) setTasks(next);
            }}
            className={styles.list}
            aria-label="Tasks"
          >
            {tasks.map((task, at) => (
              <Row
                key={task.id}
                task={task}
                index={at}
                count={tasks.length}
                owner={task.ownerId ? ownerMap.get(task.ownerId) : undefined}
                dep={
                  (() => {
                    const positions = (task.dependsOn ?? [])
                      .map(id => tasks.findIndex(entry => entry.id === id))
                      .filter(position => position >= 0)
                      .sort((left, right) => left - right);
                    if (!positions.length) return undefined;
                    const blocked = positions.some(position => position > at);
                    return { text: `${blocked ? "Waits on" : "After"} ${positions.map(position => position + 1).join(", ")}`, blocked };
                  })()
                }
                revealed={phase !== "streaming" || at < reveal.row ? Number.POSITIVE_INFINITY : at === reveal.row ? reveal.words : 0}
                streaming={phase === "streaming"}
                busy={Boolean(busy[task.id])}
                locked={locked}
                editing={editingId === task.id}
                issue={issues[task.id]}
                simulated={simulatedIssues}
                reduced={reduced}
                onEdit={() => setEditingId(task.id)}
                onSave={patch => {
                  const id = task.id;
                  setTasks(current => current.map(entry => (entry.id === id ? { ...entry, ...patch } : entry)));
                  setEditingId(null);
                  setAnnouncement(`Task ${indexOf(id) + 1} saved`);
                }}
                onCancel={() => setEditingId(null)}
                onRegenerate={() => void reroll(task.id)}
                onMove={direction => {
                  const from = indexOf(task.id);
                  const to = from + direction;
                  if (from < 0 || to < 0 || to >= tasks.length) return;
                  const next = [...tasks];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved!);
                  setTasks(next);
                  setAnnouncement(`Moved to position ${to + 1} of ${tasks.length}`);
                  requestAnimationFrame(() =>
                    sectionRef.current?.querySelector<HTMLElement>(`[data-grip="${CSS.escape(task.id)}"]`)?.focus(),
                  );
                }}
                onHover={hovering => setHoveredId(current => (hovering ? task.id : current === task.id ? null : current))}
                onRetry={() => {
                  if (sendingTo) void send(sendingTo, [task.id]);
                }}
                onIssueClick={key => setAnnouncement(`Simulated, ${key} does not exist in ${sendingTo ? targetNames[sendingTo] : "the tracker"}`)}
              />
            ))}
          </Reorder.Group>
        ) : null}
      </motion.div>

      <div className={styles.footer}>
        <Swap swapKey={statusKey} reduced={reduced} className={styles.footerStatus}>
          {status}
        </Swap>
        <span className={styles.footerActions}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              className={styles.footerActionsInner}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
              key={actionsKey}
            >
              {actions}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
        {simulated && phase === "thinking" ? ". Simulated" : ""}
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- phase */

type Phase = "idle" | "thinking" | "streaming" | "ready" | "error" | "sending" | "sent";

/** A cancellable pause, so Stop never leaves a stray timer behind. */
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export default TaskBreakdown;
