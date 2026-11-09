import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': r('./src'),
      'next/image': r('./src/shims/next-image.tsx'),
      'next/link': r('./src/shims/next-link.tsx'),
    },
  },
  server: { port: 5183 },
})
