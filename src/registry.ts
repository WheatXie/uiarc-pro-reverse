import type { ComponentType } from 'react'
import { EmojiPickerDemo } from '@/components/emoji-picker/demo'
import pickerSource from '@/components/emoji-picker/EmojiPicker.tsx?raw'
import dataSource from '@/components/emoji-picker/emoji-data.ts?raw'
import demoSource from '@/components/emoji-picker/demo.tsx?raw'

export type Tier = 'free' | 'pro'
export type Section = 'components' | 'blocks' | 'special'

export type SourceFile = { name: string; code: string }

export type RegistryItem = {
  slug: string
  title: string
  section: Section
  tier: Tier
  summary: string
  Demo: ComponentType
  files: SourceFile[]
  deps: string[]
}

export const registry: RegistryItem[] = [
  {
    slug: 'emoji-picker',
    title: 'Emoji Picker',
    section: 'components',
    tier: 'free',
    summary:
      'Searchable emoji panel with category sections, skin-tone modifiers, recent memory and full keyboard navigation.',
    Demo: EmojiPickerDemo,
    files: [
      { name: 'EmojiPicker.tsx', code: pickerSource },
      { name: 'emoji-data.ts', code: dataSource },
      { name: 'demo.tsx', code: demoSource },
    ],
    deps: ['Data: unicode-emoji-json (MIT)'],
  },
]

export const items = (section: Section) => registry.filter((r) => r.section === section)

export function getItem(slug: string) {
  return registry.find((r) => r.slug === slug)
}

export const counts = {
  components: items('components').length,
  blocks: items('blocks').length,
  special: items('special').length,
}
