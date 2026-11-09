"use client";

import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { CircleCheck, CircleDashed, Globe, LoaderCircle, Lock, TriangleAlert, X } from "lucide-react";
import Button from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./domain-verify.module.css";

/** One record the customer has to create at their DNS provider. */
export interface DnsRecord {
  id: string;
  /** Record type, such as CNAME, TXT or CAA. */
  type: string;
  /** Host label, or "@" on an apex domain. */
  name: string;
  /** The value to paste at the provider. */
  value: string;
  /** One line about what the record is for, shown under the row. */
  purpose?: string;
}

/** The outcome of one lookup for one record. */
export interface RecordCheck {
  id: string;
  status: "valid" | "missing" | "invalid";
  /** Context shown under the row, such as how many regions have seen it. */
  detail?: string;
  /** The conflicting value found, shown when the record is misconfigured. */
  found?: string;
  /** One sentence on how to fix a misconfigured record. */
  fix?: string;
}

/** The result of one DNS check. */
export interface VerifyResult {
  records: RecordCheck[];
  regions: { propagated: number; total: number };
}

/** The issued certificate, shown on the domain row once the check passes. */
export interface Certificate {
  issuer: string;
  renews: string;
}

export type DomainVerifyPhase = "enter" | "adding" | "records" | "checking" | "invalid" | "verified";

export interface DomainVerifyProps {
  /** Prefilled domain. Pasted protocols, paths, ports and trailing dots are stripped before validation. */
  defaultDomain?: string;
  /** Card title. */
  title?: string;
  /** One muted line under the title. */
  description?: string;
  /** Detected DNS host, shown as "DNS hosted at {name}" with a 14px mark. Pass null to hide it. */
  provider?: { name: string; mark?: ReactNode } | null;
  /** Returns the records to create. Defaults to a CNAME (an A record on an apex), an ownership TXT and a CAA for Let's Encrypt. */
  getRecords?: (domain: string, signal: AbortSignal) => Promise<DnsRecord[]>;
  /** One DNS check. Return per-record status and how many regions have propagated. The card polls while any record is missing. */
  verify?: (
    domain: string,
    records: DnsRecord[],
    context: { signal: AbortSignal; attempt: number; run: number },
  ) => Promise<VerifyResult>;
  /** Called once every record is valid; the domain row shows "Issuing SSL" until it resolves. */
  issueCertificate?: (domain: string, signal: AbortSignal) => Promise<Certificate>;
  /** Milliseconds between checks. Defaults to 800 simulated, 5000 with a verify handler. */
  pollInterval?: number;
  /** Plays the whole flow by itself. Defaults to true when no handlers are passed. Any pointer or key press inside the card hands control to the person. */
  autoPlay?: boolean;
  /** Called on every phase change. */
  onPhaseChange?: (phase: DomainVerifyPhase) => void;
  /** Called after the certificate is issued. */
  onVerified?: (domain: string, certificate: Certificate) => void;
  /** Called when the domain is removed with the close button or when Add another starts over. */
  onRemove?: (domain: string) => void;
  /** Extra class on the card. */
  className?: string;
}

const DEFAULT_DOMAIN = "app.acme.com";
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const standardEase: [number, number, number, number] = [...motionTokens.ease.standard];
/** Text and icon swaps: old fades in 100ms, new fades in over 160ms with a 2px rise. */
const swapIn = { duration: 0.16, ease: standardEase };
const swapOut = { duration: 0.1, ease: standardEase };
/** The card eases to its measured height on a spring with no bounce. */
const heightSpring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const instant = { duration: 0 };

/** True when a cancelled request left the card, so the catch block can stay quiet. */
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

function sanitize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#:].*$/, "")
    .replace(/\.$/, "");
}

