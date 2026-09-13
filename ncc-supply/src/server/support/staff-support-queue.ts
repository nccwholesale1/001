import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, supportTicketMessages, supportTickets } from '../db/schema'
import type { SupportTicketSummary } from './support-view'

/** The `/staff/support` queue (PRD §6.21) — mirrors the other staff queues exactly. */
export async function listSupportTicketsForStaff(
  db: Db,
  actor: Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }>,
): Promise<SupportTicketSummary[]> {
  const rows = await db.select().from(supportTickets)

  const buyerIds = rows.map((row) => row.buyerUserId).filter((id): id is string => id !== null)
  const buyers =
    buyerIds.length > 0
      ? await db.select({ id: buyerUsers.id, companyId: buyerUsers.companyId }).from(buyerUsers).where(inArray(buyerUsers.id, buyerIds))
      : []
  const companyIdByBuyerId = new Map(buyers.map((buyer) => [buyer.id, buyer.companyId]))

  const visible = rows.filter((row) => {
    const companyId = row.buyerUserId ? (companyIdByBuyerId.get(row.buyerUserId) ?? null) : null
    return canViewCompanyResource(actor, { companyId, ownerBuyerUserId: row.buyerUserId })
  })

  const summaries: SupportTicketSummary[] = []
  for (const row of visible) {
    const messages = await db
      .select({ id: supportTicketMessages.id })
      .from(supportTicketMessages)
      .where(eq(supportTicketMessages.supportTicketId, row.id))
    summaries.push({ id: row.id, status: row.status, category: row.category, createdAt: row.createdAt, messageCount: messages.length })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
