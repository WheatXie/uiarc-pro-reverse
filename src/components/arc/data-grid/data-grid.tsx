"use client";

/**
 * Data grid — a spreadsheet surface: range selection, inline editing with select and date editors,
 * a drag fill handle, multi-key sorting, per-column filters, grouping, pinned/hidden/resized columns,
 * row checkboxes, totals, clipboard, undo/redo and CSV/Excel export. The body is virtualised, the
 * header is windowed horizontally, and every interaction is keyboard reachable.
 */
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Copy,
  Download,
  EyeOff,
  FileSpreadsheet,
  FilterX,
  Group,
  ListFilter,
  Minus,
  Pin,
  PinOff,
  Redo2,
  Rows2,
  Rows3,
  Rows4,
  Search,
  Sheet,
  Trash2,
  Undo2,
  Ungroup,
  X,
} from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Calendar } from "../calendar/calendar";
import { motionTokens } from "../lib/motion-tokens";
import { writeClipboard } from "../lib/use-copy-feedback";
import styles from "./data-grid.module.css";

/** Clamp a number into an inclusive range. */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A cell address: row index and column index. */
interface HitCell extends CellPos {
  gutter: boolean;
}

interface CellPos {
  r: number;
  c: number;
}

/** A cell holds text, a number (integer, currency or percent) or an ISO date string. */
export type DataGridValue = string | number | null;

/** One record of the grid. Keys map to column keys; `id` is the stable row identity. */
export type DataGridRow = { id: string | number } & Record<string, DataGridValue>;

/** How a column is parsed, formatted, filtered and sorted. */
export type DataGridColumnType =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "select";

/** What the totals row shows under a column. */
export type DataGridAggregate = "sum" | "average" | "min" | "max" | "count" | "none";

export interface DataGridColumn {
  /** Row property this column reads and writes. */
  key: string;
  /** Header text, also used in aria labels. */
  label: string;
  /** Value type. Drives formatting, the editor, filtering and sorting. */
  type?: DataGridColumnType;
  /** Allowed values for `select` columns; the editor becomes a listbox. */
  options?: string[];
  /** Starting width in pixels. The grid remembers resizes. */
  width?: number;
  /** Lower bound for the resizer. Defaults to 72. */
  minWidth?: number;
  /** Fraction digits for numbers. Defaults to 0. */
  decimals?: number;
  /** Pass `false` to make the column read only. */
  editable?: boolean;
  /** Start hidden; the Columns menu can bring it back. */
  hidden?: boolean;
  /** Pin to the left edge so it survives horizontal scrolling. */
  pinned?: boolean;
  /** Totals function. Defaults to sum for numbers, average for percent, none otherwise. */
  aggregate?: DataGridAggregate;
  /** Intl options for `date` columns. Defaults to short month, day, year. */
  dateFormat?: Intl.DateTimeFormatOptions;
  /** Pass `false` to keep the header from offering a sort. */
  sortable?: boolean;
  /** Pass `false` to drop the filter field for this column. */
  filterable?: boolean;
  /** Pass `false` to keep the column out of the grouping menu. */
  groupable?: boolean;
}

export type DataGridSortDirection = "asc" | "desc";

export interface DataGridSort {
  key: string;
  dir: DataGridSortDirection;
}

export type DataGridFilters = Record<string, string | string[]>;

export type DataGridDensity = "compact" | "standard" | "comfortable";

export type DataGridExportFormat = "csv" | "xlsx";

/** One button in the bulk selection bar. */
export interface DataGridBulkAction {
  /** Visible text. */
  label: string;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** `danger` tints the button. */
  tone?: "default" | "danger";
  /** Fires with the rows that are currently checked. */
  onAction: (rows: DataGridRow[]) => void;
}

/** Async rows. When present the grid is read only and pages in blocks. */
export interface DataGridDataSource {
  /** Rows per page. Defaults to 100. */
  blockSize?: number;
  /** Fetch one block. `start` is inclusive, `end` exclusive. */
  getRows: (params: {
    start: number;
    end: number;
    sort: DataGridSort[];
    filters: DataGridFilters;
    search: string;
    signal: AbortSignal;
  }) => Promise<{
    rows: DataGridRow[];
    rowCount: number;
    totals?: Record<string, number | null>;
  }>;
}

export interface DataGridProps {
  /** Column definitions, left to right. */
  columns: DataGridColumn[];
  /** Controlled rows. */
  rows?: DataGridRow[];
  /** Uncontrolled starting rows. */
  defaultRows?: DataGridRow[];
  /** Fires with the full row array after any edit, paste, clear or fill. */
  onRowsChange?: (rows: DataGridRow[]) => void;
  /** Accessible name for the grid, the search field and the exports. */
  label: string;
  /** Scroll viewport height in pixels. Defaults to 400. */
  maxHeight?: number;
  /** Show the leading checkbox column. Defaults to true. */
  rowSelection?: boolean;
  /** Show row numbers in the gutter. Defaults to true. */
  rowNumbers?: boolean;
  /** Show Sum / Average / Count in the status bar. Defaults to true. */
  selectionStats?: boolean;
  /** Show the toolbar. Defaults to true. */
  toolbar?: boolean;
  /** Show the totals row. Defaults to true. */
  totals?: boolean;
  /** Extra buttons for the bulk selection bar. */
  bulkActions?: DataGridBulkAction[];
  /** Base file name for exports, without extension. */
  exportFileName?: string;
  /** Shown when there is nothing to render. */
  emptyMessage?: string;
  /** Formats offered by the export button. Defaults to CSV only. */
  exportFormats?: DataGridExportFormat[];
  /** Async data source. When set the grid is read only. */
  dataSource?: DataGridDataSource;
  /** Allow deleting checked rows. Defaults to true unless the grid is read only. */
  canDeleteRows?: boolean;
  /** Controlled sort keys. */
  sort?: DataGridSort[];
  /** Uncontrolled starting sort keys. */
  defaultSort?: DataGridSort[];
  /** Fires when the sort keys change. */
  onSortChange?: (sort: DataGridSort[]) => void;
  /** Controlled filters keyed by column key. */
  filters?: DataGridFilters;
  /** Uncontrolled starting filters. */
  defaultFilters?: DataGridFilters;
  /** Fires when a filter changes. */
  onFiltersChange?: (filters: DataGridFilters) => void;
  /** Controlled checked rows. */
  selectedRowIds?: (string | number)[];
  /** Uncontrolled starting checked rows. */
  defaultSelectedRowIds?: (string | number)[];
  /** Fires when the checked rows change. */
  onSelectedRowIdsChange?: (ids: (string | number)[]) => void;
  /** Controlled hidden column keys. */
  hiddenColumns?: string[];
  /** Uncontrolled starting hidden columns. Defaults to columns flagged `hidden`. */
  defaultHiddenColumns?: string[];
  /** Fires when a column is hidden or shown. */
  onHiddenColumnsChange?: (keys: string[]) => void;
  /** Controlled pinned column keys. */
  pinnedColumns?: string[];
  /** Uncontrolled starting pinned columns. Defaults to the first column. */
  defaultPinnedColumns?: string[];
  /** Fires when a column is pinned or unpinned. */
  onPinnedColumnsChange?: (keys: string[]) => void;
  /** Controlled row density. */
  density?: DataGridDensity;
  /** Uncontrolled starting density. Defaults to `standard`. */
  defaultDensity?: DataGridDensity;
  /** Fires when the density changes. */
  onDensityChange?: (density: DataGridDensity) => void;
  /** Controlled grouping keys. */
  groupBy?: string[];
  /** Uncontrolled starting grouping keys. */
  defaultGroupBy?: string[];
  /** Fires when the grouping changes. */
  onGroupByChange?: (keys: string[]) => void;
  /** Force the skeleton body. */
  loading?: boolean;
}

const isNumeric = (column: DataGridColumn) =>
  column.type === "number" || column.type === "currency" || column.type === "percent";

const isDate = (column: DataGridColumn) => column.type === "date";

/** Blank value a cell should hold after it is cleared. */
const blankFor = (column: DataGridColumn): DataGridValue =>
  isNumeric(column) || isDate(column) ? null : "";

/** Spreadsheet column letters for a zero-based index: 0 → A, 26 → AA. */
function columnLetter(index: number): string {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    out = String.fromCharCode(65 + ((value - 1) % 26)) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/** Build a validated `YYYY-MM-DD` string, or null when any part is out of range. */
function isoDate(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
    year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True for a string that is exactly a valid ISO calendar date. */
const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isoDate(+value.slice(0, 4), +value.slice(5, 7), +value.slice(8, 10)) === value;

/** Parse a loose date typed by a person: `2026-1-5`, `sep 23 2026`, `23 sep 2026`. */
function parseDateInput(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return isoDate(+match[1], +match[2], +match[3]);
  const monthOf = (word: string) => {
    const index = MONTHS.indexOf(word.slice(0, 3));
    return index >= 0 && (word.length === 3 || word.startsWith(MONTHS[index])) ? index + 1 : 0;
  };
  match = text.match(/^([a-z]+)\.? (\d{1,2}) (\d{4})$/);
  if (match) return isoDate(+match[3], monthOf(match[1]), +match[2]);
  match = text.match(/^(\d{1,2}) ([a-z]+)\.? (\d{4})$/);
  if (match) return isoDate(+match[3], monthOf(match[2]), +match[1]);
  return null;
}

/** Days since the epoch for an ISO date. */
const dayNumber = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), Number(iso.slice(5, 7)) - 1, +iso.slice(8, 10)) / 864e5;

const fromDayNumber = (days: number) => new Date(864e5 * days).toISOString().slice(0, 10);

/** Months since year zero, for month-stepped fill series. */
const monthIndex = (iso: string) => 12 * Number(iso.slice(0, 4)) + Number(iso.slice(5, 7)) - 1;

const fromMonthIndex = (index: number, day: number) => {
  const year = Math.floor(index / 12);
  const month = index - 12 * year + 1;
  return isoDate(year, month, Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()));
};

/** Format a date with the column's Intl options, cached per option set. */
function formatDate(iso: string, options: Intl.DateTimeFormatOptions = SHORT_DATE): string {
  if (!isIsoDate(iso)) return iso;
  const cacheKey = JSON.stringify(options);
  let formatter = DATE_FORMATTERS.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
    DATE_FORMATTERS.set(cacheKey, formatter);
  }
  return formatter.format(new Date(864e5 * dayNumber(iso)));
}

/** Display text for a cell value. */
function formatValue(value: DataGridValue | undefined, column: DataGridColumn): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && isDate(column)) return formatDate(value, column.dateFormat);
  if (typeof value !== "number") return value;
  const decimals = column.decimals ?? 0;
  const digits = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = value < 0 ? "−" : "";
  if (column.type === "currency") return `${sign}$${digits}`;
  if (column.type === "percent") return `${sign}${digits}%`;
  return `${sign}${digits}`;
}

/** Strip the formatting people paste in: currency signs, thousands separators, percents, parentheses for negatives. */
const stripFormatting = (text: string) =>
  text.trim().replace(/[$,%\s]/g, "").replace(/−/g, "-").replace(/^\((.*)\)$/, "-$1");

/** Turn typed text into a stored value for a column. */
function parseValue(
  text: string,
  column: DataGridColumn,
  options?: string[],
): { ok: true; value: DataGridValue } | { ok: false } {
  const trimmed = text.trim();
  if (isDate(column)) {
    if (trimmed === "") return { ok: true, value: null };
    const parsed = parseDateInput(trimmed);
    return parsed ? { ok: true, value: parsed } : { ok: false };
  }
  if (column.type === "select") {
    if (trimmed === "") return { ok: true, value: "" };
    const match = options?.find(option => option.toLowerCase() === trimmed.toLowerCase());
    if (match !== undefined) return { ok: true, value: match };
    return options?.length ? { ok: false } : { ok: true, value: trimmed };
  }
  if (!isNumeric(column)) return { ok: true, value: trimmed };
  const numeric = stripFormatting(trimmed);
  if (numeric === "") return { ok: true, value: null };
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false };
}

/** Continue a fill series: month/day dates and arithmetic progressions extend, anything else repeats. */
function fillSeries(series: DataGridValue[], count: number, down: boolean, type?: DataGridColumnType): DataGridValue[] {
  if (type === "date" && series.length > 1 && series.every(isIsoDate)) {
    const dates = series as string[];
    const monthStep = dates.every(date => fromDayNumber(dayNumber(date) + 1).slice(8) === "01");
    const sameDay = monthStep || dates.every(date => date.slice(8) === dates[0].slice(8));
    const step = sameDay ? monthIndex(dates[1]) - monthIndex(dates[0]) : dayNumber(dates[1]) - dayNumber(dates[0]);
    const position = (iso: string) => (sameDay ? monthIndex(iso) : dayNumber(iso));
    if (step && dates.every((date, index) => index === 0 || position(date) - position(dates[index - 1]) === step)) {
      const last = down ? dates[dates.length - 1] : dates[0];
      const day = monthStep ? 31 : +last.slice(8);
      return Array.from({ length: count }, (_, index) => {
        const next = position(last) + (down ? 1 : -1) * step * (index + 1);
        if (sameDay) return fromMonthIndex(next, day);
        return next >= dayNumber("0001-01-01") && next <= dayNumber("9999-12-31") ? fromDayNumber(next) : null;
      });
    }
  }
  const numbers = series.every(value => typeof value === "number") ? (series as number[]) : null;
  const step = numbers && numbers.length > 1 ? numbers[1] - numbers[0] : null;
  const consistent = !!numbers && step !== null && numbers.every((value, index) => index === 0 || Math.abs(value - numbers[index - 1] - step) < 1e-9);
  return Array.from({ length: count }, (_, index) => {
    if (consistent && numbers && step !== null) {
      const next = down ? numbers[numbers.length - 1] + step * (index + 1) : numbers[0] - step * (index + 1);
      return Math.round(1e6 * next) / 1e6;
    }
    return down ? series[index % series.length] : series[series.length - 1 - (index % series.length)];
  });
}

/** Case- and accent-insensitive text for search. */
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Predicate = (value: DataGridValue | undefined) => boolean;

/** Numeric filter syntax: `>10`, `<=4`, `10..20`, `!=3`, `=7`. */
function numberFilter(text: string): Predicate | "invalid" | null {
  const source = stripFormatting(text);
  if (!source) return null;
  const number = "(-?\\d*\\.?\\d+)";
  const range = source.match(new RegExp(`^${number}(?:\\.\\.|to|–|—)${number}$`));
  if (range) {
    const [low, high] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
    return value => typeof value === "number" && value >= low && value <= high;
  }
  const single = source.match(new RegExp(`^(>=|<=|!=|<>|>|<|=)?${number}$`));
  if (!single) return "invalid";
  const target = Number(single[2]);
  switch (single[1]) {
    case ">": return value => typeof value === "number" && value > target;
    case ">=": return value => typeof value === "number" && value >= target;
    case "<": return value => typeof value === "number" && value < target;
    case "<=": return value => typeof value === "number" && value <= target;
    case "!=":
    case "<>": return value => typeof value === "number" && value !== target;
    default: return value => typeof value === "number" && value === target;
  }
}

/** Date filter syntax: `2026`, `2026-09`, `>=2026-01-01`, `2026-01-01..2026-03-01`. */
function dateFilter(text: string): Predicate | "invalid" | null {
  const source = text.trim();
  if (!source) return null;
  const span = (part: string): [string, string] | null => {
    const trimmed = part.trim();
    if (/^\d{4}$/.test(trimmed)) return [`${trimmed}-01-01`, `${trimmed}-12-31`];
    const month = trimmed.match(/^(\d{4})[-/](\d{1,2})$/);
    if (month) {
      const first = isoDate(+month[1], +month[2], 1);
      const next = first ? fromMonthIndex(monthIndex(first) + 1, 1) : null;
      return first && next ? [first, fromDayNumber(dayNumber(next) - 1)] : null;
    }
    const exact = parseDateInput(trimmed);
    return exact ? [exact, exact] : null;
  };
  const parts = source.split(/\s*(?:\.\.|–|—)\s*|\s+to\s+/i);
  if (parts.length === 2) {
    const left = span(parts[0]);
    const right = span(parts[1]);
    if (!left || !right) return "invalid";
    const [low, high] = left[0] <= right[0] ? [left[0], right[1]] : [right[0], left[1]];
    return value => typeof value === "string" && value >= low && value <= high;
  }
  const match = source.match(/^(>=|<=|!=|<>|>|<|=)?\s*(.+)$/);
  const range = match ? span(match[2]) : null;
  if (!match || !range) return "invalid";
  const [low, high] = range;
  switch (match[1]) {
    case ">": return value => typeof value === "string" && value > high;
    case ">=": return value => typeof value === "string" && value >= low;
    case "<": return value => typeof value === "string" && value < low;
    case "<=": return value => typeof value === "string" && value <= high;
    case "!=":
    case "<>": return value => typeof value === "string" && (value < low || value > high);
    default: return value => typeof value === "string" && value >= low && value <= high;
  }
}

