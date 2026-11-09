"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, CircleAlert, Lock, Search, X } from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./connector-setup.module.css";

export type ConnectorMarkId = "slack" | "github" | "notion" | "google-drive" | "linear" | "jira" | "salesforce" | "hubspot";

export interface ConnectorSync {
  count: number;
  noun: string;
}

export interface Connector {
  id: string;
  name: string;
  /** A built-in mark id or your own 20px node. */
  mark?: ConnectorMarkId | ReactNode;
  description: string;
  host?: string;
  account?: string;
  scopes?: string[];
  sync?: ConnectorSync;
  keywords?: string[];
}

export interface ConnectResult {
  account?: string;
  scopes?: string[];
  synced?: number;
}

export type ConnectPhase = "redirecting" | "authorizing" | "syncing";

export interface ConnectReport {
  phase?: ConnectPhase;
  synced?: number;
}

export interface ConnectOptions {
  signal: AbortSignal;
  report: (report: ConnectReport) => void;
}

export interface DisconnectOptions {
  signal: AbortSignal;
}

export type ConnectorState =
  | { status: "connecting"; phase: ConnectPhase; synced: number }
  | { status: "error"; message: string };

export interface ConnectorDetails {
  account?: string;
  scopes: string[];
  synced?: number;
}

export interface ConnectorSetupProps {
  connectors?: Connector[];
  connected?: string[];
  defaultConnected?: string[];
  onConnectedChange?: (ids: string[]) => void;
  connect?: (connector: Connector, options: ConnectOptions) => Promise<ConnectResult | void>;
  disconnect?: (connector: Connector, options: DisconnectOptions) => Promise<void>;
  onConnect?: (connector: Connector, result: ConnectorDetails) => void;
  onDisconnect?: (connector: Connector) => void;
  assistantName?: string;
  title?: ReactNode;
  description?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  autoPlay?: boolean;
  footer?: ReactNode;
  className?: string;
}

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const count = (value: number) => Math.round(value).toLocaleString("en-US");

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

type MarkShape = { viewBox: string; paths: Array<{ d: string; fill: string }> };

const MARKS: Record<ConnectorMarkId, MarkShape> = {
  slack: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "#E01E5A", d: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" },
      { fill: "#36C5F0", d: "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" },
      { fill: "#2EB67D", d: "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" },
      { fill: "#ECB22E", d: "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" },
    ],
  },
  github: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "currentColor", d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
    ],
  },
  notion: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "currentColor", d: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" },
    ],
  },
  "google-drive": {
    viewBox: "0 -4.65 87.3 87.3",
    paths: [
      { fill: "#0066DA", d: "m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" },
      { fill: "#00AC47", d: "m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" },
      { fill: "#EA4335", d: "m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" },
      { fill: "#00832D", d: "m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" },
      { fill: "#2684FC", d: "m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" },
      { fill: "#FFBA00", d: "m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" },
    ],
  },
  linear: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "currentColor", d: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" },
    ],
  },
  jira: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "#1868DB", d: "M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" },
    ],
  },
  salesforce: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "#00A1E0", d: "M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8" },
    ],
  },
  hubspot: {
    viewBox: "0 0 24 24",
    paths: [
      { fill: "#FF7A59", d: "M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" },
    ],
  },
};

/** The built-in app marks at any size, for use elsewhere in a settings UI. */
export function ConnectorMark({ mark, size = 20 }: { mark: ConnectorMarkId | ReactNode; size?: number }) {
  if (typeof mark === "string" && mark in MARKS) {
    const shape = MARKS[mark as ConnectorMarkId];
    return (
      <svg width={size} height={size} viewBox={shape.viewBox} aria-hidden="true" focusable="false">
        {shape.paths.map((path) => (
          <path key={path.d} fill={path.fill} d={path.d} />
        ))}
      </svg>
    );
  }
  return <Fragment>{mark}</Fragment>;
}

