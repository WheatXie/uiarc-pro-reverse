"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { AnimationPlaybackControls, MotionValue, TargetAndTransition, Transition, Variants } from "motion/react";
import { ChevronDown, Plus, TriangleAlert } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Badge } from "../badge/badge";
import { Button } from "../button/button";
import { Checkbox } from "../checkbox/checkbox";
import { CopyButton } from "../copy-button/copy-button";
import { HoldToConfirm } from "../hold-to-confirm/hold-to-confirm";
import { Input } from "../input/input";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./api-keys.module.css";

export type ApiKeyEnvironment = "live" | "test";

export interface ApiKeyOwner {
  name: string;
  photo: string;
}

export interface ApiKey {
  id: string;
  name: string;
  env: ApiKeyEnvironment;
  /** Last four characters of the secret. The rest is never kept. */
  last4: string;
  scopes: string[];
  created: string;
  /** Human readable age of the last signed request, or "never". */
  used: string;
  /** Caller address of the last signed request, such as "34.201.18.7, Ashburn". */
  source?: string;
  requests: number;
  /** Set when the key has gone quiet for long enough to be worth revoking. */
  idle?: string;
  owner: ApiKeyOwner;
}

interface Scope {
  id: string;
  description: string;
}

interface CreateErrors {
  name?: string;
  scopes?: string;
}

const sofia: ApiKeyOwner = { name: "Sofia Ramirez", photo: "/media/people/sofia-ramirez.svg" };

const SCOPES: Scope[] = [
  { id: "payments:write", description: "Create, capture, and refund payments" },
  { id: "customers:read", description: "Read customers and saved payment methods" },
  { id: "invoices:write", description: "Draft, finalize, and send invoices" },
  { id: "reports:read", description: "Download balance and payout reports" },
];

const SAMPLE_KEYS: ApiKey[] = [
  {
    id: "production",
    name: "Production server",
    env: "live",
    last4: "4f2a",
    scopes: ["payments:write", "customers:read", "invoices:write"],
    created: "Mar 4, 2026",
    used: "2 min ago",
    source: "34.201.18.7, Ashburn",
    requests: 1284902,
    owner: { name: "Emma Collins", photo: "/media/people/emma-collins.svg" },
  },
  {
    id: "billing",
    name: "Billing worker",
    env: "live",
    last4: "9c01",
    scopes: ["invoices:write", "reports:read"],
    created: "Jan 18, 2026",
    used: "3 hours ago",
    source: "18.184.72.40, Frankfurt",
    requests: 48211,
    owner: { name: "Marcus Johnson", photo: "/media/people/marcus-johnson.svg" },
  },
  {
    id: "staging",
    name: "Staging",
    env: "test",
    last4: "d7e3",
    scopes: ["payments:write", "customers:read"],
    created: "Aug 30, 2026",
    used: "yesterday",
    source: "CI runner 10.0.12.8",
    requests: 9870,
    owner: { name: "Ava Mitchell", photo: "/media/people/ava-mitchell.svg" },
  },
  {
    id: "export",
    name: "Analytics export",
    env: "live",
    last4: "2b8a",
    scopes: ["reports:read"],
    created: "Nov 2, 2025",
    used: "41 days ago",
    source: "52.17.230.9, Dublin",
    idle: "No requests in 41 days. Revoke it if nothing depends on it.",
    requests: 0,
    owner: { name: "Jasmine Brooks", photo: "/media/people/jasmine-brooks.svg" },
  },
  {
    id: "local",
    name: "Local development",
    env: "test",
    last4: "6a55",
    scopes: ["payments:write", "customers:read", "invoices:write", "reports:read"],
    created: "Sep 9, 2026",
    used: "never",
    requests: 0,
    owner: sofia,
  },
];

const ENVIRONMENTS = [
  { value: "test", label: "Test" },
  { value: "live", label: "Live" },
];

const DEFAULT_SCOPES = ["customers:read"];

const SEARCH_LENGTH = 40;
const SECRET_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Stable sample secret: the same name, environment and attempt always mint the same key. */
function buildSecret(seed: string, env: ApiKeyEnvironment) {
  let hash = 0x811c9dc5;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 0x1000193);
  let secret = "";
  for (let index = 0; index < SEARCH_LENGTH; index++) {
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    hash ^= hash >>> 16;
    secret += SECRET_ALPHABET[(hash >>> 0) % SECRET_ALPHABET.length];
    hash = (hash + 0x9e3779b9) | 0;
  }
  return `sk_${env}_${secret}`;
}

