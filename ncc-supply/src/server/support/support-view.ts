import { and, asc, eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, isCompanyAdmin, ForbiddenError, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { attachments, buyerUsers, staffUsers, supportTicketMessages, supportTickets, type SupportTicketStatus } from '../db/schema'

export interface SupportMessageView {
  id: string
  from: 'customer' | 'staff'
  authorName: string | null
  isInternalNote: boolean
  message: string
  attachmentId: string | null
  createdAt: string
}

export interface SupportTicketView {
  id: string
  status: SupportTicketStatus
  category: string
  orderRequestId: string | null
  returnId: string | null
  buyerUserId: string | null
  guestContactEmail: string | null
  messages: SupportMessageView[]
}

/**
 * Internal notes (`isInternalNote`) are excluded at the query layer, not
 * just left out of some UI, whenever `includeInternalNotes` is false — a
 * stronger boundary than relying on a component to simply not render a
 * field, appropriate given internal notes can contain arbitrary staff
 * commentary about a customer complaint that must never leak to that
 * customer (CLAUDE.md rule 17).
 */
export async function buildSupportTicketView(
  db: Db,
  ticketId: string,
  opts: { includeInternalNotes: boolean },
): Promise<SupportTicketView | null> {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1)
  if (!ticket) return null

  const messageRows = await db
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.supportTicketId, ticketId))
    .orderBy(asc(supportTicketMessages.createdAt))
  const visibleRows = opts.includeInternalNotes ? messageRows : messageRows.filter((row) => !row.isInternalNote)

  const staffAuthorIds = visibleRows.map((row) => row.authorStaffUserId).filter((id): id is string => id !== null)
  const staffAuthors =
    staffAuthorIds.length > 0
      ? await db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, staffAuthorIds))
      : []
  const staffNameById = new Map(staffAuthors.map((staff) => [staff.id, staff.name]))

  const messageIds = visibleRows.map((row) => row.id)
  const attachmentRows =
    messageIds.length > 0
      ? await db
          .select({ id: attachments.id, ownerId: attachments.ownerId })
          .from(attachments)
          .where(and(eq(attachments.ownerType, 'support_ticket_message'), inArray(attachments.ownerId, messageIds)))
      : []
  const attachmentIdByMessageId = new Map(attachmentRows.map((row) => [row.ownerId, row.id]))

  const messages: SupportMessageView[] = visibleRows.map((row) => ({
    id: row.id,
    from: row.authorStaffUserId ? 'staff' : 'customer',
    authorName: row.authorStaffUserId ? (staffNameById.get(row.authorStaffUserId) ?? null) : null,
    isInternalNote: row.isInternalNote,
    message: row.message,
    attachmentId: attachmentIdByMessageId.get(row.id) ?? null,
    createdAt: row.createdAt,
  }))

  return {
    id: ticket.id,
    status: ticket.status,
    category: ticket.category,
    orderRequestId: ticket.orderRequestId,
    returnId: ticket.returnId,
    buyerUserId: ticket.buyerUserId,
    guestContactEmail: ticket.guestContactEmail,
    messages,
  }
}

/**
 * Session-gated equivalent of the guest token check, for both a buyer and
 * staff — a single accessor since `canViewCompanyResource` already
 * distinguishes all four actor kinds correctly. Internal notes are visible
 * to staff (sales_rep included — read-only, not invisible) and hidden from
 * a buyer.
 */
export async function getSupportTicketViewForActor(
  db: Db,
  actor: Actor,
  ticketId: string,
): Promise<SupportTicketView | null> {
  const [ticket] = await db
    .select({ id: supportTickets.id, buyerUserId: supportTickets.buyerUserId })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1)
  if (!ticket) return null

  const companyId = ticket.buyerUserId ? await companyIdForBuyer(db, ticket.buyerUserId) : null
  if (!canViewCompanyResource(actor, { companyId, ownerBuyerUserId: ticket.buyerUserId })) {
    throw new ForbiddenError()
  }

  const includeInternalNotes = actor.kind === 'sales_rep' || actor.kind === 'ncc_admin'
  return buildSupportTicketView(db, ticketId, { includeInternalNotes })
}

async function companyIdForBuyer(db: Db, buyerUserId: string): Promise<string | null> {
  const [buyer] = await db.select({ companyId: buyerUsers.companyId }).from(buyerUsers).where(eq(buyerUsers.id, buyerUserId)).limit(1)
  return buyer?.companyId ?? null
}

export interface SupportTicketSummary {
  id: string
  status: SupportTicketStatus
  category: string
  createdAt: string
  messageCount: number
}

async function toSummary(db: Db, ticket: typeof supportTickets.$inferSelect): Promise<SupportTicketSummary> {
  const messages = await db
    .select({ id: supportTicketMessages.id })
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.supportTicketId, ticket.id))
  return { id: ticket.id, status: ticket.status, category: ticket.category, createdAt: ticket.createdAt, messageCount: messages.length }
}

export async function listSupportTicketsForActor(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }>,
): Promise<SupportTicketSummary[]> {
  const buyerIds = isCompanyAdmin(actor)
    ? (await db.select({ id: buyerUsers.id }).from(buyerUsers).where(eq(buyerUsers.companyId, actor.companyId))).map((row) => row.id)
    : [actor.buyerUserId]
  if (buyerIds.length === 0) return []

  const rows = await db.select().from(supportTickets).where(inArray(supportTickets.buyerUserId, buyerIds))
  const summaries = await Promise.all(rows.map((row) => toSummary(db, row)))
  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
