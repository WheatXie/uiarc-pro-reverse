import { FeedbackBoard } from "./feedback-board";

export const meta = "Live · block";

/** The frame shows the board at rest: 7 requests, sorted by Top, all statuses. */
export default function FeedbackBoardDemo() {
  return <FeedbackBoard />;
}
