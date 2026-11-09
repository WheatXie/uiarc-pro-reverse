"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FileText, Share2 } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { people } from "../lib/media";
import ShareAccess, { type ShareAccessMember, type ShareRole } from "./share-access";
import styles from "./demo.module.css";

export const meta = "Live · invite, roles, link access, undo";

/** The demo's workspace directory: the shared seeded people, addressed at fieldwork.example. */
const emailFor = (id: string) => `${id.replace("-", ".")}@fieldwork.example`;

const directory = people.map(person => ({ email: emailFor(person.id), name: person.name, src: person.src }));

const member = (id: string, role: ShareRole): ShareAccessMember => {
  const person = people.find(entry => entry.id === id)!;
  return { id: person.id, email: emailFor(person.id), name: person.name, src: person.src, role };
};

const initialMembers: ShareAccessMember[] = [member("jasmine-brooks", "owner"), member("nathan-cole", "editor"), member("chloe-nguyen", "commenter"), member("daniel-kim", "viewer")];

/** A document bar whose Share button opens the panel, closing on Escape, Done or a click outside. */
export function ShareAccessDemo() {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (panel.current?.contains(target as Node) || trigger.current?.contains(target as Node)) return;
      // A role menu renders in a portal outside the panel; a click there is not a click outside.
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.bar}>
        <span className={styles.doc}>
          <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
          Q3 launch plan
        </span>
        <button ref={trigger} type="button" className={styles.share} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(current => !current)}>
          <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Share
        </button>
      </div>
      <div className={styles.stage}>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              ref={panel}
              role="dialog"
              aria-label="Share Q3 launch plan"
              className={styles.popover}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, y: -4, transition: { duration: motionTokens.duration.fast } }}
              transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
              onKeyDown={event => {
                if (event.key !== "Escape" || event.defaultPrevented) return;
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <ShareAccess
                title="Q3 launch plan"
                directory={directory}
                defaultMembers={initialMembers}
                selfId="jasmine-brooks"
                onInvite={() => new Promise<void>(resolve => { window.setTimeout(resolve, 700); })}
                onDone={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ShareAccessDemo;
