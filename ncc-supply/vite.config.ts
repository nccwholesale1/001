import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const jsxDevRuntimeShim = fileURLToPath(new URL('./src/shims/jsx-dev-runtime.ts', import.meta.url))
const emptyLibsql = fileURLToPath(new URL('./src/shims/empty-libsql.ts', import.meta.url))
const nativeLibsqlStub = fileURLToPath(new URL('./src/server/db/client-native-stub.ts', import.meta.url))

const NATIVE_LIBSQL_IDS = new Set([
  'libsql',
  '@libsql/linux-x64-gnu',
  '@libsql/linux-x64-musl',
  '@libsql/win32-x64-msvc',
  '@neon-rs/load',
])

/** Keep native libsql out of `vite build` / the Vercel Linux function. */
function stubNativeLibsql(): Plugin {
  return {
    name: 'ncc-stub-native-libsql',
    enforce: 'pre',
    apply: 'build',
    resolveId(id) {
      const normalized = id.replaceAll('\\', '/')
      if (NATIVE_LIBSQL_IDS.has(id) || NATIVE_LIBSQL_IDS.has(normalized)) {
        return emptyLibsql
      }
      if (id === '@libsql/client' || normalized === '@libsql/client') {
        return '@libsql/client/web'
      }
      if (
        normalized.endsWith('/client-native.ts') ||
        normalized.endsWith('/client-native') ||
        normalized === './client-native' ||
        normalized === './client-native.ts'
      ) {
        return nativeLibsqlStub
      }
      return undefined
    },
  }
}

// Vercel env vars sometimes set NODE_ENV=Preview (a dashboard name). Vite's
// React plugin then emits jsxDEV into the production Nitro bundle, and every
// `/_serverFn` request 500s with "jsxDEV is not a function".
const isBuild = process.argv.includes('build')
if (isBuild) {
  process.env.NODE_ENV = 'production'
}

const nativePackageAliases = {
  libsql: emptyLibsql,
  '@libsql/linux-x64-gnu': emptyLibsql,
  '@libsql/linux-x64-musl': emptyLibsql,
  '@libsql/win32-x64-msvc': emptyLibsql,
}

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'react/jsx-dev-runtime': jsxDevRuntimeShim,
      ...(isBuild ? nativePackageAliases : {}),
    },
  },
  define: isBuild ? { 'process.env.NODE_ENV': JSON.stringify('production') } : undefined,
  plugins: [
    stubNativeLibsql(),
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
      alias: {
        'react/jsx-dev-runtime': jsxDevRuntimeShim,
        ...nativePackageAliases,
      },
      traceDeps: [
        '!libsql',
        '!@libsql/win32-x64-msvc',
        '!@libsql/linux-x64-gnu',
        '!@libsql/linux-x64-musl',
        '!@neon-rs/load',
      ],
      errorHandler: './error.ts',
    }),
    viteReact({ jsxRuntime: 'automatic' }),
  ],
  server: { port: Number(process.env.PORT) || 3000 },
})

export default config
