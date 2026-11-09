"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps, type TargetAndTransition, type Transition } from "motion/react";
import { CheckCircle, CircleAlert, Download, KeyRound, Smartphone } from "lucide-react";
import { Button } from "../button/button";
import { Checkbox } from "../checkbox/checkbox";
import { CopyButton } from "../copy-button/copy-button";
import styles from "./two-factor-setup.module.css";

export type TwoFactorSetupStep = "scan" | "verify" | "backup" | "enabled";

export interface TwoFactorSetupProps {
  /** Product name shown in the copy, the authenticator entry and the otpauth URI. */
  issuer?: string;
  /** Mark drawn in the simulated authenticator row; `null` hides it. Defaults to the Northwind mark. */
  issuerLogo?: ReactNode;
  /** Account the second factor belongs to. */
  account?: string;
  /** Base32 shared secret; the setup key and the QR both come from it. */
  secret?: string;
  /** Codes listed in step three, one per line in the download file. */
  backupCodes?: string[];
  /** Real check for a typed code. When omitted the block verifies against the secret itself and says it is simulated. */
  verifyCode?: (code: string, signal: AbortSignal) => Promise<boolean>;
  /** Real enrolment call. When omitted the block waits, then reports the simulated success. */
  onEnable?: (signal: AbortSignal) => void | Promise<void>;
  /** Shows a Cancel button in the first step. */
  onCancel?: () => void;
  /** Replaces the last step's restart with your own finish action. */
  onDone?: () => void;
  /** Fires after every step change, including the restart back to scan. */
  onStepChange?: (step: TwoFactorSetupStep) => void;
  /** Date line for the authenticator row in the done summary. */
  addedLabel?: string;
  className?: string;
}

const STEP_ORDER: TwoFactorSetupStep[] = ["scan", "verify", "backup", "enabled"];

const DEFAULT_BACKUP_CODES = [
  "h4k7-2pmx",
  "9wqe-7r3d",
  "t2vn-8kfa",
  "m6xc-4jhb",
  "3rpz-q9we",
  "ky8d-5tmn",
  "a7fs-2xvq",
  "e5nh-6wc8",
];

/** The site's standard ease, so the swap and the panel travel match every other block. */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SWAP_IN: Transition = { duration: 0.16, ease: EASE };
const SWAP_OUT: Transition = { duration: 0.1, ease: EASE };
const INSTANT: Transition = { duration: 0 };

/** A cancellable pause: every await in the block goes through it so an abort unwinds the sequence. */
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/* ── QR ───────────────────────────────────────────────────────────────────────────────────────
   The shipped block encodes the otpauth URI itself instead of shipping an image: one <path> for
   the data modules and three rounded eyes. The tables and the mask search below are the encoder
   it uses, kept byte-for-byte so the rendered path is identical for the same value. */

type EccLevel = "L" | "M" | "Q" | "H";

const ECC_INDEX: Record<EccLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** Error-correction format bits, in the order the spec writes them (L, M, Q, H). */
const FORMAT_INDEX = [1, 0, 3, 2];
/** EC codewords per block, by level then version (index 0 is unused). */
const ECC_PER_BLOCK: number[][] = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
];
/** RS blocks per version, by level then version. */
const BLOCK_COUNT: number[][] = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21,
    22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37,
    38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48,
    51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57,
    60, 63, 66, 70, 74, 77, 81,
  ],
];

/** Raw module count for a version, before the EC codewords are taken out. */
const moduleBits = (version: number) => {
  let total = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    total -= (25 * align - 10) * align - 55;
    if (version >= 7) total -= 36;
  }
  return total;
};

/** Data codewords available for a version and level. */
const dataCodewords = (version: number, level: number) =>
  Math.floor(moduleBits(version) / 8) - ECC_PER_BLOCK[level][version] * BLOCK_COUNT[level][version];

/** GF(256) multiply, reduction polynomial 0x11d. */
function gfMul(a: number, b: number) {
  let out = 0;
  for (let bit = 7; bit >= 0; bit -= 1) out = (out << 1) ^ ((out >>> 7) * 285) ^ (((b >>> bit) & 1) * a);
  return out;
}

interface QrMatrix {
  size: number;
  path: string;
  eyes: [number, number][];
}

