"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import Button from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./provider-status.module.css";

export type ProviderHealth = "operational" | "degraded" | "outage";
export type IncidentStage = "investigating" | "identified" | "monitoring" | "resolved";

/** One day in the uptime strip. `uptime` is a percentage, `null` while a day has no checks. */
export interface ProviderDay {
  date: string;
  uptime: number | null;
  status?: ProviderHealth;
  note?: string;
}

export interface IncidentUpdate {
  stage: IncidentStage;
  at: string | number | Date;
  message: string;
}

export interface ProviderIncident {
  id: string;
  title: string;
  url?: string;
  updates: IncidentUpdate[];
}

export interface ProviderStatusEntry {
  id: string;
  name: string;
  detail?: string;
  mark: ReactNode;
  status: ProviderHealth;
  latencyMs?: number;
  days?: ProviderDay[];
  incident?: ProviderIncident;
}

export interface ProviderStatusProps {
  /** Providers to show, newest uptime day last. */
  providers: ProviderStatusEntry[];
  /** Re-fetch provider health; resolves to a replacement list. Omit to keep the list static. */
  onRefresh?: (signal: AbortSignal) => Promise<ProviderStatusEntry[] | void> | ProviderStatusEntry[] | void;
  /** Milliseconds between automatic refreshes. `null` disables the countdown. */
  refreshInterval?: number | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
  expandedId?: string | null;
  defaultExpandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
  onOpenIncident?: (provider: ProviderStatusEntry, incident: ProviderIncident) => void;
  footnote?: ReactNode;
  notice?: string;
  className?: string;
  simulated?: boolean;
}

export type ProviderStatusDemoProps = Partial<Omit<ProviderStatusProps, "providers">> & {
  providers?: ProviderStatusEntry[];
};

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

const HEALTH_LABEL: Record<ProviderHealth, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
};

const HEALTH_ICON = {
  operational: CircleCheck,
  degraded: TriangleAlert,
  outage: CircleX,
} as const;

const STAGE_LABEL: Record<IncidentStage, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const SEVERITY: Record<ProviderHealth, number> = { operational: 0, degraded: 1, outage: 2 };

function join(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

function healthOf(day: ProviderDay): ProviderHealth | null {
  if (day.status) return day.status;
  if (day.uptime == null) return null;
  if (day.uptime < 99) return "outage";
  if (day.uptime < 99.9) return "degraded";
  return "operational";
}

function formatLatency(value?: number) {
  if (value == null || !Number.isFinite(value)) return "–";
  return value < 1_000 ? `${Math.round(value)} ms` : `${(value / 1_000).toFixed(2)} s`;
}

function averageUptime(days: ProviderDay[]) {
  const scored = days.filter((day) => day.uptime != null);
  if (!scored.length) return null;
  return scored.reduce((total, day) => total + (day.uptime ?? 0), 0) / scored.length;
}

function formatUptime(value: number | null) {
  if (value == null) return "–";
  return `${value >= 99.995 ? "100" : value.toFixed(2)}%`;
}

function dayLabel(day: ProviderDay, isLast: boolean) {
  if (isLast) return "Today";
  if (!day.date) return "No data";
  const parsed = new Date(`${day.date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? day.date : DAY_FORMAT.format(parsed);
}

function formatAt(value: string | number | Date) {
  if (typeof value === "string") return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${TIME_FORMAT.format(date)} UTC`;
}

function describeDay(day: ProviderDay, isLast: boolean) {
  const health = healthOf(day);
  const parts = [dayLabel(day, isLast), day.uptime == null ? "no data" : `${formatUptime(day.uptime)} uptime`];
  if (health && health !== "operational") parts.push(HEALTH_LABEL[health]);
  if (day.note) parts.push(day.note);
  return parts.join(", ");
}

function defaultExpanded(list: ProviderStatusEntry[]) {
  const open = list
    .filter((entry) => !!entry.incident && entry.incident.updates.length > 0 && !entry.incident.updates.some((u) => u.stage === "resolved"))
    .sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);
  return open[0]?.id ?? list.find((entry) => entry.incident)?.id ?? null;
}

interface MarkProps {
  title?: string;
}

function AnthropicMark({ title = "Anthropic" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ title = "Google Gemini" }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shape = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title}>
      <path d={shape} fill="#3186FF" />
      <path d={shape} fill={`url(#ps-gemini-0-${uid})`} />
      <path d={shape} fill={`url(#ps-gemini-1-${uid})`} />
      <path d={shape} fill={`url(#ps-gemini-2-${uid})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`ps-gemini-0-${uid}`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`ps-gemini-1-${uid}`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`ps-gemini-2-${uid}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MistralMark({ title = "Mistral AI" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title}>
      <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
      <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
      <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
      <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
      <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
    </svg>
  );
}

function XAIMark({ title = "xAI" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title}>
      <path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
    </svg>
  );
}

