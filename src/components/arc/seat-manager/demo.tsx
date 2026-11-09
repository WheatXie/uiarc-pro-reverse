import { SeatManager } from "./seat-manager";

export const meta = "Live · block";

/** The frame opens on a full workspace: 12 seats paid for, 10 members, 2 invites, nothing changed yet. */
export default function SeatManagerDemo() {
  return <SeatManager />;
}
