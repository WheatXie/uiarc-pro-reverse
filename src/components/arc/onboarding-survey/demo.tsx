"use client";

import OnboardingSurvey from "./onboarding-survey";

export const meta = "Live · block";

/**
 * No props: the block ships its own sample questions, selection script and setup steps, so the demo
 * only mounts it and lets the sample run loop the way the live frame does.
 */
export default function OnboardingSurveyDemo() {
  return <OnboardingSurvey />;
}
