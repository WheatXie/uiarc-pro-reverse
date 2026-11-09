"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Mail,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  ScanText,
  Square,
  TriangleAlert,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs/tabs";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import styles from "./document-extract.module.css";

/* -------------------------------------------------------------------------------------------------
 * Document + schema model
 * -----------------------------------------------------------------------------------------------*/

/** A run of text that maps back to a region of the source document. */
export interface SpanPart {
  /** Stable id of the source region inside the document. */
  span: string;
  text: string;
}

/** Text as it appears in the document: either plain, or with linkable spans mixed in. */
export type Rich = string | (string | SpanPart)[];

/** How a document is drawn in the viewer. */
export type DocumentKind = "pdf" | "email";

/** A logo lockup printed at the top of the document. */
export interface DocLogo {
  name: string;
  detail?: string;
  color?: string;
  symbol?: "petals" | "peak";
}

/** Every block type the viewer knows how to draw. */
export type DocBlock =
  | { type: "masthead"; logo?: DocLogo; title?: string }
  | { type: "email"; subject: Rich; from: { name: Rich; address: string }; to: string; date: string }
  | { type: "columns"; columns: DocBlock[][] }
  | { type: "meta"; items: [string, Rich][] }
  | { type: "table"; columns: { label: string; align?: "end" }[]; details?: string[]; rows: Rich[][] }
  | { type: "totals"; rows: { label: Rich; value: Rich; strong?: boolean }[] }
  | { type: "heading"; text: Rich }
  | { type: "paragraph"; tone?: "muted"; text: Rich }
  | { type: "lines"; label?: string; lines: Rich[] }
  | { type: "pairs"; rows: [string, Rich][] }
  | { type: "rule" }
  | { type: "footer"; lines: Rich[] };

/** A document the viewer can show. */
export interface SourceDocument {
  id: string;
  name: string;
  label: string;
  kind?: DocumentKind;
  meta?: string;
  blocks: DocBlock[];
}

/** Scalar types a field can carry. */
export type ValueType = "string" | "date" | "money" | "currency" | "iban" | "integer" | "number";

/** Field types, including the repeating table. */
export type FieldType = ValueType | "table";

/** One column of a table field. */
export interface TableColumn {
  key: string;
  label: string;
  type: ValueType;
}

/** One extracted field. */
export interface ExtractField {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  description?: string;
  columns?: TableColumn[];
}

/** The output format handed to the model. */
export interface ExtractSchema {
  name: string;
  title: string;
  description?: string;
  groups?: { key: string; label: string }[];
  fields: ExtractField[];
}

/** The model the pane reports usage for. */
export interface ExtractModel {
  name: string;
  id: string;
  inputPrice: number;
  outputPrice: number;
}

/** A document paired with the schema it is read into. */
export interface ExtractSample {
  document: SourceDocument;
  schema: ExtractSchema;
}

/** One value the model produced. */
export interface ExtractedValue {
  value: string;
  source?: string;
  confidence?: number;
  note?: string;
  review?: "edited" | "checked";
  accepted?: boolean;
}

/** Events a streaming extractor yields. */
export type ExtractEvent =
  | ({ type: "value"; path: string } & ExtractedValue)
  | { type: "usage"; inputTokens: number; outputTokens: number };

/** A streaming extractor. May return an async iterable, or a promise of the whole list. */
export type ExtractRunner = (
  document: SourceDocument,
  schema: ExtractSchema,
  options: { signal: AbortSignal },
) => AsyncIterable<ExtractEvent> | Promise<ExtractEvent[]>;

/* -------------------------------------------------------------------------------------------------
 * Sample data
 * -----------------------------------------------------------------------------------------------*/

/** Pricing for the model named in the footer. */
const MODEL: ExtractModel = {
  name: "Claude Haiku 5.5",
  id: "claude-haiku-5-5",
  inputPrice: 0.1,
  outputPrice: 0.5,
};

/** A document without an explicit kind is a PDF unless it looks like an email. */
const kindOf = (document: SourceDocument): DocumentKind =>
  document.kind ?? (/\.(eml|msg)$/i.test(document.name) ? "email" : "pdf");

const invoiceSpan = (row: number, key: string, text: string): SpanPart => ({ span: `li-${row}-${key}`, text });

/** A supplier invoice, drawn as a single A4 page. */
export const sampleInvoice: SourceDocument = {
  id: "invoice",
  name: "larkspur-invoice-0418.pdf",
  label: "Invoice",
  kind: "pdf",
  meta: "PDF, 1 page",
  blocks: [
    {
      type: "masthead",
      logo: { name: "larkspur", detail: "studio", color: "#3d4fc4", symbol: "petals" },
      title: "Invoice",
    },
    {
      type: "columns",
      columns: [
        [
          {
            type: "lines",
            label: "From",
            lines: [
              [{ span: "vendor", text: "Larkspur Studio GmbH" }],
              "Langstrasse 112",
              "8004 Zürich, Switzerland",
              "VAT CHE-412.773.905 MWST",
            ],
          },
        ],
        [
          {
            type: "lines",
            label: "Bill to",
            lines: ["Fjord Analytics AG", "Attn. Lena Brunner", "Seefeldstrasse 45", "8008 Zürich, Switzerland"],
          },
        ],
      ],
    },
    {
      type: "meta",
      items: [
        ["Invoice no.", [{ span: "number", text: "INV-2026-0418" }]],
        ["Issue date", [{ span: "issue", text: "14 October 2026" }]],
        ["Payment terms", [{ span: "terms", text: "30 days net" }]],
        ["Customer no.", "FJ-20931"],
      ],
    },
    {
      type: "table",
      columns: [
        { label: "Description" },
        { label: "Qty", align: "end" },
        { label: "Unit price", align: "end" },
        { label: "Amount", align: "end" },
      ],
      details: [
        "Discovery, flows and high fidelity screens",
        "Moderated remote sessions, 45 minutes each",
        "Tokens, components and usage notes",
        "Staging environment for the test rounds",
      ],
      rows: [
        [
          [invoiceSpan(0, "d", "Product design sprint, week 41")],
          [invoiceSpan(0, "q", "5"), " days"],
          [invoiceSpan(0, "u", "1,400.00")],
          [invoiceSpan(0, "a", "7,000.00")],
        ],
        [
          [invoiceSpan(1, "d", "Usability testing sessions")],
          [invoiceSpan(1, "q", "6")],
          [invoiceSpan(1, "u", "260.00")],
          [invoiceSpan(1, "a", "1,560.00")],
        ],
        [
          [invoiceSpan(2, "d", "Design system audit")],
          [invoiceSpan(2, "q", "1")],
          [invoiceSpan(2, "u", "2,400.00")],
          [invoiceSpan(2, "a", "2,400.00")],
        ],
        [
          [invoiceSpan(3, "d", "Prototype hosting, October")],
          [invoiceSpan(3, "q", "1")],
          [invoiceSpan(3, "u", "45.00")],
          [invoiceSpan(3, "a", "45.00")],
        ],
      ],
    },
    {
      type: "totals",
      rows: [
        { label: "Subtotal", value: [{ span: "subtotal", text: "11,005.00" }] },
        { label: "VAT 8.1%", value: [{ span: "vat", text: "891.41" }] },
        {
          label: ["Total due ", { span: "currency", text: "CHF" }],
          value: [{ span: "total", text: "11,896.41" }],
          strong: true,
        },
      ],
    },
    { type: "heading", text: "Payment details" },
    {
      type: "pairs",
      rows: [
        ["Account holder", "Larkspur Studio GmbH"],
        ["IBAN", [{ span: "iban", text: "CH56 0483 5012 3456 7800 9" }]],
        ["Reference", "INV-2026-0418"],
      ],
    },
    {
      type: "paragraph",
      tone: "muted",
      text: "Our bank details changed on 1 October 2026. Please stop using CH69 0070 0110 0012 3456 7 for new payments.",
    },
    {
      type: "footer",
      lines: ["Larkspur Studio GmbH · Langstrasse 112 · 8004 Zürich", "billing@larkspur.example · larkspur.example"],
    },
  ],
};

/** The fields pulled out of an invoice. */
export const invoiceSchema: ExtractSchema = {
  name: "invoice",
  title: "Invoice",
  description: "A supplier invoice with its line items, totals and payment details.",
  groups: [
    { key: "details", label: "Invoice" },
    { key: "items", label: "Line items" },
    { key: "totals", label: "Totals" },
    { key: "payment", label: "Payment" },
  ],
  fields: [
    {
      key: "vendor",
      label: "Vendor",
      type: "string",
      group: "details",
      description: "Legal name of the company that issued the invoice.",
    },
    { key: "invoiceNumber", label: "Invoice no.", type: "string", group: "details" },
    { key: "issueDate", label: "Issue date", type: "date", group: "details" },
    {
      key: "dueDate",
      label: "Due date",
      type: "date",
      group: "details",
      description: "Infer from the payment terms when no date is printed.",
    },
    {
      key: "lineItems",
      label: "Line items",
      type: "table",
      group: "items",
      columns: [
        { key: "description", label: "Description", type: "string" },
        { key: "quantity", label: "Qty", type: "number" },
        { key: "unitPrice", label: "Unit price", type: "money" },
        { key: "amount", label: "Amount", type: "money" },
      ],
    },
    { key: "currency", label: "Currency", type: "currency", group: "totals", description: "ISO 4217 code." },
    { key: "subtotal", label: "Subtotal", type: "money", group: "totals" },
    { key: "vat", label: "VAT", type: "money", group: "totals" },
    { key: "total", label: "Total", type: "money", group: "totals" },
    { key: "iban", label: "IBAN", type: "iban", group: "payment", description: "The account to pay into now." },
  ],
};

const shipmentSpan = (row: number, key: string, text: string): SpanPart => ({ span: `it-${row}-${key}`, text });

/** A shipping confirmation, drawn as an email. */
export const sampleEmail: SourceDocument = {
  id: "shipping",
  name: "Your order HD-58213 is on its way.eml",
  label: "Shipping email",
  kind: "email",
  meta: "Email",
  blocks: [
    {
      type: "email",
      subject: "Your order HD-58213 is on its way",
      from: { name: [{ span: "merchant", text: "Halden Outdoor" }], address: "orders@haldenoutdoor.example" },
      to: "Maya Lindqvist",
      date: "Fri, 16 Oct 2026, 09:42",
    },
    { type: "masthead", logo: { name: "halden", detail: "outdoor", color: "#1f6a50", symbol: "peak" } },
    { type: "paragraph", text: "Hi Maya," },
    {
      type: "paragraph",
      text: [
        "Good news: your order ",
        { span: "order", text: "HD-58213" },
        " ",
        { span: "shipped", text: "shipped today" },
        " from our warehouse in Rotterdam. It is travelling with ",
        { span: "carrier", text: "DHL Express" },
        " and should arrive on ",
        { span: "eta", text: "Tuesday, 20 October" },
        ".",
      ],
    },
    {
      type: "meta",
      items: [
        ["Tracking number", [{ span: "tracking", text: "JVGL 0624 1180 3317" }]],
        ["Shipping to", [{ span: "recipient", text: "Maya Lindqvist" }]],
      ],
    },
    { type: "lines", lines: [[{ span: "address", text: "Kungsgatan 18, 111 43 Stockholm, Sweden" }]] },
    { type: "heading", text: "Items in this shipment" },
    {
      type: "table",
      columns: [{ label: "Item" }, { label: "Qty", align: "end" }, { label: "Price", align: "end" }],
      rows: [
        [[shipmentSpan(0, "d", "Trail shell jacket, slate, M")], [shipmentSpan(0, "q", "1")], ["€", shipmentSpan(0, "a", "189.00")]],
        [[shipmentSpan(1, "d", "Merino base layer, M")], [shipmentSpan(1, "q", "2")], ["€", shipmentSpan(1, "a", "118.00")]],
        [[shipmentSpan(2, "d", "Insulated bottle, 750 ml")], [shipmentSpan(2, "q", "1")], ["€", shipmentSpan(2, "a", "34.00")]],
      ],
    },
    {
      type: "totals",
      rows: [
        { label: "Shipping", value: [{ span: "shipping", text: "Free" }] },
        { label: "Total paid", value: [{ span: "currency", text: "€" }, { span: "total", text: "341.00" }], strong: true },
      ],
    },
    {
      type: "paragraph",
      tone: "muted",
      text: "Your wool beanie ships separately once it is back in stock on 27 October.",
    },
    { type: "paragraph", text: "Thanks for shopping with us,\nThe Halden Outdoor team" },
    {
      type: "footer",
      lines: [
        "Halden Outdoor · Westerkade 4 · 3016 CM Rotterdam",
        "You get this email because you ordered from haldenoutdoor.example",
      ],
    },
  ],
};

