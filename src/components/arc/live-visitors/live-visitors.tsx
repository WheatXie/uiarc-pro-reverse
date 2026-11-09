"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause } from "lucide-react";
import Button from "../button/button";
import Tooltip from "../tooltip/tooltip";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./live-visitors.module.css";

export interface LivePage {
  /** Path shown in the list, for example "/pricing". */
  path: string;
  /** People on that page right now. */
  visitors: number;
}

export interface LiveVisitorPing {
  /** Stable id. New ids ping in, removed ids fade out. */
  id: string;
  /** Latitude of the arrival, in degrees. */
  lat: number;
  /** Longitude of the arrival, in degrees. */
  lon: number;
  /** "event" draws a stronger ring than a plain visit. */
  kind?: "visit" | "event";
  /** Arrival time in ms. The simulated stream drops pings older than 6.4s. */
  born?: number;
}

export interface LiveVisitorEvent {
  /** Stable id. New ids fade in at the top of the list. */
  id: string;
  /** What happened, for example "Signed up" or "Upgraded to Pro". */
  label: string;
  /** City shown in the row. */
  city: string;
  /** ISO alpha-2 code. US, GB, DE, FR, NL, SE, CH, JP, IN and BR have built-in flags. */
  country: string;
  /** Time of the event; a Date or an epoch in ms. */
  at: number | string | Date;
  /** Latitude for the map label shown for 2s after the event arrives. */
  lat?: number;
  /** Longitude for the map label shown for 2s after the event arrives. */
  lon?: number;
  /** Overrides the built-in flag for this country. */
  flag?: ReactNode;
}

export type LiveVisitorsConnection = "live" | "connecting" | "reconnecting";

export interface LiveVisitorsProps {
  /** People on the site right now. Leave it out to play the built-in simulated stream; once set, the card shows only the data you pass. */
  count?: number;
  /** Pages with people on them. The card sorts them and lists the top few with bars scaled to the busiest page. */
  pages?: LivePage[];
  /** Recent arrivals as map dots. Keep it to the last few seconds of arrivals. */
  visitors?: LiveVisitorPing[];
  /** Recent conversions, newest first. */
  events?: LiveVisitorEvent[];
  /** The stream's state. connecting shows placeholders in the same space; reconnecting keeps the last data and switches the status to a warning dot. */
  connection?: LiveVisitorsConnection;
  /** Controls the pause state. While paused the card holds the last snapshot, whatever you keep passing. */
  paused?: boolean;
  /** Starts paused when uncontrolled. */
  defaultPaused?: boolean;
  /** Called from the pause button. Use it to close or pause your own subscription. */
  onPausedChange?: (paused: boolean) => void;
  /** Hides the pause button. */
  hidePause?: boolean;
  /** The words after the number, pluralized from the count. */
  label?: (count: number) => string;
  /** How many pages to list. */
  maxPages?: number;
  /** How many events to list. */
  maxEvents?: number;
  /** Accessible name of the card. */
  title?: string;
  /** Extra class on the card. It is at most 640px wide and fills narrower containers. */
  className?: string;
}

export interface LiveVisitorsState {
  count: number;
  pages: LivePage[];
  visitors: LiveVisitorPing[];
  events: LiveVisitorEvent[];
}

interface LiveCity {
  city: string;
  country: string;
  lat: number;
  lon: number;
  weight: number;
}

type Rng = () => number;

const MAP_HEIGHT = Math.round(216);
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const ROW_HEIGHT = 36;
const LIST_INSET = 4;
const SAMPLE_LABEL = "Sample data";
const DEFAULT_LABEL = (count: number) => `${count === 1 ? "person" : "people"} on the site now`;
const STATE_WORDS: Record<string, string> = { live: "Live", paused: "Paused", connecting: "Connecting", reconnecting: "Reconnecting" };
const SKELETON_WIDTHS = [88, 72, 60, 44, 36, 28];

