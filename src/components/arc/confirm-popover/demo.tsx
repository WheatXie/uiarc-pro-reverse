"use client";

import { useId, useState } from "react";
import { Trash2, UserMinus } from "lucide-react";
import ConfirmPopover, { type ConfirmPopoverContext } from "./confirm-popover";
import styles from "./demo.module.css";

export const meta = "Live · keyboard ready";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true },
    );
  });

/** A stand-in server call: reports progress, and fails once on the middle step when the switch is on. */
const run = async (steps: number, { setProgress, signal }: ConfirmPopoverContext, message: string, fail: boolean, onFail: () => void) => {
  for (let step = 1; step <= steps; step += 1) {
    await sleep(360 + 260 * Math.random(), signal);
    if (fail && step === Math.ceil(steps / 2)) {
      onFail();
      throw new Error("The server didn't respond. Nothing was changed.");
    }
    setProgress(step / steps);
  }
  return message;
};

export function ConfirmPopoverDemo() {
  const switchId = useId();
  const [fail, setFail] = useState(false);
  const [log, setLog] = useState("Nothing has changed yet");

  const remove = (context: ConfirmPopoverContext) =>
    run(3, context, "Jordan was removed (simulated)", fail, () => setFail(false)).then(setLog);

  const removeProject = (context: ConfirmPopoverContext) =>
    run(5, context, "Atlas was deleted (simulated)", fail, () => setFail(false)).then(setLog);

  return (
    <div className={styles.demo}>
      <section className={styles.card} aria-labelledby="confirm-popover-demo-title">
        <h3 id="confirm-popover-demo-title" className={styles.heading}>
          Atlas settings
        </h3>
        <div className={styles.row}>
          <img className={styles.avatar} src="/media/people/portrait/jordan-reyes.svg" alt="" width={36} height={36} draggable={false} />
          <div className={styles.text}>
            <span className={styles.name}>Jordan Reyes</span>
            <span className={styles.meta}>Editor · jordan@atlas.dev</span>
          </div>
          <ConfirmPopover
            icon={<UserMinus size={16} strokeWidth={1.75} />}
            align="end"
            title="Remove Jordan from Atlas?"
            description="Jordan loses access to the project and its three environments right away. You can invite them again later."
            confirmLabel="Remove"
            pendingLabel="Removing"
            successLabel="Removed"
            errorTitle="Couldn't remove Jordan"
            onConfirm={remove}
          >
            Remove
          </ConfirmPopover>
        </div>
        <div className={styles.row}>
          <div className={styles.text}>
            <span className={styles.name}>Delete project</span>
            <span className={styles.meta}>14 deployments, 3 environments and all logs</span>
          </div>
          <ConfirmPopover
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            align="end"
            title="Delete Atlas?"
            description="This permanently deletes 14 deployments, 3 environments and every log. It can't be undone."
            confirmText="atlas"
            confirmLabel="Delete project"
            errorTitle="Couldn't delete Atlas"
            onConfirm={removeProject}
          >
            Delete
          </ConfirmPopover>
        </div>
      </section>
      <div className={styles.footer}>
        <label className={styles.switchLabel} htmlFor={switchId}>
          <input
            id={switchId}
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={fail}
            onChange={(event) => setFail(event.target.checked)}
          />
          Fail the next attempt
        </label>
        <p className={styles.log} aria-live="polite">
          {log}
        </p>
      </div>
    </div>
  );
}

export default ConfirmPopoverDemo;