const SAMPLE = [
  {
    id: "slack",
    name: "Slack",
    mark: "slack",
    host: "slack.com",
    account: "northwind.slack.com",
    description: "Search channels and threads, post replies",
    scopes: ["Read messages in public channels", "Search message history", "Post replies as Claude"],
    sync: { count: 1204, noun: "messages" },
    keywords: ["chat", "messages"],
  },
  {
    id: "github",
    name: "GitHub",
    mark: "github",
    host: "github.com",
    account: "northwind-labs",
    description: "Read code, issues and pull requests",
    scopes: ["Read code in 12 repositories", "Read and write issues", "Comment on pull requests"],
    sync: { count: 342, noun: "pull requests" },
    keywords: ["code", "git", "repos"],
  },
  {
    id: "notion",
    name: "Notion",
    mark: "notion",
    host: "notion.so",
    account: "Northwind HQ",
    description: "Search pages, docs and databases",
    scopes: ["Read pages shared with Claude", "Search workspace content", "Create pages in Drafts"],
    sync: { count: 2318, noun: "pages" },
    keywords: ["docs", "wiki"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    mark: "google-drive",
    host: "accounts.google.com",
    account: "maya@northwind.co",
    description: "Find docs, sheets and slides",
    scopes: ["View files you open or share", "Search file names and content", "Export files to PDF"],
    sync: { count: 5612, noun: "files" },
    keywords: ["docs", "sheets", "files", "google"],
  },
  {
    id: "linear",
    name: "Linear",
    mark: "linear",
    host: "linear.app",
    account: "Northwind · NOR",
    description: "Create, triage and update issues",
    scopes: ["Read issues and projects", "Create and update issues", "Comment on issues"],
    sync: { count: 864, noun: "issues" },
    keywords: ["issues", "tickets", "projects"],
  },
  {
    id: "jira",
    name: "Jira",
    mark: "jira",
    host: "id.atlassian.com",
    account: "northwind.atlassian.net",
    description: "Track tickets across Atlassian projects",
    scopes: ["Read issues in 4 projects", "Transition issue status", "Add comments and worklogs"],
    sync: { count: 1977, noun: "issues" },
    keywords: ["atlassian", "tickets"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    mark: "salesforce",
    host: "login.salesforce.com",
    account: "Northwind Traders",
    description: "Look up accounts and opportunities",
    scopes: ["Read accounts and contacts", "Read opportunities", "Log activity on records"],
    sync: { count: 428, noun: "opportunities" },
    keywords: ["crm", "sales"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    mark: "hubspot",
    host: "app.hubspot.com",
    account: "Portal 24019837",
    description: "Read contacts, deals and notes",
    scopes: ["Read contacts and companies", "Read deals and pipelines", "Create notes on records"],
    sync: { count: 3140, noun: "contacts" },
    keywords: ["crm", "marketing"],
  },
] satisfies Connector[];

/** The sample run needs admin approval on its first Salesforce attempt, so the demo can show Retry. */
const BLOCKED: Record<string, string> = { salesforce: "Needs admin approval" };

/** One crossfade in a shared grid cell, so the row never reflows while the status changes. */
function Swap({ swapKey, children, className, reduced }: { swapKey: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <SwapItem key={swapKey} reduced={reduced}>
          {children}
        </SwapItem>
      </AnimatePresence>
    </span>
  );
}

function SwapItem({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={styles.swapItem}
      data-leaving={present ? undefined : ""}
      aria-hidden={!present || undefined}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.16 * (reduced ? 0 : 1), ease: EASE } }}
      exit={{ opacity: 0, y: 0, transition: { duration: 0.1 * (reduced ? 0 : 1), ease: EASE } }}
    >
      {children}
    </motion.span>
  );
}

/** The sync count rolls in tabular numerals inside a box reserved for its final width, so the line never jitters. */
function SyncCount({ value, final }: { value: number; final: number }) {
  return (
    <span className={styles.num}>
      <span className={styles.numGhost} aria-hidden="true">
        {count(final)}
      </span>
      <span className={styles.numLive}>{count(value)}</span>
    </span>
  );
}

