"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, TargetAndTransition, Transition, Variants } from "motion/react";
import { Check, Plus, RotateCw, TriangleAlert } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Badge } from "../badge/badge";
import { Button } from "../button/button";
import { Checkbox } from "../checkbox/checkbox";
import { CopyButton } from "../copy-button/copy-button";
import { Input } from "../input/input";
import { motionTokens as T } from "../lib/motion-tokens";
import styles from "./webhooks.module.css";

export interface WebhookDelivery {
  id: string;
  eventId: string;
  event: string;
  status: number;
  latency: number;
  time: string;
  eventTime: string;
  attempt: number;
  response: string;
  data: Record<string, unknown>;
  test?: boolean;
  resolved?: boolean;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  version: string;
  secretTail: string;
  addedBy: { name: string; photo: string };
  added: string;
  volume: number[];
  deliveries: WebhookDelivery[];
}

export interface WebhooksProps {
  className?: string;
}

/* ------------------------------------------------------------------ data */

const CURRENT_USER = { name: "Sofia Ramirez", photo: "/media/people/sofia-ramirez.svg" };

const EVENT_CATALOG = [
  { id: "order.paid", description: "An order is paid in full" },
  { id: "order.refunded", description: "An order is refunded, fully or in part" },
  { id: "invoice.paid", description: "A subscription invoice is paid" },
  { id: "invoice.payment_failed", description: "A renewal charge is declined" },
  { id: "payout.paid", description: "A payout reaches your bank" },
  { id: "dispute.created", description: "A customer disputes a charge" },
];

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  404: "Not Found",
  500: "Internal Server Error",
  502: "Bad Gateway",
  504: "Gateway Timeout",
};

/** FNV-1a seeded xorshift. Every id, secret and signature in the block comes from here, so nothing renders differently between runs. */
function seeded(seed: string) {
  let state = 0x811c9dc5;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 0x1000193);
  state = state >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function randomString(seed: string, length: number, alphabet = "0123456789abcdef") {
  const next = seeded(seed);
  let value = "";
  for (let index = 0; index < length; index++) value += alphabet[Math.floor(next() * alphabet.length)];
  return value;
}

const ALPHANUMERIC = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const parseTime = (clock: string) => {
  const [hours, minutes, seconds] = clock.split(":").map(Number);
  return { hours, minutes, seconds };
};

/** The delivery clock starts at 14:31:08 and walks forward with each simulated send. */
const clockTime = (index: number) => {
  const total = 52325 + 9 * index;
  const hours = Math.floor(total / 3600) % 24;
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
};

/** Half-hour slot of a delivery, 0 = 15:00 yesterday, 47 = the block being live right now. */
const slotOfTime = (clock: string) => {
  const { hours, minutes } = parseTime(clock);
  return Math.min(47, Math.floor(((hours + 9) * 60 + minutes) / 30));
};

const halfHourLabel = (slot: number) => {
  const start = (900 + slot * 30) % 1440;
  const end = (start + 30) % 1440;
  const stamp = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return slot === 47 ? `${stamp(start)} to now` : `${stamp(start)} to ${stamp(end)}`;
};

/** A day of traffic shaped as a business day: quiet at night, busy after lunch. */
function buildVolume(seed: string, peak: number) {
  const next = seeded(seed);
  return Array.from({ length: 48 }, (_, index) => {
    const wave = 0.1 + 0.9 * Math.max(0, Math.sin((Math.PI * (((15 + index / 2) % 24) - 6)) / 16));
    const value = Math.round(wave * peak * (0.72 + 0.56 * next()));
    return index === 47 ? Math.max(1, Math.round(0.12 * value)) : value;
  });
}

const epochOf = (clock: string) => {
  const { hours, minutes, seconds } = parseTime(clock);
  return Date.UTC(2026, 8, 22, hours, minutes, seconds) / 1000;
};

const hostOf = (url: string) => url.replace(/^https:\/\//, "").split("/")[0];

const duration = (value: number) => (value >= 1e4 ? `${(value / 1e3).toFixed(1)} s` : `${new Intl.NumberFormat("en-US").format(value)} ms`);

const rateOf = (total: number, failing: number) => (total ? Math.floor(((total - failing) / total) * 1e3) / 10 : 0);
const rateLabel = (total: number, failing: number) => (total ? `${rateOf(total, failing).toFixed(1)}%` : "–");

const unresolved = (delivery: WebhookDelivery) => delivery.status >= 300 && !delivery.resolved;

const firstDeliveryId = (endpoint: WebhookEndpoint) => (endpoint.deliveries.find(unresolved) ?? endpoint.deliveries[0])?.id;

/** Volume gains any half hour a delivery landed in, so a retry that arrives now fills the last bar. */
function withDeliveryVolume(endpoint: WebhookEndpoint): WebhookEndpoint {
  const volume = [...endpoint.volume];
  const slots = new Map<number, number>();
  for (const delivery of endpoint.deliveries) {
    const slot = slotOfTime(delivery.eventTime);
    slots.set(slot, (slots.get(slot) ?? 0) + 1);
  }
  for (const [slot, count] of slots) volume[slot] = Math.max(volume[slot], count);
  return { ...endpoint, volume };
}

function stats(endpoint: WebhookEndpoint) {
  const fails = Array.from({ length: 48 }, () => 0);
  for (const delivery of endpoint.deliveries) if (unresolved(delivery)) fails[slotOfTime(delivery.eventTime)] += 1;
  const total = endpoint.volume.reduce((sum, value) => sum + value, 0);
  return { volume: endpoint.volume, fails, total, failing: fails.reduce((sum, value) => sum + value, 0) };
}

const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  "order.paid": { id: "ord_test_4Tq9", object: "order", customer: "cus_test_Z1", amount_total: 2500, currency: "usd", items: 1, shipping: "standard" },
  "order.refunded": { id: "ord_test_4Tq9", object: "order", customer: "cus_test_Z1", amount_refunded: 2500, currency: "usd", reason: "requested_by_customer" },
  "customer.created": { id: "cus_test_Z1", object: "customer", name: "Test customer", email: "test@example.com", country: "US" },
  "invoice.paid": { id: "in_test_8Kd2", object: "invoice", number: "TEST-0001", customer: "cus_test_Z1", amount_paid: 2500, currency: "usd", status: "paid" },
  "invoice.payment_failed": { id: "in_test_8Kd2", object: "invoice", number: "TEST-0001", customer: "cus_test_Z1", amount_due: 2500, currency: "usd", attempt_count: 1 },
  "payout.paid": { id: "po_test_3Hs7", object: "payout", amount: 1e5, currency: "usd", destination: "ba_test_9", status: "paid" },
  "payout.failed": { id: "po_test_3Hs7", object: "payout", amount: 1e5, currency: "usd", failure_code: "account_closed" },
  "refund.created": { id: "re_test_6Pw1", object: "refund", charge: "ch_test_2", amount: 2500, currency: "usd", status: "succeeded" },
  "dispute.created": { id: "dp_test_5Lx3", object: "dispute", charge: "ch_test_2", amount: 2500, currency: "usd", reason: "fraudulent", status: "needs_response" },
};

