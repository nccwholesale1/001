import { createClient as createRemoteClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { env } from '../env'
import { debugSessionLog } from '../debug-session-log'
import { createLocalFileClient } from './client-native'

/**
 * Server-only. Never import this module from client code — CLAUDE.md rule 8.
 *
 * Hosted/Turso uses `@libsql/client/web` only. Native `@libsql/client` lives
 * in `client-native.ts` and is stubbed out of `vite build` so the Vercel
 * Linux function never `require`s `@libsql/linux-x64-gnu`.
 *
 * Keep this module free of top-level await.
 */
function createDbClient() {
  try {
    if (env.DATABASE_URL) {
      const client = createRemoteClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })
      // #region agent log
      debugSessionLog({
        location: 'src/server/db/client.ts:createDbClient',
        message: 'using remote libsql web client',
        hypothesisId: 'B',
        data: { mode: 'remote-web' },
      })
      // #endregion
      return client
    }
    if (process.env.VERCEL === '1' || process.env.NCC_HOSTED === '1' || import.meta.env.PROD) {
      // #region agent log
      debugSessionLog({
        location: 'src/server/db/client.ts:createDbClient',
        message: 'hosted/prod missing DATABASE_URL, using inert web client',
        hypothesisId: 'B',
        data: { mode: 'hosted-inert' },
      })
      // #endregion
      return createRemoteClient({ url: 'https://127.0.0.1' })
    }
    const client = createLocalFileClient(env.DATABASE_FILE)
    // #region agent log
    debugSessionLog({
      location: 'src/server/db/client.ts:createDbClient',
      message: 'using local native libsql client',
      hypothesisId: 'B',
      data: { mode: 'local-file' },
    })
    // #endregion
    return client
  } catch (error) {
    // #region agent log
    debugSessionLog({
      location: 'src/server/db/client.ts:createDbClient',
      message: 'createDbClient threw',
      hypothesisId: 'B',
      data: {
        name: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    })
    // #endregion
    if (process.env.VERCEL === '1' || process.env.NCC_HOSTED === '1' || import.meta.env.PROD) {
      return createRemoteClient({ url: 'https://127.0.0.1' })
    }
    throw error
  }
}

export const db = drizzle({ client: createDbClient(), schema })
export type Db = typeof db
