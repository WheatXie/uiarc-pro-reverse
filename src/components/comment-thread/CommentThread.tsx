import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EmojiPicker } from '@/components/emoji-picker/EmojiPicker'
import './comment-thread.css'

export type Comment = {
  id: string
  name: string
  body: string
  /** Two-stop gradient painted behind the avatar initial. */
  tint: [string, string]
  self?: boolean
}

export type CommentThreadProps = {
  messages?: Comment[]
  me?: { name: string; tint: [string, string] }
  onSend?: (text: string) => void
  placeholder?: string
  /** Seed the composer, useful for previews and screenshots. */
  initialDraft?: string
  /** Open the emoji panel on mount — handy for previews. */
  initialPickerOpen?: boolean
  className?: string
}

const DEFAULT_MESSAGES: Comment[] = [
  {
    id: 'c1',
    name: 'Jordan Reyes',
    body: 'Launch checklist is green. Shipping the pricing page at 3pm unless anyone objects.',
    tint: ['#ef5aa7', '#7d8cf0'],
  },
  {
    id: 'c2',
    name: 'Chloe Nguyen',
    body: 'Copy is final and the screenshots are swapped in.',
    tint: ['#7ed957', '#8b6cf0'],
  },
]

const ME = { name: 'You', tint: ['#141413', '#4a4a45'] as [string, string] }

function Avatar({ tint, small = false }: { tint: [string, string]; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center rounded-full ${small ? 'h-9 w-9' : 'h-10 w-10'}`}
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, ${tint[0]} 0%, ${tint[1]} 100%)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35), 0 0 0 1px rgba(20,20,19,0.04)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.32), transparent 58%)' }}
      />
    </span>
  )
}

function SendArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 19V5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="m6 11 6-6 6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmojiGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="12" r="8.1" stroke="currentColor" strokeWidth="1.55" />
      <path d="M7.7 14.2c.9 1.35 2 2 3.4 2 1.4 0 2.5-.65 3.4-2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="8.7" cy="10" r="0.95" fill="currentColor" />
      <circle cx="13.4" cy="10" r="0.95" fill="currentColor" />
      <path d="M19.4 3.2v4.2M17.3 5.3h4.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  )
}

export function CommentThread({
  messages = DEFAULT_MESSAGES,
  me = ME,
  onSend,
  placeholder = 'Shift picks several',
  initialDraft = '',
  initialPickerOpen = false,
  className = '',
}: CommentThreadProps) {
  const [thread, setThread] = useState<Comment[]>(messages)
  const [draft, setDraft] = useState(initialDraft)
  const [focused, setFocused] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(initialPickerOpen)
  const [sending, setSending] = useState(false)

  const areaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [draft])

  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  const canSend = draft.trim().length > 0

  const send = () => {
    if (!canSend || sending) return
    const body = draft.trim()
    setSending(true)
    const next: Comment = {
      id: `c${Date.now()}`,
      name: me.name,
      body,
      tint: me.tint,
      self: true,
    }
    setThread((prev) => [...prev, next])
    setDraft('')
    onSend?.(body)
    setTimeout(() => setSending(false), 160)
    requestAnimationFrame(() => areaRef.current?.focus())
  }

  return (
    <div
      className={`ct-card ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && pickerOpen) {
          e.stopPropagation()
          setPickerOpen(false)
        }
      }}
    >
      <ul className="ct-list">
        {thread.map((m, i) => (
          <li
            key={m.id}
            className="ct-row"
            style={{ animationDelay: `${Math.min(i, 6) * 55}ms` }}
          >
            <Avatar tint={m.tint} />
            <div className="ct-body">
              <p className="ct-name">{m.name}</p>
              <p className="ct-text">{m.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div ref={composerRef} className="ct-composer-wrap">
        {pickerOpen && (
          <div className="ct-picker">
            <EmojiPicker
              width={340}
              height={300}
              columns={8}
              autoFocus
              onSelect={(char) => {
                setDraft((d) => d + char)
                setPickerOpen(false)
                areaRef.current?.focus()
              }}
            />
          </div>
        )}

        <div className={`ct-composer ${focused ? 'is-focused' : ''}`}>
          <textarea
            ref={areaRef}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            aria-label="Write a comment"
            placeholder=""
            className="ct-input"
          />

          <div className="ct-tools">
            <button
              type="button"
              className={`ct-emoji ${pickerOpen ? 'is-open' : ''}`}
              onClick={() => setPickerOpen((v) => !v)}
              aria-label="Insert emoji"
              aria-expanded={pickerOpen}
            >
              <EmojiGlyph />
            </button>

            <span className="ct-hint">{placeholder}</span>

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send comment"
              className={`ct-send ${canSend ? 'is-armed' : ''}`}
            >
              <SendArrow />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
