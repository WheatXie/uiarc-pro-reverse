# Data grid

> A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting.

- Type: Component (data)
- Access: Arc Pro
- Page: https://uiarc.dev/components/data-grid
- Markdown: https://uiarc.dev/components/data-grid/markdown
- Source file: `registry/components/data-grid/data-grid.tsx`
- Dependencies: motion, lucide-react, @radix-ui/react-dropdown-menu, @radix-ui/react-popover
- Keywords: data, table, spreadsheet, editing, react data grid, spreadsheet component, editable table, excel like grid, inline cell editing, copy paste from excel, fill handle, virtualized table, pinned columns, column filters

## When to use

- Editing many values in place like a spreadsheet, such as budgets, price lists, or inventory.
- Data people move to and from Excel or Google Sheets with copy and paste.
- Work that needs range selection, a fill handle, fill down, and undo.
- Large tables, up to tens of thousands of rows, that people filter, sort, group with subtotals, and total.
- Server data too large to send at once, loaded in blocks as people scroll through a dataSource.
- Finance tables with many period columns, date columns, and exports people open in Excel.
- Bulk work on checked rows: copy, CSV export, delete, or your own actions.

## When not to use

- Use sortable-data-table for read-only records with sorting and row selection.
- Use a form when people edit one record at a time.
- Use a card list or card grid when each record needs rich content like images or long text.

## Installation

Data grid is part of Arc Pro. The live preview is public; the source and install command need Pro.

### CLI with a Pro token

1. Create a token in your account and set it in the environment (or `.env.local`). Never commit it.

```bash
export ARC_PRO_TOKEN=arc_pro_...
```

2. Add the Pro registry to `components.json`:

```json
{
  "registries": {
    "@uiarc": "https://uiarc.dev/r/{name}.json",
    "@uiarc-pro": {
      "url": "https://uiarc.dev/r/pro/{name}.json",
      "headers": {
        "Authorization": "Bearer ${ARC_PRO_TOKEN}"
      }
    }
  }
}
```

3. Install:

```bash
npx shadcn@latest add @uiarc-pro/data-grid
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { useState } from "react";
import { Archive } from "lucide-react";
import { DataGrid, type DataGridColumn, type DataGridRow, type DataGridSort } from "@/components/arc/data-grid/data-grid";

const columns: DataGridColumn[] = [
  { key: "item", label: "Item", width: 180, pinned: true },
  { key: "status", label: "Status", type: "select", options: ["Planned", "Active", "Done"] },
  { key: "q1", label: "Q1", type: "currency" },
  { key: "q2", label: "Q2", type: "currency" },
  { key: "margin", label: "Margin", type: "percent", decimals: 1, editable: false },
  { key: "notes", label: "Notes", hidden: true, aggregate: "count" },
];

export function Budget() {
  const [rows, setRows] = useState<DataGridRow[]>([
    { id: "r1", item: "Design", status: "Active", q1: 12000, q2: 14500, margin: 32.5, notes: "" },
    { id: "r2", item: "Hosting", status: "Planned", q1: 3200, q2: 3400, margin: 18, notes: "Annual plan" },
  ]);
  const [sort, setSort] = useState<DataGridSort[]>([{ key: "q1", dir: "desc" }]);
  return (
    <DataGrid
      label="Budget"
      columns={columns}
      rows={rows}
      onRowsChange={setRows}
      sort={sort}
      onSortChange={setSort}
      maxHeight={480}
      exportFileName="budget-2026"
      bulkActions={[{ label: "Archive", icon: <Archive size={16} aria-hidden />, onAction: checked => console.log(checked.map(r => r.id)) }]}
    />
  );
}
```

## API reference

### DataGrid

