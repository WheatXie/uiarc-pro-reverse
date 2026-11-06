import raw from '@/data/emoji-groups.json'

export type RawEmoji = {
  emoji: string
  skin_tone_support: boolean
  name: string
  slug: string
}

export type RawGroup = {
  name: string
  slug: string
  emojis: RawEmoji[]
}

export type EmojiEntry = {
  char: string
  name: string
  slug: string
  group: string
  groupSlug: string
  tones: boolean
}

const SKIN_TONE_MODIFIERS = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'] as const

export const SKIN_TONES = [
  { id: 'default', label: 'Default', color: '#ffc93c', modifier: '' },
  { id: 'light', label: 'Light', color: '#f7d7bd', modifier: SKIN_TONE_MODIFIERS[0] },
  { id: 'medium-light', label: 'Medium light', color: '#e3b48c', modifier: SKIN_TONE_MODIFIERS[1] },
  { id: 'medium', label: 'Medium', color: '#c68d63', modifier: SKIN_TONE_MODIFIERS[2] },
  { id: 'medium-dark', label: 'Medium dark', color: '#a56a44', modifier: SKIN_TONE_MODIFIERS[3] },
  { id: 'dark', label: 'Dark', color: '#7c4a2d', modifier: SKIN_TONE_MODIFIERS[4] },
] as const

export type SkinTone = (typeof SKIN_TONES)[number]
export type SkinToneId = SkinTone['id']

/** Groups that are not user-facing emoji collections (skin-tone swatches). */
const HIDDEN_GROUPS = new Set(['Component'])

export const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  'Smileys & Emotion': { icon: '🙂', label: 'Smileys' },
  'People & Body': { icon: '👋', label: 'People' },
  'Animals & Nature': { icon: '🌿', label: 'Nature' },
  'Food & Drink': { icon: '🍔', label: 'Food' },
  'Travel & Places': { icon: '🚗', label: 'Travel' },
  Activities: { icon: '⚽', label: 'Activities' },
  Objects: { icon: '💡', label: 'Objects' },
  Symbols: { icon: '❤️', label: 'Symbols' },
  Flags: { icon: '🏳️', label: 'Flags' },
}

const GROUPS = raw as RawGroup[]

export type EmojiGroup = {
  slug: string
  name: string
  label: string
  icon: string
  emojis: EmojiEntry[]
}

export const EMOJI_GROUPS: EmojiGroup[] = GROUPS.filter((g) => !HIDDEN_GROUPS.has(g.name)).map((g) => ({
  slug: g.slug,
  name: g.name,
  label: CATEGORY_META[g.name]?.label ?? g.name,
  icon: CATEGORY_META[g.name]?.icon ?? '•',
  emojis: g.emojis.map((e) => ({
    char: e.emoji,
    name: e.name,
    slug: e.slug,
    group: g.name,
    groupSlug: g.slug,
    tones: e.skin_tone_support,
  })),
}))

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_GROUPS.flatMap((g) => g.emojis)

const BY_CHAR = new Map<string, EmojiEntry>(ALL_EMOJIS.map((e) => [e.char, e]))

export function findEmoji(char: string): EmojiEntry | undefined {
  return BY_CHAR.get(char)
}

/** Apply a skin tone by appending the Fitzpatrick modifier — correct for the
 * single-codepoint people/hand emoji, which is the vast majority of the set. */
export function applyTone(char: string, tone: SkinToneId): string {
  const t = SKIN_TONES.find((s) => s.id === tone)
  if (!t || !t.modifier) return char
  const entry = BY_CHAR.get(char)
  if (!entry?.tones) return char
  return char + t.modifier
}

export function searchEmojis(query: string, limit = 120): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: { e: EmojiEntry; score: number }[] = []
  for (const e of ALL_EMOJIS) {
    const name = e.name.toLowerCase()
    const idx = name.indexOf(q)
    if (idx === -1) {
      if (e.slug.includes(q.replace(/\s+/g, '_'))) scored.push({ e, score: 60 })
      continue
    }
    scored.push({ e, score: idx === 0 ? 0 : idx })
  }
  scored.sort((a, b) => a.score - b.score || a.e.name.length - b.e.name.length)
  return scored.slice(0, limit).map((s) => s.e)
}