function AWSMark({ title = "Amazon Web Services" }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}>
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z" />
    </svg>
  );
}

function SwapText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={join(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE } }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Health({ health, reduced }: { health: ProviderHealth; reduced: boolean }) {
  const Icon = HEALTH_ICON[health];
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false}>
        <motion.span
          key={health}
          className={styles.health}
          data-health={health}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE } }}
        >
          <Icon className={styles.healthIcon} aria-hidden="true" />
          <span className={styles.healthText}>{HEALTH_LABEL[health]}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type InspectVia = "pointer" | "keyboard";

interface DayBarProps {
  name: string;
  days: ProviderDay[];
  active: number | null;
  onInspect: (index: number | null, element: HTMLElement, via: InspectVia) => void;
}

function DayBar({ name, days, active, onInspect }: DayBarProps) {
  const count = days.length;
  const outages = days.filter((day) => healthOf(day) === "outage").length;
  const degraded = days.filter((day) => healthOf(day) === "degraded").length;
  const summary =
    [
      outages ? `${outages} ${outages === 1 ? "day" : "days"} with an outage` : "",
      degraded ? `${degraded} degraded` : "",
    ]
      .filter(Boolean)
      .join(", ") || "no incidents";

  const indexAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width - 1);
    return Math.min(count - 1, Math.floor((x / rect.width) * count));
  };

  return (
    <div
      className={styles.bar}
      tabIndex={0}
      role="group"
      data-scrub={active != null || undefined}
      aria-label={`${name} uptime over the last 30 days: ${formatUptime(averageUptime(days))}, ${summary}. Use the arrow keys to inspect each day.`}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" || event.buttons) onInspect(indexAt(event), event.currentTarget, "pointer");
      }}
      onPointerDown={(event) => onInspect(indexAt(event), event.currentTarget, "pointer")}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onInspect(null, event.currentTarget, "pointer");
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) onInspect(count - 1, event.currentTarget, "keyboard");
      }}
      onBlur={(event) => onInspect(null, event.currentTarget, "keyboard")}
      onKeyDown={(event) => {
        const from = active ?? count - 1;
        let next: number | null = from;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, from - 1);
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(count - 1, from + 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = count - 1;
        else if (event.key === "Escape" && active != null) next = null;
        else return;
        event.preventDefault();
        onInspect(next, event.currentTarget, "keyboard");
      }}
    >
      {days.map((day, index) => (
        <span
          key={day.date || `pad-${index}`}
          className={styles.tick}
          data-health={healthOf(day) ?? "none"}
          data-active={index === active || undefined}
        />
      ))}
    </div>
  );
}

interface DayTipProps {
  day: ProviderDay | null;
  isLast: boolean;
  open: boolean;
  x: number;
  y: number;
  boundary: number;
}

function DayTip({ day, isLast, open, x, y, boundary }: DayTipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const width = node.offsetWidth;
    const left = Math.min(Math.max(x - width / 2, 8), Math.max(8, boundary - width - 8));
    node.style.transform = `translate(${Math.round(left)}px, ${Math.round(y)}px) translateY(-100%)`;
  }, [x, y, boundary, day, isLast]);

  const health = day ? healthOf(day) : null;
  const Icon = health ? HEALTH_ICON[health] : null;

  return (
    <div ref={ref} className={styles.tip} data-open={open || undefined} aria-hidden="true">
      {day ? (
        <>
          <span className={styles.tipHead}>
            <span className={styles.tipDate}>{dayLabel(day, isLast)}</span>
            <span className={styles.tipPct}>{day.uptime == null ? "No data" : formatUptime(day.uptime)}</span>
          </span>
          <span className={styles.tipBody}>
            {Icon && health ? (
              <span className={styles.health} data-health={health}>
                <Icon className={styles.healthIcon} aria-hidden="true" />
                <span className={styles.healthText}>{health === "operational" ? "No incidents" : HEALTH_LABEL[health]}</span>
              </span>
            ) : (
              <span className={styles.tipNote}>No checks recorded</span>
            )}
            {day.note ? <span className={styles.tipNote}>{day.note}</span> : null}
          </span>
        </>
      ) : null}
    </div>
  );
}