A spreadsheet grid for editing tabular data in place. It has range selection, a fill handle, Excel and Sheets clipboard, undo, multi-column sort, a filter row, pinned and hidden columns, row checks with bulk actions, a totals row, and virtualized rows. Every piece of view state works controlled or uncontrolled.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `columns` (required) | `DataGridColumn[]` | – | Column definitions in definition order. Pinned columns are drawn first. |
| `label` (required) | `string` | – | Accessible name for the grid. Also names the exported CSV file. |
| `rows` | `DataGridRow[]` | – | Controlled rows. Pair with onRowsChange. |
| `defaultRows` | `DataGridRow[]` | – | Starting rows when uncontrolled. |
| `onRowsChange` | `(rows: DataGridRow[]) => void` | – | Called with the full row list after every edit, fill, paste, cut, clear, delete, undo, or redo. |
| `maxHeight` | `number` | `400` | Tallest the scrolling area grows before it scrolls, in px. |
| `sort` | `DataGridSort[]` | – | Controlled sort keys in priority order. |
| `defaultSort` | `DataGridSort[]` | `[]` | Starting sort keys when uncontrolled. |
| `onSortChange` | `(sort: DataGridSort[]) => void` | – | Called when a header click, Shift-click, or header menu changes the sort. |
| `filters` | `DataGridFilters` | – | Controlled column filters, keyed by column key. |
| `defaultFilters` | `DataGridFilters` | `{}` | Starting filters when uncontrolled. The filter row starts open when any filter is set. |
| `onFiltersChange` | `(filters: DataGridFilters) => void` | – | Called when a filter changes or all filters are cleared. |
| `selectedRowIds` | `string[]` | – | Controlled checked row ids. |
| `defaultSelectedRowIds` | `string[]` | `[]` | Starting checked row ids when uncontrolled. |
| `onSelectedRowIdsChange` | `(ids: string[]) => void` | – | Called with checked ids in data order. |
| `hiddenColumns` | `string[]` | – | Controlled hidden column keys. |
| `defaultHiddenColumns` | `string[]` | – | Starting hidden keys. Defaults to columns with hidden: true. |
| `onHiddenColumnsChange` | `(keys: string[]) => void` | – | Called when the columns menu or a header menu hides or shows a column. |
| `pinnedColumns` | `string[]` | – | Controlled pinned column keys. |
| `defaultPinnedColumns` | `string[]` | – | Starting pinned keys. Defaults to columns with pinned: true, or the first column when no column sets pinned. |
| `onPinnedColumnsChange` | `(keys: string[]) => void` | – | Called when a header menu pins or unpins a column. |
| `density` | `"compact" \| "standard" \| "comfortable"` | – | Controlled row density: 32, 40, or 48px rows. |
| `defaultDensity` | `"compact" \| "standard" \| "comfortable"` | `"standard"` | Starting density when uncontrolled. |
| `onDensityChange` | `(density: DataGridDensity) => void` | – | Called when the density menu changes. |
| `rowSelection` | `boolean` | `true` | Shows the row gutter with row numbers and checkboxes. |
| `rowNumbers` | `boolean` | `true` | Shows the row number in the gutter. When false the gutter narrows to 40px and its checkboxes always show. With rowSelection off there is no gutter either way. |
| `selectionStats` | `boolean` | `true` | Shows the active cell address and the Count, Sum, and Average of the selected cells in the status bar. Status messages, such as Undo after a delete, show either way. |
| `toolbar` | `boolean` | `true` | Shows the toolbar with search, undo and redo, filters, columns, density, and export. |
| `totals` | `boolean` | `true` | Shows the sticky totals row. It always covers every row the filters keep, including rows inside collapsed groups. |
| `groupBy` | `string[]` | – | Controlled group-by column keys, outermost first. Each group row shows a toggle, its value and row count, and a subtotal under every column whose aggregate is not none. |
| `defaultGroupBy` | `string[]` | `[]` | Starting group-by keys when uncontrolled. |
| `onGroupByChange` | `(keys: string[]) => void` | – | Called when a header menu starts or stops grouping by a column. |
| `exportFormats` | `("csv" \| "xlsx")[]` | `["csv"]` | Formats Export offers. With more than one, Export opens a menu. xlsx keeps number, currency, percent, and date formats, column widths, a frozen header and pinned columns, bold totals, and groups as outlined rows with SUBTOTAL formulas. |
| `dataSource` | `DataGridDataSource` | – | Loads rows from a server one block at a time as people scroll, instead of rows. Sort, filters, and search are sent with each request. Keep it stable with useMemo. A grid with a data source is read only, does not group, hides select all, and exports only checked rows. |
| `bulkActions` | `DataGridBulkAction[]` | – | Extra actions for checked rows, shown between Export and Delete. |
| `canDeleteRows` | `boolean` | `true` | Shows Delete for checked rows. Deleting can be undone. |
| `exportFileName` | `string` | – | Export file name without the extension. Defaults to a slug of label. |
| `loading` | `boolean` | `false` | Shows six placeholder rows and sets aria-busy. |
| `emptyMessage` | `string` | `"No rows yet"` | Shown when there are no rows at all. Filtered-out rows show "No rows match" with Clear filters. |

