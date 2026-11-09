"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./revenue-globe.module.css";

/* ------------------------------------------------------------------ *
 * Sample data: 40 settlement cities, minute-by-minute payment records.
 * Everything is generated from a fixed seed, so the block shows the
 * same day on every render.
 * ------------------------------------------------------------------ */

export interface RevenueGlobeProps {
  /** Heading rendered above the globe. */
  title?: string;
  /** Short line under the heading. */
  lede?: string;
}

interface Region {
  id: string;
  name: string;
}

interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  tz: number;
  region: number;
  weight: number;
}

interface Product {
  name: string;
  amount: number;
  weight: number;
}

interface Payment {
  id: number;
  t: number;
  city: number;
  amount: number;
  product: number;
}

const REGIONS: Region[] = [
  { id: "americas", name: "Americas" },
  { id: "emea", name: "EMEA" },
  { id: "apac", name: "APAC" },
];

const city = (
  name: string,
  country: string,
  lat: number,
  lon: number,
  tz: number,
  region: number,
  weight: number,
): City => ({ name, country, lat, lon, tz, region, weight });

const CITIES: City[] = [
  city("San Francisco", "US", 37.77, -122.42, -7, 0, 6),
  city("New York", "US", 40.71, -74.01, -4, 0, 9),
  city("Toronto", "CA", 43.65, -79.38, -4, 0, 3.5),
  city("Chicago", "US", 41.88, -87.63, -5, 0, 4),
  city("Austin", "US", 30.27, -97.74, -5, 0, 3),
  city("Seattle", "US", 47.61, -122.33, -7, 0, 3.5),
  city("Los Angeles", "US", 34.05, -118.24, -7, 0, 5),
  city("Miami", "US", 25.76, -80.19, -4, 0, 2.2),
  city("Mexico City", "MX", 19.43, -99.13, -6, 0, 2.5),
  city("Bogotá", "CO", 4.71, -74.07, -5, 0, 1.2),
  city("Lima", "PE", -12.05, -77.04, -5, 0, 1),
  city("São Paulo", "BR", -23.55, -46.63, -3, 0, 4),
  city("Buenos Aires", "AR", -34.6, -58.38, -3, 0, 1.6),
  city("Santiago", "CL", -33.45, -70.67, -3, 0, 1.2),
  city("London", "GB", 51.51, -0.13, 1, 1, 7),
  city("Dublin", "IE", 53.35, -6.26, 1, 1, 1.8),
  city("Paris", "FR", 48.86, 2.35, 2, 1, 4),
  city("Berlin", "DE", 52.52, 13.4, 2, 1, 4),
  city("Amsterdam", "NL", 52.37, 4.9, 2, 1, 2.8),
  city("Stockholm", "SE", 59.33, 18.07, 2, 1, 2),
  city("Madrid", "ES", 40.42, -3.7, 2, 1, 2.2),
  city("Milan", "IT", 45.46, 9.19, 2, 1, 2),
  city("Istanbul", "TR", 41.01, 28.98, 3, 1, 1.6),
  city("Tel Aviv", "IL", 32.09, 34.78, 3, 1, 2),
  city("Dubai", "AE", 25.2, 55.27, 4, 1, 2),
  city("Lagos", "NG", 6.52, 3.38, 1, 1, 1.2),
  city("Nairobi", "KE", -1.29, 36.82, 3, 1, 0.9),
  city("Cape Town", "ZA", -33.92, 18.42, 2, 1, 1),
  city("Tokyo", "JP", 35.68, 139.69, 9, 2, 5),
  city("Seoul", "KR", 37.57, 126.98, 9, 2, 3),
  city("Shanghai", "CN", 31.23, 121.47, 8, 2, 2.5),
  city("Hong Kong", "HK", 22.32, 114.17, 8, 2, 2.2),
  city("Singapore", "SG", 1.35, 103.82, 8, 2, 3),
  city("Bengaluru", "IN", 12.97, 77.59, 5.5, 2, 3),
  city("Mumbai", "IN", 19.08, 72.88, 5.5, 2, 2.2),
  city("Jakarta", "ID", -6.21, 106.85, 7, 2, 1.6),
  city("Manila", "PH", 14.6, 120.98, 8, 2, 1.2),
  city("Sydney", "AU", -33.87, 151.21, 10, 2, 3.5),
  city("Melbourne", "AU", -37.81, 144.96, 10, 2, 2.2),
  city("Auckland", "NZ", -36.85, 174.76, 12, 2, 1),
];

const CITY_COUNT = CITIES.length;

const PRODUCTS: Product[] = [
  { name: "Plus monthly", amount: 8, weight: 45 },
  { name: "Pro monthly", amount: 16, weight: 25 },
  { name: "Seat added", amount: 12, weight: 16 },
  { name: "Usage top-up", amount: 20, weight: 8 },
  { name: "Plus annual", amount: 84, weight: 4 },
  { name: "Pro annual", amount: 168, weight: 1.6 },
  { name: "Team annual", amount: 1200, weight: 0.3 },
  { name: "Enterprise contract", amount: 0, weight: 0.006 },
];

const PRODUCT_WEIGHT = PRODUCTS.reduce((total, row) => total + row.weight, 0);

