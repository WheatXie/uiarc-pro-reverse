"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, FolderPlus, Heart, RotateCcw, Share2, Trash2 } from "lucide-react";
import { Button } from "../button/button";
import { motionTokens } from "../lib/motion-tokens";
import { OrbitMenu, type OrbitMenuAction } from "./orbit-menu";
import styles from "./orbit-menu.module.css";

export const meta = "Live · component";

const CHIP_ICON = { size: 13, strokeWidth: 2, "aria-hidden": true } as const;
const ACTION_ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const MEDIA = "/media/specials/orbit-menu-";

interface PhotoState {
  liked: boolean;
  album: boolean;
  shared: boolean;
  downloads: number;
  deleted: boolean;
}

interface Chip {
  id: string;
  icon: React.ReactNode;
  text: string;
}

const BASE: PhotoState = { liked: false, album: false, shared: false, downloads: 0, deleted: false };

const INITIAL_STATUS = "Press the button and drag to an action, or click it to keep the actions open.";

/**
 * The demo swaps its status line and chip labels the moment the state changes,
 * so each string enters on the same spring-free fade the reference uses.
 */
function AnimatedText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  const initial = reduced
    ? { opacity: 0 }
    : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={text}
        className={className}
        initial={initial}
        animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
        exit={{ ...initial, transition: { duration: reduced ? 0.1 : motionTokens.duration.instant } }}
        transition={{ duration: reduced ? 0.15 : 0.22, ease: [...motionTokens.ease.enter] }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}

