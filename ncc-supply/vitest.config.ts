import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Deliberately separate from vite.config.ts: the TanStack Start SSR plugin
// there isn't relevant to jsdom component tests and can conflict with them.
// Source files here are imported by relative path, so no alias plugin is needed.
export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
  },
})
