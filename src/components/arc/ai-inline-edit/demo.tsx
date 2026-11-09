/**
 * AI inline edit demo — the block mounted on its own, exactly as the preview frame renders it. The
 * frame's `app` layout strips the card chrome, so the editor fills the viewport and the demo adds
 * nothing around it: the header, the document and the footer hint are the whole surface.
 */
import { AiInlineEdit } from "./ai-inline-edit";

export const meta = "Live · block";

export default function AiInlineEditDemo() {
  return <AiInlineEdit />;
}
