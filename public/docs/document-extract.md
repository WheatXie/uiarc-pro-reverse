# Document extraction

> Turns a document into typed data with a model and shows where every value came from: fields fill in as the page is read, and hovering a value lights its source on the PDF.

- Type: Block
- Page: https://uiarc.dev/components/blocks/document-extract
- Markdown: https://uiarc.dev/components/blocks/document-extract/markdown

- Access: Arc Pro
- Registry id: `document-extract`
- Source file: `registry/blocks/document-extract/document-extract.tsx`
- Built from: Button, Copy button, Tabs, Text shimmer, Tooltip
- Keywords: document extraction, structured output, invoice parsing, pdf viewer, data extraction, ocr, llm extraction, json schema, typed output, confidence, human review, source highlighting, citations, form filling, claude haiku

Pass a document, a schema and extract, which streams field values with their source boxes; onConfirm receives the checked data. With no props it extracts a sample invoice.

## When to use

- Accounts payable, logistics or back office tools that turn invoices, receipts, emails or forms into records a person accepts before saving.
- Any extraction flow where a reviewer needs to see exactly where each value came from and fix the few the model was unsure about.
- Demos and settings pages for a structured output feature, with the schema and live typed JSON one tab away.

## When not to use

- Use ai-answer for a written answer with citations rather than typed fields.
- Use knowledge-base to search and cite across many documents instead of reading one.
- Use ai-inline-edit to rewrite text in place rather than pull values out of it.
- Use agent-approvals when the decision is approving an agent's actions, not reviewing extracted values.

## Installation

Document extraction is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/document-extract
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { DocumentExtract, documentToText, invoiceSchema, toJsonSchema } from "@/components/arc/blocks/document-extract/document-extract";

export function InvoiceInbox({ document }) {
  return (
    <DocumentExtract
      document={document}
      schema={invoiceSchema}
      extract={async function* (doc, schema, { signal }) {
        // Your route sends documentToText(doc) and toJsonSchema(schema) to the model as structured output,
        // and streams back one line of JSON per value: { path, value, source, confidence, note }.
        const response = await fetch("/api/extract", {
          method: "POST",
          body: JSON.stringify({ text: documentToText(doc), schema: toJsonSchema(schema) }),
          signal,
        });
        const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) yield { type: "value", ...JSON.parse(line) };
        }
      }}
      onAccept={data => saveInvoice(data)}
    />
  );
}

