import { createRequire } from 'node:module'
import { createClient as createRemoteClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { env } from '../env'
import { debugSessionLog } from '../debug-session-log'

/**
 * Server-only. Never import this module from client code — CLAUDE.md rule 8.
 *
 * Remote `DATABASE_URL` (Turso) uses the fetch-based web client so the
 * Vercel serverless bundle never includes `@libsql/client`'s native
 * bindings (those are OS-specific — a win32 build traced into a Linux
 * function 500s). Local file: URLs still use the Node client, loaded only
 * when DATABASE_URL is unset.
 *
 * Keep this module free of top-level await. A TLA graph in the Vercel
 * Node function 500s every SSR request as an opaque HTTPError.
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
    if (process.env.VERCEL === '1' || process.env.NCC_HOSTED === '1') {
      // Native @libsql/client is excluded from the Vercel linux bundle.
      // An inert web client keeps import from crashing; queries fail softly.
      // #region agent log
      debugSessionLog({
        location: 'src/server/db/client.ts:createDbClient',
        message: 'hosted deploy missing DATABASE_URL, using inert web client',
        hypothesisId: 'B',
        data: { mode: 'hosted-inert' },
      })
      // #endregion
      return createRemoteClient({ url: 'https://127.0.0.1' })
    }
    const nodeRequire = createRequire(import.meta.url)
    const { createClient } = nodeRequire('@libsql/client') as typeof import('@libsql/client')
    const client = createClient({ url: `file:${env.DATABASE_FILE}` })
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
    throw error
  }
}

export const db = drizzle({ client: createDbClient(), schema })
export type Db = typeof db
