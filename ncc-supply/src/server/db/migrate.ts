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
 * for schema migration — deliberately explicit rather than implicit.
 */
const client = createClient({ url: `file:${env.DATABASE_FILE}` })
const db = drizzle({ client })

await migrate(db, { migrationsFolder: './src/server/db/migrations' })
console.log(`Migrations applied to ${env.DATABASE_FILE}`)
client.close()
