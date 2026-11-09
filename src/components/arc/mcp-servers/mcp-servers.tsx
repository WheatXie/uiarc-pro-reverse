"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type SVGProps,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  FlaskConical,
  KeyRound,
  PencilLine,
  Plus,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { avatar as mediaAvatar } from "../lib/media";
import { Button } from "../button/button";
import { Input } from "../input/input";
import { SearchField } from "../search-field/search-field";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { Avatar } from "../avatar/avatar";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./mcp-servers.module.css";

export type McpTransport = "remote" | "local";
export type McpServerStatus = "connected" | "needs-auth" | "error";
export type McpAccess = "read" | "write";
export type McpPermission = "ask" | "allow-reads";
export type McpAuth = "oauth" | "none";

/** Brand ids that ship a real mark. Leave `brand` unset for the generic MCP mark. */
export type McpBrand =
  | "github"
  | "linear"
  | "notion"
  | "slack"
  | "sentry"
  | "stripe"
  | "postgresql"
  | "figma"
  | "vercel"
  | "supabase"
  | "cloudflare"
  | "googledrive"
  | "atlassian"
  | "datadog"
  | "hubspot"
  | "asana"
  | "posthog"
  | "airtable"
  | "docker"
  | "zendesk"
  | "intercom"
  | "gmail"
  | "googlecalendar";

/** One tool a server reports. */
export interface McpTool {
  /** Stable id, usually the tool name. */
  id: string;
  /** The name the model sees, for example create_issue. */
  name: string;
  /** Read tools only fetch; write tools change something. */
  access: McpAccess;
  /** Tokens the tool's name, description and input schema take in context. */
  tokens: number;
  /** Whether the tool is loaded into the agent's context. Reads default on, writes off. */
  enabled?: boolean;
}

/** One MCP server the agent can call tools on. */
export interface McpServer {
  id: string;
  name: string;
  /** Which real mark to draw; the generic MCP logo when unset. */
  brand?: McpBrand;
  transport: McpTransport;
  endpoint?: string;
  status: McpServerStatus;
  /** Short reason tools/list failed, shown in the open row. */
  error?: string;
  /** The default for tool calls on this server. */
  permission?: McpPermission;
  /** What an OAuth grant asks for, shown on the authorize screen. */
  scopes?: string[];
  tools: McpTool[];
}

/** One entry the Add server sheet offers. */
export interface McpDirectoryEntry {
  id: string;
  name: string;
  brand?: McpBrand;
  /** One line under the name in the directory. */
  description: string;
  transport: McpTransport;
  endpoint?: string;
  auth: McpAuth;
  scopes?: string[];
  tools: McpTool[];
}

/** What the sheet asks you to connect, so a real client can open its consent window. */
export interface McpConnectRequest {
  kind: "directory" | "url" | "reconnect" | "retry";
  serverId: string;
  name: string;
  transport: McpTransport;
  endpoint?: string;
}

/** The signed in person shown on the authorize screen. */
export interface McpAccount {
  name: string;
  email: string;
  avatar?: string;
}

export interface McpServersProps {
  /** The agent's servers. Leave unset for the simulated demo; a new array replaces the list. */
  servers?: McpServer[];
  /** What Add server offers. Entries whose id is already in the list read Added. */
  directory?: McpDirectoryEntry[];
  /** Tokens of context you are willing to spend on tool definitions. */
  budget?: number;
  /** Heading of the card. */
  title?: string;
  /** Your agent's name on the authorize screen. */
  clientName?: string;
  /** Your agent's own mark, shown shaking hands with the server's mark. */
  clientMark?: ReactElement;
  /** The signed in person shown on the authorize screen. */
  account?: McpAccount;
  /** Called when a tool is switched on or off in a server's list. */
  onToggleTool?: (serverId: string, toolId: string, enabled: boolean) => void;
  /** Called when a server connects; resolve with the tools it reported. */
  onConnect?: (request: McpConnectRequest) => void | McpTool[] | Promise<void | McpTool[]>;
  /** Called once a removal's undo window closes. */
  onRemove?: (serverId: string) => void;
  /** Called when a server's default for tool calls changes. */
  onPermissionChange?: (serverId: string, permission: McpPermission) => void;
  /** Class on the root element. */
  className?: string;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

function formatTokens(value: number) {
  if (value < 1e3) return `${Math.round(value)}`;
  const scaled = Math.round(value / 100) / 10;
  return `${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}k`;
}

/** Tokens a server actually loads: only enabled tools of a connected server count. */
function serverTokens(server: McpServer) {
  return server.status === "connected" ? server.tools.reduce((sum, tool) => sum + (tool.enabled ? tool.tokens : 0), 0) : 0;
}

/** The scopes an OAuth grant asks for, derived from the tools when the server does not name them. */
function scopesFor(tools: McpTool[], name: string) {
  const reads = tools.filter(tool => tool.access === "read").length;
  const writes = tools.length - reads;
  return [reads ? `Read data in ${name}` : null, writes ? `Make changes in ${name} when you allow it` : null].filter((scope): scope is string => !!scope);
}

const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];
/** Rows and the meter resize on a critically damped spring, so nothing overshoots its track. */
const resizeSpring: Transition = { type: "spring", visualDuration: 0.3, bounce: 0 };
const enterTransition: Transition = { duration: motionTokens.duration.fast, ease: enterEase };
const exitTransition: Transition = { duration: 0.1, ease: standardEase };

type MarkProps = SVGProps<SVGSVGElement> & { title?: string };

export const seedServers: McpServer[] = [
  {
    id: "github", name: "GitHub", brand: "github", transport: "remote",
    endpoint: "https://api.githubcopilot.com/mcp/",
    status: "connected", permission: "allow-reads",
    tools: [
      { id: "search_code", name: "search_code", access: "read", tokens: 420, enabled: true },
      { id: "get_pull_request", name: "get_pull_request", access: "read", tokens: 290, enabled: true },
      { id: "list_issues", name: "list_issues", access: "read", tokens: 400, enabled: true },
      { id: "create_issue", name: "create_issue", access: "write", tokens: 420, enabled: true },
      { id: "create_pull_request", name: "create_pull_request", access: "write", tokens: 640, enabled: true },
      { id: "merge_pull_request", name: "merge_pull_request", access: "write", tokens: 360, enabled: false },
    ],
  },
  {
    id: "linear", name: "Linear", brand: "linear", transport: "remote",
    endpoint: "https://mcp.linear.app/mcp",
    status: "connected", permission: "allow-reads",
    tools: [
      { id: "list_issues", name: "list_issues", access: "read", tokens: 310, enabled: true },
      { id: "get_issue", name: "get_issue", access: "read", tokens: 260, enabled: true },
      { id: "create_issue", name: "create_issue", access: "write", tokens: 450, enabled: true },
      { id: "update_issue", name: "update_issue", access: "write", tokens: 480, enabled: false },
      { id: "list_projects", name: "list_projects", access: "read", tokens: 260, enabled: false },
    ],
  },
  {
    id: "notion", name: "Notion", brand: "notion", transport: "remote",
    endpoint: "https://mcp.notion.com/mcp",
    status: "needs-auth", permission: "ask",
    scopes: ["Search and read pages you share with it", "Create pages and add comments"],
    tools: [
      { id: "search", name: "search", access: "read", tokens: 380, enabled: true },
      { id: "fetch", name: "fetch", access: "read", tokens: 300, enabled: true },
      { id: "create_pages", name: "create_pages", access: "write", tokens: 520, enabled: false },
      { id: "update_page", name: "update_page", access: "write", tokens: 460, enabled: false },
    ],
  },
  {
    id: "slack", name: "Slack", brand: "slack", transport: "remote",
    endpoint: "https://mcp.slack.com/mcp",
    status: "connected", permission: "ask",
    tools: [
      { id: "search_messages", name: "search_messages", access: "read", tokens: 360, enabled: true },
      { id: "get_thread", name: "get_thread", access: "read", tokens: 280, enabled: false },
      { id: "list_channels", name: "list_channels", access: "read", tokens: 240, enabled: true },
      { id: "post_message", name: "post_message", access: "write", tokens: 420, enabled: true },
    ],
  },
  {
    id: "sentry", name: "Sentry", brand: "sentry", transport: "remote",
    endpoint: "https://mcp.sentry.dev/mcp",
    status: "error", permission: "allow-reads",
    error: "tools/list timed out after 30 seconds",
    tools: [
      { id: "search_issues", name: "search_issues", access: "read", tokens: 330, enabled: true },
      { id: "get_issue_details", name: "get_issue_details", access: "read", tokens: 410, enabled: true },
      { id: "update_issue_status", name: "update_issue_status", access: "write", tokens: 300, enabled: false },
    ],
  },
  {
    id: "stripe", name: "Stripe", brand: "stripe", transport: "remote",
    endpoint: "https://mcp.stripe.com",
    status: "connected", permission: "ask",
    tools: [
      { id: "list_customers", name: "list_customers", access: "read", tokens: 320, enabled: true },
      { id: "list_invoices", name: "list_invoices", access: "read", tokens: 290, enabled: true },
      { id: "create_refund", name: "create_refund", access: "write", tokens: 350, enabled: false },
      { id: "create_payment_link", name: "create_payment_link", access: "write", tokens: 420, enabled: false },
    ],
  },
  {
    id: "postgresql", name: "PostgreSQL", brand: "postgresql", transport: "local",
    endpoint: "npx @northwind/mcp-postgres postgres://localhost/analytics",
    status: "connected", permission: "allow-reads",
    tools: [
      { id: "query", name: "query", access: "read", tokens: 290, enabled: true },
      { id: "list_tables", name: "list_tables", access: "read", tokens: 180, enabled: true },
      { id: "describe_table", name: "describe_table", access: "read", tokens: 260, enabled: true },
    ],
  },
  {
    id: "figma", name: "Figma", brand: "figma", transport: "local",
    endpoint: "http://127.0.0.1:3845/mcp",
    status: "connected", permission: "allow-reads",
    tools: [
      { id: "get_design_context", name: "get_design_context", access: "read", tokens: 610, enabled: true },
      { id: "get_screenshot", name: "get_screenshot", access: "read", tokens: 240, enabled: true },
      { id: "get_variable_defs", name: "get_variable_defs", access: "read", tokens: 300, enabled: false },
    ],
  },
];