const enter = [...motionTokens.ease.enter] as [number, number, number, number];
const standard = [...motionTokens.ease.standard] as [number, number, number, number];
const instant: Transition = { duration: 0 };

const wordShown: TargetAndTransition = { opacity: 1, y: "0em", filter: "blur(0px)" };
const wordIn: TargetAndTransition = { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` };
const wordOut: TargetAndTransition = {
  opacity: 0,
  y: "-0.3em",
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: standard },
};

const digit: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.6 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: "0em", filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${-0.6 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
};

const numberFormat = new Intl.NumberFormat("en-US");

/** The outgoing copy is hidden from assistive tech while it leaves, so the new word is the only one read. */
function SwapWord({ text, reduced }: { text: string; reduced: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={styles.swapText}
      aria-hidden={!present || undefined}
      initial={reduced ? { opacity: 0 } : wordIn}
      animate={wordShown}
      exit={reduced ? { opacity: 0, transition: instant } : wordOut}
      transition={reduced ? instant : { duration: motionTokens.duration.standard, ease: enter }}
    >
      {text}
    </motion.span>
  );
}

/** One word of copy that crossfades to the next instead of snapping. */
function Swap({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <span className={styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <SwapWord key={text} text={text} reduced={reduced} />
      </AnimatePresence>
    </span>
  );
}

/** Digits roll up when the count grows and down when it shrinks; the direction is handed to copies already leaving. */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) setState({ value, direction: value > state.value ? 1 : -1 });

  return (
    <span className={styles.roll} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
        <motion.span
          key={state.value}
          custom={state.direction}
          variants={digit}
          initial={!reduced && "enter"}
          animate="center"
          exit={reduced ? undefined : "exit"}
          transition={
            reduced
              ? instant
              : {
                  y: motionTokens.spring.snappy,
                  opacity: { duration: motionTokens.duration.fast },
                  filter: { duration: motionTokens.duration.fast },
                }
          }
        >
          {state.value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A revoked key is struck through as the row goes, rather than vanishing mid-sentence. */
function Strike({ on, delay, reduced }: { on: boolean; delay: number; reduced: boolean }) {
  return (
    <motion.span
      className={styles.strike}
      aria-hidden="true"
      initial={false}
      animate={{ scaleX: on ? 1 : 0 }}
      transition={reduced ? instant : { duration: motionTokens.duration.considered, ease: enter, delay }}
    />
  );
}

/**
 * The create button measures itself in both states and grows into the form from that exact box: width follows the
 * toolbar, height the tallest of the panel and the button, so nothing jumps when the panel mounts or unmounts.
 */
function useUnfold(open: boolean, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto");
  const height = useMotionValue<number | "auto">("auto");
  const [box, setBox] = useState({ toolbar: 0, face: 0, row: 0, inner: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const animatingUntil = useRef(0);
  const running = useRef<Record<string, AnimationPlaybackControls | undefined>>({});

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const face = faceRef.current;
    const inner = innerRef.current;
    if (!toolbar || !face || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setBox(previous => {
      const next = {
        toolbar: toolbar.getBoundingClientRect().width,
        // While open the face is clipped away, so its last closed width is the one worth remembering.
        face: openRef.current && previous.face ? previous.face : face.getBoundingClientRect().width,
        row: face.offsetHeight,
        inner: inner.getBoundingClientRect().height,
      };
      const same = next.toolbar === previous.toolbar && next.face === previous.face && next.row === previous.row && next.inner === previous.inner;
      return same ? previous : next;
    }));
    [toolbar, face, inner].forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!box.toolbar || !box.face || !box.row) return;
    // A close or open inside the settle window keeps animating; anything later is measured, not eased.
    const animated = !reduced && performance.now() < animatingUntil.current;
    const apply = (value: MotionValue<number | "auto">, target: number, key: string) => {
      const current = value.get();
      running.current[key]?.stop();
      if (animated && typeof current === "number") {
        if (Math.abs(current - target) > 0.5) running.current[key] = animate(value, target, motionTokens.spring.smooth);
      } else value.jump(target);
    };
    apply(width, open ? box.toolbar : box.face, "width");
    apply(height, open ? Math.max(box.inner, box.row) : box.row, "height");
  }, [open, box, reduced, width, height]);

  useEffect(() => () => {
    running.current.width?.stop();
    running.current.height?.stop();
  }, []);

  return {
    width,
    height,
    toolbarRef,
    faceRef,
    innerRef,
    arm: () => {
      animatingUntil.current = performance.now() + 900;
    },
  };
}

interface KeyRowProps {
  item: ApiKey;
  rowId: string;
  open: boolean;
  fresh: boolean;
  revoked: boolean;
  reduced: boolean;
  onToggle: () => void;
  onRevoke: () => void;
  triggerRef: (node: HTMLButtonElement | null) => void;
}

function KeyRow({ item, rowId, open, fresh, revoked, reduced, onToggle, onRevoke, triggerRef }: KeyRowProps) {
  const detailId = `${rowId}-detail`;
  const detailMotion = reduced ? instant : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter, delay: 0.05 } };

  return (
    <motion.div
      id={rowId}
      role="listitem"
      className={styles.row}
      data-open={open}
      data-fresh={fresh}
      data-revoked={revoked}
      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={
        reduced
          ? { opacity: 0, transition: instant }
          : { opacity: 0, height: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: enter } } }
      }
      transition={
        reduced
          ? instant
          : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: standard, delay: 0.08 } }
      }
    >
      <div className={styles.rowInner}>
        <span className={styles.flash} aria-hidden="true" />
        <button
          ref={triggerRef}
          className={styles.trigger}
          type="button"
          aria-expanded={open}
          aria-controls={open ? detailId : undefined}
          disabled={revoked}
          onClick={onToggle}
        >
          <span className={styles.identity}>
            <span className={styles.nameLine}>
              <span className={styles.strikeable}>
                <span className={styles.name}>{item.name}</span>
                <Strike on={revoked} delay={0} reduced={reduced} />
              </span>
              <Badge size="sm" tone={item.env === "live" ? "success" : "neutral"} className={styles.env}>
                {item.env === "live" ? "Live" : "Test"}
              </Badge>
            </span>
            <span className={styles.strikeable}>
              <span className={styles.masked} aria-hidden="true">{`sk_${item.env}_••••${item.last4}`}</span>
              <Strike on={revoked} delay={0.08} reduced={reduced} />
            </span>
            <span className={styles.srOnly}>{`Key ending in ${item.last4}${revoked ? ", revoked" : ""}`}</span>
          </span>
          <span className={styles.scopes}>
            <span className={styles.srOnly}>Scopes: </span>
            {item.scopes.map(scope => <span key={scope} className={styles.chip}>{scope}</span>)}
          </span>
          <span className={styles.dates}>
            <span className={styles.used}>
              {item.idle ? (
                <>
                  <TriangleAlert className={styles.idleIcon} size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.srOnly}>Idle, </span>
                </>
              ) : null}
              {item.used === "never" ? "Never used" : `Used ${item.used}`}
            </span>
            <span className={styles.created}>Created {item.created}</span>
          </span>
          <ChevronDown className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="detail"
              id={detailId}
              className={styles.detail}
              role="region"
              aria-label={`${item.name} details`}
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: instant }
                  : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } } }
              }
              transition={reduced ? instant : detailMotion}
            >
              <div className={styles.detailInner}>
                <dl className={styles.facts}>
                  <div>
                    <dt>Created by</dt>
                    <dd>
                      <Avatar name={item.owner.name} src={item.owner.photo} size="sm" aria-hidden="true" />
                      {item.owner.name}
                    </dd>
                  </div>
                  <div>
                    <dt>Last request</dt>
                    <dd>
                      {item.used === "never"
                        ? "No requests yet"
                        : `${item.used.charAt(0).toUpperCase()}${item.used.slice(1)} from ${item.source}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Requests in 30 days</dt>
                    <dd className={styles.number}>{numberFormat.format(item.requests)}</dd>
                  </div>
                  <div className={styles.narrowFact}>
                    <dt>Created</dt>
                    <dd>{item.created}</dd>
                  </div>
                  <div className={`${styles.narrowFact} ${styles.scopeFact}`}>
                    <dt>Scopes</dt>
                    <dd className={styles.factChips}>
                      {item.scopes.map(scope => <span key={scope} className={styles.chip}>{scope}</span>)}
                    </dd>
                  </div>
                </dl>
                <div className={styles.revokeRow}>
                  <p className={styles.revokeNote}>
                    {item.idle ? (
                      <>
                        <TriangleAlert className={styles.idleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                        <span>{item.idle}</span>
                      </>
                    ) : (
                      <span>Requests signed with this key fail as soon as it is revoked.</span>
                    )}
                  </p>
                  <HoldToConfirm label="Hold to revoke" confirmedLabel="Revoked" onConfirm={onRevoke} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * API keys: a list of secret keys a team signs server requests with. Each row opens into who created it, where it was
 * last used, and how much it has been used this month; the create button unfolds into a short form and, once the key is
 * minted, into the one-time secret. Keys are revoked by holding a button, then struck through before the row leaves.
 */
export function ApiKeys() {
  const id = useId();
  const reduced = useReducedMotion() ?? false;
  const [keys, setKeys] = useState<ApiKey[]>(SAMPLE_KEYS);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"form" | "reveal">("form");
  const [name, setName] = useState("");
  const [env, setEnv] = useState<ApiKeyEnvironment>("test");
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
  const [errors, setErrors] = useState<CreateErrors>({});
  const [generating, setGenerating] = useState(false);
  const [secret, setSecret] = useState("");
  const [freshId, setFreshId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<string[]>([]);
  const [status, setStatus] = useState("Open a key to see who created it and where it was last used");

  const { width, height, toolbarRef, faceRef, innerRef, arm } = useUnfold(open, reduced);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const scopeSetRef = useRef<HTMLFieldSetElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const rowTriggers = useRef(new Map<string, HTMLButtonElement>());
  const liveKeys = useRef(keys);
  const timers = useRef<number[]>([]);
  const cancel = useRef(0);
  const sequence = useRef(0);
  const submittedName = useRef("");

  const title = open && mode === "reveal" ? "Key created" : "Create key";

  useEffect(() => {
    liveKeys.current = keys;
  }, [keys]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(timer => window.clearTimeout(timer));
  }, []);

  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  function close() {
    if (!open) return;
    cancel.current++;
    arm();
    setOpen(false);
    setGenerating(false);
    if (mode === "reveal") {
      setFreshId(null);
      setStatus(`${submittedName.current} added. Only its last four characters stay visible.`);
    } else setStatus("New key discarded");
    toggleRef.current?.focus({ preventScroll: true });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating) return;
    const trimmed = name.trim();
    const next: CreateErrors = {
      name: trimmed ? undefined : "Name the key so your team can tell it apart",
      scopes: scopes.length ? undefined : "Choose at least one scope",
    };
    setErrors(next);
    if (next.name || next.scopes) {
      setStatus(next.name ?? next.scopes ?? "");
      if (next.name) nameRef.current?.focus();
      else scopeSetRef.current?.querySelector("button")?.focus();
      return;
    }
    const attempt = ++cancel.current;
    setGenerating(true);
    setStatus(`Generating ${trimmed}.`);
    later(() => {
      if (attempt !== cancel.current) return;
      sequence.current += 1;
      const value = buildSecret(`${trimmed}:${env}:${sequence.current}`, env);
      const created: ApiKey = {
        id: `created-${sequence.current}`,
        name: trimmed,
        env,
        last4: value.slice(-4),
        scopes: SCOPES.map(scope => scope.id).filter(scope => scopes.includes(scope)),
        created: "Sep 22, 2026",
        used: "never",
        requests: 0,
        owner: sofia,
      };
      submittedName.current = trimmed;
      arm();
      setSecret(value);
      setKeys(current => [created, ...current]);
      setFreshId(created.id);
      setGenerating(false);
      setMode("reveal");
      setStatus(`${trimmed} created. Copy the secret now, it will not be shown again.`);
      requestAnimationFrame(() => revealRef.current?.querySelector("button")?.focus({ preventScroll: true }));
    }, 720);
  }

  return (
    <section className={styles.keys} aria-labelledby={`${id}-heading`}>
      <div className={styles.top}>
        <header className={styles.header}>
          <h2 id={`${id}-heading`}>API keys</h2>
          <p>Secret keys sign requests from your servers to the Halden API. Keep them out of browsers and source control.</p>
        </header>
        <div
          ref={toolbarRef}
          className={styles.toolbar}
          onKeyDown={event => {
            if (event.key === "Escape" && open) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <p className={styles.count} data-hidden={open} inert={open}>
            <Roll value={keys.length} reduced={reduced} />
            <span className={styles.srOnly}>{keys.length}</span> active {keys.length === 1 ? "key" : "keys"}
          </p>
          <motion.div className={styles.shell} data-open={open} style={{ width, height }}>
            <div ref={innerRef} className={styles.shellInner}>
              <div ref={faceRef} className={styles.face}>
                <button
                  ref={toggleRef}
                  className={styles.toggle}
                  type="button"
                  aria-label={open ? "Close" : "Create key"}
                  aria-expanded={open}
                  aria-controls={open ? `${id}-panel` : undefined}
                  onClick={open ? close : () => {
                    arm();
                    setMode("form");
                    setName("");
                    setEnv("test");
                    setScopes(DEFAULT_SCOPES);
                    setErrors({});
                    setGenerating(false);
                    setOpen(true);
                    setStatus("Name the key, pick an environment, and choose its scopes");
                    requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true }));
                  }}
                >
                  <motion.span
                    className={styles.toggleIcon}
                    initial={false}
                    animate={{ rotate: open ? 45 : 0 }}
                    transition={reduced ? instant : motionTokens.spring.snappy}
                  >
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  </motion.span>
                </button>
                <span
                  id={`${id}-title`}
                  className={styles.title}
                  role={open ? "heading" : undefined}
                  aria-level={open ? 3 : undefined}
                  aria-hidden={!open || undefined}
                >
                  <Swap text={title} reduced={reduced} />
                </span>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="body"
                    id={`${id}-panel`}
                    className={styles.body}
                    role="group"
                    aria-labelledby={`${id}-title`}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: reduced ? instant : { duration: motionTokens.duration.standard + 0.04, ease: enter, delay: 0.14 },
                    }}
                    exit={{ opacity: 0, transition: reduced ? instant : { duration: 0.1, ease: standard } }}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      {mode === "form" ? (
                        <motion.form
                          key="form"
                          className={styles.form}
                          noValidate
                          onSubmit={submit}
                          exit={{ opacity: 0, transition: reduced ? instant : { duration: motionTokens.duration.instant } }}
                        >
                          <div className={styles.fields}>
                            <Input
                              ref={nameRef}
                              label="Name"
                              placeholder="Billing sync"
                              autoComplete="off"
                              maxLength={40}
                              value={name}
                              error={errors.name}
                              onChange={event => {
                                setName(event.target.value);
                                if (errors.name) setErrors(current => ({ ...current, name: undefined }));
                              }}
                            />
                            <div className={styles.envField}>
                              <span className={styles.fieldLabel} aria-hidden="true">Environment</span>
                              <SegmentedControl
                                label="Environment"
                                value={env}
                                options={ENVIRONMENTS}
                                onValueChange={value => setEnv(value as ApiKeyEnvironment)}
                              />
                            </div>
                          </div>
                          <fieldset
                            ref={scopeSetRef}
                            className={styles.scopeSet}
                            aria-describedby={errors.scopes ? `${id}-scope-error` : undefined}
                          >
                            <legend>Scopes</legend>
                            <div className={styles.scopeGrid}>
                              {SCOPES.map(scope => (
                                <Checkbox
                                  key={scope.id}
                                  label={scope.id}
                                  description={scope.description}
                                  checked={scopes.includes(scope.id)}
                                  onCheckedChange={checked => {
                                    const on = checked === true;
                                    setScopes(current => (on ? [...current.filter(value => value !== scope.id), scope.id] : current.filter(value => value !== scope.id)));
                                    if (on && errors.scopes) setErrors(current => ({ ...current, scopes: undefined }));
                                  }}
                                />
                              ))}
                            </div>
                            <AnimatePresence initial={false}>
                              {errors.scopes && (
                                <motion.p
                                  key="error"
                                  id={`${id}-scope-error`}
                                  className={styles.scopeError}
                                  role="alert"
                                  initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={reduced ? { opacity: 0, transition: instant } : { height: 0, opacity: 0 }}
                                  transition={reduced ? instant : motionTokens.spring.smooth}
                                >
                                  <span>{errors.scopes}</span>
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </fieldset>
                          <div className={styles.actions}>
                            <span className={styles.hint}>
                              <Swap
                                text={env === "live" ? "Live keys act on real payments and customers" : "Test keys only reach test data"}
                                reduced={reduced}
                              />
                            </span>
                            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
                            <Button type="submit" loading={generating}>Generate key</Button>
                          </div>
                        </motion.form>
                      ) : (
                        <motion.div
                          key="reveal"
                          ref={revealRef}
                          className={styles.reveal}
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={reduced ? instant : { duration: motionTokens.duration.standard + 0.08, ease: enter, delay: 0.06 }}
                        >
                          <div className={styles.secretBlock}>
                            <span id={`${id}-secret-label`} className={styles.fieldLabel}>Secret key</span>
                            <div className={styles.secretField} role="group" aria-labelledby={`${id}-secret-label`}>
                              <motion.code
                                className={styles.secret}
                                initial={!reduced && { opacity: 0, filter: `blur(${motionTokens.blur.text}px)` }}
                                animate={{ opacity: 1, filter: "blur(0px)" }}
                                transition={{ duration: motionTokens.duration.considered, ease: enter, delay: 0.14 }}
                              >
                                {secret}
                              </motion.code>
                              <CopyButton
                                value={secret}
                                label="Copy"
                                onCopied={() => setStatus("Secret copied. Paste it into your secrets manager.")}
                              />
                            </div>
                          </div>
                          <p className={styles.once}>
                            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                            <span>Copy it now and keep it in your secrets manager. You will not see this key again after you close this panel.</span>
                          </p>
                          <div className={styles.actions}>
                            <Button type="button" onClick={close}>Done</Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
      <div className={styles.list} role="list" aria-label="Active keys">
        <AnimatePresence initial={false}>
          {keys.map(item => (
            <KeyRow
              key={item.id}
              item={item}
              rowId={`${id}-${item.id}`}
              open={openId === item.id}
              fresh={freshId === item.id}
              revoked={revoked.includes(item.id)}
              reduced={reduced}
              onToggle={() => {
                const next = openId === item.id ? null : item.id;
                setOpenId(next);
                setStatus(next ? `${item.name} details opened` : `${item.name} details closed`);
              }}
              onRevoke={() => {
                setRevoked(current => [...current, item.id]);
                setStatus(`${item.name} revoked.`);
                later(() => {
                  const current = liveKeys.current;
                  const index = current.findIndex(entry => entry.id === item.id);
                  const neighbour = current[index + 1] ?? current[index - 1];
                  const focused = document.getElementById(`${id}-${item.id}`)?.contains(document.activeElement) ?? false;
                  setKeys(list => list.filter(entry => entry.id !== item.id));
                  setRevoked(list => list.filter(entry => entry !== item.id));
                  setOpenId(currentOpen => (currentOpen === item.id ? null : currentOpen));
                  if (focused) {
                    requestAnimationFrame(() => (neighbour ? rowTriggers.current.get(neighbour.id) : toggleRef.current)?.focus({ preventScroll: true }));
                  }
                }, 900);
              }}
              triggerRef={node => {
                if (node) rowTriggers.current.set(item.id, node);
                else rowTriggers.current.delete(item.id);
              }}
            />
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {keys.length === 0 && (
          <motion.div
            key="empty"
            className={styles.empty}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: reduced ? instant : { duration: motionTokens.duration.standard, delay: 0.3 } }}
            exit={{ opacity: 0, transition: instant }}
          >
            <p>No active keys</p>
            <span>Requests to the Halden API fail until you create one.</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setKeys(SAMPLE_KEYS);
                setStatus("Sample keys restored");
              }}
            >
              Restore sample keys
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className={styles.srOnly}>
        <p role="status" aria-live="polite">{status}</p>
      </footer>
    </section>
  );
}

export default ApiKeys;