/** [lon, lat] pairs per land mass, drawn as a dotted map. */
const LAND: readonly (readonly number[])[] = [
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

const CITIES: readonly LiveCity[] = [
          {
            city: "San Francisco",
            country: "US",
            lat: 37.77,
            lon: -122.42,
            weight: 9,
          },
          { city: "New York", country: "US", lat: 40.71, lon: -74, weight: 9 },
          { city: "Austin", country: "US", lat: 30.27, lon: -97.74, weight: 4 },
          {
            city: "Seattle",
            country: "US",
            lat: 47.6,
            lon: -122.33,
            weight: 4,
          },
          {
            city: "Chicago",
            country: "US",
            lat: 41.88,
            lon: -87.63,
            weight: 3,
          },
          { city: "London", country: "GB", lat: 51.5, lon: -0.12, weight: 8 },
          {
            city: "Manchester",
            country: "GB",
            lat: 53.48,
            lon: -2.24,
            weight: 2,
          },
          { city: "Berlin", country: "DE", lat: 52.52, lon: 13.4, weight: 6 },
          { city: "Munich", country: "DE", lat: 48.14, lon: 11.58, weight: 3 },
          { city: "Paris", country: "FR", lat: 48.86, lon: 2.35, weight: 5 },
          { city: "Amsterdam", country: "NL", lat: 52.37, lon: 4.9, weight: 4 },
          {
            city: "Stockholm",
            country: "SE",
            lat: 59.33,
            lon: 18.07,
            weight: 3,
          },
          { city: "Zurich", country: "CH", lat: 47.37, lon: 8.54, weight: 3 },
          { city: "Tokyo", country: "JP", lat: 35.68, lon: 139.69, weight: 5 },
          { city: "Osaka", country: "JP", lat: 34.69, lon: 135.5, weight: 2 },
          {
            city: "Bengaluru",
            country: "IN",
            lat: 12.97,
            lon: 77.59,
            weight: 5,
          },
          { city: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, weight: 3 },
          {
            city: "S\xe3o Paulo",
            country: "BR",
            lat: -23.55,
            lon: -46.63,
            weight: 4,
          },
          {
            city: "Rio de Janeiro",
            country: "BR",
            lat: -22.9,
            lon: -43.2,
            weight: 2,
          },
        ];

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  CH: "Switzerland",
  JP: "Japan",
  IN: "India",
  BR: "Brazil",
};

const CITY_WEIGHT = CITIES.reduce((total, city) => total + city.weight, 0);

function pickCity(rng: Rng): LiveCity {
  let rest = rng() * CITY_WEIGHT;
  for (const city of CITIES) if ((rest -= city.weight) <= 0) return city;
  return CITIES[0];
}

const latJitter = (rng: Rng) => (rng() - 0.5) * 2.4;

function makePing(rng: Rng, seq: number, born: number, city: LiveCity = pickCity(rng), kind: LiveVisitorPing["kind"] = "visit"): LiveVisitorPing {
  return { id: `v${seq}`, lat: city.lat + latJitter(rng), lon: city.lon + latJitter(rng), kind, born };
}

