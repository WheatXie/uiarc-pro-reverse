"use client";

import KnowledgeBase from "./knowledge-base";

export const meta = "Live · block";

/**
 * No props: the block runs its own five-source workspace, with one crawl still ingesting and one Drive
 * document stuck in embed, which is exactly the state the live frame is photographed in.
 */
export default function KnowledgeBaseDemo() {
  return <KnowledgeBase />;
}
