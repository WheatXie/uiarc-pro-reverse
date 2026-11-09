"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Ban, ChevronDown, CircleAlert, RotateCcw, ShieldQuestionMark } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./tool-call.module.css";

const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const instantTransition = { duration: 0 } as const;

export type ToolCallStatus = "running" | "success" | "error" | "approval" | "denied";
export type ToolCallValue = string | number | boolean | null | ToolCallValue[];
export type ToolCallTool = "github" | "linear" | "postgres" | "slack" | "gmail" | "web" | { name: string; mark: ReactNode };

export interface ToolCallListItem {
  lead?: string;
  title: string;
  tag?: string;
}

export type ToolCallOutput =
  | { type: "list"; items: ToolCallListItem[] }
  | { type: "table"; columns: string[]; rows: (string | number | null)[][] }
  | { type: "json"; value: unknown }
  | { type: "text"; text: string };

export interface ToolCallData {
  id: string;
  tool: ToolCallTool;
  title: string;
  titles?: Partial<Record<ToolCallStatus, string>>;
  status: ToolCallStatus;
  input?: Record<string, ToolCallValue>;
  output?: ToolCallOutput;
  summary?: string;
  message?: string;
  durationMs?: number;
}

export interface ToolCallProps {
  id?: string;
  tool?: ToolCallTool;
  title?: string;
  titles?: Partial<Record<ToolCallStatus, string>>;
  status?: ToolCallStatus;
  input?: Record<string, ToolCallValue>;
  output?: ToolCallOutput;
  summary?: string;
  message?: string;
  durationMs?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onRetry?: () => void;
  renderOutput?: (call: ToolCallData) => ReactNode | undefined;
  className?: string;
}

export interface ToolCallGroupProps {
  calls?: ToolCallData[];
  active?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  autoCollapse?: boolean;
  onApprove?: (call: ToolCallData) => void;
  onDeny?: (call: ToolCallData) => void;
  onRetry?: (call: ToolCallData) => void;
  renderOutput?: (call: ToolCallData) => ReactNode | undefined;
  className?: string;
}

const statusWord: Record<ToolCallStatus, string> = {
  running: "Running",
  success: "Done",
  error: "Failed",
  approval: "Needs approval",
  denied: "Denied",
};

const toolName: Record<string, string> = {
  github: "GitHub",
  linear: "Linear",
  postgres: "PostgreSQL",
  slack: "Slack",
  gmail: "Gmail",
  web: "Web search",
};

const ariaMark = { "aria-hidden": true, focusable: false } as const;

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" {...ariaMark}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinearMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="#5E6AD2" {...ariaMark}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

function PostgresMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="#4169E1" {...ariaMark}>
      <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
    </svg>
  );
}

function SlackMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" {...ariaMark}>
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function GmailMark() {
  return (
    <svg viewBox="52 42 88 66" width="100%" height="100%" {...ariaMark}>
      <path fill="#4285F4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
      <path fill="#34A853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
      <path fill="#FBBC04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
      <path fill="#EA4335" d="M72 74V48l24 18 24-18v26L96 92" />
      <path fill="#C5221F" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
    </svg>
  );
}
function WebMark() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...ariaMark}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

const markRegistry: Record<string, ReactNode> = {
  github: <GithubMark />,
  linear: <LinearMark />,
  postgres: <PostgresMark />,
  slack: <SlackMark />,
  gmail: <GmailMark />,
  web: <WebMark />,
};

/** Tool marks are identity, not decoration: the mark keeps the tool's own colour where the brand has one. */
function ToolMark({ tool, size = 16, className }: { tool: ToolCallTool; size?: number; className?: string }) {
  if (typeof tool !== "string") {
    return (
      <span className={className} style={{ width: size, height: size }} aria-hidden="true">
        <span style={{ display: "contents" }}>{tool.mark}</span>
      </span>
    );
  }
  const mark = markRegistry[tool];
  return (
    <span className={className} style={{ width: size, height: size }} aria-hidden="true">
      {mark ?? null}
    </span>
  );
}

function toolLabel(tool: ToolCallTool): string {
  return typeof tool === "string" ? toolName[tool] ?? tool : tool.name;
}

