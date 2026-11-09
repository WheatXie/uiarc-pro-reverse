"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { CoverFlow, type CoverFlowItem } from "./cover-flow";
import styles from "./cover-flow.module.css";

export const meta = "Live · component";

interface Hike extends CoverFlowItem {
  miles: number;
  gain: number;
  light: string;
}

const SRC = "/media/specials/cover-flow-";

const HIKES: Hike[] = [
  {
    id: "valley-loop",
    title: "Yosemite Valley loop",
    subtitle: "Yosemite, California",
    image: `${SRC}yosemite.jpg`,
    imagePosition: "50% 40%",
    alt: "Half Dome above a meadow where a deer grazes",
    miles: 7.2,
    gain: 400,
    light: "Late afternoon",
  },
  {
    id: "lake-agnes",
    title: "Lake Agnes Tea House",
    subtitle: "Banff, Alberta",
    image: `${SRC}lake-louise.jpg`,
    alt: "Lake Louise reflecting the mountains and a glacier",
    miles: 4.5,
    gain: 1300,
    light: "Sunrise",
  },
  {
    id: "limides",
    title: "Lago Limides",
    subtitle: "Cortina d'Ampezzo, Italy",
    image: `${SRC}lago-limides.jpg`,
    miles: 2.6,
    gain: 750,
    light: "Sunset",
  },
  {
    id: "seceda",
    title: "Seceda ridgeline",
    subtitle: "Val Gardena, Italy",
    image: `${SRC}seceda.jpg`,
    imagePosition: "50% 20%",
    miles: 6.1,
    gain: 1150,
    light: "Morning",
  },
  {
    id: "canyon",
    title: "Fjaðrárgljúfur rim",
    subtitle: "South Iceland",
    image: `${SRC}iceland-canyon.jpg`,
    miles: 1.8,
    gain: 330,
    light: "Any weather",
  },
  {
    id: "cape-nelson",
    title: "Cape Nelson lighthouse",
    subtitle: "Victoria, Australia",
    image: `${SRC}cape-nelson.jpg`,
    imagePosition: "50% 60%",
    miles: 3.1,
    gain: 260,
    light: "Blue hour",
  },
  {
    id: "lands-end",
    title: "Ocean Beach to Lands End",
    subtitle: "San Francisco, California",
    image: `${SRC}ocean-beach.jpg`,
    imagePosition: "30% 50%",
    miles: 3.4,
    gain: 550,
    light: "Sunset",
  },
];

export default function CoverFlowDemo() {
  const [index, setIndex] = useState(2);
  const [saved, setSaved] = useState<string[]>(["lake-agnes"]);
  const hike = HIKES[index];
  const isSaved = saved.includes(hike.id);

  return (
    <div className={styles.demo}>
      <CoverFlow
        items={HIKES}
        label="Hikes for this fall"
        index={index}
        onIndexChange={setIndex}
        renderCaption={item => (
          <>
            <p className={styles.demoTitle}>{item.title}</p>
            <p className={styles.demoSubtitle}>{item.subtitle}</p>
          </>
        )}
      />
      <div className={styles.details}>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Round trip</dt>
            <dd>
              <AnimatedCounter value={hike.miles} decimals={1} suffix={" mi"} />
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>Elevation gain</dt>
            <dd>
              <AnimatedCounter value={hike.gain} suffix={" ft"} />
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>Best light</dt>
            <dd className={styles.light}>{hike.light}</dd>
          </div>
        </dl>
        <button
          type="button"
          className={styles.save}
          aria-pressed={isSaved}
          onClick={() => setSaved(current => (isSaved ? current.filter(id => id !== hike.id) : [...current, hike.id]))}
        >
          {isSaved ? <BookmarkCheck size={16} strokeWidth={1.75} aria-hidden="true" /> : <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />}
          <span>{isSaved ? "Saved" : "Save hike"}</span>
        </button>
      </div>
    </div>
  );
}