/**
 * Delivery ids are the only stable handle on a row, so the event id is derived from one.
 * The seed keeps a demo delivery looking like a real one without shipping random ids.
 */
const deliveries = (rows: Array<[string, string, number, number, string, Record<string, unknown>, string?]>): WebhookDelivery[] =>
  rows.map(([id, event, status, latency, time, data, response]) => ({
    id,
    eventId: `evt_${randomString(id, 10, ALPHANUMERIC)}`,
    event,
    status,
    latency,
    time,
    eventTime: time,
    attempt: 1,
    response: response ?? '{"received":true}',
    data,
  }));

const ENDPOINTS: WebhookEndpoint[] = [
  {
    id: "ledger",
    name: "Ledger sync",
    url: "https://ledger.fernway.example/v1/halden/events",
    events: ["invoice.paid", "invoice.payment_failed", "payout.paid", "refund.created"],
    version: "2026-08-01",
    secretTail: "7f3a",
    addedBy: { name: "Emma Collins", photo: "/media/people/emma-collins.svg" },
    added: "Mar 4, 2026",
    volume: buildVolume("ledger", 14),
    deliveries: deliveries([
      [
        "dlv_8Kq2Lm4",
        "invoice.paid",
        200,
        142,
        "14:31:08",
        { id: "in_1Q8vRt2", object: "invoice", number: "FW-2026-1182", customer: "cus_R4bLw9", amount_paid: 48e3, currency: "usd", status: "paid" },
      ],
      [
        "dlv_7Hn1Pc9",
        "invoice.payment_failed",
        500,
        2318,
        "14:12:44",
        { id: "in_1Q8uXe7", object: "invoice", number: "FW-2026-1179", customer: "cus_P2mZr6", amount_due: 129900, currency: "usd", attempt_count: 2, next_payment_attempt: 0x6ab54900 },
        '{"error":"ledger_write_failed","message":"connection pool exhausted"}',
      ],
      [
        "dlv_6Gm0Ob8",
        "payout.paid",
        200,
        98,
        "13:47:02",
        { id: "po_1Q9aZt4", object: "payout", amount: 1845210, currency: "usd", arrival_date: 0x6ab1c500, destination: "ba_1PzR7c", status: "paid" },
      ],
      [
        "dlv_5Fl9Na7",
        "invoice.paid",
        504,
        3e4,
        "11:05:19",
        { id: "in_1Q8pLk3", object: "invoice", number: "FW-2026-1164", customer: "cus_K9dQe2", amount_paid: 21900, currency: "usd", status: "paid" },
        "upstream request timeout",
      ],
      [
        "dlv_4Ek8Mz6",
        "refund.created",
        200,
        121,
        "10:22:51",
        { id: "re_1Q8nWb5", object: "refund", charge: "ch_3Q8mTz1", amount: 4800, currency: "usd", reason: "requested_by_customer", status: "succeeded" },
      ],
      [
        "dlv_3Dj7Ly5",
        "invoice.paid",
        500,
        1904,
        "09:14:36",
        { id: "in_1Q8kFa9", object: "invoice", number: "FW-2026-1151", customer: "cus_H3vNp8", amount_paid: 9900, currency: "usd", status: "paid" },
        '{"error":"ledger_write_failed","message":"deadlock detected on ledger_entries"}',
      ],
      [
        "dlv_2Ci6Kx4",
        "invoice.paid",
        200,
        133,
        "08:59:10",
        { id: "in_1Q8jRm0", object: "invoice", number: "FW-2026-1149", customer: "cus_B7xLc4", amount_paid: 36e3, currency: "usd", status: "paid" },
      ],
    ]),
  },
  {
    id: "orders",
    name: "Order fulfilment",
    url: "https://api.fernway.example/webhooks/halden",
    events: ["order.paid", "order.refunded", "customer.created"],
    version: "2026-08-01",
    secretTail: "c21e",
    addedBy: { name: "Marcus Johnson", photo: "/media/people/marcus-johnson.svg" },
    added: "Jan 18, 2026",
    volume: buildVolume("orders", 34),
    deliveries: deliveries([
      [
        "dlv_9Lr3Mn5",
        "order.paid",
        200,
        87,
        "14:30:52",
        { id: "ord_7Qm2Ks", object: "order", customer: "cus_T7wQx1", amount_total: 21400, currency: "usd", items: 3, shipping: "standard" },
      ],
      [
        "dlv_9Ks2Ln4",
        "customer.created",
        200,
        64,
        "14:30:49",
        { id: "cus_T7wQx1", object: "customer", name: "Priya Raman", email: "priya@lumenhaus.co", country: "US" },
      ],
      [
        "dlv_9Jt1Ko3",
        "order.paid",
        200,
        112,
        "14:26:13",
        { id: "ord_7Qk8Hd", object: "order", customer: "cus_M2pRz5", amount_total: 5800, currency: "usd", items: 1, shipping: "express" },
      ],
      [
        "dlv_9Iu0Jp2",
        "order.refunded",
        200,
        95,
        "14:02:37",
        { id: "ord_7Qh4Wn", object: "order", customer: "cus_D8nVt3", amount_refunded: 5800, currency: "usd", reason: "damaged_in_transit" },
      ],
      [
        "dlv_9Hv9Iq1",
        "order.paid",
        200,
        238,
        "13:58:04",
        { id: "ord_7Qg1Bc", object: "order", customer: "cus_F4kYs9", amount_total: 13250, currency: "usd", items: 2, shipping: "standard" },
      ],
    ]),
  },
  {
    id: "alerts",
    name: "Ops alerts",
    url: "https://hooks.fernway.example/ops/halden",
    events: ["dispute.created", "payout.failed"],
    version: "2026-05-12",
    secretTail: "90bd",
    addedBy: { name: "Ava Mitchell", photo: "/media/people/ava-mitchell.svg" },
    added: "Jun 9, 2026",
    volume: Array.from({ length: 48 }, (_, slot) => ({ 4: 1, 17: 1, 32: 1, 43: 2 })[slot] ?? 0),
    deliveries: deliveries([
      [
        "dlv_1Aw5Cr8",
        "dispute.created",
        200,
        311,
        "12:40:18",
        { id: "dp_1Q8tYh6", object: "dispute", charge: "ch_3Q7wPx2", amount: 8900, currency: "usd", reason: "product_not_received", status: "needs_response" },
      ],
      [
        "dlv_1Bx4Ds7",
        "payout.failed",
        200,
        276,
        "07:12:55",
        { id: "po_1Q8hVc2", object: "payout", amount: 212e3, currency: "usd", failure_code: "account_closed", destination: "ba_1NcT3q" },
      ],
    ]),
  },
].map(withDeliveryVolume);

