import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { canManageStaffTeam, ForbiddenError, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import { hashPassword } from '../auth/password'
import type { Db } from '../db/client'
import { companies, salesRepAssignments, staffUsers, type StaffRole, type StaffStatus } from '../db/schema'
import { transitionStaff } from '../domain/status'
import type { AddStaffAccountInput } from '../validation/commands'

export class EmployeeIdRequiredError extends Error {
  constructor() {
    super('A sales rep account needs an employee ID before it can be created')
    this.name = 'EmployeeIdRequiredError'
  }
}

/**
 * No format has been specified by the business for employee IDs — this is
 * an implementation default (3-20 letters/digits/hyphens), recorded as such
 * (DECISIONS.md), not a confirmed business rule. Uniqueness is enforced
 * separately by the DB's own unique index, checked before insert below.
 */
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9-]{3,20}$/

export class InvalidEmployeeIdFormatError extends Error {
  constructor() {
    super('Employee ID must be 3-20 letters, digits or hyphens')
    this.name = 'InvalidEmployeeIdFormatError'
  }
}

export class DuplicateStaffFieldError extends Error {
  constructor(field: string) {
    super(`That ${field} is already in use by another staff account`)
    this.name = 'DuplicateStaffFieldError'
  }
}

export class StaffAccountNotFoundError extends Error {
  constructor() {
    super('Staff account not found')
    this.name = 'StaffAccountNotFoundError'
  }
}

export interface StaffAccountSummary {
  id: string
  name: string
  email: string
  username: string
  role: StaffRole
  employeeId: string | null
  status: StaffStatus
  assignedCompanies: Array<{ id: string; name: string }>
}

/** PRD §6.22 "Staff: team management" — table of every internal NCC account, NCC-admin-only (no read-only access for anyone else, unlike every other staff screen). */
export async function listStaffAccounts(db: Db, actor: Actor): Promise<StaffAccountSummary[]> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()

  const staff = await db.select().from(staffUsers)
  const assignments = await db
    .select({ staffUserId: salesRepAssignments.staffUserId, companyId: companies.id, companyName: companies.name })
    .from(salesRepAssignments)
    .innerJoin(companies, eq(salesRepAssignments.companyId, companies.id))

  const assignmentsByStaffId = new Map<string, Array<{ id: string; name: string }>>()
  for (const row of assignments) {
    const list = assignmentsByStaffId.get(row.staffUserId) ?? []
    list.push({ id: row.companyId, name: row.companyName })
    assignmentsByStaffId.set(row.staffUserId, list)
  }

  return staff
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username,
      role: row.role,
      employeeId: row.employeeId,
      status: row.status,
      assignedCompanies: assignmentsByStaffId.get(row.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * PRD §6.22: "the form blocks submission without it [employee ID for a
 * sales rep] and shows the verification result inline rather than silently
 * accepting an empty or malformed value" — enforced here at creation time,
 * on top of ADR-007's existing first-login activation check (which only
 * confirms *some* employee ID is on file, not its format). An NCC admin has
 * no employee-ID requirement and starts `active` immediately; a sales rep
 * starts `pending_id_verification`, activated for real on first sign-in
 * (`staff/login.ts`, unchanged by this).
 */
export async function addStaffAccount(db: Db, actor: Actor, input: AddStaffAccountInput): Promise<{ staffUserId: string }> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()

  if (input.role === 'sales_rep') {
    if (!input.employeeId) throw new EmployeeIdRequiredError()
    if (!EMPLOYEE_ID_PATTERN.test(input.employeeId)) throw new InvalidEmployeeIdFormatError()
  }

  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase()

  const [existingEmail] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)).limit(1)
  if (existingEmail) throw new DuplicateStaffFieldError('email')
  const [existingUsername] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.username, username)).limit(1)
  if (existingUsername) throw new DuplicateStaffFieldError('username')
  if (input.employeeId) {
    const [existingEmployeeId] = await db
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(eq(staffUsers.employeeId, input.employeeId))
      .limit(1)
    if (existingEmployeeId) throw new DuplicateStaffFieldError('employee ID')
  }

  const staffUserId = randomUUID()
  const passwordHash = await hashPassword(input.initialPassword)
  await db.insert(staffUsers).values({
    id: staffUserId,
    name: input.name.trim(),
    email,
    username,
    passwordHash,
    role: input.role,
    employeeId: input.role === 'sales_rep' ? (input.employeeId ?? null) : null,
    status: input.role === 'sales_rep' ? 'pending_id_verification' : 'active',
  })

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.kind === 'ncc_admin' ? actor.staffUserId : null,
    action: 'add_staff_account',
    resourceType: 'staff_user',
    resourceId: staffUserId,
    detail: { role: input.role },
  })

  return { staffUserId }
}

