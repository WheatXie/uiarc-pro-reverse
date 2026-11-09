"use client";

import { GravityWell } from "./gravity-well";
import { people, photos } from "../lib/media";
import styles from "./demo.module.css";

export const meta = "Live · component";

const POOL = [
  ...photos.map(photo => ({ src: photo.src, alt: photo.alt })),
  ...people.slice(0, 15).map(person => ({ src: person.src, alt: person.name })),
];

/** Deterministic shuffle: stride 17 across a 42-item pool is a full permutation. */
const TILES = POOL.map((_, index) => POOL[(17 * index) % POOL.length]);

export default function GravityWellDemo() {
  return (
    <div className={styles.demo}>
      <GravityWell label="Studio moodboard" className={styles.well}>
        {TILES.map(tile => (
          <img
            key={tile.src}
            className={styles.image}
            src={tile.src}
            alt={tile.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ))}
      </GravityWell>
    </div>
  );
}