function toolKey(tool: ToolCallTool): string {
  return typeof tool === "string" ? tool : tool.name;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function cellText(value: ToolCallValue): string {
  return value === null || value === undefined ? "null" : String(value);
}

/** 1180 → "1.2s", 5000 → "5.0s", 420 → "420ms". */
function formatDuration(ms?: number): string | undefined {
  if (ms === undefined) return undefined;
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

/** The summary the row prints on its own when a call comes without one. */
function derivedSummary(output?: ToolCallOutput): string | undefined {
  if (!output) return undefined;
  if (output.type === "list") return plural(output.items.length, "result");
  if (output.type === "table") return plural(output.rows.length, "row");
  if (output.type === "json") {
    const value = output.value;
    return Array.isArray(value) ? plural(value.length, "item") : plural(Object.keys(value as Record<string, unknown>).length, "field");
  }
  return undefined;
}

function Spinner() {
  return (
    <svg className={styles.spinner} width="100%" height="100%" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: .32, ease: easeStandard, delay: .04 }}
      />
    </svg>
  );
}

/** One shape per state, so the icon alone tells running from done from failed. */
function StatusIcon({ status, reduced }: { status: ToolCallStatus; reduced: boolean }) {
  return (
    <span className={styles.status} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          className={styles.statusIcon}
          data-status={status}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }}
          transition={reduced ? instantTransition : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}
        >
          {status === "running" ? (
            <Spinner />
          ) : status === "success" ? (
            <DrawnCheck reduced={reduced} />
          ) : status === "error" ? (
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : status === "approval" ? (
            <ShieldQuestionMark size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Ban size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const jsonToken = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g;

/** Tints keys, strings, numbers and literals on a single JSON line. */
function JsonLine({ line }: { line: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  jsonToken.lastIndex = 0;
  while ((match = jsonToken.exec(line))) {
    if (match.index > cursor) parts.push(line.slice(cursor, match.index));
    if (match[1]) {
      parts.push(
        <span key={key++} className={styles.jsonKey}>
          {match[1]}
          {match[2] ?? ""}
        </span>,
      );
    } else if (match[3]) {
      parts.push(
        <span key={key++} className={styles.jsonNumber}>
          {match[3]}
        </span>,
      );
    } else {
      parts.push(
        <span key={key++} className={styles.literal}>
          {match[0]}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) parts.push(line.slice(cursor));
  return <>{parts}</>;
}

/** Folds a long body to `visible` rows and grows to its full height on demand, so the row keeps its size. */
function Fold({
  total,
  visible,
  row,
  head = 0,
  unit,
  children,
}: {
  total: number;
  visible: number;
  row: number;
  head?: number;
  unit: string;
  children: (hidden: (index: number) => boolean) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const folding = total > visible + 1;
  const hidden = (index: number) => folding && !expanded && index >= visible;

  if (!folding) return <div className={styles.foldBody}>{children(hidden)}</div>;

  return (
    <>
      <motion.div
        id={id}
        className={styles.foldBody}
        initial={false}
        animate={{ height: expanded ? "auto" : visible * row + head }}
        transition={reduced ? instantTransition : motionTokens.spring.smooth}
        style={{ overflow: "hidden" }}
      >
        {children(hidden)}
      </motion.div>
      <button type="button" className={styles.more} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>
        <ChevronDown size={14} strokeWidth={1.75} className={styles.moreIcon} data-open={expanded || undefined} aria-hidden="true" />
        <span>{expanded ? "Show less" : `Show ${plural(total - visible, unit)}`}</span>
      </button>
    </>
  );
}

/** The body of a call: text, a foldable JSON block, a list of results or a small table. */
function OutputBody({ output }: { output: ToolCallOutput }) {
  if (output.type === "text") return <p className={styles.text}>{output.text}</p>;

  if (output.type === "json") {
    const lines = JSON.stringify(output.value, null, 2).split("\n");
    return (
      <Fold total={lines.length} visible={10} row={20} unit="more line">
        {(hidden) => (
          <pre className={styles.json} style={{ "--row": "20px" } as CSSProperties}>
            {lines.map((line, index) => (
              <span key={index} className={styles.jsonLine} aria-hidden={hidden(index) || undefined}>
                <JsonLine line={line} />
              </span>
            ))}
          </pre>
        )}
      </Fold>
    );
  }

  if (output.type === "list") {
    return (
      <Fold total={output.items.length} visible={5} row={32} unit="result">
        {(hidden) => (
          <ul className={styles.list} style={{ "--row": "32px" } as CSSProperties}>
            {output.items.map((item, index) => (
              <li key={index} className={styles.listRow} aria-hidden={hidden(index) || undefined}>
                {item.lead ? <span className={styles.listLead}>{item.lead}</span> : <span />}
                <span className={styles.listTitle}>{item.title}</span>
                {item.tag ? <span className={styles.listTag}>{item.tag}</span> : <span />}
              </li>
            ))}
          </ul>
        )}
      </Fold>
    );
  }

  return (
    <Fold total={output.rows.length} visible={5} row={30} head={30} unit="row">
      {(hidden) => (
        <div className={styles.tableScroll}>
          <table className={styles.table} style={{ "--row": "30px" } as CSSProperties}>
            <thead>
              <tr>
                {output.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {output.rows.map((row, index) => (
                <tr key={index} aria-hidden={hidden(index) || undefined}>
                  {row.map((cell, column) => (
                    <td key={column} className={cell === null ? styles.literal : undefined}>
                      {cellText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Fold>
  );
}

/** A copyable input as a definition list, in the same mono face as the output bodies. */
function InputList({ input }: { input: Record<string, ToolCallValue> }) {
  return (
    <dl className={styles.kv}>
      {Object.entries(input).map(([key, value]) => (
        <div key={key} className={styles.kvRow}>
          <dt className={styles.kvKey}>{key}</dt>
          <dd className={styles.kvValue}>
            {Array.isArray(value) ? (
              value.every((item) => typeof item !== "object") ? (
                value.map((item) => String(item)).join(", ")
              ) : (
                JSON.stringify(value)
              )
            ) : (
              <span className={value === null ? styles.literal : undefined}>{cellText(value)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ label, copy, children }: { label: string; copy?: string; children: ReactNode }) {
  return (
    <div className={styles.section} role="group" aria-label={label}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionLabel} aria-hidden="true">
          {label}
        </span>
        {copy ? <CopyButton value={copy} label={`Copy ${label.toLowerCase()}`} iconOnly variant="plain" className={styles.copy} /> : null}
      </div>
      <div className={styles.well}>{children}</div>
    </div>
  );
}

const GroupTouch = createContext<{ touch: () => void } | null>(null);

/** Springs the head between content heights, so an aside that appears or a reason that wraps never snaps the row. */
function useHeadSpring(reduced: boolean) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    let running: ReturnType<typeof animate> | undefined;
    const clear = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      running = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = running ? outer.getBoundingClientRect().height : height;
      height = nextHeight;
      if (reduced || widthChanged) {
        clear();
        return;
      }
      outer.style.overflow = "hidden";
      running = animate(outer, { height: [from, nextHeight] }, { ...motionTokens.spring.smooth, onComplete: clear });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      running?.stop();
    };
  }, [innerRef, outerRef, reduced]);

  return { outerRef, innerRef };
}

/** One call in a transcript: the mark and the call in plain words, a live state while it runs, and the input and output a click away. */
function ToolCallRow({
  call,
  flush = false,
  open,
  defaultOpen = false,
  onOpenChange,
  onApprove,
  onDeny,
  onRetry,
  renderOutput,
  className,
}: {
  call: ToolCallData;
  flush?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onApprove?: () => void;
  onDeny?: () => void;
  onRetry?: () => void;
  renderOutput?: (call: ToolCallData) => ReactNode | undefined;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const group = useContext(GroupTouch);
  const uid = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const expanded = open ?? localOpen;
  const { outerRef, innerRef } = useHeadSpring(reduced);

  const [flash, setFlash] = useState<{ base: ToolCallStatus; status: ToolCallStatus } | null>(null);
  const status = flash && flash.base === call.status ? flash.status : call.status;
  const live: ToolCallData = { ...call, status };
  const title = live.titles?.[status] ?? live.title;
  const summary = live.summary ?? derivedSummary(live.output);

  const [announcedStatus, setAnnouncedStatus] = useState<ToolCallStatus>(status);
  const [announcement, setAnnouncement] = useState("");
  const [flashNote, setFlashNote] = useState("");
  const flashTimer = useRef<number | undefined>(undefined);

  // Announce a state change once, never the per-frame detail: the row's own name is already readable.
  if (announcedStatus !== status) {
    setAnnouncedStatus(status);
    const name = toolLabel(live.tool);
    setAnnouncement(
      status === "running"
        ? `${name}: ${title}`
        : status === "success"
          ? `${name}: ${[title, summary].filter(Boolean).join(", ")}`
          : status === "error"
            ? `${name}: ${title}. ${live.message ?? ""}`.trim()
            : status === "approval"
              ? `${name}: ${title} needs your approval`
              : `${name}: ${title}, denied`,
    );
  }

  /** A simulated answer: show the result for a moment, then fall back to the call's own status. */
  const flashStatus = (next: ToolCallStatus, then: ToolCallStatus | undefined, note: string) => {
    const base = call.status;
    setFlash({ base, status: next });
    setFlashNote(note);
    window.clearTimeout(flashTimer.current);
    if (then) flashTimer.current = window.setTimeout(() => setFlash({ base, status: then }), 900);
  };

  useEffect(() => () => window.clearTimeout(flashTimer.current), [flashTimer]);

  const duration = formatDuration(live.durationMs);
  const note = (status === "error" || status === "approval") && live.message ? live.message : undefined;
  const label = toolLabel(live.tool);
  const ids = { name: `${uid}-name`, title: `${uid}-title`, state: `${uid}-state`, body: `${uid}-body` };
  const spokenState =
    status === "success"
      ? [statusWord.success, summary, duration].filter(Boolean).join(", ")
      : status === "error"
        ? [statusWord.error, live.message].filter(Boolean).join(": ")
        : statusWord[status];
  const aside =
    status === "approval"
      ? "approval"
      : status === "error"
        ? "error"
        : status === "denied"
          ? "denied"
          : status === "success" && (summary || duration)
            ? "meta"
            : null;

  const asideContent =
    aside === "approval" ? (
      <span className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          className={styles.action}
          onClick={() => (onDeny ? onDeny() : flashStatus("denied", undefined, "Denied. The call did not run."))}
          aria-label={`Deny: ${title}`}
        >
          Deny
        </Button>
        <Button
          variant="primary"
          size="sm"
          className={`${styles.action} ${styles.allow}`}
          onClick={() => (onApprove ? onApprove() : flashStatus("running", "success", "Allowed. This preview simulates the call, so nothing was sent."))}
          aria-label={`Allow: ${title}`}
        >
          Allow
        </Button>
      </span>
    ) : aside === "error" ? (
      <span className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          className={styles.action}
          onClick={() => (onRetry ? onRetry() : flashStatus("running", live.output ? "success" : "error", "Retrying. This preview simulates the call."))}
          aria-label={`Retry: ${title}`}
        >
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
          Retry
        </Button>
      </span>
    ) : aside === "meta" ? (
      <span className={styles.meta} aria-hidden="true">
        {summary ? (
          <span className={styles.metaSummary}>
            {summary}
            {duration ? <span className={styles.metaDot}>·</span> : null}
          </span>
        ) : null}
        {duration ? <span>{duration}</span> : null}
      </span>
    ) : aside === "denied" ? (
      <span className={styles.meta} aria-hidden="true">
        Denied
      </span>
    ) : null;

  const renderedOutput = status === "success" ? renderOutput?.(live) : undefined;
  const body =
    status === "running"
      ? { label: "Output", body: <TextShimmer className={styles.pending}>Waiting for the result</TextShimmer> }
      : status === "approval"
        ? { label: "Output", body: <p className={styles.pending}>Runs after you allow it.</p> }
        : status === "denied"
          ? { label: "Output", body: <p className={styles.pending}>Not run. You denied this call.</p> }
          : status === "error"
            ? {
                label: "Error",
                body: <p className={styles.errorText}>{live.message ?? "The call failed without a reason."}</p>,
                copy: live.message,
              }
            : renderedOutput !== undefined
              ? { label: "Output", body: renderedOutput, copy: undefined as string | undefined }
              : live.output
                ? { label: "Output", body: <OutputBody output={live.output} />, copy: outputCopyText(live.output) }
                : { label: "Output", body: <p className={styles.pending}>No output.</p>, copy: undefined as string | undefined };

  return (
    <div className={[styles.call, flush ? styles.flush : styles.standalone, className].filter(Boolean).join(" ")} data-status={status} data-open={expanded || undefined}>
      <div ref={(node) => { outerRef.current = node; }} className={styles.headClip}>
        <div ref={(node) => { innerRef.current = node; }} className={styles.head}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            aria-controls={ids.body}
            aria-labelledby={`${ids.name} ${ids.title} ${ids.state}`}
            onClick={() => {
              group?.touch();
              const next = !expanded;
              if (open === undefined) setLocalOpen(next);
              onOpenChange?.(next);
            }}
          />
          <ToolMark tool={live.tool} className={styles.mark} />
          <span className={styles.title} aria-hidden="true">
            <span id={ids.name} className={styles.srOnly}>
              {label}:
            </span>
            <span id={ids.title} className={styles.titleInner}>
              <TextShimmer active={status === "running"} className={styles.titleText}>
                {title}
              </TextShimmer>
            </span>
          </span>
          {note ? (
            <span className={styles.note} aria-hidden="true">
              {note}
            </span>
          ) : null}
          <span className={styles.aside}>
            <AnimatePresence initial={false} mode="popLayout">
              {aside ? (
                <motion.span
                  key={aside}
                  className={styles.asideInner}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: easeStandard }}
                >
                  {asideContent}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
          <StatusIcon status={status} reduced={reduced} />
          <span id={ids.state} className={styles.srOnly}>
            {spokenState}
          </span>
          <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            id={ids.body}
            className={styles.bodyClip}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? instantTransition : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
          >
            <div className={styles.body}>
              {live.input && Object.keys(live.input).length ? (
                <Section label="Input" copy={JSON.stringify(live.input, null, 2)}>
                  <InputList input={live.input} />
                </Section>
              ) : null}
              <Section label={body.label} copy={body.copy}>
                {body.body}
              </Section>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
        {flashNote ? ` ${flashNote}` : ""}
      </span>
    </div>
  );
}

/** Plain-text form of an output, for the copy button. */
function outputCopyText(output: ToolCallOutput): string {
  if (output.type === "text") return output.text;
  if (output.type === "json") return JSON.stringify(output.value, null, 2) ?? "";
  if (output.type === "list") {
    return output.items.map((item) => [item.lead, item.title, item.tag && `(${item.tag})`].filter(Boolean).join(" ")).join("\n");
  }
  return [output.columns, ...output.rows.map((row) => row.map(cellText))].map((row) => row.join("\t")).join("\n");
}

/** A standalone call, for a chat turn or a log line. */
export function ToolCall(props: ToolCallProps) {
  const { id, tool, title, titles, status, input, output, summary, message, durationMs, defaultOpen, open, onOpenChange, onApprove, onDeny, onRetry, renderOutput, className } = props;
  const sample = tool === undefined && title === undefined;
  const call: ToolCallData = {
    id: id ?? "tool-call",
    tool: tool ?? "github",
    title: title ?? sampleIssues.title,
    titles: titles ?? (sample ? sampleIssues.titles : undefined),
    status: status ?? "success",
    input: input ?? (sample ? sampleIssues.input : undefined),
    output: output ?? (sample ? sampleIssues.output : undefined),
    summary,
    message,
    durationMs: durationMs ?? (sample ? sampleIssues.durationMs : undefined),
  };
  return (
    <ToolCallRow
      call={call}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      onApprove={onApprove}
      onDeny={onDeny}
      onRetry={onRetry}
      renderOutput={renderOutput}
      className={className}
    />
  );
}

/** A run of calls in one collapsible group: "Used 4 tools", with the marks it used and the total time. */
export function ToolCallGroup({
  calls = sampleCalls,
  active,
  defaultOpen,
  open,
  onOpenChange,
  autoCollapse = true,
  onApprove,
  onDeny,
  onRetry,
  renderOutput,
  className,
}: ToolCallGroupProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const [openState, setOpenState] = useState(
    () => defaultOpen ?? calls.some((call) => call.status === "running" || call.status === "approval" || call.status === "error"),
  );
  const expanded = open ?? openState;
  const [stagger, setStagger] = useState(false);
  const touched = useRef(false);
  const wasLive = useRef(false);

  const anyRunning = calls.some((call) => call.status === "running");
  const anyApproval = calls.some((call) => call.status === "approval");
  const errorCount = calls.filter((call) => call.status === "error").length;
  const running = active ?? anyRunning;
  const live = anyRunning || anyApproval || errorCount > 0 || running;
  const total = calls.reduce(
    (sum, call) => sum + (call.status === "success" || call.status === "error" ? call.durationMs ?? 0 : 0),
    0,
  );
  const label =
    anyApproval && !anyRunning
      ? "Waiting for approval"
      : (anyRunning || running) && errorCount === 0
        ? `Using ${plural(calls.length, "tool")}`
        : `Used ${plural(calls.length, "tool")}`;
  const meta = errorCount && !anyRunning ? `${errorCount} failed` : anyApproval || anyRunning || running ? undefined : formatDuration(total);
  const signature = calls
    .filter((call) => call.status === "approval" || call.status === "error")
    .map((call) => `${call.id}:${call.status}`)
    .join("|");
  const [lastSignature, setLastSignature] = useState(signature);

  // A call that needs a decision opens the group, so the buttons are never hidden behind a closed header.
  if (signature !== lastSignature) {
    setLastSignature(signature);
    if (signature && open === undefined && !openState) setOpenState(true);
  }

  useEffect(() => {
    if (live) wasLive.current = true;
  }, [live, wasLive]);

  // Once every call has settled the group folds itself, unless someone has touched it.
  useEffect(() => {
    if (live || !autoCollapse || !expanded || touched.current || !wasLive.current || !calls.length) return;
    const timer = window.setTimeout(() => {
      wasLive.current = false;
      if (open === undefined) setOpenState(false);
      onOpenChange?.(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [live, autoCollapse, expanded, calls.length, open, onOpenChange]);

  const tools = calls.reduce<ToolCallTool[]>((list, call) => (list.some((tool) => toolKey(tool) === toolKey(call.tool)) ? list : [...list, call.tool]), []);
  const stack = tools.slice(0, 4);

  return (
    <GroupTouch.Provider value={{ touch: () => { touched.current = true; } }}>
      <div className={[styles.root, styles.group, className].filter(Boolean).join(" ")} data-open={expanded || undefined}>
        <div className={styles.groupHead}>
          <button
            type="button"
            className={styles.groupToggle}
            aria-expanded={expanded}
            aria-controls={`${uid}-list`}
            onClick={() => {
              const next = !expanded;
              touched.current = true;
              if (next) setStagger(true);
              if (open === undefined) setOpenState(next);
              onOpenChange?.(next);
            }}
          >
            <span className={styles.stack} aria-hidden="true">
              <AnimatePresence initial={false}>
                {stack.map((tool, index) => (
                  <motion.span
                    key={toolKey(tool)}
                    className={styles.stackItem}
                    style={{ zIndex: index + 1 }}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .6, width: 0, marginLeft: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 20, marginLeft: index ? -4 : 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .6, width: 0, marginLeft: 0 }}
                    transition={reduced ? instantTransition : { ...motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }}
                  >
                    <ToolMark tool={tool} size={12} className={styles.stackMark} />
                  </motion.span>
                ))}
              </AnimatePresence>
              {tools.length > stack.length ? <span className={styles.stackMore}>+{tools.length - stack.length}</span> : null}
            </span>
            <TextShimmer active={(anyRunning || running) && !anyApproval && errorCount === 0} className={styles.groupLabel}>
              {label}
            </TextShimmer>
            <span className={styles.groupMeta}>
              <AnimatePresence initial={false} mode="popLayout">
                {meta ? (
                  <motion.span
                    key={meta}
                    className={errorCount ? styles.groupMetaFailed : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
                  >
                    {meta}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </span>
            <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="list"
              id={`${uid}-list`}
              className={styles.listClip}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduced ? instantTransition : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }}
              onAnimationComplete={() => setStagger(false)}
            >
              <div className={styles.calls} role="list">
                <AnimatePresence initial={stagger}>
                  {calls.map((call, index) => (
                    <motion.div
                      key={call.id}
                      role="listitem"
                      className={styles.item}
                      initial={reduced ? { opacity: 0 } : stagger ? { opacity: 0, y: -6 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={
                        reduced
                          ? instantTransition
                          : stagger
                            ? {
                                opacity: { duration: motionTokens.duration.standard, delay: .02 * index },
                                y: { ...motionTokens.spring.snappy, delay: .02 * index },
                              }
                            : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, delay: .06 } }
                      }
                    >
                      <ToolCallRow
                        call={call}
                        flush
                        renderOutput={renderOutput}
                        onApprove={onApprove ? () => onApprove(call) : undefined}
                        onDeny={onDeny ? () => onDeny(call) : undefined}
                        onRetry={onRetry ? () => onRetry(call) : undefined}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </GroupTouch.Provider>
  );
}

const sampleIssues: ToolCallData = {
  id: "github-issues",
  tool: "github",
  title: "Searched issues in arc-ui/web",
  titles: { running: "Searching issues in arc-ui/web", error: "Could not search issues in arc-ui/web" },
  status: "success",
  input: { repo: "arc-ui/web", query: "is:open label:release-blocker milestone:2.8", sort: "updated" },
  output: {
    type: "list",
    items: [
      { lead: "#1284", title: "Checkout button stays disabled after a coupon is removed", tag: "checkout" },
      { lead: "#1291", title: "Webhook retry posts a second charge after a 504", tag: "billing" },
      { lead: "#1302", title: "Session is lost after SSO sign in on iPad", tag: "auth" },
      { lead: "#1306", title: "Release notes page returns 404 on docs preview", tag: "docs" },
    ],
  },
  durationMs: 1180,
};

const sampleProject: ToolCallData = {
  id: "linear-project",
  tool: "linear",
  title: "Read the Web 2.8 release project",
  titles: { running: "Reading the Web 2.8 release project", error: "Could not read the Web 2.8 release project" },
  status: "success",
  input: { project: "Web 2.8 release", team: "WEB", include: ["issues", "milestones"] },
  output: {
    type: "json",
    value: {
      project: "Web 2.8 release",
      lead: "Maya Chen",
      target: "2026-10-23",
      progress: 0.86,
      health: "at risk",
      milestones: [
        { name: "Code freeze", date: "2026-10-20", done: true },
        { name: "Release candidate", date: "2026-10-22", done: false },
      ],
      blocked: [
        { id: "WEB-412", title: "Ship the coupon fix to checkout", assignee: "Daniel Okafor", blockedBy: "arc-ui/web#1284" },
        { id: "WEB-418", title: "Run migration 0047 on production", assignee: "Priya Raman", blockedBy: null },
      ],
      openIssues: 7,
      doneIssues: 43,
    },
  },
  summary: "2 blocked",
  durationMs: 760,
};

const sampleMigrations: ToolCallData = {
  id: "postgres-migrations",
  tool: "postgres",
  title: "Queried pending migrations",
  titles: { running: "Querying pending migrations", error: "Could not query pending migrations" },
  status: "success",
  input: {
    database: "app_production",
    sql: "select version, name, applied_at from schema_migrations where applied_at is null order by version",
  },
  output: {
    type: "table",
    columns: ["version", "name", "applied_at"],
    rows: [
      ["0047", "add_coupon_redemptions_index", null],
      ["0048", "backfill_invoice_currency", null],
    ],
  },
  message: "Connection to app_production timed out after 5s",
  durationMs: 420,
};

const samplePost: ToolCallData = {
  id: "slack-post",
  tool: "slack",
  title: "Posted to #release",
  titles: {
    approval: "Post a summary to #release",
    denied: "Post a summary to #release",
    running: "Posting to #release",
    error: "Could not post to #release",
  },
  status: "success",
  input: {
    channel: "#release",
    text: "2.8 is blocked by #1284 (coupon checkout) and migration 0047, still pending on production. The Oct 23 target holds if both land by Wednesday.",
  },
  output: { type: "text", text: "Sent to #release at 10:42 as Arc agent." },
  summary: "1 message",
  message: "Sends as Arc agent to 48 people in #release",
  durationMs: 610,
};

const sampleCalls: ToolCallData[] = [sampleIssues, sampleProject, sampleMigrations, samplePost];

export default ToolCallGroup;
