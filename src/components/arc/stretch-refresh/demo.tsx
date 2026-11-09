"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Receipt, type LucideIcon } from "lucide-react";
import { StretchRefresh } from "./stretch-refresh";
import styles from "./stretch-refresh.module.css";

export const meta = "Live · component";

const person = (name: string, slug: string) => ({
  name,
  photo: `/media/specials/stretch-refresh-${slug}.svg`,
});

const SARAH = person("Sarah Mitchell", "sarah-mitchell");
const MARCUS = person("Marcus Reed", "marcus-reed");
const JENNY = person("Jenny Tran", "jenny-tran");
const ETHAN = person("Ethan Walsh", "ethan-walsh");
const RYAN = person("Ryan Torres", "ryan-torres");

type Actor =
  | { name: string; photo: string }
  | { name: string; icon: LucideIcon; tone: "success" | "danger" | "neutral" };

interface Row {
  id: string;
  who: Actor;
  action: string;
  target: string;
  quote?: string;
  attachment?: { src: string; alt: string };
  meta: string;
}

const ROWS: Row[] = [
  {
    id: "a1",
    who: SARAH,
    action: "merged",
    target: "Retry failed card payments",
    meta: "Checkout · 14 min ago",
  },
  {
    id: "a2",
    who: { name: "Build 2481", icon: CircleCheck, tone: "success" },
    action: "passed on",
    target: "staging",
    meta: "Deploys · 22 min ago",
  },
  {
    id: "a3",
    who: MARCUS,
    action: "commented on",
    target: "Q4 roadmap",
    quote: "Can search move to week 3? Filters depend on it.",
    meta: "Planning · 38 min ago",
  },
  {
    id: "a4",
    who: { name: "Halden Supply", icon: Receipt, tone: "neutral" },
    action: "paid invoice",
    target: "INV-2043",
    meta: "$4,820.00 · 1 hr ago",
  },
  {
    id: "a5",
    who: JENNY,
    action: "added a photo to",
    target: "Spring lookbook",
    attachment: {
      src: "/media/specials/stretch-refresh-living-room.jpg",
      alt: "A living room with tan leather chairs around a low fireplace",
    },
    meta: "Brand · 2 hr ago",
  },
  {
    id: "a6",
    who: ETHAN,
    action: "closed",
    target: "Safari date picker jumps",
    meta: "Web app · 3 hr ago",
  },
  {
    id: "a7",
    who: RYAN,
    action: "published",
    target: "September release notes",
    meta: "Docs · Yesterday",
  },
];

const BATCHES: Row[][] = [
  [
    {
      id: "b1",
      who: ETHAN,
      action: "replied on",
      target: "Retry failed card payments",
      quote: "Shipping it after lunch.",
      meta: "Checkout · Just now",
    },
    {
      id: "b2",
      who: { name: "Build 2482", icon: CircleX, tone: "danger" },
      action: "failed on",
      target: "main",
      meta: "2 checkout tests · Just now",
    },
    {
      id: "b3",
      who: RYAN,
      action: "requested your review on",
      target: "Search filters",
      meta: "Web app · Just now",
    },
  ],
  [
    {
      id: "c1",
      who: JENNY,
      action: "added a photo to",
      target: "Big Sur offsite",
      attachment: {
        src: "/media/specials/stretch-refresh-coastline.jpg",
        alt: "A modern house on a rocky coastline above a calm blue sea",
      },
      meta: "Events · Just now",
    },
  ],
  [
    {
      id: "d1",
      who: { name: "Northwind Co.", icon: Receipt, tone: "neutral" },
      action: "paid invoice",
      target: "INV-2051",
      meta: "$1,260.00 · Just now",
    },
    {
      id: "d2",
      who: MARCUS,
      action: "assigned you",
      target: "Empty state copy",
      meta: "Planning · Just now",
    },
  ],
];

function Entry({ item, unread }: { item: Row; unread: boolean }) {
  const { who } = item;
  return (
    <div className={styles.entry}>
      <span
        className={styles.avatar}
        data-kind={"photo" in who ? "photo" : "icon"}
        data-tone={"tone" in who ? who.tone : undefined}
      >
        {"photo" in who ? (
          <img src={who.photo} alt="" width={32} height={32} sizes="32px" draggable={false} />
        ) : (
          <who.icon size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <div className={styles.body}>
        <p className={styles.line}>
          {unread ? <span className={styles.srOnly}>New. </span> : null}
          <span className={styles.name}>{who.name}</span> {item.action}{" "}
          <span className={styles.name}>{item.target}</span>
        </p>
        {item.quote ? <p className={styles.quote}>“{item.quote}”</p> : null}
        {item.attachment ? (
          <span className={styles.attachment}>
            <img
              src={item.attachment.src}
              alt={item.attachment.alt}
              sizes="(max-width: 480px) 60vw, 240px"
              draggable={false}
            />
          </span>
        ) : null}
        <p className={styles.meta}>{item.meta}</p>
      </div>
      <span className={styles.dot} data-on={unread || undefined} aria-hidden="true" />
    </div>
  );
}

export default function StretchRefreshDemo() {
  const [items, setItems] = useState<Row[]>(ROWS);
  const [batch, setBatch] = useState(0);
  const [unread, setUnread] = useState<Set<string>>(() => new Set());

  async function onRefresh() {
    await new Promise(resolve => window.setTimeout(resolve, 1150));
    const next = BATCHES[batch] ?? [];
    setBatch(value => value + 1);
    setUnread(new Set(next.map(row => row.id)));
    if (!next.length) return "You’re up to date";
    setItems(current => [...next, ...current]);
    return `${next.length} new ${next.length === 1 ? "update" : "updates"}`;
  }

  return (
    <div className={styles.demo}>
      <StretchRefresh
        className={styles.feed}
        title="Brightline activity"
        subtitle={batch ? "Updated just now" : "Updated 14 min ago"}
        items={items}
        getKey={item => item.id}
        renderItem={item => <Entry item={item} unread={unread.has(item.id)} />}
        onRefresh={onRefresh}
        refreshLabel="Refresh activity"
      />
      <div className={styles.footer}>
        <span />
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setItems(ROWS);
            setBatch(0);
            setUnread(new Set());
          }}
          disabled={!batch}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
