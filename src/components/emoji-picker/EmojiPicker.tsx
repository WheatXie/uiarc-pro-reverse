import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMOJI_GROUPS,
  SKIN_TONES,
  applyTone,
  findEmoji,
  searchEmojis,
  type EmojiEntry,
  type SkinToneId,
} from './emoji-data'
import { useRecentEmojis } from './hooks'

export type EmojiPickerProps = {
  onSelect?: (char: string, entry?: EmojiEntry) => void
  width?: number
  height?: number
  columns?: number
  className?: string
  autoFocus?: boolean
}

const RECENT_SLUG = 'recent'

export function EmojiPicker({
  onSelect,
  width = 336,
  height = 380,
  columns = 9,
  className = '',
  autoFocus = true,
}: EmojiPickerProps) {
  const [query, setQuery] = useState('')
  const [tone, setTone] = useState<SkinToneId>('default')
  const [toneOpen, setToneOpen] = useState(false)
  const [hovered, setHovered] = useState<EmojiEntry | null>(null)
  const [activeGroup, setActiveGroup] = useState<string>(EMOJI_GROUPS[0]?.slug ?? '')
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  const { recent, push } = useRecentEmojis()
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const searchResults = useMemo(() => searchEmojis(query), [query])

  const sections = useMemo(() => {
    const list: { slug: string; label: string; icon: string; emojis: EmojiEntry[] }[] = []
    if (recent.length) {
      list.push({
        slug: RECENT_SLUG,
        label: 'Recently used',
        icon: '🕘',
        emojis: recent.map((c) => findEmoji(c)).filter((e): e is EmojiEntry => Boolean(e)),
      })
    }
    for (const g of EMOJI_GROUPS) list.push({ slug: g.slug, label: g.label, icon: g.icon, emojis: g.emojis })
    return list
  }, [recent])

  const flat = useMemo(() => {
    if (query.trim()) return searchResults
    return sections.flatMap((s) => s.emojis)
  }, [query, searchResults, sections])

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, flat.length)
  }, [flat.length])

  useEffect(() => {
    if (autoFocus) searchRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (focusIndex === null) return
    buttonRefs.current[focusIndex]?.focus()
  }, [focusIndex])

  const pick = (entry: EmojiEntry) => {
    const char = applyTone(entry.char, tone)
    push(entry.char)
    onSelect?.(char, entry)
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el || query.trim()) return
    const top = el.scrollTop + 8
    let current = sections[0]?.slug ?? ''
    for (const s of sections) {
      const node = sectionRefs.current[s.slug]
      if (node && node.offsetTop <= top) current = s.slug
    }
    setActiveGroup(current)
  }

  const jumpTo = (slug: string) => {
    const el = scrollRef.current
    const node = sectionRefs.current[slug]
    if (!el || !node) return
    el.scrollTo({ top: node.offsetTop - 4, behavior: 'smooth' })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nav = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!nav.includes(e.key)) return
    if (flat.length === 0) return
    e.preventDefault()
    const cur = focusIndex ?? 0
    const map: Record<string, number> = {
      ArrowRight: cur + 1,
      ArrowLeft: cur - 1,
      ArrowDown: cur + columns,
      ArrowUp: cur - columns,
      Home: 0,
      End: flat.length - 1,
    }
    const next = Math.max(0, Math.min(flat.length - 1, map[e.key] ?? cur))
    setFocusIndex(next)
  }

  const activeTone = SKIN_TONES.find((t) => t.id === tone) ?? SKIN_TONES[0]
  const preview = hovered

  const gridButton = (entry: EmojiEntry, index: number, toneAware: boolean) => (
    <button
      key={`${entry.char}-${index}`}
      ref={(node) => {
        buttonRefs.current[index] = node
      }}
      type="button"
      title={entry.name}
      aria-label={entry.name}
      onClick={() => pick(entry)}
      onMouseEnter={() => setHovered(entry)}
      onFocus={() => setHovered(entry)}
      onMouseLeave={() => setHovered(null)}
      className="grid h-8 place-items-center rounded-md text-[19px] leading-none transition-colors hover:bg-[#f1f1ef] focus-visible:bg-[#e9e9e6] focus-visible:outline-none active:scale-95"
    >
      <span className="translate-y-[0.5px]">
        {toneAware ? applyTone(entry.char, tone) : entry.char}
      </span>
    </button>
  )

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_18px_50px_-12px_rgba(20,20,19,0.22),0_2px_8px_rgba(20,20,19,0.06)] ${className}`}
      style={{ width }}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-label="Emoji picker"
    >
      <div className="px-3 pt-3">
        <div className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-[#f7f7f5] px-2.5 focus-within:border-line-strong focus-within:bg-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-faint">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setFocusIndex(null)
            }}
            placeholder="Search emoji"
            className="h-full w-full bg-transparent text-[13px] outline-none placeholder:text-ink-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
              className="grid h-5 w-5 place-items-center rounded text-ink-faint hover:bg-black/5 hover:text-ink"
              aria-label="Clear search"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-thin relative mt-2 overflow-y-auto overscroll-contain px-2 pb-2"
        style={{ height }}
      >
        {query.trim() ? (
          searchResults.length ? (
            <div className="grid gap-0.5 pt-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {searchResults.map((e, i) => gridButton(e, i, true))}
            </div>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div className="space-y-1">
                <div className="text-2xl">🫥</div>
                <p className="text-[13px] font-medium">No emoji found</p>
                <p className="text-[12px] text-ink-faint">Try “smile”, “cat” or “rocket”</p>
              </div>
            </div>
          )
        ) : (
          sections.map((section) => {
            const offset = flat.findIndex((e) => section.emojis.includes(e))
            return (
              <div
                key={section.slug}
                ref={(node) => {
                  sectionRefs.current[section.slug] = node
                }}
                data-group={section.slug}
              >
                <div className="sticky top-0 z-10 -mx-2 bg-surface/92 px-3 py-1.5 text-[10.5px] font-medium tracking-[0.08em] text-ink-faint uppercase backdrop-blur">
                  {section.label}
                </div>
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                  {section.emojis.map((e, i) => gridButton(e, offset < 0 ? i : offset + i, true))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-1.5">
        <div className="min-w-0 flex-1 truncate pl-1 text-[11.5px] text-ink-faint">
          {preview ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[15px] leading-none">{applyTone(preview.char, tone)}</span>
              <span className="truncate text-ink-soft">:{preview.slug}:</span>
            </span>
          ) : (
            <span>Click to insert</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {sections.map((s) => (
            <button
              key={s.slug}
              type="button"
              title={s.label}
              onClick={() => jumpTo(s.slug)}
              className={`grid h-7 w-7 place-items-center rounded-md text-[14px] transition-colors ${
                activeGroup === s.slug ? 'bg-[#f1f1ef]' : 'hover:bg-[#f6f6f4] opacity-55 hover:opacity-100'
              }`}
              aria-label={s.label}
            >
              <span className="grayscale-0">{s.icon}</span>
            </button>
          ))}

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setToneOpen((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#f6f6f4]"
              aria-label="Skin tone"
              aria-expanded={toneOpen}
            >
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: activeTone.color }}
              />
            </button>
            {toneOpen && (
              <div className="absolute right-0 bottom-9 z-20 w-[132px] rounded-xl border border-line bg-surface p-1 shadow-lg">
                {SKIN_TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTone(t.id)
                      setToneOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-[#f4f4f2] ${
                      tone === t.id ? 'bg-[#f4f4f2] font-medium' : ''
                    }`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: t.color }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
