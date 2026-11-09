"use client";

import { useCallback, useRef, useState } from "react";
import { Switch } from "../switch/switch";
import { ImageGeneration, simulateImageGeneration } from "./image-generation";
import type { ImageGenerationContext, ImageGenerationRequest } from "./image-generation";
import styles from "./demo.module.css";

export const meta = "Live · component";

export default function ImageGenerationDemo() {
  const [failOne, setFailOne] = useState(false);
  const started = useRef(false);
  /* With the switch on, the third variation of the first batch stops mid progress and fails with a timeout, so the halt state and Retry are one click away. */
  const generate = useCallback(async (request: ImageGenerationRequest, context: ImageGenerationContext) => {
    if (request.index === 0) started.current = true;
    if (!failOne || request.index !== 2 || !started.current) return simulateImageGeneration(request, context);
    started.current = false;
    const inner = new AbortController();
    const forward = () => inner.abort();
    context.signal.addEventListener("abort", forward, { once: true });
    try {
      return await simulateImageGeneration(request, {
        signal: inner.signal,
        onProgress: (value, preview) => {
          context.onProgress(value, preview);
          if (value > 0.58) inner.abort();
        },
      });
    } catch (error) {
      if (context.signal.aborted) throw error;
      throw new Error("The model timed out. Try again.");
    } finally {
      context.signal.removeEventListener("abort", forward);
    }
  }, [failOne]);

  return <div className={styles.demo}>
    <ImageGeneration onGenerate={failOne ? generate : undefined} autoGenerate />
    <div className={styles.controls}>
      <Switch label="Fail one image" checked={failOne} onCheckedChange={setFailOne} />
    </div>
  </div>;
}
