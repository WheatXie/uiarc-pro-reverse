import { useCallback, useEffect, useRef, useState } from 'react'

const KEY = 'uiarc:emoji-recent'

export function useRecentEmojis(limit = 18) {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as string[]).slice(0, limit) : []
    } catch {
      return []
    }
  })

  const push = useCallback(
    (char: string) => {
      setRecent((prev) => {
        const next = [char, ...prev.filter((c) => c !== char)].slice(0, limit)
        try {
          localStorage.setItem(KEY, JSON.stringify(next))
        } catch {
          /* storage disabled — keep in memory */
        }
        return next
      })
    },
    [limit],
  )

  const clear = useCallback(() => {
    setRecent([])
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return { recent, push, clear }
}

export function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: (e: MouseEvent) => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handler(e)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, handler, active])
}