/** A stable 16 character ownership token, so the same domain always shows the same TXT value. */
function ownershipToken(domain: string) {
  let first = 0x811c9dc5;
  let second = 0x1000193;
  for (const char of domain) {
    first = Math.imul(first ^ char.charCodeAt(0), 0x1000193) >>> 0;
    second = Math.imul(second ^ char.charCodeAt(0), 0x85ebca6b) >>> 0;
  }
  return (first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0")).slice(0, 16);
}

function buildRecords(domain: string, target = "edge.northwind.app"): DnsRecord[] {
  const parts = domain.split(".");
  const apex = parts.length <= 2;
  const name = apex ? "@" : parts.slice(0, -2).join(".");
  return [
    apex
      ? { id: "route", type: "A", name: "@", value: "203.0.113.24", purpose: "Routes traffic to Northwind" }
      : { id: "route", type: "CNAME", name, value: target, purpose: "Routes traffic to Northwind" },
    {
      id: "owner",
      type: "TXT",
      name: apex ? "_northwind" : `_northwind.${name}`,
      value: `northwind-verify=${ownershipToken(domain)}`,
      purpose: "Proves you own the domain",
    },
    {
      id: "ssl",
      type: "CAA",
      name,
      value: '0 issue "letsencrypt.org"',
      purpose: "Lets Let's Encrypt issue the certificate",
    },
  ];
}

/** An abortable pause, so a removed domain stops the poll instantly. */
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const defaultGetRecords: NonNullable<DomainVerifyProps["getRecords"]> = async (domain, signal) => {
  await wait(520, signal);
  return buildRecords(domain);
};

/**
 * The simulated check walks a Cloudflare proxied CNAME through one wrong value and one retry, so
 * the sample shows pending, misconfigured, not found, valid and verified without a backend.
 */
const defaultVerify: NonNullable<DomainVerifyProps["verify"]> = async (domain, records, { signal, attempt, run }) => {
  await wait(620, signal);
  const routed = records.find((record) => record.id === "route");
  const found = routed?.type === "CNAME" ? "104.21.48.112" : "172.67.141.9";
  const state = run === 0 ? (attempt === 0 ? 0 : 1) : attempt === 0 ? 2 : 3;
  const regions = [
    { propagated: 1, total: 3 },
    { propagated: 2, total: 3 },
    { propagated: 2, total: 3 },
    { propagated: 3, total: 3 },
  ][state];
  const passed = (id: string): RecordCheck => ({ id, status: "valid", detail: "Matches in all regions" });

  return {
    regions,
    records: [
      state === 0
        ? { id: "route", status: "missing", detail: "Not found yet" }
        : state === 1
          ? {
              id: "route",
              status: "invalid",
              found,
              fix: "Set the Cloudflare proxy status to DNS only.",
            }
          : state === 2
            ? { id: "route", status: "missing", detail: "Updated value seen in 2 of 3 regions" }
            : passed("route"),
      passed("owner"),
      state === 0 ? { id: "ssl", status: "missing", detail: "Seen in 1 of 3 regions" } : passed("ssl"),
    ],
  };
};

const defaultIssueCertificate: NonNullable<DomainVerifyProps["issueCertificate"]> = async (_domain, signal) => {
  await wait(1100, signal);
  return { issuer: "Let's Encrypt", renews: "Jan 25, 2027" };
};

/** Follows document visibility so the demo loop pauses in a background tab. */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    if (document.hidden) update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** The Cloudflare mark, 14px by default, inline so the card needs no asset. */
function CloudflareMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#F38020"
        d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"
      />
    </svg>
  );
}

/** The Northwind triangle, two gradient halves, used inline in the sample record hint. */
function NorthwindMark({ title = "Northwind" }: { title?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${uid}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M12 2.5 4.75 20.75 12 16.9Z" fill={`url(#${uid}-light)`} />
      <path d="M12 2.5 19.25 20.75 12 16.9Z" fill={`url(#${uid}-dark)`} />
    </svg>
  );
}

/** Single crossfade for a line that changes with the state. */
function Swap({
  id,
  children,
  className,
  reduced,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 0, transition: reduced ? instant : swapOut }}
          transition={reduced ? instant : swapIn}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Spinner() {
  return <LoaderCircle size={16} strokeWidth={1.75} className={styles.spin} aria-hidden="true" />;
}

type RecordStatus = "pending" | "checking" | "valid" | "missing" | "invalid";

