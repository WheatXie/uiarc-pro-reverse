"use client";

import { useState } from "react";
import { Combobox } from "../combobox/combobox";
import type { ComboboxOption } from "../combobox/combobox";
import { Input } from "../input/input";
import MultiStepForm from "./multi-step-form";
import type { FormStep } from "./multi-step-form";
import styles from "./demo.module.css";

export const meta = "Live · block";

const people: ComboboxOption[] = [
  { value: "emma", label: "Emma Collins", keywords: ["design", "owner"] },
  { value: "marcus", label: "Marcus Johnson", keywords: ["engineering"] },
  { value: "ava", label: "Ava Mitchell", keywords: ["research"] },
];

const steps: FormStep[] = [
  { id: "details", title: "Project details", description: "A little context helps.", content: <Input label="Project name" defaultValue="Arc launch" /> },
  { id: "owner", title: "Assign owner", content: <Combobox label="Owner" options={people} defaultValue="emma" /> },
];

/** The frame renders the wizard with its shipped two steps, then reports the finish in the status line. */
export default function MultiStepFormDemo() {
  const [status, setStatus] = useState("");
  return <div className={styles.preview}>
    <div className={styles.surface}>
      <MultiStepForm steps={steps} onComplete={() => setStatus("Project setup complete")} completeLabel="Finish setup" />
    </div>
    <div className={styles.status} role="status">{status}</div>
  </div>;
}
