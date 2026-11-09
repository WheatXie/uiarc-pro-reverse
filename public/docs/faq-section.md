# FAQ section

> FAQs as an accordion, a topic rail, or a searchable list that highlights matches.

- Type: Block
- Page: https://uiarc.dev/components/blocks/faq-section
- Markdown: https://uiarc.dev/components/blocks/faq-section/markdown

- Access: Free, open source
- Registry id: `faq-section`
- Source file: `registry/blocks/faq-section/faq-section.tsx`
- Built from: Motion
- Keywords: react faq section, faq accordion, searchable faq, faq with categories, frequently asked questions component

Use this as a starting point and replace the sample data with your own.

## When to use

- FAQ sections on pricing, product, and support pages.
- Long FAQs that benefit from categories or live search.

## When not to use

- Use accordion for generic collapsible content that is not a question list.
- Use a docs page when answers need code, images, or long structure.

## Installation

### CLI

Run one of these in a project set up with `shadcn init`:

```bash
npx shadcn@latest add @uiarc/faq-section
pnpm dlx shadcn@latest add @uiarc/faq-section
yarn dlx shadcn@latest add @uiarc/faq-section
bunx --bun shadcn@latest add @uiarc/faq-section
```

The `@uiarc` name needs `"registries": { "@uiarc": "https://uiarc.dev/r/{name}.json" }` in `components.json`. Without it, use the full URL:

```bash
npx shadcn@latest add https://uiarc.dev/r/faq-section.json
```

### Manual

1. Install the dependencies:

```bash
npm install motion lucide-react
```

2. Copy the source into your project. Main file: `registry/blocks/faq-section/faq-section.tsx`

   The source is in the registry item: https://uiarc.dev/r/faq-section.json

3. Arc imports use the `@/` alias for `registry/` and `lib/`. Keep the same folders or update the import paths.

## Usage

```tsx
import { FaqSection } from "@/components/arc/blocks/faq-section/faq-section";

export function PricingFaq() {
  return (
    <FaqSection
      variant="search"
      title="Questions about billing"
      items={[
        { question: "Can I cancel anytime?", answer: "Yes. Your plan stays active until the end of the billing period." },
        { question: "Do you offer refunds?", answer: "We refund annual plans within 14 days of purchase." },
      ]}
      contact={{ label: "Talk to billing", href: "mailto:billing@example.com" }}
    />
  );
}
```

## API reference

### FaqSection

An FAQ in three layouts: one centered accordion, questions grouped beside a category rail, or a list that filters as you type.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `"accordion" \| "columns" \| "search"` | `"accordion"` | Layout. |
| `title` | `string` | `"Frequently asked questions"` | Section heading. |
| `description` | `string` | – | One line under the heading. |
| `items` | `{ id?: string; question: string; answer: string; category?: string }[]` | `faqExampleItems` | Questions. answer is plain text and is what search matches. category groups the columns variant. |
| `multiple` | `boolean` | `false` | Allow several answers open at once. |
| `value` | `string[]` | – | Open item ids (controlled). Ids default to the question. |
| `defaultValue` | `string[]` | – | Initially open ids when uncontrolled. |
| `onValueChange` | `(value: string[]) => void` | – | Called when answers open or close. |
| `category` | `string` | – | Active category in the columns variant (controlled). |
| `onCategoryChange` | `(category: string) => void` | – | Called when the category changes. |
| `query` | `string` | – | Search text in the search variant (controlled). |
| `onQueryChange` | `(query: string) => void` | – | Called as the search text changes. |
| `contact` | `{ label: string; description?: string; href?: string; onClick?: () => void } \| null` | – | A way to reach a person when the answer isn't here. Pass null to hide it. |
| `className` | `string` | – | Extra class on the section. |

### FaqSectionBlock

Default export: a preview with a layout switcher.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `FaqSectionVariant` | `"accordion"` | Initial variant. |

## Keyboard interactions

| Keys | Action |
| --- | --- |
| ArrowUp / ArrowDown | Move between questions in one list. |
| Home / End | First or last question. |
| Enter / Space | Opens or closes the focused answer. |

## Accessibility

- Questions are buttons with aria-expanded controlling their answer region.
- Search matches are wrapped in mark elements; closed items that match only in the answer show a short excerpt.
- The search variant uses Arc SearchField with a real label.

## Motion

- Answers open with height and opacity together and the plus icon turns.
- Filtering and category changes move remaining items with layout animation.
- Reduced motion opens and filters instantly.

## Responsive behavior

- Container queries: below 760px the category rail becomes a horizontal scrolling row above the questions; below 480px padding tightens.

## Performance

- Search filters in memory on each keystroke; fine for dozens of items, not thousands.

## Notes for AI

- Keep answers plain text; the search variant matches and highlights inside them.
- Pass stable ids when questions may be reworded, so controlled open state survives edits.
- Composes Arc SearchField and SegmentedControl.

## Related

- [Accordion](https://uiarc.dev/components/accordion/markdown): Progressively reveal supporting information in place.
- [Search field](https://uiarc.dev/components/search-field/markdown): A recognizable search entry point with clear affordances.
- [Contact section](https://uiarc.dev/components/blocks/contact-section/markdown): A validated contact form that morphs into a confirmation, support channels, and office cards with local times.
- [Hero section](https://uiarc.dev/components/blocks/hero-section/markdown): Three full screen SaaS heroes: a live dashboard rising from the bottom edge over a drifting mesh, a workflow graph that routes sample events node by node, and editorial type over a mesh gradient.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
