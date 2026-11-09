"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode, SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import Button from "../button/button";
import styles from "./magic-link.module.css";

export type MagicLinkProvider = "google" | "github";
export type MailApp = "gmail" | "outlook";

export interface MagicLinkProps {
  /** Your product's name, used in the title ("Sign in to Halden") and the card's accessible name. */
  appName?: string;
  /** The address the link comes from. Shown on the inbox step and used by Open Gmail to search for the email. */
  sender?: string;
  /** Prefills the email field, for example from a previous session or an invite. */
  defaultEmail?: string;
  /** The label above the email field. */
  emailLabel?: string;
  /** Social sign in buttons, in order, with their real marks. One provider spans the row. Pass [] to hide the buttons and the divider. */
  providers?: MagicLinkProvider[];
  /** Inbox shortcuts on the Check your inbox step. Pass [] to hide them. */
  mailApps?: MailApp[];
  /** Seconds before the link can be sent again. The countdown restarts after every resend. */
  resendAfter?: number;
  /** How long the link stays valid. Display only; enforce it on the server. */
  expiresInMinutes?: number;
  /**
   * Sends the magic link, for the first send and every resend. Throw to show "We couldn't send the link"
   * (or Retry resend). The signal aborts when the person goes back or the card unmounts. Leave it out to
   * simulate a send; nothing is sent and a status message says so.
   */
  onSendLink?: (email: string, signal: AbortSignal) => Promise<void> | void;
  /**
   * Starts a social sign in, usually a redirect to your auth provider. The button shows a spinner until it
   * settles; throw to show an inline error. Leave it out to simulate one.
   */
  onProviderSignIn?: (provider: MagicLinkProvider, signal: AbortSignal) => Promise<void> | void;
  /**
   * Handles the inbox shortcuts. By default Gmail opens a search for the sender in a new tab, and Outlook
   * opens outlook.live.com for personal addresses or outlook.office.com for work ones.
   */
  onOpenMail?: (app: MailApp, email: string) => void;
  /** Extra validation after the format check, such as allowing only company domains. Return the error message to show, or nothing to accept. */
  validateEmail?: (email: string) => string | null | undefined;
  /** Link to your terms in the footer. */
  termsHref?: string;
  /** Link to your privacy policy in the footer. */
  privacyHref?: string;
  /** Class on the root wrapper, which spans its container and centers the card. */
  className?: string;
}

type Step = "form" | "sent";
type MessageTone = "error" | "hint" | "info";
type ResendPhase = "idle" | Exclude<ResendState, "count" | "ready">;
type ResendState = "count" | "ready" | "sending" | "sent" | "failed";

interface Message {
  tone: MessageTone;
  text: string;
  suggestion?: string;
}

/** The envelope writes its own curves: a decelerate drop, a hard fold that snaps the flap shut, and a short settle. */
const dropEase: [number, number, number, number] = [0.16, 1, 0.3, 1];
const foldEase: [number, number, number, number] = [0.4, 0, 1, 1];
const shutEase: [number, number, number, number] = [0, 0, 0.2, 1];

/** Both flap paths rotate around the fold line at the top of the envelope body, in viewBox units. */
const flapOrigin = { transformBox: "view-box", transformOrigin: "32px 19px" } as const;
const badgeOrigin = { transformBox: "view-box", transformOrigin: "53px 43px" } as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

/** Domain typos people actually make, mapped to the address they meant. */
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

/** Work and school Microsoft accounts land on outlook.office.com, personal ones on outlook.live.com. */
const WORK_MAIL = /@(outlook|hotmail|live|msn)\./i;

function suggestDomain(email: string): string | undefined {
  const at = email.lastIndexOf("@");
  const fix = DOMAIN_FIXES[email.slice(at + 1).toLowerCase()];
  return fix ? `${email.slice(0, at)}@${fix}` : undefined;
}

