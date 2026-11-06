import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { counts, registry, type Tier } from '@/registry'

const DOC_LINKS = [
  { label: 'Introduction', to: '/docs/introduction' },
  { label: 'Installation', to: '/docs/installation' },
  { label: 'Theming', to: '/docs/theming' },
  { label: 'Motion', to: '/docs/motion' },
  { label: 'AI and MCP', to: '/docs/ai-and-mcp' },
  { label: 'Changelog', to: '/docs/changelog' },
]

type Filter = 'all' | 'free' | 'pro'

export function Sidebar() {
  const { pathname } = useLocation()
  const [filter, setFilter] = useState<Filter>('all')
  const [docsOpen, setDocsOpen] = useState(true)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const matchesTier = (tier: Tier) => filter === 'all' || filter === tier

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return registry.filter(
      (r) => matchesTier(r.tier) && (!term || r.title.toLowerCase().includes(term) || r.slug.includes(term)),
    )
  }, [filter, q])

  const group = (section: 'components' | 'blocks' | 'special') => visible.filter((r) => r.section === section)

  const total = (section: 'components' | 'blocks' | 'special') =>
    filter === 'all' ? counts[section] : registry.filter((r) => r.section === section && matchesTier(r.tier)).length

  const Section = ({
    title,
    section,
    icon,
    badge,
  }: {
    title: string
    section: 'components' | 'blocks' | 'special'
    icon: React.ReactNode
    badge?: string
  }) => {
    const rows = group(section)
    return (
      <div className="mt-1">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[13.5px] font-medium text-ink">
          <span className="grid h-5 w-5 place-items-center text-ink-soft">{icon}</span>
          <span>{title}</span>
          <span className="ml-auto text-[12.5px] font-normal text-ink-faint tabular-nums">
            {badge ? (
              <span className="rounded-md bg-[#f2f2f0] px-1.5 py-0.5 text-[11px]">{badge}</span>
            ) : (
              total(section)
            )}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        {rows.length > 0 && (
          <ul className="mb-2 space-y-0.5 border-l border-line pl-2 ml-[17px]">
            {rows.map((r) => (
              <li key={r.slug}>
                <Link
                  to={`/components/${r.slug}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] no-underline ${
                    pathname === `/components/${r.slug}`
                      ? 'bg-[#efefec] text-ink'
                      : 'text-ink-soft hover:bg-[#f5f5f3] hover:text-ink'
                  }`}
                >
                  <span className="truncate">{r.title}</span>
                  {r.tier === 'pro' && (
                    <span className="ml-auto rounded bg-ink px-1 py-px text-[9.5px] font-medium tracking-wide text-white">
                      PRO
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <aside className="flex h-screen w-[282px] shrink-0 flex-col border-r border-line bg-canvas">
      <div className="px-4 pt-4">
        <label className="flex h-9 items-center gap-2 rounded-[11px] border border-line bg-[#f4f4f2] px-3 focus-within:bg-white focus-within:border-line-strong">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-ink-faint">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[10.5px] text-ink-faint">⌘K</kbd>
        </label>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-1 rounded-[11px] border border-line bg-[#f4f4f2] p-0.5 text-[12.5px]">
          {(['all', 'free', 'pro'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-[9px] px-2 py-[5px] capitalize transition-colors ${
                filter === f ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.07)]' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
          <button className="flex items-center gap-1 rounded-[9px] px-2 py-[5px] text-ink-soft hover:text-ink">
            More
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="scroll-thin mt-3 flex-1 overflow-y-auto px-2 pb-10">
        <button
          onClick={() => setDocsOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-[13.5px] font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink-soft">
            <path d="M12 6.5C10.5 5.2 8.6 4.6 6 4.7c-.6 0-1 .4-1 1v11.6c0 .6.4 1 1 1 2.6 0 4.5.6 6 1.9 1.5-1.3 3.4-1.9 6-1.9.6 0 1-.4 1-1V5.7c0-.6-.4-1-1-1-2.6-.1-4.5.5-6 1.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M12 6.5v13" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Docs
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className={`ml-auto text-ink-faint transition-transform ${docsOpen ? '' : '-rotate-90'}`}
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {docsOpen && (
          <ul className="mb-2 ml-[17px] space-y-0.5 border-l border-line pl-2">
            {DOC_LINKS.map((d) => (
              <li key={d.to}>
                <Link
                  to={d.to}
                  className={`block rounded-md px-2 py-[5px] text-[13px] no-underline ${
                    pathname === d.to ? 'bg-[#efefec] text-ink' : 'text-ink-soft hover:bg-[#f5f5f3] hover:text-ink'
                  }`}
                >
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Section
          title="Components"
          section="components"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="16.5" cy="16.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          }
        />
        <Section
          title="Blocks"
          section="blocks"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 10h16M10 10v10" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          }
        />
        <Section
          title="Special components"
          section="special"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5 13.9 9l5.6.3-4.3 3.6 1.5 5.5L12 15.3 7.3 18.4l1.5-5.5L4.5 9.3 10.1 9 12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          }
        />
      </nav>

      <div className="border-t border-line px-4 py-3 text-[11.5px] text-ink-faint">
        uiarc clone · local build
      </div>
    </aside>
  )
}
