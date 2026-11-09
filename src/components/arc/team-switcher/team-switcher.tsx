"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  CircleAlert,
  Link as LinkIcon,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import Button from "../button/button";
import { Input } from "../input/input";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./team-switcher.module.css";

const EASE_ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const GLIDE = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const NUMBER = new Intl.NumberFormat("en-US");

type TileStyle = { background?: string; color?: string };

export type Workspace = {
  id: string;
  name: string;
  plan?: string;
  members?: number;
  role?: string;
  tile?: TileStyle;
  logo?: ReactNode;
};

type MarkProps = { style?: CSSProperties };

function mark(d: string, name: string) {
  const Mark = ({ style }: MarkProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={style}>
      <path d={d} />
    </svg>
  );
  Mark.displayName = `${name}Mark`;
  return Mark;
}

const LinearMark = mark(
  "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
  "Linear",
);
const VercelMark = mark("m12 1.608 12 20.784H0Z", "Vercel");
const StripeMark = mark(
  "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  "Stripe",
);
const SupabaseMark = mark(
  "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z",
  "Supabase",
);
const RaycastMark = mark(
  "M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z",
  "Raycast",
);
const ResendMark = mark(
  "M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z",
  "Resend",
);
const NotionMark = mark(
  "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z",
  "Notion",
);

const FigmaMark = ({ style }: MarkProps) => (
  <svg viewBox="0 0 38 57" aria-hidden="true" focusable="false" style={style}>
    <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </svg>
);
FigmaMark.displayName = "FigmaMark";

const markStyle = (em: number, extra?: { y?: number }): CSSProperties => ({
  width: `${em}em`,
  height: `${em}em`,
  transform: extra?.y ? `translateY(${extra.y}em)` : undefined,
});

const sampleWorkspaces: Workspace[] = [
  {
    id: "linear",
    name: "Linear",
    plan: "Enterprise",
    members: 214,
    role: "Admin",
    tile: { background: "#5E6AD2", color: "#fff" },
    logo: <LinearMark style={markStyle(0.52)} />,
  },
  {
    id: "vercel",
    name: "Vercel",
    plan: "Pro",
    members: 38,
    role: "Owner",
    tile: { background: "#000", color: "#fff" },
    logo: <VercelMark style={markStyle(0.5, { y: -0.02 })} />,
  },
  {
    id: "stripe",
    name: "Stripe",
    plan: "Enterprise",
    members: 1240,
    role: "Member",
    tile: { background: "#635BFF", color: "#fff" },
    logo: <StripeMark style={markStyle(0.48)} />,
  },
  {
    id: "figma",
    name: "Figma",
    plan: "Organization",
    members: 96,
    role: "Member",
    tile: { background: "#1E1E1E" },
    logo: <FigmaMark style={{ height: "0.56em", width: "0.373em" }} />,
  },
  {
    id: "supabase",
    name: "Supabase",
    plan: "Team",
    members: 52,
    role: "Billing",
    tile: { background: "#1c1c1c", color: "#3ecf8e" },
    logo: <SupabaseMark style={markStyle(0.5)} />,
  },
  {
    id: "raycast",
    name: "Raycast",
    plan: "Pro",
    members: 24,
    role: "Guest",
    tile: { background: "#FF6363", color: "#fff" },
    logo: <RaycastMark style={markStyle(0.5)} />,
  },
];

type SampleInvite = { link: string; workspace: Workspace };

const sampleInvites: SampleInvite[] = [
  {
    link: "https://resend.com/invite/7HK2-QPLM",
    workspace: {
      id: "resend",
      name: "Resend",
      plan: "Pro",
      members: 18,
      role: "Member",
      tile: { background: "#000", color: "#fff" },
      logo: <ResendMark style={markStyle(0.44)} />,
    },
  },
  {
    link: "https://notion.so/invite/a91f-22cd",
    workspace: {
      id: "notion",
      name: "Notion",
      plan: "Business",
      members: 410,
      role: "Member",
      tile: { background: "#fff", color: "#000" },
      logo: <NotionMark style={markStyle(0.54)} />,
    },
  },
];

function memberCount(count: number) {
  return `${NUMBER.format(count)} ${count === 1 ? "member" : "members"}`;
}

