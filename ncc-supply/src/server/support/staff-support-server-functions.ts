import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireStaffActor } from '../staff/staff-session'
import { db } from '../db/client'
import { staffSupportReplySchema } from '../validation/commands'
import { getSupportTicketViewForActor, type SupportTicketSummary, type SupportTicketView } from './support-view'
import { listSupportTicketsForStaff } from './staff-support-queue'
import { escalateSupportTicket, getGuestSupportLink, replyAsStaff, resolveSupportTicket } from './support-processing'

export const listStaffSupportTickets = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SupportTicketSummary[]> => {
    const actor = await requireStaffActor(db)
    return listSupportTicketsForStaff(db, actor)
  },
)

const ticketIdSchema = z.object({ ticketId: z.string().min(1) })

export const getStaffSupportTicketDetail = createServerFn({ method: 'GET' })
  .validator(ticketIdSchema.parse)
  .handler(async ({ data }): Promise<SupportTicketView | null> => {
    const actor = await requireStaffActor(db)
    return getSupportTicketViewForActor(db, actor, data.ticketId)
  })

export const staffReplySupportTicket = createServerFn({ method: 'POST' })
  .validator(staffSupportReplySchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await replyAsStaff(db, actor, data)
  })

export const resolveStaffSupportTicket = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await resolveSupportTicket(db, actor, data.ticketId)
  })

export const escalateStaffSupportTicket = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await escalateSupportTicket(db, actor, data.ticketId)
  })

export const getSupportCustomerLink = createServerFn({ method: 'POST' })
  .validator(ticketIdSchema.parse)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const actor = await requireStaffActor(db)
    const url = await getGuestSupportLink(db, actor, data.ticketId)
    return { url }
  })
