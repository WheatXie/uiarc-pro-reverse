"use client";

import { photo, type PhotoId } from "../lib/media";
import { ImageTrail } from "./image-trail";
import styles from "./demo.module.css";

export const meta = "Live · component";

const FRAMES: PhotoId[] = [
  "lisbon-tram",
  "terracotta-waves",
  "sea-at-dusk",
  "ceramic-lamp",
  "lisbon-rooftops",
  "curved-facade",
  "wine-bar",
  "alpine-lake",
  "glass-carafe",
  "lisbon-bridge",
  "stoneware-cups",
  "coastline",
];

/* The live page serves these through /_next/image at w=384; that endpoint is a byte-identical
   passthrough of /media/photos/<id>.jpg (md5-verified), so the demo points at the file directly. */
const IMAGES = FRAMES.map(id => photo(id));

export default function ImageTrailDemo() {
  return (
    <div className={styles.demo}>
      <ImageTrail className={styles.area} images={IMAGES} intro>
        <div className={styles.copy}>
          <h3 className={styles.title}>Lisbon, in passing</h3>
          <p className={styles.meta}>Twelve frames, spring 2026</p>
        </div>
      </ImageTrail>
    </div>
  );
}
