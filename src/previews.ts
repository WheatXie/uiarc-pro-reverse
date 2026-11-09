import type { ComponentType } from "react";

export interface DemoEntry {
  Component: ComponentType;
  meta?: string;
  /** Optional per-item notes rendered under the stage. */
  notes?: string;
}

interface DemoModule {
  default?: ComponentType;
  meta?: string;
  notes?: string;
}

/**
 * Every reconstructed item ships a `demo.tsx` next to its component. Dropping the file in is
 * the whole registration step — no shared list to edit, so parallel ports never collide.
 */
const modules = import.meta.glob<DemoModule>("./components/arc/*/demo.tsx", { eager: true });

const entries: [string, DemoEntry][] = [];
for (const [path, module] of Object.entries(modules)) {
  const Component = module.default;
  if (!Component) continue;
  entries.push([path.split("/")[3], { Component, meta: module.meta, notes: module.notes }]);
}

export const demos: Record<string, DemoEntry> = Object.fromEntries(entries);
