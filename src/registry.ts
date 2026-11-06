import type { ComponentType } from 'react'
import { EmojiPickerDemo } from '@/components/emoji-picker/demo'
import pickerSource from '@/components/emoji-picker/EmojiPicker.tsx?raw'
import dataSource from '@/components/emoji-picker/emoji-data.ts?raw'
import demoSource from '@/components/emoji-picker/demo.tsx?raw'
import { CommentThreadDemo } from '@/components/comment-thread/demo'
import threadSource from '@/components/comment-thread/CommentThread.tsx?raw'
import threadCss from '@/components/comment-thread/comment-thread.css?raw'
import threadDemoSource from '@/components/comment-thread/demo.tsx?raw'

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
  {
    slug: 'comment-thread',
    title: 'Comment Thread',
    section: 'components',
    tier: 'pro',
    summary:
      'Message list with gradient avatars and a composer that grows with the draft, seeds an emoji panel and springs into a send state.',
    Demo: CommentThreadDemo,
    files: [
      { name: 'CommentThread.tsx', code: threadSource },
      { name: 'comment-thread.css', code: threadCss },
      { name: 'demo.tsx', code: threadDemoSource },
    ],
    deps: ['React + CSS', 'Reuses EmojiPicker'],
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