function mulberry32(seed: number): Rng {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function createInitialState(): LiveVisitorsState & { tick: number; seq: number } {
  const rng = mulberry32(128);
  const now = Date.now();
  const visitors = Array.from({ length: 14 }, (_, index) => makePing(rng, index, now - 420 * index));
  const event = (id: string, label: string, cityName: string, age: number): LiveVisitorEvent => {
    const city = CITIES.find(item => item.city === cityName) as LiveCity;
    return { id, label, city: city.city, country: city.country, lat: city.lat, lon: city.lon, at: now - age };
  };
  return {
    count: 128,
    pages: [
      { path: "/pricing", visitors: 31 },
      { path: "/docs/quickstart", visitors: 24 },
      { path: "/", visitors: 19 },
      { path: "/changelog", visitors: 12 },
      { path: "/blog/realtime-analytics", visitors: 10 },
    ],
    visitors,
    events: [
      event("e4", "Signed up", "Berlin", 3e3),
      event("e3", "Upgraded to Pro", "San Francisco", 16e3),
      event("e2", "Signed up", "Tokyo", 38e3),
      event("e1", "Signed up", "London", 71e3),
    ],
    tick: 0,
    seq: 100,
  };
}

/** One step of the simulated stream: a new arrival, drifting counts, and the odd signup or upgrade. */
function advance(state: ReturnType<typeof createInitialState>): ReturnType<typeof createInitialState> {
  const rng = Math.random;
  const now = Date.now();
  const tick = state.tick + 1;
  let seq = state.seq;
  const visitors = state.visitors.filter(ping => now - (ping.born ?? 0) < 6400);
  const arrivals = rng() < 0.3 ? 2 : 1;
  for (let index = 0; index < arrivals; index++) visitors.push(makePing(rng, ++seq, now));
  let count = state.count;
  if (tick % 2 === 0) {
    const pull = count > 148 ? -2 : 2 * Number(count < 116);
    count = Math.max(0, count + Math.round(7 * rng() - 3) + pull);
  }
  let pages = state.pages;
  if (tick % 2 === 1) {
    pages = pages.map(page => ({ ...page }));
    for (let index = 0; index < 2; index++) {
      const page = pages[Math.floor(rng() * pages.length)];
      const step = (rng() < 0.52 ? 1 : -1) * (1 + Math.floor(2 * rng()));
      page.visitors = Math.max(3, Math.min(48, page.visitors + step));
    }
  }
  let events = state.events;
  if (tick % 4 === 0) {
    const city = pickCity(rng);
    const roll = rng();
    events = [
      {
        id: `e${++seq}`,
        label: roll < 0.14 ? "Upgraded to Team" : roll < 0.32 ? "Upgraded to Pro" : "Signed up",
        city: city.city,
        country: city.country,
        lat: city.lat,
        lon: city.lon,
        at: now,
      },
      ...events,
    ].slice(0, 6);
    visitors.push({ ...makePing(rng, ++seq, now, city, "event"), lat: city.lat, lon: city.lon });
  }
  return { count, pages, visitors, events, tick, seq };
}

/** The simulated stream behind the default demo: about 128 people, a new arrival every 600ms, drifting page counts and a signup or upgrade every 2.4s. */
export function useLiveVisitorsSimulation(active = true): LiveVisitorsState {
  const [state, setState] = useState(createInitialState);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setState(advance), 600);
    return () => window.clearInterval(timer);
  }, [active]);
  return state;
}

const project = (lat: number, lon: number) => ({ x: ((lon - -170) / 350) * 600, y: ((76 - lat) / 126) * MAP_HEIGHT });

interface LandBox {
  ring: readonly number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

let landBoxes: LandBox[] | null = null;
let landPoints: string | null = null;

function inLand(lon: number, lat: number) {
  landBoxes ??= LAND.map(ring => {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (let index = 0; index < ring.length; index += 2) {
      minX = Math.min(minX, ring[index]);
      maxX = Math.max(maxX, ring[index]);
      minY = Math.min(minY, ring[index + 1]);
      maxY = Math.max(maxY, ring[index + 1]);
    }
    return { ring, minX, maxX, minY, maxY };
  });
  let inside = false;
  for (const box of landBoxes) {
    if (lon < box.minX || lon > box.maxX || lat < box.minY || lat > box.maxY) continue;
    const ring = box.ring;
    const count = ring.length / 2;
    for (let point = 0, previous = count - 1; point < count; previous = point++) {
      const x1 = ring[2 * point], y1 = ring[2 * point + 1], x2 = ring[2 * previous], y2 = ring[2 * previous + 1];
      if (y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
    }
  }
  return inside;
}

/** The dotted map: a dot every 6.25px wherever a land mass covers that point. Built once. */
function landPath() {
  if (landPoints) return landPoints;
  let drawing = "";
  for (let y = 3.125; y < MAP_HEIGHT; y += 6.25) {
    const lat = 76 - (y / MAP_HEIGHT) * 126;
    for (let x = 3.125; x < 600; x += 6.25) if (inLand(-170 + (x / 600) * 350, lat)) drawing += `M${x.toFixed(2)} ${y.toFixed(2)}h0`;
  }
  landPoints = drawing;
  return drawing;
}

// The reference frame is server rendered, so `useSyncExternalStore(..., () => true, () => false)`
// reports false for the first paint and only flips after hydration. A client-only route has no
// server snapshot, so the equivalent gate is an effect: first paint renders the server markup,
// the mounted pass enables the enter animation.
const useHydrated = () => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
};

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-play"
      aria-hidden="true"
    >
      <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
    </svg>
  );
}

