"use client";

import AiChat from "./ai-chat";

export const meta = "Live · block";

/**
 * The shipped block runs itself: it starts the first reply when the pane scrolls into view,
 * then asks the follow-up question on its own once that reply settles. Rendering it with no
 * props is the exact state the live frame is photographed in.
 */
export default function AiChatDemo() {
  return <AiChat />;
}
