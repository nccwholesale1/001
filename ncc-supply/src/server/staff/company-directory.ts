import { inArray } from 'drizzle-orm'
import { ForbiddenError, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, companies, salesRepAssignments, staffUsers } from '../db/schema'

export interface StaffCompanyBuyerSummary {
  id: string
  name: string
  email: string
  role: string
  status: string
  spendLimit: number | null
}

export interface StaffCompanySummary {
  id: string
  name: string
  buyers: StaffCompanyBuyerSummary[]
  assignedSalesRep: { id: string; name: string } | null
}

/**
 * PRD §6.15 "view each company's buyer users and spend-limit configuration
 * for support purposes" plus "which sales rep, if any, it's assigned to
 * (read-only — assignment itself is owned by /staff/team)". An ncc_admin
 * sees every company; a sales rep sees only their own assigned book,
 * read-only either way (this module has no mutation at all — company
 * creation is a recorded gap, see DECISIONS.md).
 */
export async function listCompaniesForStaff(db: Db, actor: Actor): Promise<StaffCompanySummary[]> {
  if (actor.kind === 'guest' || actor.kind === 'buyer') throw new ForbiddenError()

  const allCompanies = await db.select().from(companies)
  const visibleCompanies =
    actor.kind === 'ncc_admin' ? allCompanies : allCompanies.filter((company) => actor.assignedCompanyIds.includes(company.id))
  if (visibleCompanies.length === 0) return []

  const companyIds = visibleCompanies.map((company) => company.id)
  const buyers = await db.select().from(buyerUsers).where(inArray(buyerUsers.companyId, companyIds))
  const buyersByCompanyId = new Map<string, StaffCompanyBuyerSummary[]>()
  for (const buyer of buyers) {
    const list = buyersByCompanyId.get(buyer.companyId) ?? []
    list.push({ id: buyer.id, name: buyer.name, email: buyer.email, role: buyer.role, status: buyer.status, spendLimit: buyer.spendLimit })
    buyersByCompanyId.set(buyer.companyId, list)
  }

  const assignments = await db
    .select({ companyId: salesRepAssignments.companyId, staffUserId: salesRepAssignments.staffUserId })
    .from(salesRepAssignments)
    .where(inArray(salesRepAssignments.companyId, companyIds))
  const staffIds = assignments.map((row) => row.staffUserId)
  const staff = staffIds.length > 0 ? await db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, staffIds)) : []
  const staffNameById = new Map(staff.map((row) => [row.id, row.name]))
  const repByCompanyId = new Map(
    assignments.map((row) => [row.companyId, staffNameById.get(row.staffUserId) ? { id: row.staffUserId, name: staffNameById.get(row.staffUserId) as string } : null]),
  )

  return visibleCompanies.map((company) => ({
    id: company.id,
    name: company.name,
    buyers: buyersByCompanyId.get(company.id) ?? [],
    assignedSalesRep: repByCompanyId.get(company.id) ?? null,
  }))
}