export const sampleDirectory: McpDirectoryEntry[] = [
  {
    id: "vercel", name: "Vercel", brand: "vercel",
    description: "Deployments, build logs and project settings", transport: "remote",
    endpoint: "https://mcp.vercel.com", auth: "oauth",
    scopes: ["Read projects, deployments and build logs", "Create preview deployments"],
    tools: [
      { id: "list_projects", name: "list_projects", access: "read", tokens: 240 },
      { id: "list_deployments", name: "list_deployments", access: "read", tokens: 310 },
      { id: "get_build_logs", name: "get_build_logs", access: "read", tokens: 380 },
      { id: "create_deployment", name: "create_deployment", access: "write", tokens: 460 },
      { id: "promote_deployment", name: "promote_deployment", access: "write", tokens: 330 },
    ],
  },
  {
    id: "supabase", name: "Supabase", brand: "supabase",
    description: "Tables, SQL and edge functions", transport: "remote",
    endpoint: "https://mcp.supabase.com/mcp", auth: "oauth",
    scopes: ["Read tables and run read only SQL", "Apply migrations and deploy functions"],
    tools: [
      { id: "list_tables", name: "list_tables", access: "read", tokens: 220 },
      { id: "execute_sql", name: "execute_sql", access: "read", tokens: 360 },
      { id: "apply_migration", name: "apply_migration", access: "write", tokens: 420 },
      { id: "deploy_edge_function", name: "deploy_edge_function", access: "write", tokens: 480 },
    ],
  },
  {
    id: "datadog", name: "Datadog", brand: "datadog",
    description: "Metrics, monitors and logs", transport: "remote",
    endpoint: "https://mcp.datadoghq.com/mcp", auth: "oauth",
    scopes: ["Read metrics, monitors and logs", "Mute and unmute monitors"],
    tools: [
      { id: "query_metrics", name: "query_metrics", access: "read", tokens: 420 },
      { id: "search_logs", name: "search_logs", access: "read", tokens: 390 },
      { id: "list_monitors", name: "list_monitors", access: "read", tokens: 260 },
      { id: "mute_monitor", name: "mute_monitor", access: "write", tokens: 280 },
    ],
  },
  {
    id: "cloudflare", name: "Cloudflare", brand: "cloudflare",
    description: "Workers, KV namespaces and DNS records", transport: "remote",
    endpoint: "https://bindings.mcp.cloudflare.com/mcp", auth: "oauth",
    scopes: ["Read Workers, KV and DNS", "Edit DNS records"],
    tools: [
      { id: "workers_list", name: "workers_list", access: "read", tokens: 230 },
      { id: "kv_get", name: "kv_get", access: "read", tokens: 210 },
      { id: "dns_records_list", name: "dns_records_list", access: "read", tokens: 280 },
      { id: "dns_record_update", name: "dns_record_update", access: "write", tokens: 390 },
    ],
  },
  {
    id: "googledrive", name: "Google Drive", brand: "googledrive",
    description: "Search and read files in shared drives", transport: "remote",
    endpoint: "https://drivemcp.googleapis.com/mcp", auth: "oauth",
    scopes: ["See and download files in your Drive"],
    tools: [
      { id: "search_files", name: "search_files", access: "read", tokens: 340 },
      { id: "read_file", name: "read_file", access: "read", tokens: 260 },
    ],
  },
  {
    id: "atlassian", name: "Atlassian", brand: "atlassian",
    description: "Jira issues and Confluence pages", transport: "remote",
    endpoint: "https://mcp.atlassian.com/v1/sse", auth: "oauth",
    scopes: ["Read Jira issues and Confluence pages", "Create and edit issues"],
    tools: [
      { id: "search_jira", name: "search_jira", access: "read", tokens: 380 },
      { id: "get_confluence_page", name: "get_confluence_page", access: "read", tokens: 290 },
      { id: "create_jira_issue", name: "create_jira_issue", access: "write", tokens: 470 },
      { id: "add_comment", name: "add_comment", access: "write", tokens: 260 },
    ],
  },
  {
    id: "hubspot", name: "HubSpot", brand: "hubspot",
    description: "Contacts, companies and deals", transport: "remote",
    endpoint: "https://mcp.hubspot.com", auth: "oauth",
    scopes: ["Read contacts, companies and deals", "Add notes to records"],
    tools: [
      { id: "search_contacts", name: "search_contacts", access: "read", tokens: 330 },
      { id: "get_deal", name: "get_deal", access: "read", tokens: 270 },
      { id: "create_note", name: "create_note", access: "write", tokens: 300 },
    ],
  },
  {
    id: "posthog", name: "PostHog", brand: "posthog",
    description: "Product analytics, insights and feature flags", transport: "remote",
    endpoint: "https://mcp.posthog.com/mcp", auth: "oauth",
    scopes: ["Read insights and feature flags", "Update feature flag rollouts"],
    tools: [
      { id: "query_insight", name: "query_insight", access: "read", tokens: 410 },
      { id: "list_feature_flags", name: "list_feature_flags", access: "read", tokens: 230 },
      { id: "update_feature_flag", name: "update_feature_flag", access: "write", tokens: 360 },
    ],
  },
  {
    id: "asana", name: "Asana", brand: "asana",
    description: "Tasks, projects and comments", transport: "remote",
    endpoint: "https://mcp.asana.com/sse", auth: "oauth",
    scopes: ["Read tasks and projects", "Create tasks and comments"],
    tools: [
      { id: "search_tasks", name: "search_tasks", access: "read", tokens: 300 },
      { id: "get_project", name: "get_project", access: "read", tokens: 240 },
      { id: "create_task", name: "create_task", access: "write", tokens: 380 },
    ],
  },
  {
    id: "airtable", name: "Airtable", brand: "airtable",
    description: "Bases, tables and records", transport: "remote",
    endpoint: "https://mcp.airtable.com/mcp", auth: "oauth",
    scopes: ["Read bases and records", "Create and update records"],
    tools: [
      { id: "list_bases", name: "list_bases", access: "read", tokens: 200 },
      { id: "search_records", name: "search_records", access: "read", tokens: 310 },
      { id: "update_records", name: "update_records", access: "write", tokens: 400 },
    ],
  },
  {
    id: "docker", name: "Docker", brand: "docker",
    description: "Containers and images on this machine", transport: "local",
    endpoint: "docker mcp gateway run", auth: "none",
    tools: [
      { id: "list_containers", name: "list_containers", access: "read", tokens: 210 },
      { id: "container_logs", name: "container_logs", access: "read", tokens: 260 },
      { id: "restart_container", name: "restart_container", access: "write", tokens: 240 },
    ],
  },
];