/** The fields pulled out of a shipping email. */
export const shipmentSchema: ExtractSchema = {
  name: "shipment",
  title: "Shipment",
  description: "A shipping confirmation with the carrier, dates, address and the items in the parcel.",
  groups: [
    { key: "order", label: "Order" },
    { key: "delivery", label: "Delivery" },
    { key: "items", label: "Items" },
    { key: "totals", label: "Totals" },
  ],
  fields: [
    { key: "merchant", label: "Merchant", type: "string", group: "order" },
    { key: "orderNumber", label: "Order no.", type: "string", group: "order" },
    { key: "carrier", label: "Carrier", type: "string", group: "delivery" },
    { key: "trackingNumber", label: "Tracking no.", type: "string", group: "delivery" },
    {
      key: "shipDate",
      label: "Ship date",
      type: "date",
      group: "delivery",
      description: "Resolve relative dates against the email date.",
    },
    { key: "estimatedDelivery", label: "Arrives", type: "date", group: "delivery" },
    { key: "recipient", label: "Recipient", type: "string", group: "delivery" },
    { key: "shipTo", label: "Ship to", type: "string", group: "delivery" },
    {
      key: "items",
      label: "Items",
      type: "table",
      group: "items",
      columns: [
        { key: "description", label: "Item", type: "string" },
        { key: "quantity", label: "Qty", type: "integer" },
        { key: "amount", label: "Amount", type: "money" },
      ],
    },
    { key: "currency", label: "Currency", type: "currency", group: "totals", description: "ISO 4217 code." },
    { key: "shippingCost", label: "Shipping", type: "money", group: "totals" },
    { key: "total", label: "Total", type: "money", group: "totals" },
  ],
};

const SAMPLES: ExtractSample[] = [
  { document: sampleInvoice, schema: invoiceSchema },
  { document: sampleEmail, schema: shipmentSchema },
];

/** Builds the flat table-cell paths for a table field. */
const tableValues = (
  key: string,
  prefix: string,
  rows: string[][],
  columns: string[],
  sources: string[],
  confidence: number[][],
): ExtractEvent[] =>
  rows.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => ({
      type: "value" as const,
      path: `${key}.${rowIndex}.${columns[columnIndex]}`,
      value,
      source: `${prefix}-${rowIndex}-${sources[columnIndex]}`,
      confidence: confidence[rowIndex]?.[columnIndex] ?? 0.97,
    })),
  );

/** Scripted runs: what the model would return for each sample, in order. */
const RUNS: Record<string, { inputTokens: number; failAfter?: number; values: ExtractEvent[] }> = {
  invoice: {
    inputTokens: 1920,
    values: [
      { type: "value", path: "vendor", value: "Larkspur Studio GmbH", source: "vendor", confidence: 0.99 },
      { type: "value", path: "invoiceNumber", value: "INV-2026-0418", source: "number", confidence: 0.99 },
      { type: "value", path: "issueDate", value: "2026-10-14", source: "issue", confidence: 0.98 },
      {
        type: "value",
        path: "dueDate",
        value: "2026-11-13",
        source: "terms",
        confidence: 0.64,
        note: "Not printed. Worked out as the issue date plus 30 days net.",
      },
      ...tableValues(
        "lineItems",
        "li",
        [
          ["Product design sprint, week 41", "5", "1,400.00", "7,000.00"],
          ["Usability testing sessions", "6", "260.00", "1,560.00"],
          ["Design system audit", "1", "2,400.00", "2,400.00"],
          ["Prototype hosting, October", "1", "45.00", "45.00"],
        ],
        ["description", "quantity", "unitPrice", "amount"],
        ["d", "q", "u", "a"],
        [
          [0.98, 0.93, 0.99, 0.99],
          [0.99, 0.98, 0.99, 0.99],
          [0.99, 0.98, 0.99, 0.99],
          [0.97, 0.98, 0.99, 0.99],
        ],
      ),
      { type: "value", path: "currency", value: "CHF", source: "currency", confidence: 0.97 },
      { type: "value", path: "subtotal", value: "11,005.00", source: "subtotal", confidence: 0.99 },
      { type: "value", path: "vat", value: "891.41", source: "vat", confidence: 0.97 },
      { type: "value", path: "total", value: "11,896.41", source: "total", confidence: 0.99 },
      {
        type: "value",
        path: "iban",
        value: "CH56 0483 5012 3456 7800 9",
        source: "iban",
        confidence: 0.72,
        note: "Two account numbers on the page. Took the current one, the other is marked as closed.",
      },
    ],
  },
  shipping: {
    inputTokens: 1340,
    failAfter: 4,
    values: [
      { type: "value", path: "merchant", value: "Halden Outdoor", source: "merchant", confidence: 0.98 },
      { type: "value", path: "orderNumber", value: "HD-58213", source: "order", confidence: 0.99 },
      { type: "value", path: "carrier", value: "DHL Express", source: "carrier", confidence: 0.99 },
      { type: "value", path: "trackingNumber", value: "JVGL 0624 1180 3317", source: "tracking", confidence: 0.97 },
      {
        type: "value",
        path: "shipDate",
        value: "2026-10-16",
        source: "shipped",
        confidence: 0.74,
        note: "The email says shipped today. Read today as the date the email was sent.",
      },
      {
        type: "value",
        path: "estimatedDelivery",
        value: "2026-10-20",
        source: "eta",
        confidence: 0.79,
        note: "No year in the text. Took 2026 from the email date.",
      },
      { type: "value", path: "recipient", value: "Maya Lindqvist", source: "recipient", confidence: 0.99 },
      {
        type: "value",
        path: "shipTo",
        value: "Kungsgatan 18, 111 43 Stockholm, Sweden",
        source: "address",
        confidence: 0.97,
      },
      ...tableValues(
        "items",
        "it",
        [
          ["Trail shell jacket, slate, M", "1", "189.00"],
          ["Merino base layer, M", "2", "118.00"],
          ["Insulated bottle, 750 ml", "1", "34.00"],
        ],
        ["description", "quantity", "amount"],
        ["d", "q", "a"],
        [
          [0.98, 0.99, 0.99],
          [0.98, 0.97, 0.96],
          [0.99, 0.99, 0.99],
        ],
      ),
      { type: "value", path: "currency", value: "EUR", source: "currency", confidence: 0.95 },
      { type: "value", path: "shippingCost", value: "0.00", source: "shipping", confidence: 0.93 },
      { type: "value", path: "total", value: "341.00", source: "total", confidence: 0.99 },
    ],
  },
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

/** A cancellable pause, so a run stops the moment the stop button is pressed. */
const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** Rough output-token cost of one value, so the footer number climbs while a run streams. */
const tokensFor = (value: { value: string }) => 6 + Math.ceil(value.value.length / 3.2);

/** Flattens rich text to a string, for the text version of a document. */
const plainText = (text: Rich): string =>
  typeof text === "string" ? text : text.map(part => (typeof part === "string" ? part : part.text)).join("");

/** The plain-text reading of a document, as handed to the model. */
export function documentToText(document: SourceDocument): string {
  const blockText = (block: DocBlock): string => {
    switch (block.type) {
      case "masthead":
        return [block.logo ? [block.logo.name, block.logo.detail].filter(Boolean).join(" ") : "", block.title ?? ""]
          .filter(Boolean)
          .join("\n");
      case "email":
        return `From: ${plainText(block.from.name)} <${block.from.address}>
To: ${block.to}
Date: ${block.date}
Subject: ${plainText(block.subject)}`;
      case "heading":
      case "paragraph":
        return plainText(block.text);
      case "lines":
        return [block.label, ...block.lines.map(plainText)].filter(Boolean).join("\n");
      case "pairs":
      case "meta": {
        const rows: [string, Rich][] = block.type === "pairs" ? block.rows : block.items;
        return rows.map(([label, value]) => `${label}: ${plainText(value)}`).join("\n");
      }
      case "columns":
        return block.columns.map(column => column.map(blockText).join("\n\n")).join("\n\n");
      case "table":
        return [
          block.columns.map(column => column.label).join(" | "),
          ...block.rows.map(
            (row, index) => row.map(plainText).join(" | ") + (block.details?.[index] ? ` (${block.details[index]})` : ""),
          ),
        ].join("\n");
      case "totals":
        return block.rows.map(row => `${plainText(row.label)}: ${plainText(row.value)}`).join("\n");
      case "footer":
        return block.lines.map(plainText).join("\n");
      case "rule":
        return "";
    }
  };
  return document.blocks.map(blockText).filter(Boolean).join("\n\n");
}

const JSON_TYPES = {
  string: { type: "string" },
  date: { type: "string", format: "date" },
  money: { type: "number", multipleOf: 0.01 },
  currency: { type: "string", pattern: "^[A-Z]{3}$" },
  iban: { type: "string", pattern: "^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$" },
  integer: { type: "integer" },
  number: { type: "number" },
} as const;

/** The JSON Schema handed to the model as its output format. */
export function toJsonSchema(schema: ExtractSchema): Record<string, unknown> {
  const property = (field: ValueType | undefined) => {
    const type = JSON_TYPES[field ?? "string"];
    return { ...type, type: [type.type, "null"] };
  };
  const scalar = (field: ExtractField) => ({
    ...property(field.type === "table" ? "string" : field.type),
    description: field.description ?? field.label,
  });
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: schema.title,
    ...(schema.description ? { description: schema.description } : {}),
    type: "object",
    additionalProperties: false,
    required: schema.fields.map(field => field.key),
    properties: Object.fromEntries(
      schema.fields.map(field => [
        field.key,
        field.type === "table"
          ? {
              type: "array",
              description: field.description ?? field.label,
              items: {
                type: "object",
                additionalProperties: false,
                required: (field.columns ?? []).map(column => column.key),
                properties: Object.fromEntries(
                  (field.columns ?? []).map(column => [column.key, scalar({ ...column, type: column.type })]),
                ),
              },
            }
          : scalar(field),
      ]),
    ),
  };
}