async function setStaffStatus(db: Db, actor: Actor, staffUserId: string, active: boolean): Promise<void> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()
  const [staff] = await db.select({ status: staffUsers.status }).from(staffUsers).where(eq(staffUsers.id, staffUserId)).limit(1)
  if (!staff) throw new StaffAccountNotFoundError()

  const nextStatus = transitionStaff(staff.status, { type: active ? 'reactivate' : 'deactivate' })
  await db.update(staffUsers).set({ status: nextStatus }).where(eq(staffUsers.id, staffUserId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.kind === 'ncc_admin' ? actor.staffUserId : null,
    action: active ? 'reactivate_staff_account' : 'deactivate_staff_account',
    resourceType: 'staff_user',
    resourceId: staffUserId,
  })
}

export const deactivateStaffAccount = (db: Db, actor: Actor, staffUserId: string) => setStaffStatus(db, actor, staffUserId, false)
export const reactivateStaffAccount = (db: Db, actor: Actor, staffUserId: string) => setStaffStatus(db, actor, staffUserId, true)

/**
 * Role change alone never rewinds `status` (an already-activated account
 * stays activated) — but a `sales_rep` must always carry a valid employee
 * ID, so downgrading *to* that role requires one (existing or newly
 * supplied), exactly like creation. Upgrading *away* from `sales_rep`
 * clears it, matching the same "ncc_admin never has one" rule creation
 * already enforces.
 */
export async function updateStaffRole(
  db: Db,
  actor: Actor,
  staffUserId: string,
  newRole: StaffRole,
  employeeId?: string,
): Promise<void> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId)).limit(1)
  if (!staff) throw new StaffAccountNotFoundError()

  let nextEmployeeId: string | null = null
  if (newRole === 'sales_rep') {
    nextEmployeeId = staff.employeeId ?? employeeId?.trim() ?? null
    if (!nextEmployeeId) throw new EmployeeIdRequiredError()
    if (!EMPLOYEE_ID_PATTERN.test(nextEmployeeId)) throw new InvalidEmployeeIdFormatError()
    if (nextEmployeeId !== staff.employeeId) {
      const [existing] = await db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.employeeId, nextEmployeeId)).limit(1)
      if (existing) throw new DuplicateStaffFieldError('employee ID')
    }
  }

  await db.update(staffUsers).set({ role: newRole, employeeId: nextEmployeeId }).where(eq(staffUsers.id, staffUserId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.kind === 'ncc_admin' ? actor.staffUserId : null,
    action: 'update_staff_role',
    resourceType: 'staff_user',
    resourceId: staffUserId,
    detail: { newRole },
  })
}

/** §6.22 "owns assigning/reassigning a sales rep's book of company accounts" — shown read-only on /staff/accounts. */
export async function assignSalesRepCompany(db: Db, actor: Actor, staffUserId: string, companyId: string): Promise<void> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()
  const [existing] = await db
    .select({ id: salesRepAssignments.id })
    .from(salesRepAssignments)
    .where(and(eq(salesRepAssignments.staffUserId, staffUserId), eq(salesRepAssignments.companyId, companyId)))
    .limit(1)
  if (existing) return

  await db.insert(salesRepAssignments).values({ id: randomUUID(), staffUserId, companyId })
  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.kind === 'ncc_admin' ? actor.staffUserId : null,
    action: 'assign_sales_rep_company',
    resourceType: 'staff_user',
    resourceId: staffUserId,
    detail: { companyId },
  })
}

export async function unassignSalesRepCompany(db: Db, actor: Actor, staffUserId: string, companyId: string): Promise<void> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()
  await db
    .delete(salesRepAssignments)
    .where(and(eq(salesRepAssignments.staffUserId, staffUserId), eq(salesRepAssignments.companyId, companyId)))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.kind === 'ncc_admin' ? actor.staffUserId : null,
    action: 'unassign_sales_rep_company',
    resourceType: 'staff_user',
    resourceId: staffUserId,
    detail: { companyId },
  })
}

/** For the "assign a company" picker — every company, so the admin can pick one not yet assigned. */
export async function listAllCompanies(db: Db, actor: Actor): Promise<Array<{ id: string; name: string }>> {
  if (!canManageStaffTeam(actor)) throw new ForbiddenError()
  return db.select({ id: companies.id, name: companies.name }).from(companies)
}
