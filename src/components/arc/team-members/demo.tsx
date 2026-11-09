"use client";

import TeamMembers from "./team-members";

export const meta = "Live · block";

/**
 * The live frame renders the block with no props: five members (Emma is you and the owner), two
 * pending invites, seven of ten seats used, and the invite field empty.
 */
export default function TeamMembersDemo() {
  return <TeamMembers />;
}
