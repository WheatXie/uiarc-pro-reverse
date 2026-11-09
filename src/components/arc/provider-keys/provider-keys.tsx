"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Button from "../button/button";
import { TextMorph } from "../text-morph/text-morph";
import { Tooltip } from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./provider-keys.module.css";

export type ProviderId = "anthropic" | "openai" | "google" | "mistral" | "xai";

export type ProviderKeyStatus = "connected" | "invalid";

/** One stored credential. `value` is the raw secret, `last4` overrides the mask tail. */
export interface ProviderKeyRecord {
  provider: ProviderId;
  status: ProviderKeyStatus;
  value: string;
  last4?: string;
  lastUsedAt?: number | null;
  checkedAt?: number;
  error?: string;
}

export interface ProviderKeysTestResult {
  ok: boolean;
  detail?: string;
  error?: string;
}

export interface ProviderKeysTestArgs {
  provider: ProviderId;
  key?: string;
  signal: AbortSignal;
}

export interface ProviderKeysProps {
  keys?: ProviderKeyRecord[];
  defaultKeys?: ProviderKeyRecord[];
  onKeysChange?: (keys: ProviderKeyRecord[]) => void;
  providers?: ProviderId[];
  testKey?: (args: ProviderKeysTestArgs) => Promise<ProviderKeysTestResult>;
  onSave?: (provider: ProviderId, key: string, mode: "add" | "rotate") => void;
  onRemove?: (provider: ProviderId) => void;
  onCopy?: (provider: ProviderId) => void;
  revealDuration?: number;
  undoDuration?: number;
  loading?: boolean;
  title?: string;
  description?: string;
  footer?: ReactNode;
  className?: string;
}

interface MarkProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

