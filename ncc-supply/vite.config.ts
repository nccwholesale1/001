import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const hostedOnVercel = process.env.VERCEL === '1'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      ...(hostedOnVercel
        ? {
            preset: 'vercel' as const,
            // Nitro's Vercel default is the Web/Edge handler. This app needs
            // Node (useSession, node:crypto, libSQL). Web format 500s every
            // request as {"status":500,"unhandled":true,"message":"HTTPError"}.
            vercel: { entryFormat: 'node' },
          }
        : {}),
      // Vite 8 / Rolldown can emit an SSR chunk that 500s every request on
      // Vercel while `vite build` still exits 0. See TanStack/router#8031.
      inlineDynamicImports: true,
      // Native libsql binaries are OS-specific. A win32-traced build 500s on
      // Vercel's Linux functions; hosted deploys use @libsql/client/web only.
      ...(hostedOnVercel
        ? {
            traceDeps: [
              '!libsql',
              '!@libsql/win32-x64-msvc',
              '!@libsql/linux-x64-gnu',
              '!@libsql/linux-x64-musl',
              '!@neon-rs/load',
            ],
          }
        : {}),
    }),
    viteReact(),
  ],
  server: { port: Number(process.env.PORT) || 3000 },
})

export default config
