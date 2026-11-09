"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Copy, Lock, RotateCcw, Trash2 } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { AvatarGroup } from "../avatar-group/avatar-group";
import { Button } from "../button/button";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./roles-permissions.module.css";

export interface Role {
  id: string;
  name: string;
  /** How many people hold the role. */
  people: number;
  /** A short sentence naming who holds it, shown under the role name in the menu. */
  who?: string;
  /** Owners cannot be edited: every permission stays on. */
  locked?: boolean;
  /** A role created in this session; it only exists once changes are saved. */
  custom?: boolean;
}

export interface Permission {
  id: string;
  label: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  permissions: Permission[];
}

export type Grants = Record<string, Record<string, boolean>>;

export interface RolesPermissionsProps {
  /** Workspace name in the summary line. */
  workspace?: string;
}

interface Snapshot {
  roles: Role[];
  grants: Grants;
}

interface NavProps {
  "data-nav": string;
  "data-key": string;
  "data-r": number;
  "data-c": number;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const { spring, duration, ease, blur, stagger } = motionTokens;
const enter = [...ease.enter] as [number, number, number, number];
const standard = [...ease.standard] as [number, number, number, number];
/** Each permission in a group starts a beat after the one before it, so a group toggle reads as a ripple. */
const RIPPLE = 0.75 * stagger.line;

const GROUPS: PermissionGroup[] = [
  {
    id: "projects",
    name: "Projects",
    permissions: [
      { id: "view-projects", label: "View projects" },
      { id: "create-projects", label: "Create projects" },
      { id: "edit-settings", label: "Edit project settings" },
      { id: "delete-projects", label: "Delete projects" },
    ],
  },
  {
    id: "members",
    name: "Members",
    permissions: [
      { id: "invite", label: "Invite members" },
      { id: "change-roles", label: "Change member roles" },
      { id: "remove-members", label: "Remove members" },
    ],
  },
  {
    id: "billing",
    name: "Billing",
    permissions: [
      { id: "invoices", label: "View invoices" },
      { id: "payment", label: "Manage payment methods" },
      { id: "plan", label: "Change plan" },
    ],
  },
  {
    id: "security",
    name: "Security",
    permissions: [
      { id: "sso", label: "Configure single sign-on" },
      { id: "audit-log", label: "View audit log" },
      { id: "api-keys", label: "Manage API keys" },
    ],
  },
];

const PERMISSIONS = GROUPS.flatMap(group => group.permissions);

const ROLES: Role[] = [
  { id: "owner", name: "Owner", people: 1, who: "Emma Collins", locked: true },
  { id: "admin", name: "Admin", people: 3, who: "Jasmine Brooks, Ava Mitchell and 1 other" },
  { id: "editor", name: "Editor", people: 8, who: "Marcus Johnson and 7 others" },
  { id: "viewer", name: "Viewer", people: 14, who: "14 people, including 9 guests" },
  { id: "billing", name: "Billing", people: 2, who: "Sofia Ramirez and 1 other" },
];

const GRANTED: Record<string, string[]> = {
  owner: PERMISSIONS.map(permission => permission.id),
  admin: [
    "view-projects", "create-projects", "edit-settings", "delete-projects",
    "invite", "change-roles", "remove-members",
    "invoices", "audit-log", "api-keys",
  ],
  editor: ["view-projects", "create-projects", "edit-settings", "invite"],
  viewer: ["view-projects"],
  billing: ["invoices", "payment", "plan"],
};

const SAMPLE: Snapshot = {
  roles: ROLES,
  grants: Object.fromEntries(
    ROLES.map(role => [role.id, Object.fromEntries(PERMISSIONS.map(permission => [permission.id, GRANTED[role.id].includes(permission.id)]))]),
  ),
};

const EXPANDED = Object.fromEntries(GROUPS.map(group => [group.id, true])) as Record<string, boolean>;

const MEMBERS = [
  { name: "Emma Collins", src: "/media/people/emma-collins.svg" },
  { name: "Jasmine Brooks", src: "/media/people/jasmine-brooks.svg" },
  { name: "Ava Mitchell", src: "/media/people/ava-mitchell.svg" },
  { name: "Marcus Johnson", src: "/media/people/marcus-johnson.svg" },
  { name: "Sofia Ramirez", src: "/media/people/sofia-ramirez.svg" },
  ...Array.from({ length: 23 }, (_, index) => ({ name: `Workspace member ${index + 6}` })),
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const omit = <T,>(record: Record<string, T>, key: string) => Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));
const cellKey = (roleId: string, permissionId: string) => `${roleId}:${permissionId}`;
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** The first match that is not inside a slot on its way out, so a leaving column never catches the pointer. */
function visible(root: HTMLElement | null, selector: string) {
  return Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).find(element => !element.closest("[inert]"));
}

