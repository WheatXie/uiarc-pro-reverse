"use client";

import SupportWidget from "./support-widget";

export const meta = "Live · block";

/**
 * The frame opens with the launcher closed over the sample exports page. The stage is flattened with
 * `flat`, matching the reference page, which strips the stage's border, radius, shadow, and background
 * so the block sits inside the page it is placed on.
 */
export default function SupportWidgetDemo() {
  return <SupportWidget flat />;
}
