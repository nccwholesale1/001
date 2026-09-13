import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { getCurrentActor } from '../../server/buyers/buyer-session'
import { db } from '../../server/db/client'
import { buildSupportTicketView, getSupportTicketViewForActor, type SupportTicketView } from '../../server/support/support-view'
import { replyAsCustomer } from '../../server/support/support-processing'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { getAttachmentDataUrl } from '../../server/attachments/server-functions'
import { supportTicketMessageSchema } from '../../server/validation/commands'
import { checkRateLimitByIp } from '../../server/shared/rate-limit'
import { fileToBase64 } from '../../lib/file-to-base64'
import { Button } from '../../components/ui/Button'
import { TextareaField } from '../../components/ui/Field'
import { Container, Section } from '../../components/ui/Layout'
import { SupportTicketDetail } from '../../components/ui/SupportTicketDetail'

const supportTicketDetailQuerySchema = z.object({ ticketId: z.string().min(1), token: z.string().optional() }).strict()

/** Dual access, mirroring `checkout/$id.tsx::getCheckoutView` — a customer never sees another customer's internal notes (buildSupportTicketView's own `includeInternalNotes: false`). */
const getSupportTicketDetailView = createServerFn({ method: 'GET' })
  .validator(supportTicketDetailQuerySchema.parse)
  .handler(async ({ data }): Promise<SupportTicketView | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'support_ticket')
      if (!verification || verification.resourceId !== data.ticketId) return null
      return buildSupportTicketView(db, data.ticketId, { includeInternalNotes: false })
    }
    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      return await getSupportTicketViewForActor(db, actor, data.ticketId)
    } catch {
      return null
    }
  })

/** Authorization mirrors the view above — same reasoning as quote acceptance (Phase 9 decision 8). */
const replyToTicketAction = createServerFn({ method: 'POST' })
  .validator(supportTicketMessageSchema.parse)
  .handler(async ({ data }): Promise<boolean> => {
    checkRateLimitByIp('support-reply', { limit: 20, windowMs: 60 * 60 * 1000 })
    let buyerUserId: string | null = null
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'support_ticket')
      if (!verification || verification.resourceId !== data.ticketId) return false
    } else {
      const actor = await getCurrentActor(db)
      if (!actor) return false
      try {
        const view = await getSupportTicketViewForActor(db, actor, data.ticketId)
        if (!view) return false
      } catch {
        return false
      }
      buyerUserId = actor.buyerUserId
    }
    await replyAsCustomer(db, data.ticketId, buyerUserId, { message: data.message, attachment: data.attachment })
    return true
  })

const supportDetailSearchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/support/$id')({
  validateSearch: supportDetailSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const ticket = await getSupportTicketDetailView({ data: { ticketId: params.id, token: deps.token } })
    if (!ticket) throw notFound()
    return { ticket, token: deps.token }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Support Ticket · NCC Supply' }] }),
  notFoundComponent: SupportTicketNotFound,
  component: SupportTicketRoute,
})

function SupportTicketNotFound() {
  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-foreground">We couldn't find that ticket</h1>
        <p className="text-sm text-muted-foreground">
          The link may be incorrect, expired, or no longer valid.
        </p>
      </Container>
    </Section>
  )
}

function SupportTicketRoute() {
  const { ticket: initialTicket, token } = Route.useLoaderData()
  const [ticket, setTicket] = useState(initialTicket)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})

  const doReply = useServerFn(replyToTicketAction)
  const refreshTicket = useServerFn(getSupportTicketDetailView)
  const fetchAttachment = useServerFn(getAttachmentDataUrl)

  const canReply = ticket.status === 'awaiting_customer' || ticket.status === 'resolved'

  async function handleReply(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!message.trim()) {
      setError('Enter a message.')
      return
    }
    setSubmitting(true)
    try {
      const attachment = file ? { filename: file.name, base64: await fileToBase64(file) } : undefined
      const ok = await doReply({ data: { ticketId: ticket.id, token, message: message.trim(), attachment } })
      if (!ok) {
        setError('Could not send your reply. Refresh and try again.')
        return
      }
      const fresh = await refreshTicket({ data: { ticketId: ticket.id, token } })
      if (fresh) setTicket(fresh)
      setMessage('')
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your reply.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleViewAttachment(attachmentId: string) {
    const result = await fetchAttachment({ data: { attachmentId, token } })
    if (result) setAttachmentUrls((prev) => ({ ...prev, [attachmentId]: result.dataUrl }))
  }

  return (
    <SupportTicketDetail
      ticket={ticket}
      actions={
        <div className="flex flex-col gap-4">
          {ticket.messages
            .filter((m) => m.attachmentId)
            .map((m) => (
              <div key={m.id}>
                {attachmentUrls[m.attachmentId as string] ? (
                  <img
                    src={attachmentUrls[m.attachmentId as string]}
                    alt="Attachment"
                    className="max-w-xs rounded-lg border border-border"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleViewAttachment(m.attachmentId as string)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View attachment
                  </button>
                )}
              </div>
            ))}

          {canReply ? (
            <form onSubmit={handleReply} className="surface-card flex flex-col gap-3 rounded-xl p-5">
              <TextareaField
                label="Reply"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-sm text-muted-foreground"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting ? 'Sending…' : 'Send reply'}
              </Button>
            </form>
          ) : ticket.status !== 'resolved' ? (
            <p className="text-sm text-muted-foreground">Waiting on NCC's next reply.</p>
          ) : null}
        </div>
      }
    />
  )
}
