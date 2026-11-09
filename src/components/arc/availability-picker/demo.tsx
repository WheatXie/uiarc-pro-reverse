import { AvailabilityPicker } from "./availability-picker";

export const meta = "Live · block";

/** The frame shows the block at rest: Monday selected, 10:30 everyone-free, invitation not sent yet. */
export default function AvailabilityPickerDemo() {
  return <AvailabilityPicker flat />;
}
