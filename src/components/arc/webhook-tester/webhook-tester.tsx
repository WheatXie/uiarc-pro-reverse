"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock3,
  Eye,
  EyeOff,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./webhook-tester.module.css";

export interface WebhookTestRequest {
  /** Endpoint the signed POST is aimed at. */
  url: string;
  /** Event type that produced the body. */
  event: string;
  /** JSON body, pretty printed, exactly as signed. */
  body: string;
  /** Signed headers, including the signature header. */
  headers: Record<string, string>;
  /** Unix seconds the signature was computed over. */
  timestamp: number;
  /** Hex HMAC SHA-256 of `${timestamp}.${body}`. */
  signature: string;
}

export interface WebhookTestResponse {
  /** HTTP status, or 0 when nothing came back. */
  status: number;
  durationMs: number;
  headers?: Record<string, string>;
  body?: string;
  /** True when the endpoint never answered. */
  timedOut?: boolean;
  /** Failure text shown in place of a body. */
  error?: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  time: string;
  request: WebhookTestRequest;
  response?: WebhookTestResponse;
}

export interface WebhookEvent {
  type: string;
  payload: unknown;
}

export interface WebhookTesterProps {
  /** Endpoint the test events go to. https is required, except http on localhost. */
  defaultEndpoint?: string;
  /** Called as the endpoint field is edited. */
  onEndpointChange?: (url: string) => void;
  /** Event types in the select. Choosing one loads its payload into the editor. */
  events?: WebhookEvent[];
  /** Event selected on first render. */
  defaultEvent?: string;
  /** The endpoint's signing secret, shown masked with the prefix visible. */
  secret?: string;
  /** Deliveries shown on first render, newest first. */
  defaultDeliveries?: WebhookDelivery[];
  /** Sends the signed test event, usually through your backend. */
  onSend?: (request: WebhookTestRequest, signal: AbortSignal) => Promise<WebhookTestResponse>;
  /** Re-sends a failed delivery with a fresh timestamp and signature. */
  onRetry?: (delivery: WebhookDelivery, signal: AbortSignal) => Promise<WebhookTestResponse>;
  /** Who sends the events, shown in the header. */
  source?: { name: string; mark: ReactNode };
  /** Name of the header that carries t=…,v1=…. */
  signatureHeader?: string;
  /** Sends one event about a second after the card first scrolls half into view. */
  autoPlay?: boolean;
  className?: string;
}

const DEFAULT_ENDPOINT = "https://api.northwind.dev/webhooks/stripe";

export const webhookTesterEvents: WebhookEvent[] = [
  {
    type: "invoice.paid",
    payload: {
      id: "evt_1QhT8sKZ3v2Lw9Xc",
      type: "invoice.paid",
      created: 0x6ae0b5e8,
      livemode: false,
      data: {
        object: {
          id: "in_1QhT8rKZ3v2Lw9Xc",
          customer: "cus_RkN4b7TzqP1m",
          amount_paid: 4900,
          currency: "usd",
          status: "paid",
          hosted_invoice_url: null,
        },
      },
    },
  },
  {
    type: "customer.created",
    payload: {
      id: "evt_1QhT2aKZ3v2Lw4Rn",
      type: "customer.created",
      created: 0x6ae0b5e8,
      livemode: false,
      data: {
        object: {
          id: "cus_RkN4b7TzqP1m",
          email: "maya.okafor@lumen.studio",
          name: "Maya Okafor",
          currency: "usd",
          delinquent: false,
        },
      },
    },
  },
  {
    type: "customer.subscription.updated",
    payload: {
      id: "evt_1QhSz4KZ3v2Lw8Jd",
      type: "customer.subscription.updated",
      created: 0x6ae0b5e8,
      livemode: false,
      data: {
        object: {
          id: "sub_1QhSz3KZ3v2Lw8Jd",
          customer: "cus_RkN4b7TzqP1m",
          status: "active",
          plan: "team_annual",
          quantity: 12,
          cancel_at_period_end: false,
        },
      },
    },
  },
  {
    type: "checkout.session.completed",
    payload: {
      id: "evt_1QhSq9KZ3v2Lw1Te",
      type: "checkout.session.completed",
      created: 0x6ae0b5e8,
      livemode: false,
      data: {
        object: {
          id: "cs_test_a1Kq8ZpR2vN7",
          customer: "cus_RkN4b7TzqP1m",
          amount_total: 58800,
          currency: "usd",
          payment_status: "paid",
          mode: "subscription",
        },
      },
    },
  },
  {
    type: "payment_intent.payment_failed",
    payload: {
      id: "evt_1QhSk2KZ3v2Lw6Wb",
      type: "payment_intent.payment_failed",
      created: 0x6ae0b5e8,
      livemode: false,
      data: {
        object: {
          id: "pi_3QhSk1KZ3v2Lw6Wb",
          amount: 4900,
          currency: "usd",
          last_payment_error: {
            code: "card_declined",
            decline_code: "insufficient_funds",
          },
        },
      },
    },
  },
];

const stringifyBody = (payload: unknown): string =>
  typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

