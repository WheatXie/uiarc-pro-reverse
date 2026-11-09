import { InboxTriage } from "./inbox-triage";

export const meta = "Live · block";

/** The frame opens on the Inbox folder: two unread rows, five messages, nothing expanded. */
export default function InboxTriageDemo() {
  return <InboxTriage />;
}