interface IncidentPanelProps {
  id: string;
  incident: ProviderIncident;
  reduced: boolean;
  onOpen?: () => void;
}

function IncidentPanel({ id, incident, reduced, onOpen }: IncidentPanelProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ordered = incident.updates
    .map((update, order) => ({ ...update, order }))
    .sort((a, b) => {
      const left = typeof a.at === "string" ? NaN : +new Date(a.at);
      const right = typeof b.at === "string" ? NaN : +new Date(b.at);
      return Number.isFinite(left) && Number.isFinite(right) ? right - left : b.order - a.order;
    });

  const first = incident.updates[0];
  const latest = ordered[0];
  const resolved = latest?.stage === "resolved";
  const spring = reduced ? { duration: 0 } : SPRING;

  const meta = [
    first ? `Started ${formatAt(first.at)}` : "",
    latest && latest !== ordered[ordered.length - 1] ? `${resolved ? "Resolved" : "Updated"} ${formatAt(latest.at)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      id={id}
      className={styles.panel}
      role="region"
      aria-label={incident.title}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1, transition: { height: spring, opacity: { duration: reduced ? 0 : 0.16, ease: EASE } } }}
      exit={{ height: 0, opacity: 0, transition: { height: spring, opacity: { duration: reduced ? 0 : 0.1, ease: EASE } } }}
    >
      <div ref={innerRef} className={styles.panelInner}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitleWrap}>
            <span className={styles.panelTitle}>{incident.title}</span>
            <SwapText text={meta} reduced={reduced} className={styles.panelMeta} />
          </div>
        </div>
        {onOpen ? (
          <Button variant="ghost" size="sm" className={styles.panelLink} onClick={onOpen}>
            Status page
            <ArrowUpRight aria-hidden="true" />
          </Button>
        ) : null}
        <ol className={styles.updates}>
          <AnimatePresence initial={false}>
            {ordered.map((update, index) => (
              <motion.li
                key={`${update.stage}-${update.order}`}
                className={styles.update}
                data-latest={index === 0 || undefined}
                data-stage={update.stage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, ease: EASE, delay: reduced ? 0 : 0.06 } }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
              >
                <span className={styles.updateDot} aria-hidden="true" />
                <span className={styles.updateHead}>
                  <span className={styles.updateStage}>{STAGE_LABEL[update.stage]}</span>
                  <span className={styles.updateTime}>{formatAt(update.at)}</span>
                </span>
                <span className={styles.updateText}>{update.message}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </motion.div>
  );
}

interface TipState {
  id: string;
  index: number;
  via: InspectVia;
  open: boolean;
  width: number;
  x: number;
  y: number;
}

/** Provider status — a live board of provider health, p50 latency and a 30 day uptime strip. */
function ProviderStatusView({
  providers,
  onRefresh,
  refreshInterval = 30_000,
  loading = false,
  error = null,
  title = "AI providers",
  expandedId,
  defaultExpandedId = null,
  onExpandedChange,
  onOpenIncident,
  footnote,
  notice,
  className,
  simulated = false,
}: ProviderStatusProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);

  const [refreshed, setRefreshed] = useState<{ from: ProviderStatusEntry[]; list: ProviderStatusEntry[] } | null>(null);
  const list = refreshed && refreshed.from === providers ? refreshed.list : providers;

  const [internalExpanded, setInternalExpanded] = useState(defaultExpandedId);
  const openId = expandedId !== undefined ? expandedId : internalExpanded;

  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const [phase, setPhase] = useState<"idle" | "checking" | "error">("idle");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [run, setRun] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef(list);

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  const canRefresh = !!onRefresh;
  const interval = phase === "error" && refreshInterval != null ? Math.min(refreshInterval, 10_000) : refreshInterval;

  const refresh = useCallback(
    async (withAnnounce = false) => {
      if (!onRefresh) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase("checking");
      const started = performance.now();
      try {
        const result = await onRefresh(controller.signal);
        const rest = 450 - (performance.now() - started);
        if (rest > 0) await wait(rest, controller.signal);
        if (controller.signal.aborted) return;
        if (Array.isArray(result)) setRefreshed({ from: listRef.current, list: result });
        setRefreshError(null);
        setPhase("idle");
        if (withAnnounce)
          setAnnounce(simulated ? "Checked every provider. Simulated, no requests were sent." : "Checked every provider.");
      } catch (error_) {
        if (controller.signal.aborted) return;
        const message =
          error_ instanceof Error && error_.message ? error_.message : "Couldn’t refresh provider status.";
        setRefreshError(message);
        setPhase("error");
        setAnnounce(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setRun((value) => value + 1);
        }
      }
    },
    [onRefresh, simulated],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const shouldRun = canRefresh && interval != null && inView && pageVisible && phase !== "checking" && !loading;
  const counterKey = `${run}:${interval}`;
  const [tick, setTick] = useState({ key: counterKey, ms: 0 });
  const elapsed = tick.key === counterKey ? tick.ms : 0;
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!shouldRun || interval == null) return;
    let started = performance.now();
    let spent = elapsed;
    let last = Math.ceil((interval - spent) / 1_000);
    const timer = window.setInterval(() => {
      const now = performance.now();
      spent += now - started;
      started = now;
      const next = Math.ceil((interval - spent) / 1_000);
      if (next !== last) {
        last = next;
        setTick({ key: counterKey, ms: spent });
      }
      if (spent >= interval) {
        window.clearInterval(timer);
        void refreshRef.current();
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
      setTick((current) => (current.key === counterKey ? { key: counterKey, ms: spent } : current));
    };
    // `elapsed` is a one-shot seed for the accumulator; re-running on every tick would reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun, counterKey, interval]);

  const remaining = interval == null ? 0 : Math.max(0, interval - elapsed);

  const [tip, setTip] = useState<TipState | null>(null);
  const [keyboardAnnounce, setKeyboardAnnounce] = useState("");

  const dayLists = useMemo(
    () =>
      list.map((provider) => {
        const recent = (provider.days ?? []).slice(-30);
        return {
          provider,
          days: [
            ...Array.from({ length: 30 - recent.length }, () => ({ date: "", uptime: null }) as ProviderDay),
            ...recent,
          ],
        };
      }),
    [list],
  );

  const tipEntry = tip ? dayLists.find((entry) => entry.provider.id === tip.id) : undefined;
  const tipDay = tip && tipEntry ? (tipEntry.days[tip.index] ?? null) : null;
  const tipOpen = !!tip?.open && !!tipDay;

  const outages = list.filter((entry) => entry.status === "outage").length;
  const degraded = list.filter((entry) => entry.status === "degraded").length;
  const worst: ProviderHealth = outages ? "outage" : degraded ? "degraded" : "operational";
  const summary =
    worst === "operational"
      ? { worst, text: "All systems operational" }
      : {
          worst,
          text: [
            outages ? `${outages} ${outages === 1 ? "outage" : "outages"}` : "",
            degraded ? `${degraded} degraded` : "",
            `${list.length - outages - degraded} operational`,
          ]
            .filter(Boolean)
            .join(" · "),
        };

  const [summaryAnnounce, setSummaryAnnounce] = useState(summary.text);
  if (summaryAnnounce !== summary.text) {
    setSummaryAnnounce(summary.text);
    setAnnounce(`${summary.text}.${simulated ? " Simulated, no requests were sent." : ""}`);
  }

  const displayError = refreshError ?? error;
  const summaryIcon = displayError ? CircleAlert : HEALTH_ICON[summary.worst];
  const summaryKey = loading ? "loading" : displayError ? `error:${displayError}` : `ok:${summary.text}`;
  const seconds = Math.max(1, Math.ceil(remaining / 1_000));
  const isEmpty = !loading && list.length === 0;
  const SummaryIcon = summaryIcon;

  return (
    <section
      ref={rootRef}
      className={join(styles.root, className)}
      aria-labelledby={`${uid}-title`}
      aria-busy={loading || phase === "checking" || undefined}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={`${uid}-title`} className={styles.title}>
            {title}
          </h3>
          <div className={styles.summary}>
            <AnimatePresence initial={false}>
              <motion.span
                key={summaryKey}
                className={styles.summaryItem}
                data-tone={displayError ? "error" : loading ? "loading" : summary.worst}
                initial={{ opacity: 0, y: reduced ? 0 : 2 }}
                animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: EASE } }}
              >
                {loading ? (
                  <TextShimmer className={styles.summaryText}>Loading provider status</TextShimmer>
                ) : (
                  <>
                    <SummaryIcon className={styles.summaryIcon} aria-hidden="true" />
                    <span className={styles.summaryText}>{displayError ?? summary.text}</span>
                  </>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        {canRefresh ? (
          <div className={styles.refresh}>
            <span className={styles.countdown} data-phase={phase}>
              <svg className={styles.ring} viewBox="0 0 16 16" aria-hidden="true" data-phase={phase}>
                <circle className={styles.ringTrack} cx="8" cy="8" r="6.25" />
                {interval != null && phase !== "checking" ? (
                  <circle
                    key={`${run}-${interval}`}
                    className={styles.ringFill}
                    cx="8"
                    cy="8"
                    r="6.25"
                    pathLength={100}
                    style={{ animationDuration: `${interval}ms`, animationPlayState: shouldRun ? "running" : "paused" }}
                  />
                ) : null}
                {phase === "checking" ? (
                  <circle className={styles.ringSpin} cx="8" cy="8" r="6.25" pathLength={100} />
                ) : null}
              </svg>
              <span className={styles.countdownText}>
                {phase === "checking" ? (
                  <TextShimmer className={styles.countdownLabel}>Checking</TextShimmer>
                ) : loading ? (
                  <span className={styles.countdownLabel}>Waiting</span>
                ) : interval == null ? (
                  <span className={styles.countdownLabel}>{phase === "error" ? "Not updated" : "Up to date"}</span>
                ) : (
                  <span className={styles.countdownLabel}>
                    {phase === "error" ? "Retry" : "Refresh"}
                    {" in "}
                    <span className={styles.num}>
                      <span className={styles.numGhost} aria-hidden="true">
                        {Math.max(1, Math.ceil(interval / 1_000))}s
                      </span>
                      <span>
                        {seconds}
                        s
                      </span>
                    </span>
                  </span>
                )}
              </span>
            </span>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void refresh(true)}
              disabled={loading}
              aria-label={phase === "error" ? "Retry now" : "Refresh now"}
              data-phase={phase}
            >
              <RotateCw aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>
      {isEmpty ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No providers yet</span>
          <span className={styles.emptyText}>Add a provider to track its health, latency and uptime here.</span>
        </div>
      ) : (
        <>
          <div className={styles.columns} aria-hidden="true">
            <span className={styles.colName}>Provider</span>
            <span className={styles.colStatus}>Status</span>
            <span className={styles.colLatency}>p50</span>
            <span className={styles.colBar}>Last 30 days</span>
          </div>
          <ul className={styles.list} role="list">
            {loading
              ? Array.from({ length: Math.max(list.length, 6) }, (_, index) => (
                  <li key={`skeleton-${index}`} className={styles.item} data-skeleton="">
                    <div className={styles.line}>
                      <span className={join(styles.mark, styles.bone)} />
                      <span className={styles.name}>
                        <span className={styles.bone} style={{ width: 88 + (index % 3) * 18 }} />
                        <span className={styles.bone} style={{ width: 120 + (index % 2) * 24 }} />
                      </span>
                      <span className={styles.status}>
                        <span className={styles.bone} style={{ width: 84 }} />
                      </span>
                      <span className={styles.latency}>
                        <span className={styles.bone} style={{ width: 44 }} />
                      </span>
                      <span className={join(styles.bar, styles.barBone)}>
                        {Array.from({ length: 30 }, (_, tickIndex) => (
                          <span key={tickIndex} className={styles.tick} data-health="none" />
                        ))}
                      </span>
                      <span className={styles.pct}>
                        <span className={styles.bone} style={{ width: 40 }} />
                      </span>
                      <span className={styles.chev} />
                    </div>
                  </li>
                ))
              : dayLists.map(({ provider, days }) => {
                  const incident = provider.incident;
                  const isOpen = !!incident && openId === provider.id;
                  const panelId = `${uid}-${provider.id}-incident`;
                  return (
                    <li
                      key={provider.id}
                      className={styles.item}
                      data-open={isOpen || undefined}
                      data-interactive={incident ? "" : undefined}
                      data-health={provider.status}
                    >
                      <div className={styles.line}>
                        {incident ? (
                          <button
                            type="button"
                            className={styles.hit}
                            aria-expanded={isOpen}
                            aria-controls={isOpen ? panelId : undefined}
                            onClick={() => {
                              const next = openId === provider.id ? null : provider.id;
                              if (expandedId === undefined) setInternalExpanded(next);
                              onExpandedChange?.(next);
                            }}
                            aria-label={`${provider.name}, ${HEALTH_LABEL[provider.status]}. ${isOpen ? "Hide" : "Show"} incident: ${incident.title}`}
                          />
                        ) : null}
                        <span className={styles.mark} aria-hidden="true">
                          {provider.mark}
                        </span>
                        <span className={styles.name}>
                          <span className={styles.nameText}>{provider.name}</span>
                          <span className={styles.meta}>
                            {provider.detail ? <span className={styles.detail}>{provider.detail}</span> : null}
                          </span>
                        </span>
                        <span className={styles.status}>
                          <Health health={provider.status} reduced={reduced} />
                        </span>
                        <span className={styles.latency} aria-label={`Median latency ${formatLatency(provider.latencyMs)}`}>
                          <SwapText text={formatLatency(provider.latencyMs)} reduced={reduced} />
                        </span>
                        <DayBar
                          name={provider.name}
                          days={days}
                          active={tipOpen && tip?.id === provider.id ? (tip?.index ?? null) : null}
                          onInspect={(index, element, via) => {
                            const root = rootRef.current;
                            if (index == null || !root) {
                              setTip((current) =>
                                current && current.id === provider.id && current.open ? { ...current, open: false } : current,
                              );
                              return;
                            }
                            const rootRect = root.getBoundingClientRect();
                            const barRect = element.getBoundingClientRect();
                            const count = days.length;
                            const width = (barRect.width - 2 * (count - 1)) / count;
                            setTip({
                              id: provider.id,
                              index,
                              via,
                              open: true,
                              width: rootRect.width,
                              x: barRect.left - rootRect.left + index * (width + 2) + width / 2,
                              y: barRect.top - rootRect.top - 8,
                            });
                            if (via === "keyboard") {
                              const day = days[index];
                              setKeyboardAnnounce(day ? describeDay(day, index === count - 1) : "");
                            }
                          }}
                        />
                        <span className={styles.pct}>
                          <SwapText text={formatUptime(averageUptime(days))} reduced={reduced} />
                        </span>
                        <span className={styles.chev} aria-hidden="true">
                          {incident ? <ChevronDown /> : null}
                        </span>
                      </div>
                      <AnimatePresence initial={false}>
                        {isOpen && incident ? (
                          <IncidentPanel
                            key={incident.id}
                            id={panelId}
                            incident={incident}
                            reduced={reduced}
                            onOpen={
                              onOpenIncident || incident.url
                                ? () => {
                                    if (onOpenIncident) onOpenIncident(provider, incident);
                                    else if (incident.url)
                                      window.open(incident.url, "_blank", "noopener,noreferrer");
                                  }
                                : undefined
                            }
                          />
                        ) : null}
                      </AnimatePresence>
                    </li>
                  );
                })}
          </ul>
        </>
      )}
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
      <DayTip
        day={tipDay}
        isLast={!!tipEntry && tip?.index === tipEntry.days.length - 1}
        open={tipOpen}
        x={tip?.x ?? 0}
        y={tip?.y ?? 0}
        boundary={tip?.width ?? 0}
      />
      <span className={styles.srOnly} aria-live="polite">
        {tipOpen && tip?.via === "keyboard" ? keyboardAnnounce : ""}
      </span>
      <span className={styles.srOnly} aria-live="polite">
        {notice || announce}
      </span>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sample data — the frame ships with a simulated provider board.              */
/* -------------------------------------------------------------------------- */

const SAMPLE_TODAY = "2026-10-27";
const JITTER = [0, 14, -9, 22, -17, 6, -12, 19, -4, 11, -7, 3];

type DayTuple = [number, ProviderHealth, string];

const SAMPLE_DAY_MAPS: Record<string, Record<string, DayTuple>> = {
  anthropic: {
    "2026-10-09": [99.15, "degraded", "Elevated errors on Claude Opus 5.5 for 41 min"],
    "2026-10-21": [99.65, "degraded", "Slow responses on the Messages API for 17 min"],
  },
  openai: {
    "2026-10-03": [92.08, "outage", "API outage for 1 h 54 min"],
    "2026-10-17": [99.38, "degraded", "Elevated latency on GPT-6 Luna for 30 min"],
  },
  gemini: {
    "2026-10-12": [99.5, "degraded", "Increased errors in europe-west4 for 24 min"],
  },
  mistral: {
    "2026-10-06": [94.24, "outage", "La Plateforme API unavailable for 1 h 23 min"],
  },
  xai: {
    "2026-10-01": [99.54, "degraded", "Elevated errors on Grok 4.7 for 22 min"],
    "2026-10-24": [99.75, "degraded", "Slow image generation for 12 min"],
  },
  bedrock: {
    "2026-10-15": [99.0, "degraded", "Throttling errors in us-east-1 for 48 min"],
  },
};

const OPENAI_UPDATES: IncidentUpdate[] = [
  {
    stage: "investigating",
    at: "14:02 UTC",
    message:
      "We are seeing elevated 5xx errors on the Responses API for GPT-6.1 Sol. GPT-6 Luna is not affected.",
  },
  {
    stage: "identified",
    at: "14:19 UTC",
    message:
      "A capacity issue in one inference cluster is causing the errors. We are moving traffic to healthy regions.",
  },
  {
    stage: "monitoring",
    at: "14:41 UTC",
    message:
      "Error rates are back near normal. Some requests may still see higher latency while traffic rebalances.",
  },
  {
    stage: "resolved",
    at: "14:58 UTC",
    message: "Error rates and latency have been normal for 15 minutes. This incident is resolved.",
  },
];

const GEMINI_UPDATES: IncidentUpdate[] = [
  {
    stage: "investigating",
    at: "13:37 UTC",
    message: "Some requests to Gemini 4 Argon in us-central1 see a longer time to first token.",
  },
  {
    stage: "identified",
    at: "13:55 UTC",
    message: "A configuration change increased queue times on one serving pool. A rollback is in progress.",
  },
  {
    stage: "monitoring",
    at: "14:24 UTC",
    message: "The rollback is complete and latency is recovering across us-central1.",
  },
  {
    stage: "resolved",
    at: "14:50 UTC",
    message: "Latency is back to normal in every region. This incident is resolved.",
  },
];

const MISTRAL_UPDATES: IncidentUpdate[] = [
  {
    stage: "investigating",
    at: "15:06 UTC",
    message: "Some chat completion requests to Mistral Large 4 return 503 errors in the EU region.",
  },
  {
    stage: "identified",
    at: "15:18 UTC",
    message: "A failed node pool upgrade reduced capacity. We are adding capacity back.",
  },
  {
    stage: "monitoring",
    at: "15:31 UTC",
    message: "Capacity is restored and errors have stopped. We are watching the EU region closely.",
  },
  {
    stage: "resolved",
    at: "15:47 UTC",
    message: "Mistral Large 4 has been stable for 15 minutes. This incident is resolved.",
  },
];

function incidentFrom(
  id: string,
  title: string,
  updates: IncidentUpdate[],
  count: number,
  url: string,
): ProviderIncident {
  return {
    id,
    title,
    url,
    updates: updates.slice(0, count).map(({ stage, at, message }) => ({ stage, at, message })),
  };
}

const SAMPLE_BASE: Array<{
  id: string;
  name: string;
  detail: string;
  mark: ReactNode;
  latency: number;
}> = [
  { id: "anthropic", name: "Anthropic", detail: "Claude Opus 5.5, Sonnet 5.5", mark: <AnthropicMark />, latency: 412 },
  { id: "openai", name: "OpenAI", detail: "GPT-6.1 Sol, GPT-6 Luna", mark: <OpenAIMark />, latency: 538 },
  { id: "gemini", name: "Google Gemini", detail: "Gemini 4 Argon, 3.8 Flash", mark: <GeminiMark />, latency: 604 },
  { id: "mistral", name: "Mistral AI", detail: "Mistral Large 4", mark: <MistralMark />, latency: 356 },
  { id: "xai", name: "xAI", detail: "Grok 4.7", mark: <XAIMark />, latency: 448 },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    detail: "Claude Sonnet 5.5 in us-east-1",
    mark: <AWSMark />,
    latency: 521,
  },
];

function isoDay(offset: number) {
  const date = new Date(`${SAMPLE_TODAY}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function buildDays(providerId: string, today?: DayTuple): ProviderDay[] {
  const map = SAMPLE_DAY_MAPS[providerId] ?? {};
  return Array.from({ length: 30 }, (_, index) => {
    const date = isoDay(index - 29);
    const entry = date === SAMPLE_TODAY ? today : map[date];
    return entry
      ? { date, uptime: entry[0], status: entry[1], note: entry[2] }
      : { date, uptime: 100, status: "operational" as ProviderHealth };
  });
}

/** Builds the provider board the demo frame renders for a given refresh tick. */
export function buildSampleProviders(tick: number): ProviderStatusEntry[] {
  const step = tick % 11;
  const phase = step === 6 ? step - 1 : step;
  const openaiCount = phase <= 3 ? phase + 1 : 0;
  const geminiCount = phase <= 1 ? 2 : phase <= 3 ? 3 : phase === 4 ? 4 : 0;
  const mistralCount = phase >= 5 && phase <= 9 ? Math.min(4, phase === 5 ? 1 : phase - 5) : 0;
  const mistralBadge = tick >= 11 || phase >= 5;

  return SAMPLE_BASE.map((base, index) => {
    let status: ProviderHealth = "operational";
    let latency = base.latency + JITTER[(tick + 3 * index) % JITTER.length];
    let today: DayTuple | undefined;
    let incident: ProviderIncident | undefined;

    if (base.id === "openai") {
      today = [96.94, "outage", "Elevated error rates on GPT-6.1 Sol"];
      if (openaiCount) {
        incident = incidentFrom(
          "oai-2026-10-27",
          "Elevated error rates on GPT-6.1 Sol",
          OPENAI_UPDATES,
          openaiCount,
          "https://status.openai.com",
        );
        status = openaiCount <= 2 ? "outage" : openaiCount === 3 ? "degraded" : "operational";
        if (status === "outage") latency = 2140 + 6 * JITTER[tick % JITTER.length];
        if (status === "degraded") latency = 860 + 2 * JITTER[tick % JITTER.length];
      }
    }

    if (base.id === "gemini") {
      today = [98.48, "degraded", "Increased latency for Gemini 4 Argon"];
      if (geminiCount) {
        incident = incidentFrom(
          "gem-2026-10-27",
          "Increased latency for Gemini 4 Argon",
          GEMINI_UPDATES,
          geminiCount,
          "https://status.cloud.google.com",
        );
        status = geminiCount < 4 ? "degraded" : "operational";
        if (status === "degraded") latency = (geminiCount === 3 ? 940 : 1380) + 3 * JITTER[tick % JITTER.length];
      }
    }

    if (base.id === "mistral") {
      if (mistralBadge) today = [99.15, "degraded", "Elevated errors on Mistral Large 4"];
      if (mistralCount) {
        incident = incidentFrom(
          "mis-2026-10-27",
          "Elevated errors on Mistral Large 4",
          MISTRAL_UPDATES,
          mistralCount,
          "https://status.mistral.ai",
        );
        status = mistralCount < 4 ? "degraded" : "operational";
        if (status === "degraded") latency = 812 + 2 * JITTER[tick % JITTER.length];
      }
    }

    return {
      id: base.id,
      name: base.name,
      detail: base.detail,
      mark: base.mark,
      status,
      latencyMs: latency,
      days: buildDays(base.id, today),
      incident,
    };
  });
}

function ProviderStatusSample(props: ProviderStatusDemoProps) {
  const [tick, setTick] = useState(0);
  const run = useRef(0);
  const failed = useRef(-1);
  const providers = useMemo(() => buildSampleProviders(tick), [tick]);
  const [notice, setNotice] = useState("");
  const [acted, setActed] = useState(false);
  const [userExpanded, setUserExpanded] = useState<string | null>(null);
  const [autoExpanded, setAutoExpanded] = useState<string | null>(() => defaultExpanded(providers));

  if (!providers.find((provider) => provider.id === autoExpanded)?.incident) {
    const next = defaultExpanded(providers);
    if (next !== autoExpanded) setAutoExpanded(next);
  }

  const refresh = useCallback(async (signal: AbortSignal) => {
    await wait(650, signal);
    const next = run.current + 1;
    if (next % 11 === 6 && failed.current !== next) {
      failed.current = next;
      throw new Error("Couldn’t reach the status feeds. Showing the last results.");
    }
    run.current = next;
    setTick(next);
  }, []);

  const { onExpandedChange } = props;

  const handleExpanded = useCallback(
    (next: string | null) => {
      setActed(true);
      setUserExpanded(next);
      onExpandedChange?.(next);
    },
    [onExpandedChange],
  );

  const openIncident = useCallback((provider: ProviderStatusEntry) => {
    setNotice(`Sample incident for ${provider.name}. Simulated, no status page was opened.`);
  }, []);

  return (
    <ProviderStatusView
      refreshInterval={8_000}
      footnote="Sample data. Latency is the median over the last 5 minutes; uptime counts degraded time at 30%."
      onOpenIncident={openIncident}
      notice={notice}
      {...props}
      providers={providers}
      onRefresh={props.onRefresh ?? refresh}
      simulated={!props.onRefresh}
      expandedId={props.expandedId !== undefined ? props.expandedId : acted ? userExpanded : autoExpanded}
      onExpandedChange={handleExpanded}
    />
  );
}

/** Provider status board. Without a `providers` prop it runs the simulated frame data. */
export function ProviderStatus(props: ProviderStatusDemoProps) {
  if (props.providers === undefined) return <ProviderStatusSample {...props} />;
  return <ProviderStatusView {...props} providers={props.providers} />;
}

export default ProviderStatus;