function columnOf(target: EventTarget | null) {
  return target instanceof Element ? (target.closest<HTMLElement>("[data-col]")?.dataset.col ?? null) : null;
}

/** Ripple delays for the cells that actually change, so a group toggle travels down the group. */
function ripple(cells: Set<string>, roleIds: string[]) {
  const delays: Record<string, number> = {};
  PERMISSIONS.forEach((permission, index) => {
    roleIds.forEach(roleId => {
      const key = cellKey(roleId, permission.id);
      if (cells.has(key)) delays[key] = Math.min(0.03 * index, 0.36);
    });
  });
  return delays;
}

/** A line of copy that crossfades to its next value; the leaving copy is hidden from assistive tech. */
function SwapText({ children, className, reduce }: { children: ReactNode; className?: string; reduce: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={className}
      aria-hidden={!present || undefined}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.35em", filter: `blur(${blur.soft}px)` }}
      animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", filter: `blur(${blur.subtle}px)`, transition: { duration: duration.fast, ease: standard } }}
      transition={reduce ? { duration: 0 } : { duration: duration.standard, ease: enter }}
    >
      {children}
    </motion.span>
  );
}

function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduce = !!useReducedMotion();
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <SwapText key={id} className={styles.swapText} reduce={reduce}>{children}</SwapText>
      </AnimatePresence>
    </span>
  );
}

/**
 * A role column or a cell. Columns animate their own width, so duplicating or deleting a role slides the matrix instead
 * of snapping it; while a column is leaving it is inert, so its controls cannot be reached from the keyboard.
 */
function Slot({ kind, col, head, onEntered, children }: { kind: "columnheader" | "gridcell"; col: string; head?: boolean; onEntered?: () => void; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div
      role={kind}
      className={styles.slot}
      data-col={col}
      data-colhead={head ? col : undefined}
      inert={!present}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: "auto", opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { width: spring.smooth, opacity: { duration: duration.standard, ease: enter } }}
      onAnimationComplete={onEntered}
    >
      <div className={styles.cell}>{children}</div>
    </motion.div>
  );
}

function GroupBody({ id, children }: { id: string; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div
      id={id}
      className={styles.groupBody}
      inert={!present}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : { height: spring.smooth, opacity: { duration: duration.standard, ease: standard } }}
    >
      {children}
    </motion.div>
  );
}

interface ToggleProps {
  kind: "checkbox" | "switch";
  state: "on" | "off" | "mixed";
  label: string;
  locked?: boolean;
  dirty?: boolean;
  delay: number;
  onToggle: () => void;
  nav: NavProps;
}

/**
 * One permission cell. A checkbox reports on, off or mixed for a whole group; a switch reports a single permission. The
 * mark is drawn as a path, so the check and the mixed dash share their animation and never flicker.
 */