function responseHeaders(status: number, body: string, date: Date, requestId: string): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(new TextEncoder().encode(body).length),
    date: date.toUTCString(),
    server: "Vercel",
    "x-request-id": requestId,
    "x-vercel-id": `fra1::iad1::${requestId.slice(4, 9).toLowerCase()}-${date.getTime()}`,
    ...(status >= 500 ? { "x-vercel-error": "FUNCTION_INVOCATION_FAILED" } : {}),
  };
}

function requestHeaders(timestamp: number, signature: string, body: string): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(new TextEncoder().encode(body).length),
    "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
    "stripe-signature": `t=${timestamp},v1=${signature}`,
  };
}

/** Deterministic 64 hex characters, used wherever WebCrypto is not available. */
const fallbackSignature = (seed: string): string =>
  Array.from({ length: 64 }, (_, index) => "0123456789abcdef"[(seed.charCodeAt(index % seed.length) * (index + 7)) % 16]).join("");

function makeDelivery(id: string, event: string, time: string, timestamp: number, response?: WebhookTestResponse): WebhookDelivery {
  const body = stringifyBody(webhookTesterEvents.find(item => item.type === event)?.payload ?? {});
  const signature = fallbackSignature(id);
  return {
    id,
    event,
    time,
    request: {
      url: DEFAULT_ENDPOINT,
      event,
      body,
      headers: requestHeaders(timestamp, signature, body),
      timestamp,
      signature,
    },
    response,
  };
}

const okResponse = (durationMs: number, timestamp: number, requestId: string): WebhookTestResponse => {
  const body = '{\n  "received": true\n}';
  return {
    status: 200,
    durationMs,
    body,
    headers: responseHeaders(200, body, new Date(timestamp * 1e3), requestId),
  };
};

const failureBody = '{\n  "error": "Cannot read properties of undefined (reading \'plan\')"\n}';

export const webhookTesterDeliveries: WebhookDelivery[] = [
  makeDelivery("msg_2Lq8RkT4mN", "invoice.paid", "14:28:06", 0x6ae0b4f6, okResponse(184, 0x6ae0b4f6, "req_8fK2nQ4tVw")),
  makeDelivery("msg_2Lp1XcV9sB", "customer.subscription.updated", "14:11:42", 0x6ae0b11e, {
    status: 500,
    durationMs: 1204,
    body: failureBody,
    headers: responseHeaders(500, failureBody, new Date(1793110302e3), "req_3Hd7pLm2Qa"),
  }),
  makeDelivery("msg_2Ln7GhD3wE", "customer.created", "13:57:19", 0x6ae0adbf, okResponse(96, 0x6ae0adbf, "req_6Tz1cRb8Nk")),
  makeDelivery("msg_2Lm4JkP8yR", "payment_intent.payment_failed", "13:40:03", 0x6ae0a9b3, {
    status: 0,
    durationMs: 1e4,
    timedOut: true,
    error: "No response after 10 s. Return a 2xx before doing slow work.",
  }),
  makeDelivery("msg_2Lk9MnQ2zT", "checkout.session.completed", "13:22:51", 0x6ae0a5ab, okResponse(212, 0x6ae0a5ab, "req_2Wq5vYx7Je")),
];

/** Simulated durations, cycled so repeated sends never return the same number twice in a row. */
const simulatedDurations = [184, 162, 207, 143, 231, 176, 198];
let durationCursor = 0;

const randomId = (prefix: string, length = 10): string =>
  prefix +
  Array.from({ length }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[Math.floor(56 * Math.random())]).join("");

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
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

/** Simulated endpoint: local hosts refuse the connection, everything else answers 200 after a beat. */
async function simulateSend(request: WebhookTestRequest, signal: AbortSignal): Promise<WebhookTestResponse> {
  let host = "";
  try {
    host = new URL(request.url).hostname;
  } catch {
    /* the URL field validates before send, so a bad URL never reaches here */
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    await sleep(520, signal);
    return {
      status: 0,
      durationMs: 31,
      error: `Connection refused by ${host}. Expose it with a tunnel such as stripe listen.`,
    };
  }
  const duration = simulatedDurations[durationCursor++ % simulatedDurations.length];
  await sleep(560, signal);
  return okResponse(duration, Math.floor(Date.now() / 1e3), randomId("req_"));
}

/** Real HMAC SHA-256 over `${timestamp}.${body}`, with a deterministic stand-in where WebCrypto is missing. */
async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!subtle) return fallbackSignature(`${timestamp}${body.length}${secret}`);
  const encoder = new TextEncoder();
  const key = await subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No content",
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  405: "Not allowed",
  408: "Timeout",
  410: "Gone",
  422: "Unprocessable",
  429: "Rate limited",
  500: "Server error",
  502: "Bad gateway",
  503: "Unavailable",
  504: "Gateway timeout",
};

