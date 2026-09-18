import { createClient } from '@libsql/client'

/**
 * Local `vite dev` / SQLite file only. Never imported by the Vercel
 * production bundle — `vite.config.ts` aliases this module to
 * `client-native-stub.ts` during `vite build`.
 */
export function createLocalFileClient(databaseFile: string) {
  return createClient({ url: `file:${databaseFile}` })
}