function UnionJack() {
  const key = useId().replace(/:/g, "");
  return (
    <svg viewBox="10 0 40 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id={`${key}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${key}t)`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const STRIPES = Array.from({ length: 6 }, (_, index) => (
  <rect key={index} y={((2 * index + 1) * 12) / 13} width="16" height={12 / 13} fill="#fff" />
));

const FLAGS: Record<string, () => ReactNode> = {
  US: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#B22234" />
      {STRIPES}
      <rect width="6.4" height={84 / 13} fill="#3C3B6E" />
    </svg>
  ),
  GB: () => <UnionJack />,
  DE: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#000" />
      <rect y="4" width="16" height="4" fill="#DD0000" />
      <rect y="8" width="16" height="4" fill="#FFCE00" />
    </svg>
  ),
  FR: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="5.34" height="12" fill="#0055A4" />
      <rect x="5.33" width="5.34" height="12" fill="#fff" />
      <rect x="10.66" width="5.34" height="12" fill="#EF4135" />
    </svg>
  ),
  NL: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#AE1C28" />
      <rect y="4" width="16" height="4" fill="#fff" />
      <rect y="8" width="16" height="4" fill="#21468B" />
    </svg>
  ),
  SE: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#006AA7" />
      <rect x="5" width="2" height="12" fill="#FECC02" />
      <rect y="5" width="16" height="2" fill="#FECC02" />
    </svg>
  ),
  CH: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#DA291C" />
      <rect x="7" y="2.5" width="2" height="7" fill="#fff" />
      <rect x="4.5" y="5" width="7" height="2" fill="#fff" />
    </svg>
  ),
  JP: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#fff" />
      <circle cx="8" cy="6" r="3.6" fill="#BC002D" />
    </svg>
  ),
  IN: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#FF9933" />
      <rect y="4" width="16" height="4" fill="#fff" />
      <rect y="8" width="16" height="4" fill="#138808" />
      <circle cx="8" cy="6" r="1.5" fill="none" stroke="#000080" strokeWidth=".45" />
      <circle cx="8" cy="6" r=".4" fill="#000080" />
    </svg>
  ),
  BR: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#009C3B" />
      <path d="M8 1.3 14.6 6 8 10.7 1.4 6z" fill="#FFDF00" />
      <circle cx="8" cy="6" r="2.7" fill="#002776" />
      <path d="M5.4 5.4c1.8-.4 3.7 0 5.2 1" fill="none" stroke="#fff" strokeWidth=".5" />
    </svg>
  ),
};

function Flag({ code, className }: { code: string; className?: string }) {
  const key = code.toUpperCase();
  return (
    <span className={className} data-flag={key in FLAGS ? key : "none"} aria-hidden="true">
      {key in FLAGS ? FLAGS[key]() : null}
    </span>
  );
}

const toTime = (value: LiveVisitorEvent["at"]) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

function RollingNumber({ value, reduced, grow = false }: { value: number; reduced: boolean; grow?: boolean }) {
  const text = Math.max(0, Math.round(value)).toLocaleString("en-US");
  const enter = useHydrated() && grow;
  const chars = text.split("");
  return (
    <span className={styles.rolling} aria-hidden="true" data-reduced={reduced ? "" : undefined}>
      {chars.map((char, index) => {
        const place = chars.length - index;
        return /\d/.test(char) ? <RollingDigit key={place} digit={Number(char)} enter={enter} /> : <span key={`s${place}`}>{char}</span>;
      })}
    </span>
  );
}

