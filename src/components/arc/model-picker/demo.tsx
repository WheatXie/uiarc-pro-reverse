"use client";

import { ModelPicker } from "./model-picker";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: the pill, the review under it and the sample catalog
 * are the component's defaults, so the menu, effort submenu and More models are all reachable
 * without configuration.
 */
export default function ModelPickerDemo() {
  return <ModelPicker />;
}
