import { KanbanBoard } from "./kanban-board";

export const meta = "Live · block";

/**
 * The frame renders the board at rest: twelve cards across four status columns, with the
 * in progress and in review columns sitting exactly at their limits.
 */
export default function KanbanBoardDemo() {
  return <KanbanBoard />;
}
