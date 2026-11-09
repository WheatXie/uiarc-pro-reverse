import { ProjectBoard } from "./project-board";

export const meta = "Live · block";

/** The frame renders the board at rest: 6 tasks across four columns, 1 of 6 done. */
export default function ProjectBoardDemo() {
  return <ProjectBoard />;
}
