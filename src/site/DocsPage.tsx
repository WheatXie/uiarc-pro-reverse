import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "./Layout";
import { docs } from "./catalog";
import { renderMarkdown } from "./markdown";
import styles from "./site.module.css";

const FALLBACK: Record<string, string> = {
  introduction:
    "## What Arc is\n\nArc is a component library — not a dependency. Every item resolves to a folder of source you can read, edit, and keep.\n\n## How the docs are organised\n\n- **Components** — single-purpose pieces, from a button to a data grid.\n- **Blocks** — composed sections, ready to drop into a page shell.\n- **Foundations** — tokens for colour, radius, shadow, and motion.\n\n## Install model\n\nItems are published to a shadcn-compatible registry. `npx shadcn@latest add @uiarc/<item>` writes the files into your repo, then you own them.",
  installation:
    "## Requirements\n\nReact 19, and `motion` for animated items.\n\n## Add an item\n\n```bash\nnpx shadcn@latest add @uiarc/button\n```\n\nPro items resolve through the Pro registry (`@uiarc-pro/<item>`) once the account has access. Every item is plain source: TypeScript plus a CSS module.",
  theming:
    "## Tokens\n\nEverything reads from CSS custom properties in `foundation.css`: surfaces, borders, text ramp, radii, shadows, and the accent pair.\n\n```css\n:root {\n  --background: oklch(100% 0 0);\n  --foreground: oklch(18% 0 0);\n  --accent: oklch(18% 0 0);\n}\n```\n\nDark mode flips the same variables under `.dark`.",
  motion:
    "## Motion tokens\n\nDurations and easings live in `motion-tokens.ts` so every transition shares the same cadence.\n\n```ts\nexport const duration = { fast: 0.14, base: 0.22, slow: 0.36 }\nexport const ease = [0.22, 1, 0.36, 1]\n```\n\nEvery animated component respects `useReducedMotion()`.",
  ai: "## Notes for AI\n\nEach docs page is available as markdown at `/components/<slug>/markdown`, and the whole library at `/llms.txt` and `/llms-full.txt`. Props tables, keyboard maps, and accessibility notes are all machine-readable.",
  changelog: "## What's new\n\n- Emoji picker — scroll-synced categories, skin tones, virtualized grid\n- Data grid — column resize, sort, and inline edit\n- Avatar upload — crop, zoom, and progress states",
};

export function DocsPage() {
  const { slug = "introduction" } = useParams();
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/docs/${slug}.md`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (!cancelled) setMarkdown(text || FALLBACK[slug] || "");
      })
      .catch(() => {
        if (!cancelled) setMarkdown(FALLBACK[slug] || "");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const parsed = useMemo(() => (markdown ? renderMarkdown(markdown) : null), [markdown]);
  const title = docs.find((doc) => doc.slug === slug)?.title ?? slug;

  return (
    <Layout
      rail={
        parsed?.toc.length ? (
          <>
            <p className={styles.railTitle}>On this page</p>
            {parsed.toc.map((entry) => (
              <a key={entry.id} href={`#${entry.id}`} className={styles.railLink}>
                {entry.text}
              </a>
            ))}
          </>
        ) : undefined
      }
    >
      <div className={styles.crumbs}>
        <Link to="/">Docs</Link>
        <span aria-hidden="true">›</span>
        <span>{title}</span>
      </div>
      <h1 className={styles.h1}>{title}</h1>
      <div className={styles.prose}>{parsed ? parsed.node : <p>Loading…</p>}</div>
    </Layout>
  );
}