function encodeQr(value: string, level: EccLevel = "M"): QrMatrix {
  const ecl = ECC_INDEX[level];
  const bytes = Array.from(new TextEncoder().encode(value));
  let version = 1;
  while (version <= 40 && !(4 + (version < 10 ? 8 : 16) + 8 * bytes.length <= 8 * dataCodewords(version, ecl))) version += 1;
  if (version > 40) throw new RangeError("QR value is too long");

  const bits: number[] = [];
  const push = (value: number, count: number) => {
    for (let bit = count - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
  };
  const capacity = 8 * dataCodewords(version, ecl);
  push(4, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => push(byte, 8));
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 236; bits.length < capacity; pad ^= 253) push(pad, 8);

  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) codewords.push(bits.slice(index, index + 8).reduce((acc, bit) => (acc << 1) | bit, 0));

  const blocks = BLOCK_COUNT[ecl][version];
  const eccLength = ECC_PER_BLOCK[ecl][version];
  const total = Math.floor(moduleBits(version) / 8);
  const shortBlocks = blocks - (total % blocks);
  const perBlock = Math.floor(total / blocks);

  const generator = (() => {
    const poly = Array<number>(eccLength).fill(0);
    poly[eccLength - 1] = 1;
    let root = 1;
    for (let step = 0; step < eccLength; step += 1) {
      for (let index = 0; index < eccLength; index += 1) {
        poly[index] = gfMul(poly[index], root);
        if (index + 1 < eccLength) poly[index] ^= poly[index + 1];
      }
      root = gfMul(root, 2);
    }
    return poly;
  })();

  const rsRemainder = (data: number[], divisor: number[]) => {
    const out = divisor.map(() => 0);
    for (const byte of data) {
      const factor = byte ^ (out.shift() ?? 0);
      out.push(0);
      divisor.forEach((coefficient, index) => {
        out[index] ^= gfMul(coefficient, factor);
      });
    }
    return out;
  };

  const parts: number[][] = [];
  for (let block = 0, cursor = 0; block < blocks; block += 1) {
    const data = codewords.slice(cursor, cursor + perBlock - eccLength + (block < shortBlocks ? 0 : 1));
    cursor += data.length;
    const ecc = rsRemainder(data, generator);
    if (block < shortBlocks) data.push(0);
    parts.push(data.concat(ecc));
  }

  const stream: number[] = [];
  for (let index = 0; index < parts[0].length; index += 1)
    parts.forEach((part, block) => {
      if (index !== perBlock - eccLength || block >= shortBlocks) stream.push(part[index]);
    });

  const size = 4 * version + 17;
  const dark = new Uint8Array(size * size);
  const reserved = new Uint8Array(size * size);
  const finder = new Uint8Array(size * size);
  const put = (x: number, y: number, on: boolean) => {
    dark[y * size + x] = on ? 1 : 0;
    reserved[y * size + x] = 1;
  };

  for (let index = 0; index < size; index += 1) {
    put(6, index, index % 2 === 0);
    put(index, 6, index % 2 === 0);
  }

  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        put(x, y, ring !== 2 && ring !== 4);
        if (ring <= 3) finder[y * size + x] = 1;
      }
  }

  if (version > 1) {
    const count = Math.floor(version / 7) + 2;
    const pitch = 2 * Math.floor((8 * version + 3 * count + 5) / (4 * count - 4));
    const lines = [6];
    for (let next = size - 7; lines.length < count; next -= pitch) lines.splice(1, 0, next);
    lines.forEach((y, row) =>
      lines.forEach((x, column) => {
        if ((row === 0 && column === 0) || (row === 0 && column === count - 1) || (row === count - 1 && column === 0)) return;
        for (let dy = -2; dy <= 2; dy += 1)
          for (let dx = -2; dx <= 2; dx += 1) put(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
  }

  const writeFormat = (mask: number) => {
    const value = (FORMAT_INDEX[ecl] << 3) | mask;
    let remainder = value;
    for (let step = 0; step < 10; step += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 1335);
    const bits = ((value << 10) | remainder) ^ 21522;
    const bit = (index: number) => ((bits >>> index) & 1) === 1;
    for (let index = 0; index <= 5; index += 1) put(8, index, bit(index));
    put(8, 7, bit(6));
    put(8, 8, bit(7));
    put(7, 8, bit(8));
    for (let index = 9; index < 15; index += 1) put(14 - index, 8, bit(index));
    for (let index = 0; index < 8; index += 1) put(size - 1 - index, 8, bit(index));
    for (let index = 8; index < 15; index += 1) put(8, size - 15 + index, bit(index));
    put(8, size - 8, true);
  };

  writeFormat(0);
  if (version >= 7) {
    let remainder = version;
    for (let step = 0; step < 12; step += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 7973);
    const bits = (version << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const on = ((bits >>> index) & 1) === 1;
      const x = size - 11 + (index % 3);
      const y = Math.floor(index / 3);
      put(x, y, on);
      put(y, x, on);
    }
  }

  for (let right = size - 1, index = 0; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let row = 0; row < size; row += 1)
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        const y = ((right + 1) & 2) === 0 ? size - 1 - row : row;
        if (reserved[y * size + x] || index >= 8 * stream.length) continue;
        dark[y * size + x] = (stream[index >>> 3] >>> (7 - (index & 7))) & 1;
        index += 1;
      }
  }

  const maskAt = (mask: number, x: number, y: number) => {
    switch (mask) {
      case 0:
        return (x + y) % 2 === 0;
      case 1:
        return y % 2 === 0;
      case 2:
        return x % 3 === 0;
      case 3:
        return (x + y) % 3 === 0;
      case 4:
        return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5:
        return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6:
        return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default:
        return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  };

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1) if (!reserved[y * size + x] && maskAt(mask, x, y)) dark[y * size + x] ^= 1;
  };

  const penalty = () => {
    let score = 0;
    let darkCount = 0;
    const at = (x: number, y: number) => dark[y * size + x];
    for (let direction = 0; direction < 2; direction += 1)
      for (let line = 0; line < size; line += 1) {
        let run = 1;
        for (let step = 1; step <= size; step += 1) {
          if (step < size && (direction ? at(line, step) === at(line, step - 1) : at(step, line) === at(step - 1, line))) {
            run += 1;
            continue;
          }
          if (run >= 5) score += run - 2;
          run = 1;
        }
        for (let start = 0; start + 11 <= size; start += 1) {
          let window = 0;
          for (let offset = 0; offset < 11; offset += 1) window = (window << 1) | (direction ? at(line, start + offset) : at(start + offset, line));
          if (window === 1488 || window === 93) score += 40;
        }
      }
    for (let y = 0; y + 1 < size; y += 1)
      for (let x = 0; x + 1 < size; x += 1) {
        const cell = at(x, y);
        if (cell === at(x + 1, y) && cell === at(x, y + 1) && cell === at(x + 1, y + 1)) score += 3;
      }
    for (let index = 0; index < dark.length; index += 1) darkCount += dark[index];
    return score + 10 * Math.max(0, Math.ceil(Math.abs(20 * darkCount - 10 * dark.length) / dark.length) - 1);
  };

  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    writeFormat(mask);
    const score = penalty();
    if (score < bestScore) {
      bestMask = mask;
      bestScore = score;
    }
    applyMask(mask);
  }
  applyMask(bestMask);
  writeFormat(bestMask);

  let path = "";
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      if (!dark[index] || finder[index]) continue;
      let run = 1;
      while (x + run < size && dark[index + run] && !finder[index + run]) run += 1;
      path += `M${x} ${y}h${run}v1h${-run}z`;
      x += run - 1;
    }

  return {
    size,
    path,
    eyes: [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ],
  };
}

