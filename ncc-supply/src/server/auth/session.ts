import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { staffSessions, staffUsers, type StaffRole } from '../db/schema'
import { generateOpaqueToken, hashOpaqueToken } from '../shared/opaque-token'

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

export interface CreatedSession {
  token: string
  expiresAt: Date
}

export interface AuthenticatedStaff {
  staffUserId: string
  role: StaffRole
}

/**
 * Only the session's SHA-256 hash is ever persisted (CLAUDE.md rule 16) — the
 * raw `token` returned here is the one and only time the caller sees it, to
 * be handed to the client as a cookie value.
 */
export async function createSession(db: Db, staffUserId: string): Promise<CreatedSession> {
  const token = generateOpaqueToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(staffSessions).values({
    id: randomUUID(),
    tokenHash: hashOpaqueToken(token),
    staffUserId,
    expiresAt: expiresAt.toISOString(),
  })

  return { token, expiresAt }
}

/**
 * Looks sessions up by hash only — the raw token is never used in a query,
 * so a database read (logs, backups) can't be replayed as a bearer
 * credential. Returns null for missing, expired, or revoked sessions alike;
 * callers must not be able to distinguish those cases (no enumeration).
 */
export async function verifySession(db: Db, rawToken: string): Promise<AuthenticatedStaff | null> {
  const tokenHash = hashOpaqueToken(rawToken)

  const [row] = await db
    .select({
      staffUserId: staffSessions.staffUserId,
      expiresAt: staffSessions.expiresAt,
      revokedAt: staffSessions.revokedAt,
      role: staffUsers.role,
      staffStatus: staffUsers.status,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.staffUserId))
    .where(eq(staffSessions.tokenHash, tokenHash))
    .limit(1)

  if (!row) return null
  if (row.revokedAt !== null) return null
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null
  if (row.staffStatus !== 'active') return null

  return { staffUserId: row.staffUserId, role: row.role }
}

export async function invalidateSession(db: Db, rawToken: string): Promise<void> {
  await db
    .update(staffSessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(eq(staffSessions.tokenHash, hashOpaqueToken(rawToken)), isNull(staffSessions.revokedAt)),
    )
}

/** Revokes every session for a staff user — used on deactivation. */
export async function invalidateAllSessionsForStaff(db: Db, staffUserId: string): Promise<void> {
  await db
    .update(staffSessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(staffSessions.staffUserId, staffUserId), isNull(staffSessions.revokedAt)))
}