export default function OrbitMenuDemo() {
  const reduced = !!useReducedMotion();
  const [state, setState] = useState<PhotoState>(BASE);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [open, setOpen] = useState(false);

  const actions: OrbitMenuAction[] = [
    {
      id: "like",
      label: state.liked ? "Unlike" : "Like",
      done: state.liked ? "Unliked" : "Liked",
      icon: <Heart {...ACTION_ICON} />,
    },
    {
      id: "album",
      label: state.album ? "Remove from album" : "Add to album",
      done: state.album ? "Removed" : "Added to Fall trips",
      icon: <FolderPlus {...ACTION_ICON} />,
    },
    {
      id: "share",
      label: state.shared ? "Stop sharing" : "Share with Ryan",
      done: state.shared ? "Not shared" : "Shared",
      icon: <Share2 {...ACTION_ICON} />,
    },
    { id: "download", label: "Download", done: "Downloaded", icon: <Download {...ACTION_ICON} /> },
    { id: "delete", label: "Delete", done: "Deleted", tone: "danger", icon: <Trash2 {...ACTION_ICON} /> },
  ];

  const onAction = (id: string) => {
    if (id === "like") setStatus(state.liked ? "Removed your like" : "Liked the photo, 129 likes now");
    if (id === "album") {
      setStatus(state.album ? "Removed from the Fall trips album" : "Added to the Fall trips album");
    }
    if (id === "share") {
      setStatus(state.shared ? "Stopped sharing with Ryan Torres" : "Shared with Ryan Torres");
    }
    if (id === "download") setStatus("Saved hut-below-snezka.jpg, 4.2 MB");
    if (id === "delete") setStatus("Deleted the photo");

    setState((prev) => ({
      ...prev,
      liked: id === "like" ? !prev.liked : prev.liked,
      album: id === "album" ? !prev.album : prev.album,
      shared: id === "share" ? !prev.shared : prev.shared,
      downloads: id === "download" ? prev.downloads + 1 : prev.downloads,
      deleted: id === "delete" || prev.deleted,
    }));
  };

  const restore = () => {
    setState((prev) => ({ ...prev, deleted: false }));
    setStatus("Restored the photo");
  };

  const reset = () => {
    setState(BASE);
    setStatus("Photo reset");
  };

  const pristine =
    !state.liked && !state.album && !state.shared && state.downloads === 0 && !state.deleted;

  const chips = ([
    state.liked && { id: "like", icon: <Heart {...CHIP_ICON} />, text: "129 likes" },
    state.album && { id: "album", icon: <FolderPlus {...CHIP_ICON} />, text: "Fall trips" },
    state.shared && {
      id: "share",
      icon: <img className={styles.chipAvatar} src={`${MEDIA}ryan-torres.svg`} alt="" width={16} height={16} />,
      text: "Ryan Torres",
    },
    state.downloads > 0 && {
      id: "download",
      icon: <Download {...CHIP_ICON} />,
      text: state.downloads === 1 ? "Downloaded" : `Downloaded ${state.downloads} times`,
    },
  ] as (Chip | false)[]).filter((chip): chip is Chip => chip !== false);

  const chipInitial = reduced
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.8, filter: `blur(${motionTokens.blur.subtle}px)` };

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <motion.div
          className={styles.cardArea}
          initial={false}
          animate={{ scale: open ? 0.97 : 1, opacity: open ? 0.55 : 1 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : {
                  scale: motionTokens.spring.smooth,
                  opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
                }
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {state.deleted ? (
              <motion.div
                key="empty"
                className={styles.empty}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : {
                        scale: motionTokens.spring.smooth,
                        opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
                      }
                }
              >
                <p className={styles.emptyTitle}>Photo deleted</p>
                <p className={styles.emptyBody}>Hut below Śnieżka stays in Recently deleted for 30 days.</p>
                <Button variant="secondary" size="sm" onClick={restore}>
                  <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
                  Restore photo
                </Button>
              </motion.div>
            ) : (
              <motion.article
                key="card"
                className={styles.card}
                aria-label="Hut below Śnieżka"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: 0.12 } }
                    : {
                        opacity: 0,
                        scale: 0.9,
                        y: 16,
                        filter: `blur(${motionTokens.blur.soft}px)`,
                        transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] },
                      }
                }
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : {
                        scale: motionTokens.spring.smooth,
                        opacity: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
                      }
                }
              >
                <div className={styles.photo}>
                  <img
                    src={`${MEDIA}cabin.jpg`}
                    alt="A dark wooden hut in fog on a rocky mountainside"
                    draggable={false}
                    style={{ position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0 }}
                  />
                </div>
                <div className={styles.body}>
                  <div className={styles.byline}>
                    <img className={styles.avatar} src={`${MEDIA}olivia-bennett.svg`} alt="" width={28} height={28} />
                    <div className={styles.names}>
                      <h3 className={styles.title}>Hut below Śnieżka</h3>
                      <p className={styles.meta}>Olivia Bennett, Karkonosze, Poland</p>
                    </div>
                  </div>
                  <div className={styles.chips}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {chips.length === 0 && (
                        <motion.span
                          key="none"
                          className={styles.placeholder}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        >
                          128 likes, not in an album
                        </motion.span>
                      )}
                      {chips.map((chip) => (
                        <motion.span
                          key={chip.id}
                          layout={!reduced}
                          className={styles.chip}
                          initial={chipInitial}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={{ ...chipInitial, transition: { duration: motionTokens.duration.instant } }}
                          transition={
                            reduced
                              ? { duration: 0.15 }
                              : {
                                  ...motionTokens.spring.snappy,
                                  opacity: { duration: motionTokens.duration.fast },
                                  filter: { duration: motionTokens.duration.fast },
                                }
                          }
                        >
                          {chip.icon}
                          <AnimatedText text={chip.text} reduced={reduced} className={styles.chipText} />
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.article>
            )}
          </AnimatePresence>
        </motion.div>
        <div className={styles.orbit}>
          <OrbitMenu
            actions={actions}
            onAction={onAction}
            label="Photo actions"
            disabled={state.deleted}
            announce={false}
            onOpenChange={setOpen}
          />
        </div>
      </div>
      <div className={styles.footer}>
        <p className={styles.srOnly} role="status" aria-live="polite">
          <AnimatedText text={status} reduced={reduced} className={styles.statusText} />
        </p>
        <Button variant="secondary" size="sm" onClick={reset} disabled={pristine}>
          <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
          Reset photo
        </Button>
      </div>
    </div>
  );
}