/** Turns a written value into its typed form, or `undefined` when it does not fit the type. */
function parseValue(type: ValueType, raw: string): string | number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  switch (type) {
    case "string":
      return text;
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
      const date = new Date(`${text}T00:00:00Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
    }
    case "currency":
      return /^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : undefined;
    case "iban": {
      const compact = text.replace(/\s+/g, "").toUpperCase();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return undefined;
      const digits = (compact.slice(4) + compact.slice(0, 4)).replace(/[A-Z]/g, letter =>
        String(letter.charCodeAt(0) - 55),
      );
      let remainder = 0;
      for (const digit of digits) remainder = (10 * remainder + Number(digit)) % 97;
      return remainder === 1 ? compact : undefined;
    }
    case "money":
    case "number":
    case "integer": {
      const number = Number(text.replace(/[\s,'’]/g, ""));
      if (!Number.isFinite(number)) return undefined;
      if (type === "integer") return Number.isInteger(number) ? number : undefined;
      return type === "money" ? Math.round(100 * number) / 100 : number;
    }
  }
}

const FIELD_ERRORS: Record<ValueType, string> = {
  string: "Text",
  date: "Use YYYY-MM-DD",
  money: "Use a number such as 1,250.00",
  currency: "Use a three letter code such as EUR",
  iban: "This IBAN does not pass its check digits",
  integer: "Use a whole number",
  number: "Use a number",
};

const IDLE_LABELS: Record<ValueType, string> = {
  string: "Text",
  date: "Date",
  money: "Amount",
  currency: "Code",
  iban: "IBAN",
  integer: "Number",
  number: "Number",
};

/** A value is only worth flagging while it is still unchecked and unaccepted. */
const isLow = (value: ExtractedValue | undefined, threshold: number) =>
  !!value && value.confidence !== undefined && value.confidence < threshold && !value.review && !value.accepted;

const inputModeFor = (type: ValueType): HTMLAttributes<HTMLInputElement>["inputMode"] =>
  type === "money" || type === "number" ? "decimal" : type === "integer" ? "numeric" : undefined;

const isNumeric = (type: ValueType) => type === "money" || type === "number" || type === "integer";

/** Two paths are related when one contains the other, so a row lights up for its cells. */
const isRelated = (a: string | null, b: string) =>
  !!a && (a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`));

const toneStyle = (tone = 1) => ({ "--tone": `var(--series-${tone})` }) as CSSProperties;

/** Hover wiring only makes sense for a real pointer. */
const mouseOnly = (run: (event: ReactPointerEvent) => void) => (event: ReactPointerEvent) => {
  if (event.pointerType === "mouse") run(event);
};

/* -------------------------------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------------------------*/

type Phase = "idle" | "extracting" | "done" | "failed" | "stopped";
type AcceptState = "no" | "pending" | "yes";

interface ExtractState {
  phase: Phase;
  run: number;
  values: Record<string, ExtractedValue>;
  edits: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  accepted: AcceptState;
  started?: number;
  ended?: number;
  error?: string;
}

type ExtractAction =
  | { type: "reset" }
  | { type: "start"; now: number }
  | ({ type: "value" } & ExtractEvent & { type: "value" })
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; now: number }
  | { type: "fail"; message: string; now: number }
  | { type: "stop"; now: number }
  | { type: "edit"; path: string; value: string }
  | { type: "check"; path: string; threshold: number }
  | { type: "acceptAll" }
  | { type: "accepted" }
  | { type: "unaccept" };

const initialState: ExtractState = {
  phase: "idle",
  run: 0,
  values: {},
  edits: {},
  inputTokens: 0,
  outputTokens: 0,
  accepted: "no",
};

function reducer(state: ExtractState, action: ExtractAction): ExtractState {
  switch (action.type) {
    case "reset":
      return { ...initialState, run: state.run };
    case "start":
      return { ...initialState, phase: "extracting", run: state.run + 1, started: action.now };
    case "value": {
      const { path, value, source, confidence, note } = action;
      return { ...state, values: { ...state.values, [path]: { value, source, confidence, note } } };
    }
    case "usage":
      return { ...state, inputTokens: action.inputTokens, outputTokens: action.outputTokens };
    case "finish":
      return { ...state, phase: "done", ended: action.now };
    case "fail":
      return { ...state, phase: "failed", ended: action.now, error: action.message };
    case "stop":
      return state.phase === "extracting" ? { ...state, phase: "stopped", ended: action.now } : state;
    case "edit": {
      const previous = state.values[action.path];
      if (previous?.value === action.value) return state;
      return {
        ...state,
        accepted: "no",
        edits: { ...state.edits, [action.path]: (state.edits[action.path] ?? 0) + 1 },
        values: {
          ...state.values,
          [action.path]: { ...previous, value: action.value, review: "edited", accepted: false },
        },
      };
    }
    case "check": {
      const values = { ...state.values };
      for (const [path, value] of Object.entries(values)) {
        if ((path === action.path || path.startsWith(`${action.path}.`)) && isLow(value, action.threshold)) {
          values[path] = { ...value, review: "checked" };
        }
      }
      return { ...state, values };
    }
    case "acceptAll":
      return {
        ...state,
        accepted: "pending",
        values: Object.fromEntries(Object.entries(state.values).map(([path, value]) => [path, { ...value, accepted: true }])),
      };
    case "accepted":
      return { ...state, accepted: "yes" };
    case "unaccept":
      return {
        ...state,
        accepted: "no",
        values: Object.fromEntries(Object.entries(state.values).map(([path, value]) => [path, { ...value, accepted: false }])),
      };
  }
}

/** Every value that belongs to a field, including the cells of a table row. */
const valuesOf = (key: string, values: Record<string, ExtractedValue>) =>
  Object.entries(values)
    .filter(([path]) => path === key || path.startsWith(`${key}.`))
    .map(([, value]) => value);

/** Eases a number towards its target in a straight line, for the confidence readout. */
function useEasedNumber(target: number, direct: boolean, duration = 320) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  const latest = useRef(target);
  useEffect(() => {
    if (direct) {
      latest.current = target;
      return;
    }
    current.current = latest.current;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const next = current.current + (target - current.current) * (1 - (1 - progress) ** 3);
      latest.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, direct, duration]);
  return direct ? target : shown;
}

/** Scrolls a target into a scroll container, keeping clear of the sticky status line. */
function scrollInto(container: HTMLElement | null, target: Element | null, behavior: ScrollBehavior, pad = 32) {
  if (!container || !target) return;
  const box = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const sticky = container.querySelector("[data-sticky]");
  const top = box.top + (sticky ? sticky.getBoundingClientRect().height : 0) + pad;
  const bottom = box.bottom - pad;
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = rect.height > bottom - top || rect.top < top ? rect.top - top : rect.bottom - bottom;
  container.scrollTo({ top: container.scrollTop + delta, behavior });
}

const escapePath = (path: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(path) : path.replace(/"/g, '\\"'));

/** The first visible control bound to a path. */
const findControl = (root: HTMLElement | null, path: string) =>
  root
    ? ([...root.querySelectorAll<HTMLElement>(`[data-link="${escapePath(path)}"]`)].find(
        node => node.getClientRects().length > 0,
      ) ?? null)
    : null;

/* -------------------------------------------------------------------------------------------------
 * Small parts
 * -----------------------------------------------------------------------------------------------*/

/** Grows and collapses its height when the status line above the form swaps. */
function Collapse({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      style={{ overflow: "hidden" }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** Enters from nothing when a note or an error appears, and folds away when it clears. */
function Reveal({ children, className, reduced }: { children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <motion.div
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              ...motionTokens.spring.smooth,
              opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
            }
      }
    >
      {children}
    </motion.div>
  );
}

interface ConfidenceProps {
  state?: ExtractedValue;
  threshold: number;
  reduced: boolean;
  idle?: string;
  delay?: number;
}

/** The right-hand readout: a type hint before a value lands, then its confidence. */
function Confidence({ state, threshold, reduced, idle, delay = 0 }: ConfidenceProps) {
  let key: "idle" | "accepted" | "edited" | "checked" | "check" | "ok" = "idle";
  let icon: ReactNode = null;
  let label = idle ?? null;
  let tone: "muted" | "success" | "warning" = "muted";
  let spoken: string | undefined;
  const percent = state?.confidence !== undefined ? Math.round(100 * state.confidence) : undefined;

  if (state?.accepted) {
    key = "accepted";
    icon = <Check aria-hidden="true" />;
    label = state.review === "edited" ? "Edited" : percent !== undefined ? `${percent}%` : "Done";
    tone = "success";
    spoken = state.review === "edited" ? "Edited and accepted" : `Accepted, confidence ${percent} percent`;
  } else if (state?.review === "edited") {
    key = "edited";
    icon = <Pencil aria-hidden="true" />;
    label = "Edited";
  } else if (state?.review === "checked") {
    key = "checked";
    icon = <Check aria-hidden="true" />;
    label = `${percent}%`;
    tone = "success";
    spoken = `Checked, confidence ${percent} percent`;
  } else if (percent !== undefined && state?.confidence !== undefined) {
    if (state.confidence < threshold) {
      key = "check";
      icon = <TriangleAlert aria-hidden="true" />;
      label = `${percent}%`;
      tone = "warning";
      spoken = `Low confidence, ${percent} percent, check this value`;
    } else {
      key = "ok";
      label = `${percent}%`;
      spoken = `Confidence ${percent} percent`;
    }
  }

  const pop = key === "accepted" || key === "checked";
  return (
    <span className={styles.conf} data-tone={tone}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={key}
          className={styles.confInner}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1, delay } }}
          transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard], delay }}
        >
          {icon &&
            (pop && !reduced ? (
              <motion.span
                className={styles.confIcon}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ ...motionTokens.spring.snappy, delay }}
              >
                {icon}
              </motion.span>
            ) : (
              <span className={styles.confIcon}>{icon}</span>
            ))}
          <span aria-hidden={spoken ? true : undefined}>{label}</span>
          {spoken && <span className={styles.srOnly}>{spoken}</span>}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Fields
 * -----------------------------------------------------------------------------------------------*/

interface FieldContext {
  values: Record<string, ExtractedValue>;
  threshold: number;
  busy: boolean;
  reduced: boolean;
  activePath: string | null;
  tones: Record<string, number>;
  order: Record<string, number>;
  onHover: (path: string | null) => void;
  onFocusPath: (path: string | null) => void;
  onEdit: (path: string, value: string) => void;
  onCheck: (path: string) => void;
}

