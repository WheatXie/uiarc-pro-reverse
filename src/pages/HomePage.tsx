import { Link, useParams } from 'react-router-dom'
import { registry } from '@/registry'

export function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[980px] px-8 py-12">
      <p className="text-[12px] tracking-[0.14em] text-ink-faint uppercase">Component library</p>
      <h1 className="mt-3 max-w-[20ch] text-[40px] leading-[1.08] font-semibold tracking-[-0.03em]">
        Small parts, built to be lifted into your app.
      </h1>
      <p className="mt-4 max-w-[58ch] text-[14px] leading-6 text-ink-soft">
        Every entry ships the demo, the source and the data behind it. Copy a file, drop it in, keep the styling tokens.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3">
        {registry.map((r) => (
          <Link
            key={r.slug}
            to={`/components/${r.slug}`}
            className="group rounded-[16px] border border-line bg-white p-4 no-underline transition-shadow hover:shadow-[0_10px_30px_-14px_rgba(20,20,19,0.25)]"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-medium text-ink">{r.title}</span>
              <span className="ml-auto text-[11px] text-ink-faint group-hover:text-ink-soft">Open →</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-ink-soft">{r.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

const DOC_TITLES: Record<string, string> = {
  introduction: 'Introduction',
  installation: 'Installation',
  theming: 'Theming',
  motion: 'Motion',
  'ai-and-mcp': 'AI and MCP',
  changelog: 'Changelog',
}

export function DocsPage() {
  const { slug = 'introduction' } = useParams()
  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.02em]">{DOC_TITLES[slug] ?? slug}</h1>
      <div className="mt-6 space-y-4 text-[14px] leading-7 text-ink-soft">
        <p>
          This build is a local component workbench. Everything renders from source in this repository — no external
          registry, no runtime fetch.
        </p>
        {slug === 'installation' && (
          <pre className="scroll-thin overflow-auto rounded-xl border border-line bg-[#fafaf8] p-4 text-[12px] text-ink">
            <code>{`pnpm install
pnpm dev        # http://localhost:5183`}</code>
          </pre>
        )}
        {slug === 'theming' && (
          <p>
            Design tokens live in <code className="rounded bg-[#f2f2f0] px-1">src/index.css</code> under{' '}
            <code className="rounded bg-[#f2f2f0] px-1">@theme</code>: canvas, surface, line, ink, ink-soft, ink-faint.
          </p>
        )}
      </div>
    </div>
  )
}
