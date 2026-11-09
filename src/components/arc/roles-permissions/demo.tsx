"use client";

import RolesPermissions from "./roles-permissions";

export const meta = "Live · block";

/**
 * No props beyond the workspace name it already carries: five roles by four permission groups, every group expanded,
 * owners locked and nothing unsaved, which is exactly the state the live frame is photographed in.
 */
export default function RolesPermissionsDemo() {
  return <RolesPermissions />;
}
