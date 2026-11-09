"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Checkbox } from "../checkbox/checkbox";
import Switch from "../switch/switch";
import { person } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./release-readiness.module.css";

export interface ReleaseReadinessTask {
  id: string;
  /** Checklist line, also used as the checkbox's accessible name. */
  label: string;
  /** One line of supporting detail, wired to the checkbox with aria-describedby. */
  detail: string;
}

/** Sample checklist. Replace it with the gates your own release has to pass. */
export const demoReleaseTasks: readonly ReleaseReadinessTask[] = [
  { id: "brief", label: "Product brief approved", detail: "Scope and acceptance criteria are final" },
  { id: "qa", label: "Quality checks passed", detail: "Build 2.4.0-rc.3 reviewed on staging" },
  { id: "changelog", label: "Changelog is ready", detail: "Release notes drafted for customers" },
  { id: "owner", label: "Release owner on call", detail: "Someone is available for the handoff" },
];

/** The checks the sample block starts with: only the brief is already approved. */
export const demoReleaseChecks: Readonly<Record<string, boolean>> = {
  brief: true,
  qa: false,
  changelog: false,
  owner: false,
};

const owners = [person("emma-collins"), person("marcus-johnson")];

export interface ReleaseReadinessProps {
  /** Called when the release button is pressed. Awaited; a thrown error shows an inline alert. */
  onRelease?: () => void | Promise<void>;
  /** Renders without the block's own surface. The preview frame flattens the card. */
  flat?: boolean;
  /** Extra class names for the root section. */
  className?: string;
}

/**
 * A release checklist with a readiness bar, a notify switch, and a release action that unlocks
 * once every check is done.
 */
export function ReleaseReadiness({ onRelease, flat = false, className }: ReleaseReadinessProps) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const [checks, setChecks] = useState<Record<string, boolean>>(() => ({ ...demoReleaseChecks }));
  const [notify, setNotify] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  const done = demoReleaseTasks.filter(task => checks[task.id]).length;
  const left = demoReleaseTasks.length - done;

  async function startRelease() {
    setStarting(true);
    setError("");
    try {
      await onRelease?.();
      setStarted(true);
    } catch {
      setError("The release could not be started. Try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section
      className={[styles.release, className].filter(Boolean).join(" ")}
      aria-labelledby={`${uid}-title`}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 id={`${uid}-title`}>Release 2.4</h2>
          <p>Atlas workspace · ships Thursday</p>
        </div>
        <div className={styles.owners} aria-label={`Release owners: ${owners.map(owner => owner.name).join(" and ")}`}>
          {owners.map(owner => (
            <Avatar key={owner.id} name={owner.name} src={owner.src} size="sm" aria-hidden="true" />
          ))}
        </div>
      </header>
      <div className={styles.progress}>
        <div className={styles.progressMeta}>
          {/* The count is the only live region: screen readers hear progress, not every keystroke. */}
          <span aria-live="polite">
            {started ? "Release in progress" : left ? `${left} ${left === 1 ? "check" : "checks"} left` : "Ready to ship"}
          </span>
          <span className={styles.count}>
            {done} of {demoReleaseTasks.length}
          </span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Readiness"
          aria-valuemin={0}
          aria-valuemax={demoReleaseTasks.length}
          aria-valuenow={done}
        >
          {/* The fill is the full-width bar slid left, so progress animates on the compositor. */}
          <span
            className={styles.fill}
            data-complete={done === demoReleaseTasks.length || undefined}
            style={{ transform: `translateX(${(done / demoReleaseTasks.length - 1) * 100}%)` }}
          />
        </div>
      </div>
      <ul className={styles.tasks} aria-label="Before you ship" data-frame-flat={flat ? "" : undefined}>
        {demoReleaseTasks.map(task => (
          <li key={task.id} className={styles.task} data-done={checks[task.id] || undefined}>
            <Checkbox
              id={`${uid}-${task.id}`}
              checked={!!checks[task.id]}
              disabled={started}
              onCheckedChange={next => setChecks(current => ({ ...current, [task.id]: next === true }))}
              aria-label={task.label}
              aria-describedby={`${uid}-${task.id}-detail`}
            />
            <label htmlFor={`${uid}-${task.id}`} className={styles.taskCopy}>
              <span className={styles.taskLabel}>{task.label}</span>
              <span id={`${uid}-${task.id}-detail`} className={styles.taskDetail}>
                {task.detail}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <footer className={styles.footer} data-frame-flat={flat ? "" : undefined}>
        <Switch checked={notify} onCheckedChange={setNotify} label="Notify #releases" disabled={started} />
        <div className={styles.footerActions}>
          {started && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setChecks({ ...demoReleaseChecks });
                setStarted(false);
                setError("");
              }}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            disabled={left > 0 || starting}
            loading={starting}
            onClick={() => void startRelease()}
          >
            {started ? (
              <>
                <Check size={16} aria-hidden="true" />
                Started
              </>
            ) : (
              <>
                Start release
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </footer>
      <AnimatePresence initial={false}>
        {(error || started) && (
          <motion.div
            key="message"
            className={styles.message}
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    height: motionTokens.spring.smooth,
                    opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
                  }
            }
          >
            <p className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>
              {error || `Release 2.4 is rolling out.${notify ? " #releases was notified." : ""}`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default ReleaseReadiness;
