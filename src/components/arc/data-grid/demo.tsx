"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import styles from "./data-grid.module.css";
import { DataGrid, type DataGridColumn, type DataGridRow } from "./data-grid";

const STAGES = ["Discovery", "Proposal", "Negotiation", "Committed", "Closed won", "Closed lost"];
const REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"];

const COLUMNS: DataGridColumn[] = [
  { key: "account", label: "Account", width: 188, minWidth: 112, pinned: true },
  { key: "owner", label: "Owner", width: 148 },
  { key: "region", label: "Region", type: "select", options: REGIONS, width: 144 },
  { key: "stage", label: "Stage", type: "select", options: STAGES, width: 132 },
  { key: "seats", label: "Seats", type: "number", width: 96 },
  { key: "arr", label: "ARR", type: "currency", width: 128 },
  { key: "health", label: "Health", type: "percent", width: 104, minWidth: 84 },
  { key: "renewal", label: "Renews", type: "date", width: 132 },
];

const NAMES = [
  "Northwind", "Lumen", "Cedar", "Brightline", "Harbor", "Pinecrest", "Atlas", "Summit",
  "Fieldstone", "Marigold", "Keystone", "Redwood", "Bluebird", "Copper Creek", "Silverline",
  "Oakridge", "Beacon", "Granite", "Riverbend", "Evergreen", "Lighthouse", "Meridian", "Sparrow",
  "Ironwood", "Juniper", "Halcyon", "Willow", "Crescent", "Tidewater", "Aspen", "Sterling",
  "Foxglove", "Clearwater", "Highland", "Larkspur", "Orchard", "Quarry", "Saltmarsh", "Thistle",
  "Vantage", "Wildflower", "Birchwood", "Coastal", "Driftwood", "Emberly", "Fairmont", "Goldcrest",
  "Hollow Pine", "Kestrel", "Moorland",
];

const SUFFIXES = [
  "Freight", "Health", "Labs", "Credit Union", "Schools", "Robotics", "Outdoor", "Bank", "Foods",
  "Legal", "Analytics", "Travel", "Energy", "Logistics", "Dental", "Architects", "Studios",
  "Insurance", "Clinics", "Hotels", "Motors", "Pharma", "Security", "Capital", "Media", "Farms",
  "Aviation", "Brewing", "Marine", "Software", "Retail", "Partners", "Biotech", "Construction",
  "Realty", "Apparel", "Cloud", "Fitness", "Learning", "Water",
];

const QUALIFIERS = ["", " West", " East", " Europe", " Pacific"];

const OWNERS = [
  "Emma Collins", "Marcus Johnson", "Ryan Sullivan", "Hannah Walsh", "Ava Mitchell", "Tyler Hayes",
  "Daniel Kim", "Priya Raman", "Sofia Álvarez", "Noah Bennett", "Grace Liu", "Owen Park",
];

/**
 * Seeded book of business: 10,000 renewal rows built with a deterministic mulberry32 generator,
 * so the demo renders the same accounts on every load and reset.
 */
function buildRows(): DataGridRow[] {
  let seed = 0x135283b;
  const random = () => {
    let value = Math.imul((seed = (seed + 0x6d2b79f5) | 0) ^ (seed >>> 15), 1 | seed);
    return (
      (((value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value) ^ (value >>> 14)) >>> 0) /
      0x100000000
    );
  };
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  return Array.from({ length: 1e4 }, (_, index) => {
    const name = index % NAMES.length;
    const suffix = Math.floor(index / NAMES.length) % SUFFIXES.length;
    const qualifier = Math.floor(index / (NAMES.length * SUFFIXES.length)) % QUALIFIERS.length;
    const seats = 5 * Math.round((10 + random() ** 2.4 * 790) / 5);
    const price = pick([240, 300, 360, 420]);
    const month = Math.floor(12 * random());
    const day = 1 + Math.floor(28 * random());
    return {
      id: `acct-${index + 1}`,
      account: `${NAMES[name]} ${SUFFIXES[suffix]}${QUALIFIERS[qualifier]}`,
      owner: pick(OWNERS),
      region: pick(REGIONS),
      stage: STAGES[Math.min(STAGES.length - 1, Math.floor(random() ** 1.3 * STAGES.length))],
      seats,
      arr: seats * price,
      health: Math.round(35 + 64 * random()),
      renewal: `${month < 8 ? 2027 : 2026}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  });
}

const ROWS = buildRows();

export const meta = "Live · 10k rows, virtualised";

export default function DataGridDemo() {
  const [rows, setRows] = useState(ROWS);
  const changed = rows !== ROWS;

  return (
    <div className={styles.stage}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <h3 className={styles.title}>Renewals</h3>
        </div>
        <button type="button" className={styles.reset} onClick={() => setRows(ROWS)} disabled={!changed}>
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          Reset
        </button>
      </div>
      <DataGrid
        label="Renewals"
        columns={COLUMNS}
        rows={rows}
        onRowsChange={setRows}
        maxHeight={440}
        exportFileName="renewals"
        exportFormats={["csv", "xlsx"]}
      />
    </div>
  );
}