### DataGridColumn

One column definition.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `key` (required) | `string` | – | Row field this column reads and writes. |
| `label` (required) | `string` | – | Header text. Also used in CSV and copied headers. |
| `width` | `number` | `140` | Starting width in px. The last column absorbs spare width on a wide grid. |
| `minWidth` | `number` | `72` | Narrowest a resize can reach. Resizing stops at 560px. |
| `type` | `"text" \| "number" \| "currency" \| "percent" \| "select" \| "date"` | `"text"` | Number, currency, and percent align right, parse typed numbers, and total in the footer. Select picks from options. Date stores an ISO day string such as "2026-01-31", shows it formatted, edits with a calendar, and refuses text that is not a real day. |
| `dateFormat` | `Intl.DateTimeFormatOptions` | `{ month: "short", day: "numeric", year: "numeric" }` | How a date column shows its days, in en-US and UTC so a day never shifts with the time zone. |
| `decimals` | `number` | `0` | Decimal places when formatting numeric values. |
| `editable` | `boolean` | `true` | false makes the column read only. Edits, pastes, fills, and clears skip it. |
| `options` | `string[]` | – | Choices for a select column. Defaults to the distinct values already in the column. Also sets the sort order. |
| `pinned` | `boolean` | – | Starts pinned to the left edge. When no column sets this, the first column is pinned. |
| `hidden` | `boolean` | – | Starts hidden. People can show it again from the columns menu. |
| `aggregate` | `"sum" \| "average" \| "min" \| "max" \| "count" \| "none"` | – | What the totals row shows. Defaults to sum for number and currency, average for percent, none otherwise. |
| `sortable` | `boolean` | `true` | false disables the header sort button and the sort menu items. |
| `filterable` | `boolean` | `true` | false leaves the filter cell empty and drops Filter from the header menu. |
| `groupable` | `boolean` | – | Offers Group by in the header menu. Defaults to true for text, select, and date columns and false for numeric ones. |

### DataGridBulkAction