/** Is this column's filter meaningful (and valid)? */
function isFiltered(column: DataGridColumn, filter: string | string[] | undefined): boolean {
  if (filter === undefined) return false;
  if (Array.isArray(filter)) return true;
  if (isNumeric(column)) return typeof numberFilter(filter) === "function";
  if (isDate(column)) return typeof dateFilter(filter) === "function";
  return filter.trim() !== "";
}

const isEmpty = (value: DataGridValue | undefined) => value === null || value === undefined || value === "";
const collator = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });

/** Stable multi-key sort. Select columns order by their option index, empties always sink. */
function sortRows(rows: DataGridRow[], sort: DataGridSort[], columns: DataGridColumn[]): DataGridRow[] {
  const active = sort.filter(entry => columns.some(column => column.key === entry.key));
  if (!active.length) return rows;
  const orders = new Map<string, Map<string, number> | null>(
    columns.map(column => [
      column.key,
      column.type === "select" && column.options ? new Map(column.options.map((option, index) => [option, index])) : null,
    ]),
  );
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const { key, dir } of active) {
        const a = left.row[key];
        const b = right.row[key];
        if (isEmpty(a) || isEmpty(b)) {
          if (isEmpty(a) && isEmpty(b)) continue;
          return isEmpty(a) ? 1 : -1;
        }
        const order = orders.get(key);
        const delta = order && order.has(String(a)) && order.has(String(b))
          ? order.get(String(a))! - order.get(String(b))!
          : typeof a === "number" && typeof b === "number"
            ? a - b
            : collator.compare(String(a), String(b));
        if (delta) return dir === "asc" ? delta : -delta;
      }
      return left.index - right.index;
    })
    .map(item => item.row);
}

/** Aggregate a column should use when the caller did not pick one. */
function aggregateFor(column: DataGridColumn): DataGridAggregate {
  if (column.aggregate) return column.aggregate;
  if (column.type === "percent") return "average";
  return isNumeric(column) ? "sum" : "none";
}