export function ConnectorSetup({
  connectors,
  connected,
  defaultConnected,
  onConnectedChange,
  connect,
  disconnect,
  onConnect,
  onDisconnect,
  assistantName = "Claude",
  title = "Connect your tools",
  description,
  searchable = true,
  searchPlaceholder = "Search apps",
  autoPlay,
  footer,
  className,
}: ConnectorSetupProps) {
  const isDemo = connectors === undefined;
  const items = connectors ?? SAMPLE;
  const reduced = useReducedMotion() ?? false;
  const uid = useId();

  const [internal, setInternal] = useState<string[]>(() => defaultConnected ?? (isDemo ? ["github", "google-drive"] : []));
  const value = connected ?? internal;
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const [states, setStates] = useState<Record<string, ConnectorState | undefined>>({});
  const [details, setDetails] = useState<Record<string, ConnectorDetails | undefined>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState("");

  const calls = useRef(new Map<string, AbortController>());
  const attempts = useRef(new Map<string, number>());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      calls.current.forEach((controller) => controller.abort());
    },
    [],
  );

  const setValue = useCallback(
    (ids: string[]) => {
      valueRef.current = ids;
      if (connected === undefined) setInternal(ids);
      onConnectedChange?.(ids);
    },
    [connected, onConnectedChange],
  );

  const patch = useCallback((id: string, next: ConnectorState | undefined) => {
    setStates((current) => ({ ...current, [id]: next }));
  }, []);

  const announce = useCallback((text: string, simulated: boolean) => {
    setLive(simulated ? `${text} Simulated, nothing was sent.` : text);
  }, []);

  /** The built-in handshake: redirect, authorize, then a first sync that counts up over 960ms. */
  const simulate = useCallback(
    async (connector: Connector, { signal, report }: ConnectOptions) => {
      const attempt = attempts.current.get(connector.id) ?? 1;
      await wait(560, signal);
      report({ phase: "authorizing" });
      await wait(680, signal);
      const blocked = isDemo ? BLOCKED[connector.id] : undefined;
      if (blocked && attempt === 1) throw new Error(blocked);
      report({ phase: "syncing", synced: 0 });
      const total = connector.sync?.count ?? 0;
      if (total > 0) {
        await new Promise<void>((resolve, reject) => {
          const started = performance.now();
          let frame = 0;
          const tick = (now: number) => {
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            const t = Math.min(1, (now - started) / 960);
            report({ synced: Math.round(total * (1 - Math.pow(1 - t, 3))) });
            if (t < 1) frame = requestAnimationFrame(tick);
            else resolve();
          };
          frame = requestAnimationFrame(tick);
          signal.addEventListener(
            "abort",
            () => {
              cancelAnimationFrame(frame);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      } else {
        await wait(640, signal);
      }
      await wait(180, signal);
      return { account: connector.account, scopes: connector.scopes, synced: total };
    },
    [isDemo],
  );

  const startConnect = useCallback(
    async (connector: Connector) => {
      calls.current.get(connector.id)?.abort();
      const controller = new AbortController();
      calls.current.set(connector.id, controller);
      attempts.current.set(connector.id, (attempts.current.get(connector.id) ?? 0) + 1);
      const simulated = !connect;

      patch(connector.id, { status: "connecting", phase: "redirecting", synced: 0 });
      announce(`Connecting ${connector.name}.`, simulated);

      try {
        const result =
          (await (connect ?? simulate)(connector, {
            signal: controller.signal,
            report: (next) => {
              if (controller.signal.aborted) return;
              setStates((current) => {
                const state = current[connector.id];
                if (!state || state.status !== "connecting") return current;
                return {
                  ...current,
                  [connector.id]: { status: "connecting", phase: next.phase ?? state.phase, synced: next.synced ?? state.synced },
                };
              });
            },
          })) ?? {};
        if (controller.signal.aborted) return;

        const resolved: ConnectorDetails = {
          account: result.account ?? connector.account,
          scopes: result.scopes ?? connector.scopes ?? [],
          synced: result.synced ?? connector.sync?.count,
        };
        setDetails((current) => ({ ...current, [connector.id]: resolved }));
        patch(connector.id, undefined);
        if (!valueRef.current.includes(connector.id)) setValue([...valueRef.current, connector.id]);
        setConfirmId(null);
        setOpenId(connector.id);
        onConnect?.(connector, resolved);

        const syncedText = resolved.synced && connector.sync ? ` ${count(resolved.synced)} ${connector.sync.noun} synced.` : "";
        announce(`${connector.name} connected.${syncedText}`, simulated);
      } catch (error) {
        if (controller.signal.aborted) {
          patch(connector.id, undefined);
          announce(`${connector.name} connection cancelled.`, false);
          return;
        }
        const message = error instanceof Error && error.message ? error.message : `Could not connect ${connector.name}`;
        patch(connector.id, { status: "error", message });
        announce(`${connector.name} failed to connect: ${message}.`, simulated);
      } finally {
        if (calls.current.get(connector.id) === controller) calls.current.delete(connector.id);
      }
    },
    [announce, connect, onConnect, patch, setValue, simulate],
  );

  const cancelConnect = useCallback((connector: Connector) => {
    calls.current.get(connector.id)?.abort();
  }, []);

  const revoke = useCallback(
    async (connector: Connector) => {
      const controller = new AbortController();
      calls.current.set(connector.id, controller);
      setBusyId(connector.id);
      try {
        if (disconnect) await disconnect(connector, { signal: controller.signal });
        else await wait(420, controller.signal);
        setValue(valueRef.current.filter((id) => id !== connector.id));
        setDetails((current) => {
          const next = { ...current };
          delete next[connector.id];
          return next;
        });
        setOpenId((current) => (current === connector.id ? null : current));
        setConfirmId(null);
        onDisconnect?.(connector);
        announce(`${connector.name} disconnected. ${assistantName} no longer has access.`, !disconnect);
      } catch (error) {
        if (!controller.signal.aborted) {
          announce(`Could not disconnect ${connector.name}. ${error instanceof Error ? error.message : ""}`.trim(), !disconnect);
        }
      } finally {
        setBusyId(null);
        if (calls.current.get(connector.id) === controller) calls.current.delete(connector.id);
      }
    },
    [announce, assistantName, disconnect, onDisconnect, setValue],
  );

  const auto = autoPlay ?? (isDemo && !connect);
  const stopped = useRef({ stopped: false });

  useEffect(() => {
    const element = rootRef.current;
    if (!auto || !element) return;
    const flag = stopped.current;
    flag.stopped = false;
    const stop = () => {
      flag.stopped = true;
    };
    element.addEventListener("pointerdown", stop);
    element.addEventListener("keydown", stop);

    const controller = new AbortController();
    const find = (id: string) => items.find((item) => item.id === id);
    let entered = false;

    const run = async () => {
      const slack = find("slack");
      const salesforce = find("salesforce");
      try {
        await wait(600, controller.signal);
        if (flag.stopped || !slack || valueRef.current.includes("slack")) return;
        await startConnect(slack);
        await wait(2600, controller.signal);
        if (flag.stopped || !salesforce || valueRef.current.includes("salesforce")) return;
        setOpenId(null);
        await wait(240, controller.signal);
        if (flag.stopped) return;
        await startConnect(salesforce);
        await wait(1500, controller.signal);
        if (flag.stopped) return;
        await startConnect(salesforce);
      } catch {
        /* An aborted run leaves the rows wherever they stopped. */
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entered || !entries.some((entry) => entry.isIntersecting)) return;
        entered = true;
        observer.disconnect();
        void run();
      },
      { threshold: 0.35 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      controller.abort();
      element.removeEventListener("pointerdown", stop);
      element.removeEventListener("keydown", stop);
    };
  }, [auto]);

  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      term
        ? items.filter((item) => [item.name, item.description, item.account ?? "", ...(item.keywords ?? [])].some((entry) => entry.toLowerCase().includes(term)))
        : items,
    [items, term],
  );

  const connectedTotal = items.filter((item) => value.includes(item.id)).length;
  const detailsTransition: Transition = reduced
    ? { duration: 0 }
    : { height: { type: "spring", visualDuration: 0.24, bounce: 0 }, opacity: { duration: 0.16, ease: EASE } };

  const footerNode =
    footer === undefined ? (
      <Fragment>
        <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>
          {assistantName} only sees what you grant.
        </span>
      </Fragment>
    ) : (
      footer
    );

  return (
    <div ref={rootRef} className={cx(styles.root, className)} role="group" aria-labelledby={`${uid}-title`}>
      <div className={styles.header}>
        <div className={styles.headText}>
          <h3 id={`${uid}-title`} className={styles.title}>
            {title}
          </h3>
          <p className={styles.description}>{description ?? `Let ${assistantName} search and act in the apps your team uses.`}</p>
        </div>
        <span className={styles.count}>
          <span className={styles.srOnly}>
            {connectedTotal} of {items.length} connected
          </span>
          <span className={styles.countVisual} aria-hidden="true">
            <Swap swapKey={String(connectedTotal)} reduced={reduced} className={styles.countNum}>
              {connectedTotal}
            </Swap>
            <span>
              of {items.length} connected
            </span>
          </span>
        </span>
      </div>

      {searchable ? (
        <div className={styles.search}>
          <Search className={styles.searchIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            aria-label="Search apps"
            aria-controls={`${uid}-list`}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
          <AnimatePresence initial={false}>
            {query ? (
              <motion.button
                key="clear"
                type="button"
                className={styles.clear}
                aria-label="Clear search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 * (reduced ? 0 : 1) }}
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {filtered.length ? (
        <ul id={`${uid}-list`} className={styles.list} aria-label="Apps">
          {filtered.map((connector) => {
            const state = states[connector.id];
            const status: string = state ? state.status : value.includes(connector.id) ? "connected" : "available";
            const saved = details[connector.id];
            const expanded = status === "connected" && openId === connector.id;
            const total = connector.sync?.count ?? 0;
            const detailsId = `${uid}-${connector.id}-details`;
            const account = saved?.account ?? connector.account;
            const synced = saved?.synced ?? total;

            let key: string = status;
            let line: ReactNode = connector.description;
            if (state?.status === "connecting") {
              key = state.phase;
              line =
                state.phase === "redirecting" ? (
                  <TextShimmer>{`Redirecting to ${connector.host ?? connector.name}`}</TextShimmer>
                ) : state.phase === "authorizing" ? (
                  <TextShimmer>{`Authorizing ${account ?? connector.name}`}</TextShimmer>
                ) : connector.sync ? (
                  <span className={styles.syncLine}>
                    Syncing <SyncCount value={state.synced} final={total} /> {connector.sync.noun}
                  </span>
                ) : (
                  <TextShimmer>Syncing</TextShimmer>
                );
            } else if (state?.status === "error") {
              key = `error-${state.message}`;
              line = (
                <span className={styles.errorLine}>
                  <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.ellipsis}>{state.message}</span>
                </span>
              );
            } else if (status === "connected") {
              line = [account, connector.sync && synced ? `${count(synced)} ${connector.sync.noun}` : null].filter(Boolean).join(" · ") || connector.description;
            }

            const action =
              status === "available" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className={cx(styles.action, styles.connect)}
                  onClick={() => void startConnect(connector)}
                  aria-label={`Connect ${connector.name}`}
                >
                  Connect
                </Button>
              ) : status === "connecting" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className={styles.action}
                  onClick={() => cancelConnect(connector)}
                  aria-label={`Cancel connecting ${connector.name}`}
                >
                  Cancel
                </Button>
              ) : status === "error" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className={cx(styles.action, styles.connect)}
                  onClick={() => void startConnect(connector)}
                  aria-label={`Retry connecting ${connector.name}`}
                >
                  Retry
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cx(styles.action, styles.connectedBtn)}
                  aria-expanded={expanded}
                  aria-controls={detailsId}
                  aria-label={`${connector.name} connected. ${expanded ? "Hide" : "Show"} access details`}
                  onClick={() => {
                    setConfirmId(null);
                    setOpenId(expanded ? null : connector.id);
                  }}
                >
                  <Check className={styles.ok} size={16} strokeWidth={2} aria-hidden="true" />
                  <span className={styles.connectedLabel}>Connected</span>
                  <ChevronDown className={styles.chevron} data-open={expanded || undefined} size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              );

            const confirming = confirmId === connector.id;

            return (
              <li key={connector.id} className={styles.row} data-status={status} data-active={status === "connecting" || expanded || undefined}>
                <div className={styles.rowMain}>
                  <span className={styles.mark} data-mark={typeof connector.mark === "string" ? connector.mark : undefined}>
                    <ConnectorMark mark={connector.mark} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{connector.name}</span>
                    <Swap
                      swapKey={key}
                      reduced={reduced}
                      className={cx(styles.line, status === "connecting" && styles.lineLive, status === "error" && styles.lineError)}
                    >
                      {typeof line === "string" ? <span className={styles.ellipsis}>{line}</span> : line}
                    </Swap>
                  </span>
                  <span className={styles.actionSlot}>
                    <Swap swapKey={status} reduced={reduced} className={styles.actionSwap}>
                      {action}
                    </Swap>
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {state?.status === "connecting" ? (
                    <motion.span
                      key="progress"
                      className={styles.track}
                      aria-hidden="true"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.2 * (reduced ? 0 : 1), delay: 0.08 * (reduced ? 0 : 1) } }}
                      transition={{ duration: 0.16 * (reduced ? 0 : 1) }}
                    >
                      <motion.span
                        className={styles.fill}
                        initial={{ scaleX: 0 }}
                        animate={{
                          scaleX:
                            state.phase === "redirecting"
                              ? 0.16
                              : state.phase === "authorizing"
                                ? 0.4
                                : 0.4 + 0.6 * (total > 0 ? Math.min(1, state.synced / total) : 0.5),
                        }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : state.phase === "syncing"
                              ? { duration: 0.12, ease: "linear" }
                              : { duration: 0.24, ease: EASE }
                        }
                      />
                    </motion.span>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      key="details"
                      id={detailsId}
                      className={styles.detailsClip}
                      role="region"
                      aria-label={`${connector.name} access`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={detailsTransition}
                    >
                      <div className={styles.details}>
                        <span className={styles.detailsLabel}>{assistantName} can</span>
                        <ul className={styles.scopes}>
                          {(saved?.scopes ?? connector.scopes ?? []).map((scope) => (
                            <li key={scope} className={styles.scope}>
                              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                              <span className={styles.scopeText}>{scope}</span>
                            </li>
                          ))}
                        </ul>
                        <div className={styles.detailsFoot}>
                          <Swap swapKey={confirming ? "confirm" : "idle"} reduced={reduced} className={styles.footSwap}>
                            {confirming ? (
                              <span
                                className={styles.footRow}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.stopPropagation();
                                    setConfirmId(null);
                                  }
                                }}
                              >
                                <span className={cx(styles.footText, styles.confirmText, styles.ellipsis)}>Remove access?</span>
                                <span className={styles.footActions}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={cx(styles.action, styles.keep)}
                                    onClick={() => setConfirmId(null)}
                                    disabled={busyId === connector.id}
                                  >
                                    Keep
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    className={styles.action}
                                    aria-label={`Disconnect ${connector.name} and remove ${assistantName}'s access`}
                                    loading={busyId === connector.id}
                                    onClick={() => void revoke(connector)}
                                    autoFocus
                                  >
                                    Disconnect
                                  </Button>
                                </span>
                              </span>
                            ) : (
                              <span className={styles.footRow}>
                                <span className={cx(styles.footText, styles.ellipsis)}>{saved ? "Synced just now" : "Synced 12 min ago"}</span>
                                <span className={styles.footActions}>
                                  <Button size="sm" variant="secondary" className={styles.action} onClick={() => setConfirmId(connector.id)}>
                                    Disconnect
                                  </Button>
                                </span>
                              </span>
                            )}
                          </Swap>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      ) : (
        <div id={`${uid}-list`} className={styles.empty}>
          <p className={styles.emptyTitle}>No apps match “{query.trim()}”</p>
          <p className={styles.emptyCopy}>Try a product name or a category like crm or docs.</p>
          <Button
            size="sm"
            variant="secondary"
            className={styles.action}
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            Clear search
          </Button>
        </div>
      )}

      {footerNode ? <div className={styles.footer}>{footerNode}</div> : null}

      <span className={styles.srOnly} role="status" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

export default ConnectorSetup;
