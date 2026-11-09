"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechPlayer, createSimulatedProvider } from "./speech-player";
import type { Synthesize } from "./speech-player";
import { Switch } from "../switch/switch";
import styles from "./speech-player.module.css";

export const meta = "Live · component";

export default function SpeechPlayerDemo() {
  const [fail, setFail] = useState(false);
  const failNext = useRef(false);
  useEffect(() => { failNext.current = fail; }, [fail]);
  // The toggle only arms the next request: the failure it promises is spent on that request, then the switch clears.
  const synthesize = useCallback<Synthesize>((request) => {
    const shouldFail = failNext.current;
    if (shouldFail) { failNext.current = false; setFail(false); }
    return createSimulatedProvider({ delay: 620, fail: shouldFail, text: request.text })(request);
  }, []);
  return <div className={styles.demo}>
    <SpeechPlayer synthesize={synthesize} simulated />
    <Switch className={styles.toggle} label="Fail the next speech request" checked={fail} onCheckedChange={setFail} />
  </div>;
}
