"use client";

import type { ReactNode } from "react";
import { photo, type PhotoId } from "../lib/media";
import { PageCurl } from "./page-curl";
import styles from "./page-curl.module.css";

export const meta = "Live · component";

function Shot({ id, className }: { id: PhotoId; className?: string }) {
  const { src, alt } = photo(id);
  return (
    <div className={[styles.photo, className].filter(Boolean).join(" ")}>
      <img
        className={styles.image}
        src={src}
        alt={alt}
        sizes="260px"
        loading="lazy"
        decoding="async"
        style={{ position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" }}
      />
    </div>
  );
}

const pages: ReactNode[] = [
  <div key="cover" className={styles.cover}>
    <Shot id="terracotta-waves" className={styles.full} />
    <div className={styles.coverText}>
      <p className={styles.issue}>Issue 04</p>
      <p className={styles.coverTitle}>Slow rooms</p>
    </div>
  </div>,
  <div key="intro" className={styles.text}>
    <p className={styles.heading}>Rooms that take their time</p>
    <p className={styles.copy}>
      Six homes where light, texture, and a few good objects do the work. No trends, just places people love to spend a quiet afternoon.
    </p>
    <p className={styles.folio}>2</p>
  </div>,
  <div key="sunroom" className={styles.plate}>
    <Shot id="sunroom" className={styles.tall} />
    <p className={styles.caption}>A sunroom in Sintra, glass on three sides.</p>
    <p className={styles.folio}>3</p>
  </div>,
  <div key="chair" className={styles.plate}>
    <Shot id="lounge-chair" className={styles.tall} />
    <p className={styles.caption}>Woven oak and sheepskin, built to last decades.</p>
    <p className={styles.folio}>4</p>
  </div>,
  <div key="quote" className={styles.text}>
    <p className={styles.quote}>The best rooms are edited, not decorated.</p>
    <p className={styles.copy}>Sofia Ramirez, interior designer</p>
    <p className={styles.folio}>5</p>
  </div>,
  <div key="lamp" className={styles.plate}>
    <Shot id="ceramic-lamp" className={styles.tall} />
    <p className={styles.caption}>A ceramic lamp on walnut, lit at dusk.</p>
    <p className={styles.folio}>6</p>
  </div>,
  <div key="bedroom" className={styles.plate}>
    <Shot id="bedroom" className={styles.tall} />
    <p className={styles.caption}>Striped linen and an oak headboard.</p>
    <p className={styles.folio}>7</p>
  </div>,
  <div key="back" className={styles.back}>
    <p className={styles.backTitle}>Slow rooms</p>
    <p className={styles.copy}>Next issue in spring</p>
  </div>,
];

export function PageCurlDemo() {
  return (
    <div className={styles.demo}>
      <PageCurl className={styles.demoBook} pages={pages} label="Slow rooms magazine" />
    </div>
  );
}

export default PageCurlDemo;