const RECORD_STATUS: Record<RecordStatus, { label: string; icon: ReactNode }> = {
  pending: { label: "Not checked", icon: <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" /> },
  checking: { label: "Checking", icon: <Spinner /> },
  valid: { label: "Valid", icon: <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" /> },
  missing: { label: "Not found", icon: <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" /> },
  invalid: { label: "Misconfigured", icon: <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> },
};

const DOMAIN_STATUS: Partial<Record<DomainVerifyPhase, { key: string; label: string; icon: ReactNode }>> = {
  adding: { key: "pending", label: "Pending", icon: <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" /> },
  records: { key: "pending", label: "Pending", icon: <CircleDashed size={16} strokeWidth={1.75} aria-hidden="true" /> },
  checking: { key: "checking", label: "Checking", icon: <Spinner /> },
  invalid: { key: "invalid", label: "Misconfigured", icon: <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> },
  verified: { key: "valid", label: "Verified", icon: <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" /> },
};

interface CheckState {
  status: RecordStatus;
  check?: RecordCheck;
}

/**
 * A custom domain setup card: the customer adds a domain, copies the DNS records, and a checker
 * polls resolvers, marks each record valid, not found or misconfigured with a one-line fix, and
 * finishes with the domain verified and the SSL certificate issued.
 */
export function DomainVerify({
  defaultDomain = DEFAULT_DOMAIN,
  title = "Custom domain",
  description = "Serve your workspace from a domain you own.",
  provider = { name: "Cloudflare", mark: <CloudflareMark /> },
  getRecords,
  verify,
  issueCertificate,
  pollInterval,
  autoPlay,
  onPhaseChange,
  onVerified,
  onRemove,
  className,
}: DomainVerifyProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = !verify;
  const plays = autoPlay ?? (!getRecords && !verify && !issueCertificate);
  const interval = pollInterval ?? (verify ? 5000 : 800);
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inView = useInView(rootRef, { margin: "64px" });
  const pageVisible = usePageVisible();

  const [phase, setPhase] = useState<DomainVerifyPhase>("enter");
  const [draft, setDraft] = useState(defaultDomain);
  const [error, setError] = useState(false);
  const [domain, setDomain] = useState(() => sanitize(defaultDomain));
  const [records, setRecords] = useState<DnsRecord[]>(() => {
    const clean = sanitize(defaultDomain);
    return buildRecords(DOMAIN_PATTERN.test(clean) ? clean : DEFAULT_DOMAIN);
  });
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [regions, setRegions] = useState<VerifyResult["regions"] | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [taken, setTaken] = useState(false);

  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const resumeFocusRef = useRef(false);

  const changePhase = useCallback(
    (next: DomainVerifyPhase) => {
      setPhase(next);
      onPhaseChange?.(next);
    },
    [onPhaseChange],
  );

  const announce = useCallback(
    (message: string) => setAnnouncement(simulated ? `${message} Simulated, no DNS was queried.` : message),
    [simulated],
  );

  /** Every request and timer belongs to the controller, so one abort clears the whole run. */
  const beginRun = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  };

  async function addDomain() {
    const clean = sanitize(draft);
    if (!DOMAIN_PATTERN.test(clean)) {
      setError(true);
      announce("Enter a valid domain, like app.acme.com.");
      inputRef.current?.focus();
      return;
    }
    const controller = beginRun();
    setError(false);
    setFailure(null);
    setDomain(clean);
    changePhase("adding");
    try {
      const next = await (getRecords ?? defaultGetRecords)(clean, controller.signal);
      runRef.current = 0;
      setRecords(next);
      setChecks(Object.fromEntries(next.map((record) => [record.id, { status: "pending" }])));
      setRegions(null);
      setCertificate(null);
      changePhase("records");
      announce(`${clean} added. Add ${next.length} DNS records, then verify.`);
    } catch (caught) {
      if (isAbort(caught)) return;
      changePhase("enter");
      setFailure("Could not add the domain. Try again.");
      announce("Could not add the domain.");
    }
  }

  async function check() {
    const controller = beginRun();
    const run = runRef.current++;
    setFailure(null);
    changePhase("checking");
    announce(`Checking DNS for ${domain}.`);
    setChecks((current) =>
      Object.fromEntries(
        records.map((record) => [
          record.id,
          current[record.id]?.status === "valid"
            ? current[record.id]
            : { ...current[record.id], status: "checking" as const },
        ]),
      ),
    );
    try {
      for (let attempt = 0; ; attempt++) {
        const result = await (verify ?? defaultVerify)(domain, records, {
          signal: controller.signal,
          attempt,
          run,
        });
        const byId = new Map(result.records.map((record) => [record.id, record]));
        const allValid = records.every((record) => byId.get(record.id)?.status === "valid");
        const anyInvalid = records.some((record) => byId.get(record.id)?.status === "invalid");

        setRegions(result.regions);
        setChecks(
          Object.fromEntries(
            records.map((record) => {
              const result = byId.get(record.id);
              const status: RecordStatus =
                result && (result.status !== "missing" || anyInvalid) ? result.status : "checking";
              return [record.id, { status, check: result }];
            }),
          ),
        );

        if (anyInvalid) {
          const broken = records.filter((record) => byId.get(record.id)?.status === "invalid").length;
          changePhase("invalid");
          announce(`${broken === 1 ? "1 record needs" : `${broken} records need`} a fix.`);
          return;
        }
        if (allValid) {
          changePhase("verified");
          announce(`${domain} verified. Issuing the SSL certificate.`);
          const issued = await (issueCertificate ?? defaultIssueCertificate)(domain, controller.signal);
          setCertificate(issued);
          announce(`SSL certificate issued by ${issued.issuer}. ${domain} is live.`);
          onVerified?.(domain, issued);
          return;
        }
        await wait(interval, controller.signal);
      }
    } catch (caught) {
      if (isAbort(caught)) return;
      changePhase("invalid");
      setFailure("The check failed. Try again.");
      announce("The DNS check failed.");
    }
  }

  function reset(clear: boolean) {
    abortRef.current?.abort();
    if (phase !== "enter") onRemove?.(domain);
    setChecks({});
    setRegions(null);
    setCertificate(null);
    setFailure(null);
    setError(false);
    setDraft(clear ? "" : defaultDomain);
    resumeFocusRef.current = clear;
    changePhase("enter");
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  // Add another starts over with an empty field, so hand focus back to it.
  useEffect(() => {
    if (phase === "enter" && resumeFocusRef.current) {
      resumeFocusRef.current = false;
      inputRef.current?.focus();
    }
  }, [phase]);

  const advance = useEffectEvent((current: DomainVerifyPhase) => {
    if (current === "enter") void addDomain();
    else if (current === "records" || current === "invalid") void check();
    else reset(false);
  });

  // The demo plays itself only while the card is on screen and nobody has touched it.
  useEffect(() => {
    if (!plays || taken || !inView || !pageVisible) return;
    const delay =
      phase === "enter"
        ? 1100
        : phase === "records"
          ? 1300
          : phase === "invalid"
            ? 2600
            : phase === "verified" && certificate
              ? 3400
              : 0;
    if (!delay) return;
    const timer = setTimeout(() => advance(phase), delay);
    return () => clearTimeout(timer);
  }, [plays, taken, inView, pageVisible, phase, certificate]);

  const handOver = () => {
    if (plays && !taken) setTaken(true);
  };

  // The card grows when a fix hint wraps, so measure the content and spring the clip to it.
  const measureRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; first: boolean } | null>(null);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    const measure = () => {
      const height = node.offsetHeight;
      setSize((current) => (current && !current.first && current.height === height ? current : { height, first: current === null }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const measuredHeight = size?.height ?? null;
  const first = size?.first ?? true;
  const entry = phase === "enter" || phase === "adding";
  const total = regions?.total ?? 3;
  const propagated = regions?.propagated ?? 0;
  const brokenCount = records.filter((record) => checks[record.id]?.status === "invalid").length;

  const footer = failure
    ? {
        key: "failure",
        primary: failure,
        secondary: phase === "enter" ? "Check the domain and try again" : "No changes were made",
      }
    : phase === "enter" && error
      ? { key: "error", primary: "Enter a valid domain", secondary: "For example app.acme.com" }
      : entry
        ? { key: "enter", primary: "Add a domain", secondary: "Use a domain or subdomain you own" }
        : phase === "records"
          ? {
              key: "records",
              primary: `Add ${records.length} records${provider ? ` at ${provider.name}` : ""}`,
              secondary: "Changes can take a few minutes",
            }
          : phase === "checking"
            ? {
                key: "checking",
                primary: "Checking DNS",
                secondary: regions ? `Propagated in ${propagated} of ${total} regions` : `Querying ${total} regions`,
              }
            : phase === "invalid"
              ? {
                  key: "invalid",
                  primary: `${brokenCount === 1 ? "1 record needs" : `${brokenCount} records need`} a fix`,
                  secondary: `Propagated in ${propagated} of ${total} regions`,
                }
              : certificate
                ? { key: "live", primary: "Domain verified", secondary: `Live in ${total} of ${total} regions` }
                : { key: "issuing", primary: "Domain verified", secondary: "Issuing the SSL certificate" };

  const action =
    entry
      ? {
          label: phase === "adding" ? "Adding" : "Add domain",
          run: () => void addDomain(),
          loading: phase === "adding",
          disabled: !draft.trim(),
          variant: "primary" as const,
        }
      : phase === "records"
        ? { label: "Verify DNS", run: () => void check(), loading: false, disabled: false, variant: "primary" as const }
        : phase === "checking"
          ? { label: "Checking", run: () => {}, loading: true, disabled: false, variant: "primary" as const }
          : phase === "invalid"
            ? { label: "Check again", run: () => void check(), loading: false, disabled: false, variant: "primary" as const }
            : {
                label: "Add another",
                run: () => reset(true),
                loading: false,
                disabled: !certificate,
                variant: "secondary" as const,
              };

  const status = entry ? null : DOMAIN_STATUS[phase];

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={`${id}-title`}
      onPointerDownCapture={handOver}
      onKeyDownCapture={handOver}
    >
      <motion.div
        className={styles.clip}
        initial={false}
        animate={measuredHeight === null ? undefined : { height: measuredHeight }}
        transition={reduced || first ? instant : heightSpring}
      >
        <div ref={measureRef}>
          <div className={styles.body}>
            <header className={styles.header}>
              <h3 id={`${id}-title`} className={styles.title}>
                {title}
              </h3>
              <p className={styles.description}>{description}</p>
            </header>

            <div className={styles.domain} data-phase={phase} data-error={error || undefined}>
              <Globe size={16} strokeWidth={1.75} className={styles.globe} aria-hidden="true" />
              <AnimatePresence initial={false}>
                {entry ? (
                  <motion.div
                    key="field"
                    className={styles.domainSlot}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: reduced ? instant : swapOut }}
                    transition={reduced ? instant : swapIn}
                  >
                    <label htmlFor={id} className={styles.srOnly}>
                      Domain
                    </label>
                    <input
                      ref={inputRef}
                      id={id}
                      className={styles.input}
                      value={draft}
                      placeholder="app.acme.com"
                      inputMode="url"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={phase === "adding"}
                      aria-invalid={error || undefined}
                      aria-describedby={`${id}-status`}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (error) setError(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void addDomain();
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="domain"
                    className={styles.domainSlot}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: reduced ? instant : swapOut }}
                    transition={reduced ? instant : swapIn}
                  >
                    <span className={styles.domainText}>
                      <span className={styles.domainName} title={domain}>
                        {domain}
                      </span>
                      <Swap
                        id={phase === "verified" ? (certificate ? "ssl" : "issuing") : "dns"}
                        className={styles.domainMeta}
                        reduced={reduced}
                      >
                        {phase === "verified" ? (
                          certificate ? (
                            <span className={styles.metaLine}>
                              <Lock size={14} strokeWidth={1.75} className={styles.metaIcon} aria-hidden="true" />
                              <span className={styles.ellipsis}>
                                SSL by {certificate.issuer}
                                <span className={styles.wide}>, renews {certificate.renews}</span>
                              </span>
                            </span>
                          ) : (
                            <span className={styles.metaLine}>
                              <Lock size={14} strokeWidth={1.75} className={styles.metaIcon} aria-hidden="true" />
                              <TextShimmer className={styles.ellipsis}>Issuing SSL</TextShimmer>
                            </span>
                          )
                        ) : provider ? (
                          <span className={styles.metaLine}>
                            <span className={styles.metaIcon}>{provider.mark}</span>
                            <span className={styles.ellipsis}>
                              DNS <span className={styles.wide}>hosted </span>at {provider.name}
                            </span>
                          </span>
                        ) : (
                          <span className={styles.ellipsis}>Waiting for DNS records</span>
                        )}
                      </Swap>
                    </span>
                    <Swap id={status?.key ?? "none"} className={styles.status} reduced={reduced}>
                      {status && (
                        <span className={styles.statusInner} data-status={status.key}>
                          {status.icon}
                          <span>{status.label}</span>
                        </span>
                      )}
                    </Swap>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.remove}
                      aria-label={`Remove ${domain}`}
                      onClick={() => reset(false)}
                    >
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={styles.table} data-empty={entry || undefined}>
              <div className={styles.head} aria-hidden="true">
                <span>Type</span>
                <span>Name</span>
                <span>Value</span>
                <span className={styles.headStatus}>Status</span>
              </div>
              <ul className={styles.rows} aria-label="DNS records" inert={entry || undefined}>
                {records.map((record, index) => {
                  const state = checks[record.id] ?? { status: "pending" as RecordStatus };
                  const meta =
                    state.status === "invalid" && state.check
                      ? {
                          key: `invalid-${state.check.found}`,
                          node: (
                            <>
                              {state.check.found && (
                                <>
                                  Found <code className={styles.found}>{state.check.found}</code>.{" "}
                                </>
                              )}
                              {state.check.fix}
                            </>
                          ),
                        }
                      : {
                          key: state.check?.detail ?? `purpose-${state.status === "valid" ? "valid" : ""}`,
                          node:
                            state.check?.detail ??
                            (getRecords || record.id !== "route" ? (
                              (record.purpose ?? "")
                            ) : (
                              <>
                                Routes traffic to{" "}
                                <span className={styles.inlineMark}>
                                  <NorthwindMark />
                                </span>
                                Northwind
                              </>
                            )),
                        };
                  return (
                    <motion.li
                      key={record.id}
                      className={styles.row}
                      data-status={state.status}
                      initial={false}
                      animate={{ opacity: +!entry }}
                      transition={
                        reduced ? instant : { duration: 0.16, ease: standardEase, delay: entry ? 0 : 0.04 * index }
                      }
                    >
                      <span className={styles.type}>{record.type}</span>
                      <span className={styles.name} title={record.name}>
                        {record.name}
                      </span>
                      <span className={styles.value}>
                        <span className={styles.valueText} title={record.value}>
                          {record.value}
                        </span>
                        <CopyButton
                          value={record.value}
                          iconOnly
                          variant="plain"
                          label={`Copy ${record.type} value`}
                          className={styles.copy}
                        />
                      </span>
                      <Swap id={state.status} className={styles.status} reduced={reduced}>
                        <span className={styles.statusInner} data-status={state.status}>
                          {RECORD_STATUS[state.status].icon}
                          <span>{RECORD_STATUS[state.status].label}</span>
                        </span>
                      </Swap>
                      <Swap id={meta.key} className={styles.meta} reduced={reduced}>
                        <span className={state.status === "invalid" ? styles.hint : styles.ellipsis}>{meta.node}</span>
                      </Swap>
                    </motion.li>
                  );
                })}
              </ul>
              <AnimatePresence initial={false}>
                {entry && (
                  <motion.p
                    key="empty"
                    className={styles.empty}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: reduced ? instant : swapOut }}
                    transition={reduced ? instant : swapIn}
                  >
                    DNS records appear here after you add a domain
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          <footer className={styles.footer}>
            <div className={styles.footerText} id={`${id}-status`}>
              <Swap id={footer.key + footer.primary} className={styles.footerPrimary} reduced={reduced}>
                {phase !== "checking" || failure ? (
                  <span
                    className={styles.ellipsis}
                    data-tone={footer.key === "error" || footer.key === "failure" ? "danger" : undefined}
                  >
                    {footer.primary}
                  </span>
                ) : (
                  <TextShimmer className={styles.ellipsis}>{footer.primary}</TextShimmer>
                )}
              </Swap>
              <Swap id={footer.secondary} className={styles.footerSecondary} reduced={reduced}>
                <span className={styles.ellipsis}>{footer.secondary}</span>
              </Swap>
            </div>
            <Button
              variant={action.variant}
              size="sm"
              loading={action.loading}
              disabled={action.disabled}
              onClick={action.run}
              className={styles.action}
            >
              {action.label}
            </Button>
          </footer>
        </div>
      </motion.div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}

export default DomainVerify;