const statusText = (status: number): string =>
  STATUS_TEXT[status] ?? (status >= 500 ? "Server error" : status >= 400 ? "Client error" : status >= 300 ? "Redirect" : "OK");

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1e3).toFixed(ms < 1e4 ? 2 : 1).replace(/\.?0+$/, "")} s`;
}

const TOKEN = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;

/** One regex pass over the text, tinting keys, strings, numbers, literals and punctuation. */
function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) out.push(text.slice(cursor, index));
    const [token, string, colon, number, literal, punct] = match;
    if (string !== undefined) {
      out.push(
        <span key={key++} className={colon ? styles.tKey : styles.tString}>
          {string}
        </span>,
      );
      if (colon) out.push(<span key={key++} className={styles.tPunct}>{colon}</span>);
    } else if (number !== undefined) {
      out.push(<span key={key++} className={styles.tNumber}>{number}</span>);
    } else if (literal !== undefined) {
      out.push(<span key={key++} className={styles.tLiteral}>{literal}</span>);
    } else if (punct !== undefined) {
      out.push(<span key={key++} className={styles.tPunct}>{punct}</span>);
    } else {
      out.push(token);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  invalidLine?: number;
  label: string;
  id?: string;
  resetKey: string;
}

/** Line-numbered JSON editor: a transparent textarea over a tinted layer, both scrolled as one. */
function Editor({ value, onChange, onSubmit, invalidLine, label, id, resetKey }: EditorProps) {
  const layer = useRef<HTMLDivElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const firstRun = useRef(true);

  // A new event type resets the scroll and fades the tint back in, so a shorter payload starts at line 1.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const node = textarea.current;
    if (node) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
    if (layer.current) {
      layer.current.style.transform = "";
      layer.current.classList.remove(styles.codeFade);
      void layer.current.offsetWidth;
      layer.current.classList.add(styles.codeFade);
    }
    if (gutter.current) gutter.current.style.transform = "";
  }, [resetKey]);

  const lines = value.split("\n").length;

  return (
    <div className={styles.editor}>
      <div className={styles.gutter} aria-hidden="true">
        <div ref={gutter} className={styles.gutterInner}>
          {Array.from({ length: lines }, (_, index) => (
            <span key={index} className={index + 1 === invalidLine ? styles.gutterBad : undefined}>
              {index + 1}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.code}>
        <div className={styles.codeClip} aria-hidden="true">
          <div ref={layer} className={styles.codeLayer}>
            {highlight(value)}
            {"\n "}
          </div>
        </div>
        <textarea
          ref={textarea}
          id={id}
          className={styles.codeInput}
          value={value}
          onChange={event => onChange(event.target.value)}
          onScroll={event => {
            const { scrollTop, scrollLeft } = event.currentTarget;
            if (layer.current) layer.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
            if (gutter.current) gutter.current.style.transform = `translateY(${-scrollTop}px)`;
          }}
          onKeyDown={event => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
              return;
            }
            // Enter keeps the line's indent and adds two spaces after an opening brace or bracket.
            if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
              const node = event.currentTarget;
              const caret = node.selectionStart;
              const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
              const indent = value.slice(lineStart).match(/^ */)?.[0] ?? "";
              const extra = /[{[]\s*$/.test(value.slice(lineStart, caret)) ? "  " : "";
              if (!indent && !extra) return;
              event.preventDefault();
              const insert = `\n${indent}${extra}`;
              const inserted = document.execCommand?.("insertText", false, insert);
              if (!inserted) {
                node.setRangeText(insert, caret, node.selectionEnd, "end");
                onChange(node.value);
              }
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-label={label}
          aria-invalid={invalidLine !== undefined || undefined}
        />
      </div>
    </div>
  );
}

function StripeMark() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" focusable="false">
      <path
        fill="#635BFF"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
      />
    </svg>
  );
}

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

const TABS = [
  { id: "body", label: "Body" },
  { id: "headers", label: "Headers" },
  { id: "request", label: "Request" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type NodeState = "idle" | "active" | "done" | "error" | "warn";

const ENTER: { duration: number; ease: [number, number, number, number] } = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const EXIT = { duration: 0.1, ease: [0.22, 1, 0.36, 1] } as const;
const TAB_SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

const isOk = (response: WebhookTestResponse | undefined): boolean => !!response && response.status >= 200 && response.status < 300;

const responseWord = (response: WebhookTestResponse | undefined): string =>
  response ? (response.status ? String(response.status) : response.timedOut ? "Timeout" : "Failed") : "Sending";

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const pathOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return "/";
  }
};

/** Timeline icon: the glyph crossfades in place, the idle state is a hollow dot. */
function NodeIcon({ state }: { state: NodeState }) {
  const reduced = Boolean(useReducedMotion());
  const glyph =
    state === "active" ? (
      <LoaderCircle size={16} strokeWidth={1.75} className={styles.spin} />
    ) : state === "done" ? (
      <CircleCheck size={16} strokeWidth={1.75} />
    ) : state === "error" ? (
      <CircleX size={16} strokeWidth={1.75} />
    ) : state === "warn" ? (
      <Clock3 size={16} strokeWidth={1.75} />
    ) : (
      <span className={styles.idleDot} />
    );
  return (
    <span className={cx(styles.nodeIcon, styles[`node_${state}`])}>
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          className={styles.nodeGlyph}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
          transition={reduced ? { duration: 0 } : ENTER}
        >
          {glyph}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A fixed-slot text swap: 100ms out, 160ms in with a 2px rise, so nothing around it shifts. */
function Swap({ children, id, className }: { children: ReactNode; id: string; className?: string }) {
  const reduced = Boolean(useReducedMotion());
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
          transition={reduced ? { duration: 0 } : ENTER}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Connector({ filled, traveling, loop }: { filled: boolean; traveling: boolean; loop: boolean }) {
  const reduced = Boolean(useReducedMotion());
  return (
    <span className={styles.connector} aria-hidden="true">
      <motion.span
        className={styles.connectorFill}
        initial={false}
        animate={{ scaleX: filled ? 1 : 0 }}
        transition={reduced || !filled ? { duration: 0 } : { duration: loop ? 0.5 : 0.28, ease: [0.65, 0, 0.35, 1] }}
      />
      {traveling && !reduced ? (
        <motion.span
          className={styles.dotTrack}
          initial={{ x: "0%", opacity: 0 }}
          animate={{ x: "100%", opacity: [0, 1, 1, 0] }}
          transition={{
            duration: loop ? 0.7 : 0.28,
            ease: [0.65, 0, 0.35, 1],
            repeat: loop ? Infinity : 0,
            times: [0, 0.15, 0.85, 1],
          }}
        >
          <span className={styles.dot} />
        </motion.span>
      ) : null}
    </span>
  );
}

/** Signed → Sent → response, with the connector fill and the traveling dot while a send is in flight. */
function Timeline({ delivery, stage }: { delivery?: WebhookDelivery; stage: number | null }) {
  const response = delivery?.response;
  const pending = !!delivery && !response;
  const step = delivery ? (pending ? stage ?? 0 : 3) : -1;
  const responseState: NodeState =
    step < 2 ? "idle" : step === 2 ? "active" : isOk(response) ? "done" : response?.timedOut ? "warn" : "error";
  const responseLabel =
    step < 3 || !response ? "Response" : response.status ? `${response.status} ${statusText(response.status)}` : response.timedOut ? "Timed out" : "Unreachable";
  const responseMeta = step === 2 ? "Waiting" : step < 3 || !response ? "Not sent yet" : formatDuration(response.durationMs);

  const nodes: { label: string; meta: string; state: NodeState }[] = [
    { label: step >= 1 ? "Signed" : "Sign", meta: "HMAC SHA-256", state: step < 0 ? "idle" : step === 0 ? "active" : "done" },
    { label: step >= 2 ? "Sent" : "Send", meta: "POST", state: step < 1 ? "idle" : step === 1 ? "active" : "done" },
    { label: responseLabel, meta: responseMeta, state: responseState },
  ];

  return (
    <ol className={styles.timeline} aria-label="Request timeline">
      {nodes.map((node, index) => (
        <li key={index} className={styles.node}>
          <span className={styles.nodeTrack}>
            <NodeIcon state={node.state} />
            {index < 2 ? <Connector filled={step > index} traveling={pending && step === index + 1} loop={index === 1} /> : null}
          </span>
          <Swap id={node.label} className={styles.nodeLabel}>
            {node.label}
          </Swap>
          <Swap id={node.meta} className={styles.nodeMeta}>
            {node.meta}
          </Swap>
        </li>
      ))}
    </ol>
  );
}

function HeaderLines({ first, headers }: { first: string; headers: Record<string, string> }) {
  return (
    <>
      <span className={styles.tStatus}>{first}</span>
      {"\n"}
      {Object.entries(headers).map(([name, value]) => (
        <span key={name}>
          <span className={styles.tHeader}>{name}:</span> {value}
          {"\n"}
        </span>
      ))}
    </>
  );
}

/** Body, Headers or Request for the selected delivery, or the empty and waiting states. */
function WellPanel({ delivery, tab }: { delivery?: WebhookDelivery; tab: TabId }) {
  if (!delivery) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyTitle}>No deliveries yet</span>
        <span>Send a test event to see the response here.</span>
      </div>
    );
  }
  const { request, response } = delivery;
  if (tab === "request") {
    return (
      <pre className={styles.pre}>
        <HeaderLines first={`POST ${pathOf(request.url)} HTTP/1.1`} headers={{ host: hostOf(request.url), ...request.headers }} />
        {"\n"}
        {highlight(request.body)}
      </pre>
    );
  }
  if (!response) {
    return (
      <div className={styles.waiting}>
        <TextShimmer>Waiting for response</TextShimmer>
      </div>
    );
  }
  if (response.status) {
    if (tab === "headers") {
      return (
        <pre className={styles.pre}>
          <HeaderLines first={`HTTP/1.1 ${response.status} ${statusText(response.status)}`} headers={response.headers ?? {}} />
        </pre>
      );
    }
    return <pre className={styles.pre}>{response.body ? highlight(response.body) : <span className={styles.tPunct}>Empty body</span>}</pre>;
  }
  if (tab === "headers") {
    return (
      <div className={styles.empty}>
        <span>No response, so no headers.</span>
      </div>
    );
  }
  return (
    <div className={styles.failure}>
      {response.timedOut ? <Clock3 size={14} strokeWidth={1.75} className={styles.warnIcon} /> : <TriangleAlert size={14} strokeWidth={1.75} className={styles.dangerIcon} />}
      <span>{response.error ?? "No response"}</span>
    </div>
  );
}

const MODIFIER = "mac";

const KEY_FACES: Record<string, { glyph: string; name: string }> = {
  mod: { glyph: MODIFIER === "mac" ? "⌘" : "Ctrl", name: MODIFIER === "mac" ? "Command" : "Control" },
  enter: { glyph: MODIFIER === "mac" ? "↵" : "Enter", name: MODIFIER === "mac" ? "Return" : "Enter" },
  ctrl: { glyph: MODIFIER === "mac" ? "⌃" : "Ctrl", name: "Control" },
  shift: { glyph: MODIFIER === "mac" ? "⇧" : "Shift", name: "Shift" },
  alt: { glyph: MODIFIER === "mac" ? "⌥" : "Alt", name: MODIFIER === "mac" ? "Option" : "Alt" },
};

/** Key caps with the printed glyph visible and the key's real name kept for screen readers. */
function Kbd({ keys }: { keys: string[] }) {
  return (
    <kbd className={cx(styles.kbd, styles.kbdSm)}>
      {keys.map((key, index) => {
        const face = KEY_FACES[key] ?? { glyph: key.toUpperCase(), name: key.toUpperCase() };
        const named = face.glyph !== face.name;
        return (
          <span key={`${key}-${index}`} className={styles.kbdSlot}>
            {index > 0 ? <span className={styles.kbdHidden}> </span> : null}
            <kbd className={styles.kbdKey}>
              {named ? (
                <>
                  <span className={styles.kbdGlyph} aria-hidden="true">
                    {face.glyph}
                  </span>
                  <span className={styles.kbdHidden}>{face.name}</span>
                </>
              ) : (
                face.glyph
              )}
            </kbd>
          </span>
        );
      })}
    </kbd>
  );
}

function useClock(defaultDeliveries: WebhookDelivery[], mountedAt: RefObject<number>): () => string {
  const builtIn = defaultDeliveries === webhookTesterDeliveries;
  return useCallback(() => {
    const pad = (value: number) => String(value).padStart(2, "0");
    if (!builtIn) {
      const now = new Date();
      return [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join(":");
    }
    // Sample deliveries run on a fixed clock, ticking from the sample timestamp so the list looks alive.
    const now = new Date(1793111528e3 + (Date.now() - mountedAt.current));
    return [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()].map(pad).join(":");
  }, [builtIn, mountedAt]);
}

/**
 * A developer webhook tester in one card. The request side has the endpoint URL, an event type select, the signing
 * secret with reveal and copy, and a JSON payload editor with syntax tint, line numbers, validation and Format. Send
 * test event signs the body with real HMAC SHA-256, runs a request timeline (signed, sent, 200 OK in 184 ms) and shows
 * the response body, response headers and the exact request in tabs. Recent deliveries list every attempt with a status
 * chip; failed ones have Retry. With no props it simulates the endpoint and sends one sample event when it scrolls into
 * view.
 */
export function WebhookTester({
  defaultEndpoint = DEFAULT_ENDPOINT,
  onEndpointChange,
  events = webhookTesterEvents,
  defaultEvent,
  secret = "whsec_9vXc2Lq8RkT4mN7bP1sZ",
  defaultDeliveries = webhookTesterDeliveries,
  onSend,
  onRetry,
  source = { name: "Stripe", mark: <StripeMark /> },
  signatureHeader = "stripe-signature",
  autoPlay,
  className,
}: WebhookTesterProps) {
  const uid = useId();
  const reduced = Boolean(useReducedMotion());
  const simulated = !onSend;

  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [event, setEvent] = useState(defaultEvent ?? events[0]?.type ?? "");
  const [payloadText, setPayloadText] = useState(() => stringifyBody(events.find(item => item.type === (defaultEvent ?? events[0]?.type))?.payload ?? {}));
  const [revealed, setRevealed] = useState(false);
  const [deliveries, setDeliveries] = useState(defaultDeliveries);
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultDeliveries[0]?.id);
  const [tab, setTab] = useState<TabId>("body");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const root = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const interacted = useRef(false);
  const mountedAt = useRef(0);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({ body: null, headers: null, request: null });

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const timeLabel = useClock(defaultDeliveries, mountedAt);

  useEffect(() => () => abort.current?.abort(), []);

  const parse = useMemo(() => {
    try {
      JSON.parse(payloadText);
      return { ok: true as const, bytes: new TextEncoder().encode(payloadText).length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const lineMatch = message.match(/line (\d+)/);
      if (lineMatch) return { ok: false as const, line: Number(lineMatch[1]) };
      const positionMatch = message.match(/position (\d+)/);
      if (positionMatch) return { ok: false as const, line: payloadText.slice(0, Number(positionMatch[1])).split("\n").length };
      return { ok: false as const, line: payloadText.trim() ? undefined : 1 };
    }
  }, [payloadText]);

  const urlValid = useMemo(() => {
    try {
      const parsed = new URL(endpoint.trim());
      const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      return parsed.protocol === "https:" || (local && parsed.protocol === "http:");
    } catch {
      return false;
    }
  }, [endpoint]);

  const sending = sendingId !== null;
  const selected = deliveries.find(item => item.id === selectedId);
  const canFormat =
    parse.ok &&
    (() => {
      try {
        return JSON.stringify(JSON.parse(payloadText), null, 2) === payloadText;
      } catch {
        return true;
      }
    })();

  const send = useCallback(
    async (id: string, buildRequest: (signal: AbortSignal) => Promise<WebhookTestRequest>, perform: (request: WebhookTestRequest, signal: AbortSignal) => Promise<WebhookTestResponse>, prepend: boolean) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const { signal } = controller;
      setSendingId(id);
      try {
        const request = await buildRequest(signal);
        if (signal.aborted) return;
        const delivery: WebhookDelivery = { id, event: request.event, time: timeLabel(), request };
        setDeliveries(current => (prepend ? [delivery, ...current].slice(0, 20) : current.map(item => (item.id === id ? delivery : item))));
        setStage(0);
        setSelectedId(id);
        setTab("body");
        setStatus(`Sending ${request.event} to ${hostOf(request.url)}.${simulated ? " Simulated, nothing was sent." : ""}`);
        await sleep(160 * (reduced ? 0 : 1), signal);
        setStage(1);
        // The response promise starts here so the fastest endpoints still show the sent beat.
        const pending = perform(request, signal).catch((error: unknown) => {
          // Aborted sends stay silent: never let the rejection escape unhandled when the
          // outer flow has already returned (otherwise Chrome logs "Aborted" to the console).
          if (signal.aborted) return { status: 0, durationMs: 0, error: "Aborted" } as WebhookTestResponse;
          const failure: WebhookTestResponse = { status: 0, durationMs: 0, error: error instanceof Error ? error.message : "The request failed" };
          return failure;
        });
        await sleep(300 * (reduced ? 0 : 1), signal);
        setStage(2);
        const response = await pending;
        if (signal.aborted) return;
        setDeliveries(current => current.map(item => (item.id === id ? { ...item, response } : item)));
        setStage(3);
        const outcome = response.status
          ? `${response.status} ${statusText(response.status)} in ${formatDuration(response.durationMs)}`
          : response.timedOut
            ? "Timed out"
            : `Failed: ${response.error ?? "no response"}`;
        setStatus(`${request.event}: ${outcome}.${simulated ? " Simulated, nothing was sent." : ""}`);
      } catch {
        /* aborted sends stay silent */
      } finally {
        if (abort.current === controller) {
          setSendingId(null);
          setStage(null);
          abort.current = null;
        }
      }
    },
    [reduced, simulated, timeLabel],
  );

  const buildSigned = useCallback(
    async (eventType: string, body: string, url: string): Promise<WebhookTestRequest> => {
      const timestamp = Math.floor(Date.now() / 1e3);
      const signature = await sign(secret, timestamp, body);
      const raw = requestHeaders(timestamp, signature, body);
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(raw)) headers[name === "stripe-signature" ? signatureHeader : name] = value;
      return { url: url.trim(), event: eventType, body, headers, timestamp, signature };
    },
    [secret, signatureHeader],
  );

  const sendCurrent = useCallback(() => {
    if (sending || !urlValid || !parse.ok) return;
    void send(randomId("msg_"), () => buildSigned(event, payloadText, endpoint), onSend ?? simulateSend, true);
  }, [sending, urlValid, parse.ok, send, buildSigned, event, payloadText, endpoint, onSend]);

  // One sample send, about a second after the card first scrolls half into view, unless someone already touched it.
  const autoplay = autoPlay ?? simulated;
  const sendLatest = useRef(sendCurrent);
  useEffect(() => {
    sendLatest.current = sendCurrent;
  }, [sendCurrent]);
  useEffect(() => {
    if (!autoplay || typeof IntersectionObserver === "undefined") return;
    const node = root.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            if (!interacted.current) {
              interacted.current = true;
              sendLatest.current();
            }
            observer.disconnect();
          }, 900);
        } else {
          clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [autoplay]);

  const interact = () => {
    interacted.current = true;
  };

  const onTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex(item => item.id === tab);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index + TABS.length - 1) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const hint = sending
    ? { key: "busy", tone: "busy" as const, text: `Sending to ${hostOf(endpoint)}` }
    : urlValid
      ? parse.ok
        ? { key: "ready", tone: "muted" as const, text: "to send" }
        : { key: "json", tone: "danger" as const, text: parse.line ? `Fix the payload on line ${parse.line}` : "Fix the payload to send" }
      : { key: "url", tone: "danger" as const, text: "Enter a valid https URL" };

  const maskedSecret = secret.slice(0, 6) + "•".repeat(Math.max(0, secret.length - 6));

  const copyText = selected
    ? (() => {
        const { request, response } = selected;
        if (tab === "request") {
          return [
            `POST ${pathOf(request.url)} HTTP/1.1`,
            `host: ${hostOf(request.url)}`,
            ...Object.entries(request.headers).map(([name, value]) => `${name}: ${value}`),
            "",
            request.body,
          ].join("\n");
        }
        if (!response) return "";
        if (tab === "headers") {
          return response.status
            ? [`HTTP/1.1 ${response.status} ${statusText(response.status)}`, ...Object.entries(response.headers ?? {}).map(([name, value]) => `${name}: ${value}`)].join("\n")
            : "";
        }
        return response.body ?? response.error ?? "";
      })()
    : "";

  const panelId = `${uid}-panel`;
  const failed = deliveries.filter(item => item.response && !isOk(item.response)).length;

  return (
    <section ref={root} className={cx(styles.root, className)} aria-label="Webhook tester" onPointerDownCapture={interact} onKeyDownCapture={interact}>
      <header className={styles.header}>
        <span className={styles.mark} aria-hidden="true">
          {source.mark}
        </span>
        <div className={styles.headings}>
          <h2 className={styles.title}>Webhook tester</h2>
          <p className={styles.subtitle}>Signed test events from {source.name}</p>
        </div>
        <span className={styles.modeChip}>
          <FlaskConical size={14} strokeWidth={1.75} aria-hidden="true" />
          Test mode
        </span>
      </header>
      <div className={styles.body}>
        <div className={styles.request}>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Endpoint</span>
              <span className={styles.fieldValue}>
                <span className={styles.method}>POST</span>
                <input
                  className={cx(styles.input, !urlValid && styles.inputBad)}
                  value={endpoint}
                  spellCheck={false}
                  inputMode="url"
                  autoComplete="off"
                  aria-invalid={!urlValid || undefined}
                  onChange={change => {
                    setEndpoint(change.target.value);
                    onEndpointChange?.(change.target.value);
                  }}
                  onKeyDown={key => {
                    if (key.key === "Enter" && (key.metaKey || key.ctrlKey || key.currentTarget.tagName === "INPUT")) {
                      key.preventDefault();
                      sendCurrent();
                    }
                  }}
                />
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Event</span>
              <span className={styles.fieldValue}>
                <select
                  className={styles.select}
                  value={event}
                  onChange={change => {
                    const next = change.target.value;
                    interact();
                    setEvent(next);
                    setPayloadText(stringifyBody(events.find(item => item.type === next)?.payload ?? {}));
                  }}
                >
                  {events.map(item => (
                    <option key={item.type} value={item.type}>
                      {item.type}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
              </span>
            </label>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Secret</span>
              <span className={styles.fieldValue}>
                <span className={styles.secret}>
                  <span className={cx(styles.secretText, revealed && styles.secretHidden)} aria-hidden="true">
                    {maskedSecret}
                  </span>
                  <span className={cx(styles.secretText, !revealed && styles.secretHidden)} aria-hidden={!revealed}>
                    {secret}
                  </span>
                  {!revealed ? <span className={styles.srOnly}>Hidden</span> : null}
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-pressed={revealed}
                  aria-label={revealed ? "Hide signing secret" : "Reveal signing secret"}
                  onClick={() => setRevealed(value => !value)}
                >
                  <Swap id={revealed ? "off" : "on"} className={styles.iconSwap}>
                    {revealed ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                  </Swap>
                </button>
                <CopyButton value={secret} label="Copy signing secret" iconOnly variant="plain" className={styles.copy} />
              </span>
            </div>
          </div>
          <div className={styles.editorWrap}>
            <Editor
              value={payloadText}
              onChange={next => {
                interact();
                setPayloadText(next);
              }}
              onSubmit={sendCurrent}
              label={`Payload for ${event}`}
              resetKey={event}
              invalidLine={parse.ok ? undefined : parse.line}
            />
            <div className={styles.editorFooter}>
              <Swap id={parse.ok ? "ok" : `bad-${parse.line ?? 0}`} className={styles.editorStatus}>
                {parse.ok ? (
                  <>
                    <CircleCheck size={14} strokeWidth={1.75} className={styles.okIcon} aria-hidden="true" />
                    Valid JSON
                    <span className={styles.sep}>·</span>
                    <span className={styles.num}>{parse.bytes.toLocaleString("en-US")} bytes</span>
                  </>
                ) : (
                  <>
                    <TriangleAlert size={14} strokeWidth={1.75} className={styles.dangerIcon} aria-hidden="true" />
                    {parse.line ? `Invalid JSON on line ${parse.line}` : "Invalid JSON"}
                  </>
                )}
              </Swap>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  interact();
                  try {
                    setPayloadText(JSON.stringify(JSON.parse(payloadText), null, 2));
                  } catch {
                    /* the button is disabled while the payload does not parse */
                  }
                }}
                disabled={!parse.ok || canFormat}
              >
                Format
              </button>
            </div>
          </div>
          <div className={styles.sendRow}>
            <Swap id={hint.key} className={cx(styles.hint, hint.tone === "danger" && styles.hintDanger)}>
              {hint.tone === "busy" ? (
                <TextShimmer>{hint.text}</TextShimmer>
              ) : hint.tone === "danger" ? (
                <>
                  <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                  {hint.text}
                </>
              ) : (
                <>
                  <Kbd keys={["mod", "enter"]} />
                  {hint.text}
                </>
              )}
            </Swap>
            <Button
              size="sm"
              onClick={() => {
                interact();
                sendCurrent();
              }}
              loading={sending}
              disabled={!sending && (!urlValid || !parse.ok)}
              className={styles.sendButton}
            >
              Send test event
            </Button>
          </div>
        </div>
        <div className={styles.response}>
          <Timeline delivery={selected} stage={selected && selected.id === sendingId ? stage : null} />
          <div className={styles.well}>
            <div className={styles.tabsBar}>
              <div role="tablist" aria-label="Response" className={styles.tabs}>
                {TABS.map(item => (
                  <button
                    key={item.id}
                    ref={node => {
                      tabRefs.current[item.id] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${item.id}`}
                    aria-selected={tab === item.id}
                    aria-controls={panelId}
                    tabIndex={tab === item.id ? 0 : -1}
                    className={cx(styles.tab, tab === item.id && styles.tabOn)}
                    onClick={() => setTab(item.id)}
                    onKeyDown={onTabKey}
                  >
                    {item.label}
                    {tab === item.id ? <motion.span layoutId={`${uid}-tab-line`} className={styles.tabLine} transition={reduced ? { duration: 0 } : TAB_SPRING} /> : null}
                  </button>
                ))}
              </div>
              <CopyButton value={copyText} label={`Copy ${tab}`} iconOnly variant="plain" disabled={!copyText} className={styles.copy} />
            </div>
            <div className={styles.wellBody} role="tabpanel" id={panelId} aria-labelledby={`${uid}-tab-${tab}`} tabIndex={0}>
              <AnimatePresence initial={false}>
                <motion.div
                  key={`${selected?.id ?? "none"}-${tab}-${selected?.response ? "r" : "p"}`}
                  className={styles.wellLayer}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
                  transition={reduced ? { duration: 0 } : ENTER}
                >
                  <WellPanel delivery={selected} tab={tab} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className={styles.deliveries}>
            <div className={styles.deliveriesHead}>
              <h3 className={styles.sectionTitle}>Recent deliveries</h3>
              <span className={styles.meta}>{failed} failed</span>
            </div>
            {deliveries.length === 0 ? (
              <div className={styles.listEmpty}>Deliveries show up here after the first test event.</div>
            ) : (
              <ul className={styles.list}>
                <AnimatePresence initial={false}>
                  {deliveries.map(delivery => {
                    const response = delivery.response;
                    const ok = isOk(response);
                    const retryable = !!response && !ok;
                    const tone = response ? (ok ? "ok" : response.timedOut ? "warn" : "bad") : "pending";
                    return (
                      <motion.li
                        key={delivery.id}
                        layout={reduced ? false : "position"}
                        className={cx(styles.row, delivery.id === selectedId && styles.rowOn)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: EXIT }}
                        transition={reduced ? { duration: 0 } : { layout: TAB_SPRING, opacity: ENTER }}
                      >
                        <button
                          type="button"
                          className={cx(styles.rowMain, !retryable && styles.rowWide)}
                          aria-current={delivery.id === selectedId || undefined}
                          onClick={() => setSelectedId(delivery.id)}
                          aria-label={`${delivery.event}, ${!response ? "sending" : response.status ? `${response.status} ${statusText(response.status)}` : responseWord(response)}, ${delivery.time}`}
                        >
                          <span className={cx(styles.chip, styles[`chip_${tone}`])}>
                            <Swap id={tone} className={styles.chipIcon}>
                              {tone === "pending" ? (
                                <LoaderCircle size={14} strokeWidth={1.75} className={styles.spin} />
                              ) : tone === "ok" ? (
                                <CircleCheck size={14} strokeWidth={1.75} />
                              ) : tone === "warn" ? (
                                <Clock3 size={14} strokeWidth={1.75} />
                              ) : (
                                <CircleX size={14} strokeWidth={1.75} />
                              )}
                            </Swap>
                            <Swap id={responseWord(response)} className={styles.chipText}>
                              {responseWord(response)}
                            </Swap>
                          </span>
                          <span className={styles.rowEvent} title={delivery.event}>
                            {delivery.event}
                          </span>
                          <span className={styles.rowTime}>{delivery.time}</span>
                          {!retryable ? <span className={styles.rowDuration}>{response ? formatDuration(response.durationMs) : ""}</span> : null}
                        </button>
                        {retryable ? (
                          <button
                            type="button"
                            className={styles.retry}
                            onClick={() => {
                              if (sending) return;
                              interacted.current = true;
                              void send(
                                delivery.id,
                                () => buildSigned(delivery.event, delivery.request.body, delivery.request.url),
                                (request, signal) => (onRetry ? onRetry({ ...delivery, request }, signal) : (onSend ?? simulateSend)(request, signal)),
                                false,
                              );
                            }}
                            disabled={sending}
                            aria-label={`Retry ${delivery.event} delivery`}
                          >
                            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                            Retry
                          </button>
                        ) : null}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}

export default WebhookTester;
