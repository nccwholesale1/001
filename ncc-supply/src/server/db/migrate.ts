import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
// Explicit .ts extension: this file runs standalone via `node
// --experimental-strip-types` (package.json db:migrate script), not through
// Vite's bundler resolution, so Node's own ESM resolver needs the real path.
import { env } from '../env.ts'

/**
 * Standalone migration runner (`pnpm db:migrate`). Separate from
 * `db/client.ts` so the app's own singleton connection isn't the one used
 * for schema migration — deliberately explicit rather than implicit. Mirrors
 * client.ts's own DATABASE_URL-takes-priority rule so this can be pointed at
 * a remote database (e.g. Turso) with the same env vars the app itself uses.
 */
const client = env.DATABASE_URL
  ? createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })
  : createClient({ url: `file:${env.DATABASE_FILE}` })
const db = drizzle({ client })

await migrate(db, { migrationsFolder: './src/server/db/migrations' })
console.log(`Migrations applied to ${env.DATABASE_URL ?? env.DATABASE_FILE}`)
client.close()
