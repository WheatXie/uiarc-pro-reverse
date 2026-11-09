"use client";

import McpServers from "./mcp-servers";

export const meta = "Live · block";

/**
 * The live frame runs the block on its own: eight servers, two of them needing attention, and
 * 6.4k of an 8k budget spent. Rows open for their tool list, Add server walks the whole sheet.
 */
export default function McpServersDemo() {
  return <McpServers />;
}