function mix(value: number) {
  let hash = Math.imul(((0x5bd1e995 ^ value) >>> 0) ^ (value >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function minuteRecords(minute: number): Payment[] {
  const seed = mix(7919 * minute + 104729) >>> 0;
  let state = seed;
  const random = () => {
    const next = (state = (state + 0x6d2b79f5) >>> 0);
    let value = Math.imul(next ^ (next >>> 15), 1 | next);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  const records: Payment[] = [];
  const hour = Math.floor(minute / 60);

  for (let index = 0; index < CITY_COUNT; index++) {
    const entry = CITIES[index];
    const jitter = 0.78 + 0.44 * (mix(131 * index + 977 * hour) / 0x100000000);
    const local = (minute + 0.5) / 60 + entry.tz;
    const hourAngle = ((local % 24) + 24) % 24;
    const afternoon = hourAngle - 13.5;
    const evening = hourAngle - 20.5;
    const demand =
      0.07 +
      0.93 * Math.exp(-(afternoon * afternoon) / 21.8) +
      0.16 * Math.exp(-(evening * evening) / 3.9);
    const lambda = entry.weight * demand * 3.84 * jitter;

    const limit = Math.exp(-lambda);
    let count = 0;
    let probability = 1;
    do {
      count++;
      probability *= random();
    } while (probability > limit && count < 200);
    count--;

    while (count-- > 0) {
      let pick = random() * PRODUCT_WEIGHT;
      let product = 0;
      for (let slot = 0; slot < PRODUCTS.length; slot++) {
        pick -= PRODUCTS[slot].weight;
        if (pick <= 0) {
          product = slot;
          break;
        }
      }
      const amount =
        PRODUCTS[product].amount || 12000 + 1000 * Math.floor(37 * random());
      records.push({
        id: 0,
        t: 60 * minute + 60 * random(),
        city: index,
        amount,
        product,
      });
    }
  }

  records.sort((left, right) => left.t - right.t);
  records.forEach((record, index) => {
    record.id = 4096 * minute + index;
  });
  return records;
}

const minuteCache = new Map<number, Payment[]>();

function recordsFor(minute: number) {
  const cached = minuteCache.get(minute);
  if (cached) return cached;
  const records = minuteRecords(minute);
  minuteCache.set(minute, records);
  if (minuteCache.size > 24) {
    const oldest = minuteCache.keys().next().value;
    if (oldest !== undefined) minuteCache.delete(oldest);
  }
  return records;
}

interface DayIndex {
  revenue: Float64Array;
  counts: Float64Array;
  bins: number[];
  forecast: number[];
}

let dayIndex: DayIndex | null = null;

function buildDay(): DayIndex {
  if (dayIndex) return dayIndex;
  const revenue = new Float64Array(1441 * CITY_COUNT);
  const counts = new Float64Array(1441 * CITY_COUNT);
  const bins = Array.from({ length: 96 }, () => 0);

  for (let minute = 0; minute < 1440; minute++) {
    const previous = minute * CITY_COUNT;
    const next = previous + CITY_COUNT;
    for (let index = 0; index < CITY_COUNT; index++) {
      revenue[next + index] = revenue[previous + index];
      counts[next + index] = counts[previous + index];
    }
    for (const record of minuteRecords(minute)) {
      revenue[next + record.city] += record.amount;
      counts[next + record.city] += 1;
      bins[Math.floor(minute / 15)] += record.amount;
    }
  }

  const forecast = REGIONS.map((_, region) =>
    CITIES.reduce(
      (total, entry, index) =>
        total + (entry.region === region ? revenue[1440 * CITY_COUNT + index] : 0),
      0,
    ),
  );

  dayIndex = { revenue, counts, bins, forecast };
  return dayIndex;
}

function forEachRecord(from: number, to: number, visit: (record: Payment) => void) {
  const first = Math.max(0, Math.floor(from / 60));
  const last = Math.min(1439, Math.floor(to / 60));
  for (let minute = first; minute <= last; minute++) {
    for (const record of recordsFor(minute)) {
      if (record.t > to) break;
      if (record.t > from) visit(record);
    }
  }
}

function stateAt(time: number, revenue: Float64Array, counts: Float64Array) {
  const day = buildDay();
  const clamped = Math.max(0, Math.min(86400, time));
  const minute = Math.min(1440, Math.floor(clamped / 60));
  const offset = minute * CITY_COUNT;
  for (let index = 0; index < CITY_COUNT; index++) {
    revenue[index] = day.revenue[offset + index];
    counts[index] = day.counts[offset + index];
  }
  if (minute < 1440) {
    for (const record of recordsFor(minute)) {
      if (record.t > clamped) break;
      revenue[record.city] += record.amount;
      counts[record.city] += 1;
    }
  }
}

const totalOf = (values: ArrayLike<number>) => {
  let total = 0;
  for (let index = 0; index < values.length; index++) total += values[index];
  return total;
};

interface Snapshot {
  t: number;
  total: number;
  count: number;
  lastHour: number;
  regions: number[];
  cityRevenue: number[];
  cityCount: number[];
  top: number[];
}

function snapshotAt(time: number, exclude: Payment[] = []): Snapshot {
  const revenue = new Float64Array(CITY_COUNT);
  const counts = new Float64Array(CITY_COUNT);
  stateAt(time, revenue, counts);
  for (const record of exclude) {
    revenue[record.city] -= record.amount;
    counts[record.city] -= 1;
  }
  const earlier = new Float64Array(CITY_COUNT);
  stateAt(time - 3600, earlier, new Float64Array(CITY_COUNT));
  const total = totalOf(revenue);
  const regions = REGIONS.map((_, region) =>
    CITIES.reduce(
      (sum, entry, index) => sum + (entry.region === region ? revenue[index] : 0),
      0,
    ),
  );
  const order = CITIES.map((_, index) => index).sort(
    (left, right) => revenue[right] - revenue[left],
  );
  return {
    t: time,
    total,
    count: totalOf(counts),
    lastHour: Math.max(0, total - totalOf(earlier)),
    regions,
    cityRevenue: Array.from(revenue),
    cityCount: Array.from(counts),
    top: order.slice(0, 5),
  };
}

function topTransactions(from: number, window: number, limit: number) {
  const found: Payment[] = [];
  forEachRecord(from - window, from, (record) => {
    if (record.city !== 0) found.push(record);
  });
  return found.sort((left, right) => right.amount - left.amount).slice(0, limit);
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatMoney = (value: number) => money.format(Math.round(value));
const formatCount = (value: number) => plain.format(Math.round(value));

function compactMoney(value: number) {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1)}k`;
  return formatMoney(value);
}

const pad2 = (value: number) => String(value).padStart(2, "0");

function clockTime(seconds: number, withSeconds = true) {
  const whole = Math.max(0, Math.min(86399, Math.floor(seconds)));
  const base = `${pad2(Math.floor(whole / 3600))}:${pad2(Math.floor(whole / 60) % 60)}`;
  return withSeconds ? `${base}:${pad2(whole % 60)}` : base;
}

/* ------------------------------------------------------------------ *
 * Geography helpers
 * ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (from: number, to: number, value: number) => {
  const ratio = clamp((value - from) / (to - from), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
};

type Vec3 = [number, number, number];

function toVector(lat: number, lon: number): Vec3 {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return [
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda),
  ];
}

const dot = (left: Vec3, right: Vec3) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1;
  const bx = 3 * (x2 - x1) - ax;
  const cx = 1 - ax - bx;
  const ay = 3 * y1;
  const by = 3 * (y2 - y1) - ay;
  const cy = 1 - ay - by;
  const sampleX = (t: number) => ((cx * t + bx) * t + ax) * t;
  const sampleY = (t: number) => ((cy * t + by) * t + ay) * t;
  const slopeX = (t: number) => (3 * cx * t + 2 * bx) * t + ax;

  return (input: number) => {
    if (input <= 0) return 0;
    if (input >= 1) return 1;
    let t = input;
    for (let step = 0; step < 6; step++) {
      const delta = sampleX(t) - input;
      if (Math.abs(delta) < 1e-5) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= delta / slope;
    }
    let low = 0;
    let high = 1;
    t = input;
    for (let step = 0; step < 24; step++) {
      const value = sampleX(t);
      if (Math.abs(value - input) < 1e-5) break;
      if (value < input) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return sampleY(t);
  };
}

/* ------------------------------------------------------------------ *
 * Canvas engine: dotted globe, payment arcs, ripples, camera springs.
 * ------------------------------------------------------------------ */

const MIN_LAT = 22 * DEG;
const MAX_LAT = 66 * DEG;
const HOME_LON = -84 * DEG;
const DRIFT_BAND = 46 * DEG;
const easeInOut = cubicBezier(...motionTokens.ease.inOut);
const easeEnter = cubicBezier(...motionTokens.ease.enter);

interface GlobeDots {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  land: Uint8Array;
  count: number;
  step: number;
}

const dotCache = new Map<number, GlobeDots>();

/* Continents as flat [lon, lat, lon, lat, …] rings, degrees. */
const CONTINENTS: number[][] = [
      [
        -168, 66, -162, 70, -156, 71.3, -141, 69.6, -128, 70, -117, 69,
        -100, 68, -94, 72, -85, 69.5, -82, 66, -78, 72, -68, 70, -62, 66,
        -64, 60, -61, 56, -56, 52, -60, 47.5, -66, 45, -70, 43.5, -70, 41.7,
        -74, 40.5, -76, 38, -76, 35, -81, 31.5, -80, 27, -80.5, 25.2, -82.5,
        27.5, -84, 30, -89, 30.2, -94, 29.5, -97.5, 27, -97.5, 22, -96, 19,
        -94, 18.5, -91, 18.8, -90.5, 21, -87, 21.5, -88, 16, -84, 15.5,
        -83.5, 11, -81.5, 9, -79, 9.3, -77.3, 8.5, -78, 7.5, -80, 7.4, -83,
        8.3, -86, 11, -88, 13.3, -92, 14.5, -95, 16, -99, 16.7, -104.5, 19,
        -105.7, 22.5, -109, 26, -112.5, 29.5, -114.7, 31.5, -114, 30, -112,
        27, -110, 23.2, -112, 25, -114.5, 28, -116.5, 31.5, -117.2, 32.7,
        -120.6, 34.5, -122.5, 37.5, -124.2, 40.5, -124, 46, -124.7, 48.4,
        -123, 49, -127.5, 50.8, -130.5, 54.5, -133.5, 57.5, -137.5, 58.7,
        -141, 60, -146, 60.8, -152, 59, -154, 57.5, -158, 56.5, -162, 55,
        -164.5, 54.6, -158, 58.6, -162, 59.8, -165, 61, -166, 63, -161,
        64.4, -165, 64.8,
      ],
      [
        -94.5, 59, -92.5, 57, -88, 56, -82.5, 55, -79.5, 54.5, -78.5, 58,
        -77, 60.5, -78, 62.3, -82, 64.5, -86, 64, -90, 63.5, -94, 61,
      ],
      [
        -120, 72, -120, 76, -110, 78, -95, 80, -80, 83, -65, 82.5, -75, 78,
        -88, 76, -95, 74, -105, 73, -115, 71,
      ],
      [
        -73, 78, -68, 80.5, -60, 82, -40, 83.5, -22, 82.5, -18, 80, -19, 76,
        -21, 72, -22, 70, -26, 68.5, -32, 68, -36, 65.5, -40, 64.5, -43, 60,
        -46, 60.8, -49, 62, -51, 64, -53, 66.5, -54, 69.5, -55, 71, -58,
        75.5, -66, 76.5,
      ],
      [
        -24, 65.5, -22, 66.4, -18, 66.2, -14.5, 66, -13.5, 65, -15, 64.3,
        -18, 63.4, -22, 63.8, -24, 64.8,
      ],
      [
        -84.9, 21.9, -82, 23.2, -77.5, 21.9, -74.2, 20.2, -77.7, 19.9,
        -80.5, 21.6, -83.3, 21.8,
      ],
      [
        -74.4, 19.8, -72.8, 19.9, -70, 19.7, -68.4, 18.6, -71.3, 17.7,
        -74.4, 18.4,
      ],
      [
        -77.3, 8.5, -75.5, 10.5, -72, 12, -71.5, 11, -68, 10.5, -64, 10.7,
        -61, 10.5, -58, 6.8, -54, 5.8, -51.5, 4.2, -50, 1.8, -49, -0.5,
        -44.5, -2.5, -40, -2.8, -37, -4.8, -35, -6.5, -35, -9, -37, -12,
        -39, -15, -39.5, -18, -41, -22, -43, -23, -46, -24, -48.5, -27,
        -49.5, -29, -51.5, -31.5, -53.5, -34, -58, -34.5, -57, -36.5, -57.5,
        -38.2, -62, -39, -62.5, -41, -65, -42, -64.5, -45, -67.5, -46.5,
        -66, -48, -68.5, -50.5, -69, -52.3, -68.5, -54.5, -71, -54, -74,
        -52, -75.5, -48, -74, -44, -73.5, -40, -73.5, -37, -71.5, -33,
        -71.5, -28, -70.5, -23, -70.2, -18.5, -72, -17, -76, -14, -78, -11,
        -79.5, -8, -81, -6, -80.5, -3, -80, -1, -80.5, 1, -78.8, 1.8, -77.5,
        4, -77.4, 7,
      ],
      [
        -9, 37, -9.5, 39, -9, 43, -8, 43.7, -2, 43.4, -1.3, 44.5, -1.2, 46,
        -2.3, 47.2, -4.5, 48, -4.7, 48.6, -1.5, 48.7, -1.3, 49.7, 1, 50,
        1.6, 50.9, 3.5, 51.4, 4.5, 52.5, 5, 53.3, 7, 53.6, 8.5, 53.8, 8.6,
        55.5, 8.2, 56.9, 10.5, 57.6, 10.5, 56.5, 10.9, 55.7, 9.8, 54.9, 11,
        54, 13, 54.4, 14.5, 53.9, 18, 54.8, 19.8, 54.4, 21.2, 55.2, 21,
        56.8, 21.8, 57.5, 23.7, 57.2, 24.3, 58.3, 23.5, 59.2, 28, 59.5, 30,
        60, 26, 60.4, 22.8, 59.9, 21.4, 60.8, 21.2, 62.5, 22.3, 63.8, 25,
        65, 25.3, 65.5, 22.5, 65.8, 21.3, 64.8, 19, 63.5, 17.5, 62.3, 17.2,
        61, 18.8, 60, 18.5, 59.3, 16.7, 57.7, 16.4, 56.6, 14.3, 55.5, 12.9,
        55.4, 12.6, 56.2, 11.7, 57.7, 11.2, 59, 10.5, 59.2, 8, 58.1, 5.6,
        58.9, 5, 61, 5.3, 62.5, 8, 63.5, 10.5, 64.6, 12.5, 66, 14.5, 67.8,
        16, 68.8, 18.5, 69.8, 22, 70.3, 26, 71, 29, 70.8, 31, 70, 33, 69.3,
        36, 69, 41, 67.5, 44, 68.5, 46, 68, 53, 68.6, 58, 68.8, 60, 69.6,
        66, 69.5, 72, 72.8, 76, 72.2, 80, 72.5, 84, 73.8, 87, 75, 95, 76,
        100, 76.5, 104, 77.7, 107, 76.9, 112, 76, 114, 75.5, 112, 73.7, 120,
        73, 128, 73.2, 130, 71, 136, 71.5, 140, 72.4, 146, 72.3, 150, 71.5,
        155, 71, 160, 70.8, 165, 69.7, 170, 70, 176, 69.8, 180, 68.9, 180,
        65, 178, 64.5, 174, 61.8, 170, 60, 166, 60.3, 163, 59.8, 162, 58,
        163, 56.5, 162, 54.5, 160, 53, 158, 51.5, 156.7, 51, 156, 55, 156.5,
        57.5, 160, 60.5, 159, 61.5, 155, 59.3, 150, 59.5, 145, 59.3, 142,
        59, 138, 56.5, 137, 54, 140.5, 53.3, 141.3, 52, 140.5, 48.5, 138.5,
        47, 135, 43.5, 132, 43, 130.7, 42.3, 129.5, 40.8, 128.5, 38.5,
        129.4, 36.5, 129.2, 35.2, 127.5, 34.6, 126.3, 34.6, 126.5, 36.5,
        126.7, 37.7, 125, 38, 124.7, 39.6, 122.2, 40.4, 121.2, 40.9, 119,
        39.2, 118, 39, 117.7, 38.5, 118.8, 37.5, 120.8, 37.8, 122.5, 37.4,
        120.5, 36.1, 119.2, 34.8, 120.8, 32.5, 121.8, 31, 121.7, 30, 122,
        29.2, 120.5, 27, 119.5, 25.4, 117.8, 24.3, 116, 22.9, 114, 22.3,
        112, 21.6, 110.3, 21, 110.2, 20.3, 109.7, 21.5, 108, 21.5, 106.6,
        20.2, 105.8, 19, 106.5, 17.5, 108.8, 15.4, 109.3, 13, 109.2, 11.6,
        107.5, 10.5, 106.7, 10.3, 104.8, 8.6, 105, 9.9, 104.5, 10.4, 103,
        11, 102.3, 12.2, 100.9, 12.7, 100.2, 13.4, 99.2, 10.4, 99.9, 9.2,
        100.4, 7.4, 101.3, 6.9, 102.1, 6.2, 103.4, 4.5, 103.5, 2.5, 104.2,
        1.4, 103.5, 1.3, 101.3, 2.8, 100.4, 4.5, 100.3, 6, 98.3, 8.2, 98.5,
        10, 98.6, 13.6, 97.7, 15.8, 97.4, 16.8, 94.6, 16.2, 94.3, 18.5, 93,
        19.8, 92.2, 21.3, 91.8, 22.3, 90.5, 22.2, 89, 21.8, 87, 21.5, 86.9,
        20.7, 85, 19.5, 82.3, 17, 80.3, 15.7, 80.3, 13.3, 79.9, 10.3, 78.2,
        8.8, 77.5, 8.1, 76.6, 8.9, 75.7, 11.3, 74.7, 13, 73.5, 16, 72.8,
        19.3, 72.8, 21, 70.5, 20.9, 69, 22.4, 70, 22.9, 68.3, 23.6, 66.6,
        25.4, 64, 25.3, 61.6, 25.2, 57.3, 25.8, 56.5, 27.1, 54.7, 26.5,
        52.5, 27.6, 51.3, 28, 50.2, 30.2, 48.9, 30.3, 48, 29.5, 48.5, 28,
        50, 26.5, 50.8, 25, 51.5, 25.3, 51.6, 24.2, 53.5, 24.1, 55.5, 25.5,
        56.3, 26.3, 56.4, 24.9, 57.7, 23.8, 59.8, 22.5, 58.5, 20.4, 57.7,
        19, 55.4, 17.6, 52.2, 15.8, 49.6, 14.6, 45, 12.8, 43.5, 12.7, 42.8,
        15, 42.6, 16.8, 41, 19.5, 39.1, 21.8, 38.4, 23.8, 37.2, 25.1, 35.2,
        28.1, 34.6, 28.1, 34.9, 29.5, 34.5, 31.5, 35, 33, 35.9, 35, 36.2,
        36.6, 34.5, 36.8, 32.5, 36.1, 30.5, 36.4, 29, 36.7, 27.3, 37.5,
        26.3, 38.3, 26.2, 39.5, 26.6, 40.3, 29, 41.1, 31, 41.1, 33.5, 42,
        35.2, 42, 38.3, 40.9, 41.5, 41.5, 41.7, 42.6, 39.8, 43.4, 38, 44.5,
        36.6, 45.3, 35.3, 44.8, 33.5, 44.5, 32.8, 45.4, 33.7, 46, 31.7,
        46.6, 30.7, 46.5, 29.7, 45.4, 28.7, 44.3, 27.9, 42.7, 28, 41.5,
        26.2, 40.9, 25.9, 40.8, 24, 40.8, 23.7, 40.2, 22.6, 40.4, 22.9,
        39.4, 23.3, 38.1, 24, 38, 22.8, 37.5, 22.4, 36.5, 21.7, 36.9, 21.1,
        38.3, 20.2, 39.6, 19.4, 40.4, 19.5, 41.8, 18.5, 42.5, 16.5, 43.4,
        15.2, 44.3, 13.7, 45.1, 13.1, 45.7, 12.3, 45.3, 12.4, 44.2, 13.6,
        43.5, 14.8, 42.1, 16.1, 41.4, 17.9, 40.6, 18.5, 40.1, 17, 39.5,
        16.6, 38.4, 15.7, 38, 15.6, 40, 14.5, 40.6, 12.5, 41.5, 11, 42.5,
        10.2, 43.9, 8.8, 44.4, 7.5, 43.8, 6, 43.1, 4.3, 43.5, 3.2, 43, 3.1,
        41.9, 2, 41.2, 0.8, 41, -0.3, 39.5, 0.2, 38.8, -0.7, 37.6, -2.1,
        36.7, -4.4, 36.7, -5.6, 36, -6.3, 36.8, -7.4, 37.2, -8.9, 37,
      ],
      [
        47, 45, 49.2, 46.4, 51.2, 47, 53, 46.5, 53.2, 45, 51.3, 44.5, 50.6,
        43.8, 52.7, 41.8, 54, 40.7, 53.9, 38, 53.2, 37, 50.2, 37.3, 49,
        38.4, 49.5, 40.2, 48, 42, 47.5, 43.2,
      ],
      [
        -5.9, 35.8, -2, 35.1, 1, 36.5, 3, 36.8, 7, 37, 10.2, 37.2, 11, 36.8,
        10.2, 35.5, 11, 34, 10.5, 33.3, 12.2, 32.8, 15.2, 32.3, 15.7, 31.3,
        18.5, 30.3, 20, 30.9, 20, 32, 22, 32.9, 25, 31.8, 29, 30.9, 32.3,
        31.2, 34.2, 31.3, 34.9, 29.5, 34.3, 27.8, 33.6, 28.3, 32.6, 29.9,
        33.9, 27.2, 35.5, 24, 37.2, 21, 37.4, 18.8, 38.6, 17.9, 39.7, 15.3,
        41.3, 13.8, 43.3, 12.5, 43.1, 11.6, 44.5, 10.4, 47.5, 11.2, 51.2,
        11.8, 51, 10.4, 50.8, 9, 49, 6, 47.5, 4.2, 45.5, 2, 43.2, -0.5,
        41.6, -1.7, 40.2, -2.8, 39.3, -4.7, 39, -6.5, 39.5, -8, 40.4, -10.5,
        40.6, -14, 39, -16.8, 36.8, -18.6, 35, -20.5, 35.4, -22.2, 35.5,
        -24, 32.9, -25.9, 32.7, -28, 31, -29.9, 28.8, -32.2, 26.5, -33.8,
        25.6, -34, 22.5, -34, 20, -34.8, 18.4, -34.2, 18.2, -32, 17.2,
        -29.5, 16.4, -28.6, 15.2, -26.5, 14.4, -22.5, 13.4, -20.8, 11.8,
        -17.3, 11.8, -15.8, 12.6, -13.3, 13.7, -10.8, 13.2, -8.8, 12.2, -6,
        12.3, -4.8, 11, -3.9, 9.6, -1, 9.3, 1, 9.8, 3, 8.9, 4.5, 7, 4.4,
        5.7, 4.3, 4.5, 6.3, 2.5, 6.3, 1, 5.9, -1.9, 4.8, -4, 5.2, -7.5, 4.4,
        -9.3, 5.5, -11.4, 6.9, -13.2, 8.4, -13.7, 9.5, -15, 10.9, -16.7,
        12.4, -17.2, 14.7, -16.5, 16.3, -16, 18.7, -16.9, 21.3, -15.2, 24,
        -14.8, 25.5, -13.1, 27.6, -11.4, 28.3, -9.8, 29.8, -9.6, 31.5, -8.6,
        33.2, -6.8, 34,
      ],
      [
        49.3, -12, 50.4, -15.2, 49.8, -17, 48.7, -20.5, 47.6, -23.8, 47.1,
        -24.9, 45.2, -25.6, 44, -24.8, 43.3, -22.5, 43.7, -20.5, 44.4, -19,
        44, -17, 45.2, -15.8, 47.5, -14.5, 48.8, -12.5,
      ],
      [
        -5.7, 50, -3, 50.6, 1.4, 51.2, 1.7, 52.7, 0.3, 53.5, -0.3, 54.5,
        -1.6, 55.6, -2, 56.9, -1.8, 57.6, -3.3, 58.6, -5, 58.6, -6.2, 57.5,
        -5.6, 56.3, -5, 55, -3, 54.9, -3.4, 54.3, -3, 53.4, -4.6, 53.3,
        -4.2, 52.3, -4.7, 51.7, -3, 51.5,
      ],
      [
        -6, 52.2, -6.2, 53.9, -5.6, 54.6, -6.8, 55.2, -8.3, 55.2, -8.7,
        54.3, -10, 54.2, -9.9, 53.3, -9.3, 52.6, -10.3, 51.9, -9.5, 51.5,
        -8.2, 51.8, -6.4, 52.2,
      ],
      [11, 78.5, 16, 80, 27, 80.2, 22, 77.5, 15, 77],
      [52, 71.5, 56, 73.5, 60, 76.5, 68, 77, 63, 74.5, 57, 70.6],
      [142, 46, 143.5, 49, 144.5, 54, 142.5, 54.3, 142, 51.5, 141.8, 48],
      [
        130, 31.3, 131.3, 31.4, 132, 33.2, 134, 33.4, 135.3, 33.7, 136.8,
        34.3, 138.8, 34.6, 140, 35, 140.8, 35.7, 140.6, 36.8, 141, 38.3,
        141.9, 39.8, 141.4, 41.4, 140, 40.8, 139.8, 39.8, 139.5, 38.2,
        137.3, 36.8, 136.6, 37.2, 135.5, 35.6, 133, 35.5, 131, 34.3, 129.8,
        33.2,
      ],
      [
        140, 42.4, 141.2, 41.8, 143.2, 42, 145.5, 43.2, 145.3, 44.3, 142,
        45.4, 141.6, 44.3, 140.3, 43.3,
      ],
      [120.1, 23, 120.7, 22, 121.5, 23, 121.9, 24.9, 121, 25.2, 120.2, 24],
      [79.8, 8.2, 80.2, 9.8, 81.9, 7.5, 81.2, 6.2, 80, 6],
      [
        120, 18.4, 122.3, 18.5, 122, 16, 124, 13.2, 122.9, 13.6, 121.4,
        13.9, 120.5, 14.6, 119.8, 16.4,
      ],
      [122, 7, 123.5, 8.5, 125, 9.7, 126.6, 7.2, 125.4, 5.6, 124, 6.3],
      [
        95.3, 5.6, 97.5, 5.2, 100.4, 2.2, 103.8, -1, 106, -3.1, 105.8, -5.8,
        104.5, -5.9, 102, -4, 100.3, -1, 98.7, 1.8, 96, 4,
      ],
      [
        105.2, -6.8, 106.5, -6, 108.3, -6.2, 111, -6.4, 112.7, -6.9, 114.5,
        -7.7, 114.4, -8.7, 111, -8.2, 108, -7.8, 106.3, -7.4,
      ],
      [
        109, 1.5, 109.6, -0.5, 110.2, -2.9, 112, -3.4, 114.5, -4, 116.5,
        -3.2, 116.5, -1.5, 117.5, 0, 117.9, 1.3, 118.9, 5, 117.3, 6.9, 116,
        6, 115.4, 4.9, 113.6, 3.2, 111.4, 2.5, 110.3, 1.7,
      ],
      [
        119.3, -5.5, 121, -5, 121.4, -2, 123.3, -1, 124.8, 1.4, 121.5, 1.2,
        119.8, 0, 119.5, -3.5,
      ],
      [
        131, -1.3, 134, -0.8, 135.3, -3.3, 138, -1.6, 141, -2.6, 144.5,
        -3.8, 146, -5.5, 147.5, -6, 147.8, -8, 150, -10.3, 146.2, -8.8,
        144.2, -7.8, 143, -9, 141, -9.2, 139, -8.1, 138, -8.4, 137.7, -5.2,
        135.2, -4.3, 133, -4, 132, -2.8,
      ],
      [
        113.4, -22, 114, -26.3, 115, -29.5, 115.3, -33.5, 117.8, -35.1, 121,
        -33.9, 124, -33.3, 126, -32.3, 129, -31.7, 131.2, -31.5, 134.2,
        -32.8, 135.8, -34.8, 137.8, -33.4, 137.7, -35.7, 138.5, -35.5,
        139.7, -37, 141.6, -38.4, 144, -38.3, 145.5, -38.6, 147.8, -37.9,
        150, -37.5, 150.8, -34.5, 152.5, -32, 153.6, -28.5, 153.1, -25.5,
        151, -23.3, 149.5, -22.3, 147.4, -19.4, 146, -17.5, 145.4, -14.8,
        143.8, -14, 142.6, -10.7, 141.6, -12.6, 141.5, -15.5, 140.6, -17.5,
        139, -17.3, 137, -15.9, 135.5, -14.9, 136.8, -12.2, 135.8, -11.9,
        133.5, -11.3, 130.8, -12.4, 129.5, -14.9, 127.8, -14.3, 126, -14.2,
        124.3, -16.3, 122.3, -17.5, 121.4, -19.3, 119, -20.2, 116.7, -20.6,
        114.5, -21.8,
      ],
      [144.6, -40.7, 148.3, -40.9, 148, -43.2, 146.5, -43.6, 145.2, -42.2],
      [
        172.7, -34.4, 174.5, -36, 176, -37.6, 178.5, -37.7, 177.5, -39.3,
        176.9, -40, 175.2, -41.6, 174.6, -41.3, 175.2, -40, 173.8, -39.2,
        174.6, -38, 174.3, -36.7,
      ],
      [
        172.8, -40.5, 174.2, -41.7, 172.8, -43.6, 171.2, -44.6, 169.3,
        -46.6, 166.5, -46, 166.7, -45.2, 168.5, -44, 170.8, -42.8, 172.1,
        -41.1,
      ],
      [
        -180, -90, -180, -78, -150, -77, -120, -73.5, -100, -73, -75, -72.5,
        -62, -64, -58, -63.5, -60, -68, -60, -74, -40, -78, -25, -76, -10,
        -71, 10, -70, 30, -69.5, 50, -66.5, 70, -68, 90, -66, 110, -66, 130,
        -66.5, 150, -68.5, 165, -71, 170, -77, 180, -78, 180, -90,
      ],
  ];

interface Bounds {
  ring: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

let ringCache: Bounds[] | null = null;

function insideLand(lon: number, lat: number) {
  let hit = false;
  if (!ringCache) {
    ringCache = CONTINENTS.map((ring): Bounds => {
      let minX = 180;
      let maxX = -180;
      let minY = 90;
      let maxY = -90;
      for (let index = 0; index < ring.length; index += 2) {
        minX = Math.min(minX, ring[index]);
        maxX = Math.max(maxX, ring[index]);
        minY = Math.min(minY, ring[index + 1]);
        maxY = Math.max(maxY, ring[index + 1]);
      }
      return { ring, minX, maxX, minY, maxY };
    });
  }
  const rings = ringCache;
  for (const bounds of rings) {
    if (
      lon < bounds.minX ||
      lon > bounds.maxX ||
      lat < bounds.minY ||
      lat > bounds.maxY
    )
      continue;
    const ring = bounds.ring;
    const count = ring.length / 2;
    for (let current = 0, previous = count - 1; current < count; previous = current++) {
      const x1 = ring[2 * current];
      const y1 = ring[2 * current + 1];
      const x2 = ring[2 * previous];
      const y2 = ring[2 * previous + 1];
      if (y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
        hit = !hit;
      }
    }
  }
  return hit;
}

function buildDots(step: number): GlobeDots {
  const cached = dotCache.get(step);
  if (cached) return cached;
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const land: number[] = [];

  const walk = (spacing: number, isLand: boolean) => {
    let ring = 0;
    for (let lat = -90 + spacing / 2; lat < 90; lat += spacing, ring++) {
      const columns = Math.max(1, Math.round((360 * Math.cos(lat * DEG)) / spacing));
      for (let column = 0; column < columns; column++) {
        const lon = -180 + ((column + (ring % 2) * 0.5) * 360) / columns;
        if (insideLand(lon, lat) !== isLand) continue;
        const vector = toVector(lat, lon);
        xs.push(vector[0]);
        ys.push(vector[1]);
        zs.push(vector[2]);
        land.push(isLand ? 1 : 0);
      }
    }
  };

  walk(step, true);
  walk(2.5 * step, false);

  const dots: GlobeDots = {
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    z: Float32Array.from(zs),
    land: Uint8Array.from(land),
    count: xs.length,
    step,
  };
  dotCache.set(step, dots);
  return dots;
}

interface CameraMove {
  from: Vec3;
  to: Vec3;
  omega: number;
  p: number;
  v: number;
  zoomFrom: number;
  zoomTo: number;
}

interface DragState {
  id: number;
  x0: number;
  y0: number;
  lon0: number;
  lat0: number;
  moved: boolean;
  touch: boolean;
  samples: { x: number; y: number; t: number }[];
}

interface Arc {
  tx: Payment;
  born: number;
  dur: number;
  from: Vec3;
  omega: number;
  lift: number;
  width: number;
  landed: boolean;
}

interface Ripple {
  city: number;
  born: number;
  dur: number;
  size: number;
  strong: boolean;
}

type Focus = { kind: "city" | "region"; index: number } | null;

interface EngineEvents {
  tick: (snapshot: Snapshot) => void;
  mode: (mode: Mode) => void;
  focus: (focus: Focus) => void;
  hover: (index: number | null) => void;
  anchor: (index: number | null, x: number, y: number, shown: boolean) => void;
  frame: (time: number, live: number) => void;
}

export type Mode = "live" | "replay" | "paused";

const CITY_VECTORS = CITIES.map((entry) => toVector(entry.lat, entry.lon));
const HOME_VECTOR = toVector(CITIES[0].lat, CITIES[0].lon);

const TANGENTS = CITY_VECTORS.map((vector) => {
  const east = normalize([vector[2], 0, -vector[0]]);
  const north: Vec3 = [
    vector[1] * east[2] - vector[2] * east[1],
    vector[2] * east[0] - vector[0] * east[2],
    vector[0] * east[1] - vector[1] * east[0],
  ];
  return { east, north };
});

const REGION_VECTORS = REGIONS.map((_, region) =>
  normalize(
    CITY_VECTORS.reduce<Vec3>(
      (sum, vector, index) => {
        const weight = CITIES[index].region === region ? CITIES[index].weight : 0;
        return [
          sum[0] + vector[0] * weight,
          sum[1] + vector[1] * weight,
          sum[2] + vector[2] * weight,
        ];
      },
      [0, 0, 0],
    ),
  ),
);

const springStep = (
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] => {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const step = dt / steps;
  for (let index = 0; index < steps; index++) {
    velocity += (-stiffness * (value - target) - damping * velocity) * step;
    value += velocity * step;
  }
  return [value, velocity];
};

const rubberBand = (delta: number, limit = 0.55) =>
  (1 - 1 / ((Math.abs(delta) * limit) / 0.45 + 1)) * 0.45 * Math.sign(delta);

function slerp(from: Vec3, to: Vec3, amount: number, omega: number): Vec3 {
  const angle = omega || Math.acos(clamp(dot(from, to), -1, 1));
  if (angle < 1e-5) return [from[0], from[1], from[2]];
  const sin = Math.sin(angle);
  const left = Math.sin((1 - amount) * angle) / sin;
  const right = Math.sin(amount * angle) / sin;
  return [
    from[0] * left + to[0] * right,
    from[1] * left + to[1] * right,
    from[2] * left + to[2] * right,
  ];
}

const ARC_BUCKETS = 16;

export class GlobeEngine {
  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  readonly reduced: boolean;
  private events: EngineEvents;
  private mode: Mode = "live";
  private colors = {
    fg: "#111",
    muted: "#888",
    secondary: "#555",
    accent: "#333",
    surface: "#fff",
    border: "#e5e5e5",
  };
  private font = "sans-serif";
  private dpr = 1;
  private w = 0;
  private h = 0;
  private baseR = 0;
  private dots: GlobeDots | null = null;
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private bucket = new Int8Array(0);
  private order = new Int32Array(0);
  private counts = new Int32Array(ARC_BUCKETS);
  private offsets = new Int32Array(ARC_BUCKETS + 1);
  private cursorAt = new Int32Array(ARC_BUCKETS);
  private cityX = new Float32Array(CITY_COUNT);
  private cityY = new Float32Array(CITY_COUNT);
  private cityZ = new Float32Array(CITY_COUNT);
  private lon = -8 * DEG;
  private lat = MIN_LAT;
  private zoom = 0.86;
  private vLon = -0.42;
  private vLat = 0;
  private vZoom = 0;
  private drift = -1;
  private move: CameraMove | null = null;
  private drag: DragState | null = null;
  private pointer = { x: 0, y: 0, inside: false };
  private hover: number | null = null;
  private peeked: number | null = null;
  private focus: Focus = null;
  private clock = 60120;
  private liveNow = 60120;
  private speed = 1;
  private catchUp = false;
  private scrubbing = false;
  private resume: Mode = "live";
  private arcs: Arc[] = [];
  private ripples: Ripple[] = [];
  private budget = 0;
  private stills: Payment[] = [];
  private started = 0;
  private last = 0;
  private lastTick = 0;
  private raf = 0;
  private onScreen = false;
  private pageVisible = true;
  private introStart = -1;
  private cursor = "";
  private tickKey = "";
  private observers: ResizeObserver[] | null = null;
  private intersection: IntersectionObserver | null = null;
  private mutation: MutationObserver | null = null;
  private cleanups: (() => void)[] = [];
  private ctx: CanvasRenderingContext2D | null;
  private snapshot = snapshotAt(60120);

  constructor(
    canvas: HTMLCanvasElement,
    host: HTMLElement,
    reduced: boolean,
    events: EngineEvents,
  ) {
    this.canvas = canvas;
    this.host = host;
    this.reduced = reduced;
    this.events = events;
    this.ctx = canvas.getContext("2d");
    this.started = performance.now();

    if (reduced) {
      this.lon = -45 * DEG;
      this.zoom = 1;
      this.vLon = 0;
      this.stills = topTransactions(60120, 1500, 18);
    }
    this.refreshColors();

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((entry) => entry.isIntersecting);
      if (this.onScreen && this.introStart < 0 && !reduced) {
        this.introStart = performance.now() / 1000;
      }
      this.schedule();
    });
    intersectionObserver.observe(host);
    const mutationObserver = new MutationObserver(() => this.refreshColors());
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-accent"],
    });
    this.observers = [resizeObserver];
    this.intersection = intersectionObserver;
    this.mutation = mutationObserver;

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => this.refreshColors();
    scheme.addEventListener("change", onScheme);

    const onVisibility = () => {
      this.pageVisible = document.visibilityState === "visible";
      this.schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const down = (event: PointerEvent) => this.pointerDown(event);
    const move = (event: PointerEvent) => this.pointerMove(event);
    const up = (event: PointerEvent) => this.pointerUp(event, false);
    const cancel = (event: PointerEvent) => this.pointerUp(event, true);
    const leave = () => {
      this.pointer.inside = false;
      this.schedule();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("pointerleave", leave);

    this.cleanups.push(
      () => scheme.removeEventListener("change", onScheme),
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => {
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", cancel);
        canvas.removeEventListener("pointerleave", leave);
      },
    );

    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.observers?.forEach((observer) => observer.disconnect());
    this.intersection?.disconnect();
    this.mutation?.disconnect();
    this.cleanups.forEach((cleanup) => cleanup());
  }

  select(next: Focus) {
    const same =
      !!next &&
      !!this.focus &&
      next.kind === this.focus.kind &&
      next.index === this.focus.index;
    this.focus = same ? null : next;
    this.events.focus(this.focus);
    if (!this.focus) {
      this.move = null;
      this.schedule();
      return;
    }
    const target =
      this.focus.kind === "city"
        ? CITY_VECTORS[this.focus.index]
        : REGION_VECTORS[this.focus.index];
    const lat = clamp(Math.asin(target[1]), -MAX_LAT, MAX_LAT);
    const lon = Math.atan2(target[0], target[2]);
    const vector: Vec3 = [
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.cos(lon),
    ];
    const zoomTo = this.focus.kind === "city" ? 1.3 : 1.08;

    if (this.reduced) {
      this.lon = lon;
      this.lat = lat;
      this.zoom = zoomTo;
      this.move = null;
      this.schedule();
      return;
    }

    const from = this.center();
    const omega = Math.acos(clamp(dot(from, vector), -1, 1));
    const carry = this.move ? (this.move.v * this.move.omega) / Math.max(omega, 0.05) : 0;
    this.move = {
      from,
      to: vector,
      omega,
      p: 0,
      v: clamp(carry, 0, 3),
      zoomFrom: this.zoom,
      zoomTo,
    };
    this.vLon = 0;
    this.vLat = 0;
    this.schedule();
  }

  clearFocus() {
    if (this.focus) this.select(this.focus);
  }

  peek(index: number | null) {
    this.peeked = index;
    this.schedule();
  }

  nudge(lonStep: number, latStep: number) {
    this.move = null;
    if (this.reduced) {
      this.lon += 0.18 * lonStep;
      this.lat = clamp(this.lat + 0.14 * latStep, -MAX_LAT, MAX_LAT);
    } else {
      this.vLon += 1.1 * lonStep;
      this.vLat += 0.8 * latStep;
    }
    this.schedule();
  }

  replayDay() {
    this.clock = 0;
    this.catchUp = false;
    this.speed = 1;
    this.setMode(this.reduced ? "paused" : "replay");
    this.afterJump();
  }

  togglePlay() {
    if (this.mode === "paused") {
      this.setMode(this.clock >= this.liveNow - 1 ? "live" : "replay");
    } else {
      this.setMode("paused");
    }
    this.catchUp = false;
  }

  goLive() {
    if (this.reduced || this.liveNow - this.clock < 2) {
      this.clock = this.liveNow;
      this.setMode("live");
      this.afterJump();
      return;
    }
    this.catchUp = true;
    this.setMode("replay");
  }

  seek(time: number) {
    this.clock = clamp(time, 0, this.liveNow);
    const atLive = this.clock >= this.liveNow - 1;
    if (this.reduced) this.setMode(atLive ? "live" : "paused");
    else if (this.mode !== "paused") this.setMode(atLive ? "live" : "replay");
    this.catchUp = false;
    this.afterJump();
  }

  scrubStart() {
    if (this.scrubbing) return;
    this.resume = this.mode;
    this.scrubbing = true;
    this.setMode("paused");
  }

  scrubTo(time: number) {
    this.clock = clamp(time, 0, this.liveNow);
    this.afterJump();
  }

  scrubEnd() {
    if (!this.scrubbing) return;
    this.scrubbing = false;
    const atLive = this.clock >= this.liveNow - 1;
    if (this.reduced) this.setMode(atLive ? "live" : "paused");
    else if (this.resume !== "paused") this.setMode(atLive ? "live" : "replay");
  }

  get live() {
    return this.liveNow;
  }

  get time() {
    return this.clock;
  }

  refreshColors() {
    const probe = document.createElement("span");
    probe.style.display = "none";
    this.host.appendChild(probe);
    const reader = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });

    const read = (token: string, fallback: string) => {
      probe.style.color = fallback;
      probe.style.color = `var(${token}, ${fallback})`;
      const resolved = getComputedStyle(probe).color;
      if (!reader) return resolved;
      reader.clearRect(0, 0, 1, 1);
      reader.fillStyle = fallback;
      reader.fillStyle = resolved;
      reader.fillRect(0, 0, 1, 1);
      const [red, green, blue] = reader.getImageData(0, 0, 1, 1).data;
      return `rgb(${red}, ${green}, ${blue})`;
    };

    this.colors = {
      fg: read("--foreground", "#111"),
      muted: read("--text-muted", "#888"),
      secondary: read("--text-secondary", "#555"),
      accent: read("--accent", "#333"),
      surface: read("--surface", "#fff"),
      border: read("--border", "#e5e5e5"),
    };
    probe.remove();
    this.font = getComputedStyle(this.host).fontFamily || "sans-serif";
    this.schedule();
  }

  resize() {
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.baseR = 0.41 * Math.min(rect.width, rect.height);

    const step = Math.round(10 * clamp(5.4 / (this.baseR * DEG), 1.2, 2.8)) / 10;
    if (!this.dots || this.dots.step !== step) {
      this.dots = buildDots(step);
      this.px = new Float32Array(this.dots.count);
      this.py = new Float32Array(this.dots.count);
      this.bucket = new Int8Array(this.dots.count);
      this.order = new Int32Array(this.dots.count);
    }
    this.schedule(true);
  }

  private get running() {
    return this.onScreen && this.pageVisible;
  }

  private schedule(retry = false) {
    if (this.raf) return;
    if (!this.running && !retry) return;
    this.raf = requestAnimationFrame((time) => {
      this.raf = 0;
      this.frame(time);
    });
  }

  private setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== "replay") this.catchUp = false;
    this.events.mode(mode);
    this.schedule();
  }

  private afterJump() {
    this.arcs = this.arcs.filter((arc) => arc.tx.t <= this.clock);
    if (this.reduced) this.stills = topTransactions(this.clock, 1500, 18);
    this.lastTick = 0;
    this.schedule();
  }

  private center(): Vec3 {
    return [
      Math.cos(this.lat) * Math.sin(this.lon),
      Math.sin(this.lat),
      Math.cos(this.lat) * Math.cos(this.lon),
    ];
  }

  private local(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const { x, y } = this.local(event);
    this.canvas.setPointerCapture(event.pointerId);
    this.drag = {
      id: event.pointerId,
      x0: x,
      y0: y,
      lon0: this.lon,
      lat0: this.lat,
      moved: false,
      touch: event.pointerType !== "mouse",
      samples: [{ x, y, t: event.timeStamp }],
    };
  }

  private pointerMove(event: PointerEvent) {
    const { x, y } = this.local(event);
    this.pointer = { x, y, inside: event.pointerType === "mouse" };
    const drag = this.drag;
    if (drag && drag.id === event.pointerId) {
      const dx = x - drag.x0;
      const rawDy = drag.touch ? 0 : y - drag.y0;
      if (!drag.moved && Math.hypot(dx, rawDy) > 4) {
        drag.moved = true;
        drag.x0 = x;
        drag.y0 = drag.touch ? drag.y0 : y;
        drag.lon0 = this.lon;
        drag.lat0 = this.lat;
        this.move = null;
      }
      if (drag.moved) {
        const radius = this.baseR * this.zoom;
        this.lon = drag.lon0 - (x - drag.x0) / radius;
        const target = drag.lat0 + (drag.touch ? 0 : (y - drag.y0) / radius);
        const excess = Math.abs(target) - MAX_LAT;
        this.lat =
          excess > 0 ? Math.sign(target) * (MAX_LAT + rubberBand(excess)) : target;
        this.vLon = 0;
        this.vLat = 0;
      }
      drag.samples.push({ x, y, t: event.timeStamp });
      while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 90) {
        drag.samples.shift();
      }
    }
    this.schedule();
  }

  private pointerUp(event: PointerEvent, cancelled: boolean) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    this.drag = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    if (cancelled) return;
    if (!drag.moved) {
      this.click(this.local(event));
      return;
    }
    if (this.reduced) return;
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const span = Math.max(16, last.t - first.t) / 1000;
    const radius = this.baseR * this.zoom;
    this.vLon = clamp(-(last.x - first.x) / span / radius, -7, 7);
    this.vLat = drag.touch ? 0 : clamp((last.y - first.y) / span / radius, -5, 5);
    this.schedule();
  }

  private hitCity(x: number, y: number, tolerance: number) {
    let best: number | null = null;
    let limit = tolerance;
    for (let index = 0; index < CITY_COUNT; index++) {
      if (this.cityZ[index] <= 0.05) continue;
      const distance = Math.hypot(this.cityX[index] - x, this.cityY[index] - y);
      if (distance < limit) {
        best = index;
        limit = distance;
      }
    }
    return best;
  }

  private click({ x, y }: { x: number; y: number }) {
    const city = this.hitCity(x, y, 18);
    if (city !== null) {
      this.select({ kind: "city", index: city });
      return;
    }
    const radius = this.baseR * this.zoom;
    const nx = (x - this.w / 2) / radius;
    const ny = (this.h / 2 - y) / radius;
    if (nx * nx + ny * ny >= 1) {
      this.clearFocus();
      return;
    }
    const nz = Math.sqrt(1 - nx * nx - ny * ny);
    const sinLat = Math.sin(this.lat);
    const cosLat = Math.cos(this.lat);
    const sinLon = Math.sin(this.lon);
    const cosLon = Math.cos(this.lon);
    const up = -ny * sinLat + nz * cosLat;
    const direction: Vec3 = [
      nx * cosLon + up * sinLon,
      ny * cosLat + nz * sinLat,
      -nx * sinLon + up * cosLon,
    ];
    let best = 0;
    let bestDot = -2;
    CITY_VECTORS.forEach((vector, index) => {
      const value = dot(vector, direction);
      if (value > bestDot) {
        bestDot = value;
        best = index;
      }
    });
    this.select({ kind: "region", index: CITIES[best].region });
  }

  private advance(dt: number, now: number) {
    if (!this.reduced) {
      this.liveNow = Math.min(86399, 60120 + (performance.now() - this.started) / 1000);
    }
    const previous = this.clock;
    if (this.mode === "live") {
      this.clock = this.liveNow;
    } else if (this.mode === "replay") {
      const remaining = this.liveNow - this.clock;
      const cap = this.catchUp ? 40000 : 1500;
      const target = clamp(remaining * (this.catchUp ? 2.4 : 1.2), 2, cap);
      this.speed += (target - this.speed) * (1 - Math.exp(-dt / 0.3));
      this.clock = Math.min(this.liveNow, this.clock + this.speed * dt);
      if (this.liveNow - this.clock < 1) {
        this.clock = this.liveNow;
        this.setMode("live");
      }
    }
    if (this.clock < previous) this.afterJump();
    else if (this.clock > previous && !this.reduced) this.spawn(previous, this.clock, dt, now);
  }

  private spawn(from: number, to: number, dt: number, now: number) {
    const isLive = this.mode === "live" && to - from < 3;
    if (!isLive && to - from > 10800) return;
    const fresh: Payment[] = [];
    forEachRecord(from, to, (record) => {
      fresh.push(record);
    });
    if (!fresh.length) {
      this.budget = Math.min(3, this.budget + 8 * dt);
      return;
    }
    let selected = fresh;
    if (!isLive) {
      this.budget = Math.min(3, this.budget + 8 * dt);
      const allowance = Math.floor(this.budget);
      selected = allowance
        ? fresh.sort((left, right) => right.amount - left.amount).slice(0, allowance)
        : [];
      this.budget -= selected.length;
    }
    for (const record of selected.slice(0, 6)) this.launch(record, now);
    if (this.arcs.length > 80) this.arcs.splice(0, this.arcs.length - 80);
  }

  private launch(record: Payment, now: number) {
    const size = clamp(Math.log10(record.amount / 5) / 3.8, 0, 1);
    if (record.city === 0) {
      this.ripples.push({ city: 0, born: now, dur: 1, size, strong: true });
      return;
    }
    const from = CITY_VECTORS[record.city];
    const omega = Math.acos(clamp(dot(from, HOME_VECTOR), -1, 1));
    const ratio = omega / Math.PI;
    this.arcs.push({
      tx: record,
      born: now,
      dur: 1.05 + 1.1 * ratio,
      from,
      omega,
      lift: 0.04 + 0.24 * ratio,
      width: 1 + 1.6 * size,
      landed: false,
    });
    this.ripples.push({ city: record.city, born: now, dur: 0.8, size: 0.6 * size, strong: false });
  }

  private updateCamera(dt: number, now: number) {
    if (this.drag?.moved) return;
    if (this.move) {
      const move = this.move;
      [move.p, move.v] = springStep(move.p, move.v, 1, 40, 12.6, dt);
      const amount = clamp(move.p, 0, 1.02);
      const vector = slerp(move.from, move.to, amount, move.omega);
      this.lat = clamp(Math.asin(clamp(vector[1], -1, 1)), -Math.PI / 2, Math.PI / 2);
      this.lon = Math.atan2(vector[0], vector[2]);
      this.zoom =
        move.zoomFrom +
        (move.zoomTo - move.zoomFrom) * amount -
        0.16 * Math.sin(Math.PI * clamp(amount, 0, 1)) * (move.omega / Math.PI);
      if (Math.abs(move.p - 1) < 5e-4 && Math.abs(move.v) < 0.005) this.move = null;
      return;
    }

    const intro =
      this.introStart < 0 ? 0 : 1 - smoothstep(0, 1.6, now - this.introStart);
    const offset = Math.atan2(Math.sin(this.lon - HOME_LON), Math.cos(this.lon - HOME_LON));
    if (offset < -DRIFT_BAND) this.drift = 1;
    else if (offset > DRIFT_BAND) this.drift = -1;

    const target = this.reduced || this.focus ? 0 : 0.07 * this.drift * (1 + 5 * intro);
    this.vLon += (target - this.vLon) * (1 - Math.exp(-dt / (intro > 0 ? 0.5 : 1.4)));
    this.lon += this.vLon * dt;

    const restLat = this.focus ? clamp(this.lat, -MAX_LAT, MAX_LAT) : MIN_LAT;
    [this.lat, this.vLat] = springStep(this.lat, this.vLat, restLat, 9, 6, dt);

    const restZoom = this.focus
      ? this.focus.kind === "city"
        ? 1.3
        : 1.08
      : 1;
    [this.zoom, this.vZoom] = springStep(this.zoom, this.vZoom, restZoom, 60, 15.5, dt);
    if (this.reduced) {
      this.zoom = restZoom;
      this.vZoom = 0;
      this.vLat = 0;
    }
  }

  private frame(timestamp: number) {
    const now = timestamp / 1000;
    const dt = this.last ? clamp((timestamp - this.last) / 1000, 0, 0.05) : 1 / 60;
    this.last = timestamp;

    this.advance(dt, now);
    this.updateCamera(dt, now);
    this.draw(now);
    this.updateHover();

    if (timestamp - this.lastTick > (this.mode === "live" ? 380 : 171)) {
      this.lastTick = timestamp;
      const landed = this.arcs
        .filter((arc) => !arc.landed && arc.tx.t <= this.clock)
        .map((arc) => arc.tx);
      const key = `${this.clock}|${landed.map((record) => record.id).join(",")}`;
      if (key !== this.tickKey) {
        this.tickKey = key;
        this.snapshot = snapshotAt(this.clock, landed);
        this.events.tick(this.snapshot);
      }
    }

    this.events.frame(this.clock, this.liveNow);
    if (this.reduced) {
      this.last = 0;
      return;
    }
    if (this.running) this.schedule();
    else this.last = 0;
  }

  private updateHover() {
    const city =
      this.pointer.inside && !this.drag?.moved
        ? this.hitCity(this.pointer.x, this.pointer.y, 14)
        : null;
    if (city !== this.hover) {
      this.hover = city;
      this.events.hover(city);
    }
    const cursor = this.drag?.moved ? "grabbing" : city !== null ? "pointer" : "grab";
    if (cursor !== this.cursor) {
      this.cursor = cursor;
      this.canvas.style.cursor = cursor;
    }
    const anchor =
      this.hover ??
      this.peeked ??
      (this.focus?.kind === "city" ? this.focus.index : null);
    if (anchor === null) {
      this.events.anchor(null, 0, 0, false);
    } else {
      this.events.anchor(
        anchor,
        this.cityX[anchor],
        this.cityY[anchor],
        this.cityZ[anchor] > 0.08,
      );
    }
  }
  private draw(now: number) {
    const ctx = this.ctx;
    const dots = this.dots;
    if (!ctx || !dots || !this.w) return;
    const { fg, accent, surface, border, secondary } = this.colors;
    const width = this.w;
    const height = this.h;
    const cx = width / 2;
    const cy = height / 2;
    const radius = this.baseR * this.zoom;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    const sinLat = Math.sin(this.lat);
    const cosLat = Math.cos(this.lat);
    const sinLon = Math.sin(this.lon);
    const cosLon = Math.cos(this.lon);

    const project = (
      x: number,
      y: number,
      z: number,
      target: [number, number, number, number],
    ) => {
      const east = x * cosLon - z * sinLon;
      const depth = x * sinLon + z * cosLon;
      const plane = y * cosLat - depth * sinLat;
      target[0] = cx + radius * east;
      target[1] = cy - radius * plane;
      target[2] = y * sinLat + depth * cosLat;
      target[3] = east * east + plane * plane;
      return target;
    };

    const point: [number, number, number, number] = [0, 0, 0, 0];

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.028;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const sunAngle = (12 - this.clock / 3600) * 15 * DEG;
    const sunSin = Math.sin(sunAngle);
    const sunCos = Math.cos(sunAngle);
    const intro =
      this.introStart < 0
        ? this.reduced
          ? 1
          : 0
        : easeEnter(clamp((now - this.introStart) / 1.5, 0, 1));
    const introAngle = intro * (Math.PI / 2 + 0.5);

    const counts = this.counts;
    counts.fill(0);
    const { x: dx, y: dy, z: dz, land, count } = dots;

    for (let index = 0; index < count; index++) {
      const east = dx[index] * cosLon - dz[index] * sinLon;
      const depth = dx[index] * sinLon + dz[index] * cosLon;
      const facing = dy[index] * sinLat + depth * cosLat;
      if (facing <= 0) {
        this.bucket[index] = -1;
        continue;
      }
      let alpha = 0.16 + 0.84 * Math.pow(facing, 0.65);
      alpha *= 0.52 + 0.48 * smoothstep(-0.12, 0.16, dx[index] * sunSin + dz[index] * sunCos);
      if (intro < 1) {
        alpha *= smoothstep(introAngle, introAngle - 0.45, Math.acos(Math.min(1, facing)));
      }
      if (alpha < 0.02) {
        this.bucket[index] = -1;
        continue;
      }
      const bucket = Math.min(7, Math.floor(8 * alpha)) + 8 * (land[index] ? 0 : 1);
      this.bucket[index] = bucket;
      this.px[index] = cx + radius * east;
      this.py[index] = cy - radius * (dy[index] * cosLat - depth * sinLat);
      counts[bucket]++;
    }

    const offsets = this.offsets;
    for (let index = 0; index < ARC_BUCKETS; index++) {
      offsets[index + 1] = offsets[index] + counts[index];
    }
    const cursorAt = this.cursorAt;
    cursorAt.set(offsets.subarray(0, ARC_BUCKETS));
    for (let index = 0; index < count; index++) {
      const bucket = this.bucket[index];
      if (bucket >= 0) this.order[cursorAt[bucket]++] = index;
    }

    const unit = dots.step * DEG * radius;
    const landRadius = clamp(0.2 * unit, 0.75, 1.6);
    const seaRadius = clamp(0.12 * unit, 0.5, 0.9);

    ctx.fillStyle = fg;
    for (let bucket = 0; bucket < ARC_BUCKETS; bucket++) {
      if (offsets[bucket] === offsets[bucket + 1]) continue;
      const isLand = bucket < 8;
      const strength = ((bucket % 8) + 0.5) / 8;
      ctx.globalAlpha = strength * (isLand ? 0.6 : 0.22);
      ctx.beginPath();
      const size = isLand ? landRadius * (0.7 + 0.3 * strength) : seaRadius;
      for (let slot = offsets[bucket]; slot < offsets[bucket + 1]; slot++) {
        const index = this.order[slot];
        if (isLand) {
          ctx.moveTo(this.px[index] + size, this.py[index]);
          ctx.arc(this.px[index], this.py[index], size, 0, 2 * Math.PI);
        } else {
          ctx.rect(this.px[index] - size, this.py[index] - size, 2 * size, 2 * size);
        }
      }
      ctx.fill();
    }

    const active = this.focus;
    const lit = (index: number) =>
      !active ||
      (active.kind === "city"
        ? active.index === index || index === 0
        : CITIES[index].region === active.index || index === 0);

    let peak = 1;
    for (let index = 0; index < CITY_COUNT; index++) {
      peak = Math.max(peak, this.snapshot.cityRevenue[index]);
    }
    for (let index = 0; index < CITY_COUNT; index++) {
      const vector = CITY_VECTORS[index];
      project(vector[0], vector[1], vector[2], point);
      this.cityX[index] = point[0];
      this.cityY[index] = point[1];
      this.cityZ[index] = point[2];
      if (point[2] <= 0 || index === 0) continue;
      const size =
        1.3 + 2.1 * Math.sqrt(Math.max(0, this.snapshot.cityRevenue[index]) / peak);
      ctx.globalAlpha = (0.25 + 0.75 * point[2]) * (lit(index) ? 0.72 : 0.25) * Math.min(1, 1.4 * intro);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(point[0], point[1], size, 0, 2 * Math.PI);
      ctx.fill();
    }

    const alive: Arc[] = [];
    const arcPoint: [number, number, number, number] = [0, 0, 0, 0];
    const depthBucket = (target: [number, number, number, number]) =>
      target[2] >= 0 ? 4 : target[3] > 1 ? Math.round(4 * smoothstep(-0.4, 0, target[2])) : 0;

    const strokeArc = (arc: Arc, from: number, to: number, lift: number, alpha: number) => {
      const steps = Math.max(2, Math.ceil((to - from) * 56));
      const arcSin = Math.sin(arc.omega);
      let previousX = 0;
      let previousY = 0;
      let drawing = 0;
      let lastBucket = 0;
      for (let step = 0; step <= steps; step++) {
        const amount = from + ((to - from) * step) / steps;
        const left = Math.sin((1 - amount) * arc.omega) / arcSin;
        const right = Math.sin(amount * arc.omega) / arcSin;
        const swell = 1 + lift * Math.sin(Math.PI * amount);
        project(
          (arc.from[0] * left + HOME_VECTOR[0] * right) * swell,
          (arc.from[1] * left + HOME_VECTOR[1] * right) * swell,
          (arc.from[2] * left + HOME_VECTOR[2] * right) * swell,
          arcPoint,
        );
        const bucket = depthBucket(arcPoint);
        const visible = step ? Math.min(bucket, lastBucket) : 0;
        if (visible !== drawing) {
          if (drawing) ctx.stroke();
          if (visible) {
            ctx.globalAlpha = (alpha * visible) / 4;
            ctx.beginPath();
            ctx.moveTo(previousX, previousY);
          }
          drawing = visible;
        }
        if (drawing) ctx.lineTo(arcPoint[0], arcPoint[1]);
        previousX = arcPoint[0];
        previousY = arcPoint[1];
        lastBucket = bucket;
      }
      if (drawing) ctx.stroke();
      return lastBucket / 4;
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const arc of this.reduced ? [] : this.arcs) {
      const age = now - arc.born;
      const fade = 0.55 * arc.dur;
      if (age > arc.dur + 0.12 + fade) continue;
      alive.push(arc);
      if (!arc.landed && age >= arc.dur) {
        arc.landed = true;
        this.ripples.push({
          city: 0,
          born: arc.born + arc.dur,
          dur: 1.1,
          size: (arc.width - 1) / 1.6,
          strong: true,
        });
      }
      const head = age < arc.dur ? easeInOut(age / arc.dur) : 1;
      const tail = age < arc.dur + 0.12 ? 0 : easeInOut((age - arc.dur - 0.12) / fade);
      const strength = age < arc.dur + 0.12 ? 1 : 1 - 0.6 * tail;
      const glow = lit(arc.tx.city) ? 1 : 0.22;
      if (head - tail < 0.002) continue;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      strokeArc(arc, tail, head, 0, 0.1 * strength * glow);
      ctx.strokeStyle = accent;
      ctx.lineWidth = arc.width;
      const landed = strokeArc(arc, tail, head, arc.lift, 0.92 * strength * glow);
      if (age < arc.dur && landed > 0) {
        ctx.globalAlpha = 0.92 * glow * landed;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(arcPoint[0], arcPoint[1], 0.9 * arc.width + 1.1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    if (!this.reduced) this.arcs = alive;

    if (this.reduced) {
      for (const record of this.stills) {
        const from = CITY_VECTORS[record.city];
        const omega = Math.acos(clamp(dot(from, HOME_VECTOR), -1, 1));
        const size = clamp(Math.log10(record.amount / 5) / 3.8, 0, 1);
        const still: Arc = {
          tx: record,
          born: 0,
          dur: 1,
          from,
          omega,
          lift: 0.04 + (omega / Math.PI) * 0.24,
          width: 1 + 1.6 * size,
          landed: true,
        };
        ctx.strokeStyle = accent;
        ctx.lineWidth = still.width;
        strokeArc(still, 0, 1, still.lift, 0.7 * (lit(record.city) ? 1 : 0.22));
      }
    }

    const ripplePoint: [number, number, number, number] = [0, 0, 0, 0];
    this.ripples = this.ripples.filter((ripple) => now - ripple.born < ripple.dur);
    for (const ripple of this.ripples) {
      const age = now - ripple.born;
      if (age < 0) continue;
      const progress = age / ripple.dur;
      if (this.cityZ[ripple.city] <= 0.02) continue;
      const anchor = CITY_VECTORS[ripple.city];
      const { east, north } = TANGENTS[ripple.city];
      const spread =
        easeEnter(progress) *
        (ripple.strong ? 0.045 + 0.05 * ripple.size : 0.02 + 0.03 * ripple.size);
      const cosSpread = Math.cos(spread);
      const sinSpread = Math.sin(spread);
      ctx.strokeStyle = ripple.strong ? accent : fg;
      ctx.globalAlpha =
        Math.pow(1 - progress, 1.6) * (ripple.strong ? 0.85 : 0.45) * (lit(ripple.city) ? 1 : 0.3);
      ctx.lineWidth = ripple.strong ? 1.4 : 1;
      ctx.beginPath();
      for (let step = 0; step <= 28; step++) {
        const angle = (step / 28) * Math.PI * 2;
        const alongEast = Math.cos(angle) * sinSpread;
        const alongNorth = Math.sin(angle) * sinSpread;
        project(
          anchor[0] * cosSpread + east[0] * alongEast + north[0] * alongNorth,
          anchor[1] * cosSpread + east[1] * alongEast + north[1] * alongNorth,
          anchor[2] * cosSpread + east[2] * alongEast + north[2] * alongNorth,
          ripplePoint,
        );
        if (step) ctx.lineTo(ripplePoint[0], ripplePoint[1]);
        else ctx.moveTo(ripplePoint[0], ripplePoint[1]);
      }
      ctx.stroke();
    }

    const homeDepth = this.cityZ[0];
    if (homeDepth > 0) {
      const x = this.cityX[0];
      const y = this.cityY[0];
      const alpha = (0.35 + 0.65 * homeDepth) * Math.min(1, 1.4 * intro);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = surface;
      ctx.beginPath();
      ctx.arc(x, y, 5.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, 2 * Math.PI);
      ctx.fill();
      this.label("San Francisco", x + 10, y + 4, alpha, secondary, surface, 400);
    }

    const highlighted = new Set<number>();
    const boxes: number[][] = [];
    if (active?.kind === "city") highlighted.add(active.index);
    if (active?.kind === "region") {
      const revenue = this.snapshot.cityRevenue;
      CITIES.map((_, index) => index)
        .filter((index) => CITIES[index].region === active.index && index !== 0)
        .sort((left, right) => revenue[right] - revenue[left])
        .slice(0, 3)
        .forEach((index) => highlighted.add(index));
    }
    if (this.hover !== null) highlighted.add(this.hover);
    if (this.peeked !== null) highlighted.add(this.peeked);

    for (const index of highlighted) {
      const depth = this.cityZ[index];
      if (depth <= 0.08 || index === 0) continue;
      const x = this.cityX[index];
      const y = this.cityY[index];
      const isFocused = active?.kind === "city" && active.index === index;
      ctx.globalAlpha = 0.4 + 0.6 * depth;
      ctx.strokeStyle = isFocused ? accent : fg;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, 2 * Math.PI);
      ctx.stroke();
      if (this.hover === index || this.peeked === index || isFocused) continue;
      const box = [x + 9, y - 9, x + 15 + 6.6 * CITIES[index].name.length, y + 8];
      const overlaps = boxes.some(
        (other) =>
          box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1],
      );
      if (overlaps) continue;
      boxes.push(box);
      this.label(CITIES[index].name, x + 11, y + 4, 0.4 + 0.6 * depth, fg, surface, 500);
    }

    ctx.globalAlpha = 1;
  }

  private label(
    text: string,
    x: number,
    y: number,
    alpha: number,
    fill: string,
    halo: string,
    weight: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.font = `${weight} 12px ${this.font}`;
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = halo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

}

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

function Ticker({
  value,
  prefix = "",
  reduce,
}: {
  value: number;
  prefix?: string;
  reduce: boolean;
}) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (latest) => prefix + formatCount(Math.round(latest)));

  useEffect(() => {
    if (reduce) {
      motionValue.jump(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: motionTokens.duration.considered,
      ease: [...motionTokens.ease.standard] as [number, number, number, number],
    });
    return () => controls.stop();
  }, [value, reduce, motionValue]);

  return (
    <motion.span className={styles.ticker} aria-hidden="true">
      {text}
    </motion.span>
  );
}

function Stat({
  label,
  value,
  prefix,
  reduce,
}: {
  label: string;
  value: number;
  prefix?: string;
  reduce: boolean;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        <Ticker value={value} prefix={prefix} reduce={reduce} />
        <span className={styles.srOnly}>
          {(prefix ?? "") + formatCount(Math.round(value))}
        </span>
      </span>
    </div>
  );
}

function CityTip({ city, snapshot }: { city: number; snapshot: Snapshot }) {
  const entry = CITIES[city];
  const local = (((snapshot.t + 3600 * entry.tz) % 86400) + 86400) % 86400;
  const share =
    snapshot.total > 0 ? (snapshot.cityRevenue[city] / snapshot.total) * 100 : 0;

  return (
    <>
      <div className={styles.tipHead}>
        <span className={styles.tipName}>{entry.name}</span>
        <span className={styles.tipMeta}>
          {city === 0 ? "Headquarters" : REGIONS[entry.region].name} ·{" "}
          {clockTime(local, false)} local
        </span>
      </div>
      <dl className={styles.tipStats}>
        <div>
          <dt>Today</dt>
          <dd>{formatMoney(snapshot.cityRevenue[city])}</dd>
        </div>
        <div>
          <dt>Payments</dt>
          <dd>{formatCount(snapshot.cityCount[city])}</dd>
        </div>
        <div>
          <dt>Share</dt>
          <dd>{share.toFixed(1)}%</dd>
        </div>
      </dl>
    </>
  );
}

const HOURS = ["00:00", "06:00", "12:00", "18:00", "24:00"];
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useSyncExternalStoreReduced() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

function setSliderAria(element: HTMLElement, time: number, live: number) {
  element.setAttribute("aria-valuenow", String(Math.round(time)));
  element.setAttribute("aria-valuetext", `${clockTime(time, false)} UTC`);
  element.setAttribute("aria-valuemax", String(Math.round(live)));
}

const forecastShare = (value: number, forecast: number) =>
  forecast > 0 ? Math.round((value / forecast) * 100) : 0;

/* ------------------------------------------------------------------ *
 * Block
 * ------------------------------------------------------------------ */

export function RevenueGlobe() {
  const reduce = useSyncExternalStoreReduced();
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotAt(60120));
  const [mode, setMode] = useState<Mode>("live");
  const [focus, setFocus] = useState<Focus>(null);
  const [tip, setTip] = useState<{ city: number | null; shown: boolean }>({
    city: null,
    shown: false,
  });
  const [announce, setAnnounce] = useState("");

  const [bins] = useState(() => {
    const values = buildDay().bins;
    const peak = Math.max(...values);
    return values.map((value) => value / peak);
  });
  const [forecast] = useState(() => buildDay().forecast);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const playedRef = useRef<SVGRectElement | null>(null);
  const availableRef = useRef<SVGRectElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);

  const tipX = useMotionValue(0);
  const tipY = useMotionValue(0);
  const tipSpringX: MotionValue<number> = useSpring(tipX, motionTokens.spring.responsive);
  const tipSpringY: MotionValue<number> = useSpring(tipY, motionTokens.spring.responsive);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const slider = sliderRef.current;
    if (!host || !canvas || !slider) return;

    let tipState = { city: null as number | null, shown: false };
    let clockText = "";
    let lastAria = 0;

    const engine = new GlobeEngine(canvas, host, reduce, {
      tick: setSnapshot,
      mode: (next) => {
        setMode(next);
        setAnnounce(
          next === "live"
            ? "Back to live"
            : next === "replay"
              ? "Replaying today"
              : "Paused",
        );
      },
      focus: (next) => {
        setFocus(next);
        setAnnounce(
          next
            ? next.kind === "city"
              ? `Camera on ${CITIES[next.index].name}`
              : `Camera on ${REGIONS[next.index].name}`
            : "Selection cleared",
        );
      },
      hover: () => {},
      anchor: (city, x, y, shown) => {
        const clampX = Math.min(Math.max(x, 120), host.clientWidth - 108 - 12);
        const clampY = Math.max(y, 132);
        if (shown && (!tipState.shown || tipState.city === null)) {
          tipX.jump(clampX);
          tipY.jump(clampY);
          tipSpringX.jump(clampX);
          tipSpringY.jump(clampY);
        } else if (shown) {
          tipX.set(clampX);
          tipY.set(clampY);
        }
        if (city !== tipState.city || shown !== tipState.shown) {
          tipState = { city, shown };
          setTip(tipState);
        }
      },
      frame: (time, live) => {
        const played = (time / 86400) * 960;
        if (thumbRef.current) {
          thumbRef.current.style.transform = `translateX(${((time / 86400) * 100).toFixed(3)}cqw)`;
        }
        playedRef.current?.setAttribute("width", played.toFixed(1));
        availableRef.current?.setAttribute("width", ((live / 86400) * 960).toFixed(1));
        const text = clockTime(time);
        if (text !== clockText && clockRef.current) {
          clockRef.current.textContent = text;
          clockText = text;
        }
        const now = performance.now();
        if (now - lastAria > 600) {
          lastAria = now;
          setSliderAria(slider, time, live);
        }
      },
    });

    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [reduce, tipX, tipY, tipSpringX, tipSpringY]);

  const select = (next: Focus) => engineRef.current?.select(next);
  const isActive = (kind: "city" | "region", index: number) =>
    focus?.kind === kind && focus.index === index;

  const scrubTo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.scrubTo(((event.clientX - rect.left) / rect.width) * 86400);
  };

  const tipCity = tip.city;
  const leader = snapshot.top[0];
  const summary = `${formatMoney(snapshot.total)} revenue today from ${formatCount(
    snapshot.count,
  )} payments as of ${clockTime(snapshot.t, false)} UTC. ${REGIONS.map(
    (region, index) => `${region.name} ${compactMoney(snapshot.regions[index])}`,
  ).join(", ")}. ${CITIES[leader].name} leads.`;
  const itemTransition = {
    duration: reduce ? 0 : motionTokens.duration.standard,
    ease: [...motionTokens.ease.enter] as [number, number, number, number],
  };

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={`${id}-title`} className={styles.title}>
            Payments today
          </h2>
          <p className={styles.lede}>
            40 cities settling to San Francisco. Drag to spin, pick a city to fly
            there.
          </p>
        </div>
        <p className={styles.meta}>Tuesday, 22 September</p>
      </header>

      <div className={styles.stage}>
        <div className={styles.viz}>
          <div
            ref={hostRef}
            className={styles.globe}
            role="region"
            aria-roledescription="interactive globe"
            aria-label="Revenue globe. Arrow keys spin it, Escape clears the selection."
            aria-describedby={`${id}-summary`}
            tabIndex={0}
            onKeyDown={(event) => {
              const steps: Record<string, [number, number]> = {
                ArrowLeft: [1, 0],
                ArrowRight: [-1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              if (event.key in steps) {
                engineRef.current?.nudge(...steps[event.key]);
                event.preventDefault();
              } else if (event.key === "Escape") {
                engineRef.current?.clearFocus();
              }
            }}
          >
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
            <motion.div
              className={styles.tip}
              style={{ x: tipSpringX, y: tipSpringY, width: 216 }}
              initial={false}
              animate={
                tip.shown && tipCity !== null
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.96 }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      opacity: { duration: motionTokens.duration.fast },
                      scale: motionTokens.spring.snappy,
                    }
              }
              aria-hidden="true"
            >
              {tipCity !== null && <CityTip city={tipCity} snapshot={snapshot} />}
            </motion.div>
            <p id={`${id}-summary`} className={styles.srOnly}>
              {summary}
            </p>
          </div>

          <div className={styles.timeline}>
            <div className={styles.controls}>
              {!reduce && (
                <button
                  type="button"
                  className={styles.control}
                  onClick={() => engineRef.current?.replayDay()}
                >
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                  Replay today
                </button>
              )}
              {!reduce && (
                <button
                  type="button"
                  className={styles.iconControl}
                  aria-label={mode === "paused" ? "Play" : "Pause"}
                  onClick={() => engineRef.current?.togglePlay()}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={mode === "paused" ? "play" : "pause"}
                      className={styles.iconSwap}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{
                        duration: motionTokens.duration.fast,
                        ease: [...motionTokens.ease.standard] as [
                          number,
                          number,
                          number,
                          number,
                        ],
                      }}
                    >
                      {mode === "paused" ? (
                        <Play size={16} strokeWidth={1.75} />
                      ) : (
                        <Pause size={16} strokeWidth={1.75} />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </button>
              )}
              <span className={styles.clock}>
                <span ref={clockRef}>{clockTime(60120)}</span> UTC
              </span>
              <button
                type="button"
                className={styles.live}
                data-live={mode === "live"}
                aria-pressed={mode === "live"}
                onClick={() => engineRef.current?.goLive()}
              >
                <span className={styles.liveDot} aria-hidden="true" />
                {reduce ? "Now" : mode === "live" ? "Live" : "Go live"}
              </button>
            </div>

            <div
              ref={sliderRef}
              className={styles.slider}
              role="slider"
              tabIndex={0}
              aria-label="Time of day, UTC"
              aria-valuemin={0}
              aria-valuemax={60120}
              aria-valuenow={60120}
              aria-valuetext={`${clockTime(60120, false)} UTC`}
              onKeyDown={(event) => {
                const engine = engineRef.current;
                if (!engine) return;
                const small = event.shiftKey ? 3600 : 300;
                const moves: Record<string, number> = {
                  ArrowLeft: -small,
                  ArrowDown: -small,
                  ArrowRight: small,
                  ArrowUp: small,
                  PageDown: -3600,
                  PageUp: 3600,
                };
                if (event.key in moves) {
                  engine.seek(engine.time + moves[event.key]);
                } else if (event.key === "Home") {
                  engine.seek(0);
                } else if (event.key === "End") {
                  engine.goLive();
                } else {
                  return;
                }
                event.preventDefault();
                setSliderAria(event.currentTarget, engine.time, engine.live);
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                engineRef.current?.scrubStart();
                scrubTo(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubTo(event);
              }}
              onPointerUp={() => engineRef.current?.scrubEnd()}
              onPointerCancel={() => engineRef.current?.scrubEnd()}
            >
              <svg
                className={styles.bins}
                viewBox="0 0 960 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <clipPath id={`${id}-available`}>
                    <rect ref={availableRef} x="0" y="0" width={668} height="40" />
                  </clipPath>
                  <clipPath id={`${id}-played`}>
                    <rect ref={playedRef} x="0" y="0" width={668} height={40} />
                  </clipPath>
                </defs>
                <g className={styles.binsFuture}>
                  {bins.map((_, index) => (
                    <rect
                      key={index}
                      x={10 * index + 1.5}
                      y={38.5}
                      width={7}
                      height={1.5}
                    />
                  ))}
                </g>
                <g className={styles.binsBase} clipPath={`url(#${id}-available)`}>
                  {bins.map((value, index) => (
                    <rect
                      key={index}
                      x={10 * index + 1.5}
                      y={40 - Math.max(1.5, 36 * value)}
                      width={7}
                      height={Math.max(1.5, 36 * value)}
                    />
                  ))}
                </g>
                <g className={styles.binsPlayed} clipPath={`url(#${id}-played)`}>
                  {bins.map((value, index) => (
                    <rect
                      key={index}
                      x={10 * index + 1.5}
                      y={40 - Math.max(1.5, 36 * value)}
                      width={7}
                      height={Math.max(1.5, 36 * value)}
                    />
                  ))}
                </g>
              </svg>
              <span
                ref={thumbRef}
                className={styles.thumb}
                style={{ transform: `translateX(${(0.6958333333333333 * 100).toFixed(3)}cqw)` }}
                aria-hidden="true"
              >
                <span className={styles.thumbLine} />
              </span>
            </div>

            <div className={styles.hours} aria-hidden="true">
              {HOURS.map((hour) => (
                <span key={hour}>{hour}</span>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.panel} aria-label="Key numbers">
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Revenue today</span>
            <span className={styles.kpiValue}>
              <Ticker value={snapshot.total} prefix="$" reduce={reduce} />
              <span className={styles.srOnly}>{formatMoney(snapshot.total)}</span>
            </span>
            <div className={styles.stats}>
              <Stat label="Payments" value={snapshot.count} reduce={reduce} />
              <Stat label="Last hour" value={snapshot.lastHour} prefix="$" reduce={reduce} />
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>Regions</h3>
              <span>Today vs forecast</span>
            </div>
            <ul className={styles.list}>
              {REGIONS.map((region, index) => {
                const revenue = snapshot.regions[index];
                return (
                  <li key={region.id}>
                    <button
                      type="button"
                      className={styles.row}
                      aria-pressed={isActive("region", index)}
                      onClick={() => select({ kind: "region", index })}
                    >
                      <span className={styles.rowHead}>
                        <span className={styles.rowName}>
                          {region.name}
                          <span className={styles.rowMeta}>
                            {forecastShare(revenue, forecast[index])}% of forecast
                          </span>
                        </span>
                        <span className={styles.rowValue}>
                          <Ticker value={revenue} prefix="$" reduce={reduce} />
                          <span className={styles.srOnly}>{formatMoney(revenue)}</span>
                        </span>
                      </span>
                      <span className={styles.bar} aria-hidden="true">
                        <span className={styles.track}>
                          <motion.span
                            className={styles.fill}
                            initial={false}
                            animate={{ scaleX: Math.min(1, revenue / forecast[index]) }}
                            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
                          />
                        </span>
                      </span>
                      <span className={styles.srOnly}>
                        , {forecastShare(revenue, snapshot.total)}% of today’s revenue,
                        forecast {compactMoney(forecast[index])}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.group}>
            <div className={styles.groupHead}>
              <h3>Top cities</h3>
              <span>Today</span>
            </div>
            <ol className={styles.list}>
              <AnimatePresence initial={false} mode="popLayout">
                {snapshot.top.map((city) => (
                  <motion.li
                    key={city}
                    layout={!reduce}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { layout: motionTokens.spring.smooth, default: itemTransition }
                    }
                  >
                    <button
                      type="button"
                      className={`${styles.row} ${styles.cityRow}`}
                      aria-pressed={isActive("city", city)}
                      onClick={() => select({ kind: "city", index: city })}
                      onFocus={() => engineRef.current?.peek(city)}
                      onBlur={() => engineRef.current?.peek(null)}
                      onPointerMove={() => engineRef.current?.peek(city)}
                      onPointerLeave={() => engineRef.current?.peek(null)}
                    >
                      <span className={styles.rowName}>
                        {CITIES[city].name}
                        <span className={styles.rowMeta}>{CITIES[city].country}</span>
                      </span>
                      <span className={styles.rowValue}>
                        <Ticker value={snapshot.cityRevenue[city]} prefix="$" reduce={reduce} />
                        <span className={styles.srOnly}>
                          {formatMoney(snapshot.cityRevenue[city])}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
        </aside>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>

      <div className={styles.srOnly}>
        <table>
          <caption>Revenue by city today, as of {clockTime(snapshot.t, false)} UTC</caption>
          <thead>
            <tr>
              <th scope="col">City</th>
              <th scope="col">Region</th>
              <th scope="col">Revenue</th>
              <th scope="col">Payments</th>
            </tr>
          </thead>
          <tbody>
            {CITIES.map((entry, index) => (
              <tr key={entry.name}>
                <th scope="row">{entry.name}</th>
                <td>{REGIONS[entry.region].name}</td>
                <td>{formatMoney(snapshot.cityRevenue[index])}</td>
                <td>{formatCount(snapshot.cityCount[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RevenueGlobe;
