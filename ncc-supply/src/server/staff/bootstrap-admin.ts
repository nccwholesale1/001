import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../auth/password'
import type { Db } from '../db/client'
import { staffUsers } from '../db/schema'

export class BootstrapAdminExistsError extends Error {
  constructor() {
    super('An NCC admin already exists — refusing to create another via bootstrap.')
    this.name = 'BootstrapAdminExistsError'
  }
}

export interface BootstrapAdminInput {
  name: string
  email: string
  username: string
  password: string
}

/**
 * One-shot production bootstrap: create the first NCC admin when the staff
 * table is empty of that role. Never a public HTTP endpoint. Subsequent
 * staff accounts go through `/staff/team`.
 */
export async function bootstrapFirstNccAdmin(db: Db, input: BootstrapAdminInput): Promise<{ staffUserId: string }> {
  const [existing] = await db
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.role, 'ncc_admin'))
    .limit(1)
  if (existing) throw new BootstrapAdminExistsError()

  const staffUserId = randomUUID()
  await db.insert(staffUsers).values({
    id: staffUserId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    username: input.username.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: 'ncc_admin',
    employeeId: null,
    status: 'active',
  })
  return { staffUserId }
}
