import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { env } from '../env'

/**
 * Server-only. Never import this module from client code — CLAUDE.md rule 8.
 *
 * Uses libSQL (`@libsql/client`) rather than Node's built-in node:sqlite:
 * drizzle-orm's stable release line (0.45.x, "latest" on npm) has no
 * node:sqlite export at all — that support only exists on drizzle-orm's
 * pre-1.0 beta/rc tags, which isn't a foundational dependency to pin to
 * pre-release for. libSQL ships prebuilt native bindings (no node-gyp/Python
 * compile step, which this machine can't do anyway) and works as a plain
 * local file via a `file:` URL — no server, no Turso account needed.
 */
const client = createClient({ url: `file:${env.DATABASE_FILE}` })

export const db = drizzle({ client, schema })
export type Db = typeof db
