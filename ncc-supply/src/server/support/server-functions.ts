import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentActor, requireActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { supportTicketRequestSchema } from '../validation/commands'
import { getSupportTicketViewForActor, listSupportTicketsForActor, type SupportTicketSummary, type SupportTicketView } from './support-view'
import { submitSupportTicket, type SubmitSupportTicketResult } from './submit-support-ticket'

/** Safe with no auth gate — same reasoning as `submitReturn`: creating a new ticket needs no proof beyond what an optional reference already verifies internally. */
export const submitSupportTicketFn = createServerFn({ method: 'POST' })
  .validator(supportTicketRequestSchema.parse)
  .handler(async ({ data }): Promise<SubmitSupportTicketResult> => {
    const actor = await getCurrentActor(db)
    return submitSupportTicket(db, actor, data)
  })

export const listMySupportTickets = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SupportTicketSummary[]> => {
    const actor = await requireActor(db)
    return listSupportTicketsForActor(db, actor)
  },
)

const ticketIdSchema = z.object({ ticketId: z.string().min(1) })

export const getMySupportTicketDetail = createServerFn({ method: 'GET' })
  .validator(ticketIdSchema.parse)
  .handler(async ({ data }): Promise<SupportTicketView | null> => {
    const actor = await requireActor(db)
    return getSupportTicketViewForActor(db, actor, data.ticketId)
  })
