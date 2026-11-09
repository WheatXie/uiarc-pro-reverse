"use client";

import { useRef, useState } from "react";
import { Bookmark, Compass, House, Search, UserRound } from "lucide-react";
import { GlassTabBar, type GlassTabBarItem } from "./glass-tabbar";
import styles from "./glass-tabbar.module.css";

export const meta = "Live · component";

const iconProps = { strokeWidth: 1.75, "aria-hidden": true } as const;

const items: GlassTabBarItem[] = [
  { value: "home", label: "Home", icon: <House {...iconProps} /> },
  { value: "explore", label: "Explore", icon: <Compass {...iconProps} /> },
  { value: "saved", label: "Saved", icon: <Bookmark {...iconProps} />, badge: 3 },
  { value: "profile", label: "Profile", icon: <UserRound {...iconProps} /> },
];

const action: GlassTabBarItem = { value: "search", label: "Search", icon: <Search {...iconProps} /> };

/** Fourteen blocks of scrolling content, so the bar has something to collapse against. */
const rows = Array.from({ length: 14 }, (_, index) => ({ wide: index % 3 !== 1, tall: index % 4 === 0 }));

export default function GlassTabBarDemo() {
  const [value, setValue] = useState("home");
  const scroller = useRef<HTMLDivElement>(null);
  return <div className={styles.demo}>
    <div ref={scroller} className={styles.scroller}>
      <div className={styles.canvas} aria-hidden="true">
        {rows.map((row, index) => <span key={index} className={styles.row} data-tall={row.tall || undefined} data-wide={row.wide || undefined} />)}
      </div>
    </div>
    <GlassTabBar className={styles.tabbar} items={items} action={action} value={value} onValueChange={setValue} scrollRef={scroller} label="Main" />
  </div>;
}