/* -------------------------------------------------------------- animation */

const EASE_ENTER = [...T.ease.enter] as [number, number, number, number];
const EASE_STANDARD = [...T.ease.standard] as [number, number, number, number];
const ZERO: Transition = { duration: 0 };
const SHOWN: TargetAndTransition = { opacity: 1, y: "0em", filter: "blur(0px)" };
const SWAP_IN: TargetAndTransition = { opacity: 0, y: "0.35em", filter: `blur(${T.blur.soft}px)` };
const SWAP_OUT: TargetAndTransition = {
  opacity: 0,
  y: "-0.3em",
  filter: `blur(${T.blur.subtle}px)`,
  transition: { duration: T.duration.fast, ease: EASE_STANDARD },
};

const rollVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.6 * direction}em`, filter: `blur(${T.blur.subtle}px)` }),
  center: { opacity: 1, y: "0em", filter: "blur(0px)" },
  exit: (direction: number) => ({ opacity: 0, y: `${-0.6 * direction}em`, filter: `blur(${T.blur.subtle}px)` }),
};

/** Rows open their height on a spring as they arrive, and close it as they leave. Reduced motion only fades. */
function rowMotion(reduced: boolean) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, height: 0, overflow: "hidden" },
    animate: { opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } },
    exit: reduced
      ? { opacity: 0, transition: ZERO }
      : { opacity: 0, height: 0, overflow: "hidden", transition: { height: T.spring.smooth, opacity: { duration: T.duration.fast } } },
    transition: reduced ? ZERO : { height: T.spring.smooth, opacity: { duration: T.duration.standard, ease: EASE_ENTER, delay: 0.08 } },
  } as const;
}

/* ------------------------------------------------------------------- copy */

/** A whole line of text swaps as one blurred crossfade. Outgoing copies are hidden from assistive tech. */
function Swap({ text, reduced, wrap = false }: { text: string; reduced: boolean; wrap?: boolean }) {
  return (
    <span className={wrap ? styles.swapBlock : styles.swap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <SwapText key={text} text={text} reduced={reduced} wrap={wrap} />
      </AnimatePresence>
    </span>
  );
}

function SwapText({ text, reduced, wrap }: { text: string; reduced: boolean; wrap: boolean }) {
  const present = useIsPresent();
  return (
    <motion.span
      className={wrap ? styles.swapWrap : styles.swapText}
      aria-hidden={!present || undefined}
      initial={reduced ? { opacity: 0 } : SWAP_IN}
      animate={SHOWN}
      exit={reduced ? { opacity: 0, transition: ZERO } : SWAP_OUT}
      transition={reduced ? ZERO : { duration: T.duration.standard, ease: EASE_ENTER }}
    >
      {text}
    </motion.span>
  );
}

/** Each character rolls in the direction the number moved, right to left. Screen readers get the plain text elsewhere. */
function Roll({ text, value, reduced }: { text: string; value: number; reduced: boolean }) {
  const [shown, setShown] = useState({ value, direction: 1 });
  if (shown.value !== value) setShown({ value, direction: value > shown.value ? 1 : -1 });
  const characters = [...text];
  return (
    <span className={styles.roll} aria-hidden="true">
      {characters.map((character, index) => {
        const key = characters.length - index;
        const delay = 0.03 * Math.min(key - 1, 4);
        return (
          <span key={key} className={styles.rollSlot}>
            <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}>
              <motion.span
                key={character}
                custom={shown.direction}
                variants={rollVariants}
                initial={!reduced && "enter"}
                animate="center"
                exit={reduced ? undefined : "exit"}
                transition={
                  reduced
                    ? ZERO
                    : { y: { ...T.spring.snappy, delay }, opacity: { duration: T.duration.fast, delay }, filter: { duration: T.duration.fast, delay } }
                }
              >
                {character}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------------------------------------- code view */

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g;

function Code({ text }: { text: string }) {
  return (
    <pre className={styles.code}>
      <code>
        {text.split("\n").map((line, index) => {
          const parts: ReactNode[] = [];
          let cursor = 0;
          for (const match of line.matchAll(JSON_TOKEN)) {
            const start = match.index ?? 0;
            if (start > cursor) parts.push(line.slice(cursor, start));
            if (match[1]) {
              parts.push(
                <span key={start} className={match[2] ? styles.key : styles.string}>
                  {match[1]}
                </span>,
              );
              if (match[2]) parts.push(match[2]);
            } else {
              parts.push(
                <span key={start} className={match[3] ? styles.number : styles.literal}>
                  {match[3] ?? match[4]}
                </span>,
              );
            }
            cursor = start + match[0].length;
          }
          if (cursor < line.length) parts.push(line.slice(cursor));
          return (
            <span key={index} className={styles.line}>
              <span className={styles.lineNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>{parts}</span>
            </span>
          );
        })}
      </code>
    </pre>
  );
}

/* ------------------------------------------------------------- the shell */

/** The add button widens into a form and the toolbar keeps its height; both follow their content without a jump. */
function useShellSize(open: boolean, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto");
  const height = useMotionValue<number | "auto">("auto");
  const [box, setBox] = useState({ track: 0, face: 0, row: 0, inner: 0 });
  const trackRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const armedUntil = useRef(0);
  const running = useRef<{ width?: AnimationPlaybackControls; height?: AnimationPlaybackControls }>({});

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const track = trackRef.current;
    const face = faceRef.current;
    const inner = innerRef.current;
    if (!track || !face || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setBox((previous) => {
        const next = {
          track: track.getBoundingClientRect().width,
          face: openRef.current && previous.face ? previous.face : face.getBoundingClientRect().width,
          row: face.offsetHeight,
          inner: inner.getBoundingClientRect().height,
        };
        return next.track === previous.track && next.face === previous.face && next.row === previous.row && next.inner === previous.inner ? previous : next;
      }),
    );
    [track, face, inner].forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!box.track || !box.face || !box.row) return;
    const animateChange = !reduced && performance.now() < armedUntil.current;
    const run = (value: typeof width, target: number, key: "width" | "height") => {
      const current = value.get();
      running.current[key]?.stop();
      if (animateChange && typeof current === "number") {
        if (Math.abs(current - target) > 0.5) running.current[key] = animate(value, target, T.spring.smooth);
      } else value.jump(target);
    };
    run(width, open ? box.track : box.face, "width");
    run(height, open ? Math.max(box.inner, box.row) : box.row, "height");
  }, [open, box, reduced, width, height]);

  useEffect(
    () => () => {
      running.current.width?.stop();
      running.current.height?.stop();
    },
    [],
  );

  return {
    width,
    height,
    trackRef,
    faceRef,
    innerRef,
    arm: () => {
      armedUntil.current = performance.now() + 900;
    },
  };
}

/** The detail column keeps its height as endpoints switch, so the page below never jumps. */
function useFollowHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const armedUntil = useRef(0);
  useEffect(() => {
    let running: AnimationPlaybackControls | undefined;
    const frame = outer.current;
    const content = inner.current;
    if (!frame || !content || typeof ResizeObserver === "undefined") return;
    let last = content.offsetHeight;
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight;
      if (next === last) return;
      const from = running ? frame.offsetHeight : last;
      last = next;
      running?.stop();
      running = undefined;
      if (reduced || performance.now() > armedUntil.current || Math.abs(from - next) < 1) {
        frame.style.height = "";
        return;
      }
      frame.style.height = `${from}px`;
      running = animate(frame, { height: [`${from}px`, `${next}px`] }, {
        ...T.spring.smooth,
        onComplete: () => {
          frame.style.height = "";
          running = undefined;
        },
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      running?.stop();
    };
  }, [reduced]);
  return { outer, inner, arm: () => (armedUntil.current = performance.now() + 500) };
}

/* --------------------------------------------------------------- endpoint */

function EndpointRow({
  endpoint,
  selected,
  selectedId,
  fresh,
  reduced,
  detailId,
  onSelect,
}: {
  endpoint: WebhookEndpoint;
  selected: boolean;
  selectedId: string;
  fresh: boolean;
  reduced: boolean;
  detailId: string;
  onSelect: () => void;
}) {
  const { total, failing } = stats(endpoint);
  const shown = endpoint.events.slice(0, 3);
  const rest = endpoint.events.length - shown.length;
  return (
    <motion.div role="listitem" className={styles.row} {...rowMotion(reduced)}>
      <div className={styles.endpoint} data-fresh={fresh}>
        {selected && (
          <motion.span
            layoutId="endpoint-highlight"
            layoutDependency={selectedId}
            className={styles.highlight}
            transition={reduced ? ZERO : T.spring.morph}
            aria-hidden="true"
          />
        )}
        <span className={styles.flash} aria-hidden="true" />
        <button type="button" className={styles.endpointButton} data-endpoint={endpoint.id} aria-current={selected ? "true" : undefined} aria-controls={detailId} onClick={onSelect}>
          <span className={styles.identity}>
            <span className={styles.name}>{endpoint.name}</span>
            <span className={styles.url}>
              <span className={styles.host}>{hostOf(endpoint.url)}</span>
              {endpoint.url.replace(/^https:\/\/[^/]+/, "")}
            </span>
          </span>
          <span className={styles.srOnly}>{`Events: ${endpoint.events.join(", ")}. `}</span>
          <span className={styles.events} aria-hidden="true">
            {shown.map((event) => (
              <span key={event} className={styles.chip} aria-hidden="true">
                {event}
              </span>
            ))}
            {rest > 0 && (
              <span className={styles.chip} aria-hidden="true">
                +{rest}
              </span>
            )}
          </span>
          <span className={styles.rate}>
            <Roll text={rateLabel(total, failing)} value={rateOf(total, failing)} reduced={reduced} />
            <span className={styles.srOnly}>{total ? `${rateLabel(total, failing)} delivered. ` : "No events yet. "}</span>
            <span className={styles.rateLabel} aria-hidden="true">
              delivered
            </span>
          </span>
          <span className={styles.state}>
            <Badge
              size="sm"
              tone={failing ? "warning" : total ? "success" : "neutral"}
              icon={failing ? <TriangleAlert size={12} strokeWidth={2} /> : total ? <Check size={12} strokeWidth={2} /> : undefined}
            >
              {failing ? `${failing} failing` : total ? "Healthy" : "No events"}
            </Badge>
          </span>
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ chart */

const AXIS_MARKS = [
  { slot: 0, label: "15:00" },
  { slot: 12, label: "21:00" },
  { slot: 24, label: "03:00" },
  { slot: 36, label: "09:00" },
];

function Chart({ endpoint, reduced }: { endpoint: WebhookEndpoint; reduced: boolean }) {
  const { volume, fails, total, failing } = stats(endpoint);
  const [hovered, setHovered] = useState<number | null>(null);
  const ceiling = Math.max(4, ...volume);
  const peak = volume.indexOf(Math.max(...volume));
  const failingRanges = fails.flatMap((count, slot) => (count ? [halfHourLabel(slot)] : []));
  const description = total
    ? `Events per half hour over the last 24 hours: ${new Intl.NumberFormat("en-US").format(total)} events, ${failing ? `${failing} still failing, from ${failingRanges.join(", ")}` : "all delivered"}. Busiest from ${halfHourLabel(peak)} with ${volume[peak]} events.`
    : "No events in the last 24 hours.";
  const caption = total ? `${new Intl.NumberFormat("en-US").format(total)} events` : "No events yet";

  return (
    <div className={styles.chartBlock}>
      <p className={styles.caption} aria-hidden="true">
        {hovered === null ? (
          <>
            <Swap text={caption} reduced={reduced} />
            {failing ? (
              <span className={styles.legend}>
                <span className={styles.swatch} />
                <Swap text={`${failing} failed`} reduced={reduced} />
              </span>
            ) : total ? (
              <span className={styles.legendMuted}>all delivered</span>
            ) : null}
          </>
        ) : (
          <>
            <span className={styles.readoutTime}>{halfHourLabel(hovered)}</span>
            <span>
              {volume[hovered]} {volume[hovered] === 1 ? "event" : "events"}
            </span>
            {fails[hovered] ? (
              <span className={styles.legend}>
                <span className={styles.swatch} />
                {fails[hovered]} failed
              </span>
            ) : null}
          </>
        )}
      </p>
      <div
        className={styles.chart}
        role="img"
        aria-label={description}
        data-hover={hovered !== null}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          const box = event.currentTarget.getBoundingClientRect();
          setHovered(Math.min(47, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * 48))));
        }}
        onPointerLeave={() => setHovered(null)}
      >
        {volume.map((value, slot) => {
          const failHeight = fails[slot] ? Math.max(5, Math.round((fails[slot] / ceiling) * 56) + 1) : 0;
          const height = value ? Math.max(3, Math.round((value / ceiling) * 56), failHeight + (value > fails[slot] ? 3 : -1)) : 0;
          const transition = reduced ? ZERO : { ...T.spring.smooth, delay: 0.004 * slot };
          return (
            <motion.span key={slot} className={styles.bar} data-active={hovered === slot} initial={false} animate={{ height }} transition={transition}>
              <motion.span className={styles.fail} initial={false} animate={{ height: failHeight }} transition={transition} />
              <span className={styles.ok} />
            </motion.span>
          );
        })}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {AXIS_MARKS.map((mark) => (
          <span key={mark.slot} style={{ left: `${(mark.slot / 48) * 100}%` }}>
            {mark.label}
          </span>
        ))}
        <span className={styles.now}>Now</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- delivery */

function DeliveryRow({
  delivery,
  endpointId,
  selected,
  selectedKey,
  fresh,
  sending,
  reduced,
  inspectorId,
  onSelect,
  onRetry,
  buttonRef,
}: {
  delivery: WebhookDelivery;
  endpointId: string;
  selected: boolean;
  selectedKey: string;
  fresh: boolean;
  sending: boolean;
  reduced: boolean;
  inspectorId: string;
  onSelect: () => void;
  onRetry: () => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}) {
  const ok = delivery.status < 300;
  const label = `${delivery.status} ${STATUS_TEXT[delivery.status]}, ${delivery.event}${delivery.attempt > 1 ? `, attempt ${delivery.attempt}` : ""}${delivery.test ? ", test event" : ""}, ${duration(delivery.latency)}, sent at ${delivery.time}${delivery.resolved ? ", resolved by a retry" : ""}`;
  const fade = {
    initial: reduced ? { opacity: 0 } : SWAP_IN,
    animate: SHOWN,
    exit: reduced ? { opacity: 0, transition: ZERO } : SWAP_OUT,
    transition: reduced ? ZERO : { duration: T.duration.standard, ease: EASE_ENTER },
  };
  return (
    <motion.div role="listitem" className={styles.row} data-row={delivery.id} {...rowMotion(reduced)}>
      <div className={styles.delivery} data-fresh={fresh} data-resolved={delivery.resolved ?? false}>
        {selected && (
          <motion.span
            layoutId={`delivery-${endpointId}`}
            layoutDependency={selectedKey}
            className={styles.highlight}
            transition={reduced ? ZERO : T.spring.morph}
            aria-hidden="true"
          />
        )}
        <span className={styles.flash} aria-hidden="true" />
        <button
          ref={buttonRef}
          type="button"
          className={styles.deliveryButton}
          data-delivery={delivery.id}
          aria-current={selected ? "true" : undefined}
          aria-controls={inspectorId}
          aria-label={label}
          onClick={onSelect}
        >
          <Badge size="sm" tone={ok ? "success" : "danger"} className={styles.statusCode}>
            {String(delivery.status)}
          </Badge>
          <span className={styles.eventCell}>
            <span className={styles.eventName}>{delivery.event}</span>
            {delivery.attempt > 1 ? (
              <span className={styles.attempt}>Attempt {delivery.attempt}</span>
            ) : delivery.test ? (
              <span className={styles.attempt}>Test</span>
            ) : null}
          </span>
          <span className={styles.meta}>
            <span className={styles.latency}>{duration(delivery.latency)}</span>
            <span className={styles.time}>{delivery.time}</span>
          </span>
        </button>
        <span className={styles.action}>
          {!ok && (
            <AnimatePresence mode="popLayout" initial={false}>
              {delivery.resolved ? (
                <motion.span key="resolved" className={styles.resolved} {...fade}>
                  <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                  Resolved
                </motion.span>
              ) : (
                <motion.span key="retry" {...fade}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={sending}
                    aria-label={sending ? `Sending ${delivery.event} again` : `Retry ${delivery.event} from ${delivery.time}`}
                    onClick={onRetry}
                  >
                    {sending ? (
                      "Sending"
                    ) : (
                      <>
                        <RotateCw size={14} strokeWidth={1.75} aria-hidden="true" />
                        Retry
                      </>
                    )}
                  </Button>
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------- inspector */

function Inspector({
  endpoint,
  delivery,
  tab,
  reduced,
  id,
  onTab,
  onCopied,
}: {
  endpoint: WebhookEndpoint;
  delivery: WebhookDelivery | undefined;
  tab: "payload" | "headers";
  reduced: boolean;
  id: string;
  onTab: (tab: "payload" | "headers") => void;
  onCopied: (what: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const tabs = useRef<{ payload: HTMLButtonElement | null; headers: HTMLButtonElement | null }>({ payload: null, headers: null });

  const payload = delivery
    ? JSON.stringify(
        {
          id: delivery.eventId,
          type: delivery.event,
          created: epochOf(delivery.eventTime),
          api_version: endpoint.version,
          livemode: !delivery.test,
          data: { object: delivery.data },
        },
        null,
        2,
      )
    : "";
  const headers: [string, string][] = delivery
    ? [
        ["Content-Type", "application/json; charset=utf-8"],
        ["User-Agent", "Halden-Webhooks/2026-08"],
        ["Halden-Event-Id", delivery.eventId],
        ["Halden-Delivery-Id", delivery.id],
        ["Halden-Attempt", String(delivery.attempt)],
        ["Halden-Signature", `t=${epochOf(delivery.time)},v1=${randomString(`${delivery.id}:${endpoint.secretTail}`, 64)}`],
      ]
    : [];

  useEffect(() => {
    scroll.current?.scrollTo({ top: 0, left: 0 });
  }, [delivery?.id, tab]);

  if (!delivery) {
    return (
      <section id={id} className={styles.inspector} aria-label="Delivery inspector">
        <p className={styles.placeholder}>The request body and headers of each delivery show up here.</p>
      </section>
    );
  }

  const ok = delivery.status < 300;
  const body = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 4, filter: `blur(${T.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, transition: reduced ? ZERO : { duration: T.duration.instant } },
    transition: reduced ? ZERO : { duration: T.duration.standard, ease: EASE_ENTER },
  };

  return (
    <section id={id} className={styles.inspector} aria-labelledby={`${id}-title`}>
      <div className={styles.inspectorHead}>
        <div className={styles.inspectorTitle}>
          <h4 id={`${id}-title`}>
            <Swap text={delivery.event} reduced={reduced} />
          </h4>
          <p>
            <Swap text={`${delivery.eventId}, attempt ${delivery.attempt}`} reduced={reduced} />
          </p>
        </div>
        <CopyButton
          value={tab === "payload" ? payload : headers.map(([name, value]) => `${name}: ${value}`).join("\n")}
          label="Copy"
          onCopied={() => onCopied(tab === "payload" ? "Payload" : "Headers")}
        />
      </div>
      <div className={styles.response}>
        <span className={styles.responseLine}>
          <span className={styles.responseLabel}>Response</span>
          <Badge size="sm" tone={ok ? "success" : "danger"}>
            {String(delivery.status)}
          </Badge>
          <Swap text={`${STATUS_TEXT[delivery.status]} in ${duration(delivery.latency)}`} reduced={reduced} />
        </span>
        <code className={styles.responseBody}>
          <Swap text={delivery.response} reduced={reduced} wrap />
        </code>
      </div>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Request"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "payload" : event.key === "End" || tab === "payload" ? "headers" : "payload";
          onTab(next);
          tabs.current[next]?.focus();
        }}
      >
        {(["payload", "headers"] as const).map((name) => (
          <button
            key={name}
            ref={(node) => {
              tabs.current[name] = node;
            }}
            id={`${id}-${name}`}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={tab === name}
            aria-controls={`${id}-panel`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => onTab(name)}
          >
            {tab === name && (
              <motion.span
                layoutId={`tab-${endpoint.id}`}
                layoutDependency={tab}
                className={styles.tabHighlight}
                transition={reduced ? ZERO : T.spring.morph}
                aria-hidden="true"
              />
            )}
            <span className={styles.tabLabel}>{name === "payload" ? "Payload" : "Headers"}</span>
          </button>
        ))}
      </div>
      <div ref={scroll} id={`${id}-panel`} className={styles.panel} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={`${delivery.id}-${tab}`} className={styles.panelBody} {...body}>
            {tab === "payload" ? (
              <Code text={payload} />
            ) : (
              <dl className={styles.headers}>
                {headers.map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- the block */

const URL_PATTERN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;

/** Arrow keys move between rows and take the selection with them, so the panel follows the focus. */
function navigate(event: KeyboardEvent<HTMLDivElement>, attribute: string, onMove: (key: string) => void) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`[${attribute}]`));
  const index = rows.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
  rows[next].focus();
  onMove(rows[next].getAttribute(attribute) ?? "");
}

