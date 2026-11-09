"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Heart } from "lucide-react";
import { photo } from "../lib/media";
import GlassMenu from "./glass-menu";
import { createGroups, noteFor } from "./glass-menu-data";
import type { GlassMenuNote } from "./glass-menu-data";
import styles from "./glass-menu.module.css";

export const meta = "Live · component";

const poolHouse = photo("pool-house");

/** A photo card whose title opens the glass action menu; each choice answers in a toast. */
export function GlassMenuDemo() {
  const reduced = useReducedMotion();
  const [favorite, setFavorite] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [note, setNote] = useState<GlassMenuNote | null>(null);
  const counter = useRef(0);

  const remember = (text: string, undo = false) => {
    counter.current += 1;
    setNote({ id: counter.current, text, undo });
  };

  return (
    <div className={styles.demo}>
      <div className={styles.frame}>
        <img
          src={poolHouse.src}
          alt={poolHouse.alt}
          sizes="(max-width: 640px) 100vw, 760px"
          className={styles.image}
          data-deleted={deleted ? "" : undefined}
          draggable={false}
          style={{ position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, color: "transparent" }}
        />
        <div className={styles.top}>
          <GlassMenu
            groups={createGroups({ favorite, deleted })}
            label="Photo actions"
            onSelect={id => {
              if (id === "favorite") {
                setFavorite(current => !current);
                remember(favorite ? "Removed from favorites" : "Added to favorites");
                return;
              }
              if (id === "delete") setDeleted(true);
              const text = noteFor(id, favorite);
              if (text) remember(text, id === "delete");
            }}
          >
            <span>Pool house</span>
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
          </GlassMenu>
          <AnimatePresence>
            {favorite && (
              <motion.span
                key="fav"
                className={styles.badge}
                role="img"
                aria-label="Favorite"
                initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: reduced ? 1 : 0.4, opacity: 0 }}
                transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.34, bounce: 0 }}
              >
                <Heart size={16} strokeWidth={1.75} fill="currentColor" aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className={styles.bottom} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            {note && (
              <motion.div
                key={note.id}
                className={styles.note}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
                transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.36, bounce: 0 }}
              >
                <span>{note.text}</span>
                {note.undo && (
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={() => {
                      setDeleted(false);
                      remember("Restored");
                    }}
                  >
                    Undo
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default GlassMenuDemo;
