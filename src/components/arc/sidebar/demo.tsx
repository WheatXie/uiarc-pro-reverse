"use client";

import SidebarRail from "./sidebar";

export const meta = "Live · block";

/**
 * The shipped block is self-contained: it measures its own container to choose the rail, floating
 * sheet, or menu-button state, starts on the checkout page with the Projects group open, and folds
 * itself once the first frame has painted. Rendering it with no props is the exact state the live
 * frame is photographed in.
 */
export default function SidebarRailDemo() {
  return <SidebarRail />;
}