An extra toolbar action for checked rows.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` (required) | `string` | – | Button text. Also the React key, so keep it unique. |
| `icon` | `ReactNode` | – | Icon before the label. The label hides below 640px of grid width. |
| `tone` | `"danger"` | – | Draws the button in the danger color. |
| `onAction` (required) | `(rows: DataGridRow[]) => void` | – | Receives the checked rows in data order. |

### DataGridDataSource

Server rows for DataGrid. The grid asks for the blocks that cover the rows in view, keeps up to 40 blocks, and starts over when sort, filters, or search change.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `getRows` (required) | `(request: DataGridRowsRequest) => Promise<DataGridRowsResult>` | – | Returns one block. request has start (inclusive), end (exclusive), sort, filters, search, and an AbortSignal that fires when the query changes. Resolve with rows, rowCount for the whole filtered set, and optional totals keyed by column key. |
| `blockSize` | `number` | `100` | Rows per request. |

### Types

Exported from data-grid.tsx.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `DataGridValue` | `string \| number \| null` | – | A cell value. Empty number cells store null. |
| `DataGridRow` | `{ id: string; [key: string]: DataGridValue }` | – | A row. id must be unique and stable. |
| `DataGridSort` | `{ key: string; dir: "asc" \| "desc" }` | – | One sort key. |
| `DataGridFilters` | `Record<string, string \| string[]>` | – | Text and number columns take a query string. Select columns take the list of values to keep. |
| `DataGridColumnType` | `"text" \| "number" \| "currency" \| "percent" \| "select" \| "date"` | – | Column type. |
| `DataGridRowsRequest` | `{ start: number; end: number; sort: DataGridSort[]; filters: DataGridFilters; search: string; signal: AbortSignal }` | – | What a data source is asked for. |
| `DataGridRowsResult` | `{ rows: DataGridRow[]; rowCount: number; totals?: Record<string, number \| null> }` | – | What a data source returns for one block. |
| `DataGridExportFormat` | `"csv" \| "xlsx"` | – | An export format. |
| `DataGridExportNode` | `DataGridRow \| { label: string; children: DataGridExportNode[] }` | – | A row or a group of rows for toXlsx. |
| `DataGridAggregate` | `"sum" \| "average" \| "min" \| "max" \| "count" \| "none"` | – | Totals row aggregate. |
| `DataGridDensity` | `"compact" \| "standard" \| "comfortable"` | – | Row density. |
| `DataGridProps` | `interface` | – | Props of DataGrid. |

### data-grid-model helpers

Pure functions exported from data-grid-model.ts, usable on the server or in tests.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | `(value: DataGridValue \| undefined, column: DataGridColumn) => string` | – | Display text: en-US grouping, $ for currency, % for percent, a true minus sign for negatives. |
| `parse` | `(text: string, column: DataGridColumn, options?: string[]) => { ok: true; value: DataGridValue } \| { ok: false }` | – | Reads typed or pasted text. Numbers accept $, %, commas, spaces, and accounting parentheses. Select values match options without case. |
| `parseDay / formatDay / isIsoDay` | `(text: string) => string \| null / (iso: string, options?) => string / (value: unknown) => boolean` | – | Date helpers. parseDay reads 2026-01-31, 2026/1/31, Jan 31 2026, or 31 January 2026 and refuses all-number forms like 01/02/2026, which read differently by country. |
| `dateFilter` | `(expression: string) => ((iso: string) => boolean) \| null \| "invalid"` | – | Parses a day, month (2026-03), or year (2026) with > >= < <= = !=, or a range like 2026-01-01..2026-03-31. |
| `toXlsx` | `(columns: DataGridColumn[], nodes: DataGridExportNode[], options?: DataGridXlsxOptions) => Uint8Array` | – | From data-grid-xlsx.ts. Writes an .xlsx workbook with no dependencies. options: sheetName, freezeColumns, totals, widths. Files are stored without compression. |
| `numberFilter` | `(expression: string) => ((value: number) => boolean) \| null \| "invalid"` | – | Parses >100, >=100, <5, !=0, =12, 12, or a range like 10..50. |
| `rowMatcher` | `(columns, filters, search, searchColumns?) => ((row: DataGridRow) => boolean) \| null` | – | One predicate for all filters and the quick search. |
| `sortRows` | `(rows: DataGridRow[], sort: DataGridSort[], columns: DataGridColumn[]) => DataGridRow[]` | – | Stable multi-key sort. Empty cells sink to the bottom either way. |
| `aggregate / defaultAggregate` | `(rows, column, kind) => number \| null / (column) => DataGridAggregate` | – | The totals row math and its default per column type. |
| `toTsv / parseTsv / toHtml / parseHtmlTable` | `(matrix: string[][]) => string / (text: string) => string[][] / ...` | – | Clipboard formats that match Excel and Google Sheets, including quoted cells with tabs or line breaks. |
| `toCsv` | `(columns: DataGridColumn[], rows: DataGridRow[]) => string` | – | RFC 4180 CSV with a byte order mark so Excel reads UTF-8. |
| `extend` | `(source: DataGridValue[], count: number, forward: boolean, type?: DataGridColumnType) => DataGridValue[]` | – | Fill handle values. An evenly spaced number run continues its series. In a date column, days continue by days, or by months when they share a day of the month or are all month ends. Anything else repeats. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow keys | Move the active cell. |
| Shift + arrows | Extend the range from the active cell. |
| Cmd/Ctrl + arrows | Jump to the first or last row or column. Add Shift to extend the range. |
| Home / End | Move to the first or last column in the row. |
| Cmd/Ctrl + Home / End | Move to the first or last cell of the grid. |
| PageUp / PageDown | Move by one visible page of rows. |
| Cmd/Ctrl + A | Select every cell. |
| Ctrl + Space | Extend the range to the whole of its columns. |
| Shift + Space | Check or uncheck the rows in the range. Needs rowSelection. |
| Enter / F2 | Edit the active cell, keeping its value. Arrow keys then move the caret. |
| Any character | Start editing and replace the value. Arrow keys then commit and move, like Excel. |
| Alt + ArrowDown | On a select cell, open its option list. |
| Enter / Shift + Enter (editing) | Commit and move down or up. An invalid value stays open and is marked. |
| Tab / Shift + Tab (editing) | Commit and move right or left. |
| ArrowUp / ArrowDown (option list) | Move through select options. Enter or Tab picks the highlighted one. |
| Alt + ArrowDown (date editing) | Open the calendar and move focus into it. Arrow keys pick a day, Enter saves it, Escape returns to the text. |
| Escape (editing) | Close the option list or calendar, or cancel the edit. |
| Escape | Collapse the range to the active cell, or else clear checked rows. |
| Delete / Backspace | Clear the range. Read-only cells are skipped. |
| Cmd/Ctrl + D | Fill down: copy the top row of the range into the rows below. |
| Cmd/Ctrl + C / X / V | Copy, cut, or paste. Works with Excel, Google Sheets, and Numbers. |
| Cmd/Ctrl + Z | Undo. |
| Cmd/Ctrl + Shift + Z / Cmd/Ctrl + Y | Redo. |
| Shift + click header | Add the column as the next sort key. Plain click cycles ascending, descending, off. |
| Alt + ArrowLeft / ArrowRight (header) | Narrow or widen the column by 16px. |
| Enter / ArrowDown (search or filter input) | Return focus to the grid. |
| Escape (search or filter input) | Clear the input, or return to the grid when it is empty. |

## Accessibility

- The grid is one focusable role="grid" with aria-multiselectable, aria-rowcount, aria-colcount, and aria-busy while loading. The active cell is exposed through aria-activedescendant, not moving focus.
- Rows and cells carry aria-rowindex and aria-colindex, so counts stay right while rows are virtualized. The active and editing rows stay mounted when scrolled away.
- Cells report aria-selected and aria-readonly. Rows report aria-selected when checked.
- Headers are role="columnheader" with aria-sort. The sort button label names the direction, the sort priority, and the Alt + arrow resize keys.
- The cell editor is labelled by column and row name and sets aria-invalid on a bad value. On select columns it is a combobox that controls a listbox, with aria-activedescendant on the highlighted option.
- Row checkboxes are role="checkbox" and stay out of the tab order; the select-all box in the header is tabbable and shows a mixed state.
- Number filter inputs describe their syntax and set aria-invalid on an unreadable expression. Select filters open a labelled checklist.
- Edits, sorts, checks, copies, pastes, fills, undo, and redo are announced in a polite live region. The row count is also a polite live region.
- Totals cells carry a full aria-label, such as "Q1 sum $15,200".
- With groupBy the grid becomes role="treegrid". Group rows carry aria-level and aria-expanded, their toggle is a button that names the group, row count, and action, and subtotal cells carry full labels. Data rows carry aria-level too.
- The date editor is a combobox with a dialog popup. The calendar opens in a portal so the grid never clips it, and focus returns to the cell when it closes.
- Scrolling columns outside the view are not rendered, but every cell keeps its aria-colindex, and the active and editing cells stay mounted.
- With a data source, rows still loading render as placeholder rows with aria-busy.

## Motion

- The selection rectangle and active cell spring between ranges on motionTokens.spring.snappy. Scrolling moves them at once, and resizing a column snaps them.
- After a sort, rows slide to their new place on the spring curve for 700ms, and rows arriving from off screen fade in.
- Pasted, filled, undone, and redone cells flash a wash that fades out over 0.9s.
- The toolbar swaps to bulk actions with a short slide, fade, and blur. Status messages enter the same way.
- Totals, the selection summary, and the checked count roll with animated-counter.
- An invalid edit shakes once. Menus and the option list fade and scale in from their anchor.
- A group's chevron turns on the spring curve as it opens and closes.
- Reduced motion jumps the selection, drops the row slide, the shake, the press scales, the chevron turn, and the skeleton pulse, and keeps short fades.

## Responsive behavior

- The grid scrolls in both directions inside maxHeight. The header and totals row stay sticky, and pinned columns and the row gutter stay on the left.
- Pinned columns are scaled down to about half of the grid width so a narrow grid still shows scrolling columns.
- Layout reacts to the grid's own width with container queries. Below 640px toolbar buttons become icons. Below 460px the row count and undo and redo buttons hide. Below 480px the status message wraps to its own line.
- On touch a pan scrolls the grid. A tap selects a cell on release, a second tap edits it, and only the fill handle takes over a touch drag.
- Row checkboxes and header menu buttons are always visible on devices without hover.

## Performance

- Rows are virtualized: only the visible rows plus 6 above and below render, each positioned with translateY. Rows are memoized, so scrolling and typing re-render only the rows they touch.
- Filters and search use useDeferredValue, so typing a filter stays responsive on large data.
- The sorted and filtered view is recomputed only when sort, filters, search, visible columns, or the set of row ids change, not on every edit.
- Select column options are derived from up to 200 distinct values when options is not given; pass options for large or wide data.
- Columns are virtualized too: pinned columns always render, and scrolling columns render only within about 240px of the view, updated every 64px of horizontal scroll.
- Group rows are computed with the view, not on every edit, so an edited row stays in its group until the next sort, filter, or grouping change. Subtotals update at once.
- A dataSource keeps up to 40 blocks and aborts requests that a sort, filter, or search change makes stale. Undo holds up to 100 full row snapshots.

## Notes for AI

- Choose it when people edit many values in place like a spreadsheet. Use sortable-data-table for read-only records. For rows that roll up under a shared value, such as journal lines by account and period, use groupBy.
- Every row needs a unique, stable id. Column keys map to row fields. Keep rows from onRowsChange to persist edits.
- Use number, currency, or percent for numeric data so parsing, right alignment, totals, and the status bar sum work. Store raw numbers, not formatted strings.
- Mark computed or locked columns editable: false. Give select columns options so pasted and typed values are checked against them.
- Copy writes tab separated text plus an HTML table with formatted values, so Excel and Sheets read typed numbers. Paste reads an HTML table first, then TSV with quoted cells. A selection that is a whole multiple of the clipboard is tiled; values that do not parse are skipped and reported.
- The bulk Copy button copies checked rows with a header row through navigator.clipboard, and Export downloads CSV of checked rows. The toolbar Export downloads all filtered rows in view order.
- A sort reorders once, like a spreadsheet. Editing a value does not re-sort or re-filter, so rows never jump under the cursor.
- Undo keeps 100 steps and covers edits, fills, pastes, clears, and row deletes. Sort, filter, and column changes are view state and are not undone.
- Text filters match accent-insensitive substrings; prefix = for an exact match or ! to exclude. The quick search matches every word across visible columns.
- Filtering, sorting, and grouping run on the client over the rows you pass. For data too large to send at once, pass a dataSource: the grid asks for blocks of rows as people scroll and sends sort, filters, and search with each request.
- Use a date column for days. Values stay ISO day strings, so they round-trip with no time zone shift; sort and filter compare them as days, and the fill handle continues a daily or monthly series.
- Grouping reuses each column's aggregate for its subtotals, so one setting drives the group rows and the totals row. A grouped .xlsx export writes SUBTOTAL formulas, so Excel never counts a subtotal twice.
- For a small form table, turn off rowNumbers when rows already carry their own number, and selectionStats when the address and counts mean nothing to the reader.

## Related

- [Sortable data table](https://uiarc.dev/components/sortable-data-table/markdown): Compare structured records with sortable columns.
- [Filter toolbar](https://uiarc.dev/components/filter-toolbar/markdown): Keep collection filters close and easy to reset.
- [Date picker](https://uiarc.dev/components/date-picker/markdown): Choose a date without losing context.
- [Animated counter](https://uiarc.dev/components/animated-counter/markdown): Give changing totals a clear sense of movement.
- [Pagination](https://uiarc.dev/components/pagination/markdown): Move through a long collection with clear bounds.

## Also in advanced charts

- [Sunburst](https://uiarc.dev/components/sunburst/markdown): A hierarchy in rings: click a segment and every arc swings around it as the new centre, with a breadcrumb back and a rolling total.
- [Sankey flow](https://uiarc.dev/components/sankey-flow/markdown): Flows between stages as ribbons with drifting particles; hover any node or ribbon to pour its share through the whole journey.
- [Funnel chart](https://uiarc.dev/components/funnel-chart/markdown): A tapered conversion funnel with drop-off at every step, a device split that morphs the band, and dots that stream through it.
- [Radar chart](https://uiarc.dev/components/radar-chart/markdown): Two or three profiles on one web: shapes morph when you swap a profile, and a sweep across the axes compares values in place.
- [Realtime stream](https://uiarc.dev/components/realtime-stream/markdown): A live line that scrolls at 60fps as readings arrive, holds still on hover to read, and pops a marker on every anomaly.
- [Race bar chart](https://uiarc.dev/components/race-bar-chart/markdown): A ranking over time: bars overtake each other on springs, values count up, and a timeline you can play or scrub.

## Guidance for AI tools

Data grid: A spreadsheet grid with range selection, inline editing, a fill handle, and animated sorting. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