/** Aggregate value over the given rows, or null when there is nothing to report. */
function aggregateValue(rows: DataGridRow[], column: DataGridColumn, kind: DataGridAggregate): number | null {
  if (kind === "none") return null;
  let sum = 0;
  let numeric = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let filled = 0;
  for (const row of rows) {
    const value = row[column.key];
    if (!isEmpty(value)) filled += 1;
    if (typeof value === "number") {
      sum += value;
      numeric += 1;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (kind === "count") return filled;
  if (!numeric) return null;
  if (kind === "sum") return sum;
  if (kind === "average") return sum / numeric;
  if (kind === "min") return min;
  return max;
}

/** Tab separated text for the clipboard. */
function toTsv(matrix: string[][]): string {
  return matrix.map(row => row.map(cell => (/[\t\n"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join("\t")).join("\n");
}

/** An HTML table for rich clipboard targets. */
function toHtml(table: string[][]): string {
  const body = table
    .map(row => `<tr>${row.map(cell => `<td>${cell.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br>")}</td>`).join("")}</tr>`)
    .join("");
  return `<meta charset="utf-8"><table><tbody>${body}</tbody></table>`;
}

/** Save a blob under a file name and clean the object URL up afterwards. */
function download(filename: string, data: BlobPart | Uint8Array, mime: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Write text and HTML to the clipboard, falling back to plain text. */
async function copyRich(plain: string, html: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    }
    await writeClipboard(plain);
    return true;
  } catch {
    return false;
  }
}

const escapeXml = (text: string) =>
  text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SUBTOTAL: Record<Exclude<DataGridAggregate, "none">, number> = { average: 1, count: 3, max: 4, min: 5, sum: 9 };

/** Excel number format code for a totals cell. */
function numberFormat(column: DataGridColumn, kind: DataGridAggregate): string {
  if (kind === "count") return "#,##0";
  if (isDate(column)) return "mmm d, yyyy";
  const decimals = column.type === "percent" && kind === "average" ? Math.max(1, column.decimals ?? 0) : column.decimals ?? 0;
  const tail = decimals > 0 ? `.${"0".repeat(decimals)}` : "";
  if (column.type === "currency") return `"$"#,##0${tail};-"$"#,##0${tail}`;
  if (column.type === "percent") return `0${tail}%`;
  return `#,##0${tail}`;
}

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

interface GridCheckboxProps {
  checked: boolean | "mixed";
  label: string;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Only the row's own checkbox joins the tab order; the rest are reachable through the grid. */
  tabbable?: boolean;
}

/** The square checkbox used by the header and the row gutter. */
function GridCheckbox({ checked, label, onToggle, tabbable = false }: GridCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === "mixed" ? "mixed" : checked}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      className={styles.checkbox}
      data-state={checked === "mixed" ? "mixed" : checked ? "on" : "off"}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation();
        onToggle(event);
      }}
    >
      <span className={styles.checkboxMark} aria-hidden="true">
        {checked === "mixed" ? <Minus size={12} strokeWidth={2.25} /> : <Check size={12} strokeWidth={2.25} />}
      </span>
    </button>
  );
}

interface HeadMenuProps {
  column: DataGridColumn;
  sorted?: DataGridSortDirection | null;
  pinned?: boolean;
  canHide: boolean;
  grouped?: boolean;
  onSort: (direction: DataGridSortDirection | null) => void;
  onFilter?: (() => void) | null;
  onGroup?: (() => void) | null;
  onPin: () => void;
  onHide: () => void;
}

/** Per-column options menu behind the chevron in the header cell. */
function HeadMenu({ column, sorted, pinned, canHide, grouped = false, onSort, onFilter, onGroup = null, onPin, onHide }: HeadMenuProps) {
  const sortable = column.sortable !== false;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.headMenuButton} aria-label={`${column.label} column options`} onPointerDown={event => event.stopPropagation()}>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4} collisionPadding={10} onCloseAutoFocus={event => event.preventDefault()}>
          {sortable && (
            <>
              <DropdownMenu.Item className={styles.menuItem} data-active={sorted === "asc" || undefined} onSelect={() => onSort("asc")}>
                <ArrowUp {...ICON} />
                Sort ascending
              </DropdownMenu.Item>
              <DropdownMenu.Item className={styles.menuItem} data-active={sorted === "desc" || undefined} onSelect={() => onSort("desc")}>
                <ArrowDown {...ICON} />
                Sort descending
              </DropdownMenu.Item>
              {sorted && (
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => onSort(null)}>
                  <X {...ICON} />
                  Clear sort
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className={styles.menuSeparator} />
            </>
          )}
          {onFilter && (
            <DropdownMenu.Item className={styles.menuItem} onSelect={onFilter}>
              <ListFilter {...ICON} />
              Filter
            </DropdownMenu.Item>
          )}
          {onGroup && (
            <DropdownMenu.Item className={styles.menuItem} onSelect={onGroup}>
              {grouped ? <Ungroup {...ICON} /> : <Group {...ICON} />}
              {grouped ? "Stop grouping" : `Group by ${column.label}`}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={styles.menuItem} onSelect={onPin}>
            {pinned ? <PinOff {...ICON} /> : <Pin {...ICON} />}
            {pinned ? "Unpin column" : "Pin column"}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.menuItem} disabled={!canHide} onSelect={onHide}>
            <EyeOff {...ICON} />
            Hide column
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface ColumnsMenuProps {
  columns: DataGridColumn[];
  hidden: Set<string>;
  pinned: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}

/** Column visibility menu. The last visible column cannot be hidden. */
function ColumnsMenu({ columns, hidden, pinned, onToggle, onShowAll }: ColumnsMenuProps) {
  const visible = columns.length - columns.filter(column => hidden.has(column.key)).length;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.toolButton} aria-label="Columns">
        <Columns3 {...ICON} />
        <span className={styles.toolLabel}>Columns</span>
        {hidden.size > 0 && <span className={styles.toolCount}>{visible}/{columns.length}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={10}>
          <div className={styles.menuScroll}>
            {columns.map(column => {
              const shown = !hidden.has(column.key);
              return (
                <DropdownMenu.CheckboxItem
                  key={column.key}
                  className={styles.menuItem}
                  checked={shown}
                  disabled={shown && visible === 1}
                  onSelect={event => event.preventDefault()}
                  onCheckedChange={() => onToggle(column.key)}
                >
                  <span className={styles.menuCheck} data-on={shown || undefined} aria-hidden="true">
                    <Check size={12} strokeWidth={2.25} />
                  </span>
                  <span className={styles.menuText}>{column.label}</span>
                  {pinned.has(column.key) && <Pin size={14} strokeWidth={1.75} className={styles.menuMeta} aria-label="Pinned" />}
                </DropdownMenu.CheckboxItem>
              );
            })}
          </div>
          <DropdownMenu.Separator className={styles.menuSeparator} />
          <DropdownMenu.Item
            className={styles.menuItem}
            disabled={hidden.size === 0}
            onSelect={event => {
              event.preventDefault();
              onShowAll();
            }}
          >
            Show all columns
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const EXPORT_FORMATS: Record<DataGridExportFormat, { label: string; icon: ReactNode }> = {
  csv: { label: "CSV", icon: <FileSpreadsheet {...ICON} /> },
  xlsx: { label: "Excel workbook", icon: <Sheet {...ICON} /> },
};

interface ExportButtonProps {
  formats: DataGridExportFormat[];
  disabled?: boolean;
  onExport: (format: DataGridExportFormat) => void;
}

/** One format exports straight away, several open a menu. */
function ExportButton({ formats, disabled = false, onExport }: ExportButtonProps) {
  const single = formats.length === 1 ? formats[0] : undefined;
  if (single) {
    return (
      <button
        type="button"
        className={styles.toolButton}
        aria-label={`Export ${single === "csv" ? "CSV" : "Excel workbook"}`}
        onClick={() => onExport(single)}
        disabled={disabled}
      >
        <Download {...ICON} />
        <span className={styles.toolLabel}>Export</span>
      </button>
    );
  }
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.toolButton} aria-label="Export" disabled={disabled}>
        <Download {...ICON} />
        <span className={styles.toolLabel}>Export</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={10}>
          {formats.map(format => (
            <DropdownMenu.Item key={format} className={styles.menuItem} onSelect={() => onExport(format)}>
              {EXPORT_FORMATS[format].icon}
              <span className={styles.menuText}>{EXPORT_FORMATS[format].label}</span>
              <span className={styles.menuMeta}>.{format}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const DENSITIES: { value: DataGridDensity; label: string; icon: ReactNode }[] = [
  { value: "compact", label: "Compact", icon: <Rows4 {...ICON} /> },
  { value: "standard", label: "Standard", icon: <Rows3 {...ICON} /> },
  { value: "comfortable", label: "Comfortable", icon: <Rows2 {...ICON} /> },
];

interface DensityMenuProps {
  density: DataGridDensity;
  onChange: (density: DataGridDensity) => void;
}

/** Row height menu; the trigger shows only the current icon. */
function DensityMenu({ density, onChange }: DensityMenuProps) {
  const current = DENSITIES.find(option => option.value === density) ?? DENSITIES[1];
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={styles.toolButton} aria-label={`Row density, ${current.label.toLowerCase()}`}>
        {current.icon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={10}>
          <DropdownMenu.RadioGroup value={density} onValueChange={value => onChange(value as DataGridDensity)}>
            {DENSITIES.map(option => (
              <DropdownMenu.RadioItem key={option.value} value={option.value} className={styles.menuItem}>
                {option.icon}
                <span className={styles.menuText}>{option.label}</span>
                <DropdownMenu.ItemIndicator className={styles.menuMeta}>
                  <Check size={14} strokeWidth={2} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface FilterSelectProps {
  column: DataGridColumn;
  options: string[];
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
}

/** Multi-select value filter for `select` columns. Picking every value clears the filter. */
function FilterSelect({ column, options, value, onChange }: FilterSelectProps) {
  const [query, setQuery] = useState("");
  const chosen = useMemo(() => new Set(value ?? options), [value, options]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter(option => (option || "Empty").toLowerCase().includes(needle)) : options;
  }, [options, query]);
  const summary = value === undefined ? "All" : value.length === 0 ? "None" : value.length === 1 ? value[0] || "Empty" : `${value.length} of ${options.length}`;
  return (
    <Popover.Root onOpenChange={open => { if (!open) setQuery(""); }}>
      <Popover.Trigger className={styles.filterSelect} data-filter-key={column.key} data-active={value !== undefined || undefined} aria-label={`Filter ${column.label}, ${summary}`}>
        <span className={styles.filterSelectText}>{summary}</span>
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.menu} align="start" sideOffset={4} collisionPadding={10} aria-label={`Filter ${column.label}`}>
          {options.length > 7 && (
            <label className={styles.menuSearch}>
              <Search size={14} strokeWidth={1.75} aria-hidden="true" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search values" aria-label="Search values" spellCheck={false} />
            </label>
          )}
          <div className={styles.menuScroll} role="group" aria-label={`${column.label} values`}>
            {matches.map(option => {
              const on = chosen.has(option);
              return (
                <button
                  key={option || "\0"}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={styles.menuItem}
                  onClick={() => {
                    const next = new Set(chosen);
                    if (next.has(option)) next.delete(option);
                    else next.add(option);
                    onChange(next.size === options.length ? undefined : options.filter(item => next.has(item)));
                  }}
                >
                  <span className={styles.menuCheck} data-on={on || undefined} aria-hidden="true">
                    <Check size={12} strokeWidth={2.25} />
                  </span>
                  <span className={styles.menuText} data-muted={!option || undefined}>{option || "Empty"}</span>
                </button>
              );
            })}
            {!matches.length && <p className={styles.menuEmpty}>No matching values</p>}
          </div>
          <div className={styles.menuFooter}>
            <button type="button" className={styles.menuLink} disabled={value === undefined} onClick={() => onChange(undefined)}>Select all</button>
            <button type="button" className={styles.menuLink} disabled={value !== undefined && value.length === 0} onClick={() => onChange([])}>Clear</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Horizontal window of columns currently mounted. */
interface GridWindow {
  start: number;
  end: number;
  pinCount: number;
  pinEdge: number;
  lefts: number[];
  widths: number[];
  total: number;
}

/** Everything a cell renderer needs about one column's position in the row. */
interface GridSlot {
  column: DataGridColumn;
  width: number;
  left: number;
  pinned?: boolean;
  edge?: boolean;
  numeric?: boolean;
}

interface CellRect {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

interface OverlayProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "style" | "onDrag" | "onDragStart" | "onDragEnd" | "onDragEnter" | "onDragExit" | "onDragLeave" | "onDragOver" | "onDrop" | "onAnimationStart"
  > {
  range: CellRect;
  geo: Pick<GridWindow, "lefts" | "widths" | "pinCount" | "pinEdge">;
  rowH: number;
  /** Maps a visual row index to its rendered line, so collapsed groups leave no gap. */
  lineOf?: number[];
  scrollX: MotionValue<number>;
  instant?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * A rectangle pinned to a cell range. Position, width and height spring between ranges and the
 * left edge is clipped away under the pinned column so a selection never paints over it.
 */
function RangeOverlay({ range, geo, rowH, lineOf, scrollX, instant, className, children, ...rest }: OverlayProps) {
  const reduceMotion = !!useReducedMotion();
  const line = (row: number) => (lineOf ? lineOf[row] ?? row : row);
  const target = {
    left: geo.lefts[range.c0] ?? 0,
    right: (geo.lefts[range.c1] ?? 0) + (geo.widths[range.c1] ?? 0),
    top: line(range.r0) * rowH,
    bottom: (line(range.r1) + 1) * rowH,
  };
  const left = useMotionValue(target.left);
  const right = useMotionValue(target.right);
  const top = useMotionValue(target.top);
  const bottom = useMotionValue(target.bottom);
  const pinnedStart = range.c0 < geo.pinCount;
  const pinnedEnd = range.c1 < geo.pinCount;
  const startFlag = useMotionValue(+!!pinnedStart);
  const endFlag = useMotionValue(+!!pinnedEnd);
  const pinEdge = useMotionValue(geo.pinEdge);
  const edge = geo.pinEdge;

  useEffect(() => {
    startFlag.jump(+!!pinnedStart);
    endFlag.jump(+!!pinnedEnd);
    pinEdge.jump(edge);
    const pairs: [typeof left, number][] = [
      [left, target.left],
      [right, target.right],
      [top, target.top],
      [bottom, target.bottom],
    ];
    if (instant || reduceMotion) {
      pairs.forEach(([value, next]) => value.jump(next));
      return;
    }
    const animations = pairs.map(([value, next]) => animate(value, next, motionTokens.spring.snappy));
    return () => animations.forEach(animation => animation.stop());
  }, [target.left, target.right, target.top, target.bottom, pinnedStart, pinnedEnd, edge, instant, reduceMotion, left, right, top, bottom, startFlag, endFlag, pinEdge]);

  const width = useTransform(() =>
    Math.max(0, (endFlag.get() || !startFlag.get()
      ? right.get()
      : Math.max(right.get() - scrollX.get(), pinEdge.get())) - left.get()),
  );
  const height = useTransform(() => bottom.get() - top.get());
  const clipPath = useTransform(() => {
    const offset = startFlag.get() ? 0 : scrollX.get() + pinEdge.get() - left.get();
    return `inset(-8px -8px -8px ${offset > 0 ? offset : -8}px)`;
  });

  return (
    <div className={styles.rectLayer} data-pinned={pinnedStart || undefined}>
      <motion.div className={className} style={{ x: left, y: top, width, height, clipPath }} aria-hidden="true" {...rest}>
        {children}
      </motion.div>
    </div>
  );
}

/** Pinned columns first, then the windowed ones, then any kept column rendered absolutely. */
function renderSlots(
  slots: GridSlot[],
  win: GridWindow,
  render: (slot: GridSlot, index: number, style: CSSProperties) => ReactNode,
  keep: number[] = [],
): ReactNode[] {
  const children: ReactNode[] = [];
  for (let index = 0; index < win.pinCount && index < slots.length; index += 1) {
    children.push(render(slots[index], index, { width: slots[index].width, left: slots[index].left }));
  }
  const gap = (slots[win.start]?.left ?? win.pinEdge) - win.pinEdge;
  if (win.start > win.pinCount && gap > 0) {
    children.push(<div key="\u0000spacer" className={styles.spacer} style={{ width: gap }} aria-hidden="true" />);
  }
  for (let index = win.start; index < win.end && index < slots.length; index += 1) {
    children.push(render(slots[index], index, { width: slots[index].width }));
  }
  for (const index of new Set(keep)) {
    const slot = slots[index];
    if (slot && index >= win.pinCount && (index < win.start || index >= win.end)) {
      children.push(render(slot, index, { width: slot.width, left: slot.left, position: "absolute", top: 0 }));
    }
  }
  return children;
}

interface GridRowProps {
  row: DataGridRow;
  r: number;
  y: number;
  slots: GridSlot[];
  win: GridWindow;
  uid: string;
  ariaRow: number;
  level?: number;
  gutter: boolean;
  checked: boolean;
  inRows: boolean;
  rangeC0: number;
  rangeC1: number;
  keepC: number[];
  editingC: number;
  editor: ReactNode;
  onToggle: (id: string | number, index: number, shift: boolean) => void;
}

/** One body row. Memoised because the virtualiser re-renders the window on every scroll frame. */
const GridRow = memo(function GridRow({
  row,
  r,
  y,
  slots,
  win,
  uid,
  ariaRow,
  level,
  gutter,
  checked,
  inRows,
  rangeC0,
  rangeC1,
  keepC,
  editingC,
  editor,
  onToggle,
}: GridRowProps) {
  const offset = gutter ? 2 : 1;
  const name = String((slots[0] && row[slots[0].column.key]) || row.id);
  return (
    <div
      role="row"
      aria-rowindex={ariaRow}
      aria-level={level}
      aria-selected={gutter ? checked : undefined}
      className={styles.row}
      data-checked={checked || undefined}
      data-editing={editingC >= 0 || undefined}
      style={{ transform: `translateY(${y}px)` }}
    >
      {gutter && (
        <div role="gridcell" aria-colindex={1} className={styles.gutter} data-in-range={inRows || undefined}>
          <span className={styles.rowNumber} aria-hidden="true">{(r + 1).toLocaleString("en-US")}</span>
          <GridCheckbox checked={checked} label={`Select ${name}`} onToggle={event => onToggle(row.id ?? r, r, event.shiftKey)} />
        </div>
      )}
      {renderSlots(
        slots,
        win,
        (slot, index, style) => {
          const editing = editingC === index;
          const text = formatValue(row[slot.column.key], slot.column);
          return (
            <div
              key={slot.column.key}
              id={`${uid}-${r}-${index}`}
              role="gridcell"
              aria-colindex={index + offset}
              aria-selected={inRows && index >= rangeC0 && index <= rangeC1}
              aria-readonly={slot.column.editable === false || undefined}
              className={styles.cell}
              data-num={slot.numeric || undefined}
              data-pinned={slot.pinned || undefined}
              data-pin-edge={slot.edge || undefined}
              data-editing={editing || undefined}
              style={style}
            >
              {editing ? editor : <span className={styles.value} title={text.length > 18 ? text : undefined}>{text}</span>}
            </div>
          );
        },
        [...keepC, editingC].filter(index => index >= 0),
      )}
    </div>
  );
});

/** Placeholder row shown while a data source is loading. */
function SkeletonRow({ y, slots, win, ariaRow, gutter }: { y: number; slots: GridSlot[]; win: GridWindow; ariaRow: number; gutter: boolean }) {
  return (
    <div role="row" aria-rowindex={ariaRow} aria-busy="true" className={styles.row} style={{ transform: `translateY(${y}px)` }}>
      {gutter && <div role="gridcell" aria-colindex={1} className={styles.gutter} />}
      {renderSlots(slots, win, (slot, index, style) => (
        <div
          key={slot.column.key}
          role="gridcell"
          aria-colindex={index + (gutter ? 2 : 1)}
          className={styles.cell}
          data-num={slot.numeric || undefined}
          data-pinned={slot.pinned || undefined}
          data-pin-edge={slot.edge || undefined}
          style={style}
        >
          <span className={styles.skeleton} style={{ width: `${40 + ((7 * ariaRow + slot.width) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}

interface GroupNode {
  id: string;
  level: number;
  column?: DataGridColumn;
  value?: DataGridValue;
  rows: DataGridRow[];
  children: GroupNode[];
}

interface GroupRowProps {
  node: GroupNode;
  rows: DataGridRow[];
  y: number;
  slots: GridSlot[];
  win: GridWindow;
  column?: DataGridColumn;
  ariaRow: number;
  gutter: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
}

/** Group header row: a disclosure toggle in the first cell and aggregates in the rest. */
const GroupRow = memo(function GroupRow({ node, rows, y, slots, win, column, ariaRow, gutter, collapsed, onToggle }: GroupRowProps) {
  const totals = useMemo(
    () => slots.map(slot => {
      const kind = aggregateFor(slot.column);
      return { kind, value: aggregateValue(rows, slot.column, kind) };
    }),
    [rows, slots],
  );
  const label = column ? formatValue(node.value, column) : String(node.value ?? "");
  const text = label || "Empty";
  return (
    <div
      role="row"
      aria-rowindex={ariaRow}
      aria-level={node.level + 1}
      aria-expanded={!collapsed}
      className={styles.row}
      data-group-row=""
      style={{ transform: `translateY(${y}px)` }}
    >
      {gutter && <div role="gridcell" aria-colindex={1} className={styles.gutter} />}
      {renderSlots(slots, win, (slot, index, style) => {
        const total = totals[index];
        const formatted = index > 0 && total && total.value !== null && total.kind !== "none"
          ? total.kind === "count"
            ? total.value.toLocaleString("en-US")
            : formatValue(Math.round(100 * total.value) / 100, {
                ...slot.column,
                decimals: slot.column.type === "percent" && total.kind === "average"
                  ? Math.max(1, slot.column.decimals ?? 0)
                  : slot.column.decimals,
              })
          : "";
        return (
          <div
            key={slot.column.key}
            role="gridcell"
            aria-colindex={index + (gutter ? 2 : 1)}
            className={styles.cell}
            data-group-cell=""
            data-num={slot.numeric || undefined}
            data-pinned={slot.pinned || undefined}
            data-pin-edge={slot.edge || undefined}
            style={style}
            aria-label={index > 0 && formatted ? `${text} ${slot.column.label} ${AGGREGATE_LABEL[total.kind].toLowerCase()} ${formatted}` : undefined}
          >
            {index === 0 ? (
              <button
                type="button"
                className={styles.groupToggle}
                style={{ paddingLeft: 4 + 16 * node.level }}
                aria-expanded={!collapsed}
                aria-label={`${column?.label ?? "Group"} ${text}, ${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "row" : "rows"}. ${collapsed ? "Expand" : "Collapse"}`}
                onClick={() => onToggle(node.id)}
              >
                <ChevronRight className={styles.groupChevron} size={14} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.groupLabel} data-empty={!label || undefined}>{text}</span>
                <span className={styles.groupCount}>{rows.length.toLocaleString("en-US")}</span>
              </button>
            ) : (
              formatted && <span className={styles.value} aria-hidden="true">{formatted}</span>
            )}
          </div>
        );
      })}
    </div>
  );
});

const AGGREGATE_LABEL: Record<DataGridAggregate, string> = {
  sum: "Sum",
  average: "Avg",
  min: "Min",
  max: "Max",
  count: "Count",
  none: "",
};

const isoToDate = (iso: string) => new Date(+iso.slice(0, 4), Number(iso.slice(5, 7)) - 1, +iso.slice(8, 10));

interface EditorState {
  draft: string;
  mode: "edit" | "enter";
  list: boolean;
  invalid: boolean;
}

interface CellEditorProps {
  column: DataGridColumn;
  options: string[];
  editing: EditorState;
  /** Accessible name: "<column> for <row label>". */
  label: string;
  /** Flip the date popover above the cell when there is no room below. */
  openUp: boolean;
  onDraft: (draft: string) => void;
  onCommit: (move?: { dr: number; dc: number }, value?: string) => void;
  onCancel: () => void;
}

/** Inline editor: a text/number input, a combobox for selects and a popover calendar for dates. */
function CellEditor({ column, options, editing, label, openUp, onDraft, onCommit, onCancel }: CellEditorProps) {
  const select = column.type === "select";
  const date = column.type === "date";
  const [open, setOpen] = useState<boolean>(!!((select || date) && editing.list));
  const indexOf = (value: string) => options.findIndex(option => option.toLowerCase() === value.trim().toLowerCase());
  const [active, setActive] = useState(() => Math.max(0, indexOf(editing.draft)));
  const matches = useMemo(() => {
    if (!select) return [];
    const needle = editing.draft.trim().toLowerCase();
    if (!needle || options.some(option => option.toLowerCase() === needle)) return options;
    return [
      ...options.filter(option => option.toLowerCase().startsWith(needle)),
      ...options.filter(option => !option.toLowerCase().startsWith(needle) && option.toLowerCase().includes(needle)),
    ];
  }, [select, editing.draft, options]);
  const exact = Math.max(0, matches.findIndex(option => option.toLowerCase() === editing.draft.trim().toLowerCase()));
  const current = clamp(active, 0, Math.max(0, matches.length - 1));
  const listId = `${label.replace(/\W+/g, "-")}-options`;
  const highlighted = () => (open && matches[current] !== undefined ? matches[current] : undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const parsed = date ? parseDateInput(editing.draft) : null;
  const [month, setMonth] = useState<Date>(() => (parsed ? isoToDate(parsed) : new Date()));
  const [lastParsed, setLastParsed] = useState(parsed);
  if (lastParsed !== parsed) {
    setLastParsed(parsed);
    if (parsed) setMonth(isoToDate(parsed));
  }
  const inside = (node: EventTarget | Element | null) => node instanceof Node && !!popoverRef.current?.contains(node);

  const field = (
    <input
      ref={inputRef}
      className={styles.editor}
      value={editing.draft}
      autoFocus
      aria-label={label}
      aria-invalid={editing.invalid || undefined}
      inputMode={isNumeric(column) ? "decimal" : undefined}
      spellCheck={false}
      autoComplete="off"
      placeholder={date ? "YYYY-MM-DD" : undefined}
      role={select || date ? "combobox" : undefined}
      aria-haspopup={date ? "dialog" : undefined}
      aria-expanded={select || date ? open : undefined}
      aria-controls={(select || date) && open ? listId : undefined}
      aria-activedescendant={select && open && matches.length ? `${listId}-${current}` : undefined}
      onFocus={event => {
        const end = event.currentTarget.value.length;
        event.currentTarget.setSelectionRange(end, end);
      }}
      onChange={event => {
        onDraft(event.target.value);
        if (select) {
          setOpen(true);
          setActive(Math.max(0, indexOf(event.target.value)));
        }
      }}
      onBlur={event => {
        if (!inside(event.relatedTarget)) onCommit();
      }}
      onKeyDown={event => {
        event.stopPropagation();
        const enterMode = editing.mode === "enter";
        if (select && event.altKey && event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
          setActive(exact);
          return;
        }
        if (date && (event.altKey || open) && event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            popoverRef.current?.querySelector<HTMLElement>('[data-present] [data-date][tabindex="0"]')?.focus({ preventScroll: true });
          });
          return;
        }
        if (select && open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          setActive(value => clamp(clamp(value, 0, matches.length - 1) + (event.key === "ArrowDown" ? 1 : -1), 0, Math.max(0, matches.length - 1)));
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit({ dr: event.shiftKey ? -1 : 1, dc: 0 }, highlighted());
        } else if (event.key === "Tab") {
          event.preventDefault();
          onCommit({ dr: 0, dc: event.shiftKey ? -1 : 1 }, highlighted());
        } else if (event.key === "Escape") {
          event.preventDefault();
          if ((select || date) && open) setOpen(false);
          else onCancel();
        } else if (enterMode && event.key.startsWith("Arrow")) {
          event.preventDefault();
          const move = {
            ArrowUp: { dr: -1, dc: 0 },
            ArrowDown: { dr: 1, dc: 0 },
            ArrowLeft: { dr: 0, dc: -1 },
            ArrowRight: { dr: 0, dc: 1 },
          }[event.key];
          if (move) onCommit(move);
        }
      }}
    />
  );

  if (date) {
    return (
      <Popover.Root open={open} onOpenChange={next => { if (!next) setOpen(false); }}>
        <Popover.Anchor asChild>{field}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            ref={popoverRef}
            id={listId}
            className={`${styles.menu} ${styles.datePopover}`}
            align="start"
            side={openUp ? "top" : "bottom"}
            sideOffset={6}
            collisionPadding={10}
            aria-label={`${column.label} calendar`}
            onOpenAutoFocus={event => event.preventDefault()}
            onCloseAutoFocus={event => event.preventDefault()}
            onInteractOutside={event => {
              if (event.target === inputRef.current) event.preventDefault();
            }}
            onEscapeKeyDown={event => {
              event.preventDefault();
              if (inside(document.activeElement)) inputRef.current?.focus();
              setOpen(false);
            }}
            onPointerDown={event => event.stopPropagation()}
            onMouseDown={event => {
              if (!inside(document.activeElement)) event.preventDefault();
            }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
            onBlur={() => requestAnimationFrame(() => {
              const focus = document.activeElement;
              if (!inside(focus) && focus !== inputRef.current) onCommit();
            })}
          >
            <Calendar
              value={parsed ? isoToDate(parsed) : undefined}
              month={month}
              onMonthChange={setMonth}
              showToday
              onChange={value => onCommit(
                { dr: 0, dc: 0 },
                `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`,
              )}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <>
      {field}
      {select && open && (
        <div id={listId} role="listbox" aria-label={`${column.label} options`} className={styles.options} data-up={openUp || undefined}>
          {matches.length ? matches.map((option, index) => (
            <div
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === current}
              className={styles.option}
              data-active={index === current || undefined}
              data-current={option === editing.draft || undefined}
              onPointerDown={event => event.preventDefault()}
              onPointerEnter={() => setActive(index)}
              onClick={() => onCommit({ dr: 0, dc: 0 }, option)}
            >
              {option}
            </div>
          )) : <div className={styles.optionEmpty}>No match</div>}
        </div>
      )}
    </>
  );
}

/** Controlled/uncontrolled state pair with a single setter for both modes. */
function useControllable<T>(
  controlled: T | undefined,
  initial: () => T,
  onChange?: (value: T) => void,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [inner, setInner] = useState<T>(initial);
  const value = controlled === undefined ? inner : controlled;
  const latest = useRef(value);
  latest.current = value;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(latest.current) : next;
      latest.current = resolved;
      setInner(resolved);
      onChange?.(resolved);
    },
    [onChange],
  );
  return [value, set];
}

/** Build one predicate out of every column filter plus the global search tokens. */
function rowPredicate(
  filters: DataGridFilters,
  search: string,
  columns: DataGridColumn[],
): ((row: DataGridRow) => boolean) | null {
  const tests: ((row: DataGridRow) => boolean)[] = [];
  for (const column of columns) {
    const filter = filters[column.key];
    if (filter === undefined) continue;
    if (Array.isArray(filter)) {
      const allowed = new Set(filter);
      tests.push(row => allowed.has(String(row[column.key] ?? "")));
    } else if (isNumeric(column)) {
      const parsed = numberFilter(filter);
      if (typeof parsed === "function")
        tests.push(row => {
          const value = row[column.key];
          return typeof value === "number" && parsed(value);
        });
    } else if (isDate(column)) {
      const parsed = dateFilter(filter);
      if (typeof parsed === "function")
        tests.push(row => {
          const value = row[column.key];
          return isIsoDate(value) && parsed(value);
        });
    } else if (filter.trim()) {
      const text = filter.trim();
      const negated = text.startsWith("!");
      const exact = text.startsWith("=");
      const needle = normalize(negated || exact ? text.slice(1) : text);
      if (needle)
        tests.push(row => {
          const haystack = normalize(String(row[column.key] ?? ""));
          const hit = exact ? haystack === needle : haystack.includes(needle);
          return negated ? !hit : hit;
        });
    }
  }
  const tokens = normalize(search).split(/\s+/).filter(Boolean);
  if (tokens.length)
    tests.push(row => {
      const haystack = columns
        .map(column => normalize(formatValue(row[column.key], column) + " " + String(row[column.key] ?? "")))
        .join(" ");
      return tokens.every(token => haystack.includes(token));
    });
  if (!tests.length) return null;
  return row => tests.every(test => test(row));
}

/** Bucket rows by each grouping key, honouring the sort of the grouped column. */
function buildGroups(
  rows: DataGridRow[],
  groupKeys: string[],
  sort: DataGridSort[],
  columns: DataGridColumn[],
): GroupNode[] {
  const build = (list: DataGridRow[], level: number, prefix: string): GroupNode[] => {
    const key = groupKeys[level];
    const column = columns.find(item => item.key === key);
    const buckets = new Map<string, DataGridRow[]>();
    for (const row of list) {
      const label = String(row[key] ?? "");
      const bucket = buckets.get(label);
      if (bucket) bucket.push(row);
      else buckets.set(label, [row]);
    }
    const direction = sort.find(item => item.key === key)?.dir ?? "asc";
    return sortRows([...buckets.values()].map(bucket => bucket[0]), [{ key, dir: direction }], columns).map(
      first => {
        const label = String(first[key] ?? "");
        const bucket = buckets.get(label) ?? [];
        const id = `${prefix}\u001f${label}`;
        return {
          id,
          level,
          column,
          value: first[key] ?? null,
          rows: bucket,
          children: level + 1 < groupKeys.length ? build(bucket, level + 1, id) : [],
        };
      },
    );
  };
  return build(rows, 0, "");
}

/** CSV text with a BOM, CRLF endings and quoted cells where needed. */
function buildCsv(columns: DataGridColumn[], rows: DataGridRow[]): string {
  const quote = (text: string) => (/[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const lines = [columns.map(column => quote(column.label)).join(",")];
  for (const row of rows)
    lines.push(columns.map(column => quote(row[column.key] == null ? "" : String(row[column.key]))).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

/** One node of an xlsx sheet: either a bucket of rows or a nested group. */
interface ExportNode {
  label: string;
  rows?: DataGridRow[];
  children?: ExportNode[];
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) crc = crcTable[(crc ^ data[index]) & 255] ^ (crc >>> 8);
  return (0xffffffff ^ crc) >>> 0;
}

/** Minimal store-only zip writer, enough for an xlsx package. */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const sum = crc32(file.data);
    const size = file.data.length;
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x4034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 2048, true);
    header.setUint16(8, 0, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, 33, true);
    header.setUint32(14, sum, true);
    header.setUint32(18, size, true);
    header.setUint32(22, size, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    local.push(new Uint8Array(header.buffer), name, file.data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x2014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 2048, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, 0, true);
    entry.setUint16(14, 33, true);
    entry.setUint32(16, sum, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x6054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/** Excel workbook with a frozen header, group outlines, number formats and SUBTOTAL totals. */
function buildXlsx(
  columns: DataGridColumn[],
  nodes: ExportNode[],
  options: { sheetName: string; freezeColumns: number; totals: boolean; widths: Record<string, number> },
): Uint8Array {
  const formats: string[] = [];
  const styles: { fmt: number; bold: boolean }[] = [
    { fmt: 0, bold: false },
    { fmt: 0, bold: true },
  ];
  const style = {
    get(format: string | null, bold: boolean) {
      let fmt = 0;
      if (format) {
        let index = formats.indexOf(format);
        if (index < 0) {
          formats.push(format);
          index = formats.length - 1;
        }
        fmt = 164 + index;
      }
      let index = styles.findIndex(item => item.fmt === fmt && item.bold === bold);
      if (index < 0) {
        styles.push({ fmt, bold });
        index = styles.length - 1;
      }
      return index;
    },
    xml() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${formats.length ? `<numFmts count="${formats.length}">${formats.map((code, index) => `<numFmt numFmtId="${164 + index}" formatCode="${escapeXml(code)}"/>`).join("")}</numFmts>` : ""}<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(item => `<xf numFmtId="${item.fmt}" fontId="${+!!item.bold}" fillId="0" borderId="0" xfId="0"${item.fmt ? ' applyNumberFormat="1"' : ""}${item.bold ? ' applyFont="1"' : ""}/>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    },
  };

  const kinds = columns.map(column => aggregateFor(column));
  const rows: string[] = [];
  let rowIndex = 0;
  let maxLevel = 0;

  const textCell = (ref: string, text: string, bold = false) =>
    `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;

  const body = (columnIndex: number, row: DataGridRow) => {
    const column = columns[columnIndex];
    const ref = `${columnLetter(columnIndex)}${rowIndex}`;
    const value = row[column.key];
    if (value == null || value === "") return "";
    if (typeof value === "number" && Number.isFinite(value))
      return `<c r="${ref}" s="${style.get(isNumeric(column) ? numberFormat(column, aggregateFor(column)) : null, false)}"><v>${column.type === "percent" ? value / 100 : value}</v></c>`;
    if (isDate(column) && isIsoDate(value))
      return `<c r="${ref}" s="${style.get(numberFormat(column, aggregateFor(column)), false)}"><v>${Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) / 864e5 + 25569}</v></c>`;
    return textCell(ref, String(value));
  };

  const subtotal = (columnIndex: number, from: number, to: number, of: DataGridRow[], bold: boolean) => {
    const column = columns[columnIndex];
    const kind = kinds[columnIndex];
    if (kind === "none" || to < from) return "";
    const value = aggregateValue(of, column, kind);
    const literal = value === null ? "" : `<v>${column.type === "percent" && kind !== "count" ? value / 100 : value}</v>`;
    const range = `${columnLetter(columnIndex)}${from}:${columnLetter(columnIndex)}${to}`;
    return `<c r="${columnLetter(columnIndex)}${rowIndex}" s="${style.get(numberFormat(column, kind), bold)}"><f>SUBTOTAL(${SUBTOTAL[kind as Exclude<DataGridAggregate, "none">]},${range})</f>${literal}</c>`;
  };

  const openRow = (cells: string, extra = "") => `<row r="${rowIndex}"${extra}>${cells}</row>`;

  rowIndex = 1;
  rows.push(openRow(columns.map((column, index) => textCell(`${columnLetter(index)}1`, column.label, true)).join("")));

  const leafRows = (node: ExportNode): DataGridRow[] =>
    node.children ? node.children.flatMap(leafRows) : node.rows ?? [];

  const walk = (node: ExportNode, level: number) => {
    if (!node.children) {
      for (const row of node.rows ?? []) {
        rowIndex++;
        rows.push(
          openRow(
            columns.map((_, index) => body(index, row)).join(""),
            level ? ` outlineLevel="${Math.min(7, level)}"` : "",
          ),
        );
      }
      return;
    }
    maxLevel = Math.max(maxLevel, level + 1);
    rowIndex++;
    const slot = rows.length;
    const start = rowIndex;
    rows.push("");
    for (const child of node.children) walk(child, level + 1);
    const end = rowIndex;
    const restored = rowIndex;
    rowIndex = start;
    const collected = leafRows(node);
    const cells = columns
      .map((_, index) =>
        index === 0 ? textCell(`A${start}`, node.label, true) : subtotal(index, start + 1, end, collected, true),
      )
      .join("");
    rows[slot] = openRow(cells, level ? ` outlineLevel="${Math.min(7, level)}"` : "");
    rowIndex = restored;
  };

  for (const node of nodes) walk(node, 0);

  const lastRow = rowIndex;
  if (options.totals && columns.some((_, index) => kinds[index] !== "none")) {
    rowIndex++;
    const every = nodes.flatMap(leafRows);
    rows.push(
      openRow(
        columns
          .map((_, index) =>
            index === 0 && kinds[0] === "none" ? textCell(`A${rowIndex}`, "Total", true) : subtotal(index, 2, lastRow, every, true),
          )
          .join(""),
      ),
    );
  }

  const widths = columns.map(column => options.widths[column.key] ?? column.width ?? 140);
  const cols = `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(4, Math.round((width / 7) * 100) / 100)}" customWidth="1"/>`).join("")}</cols>`;
  const frozen = Math.max(0, Math.min(columns.length - 1, options.freezeColumns));
  const topLeft = `${columnLetter(frozen)}2`;
  const pane = `<pane${frozen ? ` xSplit="${frozen}"` : ""} ySplit="1" topLeftCell="${topLeft}" activePane="${frozen ? "bottomRight" : "bottomLeft"}" state="frozen"/><selection pane="${frozen ? "bottomRight" : "bottomLeft"}" activeCell="${topLeft}" sqref="${topLeft}"/>`;
  const dimension = `A1:${columnLetter(Math.max(0, columns.length - 1))}${Math.max(1, rowIndex)}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"${maxLevel ? ` outlineLevelRow="${Math.min(7, maxLevel)}"` : ""}/>${cols}<sheetData>${rows.join("")}</sheetData></worksheet>`;

  const encoder = new TextEncoder();
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const sheetName = escapeXml(
    (options.sheetName || "Sheet1").replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || "Sheet1",
  );
  return zip([
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(
        `${declaration}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(
        `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
    { name: "xl/styles.xml", data: encoder.encode(style.xml()) },
  ]);
}

/** Parse a pasted HTML table into a plain matrix, keeping `colspan` holes empty. */
function parseHtmlTable(html: string): string[][] | null {
  if (typeof DOMParser === "undefined" || !/<table/i.test(html)) return null;
  const table = new DOMParser().parseFromString(html, "text/html").querySelector("table");
  if (!table) return null;
  const matrix: string[][] = [];
  table.querySelectorAll("tr").forEach(row => {
    const line: string[] = [];
    row.querySelectorAll("td, th").forEach(cell => {
      cell.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
      line.push((cell.textContent ?? "").replace(/\u00a0/g, " ").trim());
      const span = Number(cell.getAttribute("colspan") ?? 1);
      for (let index = 1; index < span; index++) line.push("");
    });
    matrix.push(line);
  });
  return matrix.length ? matrix : null;
}

/** Parse pasted tab separated text, honouring quoted cells with embedded newlines. */
function parseTsvText(text: string): string[][] | null {
  const matrix: string[][] = [];
  let line: string[] = [];
  let cell = "";
  let quoted = false;
  let index = 0;
  const source = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  while (index < source.length) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 2;
        continue;
      }
      if (char === '"') {
        quoted = false;
        index++;
        continue;
      }
      cell += char;
      index++;
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
      index++;
      continue;
    }
    if (char === "\t") {
      line.push(cell);
      cell = "";
      index++;
      continue;
    }
    if (char === "\n") {
      line.push(cell);
      matrix.push(line);
      line = [];
      cell = "";
      index++;
      continue;
    }
    cell += char;
    index++;
  }
  line.push(cell);
  matrix.push(line);
  return matrix;
}

/** Transient status-bar message; `n` restarts the enter animation. */
interface GridStatus {
  text: string;
  n: number;
  action?: { label: string; run: () => void };
}

/** Editing state plus the cell it belongs to. */
interface EditCell extends EditorState {
  r: number;
  c: number;
}

/** An in-flight pointer drag: fill handle, row band or plain range selection. */
interface DragState {
  mode: "fill" | "rows" | "select";
  range: CellRect;
  pointer: { x: number; y: number };
  frame: number;
}

/** Rows fetched from a data source, keyed by block index. */
interface BlockCache {
  key: string;
  count: number | null;
  blocks: Map<number, DataGridRow[]>;
  totals?: Record<string, number | null>;
  failed: boolean;
}

const DENSITY_ROW_HEIGHT: Record<DataGridDensity, number> = {
  compact: 32,
  standard: 40,
  comfortable: 48,
};

/** Normalise two corners into an ordered rectangle. */
function rangeOf(a: CellPos, b: CellPos): CellRect {
  return {
    r0: Math.min(a.r, b.r),
    r1: Math.max(a.r, b.r),
    c0: Math.min(a.c, b.c),
    c1: Math.max(a.c, b.c),
  };
}

/** "1,234 cells" / "1 row". */
const plural = (count: number, word: string) =>
  `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

export function DataGrid({
  columns,
  rows,
  defaultRows,
  onRowsChange,
  label,
  maxHeight = 400,
  rowSelection = true,
  rowNumbers = true,
  selectionStats = true,
  toolbar = true,
  totals = true,
  bulkActions,
  exportFileName,
  emptyMessage = "No rows yet",
  exportFormats,
  dataSource,
  canDeleteRows,
  sort: sortProp,
  defaultSort,
  onSortChange,
  filters: filtersProp,
  defaultFilters,
  onFiltersChange,
  selectedRowIds: selectedRowIdsProp,
  defaultSelectedRowIds,
  onSelectedRowIdsChange,
  hiddenColumns: hiddenColumnsProp,
  defaultHiddenColumns,
  onHiddenColumnsChange,
  pinnedColumns: pinnedColumnsProp,
  defaultPinnedColumns,
  onPinnedColumnsChange,
  density: densityProp,
  defaultDensity,
  onDensityChange,
  groupBy: groupByProp,
  defaultGroupBy,
  onGroupByChange,
  loading,
}: DataGridProps) {
  const readOnly = !!dataSource;
  const canDelete = (canDeleteRows ?? true) && !readOnly;
  const reduceMotion = !!useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const [innerRows, setInnerRows] = useState<DataGridRow[]>(() => defaultRows ?? rows ?? []);
  const allRows = rows ?? innerRows;

  const [sort, setSortState] = useControllable<DataGridSort[]>(sortProp, () => defaultSort ?? [], onSortChange);
  const [filters, setFiltersState] = useControllable<DataGridFilters>(
    filtersProp,
    () => defaultFilters ?? {},
    onFiltersChange,
  );
  const [selectedIds, setSelectedIds] = useControllable<(string | number)[]>(
    selectedRowIdsProp,
    () => defaultSelectedRowIds ?? [],
    onSelectedRowIdsChange,
  );
  const [hiddenKeys, setHiddenKeys] = useControllable<string[]>(
    hiddenColumnsProp,
    () => defaultHiddenColumns ?? columns.filter(column => column.hidden).map(column => column.key),
    onHiddenColumnsChange,
  );
  const [pinnedKeys, setPinnedKeys] = useControllable<string[]>(
    pinnedColumnsProp,
    () =>
      defaultPinnedColumns ??
      (columns.some(column => column.pinned !== undefined)
        ? columns.filter(column => column.pinned).map(column => column.key)
        : columns.slice(0, 1).map(column => column.key)),
    onPinnedColumnsChange,
  );
  const [density, setDensityState] = useControllable<DataGridDensity>(
    densityProp,
    () => defaultDensity ?? "standard",
    onDensityChange,
  );
  const [groupKeys, setGroupKeys] = useControllable<string[]>(groupByProp, () => defaultGroupBy ?? [], onGroupByChange);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(() => Object.keys(filtersProp ?? defaultFilters ?? {}).length > 0);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map(column => [column.key, column.width ?? 140])),
  );
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeftBucket, setScrollLeftBucket] = useState(0);
  const [selection, setSelection] = useState<{ anchor: CellPos; focus: CellPos }>({
    anchor: { r: 0, c: 0 },
    focus: { r: 0, c: 0 },
  });
  const [editing, setEditing] = useState<EditCell | null>(null);
  const [dragRange, setDragRange] = useState<CellRect | null>(null);
  const [wash, setWash] = useState<{ range: CellRect; n: number } | null>(null);
  const [activeResize, setActiveResize] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [status, setStatus] = useState<GridStatus | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [history, setHistory] = useState({ past: 0, future: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollX = useMotionValue(0);
  const pastRef = useRef<{ rows: DataGridRow[]; range: CellRect | null }[]>([]);
  const futureRef = useRef<{ rows: DataGridRow[]; range: CellRect | null }[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const touchRef = useRef<{ cell: HitCell; id: number } | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const sortTimer = useRef<number | undefined>(undefined);
  const keyGuard = useRef(false);
  const lastToggled = useRef<number | null>(null);
  const handlers = useRef<{ toggleRow: typeof toggleRow; undo: () => void }>({
    toggleRow: () => {},
    undo: () => {},
  });

  const hiddenSet = useMemo(() => new Set(hiddenKeys), [hiddenKeys]);
  const pinnedSet = useMemo(() => new Set(pinnedKeys), [pinnedKeys]);

  const orderedColumns = useMemo(() => {
    const visible = columns.filter(column => !hiddenSet.has(column.key));
    return [...visible.filter(column => pinnedSet.has(column.key)), ...visible.filter(column => !pinnedSet.has(column.key))];
  }, [columns, hiddenSet, pinnedSet]);

  const columnCount = orderedColumns.length;
  const rowH = DENSITY_ROW_HEIGHT[density];
  const toolbarH = 40 + 40 * Number(filtersOpen);
  const footH = 40 * Number(totals);
  const gutterWidth = rowSelection ? (rowNumbers ? 48 : 40) : 0;

  const geometry = useMemo(() => {
    const sizes = orderedColumns.map(column => widths[column.key] ?? column.width ?? 140);
    const pinCount = orderedColumns.filter(column => pinnedSet.has(column.key)).length;
    const pinTotal = sizes.slice(0, pinCount).reduce((total, size) => total + size, 0);
    const maxPin = viewport.w ? Math.max(96, Math.floor(0.5 * viewport.w) - gutterWidth) : Infinity;
    if (pinTotal > maxPin)
      for (let index = 0; index < pinCount; index++)
        sizes[index] = Math.max(
          Math.min(orderedColumns[index].minWidth ?? 72, 96),
          Math.floor((sizes[index] * maxPin) / pinTotal),
        );
    const total = sizes.reduce((sum, size) => sum + size, 0) + gutterWidth;
    if (viewport.w > total && sizes.length) sizes[sizes.length - 1] += viewport.w - total;
    const lefts: number[] = [];
    let cursor = gutterWidth;
    for (const size of sizes) {
      lefts.push(cursor);
      cursor += size;
    }
    return {
      lefts,
      widths: sizes,
      pinCount,
      pinEdge: gutterWidth + sizes.slice(0, pinCount).reduce((sum, size) => sum + size, 0),
      lead: gutterWidth,
      total: cursor,
    };
  }, [orderedColumns, widths, pinnedSet, viewport.w, gutterWidth]);

  const slots = useMemo<GridSlot[]>(
    () =>
      orderedColumns.map((column, index) => ({
        column,
        width: geometry.widths[index],
        left: geometry.lefts[index],
        pinned: index < geometry.pinCount,
        edge: index === geometry.pinCount - 1,
        numeric: isNumeric(column),
      })),
    [orderedColumns, geometry],
  );

  const selectOptions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const column of columns) {
      if (column.type !== "select") continue;
      if (column.options) {
        map.set(column.key, column.options);
        continue;
      }
      const found = new Set<string>();
      for (const row of allRows) {
        const value = row[column.key];
        if (value != null && value !== "") found.add(String(value));
        if (found.size > 200) break;
      }
      map.set(column.key, [...found].sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [columns, allRows]);

  const optionsFor = useCallback(
    (column: DataGridColumn) => {
      const base = selectOptions.get(column.key) ?? [];
      const hasBlank = allRows.some(
        row => row[column.key] === "" || row[column.key] === null || row[column.key] === undefined,
      );
      return hasBlank ? [...base, ""] : base;
    },
    [selectOptions, allRows],
  );

  const deferredFilters = useDeferredValue(filters);
  const deferredSearch = useDeferredValue(search);

  const groupColumns = useMemo(
    () => (readOnly ? [] : groupKeys.filter(key => columns.some(column => column.key === key))),
    [readOnly, groupKeys, columns],
  );

  const derived = useMemo(() => {
    if (readOnly) return { ids: [] as (string | number)[], groups: null as GroupNode[] | null };
    const predicate = rowPredicate(deferredFilters, deferredSearch, orderedColumns);
    const filtered = sortRows(predicate ? allRows.filter(predicate) : allRows, sort, columns);
    if (!groupColumns.length) return { ids: filtered.map(row => row.id), groups: null };
    const groups = buildGroups(filtered, groupColumns, sort, columns);
    const flatten = (node: GroupNode): (string | number)[] =>
      node.children.length ? node.children.flatMap(flatten) : node.rows.map(row => row.id);
    return { ids: groups.flatMap(flatten), groups };
  }, [readOnly, allRows, deferredFilters, deferredSearch, sort, columns, orderedColumns, groupColumns]);

  const rowById = useMemo(() => new Map(allRows.map(row => [row.id, row])), [allRows]);
  const sortedRows = useMemo(
    () => derived.ids.flatMap(id => {
      const row = rowById.get(id);
      return row ? [row] : [];
    }),
    [derived.ids, rowById],
  );

  const layout = useMemo(() => {
    if (!derived.groups) return null;
    const display: DataGridRow[] = [];
    const lineOf: number[] = [];
    const lineRow: number[] = [];
    const groupAt = new Map<number, { node: GroupNode; rows: DataGridRow[] }>();
    const walk = (node: GroupNode) => {
      groupAt.set(lineRow.length, {
        node,
        rows: node.rows,
      });
      lineOf.push(display.length);
      lineRow.push(display.length);
      if (collapsed.has(node.id)) return;
      if (node.children.length) {
        node.children.forEach(walk);
        return;
      }
      for (const row of node.rows) {
        lineOf.push(lineRow.length);
        lineRow.push(display.length);
        display.push(row);
      }
    };
    derived.groups.forEach(walk);
    const last = Math.max(0, display.length - 1);
    return { display, lineOf, lineRow: lineRow.map(index => Math.min(index, last)), groupAt, lineCount: lineRow.length };
  }, [derived.groups, collapsed]);

  const lineOf = layout?.lineOf ?? null;
  const toLine = useCallback((index: number) => (lineOf ? lineOf[index] ?? index : index), [lineOf]);

  const blockSize = Math.max(1, dataSource?.blockSize ?? 100);
  const [blocks, setBlocks] = useState<BlockCache>(() => ({
    key: "",
    count: null,
    blocks: new Map(),
    totals: undefined,
    failed: false,
  }));
  const blockKey = JSON.stringify([sort, deferredFilters, deferredSearch.trim()]);
  const getRows = dataSource?.getRows;
  if (blocks.key !== blockKey) {
    setBlocks({ key: blockKey, count: null, blocks: new Map(), totals: undefined, failed: false });
  }

  const isLoading = (loading ?? false) || (readOnly && blocks.count === null && !blocks.failed);
  const sourceRows = layout ? layout.display : sortedRows;
  const rowAt = useCallback(
    (index: number): DataGridRow | undefined =>
      readOnly ? blocks.blocks.get(Math.floor(index / blockSize))?.[index % blockSize] : sourceRows[index],
    [readOnly, blocks.blocks, blockSize, sourceRows],
  );
  const rowCount = isLoading ? 0 : readOnly ? blocks.count ?? 0 : sourceRows.length;
  const lineCount = isLoading ? 0 : layout ? layout.lineCount : rowCount;
  const totalRows = readOnly ? blocks.count ?? 0 : sortedRows.length;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const activeFilters =
    orderedColumns.filter(column => isFiltered(column, deferredFilters[column.key])).length +
    columns.filter(column => hiddenSet.has(column.key) && isFiltered(column, deferredFilters[column.key])).length;
  const hasFilters = activeFilters > 0 || search.trim() !== "";

  const lastRow = Math.max(0, rowCount - 1);
  const lastCol = Math.max(0, columnCount - 1);
  const anchorPos: CellPos = { r: clamp(selection.anchor.r, 0, lastRow), c: clamp(selection.anchor.c, 0, lastCol) };
  const focusPos: CellPos = { r: clamp(selection.focus.r, 0, lastRow), c: clamp(selection.focus.c, 0, lastCol) };
  const selectedRange = rangeOf(anchorPos, focusPos);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setViewport(current =>
        current.w === el.clientWidth && current.h === el.clientHeight
          ? current
          : { w: el.clientWidth, h: el.clientHeight },
      ),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const previousRowH = useRef(rowH);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && previousRowH.current !== rowH) el.scrollTop = Math.round((el.scrollTop * rowH) / previousRowH.current);
    previousRowH.current = rowH;
  }, [rowH]);

  useEffect(
    () => () => {
      window.clearTimeout(statusTimer.current);
      window.clearTimeout(sortTimer.current);
    },
    [],
  );

  /** Show a message in the status bar and announce it, then let it fade. */
  const showStatus = (text: string, action?: GridStatus["action"]) => {
    window.clearTimeout(statusTimer.current);
    setStatus(current => ({ text, n: (current?.n ?? 0) + 1, action }));
    setAnnouncement(text);
    statusTimer.current = window.setTimeout(() => setStatus(null), action ? 6000 : 2400);
  };

  const guardReadOnly = () => {
    if (readOnly) showStatus("This grid is read only");
    return readOnly;
  };

  const commitRows = (next: DataGridRow[]) => {
    if (!rows) setInnerRows(next);
    onRowsChange?.(next);
  };

  const pushHistory = (next: DataGridRow[], range: CellRect | null) => {
    pastRef.current = [...pastRef.current.slice(-99), { rows: allRows, range }];
    futureRef.current = [];
    setHistory({ past: pastRef.current.length, future: 0 });
    commitRows(next);
  };

  /** Apply cell edits, skipping read-only, ill-typed and unchanged cells. */
  const applyEdits = (edits: { r: number; c: number; value: DataGridValue }[], range: CellRect | null) => {
    if (readOnly) return 0;
    const patches = new Map<string | number, Record<string, DataGridValue>>();
    let count = 0;
    for (const edit of edits) {
      const column = orderedColumns[edit.c];
      const row = sourceRows[edit.r];
      if (!row || !column || column.editable === false) continue;
      if (isNumeric(column) && edit.value !== null && typeof edit.value !== "number") continue;
      if (isDate(column) && edit.value !== null && !isIsoDate(edit.value)) continue;
      if ((row[column.key] ?? null) === edit.value) continue;
      if (edit.value === "" && (row[column.key] ?? "") === "") continue;
      patches.set(row.id, { ...patches.get(row.id), [column.key]: edit.value });
      count++;
    }
    if (count) pushHistory(allRows.map(row => (patches.has(row.id) ? { ...row, ...patches.get(row.id) } : row)), range);
    return count;
  };

  /** Scroll a cell into view, leaving the pinned block alone. */
  const scrollCellIntoView = (pos: CellPos) => {
    const el = scrollerRef.current;
    if (!el) return;
    const line = toLine(pos.r);
    const top = line * rowH;
    const bottom = top + rowH;
    const viewTop = el.scrollTop;
    const viewBottom = el.scrollTop + el.clientHeight - toolbarH - footH;
    if (top < viewTop) el.scrollTop = top;
    else if (bottom > viewBottom) el.scrollTop = bottom - (el.clientHeight - toolbarH - footH);
    if (pos.c < geometry.pinCount) return;
    const left = geometry.lefts[pos.c];
    const right = left + geometry.widths[pos.c];
    if (left - geometry.pinEdge < el.scrollLeft) el.scrollLeft = left - geometry.pinEdge;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  };

  const selectRange = (anchor: CellPos, focus: CellPos = anchor, scrollPos: CellPos = focus) => {
    setSelection({ anchor, focus });
    scrollCellIntoView(scrollPos);
  };

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  const flashRange = (range: CellRect) => setWash(current => ({ range, n: (current?.n ?? 0) + 1 }));

  /** Enter edit mode on a cell; typing starts in enter mode (commit-and-move). */
  const beginEdit = (pos: CellPos, draft?: string, fromDoubleClick = false) => {
    const column = orderedColumns[pos.c];
    const row = rowAt(pos.r);
    if (!row || !column || guardReadOnly()) return;
    if (column.editable === false) {
      showStatus(`${column.label} is read only`);
      return;
    }
    selectRange(pos);
    keyGuard.current = false;
    const value = row[column.key];
    setEditing({
      r: pos.r,
      c: pos.c,
      draft: draft ?? (value == null ? "" : String(value)),
      invalid: false,
      mode: draft === undefined ? "edit" : "enter",
      list: fromDoubleClick || ((column.type === "select" || column.type === "date") && draft !== undefined),
    });
  };

  const clearRange = (range: CellRect) => {
    if (guardReadOnly()) return;
    const edits: { r: number; c: number; value: DataGridValue }[] = [];
    for (let r = range.r0; r <= range.r1; r++)
      for (let c = range.c0; c <= range.c1; c++) edits.push({ r, c, value: blankFor(orderedColumns[c]) });
    const count = applyEdits(edits, range);
    showStatus(count ? `Cleared ${plural(count, "cell")}` : "Nothing to clear");
  };

  const undo = () => {
    const entry = pastRef.current.pop();
    if (!entry) {
      showStatus("Nothing to undo");
      return;
    }
    futureRef.current.push({ rows: allRows, range: entry.range });
    setHistory({ past: pastRef.current.length, future: futureRef.current.length });
    commitRows(entry.rows);
    if (entry.range) {
      setSelection({
        anchor: { r: entry.range.r0, c: entry.range.c0 },
        focus: { r: entry.range.r1, c: entry.range.c1 },
      });
      flashRange(entry.range);
    }
    showStatus("Undone");
  };

  const redo = () => {
    const entry = futureRef.current.pop();
    if (!entry) {
      showStatus("Nothing to redo");
      return;
    }
    pastRef.current.push({ rows: allRows, range: entry.range });
    setHistory({ past: pastRef.current.length, future: futureRef.current.length });
    commitRows(entry.rows);
    if (entry.range) {
      setSelection({
        anchor: { r: entry.range.r0, c: entry.range.c0 },
        focus: { r: entry.range.r1, c: entry.range.c1 },
      });
      flashRange(entry.range);
    }
    showStatus("Redone");
  };

  const changeSort = (next: DataGridSort[]) => {
    setSortState(next);
    window.clearTimeout(sortTimer.current);
    setMoving(true);
    sortTimer.current = window.setTimeout(() => setMoving(false), 700);
    const parts = next.map(item => {
      const column = columns.find(entry => entry.key === item.key);
      return `${column?.label ?? item.key} ${item.dir === "asc" ? "ascending" : "descending"}`;
    });
    setAnnouncement(parts.length ? `Sorted by ${parts.join(", then ")}` : "Original order restored");
  };

  const setFilter = (key: string, value: string | string[] | undefined) => {
    const next = { ...filters };
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
    setFiltersState(next);
  };

  const clearAllFilters = () => {
    setFiltersState({});
    setSearch("");
    showStatus("Filters cleared");
  };

  const hideColumn = (key: string) => {
    if (!hiddenSet.has(key) && columnCount <= 1) return;
    setHiddenKeys(hiddenSet.has(key) ? hiddenKeys.filter(item => item !== key) : [...hiddenKeys, key]);
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRow = (id: string | number, index: number, shift: boolean) => {
    const next = new Set(selectedSet);
    const on = !next.has(id);
    if (shift && lastToggled.current !== null) {
      const from = Math.min(lastToggled.current, index);
      const to = Math.max(lastToggled.current, index);
      for (let line = from; line <= to; line++) {
        const row = rowAt(line);
        if (!row) continue;
        if (on) next.add(row.id);
        else next.delete(row.id);
      }
    } else if (on) next.add(id);
    else next.delete(id);
    lastToggled.current = index;
    commitChecked(next);
  };

  const [checkedCache, setCheckedCache] = useState<Map<string | number, DataGridRow>>(() => new Map());

  function commitChecked(next: Set<string | number>) {
    if (!readOnly) {
      setSelectedIds(allRows.filter(row => next.has(row.id)).map(row => row.id));
      return;
    }
    const kept = new Map([...checkedCache].filter(([id]) => next.has(id)));
    for (const block of blocks.blocks.values())
      for (const row of block) if (next.has(row.id)) kept.set(row.id, row);
    setCheckedCache(kept);
    setSelectedIds([...next]);
  }

  const allChecked = useMemo(() => {
    if (!selectedSet.size || !sortedRows.length) return false;
    return sortedRows.every(row => selectedSet.has(row.id));
  }, [sortedRows, selectedSet]);
  const someChecked = useMemo(() => {
    if (!selectedSet.size || !sortedRows.length) return false;
    return !allChecked && sortedRows.some(row => selectedSet.has(row.id));
  }, [sortedRows, selectedSet, allChecked]);

  const checkedRows = useMemo(
    () => (readOnly ? [...selectedIds].flatMap(id => {
      const row = checkedCache.get(id);
      return row ? [row] : [];
    }) : allRows.filter(row => selectedSet.has(row.id))),
    [readOnly, selectedIds, checkedCache, allRows, selectedSet],
  );

  /** Build a string matrix for the clipboard and exports. */
  const rangeMatrix = (range: CellRect, includeHeader = false, formatted = false) => {
    const matrix: string[][] = includeHeader
      ? [orderedColumns.slice(range.c0, range.c1 + 1).map(column => column.label)]
      : [];
    for (let r = range.r0; r <= range.r1; r++) {
      const line: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) {
        const column = orderedColumns[c];
        const value = rowAt(r)?.[column.key];
        line.push(formatted ? formatValue(value, column) : value == null ? "" : String(value));
      }
      matrix.push(line);
    }
    return matrix;
  };

  const copyCheckedRows = async () => {
    const matrix = [
      orderedColumns.map(column => column.label),
      ...checkedRows.map(row => orderedColumns.map(column => formatValue(row[column.key], column))),
    ];
    const plain = [
      orderedColumns.map(column => column.label),
      ...checkedRows.map(row => orderedColumns.map(column => String(row[column.key] ?? ""))),
    ];
    showStatus(
      (await copyRich(toTsv(plain), toHtml(matrix)))
        ? `Copied ${plural(checkedRows.length, "row")}`
        : "Copy failed. Your browser blocked the clipboard",
    );
  };

  const formats = exportFormats?.length ? exportFormats : (["csv"] as DataGridExportFormat[]);

  const exportAs = (format: DataGridExportFormat, target: DataGridRow[], useGroups = false) => {
    const base =
      exportFileName ??
      (label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "data");
    if (format === "xlsx") {
      const toNode = (row: DataGridRow): ExportNode => ({ label: "", rows: [row] });
      const groupNode = (node: GroupNode): ExportNode => {
        const column = node.column;
        const text = column ? formatValue(node.value, column) : String(node.value ?? "");
        return {
          label: `${column?.label ?? node.id}: ${text || "Empty"}`,
          children: node.children.length ? node.children.map(groupNode) : node.rows.map(toNode),
        };
      };
      const nodes: ExportNode[] = useGroups && derived.groups ? derived.groups.map(groupNode) : target.map(toNode);
      download(
        `${base}.xlsx`,
        buildXlsx(orderedColumns, nodes, {
          sheetName: label,
          freezeColumns: geometry.pinCount,
          totals,
          widths: Object.fromEntries(orderedColumns.map((column, index) => [column.key, geometry.widths[index] ?? column.width ?? 140])),
        }),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } else {
      download(`${base}.csv`, buildCsv(orderedColumns, target), "text/csv;charset=utf-8");
    }
    showStatus(`Exported ${plural(target.length, "row")}`);
  };

  const clipboard = useRef<{ copy: (event: ClipboardEvent) => void; cut: (event: ClipboardEvent) => void; paste: (event: ClipboardEvent) => void } | null>(null);

  useEffect(() => {
    const cells = (selectedRange.r1 - selectedRange.r0 + 1) * (selectedRange.c1 - selectedRange.c0 + 1);
    const write = (event: ClipboardEvent) => {
      event.preventDefault();
      event.clipboardData?.setData("text/plain", toTsv(rangeMatrix(selectedRange)));
      event.clipboardData?.setData("text/html", toHtml(rangeMatrix(selectedRange, false, true)));
    };
    clipboard.current = {
      copy: event => {
        if (!rowCount) return;
        write(event);
        flashRange(selectedRange);
        showStatus(`Copied ${plural(cells, "cell")}`);
      },
      cut: event => {
        if (!rowCount) return;
        if (guardReadOnly()) {
          event.preventDefault();
          return;
        }
        write(event);
        clearRange(selectedRange);
      },
      paste: event => {
        if (!rowCount) return;
        const html = event.clipboardData?.getData("text/html") ?? "";
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const matrix = (html ? parseHtmlTable(html) : null) ?? (text ? parseTsvText(text) : null);
        if (!matrix?.length) return;
        event.preventDefault();
        if (guardReadOnly()) return;
        const height = matrix.length;
        const width = Math.max(...matrix.map(line => line.length));
        const spanRows = selectedRange.r1 - selectedRange.r0 + 1;
        const spanCols = selectedRange.c1 - selectedRange.c0 + 1;
        const tiled = (spanRows > height || spanCols > width) && spanRows % height === 0 && spanCols % width === 0;
        const rowSpan = tiled ? spanRows : Math.min(height, rowCount - selectedRange.r0);
        const colSpan = tiled ? spanCols : Math.min(width, columnCount - selectedRange.c0);
        const edits: { r: number; c: number; value: DataGridValue }[] = [];
        let skipped = 0;
        for (let r = 0; r < rowSpan; r++)
          for (let c = 0; c < colSpan; c++) {
            const raw = matrix[r % height]?.[c % width] ?? "";
            const column = orderedColumns[selectedRange.c0 + c];
            const parsed = parseValue(raw, column, selectOptions.get(column.key));
            if (parsed.ok) edits.push({ r: selectedRange.r0 + r, c: selectedRange.c0 + c, value: parsed.value ?? null });
            else skipped++;
          }
        const target: CellRect = {
          r0: selectedRange.r0,
          c0: selectedRange.c0,
          r1: selectedRange.r0 + rowSpan - 1,
          c1: selectedRange.c0 + colSpan - 1,
        };
        const count = applyEdits(edits, target);
        setSelection({ anchor: { r: target.r0, c: target.c0 }, focus: { r: target.r1, c: target.c1 } });
        flashRange(target);
        showStatus(
          `Pasted ${plural(count, "cell")}${skipped ? `, skipped ${skipped} that did not fit` : ""}${
            !tiled && (height > rowSpan || width > colSpan) ? ". Some cells fell outside the grid" : ""
          }`,
        );
      },
    };
  });

  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      if (document.activeElement === gridRef.current) clipboard.current?.copy(event);
    };
    const onCut = (event: ClipboardEvent) => {
      if (document.activeElement === gridRef.current) clipboard.current?.cut(event);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (document.activeElement === gridRef.current) clipboard.current?.paste(event);
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  /** Which cell sits under a viewport point. */
  const hitTest = (clientX: number, clientY: number): HitCell | null => {
    const scroller = scrollerRef.current;
    const body = bodyRef.current;
    if (!scroller || !body || !rowCount || !columnCount) return null;
    const outer = scroller.getBoundingClientRect();
    const inner = body.getBoundingClientRect();
    const line = clamp(Math.floor((clientY - inner.top) / rowH), 0, Math.max(0, lineCount - 1));
    const rowIndex = clamp(layout ? layout.lineRow[line] ?? 0 : line, 0, rowCount - 1);
    const x = clientX - outer.left;
    if (x < geometry.pinEdge) {
      if (x < geometry.lead) return { r: rowIndex, c: 0, gutter: true };
      for (let c = 0; c < geometry.pinCount; c++)
        if (x < geometry.lefts[c] + geometry.widths[c]) return { r: rowIndex, c, gutter: false };
    }
    const innerX = clientX - inner.left;
    let column = columnCount - 1;
    for (let c = geometry.pinCount; c < columnCount; c++)
      if (innerX < geometry.lefts[c] + geometry.widths[c]) {
        column = c;
        break;
      }
    return {
      r: rowIndex,
      c: Math.max(Math.min(geometry.pinCount, columnCount - 1), column),
      gutter: false,
    };
  };

  const extendDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const hit = hitTest(clientX, clientY);
    if (!hit) return;
    if (drag.mode === "rows") {
      setSelection(current =>
        current.focus.r === hit.r
          ? current
          : { anchor: { ...current.anchor, c: 0 }, focus: { r: hit.r, c: columnCount - 1 } },
      );
      return;
    }
    if (drag.mode === "select") {
      setSelection(current =>
        current.focus.r === hit.r && current.focus.c === hit.c ? current : { ...current, focus: { r: hit.r, c: hit.c } },
      );
      return;
    }
    const base = drag.range;
    const dr = hit.r > base.r1 ? hit.r - base.r1 : hit.r < base.r0 ? hit.r - base.r0 : 0;
    const dc = hit.c > base.c1 ? hit.c - base.c1 : hit.c < base.c0 ? hit.c - base.c0 : 0;
    if (!dr && !dc) {
      setDragRange(null);
      return;
    }
    setDragRange(
      Math.abs(dr) >= Math.abs(dc)
        ? { ...base, r0: Math.min(base.r0, hit.r), r1: Math.max(base.r1, hit.r) }
        : { ...base, c0: Math.min(base.c0, hit.c), c1: Math.max(base.c1, hit.c) },
    );
  };

  /** Nudge the scroller while a drag sits near an edge, then re-hit-test. */
  const autoScroll = () => {
    const drag = dragRef.current;
    const scroller = scrollerRef.current;
    if (!drag || !scroller) return;
    const box = scroller.getBoundingClientRect();
    const { x, y } = drag.pointer;
    const ease = (distance: number) => Math.sign(distance) * Math.min(28, 0.35 * Math.abs(distance));
    const dy =
      y > box.bottom - footH - 8 ? ease(y - box.bottom + footH + 8) : y < box.top + toolbarH ? ease(y - box.top - toolbarH) : 0;
    const dx =
      x > box.right - 8
        ? ease(x - box.right + 8)
        : x < box.left + geometry.pinEdge && scroller.scrollLeft > 0 && drag.mode !== "rows"
          ? ease(x - box.left - geometry.pinEdge)
          : 0;
    if (dx || dy) {
      scroller.scrollTop += dy;
      scroller.scrollLeft += dx;
      extendDrag(x, y);
    }
    drag.frame = requestAnimationFrame(autoScroll);
  };

  /** Commit a fill drag, extending the series in the dragged direction. */
  const finishFill = () => {
    touchRef.current = null;
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    dragRef.current = null;
    if (drag.mode !== "fill" || !dragRange) return;
    const source = drag.range;
    const edits: { r: number; c: number; value: DataGridValue }[] = [];
    const read = (r: number, c: number) => sourceRows[r]?.[orderedColumns[c].key] ?? null;
    if (dragRange.r0 !== source.r0 || dragRange.r1 !== source.r1) {
      const down = dragRange.r1 > source.r1;
      const count = down ? dragRange.r1 - source.r1 : source.r0 - dragRange.r0;
      for (let c = source.c0; c <= source.c1; c++) {
        const series = Array.from({ length: source.r1 - source.r0 + 1 }, (_, index) => read(source.r0 + index, c));
        fillSeries(series, count, down, orderedColumns[c]?.type).forEach((value, index) =>
          edits.push({ r: down ? source.r1 + 1 + index : source.r0 - 1 - index, c, value }),
        );
      }
    } else {
      const right = dragRange.c1 > source.c1;
      const count = right ? dragRange.c1 - source.c1 : source.c0 - dragRange.c0;
      for (let r = source.r0; r <= source.r1; r++) {
        const series = Array.from({ length: source.c1 - source.c0 + 1 }, (_, index) => read(r, source.c0 + index));
        fillSeries(series, count, right).forEach((value, index) =>
          edits.push({ r, c: right ? source.c1 + 1 + index : source.c0 - 1 - index, value }),
        );
      }
    }
    const target: CellRect =
      dragRange.r1 > source.r1
        ? { ...dragRange, r0: source.r1 + 1 }
        : dragRange.r0 < source.r0
          ? { ...dragRange, r1: source.r0 - 1 }
          : dragRange.c1 > source.c1
            ? { ...dragRange, c0: source.c1 + 1 }
            : { ...dragRange, c1: source.c0 - 1 };
    const count = applyEdits(edits, dragRange);
    setSelection({ anchor: { r: dragRange.r0, c: dragRange.c0 }, focus: { r: dragRange.r1, c: dragRange.c1 } });
    flashRange(target);
    showStatus(count ? `Filled ${plural(count, "cell")}` : "Nothing to fill");
  };

  const pageRows = Math.max(1, Math.floor(((viewport.h || maxHeight) - toolbarH - footH) / rowH) - 1);

  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let filled = 0;
    const types = new Set<DataGridColumnType>();
    for (let r = selectedRange.r0; r <= selectedRange.r1; r++) {
      const row = rowAt(r);
      if (!row) continue;
      for (let c = selectedRange.c0; c <= selectedRange.c1; c++) {
        const column = orderedColumns[c];
        if (!column) continue;
        const value = row[column.key];
        if (value != null && value !== "") filled++;
        if (typeof value === "number") {
          sum += value;
          count++;
          types.add(column.type ?? "number");
        }
      }
    }
    const type = types.size === 1 ? [...types][0] : "number";
    return {
      sum,
      count,
      filled,
      avg: count ? sum / count : 0,
      prefix: type === "currency" ? "$" : "",
      suffix: type === "percent" ? "%" : "",
    };
  }, [selectedRange, rowAt, orderedColumns]);

  const totalsLabels = useMemo(
    () =>
      totals
        ? orderedColumns.map(column => {
            const kind = aggregateFor(column);
            return {
              kind,
              value: readOnly ? (kind === "none" ? null : blocks.totals?.[column.key] ?? null) : aggregateValue(sortedRows, column, kind),
            };
          })
        : [],
    [orderedColumns, sortedRows, totals, readOnly, blocks.totals],
  );

  const visibleLines = Math.ceil((viewport.h || maxHeight) / rowH);
  const firstLine = Math.max(0, scrollTop - 6);
  const lastLine = Math.min(lineCount, scrollTop + visibleLines + 6);
  const mountedLines: number[] = [];
  for (let line = firstLine; line < lastLine; line++) mountedLines.push(line);
  for (const index of [anchorPos.r, focusPos.r, editing?.r ?? -1]) {
    const line = index >= 0 && index < rowCount ? toLine(index) : -1;
    if (line >= 0 && (line < firstLine || line >= lastLine) && !mountedLines.includes(line)) mountedLines.push(line);
  }

  const columnWindow = useMemo<GridWindow>(() => {
    const pinCount = geometry.pinCount;
    if (!viewport.w) return { start: pinCount, end: columnCount, pinCount, pinEdge: geometry.pinEdge, lefts: geometry.lefts, widths: geometry.widths, total: geometry.total };
    const from = 64 * scrollLeftBucket + geometry.pinEdge - 240;
    const to = (scrollLeftBucket + 1) * 64 + viewport.w + 240;
    let start = pinCount;
    while (start < columnCount && (geometry.lefts[start] ?? 0) + (geometry.widths[start] ?? 0) < from) start++;
    let end = start;
    while (end < columnCount && (geometry.lefts[end] ?? 0) < to) end++;
    return { start, end, pinCount, pinEdge: geometry.pinEdge, lefts: geometry.lefts, widths: geometry.widths, total: geometry.total };
  }, [geometry, viewport.w, scrollLeftBucket, columnCount]);

  const firstBlock = Math.floor(firstLine / blockSize);
  const lastBlock = Math.floor(Math.max(firstLine, lastLine - 1) / blockSize);
  const blockRef = useRef(blocks);
  useLayoutEffect(() => {
    blockRef.current = blocks;
  });
  const queryRef = useRef({ sort, filters: deferredFilters, search: deferredSearch.trim() });
  useLayoutEffect(() => {
    queryRef.current = { sort, filters: deferredFilters, search: deferredSearch.trim() };
  });

  useEffect(() => {
    if (!dataSource || !getRows) return;
    const { key, count, blocks: cache } = blockRef.current;
    const wanted: number[] = [];
    if (count === null) wanted.push(0);
    else for (let block = firstBlock; block <= lastBlock && block * blockSize < count; block++) wanted.push(block);
    const controllers = pendingRef.current;
    for (const block of wanted) {
      const id = `${key}${block}`;
      if (cache.has(block) || controllers.has(id)) continue;
      const controller = new AbortController();
      controllers.set(id, controller);
      getRows({ start: block * blockSize, end: (block + 1) * blockSize, ...queryRef.current, signal: controller.signal }).then(
        result => {
          if (controller.signal.aborted) return;
          controllers.delete(id);
          setBlocks(current => {
            if (current.key !== key) return current;
            const next = new Map(current.blocks).set(block, result.rows);
            while (next.size > 40) {
              let furthest = block;
              for (const index of next.keys())
                if (Math.abs(index - block) > Math.abs(furthest - block)) furthest = index;
              if (furthest === block) break;
              next.delete(furthest);
            }
            return {
              ...current,
              count: Math.max(0, result.rowCount),
              blocks: next,
              totals: result.totals ?? current.totals,
              failed: false,
            };
          });
        },
        () => {
          if (controller.signal.aborted) return;
          controllers.delete(id);
          setBlocks(current => (current.key === key ? { ...current, failed: true } : current));
          showStatus("Rows could not load");
        },
      );
    }
  }, [dataSource, getRows, blocks.key, blocks.count, blocks.blocks, firstBlock, lastBlock, blockSize]);

  const pendingRef = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const controllers = pendingRef.current;
    return () => {
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    };
  }, [blocks.key]);

  const bulk = rowSelection && selectedIds.length > 0;
  const activeDescendant = rowCount ? `${uid}-${focusPos.r}-${focusPos.c}` : undefined;
  const bodyHeight = isLoading ? 6 * rowH : lineCount ? lineCount * rowH : 176;
  const gridHeight = lineCount;
  const rowNumberOffset = filtersOpen ? 2 : 1;
  const editingRow = editing ? rowAt(editing.r) : undefined;
  const editorNode =
    editing && orderedColumns[editing.c] && editingRow
      ? (
          <CellEditor
            key={`${editing.r}-${editing.c}`}
            column={orderedColumns[editing.c]}
            options={selectOptions.get(orderedColumns[editing.c].key) ?? []}
            editing={editing}
            label={`${orderedColumns[editing.c].label} for ${String(editingRow[orderedColumns[0].key] ?? "")}`}
            openUp={
              (toLine(editing.r) + 1) * rowH + 220 > scrollTop * rowH + (viewport.h || maxHeight) - toolbarH - footH &&
              toLine(editing.r) * rowH > 220
            }
            onDraft={draft => setEditing(current => (current ? { ...current, draft, invalid: false } : current))}
            onCommit={(move, value) => {
              if (!editing || keyGuard.current) return;
              const column = orderedColumns[editing.c];
              const row = sourceRows[editing.r];
              const parsed = parseValue(value ?? editing.draft, column, selectOptions.get(column.key));
              if (!parsed.ok) {
                if (move) {
                  setEditing({
                    ...editing,
                    invalid: true,
                    list: column.type === "select" || column.type === "date",
                  });
                  setAnnouncement(
                    column.type === "select"
                      ? `Choose one of the ${column.label} options`
                      : isDate(column)
                        ? `${column.label} needs a date like 2026-01-31`
                        : `${column.label} needs a number`,
                  );
                  return;
                }
                keyGuard.current = true;
                setEditing(null);
                return;
              }
              keyGuard.current = true;
              if (row && (row[column.key] ?? null) !== parsed.value) {
                applyEdits([{ r: editing.r, c: editing.c, value: parsed.value ?? null }], {
                  r0: editing.r,
                  r1: editing.r,
                  c0: editing.c,
                  c1: editing.c,
                });
                setAnnouncement(
                  `${column.label} for ${String(row[orderedColumns[0].key] ?? "")} set to ${
                    formatValue(parsed.value ?? null, column) || "empty"
                  }`,
                );
              }
              setEditing(null);
              if (move && (move.dr || move.dc)) {
                selectRange({
                  r: clamp(editing.r + move.dr, 0, lastRow),
                  c: clamp(editing.c + move.dc, 0, lastCol),
                });
              }
              focusGrid();
            }}
            onCancel={() => {
              keyGuard.current = true;
              setEditing(null);
              focusGrid();
            }}
          />
        )
      : null;

  const rowCountText = `${totalRows.toLocaleString("en-US")}${
    hasFilters && !readOnly ? ` of ${allRows.length.toLocaleString("en-US")}` : ""
  } ${totalRows === 1 && !hasFilters ? "row" : "rows"}`;

  const handlersReady = () => {
    handlers.current = { toggleRow, undo };
  };
  useLayoutEffect(handlersReady);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-density={density}
      data-row-numbers={rowSelection && !rowNumbers ? "off" : undefined}
      style={{ "--row-h": `${rowH}px`, "--gutter-w": `${gutterWidth || 48}px` } as CSSProperties}
    >
      {toolbar && (
        <div className={styles.toolbar}>
          <AnimatePresence initial={false}>
            {bulk ? (
              <motion.div
                key="bulk"
                className={styles.toolbarRow}
                data-bulk=""
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.standard }}
              >
                <button
                  type="button"
                  className={styles.toolIcon}
                  aria-label="Clear row selection"
                  onClick={() => setSelectedIds([])}
                >
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <span className={styles.bulkCount}>
                  <AnimatedCounter value={selectedIds.length} />
                  {" selected"}
                </span>
                <span className={styles.toolSpacer} />
                <button type="button" className={styles.toolButton} onClick={copyCheckedRows}>
                  <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.toolLabel}>Copy</span>
                </button>
                <ExportButton formats={formats} onExport={format => exportAs(format, checkedRows)} />
                {bulkActions?.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    className={styles.toolButton}
                    data-tone={action.tone}
                    onClick={() => action.onAction(checkedRows)}
                  >
                    {action.icon}
                    <span className={styles.toolLabel}>{action.label}</span>
                  </button>
                ))}
                {canDelete && (
                  <button
                    type="button"
                    className={styles.toolButton}
                    data-tone="danger"
                    onClick={() => {
                      const count = checkedRows.length;
                      pushHistory(allRows.filter(row => !selectedSet.has(row.id)), null);
                      setSelectedIds([]);
                      showStatus(`Deleted ${plural(count, "row")}`, {
                        label: "Undo",
                        run: () => {
                          handlers.current.undo();
                          focusGrid();
                        },
                      });
                    }}
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.toolLabel}>Delete</span>
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="tools"
                className={styles.toolbarRow}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.standard }}
              >
                <label className={styles.search}>
                  <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search"
                    aria-label={`Search ${label}`}
                    spellCheck={false}
                    onKeyDown={event => {
                      if (event.key === "Escape") {
                        if (search) setSearch("");
                        else focusGrid();
                      } else if (event.key === "Enter" || event.key === "ArrowDown") {
                        event.preventDefault();
                        focusGrid();
                      }
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      className={styles.searchClear}
                      aria-label="Clear search"
                      onClick={() => {
                        setSearch("");
                        searchRef.current?.focus();
                      }}
                    >
                      <X size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  )}
                </label>
                <span className={styles.rowCount} aria-live="polite">
                  {rowCountText}
                </span>
                <span className={styles.toolSpacer} />
                <span className={styles.toolGroup}>
                  <button
                    type="button"
                    className={styles.toolIcon}
                    aria-label="Undo"
                    disabled={!history.past}
                    onClick={() => {
                      undo();
                      focusGrid();
                    }}
                  >
                    <Undo2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.toolIcon}
                    aria-label="Redo"
                    disabled={!history.future}
                    onClick={() => {
                      redo();
                      focusGrid();
                    }}
                  >
                    <Redo2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </span>
                <button
                  type="button"
                  className={styles.toolButton}
                  aria-pressed={filtersOpen}
                  aria-label="Filters"
                  onClick={() => setFiltersOpen(open => !open)}
                >
                  <ListFilter size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.toolLabel}>Filter</span>
                  {activeFilters > 0 && <span className={styles.toolCount}>{activeFilters}</span>}
                </button>
                <ColumnsMenu
                  columns={columns}
                  hidden={hiddenSet}
                  pinned={pinnedSet}
                  onToggle={hideColumn}
                  onShowAll={() => setHiddenKeys([])}
                />
                <DensityMenu density={density} onChange={setDensityState} />
                {groupColumns.length > 0 && (
                  <button
                    type="button"
                    className={styles.toolIcon}
                    aria-label={collapsed.size ? "Expand all groups" : "Collapse all groups"}
                    onClick={() => {
                      const expand = collapsed.size === 0;
                      if (expand) {
                        const ids: string[] = [];
                        const collect = (node: GroupNode) => {
                          ids.push(node.id);
                          node.children.forEach(collect);
                        };
                        derived.groups?.forEach(collect);
                        setCollapsed(new Set(ids));
                      } else setCollapsed(new Set());
                      setAnnouncement(expand ? "Collapsed all groups" : "Expanded all groups");
                    }}
                  >
                    {collapsed.size ? (
                      <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <ChevronsDownUp size={16} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>
                )}
                {!readOnly && (
                  <ExportButton formats={formats} disabled={!sortedRows.length} onExport={format => exportAs(format, sortedRows, true)} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div
        ref={scrollerRef}
        className={styles.scroller}
        style={{ maxHeight }}
        onScroll={event => {
          const el = event.currentTarget;
          scrollX.set(el.scrollLeft);
          rootRef.current?.toggleAttribute("data-scrolled-x", el.scrollLeft > 0);
          const nextTop = Math.max(0, Math.floor(el.scrollTop / rowH));
          if (nextTop !== scrollTop) setScrollTop(nextTop);
          const bucket = Math.floor(el.scrollLeft / 64);
          if (bucket !== scrollLeftBucket) setScrollLeftBucket(bucket);
        }}
      >
        <div
          ref={gridRef}
          className={styles.grid}
          role={layout ? "treegrid" : "grid"}
          tabIndex={0}
          aria-label={label}
          aria-multiselectable="true"
          aria-busy={isLoading || undefined}
          aria-rowcount={gridHeight + rowNumberOffset + Number(totals)}
          aria-colcount={columnCount + Number(rowSelection)}
          aria-activedescendant={editing ? undefined : activeDescendant}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            const meta = event.metaKey || event.ctrlKey;
            const key = event.key.toLowerCase();
            if (meta && key === "z") {
              event.preventDefault();
              if (event.shiftKey) redo();
              else undo();
              return;
            }
            if (meta && key === "y") {
              event.preventDefault();
              redo();
              return;
            }
            if (!rowCount) return;
            if (meta && key === "a") {
              event.preventDefault();
              setSelection({ anchor: { r: 0, c: 0 }, focus: { r: rowCount - 1, c: columnCount - 1 } });
              setAnnouncement(`Selected all ${plural(rowCount * columnCount, "cell")}`);
              return;
            }
            if (meta && key === "d") {
              event.preventDefault();
              if (guardReadOnly()) return;
              if (selectedRange.r0 === selectedRange.r1) {
                showStatus("Select more than one row to fill down");
                return;
              }
              const edits: { r: number; c: number; value: DataGridValue }[] = [];
              for (let r = selectedRange.r0 + 1; r <= selectedRange.r1; r++)
                for (let c = selectedRange.c0; c <= selectedRange.c1; c++)
                  edits.push({ r, c, value: sourceRows[selectedRange.r0]?.[orderedColumns[c].key] ?? null });
              const count = applyEdits(edits, selectedRange);
              flashRange({ ...selectedRange, r0: selectedRange.r0 + 1 });
              showStatus(count ? `Filled down ${plural(count, "cell")}` : "Nothing to fill");
              return;
            }
            if (event.key === " " && event.shiftKey && rowSelection) {
              event.preventDefault();
              const ids: (string | number)[] = [];
              for (let r = selectedRange.r0; r <= selectedRange.r1; r++) {
                const row = rowAt(r);
                if (row) ids.push(row.id);
              }
              const on = !ids.every(id => selectedSet.has(id));
              const next = new Set(selectedSet);
              ids.forEach(id => (on ? next.add(id) : next.delete(id)));
              commitChecked(next);
              setAnnouncement(`${on ? "Checked" : "Unchecked"} ${plural(ids.length, "row")}`);
              return;
            }
            if (event.key === " " && event.ctrlKey) {
              event.preventDefault();
              setSelection({ anchor: { r: 0, c: selectedRange.c0 }, focus: { r: rowCount - 1, c: selectedRange.c1 } });
              return;
            }
            const moves: Record<string, [number, number]> = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
              PageUp: [-pageRows, 0],
              PageDown: [pageRows, 0],
              Home: [0, -columnCount],
              End: [0, columnCount],
            };
            const move = moves[event.key];
            if (move) {
              if (event.altKey && event.key === "ArrowDown" && orderedColumns[anchorPos.c]?.type === "select") {
                event.preventDefault();
                beginEdit(anchorPos, undefined, true);
                return;
              }
              event.preventDefault();
              const [dr, dc] = move;
              const from = event.shiftKey ? focusPos : anchorPos;
              const toEdge = meta && event.key.startsWith("Arrow");
              const next: CellPos = {
                r: clamp(toEdge ? (dr < 0 ? 0 : dr > 0 ? rowCount - 1 : from.r) : from.r + dr, 0, rowCount - 1),
                c: clamp(toEdge ? (dc < 0 ? 0 : dc > 0 ? columnCount - 1 : from.c) : from.c + dc, 0, columnCount - 1),
              };
              if (meta && (event.key === "Home" || event.key === "End")) next.r = event.key === "Home" ? 0 : rowCount - 1;
              if (event.shiftKey) selectRange(anchorPos, next);
              else selectRange(next);
              return;
            }
            if (event.key === "Enter" || event.key === "F2") {
              event.preventDefault();
              beginEdit(anchorPos);
              return;
            }
            if (event.key === "Escape") {
              if (selectedRange.r0 !== selectedRange.r1 || selectedRange.c0 !== selectedRange.c1) {
                event.preventDefault();
                selectRange(anchorPos);
              } else if (selectedIds.length) {
                event.preventDefault();
                setSelectedIds([]);
                setAnnouncement("Cleared row selection");
              }
              return;
            }
            if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault();
              clearRange(selectedRange);
              return;
            }
            if (event.key.length === 1 && !meta && !event.altKey) {
              event.preventDefault();
              beginEdit(anchorPos, event.key);
            }
          }}
          style={{ width: geometry.total }}
        >
          <div role="rowgroup" className={styles.head}>
            <div role="row" aria-rowindex={1} className={styles.headRow}>
              {rowSelection && (
                <div role="columnheader" aria-colindex={1} className={styles.gutterHead}>
                  {!readOnly && (
                    <GridCheckbox
                      checked={allChecked ? true : someChecked ? "mixed" : false}
                      label={allChecked ? "Clear row selection" : "Select all rows"}
                      onToggle={() => {
                        const next = new Set(selectedSet);
                        sortedRows.forEach(row => (allChecked ? next.delete(row.id) : next.add(row.id)));
                        commitChecked(next);
                        setAnnouncement(
                          allChecked ? "Cleared row selection" : `Checked ${plural(sortedRows.length, "row")}`,
                        );
                      }}
                      tabbable
                    />
                  )}
                </div>
              )}
              {renderSlots(slots, columnWindow, (slot, index, style) => {
                const column = slot.column;
                const priority = sort.findIndex(item => item.key === column.key);
                const direction = priority >= 0 ? sort[priority].dir : null;
                const sortable = column.sortable !== false;
                return (
                  <div
                    key={column.key}
                    role="columnheader"
                    aria-colindex={index + (rowSelection ? 2 : 1)}
                    aria-sort={
                      direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined
                    }
                    className={styles.headCell}
                    data-pinned={slot.pinned || undefined}
                    data-pin-edge={slot.edge || undefined}
                    data-num={slot.numeric || undefined}
                    data-selected={
                      (rowCount > 0 && index >= selectedRange.c0 && index <= selectedRange.c1) || undefined
                    }
                    data-sorted={direction ?? undefined}
                    style={style}
                  >
                    <button
                      type="button"
                      className={styles.sortButton}
                      disabled={!sortable}
                      onClick={event => {
                        const nextDirection = direction ? (direction === "asc" ? "desc" : null) : "asc";
                        if (event.shiftKey) {
                          changeSort(
                            direction
                              ? nextDirection
                                ? sort.map(item =>
                                    item.key === column.key ? { key: column.key, dir: nextDirection } : item,
                                  )
                                : sort.filter(item => item.key !== column.key)
                              : [...sort, { key: column.key, dir: "asc" }],
                          );
                        } else changeSort(nextDirection ? [{ key: column.key, dir: nextDirection }] : []);
                      }}
                      onKeyDown={event => {
                        if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                          event.preventDefault();
                          const step = event.key === "ArrowRight" ? 16 : -16;
                          setWidths(current => ({
                            ...current,
                            [column.key]: clamp(
                              (current[column.key] ?? geometry.widths[index]) + step,
                              orderedColumns[index].minWidth ?? 72,
                              560,
                            ),
                          }));
                        }
                      }}
                      aria-label={`${column.label}${
                        direction
                          ? `, sorted ${direction === "asc" ? "ascending" : "descending"}${
                              sort.length > 1 ? `, priority ${priority + 1}` : ""
                            }`
                          : ""
                      }. ${sortable ? "Sort, shift to add a sort key. " : ""}Alt and arrow keys resize`}
                    >
                      <span className={styles.headLabel}>{column.label}</span>
                      {sortable && (
                        <span className={styles.sortIcon} data-dir={direction ?? undefined} aria-hidden="true">
                          <ArrowUp size={14} strokeWidth={1.75} />
                          {sort.length > 1 && priority >= 0 && <span className={styles.sortOrder}>{priority + 1}</span>}
                        </span>
                      )}
                    </button>
                    <HeadMenu
                      column={column}
                      sorted={direction}
                      pinned={slot.pinned}
                      canHide={columnCount > 1}
                      onSort={next => changeSort(next ? [{ key: column.key, dir: next }] : sort.filter(item => item.key !== column.key))}
                      onFilter={
                        column.filterable === false
                          ? null
                          : () => {
                              setFiltersOpen(true);
                              requestAnimationFrame(() =>
                                rootRef.current
                                  ?.querySelector<HTMLElement>(`[data-filter-key="${CSS.escape(column.key)}"]`)
                                  ?.focus(),
                              );
                            }
                      }
                      grouped={groupColumns.includes(column.key)}
                      onGroup={
                        !readOnly && (column.groupable ?? !isNumeric(column))
                          ? () => {
                              const on = !groupKeys.includes(column.key);
                              setGroupKeys(
                                on ? [...groupKeys, column.key] : groupKeys.filter(key => key !== column.key),
                              );
                              setAnnouncement(
                                `${on ? "Grouped by" : "Stopped grouping by"} ${
                                  columns.find(item => item.key === column.key)?.label ?? column.key
                                }`,
                              );
                            }
                          : null
                      }
                      onPin={() =>
                        setPinnedKeys(
                          pinnedSet.has(column.key) ? pinnedKeys.filter(key => key !== column.key) : [...pinnedKeys, column.key],
                        )
                      }
                      onHide={() => hideColumn(column.key)}
                    />
                    <div
                      className={styles.resizer}
                      aria-hidden="true"
                      data-active={activeResize === column.key || undefined}
                      onPointerDown={event => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const handle = event.currentTarget;
                        const startX = event.clientX;
                        const startWidth = geometry.widths[index];
                        const minWidth = orderedColumns[index].minWidth ?? 72;
                        handle.setPointerCapture(event.pointerId);
                        setActiveResize(column.key);
                        const move = (moveEvent: PointerEvent) =>
                          setWidths(current => ({
                            ...current,
                            [column.key]: clamp(Math.round(startWidth + moveEvent.clientX - startX), minWidth, 560),
                          }));
                        const stop = () => {
                          setActiveResize(null);
                          handle.removeEventListener("pointermove", move);
                          handle.removeEventListener("pointerup", stop);
                          handle.removeEventListener("pointercancel", stop);
                        };
                        handle.addEventListener("pointermove", move);
                        handle.addEventListener("pointerup", stop);
                        handle.addEventListener("pointercancel", stop);
                      }}
                      onDoubleClick={() => setWidths(current => ({ ...current, [column.key]: column.width ?? 140 }))}
                    />
                  </div>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {filtersOpen && (
                <motion.div
                  key="filters"
                  role="row"
                  aria-rowindex={2}
                  className={styles.filterRow}
                  initial={{ height: 40 * Number(reduceMotion), opacity: 0 }}
                  animate={{ height: 40, opacity: 1 }}
                  exit={{
                    height: 40 * Number(reduceMotion),
                    opacity: 0,
                    transition: reduceMotion
                      ? { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard }
                      : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.exit, ease: motionTokens.ease.exit } },
                  }}
                  transition={
                    reduceMotion
                      ? { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard }
                      : {
                          height: motionTokens.spring.smooth,
                          opacity: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
                        }
                  }
                >
                  {rowSelection && (
                    <div role="gridcell" aria-colindex={1} className={styles.gutterHead}>
                      {hasFilters && (
                        <button
                          type="button"
                          className={styles.clearFilters}
                          aria-label="Clear all filters"
                          onClick={clearAllFilters}
                        >
                          <FilterX size={15} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                  {renderSlots(slots, columnWindow, (slot, index, style) => {
                    const column = slot.column;
                    const value = filters[column.key];
                    const numeric = isNumeric(column);
                    const date = isDate(column);
                    const invalid =
                      typeof value === "string" &&
                      (numeric ? numberFilter(value) === "invalid" : date && dateFilter(value) === "invalid");
                    return (
                      <div
                        key={column.key}
                        role="gridcell"
                        aria-colindex={index + (rowSelection ? 2 : 1)}
                        className={styles.filterCell}
                        data-pinned={slot.pinned || undefined}
                        data-pin-edge={slot.edge || undefined}
                        style={style}
                      >
                        {column.filterable === false ? null : column.type === "select" ? (
                          <FilterSelect
                            column={column}
                            options={optionsFor(column)}
                            value={Array.isArray(value) ? value : undefined}
                            onChange={next => setFilter(column.key, next)}
                          />
                        ) : (
                          <input
                            className={styles.filterInput}
                            data-filter-key={column.key}
                            data-num={slot.numeric || undefined}
                            data-active={isFiltered(column, value) || undefined}
                            aria-invalid={invalid || undefined}
                            value={typeof value === "string" ? value : ""}
                            spellCheck={false}
                            autoComplete="off"
                            placeholder={numeric ? "> 100, 10..50" : date ? "> 2026-01-31" : "Contains"}
                            aria-label={`Filter ${column.label}${
                              numeric
                                ? ". Use > < = or a range like 10..50"
                                : date
                                  ? ". Use a day, month, or year with > < =, or a range like 2026-01-01..2026-03-31"
                                  : ""
                            }`}
                            onChange={event => setFilter(column.key, event.target.value)}
                            onKeyDown={event => {
                              if (event.key === "Escape") {
                                event.preventDefault();
                                if (value) setFilter(column.key, undefined);
                                else focusGrid();
                              } else if (event.key === "Enter" || event.key === "ArrowDown") {
                                event.preventDefault();
                                focusGrid();
                              }
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            ref={bodyRef}
            role="rowgroup"
            className={styles.body}
            data-moving={(moving && !reduceMotion) || undefined}
            data-any-checked={selectedIds.length > 0 || undefined}
            style={{ height: bodyHeight }}
            onPointerDown={event => {
              if (event.button !== 0 || dragRef.current) return;
              const target = event.target as HTMLElement;
              if (target.closest("input, [role=listbox], button, [data-group-row]")) return;
              const fill = !!target.closest("[data-fill-handle]");
              const hit: HitCell | null = hitTest(event.clientX, event.clientY);
              if (!hit) return;
              if (event.pointerType === "touch" && !fill) {
                touchRef.current = { cell: hit, id: event.pointerId };
                return;
              }
              event.preventDefault();
              focusGrid();
              event.currentTarget.setPointerCapture(event.pointerId);
              if (hit.gutter) {
                setSelection(current =>
                  event.shiftKey
                    ? { anchor: { r: current.anchor.r, c: 0 }, focus: { r: hit.r, c: columnCount - 1 } }
                    : { anchor: { r: hit.r, c: 0 }, focus: { r: hit.r, c: columnCount - 1 } },
                );
              } else if (!fill) {
                setSelection(current =>
                  event.shiftKey ? { ...current, focus: { r: hit.r, c: hit.c } } : { anchor: { r: hit.r, c: hit.c }, focus: { r: hit.r, c: hit.c } },
                );
              }
              dragRef.current = {
                mode: fill ? "fill" : hit.gutter ? "rows" : "select",
                range: selectedRange,
                pointer: { x: event.clientX, y: event.clientY },
                frame: 0,
              };
              dragRef.current.frame = requestAnimationFrame(autoScroll);
            }}
            onPointerMove={event => {
              const drag = dragRef.current;
              if (!drag) return;
              drag.pointer = { x: event.clientX, y: event.clientY };
              extendDrag(event.clientX, event.clientY);
            }}
            onPointerUp={event => {
              const touch = touchRef.current;
              if (touch && touch.id === event.pointerId) {
                touchRef.current = null;
                const { cell } = touch;
                if (cell.gutter) {
                  selectRange({ r: cell.r, c: 0 }, { r: cell.r, c: columnCount - 1 });
                  return;
                }
                if (
                  anchorPos.r !== cell.r ||
                  anchorPos.c !== cell.c ||
                  selectedRange.r0 !== selectedRange.r1 ||
                  selectedRange.c0 !== selectedRange.c1 ||
                  editing
                ) {
                  setSelection({ anchor: { r: cell.r, c: cell.c }, focus: { r: cell.r, c: cell.c } });
                  focusGrid();
                } else beginEdit(cell);
                return;
              }
              finishFill();
            }}
            onPointerCancel={finishFill}
            onDoubleClick={event => {
              if ((event.target as HTMLElement).closest("input, button, [role=listbox], [data-fill-handle], [data-group-row]"))
                return;
              const hit = hitTest(event.clientX, event.clientY);
              if (hit && !hit.gutter) beginEdit({ r: hit.r, c: hit.c }, undefined, true);
            }}
          >
            {isLoading &&
              Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className={styles.row}
                  aria-hidden="true"
                  style={{ transform: `translateY(${index * rowH}px)`, width: geometry.total }}
                >
                  {rowSelection && <div className={styles.gutter} />}
                  {renderSlots(slots, columnWindow, (slot, _index, style) => (
                    <div
                      key={slot.column.key}
                      className={styles.cell}
                      data-num={slot.numeric || undefined}
                      data-pinned={slot.pinned || undefined}
                      data-pin-edge={slot.edge || undefined}
                      style={style}
                    >
                      <span
                        className={styles.skeleton}
                        style={{ width: `${40 + ((7 * index + slot.width) % 45)}%` }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            {!isLoading &&
              mountedLines.map(line => {
                const ariaRow = line + rowNumberOffset + 1;
                const y = line * rowH;
                const group = layout?.groupAt.get(line);
                if (group)
                  return (
                    <GroupRow
                      key={group.node.id}
                      node={group.node}
                      rows={group.rows}
                      y={y}
                      slots={slots}
                      win={columnWindow}
                      ariaRow={line + rowNumberOffset + 1}
                      gutter={rowSelection}
                      column={group.node.column}
                      collapsed={collapsed.has(group.node.id)}
                      onToggle={toggleCollapse}
                    />
                  );
                const rowIndex = layout ? layout.lineRow[line] ?? line : line;
                const row = rowAt(rowIndex);
                if (!row)
                  return (
                    <SkeletonRow key={`pending-${line}`} y={y} slots={slots} win={columnWindow} ariaRow={line + rowNumberOffset + 1} gutter={rowSelection} />
                  );
                const inRows = rowIndex >= selectedRange.r0 && rowIndex <= selectedRange.r1;
                return (
                  <GridRow
                    key={row.id}
                    row={row}
                    r={rowIndex}
                    y={y}
                    slots={slots}
                    win={columnWindow}
                    uid={uid}
                    ariaRow={line + rowNumberOffset + 1}
                    level={layout ? groupColumns.length + 1 : undefined}
                    gutter={rowSelection}
                    checked={selectedSet.has(row.id)}
                    inRows={inRows}
                    rangeC0={inRows ? selectedRange.c0 : -1}
                    rangeC1={inRows ? selectedRange.c1 : -1}
                    keepC={focusPos.r === rowIndex ? [focusPos.c] : []}
                    editingC={editing?.r === rowIndex ? editing.c : -1}
                    editor={editing?.r === rowIndex ? editorNode : null}
                    onToggle={toggleRow}
                  />
                );
              })}
            {!isLoading && gridHeight === 0 && (
              <div className={styles.empty} style={{ left: 0, width: viewport.w || "100%" }}>
                <p className={styles.emptyTitle}>{hasFilters ? "No rows match" : emptyMessage}</p>
                {hasFilters && (
                  <button type="button" className={styles.toolButton} onClick={clearAllFilters}>
                    <FilterX size={16} strokeWidth={1.75} aria-hidden="true" />
                    {"Clear filters"}
                  </button>
                )}
              </div>
            )}
            {rowCount > 0 && columnCount > 0 && (
              <>
                <RangeOverlay
                  className={styles.selection}
                  range={selectedRange}
                  geo={geometry}
                  rowH={rowH}
                  lineOf={lineOf ?? undefined}
                  scrollX={scrollX}
                  instant={!!editing}
                  data-editing={editing ? "" : undefined}
                >
                  {!editing && !readOnly && <span className={styles.fillHandle} data-fill-handle="" />}
                </RangeOverlay>
                <RangeOverlay
                  className={styles.activeCell}
                  range={rangeOf(anchorPos, anchorPos)}
                  geo={geometry}
                  rowH={rowH}
                  lineOf={lineOf ?? undefined}
                  scrollX={scrollX}
                  instant={!!editing}
                />
                {dragRange && (
                  <RangeOverlay
                    className={styles.fillPreview}
                    range={dragRange}
                    geo={geometry}
                    rowH={rowH}
                    lineOf={lineOf ?? undefined}
                    scrollX={scrollX}
                  />
                )}
                <AnimatePresence>
                  {wash && (
                    <motion.div
                      key={wash.n}
                      className={styles.washLayer}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: reduceMotion ? motionTokens.duration.standard : 0.9, ease: "easeOut" }}
                      onAnimationComplete={() => setWash(current => (current?.n === wash.n ? null : current))}
                    >
                      <RangeOverlay
                        className={styles.wash}
                        range={{
                          r0: clamp(wash.range.r0, 0, lastRow),
                          r1: clamp(wash.range.r1, 0, lastRow),
                          c0: clamp(wash.range.c0, 0, lastCol),
                          c1: clamp(wash.range.c1, 0, lastCol),
                        }}
                        geo={geometry}
                        rowH={rowH}
                        lineOf={lineOf ?? undefined}
                        scrollX={scrollX}
                        instant
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
          {totals && (
            <div role="rowgroup" className={styles.foot}>
              <div role="row" aria-rowindex={gridHeight + rowNumberOffset + 1} className={styles.totalsRow}>
                {rowSelection && <div role="gridcell" aria-colindex={1} className={styles.gutterHead} />}
                {renderSlots(slots, columnWindow, (slot, index, style) => {
                  const total = totalsLabels[index];
                  const label = index === 0 && total?.kind === "none";
                  const value = total?.value;
                  const scaled =
                    value != null
                      ? Math.abs(value) >= 1e9
                        ? { value: Math.round(value / 1e8) / 10, unit: "B", decimals: 1 }
                        : Math.abs(value) >= 1e6
                          ? { value: Math.round(value / 1e5) / 10, unit: "M", decimals: 1 }
                          : Math.abs(value) >= 1e5
                            ? { value: Math.round(value / 1e3), unit: "K", decimals: 0 }
                            : {
                                value: Math.round(10 * value) / 10,
                                unit: "",
                                decimals: Number(!Number.isInteger(Math.round(10 * value) / 10)),
                              }
                      : null;
                  const suffix = (scaled?.unit ?? "") + (slot.column.type === "percent" ? "%" : "");
                  return (
                    <div
                      key={slot.column.key}
                      role="gridcell"
                      aria-colindex={index + (rowSelection ? 2 : 1)}
                      className={styles.totalCell}
                      data-num={slot.numeric || undefined}
                      data-pinned={slot.pinned || undefined}
                      data-pin-edge={slot.edge || undefined}
                      style={style}
                      aria-label={
                        label
                          ? rowCountText
                          : scaled && total
                            ? `${slot.column.label} ${AGGREGATE_LABEL[total.kind].toLowerCase()} ${formatValue(
                                Math.round(100 * (value as number)) / 100,
                                {
                                  ...slot.column,
                                  decimals: slot.column.type === "percent" ? 1 : slot.column.decimals,
                                },
                              )}`
                            : undefined
                      }
                    >
                      {label ? (
                        <span className={styles.totalLabel}>{isLoading ? "Loading" : rowCountText}</span>
                      ) : (
                        scaled &&
                        total && (
                          <>
                            <span className={styles.totalLabel} aria-hidden="true">
                              {AGGREGATE_LABEL[total.kind]}
                            </span>
                            <span className={styles.totalValue} aria-hidden="true">
                              <AnimatedCounter
                                value={scaled.value}
                                decimals={scaled.decimals}
                                prefix={slot.column.type === "currency" ? "$" : ""}
                                suffix={suffix}
                              />
                            </span>
                          </>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.statusBar} data-stats={!selectionStats ? "off" : undefined}>
        {selectionStats && (
          <span
            className={styles.address}
            aria-label={rowCount ? `Selection ${columnLetter(selectedRange.c0)}${selectedRange.r0 + 1}` : undefined}
          >
            {rowCount
              ? `${columnLetter(selectedRange.c0)}${selectedRange.r0 + 1}${
                  selectedRange.r0 === selectedRange.r1 && selectedRange.c0 === selectedRange.c1
                    ? ""
                    : `:${columnLetter(selectedRange.c1)}${selectedRange.r1 + 1}`
                }`
              : "\u2013"}
          </span>
        )}
        {selectionStats && rowCount > 0 && (
          <span className={styles.stats}>
            {stats.count > 1 && (
              <>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Sum</span>
                  <span className={styles.statValue}>
                    <AnimatedCounter
                      value={Math.round(100 * stats.sum) / 100}
                      prefix={stats.prefix}
                      suffix={stats.suffix}
                      decimals={Number(!Number.isInteger(Math.round(100 * stats.sum) / 100)) * 2}
                    />
                  </span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Average</span>
                  <span className={styles.statValue}>
                    <AnimatedCounter
                      value={Math.round(10 * stats.avg) / 10}
                      prefix={stats.prefix}
                      suffix={stats.suffix}
                      decimals={Number(!Number.isInteger(Math.round(10 * stats.avg) / 10))}
                    />
                  </span>
                </span>
              </>
            )}
            <span className={styles.stat}>
              <span className={styles.statLabel}>Count</span>
              <span className={styles.statValue}>
                <AnimatedCounter value={stats.filled} />
              </span>
            </span>
          </span>
        )}
        <span className={styles.status}>
          <AnimatePresence initial={false}>
            {status && (
              <motion.span
                key={status.n}
                className={styles.statusText}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: motionTokens.duration.fast } }
                }
                transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.standard }}
              >
                <span aria-hidden="true">{status.text}</span>
                {status.action && (
                  <button
                    type="button"
                    className={styles.statusAction}
                    onClick={() => {
                      const run = status.action?.run;
                      setStatus(null);
                      run?.();
                    }}
                  >
                    {status.action.label}
                  </button>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default DataGrid;