function Toggle({ kind, state, label, locked, dirty, delay, onToggle, nav }: ToggleProps) {
  const reduce = !!useReducedMotion();
  const [box, setBox] = useState<HTMLSpanElement | null>(null);
  const offset = reduce ? 0 : delay;
  const mark = (on: boolean) => ({ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 });
  const transition = reduce
    ? { duration: 0 }
    : { pathLength: { duration: duration.fast, ease: enter, delay: offset }, opacity: { duration: duration.instant, delay: offset } };

  return (
    <button
      {...nav}
      type="button"
      role={kind}
      aria-checked={state === "mixed" ? "mixed" : state === "on"}
      aria-label={label}
      aria-disabled={locked || undefined}
      className={styles.toggle}
      data-state={state}
      data-locked={locked || undefined}
      style={{ "--delay": `${offset}s` } as CSSProperties}
      onClick={() => {
        if (locked && !reduce && box) {
          animate(box, { x: [0, 3, -2, 1, 0] }, { duration: 0.34, ease: "easeOut" });
        }
        onToggle();
      }}
    >
      <span ref={setBox} className={styles.box}>
        <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true">
          <motion.path d="M4.25 8.4 6.9 10.9 11.75 5.4" initial={false} animate={mark(state === "on")} transition={transition} />
          <motion.path d="M5 8h6" initial={false} animate={mark(state === "mixed")} transition={transition} />
        </svg>
      </span>
      <AnimatePresence initial={false}>
        {dirty && (
          <motion.span
            key="dirty"
            className={styles.dirty}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={reduce ? { duration: 0 } : { ...spring.snappy, delay: offset }}
          />
        )}
      </AnimatePresence>
    </button>
  );
}

interface RoleHeaderProps {
  role: Role;
  isNew: boolean;
  dirty: boolean;
  canRevert: boolean;
  nav: NavProps;
  onDuplicate: () => void;
  onRevert: () => void;
  onDelete: () => void;
  onCloseFocus: (event: Event) => void;
}