/** Simulated sends keep the real timings, so the spinner and the crossfade read the same with no callback. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
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

function GoogleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function GmailMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#4285F4" d="M1.636 21.002h3.819v-9.273L0 7.638v11.728c0 .904.732 1.636 1.636 1.636z" />
      <path fill="#34A853" d="M18.545 21.002h3.819c.904 0 1.636-.732 1.636-1.636V7.638l-5.455 4.091z" />
      <path fill="#FBBC04" d="M18.545 4.638v7.091L24 7.638V5.457c0-2.023-2.309-3.178-3.927-1.964z" />
      <path fill="#EA4335" d="M5.455 11.729V4.638L12 9.548l6.545-4.91v7.091L12 16.639z" />
      <path fill="#C5221F" d="M0 5.457v2.181l5.455 4.091V4.638L3.927 3.493C2.309 2.279 0 3.434 0 5.457z" />
    </svg>
  );
}

function OutlookMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="7.5" y="3" width="16" height="18" rx="2" fill="#0078D4" />
      <path fill="#28A8EA" d="M7.5 10.6 15.5 15.4l8-4.8V19a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z" />
      <path fill="#50D9FF" d="M15.5 3h6a2 2 0 0 1 2 2v3.4h-8z" opacity=".55" />
      <rect x="0.5" y="6" width="12.5" height="12" rx="2" fill="#0A5CB0" />
      <ellipse cx="6.75" cy="12" rx="2.75" ry="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

const PROVIDERS: Record<MagicLinkProvider, { label: string; Mark: (props: SVGProps<SVGSVGElement>) => ReactNode }> = {
  google: { label: "Google", Mark: GoogleMark },
  github: { label: "GitHub", Mark: GitHubMark },
};

const MAIL_APPS: Record<MailApp, { label: string; Mark: (props: SVGProps<SVGSVGElement>) => ReactNode }> = {
  gmail: { label: "Gmail", Mark: GmailMark },
  outlook: { label: "Outlook", Mark: OutlookMark },
};

/** One small inline SVG, played once per send: the letter drops in, the flap folds shut, the check settles. */
function Envelope({ play }: { play: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const run = play && !reduced;
  const clipId = `${useId().replace(/:/g, "")}-body`;
  return (
    <svg className={styles.envelope} viewBox="0 0 64 52" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="4.75" y="18.75" width="54.5" height="30.5" rx="5" />
        </clipPath>
      </defs>
      <rect x="4.75" y="18.75" width="54.5" height="30.5" rx="5" className={styles.envBack} />
      <motion.path
        d="M5.5 19.25 32 3.75l26.5 15.5Z"
        className={styles.envFlapOpen}
        style={flapOrigin}
        initial={run ? { scaleY: 1 } : false}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.1, delay: 0.36, ease: foldEase }}
      />
      <motion.g
        initial={run ? { y: -16, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ y: { duration: 0.3, delay: 0.06, ease: dropEase }, opacity: { duration: 0.12, delay: 0.06 } }}
      >
        <rect x="12.75" y="21.75" width="38.5" height="26" rx="3" className={styles.envLetter} />
        <path d="M18.5 28h12" className={styles.envLineStrong} />
        <path d="M18.5 33h27M18.5 37.5h20" className={styles.envLine} />
      </motion.g>
      <g clipPath={`url(#${clipId})`}>
        <path d="M0 18.75 32 33l32-14.25V52H0Z" className={styles.envPocket} />
        <path d="M4.75 19.5 32 33l27.25-13.5" className={styles.envStroke} />
      </g>
      <motion.path
        d="M5.5 19.25 32 36l26.5-16.75Z"
        className={styles.envFlap}
        style={flapOrigin}
        initial={run ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.16, delay: 0.46, ease: shutEase }}
      />
      <rect x="4.75" y="18.75" width="54.5" height="30.5" rx="5" className={styles.envStroke} />
      <motion.g
        style={badgeOrigin}
        initial={run ? { scale: 0.5, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ scale: { duration: 0.2, delay: 0.62, ease: dropEase }, opacity: { duration: 0.12, delay: 0.62 } }}
      >
        <circle cx="53" cy="43" r="8.25" className={styles.envBadge} />
        <path d="m49.6 43.1 2.3 2.3 4.5-4.6" className={styles.envCheck} />
      </motion.g>
    </svg>
  );
}

/**
 * The resend label keeps every state mounted as a hidden ghost, so the button never resizes and the visible
 * label can crossfade in place. Resend stays focusable during the countdown (aria-disabled only).
 */
