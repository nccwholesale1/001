import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { idempotencyKeys } from '../db/schema'

/**
 * Wraps a mutation so a duplicate call with the same (scope, key) — a
 * retried form submit, a double-tapped button — replays the first call's
 * result instead of re-running it (CLAUDE.md rule 21). `scope` namespaces
 * keys per command type (e.g. "submit_basket") so two different commands
 * can't collide on the same client-supplied key.
 */
export async function withIdempotency<T>(
  db: Db,
  scope: string,
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    .limit(1)

  if (existing) return JSON.parse(existing.resultJson) as T

  const result = await run()

  try {
    await db.insert(idempotencyKeys).values({
      id: randomUUID(),
      scope,
      key,
      resultJson: JSON.stringify(result),
    })
  } catch {
    // A concurrent call already won the race and inserted first (unique
    // constraint on scope+key) — return its stored result instead of ours,
    // so both callers observe the same outcome.
    const [winner] = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
      .limit(1)
    if (winner) return JSON.parse(winner.resultJson) as T
    throw new Error(
      `Idempotency key insert failed for scope "${scope}" but no row was found afterward`,
    )
  }

  return result
}
