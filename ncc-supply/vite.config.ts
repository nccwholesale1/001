import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Always target Vercel Node (not the default Web/Edge handler). Gating
      // this on VERCEL=1 is unnecessary — this app only deploys to Vercel —
      // and the Web format 500s every request as HTTPError.
      preset: 'vercel',
      vercel: { entryFormat: 'node' },
      inlineDynamicImports: true,
      traceDeps: [
        '!libsql',
        '!@libsql/win32-x64-msvc',
        '!@libsql/linux-x64-gnu',
        '!@libsql/linux-x64-musl',
        '!@neon-rs/load',
      ],
      errorHandler: './error.ts',
    }),
    viteReact(),
  ],
  server: { port: Number(process.env.PORT) || 3000 },
})

export default config
