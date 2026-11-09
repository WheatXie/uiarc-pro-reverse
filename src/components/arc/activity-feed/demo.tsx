import { ActivityFeed } from "./activity-feed";

export const meta = "Live · block";

/** The frame shows the feed flattened into the page: fifteen events, six unread, three more arriving behind the button. */
export default function ActivityFeedDemo() {
  return <ActivityFeed flat />;
}
