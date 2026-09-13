import { eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Actor } from '../auth/authorization'
import { getCurrentActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { supportTicketMessages } from '../db/schema'
import { getReturnViewForActor } from '../returns/return-view'
import { getCurrentStaffActor } from '../staff/staff-session'
import { getSupportTicketViewForActor } from '../support/support-view'
import { verifyGuestToken } from '../tokens/token-service'
import { getAttachment } from './attachments'

/** Buyer session first, then staff session — either can own an authenticated view of a return/ticket. */
async function getCurrentViewerActor(): Promise<Actor | null> {
  const buyer = await getCurrentActor(db)
  if (buyer) return buyer
  return getCurrentStaffActor(db)
}

const attachmentAccessSchema = z.object({
  attachmentId: z.string().min(1),
  /** A guest proves access with the same token their return/ticket status page uses. */
  token: z.string().optional(),
})

export interface AttachmentDataUrl {
  filename: string
  contentType: string
  dataUrl: string
}

/**
 * Never a public static path (rule 21's "serve through authorized expiring
 * access") — re-runs the owning resource's own real authorization check
 * (the same one its status page uses) before releasing any bytes, whether
 * that's a guest token or a signed-in actor's session. Returned as a data
 * URL rather than a raw byte stream since this project has no raw HTTP
 * route mechanism set up — a data URL keeps this a plain, typed
 * `createServerFn` like everywhere else, and attachments are capped small
 * enough (5MB) for this to stay practical.
 */
export const getAttachmentDataUrl = createServerFn({ method: 'GET' })
  .validator(attachmentAccessSchema.parse)
  .handler(async ({ data }): Promise<AttachmentDataUrl | null> => {
    const attachment = await getAttachment(db, data.attachmentId)
    if (!attachment) return null

    if (attachment.ownerType === 'return') {
      const returnId = attachment.ownerId
      if (data.token) {
        const verification = await verifyGuestToken(db, data.token, 'return')
        if (!verification || verification.resourceId !== returnId) return null
      } else {
        const actor = await getCurrentViewerActor()
        if (!actor) return null
        try {
          const view = await getReturnViewForActor(db, actor, returnId)
          if (!view) return null
        } catch {
          return null
        }
      }
    } else {
      const [message] = await db
        .select({ supportTicketId: supportTicketMessages.supportTicketId })
        .from(supportTicketMessages)
        .where(eq(supportTicketMessages.id, attachment.ownerId))
        .limit(1)
      if (!message) return null
      const ticketId = message.supportTicketId

      if (data.token) {
        const verification = await verifyGuestToken(db, data.token, 'support_ticket')
        if (!verification || verification.resourceId !== ticketId) return null
      } else {
        const actor = await getCurrentViewerActor()
        if (!actor) return null
        try {
          const view = await getSupportTicketViewForActor(db, actor, ticketId)
          if (!view) return null
        } catch {
          return null
        }
      }
    }

    return {
      filename: attachment.filename,
      contentType: attachment.contentType,
      dataUrl: `data:${attachment.contentType};base64,${attachment.data.toString('base64')}`,
    }
  })
