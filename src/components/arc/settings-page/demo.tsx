"use client";

import SettingsPage from "./settings-page";

export const meta = "Live · block";

/**
 * No props: the block ships its own workspace state — Emma Collins on the Team plan, saved, on the
 * profile section, which is the state the live frame is photographed in.
 */
export default function SettingsPageDemo() {
  return <SettingsPage />;
}
