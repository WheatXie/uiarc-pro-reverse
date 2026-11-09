"use client";

import BookingPill from "./booking-pill";
import styles from "./booking-pill.module.css";

export const meta = "Live · component";

/** The venue keeps three Mondays closed, so the strip opens on an open day. */
const CLOSED = new Set(["2026-09-21", "2026-09-28", "2026-10-05"]);

/** FNV-1a over the slot key; deterministic so server and client agree. */
function hash01(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x1000193);
  }
  return (hash >>> 0) / 0x100000000;
}

export default function BookingPillDemo() {
  return (
    <div className={styles.stage}>
      <BookingPill
        venue="Olea"
        venueDetail="432 Octavia Street, San Francisco"
        startDate="2026-09-21"
        isAvailable={(date, time, partySize) =>
          !CLOSED.has(date) && hash01(`${date} ${time}`) > 0.14 + 0.045 * partySize
        }
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 1100))}
      />
    </div>
  );
}
