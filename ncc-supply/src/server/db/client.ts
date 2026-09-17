import { createRequire } from 'node:module'
import { createClient as createRemoteClient } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { env } from '../env'

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
  if (env.DATABASE_URL) {
    return createRemoteClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })
  }
  const nodeRequire = createRequire(import.meta.url)
  const { createClient } = nodeRequire('@libsql/client') as typeof import('@libsql/client')
  return createClient({ url: `file:${env.DATABASE_FILE}` })
}

export const db = drizzle({ client: createDbClient(), schema })
export type Db = typeof db