export function Webhooks({ className }: WebhooksProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(ENDPOINTS);
  const [selectedId, setSelectedId] = useState(ENDPOINTS[0].id);
  const [selectedDelivery, setSelectedDelivery] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(ENDPOINTS.map((endpoint) => [endpoint.id, firstDeliveryId(endpoint)])),
  );
  const [tab, setTab] = useState<"payload" | "headers">("payload");
  const [sending, setSending] = useState<string[]>([]);
  const [freshRows, setFreshRows] = useState<string[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [live, setLive] = useState("Pick a delivery to inspect its payload and headers");
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"form" | "reveal">("form");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>(["order.paid"]);
  const [errors, setErrors] = useState<{ url?: string; events?: string }>({});
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState("");
  const [freshEndpoint, setFreshEndpoint] = useState<string | null>(null);

  const { width, height, trackRef, faceRef, innerRef, arm: armShell } = useShellSize(open, reduced);
  const { outer, inner, arm: armFollow } = useFollowHeight(reduced);

  const formButton = useRef<HTMLButtonElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const eventSet = useRef<HTMLFieldSetElement>(null);
  const revealPanel = useRef<HTMLDivElement>(null);
  const deliveryButtons = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<number[]>([]);
  const retrySeq = useRef(0);
  const addSeq = useRef(0);
  const secretSeq = useRef(0);
  const newName = useRef("");
  const latestId = useRef(selectedId);

  const selected = endpoints.find((endpoint) => endpoint.id === selectedId) ?? endpoints[0];
  const selectedKey = selectedDelivery[selected.id] ?? firstDeliveryId(selected);
  const delivery = selected.deliveries.find((item) => item.id === selectedKey);
  const panelTitle = open && panel === "reveal" ? "Endpoint added" : open ? "New endpoint" : "Add endpoint";
  const detailId = `${uid}-detail`;
  const inspectorId = `${uid}-inspector`;

  useEffect(() => {
    latestId.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const later = (action: () => void, delay: number) => {
    timers.current.push(window.setTimeout(action, delay));
  };

  const flash = (id: string) => {
    setFreshRows((list) => [...list, id]);
    later(() => setFreshRows((list) => list.filter((item) => item !== id)), 1400);
  };

  const focusDelivery = (id: string) => requestAnimationFrame(() => deliveryButtons.current.get(id)?.focus({ preventScroll: true }));

  function select(id: string) {
    if (id === latestId.current) return;
    armFollow();
    latestId.current = id;
    setSelectedId(id);
  }

  function close() {
    if (!open) return;
    addSeq.current++;
    armShell();
    setOpen(false);
    setAdding(false);
    if (panel === "reveal") {
      setFreshEndpoint(null);
      setLive(`${newName.current} added. Send a test event to check that it answers.`);
    } else {
      setLive("New endpoint discarded");
    }
    formButton.current?.focus({ preventScroll: true });
  }

  function openPanel() {
    armShell();
    setPanel("form");
    setUrl("");
    setDescription("");
    setEvents(["order.paid"]);
    setErrors({});
    setAdding(false);
    setOpen(true);
    setLive("Enter an HTTPS URL and choose the events it should receive");
    requestAnimationFrame(() => urlInput.current?.focus({ preventScroll: true }));
  }

  const failingCount = endpoints.filter((endpoint) => stats(endpoint).failing > 0).length;

  function toggleEvent(id: string, on: boolean) {
    setEvents((list) => (on ? [...list.filter((item) => item !== id), id] : list.filter((item) => item !== id)));
    if (on && errors.events) setErrors((previous) => ({ ...previous, events: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const value = url.trim();
    const nextErrors = {
      url: value ? (URL_PATTERN.test(value) ? undefined : "Use a public HTTPS URL, such as https://api.fernway.example/webhooks") : "Enter the URL Halden should post events to",
      events: events.length ? undefined : "Choose at least one event",
    };
    setErrors(nextErrors);
    if (nextErrors.url || nextErrors.events) {
      setLive(nextErrors.url ?? nextErrors.events ?? "");
      if (nextErrors.url) urlInput.current?.focus();
      else eventSet.current?.querySelector("button")?.focus();
      return;
    }
    const seq = ++addSeq.current;
    setAdding(true);
    setLive(`Adding ${value}.`);
    later(() => {
      if (seq !== addSeq.current) return;
      secretSeq.current += 1;
      const created = `whsec_${randomString(`${value}:${secretSeq.current}`, 32, ALPHANUMERIC)}`;
      const endpoint: WebhookEndpoint = {
        id: `new-${secretSeq.current}`,
        name: description.trim() || hostOf(value),
        url: value,
        events: EVENT_CATALOG.map((item) => item.id).filter((id) => events.includes(id)),
        version: "2026-08-01",
        secretTail: created.slice(-4),
        addedBy: CURRENT_USER,
        added: "Sep 22, 2026",
        volume: Array.from({ length: 48 }, () => 0),
        deliveries: [],
      };
      newName.current = endpoint.name;
      armShell();
      setSecret(created);
      setEndpoints((list) => [endpoint, ...list]);
      setFreshEndpoint(endpoint.id);
      setAdding(false);
      setPanel("reveal");
      setLive(`${endpoint.name} added. Copy the signing secret now, it will not be shown again.`);
      requestAnimationFrame(() => revealPanel.current?.querySelector("button")?.focus({ preventScroll: true }));
      later(() => select(endpoint.id), 460 * (reduced ? 0 : 1));
    }, 760);
  }

  function retry(endpoint: WebhookEndpoint, target: WebhookDelivery) {
    if (sending.includes(target.id)) return;
    const host = hostOf(endpoint.url);
    setSending((list) => [...list, target.id]);
    setLive(`Retrying ${target.event} to ${host}.`);
    later(() => {
      const seq = ++retrySeq.current;
      const next: WebhookDelivery = {
        ...target,
        id: `dlv_${randomString(`${target.id}:${seq}`, 7)}`,
        status: 200,
        latency: [184, 146, 211, 163, 129, 197][seq % 6],
        time: clockTime(seq),
        attempt: target.attempt + 1,
        response: '{"received":true}',
        resolved: false,
      };
      const hadFocus = document.activeElement?.closest(`[data-row="${target.id}"]`) != null;
      setEndpoints((list) =>
        list.map((item) =>
          item.id !== endpoint.id
            ? item
            : {
                ...item,
                deliveries: [next, ...item.deliveries.map((entry) => (entry.id === target.id ? { ...entry, resolved: true } : entry))],
              },
        ),
      );
      setSending((list) => list.filter((id) => id !== target.id));
      flash(next.id);
      setLive(`${target.event} delivered on attempt ${next.attempt}. ${host} answered 200 in ${next.latency} ms.`);
      if (hadFocus) focusDelivery(next.id);
      later(() => setSelectedDelivery((map) => ({ ...map, [endpoint.id]: next.id })), 460 * (reduced ? 0 : 1));
    }, 1100);
  }

  return (
    <section className={[styles.hooks, className].filter(Boolean).join(" ")} aria-labelledby={`${uid}-heading`}>
      <div className={styles.top}>
        <header className={styles.header}>
          <h2 id={`${uid}-heading`}>Webhooks</h2>
          <p>Halden signs every event and posts it to your endpoints. Failed deliveries retry on their own for three days, or you can retry them now.</p>
        </header>
        <div
          ref={trackRef}
          className={styles.toolbar}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Escape" && open) {
              event.stopPropagation();
              close();
            }
          }}
        >
          <p className={styles.count} data-hidden={open} inert={open}>
            <Roll text={String(endpoints.length)} value={endpoints.length} reduced={reduced} />
            <span className={styles.srOnly}>{endpoints.length}</span>
            <span>{endpoints.length === 1 ? "endpoint" : "endpoints"}</span>
            <span className={styles.countNote}>
              <Swap text={failingCount ? `${failingCount} with failed deliveries` : "all delivering"} reduced={reduced} />
            </span>
          </p>
          <motion.div className={styles.shell} data-open={open} style={{ width, height }}>
            <div ref={innerRef} className={styles.shellInner}>
              <div ref={faceRef} className={styles.face}>
                <button
                  ref={formButton}
                  className={styles.toggle}
                  type="button"
                  aria-label={open ? "Close" : "Add endpoint"}
                  aria-expanded={open}
                  aria-controls={open ? `${uid}-panel` : undefined}
                  onClick={open ? close : openPanel}
                >
                  <motion.span className={styles.toggleIcon} initial={false} animate={{ rotate: 45 * (open ? 1 : 0) }} transition={reduced ? ZERO : T.spring.snappy}>
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  </motion.span>
                </button>
                <span id={`${uid}-title`} className={styles.title} role={open ? "heading" : undefined} aria-level={open ? 3 : undefined} aria-hidden={!open || undefined}>
                  <Swap text={panelTitle} reduced={reduced} />
                </span>
              </div>
              <AnimatePresence initial={false}>
                {open && (
                <motion.div
                  key="body"
                  id={`${uid}-panel`}
                  className={styles.body}
                  role="group"
                  aria-labelledby={`${uid}-title`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: reduced ? ZERO : { duration: T.duration.standard + 0.04, ease: EASE_ENTER, delay: 0.14 } }}
                  exit={{ opacity: 0, transition: reduced ? ZERO : { duration: 0.1, ease: EASE_STANDARD } }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {panel === "form" ? (
                      <motion.form
                        key="form"
                        className={styles.form}
                        noValidate
                        onSubmit={submit}
                        exit={{ opacity: 0, transition: reduced ? ZERO : { duration: T.duration.instant } }}
                      >
                        <div className={styles.fields}>
                          <Input
                            ref={urlInput}
                            label="Endpoint URL"
                            placeholder="https://api.fernway.example/webhooks"
                            type="url"
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            value={url}
                            error={errors.url}
                            onChange={(event) => {
                              setUrl(event.target.value);
                              if (errors.url) setErrors((previous) => ({ ...previous, url: undefined }));
                            }}
                          />
                          <Input
                            label="Description"
                            description="Optional"
                            placeholder="Warehouse sync"
                            autoComplete="off"
                            maxLength={40}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </div>
                        <fieldset ref={eventSet} className={styles.eventSet} aria-describedby={errors.events ? `${uid}-event-error` : undefined}>
                          <legend>Events to send</legend>
                          <div className={styles.eventGrid}>
                            {EVENT_CATALOG.map((item) => (
                              <Checkbox
                                key={item.id}
                                label={item.id}
                                description={item.description}
                                checked={events.includes(item.id)}
                                onCheckedChange={(checked) => toggleEvent(item.id, checked === true)}
                              />
                            ))}
                          </div>
                          <AnimatePresence initial={false}>
                            {errors.events && (
                              <motion.p
                                key="error"
                                id={`${uid}-event-error`}
                                className={styles.fieldError}
                                role="alert"
                                initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={reduced ? { opacity: 0, transition: ZERO } : { height: 0, opacity: 0 }}
                                transition={reduced ? ZERO : T.spring.smooth}
                              >
                                <span>{errors.events}</span>
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </fieldset>
                        <div className={styles.actions}>
                          <span className={styles.hint}>
                            <Swap text={events.length === 1 ? "1 event selected" : `${events.length} events selected`} reduced={reduced} />
                          </span>
                          <Button type="button" variant="ghost" onClick={close}>
                            Cancel
                          </Button>
                          <Button type="submit" loading={adding}>
                            {adding ? "Adding" : "Add endpoint"}
                          </Button>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="reveal"
                        ref={revealPanel}
                        className={styles.reveal}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={reduced ? ZERO : { duration: T.duration.standard + 0.08, ease: EASE_ENTER, delay: 0.06 }}
                      >
                        <div className={styles.secretBlock}>
                          <span id={`${uid}-secret-label`} className={styles.fieldLabel}>
                            Signing secret
                          </span>
                          <div className={styles.secretField} role="group" aria-labelledby={`${uid}-secret-label`}>
                            <motion.code
                              className={styles.secret}
                              initial={reduced ? undefined : { opacity: 0, filter: `blur(${T.blur.text}px)` }}
                              animate={{ opacity: 1, filter: "blur(0px)" }}
                              transition={{ duration: T.duration.considered, ease: EASE_ENTER, delay: 0.14 }}
                            >
                              {secret}
                            </motion.code>
                            <CopyButton value={secret} label="Copy" onCopied={() => setLive("Signing secret copied. Store it with your other server secrets.")} />
                          </div>
                        </div>
                        <p className={styles.once}>
                          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                          <span>Shown once. Use it to check the Halden-Signature header on every request. You can roll it later, but you cannot view it again.</span>
                        </p>
                        <div className={styles.actions}>
                          <Button type="button" onClick={close}>
                            Done
                          </Button>
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
      <div className={styles.endpoints} role="list" aria-label="Endpoints" onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => navigate(event, "data-endpoint", select)}>
        <AnimatePresence initial={false}>
          {endpoints.map((endpoint) => (
            <EndpointRow
              key={endpoint.id}
              endpoint={endpoint}
              selected={endpoint.id === selected.id}
              selectedId={selected.id}
              fresh={freshEndpoint === endpoint.id}
              reduced={reduced}
              detailId={detailId}
              onSelect={() => select(endpoint.id)}
            />
          ))}
        </AnimatePresence>
      </div>
      <div id={detailId} className={styles.detail} role="region" aria-labelledby={`${uid}-detail-title`}>
        <div className={styles.detailHead}>
          <div className={styles.detailTitle}>
            <h3 id={`${uid}-detail-title`}>
              <Swap text={selected.name} reduced={reduced} />
            </h3>
            <div className={styles.detailMeta}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={selected.id}
                  initial={reduced ? { opacity: 0 } : SWAP_IN}
                  animate={SHOWN}
                  exit={reduced ? { opacity: 0, transition: ZERO } : SWAP_OUT}
                  transition={reduced ? ZERO : { duration: T.duration.standard, ease: EASE_ENTER }}
                >
                  <span className={styles.metaItem}>
                    <span className={styles.dot} aria-hidden="true" />
                    <Avatar className={styles.metaAvatar} name={selected.addedBy.name} src={selected.addedBy.photo} size="sm" aria-hidden="true" />
                    <span>
                      Added by {selected.addedBy.name} on {selected.added}
                    </span>
                  </span>
                  <span className={styles.metaItem}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span className={styles.mono}>whsec_••••{selected.secretTail}</span>
                  </span>
                  <span className={styles.metaItem}>
                    <span className={styles.dot} aria-hidden="true" />
                    <span>API {selected.version}</span>
                  </span>
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <Chart endpoint={selected} reduced={reduced} />
        <div ref={outer} className={styles.follow}>
          <div ref={inner} className={styles.followInner}>
            <AnimatePresence initial={false}>
              <motion.div
                key={selected.id}
                className={styles.split}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${T.blur.subtle}px)` }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, pointerEvents: "none", transition: reduced ? ZERO : { duration: T.duration.instant } }}
                transition={reduced ? ZERO : { duration: T.duration.standard, ease: EASE_ENTER, delay: 0.04 }}
              >
                <div className={styles.deliveries}>
                  <h4 className={styles.sectionLabel}>Recent deliveries</h4>
                  <div
                    role="list"
                    aria-label={`Recent deliveries to ${selected.name}`}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => navigate(event, "data-delivery", (id) => setSelectedDelivery((map) => ({ ...map, [selected.id]: id })))}
                  >
                    <AnimatePresence initial={false}>
                      {selected.deliveries.map((item) => (
                        <DeliveryRow
                          key={item.id}
                          delivery={item}
                          endpointId={selected.id}
                          selected={item.id === selectedKey}
                          selectedKey={selectedKey ?? ""}
                          fresh={freshRows.includes(item.id)}
                          sending={sending.includes(item.id)}
                          reduced={reduced}
                          inspectorId={inspectorId}
                          onSelect={() => setSelectedDelivery((map) => ({ ...map, [selected.id]: item.id }))}
                          onRetry={() => retry(selected, item)}
                          buttonRef={(node) => {
                            if (node) deliveryButtons.current.set(item.id, node);
                            else deliveryButtons.current.delete(item.id);
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence initial={false}>
                    {selected.deliveries.length === 0 && (
                      <motion.div key="empty" className={styles.emptyWrap} {...rowMotion(reduced)}>
                        <div className={styles.empty}>
                          <p>No deliveries yet</p>
                          <span>
                            Send a test event to check that {hostOf(selected.url)} answers with a 2xx status.
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={testing === selected.id}
                            onClick={() => {
                              if (testing) return;
                              setTesting(selected.id);
                              setLive(`Sending a test ${selected.events[0]} event to ${hostOf(selected.url)}.`);
                              later(() => {
                                const seq = ++retrySeq.current;
                                const time = clockTime(seq);
                                const name = selected.events[0];
                                const created: WebhookDelivery = {
                                  id: `dlv_${randomString(`${selected.id}:test:${seq}`, 7)}`,
                                  eventId: `evt_${randomString(`${selected.id}:evt:${seq}`, 10)}`,
                                  event: name,
                                  status: 200,
                                  latency: 172,
                                  time,
                                  eventTime: time,
                                  attempt: 1,
                                  response: '{"received":true}',
                                  data: SAMPLE_PAYLOADS[name],
                                  test: true,
                                };
                                setEndpoints((list) =>
                                  list.map((endpoint) =>
                                    endpoint.id !== selected.id
                                      ? endpoint
                                      : { ...endpoint, volume: endpoint.volume.map((value, slot) => (slot === 47 ? value + 1 : value)), deliveries: [created, ...endpoint.deliveries] },
                                  ),
                                );
                                setSelectedDelivery((map) => ({ ...map, [selected.id]: created.id }));
                                setTesting(null);
                                flash(created.id);
                                setLive(`Test event delivered. ${hostOf(selected.url)} answered 200 in 172 ms.`);
                                focusDelivery(created.id);
                              }, 900);
                            }}
                          >
                            {testing === selected.id ? "Sending" : "Send test event"}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Inspector endpoint={selected} delivery={delivery} tab={tab} reduced={reduced} id={inspectorId} onTab={setTab} onCopied={(what) => setLive(`${what} copied`)} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <footer className={styles.srOnly}>
        <p role="status" aria-live="polite">
          {live}
        </p>
      </footer>
    </section>
  );
}

export default Webhooks;

/* Re-exported so tests can read the delivery clock without rendering. */
export { clockTime as deliveryClock, hostOf as endpointHost };
