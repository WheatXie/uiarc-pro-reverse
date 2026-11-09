"use client";

import InvitePeople from "./invite-people";

/**
 * Default frame state: five teammates, one invite already sent to Tyler Hayes, and an empty
 * chip field on the Starter plan — 6 of 10 seats used.
 */
export default function InvitePeopleDemo() {
  return <InvitePeople />;
}

export const meta = "Live · block";
