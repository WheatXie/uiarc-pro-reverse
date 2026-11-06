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
    <div className="mx-auto w-full max-w-[980px] px-8 py-10">
      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        <span>Components</span>
        <span>/</span>
        <span className="text-ink-soft">{item.title}</span>
        {item.tier === 'pro' && (
          <span className="ml-1 rounded bg-ink px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-white">PRO</span>
        )}
      </div>

      <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em]">{item.title}</h1>
      <p className="mt-2 max-w-[62ch] text-[13.5px] leading-6 text-ink-soft">{item.summary}</p>

      <div className="mt-7 flex items-center gap-1 border-b border-line">
        {(['preview', 'code'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] capitalize ${
              tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto pb-2 text-[11.5px] text-ink-faint">{item.deps.join(' · ')}</div>
      </div>

      {tab === 'preview' ? (
        <div className="mt-5 grid place-items-center rounded-[16px] border border-line bg-[radial-gradient(circle_at_1px_1px,#ececea_1px,transparent_0)] bg-[length:16px_16px] bg-white p-10">
          <Demo />
        </div>
      ) : (
        <div className="mt-5">
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
  )
}
