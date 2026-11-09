"use client";

import ProfilePage from "./profile-page";

export const meta = "Live · block";

/**
 * No props: the block ships Jasmine Brooks' sample profile, seven activity entries and four project
 * cards, with the sheet closed on the activity tab — the state the live frame is photographed in.
 */
export default function ProfilePageDemo() {
  return <ProfilePage />;
}