export const brandMarks: Record<McpBrand, (props: MarkProps) => ReactElement> = {
  github: GithubMark,
  linear: LinearMark,
  notion: NotionMark,
  slack: SlackMark,
  sentry: SentryMark,
  stripe: StripeMark,
  postgresql: PostgresqlMark,
  figma: FigmaMark,
  vercel: VercelMark,
  supabase: SupabaseMark,
  cloudflare: CloudflareMark,
  googledrive: GoogledriveMark,
  atlassian: AtlassianMark,
  datadog: DatadogMark,
  hubspot: HubspotMark,
  asana: AsanaMark,
  posthog: PosthogMark,
  airtable: AirtableMark,
  docker: DockerMark,
  zendesk: ZendeskMark,
  intercom: IntercomMark,
  gmail: GmailMark,
  googlecalendar: GooglecalendarMark
};

function GithubMark({ title = "GitHub", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinearMark({ title = "Linear", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function NotionMark({ title = "Notion", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

function SlackMark({ title = "Slack", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function SentryMark({ title = "Sentry", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
    </svg>
  );
}

function StripeMark({ title = "Stripe", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  );
}

function PostgresqlMark({ title = "PostgreSQL", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
    </svg>
  );
}

function FigmaMark({ title = "Figma", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z" />
    </svg>
  );
}

function VercelMark({ title = "Vercel", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m12 1.608 12 20.784H0Z" />
    </svg>
  );
}

function SupabaseMark({ title = "Supabase", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </svg>
  );
}

function CloudflareMark({ title = "Cloudflare", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" />
    </svg>
  );
}

function GoogledriveMark({ title = "Google Drive", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
    </svg>
  );
}

function AtlassianMark({ title = "Atlassian", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M7.12 11.084a.683.683 0 00-1.16.126L.075 22.974a.703.703 0 00.63 1.018h8.19a.678.678 0 00.63-.39c1.767-3.65.696-9.203-2.406-12.52zM11.434.386a15.515 15.515 0 00-.906 15.317l3.95 7.9a.703.703 0 00.628.388h8.19a.703.703 0 00.63-1.017L12.63.38a.664.664 0 00-1.196.006z" />
    </svg>
  );
}

function DatadogMark({ title = "Datadog", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M19.57 17.04l-1.997-1.316-1.665 2.782-1.937-.567-1.706 2.604.087.82 9.274-1.71-.538-5.794zm-8.649-2.498l1.488-.204c.241.108.409.15.697.223.45.117.97.23 1.741-.16.18-.088.553-.43.704-.625l6.096-1.106.622 7.527-10.444 1.882zm11.325-2.712l-.602.115L20.488 0 .789 2.285l2.427 19.693 2.306-.334c-.184-.263-.471-.581-.96-.989-.68-.564-.44-1.522-.039-2.127.53-1.022 3.26-2.322 3.106-3.956-.056-.594-.15-1.368-.702-1.898-.02.22.017.432.017.432s-.227-.289-.34-.683c-.112-.15-.2-.199-.319-.4-.085.233-.073.503-.073.503s-.186-.437-.216-.807c-.11.166-.137.48-.137.48s-.241-.69-.186-1.062c-.11-.323-.436-.965-.343-2.424.6.421 1.924.321 2.44-.439.171-.251.288-.939-.086-2.293-.24-.868-.835-2.16-1.066-2.651l-.028.02c.122.395.374 1.223.47 1.625.293 1.218.372 1.642.234 2.204-.116.488-.397.808-1.107 1.165-.71.358-1.653-.514-1.713-.562-.69-.55-1.224-1.447-1.284-1.883-.062-.477.275-.763.445-1.153-.243.07-.514.192-.514.192s.323-.334.722-.624c.165-.109.262-.178.436-.323a9.762 9.762 0 0 0-.456.003s.42-.227.855-.392c-.318-.014-.623-.003-.623-.003s.937-.419 1.678-.727c.509-.208 1.006-.147 1.286.257.367.53.752.817 1.569.996.501-.223.653-.337 1.284-.509.554-.61.99-.688.99-.688s-.216.198-.274.51c.314-.249.66-.455.66-.455s-.134.164-.259.426l.03.043c.366-.22.797-.394.797-.394s-.123.156-.268.358c.277-.002.838.012 1.056.037 1.285.028 1.552-1.374 2.045-1.55.618-.22.894-.353 1.947.68.903.888 1.609 2.477 1.259 2.833-.294.295-.874-.115-1.516-.916a3.466 3.466 0 0 1-.716-1.562 1.533 1.533 0 0 0-.497-.85s.23.51.23.96c0 .246.03 1.165.424 1.68-.039.076-.057.374-.1.43-.458-.554-1.443-.95-1.604-1.067.544.445 1.793 1.468 2.273 2.449.453.927.186 1.777.416 1.997.065.063.976 1.197 1.15 1.767.306.994.019 2.038-.381 2.685l-1.117.174c-.163-.045-.273-.068-.42-.153.08-.143.241-.5.243-.572l-.063-.111c-.348.492-.93.97-1.414 1.245-.633.359-1.363.304-1.838.156-1.348-.415-2.623-1.327-2.93-1.566 0 0-.01.191.048.234.34.383 1.119 1.077 1.872 1.56l-1.605.177.759 5.908c-.337.048-.39.071-.757.124-.325-1.147-.946-1.895-1.624-2.332-.599-.384-1.424-.47-2.214-.314l-.05.059a2.851 2.851 0 0 1 1.863.444c.654.413 1.181 1.481 1.375 2.124.248.822.42 1.7-.248 2.632-.476.662-1.864 1.028-2.986.237.3.481.705.876 1.25.95.809.11 1.577-.03 2.106-.574.452-.464.69-1.434.628-2.456l.714-.104.258 1.834 11.827-1.424zM15.05 6.848c-.034.075-.085.125-.007.37l.004.014.013.032.032.073c.14.287.295.558.552.696.067-.011.136-.019.207-.023.242-.01.395.028.492.08.009-.048.01-.119.005-.222-.018-.364.072-.982-.626-1.308-.264-.122-.634-.084-.757.068a.302.302 0 0 1 .058.013c.186.066.06.13.027.207m1.958 3.392c-.092-.05-.52-.03-.821.005-.574.068-1.193.267-1.328.372-.247.191-.135.523.047.66.511.382.96.638 1.432.575.29-.038.546-.497.728-.914.124-.288.124-.598-.058-.698m-5.077-2.942c.162-.154-.805-.355-1.556.156-.554.378-.571 1.187-.041 1.646.053.046.096.078.137.104a4.77 4.77 0 0 1 1.396-.412c.113-.125.243-.345.21-.745-.044-.542-.455-.456-.146-.749" />
    </svg>
  );
}

function HubspotMark({ title = "HubSpot", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  );
}

function AsanaMark({ title = "Asana", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M18.78 12.653c-2.882 0-5.22 2.336-5.22 5.22s2.338 5.22 5.22 5.22 5.22-2.34 5.22-5.22-2.336-5.22-5.22-5.22zm-13.56 0c-2.88 0-5.22 2.337-5.22 5.22s2.338 5.22 5.22 5.22 5.22-2.338 5.22-5.22-2.336-5.22-5.22-5.22zm12-6.525c0 2.883-2.337 5.22-5.22 5.22-2.882 0-5.22-2.337-5.22-5.22 0-2.88 2.338-5.22 5.22-5.22 2.883 0 5.22 2.34 5.22 5.22z" />
    </svg>
  );
}

function PosthogMark({ title = "PostHog", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z" />
    </svg>
  );
}

function AirtableMark({ title = "Airtable", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M11.992 1.966c-.434 0-.87.086-1.28.257L1.779 5.917c-.503.208-.49.908.012 1.116l8.982 3.558a3.266 3.266 0 0 0 2.454 0l8.982-3.558c.503-.196.503-.908.012-1.116l-8.957-3.694a3.255 3.255 0 0 0-1.272-.257zM23.4 8.056a.589.589 0 0 0-.222.045l-10.012 3.877a.612.612 0 0 0-.38.564v8.896a.6.6 0 0 0 .821.552L23.62 18.1a.583.583 0 0 0 .38-.551V8.653a.6.6 0 0 0-.6-.596zM.676 8.095a.644.644 0 0 0-.48.19C.086 8.396 0 8.53 0 8.69v8.355c0 .442.515.737.908.54l6.27-3.006.307-.147 2.969-1.436c.466-.22.43-.908-.061-1.092L.883 8.138a.57.57 0 0 0-.207-.044z" />
    </svg>
  );
}

function DockerMark({ title = "Docker", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
    </svg>
  );
}

function ZendeskMark({ title = "Zendesk", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
    </svg>
  );
}

function IntercomMark({ title = "Intercom", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
    </svg>
  );
}

function GmailMark({ title = "Gmail", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function GooglecalendarMark({ title = "Google Calendar", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
    </svg>
  );
}

/** The generic mark for a server with no brand. */
function McpLogo({ title = "Model Context Protocol", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...props}>
      <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
      <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
    </svg>
  );
}

/** The sample client's own mark, so the authorize screen shows two parties. */
export function NorthwindMark({ title = "Northwind", ...props }: MarkProps) {
  const raw = useId();
  const id = raw.replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} role="img" aria-label={title} {...props}>
      <defs>
        <linearGradient id={`${id}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${id}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${id}-dark)`} />
    </svg>
  );
}

/** Draws the server's own mark when it has a brand, and the MCP logo when it does not. */
function BrandMark({ brand, className }: { brand?: McpBrand; className?: string }) {
  const Mark = brand ? brandMarks[brand] : McpLogo;
  return <Mark className={cx(styles.mark, className)} data-brand={brand} aria-hidden="true" />;
}

const statusIcons = { connected: CircleCheck, "needs-auth": KeyRound, error: CircleAlert } as const;
const statusLabels: Record<McpServerStatus, string> = { connected: "Connected", "needs-auth": "Needs sign in", error: "Error" };

/** Cross fades one short label into the next in place, so the row never jumps wider and back. */
function Swap({ id, children, reduced, className }: { id: string; children: ReactElement | string; reduced: boolean; className?: string }) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0 } : enterTransition }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitTransition }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The connection state as an icon in its semantic color plus a word, or the live label while connecting. */
function Status({ status, working, reduced }: { status: McpServerStatus; working?: string; reduced: boolean }) {
  const Icon = statusIcons[status];
  return (
    <Swap id={working ? `working-${working}` : status} reduced={reduced}>
      {working ? (
        <span className={styles.status} data-status="working">
          <TextShimmer>{working}</TextShimmer>
        </span>
      ) : (
        <span className={styles.status} data-status={status}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          {statusLabels[status]}
        </span>
      )}
    </Swap>
  );
}

/** Whether a tool only reads or changes something, as an eye or a pen plus the word. */
function Access({ access }: { access: McpAccess }) {
  const Icon = access === "read" ? Eye : PencilLine;
  return (
    <span className={styles.access} data-access={access}>
      <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
      <span className={styles.accessText}>{access === "read" ? "Read" : "Write"}</span>
    </span>
  );
}

/** A token count that rolls its digits when tools are switched. */
function Counter({ value }: { value: number }) {
  const shown = value < 1e3 ? { value: Math.round(value), decimals: 0, suffix: "" } : { value: Math.round(value / 100) / 10, decimals: 1, suffix: "k" };
  return (
    <span className={styles.counter}>
      <AnimatedCounter value={shown.value} decimals={shown.decimals} suffix={shown.suffix} />
    </span>
  );
}

/** A plain count that rolls its digits, with no unit. */
function PlainCounter({ value }: { value: number }) {
  return (
    <span className={styles.counter}>
      <AnimatedCounter value={value} />
    </span>
  );
}

/** What the enabled tool definitions cost in context, over a bar with one segment per server and the budget line. */
function ContextMeter({ servers, budget, hotId, reduced }: { servers: McpServer[]; budget: number; hotId: string | null; reduced: boolean }) {
  const measured = servers.map(server => ({ id: server.id, name: server.name, tokens: serverTokens(server) })).filter(server => server.tokens > 0);
  const total = measured.reduce((sum, server) => sum + server.tokens, 0);
  const enabled = servers.reduce((sum, server) => sum + (server.status === "connected" ? server.tools.filter(tool => tool.enabled).length : 0), 0);
  const span = Math.max(budget, total, 1);
  const over = total - budget;
  const focused = !!hotId && measured.some(server => server.id === hotId);
  return (
    <div className={styles.meter}>
      <div className={styles.meterLine}>
        <p className={styles.meterText}>
          <span className={styles.meterValue}>
            <PlainCounter value={enabled} />
          </span>
          <Swap id={enabled === 1 ? "one" : "many"} reduced={reduced}>
            {enabled === 1 ? "tool" : "tools"}
          </Swap>
          <span className={styles.meterDot} aria-hidden="true">
            ·
          </span>
          <span className={styles.meterValue}>
            <Counter value={total} />
          </span>
          <span>tokens of context</span>
        </p>
        <Swap id={over > 0 ? "over" : "under"} reduced={reduced} className={styles.budgetSlot}>
          {over > 0 ? (
            <span className={styles.budget} data-over="">
              <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
              {formatTokens(over)} over the {formatTokens(budget)} budget
            </span>
          ) : (
            <span className={styles.budget}>{formatTokens(budget)} budget</span>
          )}
        </Swap>
      </div>
      <div
        className={styles.track}
        data-focus={focused || undefined}
        role="meter"
        aria-label="Context used by tool definitions"
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={total}
        aria-valuetext={`${total.toLocaleString("en-US")} of ${budget.toLocaleString("en-US")} budgeted tokens${over > 0 ? `, ${over.toLocaleString("en-US")} over` : ""}`}
      >
        <AnimatePresence initial={false}>
          {measured.map(server => (
            <motion.span
              key={server.id}
              className={styles.segment}
              data-hot={hotId === server.id || undefined}
              title={`${server.name}: ${formatTokens(server.tokens)} tokens`}
              initial={{ width: "0%" }}
              animate={{ width: `${(server.tokens / span) * 100}%` }}
              exit={{ width: "0%" }}
              transition={reduced ? { duration: 0 } : resizeSpring}
            >
              <span className={styles.segmentFill} />
            </motion.span>
          ))}
        </AnimatePresence>
        <motion.span
          className={styles.overflow}
          aria-hidden="true"
          initial={false}
          animate={{ left: `${(budget / span) * 100}%`, opacity: over > 0 ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { left: resizeSpring, opacity: { duration: 0.2 } }}
        />
      </div>
    </div>
  );
}

const permissionOptions = [
  { value: "ask", label: "Ask every time" },
  { value: "allow-reads", label: "Always allow reads" },
];

/** One server's tools, each switch named with the tool, its access and what it costs. */
function ToolList({ server, onToggleTool }: { server: McpServer; onToggleTool: (serverId: string, toolId: string, enabled: boolean) => void }) {
  const uid = useId();
  return (
    <ul className={styles.tools} aria-label={`${server.name} tools`}>
      {server.tools.map(tool => {
        const controlId = `${uid}-${tool.id}`;
        return (
          <li key={tool.id} className={styles.tool} data-off={!tool.enabled || undefined}>
            <label htmlFor={controlId} className={styles.toolName}>
              {tool.name}
            </label>
            <Access access={tool.access} />
            <span className={styles.toolTokens}>{formatTokens(tool.tokens)}</span>
            <Switch
              id={controlId}
              className={styles.toolSwitch}
              checked={tool.enabled}
              onCheckedChange={checked => onToggleTool(server.id, tool.id, checked)}
              aria-label={`${tool.name}, ${tool.access === "read" ? "read" : "write"} tool, ${tool.tokens} tokens`}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** One server: its mark, status, transport, what its enabled tools cost, and its tools when open. */
function ServerRow({
  server,
  open,
  fresh,
  working,
  reduced,
  onToggleOpen,
  onToggleTool,
  onPermission,
  onSignIn,
  onRetry,
  onRemove,
  onHot,
  onHeadKey,
}: {
  server: McpServer;
  open: boolean;
  fresh: boolean;
  working?: string;
  reduced: boolean;
  onToggleOpen: (serverId: string) => void;
  onToggleTool: (serverId: string, toolId: string, enabled: boolean) => void;
  onPermission: (serverId: string, permission: McpPermission) => void;
  onSignIn: (serverId: string) => void;
  onRetry: (serverId: string) => void;
  onRemove: (serverId: string) => void;
  onHot: (serverId: string | null) => void;
  onHeadKey: (event: ReactKeyboardEvent<HTMLButtonElement>, serverId: string) => void;
}) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const connected = server.status === "connected" && !working;
  const on = server.tools.filter(tool => tool.enabled).length;
  const tokens = serverTokens(server);
  const transport = server.transport === "remote" ? "Remote" : "Local";
  const action = working || server.status === "connected" ? null : server.status === "needs-auth" ? "Sign in" : "Retry";
  return (
    <div className={styles.row} data-open={open || undefined} data-fresh={fresh || undefined} onPointerEnter={() => onHot(server.id)} onPointerLeave={() => onHot(null)}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.headButton}
          data-head={server.id}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${server.name}, ${working ?? statusLabels[server.status]}, ${transport}${connected ? `, ${on} of ${server.tools.length} tools on, ${formatTokens(tokens)} tokens` : ""}`}
          onClick={() => onToggleOpen(server.id)}
          onKeyDown={event => onHeadKey(event, server.id)}
          onFocus={() => onHot(server.id)}
          onBlur={() => onHot(null)}
        >
          <BrandMark brand={server.brand} className={styles.rowMark} />
          <span className={styles.headText}>
            <span className={styles.name}>{server.name}</span>
            <span className={styles.sub}>
              <Status status={server.status} working={working} reduced={reduced} />
              <span className={styles.subDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.transport}>{transport}</span>
            </span>
          </span>
          <Swap id={connected ? "meta" : "spacer"} reduced={reduced} className={styles.metaSlot}>
            {connected ? (
              <span className={styles.meta}>
                <span className={styles.toolCount}>
                  <PlainCounter value={on} /> of {server.tools.length}
                  <span className={styles.wideOnly}>&nbsp;tools</span>
                </span>
                <span className={styles.tokens}>
                  <Counter value={tokens} />
                  <span className={styles.srOnly}> tokens</span>
                </span>
              </span>
            ) : (
              <span className={styles.actionSpacer} data-action={server.status} aria-hidden="true" />
            )}
          </Swap>
          <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {action ? (
            <motion.span
              key={action}
              className={styles.headAction}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: reduced ? { duration: 0 } : enterTransition }}
              exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitTransition }}
            >
              <Button
                size="sm"
                variant="secondary"
                className={styles.rowAction}
                onClick={() => (server.status === "needs-auth" ? onSignIn : onRetry)(server.id)}
                aria-label={`${action}: ${server.name}`}
              >
                {server.status === "needs-auth" ? <KeyRound size={15} strokeWidth={1.75} aria-hidden="true" /> : null}
                {action}
              </Button>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-label={`${server.name} settings`}
            className={styles.panelClip}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { height: resizeSpring, opacity: { duration: 0.12 } } }}
            transition={reduced ? { duration: 0 } : { height: resizeSpring, opacity: enterTransition }}
          >
            <div className={styles.panel}>
              {server.status !== "connected" || working ? (
                <p className={styles.notice} data-tone={server.status === "error" ? "error" : "auth"}>
                  {server.status === "error" ? <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> : <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />}
                  <span>
                    {server.status === "error" ? (
                      <>
                        <span className={styles.noticeTitle}>Could not load tools.</span> {server.error ?? "The server did not answer."}
                      </>
                    ) : (
                      <>
                        <span className={styles.noticeTitle}>Signed out.</span> Sign in to {server.name} again to load its {server.tools.length || ""} tools.
                      </>
                    )}
                  </span>
                </p>
              ) : (
                <ToolList server={server} onToggleTool={onToggleTool} />
              )}
              <div className={styles.setting}>
                <span className={styles.settingLabel} id={`${uid}-perm`}>
                  Before a tool runs
                </span>
                <SegmentedControl
                  label="Before a tool runs"
                  options={permissionOptions}
                  value={server.permission ?? "ask"}
                  onValueChange={value => onPermission(server.id, value as McpPermission)}
                  className={styles.segmented}
                />
              </div>
              <div className={styles.panelFoot}>
                {server.endpoint ? (
                  <code className={styles.endpoint} title={server.endpoint}>
                    {server.endpoint}
                  </code>
                ) : (
                  <span />
                )}
                <Button size="sm" variant="ghost" className={styles.remove} onClick={() => onRemove(server.id)} aria-label={`Remove ${server.name}`}>
                  <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type SheetTarget = {
  kind: McpConnectRequest["kind"];
  id: string;
  name: string;
  brand?: McpBrand;
  transport: McpTransport;
  endpoint?: string;
  auth: McpAuth;
  scopes: string[];
  tools: McpTool[];
  permission?: McpPermission;
};

type SheetStep = { name: "directory" } | { name: "authorize" | "discover"; target: SheetTarget };

/** Parses what was pasted into the URL field, prefixing https when no scheme was typed. */
function parseServerUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || (!url.hostname.includes(".") && url.hostname !== "localhost")) return null;
    return url;
  } catch {
    return null;
  }
}

/** The Add server sheet: search the directory or paste a URL, authorize OAuth, then watch tools arrive. */
function AddServerSheet({
  mode,
  directory,
  connectedIds,
  clientName,
  clientMark,
  account,
  reduced,
  connect,
  onClose,
  onDone,
  announce,
}: {
  mode: { kind: "add" } | { kind: "reconnect"; server: McpServer };
  directory: McpDirectoryEntry[];
  connectedIds: string[];
  clientName: string;
  clientMark: ReactElement;
  account: McpAccount;
  reduced: boolean;
  connect: (request: McpConnectRequest, fallback: McpTool[]) => Promise<McpTool[]>;
  onClose: () => void;
  onDone: (server: McpServer, kind: McpConnectRequest["kind"]) => void;
  announce: (message: string) => void;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const back = mode.kind === "reconnect";
  const [step, setStep] = useState<SheetStep>(() =>
    mode.kind === "reconnect"
      ? {
          name: "authorize",
          target: {
            kind: "reconnect",
            id: mode.server.id,
            name: mode.server.name,
            brand: mode.server.brand,
            transport: mode.server.transport,
            endpoint: mode.server.endpoint,
            auth: "oauth",
            scopes: mode.server.scopes ?? scopesFor(mode.server.tools, mode.server.name),
            tools: mode.server.tools,
            permission: mode.server.permission,
          },
        }
      : { name: "directory" },
  );
  const [dir, setDir] = useState(1);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"working" | "done" | "error">("working");
  const [found, setFound] = useState<McpTool[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const discoverTitle = useRef<HTMLHeadingElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const run = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const live = timers.current;
    return () => {
      run.current += 1;
      live.forEach(window.clearTimeout);
      live.clear();
    };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);

  const show = useCallback((next: SheetStep, direction: number) => {
    setDir(direction);
    setStep(next);
  }, []);

  const discover = useCallback(
    (target: SheetTarget) => {
      const ticket = ++run.current;
      show({ name: "discover", target }, 1);
      setPhase("working");
      setFound([]);
      setPicked({});
      setError(null);
      announce(`Discovering tools on ${target.name}.`);
      connect({ kind: target.kind, serverId: target.id, name: target.name, transport: target.transport, endpoint: target.endpoint }, target.tools)
        .then(tools => {
          if (run.current !== ticket) return;
          const known = new Map(target.tools.map(tool => [tool.id, tool]));
          tools.forEach((tool, index) =>
            later(() => {
              if (run.current !== ticket) return;
              const match = known.get(tool.id);
              const on = tool.enabled ?? match?.enabled ?? tool.access === "read";
              setFound(current => [...current, tool]);
              setPicked(current => ({ ...current, [tool.id]: on }));
            }, 40 + 95 * index),
          );
          later(
            () => {
              if (run.current !== ticket) return;
              setPhase("done");
              announce(tools.length ? `Found ${tools.length} ${tools.length === 1 ? "tool" : "tools"} on ${target.name}. Reads are on, writes are off.` : `${target.name} reported no tools.`);
            },
            120 + 95 * tools.length,
          );
        })
        .catch((reason: unknown) => {
          if (run.current !== ticket) return;
          const message = reason instanceof Error && reason.message ? reason.message : `${target.name} did not answer.`;
          setPhase("error");
          setError(message);
          announce(`Discovery failed. ${message}`);
        });
    },
    [announce, connect, later, show],
  );

  const start = useCallback(
    (entry: McpDirectoryEntry) => {
      const target: SheetTarget = {
        kind: "directory",
        id: entry.id,
        name: entry.name,
        brand: entry.brand,
        transport: entry.transport,
        endpoint: entry.endpoint,
        auth: entry.auth,
        scopes: entry.scopes ?? scopesFor(entry.tools, entry.name),
        tools: entry.tools,
      };
      if (target.auth === "oauth") show({ name: "authorize", target }, 1);
      else discover(target);
    },
    [discover, show],
  );

  const backToDirectory = () => {
    run.current += 1;
    setBusy(false);
    show({ name: "directory" }, -1);
  };

  const stepKey = step.name === "directory" ? "directory" : `${step.name}-${step.target.id}`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (step.name === "directory") search.current?.focus();
      else if (step.name === "authorize") primary.current?.focus();
      else discoverTitle.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [stepKey, step.name]);

  useEffect(() => {
    if (phase === "done" && step.name === "discover" && document.activeElement === discoverTitle.current) primary.current?.focus();
  }, [phase, step.name]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? directory.filter(entry => `${entry.name} ${entry.description}`.toLowerCase().includes(needle)) : directory;
  }, [directory, query]);

  const heading = step.name === "directory" ? "Add a server" : step.name === "authorize" ? `Sign in to ${step.target.name}` : step.target.name;
  const hasBack = step.name !== "directory" && step.target.kind !== "reconnect" && step.target.kind !== "retry";
  const chosen = found.filter(tool => picked[tool.id]);
  const chosenTokens = chosen.reduce((sum, tool) => sum + tool.tokens, 0);
  return (
    <motion.div
      ref={dialog}
      className={styles.sheet}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key !== "Tab" || !dialog.current) return;
        const items = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].filter(
          item => item.offsetParent !== null && !item.closest("[data-leaving]"),
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      initial={reduced ? { opacity: 0 } : { y: "100%" }}
      animate={reduced ? { opacity: 1 } : { y: 0 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.12 } } : { y: "100%", transition: { type: "spring", visualDuration: 0.26, bounce: 0 } }}
      transition={reduced ? { duration: 0.12 } : { type: "spring", visualDuration: 0.34, bounce: 0 }}
    >
      <div className={styles.sheetHead}>
        <span className={styles.sheetSide}>
          <AnimatePresence initial={false}>
            {hasBack ? (
              <motion.span
                key="back"
                className={styles.sheetSideItem}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.14 }}
              >
                <Button variant="ghost" size="sm" className={styles.iconButton} onClick={backToDirectory} aria-label="Back to the directory">
                  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
        <h3 id={titleId} className={styles.sheetTitle}>
          <Swap id={heading} reduced={reduced}>
            {heading}
          </Swap>
        </h3>
        <span className={styles.sheetSide} data-end="">
          <Button variant="ghost" size="sm" className={styles.iconButton} onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </span>
      </div>
      <div className={styles.sheetBody}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={stepKey}
            className={styles.step}
            custom={dir}
            variants={{
              enter: (direction: number) => ({ opacity: 0, x: reduced ? 0 : 18 * direction }),
              center: { opacity: 1, x: 0, transition: { duration: reduced ? 0 : 0.22, ease: enterEase } },
              exit: (direction: number) => ({ opacity: 0, x: reduced ? 0 : -18 * direction, transition: { duration: reduced ? 0 : 0.12, ease: enterEase } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step.name === "directory" ? (
              <>
                <div
                  className={styles.stepScroll}
                  onKeyDown={event => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    const items = [...(dialog.current?.querySelectorAll<HTMLElement>("[data-entry]:not([disabled])") ?? [])];
                    if (!items.length) return;
                    const index = items.indexOf(document.activeElement as HTMLElement);
                    event.preventDefault();
                    if (event.key === "ArrowDown") items[index < 0 ? 0 : Math.min(items.length - 1, index + 1)]?.focus();
                    else if (index <= 0) search.current?.focus();
                    else items[index - 1]?.focus();
                  }}
                >
                  <div className={styles.searchWrap}>
                    <SearchField ref={search} label="Search servers" placeholder="Search servers" value={query} onValueChange={setQuery} autoComplete="off" />
                  </div>
                  {filtered.length ? (
                    <ul className={styles.directory} aria-label="Servers">
                      {filtered.map(entry => {
                        const added = connectedIds.includes(entry.id);
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              data-entry=""
                              className={styles.entry}
                              disabled={added}
                              onClick={() => start(entry)}
                              aria-label={`${entry.name}, ${entry.description}${added ? ", already added" : ""}`}
                            >
                              <BrandMark brand={entry.brand} className={styles.entryMark} />
                              <span className={styles.entryText}>
                                <span className={styles.entryName}>{entry.name}</span>
                                <span className={styles.entryDesc}>{entry.description}</span>
                              </span>
                              <span className={styles.entryMeta}>
                                {added ? (
                                  <>
                                    <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    {entry.transport === "local" ? "Local" : "Remote"}
                                    <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                                  </>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className={styles.noResults} role="status">
                      <p className={styles.noResultsTitle}>No servers match “{query.trim()}”</p>
                      <p>Paste the server&apos;s URL below to connect it directly.</p>
                    </div>
                  )}
                </div>
                <form
                  className={styles.urlForm}
                  onSubmit={event => {
                    event.preventDefault();
                    const parsed = parseServerUrl(url);
                    if (!parsed) {
                      setUrlError("Enter a server URL, like https://mcp.example.com/mcp");
                      return;
                    }
                    setUrlError(undefined);
                    const name = parsed.hostname.replace(/^(www|mcp|api)\./, "") || parsed.hostname;
                    discover({
                      kind: "url",
                      id: `url-${(parsed.host + parsed.pathname).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "server"}`,
                      name,
                      transport: "remote",
                      endpoint: parsed.href,
                      auth: "none",
                      scopes: [],
                      tools: urlConnectTools,
                    });
                  }}
                  noValidate
                >
                  <p className={styles.urlTitle} id={`${uid}-url`}>
                    Or connect by URL
                  </p>
                  <div className={styles.urlRow}>
                    <Input
                      label="Server URL"
                      placeholder="https://mcp.example.com/mcp"
                      value={url}
                      onChange={event => {
                        setUrl(event.target.value);
                        if (urlError) setUrlError(undefined);
                      }}
                      error={urlError}
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby={`${uid}-url`}
                    />
                    <Button type="submit" variant="secondary" className={styles.urlButton}>
                      Connect
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
            {step.name === "authorize" ? (
              <>
                <div className={styles.stepScroll}>
                  <div className={styles.auth}>
                    <p className={styles.simTag}>
                      <FlaskConical size={14} strokeWidth={1.75} aria-hidden="true" />
                      Simulated sign in
                    </p>
                    <div className={styles.handshake} aria-hidden="true">
                      <BrandMark brand={step.target.brand} className={styles.handshakeMark} />
                      <span className={styles.handshakeLine}>
                        <ArrowRight size={14} strokeWidth={1.75} />
                      </span>
                      <span className={styles.handshakeClient}>{clientMark}</span>
                    </div>
                    <p className={styles.authTitle}>
                      {clientName} wants to use your {step.target.name} account
                    </p>
                    <div className={styles.account}>
                      <Avatar name={account.name} src={account.avatar} size="sm" className={styles.accountAvatar} aria-hidden="true" />
                      <span className={styles.accountName}>{account.name}</span>
                      <span className={styles.accountEmail}>{account.email}</span>
                    </div>
                    <div className={styles.scopes}>
                      <p className={styles.scopesTitle}>This lets the agent</p>
                      <ul>
                        {step.target.scopes.map(scope => (
                          <li key={scope}>
                            <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                            {scope}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className={styles.stepFoot}>
                  <p className={styles.footNote}>No {step.target.name} account is contacted.</p>
                  <div className={styles.footActions}>
                    <Button variant="ghost" onClick={back ? onClose : backToDirectory}>
                      Cancel
                    </Button>
                    <Button
                      ref={primary}
                      className={styles.accentButton}
                      loading={busy}
                      onClick={() => {
                        if (busy) return;
                        const target = step.target;
                        setBusy(true);
                        announce(`Authorizing ${target.name}. Simulated, no account is contacted.`);
                        later(() => {
                          setBusy(false);
                          discover(target);
                        }, reduced ? 200 : 620);
                      }}
                    >
                      Authorize
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
            {step.name === "discover" ? (
              <>
                <div className={styles.stepScroll}>
                  <div className={styles.discoverHead}>
                    <BrandMark brand={step.target.brand} className={styles.discoverMark} />
                    <div className={styles.discoverText}>
                      <h4 ref={discoverTitle} tabIndex={-1} className={styles.discoverTitle}>
                        <Swap id={phase} reduced={reduced}>
                          {phase === "working" ? (
                            <TextShimmer>Discovering tools</TextShimmer>
                          ) : phase === "done" ? (
                            <span className={styles.phaseDone}>
                              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                              Found {found.length} {found.length === 1 ? "tool" : "tools"}
                            </span>
                          ) : (
                            <span className={styles.phaseError}>
                              <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                              Discovery failed
                            </span>
                          )}
                        </Swap>
                      </h4>
                      <p className={styles.discoverSub}>{step.target.endpoint ?? (step.target.transport === "local" ? "Local server" : "Remote server")}</p>
                    </div>
                  </div>
                  {phase === "error" ? (
                    <div className={styles.discoverError} role="alert">
                      <p>{error}</p>
                      <Button variant="secondary" size="sm" onClick={() => discover(step.target)}>
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <ul className={styles.found} aria-label={`${step.target.name} tools`} aria-busy={phase === "working"}>
                      <AnimatePresence initial={false}>
                        {found.map(tool => {
                          const controlId = `${uid}-found-${tool.id}`;
                          return (
                            <motion.li
                              key={tool.id}
                              className={styles.tool}
                              data-off={!picked[tool.id] || undefined}
                              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: reduced ? 0 : 0.18, ease: enterEase }}
                            >
                              <label htmlFor={controlId} className={styles.toolName}>
                                {tool.name}
                              </label>
                              <Access access={tool.access} />
                              <span className={styles.toolTokens}>{formatTokens(tool.tokens)}</span>
                              <Switch
                                id={controlId}
                                className={styles.toolSwitch}
                                checked={!!picked[tool.id]}
                                onCheckedChange={checked => setPicked(current => ({ ...current, [tool.id]: checked }))}
                                aria-label={`${tool.name}, ${tool.access} tool, ${tool.tokens} tokens`}
                              />
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                      {phase === "working" && !reduced ? (
                        <li className={styles.foundPending} aria-hidden="true">
                          <span />
                          <span />
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
                <div className={styles.stepFoot}>
                  <p className={styles.footNote}>
                    {phase === "error" ? (
                      "Nothing was added."
                    ) : (
                      <>
                        <span className={styles.footValue}>
                          <PlainCounter value={chosen.length} />
                        </span>
                        &nbsp;on
                        <span aria-hidden="true">&nbsp;·&nbsp;</span>
                        <span className={styles.footValue}>
                          <Counter value={chosenTokens} />
                        </span>
                        &nbsp;tokens
                      </>
                    )}
                  </p>
                  <div className={styles.footActions}>
                    <Button
                      ref={primary}
                      className={styles.accentButton}
                      disabled={phase !== "done"}
                      onClick={() => {
                        if (step.name !== "discover" || phase !== "done") return;
                        const target = step.target;
                        onDone(
                          {
                            id: target.id,
                            name: target.name,
                            brand: target.brand,
                            transport: target.transport,
                            endpoint: target.endpoint,
                            status: "connected",
                            permission: target.permission ?? "ask",
                            scopes: target.auth === "oauth" ? target.scopes : undefined,
                            tools: found.map(tool => ({ id: tool.id, name: tool.name, access: tool.access, tokens: tool.tokens, enabled: !!picked[tool.id] })),
                          },
                          target.kind,
                        );
                      }}
                    >
                      {step.target.kind === "reconnect" ? "Done" : "Add server"}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Servers whose discovery fails on purpose, so the error path is reachable in the demo. */
const simulatedFailures = new Set(["datadog"]);

/** Tools a pasted URL reports, used when nothing real answers. */
const urlConnectTools: McpTool[] = [
  { id: "search", name: "search", access: "read", tokens: 280 },
  { id: "fetch", name: "fetch", access: "read", tokens: 240 },
];

const defaultAccount: McpAccount = { name: "Emma Collins", email: "emma@northwind.dev", avatar: mediaAvatar("emma-collins") };

/**
 * MCP servers: what the agent can do, and what those tool definitions cost in context.
 * Rows open to a tool list, the add sheet searches a directory or takes a URL, and removals
 * keep a short undo window.
 */
export function McpServers({
  servers,
  directory = sampleDirectory,
  budget = 8000,
  title = "MCP servers",
  clientName = "Northwind agent",
  clientMark = <NorthwindMark aria-hidden="true" />,
  account = defaultAccount,
  onToggleTool,
  onConnect,
  onRemove,
  onPermissionChange,
  className,
}: McpServersProps) {
  const uncontrolled = servers === undefined;
  const reduced = !!useReducedMotion();
  const titleId = `${useId()}-title`;
  const [rows, setRows] = useState<McpServer[]>(() => servers ?? seedServers);
  const [syncFrom, setSyncFrom] = useState(servers);
  if (servers !== syncFrom) {
    setSyncFrom(servers);
    if (servers) setRows(servers);
  }
  const [open, setOpen] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [working, setWorking] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ server: McpServer; index: number; key: number } | null>(null);
  const [undoHover, setUndoHover] = useState(false);
  const [sheet, setSheet] = useState<{ kind: "add" } | { kind: "reconnect"; server: McpServer } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<string | null>(null);
  const failed = useRef(new Set<string>());
  const stateRef = useRef({ rows, pending, onConnect, onRemove });
  useLayoutEffect(() => {
    stateRef.current = { rows, pending, onConnect, onRemove };
  });
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach(window.clearTimeout);
      live.clear();
    };
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);
  const announce = useCallback((message: string) => setAnnouncement(current => (current === message ? `${message} ` : message)), []);
  const focusHead = useCallback((id: string | null) => {
    requestAnimationFrame(() => {
      const target = id ? root.current?.querySelector<HTMLElement>(`[data-head="${CSS.escape(id)}"]`) : null;
      (target ?? addButton.current)?.focus();
    });
  }, []);
  const flash = useCallback(
    (id: string) => {
      setFresh(id);
      later(() => setFresh(current => (current === id ? null : current)), 1700);
    },
    [later],
  );
  const connectTools = useCallback(
    (request: McpConnectRequest, fallback: McpTool[]) => {
      const handler = stateRef.current.onConnect;
      if (handler) {
        return Promise.resolve()
          .then(() => handler(request))
          .then(result => (Array.isArray(result) ? result : fallback));
      }
      return new Promise<McpTool[]>((resolve, reject) => {
        later(
          () => {
            if (uncontrolled && simulatedFailures.has(request.serverId) && !failed.current.has(request.serverId)) {
              failed.current.add(request.serverId);
              reject(new Error(`${request.name} closed the connection during tools/list. Simulated failure, try again.`));
            } else resolve(fallback);
          },
          request.kind === "retry" ? 1100 : 760,
        );
      });
    },
    [later, uncontrolled],
  );
  const totalTokens = rows.reduce((sum, server) => sum + serverTokens(server), 0);
  const toggleTool = (serverId: string, toolId: string, enabled: boolean) => {
    const server = rows.find(row => row.id === serverId);
    const tool = server?.tools.find(item => item.id === toolId);
    if (!server || !tool || tool.enabled === enabled) return;
    setRows(current =>
      current.map(row =>
        row.id === serverId ? { ...row, tools: row.tools.map(item => (item.id === toolId ? { ...item, enabled } : item)) } : row,
      ),
    );
    onToggleTool?.(serverId, toolId, enabled);
    announce(`${tool.name} ${enabled ? "on" : "off"}. ${formatTokens(totalTokens + (enabled ? tool.tokens : -tool.tokens))} tokens of context.`);
  };
  const changePermission = (serverId: string, permission: McpPermission) => {
    const server = rows.find(row => row.id === serverId);
    if (!server || server.permission === permission) return;
    setRows(current => current.map(row => (row.id === serverId ? { ...row, permission } : row)));
    onPermissionChange?.(serverId, permission);
    announce(`${server.name}: ${permission === "ask" ? "ask before every tool call" : "read tools run without asking"}.`);
  };
  const commitRemoval = useCallback(() => {
    const removal = stateRef.current.pending;
    if (!removal) return;
    stateRef.current.onRemove?.(removal.server.id);
    setPending(null);
    setUndoHover(false);
  }, []);
  const remove = (serverId: string) => {
    const index = rows.findIndex(row => row.id === serverId);
    if (index < 0) return;
    const server = rows[index];
    commitRemoval();
    const neighbour = rows[index + 1] ?? rows[index - 1] ?? null;
    setRows(current => current.filter(row => row.id !== serverId));
    setOpen(current => (current === serverId ? null : current));
    setWorking(current => {
      const next = { ...current };
      delete next[serverId];
      return next;
    });
    setPending({ server, index, key: Date.now() });
    announce(`Removed ${server.name}. Undo is available for a few seconds.`);
    focusHead(neighbour?.id ?? null);
  };
  const undo = useCallback(() => {
    const removal = stateRef.current.pending;
    if (!removal) return;
    setPending(null);
    setUndoHover(false);
    setRows(current => {
      if (current.some(row => row.id === removal.server.id)) return current;
      const next = [...current];
      next.splice(Math.min(removal.index, next.length), 0, removal.server);
      return next;
    });
    flash(removal.server.id);
    announce(`Restored ${removal.server.name}.`);
    focusHead(removal.server.id);
  }, [announce, flash, focusHead]);
  useEffect(() => {
    if (!pending || undoHover) return;
    const timer = window.setTimeout(commitRemoval, 6000);
    return () => window.clearTimeout(timer);
  }, [pending, undoHover, commitRemoval]);
  const retry = (serverId: string) => {
    const server = rows.find(row => row.id === serverId);
    if (!server || working[serverId]) return;
    focusHead(serverId);
    setWorking(current => ({ ...current, [serverId]: "Connecting" }));
    announce(`Reconnecting to ${server.name}.`);
    connectTools({ kind: "retry", serverId, name: server.name, transport: server.transport, endpoint: server.endpoint }, server.tools)
      .then(tools => {
        const known = new Map(server.tools.map(tool => [tool.id, tool]));
        const merged = tools.map(tool => ({
          ...tool,
          enabled: tool.enabled ?? known.get(tool.id)?.enabled ?? tool.access === "read",
        }));
        setRows(current => current.map(row => (row.id === serverId ? { ...row, status: "connected", error: undefined, tools: merged } : row)));
        flash(serverId);
        announce(`${server.name} connected. ${merged.filter(tool => tool.enabled).length} tools on.`);
      })
      .catch((reason: unknown) => {
        const message = reason instanceof Error && reason.message ? reason.message : "The server did not answer.";
        setRows(current => current.map(row => (row.id === serverId ? { ...row, status: "error", error: message } : row)));
        announce(`${server.name} is still not answering. ${message}`);
      })
      .finally(() => {
        setWorking(current => {
          const next = { ...current };
          delete next[serverId];
          return next;
        });
      });
  };
  const openSheet = (next: { kind: "add" } | { kind: "reconnect"; server: McpServer }, focus: string | null) => {
    returnFocus.current = focus;
    setHot(null);
    setSheet(next);
    requestAnimationFrame(() => {
      const element = root.current;
      if (element && element.getBoundingClientRect().bottom > window.innerHeight) {
        element.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
      }
    });
  };
  const closeSheet = () => {
    setSheet(null);
    focusHead(returnFocus.current);
  };
  const onHeadKey = (event: ReactKeyboardEvent<HTMLButtonElement>, serverId: string) => {
    const heads = [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-head]") ?? [])];
    const index = heads.findIndex(head => head.dataset.head === serverId);
    const target =
      event.key === "ArrowDown"
        ? heads[index + 1]
        : event.key === "ArrowUp"
          ? heads[index - 1]
          : event.key === "Home"
            ? heads[0]
            : event.key === "End"
              ? heads[heads.length - 1]
              : undefined;
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };
  return (
    <motion.section
      ref={root}
      className={cx(styles.root, className)}
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (!pending || undoHover || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
        if ((event.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
        undo();
      }}
      initial={false}
      animate={{ minHeight: sheet ? 600 : 0 }}
      transition={reduced ? { duration: 0 } : resizeSpring}
    >
      <div className={styles.main} inert={!!sheet}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h2 id={titleId} className={styles.title}>
              <McpLogo className={styles.titleMark} aria-hidden="true" />
              {title}
            </h2>
            <Button
              ref={addButton}
              variant="secondary"
              size="sm"
              className={styles.addButton}
              onClick={() => openSheet({ kind: "add" }, null)}
              aria-haspopup="dialog"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Add server
            </Button>
          </div>
          <ContextMeter servers={rows} budget={budget} hotId={hot} reduced={reduced} />
        </header>
        <ul className={styles.list} aria-label="Connected servers">
          <AnimatePresence initial={false}>
            {rows.map(server => (
              <motion.li
                key={server.id}
                className={styles.item}
                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: 0 } }
                    : { height: 0, opacity: 0, transition: { height: resizeSpring, opacity: { duration: 0.14 } } }
                }
                transition={reduced ? { duration: 0 } : { height: resizeSpring, opacity: { ...enterTransition, delay: 0.04 } }}
              >
                <ServerRow
                  server={server}
                  open={open === server.id}
                  fresh={fresh === server.id}
                  working={working[server.id] ?? undefined}
                  reduced={reduced}
                  onToggleOpen={id => setOpen(current => (current === id ? null : id))}
                  onToggleTool={toggleTool}
                  onPermission={changePermission}
                  onSignIn={id => {
                    const match = rows.find(row => row.id === id);
                    if (match) openSheet({ kind: "reconnect", server: match }, id);
                  }}
                  onRetry={retry}
                  onRemove={remove}
                  onHot={setHot}
                  onHeadKey={onHeadKey}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {rows.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: reduced ? { duration: 0 } : { ...enterTransition, delay: 0.18 } }}
              exit={{ opacity: 0, transition: reduced ? { duration: 0 } : exitTransition }}
            >
              <McpLogo className={styles.emptyMark} aria-hidden="true" />
              <p className={styles.emptyTitle}>No servers connected</p>
              <p className={styles.emptyText}>
                Connect a server to give the agent tools. Each tool you turn on adds its definition to the context.
              </p>
              <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "add" }, null)} aria-haspopup="dialog">
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                Add server
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {pending ? (
            <motion.div
              key="undo"
              className={styles.undoClip}
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { height: 0, opacity: 0, transition: { height: resizeSpring, opacity: { duration: 0.12 } } }
              }
              transition={reduced ? { duration: 0 } : { height: resizeSpring, opacity: enterTransition }}
            >
              <div
                className={styles.undo}
                onPointerEnter={() => setUndoHover(true)}
                onPointerLeave={() => setUndoHover(false)}
                onFocus={() => setUndoHover(true)}
                onBlur={() => setUndoHover(false)}
              >
                <BrandMark brand={pending.server.brand} className={styles.undoMark} />
                <p className={styles.undoText}>Removed {pending.server.name}</p>
                <Button key={pending.key} variant="ghost" size="sm" className={styles.undoButton} onClick={undo}>
                  <Undo2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  Undo
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {sheet ? (
          <motion.div
            key="layer"
            className={styles.layer}
            initial={{ opacity: 1 }}
            exit={{ opacity: 1, transition: { duration: reduced ? 0.12 : 0.28 } }}
          >
            <motion.div
              className={styles.scrim}
              aria-hidden="true"
              onClick={closeSheet}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: enterEase }}
            />
            <AddServerSheet
              key={sheet.kind === "reconnect" ? `reconnect-${sheet.server.id}` : "add"}
              mode={sheet}
              directory={directory}
              connectedIds={rows.map(row => row.id)}
              clientName={clientName}
              clientMark={clientMark}
              account={account}
              reduced={reduced}
              connect={connectTools}
              onClose={closeSheet}
              onDone={(server, kind) => {
                setSheet(null);
                const on = server.tools.filter(tool => tool.enabled).length;
                if (kind === "reconnect") {
                  setRows(current =>
                    current.map(row => (row.id === server.id ? { ...row, status: "connected", error: undefined, tools: server.tools } : row)),
                  );
                  flash(server.id);
                  announce(`${server.name} signed in. ${on} of ${server.tools.length} tools on.`);
                  focusHead(server.id);
                  return;
                }
                announce(`${server.name} added with ${on} of ${server.tools.length} tools on.${onConnect ? "" : " Simulated, nothing was connected."}`);
                later(() => {
                  setRows(current => [server, ...current.filter(row => row.id !== server.id)]);
                  flash(server.id);
                  focusHead(server.id);
                }, reduced ? 0 : 180);
              }}
              announce={announce}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </motion.section>
  );
}

export default McpServers;
