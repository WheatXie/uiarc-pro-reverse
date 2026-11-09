"use client";

import { OrbitLogos, type OrbitLogo } from "./orbit-logos";
import styles from "./orbit-logos.module.css";

export const meta = "Live · component";

const asset = (name: string) => `/block-logos/${name}-color.svg`;

const GITHUB =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

const LOGOS: OrbitLogo[] = [
  {
    name: "Stripe",
    icon: asset("stripe"),
    category: "Payments",
    description: "Starts trials and bills usage from your plans",
    href: "https://docs.stripe.com",
  },
  {
    name: "GitHub",
    icon: GITHUB,
    category: "Dev",
    description: "Opens pull requests from approved reviews",
    href: "https://docs.github.com",
    connected: true,
  },
  {
    name: "Slack",
    icon: asset("slack"),
    category: "Comms",
    description: "Posts deploy alerts to the right channels",
    href: "https://api.slack.com",
    connected: true,
  },
  {
    name: "Figma",
    icon: asset("figma"),
    category: "Design",
    description: "Links frames to the tickets they belong to",
    href: "https://www.figma.com/developers",
    connected: true,
  },
  {
    name: "Google Drive",
    icon: asset("googledrive"),
    category: "Storage",
    description: "Attaches shared files to records",
    href: "https://developers.google.com/drive",
  },
  {
    name: "Linear",
    icon: asset("linear"),
    category: "Dev",
    description: "Syncs issues and status both ways",
    href: "https://linear.app/developers",
  },
  {
    name: "Shopify",
    icon: asset("shopify"),
    category: "Payments",
    description: "Imports orders and refunds as they happen",
    href: "https://shopify.dev",
  },
  {
    name: "Discord",
    icon: asset("discord"),
    category: "Comms",
    description: "Answers your community from one inbox",
    href: "https://discord.com/developers/docs",
  },
  {
    name: "Vercel",
    icon: "m12 1.608 12 20.784H0Z",
    category: "Dev",
    description: "Comments preview links on every build",
    href: "https://vercel.com/docs",
    connected: true,
  },
  {
    name: "Dropbox",
    icon: asset("dropbox"),
    category: "Storage",
    description: "Backs up exports to a shared folder",
    href: "https://www.dropbox.com/developers",
  },
  {
    name: "Framer",
    icon: asset("framer"),
    category: "Design",
    description: "Publishes changelog pages to your site",
    href: "https://www.framer.com/developers",
  },
  {
    name: "Cloudflare",
    icon: asset("cloudflare"),
    category: "Dev",
    description: "Purges the cache when you release",
    href: "https://developers.cloudflare.com",
  },
  {
    name: "Loom",
    icon: asset("loom"),
    category: "Comms",
    description: "Embeds walkthroughs in bug reports",
    href: "https://dev.loom.com",
  },
  {
    name: "Supabase",
    icon: asset("supabase"),
    category: "Storage",
    description: "Streams new rows as events",
    href: "https://supabase.com/docs",
  },
];

export default function OrbitLogosDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <OrbitLogos logos={LOGOS} label="Integrations" />
    </div>
  );
}