/** A role header, with a menu for duplicate, revert and delete. Locked owner columns only offer duplicating. */
function RoleHeader({ role, isNew, dirty, canRevert, nav, onDuplicate, onRevert, onDelete, onCloseFocus }: RoleHeaderProps) {
  const reduce = !!useReducedMotion();
  const menuId = useId();
  const [focused, setFocused] = useState<string | null>(null);

  const items = [
    { key: "duplicate", label: "Duplicate role", icon: <Copy size={16} strokeWidth={1.75} />, onSelect: onDuplicate, disabled: false, danger: false },
    ...(role.locked ? [] : [{ key: "revert", label: "Revert changes", icon: <RotateCcw size={16} strokeWidth={1.75} />, onSelect: onRevert, disabled: !canRevert, danger: false }]),
    ...(role.custom ? [{ key: "delete", label: "Delete role", icon: <Trash2 size={16} strokeWidth={1.75} />, onSelect: onDelete, disabled: false, danger: true }] : []),
  ];

  const people = isNew ? "New role" : role.people === 0 ? "No members" : `${role.people} ${role.people === 1 ? "person" : "people"}`;

  return (
    <DropdownMenu.Root onOpenChange={open => { if (open) setFocused(null); }}>
      <DropdownMenu.Trigger className={styles.roleTrigger} {...nav}>
        <span className={styles.roleName}>
          {role.locked && <Lock className={styles.lock} size={12} strokeWidth={1.75} aria-hidden="true" />}
          <span className={styles.roleText}>{role.name}</span>
          <ChevronDown className={styles.chev} size={12} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className={styles.rolePeople}>
          <AnimatePresence initial={false}>
            {dirty && (
              <motion.i
                key="dot"
                className={styles.roleDot}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={reduce ? { duration: 0 } : spring.snappy}
              />
            )}
          </AnimatePresence>
          {people}
        </span>
        {role.locked && <span className={styles.srOnly}>, permissions are fixed</span>}
        {dirty && <span className={styles.srOnly}>, unsaved changes</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align="center"
          sideOffset={4}
          collisionPadding={12}
          loop
          onCloseAutoFocus={onCloseFocus}
          onFocus={event => {
            const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-item]") : null;
            setFocused(item?.dataset.item ?? null);
          }}
        >
          <DropdownMenu.Label className={styles.menuLabel}>
            <span>{role.name}</span>
            <small>{role.who ?? (isNew ? "Not saved yet" : "No members yet")}</small>
          </DropdownMenu.Label>
          <DropdownMenu.Group id={menuId}>
            {items.map(item => (
              <div key={item.key}>
                {item.danger && <DropdownMenu.Separator className={styles.menuSeparator} />}
                <DropdownMenu.Item
                  className={styles.menuItem}
                  data-item={item.key}
                  data-tone={item.danger ? "danger" : undefined}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                >
                  {focused === item.key && (
                    <motion.span
                      layoutId="highlight"
                      className={styles.menuHighlight}
                      aria-hidden="true"
                      transition={reduce ? { duration: 0 } : spring.snappy}
                    />
                  )}
                  <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.menuText}>{item.label}</span>
                </DropdownMenu.Item>
              </div>
            ))}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Roles and permissions: a matrix of roles by permission, grouped so an admin can read a role down the page. Group
 * toggles cover a whole row and ripple their cells, a column band follows the pointer, and every change feeds a review
 * bar that can be discarded or saved. Duplicating, reverting and deleting roles all wait for the same save.
 */
export function RolesPermissions({ workspace = "Kestrel Analytics" }: RolesPermissionsProps = {}) {
  const uid = useId();
  const reduce = !!useReducedMotion();

  const [saved, setSaved] = useState<Snapshot>(SAMPLE);
  const [roles, setRoles] = useState<Role[]>(SAMPLE.roles);
  const [grants, setGrants] = useState<Grants>(SAMPLE.grants);
  const [savedGrants, setSavedGrants] = useState<Grants>({});
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(EXPANDED);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [status, setStatus] = useState("");
  const [rovingKey, setRovingKey] = useState(`head:${SAMPLE.roles[0].id}`);

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const roleCounter = useRef(0);
  const pendingFocusKey = useRef<string | null>(null);
  const pendingScrollCol = useRef<string | null>(null);
  const hoverCol = useRef<string | null>(null);
  const timers = useRef({ phase: 0, flash: 0 });

  const bandX = useMotionValue(0);
  const bandWidth = useMotionValue(0);
  const bandOpacity = useMotionValue(0);

  const diff = buildDiff(saved, roles, grants, savedGrants);
  const barOpen = diff.count > 0 || saveState !== "idle";
  const justSaved = saveState === "saved" && diff.count === 0;

  const later = (run: () => void, ms: number) => {
    window.clearTimeout(timers.current.phase);
    timers.current.phase = window.setTimeout(run, ms);
  };

  /** The band tracks the hovered role column; the first column it lands on jumps, later ones glide. */
  function hoverColumn(col: string | null) {
    if (hoverCol.current === col) return;
    const glide = hoverCol.current !== null && !reduce;
    const target = col ? visible(gridRef.current, `[data-colhead="${col}"]`) : undefined;
    if (!target) {
      hoverCol.current = null;
      animate(bandOpacity, 0, { duration: reduce ? 0 : duration.fast });
      return;
    }
    hoverCol.current = col;
    if (glide) {
      animate(bandX, target.offsetLeft, spring.morph);
      animate(bandWidth, target.offsetWidth, spring.morph);
    } else {
      bandX.jump(target.offsetLeft);
      bandWidth.jump(target.offsetWidth);
    }
    animate(bandOpacity, 1, { duration: reduce ? 0 : duration.fast });
  }

  /** Arrow keys walk the matrix and never leave it: up and down snap to the nearest column in the next row. */
  function onGridKeyDown(event: KeyboardEvent<HTMLElement>) {
    const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!handled.includes(event.key) || event.altKey || event.metaKey) return;
    const cells = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? [])
      .filter(cell => !cell.closest("[inert]"))
      .map(cell => ({ element: cell, r: Number(cell.dataset.r), c: Number(cell.dataset.c) }));
    const row = Number(event.currentTarget.dataset.r);
    const col = Number(event.currentTarget.dataset.c);
    const inRow = (r: number) => cells.filter(cell => cell.r === r).sort((a, b) => a.c - b.c);
    let next: (typeof cells)[number] | undefined;

    if (event.key === "ArrowLeft") next = inRow(row).filter(cell => cell.c < col).at(-1);
    else if (event.key === "ArrowRight") next = inRow(row).find(cell => cell.c > col);
    else if (event.key === "Home") next = event.ctrlKey ? cells[0] : inRow(row)[0];
    else if (event.key === "End") next = event.ctrlKey ? cells.at(-1) : inRow(row).at(-1);
    else {
      const rows = [...new Set(cells.map(cell => cell.r))].sort((a, b) => a - b);
      const target = event.key === "ArrowUp" ? rows.filter(r => r < row).at(-1) : rows.find(r => r > row);
      if (target !== undefined) next = inRow(target).sort((a, b) => Math.abs(a.c - col) - Math.abs(b.c - col))[0];
    }
    if (next) {
      event.preventDefault();
      next.element.focus();
    }
  }

  /** A new or deleted column takes focus once it has finished sliding, not before. */
  function restoreFocus(event: Event) {
    const key = pendingFocusKey.current;
    if (!key) return;
    pendingFocusKey.current = null;
    event.preventDefault();
    visible(gridRef.current, `[data-key="${key}"]`)?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const current = timers.current;
    return () => {
      window.clearTimeout(current.phase);
      window.clearTimeout(current.flash);
    };
  }, []);

  // When the bar closes under the pointer, focus returns to the one tab stop in the matrix.
  useEffect(() => {
    if (barOpen) return;
    if (barRef.current?.contains(document.activeElement)) {
      gridRef.current?.querySelector<HTMLElement>('[data-nav][tabindex="0"]')?.focus({ preventScroll: true });
    }
  }, [barOpen]);

  const navKeys = new Set<string>();
  const rowOf: Record<string, number> = {};
  let rowCounter = 0;
  roles.forEach(role => navKeys.add(`head:${role.id}`));
  GROUPS.forEach(group => {
    rowOf[group.id] = ++rowCounter;
    navKeys.add(`g:${group.id}`);
    roles.forEach(role => navKeys.add(`g:${group.id}:${role.id}`));
    if (expanded[group.id]) {
      group.permissions.forEach(permission => {
        rowOf[permission.id] = ++rowCounter;
        roles.forEach(role => navKeys.add(`p:${permission.id}:${role.id}`));
      });
    }
  });

  const activeKey = navKeys.has(rovingKey) ? rovingKey : `head:${roles[0].id}`;
  const nav = (key: string, r: number, c: number): NavProps => ({
    "data-nav": "",
    "data-key": key,
    "data-r": r,
    "data-c": c,
    tabIndex: key === activeKey ? 0 : -1,
    onKeyDown: onGridKeyDown,
  });

  const affected = [...diff.touched, ...diff.removed].reduce((total, role) => total + role.people, 0);
  const names = [...diff.touched.map(role => role.name), ...diff.removed.map(role => role.name)];
  const summary = `${names.length <= 2 ? names.join(" and ") : names.length === 3 ? `${names[0]}, ${names[1]} and ${names[2]}` : `${names[0]}, ${names[1]} and ${names.length - 2} more`} · ${affected ? `affects ${affected} ${affected === 1 ? "person" : "people"}` : "no members yet"}`;
  const barSub = justSaved ? "Saved" : saveState === "saving" ? "Saving" : summary;

  function toggleGroup(role: Role, group: PermissionGroup) {
    if (role.locked) {
      setStatus(`${role.name} always has every permission`);
      return;
    }
    const on = !group.permissions.every(permission => grants[role.id][permission.id]);
    const rippleDelays: Record<string, number> = {};
    group.permissions.forEach((permission, index) => {
      if (grants[role.id][permission.id] !== on) rippleDelays[cellKey(role.id, permission.id)] = (index + 1) * RIPPLE;
    });
    setGrants({
      ...grants,
      [role.id]: {
        ...grants[role.id],
        ...Object.fromEntries(group.permissions.map(permission => [permission.id, on])),
      },
    });
    setDelays(rippleDelays);
    setStatus(`${on ? "Turned on" : "Turned off"} all ${group.name.toLowerCase()} permissions for ${role.name}`);
  }

  function togglePermission(role: Role, permission: Permission) {
    if (role.locked) {
      setStatus(`${role.name} always has every permission`);
      return;
    }
    const on = !grants[role.id][permission.id];
    setGrants({ ...grants, [role.id]: { ...grants[role.id], [permission.id]: on } });
    setDelays({});
    setStatus(`${role.name} ${on ? "can now" : "can no longer"} ${lowerFirst(permission.label)}`);
  }

  function duplicateRole(role: Role) {
    const nextId = `role-${++roleCounter.current}`;
    const taken = new Set([...roles, ...saved.roles].map(entry => entry.name));
    let name = `${role.name} copy`;
    for (let suffix = 2; taken.has(name); suffix++) name = `${role.name} copy ${suffix}`;
    const copy = { ...grants[role.id] };
    const index = roles.findIndex(entry => entry.id === role.id);
    setRoles([...roles.slice(0, index + 1), { id: nextId, name, people: 0, custom: true }, ...roles.slice(index + 1)]);
    setGrants({ ...grants, [nextId]: copy });
    setSavedGrants({ ...savedGrants, [nextId]: copy });
    setDelays({});
    pendingFocusKey.current = `head:${nextId}`;
    pendingScrollCol.current = nextId;
    hoverColumn(null);
    setStatus(`Duplicated ${role.name} as ${name}, not saved yet`);
  }

  function revertRole(role: Role) {
    const base = saved.grants[role.id] ?? savedGrants[role.id];
    if (!base) return;
    setGrants({ ...grants, [role.id]: { ...base } });
    setDelays(ripple(diff.cells, [role.id]));
    setStatus(`Reverted changes to ${role.name}`);
  }

  function deleteRole(role: Role) {
    const index = roles.findIndex(entry => entry.id === role.id);
    const neighbour = roles[index - 1] ?? roles[index + 1];
    setRoles(roles.filter(entry => entry.id !== role.id));
    setGrants(omit(grants, role.id));
    setSavedGrants(omit(savedGrants, role.id));
    setDelays({});
    pendingFocusKey.current = neighbour ? `head:${neighbour.id}` : null;
    hoverColumn(null);
    setStatus(diff.savedIds.has(role.id) ? `Deleted ${role.name}. Save to apply.` : `Removed ${role.name}`);
  }

  function save() {
    if (saveState === "saving" || diff.count === 0) return;
    const snapshot: Snapshot = { roles, grants };
    const changed = diff.count;
    setSaveState("saving");
    setStatus(`Saving ${plural(changed, "change")}`);
    later(() => {
      setSaved(snapshot);
      setSaveState("saved");
      setStatus(`Saved ${plural(changed, "change")}.`);
      later(() => setSaveState("idle"), 1600);
    }, 900);
  }

  return (
    <section className={styles.card} aria-labelledby={`${uid}-title`}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={`${uid}-title`}>Roles and permissions</h2>
            <p className={styles.summary}>
              {workspace} · <span className={styles.count}>28</span> members across{" "}
              <span className={styles.count}><AnimatedCounter value={roles.length} /></span> roles
            </p>
          </div>
          <AvatarGroup members={MEMBERS} max={4} size="sm" label="Workspace members" />
        </header>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          onScroll={event => event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollLeft > 1)}
        >
          <div
            ref={gridRef}
            role="grid"
            aria-labelledby={`${uid}-title`}
            className={styles.grid}
            onPointerMove={event => {
              if (event.pointerType !== "mouse" || !event.currentTarget.contains(event.target as Node)) return;
              hoverColumn(columnOf(event.target));
            }}
            onPointerLeave={() => hoverColumn(null)}
            onFocus={event => {
              if (!(event.target instanceof HTMLElement) || !event.currentTarget.contains(event.target)) return;
              if (event.target.dataset.key) setRovingKey(event.target.dataset.key);
              if (event.target.matches(":focus-visible")) hoverColumn(columnOf(event.target));
            }}
            onBlur={event => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null) || event.currentTarget.matches(":hover")) return;
              hoverColumn(null);
            }}
          >
            <motion.span className={styles.band} style={{ x: bandX, width: bandWidth, opacity: bandOpacity }} aria-hidden="true" />
            <div role="row" className={`${styles.row} ${styles.headRow}`}>
              <div role="columnheader" className={`${styles.label} ${styles.corner}`} data-corner="">Permission</div>
              <AnimatePresence initial={false}>
                {roles.map((role, index) => (
                  <Slot
                    key={role.id}
                    kind="columnheader"
                    col={role.id}
                    head
                    onEntered={() => revealColumn(role.id)}
                  >
                    <RoleHeader
                      role={role}
                      isNew={!diff.savedIds.has(role.id)}
                      dirty={diff.touched.includes(role)}
                      canRevert={PERMISSIONS.some(permission => diff.cells.has(cellKey(role.id, permission.id)))}
                      nav={nav(`head:${role.id}`, 0, index + 1)}
                      onDuplicate={() => duplicateRole(role)}
                      onRevert={() => revertRole(role)}
                      onDelete={() => deleteRole(role)}
                      onCloseFocus={restoreFocus}
                    />
                  </Slot>
                ))}
              </AnimatePresence>
            </div>
            {GROUPS.map(group => {
              const open = expanded[group.id];
              return (
                <Fragment key={group.id}>
                  <div role="row" className={`${styles.row} ${styles.groupRow}`}>
                    <div role="rowheader" className={styles.label}>
                      <button
                        {...nav(`g:${group.id}`, rowOf[group.id], 0)}
                        type="button"
                        className={styles.disclosure}
                        aria-expanded={open}
                        aria-controls={open ? `${uid}-${group.id}` : undefined}
                        onClick={() => setExpanded({ ...expanded, [group.id]: !open })}
                      >
                        <motion.span
                          className={styles.disclosureIcon}
                          initial={false}
                          animate={{ rotate: open ? 0 : -90 }}
                          transition={reduce ? { duration: 0 } : spring.snappy}
                        >
                          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
                        </motion.span>
                        <span className={styles.groupName}>{group.name}</span>
                        <span className={styles.groupCount}>
                          {group.permissions.length}
                          <span className={styles.srOnly}> permissions</span>
                        </span>
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {roles.map((role, index) => {
                        const count = group.permissions.filter(permission => grants[role.id]?.[permission.id]).length;
                        const state = count === 0 ? "off" : count === group.permissions.length ? "on" : "mixed";
                        return (
                          <Slot key={role.id} kind="gridcell" col={role.id}>
                            <Toggle
                              kind="checkbox"
                              state={state}
                              label={`${role.name}: all ${group.name.toLowerCase()} permissions${role.locked ? ", always on" : ""}`}
                              locked={role.locked}
                              delay={0}
                              dirty={!open && group.permissions.some(permission => diff.cells.has(cellKey(role.id, permission.id)))}
                              onToggle={() => toggleGroup(role, group)}
                              nav={nav(`g:${group.id}:${role.id}`, rowOf[group.id], index + 1)}
                            />
                          </Slot>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <GroupBody key="body" id={`${uid}-${group.id}`}>
                        {group.permissions.map(permission => (
                          <div key={permission.id} role="row" className={`${styles.row} ${styles.permRow}`}>
                            <div role="rowheader" className={`${styles.label} ${styles.permLabel}`}>{permission.label}</div>
                            <AnimatePresence initial={false}>
                              {roles.map((role, index) => {
                                const key = cellKey(role.id, permission.id);
                                const dirty = diff.cells.has(key);
                                return (
                                  <Slot key={role.id} kind="gridcell" col={role.id}>
                                    <Toggle
                                      kind="switch"
                                      state={grants[role.id]?.[permission.id] ? "on" : "off"}
                                      label={`${role.name}: ${permission.label}${role.locked ? ", always on" : dirty ? ", unsaved" : ""}`}
                                      locked={role.locked}
                                      dirty={dirty}
                                      delay={delays[key] ?? 0}
                                      onToggle={() => togglePermission(role, permission)}
                                      nav={nav(`p:${permission.id}:${role.id}`, rowOf[permission.id], index + 1)}
                                    />
                                  </Slot>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        ))}
                      </GroupBody>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </div>
        </div>
        <footer className={styles.foot}>
          <span className={styles.note}>
            <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
            Owners always have every permission
          </span>
          <span className={styles.note}>
            <i className={styles.legendDot} aria-hidden="true" />
            Unsaved change
          </span>
        </footer>
        <p className={styles.srOnly} role="status" aria-live="polite">{status}</p>
        <div className={styles.barSpace} data-open={barOpen || undefined} aria-hidden="true" />
        <div className={styles.barAnchor}>
          <AnimatePresence>
            {barOpen && (
              <motion.div
                key="bar"
                ref={barRef}
                className={styles.bar}
                role="region"
                aria-label="Unsaved permission changes"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 16, transition: { y: spring.smooth, opacity: { duration: duration.standard, ease: standard } } }}
                transition={reduce ? { duration: 0 } : { y: spring.smooth, opacity: { duration: duration.fast, ease: enter } }}
              >
                <div className={styles.barText}>
                  <Swap id={justSaved ? "saved" : "pending"}>
                    {justSaved ? (
                      <span className={styles.barLine}>
                        <Check className={styles.savedIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                        Permissions saved
                      </span>
                    ) : (
                      <span className={styles.barLine}>
                        <span className={styles.count}><AnimatedCounter value={Math.max(diff.count, 1)} /></span>
                        <span className={styles.unsavedWord}>unsaved</span>
                        <TextMorph>{diff.count === 1 ? "change" : "changes"}</TextMorph>
                      </span>
                    )}
                  </Swap>
                  <Swap id={barSub} className={styles.barSub}>{barSub}</Swap>
                </div>
                <div className={styles.barActions}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saveState === "saving" || diff.count === 0}
                    onClick={() => {
                      if (saveState === "saving" || diff.count === 0) return;
                      setDelays(ripple(diff.cells, saved.roles.map(role => role.id)));
                      setRoles(saved.roles);
                      setGrants(saved.grants);
                      setSavedGrants({});
                      hoverColumn(null);
                      setStatus(`Discarded ${plural(diff.count, "unsaved change")}`);
                    }}
                  >
                    Discard
                  </Button>
                  <Button type="button" size="sm" loading={saveState === "saving"} onClick={save}>
                    {justSaved ? <><Check size={16} strokeWidth={1.75} aria-hidden="true" />Saved</> : "Save changes"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );

  /** A column that has just slid in is scrolled clear of the sticky labels, then lit for a moment. */
  function revealColumn(col: string) {
    if (pendingScrollCol.current !== col) return;
    pendingScrollCol.current = null;
    const scroller = scrollerRef.current;
    const slot = visible(gridRef.current, `[data-colhead="${col}"]`);
    const corner = gridRef.current?.querySelector<HTMLElement>("[data-corner]");
    if (scroller && slot && corner) {
      const start = slot.offsetLeft;
      const end = start + slot.offsetWidth;
      const left = end > scroller.scrollLeft + scroller.clientWidth
        ? end - scroller.clientWidth
        : start - corner.offsetWidth < scroller.scrollLeft
          ? start - corner.offsetWidth
          : scroller.scrollLeft;
      if (left !== scroller.scrollLeft) scroller.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    }
    hoverColumn(col);
    window.clearTimeout(timers.current.flash);
    timers.current.flash = window.setTimeout(() => {
      if (hoverCol.current !== col || gridRef.current?.matches(":hover")) return;
      hoverColumn(null);
    }, 1400);
  }
}

/** What differs between the saved snapshot and the live matrix: changed cells, touched roles, and deleted roles. */
function buildDiff(saved: Snapshot, roles: Role[], grants: Grants, savedGrants: Grants) {
  const savedIds = new Set(saved.roles.map(role => role.id));
  const liveIds = new Set(roles.map(role => role.id));
  const cells = new Set<string>();
  const touched: Role[] = [];
  for (const role of roles) {
    const base = saved.grants[role.id] ?? savedGrants[role.id] ?? {};
    let changed = !savedIds.has(role.id);
    for (const permission of PERMISSIONS) {
      if (!!grants[role.id]?.[permission.id] !== !!base[permission.id]) {
        cells.add(cellKey(role.id, permission.id));
        changed = true;
      }
    }
    if (changed) touched.push(role);
  }
  const added = roles.filter(role => !savedIds.has(role.id)).length;
  const removed = saved.roles.filter(role => !liveIds.has(role.id));
  return { cells, touched, removed, savedIds, count: cells.size + added + removed.length };
}

export default RolesPermissions;
