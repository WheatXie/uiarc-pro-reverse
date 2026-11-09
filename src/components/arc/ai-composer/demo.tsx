"use client";

import AiComposer from "./ai-composer";

export const meta = "Live · block";

/**
 * The shipped block drives itself: nothing is sent yet, so the frame shows the greeting, the empty
 * composer with its hint mirror, the three suggestions and a disabled send button. Anything typed
 * (or picked from `/` and `@`) starts a simulated reply with phase timers and a typewriter.
 */
export default function AiComposerDemo() {
  return <AiComposer />;
}