/** One editable value with its confidence readout, note and type error. */
function FieldRow({ field, ctx }: { field: ExtractField; ctx: FieldContext }) {
  const id = useId();
  const state = ctx.values[field.key];
  const low = isLow(state, ctx.threshold);
  const invalid = !!state?.value.trim() && parseValue(field.type as ValueType, state.value) === undefined;
  const describedBy = [low && state?.note ? `${id}-note` : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const stagger = state?.accepted && !ctx.reduced ? (ctx.order[field.key] ?? 0) * motionTokens.stagger.item : 0;

  return (
    <div
      className={styles.row}
      data-anchor=""
      data-active={isRelated(ctx.activePath, field.key) ? "" : undefined}
      data-tone={low ? "check" : undefined}
      style={toneStyle(ctx.tones[field.key])}
      onPointerEnter={mouseOnly(() => ctx.onHover(field.key))}
      onPointerLeave={mouseOnly(() => ctx.onHover(null))}
    >
      <label htmlFor={id} className={styles.rowLabel}>
        {field.label}
      </label>
      <input
        id={id}
        className={styles.input}
        data-link={field.key}
        data-numeric={isNumeric(field.type as ValueType) ? "" : undefined}
        data-landed={state?.confidence !== undefined ? "" : undefined}
        value={state?.value ?? ""}
        readOnly={ctx.busy}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        spellCheck={false}
        autoComplete="off"
        inputMode={inputModeFor(field.type as ValueType)}
        onChange={event => ctx.onEdit(field.key, event.target.value)}
        onFocus={() => ctx.onFocusPath(field.key)}
      />
      <Confidence
        state={state}
        threshold={ctx.threshold}
        reduced={ctx.reduced}
        idle={IDLE_LABELS[field.type as ValueType]}
        delay={stagger}
      />
      <AnimatePresence initial={false}>
        {low && state?.note && (
          <Reveal key="note" className={styles.rowExtra} reduced={ctx.reduced}>
            <div className={styles.note}>
              <p id={`${id}-note`} className={styles.noteText}>
                {state.note}
              </p>
              <button type="button" className={styles.noteButton} onClick={() => ctx.onCheck(field.key)}>
                <Check aria-hidden="true" />
                Looks right
              </button>
            </div>
          </Reveal>
        )}
        {invalid && (
          <Reveal key="error" className={styles.rowExtra} reduced={ctx.reduced}>
            <p id={`${id}-error`} className={styles.fieldError}>
              {FIELD_ERRORS[field.type as ValueType]}
            </p>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A repeating group of values, one row per record found in the document. */
function TableField({ field, ctx }: { field: ExtractField; ctx: FieldContext }) {
  const id = useId();
  const columns = field.columns ?? [];
  const prefix = `${field.key}.`;
  const paths = Object.keys(ctx.values).filter(path => path.startsWith(prefix));
  const rows = paths.reduce((max, path) => Math.max(max, Number(path.split(".")[1]) + 1), 0);
  const cells = paths.map(path => ctx.values[path]).filter((value): value is ExtractedValue => !!value);
  const low = paths.filter(path => isLow(ctx.values[path], ctx.threshold));
  const landed = cells.filter(cell => cell.confidence !== undefined);
  const lowest = (list: ExtractedValue[]) => Math.min(...list.map(cell => cell.confidence ?? 1));
  const allAccepted = cells.length > 0 && cells.every(cell => cell.accepted);

  const summary: ExtractedValue | undefined = landed.length
    ? allAccepted
      ? {
          value: "",
          accepted: true,
          confidence: lowest(landed),
          review: cells.some(cell => cell.review === "edited") ? "edited" : undefined,
        }
      : low.length
        ? { value: "", confidence: lowest(low.map(path => ctx.values[path])) }
        : cells.some(cell => cell.review === "edited")
          ? { value: "", review: "edited" }
          : { value: "", confidence: lowest(landed) }
    : undefined;

  const stagger = allAccepted && !ctx.reduced ? (ctx.order[field.key] ?? 0) * motionTokens.stagger.item : 0;

  return (
    <div
      className={styles.tableField}
      data-active={isRelated(ctx.activePath, field.key) ? "" : undefined}
      style={toneStyle(ctx.tones[field.key])}
    >
      <div
        className={styles.tableTitle}
        onPointerEnter={mouseOnly(() => ctx.onHover(field.key))}
        onPointerLeave={mouseOnly(() => ctx.onHover(null))}
      >
        <span className={styles.groupDot} aria-hidden="true" />
        <span id={`${id}-label`} className={styles.tableLabel}>
          {field.label}
        </span>
        <span className={styles.rowCount}>{rows ? `${rows} ${rows === 1 ? "row" : "rows"}` : "Table"}</span>
        <Confidence state={summary} threshold={ctx.threshold} reduced={ctx.reduced} delay={stagger} />
      </div>
      <div className={styles.grid} data-anchor="" role="table" aria-labelledby={`${id}-label`} data-columns={columns.length}>
        <div className={styles.gridHead} role="row">
          {columns.map(column => (
            <span
              key={column.key}
              role="columnheader"
              className={styles.th}
              data-numeric={isNumeric(column.type) ? "" : undefined}
            >
              {column.label}
            </span>
          ))}
        </div>
        {rows === 0 && (
          <p className={styles.gridEmpty}>{ctx.busy ? "Rows appear here as they are found" : "No rows yet"}</p>
        )}
        <AnimatePresence initial={false}>
          {Array.from({ length: rows }, (_, row) => (
            <motion.div
              key={row}
              role="row"
              className={styles.tr}
              initial={!ctx.reduced && { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={
                ctx.reduced
                  ? { duration: 0 }
                  : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }
              }
            >
              <div className={styles.trInner}>
                {columns.map(column => {
                  const path = `${field.key}.${row}.${column.key}`;
                  const cell = ctx.values[path];
                  const cellLow = isLow(cell, ctx.threshold);
                  const cellInvalid = !!cell?.value.trim() && parseValue(column.type, cell.value) === undefined;
                  const numeric = isNumeric(column.type);
                  return (
                    <span
                      key={column.key}
                      role="cell"
                      className={styles.td}
                      data-numeric={numeric ? "" : undefined}
                      onPointerEnter={mouseOnly(() => ctx.onHover(path))}
                      onPointerLeave={mouseOnly(() => ctx.onHover(null))}
                    >
                      <input
                        className={styles.cellInput}
                        data-link={path}
                        data-numeric={numeric ? "" : undefined}
                        data-landed={cell?.confidence !== undefined ? "" : undefined}
                        data-active={ctx.activePath === path ? "" : undefined}
                        data-tone={cellLow ? "check" : undefined}
                        value={cell?.value ?? ""}
                        readOnly={ctx.busy}
                        aria-label={`${column.label}, row ${row + 1}${cellLow ? ", needs a check" : ""}`}
                        aria-invalid={cellInvalid || undefined}
                        spellCheck={false}
                        autoComplete="off"
                        inputMode={inputModeFor(column.type)}
                        onChange={event => ctx.onEdit(path, event.target.value)}
                        onFocus={() => ctx.onFocusPath(path)}
                      />
                    </span>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {low.length > 0 && (
          <Reveal key="note" reduced={ctx.reduced}>
            <div className={styles.note}>
              <p className={styles.noteText}>
                {low.length === 1
                  ? "One cell is marked with low confidence."
                  : `${low.length} cells are marked with low confidence.`}
              </p>
              <button type="button" className={styles.noteButton} onClick={() => ctx.onCheck(field.key)}>
                <Check aria-hidden="true" />
                Looks right
              </button>
            </div>
          </Reveal>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The form: schema groups in order, each with its own colour. */
function FieldGroups({ schema, ctx }: { schema: ExtractSchema; ctx: FieldContext }) {
  const groups = schema.groups?.length ? schema.groups : [];
  const sections = groups.map(group => ({
    key: group.key,
    label: group.label as string | undefined,
    fields: schema.fields.filter(field => field.group === group.key),
  }));
  const rest = schema.fields.filter(field => !field.group || !groups.some(group => group.key === field.group));
  if (rest.length) sections.push({ key: "__rest", label: undefined, fields: rest });

  return (
    <div className={styles.form}>
      {sections
        .filter(section => section.fields.length)
        .map(section => {
          const first = section.fields[0];
          const solo = section.fields.length === 1 && first?.label === section.label;
          return (
            <section
              key={section.key}
              className={styles.group}
              aria-label={section.label}
              data-solo={solo ? "" : undefined}
              style={toneStyle(first ? ctx.tones[first.key] : 1)}
            >
              {section.label && !solo && (
                <p className={styles.groupHead} aria-hidden="true">
                  <span className={styles.groupDot} />
                  {section.label}
                </p>
              )}
              {section.fields.map(field =>
                field.type === "table" ? (
                  <TableField key={field.key} field={field} ctx={ctx} />
                ) : (
                  <FieldRow key={field.key} field={field} ctx={ctx} />
                ),
              )}
            </section>
          );
        })}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * JSON view
 * -----------------------------------------------------------------------------------------------*/

const JSON_TOKEN = String.raw`("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)`;

interface Linking {
  activePath: string | null;
  tones: Record<string, number>;
  edits: Record<string, number>;
  onHover: (path: string | null) => void;
  onSelect: (path: string | null) => void;
}

interface JsonLineModel {
  text: string;
  path?: string;
  leaf?: boolean;
}

/** Pretty-printed JSON that lights up the matching field when a line is hovered. */
function JsonView({ value, label, linking }: { value: unknown; label: string; linking?: Linking }) {
  const lines = useMemo(() => {
    const out: JsonLineModel[] = [];
    const walk = (node: unknown, depth: number, path: string | undefined, key: string | null, comma: boolean) => {
      const indent = "  ".repeat(depth);
      const prefix = key !== null ? `${JSON.stringify(key)}: ` : "";
      const tail = comma ? "," : "";
      if (Array.isArray(node) || (node && typeof node === "object")) {
        const entries: [string, unknown][] = Array.isArray(node)
          ? node.map((item, index) => [String(index), item])
          : Object.entries(node as Record<string, unknown>);
        const [open, close] = Array.isArray(node) ? ["[", "]"] : ["{", "}"];
        if (!entries.length) {
          out.push({ text: `${indent}${prefix}${open}${close}${tail}`, path });
          return;
        }
        out.push({ text: `${indent}${prefix}${open}`, path });
        entries.forEach(([entryKey, entryValue], index) =>
          walk(entryValue, depth + 1, path ? `${path}.${entryKey}` : entryKey, Array.isArray(node) ? null : entryKey, index < entries.length - 1),
        );
        out.push({ text: `${indent}${close}${tail}`, path });
      } else {
        out.push({ text: `${indent}${prefix}${JSON.stringify(node)}${tail}`, path, leaf: true });
      }
    };
    walk(value, 0, undefined, null, false);
    return out;
  }, [value]);

  const pathOf = (target: EventTarget | null) =>
    target instanceof Element ? (target.closest("[data-link]") as HTMLElement | null)?.dataset.link ?? null : null;

  return (
    <pre
      className={styles.code}
      aria-label={label}
      tabIndex={0}
      data-linked={linking ? "" : undefined}
      onPointerOver={linking ? mouseOnly(event => linking.onHover(pathOf(event.target))) : undefined}
      onPointerLeave={linking ? mouseOnly(() => linking.onHover(null)) : undefined}
      onClick={
        linking
          ? event => {
              const path = pathOf(event.target);
              if (path) linking.onSelect(path);
            }
          : undefined
      }
    >
      <code>
        {lines.map((line, index) => {
          const head = line.path?.split(".")[0];
          const linked = !!linking && !!line.path;
          const changed = linked && line.leaf && line.path ? linking.edits[line.path] : undefined;
          return (
            <span
              key={`${index}-${changed ?? 0}`}
              className={styles.jsonLine}
              data-link={linked ? line.path : undefined}
              data-active={
                linked && line.path && linking.activePath && (line.path === linking.activePath || line.path.startsWith(`${linking.activePath}.`))
                  ? ""
                  : undefined
              }
              data-changed={changed ? "" : undefined}
              style={linked && head ? toneStyle(linking.tones[head]) : undefined}
            >
              {tokenize(line.text)}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

/** Splits one JSON line into key, string, literal and number spans. */
function tokenize(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = new RegExp(JSON_TOKEN, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) out.push(text.slice(cursor, match.index));
    const kind = match[1] ? (match[2] ? "key" : "string") : match[3] ? "literal" : "number";
    const className =
      kind === "key" ? styles.jsonKey : kind === "string" ? styles.jsonString : kind === "literal" ? styles.jsonLiteral : styles.jsonNumber;
    out.push(
      <span key={match.index} className={className}>
        {match[1] ?? match[0]}
      </span>,
    );
    if (match[2]) out.push(match[2]);
    cursor = pattern.lastIndex;
  }
  out.push(text.slice(cursor));
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * Document page
 * -----------------------------------------------------------------------------------------------*/

interface SpanLink {
  path: string;
  label: string;
  tone: "ok" | "check";
  color: number;
}

/** The small PDF mark used by the file chip and the menu. */
function PdfMark() {
  return (
    <svg className={styles.fileMark} viewBox="0 0 16 20" aria-hidden="true">
      <path d="M2.5 1h7.2L14 5.3v12.2c0 .8-.7 1.5-1.5 1.5h-10C1.7 19 1 18.3 1 17.5v-15C1 1.7 1.7 1 2.5 1Z" fill="var(--surface)" stroke="currentColor" strokeOpacity=".32" />
      <path d="M9.7 1v3.1c0 .7.5 1.2 1.2 1.2H14" fill="none" stroke="currentColor" strokeOpacity=".32" />
      <rect x="0" y="10" width="11" height="6" rx="1.5" fill="#d93a32" />
      <path
        d="M2 14.6v-3.2h1.2c.6 0 1 .4 1 1s-.4 1-1 1H2M5.2 14.6v-3.2h.9c.9 0 1.5.6 1.5 1.6s-.6 1.6-1.5 1.6h-.9ZM8.5 14.6v-3.2h1.6M8.5 13h1.3"
        fill="none"
        stroke="#fff"
        strokeWidth=".8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The two logo marks a sample document can carry. */
function LogoSymbol({ symbol }: { symbol?: DocLogo["symbol"] }) {
  if (symbol === "petals") {
    return (
      <svg className={styles.logoSymbol} viewBox="0 0 20 20" aria-hidden="true">
        {[0, 120, 240].map(angle => (
          <ellipse
            key={angle}
            cx="10"
            cy="6.4"
            rx="3.3"
            ry="5.4"
            fill="currentColor"
            fillOpacity=".78"
            transform={`rotate(${angle} 10 11)`}
          />
        ))}
      </svg>
    );
  }
  if (symbol === "peak") {
    return (
      <svg className={styles.logoSymbol} viewBox="0 0 20 20" aria-hidden="true">
        <path d="M1.5 16.5 7.6 6.2l3.1 5.1 2-3.2 5.8 8.4Z" fill="currentColor" />
      </svg>
    );
  }
  return null;
}

function Logo({ logo }: { logo: DocLogo }) {
  return (
    <span className={styles.logo} style={logo.color ? { color: logo.color } : undefined}>
      <LogoSymbol symbol={logo.symbol} />
      <span className={styles.logoName}>{logo.name}</span>
      {logo.detail && <span className={styles.logoDetail}>{logo.detail}</span>}
    </span>
  );
}

interface PageProps {
  document: SourceDocument;
  links: Map<string, SpanLink>;
  lit: Set<string>;
  scanKey: number;
  reduced: boolean;
  onSpanHover: (path: string | null) => void;
  onSpanPress: (path: string) => void;
  onBackgroundPress: () => void;
  pageRef: RefObject<HTMLElement | null>;
  style?: CSSProperties;
}

/** The document itself: one paper page, with every extractable span linkable. */
function DocPage({
  document,
  links,
  lit,
  scanKey,
  reduced,
  onSpanHover,
  onSpanPress,
  onBackgroundPress,
  pageRef,
  style,
}: PageProps) {
  const kind = kindOf(document);
  const accent = document.blocks.find(block => block.type === "masthead" && !!block.logo) as
    | { type: "masthead"; logo?: DocLogo }
    | undefined;

  const rich = (text: Rich): ReactNode => {
    if (typeof text === "string") return text;
    return text.map((part, index) => {
      if (typeof part === "string") return <Fragment key={index}>{part}</Fragment>;
      const link = links.get(part.span);
      return (
        <span
          key={index}
          className={styles.span}
          data-span={part.span}
          data-linked={link ? "" : undefined}
          data-tone={link?.tone}
          data-lit={lit.has(part.span) ? "" : undefined}
          style={link ? toneStyle(link.color) : undefined}
        >
          {part.text}
        </span>
      );
    });
  };

  const block = (node: DocBlock, index: number): ReactNode => {
    switch (node.type) {
      case "masthead":
        return (
          <div key={index} className={styles.masthead}>
            {node.logo ? <Logo logo={node.logo} /> : <span />}
            {node.title && <p className={styles.docTitle}>{node.title}</p>}
          </div>
        );
      case "email": {
        const initials = plainText(node.from.name)
          .split(/\s+/)
          .map(word => word[0])
          .join("")
          .slice(0, 2);
        return (
          <div key={index} className={styles.mailHead}>
            <p className={styles.mailSubject}>{rich(node.subject)}</p>
            <div className={styles.mailFrom}>
              <span
                className={styles.mailAvatar}
                style={accent?.logo?.color ? { background: accent.logo.color } : undefined}
                aria-hidden="true"
              >
                {initials}
              </span>
              <div className={styles.mailWho}>
                <p>
                  <span className={styles.mailName}>{rich(node.from.name)}</span>{" "}
                  <span className={styles.inkMuted}>
                    {"<"}
                    {node.from.address}
                    {">"}
                  </span>
                </p>
                <p className={styles.inkMuted}>To {node.to}</p>
              </div>
              <p className={[styles.mailDate, styles.inkMuted].join(" ")}>{node.date}</p>
            </div>
          </div>
        );
      }
      case "heading":
        return (
          <p key={index} className={styles.docHeading}>
            {rich(node.text)}
          </p>
        );
      case "paragraph":
        return (
          <p key={index} className={[styles.docText, node.tone === "muted" && styles.inkMuted].filter(Boolean).join(" ")}>
            {rich(node.text)}
          </p>
        );
      case "lines":
        return (
          <div key={index} className={styles.docLines}>
            {node.label && <p className={styles.docLabel}>{node.label}</p>}
            {node.lines.map((line, lineIndex) => (
              <p key={lineIndex}>{rich(line)}</p>
            ))}
          </div>
        );
      case "pairs":
        return (
          <dl key={index} className={styles.docPairs}>
            {node.rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{rich(value)}</dd>
              </div>
            ))}
          </dl>
        );
      case "meta":
        return (
          <dl key={index} className={styles.docMeta} style={{ "--count": node.items.length } as CSSProperties}>
            {node.items.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{rich(value)}</dd>
              </div>
            ))}
          </dl>
        );
      case "columns":
        return (
          <div key={index} className={styles.docColumns}>
            {node.columns.map((column, columnIndex) => (
              <div key={columnIndex}>{column.map(block)}</div>
            ))}
          </div>
        );
      case "table":
        return (
          <table key={index} className={styles.docTable}>
            <thead>
              <tr>
                {node.columns.map(column => (
                  <th key={column.label} scope="col" data-align={column.align}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} data-align={node.columns[cellIndex]?.align}>
                      {rich(cell)}
                      {cellIndex === 0 && node.details?.[rowIndex] && (
                        <span className={styles.docDetail}>{node.details[rowIndex]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "totals":
        return (
          <dl key={index} className={styles.docTotals}>
            {node.rows.map((row, rowIndex) => (
              <div key={rowIndex} data-strong={row.strong ? "" : undefined}>
                <dt>{rich(row.label)}</dt>
                <dd>{rich(row.value)}</dd>
              </div>
            ))}
          </dl>
        );
      case "rule":
        return <hr key={index} className={styles.docRule} />;
      case "footer":
        return (
          <div key={index} className={styles.docFooter}>
            <div>
              {node.lines.map((line, lineIndex) => (
                <p key={lineIndex}>{rich(line)}</p>
              ))}
            </div>
            {kind === "pdf" && <p>Page 1 of 1</p>}
          </div>
        );
    }
  };

  const hit = (target: EventTarget | null) =>
    target instanceof Element ? links.get((target.closest("[data-span][data-linked]") as HTMLElement | null)?.dataset.span ?? "") ?? null : null;

  return (
    <article
      ref={pageRef}
      className={styles.page}
      data-kind={kind}
      aria-label={document.name}
      style={style}
      onPointerOver={mouseOnly(event => onSpanHover(hit(event.target)?.path ?? null))}
      onPointerLeave={mouseOnly(() => onSpanHover(null))}
      onClick={event => {
        const link = hit(event.target);
        if (link) onSpanPress(link.path);
        else onBackgroundPress();
      }}
    >
      {kind === "email" ? (
        <>
          {document.blocks.filter(node => node.type === "email").map(block)}
          <div className={styles.mailBody}>{document.blocks.filter(node => node.type !== "email").map(block)}</div>
        </>
      ) : (
        document.blocks.map(block)
      )}
      {scanKey > 0 && !reduced && (
        <div key={scanKey} className={styles.scan} aria-hidden="true">
          <span className={styles.scanBeam} />
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Viewer
 * -----------------------------------------------------------------------------------------------*/

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const clampZoom = (zoom: number) => Math.min(2, Math.max(0.4, zoom));
const PAGE_WIDTH = 540;

interface FileOption {
  id: string;
  name: string;
  label: string;
  kind: DocumentKind;
  meta?: string;
}

/** The document chip: a plain label for one file, a menu when a sample set is offered. */
function FileChip({
  document,
  files,
  onFileChange,
}: {
  document: SourceDocument;
  files?: FileOption[];
  onFileChange?: (id: string) => void;
}) {
  const mark =
    kindOf(document) === "email" ? <Mail aria-hidden="true" className={styles.fileIcon} /> : <PdfMark />;

  if (files && files.length >= 2 && onFileChange) {
    return (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={[styles.fileTitle, styles.fileButton].join(" ")}
            aria-label={`${document.name}, switch document`}
          >
            {mark}
            <span className={styles.fileName}>{document.name}</span>
            <ChevronDown aria-hidden="true" className={styles.fileChevron} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={12}>
            <DropdownMenu.RadioGroup value={document.id} onValueChange={onFileChange}>
              {files.map(file => (
                <DropdownMenu.RadioItem key={file.id} value={file.id} className={styles.menuItem}>
                  {file.kind === "email" ? <Mail aria-hidden="true" className={styles.fileIcon} /> : <PdfMark />}
                  <span className={styles.menuText}>
                    <span className={styles.menuName}>{file.name}</span>
                    {file.meta && <span className={styles.menuMeta}>{file.meta}</span>}
                  </span>
                  <DropdownMenu.ItemIndicator className={styles.menuCheck}>
                    <Check aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  return (
    <span className={styles.fileTitle}>
      {mark}
      <span className={styles.fileName} title={document.name}>
        {document.name}
      </span>
    </span>
  );
}

interface ViewerProps extends PageProps {
  files?: FileOption[];
  onFileChange?: (id: string) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
}

/** The paper pane: toolbar, zoom tools and the scrollable page. */
function Viewer({ files, onFileChange, canvasRef, ...page }: ViewerProps) {
  const { document, reduced, pageRef } = page;
  const kind = kindOf(document);
  const sizerRef = useRef<HTMLDivElement>(null);
  const zoomValue = useMotionValue(1);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const fitting = useRef(true);

  const apply = useCallback((next: number) => {
    const sizer = sizerRef.current;
    const article = pageRef.current;
    if (!sizer || !article) return;
    sizer.style.width = `${PAGE_WIDTH * next}px`;
    sizer.style.height = `${article.offsetHeight * next}px`;
    article.style.transform = `scale(${next})`;
  }, []);

  const fitZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const computed = getComputedStyle(canvas);
    return clampZoom(
      Math.floor(((canvas.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight)) / PAGE_WIDTH) * 100) / 100,
    );
  }, [canvasRef]);

  const jump = useCallback(
    (next: number, options: { fit?: boolean } = {}) => {
      const canvas = canvasRef.current;
      const target = clampZoom(next);
      fitting.current = !!options.fit;
      setFit(!!options.fit);
      setZoom(target);
      if (!canvas) {
        zoomValue.jump(target);
        return;
      }
      const from = zoomValue.get();
      const inset = parseFloat(getComputedStyle(canvas).paddingTop);
      const centerY = (canvas.scrollTop + canvas.clientHeight / 2 - inset) / from;
      const centerX = (canvas.scrollLeft + canvas.clientWidth / 2 - inset) / from;
      const update = (value: number) => {
        apply(value);
        canvas.scrollTop = centerY * value + inset - canvas.clientHeight / 2;
        canvas.scrollLeft = centerX * value + inset - canvas.clientWidth / 2;
      };
      if (reduced) {
        zoomValue.jump(target);
        update(target);
        return;
      }
      animate(zoomValue, target, { ...motionTokens.spring.smooth, onUpdate: update });
    },
    [apply, canvasRef, reduced, zoomValue],
  );

  useEffect(() => zoomValue.on("change", apply), [zoomValue, apply]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const article = pageRef.current;
    if (!canvas || !article) return;
    const sync = () => {
      if (fitting.current) {
        const next = fitZoom();
        zoomValue.jump(next);
        setZoom(next);
      }
      apply(zoomValue.get());
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(canvas);
    observer.observe(article);
    return () => observer.disconnect();
  }, [apply, canvasRef, fitZoom, zoomValue, document.id]);

  const zoomIn = () => jump(ZOOM_STEPS.find(step => step > zoom + 0.005) ?? 2);
  const zoomOut = () => jump([...ZOOM_STEPS].reverse().find(step => step < zoom - 0.005) ?? 0.4);
  const percent = Math.round(zoom * 100);

  return (
    <section className={styles.viewer} aria-label="Document">
      <div className={styles.toolbar}>
        <FileChip document={document} files={files} onFileChange={onFileChange} />
        <div className={styles.tools}>
          {kind === "pdf" && (
            <span className={styles.pageCount} aria-label="Page 1 of 1">
              1 / 1
            </span>
          )}
          <span className={styles.toolGroup} role="group" aria-label="Zoom">
            <Tooltip content="Zoom out">
              <button
                type="button"
                className={styles.tool}
                aria-label="Zoom out"
                aria-keyshortcuts="Control+-"
                disabled={zoom <= 0.405}
                onClick={zoomOut}
              >
                <Minus aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip content="Actual size">
              <button
                type="button"
                className={[styles.tool, styles.zoomValue].join(" ")}
                aria-label={`Zoom ${percent}%, show at actual size`}
                onClick={() => jump(1)}
              >
                {percent}%
              </button>
            </Tooltip>
            <Tooltip content="Zoom in">
              <button
                type="button"
                className={styles.tool}
                aria-label="Zoom in"
                aria-keyshortcuts="Control+="
                disabled={zoom >= 1.995}
                onClick={zoomIn}
              >
                <Plus aria-hidden="true" />
              </button>
            </Tooltip>
          </span>
          <button
            type="button"
            className={[styles.tool, styles.fitButton].join(" ")}
            aria-pressed={fit}
            aria-keyshortcuts="Control+0"
            onClick={() => jump(fitZoom(), { fit: true })}
          >
            Fit
          </button>
        </div>
      </div>
      <div
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        role="region"
        aria-label={`${document.name}, zoom ${percent}%`}
        onKeyDown={event => {
          if (!(event.metaKey || event.ctrlKey)) return;
          if (event.key === "=" || event.key === "+") {
            event.preventDefault();
            zoomIn();
          } else if (event.key === "-") {
            event.preventDefault();
            zoomOut();
          } else if (event.key === "0") {
            event.preventDefault();
            jump(fitZoom(), { fit: true });
          }
        }}
      >
        <div ref={sizerRef} className={styles.sizer}>
          <DocPage {...page} style={{ width: PAGE_WIDTH }} />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Source links
 * -----------------------------------------------------------------------------------------------*/

interface ConnectorProps {
  source: string;
  path: string;
  color: number;
  reduced: boolean;
  bodyRef: RefObject<HTMLDivElement | null>;
  docRef: RefObject<HTMLDivElement | null>;
  formRef: RefObject<HTMLDivElement | null>;
}

/** The hairline drawn from a span in the document to the field it filled. */
function Connector({ source, path, color, reduced, bodyRef, docRef, formRef }: ConnectorProps) {
  const gradientId = `de-sheen-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const sheenRef = useRef<SVGPathElement>(null);
  const startRef = useRef<SVGCircleElement>(null);
  const endRef = useRef<SVGCircleElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const stops = useRef<(SVGStopElement | null)[]>([]);

  useLayoutEffect(() => {
    let frame = 0;
    let signature = "";
    const born = performance.now();
    const tick = (now: number) => {
      const body = bodyRef.current;
      const doc = docRef.current;
      const form = formRef.current;
      const span = doc?.querySelector(`[data-span="${escapePath(source)}"]`);
      const field = findControl(form, path);
      if (body && doc && form && span && field) {
        const bodyBox = body.getBoundingClientRect();
        const docBox = doc.getBoundingClientRect();
        const formBox = form.getBoundingClientRect();
        const rects = span.getClientRects();
        const box = rects[rects.length - 1] ?? span.getBoundingClientRect();
        const fieldBox = field.getBoundingClientRect();
        const rowBox = (field.closest("[data-anchor]") ?? field).getBoundingClientRect();
        const topLimit = Math.max(
          formBox.top,
          form.querySelector("[data-sticky]")?.getBoundingClientRect().bottom ?? formBox.top,
        );
        const formBelow = formBox.top >= docBox.bottom - 1;
        const startX = box.right + 2;
        const startY = box.top + box.height / 2;
        const endX = rowBox.left - 7;
        const endY = fieldBox.top + fieldBox.height / 2;
        const visible =
          !formBelow &&
          startY > docBox.top + 2 &&
          startY < docBox.bottom - 2 &&
          startX < docBox.right + 2 &&
          startX > docBox.left &&
          endY > topLimit + 2 &&
          endY < formBox.bottom - 2;
        const x1 = startX - bodyBox.left;
        const y1 = startY - bodyBox.top;
        const x2 = endX - bodyBox.left;
        const y2 = endY - bodyBox.top;
        const bend = Math.max(28, (x2 - x1) * 0.5);
        const d = `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + bend).toFixed(1)} ${y1.toFixed(1)} ${(x2 - bend).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        const sx = x1;
        const sy = y1;
        const ex = x2;
        const ey = y2;
        const next = `${d}|${visible}`;
        if (next !== signature) {
          signature = next;
          pathRef.current?.setAttribute("d", d);
          sheenRef.current?.setAttribute("d", d);
          startRef.current?.setAttribute("cx", sx.toFixed(1));
          startRef.current?.setAttribute("cy", sy.toFixed(1));
          endRef.current?.setAttribute("cx", ex.toFixed(1));
          endRef.current?.setAttribute("cy", ey.toFixed(1));
          gradientRef.current?.setAttribute("x1", sx.toFixed(1));
          gradientRef.current?.setAttribute("y1", sy.toFixed(1));
          gradientRef.current?.setAttribute("x2", ex.toFixed(1));
          gradientRef.current?.setAttribute("y2", ey.toFixed(1));
          groupRef.current?.toggleAttribute("data-hidden", !visible);
        }
      } else if (signature !== "none") {
        signature = "none";
        groupRef.current?.toggleAttribute("data-hidden", true);
      }

      const progress = (now - born - 120) / 640;
      if (!reduced && progress <= 1.05) {
        const eased =
          -0.2 +
          (progress <= 0 ? 0 : progress >= 1 ? 1 : progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2) * 1.4;
        [eased - 0.2, eased, eased + 0.2].forEach((offset, index) =>
          stops.current[index]?.setAttribute("offset", String(Math.min(1, Math.max(0, offset)))),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [source, path, reduced, bodyRef, docRef, formRef]);

  return (
    <motion.g
      style={toneStyle(color)}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 * (reduced ? 0 : 1), ease: [...motionTokens.ease.standard] } }}
    >
      <defs>
        <linearGradient ref={gradientRef} id={gradientId} gradientUnits="userSpaceOnUse">
          {[0, 1, 2].map(index => (
            <stop
              key={index}
              ref={node => {
                stops.current[index] = node;
              }}
              offset="0"
              className={styles.sheenStop}
              data-peak={index === 1 ? "" : undefined}
            />
          ))}
        </linearGradient>
      </defs>
      <g ref={groupRef} className={styles.linkBody}>
        <path ref={pathRef} className={styles.linkPath} pathLength={1} data-draw={reduced ? undefined : ""} />
        {!reduced && <path ref={sheenRef} className={styles.linkSheen} stroke={`url(#${gradientId})`} />}
        <circle ref={startRef} r={3} className={styles.linkStart} />
        <circle ref={endRef} r={3} className={styles.linkEnd} data-draw={reduced ? undefined : ""} />
      </g>
    </motion.g>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Footer
 * -----------------------------------------------------------------------------------------------*/

/** One bar per field: its height is the lowest confidence in that field. */
function Bars({
  fields,
  values,
  threshold,
  order,
  onHover,
}: {
  fields: ExtractField[];
  values: Record<string, ExtractedValue>;
  threshold: number;
  order: Record<string, number>;
  onHover: (path: string | null) => void;
}) {
  return (
    <span className={styles.bars} aria-hidden="true">
      {fields.map(field => {
        const landed = valuesOf(field.key, values).filter(value => value.confidence !== undefined);
        const lowest = landed.length ? Math.min(...landed.map(value => value.confidence ?? 1)) : 0;
        const tone = landed.length
          ? landed.every(value => value.accepted)
            ? "accepted"
            : landed.some(value => isLow(value, threshold))
              ? "check"
              : "ok"
          : "pending";
        const height = landed.length ? 5 + 13 * Math.max(0, (lowest - 0.5) / 0.5) : 3;
        return (
          <span
            key={field.key}
            className={styles.bar}
            data-tone={tone}
            style={{ "--h": `${height.toFixed(1)}px`, "--i": order[field.key] ?? 0 } as CSSProperties}
            onPointerEnter={event => {
              if (event.pointerType === "mouse" && landed.length) onHover(field.key);
            }}
            onPointerLeave={event => {
              if (event.pointerType === "mouse") onHover(null);
            }}
          />
        );
      })}
    </span>
  );
}

/** The Claude starburst used as the model mark. */
function ClaudeMark({ title = "Claude", className }: { title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} className={className}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/

export interface DocumentExtractProps {
  /** A single document to read. Takes priority over `samples`. */
  document?: SourceDocument;
  /** The output format for `document`. Defaults to the invoice schema. */
  schema?: ExtractSchema;
  /** Several documents the viewer can switch between, each with its own schema. */
  samples?: ExtractSample[];
  /** Replaces the built-in scripted run. Yield `value` events, then let the iterable end. */
  extract?: ExtractRunner;
  /** Called when every field is accepted. Data is sent only through this callback. */
  onAccept?: (
    data: Record<string, unknown>,
    context: { document: SourceDocument; schema: ExtractSchema; values: Record<string, ExtractedValue> },
  ) => void | Promise<void>;
  /** The model reported in the footer and used for the cost estimate. */
  model?: ExtractModel;
  /** A custom model mark, rendered at 14px in the footer. */
  modelMark?: ReactNode;
  /** Values below this confidence ask for a check. */
  reviewThreshold?: number;
  /**
   * Drops the panel chrome: no border, radius, shadow or background, and no rule above the
   * footer. The preview frame renders the block this way so it sits flush in the page.
   */
  flat?: boolean;
  className?: string;
}

/**
 * Reads a document into a typed form: the page on the left, the fields it fills on the right,
 * with every value traceable back to the text it came from.
 */
export function DocumentExtract({
  document,
  schema,
  samples,
  extract,
  onAccept,
  model = MODEL,
  modelMark,
  reviewThreshold = 0.8,
  flat = false,
  className,
}: DocumentExtractProps) {
  const reduced = useReducedMotion() ?? false;
  const sampleList = useMemo<ExtractSample[]>(
    () => (document ? [{ document, schema: schema ?? SAMPLES[0].schema }] : samples?.length ? samples : SAMPLES),
    [document, schema, samples],
  );
  const [activeId, setActiveId] = useState(sampleList[0].document.id);
  const sample = sampleList.find(item => item.document.id === activeId) ?? sampleList[0];
  const current = sample.document;
  const fields = sample.schema.fields;

  const [state, dispatch] = useReducer(reducer, initialState);
  const [tab, setTab] = useState<string>("fields");
  const [hovered, setHovered] = useState<{ path: string | null; from: "doc" | "form" } | null>(null);
  const activePath = hovered?.path ?? null;
  const [focused, setFocused] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<AbortController | null>(null);

  /** The built-in run: scripted, timed, cancellable. */
  const scripted = useMemo<ExtractRunner>(() => {
    const seen = new Map<string, number>();
    return async function* run(target, _schema, { signal }) {
      const script = RUNS[target.id];
      if (!script) {
        throw new Error("The preview only has scripted runs for its two sample documents.");
      }
      const attempt = (seen.get(target.id) ?? 0) + 1;
      seen.set(target.id, attempt);
      yield { type: "usage", inputTokens: script.inputTokens, outputTokens: 0 };
      await delay(760, signal);
      let tokens = 4;
      for (const [index, value] of script.values.entries()) {
        if (script.failAfter !== undefined && attempt === 1 && index === script.failAfter) {
          await delay(900, signal);
          throw new Error("overloaded_error (529): the model is busy right now.");
        }
        const cell = value.type === "value" ? value.path.split(".").length > 1 : false;
        await delay(cell ? 46 + (index % 3) * 14 : 120 + (index % 4) * 26, signal);
        if (value.type !== "value") continue;
        tokens += tokensFor(value);
        yield value;
        yield { type: "usage", inputTokens: script.inputTokens, outputTokens: tokens };
      }
    };
  }, []);

  const runner = extract ?? scripted;
  const simulated = !extract;
  const busy = state.phase === "extracting";
  const currentPath = activePath ?? focused;

  /** Each field's colour comes from its group, so the page, the form and the bars agree. */
  const tones = useMemo(() => {
    const groups = sample.schema.groups ?? [];
    return Object.fromEntries(
      sample.schema.fields.map((field, index) => {
        const group = field.group ? groups.findIndex(item => item.key === field.group) : -1;
        return [field.key, ((group >= 0 ? group : index) % 4) + 1];
      }),
    );
  }, [sample.schema]);

  const order = useMemo(() => Object.fromEntries(fields.map((field, index) => [field.key, index])), [fields]);

  const lowPaths = useMemo(
    () => Object.entries(state.values).filter(([, value]) => isLow(value, reviewThreshold)).map(([path]) => path),
    [state.values, reviewThreshold],
  );
  const lowFields = useMemo(() => new Set(lowPaths.map(path => path.split(".")[0])).size, [lowPaths]);
  const filled = fields.filter(field => valuesOf(field.key, state.values).some(value => value.value.trim())).length;
  const landedValues = Object.values(state.values).filter(value => value.confidence !== undefined);
  const average = landedValues.length
    ? landedValues.reduce((sum, value) => sum + (value.confidence ?? 0), 0) / landedValues.length
    : 0;
  const cost = (state.inputTokens * model.inputPrice + state.outputTokens * model.outputPrice) / 1e6;
  const easedAverage = useEasedNumber(Math.round(100 * average), reduced);
  const easedCost = useEasedNumber(cost, reduced);
  const elapsed = state.started ? ((state.ended ?? Date.now()) - state.started) / 1000 : 0;

  /** The typed output, plus the paths that do not fit their types. */
  const output = useMemo(() => {
    const invalid: string[] = [];
    const read = (type: ValueType, path: string) => {
      const value = state.values[path];
      if (!value) return null;
      const parsed = parseValue(type, value.value);
      if (parsed === undefined) {
        invalid.push(path);
        return null;
      }
      return parsed;
    };
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "table") {
        const prefix = `${field.key}.`;
        const rows = Object.keys(state.values)
          .filter(path => path.startsWith(prefix))
          .reduce((max, path) => Math.max(max, Number(path.split(".")[1]) + 1), 0);
        data[field.key] = Array.from({ length: rows }, (_, row) =>
          Object.fromEntries((field.columns ?? []).map(column => [column.key, read(column.type, `${field.key}.${row}.${column.key}`)])),
        );
      } else {
        data[field.key] = read(field.type, field.key);
      }
    }
    return { data, invalid };
  }, [fields, state.values]);

  const jsonSchema = useMemo(() => toJsonSchema(sample.schema), [sample.schema]);

  /** Span id → the field it fills, so the page can light up. */
  const links = useMemo(() => {
    const map = new Map<string, SpanLink>();
    for (const [path, value] of Object.entries(state.values)) {
      if (!value.source || map.has(value.source)) continue;
      const head = path.split(".")[0];
      map.set(value.source, {
        path,
        label: fields.find(field => field.key === head)?.label ?? path,
        tone: isLow(value, reviewThreshold) ? "check" : "ok",
        color: tones[head] ?? 1,
      });
    }
    return map;
  }, [state.values, fields, reviewThreshold, tones]);

  /** Spans lit by the field under the pointer or the keyboard. */
  const lit = useMemo(() => {
    const set = new Set<string>();
    if (!currentPath) return set;
    for (const [path, value] of Object.entries(state.values)) {
      if (value.source && (path === currentPath || path.startsWith(`${currentPath}.`))) set.add(value.source);
    }
    return set;
  }, [currentPath, state.values]);

  const revealSource = useCallback(
    (source: string) => {
      const span = canvasRef.current?.querySelector(`[data-span="${escapePath(source)}"]`);
      if (!span) return;
      (span as HTMLElement).dataset.fresh = "";
      window.setTimeout(() => {
        delete (span as HTMLElement).dataset.fresh;
      }, 520);
      scrollInto(canvasRef.current, span, reduced ? "auto" : "smooth", 56);
    },
    [reduced],
  );

  const start = useCallback(async () => {
    runRef.current?.abort();
    const controller = new AbortController();
    runRef.current = controller;
    dispatch({ type: "start", now: Date.now() });
    setAnnouncement("");
    setFocused(null);
    setHovered(null);
    formRef.current?.scrollTo({ top: 0 });
    canvasRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    try {
      const produced = runner(current, sample.schema, { signal: controller.signal });
      const stream: AsyncIterable<ExtractEvent> =
        produced && typeof (produced as AsyncIterable<ExtractEvent>)[Symbol.asyncIterator] === "function"
          ? (produced as AsyncIterable<ExtractEvent>)
          : (async function* () {
              for (const event of await (produced as Promise<ExtractEvent[]>)) yield event;
            })();
      for await (const event of stream) {
        if (controller.signal.aborted) return;
        if (event.type === "value") {
          dispatch(event);
          const path = event.path;
          const source = event.source;
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => {
              if (source) revealSource(source);
              scrollInto(formRef.current, findControl(formRef.current, path), reduced ? "auto" : "smooth", 24);
            }),
          );
        } else {
          dispatch({ type: "usage", inputTokens: event.inputTokens, outputTokens: event.outputTokens });
        }
      }
      if (!controller.signal.aborted) dispatch({ type: "finish", now: Date.now() });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "fail",
        message: error instanceof Error ? error.message : String(error),
        now: Date.now(),
      });
    } finally {
      if (runRef.current === controller) runRef.current = null;
    }
  }, [current, sample.schema, runner, revealSource, reduced]);

  const stop = useCallback(() => {
    runRef.current?.abort();
    runRef.current = null;
    dispatch({ type: "stop", now: Date.now() });
  }, []);

  useEffect(() => () => runRef.current?.abort(), []);

  const announcementText =
    state.phase === "extracting"
      ? `Extracting ${fields.length} fields with ${model.name}${simulated ? ", simulated in this preview" : ""}.`
      : state.phase === "done"
        ? lowPaths.length
          ? `Extracted ${filled} of ${fields.length} fields. ${lowFields === 1 ? "One field needs" : `${lowFields} fields need`} a check.`
          : `Extracted all ${fields.length} fields.`
        : state.phase === "failed"
          ? `Extraction failed after ${filled} of ${fields.length} fields. ${state.error ?? ""}`
          : state.phase === "stopped"
            ? `Stopped after ${filled} of ${fields.length} fields.`
            : "";

  const changeTab = (next: string) => {
    setTab(next);
    formRef.current?.scrollTo({ top: 0 });
  };

  /** Brings a field into view, scrolling the pane and the page as needed. */
  const revealPath = useCallback(
    (path: string) => {
      const control = findControl(formRef.current, path);
      if (!control) return;
      scrollInto(formRef.current, control, reduced ? "auto" : "smooth", 24);
      if (control instanceof HTMLInputElement) control.focus({ preventScroll: true });
      const paneBox = formRef.current?.getBoundingClientRect();
      const canvasBox = canvasRef.current?.getBoundingClientRect();
      if (paneBox && canvasBox && paneBox.top >= canvasBox.bottom - 1) {
        window.requestAnimationFrame(() => {
          const box = control.getBoundingClientRect();
          if (box.top < 0 || box.bottom > window.innerHeight) {
            control.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
          }
        });
      }
    },
    [reduced],
  );

  const focusedSource = focused ? state.values[focused]?.source : undefined;
  useEffect(() => {
    if (!focusedSource) return;
    scrollInto(
      canvasRef.current,
      canvasRef.current?.querySelector(`[data-span="${escapePath(focusedSource)}"]`) ?? null,
      reduced ? "auto" : "smooth",
      56,
    );
  }, [focusedSource, reduced]);

  const latestValues = useRef(state.values);
  useLayoutEffect(() => {
    latestValues.current = state.values;
  }, [state.values]);

  useEffect(() => {
    if (!hovered || busy) return;
    const timer = window.setTimeout(() => {
      if (hovered.from === "form") {
        const source = latestValues.current[hovered.path ?? ""]?.source;
        if (source) {
          scrollInto(
            canvasRef.current,
            canvasRef.current?.querySelector(`[data-span="${escapePath(source)}"]`) ?? null,
            reduced ? "auto" : "smooth",
            56,
          );
        }
      } else {
        scrollInto(formRef.current, findControl(formRef.current, hovered.path ?? ""), reduced ? "auto" : "smooth", 24);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [hovered, busy, reduced]);

  const highlight = useCallback(
    (from: "doc" | "form", path: string | null) =>
      setHovered(previous => (path ? (previous?.path === path && previous.from === from ? previous : { path, from }) : null)),
    [],
  );
  const hoverForm = useCallback((path: string | null) => highlight("form", path), [highlight]);
  const hoverDoc = useCallback((path: string | null) => highlight("doc", path), [highlight]);

  const linkedPath = currentPath && state.values[currentPath]?.source ? currentPath : null;
  const linkedSource = linkedPath ? state.values[linkedPath]?.source : undefined;
  const drawLink = !!linkedPath && !!linkedSource && tab !== "schema";

  const ctx: FieldContext = {
    values: state.values,
    threshold: reviewThreshold,
    busy,
    reduced,
    activePath: currentPath,
    tones,
    order,
    onHover: hoverForm,
    onFocusPath: setFocused,
    onEdit: (path, value) => dispatch({ type: "edit", path, value }),
    onCheck: path => {
      dispatch({ type: "check", path, threshold: reviewThreshold });
      setAnnouncement(`${fields.find(field => field.key === path)?.label ?? "Value"} marked as checked.`);
      window.requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(`[data-link="${escapePath(path)}"], [data-link^="${escapePath(path)}."]`)
          ?.focus({ preventScroll: true }),
      );
    },
  };

  const canAccept = (state.phase === "done" || state.phase === "stopped") && landedValues.length > 0;

  const accept = async () => {
    if (!canAccept || state.accepted !== "no") return;
    if (output.invalid.length) {
      const first = output.invalid[0];
      if (tab !== "fields") changeTab("fields");
      window.requestAnimationFrame(() => revealPath(first));
      setAnnouncement(
        output.invalid.length === 1
          ? "One value does not fit its type. Fix it before accepting."
          : `${output.invalid.length} values do not fit their types. Fix them before accepting.`,
      );
      return;
    }
    dispatch({ type: "acceptAll" });
    try {
      if (onAccept) await onAccept(output.data, { document: current, schema: sample.schema, values: state.values });
      else await new Promise(resolve => window.setTimeout(resolve, 560));
      dispatch({ type: "accepted" });
      setAnnouncement(
        `All ${filled} fields accepted. ${onAccept ? "The data was sent." : "Sending the data is simulated in this preview."}`,
      );
    } catch (error) {
      dispatch({ type: "unaccept" });
      setAnnouncement(`Could not accept. ${error instanceof Error ? error.message : ""}`);
    }
  };

  let actionLabel: ReactNode;
  let actionVariant: "primary" | "secondary" = "primary";
  let onAction = () => {
    void start();
  };
  if (busy) {
    actionLabel = (
      <>
        <Square aria-hidden="true" className={styles.stopIcon} />
        Stop
      </>
    );
    actionVariant = "secondary";
    onAction = stop;
  } else if (state.phase === "failed") {
    actionLabel = (
      <>
        <RotateCcw aria-hidden="true" />
        Retry
      </>
    );
  } else if (state.phase === "idle") {
    actionLabel = (
      <>
        <ScanText aria-hidden="true" />
        Extract
      </>
    );
  } else {
    actionLabel = (
      <>
        <RotateCcw aria-hidden="true" />
        <span>
          Extract<span className={styles.againWord}> again</span>
        </span>
      </>
    );
    actionVariant = "secondary";
  }

  const progressText = `${filled} of ${fields.length}`;

  let status: ReactNode;
  if (busy) {
    status = (
      <p className={styles.statusLine}>
        <TextShimmer className={styles.statusShimmer}>
          {filled ? "Extracting fields" : "Reading the document"}
        </TextShimmer>
        <span className={styles.statusMeta}>{progressText}</span>
      </p>
    );
  } else if (state.phase === "idle") {
    status = (
      <p className={styles.statusLine}>
        <span className={styles.statusQuiet}>
          {fields.length} fields to fill from this {kindOf(current) === "email" ? "email" : "document"}
        </span>
      </p>
    );
  } else if (state.phase === "failed") {
    status = (
      <div className={styles.statusBlock} role="alert" data-tone="danger">
        <p className={styles.statusLine}>
          <CircleAlert aria-hidden="true" className={styles.statusIcon} />
          <span>Extraction failed after {progressText} fields</span>
        </p>
        <p className={styles.statusBody}>
          {model.name} returned {state.error ?? "an error."} Retry reads the whole document again
          {simulated ? "; in this preview only the first run fails" : ""}.
        </p>
      </div>
    );
  } else if (state.phase === "stopped") {
    status = (
      <div className={styles.statusBlock}>
        <p className={styles.statusLine}>
          <Square aria-hidden="true" className={styles.stopIcon} />
          <span>Stopped after {progressText} fields</span>
        </p>
        <p className={styles.statusBody}>
          The values found so far are kept. Extract again reads the whole document.
        </p>
      </div>
    );
  } else if (state.accepted === "yes") {
    status = (
      <p className={styles.statusLine}>
        <CircleCheck aria-hidden="true" className={styles.statusOk} />
        <span>
          All fields accepted
          {simulated ? ". Sending is simulated in this preview" : " and sent"}
        </span>
      </p>
    );
  } else if (lowPaths.length) {
    status = (
      <p className={styles.statusLine} data-tone="warning">
        <TriangleAlert aria-hidden="true" className={styles.statusIcon} />
        <span>{lowFields === 1 ? "One field needs a check" : `${lowFields} fields need a check`}</span>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            const first = lowPaths[0];
            if (!first) return;
            if (tab !== "fields") changeTab("fields");
            window.requestAnimationFrame(() => revealPath(first));
          }}
        >
          Review
        </button>
      </p>
    );
  } else {
    status = (
      <p className={styles.statusLine}>
        <CircleCheck aria-hidden="true" className={styles.statusOk} />
        <span>
          Found {progressText} fields in {elapsed.toFixed(1)} s
        </span>
      </p>
    );
  }

  const statusKey = busy
    ? "busy"
    : state.phase === "done"
      ? state.accepted === "yes"
        ? "accepted"
        : lowPaths.length
          ? "review"
          : "done"
      : state.phase;

  let summary: ReactNode;
  if (landedValues.length) {
    summary = (
      <>
        <span>
          <span className={styles.summaryStrong}>{Math.round(easedAverage)}%</span> average
        </span>
        {state.accepted !== "no" && lowPaths.length === 0 ? (
          <span className={styles.summaryOk}>
            <Check aria-hidden="true" />
            {state.accepted === "yes" ? "All accepted" : "Accepting"}
          </span>
        ) : lowPaths.length ? (
          <span className={styles.summaryWarn}>
            <TriangleAlert aria-hidden="true" />
            {lowFields} to check
          </span>
        ) : (
          !busy && (
            <span className={styles.summaryOk}>
              <CircleCheck aria-hidden="true" />
              Ready
            </span>
          )
        )}
      </>
    );
  } else {
    summary = <span className={styles.summaryQuiet}>{busy ? "Reading" : "No values yet"}</span>;
  }

  let acceptLabel: ReactNode = "Accept all";
  if (state.accepted === "yes") {
    acceptLabel = (
      <>
        <Check aria-hidden="true" />
        Accepted
      </>
    );
  }

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        if (busy) {
          event.preventDefault();
          stop();
        } else if (focused) {
          setFocused(null);
        }
      }}
    >
      <div ref={bodyRef} className={styles.body}>
        <Viewer
          document={current}
          canvasRef={canvasRef}
          links={links}
          lit={lit}
          scanKey={state.run}
          reduced={reduced}
          files={
            sampleList.length > 1
              ? sampleList.map(item => ({
                  id: item.document.id,
                  name: item.document.name,
                  label: item.document.label,
                  kind: kindOf(item.document),
                  meta: item.document.meta,
                }))
              : undefined
          }
          onFileChange={next => {
            if (next === activeId) return;
            runRef.current?.abort();
            runRef.current = null;
            dispatch({ type: "reset" });
            setActiveId(next);
            setHovered(null);
            setFocused(null);
            setAnnouncement("");
            canvasRef.current?.scrollTo({ top: 0 });
            formRef.current?.scrollTo({ top: 0 });
          }}
          onSpanHover={hoverDoc}
          onSpanPress={path => {
            setFocused(path);
            if (tab === "schema") {
              changeTab("fields");
              window.setTimeout(() => revealPath(path), 80);
              return;
            }
            revealPath(path);
          }}
          onBackgroundPress={() => setFocused(null)}
          pageRef={pageRef}
        />
        <Tabs value={tab} onValueChange={changeTab} className={styles.formPane}>
          <div className={styles.formHead}>
            <TabsList aria-label="Output">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              variant={actionVariant}
              className={[actionVariant === "primary" && styles.accentButton, styles.action].filter(Boolean).join(" ")}
              onClick={onAction}
              aria-keyshortcuts={busy ? "Escape" : undefined}
            >
              {actionLabel}
            </Button>
          </div>
          <div
            ref={formRef}
            className={styles.formScroll}
            onScroll={event => event.currentTarget.toggleAttribute("data-scrolled", event.currentTarget.scrollTop > 2)}
          >
            <TabsContent value="fields" className={styles.tabPanel}>
              <div className={styles.status} data-sticky="">
                <Collapse reduced={reduced}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={statusKey}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
                    >
                      {status}
                    </motion.div>
                  </AnimatePresence>
                </Collapse>
              </div>
              <FieldGroups schema={sample.schema} ctx={ctx} />
            </TabsContent>
            <TabsContent value="json" className={styles.tabPanel}>
              <div className={styles.codeBar}>
                <span className={styles.codeNote}>
                  {output.invalid.length ? (
                    <>
                      <TriangleAlert aria-hidden="true" className={styles.codeWarn} />
                      {output.invalid.length === 1
                        ? "One value does not fit its type and is null"
                        : `${output.invalid.length} values do not fit their types and are null`}
                    </>
                  ) : state.phase === "idle" ? (
                    "Typed output appears here as values arrive"
                  ) : (
                    <>
                      <CircleCheck aria-hidden="true" className={styles.statusOk} />
                      Matches the {sample.schema.title.toLowerCase()} schema, updates as you edit
                    </>
                  )}
                </span>
                <CopyButton value={JSON.stringify(output.data, null, 2)} label="Copy" />
              </div>
              <JsonView
                value={output.data}
                label="Typed output as JSON"
                linking={{
                  activePath: currentPath,
                  tones,
                  edits: state.edits,
                  onHover: hoverForm,
                  onSelect: setFocused,
                }}
              />
            </TabsContent>
            <TabsContent value="schema" className={styles.tabPanel}>
              <div className={styles.codeBar}>
                <span className={styles.codeNote}>Sent to {model.id} as the output format</span>
                <CopyButton value={JSON.stringify(jsonSchema, null, 2)} label="Copy" />
              </div>
              <JsonView value={jsonSchema} label="JSON schema" />
            </TabsContent>
          </div>
        </Tabs>
        <svg className={styles.links} aria-hidden="true">
          <AnimatePresence>
            {drawLink && linkedPath && linkedSource && (
              <Connector
                key={linkedPath}
                source={linkedSource}
                path={linkedPath}
                color={tones[linkedPath.split(".")[0]] ?? 1}
                reduced={reduced}
                bodyRef={bodyRef}
                docRef={canvasRef}
                formRef={formRef}
              />
            )}
          </AnimatePresence>
        </svg>
      </div>
      <footer className={styles.footer} data-frame-flat={flat ? "" : undefined}>
        <div className={styles.summary}>
          <Bars
            fields={fields}
            values={state.values}
            threshold={reviewThreshold}
            order={order}
            onHover={hoverForm}
          />
          <p className={styles.summaryText}>{summary}</p>
        </div>
        <p className={styles.meta}>
          <span className={styles.modelMark} aria-hidden="true">
            {modelMark ?? <ClaudeMark title="" />}
          </span>
          <span className={styles.modelName}>{model.name}</span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span className={styles.tabular}>
            {easedCost <= 0 ? "$0.00" : easedCost < 0.01 ? `$${easedCost.toFixed(4)}` : `$${easedCost.toFixed(3)}`}
          </span>
          <span className={styles.metaDot} aria-hidden="true" />
          <span className={styles.tabular}>{elapsed.toFixed(1)} s</span>
        </p>
        <Button
          size="sm"
          variant={state.accepted === "yes" ? "secondary" : "primary"}
          className={[state.accepted !== "yes" && styles.accentButton, styles.accept].filter(Boolean).join(" ")}
          disabled={!canAccept || state.accepted === "yes"}
          loading={state.accepted === "pending"}
          onClick={() => {
            void accept();
          }}
        >
          {acceptLabel}
        </Button>
      </footer>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcementText}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default DocumentExtract;
