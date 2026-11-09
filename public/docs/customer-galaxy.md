# Customer galaxy

> 2,400 accounts as a drifting galaxy that spirals into clusters by plan, region or health.

- Type: Block
- Page: https://uiarc.dev/components/blocks/customer-galaxy
- Markdown: https://uiarc.dev/components/blocks/customer-galaxy/markdown

- Access: Arc Pro
- Registry id: `customer-galaxy`
- Source file: `registry/blocks/customer-galaxy/customer-galaxy.tsx`
- Keywords: react data galaxy, customer visualization, canvas particle clusters, zoomable scatter, account explorer, mrr visualization

Use this on a customer success or revenue page to explore where MRR and risk concentrate. Replace the seeded book in galaxy-data.ts with your accounts; clusters, totals and the side panel derive from it.

## When to use

- Customer success or revenue pages to explore where MRR and risk concentrate.
- Showcase views that cluster thousands of accounts by plan, region, or health.

## When not to use

- Use customers-table when people need to find and act on specific accounts.
- Use semantic-zoom for hierarchical data like teams and projects.
- Use bar-chart for simple totals by segment.

## Installation

Customer galaxy is part of Arc Pro. The live preview is public; the source and install command need Pro.

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
npx shadcn@latest add @uiarc-pro/customer-galaxy
```

### Manual

Signed-in Pro members can copy the source from the Manual tab on the docs page.

- Plans: https://uiarc.dev/pricing
- Create a Pro token: https://uiarc.dev/account#pro-access
- Setup guide: https://uiarc.dev/docs/ai#pro-access

## Usage

```tsx
import { CustomerGalaxy } from "@/components/arc/blocks/customer-galaxy/customer-galaxy";

export default function CustomerSuccessPage() {
  return (
    <section>
      <CustomerGalaxy />
    </section>
  );
}
```

## API reference

### CustomerGalaxy

A canvas galaxy of about 2,400 accounts sized by MRR that spirals into clusters by plan, region or health, with pan, zoom and a totals panel. Takes no props; accounts are sample data in galaxy-data.ts.

No props.

## Keyboard interactions

| Keys | Action |
| --- | --- |
| Arrow left / Arrow right | On the grouping tabs, switches grouping; on the stage, flies between clusters by MRR. |
| Arrow keys | Steps through accounts when a single cluster is in view. |
| + / - | Zooms in or out. |
| Escape | Clears the selected account, then resets the view. |
| 0 / Home | Fits all accounts. |

## Accessibility

- The stage is role="application" with a roledescription, a text summary label and a keyboard hint.
- Grouping uses a tablist and tabpanel; cluster rows are aria-pressed buttons with MRR and risk in their labels.
- Zoom buttons have labels, and a polite live region announces selections.

## Motion

- Accounts drift, then spiral into clusters with spring physics when grouping changes; flying to a cluster eases the camera.
- The tab pill slides with a shared layout spring, and panel rows reorder with layout animation.
- Reduced motion is passed to the engine, which snaps to layouts, and UI transitions become instant.

## Responsive behavior

- From an 880px container the totals panel sits beside the stage at 296px; below that it moves under it, and below 620px the stage is 440px tall.
- Touch uses pinch to zoom and double tap; the stage allows vertical page scroll until zoomed in.
- Mouse wheel zoom only takes over for ctrl or pinch gestures and mouse-like wheels, so trackpad scrolling still moves the page.

## Performance

- Renders about 2,400 accounts on a 2D canvas with devicePixelRatio capped at 2.
- The loop pauses offscreen via IntersectionObserver and in hidden tabs.

## Notes for AI

- Use on a customer success or revenue page to explore where MRR and risk concentrate.
- Replace the seeded accounts in galaxy-data.ts with your book, keeping plan, region, health and MRR fields.

## Related

- [Revenue globe](https://uiarc.dev/components/blocks/revenue-globe/markdown): A dotted globe where live payments arc home to headquarters, with a replayable day.
- [Semantic zoom](https://uiarc.dev/components/blocks/semantic-zoom/markdown): An infinite-zoom map of a company that reveals teams, projects, tasks and people as you fly in.
- [Cohort retention](https://uiarc.dev/components/blocks/cohort-retention/markdown): A cohort retention triangle that morphs into retention curves and rewashes by segment.

## Guidance for AI tools

Blocks are complete, self-contained screens with sample data. Replace the sample data and connect the callbacks described above. Follow the declared prop types and do not invent props. Keep keyboard access, reduced motion support, and both light and dark themes intact when adapting it.

Full library index: https://uiarc.dev/llms.txt
