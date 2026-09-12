import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { guestTokens, type TokenResourceType } from '../db/schema'
import { generateOpaqueToken, hashOpaqueToken } from '../shared/opaque-token'

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface IssuedToken {
  token: string
  expiresAt: Date
}

/**
 * Guest access to order/quote/return/support-ticket status pages is entirely
 * token-mediated (CLAUDE.md rule 16, docs/route-permissions-matrix.md) — no
 * guest account exists to authorize against. Same hash-only storage pattern
 * as ../auth/session.ts: the raw token is returned exactly once, here.
 */
export async function issueGuestToken(
  db: Db,
  resourceType: TokenResourceType,
  resourceId: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<IssuedToken> {
  const token = generateOpaqueToken()
  const expiresAt = new Date(Date.now() + ttlMs)

  await db.insert(guestTokens).values({
    id: randomUUID(),
    tokenHash: hashOpaqueToken(token),
    resourceType,
    resourceId,
    expiresAt: expiresAt.toISOString(),
  })

  return { token, expiresAt }
}

/**
 * Returns the resource id on success, or null for any failure case —
 * unknown token, wrong resource type, expired, or revoked. Callers must
 * treat all of these identically so a probing request can't distinguish
 * "wrong token" from "right token, wrong resource" (no enumeration).
 */
export async function verifyGuestToken(
  db: Db,
  rawToken: string,
  resourceType: TokenResourceType,
): Promise<{ resourceId: string } | null> {
  const [row] = await db
    .select()
    .from(guestTokens)
    .where(eq(guestTokens.tokenHash, hashOpaqueToken(rawToken)))
    .limit(1)

  if (!row) return null
  if (row.resourceType !== resourceType) return null
  if (row.revokedAt !== null) return null
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null

  return { resourceId: row.resourceId }
}

export async function revokeGuestToken(db: Db, rawToken: string): Promise<void> {
  await db
    .update(guestTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(guestTokens.tokenHash, hashOpaqueToken(rawToken)), isNull(guestTokens.revokedAt)))
}
