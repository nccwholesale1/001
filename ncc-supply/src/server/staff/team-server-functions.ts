import { createServerFn } from '@tanstack/react-start'
import {
  addStaffAccountSchema,
  salesRepCompanyAssignmentSchema,
  staffAccountIdSchema,
  updateStaffRoleSchema,
} from '../validation/commands'
import { db } from '../db/client'
import { requireStaffActor } from './staff-session'
import {
  addStaffAccount,
  assignSalesRepCompany,
  deactivateStaffAccount,
  listAllCompanies,
  listStaffAccounts,
  reactivateStaffAccount,
  unassignSalesRepCompany,
  updateStaffRole,
  type StaffAccountSummary,
} from './team-management'

export const listTeamAccounts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StaffAccountSummary[]> => {
    const actor = await requireStaffActor(db)
    return listStaffAccounts(db, actor)
  },
)

export const listCompaniesForAssignment = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<{ id: string; name: string }>> => {
    const actor = await requireStaffActor(db)
    return listAllCompanies(db, actor)
  },
)

export const addTeamAccount = createServerFn({ method: 'POST' })
  .validator(addStaffAccountSchema.parse)
  .handler(async ({ data }): Promise<{ staffUserId: string }> => {
    const actor = await requireStaffActor(db)
    return addStaffAccount(db, actor, data)
  })

export const deactivateTeamAccount = createServerFn({ method: 'POST' })
  .validator(staffAccountIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await deactivateStaffAccount(db, actor, data.staffUserId)
  })

export const reactivateTeamAccount = createServerFn({ method: 'POST' })
  .validator(staffAccountIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await reactivateStaffAccount(db, actor, data.staffUserId)
  })

export const assignTeamCompany = createServerFn({ method: 'POST' })
  .validator(salesRepCompanyAssignmentSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await assignSalesRepCompany(db, actor, data.staffUserId, data.companyId)
  })

export const unassignTeamCompany = createServerFn({ method: 'POST' })
  .validator(salesRepCompanyAssignmentSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await unassignSalesRepCompany(db, actor, data.staffUserId, data.companyId)
  })

export const updateTeamAccountRole = createServerFn({ method: 'POST' })
  .validator(updateStaffRoleSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await updateStaffRole(db, actor, data.staffUserId, data.role, data.employeeId)
  })
