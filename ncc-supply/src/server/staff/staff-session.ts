import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import type { Actor } from '../auth/authorization'
import { verifySession, type CreatedSession } from '../auth/session'
import type { Db } from '../db/client'
import { salesRepAssignments } from '../db/schema'
import { env } from '../env'

const COOKIE_NAME = 'ncc_staff_session'

/**
 * `session.ts`'s token is already a safe, unforgeable bearer credential
 * (random, hash-verified server-side — the raw value is only ever handed
 * out once, at login) — unlike the buyer/basket pointer cookies, it doesn't
 * need `useSession`'s extra sealing layer, so a plain httpOnly cookie is
 * the correct, standard transport for it.
 */
export function setStaffSessionCookie(session: CreatedSession): void {
  setCookie(COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt,
  })
}

export function clearStaffSessionCookie(): void {
  deleteCookie(COOKIE_NAME, { path: '/' })
}

export class NotSignedInAsStaffError extends Error {
  constructor() {
    super('Not signed in as staff')
    this.name = 'NotSignedInAsStaffError'
  }
}

/**
 * Resolves the signed-in staff member into the shared `Actor` shape
 * (../auth/authorization.ts) — a sales rep's `assignedCompanyIds` is loaded
 * here so every downstream `canViewCompanyResource`/`canMutateCompanyResource`
 * check has it, mirroring how ../buyers/buyer-session.ts resolves a buyer.
 */
export async function getCurrentStaffActor(
  db: Db,
): Promise<Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }> | null> {
  const token = getCookie(COOKIE_NAME)
  if (!token) return null

  const authenticated = await verifySession(db, token)
  if (!authenticated) return null

  if (authenticated.role === 'ncc_admin') {
    return { kind: 'ncc_admin', staffUserId: authenticated.staffUserId }
  }

  const assignments = await db
    .select({ companyId: salesRepAssignments.companyId })
    .from(salesRepAssignments)
    .where(eq(salesRepAssignments.staffUserId, authenticated.staffUserId))
  return {
    kind: 'sales_rep',
    staffUserId: authenticated.staffUserId,
    assignedCompanyIds: assignments.map((row) => row.companyId),
  }
}

export async function requireStaffActor(
  db: Db,
): Promise<Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }>> {
  const actor = await getCurrentStaffActor(db)
  if (!actor) throw new NotSignedInAsStaffError()
  return actor
}