function ResendLabel({ phase, remaining, fade }: { phase: ResendPhase; remaining: number; fade: Transition }) {
  const state: ResendState = phase === "idle" ? (remaining > 0 ? "count" : "ready") : phase;
  const labels: Record<ResendState, ReactNode> = {
    count: (
      <span>
        Resend in <span className={styles.count}>{`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}</span>
      </span>
    ),
    ready: "Resend link",
    sending: "Sending…",
    sent: (
      <>
        <Check className={styles.textIcon} aria-hidden="true" />
        New link sent
      </>
    ),
    failed: (
      <>
        <CircleAlert className={styles.textIcon} aria-hidden="true" />
        Retry resend
      </>
    ),
  };

  return (
    <span className={styles.resend}>
      {Object.entries(labels).map(([ghost, label]) => (
        <span key={`ghost-${ghost}`} className={styles.ghost} aria-hidden="true">
          {ghost === "count" ? (
            <span>
              Resend in <span className={styles.count}>0:00</span>
            </span>
          ) : (
            label
          )}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          className={[styles.resendLabel, state === "count" ? styles.waiting : ""].filter(Boolean).join(" ")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: fade }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          {labels[state]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A passwordless sign in card. Google and GitHub sit above an email field with inline validation and a typo
 * check; Send magic link crossfades the card in place to Check your inbox, where an envelope seals the letter,
 * the inbox shortcuts jump to Gmail or Outlook and a resend countdown ticks.
 */
export function MagicLink({
  appName = "Halden",
  sender = "login@halden.app",
  defaultEmail = "",
  emailLabel = "Work email",
  providers = ["google", "github"],
  mailApps = ["gmail", "outlook"],
  resendAfter = 30,
  expiresInMinutes = 15,
  onSendLink,
  onProviderSignIn,
  onOpenMail,
  validateEmail,
  termsHref = "#",
  privacyHref = "#",
  className,
}: MagicLinkProps) {
  const reduced = useReducedMotion() ?? false;
  const baseId = useId();
  const [email, setEmail] = useState(defaultEmail);
  const [sentEmail, setSentEmail] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [sending, setSending] = useState(false);
  const [providerLoading, setProviderLoading] = useState<MagicLinkProvider | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [touched, setTouched] = useState(false);
  const [lastSent, setLastSent] = useState("");
  const [sendCount, setSendCount] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const [resendPhase, setResendPhase] = useState<ResendPhase>("idle");
  const [status, setStatus] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sendAbort = useRef<AbortController | null>(null);
  const providerAbort = useRef<AbortController | null>(null);
  const resendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shouldFocus = useRef(false);

  useEffect(
    () => () => {
      sendAbort.current?.abort();
      providerAbort.current?.abort();
      clearTimeout(resendTimer.current);
    },
    [],
  );

  // Focus follows the step, never the first paint.
  useEffect(() => {
    if (!shouldFocus.current) return;
    if (step === "sent") {
      headingRef.current?.focus({ preventScroll: true });
    } else {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }
  }, [step]);

  // A 250ms tick keeps the countdown honest across tab throttling; it stops once the deadline passes.
  useEffect(() => {
    if (step !== "sent" || !deadline) return;
    const interval = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [step, deadline]);

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const simulated = !onSendLink;

  function validate(value: string): Message | null {
    if (!value) return { tone: "error", text: "Enter your email address" };
    if (!EMAIL_PATTERN.test(value)) return { tone: "error", text: "Check the email address for typos" };
    const custom = validateEmail?.(value);
    return custom ? { tone: "error", text: custom } : null;
  }

  async function sendLink(address: string, kind: "first" | "resend"): Promise<boolean | undefined> {
    sendAbort.current?.abort();
    const controller = new AbortController();
    sendAbort.current = controller;
    try {
      if (onSendLink) await onSendLink(address, controller.signal);
      else await wait(kind === "first" ? 900 : 700, controller.signal);
      if (controller.signal.aborted) return undefined;
      const time = Date.now();
      setNow(time);
      setDeadline(time + resendAfter * 1000);
      setSendCount(count => count + 1);
      return true;
    } catch {
      return controller.signal.aborted ? undefined : false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || providerLoading) return;
    const address = email.trim();
    setTouched(true);
    const invalid = validate(address);
    if (invalid) {
      setMessage(invalid);
      setStatus("");
      inputRef.current?.focus();
      return;
    }
    // One hint per typed address: pressing Enter again sends to the address as typed.
    const suggestion = suggestDomain(address);
    if (suggestion && lastSent !== address) {
      setLastSent(address);
      setMessage({ tone: "hint", text: "Did you mean", suggestion });
      return;
    }
    setMessage(null);
    setSending(true);
    setStatus("Sending your sign in link");
    const result = await sendLink(address, "first");
    if (result === undefined) return;
    setSending(false);
    if (!result) {
      setMessage({ tone: "error", text: "We couldn't send the link. Try again." });
      setStatus("We couldn't send the link");
      return;
    }
    shouldFocus.current = true;
    setSentEmail(address);
    setResendPhase("idle");
    setStep("sent");
    setStatus(`Magic link sent to ${address}.${simulated ? " Simulated, nothing was sent." : ""}`);
  }

  async function resend() {
    if (remaining > 0 || resendPhase === "sending") return;
    clearTimeout(resendTimer.current);
    setResendPhase("sending");
    const result = await sendLink(sentEmail, "resend");
    if (result === undefined) return;
    if (!result) {
      setResendPhase("failed");
      setStatus("We couldn't resend the link");
      return;
    }
    setResendPhase("sent");
    setStatus(`New link sent to ${sentEmail}.${simulated ? " Simulated, nothing was sent." : ""}`);
    resendTimer.current = setTimeout(() => setResendPhase("idle"), 1800);
  }

  async function providerSignIn(provider: MagicLinkProvider) {
    if (providerLoading || sending) return;
    const { label } = PROVIDERS[provider];
    providerAbort.current?.abort();
    const controller = new AbortController();
    providerAbort.current = controller;
    setProviderLoading(provider);
    setMessage(null);
    try {
      if (onProviderSignIn) {
        await onProviderSignIn(provider, controller.signal);
      } else {
        await wait(800, controller.signal);
        setMessage({ tone: "info", text: `Simulated, ${label} sign in would open here` });
        setStatus(`Simulated, ${label} sign in was not opened`);
      }
    } catch {
      if (controller.signal.aborted) return;
      setMessage({ tone: "error", text: `${label} sign in didn't finish. Try again.` });
    }
    if (!controller.signal.aborted) setProviderLoading(null);
  }

  function openMail(app: MailApp) {
    if (onOpenMail) {
      onOpenMail(app, sentEmail);
      return;
    }
    window.open(
      app === "gmail"
        ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${sender} newer_than:1d`)}`
        : WORK_MAIL.test(sentEmail)
          ? "https://outlook.live.com/mail/0/"
          : "https://outlook.office.com/mail/",
      "_blank",
      "noopener,noreferrer",
    );
    setStatus(`Opened ${MAIL_APPS[app].label} in a new tab`);
  }

  // Steps share one grid cell: the old one fades out over 100ms, the new one fades in over 200ms with a 4px rise.
  const viewVariants: Variants = {
    shown: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.12 : 0.2, delay: reduced ? 0 : 0.08, ease: [...motionTokens.ease.enter] },
    },
    hidden: (distance: number) => ({
      opacity: 0,
      y: reduced ? 0 : distance,
      transition: { duration: 0.1, ease: [...motionTokens.ease.standard] },
    }),
  };
  const fade: Transition = reduced ? { duration: 0.12 } : { duration: 0.16, ease: [...motionTokens.ease.enter] };
  const messageId = `${baseId}-message`;
  const busy = sending || providerLoading !== null;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <section className={styles.card} aria-label={`Sign in to ${appName}`}>
        <div className={styles.stack}>
          <motion.div className={styles.view} custom={-4} variants={viewVariants} initial={false} animate={step === "form" ? "shown" : "hidden"} inert={step !== "form"}>
            <div className={styles.body}>
              <header className={styles.header}>
                <h2 className={styles.title}>Sign in to {appName}</h2>
                <p className={styles.subtitle}>Welcome back. No password needed.</p>
              </header>
              {providers.length ? (
                <>
                  <div className={[styles.pair, providers.length === 1 ? styles.single : ""].filter(Boolean).join(" ")}>
                    {providers.map(provider => {
                      const { label, Mark } = PROVIDERS[provider];
                      return (
                        <Button
                          key={provider}
                          type="button"
                          variant="secondary"
                          className={styles.wide}
                          loading={providerLoading === provider}
                          disabled={busy && providerLoading !== provider}
                          onClick={() => providerSignIn(provider)}
                          aria-label={`Continue with ${label}`}
                        >
                          <Mark className={styles.mark} />
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className={styles.divider} role="separator" aria-label="or">
                    <span aria-hidden="true">or</span>
                  </div>
                </>
              ) : null}
              <form className={styles.form} onSubmit={submit} noValidate>
                <label className={styles.label} htmlFor={`${baseId}-email`}>
                  {emailLabel}
                </label>
                <input
                  ref={inputRef}
                  id={`${baseId}-email`}
                  className={styles.input}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="you@company.com"
                  value={email}
                  onChange={event => {
                    const next = event.target.value;
                    setEmail(next);
                    if (!message) return;
                    // Re-validate only while an error is showing; a typo hint clears as soon as the address changes.
                    if (message.tone === "error" && touched) setMessage(validate(next.trim()));
                    else if (message.tone !== "error") setMessage(null);
                  }}
                  readOnly={sending}
                  aria-invalid={message?.tone === "error" || undefined}
                  aria-describedby={message ? messageId : undefined}
                />
                <div className={styles.message} id={messageId}>
                  <AnimatePresence initial={false}>
                    {message ? (
                      <motion.div
                        key={`${message.tone}:${message.text}:${message.suggestion ?? ""}`}
                        className={[styles.messageRow, styles[message.tone]].join(" ")}
                        role={message.tone === "error" ? "alert" : undefined}
                        initial={{ opacity: 0, y: reduced ? 0 : 2 }}
                        animate={{ opacity: 1, y: 0, transition: fade }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        {message.tone === "error" ? <CircleAlert className={styles.messageIcon} aria-hidden="true" /> : null}
                        {message.tone === "info" ? <Check className={styles.messageIcon} aria-hidden="true" /> : null}
                        <span className={styles.messageText}>{message.text}</span>
                        {message.suggestion ? (
                          <span className={styles.suggestion}>
                            <button
                              type="button"
                              className={styles.fix}
                              onClick={() => {
                                setEmail(message.suggestion ?? "");
                                setMessage(null);
                                inputRef.current?.focus();
                              }}
                            >
                              {message.suggestion}
                            </button>
                            ?
                          </span>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
                <Button type="submit" className={styles.wide} loading={sending} disabled={providerLoading !== null}>
                  Send magic link
                </Button>
              </form>
            </div>
            <footer className={styles.footer}>
              <p className={styles.terms}>
                By continuing, you agree to the <a href={termsHref}>Terms</a> and <a href={privacyHref}>Privacy Policy</a>.
              </p>
            </footer>
          </motion.div>

          <motion.div className={styles.view} custom={4} variants={viewVariants} initial={false} animate={step === "sent" ? "shown" : "hidden"} inert={step !== "sent"}>
            <div className={[styles.body, styles.sentBody].join(" ")}>
              <Envelope key={sendCount} play={sendCount > 0} />
              <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
                Check your inbox
              </h2>
              <p className={styles.subtitle}>We sent a sign in link to</p>
              <p className={styles.email} title={sentEmail}>
                {sentEmail || "\u00a0"}
              </p>
              <p className={styles.meta}>
                From {sender} · expires in {expiresInMinutes} minutes
              </p>
              {mailApps.length ? (
                <div className={[styles.pair, styles.apps, mailApps.length === 1 ? styles.single : ""].filter(Boolean).join(" ")}>
                  {mailApps.map(app => {
                    const { label, Mark } = MAIL_APPS[app];
                    return (
                      <Button key={app} type="button" variant="secondary" className={styles.wide} onClick={() => openMail(app)}>
                        <Mark className={styles.mark} />
                        Open {label}
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <footer className={[styles.footer, styles.sentFooter].join(" ")}>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  sendAbort.current?.abort();
                  clearTimeout(resendTimer.current);
                  shouldFocus.current = true;
                  setResendPhase("idle");
                  setStep("form");
                  setStatus("");
                }}
              >
                <ArrowLeft className={styles.textIcon} aria-hidden="true" />
                Use a different email
              </button>
              <button type="button" className={styles.textButton} onClick={resend} aria-disabled={remaining > 0 || resendPhase === "sending" || undefined}>
                <ResendLabel phase={resendPhase} remaining={remaining} fade={fade} />
              </button>
            </footer>
          </motion.div>
        </div>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  );
}

export default MagicLink;
