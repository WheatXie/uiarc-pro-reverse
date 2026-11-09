import EnvVariables from "./env-variables";

export const meta = "Live · block";

/**
 * The frame opens on the list view: 10 keys across the three environments, six of them write-only,
 * with nothing queued for a redeploy yet.
 */
export default function EnvVariablesDemo() {
  return <EnvVariables flat />;
}
