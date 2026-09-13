import { eq, or } from 'drizzle-orm'
import { recordAuditEvent } from '../audit/audit-log'
import { verifyPassword } from '../auth/password'
import { createSession, type CreatedSession } from '../auth/session'
import type { Db } from '../db/client'
import { staffUsers, type StaffRole } from '../db/schema'
import { assertCanActivateOnFirstLogin, transitionStaff } from '../domain/status'

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Incorrect email/username or password')
    this.name = 'InvalidCredentialsError'
  }
}

export class AccountDeactivatedError extends Error {
  constructor() {
    super('This account has been deactivated — contact an NCC admin')
    this.name = 'AccountDeactivatedError'
  }
}

export interface StaffLoginResult {
  session: CreatedSession
  staffUserId: string
  role: StaffRole
}

/**
 * PRD §2/§6.22 acceptance criterion 18: one field, email OR username,
 * resolving to the same account. Deliberately returns the same
 * `InvalidCredentialsError` for "no such identifier" and "wrong password" —
 * no enumeration of which one was wrong (same spirit as guest-token
 * verification's uniform-null contract).
 *
 * A `pending_id_verification` sales rep activates right here, on this
 * first successful password check (ADR-007) — proof of email/username
 * ownership plus the password an admin already set is exactly the
 * verification the rule calls for; no separate ID-document step exists.
 */
export async function signInStaff(
  db: Db,
  input: { identifier: string; password: string },
): Promise<StaffLoginResult> {
  const identifier = input.identifier.trim().toLowerCase()
  const [staff] = await db
    .select()
    .from(staffUsers)
    .where(or(eq(staffUsers.email, identifier), eq(staffUsers.username, identifier)))
    .limit(1)

  if (!staff) throw new InvalidCredentialsError()
  if (!(await verifyPassword(input.password, staff.passwordHash))) {
    throw new InvalidCredentialsError()
  }
  if (staff.status === 'deactivated') throw new AccountDeactivatedError()

  if (staff.status === 'pending_id_verification') {
    assertCanActivateOnFirstLogin(staff)
    const nextStatus = transitionStaff('pending_id_verification', { type: 'first_login' })
    await db.update(staffUsers).set({ status: nextStatus }).where(eq(staffUsers.id, staff.id))
    await recordAuditEvent(db, {
      actorType: 'staff',
      actorId: staff.id,
      action: 'activate_staff_first_login',
      resourceType: 'staff_user',
      resourceId: staff.id,
    })
  }

  const session = await createSession(db, staff.id)
  return { session, staffUserId: staff.id, role: staff.role }
}
