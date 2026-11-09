"use client";

import { SettingsCommand } from "./settings-command";

export const meta = "Live · block";

/**
 * No props: the block ships its own workspace schema and saved values — Northwind Studio on the
 * General section, no unsaved changes, which is the state the live frame is photographed in.
 */
export default function SettingsCommandDemo() {
  return <SettingsCommand />;
}
