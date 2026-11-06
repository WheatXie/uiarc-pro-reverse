import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { getItem } from '@/registry'

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute top-3 right-3 z-10 rounded-md border border-line bg-white/90 px-2 py-1 text-[11.5px] text-ink-soft backdrop-blur hover:text-ink"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="scroll-thin max-h-[560px] overflow-auto rounded-xl border border-line bg-[#fafaf8] p-4 text-[12px] leading-[1.65]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }

function EyeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...iconProps}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" {...iconProps}>
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...iconProps}>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...iconProps}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
    </svg>
  )
}

function LaunchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...iconProps}>
      <path d="M14 5h5v5M19 5l-7.5 7.5" />
      <path d="M18.5 14.5v4a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V7.5A1.5 1.5 0 0 1 6 6h4" />
    </svg>
  )
}

export function ComponentPage() {
  const { slug = '' } = useParams()
  const item = getItem(slug)
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [file, setFile] = useState(0)

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-24">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-ink-soft">No component registered under “{slug}”.</p>
      </div>
    )
  }

  const { Demo } = item

  return (
    <div className="flex min-h-screen flex-col bg-white pb-4">
      <div className="px-8 pt-8">
        <div className="flex items-center gap-2 text-[12px] text-ink-faint">
          <span>Components</span>
          <span>/</span>
          <span className="text-ink-soft">{item.title}</span>
          {item.tier === 'pro' && (
            <span className="ml-1 rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-white">
              PRO
            </span>
          )}
        </div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em]">{item.title}</h1>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-6 text-ink-soft">{item.summary}</p>
      </div>

      <div className="mt-7 flex items-end justify-between gap-4 border-b border-line px-8">
        <div className="flex items-center gap-7">
          {(['preview', 'code'] as const).map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-[15px] capitalize transition-colors ${
                  active
                    ? 'border-ink font-semibold text-ink'
                    : 'border-transparent font-medium text-ink-faint hover:text-ink-soft'
                }`}
              >
                {t === 'preview' ? <EyeIcon /> : <CodeIcon />}
                {t === 'preview' ? 'Preview' : 'Code'}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 pb-2.5">
          <span className="text-[13.5px] text-ink-faint">Live · keyboard ready</span>
          <div className="flex items-center gap-1 rounded-[11px] border border-line bg-[#f4f4f2] p-[3px]">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <ExpandIcon />
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-[8px] text-ink-faint">
              <PanelIcon />
            </span>
          </div>
          <button className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-[#f4f4f2] hover:text-ink">
            <LaunchIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 px-7 pt-4">
        {tab === 'preview' ? (
          <div className="flex min-h-[calc(100vh-330px)] items-center justify-center rounded-[22px] border border-[#efefec] bg-[#f7f7f5] px-10 py-10">
            <Demo />
          </div>
        ) : (
          <div className="py-4">
            <div className="mb-2 flex flex-wrap gap-1">
              {item.files.map((f, i) => (
                <button
                  key={f.name}
                  onClick={() => setFile(i)}
                  className={`rounded-lg px-2.5 py-1 text-[12px] ${
                    file === i ? 'bg-[#efefec] text-ink' : 'text-ink-faint hover:text-ink-soft'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <CodeBlock code={item.files[file]?.code ?? ''} />
          </div>
        )}
      </div>
    </div>
  )
}
