"use client";

import { useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import { Checkbox } from "../checkbox/checkbox";
import { SelectionToolbar } from "./selection-toolbar";
import styles from "./demo.module.css";

export const meta = "Live · block";

const projects = [
  { id: "atlas", name: "Atlas redesign", meta: "Updated 2 hours ago" },
  { id: "launch", name: "Spring launch site", meta: "Updated yesterday" },
  { id: "billing", name: "Billing migration", meta: "Updated 3 days ago" },
  { id: "onboarding", name: "Onboarding emails", meta: "Updated last week" },
];

/** Two projects start selected, so the frame lands on a live toolbar instead of an empty slot. */
export default function SelectionToolbarDemo() {
  const [selected, setSelected] = useState<string[]>(["atlas", "launch"]);
  const [status, setStatus] = useState("");
  const commit = (verb: string) => {
    setStatus(`${selected.length} ${selected.length === 1 ? "project" : "projects"} ${verb}`);
    setSelected([]);
  };
  return <div className={styles.preview}>
    <div className={styles.surface}>
      <div className={styles.demo}>
        <ul className={styles.list} aria-label="Projects">
          {projects.map((project) => <li key={project.id} className={styles.row}>
            <Checkbox checked={selected.includes(project.id)} aria-label={`Select ${project.name}`} onCheckedChange={(checked) => setSelected((current) => checked === true
              ? current.includes(project.id) ? current : [...current, project.id]
              : current.filter((id) => id !== project.id))} />
            <span className={styles.copy}>
              <span className={styles.name}>{project.name}</span>
              <span className={styles.meta}>{project.meta}</span>
            </span>
          </li>)}
        </ul>
        <div className={styles.slot}>
          <SelectionToolbar count={selected.length} noun="project" onClear={() => setSelected([])} actions={[
            { label: "Archive", icon: <Archive size={16} strokeWidth={1.75} />, onClick: () => commit("archived") },
            { label: "Delete", icon: <Trash2 size={16} strokeWidth={1.75} />, destructive: true, onClick: () => commit("deleted") },
          ]} />
        </div>
      </div>
    </div>
    <div className={styles.status} role="status">{status}</div>
  </div>;
}
