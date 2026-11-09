import { AppWindow, LayoutDashboard, Warehouse } from "lucide-react";
import DataFlow, { type DataFlowDestination, type DataFlowNode } from "./data-flow";
import styles from "./data-flow.module.css";

export const meta = "Live · component";

const logo = (name: string) => `/block-logos/${name}-color.svg`;

const SOURCES: DataFlowNode[] = [
  {
    id: "app",
    label: "App",
    meta: "Web and iOS",
    detail: "Clicks and sessions as they happen",
    icon: <AppWindow />,
  },
  {
    id: "database",
    label: "Database",
    meta: "Supabase",
    detail: "Row changes through change data capture",
    icon: logo("supabase"),
  },
  {
    id: "events",
    label: "Events",
    meta: "Stripe webhooks",
    detail: "Payments, refunds and disputes",
    icon: logo("stripe"),
  },
];

const DESTINATIONS: DataFlowDestination[] = [
  {
    id: "warehouse",
    label: "Warehouse",
    meta: "Every record",
    detail: "Stored in full for analysis",
    icon: <Warehouse />,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    meta: "Live metrics",
    detail: "Rolled up into metrics each minute",
    icon: <LayoutDashboard />,
  },
  {
    id: "alerts",
    label: "Alerts",
    meta: "Slack",
    detail: "Only unusual records reach #data-alerts",
    icon: logo("slack"),
    share: 0.34,
  },
];

export default function DataFlowDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <DataFlow sources={SOURCES} destinations={DESTINATIONS} />
    </div>
  );
}
