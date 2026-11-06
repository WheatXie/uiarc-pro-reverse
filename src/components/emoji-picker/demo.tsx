import { useCallback, useEffect, useRef, useState } from 'react'
import { EmojiPicker } from './EmojiPicker'

export function EmojiPickerDemo() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('open') === '1')
  const [value, setValue] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const onDown = useCallback((e: MouseEvent) => {
    if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    document.addEventListener('mousedown', onDown)
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onDown])

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div ref={wrapRef} className="relative">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write a message…"
            className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Insert emoji"
            className="grid h-7 w-7 place-items-center rounded-lg text-[17px] hover:bg-[#f3f3f1]"
          >
            🙂
          </button>
        </div>

        {open && (
          <div className="absolute top-12 left-0 z-30">
            <EmojiPicker
              onSelect={(char) => {
                setValue((v) => v + char)
                setOpen(false)
              }}
            />
          </div>
        )}
      </div>
      <p className="text-[12px] text-ink-faint">
        Type to search, arrow keys to move, <kbd className="rounded border border-line bg-[#f7f7f5] px-1">Enter</kbd> to insert.
      </p>
    </div>
  )
}
