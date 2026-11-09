# Invoice studio

> An editable invoice with live totals and a clear save flow.

- Type: Block
- Page: https://uiarc.dev/components/blocks/invoice-studio
- Markdown: https://uiarc.dev/components/blocks/invoice-studio/markdown

- Access: Arc Pro
- Registry id: `invoice-studio`
- Source file: `registry/blocks/invoice-studio/invoice-studio.tsx`
- Built from: Input, Button, Motion
- Keywords: react invoice editor, invoice generator ui, line items form, quote builder, invoice form with totals, billing invoice component

Use this as a starting point for creating an invoice. Persist line items and totals through your own service.

## When to use

- Creating or editing an invoice or quote with line items.
- Forms that need a live subtotal and total as quantities and rates change.

## When not to use

- Use billing-overview to show past invoices and plan status.
- Use checkout-flow when the customer is paying.
- Use sortable-data-table for read-only lists of invoices.

## Installation

Invoice studio is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/invoice-studio
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { InvoiceStudio, type InvoiceLine } from "@/components/arc/blocks/invoice-studio/invoice-studio";

export function NewInvoice() {
  async function save(lines: InvoiceLine[]) {
    await fetch("/api/invoices/draft", { method: "POST", body: JSON.stringify({ lines }) });
  }
  return <InvoiceStudio onSave={save} />;
}
```

## API reference

### InvoiceStudio

An editable invoice with line items, live subtotal and total, and a save draft action. Client details and starting lines are sample data.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onSave` | `(lines: InvoiceLine[]) => void \| Promise<void>` | – | Called with parsed lines when every line has a description. Awaited; a thrown error shows a save error. |

### InvoiceLine

Type passed to onSave.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `description` (required) | `string` | – | Line description. |
| `quantity` (required) | `number` | – | Quantity, clamped to zero or more. |
| `rate` (required) | `number` | – | Unit rate in USD. |

## Accessibility

- The total is an output element with aria-live and aria-atomic.
- Save progress and validation messages are announced via role="status".
- Row inputs and remove buttons carry per-line aria-labels.

## Motion

- Totals roll with a short vertical slide and blur when they change.
- Added and removed lines animate height via layout.
- Reduced motion uses opacity-only swaps with zero duration.

## Responsive behavior

- Below 760px line columns narrow; below 620px the column header hides and each line becomes a stacked card with its own labels.
- Below 380px the from and to parties stack into one column.

## Performance

- Totals recompute on each edit and roll with a short slide; line add and remove animate height with layout.
- Lines are not virtualized, which suits invoices with a few dozen lines.

## Notes for AI

- Use for creating or editing an invoice or quote.
- Replace startingLines and the client header; totals are USD only.
- Recompute totals on the server; treat onSave data as a draft.

## Related

- [Billing overview](https://uiarc.dev/components/blocks/billing-overview/markdown): A billing page where the plan card morphs into a picker and usage, invoices, and card follow.
- [Number field](https://uiarc.dev/components/number-field/markdown): Enter a bounded number with clear increment controls.
- [Sortable data table](https://uiarc.dev/components/sortable-data-table/markdown): Compare structured records with sortable columns.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