function QrCode({ value, label }: { value: string; label: string }) {
  const matrix = useMemo(() => encodeQr(value, "M"), [value]);
  return (
    <svg className={styles.qrSvg} viewBox={`0 0 ${matrix.size} ${matrix.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={matrix.path} fill="currentColor" />
      {matrix.eyes.map(([x, y]) => (
        <g key={`${x}-${y}`} shapeRendering="geometricPrecision">
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.7} fill="none" stroke="currentColor" strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/* ── TOTP ─────────────────────────────────────────────────────────────────────────────────────
   The simulated app and the fallback check both read the real clock: HMAC-SHA1 over the 30 s
   counter, dynamic truncation, six digits. Nothing leaves the page. */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(secret: string) {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function totp(secret: string, offset = 0, now = Date.now()) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const key = await subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = Math.floor(now / 1e3 / 30) + offset;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const digest = new Uint8Array(await subtle.sign("HMAC", key, buffer));
  const at = 15 & digest[digest.length - 1];
  const value = ((127 & digest[at]) << 24) | (digest[at + 1] << 16) | (digest[at + 2] << 8) | digest[at + 3];
  return String(value % 1e6).padStart(6, "0");
}

/** Accepts the previous, current and next window so a code typed across a rollover still passes. */
async function matchesTotp(secret: string, code: string) {
  const codes = await Promise.all([-1, 0, 1].map((offset) => totp(secret, offset)));
  if (codes[0] === null) return /^\d{6}$/.test(code) && code !== "000000";
  return codes.includes(code);
}

/* ── icons ───────────────────────────────────────────────────────────────────────────────── */

function GoogleGlyph({ size = 16 }: { size?: number }) {
  const segments: [number, string][] = [
    [-90, "#EA4335"],
    [-30, "#4285F4"],
    [30, "#4285F4"],
    [90, "#34A853"],
    [150, "#FBBC04"],
    [210, "#EA4335"],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {segments.map(([angle, color]) => (
        <line
          key={angle}
          x1="12"
          y1="12"
          x2={12 + 8.6 * Math.cos((angle * Math.PI) / 180)}
          y2={12 + 8.6 * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="4.4"
          strokeLinecap="round"
        />
      ))}
      <circle cx="12" cy="12" r="2.6" fill="#4285F4" />
    </svg>
  );
}

function OnePasswordGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 0c6.627 0 12 5.373 12 12 0 6.628-5.373 12-12 12S0 18.628 0 12C0 5.373 5.373 0 12 0m-.893 4.86c-.485 0-.727.001-.913.095a.87.87 0 0 0-.378.379c-.094.185-.095.428-.095.912v2.747c0 .12 0 .182.016.238q.02.075.065.138a1 1 0 0 0 .175.162l.695.564c.113.092.17.139.19.194a.22.22 0 0 1 0 .15c-.02.056-.077.102-.19.194l-.695.564a1 1 0 0 0-.175.162.4.4 0 0 0-.065.138 1 1 0 0 0-.016.238v6.019c0 .485 0 .728.095.913a.87.87 0 0 0 .378.378c.186.094.428.094.913.094h1.786c.485 0 .727 0 .913-.094a.87.87 0 0 0 .378-.378c.095-.185.095-.428.095-.913v-2.747c0-.12 0-.182-.016-.238a.4.4 0 0 0-.065-.138 1 1 0 0 0-.175-.162l-.695-.564c-.113-.092-.17-.138-.191-.193a.22.22 0 0 1 0-.152c.02-.055.078-.1.19-.193l.696-.564a1 1 0 0 0 .175-.162.4.4 0 0 0 .065-.138 1 1 0 0 0 .016-.238V6.246c0-.484 0-.727-.095-.912a.87.87 0 0 0-.378-.379c-.186-.094-.428-.094-.913-.094Z"
        fill="#145FE4"
      />
    </svg>
  );
}

function NorthwindMark() {
  const raw = useId();
  const id = raw.replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="Northwind">
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

/* ── pieces ──────────────────────────────────────────────────────────────────────────────── */

/** Crossfade for a one-line label; the wrapper keeps its box so nothing around it shifts. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: reduced ? INSTANT : SWAP_OUT }}
          transition={reduced ? INSTANT : SWAP_IN}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The 30 s window: a stroked ring that drains while it runs, and a plain arc when it is paused. */
function WindowRing({ seconds, delay, reduced }: { seconds: number | null; delay?: string; reduced: boolean }) {
  return (
    <svg className={styles.ring} data-low={(seconds !== null && seconds <= 5) || undefined} width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" className={styles.ringTrack} />
      <circle
        cx="8"
        cy="8"
        r="6.25"
        pathLength={1}
        className={styles.ringFill}
        style={reduced || !delay ? { strokeDashoffset: seconds === null ? 0 : 1 - seconds / 30 } : { animationDelay: delay }}
        data-running={!reduced && delay ? "" : undefined}
      />
    </svg>
  );
}

const offPanel: TargetAndTransition = { opacity: 0, transitionEnd: { visibility: "hidden" } };

/**
 * Two-factor authentication, in four steps that share one grid cell: scan the QR, confirm a code,
 * save the backup codes, done. Every step is mounted, so a move is a crossfade and a 12px slide
 * rather than a layout change, and the ones you cannot see are `inert`.
 */
export function TwoFactorSetup({
  issuer = "Northwind",
  issuerLogo = issuer === "Northwind" ? <NorthwindMark /> : null,
  account = "maya@northwind.io",
  secret = "QK7MR2XD5LVNA3WE",
  backupCodes = DEFAULT_BACKUP_CODES,
  verifyCode,
  onEnable,
  onCancel,
  onDone,
  onStepChange,
  addedLabel = "Added Oct 27, 2026",
  className,
}: TwoFactorSetupProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const simulated = !verifyCode;

  const rootRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<(HTMLInputElement | null)[]>([]);
  const controller = useRef<AbortController | null>(null);
  /** True once the visitor has moved the block themselves; only then does verify grab focus. */
  const interacted = useRef(false);

  const [step, setStep] = useState<TwoFactorSetupStep>("scan");
  const [digits, setDigits] = useState<string[]>(() => Array<string>(6).fill(""));
  const [activeSlot, setActiveSlot] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [status, setStatus] = useState("");
  const [seconds, setSeconds] = useState<number | null>(null);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [ringDelay, setRingDelay] = useState<string | undefined>(undefined);
  const [inView, setInView] = useState(true);

  const cleanSecret = secret.replace(/\s/g, "").toUpperCase();
  const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  const stepIndex = STEP_ORDER.indexOf(step);
  const code = digits.join("");
  const complete = code.length === 6;

  const goTo = useCallback(
    (next: TwoFactorSetupStep) => {
      interacted.current = true;
      setStep(next);
      onStepChange?.(next);
    },
    [onStepChange],
  );

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The clock only runs while the verify step is on screen, and it ticks on the second so the
  // ring and the countdown stay in step with the window they describe.
  useEffect(() => {
    if (step !== "verify" || !inView) return;
    let cancelled = false;
    let lastWindow = -1;
    let started = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const now = Date.now();
      if (!started) {
        started = true;
        setRingDelay(`-${((now / 1e3) % 30).toFixed(3)}s`);
      }
      setSeconds(30 - (Math.floor(now / 1e3) % 30));
      const window = Math.floor(now / 1e3 / 30);
      if (simulated && window !== lastWindow) {
        lastWindow = window;
        void totp(cleanSecret, 0, now).then((next) => {
          if (!cancelled) setSimulatedCode(next ?? "284019");
        });
      }
    };
    tick();
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 1000);
    }, 1e3 - (Date.now() % 1e3) + 10);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [step, inView, simulated, cleanSecret]);

  useEffect(() => {
    if (step !== "verify" || !interacted.current) return;
    const timer = setTimeout(() => slotRefs.current[Math.max(0, digits.findIndex((digit) => !digit))]?.focus({ preventScroll: true }), 60 * (reduced ? 0 : 1));
    return () => clearTimeout(timer);
    // Focus is owed once per arrival on the step, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const focusSlot = (index: number) => slotRefs.current[Math.max(0, Math.min(5, index))]?.focus({ preventScroll: true });

  const submit = useCallback(
    async (value: string) => {
      if (verifying || value.length !== 6) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setVerifying(true);
      setError(null);
      setStatus("Checking the code");
      try {
        const ok = verifyCode ? await verifyCode(value, current.signal) : (await Promise.all([matchesTotp(cleanSecret, value), wait(520, current.signal)]))[0];
        if (current.signal.aborted) return;
        if (!ok) {
          setError("That code did not match. Try the newest one.");
          setStatus("That code did not match");
          focusSlot(5);
          return;
        }
        setVerified(true);
        setStatus(simulated ? "Code verified. Simulated, nothing was sent." : "Code verified");
        await wait(260 * (reduced ? 0 : 1), current.signal);
        goTo("backup");
      } catch (caught) {
        if (isAbort(caught)) return;
        setError("We could not check the code. Try again.");
        setStatus("We could not check the code");
      } finally {
        if (controller.current === current) setVerifying(false);
      }
    },
    [verifying, verifyCode, cleanSecret, simulated, reduced, goTo],
  );

  const insert = (start: number, chars: string) => {
    if (verifying || verified) return;
    const next = [...digits];
    let cursor = start;
    for (const char of chars) {
      if (cursor >= 6) break;
      next[cursor] = char;
      cursor += 1;
    }
    setDigits(next);
    setError(null);
    const joined = next.join("");
    if (joined.length === 6) {
      slotRefs.current[5]?.focus({ preventScroll: true });
      void submit(joined);
      return;
    }
    const from = Math.min(cursor, 5);
    const empty = next.findIndex((digit, index) => index >= from && !digit);
    focusSlot(empty === -1 ? from : empty);
  };

  const clearSlot = (index: number) => {
    const next = [...digits];
    next[index] = "";
    setDigits(next);
    setError(null);
  };

  const enable = async () => {
    if (!saved || enabling) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setEnabling(true);
    setEnableError(null);
    try {
      if (onEnable) await onEnable(current.signal);
      else await wait(560, current.signal);
      if (current.signal.aborted) return;
      setStatus(onEnable ? "Two-factor authentication is on" : "Two-factor authentication is on. Simulated, nothing was saved.");
      goTo("enabled");
    } catch (caught) {
      if (isAbort(caught)) return;
      setEnableError("Could not turn on two-factor. Try again.");
      setStatus("Could not turn on two-factor");
    } finally {
      if (controller.current === current) setEnabling(false);
    }
  };

  const backupText = `${issuer} backup codes\n${account}\n\n${backupCodes.join("\n")}\n\nEach code works once. Keep them somewhere safe.\n`;

  useEffect(() => {
    if (!downloaded) return;
    const timer = setTimeout(() => setDownloaded(false), 1800);
    return () => clearTimeout(timer);
  }, [downloaded]);

  const primary =
    step === "scan"
      ? { label: "Continue", disabled: false, loading: false }
      : step === "verify"
        ? { label: "Verify", disabled: !complete || verified, loading: verifying || verified }
        : step === "backup"
          ? { label: "Turn on", disabled: !saved, loading: enabling }
          : { label: "Done", disabled: false, loading: false };

  const aside = step === "verify" ? { key: "back", label: "Back" } : step === "scan" && onCancel ? { key: "cancel", label: "Cancel" } : null;

  const panel = (index: number): HTMLMotionProps<"div"> => {
    const on = index === stepIndex;
    return {
      initial: false,
      animate: on ? { opacity: 1, x: 0, visibility: "visible" } : { ...offPanel, x: reduced ? 0 : index > stepIndex ? 12 : -12 },
      transition: reduced
        ? { duration: 0.12 }
        : on
          ? {
              opacity: { duration: 0.2, ease: EASE, delay: 0.06 },
              x: { type: "spring", visualDuration: 0.24, bounce: 0, delay: 0.06 },
            }
          : { duration: 0.1, ease: EASE },
      inert: !on,
      "aria-hidden": !on || undefined,
    };
  };

  const titleId = `${uid}-title`;
  const verifyId = `${uid}-verify`;
  const messageId = `${uid}-message`;
  const filled = Math.min(stepIndex + 1, 3);
  const label = step === "enabled" ? "on" : `${stepIndex + 1}`;

  const entryBody = (
    <>
      <span className={styles.entryWho}>
        {issuerLogo ? (
          <span className={styles.entryLogo} aria-hidden="true">
            {issuerLogo}
          </span>
        ) : null}
        <span className={styles.entryText}>
          <span className={styles.entryName}>{issuer}</span>
          <span className={styles.meta}>{account}</span>
        </span>
      </span>
      {simulated ? <span className={styles.entryCode}>{simulatedCode ? `${simulatedCode.slice(0, 3)} ${simulatedCode.slice(3)}` : "--- ---"}</span> : null}
      <span className={styles.entryTimer}>
        <WindowRing seconds={seconds} delay={ringDelay} reduced={reduced} />
        <span className={styles.seconds}>{seconds ?? 30}s</span>
      </span>
    </>
  );

  const onChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, "");
    if (!raw) {
      clearSlot(index);
      return;
    }
    const previous = digits[index];
    const value = raw.length === 2 && previous ? (raw[0] === previous ? raw[1] : raw[0]) : raw;
    insert(raw.length >= 6 ? 0 : index, value);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        if (verifying || verified) return;
        if (digits[index]) clearSlot(index);
        else if (index > 0) {
          clearSlot(index - 1);
          focusSlot(index - 1);
        }
        return;
      case "Delete":
        event.preventDefault();
        if (!verifying && !verified) clearSlot(index);
        return;
      case "ArrowLeft":
        event.preventDefault();
        focusSlot(index - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        focusSlot(index + 1);
        return;
      case "Home":
        event.preventDefault();
        focusSlot(0);
        return;
      case "End":
        event.preventDefault();
        focusSlot(5);
        return;
      case "Enter":
        event.preventDefault();
        if (complete) void submit(code);
        return;
      default:
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    insert(pasted.length >= 6 ? 0 : index, pasted.slice(0, 6));
    setStatus(pasted.length >= 6 ? "Code pasted" : "");
  };

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={titleId} data-step={step}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h2 id={titleId} className={styles.title}>
            Two-factor authentication
          </h2>
          <Swap id={label} reduced={reduced} className={styles.stepLabel}>
            {step === "enabled" ? (
              <span className={styles.onLabel}>
                <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
                On
              </span>
            ) : (
              <span>
                Step <span className={styles.num}>{stepIndex + 1}</span> of <span className={styles.num}>3</span>
              </span>
            )}
          </Swap>
        </div>
        <div className={styles.progress} aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className={styles.segment}>
              <span className={styles.segmentFill} data-on={index < filled || undefined} data-done={step === "enabled" || undefined} />
            </span>
          ))}
        </div>
      </header>

      <div className={styles.stage}>
        <motion.div className={styles.panel} {...panel(0)}>
          <div className={styles.scan}>
            <div className={styles.qr}>
              <QrCode value={otpauth} label={`QR code that adds ${issuer} for ${account} to an authenticator app`} />
            </div>
            <div className={styles.scanText}>
              <h3 className={styles.stepTitle}>Scan the QR code</h3>
              <p className={styles.muted}>
                Open your authenticator app and scan this code to add {issuer}.
              </p>
            </div>
            <div className={styles.works}>
              <span className={styles.worksItem}>
                <GoogleGlyph size={16} />
                Google Authenticator
              </span>
              <span className={styles.worksItem}>
                <OnePasswordGlyph size={16} />
                1Password
              </span>
            </div>
            <div className={styles.keyBlock}>
              <span className={styles.meta} id={`${uid}-key`}>
                Can&apos;t scan it? Enter this key
              </span>
              <div className={styles.keyField}>
                <code className={styles.key} aria-labelledby={`${uid}-key`}>
                  {cleanSecret.match(/.{1,4}/g)?.join(" ") ?? cleanSecret}
                </code>
                <CopyButton value={cleanSecret} label="Copy setup key" iconOnly variant="plain" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className={styles.panel} {...panel(1)}>
          <div className={styles.stack}>
            <div>
              <h3 id={verifyId} className={styles.stepTitle}>
                Enter the 6-digit code
              </h3>
              <p className={styles.muted}>
                Type the code your app shows for {issuer}. It changes every 30 seconds.
              </p>
            </div>
            {simulated ? (
              <button
                type="button"
                className={[styles.entry, styles.entryButton].join(" ")}
                onClick={() => {
                  if (!simulatedCode || verifying || verified) return;
                  setStatus("Filled from the simulated authenticator");
                  insert(0, simulatedCode);
                }}
                disabled={!simulatedCode || verifying || verified}
                aria-label={`Simulated authenticator: fill in the current code for ${issuer}`}
              >
                {entryBody}
              </button>
            ) : (
              <div className={styles.entry}>{entryBody}</div>
            )}
            <div
              className={styles.otp}
              role="group"
              aria-labelledby={verifyId}
              aria-describedby={messageId}
              data-error={error ? "" : undefined}
              data-verified={verified || undefined}
            >
              {digits.map((digit, index) => (
                <Fragment key={index}>
                  {index === 3 ? <span className={styles.dash} aria-hidden="true" /> : null}
                  <div className={styles.slot} data-active={activeSlot === index || undefined} data-filled={digit ? "" : undefined}>
                    <input
                      ref={(node) => {
                        slotRefs.current[index] = node;
                      }}
                      className={styles.slotInput}
                      value={digit}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${index + 1} of 6`}
                      aria-invalid={error ? true : undefined}
                      readOnly={verifying || verified}
                      onChange={(event) => onChange(index, event)}
                      onKeyDown={(event) => onKeyDown(index, event)}
                      onPaste={(event) => onPaste(index, event)}
                      onFocus={(event) => {
                        setActiveSlot(index);
                        event.currentTarget.select();
                      }}
                      onBlur={() => setActiveSlot((current) => (current === index ? -1 : current))}
                    />
                    <span className={styles.glyph} aria-hidden="true">
                      <AnimatePresence initial={false}>
                        {digit ? (
                          <motion.span
                            key={digit}
                            className={styles.glyphInner}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: reduced ? INSTANT : SWAP_OUT }}
                            transition={reduced ? INSTANT : SWAP_IN}
                          >
                            {digit}
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                      {!digit && activeSlot === index && !verifying ? <span className={styles.caret} /> : null}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className={styles.message} id={messageId}>
              <Swap id={error ? `e:${error}` : verified ? "ok" : "hint"} reduced={reduced} className={styles.messageSwap}>
                {error ? (
                  <span className={styles.errorText} role="alert">
                    <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.truncate}>{error}</span>
                  </span>
                ) : verified ? (
                  <span className={styles.okText}>
                    <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
                    <span className={styles.truncate}>Code verified</span>
                  </span>
                ) : (
                  <span className={styles.hintText}>
                    <span className={styles.truncate}>
                      {simulated ? "Simulated app. Click the code above to fill it in." : "Paste or type the code."}
                    </span>
                  </span>
                )}
              </Swap>
            </div>
          </div>
        </motion.div>

        <motion.div className={styles.panel} {...panel(2)}>
          <div className={styles.stack}>
            <div>
              <h3 className={styles.stepTitle}>Save your backup codes</h3>
              <p className={styles.muted}>Each code works once. Use one to sign in if you lose your phone.</p>
            </div>
            <ol className={styles.codes} aria-label="Backup codes">
              {backupCodes.map((backup) => (
                <li key={backup} className={styles.code}>
                  {backup}
                </li>
              ))}
            </ol>
            <div className={styles.backupFoot}>
              <div className={styles.check}>
                <Checkbox
                  label="I saved my backup codes"
                  checked={saved}
                  onCheckedChange={(next) => {
                    setSaved(next === true);
                    setEnableError(null);
                  }}
                />
              </div>
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([backupText], { type: "text/plain" }));
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${issuer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-backup-codes.txt`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1e3);
                    setDownloaded(true);
                    setStatus("Backup codes downloaded");
                  }}
                >
                  {downloaded ? (
                    <>
                      <CheckCircle size={16} strokeWidth={2} aria-hidden="true" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                      Download
                    </>
                  )}
                </Button>
                <CopyButton value={backupText} label="Copy" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className={styles.panel} {...panel(3)}>
          <div className={styles.stack}>
            <div className={styles.doneHead}>
              <svg className={styles.doneMark} width={40} height={40} viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1.5" opacity=".28" />
                <motion.path
                  d="M13 20.5l4.8 4.8L27.5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: step === "enabled" ? 1 : 0 }}
                  transition={reduced ? INSTANT : { duration: 0.26, ease: EASE, delay: 0.14 * (step === "enabled" ? 1 : 0) }}
                />
              </svg>
              <div>
                <h3 className={styles.stepTitle}>Two-factor authentication is on</h3>
                <p className={styles.muted}>{issuer} will ask for a code when you sign in on a new device.</p>
              </div>
            </div>
            <ul className={styles.summary}>
              <li className={styles.summaryRow}>
                <Smartphone size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.summaryName}>Authenticator app</span>
                <span className={styles.meta}>{addedLabel}</span>
              </li>
              <li className={styles.summaryRow}>
                <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.summaryName}>Backup codes</span>
                <span className={styles.meta}>
                  <span className={styles.num}>{backupCodes.length}</span> of <span className={styles.num}>{backupCodes.length}</span> unused
                </span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footLeft}>
          <AnimatePresence initial={false} mode="popLayout">
            {aside ? (
              <motion.span
                key={aside.key}
                className={styles.footItem}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: reduced ? INSTANT : SWAP_OUT }}
                transition={reduced ? INSTANT : SWAP_IN}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (step === "scan") {
                      onCancel?.();
                      return;
                    }
                    controller.current?.abort();
                    setVerifying(false);
                    setDigits(Array<string>(6).fill(""));
                    setError(null);
                    goTo("scan");
                  }}
                >
                  {aside.label}
                </Button>
              </motion.span>
            ) : enableError && step === "backup" ? (
              <motion.span
                key="enable-error"
                className={[styles.footItem, styles.errorText].join(" ")}
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: reduced ? INSTANT : SWAP_OUT }}
                transition={reduced ? INSTANT : SWAP_IN}
              >
                <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.truncate}>{enableError}</span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (step === "scan") {
              setError(null);
              goTo("verify");
              return;
            }
            if (step === "verify") {
              void submit(code);
              return;
            }
            if (step === "backup") {
              void enable();
              return;
            }
            if (onDone) {
              onDone();
              return;
            }
            controller.current?.abort();
            setDigits(Array<string>(6).fill(""));
            setError(null);
            setVerified(false);
            setVerifying(false);
            setSaved(false);
            setEnabling(false);
            setEnableError(null);
            setDownloaded(false);
            interacted.current = false;
            setStep("scan");
            onStepChange?.("scan");
            setStatus("Demo restarted");
          }}
          disabled={primary.disabled && !primary.loading}
          loading={primary.loading}
        >
          {primary.label}
        </Button>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}

export default TwoFactorSetup;