function AnthropicMark({ title = "Anthropic", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function OpenAIMark({ title = "OpenAI", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...rest}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function GeminiMark({ title = "Gemini", ...rest }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shape = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...rest}>
      <path d={shape} fill="#3186FF" />
      <path d={shape} fill={`url(#lobe-icons-gemini-0-${uid})`} />
      <path d={shape} fill={`url(#lobe-icons-gemini-1-${uid})`} />
      <path d={shape} fill={`url(#lobe-icons-gemini-2-${uid})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-0-${uid}`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-1-${uid}`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`lobe-icons-gemini-2-${uid}`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MistralMark({ title = "Mistral AI", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...rest}>
      <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
      <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
      <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
      <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
      <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
    </svg>
  );
}

function XAIMark({ title = "xAI", ...rest }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" role="img" aria-label={title} {...rest}>
      <path d="M6.469 8.776L16.512 23h-4.464L2.005 8.776H6.47zm-.004 7.9l2.233 3.164L6.467 23H2l4.465-6.324zM22 2.582V23h-3.659V7.764L22 2.582zM22 1l-9.952 14.095-2.233-3.163L17.533 1H22z" />
    </svg>
  );
}

interface ProviderSpec {
  id: ProviderId;
  name: string;
  maskPrefix: string;
  startsWith: string;
  pattern: RegExp;
  placeholder: string;
  console: string;
  formatHint: string;
  testModel: string;
  Mark: (props: MarkProps) => ReactNode;
  sample: () => string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_ALPHABET = `${ALPHABET}-_`;

function randomKey(length: number, alphabet: string) {
  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues?.(bytes);
  let out = "";
  for (let index = 0; index < length; index += 1)
    out += alphabet[(bytes[index] || Math.floor(256 * Math.random())) % alphabet.length];
  return out;
}

const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    maskPrefix: "sk-ant-",
    startsWith: "sk-ant-",
    pattern: /^sk-ant-[a-z0-9]+-[A-Za-z0-9_-]{40,}$/,
    placeholder: "sk-ant-api03-…",
    console: "console.anthropic.com",
    formatHint: "Anthropic keys start with sk-ant-",
    testModel: "Claude Opus 5.5",
    Mark: AnthropicMark,
    sample: () => `sk-ant-api03-${randomKey(95, KEY_ALPHABET)}`,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    maskPrefix: "sk-proj-",
    startsWith: "sk-",
    pattern: /^sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{40,}$/,
    placeholder: "sk-proj-…",
    console: "platform.openai.com",
    formatHint: "OpenAI keys start with sk-",
    testModel: "GPT-6.1 Sol",
    Mark: OpenAIMark,
    sample: () => `sk-proj-${randomKey(128, KEY_ALPHABET)}`,
  },
  google: {
    id: "google",
    name: "Google AI",
    maskPrefix: "AIza",
    startsWith: "AIza",
    pattern: /^AIza[0-9A-Za-z_-]{35}$/,
    placeholder: "AIza…",
    console: "aistudio.google.com",
    formatHint: "Google AI keys start with AIza",
    testModel: "Gemini 4 Argon",
    Mark: GeminiMark,
    sample: () => `AIzaSy${randomKey(33, KEY_ALPHABET)}`,
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    maskPrefix: "",
    startsWith: "",
    pattern: /^[A-Za-z0-9]{32}$/,
    placeholder: "32 letters and numbers",
    console: "console.mistral.ai",
    formatHint: "Mistral keys are 32 letters and numbers",
    testModel: "Mistral Large 4",
    Mark: MistralMark,
    sample: () => randomKey(32, ALPHABET),
  },
  xai: {
    id: "xai",
    name: "xAI",
    maskPrefix: "xai-",
    startsWith: "xai-",
    pattern: /^xai-[A-Za-z0-9]{40,}$/,
    placeholder: "xai-…",
    console: "console.x.ai",
    formatHint: "xAI keys start with xai-",
    testModel: "Grok 4.7",
    Mark: XAIMark,
    sample: () => `xai-${randomKey(80, ALPHABET)}`,
  },
};

const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "google", "mistral", "xai"];
const REVOKED_KEY = "TmC9U9AIkxZnWP4R75wJ0Prr58qBh7Qd";
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };

function joinClass(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function article(name: string) {
  return /^[aeiou]/i.test(name) || name === "xAI" ? "an" : "a";
}

function maskOf(spec: ProviderSpec, record: ProviderKeyRecord) {
  const last4 = record.last4 ?? record.value?.slice(-4) ?? "";
  return { prefix: spec.maskPrefix, last4 };
}

function when(then: number, now: number) {
  const diff = Math.max(0, now - then);
  if (diff < 45_000) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stamp(value: number | Date | null | undefined) {
  return value instanceof Date ? value.getTime() : (value ?? undefined);
}

function defaultKeys(now = Date.now()): ProviderKeyRecord[] {
  return [
    {
      provider: "anthropic",
      status: "connected",
      lastUsedAt: now - 120_000,
      value: "sk-ant-api03-eYgMU06SvpOdf6nN9lURze6EYWS6PaYPnhFlcwVc5QIzNVxM6F9ZRnone-6Mm6ELCeX1pVkPetNvRupr9rZhGrdkYoD4f2a",
    },
    {
      provider: "openai",
      status: "connected",
      lastUsedAt: now - 840_000,
      value: "sk-proj-joW0m5EsjYx3k1QDHt7DZMbnIcwi5p6te-gASRh5Q1gD-FqXdGUVQhJd2ddCcvdbE4fP1UnTjKMAOYECVqgvlnlvNASLBLkbo5QZUnvsKur3rwkKn0s2fxYlJ2Uj9c1e",
    },
    {
      provider: "google",
      status: "connected",
      lastUsedAt: now - 93_600_000,
      value: "AIzaSy9_ExVruZRmEvYh4_38g9EgwA-QxnLQk7w",
    },
    {
      provider: "mistral",
      status: "invalid",
      lastUsedAt: now - 259_200_000,
      checkedAt: now - 259_200_000,
      error: "401 Unauthorized, the key was revoked",
      value: REVOKED_KEY,
    },
  ];
}

function Swap({ id, children, className, reduced }: { id?: string | null; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={joinClass(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id ?? "none"}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.12 : 0.16, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Glyph({ id, children, reduced }: { id: string; children: ReactNode; reduced: boolean }) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={id}
        className={styles.iconSlot}
        aria-hidden="true"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease: EASE } }}
        exit={{ opacity: 0, scale: reduced ? 1 : 0.7, transition: { duration: 0.1, ease: EASE } }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

type FormMode = "add" | "rotate";

interface FormProps {
  spec: ProviderSpec;
  mode: FormMode;
  data?: ProviderKeyRecord;
  reduced: boolean;
  test: (args: ProviderKeysTestArgs) => Promise<ProviderKeysTestResult>;
  onCancel: () => void;
  onSaved: (value: string) => void;
}

function ProviderKeyForm({ spec, mode, data, reduced, test, onCancel, onSaved }: FormProps) {
  const inputId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<"edit" | "testing" | "connected" | "rejected">("edit");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      abortRef.current?.abort();
    };
  }, []);

  const state = (() => {
    const trimmed = value.trim();
    if (!trimmed) return "empty" as const;
    if (spec.pattern.test(trimmed)) return "valid" as const;
    const starts = spec.startsWith;
    if (
      (starts && !(trimmed.startsWith(starts) || starts.startsWith(trimmed))) ||
      /\s/.test(trimmed) ||
      (spec.id === "mistral" && (/[^A-Za-z0-9]/.test(trimmed) || trimmed.length > 32)) ||
      (spec.id === "google" && trimmed.length > 39)
    )
      return "error" as const;
    return "partial" as const;
  })();

  const busy = phase === "testing" || phase === "connected";
  const invalid = phase === "edit" && (state === "error" || (touched && state === "partial") || (touched && state === "empty"));

  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (busy) return;
    if (state !== "valid") {
      setTouched(true);
      inputRef.current?.focus();
      return;
    }
    const key = value.trim();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("testing");
    try {
      const result = await test({ provider: spec.id, key, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.ok) {
        setDetail(result.detail ?? `${spec.name} answered`);
        setPhase("connected");
        window.setTimeout(() => {
          if (!controller.signal.aborted) onSaved(key);
        }, 720);
      } else {
        setDetail(result.error ?? `${spec.name} rejected the key`);
        setPhase("rejected");
        requestAnimationFrame(() => inputRef.current?.select());
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setDetail(error instanceof Error && error.message ? error.message : `Could not reach ${spec.name}`);
      setPhase("rejected");
    }
  };

  const masked = data ? `${maskOf(spec, data).prefix}••••${maskOf(spec, data).last4}` : "";

  const help =
    phase === "testing"
      ? { id: "testing", tone: "muted", icon: <Spinner />, text: <TextMorph>Testing connection</TextMorph> }
      : phase === "connected"
        ? { id: "connected", tone: "ok", icon: <CircleCheck aria-hidden="true" />, text: `Connected · ${detail}` }
        : phase === "rejected"
          ? {
              id: `rejected:${detail}`,
              tone: "bad",
              icon: <CircleAlert aria-hidden="true" />,
              text: `Rejected: ${detail}`,
            }
          : invalid
            ? {
                id: state === "error" ? "format" : "short",
                tone: "bad",
                icon: <CircleAlert aria-hidden="true" />,
                text:
                  state === "empty"
                    ? `Paste ${article(spec.name)} ${spec.name} key first`
                    : state === "error"
                      ? spec.formatHint
                      : `That ${spec.name} key looks incomplete`,
              }
            : state === "valid"
              ? { id: "valid", tone: "ok", icon: <Check aria-hidden="true" />, text: "Format looks right" }
              : {
                  id: "idle",
                  tone: "muted",
                  icon: null,
                  text:
                    mode === "rotate" && masked ? (
                      <>
                        Replaces <span className={styles.mono}>{masked}</span> once the new key connects
                      </>
                    ) : (
                      `Create one at ${spec.console}`
                    ),
                };

  const label =
    phase === "testing" ? (
      <>
        <Spinner />
        Testing
      </>
    ) : phase === "connected" ? (
      <>
        <Check aria-hidden="true" />
        {mode === "rotate" ? "Rotated" : "Saved"}
      </>
    ) : mode === "rotate" ? (
      "Rotate"
    ) : (
      "Save key"
    );

  return (
    <form className={styles.form} onSubmit={submit} noValidate data-phase={phase}>
      <label htmlFor={inputId} className={styles.srOnly}>
        {mode === "rotate" ? `New ${spec.name} key` : `${spec.name} API key`}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.input}
        value={value}
        readOnly={busy}
        placeholder={spec.placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={invalid || phase === "rejected" || undefined}
        aria-describedby={helpId}
        data-tone={invalid || phase === "rejected" ? "bad" : phase === "connected" ? "ok" : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          if (phase === "rejected") setPhase("edit");
        }}
        onBlur={() => {
          if (value.trim()) setTouched(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          abortRef.current?.abort();
          onCancel();
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.cancel}
        onClick={() => {
          abortRef.current?.abort();
          onCancel();
        }}
      >
        Cancel
      </Button>
      <Button type="submit" variant="primary" size="sm" className={styles.save} aria-disabled={busy || undefined}>
        {label}
      </Button>
      <p id={helpId} className={styles.help} data-tone={help.tone} aria-live="polite">
        <Swap id={help.id} reduced={reduced}>
          <span className={styles.helpInner}>
            {help.icon}
            <span className={styles.helpText}>{help.text}</span>
          </span>
        </Swap>
      </p>
      <button
        type="button"
        className={styles.sample}
        disabled={busy}
        onClick={() => {
          setValue(spec.sample());
          setTouched(false);
          setPhase("edit");
          inputRef.current?.focus();
        }}
      >
        Use sample key
      </button>
    </form>
  );
}

interface RowProps {
  spec: ProviderSpec;
  data?: ProviderKeyRecord;
  now: number;
  reduced: boolean;
  revealed: number | null;
  revealDuration: number;
  copied: boolean;
  testing: boolean;
  undoable: boolean;
  editing: FormMode | null;
  form: ReactNode;
  onReveal: () => void;
  onCopy: () => void;
  onTest: () => void;
  onRemove: () => void;
  onUndo: () => void;
  onOpen: (mode: FormMode, anchor: HTMLButtonElement) => void;
}

function ProviderRow({
  spec,
  data,
  now,
  reduced,
  revealed,
  revealDuration,
  copied,
  testing,
  undoable,
  editing,
  form,
  onReveal,
  onCopy,
  onTest,
  onRemove,
  onUndo,
  onOpen,
}: RowProps) {
  const status = data?.status ?? "unset";
  const provider = spec.id;
  const { prefix, last4 } = data ? maskOf(spec, data) : { prefix: "", last4: "" };
  const used = stamp(data?.lastUsedAt);
  const checked = stamp(data?.checkedAt);
  const shown = revealed !== null && !!data?.value;
  const phase = testing ? "testing" : status;

  const inner = {
    testing: (
      <>
        <Spinner />
        <TextMorph>Testing</TextMorph>
      </>
    ),
    connected: (
      <>
        <CircleCheck className={styles.ok} aria-hidden="true" />
        <span>Connected</span>
      </>
    ),
    invalid: (
      <>
        <CircleAlert className={styles.bad} aria-hidden="true" />
        <span>Invalid</span>
      </>
    ),
    unset: (
      <>
        <CircleDashed className={styles.idle} aria-hidden="true" />
        <span>Not set</span>
      </>
    ),
  }[phase];

  const statusLabel = {
    testing: "Testing",
    connected: "Connected",
    invalid: "Invalid",
    unset: "Not set",
  }[phase];

  const meta =
    status === "connected"
      ? used
        ? `Used ${when(used, now)}`
        : "Not used yet"
      : status === "invalid"
        ? checked
          ? `Rejected ${when(checked, now)}`
          : "Rejected"
        : undoable
          ? "Removed just now"
          : "";

  const value = (
    status === "unset" ? (
      <span className={styles.hint}>Get one at {spec.console}</span>
    ) : shown ? (
      <span className={joinClass(styles.mono, styles.revealed)}>{data?.value}</span>
    ) : (
      <span className={styles.mono}>
        <span className={styles.prefix}>{prefix}</span>
        <span className={styles.dots}>••••</span>
        <span>{last4}</span>
      </span>
    )
  );

  const valueKey = status === "unset" ? "unset" : shown ? "shown" : `mask:${prefix}${last4}`;
  const testHint = status === "invalid" && data?.error ? `${data.error}. Test again` : "Test connection";

  return (
    <li className={styles.row} data-state={phase} data-editing={editing ? "" : undefined}>
      <spec.Mark className={styles.mark} aria-hidden="true" />
      <span className={styles.name}>{spec.name}</span>
      <span className={styles.key}>
        <Swap id={valueKey} reduced={reduced}>
          {value}
        </Swap>
      </span>
      <span className={styles.status}>
        {status === "unset" ? (
          <span className={styles.statusChip}>
            <Swap id={phase} reduced={reduced}>
              <span className={styles.statusInner}>{inner}</span>
            </Swap>
          </span>
        ) : (
          <Tooltip content={testHint}>
            <button
              type="button"
              className={joinClass(styles.statusChip, styles.statusButton)}
              data-status={provider}
              aria-label={`${spec.name}: ${statusLabel}. ${testHint}`}
              aria-busy={testing || undefined}
              onClick={() => {
                if (!testing) onTest();
              }}
            >
              <Swap id={phase} reduced={reduced}>
                <span className={styles.statusInner}>{inner}</span>
              </Swap>
            </button>
          </Tooltip>
        )}
      </span>
      <span className={styles.meta}>
        <Swap id={meta || "none"} reduced={reduced}>
          <span className={styles.metaText}>{meta}</span>
        </Swap>
      </span>
      <span className={styles.actions}>
        <Swap id={status === "unset" ? (undoable ? "undo" : "add") : "keyed"} reduced={reduced} className={styles.actionSwap}>
          {status === "unset" ? (
            undoable ? (
              <button type="button" className={styles.pill} data-undo={provider} onClick={onUndo} aria-label={`Undo removing the ${spec.name} key`}>
                Undo
              </button>
            ) : (
              <button
                type="button"
                className={styles.pill}
                data-add={provider}
                aria-expanded={editing === "add"}
                aria-label={`Add ${article(spec.name)} ${spec.name} key`}
                onClick={(event) => onOpen("add", event.currentTarget)}
              >
                <Plus aria-hidden="true" />
                Add key
              </button>
            )
          ) : (
            <span className={styles.iconRow}>
              <Tooltip content={shown ? "Hide key" : `Reveal for ${Math.round(revealDuration / 1_000)} seconds`}>
                <button
                  type="button"
                  className={styles.icon}
                  data-reveal={provider}
                  disabled={!data?.value}
                  aria-pressed={shown}
                  aria-label={shown ? `Hide the ${spec.name} key` : `Reveal the ${spec.name} key for ${Math.round(revealDuration / 1_000)} seconds`}
                  onClick={onReveal}
                >
                  <Glyph id={shown ? "hide" : "show"} reduced={reduced}>
                    {shown ? <EyeOff /> : <Eye />}
                  </Glyph>
                  {shown && !reduced ? (
                    <svg className={styles.countdown} viewBox="0 0 32 32" aria-hidden="true" style={{ "--reveal-ms": `${revealDuration}ms` } as CSSProperties}>
                      <circle cx="16" cy="16" r="15" pathLength={100} />
                    </svg>
                  ) : null}
                </button>
              </Tooltip>
              <Tooltip content={copied ? "Copied" : "Copy key"}>
                <button
                  type="button"
                  className={joinClass(styles.icon, copied && styles.copied)}
                  disabled={!data?.value}
                  aria-label={`Copy the ${spec.name} key`}
                  onClick={onCopy}
                >
                  <Glyph id={copied ? "done" : "copy"} reduced={reduced}>
                    {copied ? <Check /> : <Copy />}
                  </Glyph>
                </button>
              </Tooltip>
              <Tooltip content={status === "invalid" ? "Replace key" : "Rotate key"}>
                <button
                  type="button"
                  className={styles.icon}
                  data-rotate={provider}
                  aria-expanded={editing === "rotate"}
                  aria-label={`${status === "invalid" ? "Replace" : "Rotate"} the ${spec.name} key`}
                  onClick={(event) => onOpen("rotate", event.currentTarget)}
                >
                  <span className={styles.iconSlot} aria-hidden="true">
                    <RefreshCw />
                  </span>
                </button>
              </Tooltip>
              <Tooltip content="Remove key">
                <button
                  type="button"
                  className={joinClass(styles.icon, styles.danger)}
                  data-remove={provider}
                  aria-label={`Remove the ${spec.name} key`}
                  onClick={onRemove}
                >
                  <span className={styles.iconSlot} aria-hidden="true">
                    <Trash2 />
                  </span>
                </button>
              </Tooltip>
            </span>
          )}
        </Swap>
      </span>
      <AnimatePresence initial={false}>
        {form ? (
          <motion.div
            key="form"
            className={styles.formWrap}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: reduced ? { duration: 0 } : { height: SPRING, opacity: { duration: 0.16, delay: 0.04, ease: EASE } },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: reduced ? { duration: 0 } : { height: SPRING, opacity: { duration: 0.1, ease: EASE } },
            }}
          >
            {form}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

/**
 * Provider keys — a workspace credential list where every row can be revealed for a few
 * seconds, copied, tested against its provider and rotated in place.
 */
export function ProviderKeys({
  keys,
  defaultKeys: initialKeys,
  onKeysChange,
  providers = PROVIDER_ORDER,
  testKey,
  onSave,
  onRemove,
  onCopy,
  revealDuration = 5_000,
  undoDuration = 5_000,
  loading = false,
  title = "Provider keys",
  description = "Your own keys, encrypted at rest and only used by this workspace.",
  footer,
  className,
}: ProviderKeysProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [internal, setInternal] = useState<ProviderKeyRecord[]>(() => initialKeys ?? (keys ? [] : defaultKeys()));
  const records = keys ?? internal;
  const recordsRef = useRef(records);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const [revealed, setRevealed] = useState<{ provider: ProviderId; token: number } | null>(null);
  const [copied, setCopied] = useState<ProviderId | null>(null);
  const [testing, setTesting] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [undoable, setUndoable] = useState<Partial<Record<ProviderId, ProviderKeyRecord>>>({});
  const [editing, setEditing] = useState<{ provider: ProviderId; mode: FormMode } | null>(null);
  const [announce, setAnnounce] = useState("");
  const timers = useRef(new Map<string, number>());
  const aborts = useRef(new Map<ProviderId, AbortController>());
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const pending = timers.current;
    const running = aborts.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      running.forEach((controller) => controller.abort());
    };
  }, []);

  const schedule = useCallback((id: string, delay: number, run: () => void) => {
    const pending = timers.current;
    window.clearTimeout(pending.get(id));
    pending.set(
      id,
      window.setTimeout(() => {
        pending.delete(id);
        run();
      }, delay),
    );
  }, []);

  const cancel = useCallback((id: string) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const say = useCallback(
    (message: string) => setAnnounce(testKey ? message : `${message}. Simulated, nothing was sent.`),
    [testKey],
  );

  const focusFirst = useCallback((...selectors: string[]) => {
    requestAnimationFrame(() => {
      for (const selector of selectors) {
        const node = rootRef.current?.querySelector<HTMLElement>(selector);
        if (node && !(node as HTMLButtonElement).disabled) {
          node.focus({ preventScroll: true });
          return;
        }
      }
    });
  }, []);

  const commit = useCallback(
    (provider: ProviderId, next?: ProviderKeyRecord) => {
      const current = recordsRef.current;
      const index = current.findIndex((record) => record.provider === provider);
      const merged = next
        ? index < 0
          ? [...current, next]
          : current.map((record, position) => (position === index ? next : record))
        : current.filter((record) => record.provider !== provider);
      recordsRef.current = merged;
      if (keys === undefined) setInternal(merged);
      onKeysChange?.(merged);
    },
    [keys, onKeysChange],
  );

  const test = useCallback(
    (args: ProviderKeysTestArgs): Promise<ProviderKeysTestResult> => {
      if (testKey) return testKey(args);
      const { provider, key, signal } = args;
      const spec = PROVIDERS[provider];
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          const record = recordsRef.current.find((entry) => entry.provider === provider);
          if (key === REVOKED_KEY || (!key && record?.status === "invalid")) {
            resolve({ ok: false, error: "401 Unauthorized, the key was revoked" });
            return;
          }
          const ms = 340 + ((key ?? record?.value ?? provider).charCodeAt(5) % 9) * 13;
          resolve({ ok: true, detail: `${spec.testModel} answered in ${ms} ms` });
        }, key ? 950 : 750);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    },
    [testKey],
  );

  const recordFor = (provider: ProviderId) => records.find((record) => record.provider === provider);

  const runTest = async (provider: ProviderId) => {
    const spec = PROVIDERS[provider];
    aborts.current.get(provider)?.abort();
    const controller = new AbortController();
    aborts.current.set(provider, controller);
    setTesting((state) => ({ ...state, [provider]: true }));
    say(`Testing the ${spec.name} key`);
    try {
      const result = await test({ provider, signal: controller.signal });
      const record = recordsRef.current.find((entry) => entry.provider === provider);
      if (controller.signal.aborted || !record) return;
      if (result.ok) {
        commit(provider, {
          ...record,
          status: "connected",
          error: undefined,
          checkedAt: Date.now(),
          lastUsedAt: Date.now(),
        });
        say(`${spec.name} connected${result.detail ? `. ${result.detail}` : ""}`);
      } else {
        commit(provider, {
          ...record,
          status: "invalid",
          error: result.error ?? `${spec.name} rejected the key`,
          checkedAt: Date.now(),
        });
        say(`${spec.name} rejected the key: ${result.error ?? "unknown error"}`);
      }
    } catch {
      if (!controller.signal.aborted) say(`Could not reach ${spec.name}. Try again`);
    } finally {
      if (aborts.current.get(provider) === controller) {
        aborts.current.delete(provider);
        setTesting((state) => ({ ...state, [provider]: false }));
      }
    }
  };

  const toggleReveal = (provider: ProviderId) => {
    const spec = PROVIDERS[provider];
    if (revealed?.provider === provider) {
      cancel("reveal");
      setRevealed(null);
      say(`${spec.name} key hidden`);
      return;
    }
    setRevealed({ provider, token: Date.now() });
    say(`${spec.name} key shown for ${Math.round(revealDuration / 1_000)} seconds`);
    schedule("reveal", revealDuration, () => setRevealed(null));
  };

  const copy = (provider: ProviderId) => {
    const spec = PROVIDERS[provider];
    const value = recordFor(provider)?.value;
    if (!value) return;
    void copyText(value).then(
      () => {
        setCopied(provider);
        schedule("copied", 1_400, () => setCopied(null));
        setAnnounce(`${spec.name} key copied to the clipboard`);
        onCopy?.(provider);
      },
      () => setAnnounce(`Could not copy the ${spec.name} key`),
    );
  };

  const remove = (provider: ProviderId) => {
    const record = recordFor(provider);
    if (!record) return;
    const spec = PROVIDERS[provider];
    aborts.current.get(provider)?.abort();
    setTesting((state) => ({ ...state, [provider]: false }));
    if (revealed?.provider === provider) {
      cancel("reveal");
      setRevealed(null);
    }
    if (editing?.provider === provider) setEditing(null);
    commit(provider);
    setUndoable((state) => ({ ...state, [provider]: record }));
    say(`${spec.name} key removed. Undo is available for ${Math.round(undoDuration / 1_000)} seconds`);
    focusFirst(`[data-undo="${provider}"]`);
    schedule(`undo:${provider}`, undoDuration, () => {
      const focused = document.activeElement?.getAttribute("data-undo") === provider;
      setUndoable((state) => {
        const next = { ...state };
        delete next[provider];
        return next;
      });
      onRemove?.(provider);
      if (focused) focusFirst(`[data-add="${provider}"]`);
    });
  };

  const undo = (provider: ProviderId) => {
    const record = undoable[provider];
    if (!record) return;
    cancel(`undo:${provider}`);
    setUndoable((state) => {
      const next = { ...state };
      delete next[provider];
      return next;
    });
    commit(provider, record);
    say(`${PROVIDERS[provider].name} key restored`);
    focusFirst(`[data-remove="${provider}"]`);
  };

  const openForm = (provider: ProviderId, mode: FormMode, anchor: HTMLButtonElement) => {
    if (editing?.provider === provider && editing.mode === mode) {
      closeForm();
      return;
    }
    anchorRef.current = anchor;
    if (mode === "add" && undoable[provider]) {
      cancel(`undo:${provider}`);
      setUndoable((state) => {
        const next = { ...state };
        delete next[provider];
        return next;
      });
      onRemove?.(provider);
    }
    setEditing({ provider, mode });
  };

  const closeForm = () => {
    setEditing(null);
    const anchor = anchorRef.current;
    requestAnimationFrame(() => {
      if (anchor?.isConnected) anchor.focus({ preventScroll: true });
    });
  };

  const addTarget = providers.find((provider) => !recordFor(provider) && !undoable[provider]) ?? providers.find((provider) => !recordFor(provider));

  const footerNode =
    footer === undefined ? (
      <>
        <ShieldCheck aria-hidden="true" />
        <span>Keys are encrypted with AES-256 and never written to logs.</span>
      </>
    ) : (
      footer
    );

  return (
    <section ref={rootRef} className={joinClass(styles.root, className)} aria-labelledby={titleId} aria-busy={loading || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className={styles.headerButton}
          disabled={loading || !addTarget}
          aria-expanded={(editing?.mode === "add" && editing.provider === addTarget) || undefined}
          onClick={(event) => addTarget && openForm(addTarget, "add", event.currentTarget)}
        >
          <Plus aria-hidden="true" />
          Add key
        </Button>
      </header>
      <ul className={styles.list} aria-label="API keys by provider">
        {loading
          ? providers.map((provider) => (
              <li key={provider} className={joinClass(styles.row, styles.skeletonRow)} aria-hidden="true">
                <span className={joinClass(styles.mark, styles.skeletonMark)} />
                <span className={styles.name}>
                  <span className={styles.bar} style={{ width: 84 }} />
                </span>
                <span className={styles.key}>
                  <span className={styles.bar} style={{ width: 132 }} />
                </span>
                <span className={styles.status}>
                  <span className={styles.bar} style={{ width: 76 }} />
                </span>
                <span className={styles.meta}>
                  <span className={styles.bar} style={{ width: 92 }} />
                </span>
                <span className={styles.actions} />
              </li>
            ))
          : providers.map((provider) => {
              const spec = PROVIDERS[provider];
              const record = recordFor(provider);
              return (
                <ProviderRow
                  key={provider}
                  spec={spec}
                  data={record}
                  now={now}
                  reduced={reduced}
                  revealed={revealed?.provider === provider ? revealed.token : null}
                  revealDuration={revealDuration}
                  copied={copied === provider}
                  testing={!!testing[provider]}
                  undoable={!!undoable[provider]}
                  editing={editing?.provider === provider ? editing.mode : null}
                  onReveal={() => toggleReveal(provider)}
                  onCopy={() => copy(provider)}
                  onTest={() => void runTest(provider)}
                  onRemove={() => remove(provider)}
                  onUndo={() => undo(provider)}
                  onOpen={(mode, anchor) => openForm(provider, mode, anchor)}
                  form={
                    editing?.provider === provider ? (
                      <ProviderKeyForm
                        spec={spec}
                        mode={editing.mode}
                        data={record}
                        reduced={reduced}
                        test={test}
                        onCancel={closeForm}
                        onSaved={(value) => {
                          const mode = editing.mode;
                          const current = recordsRef.current.find((entry) => entry.provider === provider);
                          commit(provider, {
                            provider,
                            status: "connected",
                            value,
                            last4: value.slice(-4),
                            lastUsedAt: null,
                            checkedAt: Date.now(),
                          });
                          if (current && revealed?.provider === provider) {
                            cancel("reveal");
                            setRevealed(null);
                          }
                          onSave?.(provider, value, mode);
                          setEditing(null);
                          say(`${spec.name} key ${mode === "rotate" ? "rotated" : "added"} and connected`);
                          focusFirst(`[data-rotate="${provider}"]`, `[data-status="${provider}"]`);
                        }}
                      />
                    ) : null
                  }
                />
              );
            })}
      </ul>
      {footerNode !== null ? <p className={styles.footer}>{footerNode}</p> : null}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}

export default ProviderKeys;