function workspaceMeta(workspace: Workspace) {
  return [workspace.plan, workspace.members != null ? memberCount(workspace.members) : null]
    .filter(Boolean)
    .join(" · ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function waiting(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function parseInvite(value: string, list: Workspace[]): Workspace {
  const known = sampleInvites.find((item) => item.link.toLowerCase() === value.toLowerCase());
  if (known) return known.workspace;
  let url: URL | null = null;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    url = null;
  }
  if (!url || !/invite|join/i.test(url.pathname) || !url.hostname.includes("."))
    throw new Error("That doesn't look like an invite link");
  const host = url.hostname.replace(/^www\./, "").split(".")[0] ?? "";
  const name = host.charAt(0).toUpperCase() + host.slice(1);
  const workspace: Workspace = { id: `ws-${slugify(name)}`, name, plan: "Team", role: "Member" };
  if (list.some((item) => item.id === workspace.id)) throw new Error(`You're already in ${name}`);
  return workspace;
}

function Tile({ workspace, size = 28 }: { workspace: Workspace; size?: number }) {
  return (
    <span
      className={`${styles.tile}${workspace.tile ? "" : ` ${styles.tileLetter}`}`}
      style={
        {
          "--tile": `${size}px`,
          background: workspace.tile?.background,
          color: workspace.tile?.color,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {workspace.logo ?? (
        <span className={styles.initial}>
          {workspace.name.trim().charAt(0).toUpperCase() || "W"}
        </span>
      )}
    </span>
  );
}

function Swap({
  swapKey,
  children,
  className,
  reduced,
}: {
  swapKey: string;
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={swapKey}
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              duration: reduced ? 0.1 : 0.16,
              delay: reduced ? 0 : 0.04,
              ease: EASE_ENTER,
            },
          }}
          exit={{
            opacity: 0,
            y: reduced ? 0 : -2,
            transition: { duration: 0.1, ease: "easeOut" },
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Shortcut({ index, pressed }: { index: number; pressed: boolean }) {
  return (
    <kbd className={`${styles.kbd} ${styles.kbdSm}`} aria-hidden="true">
      <span className={styles.kbdSlot}>
        <kbd className={styles.kbdKey} data-pressed={pressed || undefined}>
          <span className={styles.kbdGlyph} aria-hidden="true">
            ⌘
          </span>
          <span className={styles.kbdHidden}>Command</span>
        </kbd>
      </span>
      <span className={styles.kbdSlot}>
        <span className={styles.kbdHidden}> </span>
        <kbd className={styles.kbdKey} data-pressed={pressed || undefined}>
          {index}
        </kbd>
      </span>
    </kbd>
  );
}

export type TeamSwitcherProps = {
  /** Workspaces shown in the list. Falls back to six shipped samples. */
  workspaces?: Workspace[];
  /** Controlled active workspace id. */
  value?: string;
  /** Initial active workspace id when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (id: string, workspace: Workspace) => void;
  /** Swap a workspace. Resolve to finish, throw to surface the error state. */
  onSwitch?: (workspace: Workspace, signal: AbortSignal) => void | Promise<void>;
  onCreateWorkspace?: (
    name: string,
    signal: AbortSignal,
  ) => Workspace | null | undefined | Promise<Workspace | null | undefined>;
  onJoinWorkspace?: (
    invite: string,
    signal: AbortSignal,
  ) => Workspace | null | undefined | Promise<Workspace | null | undefined>;
  /** Controlled panel visibility. */
  open?: boolean;
  /** Panel open on mount. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Listen for ⌘1–⌘9 outside the trigger. */
  globalShortcuts?: boolean;
  /** Fake round-trip used by the built-in switch/create/join stubs. */
  simulatedDelay?: number;
  disabled?: boolean;
  className?: string;
};

export function TeamSwitcher({
  workspaces,
  value,
  defaultValue,
  onValueChange,
  onSwitch,
  onCreateWorkspace,
  onJoinWorkspace,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  globalShortcuts = false,
  simulatedDelay = 650,
  disabled = false,
  className,
}: TeamSwitcherProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const panelId = `${uid}-panel`;
  const listboxId = `${uid}-listbox`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const switchAbort = useRef<AbortController | null>(null);
  const formAbort = useRef<AbortController | null>(null);

  const [created, setCreated] = useState<Workspace[]>([]);
  const all = useMemo(() => {
    const base = workspaces ?? sampleWorkspaces;
    return [...base, ...created.filter((item) => !base.some((other) => other.id === item.id))];
  }, [workspaces, created]);

  const byId = useCallback((id: string) => all.find((item) => item.id === id), [all]);

  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (workspaces ?? sampleWorkspaces)[0]?.id,
  );
  const activeId = value ?? internalValue;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "switching" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const current = byId(pendingId ?? activeId) ?? all[0];

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<string | null>(open ? `ws:${activeId}` : null);
  const [pressed, setPressed] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [createName, setCreateName] = useState("");
  const [invite, setInvite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const [highlightVisible, setHighlightVisible] = useState(false);
  const selectedRef = useRef(false);
  const navPressed = useRef(false);
  const y = useMotionValue(0);
  const height = useMotionValue(48);
  const [clip, setClip] = useState("none");

  const setOpenState = useCallback(
    (next: boolean, focusTrigger = false, noFocusVisible = false) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next && focusTrigger)
        triggerRef.current?.focus({ preventScroll: true, focusVisible: !noFocusVisible });
    },
    [onOpenChange, openProp],
  );

  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return;
    wasOpen.current = open;
    setView("list");
    setQuery("");
    setHighlighted(`ws:${activeId}`);
    setFormError(undefined);
    setSubmitting(false);
    if (!open) formAbort.current?.abort();
  }, [open, activeId]);

  const focusOnOpen = useRef(open);
  useEffect(() => {
    if (focusOnOpen.current === open) return;
    focusOnOpen.current = open;
    if (open) searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    return () => {
      switchAbort.current?.abort();
      formAbort.current?.abort();
    };
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      trimmedQuery
        ? all.filter((item) =>
            [item.name, item.plan, item.role].some((field) =>
              field?.toLowerCase().includes(trimmedQuery),
            ),
          )
        : all,
    [all, trimmedQuery],
  );
  const items = useMemo(
    () => [...matches.map((item) => `ws:${item.id}`), "create", "join"],
    [matches],
  );

  useEffect(() => {
    if (phase !== "error") return;
    const id = window.setTimeout(() => setPhase("idle"), 3200);
    return () => window.clearTimeout(id);
  }, [phase]);

  const switchTo = useCallback(
    async (workspace: Workspace, prefix = "") => {
      if (workspace.id === activeId && phase !== "switching") return;
      switchAbort.current?.abort();
      if (workspace.id === activeId) {
        setPendingId(null);
        setPhase("idle");
        return;
      }
      const controller = new AbortController();
      switchAbort.current = controller;
      setPendingId(workspace.id);
      setPhase("switching");
      setAnnounce(`${prefix}Switching to ${workspace.name}`);
      try {
        if (onSwitch) await onSwitch(workspace, controller.signal);
        else await waiting(simulatedDelay, controller.signal);
        if (controller.signal.aborted) return;
        if (value === undefined) setInternalValue(workspace.id);
        onValueChange?.(workspace.id, workspace);
        setPendingId(null);
        setPhase("idle");
        setAnnounce(
          `${prefix}Switched to ${workspace.name}.${onSwitch ? "" : " Simulated, nothing was loaded."}`,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setPendingId(null);
        setPhase("error");
        setErrorMsg(
          error instanceof Error && error.message ? error.message : "Couldn't switch, try again",
        );
        setAnnounce(`Couldn't switch to ${workspace.name}.`);
      }
    },
    [activeId, onSwitch, onValueChange, phase, simulatedDelay, value],
  );

  const choose = useCallback(
    (id: string, fromClick = false) => {
      setOpenState(false, true, fromClick);
      const workspace = byId(id);
      if (workspace) void switchTo(workspace);
    },
    [byId, setOpenState, switchTo],
  );

  const goToView = useCallback(
    (next: "list" | "create" | "join") => {
      formAbort.current?.abort();
      setSubmitting(false);
      setFormError(undefined);
      if (next === "create") setCreateName(query.trim() && !matches.length ? query.trim() : "");
      if (next === "join") setInvite("");
      setView(next);
      if (next === "list")
        requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    },
    [matches.length, query],
  );

  const activate = useCallback(
    (key: string) => {
      if (key === "create" || key === "join") goToView(key);
      else choose(key.slice(3));
    },
    [choose, goToView],
  );

  const handleShortcut = useCallback(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
      const index = /^Digit([1-9])$/.exec((event as KeyboardEvent).code)?.[1] ?? /^([1-9])$/.exec(event.key)?.[1];
      const workspace = index ? all[Number(index) - 1] : undefined;
      if (!workspace || disabled) return false;
      event.preventDefault();
      if (open && view === "list") {
        const key = `ws:${workspace.id}`;
        setHighlighted(key);
        setPressed(key);
        window.setTimeout(() => {
          setPressed(null);
          choose(workspace.id);
        }, 140 * (reduced ? 0 : 1));
      } else {
        void switchTo(workspace);
      }
      return true;
    },
    [all, choose, disabled, open, reduced, switchTo, view],
  );

  useEffect(() => {
    if (!globalShortcuts) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      handleShortcut(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [globalShortcuts, handleShortcut]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenState(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, setOpenState]);

  const compute = useCallback(
    (instant = false) => {
      const body = bodyRef.current;
      const row = highlighted ? rowRefs.current.get(highlighted) : undefined;
      if (!body || !row) {
        selectedRef.current = false;
        return false;
      }
      let offset = 0;
      let node: HTMLElement | null = row;
      const stop = listboxRef.current;
      while (node && node !== stop) {
        offset += node.offsetTop;
        const parent: HTMLElement | null = node.offsetParent as HTMLElement | null;
        if (parent && parent !== stop) offset -= parent.scrollTop;
        node = parent;
      }
      const size = row.offsetHeight;
      if (body.contains(row)) {
        const top = body.offsetTop;
        const bottom = top + body.clientHeight;
        setClip(
          offset < top || offset + size > bottom
            ? `inset(${Math.max(0, top - offset)}px 0 ${Math.max(0, offset + size - bottom)}px 0 round var(--row-radius))`
            : "none",
        );
      } else {
        setClip("none");
      }
      if (!instant && selectedRef.current && !reduced) {
        animate(y, offset, GLIDE);
        animate(height, size, GLIDE);
      } else {
        y.jump(offset);
        height.jump(size);
      }
      selectedRef.current = true;
      return true;
    },
    [height, highlighted, reduced, y],
  );

  const listOpen = open && view === "list";
  useLayoutEffect(() => {
    if (!listOpen) {
      selectedRef.current = false;
      return;
    }
    compute(false);
    const visible = selectedRef.current;
    setHighlightVisible(visible);
    if (visible && navPressed.current && highlighted)
      rowRefs.current.get(highlighted)?.scrollIntoView({ block: "nearest" });
    navPressed.current = false;
  }, [compute, highlighted, listOpen, matches]);

  const submitForm = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, formView: "create" | "join") => {
      event.preventDefault();
      if (submitting) return;
      const raw = formView === "create" ? createName : invite;
      const value_ = raw.trim();
      if (!value_) {
        setFormError(
          formView === "create" ? "Give the workspace a name" : "Paste an invite link or code",
        );
        return;
      }
      formAbort.current?.abort();
      const controller = new AbortController();
      formAbort.current = controller;
      setSubmitting(true);
      setFormError(undefined);
      try {
        let workspace: Workspace | null | undefined;
        if (formView === "create") {
          workspace = onCreateWorkspace
            ? await onCreateWorkspace(value_, controller.signal)
            : (await waiting(600, controller.signal),
              {
                id: `ws-${slugify(value_) || "new"}-${Date.now().toString(36)}`,
                name: value_,
                plan: "Free",
                members: 1,
                role: "Owner",
              });
        } else {
          workspace = onJoinWorkspace
            ? await onJoinWorkspace(value_, controller.signal)
            : (await waiting(600, controller.signal), parseInvite(value_, all));
        }
        if (controller.signal.aborted) return;
        setSubmitting(false);
        if (!workspace) {
          setOpenState(false, true);
          return;
        }
        setCreated((prev) =>
          prev.some((item) => item.id === workspace.id) ? prev : [...prev, workspace],
        );
        setOpenState(false, true);
        void switchTo(
          workspace,
          `${formView === "create" ? "Created" : "Joined"} ${workspace.name}${
            (formView === "create" ? onCreateWorkspace : onJoinWorkspace)
              ? ""
              : " (simulated, nothing was sent)"
          }. `,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setSubmitting(false);
        setFormError(
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong, try again",
        );
      }
    },
    [all, createName, invite, onJoinWorkspace, onCreateWorkspace, setOpenState, submitting, switchTo],
  );

  const availableInvite = sampleInvites.find(
    (item) => !all.some((workspace) => workspace.id === item.workspace.id),
  );
  const invitePreview = useMemo(() => {
    const trimmed = invite.trim();
    if (!trimmed) return null;
    try {
      return parseInvite(trimmed, []);
    } catch {
      return null;
    }
  }, [invite]);

  const phaseLabel = phase === "switching" ? "switching" : phase === "error" ? "error" : "idle";
  const draft: Workspace = {
    id: "draft",
    name: createName.trim() || "Untitled workspace",
    plan: "Free",
    members: 1,
  };
  const activedescendant =
    highlighted && highlightVisible ? `${uid}-${highlighted}` : undefined;

  const panelAnimation = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0, y: -4, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: EASE_ENTER } },
        exit: {
          opacity: 0,
          y: -4,
          scale: 0.98,
          transition: { duration: 0.12, ease: "easeIn" as const },
        },
      };

  const viewAnimation = (direction: number) => ({
    initial: { opacity: 0, x: reduced ? 0 : 6 * direction },
    animate: { opacity: 1, x: 0, transition: { duration: 0.16, delay: 0.04, ease: EASE_ENTER } },
    exit: {
      opacity: 0,
      x: reduced ? 0 : -6 * direction,
      transition: { duration: 0.1, ease: "easeOut" as const },
    },
  });

  const actions: [string, string, ComponentType<{ size?: number; "aria-hidden"?: boolean }>][] = [
    ["create", "Create workspace", Plus],
    ["join", "Join with invite", LinkIcon],
  ];

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onKeyDown={(event) => {
        if (handleShortcut(event)) return;
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        if (view !== "list") goToView("list");
        else if (query) setQuery("");
        else setOpenState(false, true);
      }}
      onBlur={(event) => {
        if (rootRef.current?.contains(event.relatedTarget as Node)) return;
        setOpenState(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-busy={phase === "switching" || undefined}
        aria-label={`Workspace: ${current?.name ?? "none"}. ${
          phase === "switching" ? "Switching." : workspaceMeta(current ?? { id: "", name: "" })
        }`}
        disabled={disabled}
        data-open={open || undefined}
        onClick={() => setOpenState(!open)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" || open) return;
          event.preventDefault();
          setOpenState(true);
        }}
      >
        {current && (
          <Swap swapKey={current.id} className={styles.triggerTile} reduced={reduced}>
            <Tile workspace={current} size={32} />
          </Swap>
        )}
        <span className={styles.triggerText}>
          <Swap swapKey={current?.id ?? "none"} className={styles.triggerName} reduced={reduced}>
            <span className={styles.truncate}>{current?.name}</span>
          </Swap>
          <Swap
            swapKey={`${phaseLabel}:${current?.id}`}
            className={styles.triggerMeta}
            reduced={reduced}
          >
            {phaseLabel === "switching" ? (
              <TextMorph className={styles.truncate}>Switching workspace</TextMorph>
            ) : phaseLabel === "error" ? (
              <span className={styles.errorLine}>
                <CircleAlert size={14} aria-hidden />
                <span className={styles.truncate}>{errorMsg}</span>
              </span>
            ) : (
              <span className={styles.truncate}>{current ? workspaceMeta(current) : ""}</span>
            )}
          </Swap>
        </span>
        <Swap
          swapKey={phaseLabel === "switching" ? "spin" : "chevron"}
          className={styles.triggerEnd}
          reduced={reduced}
        >
          {phaseLabel === "switching" ? (
            <LoaderCircle size={16} className={styles.spin} aria-hidden />
          ) : (
            <ChevronsUpDown size={16} aria-hidden />
          )}
        </Swap>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Switch workspace"
            className={styles.panel}
            data-frame-keep=""
            {...panelAnimation}
          >
            <AnimatePresence initial={false}>
              {view === "list" ? (
                <motion.div key="list" className={styles.view} {...viewAnimation(-1)}>
                  <div className={styles.searchRow}>
                    <Search size={16} className={styles.searchIcon} aria-hidden />
                    <input
                      ref={searchRef}
                      className={styles.search}
                      value={query}
                      onChange={(event) => {
                        const next = event.target.value;
                        setQuery(next);
                        const needle = next.trim().toLowerCase();
                        const first = all.find(
                          (item) =>
                            !needle ||
                            [item.name, item.plan, item.role].some((field) =>
                              field?.toLowerCase().includes(needle),
                            ),
                        );
                        setHighlighted(first ? `ws:${first.id}` : "create");
                      }}
                      onKeyDown={(event) => {
                        const index = highlighted ? items.indexOf(highlighted) : -1;
                        const move = (next: number) => {
                          event.preventDefault();
                          navPressed.current = true;
                          setHighlighted(items[(next + items.length) % items.length]);
                        };
                        if (event.key === "ArrowDown") move(index + 1);
                        else if (event.key === "ArrowUp") move(index < 0 ? items.length - 1 : index - 1);
                        else if (event.key === "Home" && !query) move(0);
                        else if (event.key === "End" && !query) move(items.length - 1);
                        else if (event.key === "Enter" && highlighted) {
                          event.preventDefault();
                          activate(highlighted);
                        }
                      }}
                      placeholder="Find a workspace"
                      aria-label="Find a workspace"
                      role="combobox"
                      aria-expanded="true"
                      aria-controls={listboxId}
                      aria-autocomplete="list"
                      aria-activedescendant={activedescendant}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                  <div
                    ref={listboxRef}
                    id={listboxId}
                    role="listbox"
                    aria-label="Workspaces and actions"
                    className={styles.listbox}
                  >
                    <motion.div
                      className={styles.highlight}
                      aria-hidden="true"
                      data-pressed={pressed || undefined}
                      style={{ y, height, clipPath: clip }}
                      initial={false}
                      animate={{ opacity: highlightVisible ? 1 : 0 }}
                      transition={{ duration: 0.12 }}
                    />
                    <div
                      ref={bodyRef}
                      role="group"
                      aria-label="Workspaces"
                      className={styles.body}
                      style={{ "--rows": 6, "--row": "48px" } as CSSProperties}
                      onScroll={() => compute(true)}
                    >
                      {matches.map((workspace) => {
                        const key = `ws:${workspace.id}`;
                        const index = all.indexOf(workspace);
                        return (
                          <div
                            key={workspace.id}
                            id={`${uid}-${key}`}
                            ref={(node) => {
                              if (node) rowRefs.current.set(key, node);
                              else rowRefs.current.delete(key);
                            }}
                            role="option"
                            aria-selected={workspace.id === activeId}
                            data-active={highlighted === key || undefined}
                            className={styles.row}
                            onPointerMove={() => {
                              if (highlighted !== key) setHighlighted(key);
                            }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              setPressed(key);
                            }}
                            onPointerUp={() => setPressed(null)}
                            onPointerLeave={() => setPressed((prev) => (prev === key ? null : prev))}
                            onClick={() => choose(workspace.id, true)}
                          >
                            <Tile workspace={workspace} />
                            <span className={styles.rowText}>
                              <span className={`${styles.rowName} ${styles.truncate}`}>
                                {workspace.name}
                              </span>
                              <span className={`${styles.rowMeta} ${styles.truncate}`}>
                                {workspaceMeta(workspace)}
                              </span>
                            </span>
                            {workspace.role && <span className={styles.role}>{workspace.role}</span>}
                            <span className={styles.slot}>
                              {workspace.id === activeId ? (
                                <Check size={16} className={styles.check} aria-label="Current workspace" />
                              ) : index < 9 ? (
                                <Shortcut index={index + 1} pressed={pressed === key} />
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
                      {!matches.length && (
                        <div className={styles.empty} role="presentation">
                          <span className={styles.emptyTitle}>{`No workspaces match “`}{query.trim()}{`”`}</span>
                          <span className={styles.emptyHint}>Press Enter to create it</span>
                        </div>
                      )}
                    </div>
                    <div role="group" aria-label="Actions" className={styles.footer}>
                      {actions.map(([key, label, Icon]) => (
                        <div
                          key={key}
                          id={`${uid}-${key}`}
                          ref={(node) => {
                            if (node) rowRefs.current.set(key, node);
                            else rowRefs.current.delete(key);
                          }}
                          role="option"
                          aria-selected={false}
                          data-active={highlighted === key || undefined}
                          className={styles.action}
                          onPointerMove={() => {
                            if (highlighted !== key) setHighlighted(key);
                          }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            setPressed(key);
                          }}
                          onPointerUp={() => setPressed(null)}
                          onPointerLeave={() => setPressed((prev) => (prev === key ? null : prev))}
                          onClick={() => goToView(key as "create" | "join")}
                        >
                          <span className={styles.actionIcon}>
                            <Icon size={16} aria-hidden />
                          </span>
                          <span className={styles.truncate}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key={view}
                  className={styles.view}
                  onSubmit={(event) => void submitForm(event, view)}
                  noValidate
                  {...viewAnimation(1)}
                >
                  <div className={styles.formHead}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.back}
                      onClick={() => goToView("list")}
                      aria-label="Back to workspaces"
                    >
                      <ArrowLeft size={16} aria-hidden />
                    </Button>
                    <span className={styles.formTitle}>
                      {view === "create" ? "Create workspace" : "Join with invite"}
                    </span>
                  </div>
                  <div className={styles.formBody}>
                    {view === "create" ? (
                      <>
                        <div className={styles.preview}>
                          <Swap
                            swapKey={draft.name.charAt(0).toUpperCase()}
                            reduced={reduced}
                          >
                            <Tile workspace={draft} size={40} />
                          </Swap>
                          <span className={styles.rowText}>
                            <span
                              className={`${styles.rowName} ${styles.truncate}${
                                createName.trim() ? "" : ` ${styles.placeholderName}`
                              }`}
                            >
                              {draft.name}
                            </span>
                            <span className={`${styles.rowMeta} ${styles.truncate}`}>
                              {createName.trim()
                                ? `/${slugify(createName) || "workspace"}`
                                : "Free plan"}
                              {" · You are the owner"}
                            </span>
                          </span>
                        </div>
                        <Input
                          label="Workspace name"
                          autoFocus
                          value={createName}
                          maxLength={48}
                          placeholder="Northwind Labs"
                          autoComplete="off"
                          error={formError}
                          onChange={(event) => {
                            setCreateName(event.target.value);
                            if (formError) setFormError(undefined);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <div className={styles.preview}>
                          {invitePreview ? (
                            <Swap swapKey={invitePreview.id} reduced={reduced}>
                              <Tile workspace={invitePreview} size={40} />
                            </Swap>
                          ) : (
                            <span className={styles.tileEmpty} aria-hidden="true" />
                          )}
                          <span className={styles.rowText}>
                            <Swap
                              swapKey={invitePreview?.id ?? "none"}
                              reduced={reduced}
                              className={styles.truncate}
                            >
                              <span
                                className={`${styles.rowName} ${styles.truncate}${
                                  invitePreview ? "" : ` ${styles.placeholderName}`
                                }`}
                              >
                                {invitePreview?.name ?? "No invite yet"}
                              </span>
                            </Swap>
                            <Swap
                              swapKey={`m:${invitePreview?.id ?? "none"}`}
                              reduced={reduced}
                              className={styles.truncate}
                            >
                              <span
                                className={`${styles.rowMeta} ${styles.truncate}${
                                  invitePreview ? "" : ` ${styles.placeholderName}`
                                }`}
                              >
                                {invitePreview
                                  ? `Invited as ${invitePreview.role ?? "Member"} · ${
                                      invitePreview.members != null
                                        ? memberCount(invitePreview.members)
                                        : "Pending"
                                    }`
                                  : "Paste a link to preview the workspace"}
                              </span>
                            </Swap>
                          </span>
                        </div>
                        <Input
                          label="Invite link or code"
                          autoFocus
                          value={invite}
                          placeholder="https://resend.com/invite/…"
                          autoComplete="off"
                          spellCheck={false}
                          error={formError}
                          onChange={(event) => {
                            setInvite(event.target.value);
                            if (formError) setFormError(undefined);
                          }}
                        />
                        {!onJoinWorkspace && (
                          <button
                            type="button"
                            className={styles.sample}
                            disabled={!availableInvite}
                            onClick={() => {
                              if (!availableInvite) return;
                              setInvite(availableInvite.link);
                              setFormError(undefined);
                            }}
                          >
                            {availableInvite ? "Use a sample invite" : "Sample invites used"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.formFoot}>
                    <Button type="button" variant="ghost" size="sm" onClick={() => goToView("list")}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" loading={submitting}>
                      {view === "create"
                        ? submitting
                          ? "Creating"
                          : "Create workspace"
                        : submitting
                          ? "Joining"
                          : "Join workspace"}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

export default TeamSwitcher;