// Mark the spans a value can cite, so the form can point back at them.
const document = {
  id: "inv-0418",
  name: "larkspur-invoice-0418.pdf",
  label: "Invoice",
  kind: "pdf",
  blocks: [
    { type: "masthead", logo: { name: "larkspur", detail: "studio", color: "#3d4fc4", symbol: "petals" }, title: "Invoice" },
    { type: "meta", items: [["Invoice no.", [{ span: "number", text: "INV-2026-0418" }]], ["Issue date", [{ span: "issue", text: "14 October 2026" }]]] },
  ],
};
```

## API reference

### DocumentExtract

Turns a document into typed data with a model and shows where every value came from. The document sits in a quiet PDF viewer: a slim toolbar with the file name, page count and zoom, and the page as a white A4 sheet (white in dark mode too, like paper) on a slightly darker canvas. An email renders as a message view. The schema's fields sit beside it as an editable form in color groups. Extract streams values in while one soft scan bar passes down the page and each cited span takes a faint tint in its group's color. Hovering, focusing or clicking a field or a span lights both ends and draws one curved connector between them in that color, with a single sheen along it. Low confidence values carry the model's reason and a Looks right button; edits update the JSON tab live. Accept all confirms every value with a short check cascade and hands the typed output to onAccept.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `document` | `SourceDocument` | – | The document to read: { id, name, label, kind?, meta?, blocks }. kind is "pdf" (an A4 sheet with a page count) or "email" (a message view), inferred from the file name when left out. Blocks are masthead (a text wordmark and title), email (subject, sender, recipient, date), heading, paragraph, lines (an address under a label), pairs, meta (a strip of label and value cells), columns, table (with optional detail lines), totals (the strong row sits on a double rule), rule and footer. Text is a string or an array of segments, where { span, text } marks a source span a value can cite. Without it the preview offers its two samples, an invoice and a shipping email. |
| `schema` | `ExtractSchema` | `invoiceSchema` | The fields to fill: { name, title, description?, groups?, fields }. A field is { key, label, type, description?, group? } with type string, date, money, currency, iban, integer or number; a table is { key, label, type: "table", group?, columns }. Each group in groups takes the next series color (--series-1 to --series-4) for its dot, rows, spans and connector; without groups each field takes its own. The Schema tab shows toJsonSchema(schema). |
| `samples` | `{ document: SourceDocument; schema: ExtractSchema }[]` | `sampleDocuments` | Several documents to switch between from a menu on the file name, each with its own schema. Ignored when document is set. |
| `extract` | `(document, schema, { signal }) => AsyncIterable<ExtractEvent> \| Promise<ExtractEvent[]>` | – | Your model call. Yield { type: "value", path, value, source?, confidence, note? } as values arrive, { type: "usage", inputTokens, outputTokens } for the cost readout, and { type: "error", message } or throw to show the failure state. Paths are field keys, or table.row.column for a cell such as lineItems.0.amount; source is the span id. Respect signal; Stop and Escape abort it. Without it the preview simulates the run and fails the first run of the shipping email so Retry can be tried. |
| `onAccept` | `(data: ExtractOutput, detail: { document, schema, values }) => void \| Promise<void>` | – | Called by Accept all after every value turns accepted. data has one key per schema field, typed: dates as YYYY-MM-DD strings, money and numbers as numbers, IBANs without spaces, tables as arrays of row objects. Accept all first asks to fix any value that does not fit its type. Throw to undo the accept. Without it the preview simulates the hand-off and says so. |
| `model` | `ExtractModel` | `{ name: "Claude Haiku 5.5", id: "claude-haiku-5-5", inputPrice: 0.1, outputPrice: 0.5 }` | The model named in the footer. Prices are US dollars per million tokens and drive the cost readout; id is named in the Schema tab. |
| `modelMark` | `ReactNode` | `Claude mark` | The model's mark in the footer. |
| `reviewThreshold` | `number` | `0.8` | Values with a confidence below this are flagged with a warning, show their reason, and count toward the to check summary. |
| `className` | `string` | – | Class on the root element. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Tab | Moves through the file menu, the zoom controls and Fit, the page canvas, the output tabs, Extract, each field and table cell, every Looks right button, Review and Accept all. |
| Focus a field | Selects it: the page scrolls to its source span, both ends light in the group's color and the connector draws between them. Tabbing through the form walks the document alongside. |
| Control or Command with = / - / 0 | With the page canvas focused, zooms in, zooms out, or fits the page to the width. |
| Arrow keys | Scroll the focused page canvas and the JSON blocks; on the output tabs and in the file menu they move the selection. |
| Escape | Stops a running extraction. Otherwise clears the selected field. |
| Enter, Space | Activates Extract, Stop, Retry, Review, Looks right, the zoom controls, Fit, the copy buttons and Accept all, and picks a document in the file menu. |

## Accessibility

- The run's state is announced through a polite status region: extracting, done with how many fields need a check, failed with the error, and stopped. Checking a value and accepting speak through a second polite region, including that the preview only simulates the hand-off.
- Confidence is a percent with an icon for every state that matters: a warning for low confidence, a check once checked or accepted, a pencil once edited. Spoken text reads the state and percent, and a flagged value's reason is tied to its input with aria-describedby.
- Every value is a real input with a label. Table cells are inputs inside a table role with column headers, and each cell's name includes its column, row and whether it needs a check.
- The viewer is a labeled region that announces its zoom; icon buttons have names and tooltips, and Fit reports its pressed state. The document switcher is a menu of radio items.
- The connector, the scan bar and the confidence bars are decorative and hidden from assistive technology; the linked field, its status text and the summary carry the same information.
- Values that do not fit their type, such as a date that is not YYYY-MM-DD or an IBAN whose check digits fail, show a message tied to the field, become null in the JSON, and block Accept all with a spoken reason.
- Pointer focus draws no ring; keyboard focus shows Arc's shared focus ring. Inputs show focus with their border.

## Motion

- The connector is one cubic Bezier that draws in over 220ms with round caps in the field's series color; a soft band of light travels along it once, then the line rests. Round anchors sit at both ends and the far one settles in as the line reaches it. It is measured on requestAnimationFrame while shown, so it follows scrolling, zoom and resizing without lag, and fades out in 120ms.
- While extracting, one thin bar of light with a soft trailing fade passes down the page once. Each cited span takes a brief stronger tint as its value lands, then rests at a faint tint; the field's text fades in.
- Zoom eases on the smooth spring around the middle of the canvas, so the point you are reading stays put.
- Accept all turns each field's status into a check with a short stagger and a crisp snappy pop, and the footer bars turn green in the same order.
- Table rows grow in on the smooth spring; reasons for flagged values open and close their height on the same spring. Status lines crossfade (out in 100ms, in over 160ms) inside a container that animates its height. Average confidence and cost roll on a short tween with tabular numerals.
- Reduced motion removes the scan bar, the draw, the sheen, the cascade, flashes and tweens. Selection, tints, the connector, labels and announcements stay, and zoom changes in one step.

## Responsive behavior

- The block caps at 1080px. From 760px of its own width the viewer and the form sit side by side, 600px tall, with the connector between them; the form keeps up to 436px.
- Below 760px the viewer stacks above the form with its own 330px canvas and the form scrolls in 430px below it. The connector hides there, since it would cross the form; the matching tints, the auto scroll to each source and a press on a span that brings its field into view carry the link.
- Fit keeps the A4 sheet at the canvas width, so on a phone the whole page shows and zoom brings the text up. Below 520px the page count and model name drop, field labels narrow, the line items table scrolls sideways inside its own box and Accept all takes the full width.
- The page, the form and the code tabs scroll inside their own panes, so the block never scrolls the page sideways.

## Performance

- Values arrive through one reducer; the form, links, output and JSON lines are derived with memoized maps keyed on the values object.
- Span hover is one delegated pointer listener on the page and one on each JSON block. Span flashes write a data attribute directly instead of re-rendering the document.
- Zoom writes the sheet's scale and size straight to the DOM on each animation frame, so the page never re-renders while it zooms.
- The connector runs one requestAnimationFrame loop only while a link shows, measures two rectangles per frame, and writes path attributes only when they change. The sheen moves three gradient stops; the scan bar is a single transform animation.
- Panes scroll themselves with scrollTo on their own element, never scrollIntoView, so the host page never jumps; the one exception is a press on a span in the stacked layout, which may bring its field into the window.

## Notes for AI

- Mark every value the model may cite as a span in the document data, and ask the model to return the span id as source. Without a source a value still fills its field but cannot be linked.
- Ask for a confidence between 0 and 1 and a short note for anything inferred rather than read, such as a due date worked out from payment terms. Notes appear under flagged values.
- Stream values in schema order so the form fills top to bottom. Emit usage events as the stream goes so cost rolls instead of jumping at the end.
- Keep display values as the document writes them (1,400.00, CH56 0483 ...); the block parses them into typed output with parseValue rules.
- Use toJsonSchema(schema) as the model's structured output format so the Schema tab shows exactly what was sent.
- Give the schema up to four groups so each gets its own series color; more groups repeat the colors.
- The preview is fully simulated: scripted values, usage and timing for the two samples, an overloaded_error on the first run of the shipping email, and a simulated hand-off on Accept all.

## Related

- [Knowledge base](https://uiarc.dev/components/blocks/knowledge-base/markdown): A retrieval knowledge base in one card: add sources and watch them parse, chunk, embed and index, then test a question and see which chunks come back and why.
- [AI answer](https://uiarc.dev/components/blocks/ai-answer/markdown): One AI answer set like a clean article: it thinks, shows its sources as small cards with colored marks, and streams a formatted answer where every citation lights the sentence it supports. Copy, regenerate with options, rate, share, page through versions and ask a related question in place.
- [Agent approvals](https://uiarc.dev/components/blocks/agent-approvals/markdown): One approval card for agents: the waiting tool call reads like a permission prompt with the tool's mark, the agent's reason and its arguments, and you approve, deny or allow it from now on.
- [Model picker](https://uiarc.dev/components/blocks/model-picker/markdown): A model picker in one quiet pill: open it to choose from featured models with a one line note each, set the reasoning effort, or browse every other model by provider, and the pill swaps to your choice in place.
- [Text shimmer](https://uiarc.dev/components/text-shimmer/markdown): Show ongoing work with a calm light across the words.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
