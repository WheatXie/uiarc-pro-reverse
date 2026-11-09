"use client";

import { PromptStudio } from "./prompt-studio";

export const meta = "Live · edit, run, compare and promote";

/**
 * Prompt studio as it ships: the sample support-reply prompt, four versions,
 * three test cases and a simulated reply stream (no provider needed).
 */
export default function PromptStudioDemo() {
  return <PromptStudio />;
}