function RollingDigit({ digit, enter }: { digit: number; enter: boolean }) {
  const [animate] = useState(enter);
  return (
    <span className={styles.digit} data-enter={animate ? "" : undefined}>
      <span className={styles.digitSizer}>0</span>
      <span className={styles.digitWindow}>
        <span className={styles.digitStrip} style={{ transform: `translateY(${-(10 * digit)}%)` }}>
          {"0123456789".split("").map(character => (
            <span key={character}>{character}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

/** Remembers the ids that were already there when the list first rendered, so only genuinely new rows animate in. */
function useInitialSet(ids: string[]) {
  const [set] = useState(() => new Set(ids));
  return set;
}

function VisitorMap({ visitors, events, reduced, hydrated }: { visitors: LiveVisitorPing[]; events: LiveVisitorEvent[]; reduced: boolean; hydrated: boolean }) {
  const land = useMemo(() => landPath(), []);
  const seenVisitors = useInitialSet(visitors.map(ping => ping.id));
  const seenEvents = useInitialSet(events.map(event => event.id));
  const newest = events[0];
  const pending = newest && !seenEvents.has(newest.id) && newest.lat !== undefined && newest.lon !== undefined ? newest : null;
  const [labelId, setLabelId] = useState<string | null>(null);
  const pendingId = pending?.id;
  useEffect(() => {
    if (!pendingId) return;
    const timer = window.setTimeout(() => setLabelId(pendingId), 2000);
    return () => window.clearTimeout(timer);
  }, [pendingId]);
  const labelled = pending && labelId !== pending.id ? pending : null;
  const point = labelled && labelled.lat !== undefined && labelled.lon !== undefined ? project(labelled.lat, labelled.lon) : null;
  const align = point ? (point.x / 600 > 0.8 ? "end" : point.x / 600 < 0.2 ? "start" : "center") : "center";
  return (
    <div className={styles.map} aria-hidden="true">
      <svg viewBox={`0 0 600 ${MAP_HEIGHT}`} className={styles.mapSvg}>
        <path d={land} className={styles.land} />
        <AnimatePresence initial={false}>
          {visitors.map(ping => {
            const { x, y } = project(ping.lat, ping.lon);
            const strong = ping.kind === "event";
            const entering = hydrated && !seenVisitors.has(ping.id) && !reduced;
            return (
              <motion.g
                key={ping.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.4 * Number(!reduced), ease: EASE } }}
              >
                {entering ? <circle cx={x} cy={y} r={strong ? 3.4 : 2.6} className={strong ? styles.ringStrong : styles.ring} /> : null}
                <circle cx={x} cy={y} r={strong ? 3.4 : 2.6} className={strong ? styles.pingStrong : styles.ping} />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {labelled && point ? (
          <motion.span
            key={labelled.id}
            className={styles.mapLabel}
            style={{ left: `${(point.x / 600) * 100}%`, top: `${(point.y / MAP_HEIGHT) * 100}%` }}
            initial={{ opacity: 0, y: 2 * Number(!reduced) }}
            animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: EASE } }}
          >
            <span className={styles.mapLabelInner} data-align={align}>
              {labelled.flag ?? <Flag code={labelled.country} className={styles.flag} />}
              <span>{labelled.city}</span>
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PagesList({ pages, max, connecting }: { pages: LivePage[]; max: number; connecting: boolean }) {
  const sorted = useMemo(() => pages.map((page, index) => ({ ...page, index })).sort((a, b) => b.visitors - a.visitors || a.index - b.index), [pages]);
  const seen = useInitialSet(sorted.slice(0, max + 1).map(page => page.path));
  const top = sorted[0]?.visitors || 1;
  const height = ROW_HEIGHT * max - LIST_INSET;
  if (connecting) return <SkeletonRows rows={max} height={height} bars />;
  if (!sorted.length) {
    return (
      <p className={styles.empty} style={{ height }}>
        No one is browsing right now
      </p>
    );
  }
  const rows = sorted.slice(0, max + 1);
  const shown = Math.min(max, sorted.length);
  return (
    <ol className={styles.rows} style={{ height }} aria-label={`Top ${shown} pages by visitors`}>
      {rows.map((page, index) => {
        const out = index >= max;
        return (
          <li
            key={page.path}
            className={styles.pageRow}
            data-enter={seen.has(page.path) ? undefined : ""}
            data-out={out ? "" : undefined}
            aria-hidden={out || undefined}
            style={{ transform: `translateY(${ROW_HEIGHT * index}px)` }}
          >
            <span className={styles.bar} style={{ width: `${Math.max(4, (page.visitors / top) * 100)}%` }} aria-hidden="true" />
            <span className={styles.path} title={page.path}>
              {page.path}
            </span>
            <span className={styles.value}>
              <RollingNumber value={page.visitors} reduced={false} />
              <span className={styles.srOnly}>{page.visitors} visitors</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EventsList({ events, max, now, hydrated, connecting }: { events: LiveVisitorEvent[]; max: number; now: number; hydrated: boolean; connecting: boolean }) {
  const seen = useInitialSet(events.map(event => event.id));
  const height = ROW_HEIGHT * max - LIST_INSET;
  if (connecting) return <SkeletonRows rows={max} height={height} />;
  if (!events.length) {
    return (
      <p className={styles.empty} style={{ height }}>
        Signups and upgrades show up here
      </p>
    );
  }
  const rows = events.slice(0, max + 1);
  return (
    <ol className={styles.rows} style={{ height }} aria-label="Recent signups and upgrades">
      {rows.map((event, index) => {
        const out = index >= max;
        const key = event.country.toUpperCase();
        const country = key in FLAGS ? COUNTRY_NAMES[key] : event.country;
        const seconds = hydrated && now ? Math.max(0, Math.round((now - toTime(event.at)) / 1e3)) : null;
        const short = seconds === null ? "" : seconds < 5 ? "now" : seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
        const spoken =
          seconds === null
            ? ""
            : seconds < 5
              ? "just now"
              : seconds < 60
                ? `${seconds} seconds ago`
                : seconds < 3600
                  ? `${Math.floor(seconds / 60)} minutes ago`
                  : `${Math.floor(seconds / 3600)} hours ago`;
        return (
          <li
            key={event.id}
            className={styles.eventRow}
            data-enter={seen.has(event.id) ? undefined : ""}
            data-out={out ? "" : undefined}
            aria-hidden={out || undefined}
            style={{ transform: `translateY(${ROW_HEIGHT * index}px)` }}
          >
            {event.flag ?? <Flag code={event.country} className={styles.flag} />}
            <span className={styles.eventText}>
              <span className={styles.eventLabel}>{event.label}</span>
              <span className={styles.eventPlace}>{event.city}</span>
            </span>
            <span className={styles.time} aria-hidden="true">
              {short}
            </span>
            <span className={styles.srOnly}>{`${event.label}, ${event.city}, ${country}${short ? `, ${spoken}` : ""}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SkeletonRows({ rows, height, bars = false }: { rows: number; height: number; bars?: boolean }) {
  return (
    <div className={styles.rows} style={{ height }} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.skeletonRow} style={{ transform: `translateY(${ROW_HEIGHT * index}px)` }}>
          {bars ? null : <span className={styles.skeletonFlag} />}
          <span className={styles.skeletonLine} style={{ width: `${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}%` }} />
        </span>
      ))}
    </div>
  );
}

interface LiveVisitorsViewProps extends LiveVisitorsProps {
  count: number;
  simulated: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

function LiveVisitorsView({
  count,
  pages = [],
  visitors = [],
  events = [],
  connection = "live",
  paused,
  defaultPaused = false,
  onPausedChange,
  hidePause = false,
  label = DEFAULT_LABEL,
  maxPages = 4,
  maxEvents = 4,
  title = "Live visitors",
  className,
  simulated,
  onVisibleChange,
}: LiveVisitorsViewProps) {
  const reduced = useReducedMotion() ?? false;
  const hydrated = useHydrated();
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  const [ownPaused, setOwnPaused] = useState(defaultPaused);
  const isPaused = paused ?? ownPaused;
  const [message, setMessage] = useState("");
  const latest = { count, pages, visitors, events };
  const [snapshot, setSnapshot] = useState<LiveVisitorsState | null>(null);
  if (isPaused && !snapshot) setSnapshot(latest);
  else if (!isPaused && snapshot) setSnapshot(null);
  const data = isPaused && snapshot ? snapshot : latest;
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      onVisibleChange?.(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisibleChange]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const read = () => setNow(Date.now());
    read();
    const timer = window.setInterval(read, 1e3);
    return () => window.clearInterval(timer);
  }, [visible]);
  const connecting = connection === "connecting";
  const status = isPaused ? "paused" : connection;
  return (
    <section
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      data-active={visible && status === "live" ? "" : undefined}
    >
      <h2 id={titleId} className={styles.srOnly}>
        {title}
      </h2>
      <header className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.status} data-state={status}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.stateStack}>
              {Object.keys(STATE_WORDS).map(key => (
                <span key={key} className={styles.stateLabel} data-on={key === status ? "" : undefined} aria-hidden={key !== status || undefined}>
                  {STATE_WORDS[key]}
                </span>
              ))}
            </span>
          </div>
          <p className={styles.countRow}>
            <span className={styles.count} data-pending={connecting ? "" : undefined}>
              <RollingNumber value={data.count} reduced={reduced} grow />
              <span className={styles.countSkeleton} aria-hidden="true" />
            </span>
            <span className={styles.countLabel}>{label(data.count)}</span>
            <span className={styles.srOnly}>{connecting ? "Connecting to the live stream" : `${data.count} ${label(data.count)}`}</span>
          </p>
        </div>
        <div className={styles.headActions}>
          {simulated ? <span className={styles.meta}>{SAMPLE_LABEL}</span> : null}
          {hidePause ? null : (
            <Tooltip content={isPaused ? "Resume updates" : "Pause updates"}>
              <Button
                variant="ghost"
                size="sm"
                className={styles.iconButton}
                aria-label={isPaused ? "Resume live updates" : "Pause live updates"}
                aria-pressed={isPaused}
                onClick={() => {
                  const next = !isPaused;
                  if (paused === undefined) setOwnPaused(next);
                  onPausedChange?.(next);
                  setMessage(next ? "Live updates paused." : simulated ? "Live updates resumed. Simulated stream, no visitors are tracked." : "Live updates resumed.");
                }}
                disabled={connecting}
              >
                {isPaused ? <PlayIcon size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </Button>
            </Tooltip>
          )}
        </div>
      </header>
      <VisitorMap visitors={data.visitors} events={data.events} reduced={reduced} hydrated={hydrated} />
      <div className={styles.lists}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Top pages</h3>
            <span className={styles.meta}>Visitors</span>
          </div>
          <PagesList pages={data.pages} max={maxPages} connecting={connecting} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Just now</h3>
            <span className={styles.meta}>Signups and upgrades</span>
          </div>
          <EventsList events={data.events} max={maxEvents} now={now} hydrated={hydrated} connecting={connecting} />
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {message}
      </p>
    </section>
  );
}

function SimulatedLiveVisitors(props: LiveVisitorsProps) {
  const [paused, setPaused] = useState(props.defaultPaused ?? false);
  const [visible, setVisible] = useState(true);
  const isPaused = props.paused ?? paused;
  const state = useLiveVisitorsSimulation(!isPaused && visible);
  const handlePausedChange = useCallback(
    (next: boolean) => {
      setPaused(next);
      props.onPausedChange?.(next);
    },
    [props],
  );
  return (
    <LiveVisitorsView
      {...props}
      count={state.count}
      pages={state.pages}
      visitors={state.visitors}
      events={state.events}
      paused={isPaused}
      onPausedChange={handlePausedChange}
      simulated
      onVisibleChange={setVisible}
    />
  );
}

/** A realtime visitors card: a pulsing live status, a count that rolls digit by digit, a dotted world map where new arrivals ping in and fade, the top pages right now with bars, and a ticker of signups and upgrades with country flags. With no props it plays a simulated stream of a SaaS marketing site. */
export function LiveVisitors(props: LiveVisitorsProps) {
  return props.count === undefined ? <SimulatedLiveVisitors {...props} /> : <LiveVisitorsView {...props} count={props.count} simulated={false} />;
}

export default LiveVisitors;
