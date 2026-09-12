import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

/**
 * Test-only. Spins up a fresh in-memory libSQL database with every
 * generated migration applied, so each test file (or each test, if it
 * calls this per-test) gets full schema isolation with no shared state and
 * no file left on disk.
 */
export async function createTestDb() {
  const client = createClient({ url: ':memory:' })
  await applyMigrations(client)
  const db = drizzle({ client, schema })
  return { db, client }
}

async function applyMigrations(client: Client) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    const statements = sql.split('--> statement-breakpoint')
    for (const statement of statements) {
      const trimmed = statement.trim()
      if (trimmed) await client.execute(trimmed)
    }
  }
}
