import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { getCurrentStaff } from '../../../server/staff/server-functions'
import {
  escalateStaffSupportTicket,
  getStaffSupportTicketDetail,
  getSupportCustomerLink,
  resolveStaffSupportTicket,
  staffReplySupportTicket,
} from '../../../server/support/staff-support-server-functions'
import { getAttachmentDataUrl } from '../../../server/attachments/server-functions'
import { fileToBase64 } from '../../../lib/file-to-base64'
import { Button } from '../../../components/ui/Button'
import { TextareaField } from '../../../components/ui/Field'
import { Container, Section } from '../../../components/ui/Layout'
import { StatusChip } from '../../../components/ui/StatusChip'
import { SUPPORT_STATUS_DISPLAY, SupportTicketDetail } from '../../../components/ui/SupportTicketDetail'

export const Route = createFileRoute('/staff/support/$id')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: async ({ params }) => {
    const staff = await getCurrentStaff()
    let ticket
    try {
      ticket = await getStaffSupportTicketDetail({ data: { ticketId: params.id } })
    } catch {
      throw redirect({ to: '/staff/support' })
    }
    if (!ticket) throw notFound()
    return { ticket, isNccAdmin: staff?.role === 'ncc_admin' }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Support Ticket · NCC Staff' }] }),
  component: StaffSupportTicketRoute,
})

function StaffSupportTicketRoute() {
  const { ticket: initialTicket, isNccAdmin } = Route.useLoaderData()
  const [ticket, setTicket] = useState(initialTicket)
  const [message, setMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})

  const reply = useServerFn(staffReplySupportTicket)
  const resolve = useServerFn(resolveStaffSupportTicket)
  const escalate = useServerFn(escalateStaffSupportTicket)
  const fetchCustomerLink = useServerFn(getSupportCustomerLink)
  const fetchAttachment = useServerFn(getAttachmentDataUrl)
  const refreshDetail = useServerFn(getStaffSupportTicketDetail)

  async function refresh() {
    const fresh = await refreshDetail({ data: { ticketId: ticket.id } })
    if (fresh) setTicket(fresh)
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      setError('Enter a message.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const attachment = file ? { filename: file.name, base64: await fileToBase64(file) } : undefined
      await reply({ data: { ticketId: ticket.id, message: message.trim(), isInternalNote, attachment } })
      await refresh()
      setMessage('')
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that reply.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResolve() {
    setBusy(true)
    setError(null)
    try {
      await resolve({ data: { ticketId: ticket.id } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve this ticket.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEscalate() {
    setBusy(true)
    setError(null)
    try {
      await escalate({ data: { ticketId: ticket.id } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not escalate this ticket.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await fetchCustomerLink({ data: { ticketId: ticket.id } })
      if (!url) {
        setError('This ticket has no guest link — it belongs to a signed-in company buyer.')
        return
      }
      await navigator.clipboard.writeText(`${window.location.origin}${url}`)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a customer link.')
    } finally {
      setBusy(false)
    }
  }

  async function handleViewAttachment(attachmentId: string) {
    const result = await fetchAttachment({ data: { attachmentId } })
    if (result) setAttachmentUrls((prev) => ({ ...prev, [attachmentId]: result.dataUrl }))
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Ticket {ticket.id.slice(0, 8)}</h1>
          <StatusChip
            tone={SUPPORT_STATUS_DISPLAY[ticket.status]?.tone ?? 'info'}
            label={SUPPORT_STATUS_DISPLAY[ticket.status]?.label ?? ticket.status}
          />
        </div>

        {!isNccAdmin ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Read-only — only an NCC admin can reply, resolve, or escalate this ticket.
          </p>
        ) : null}

        <SupportTicketDetail
          ticket={ticket}
          bare
          actions={
            <div className="flex flex-col gap-2">
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
            </div>
          }
        />

        {isNccAdmin ? (
          <form onSubmit={handleReply} className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <TextareaField label="Reply" value={message} onChange={(event) => setMessage(event.target.value)} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isInternalNote} onChange={(event) => setIsInternalNote(event.target.checked)} />
              Internal note (never shown to the customer)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? 'Sending…' : isInternalNote ? 'Add note' : 'Send reply'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleResolve} disabled={busy}>
                Resolve
              </Button>
              <Button type="button" variant="secondary" onClick={handleEscalate} disabled={busy}>
                Escalate
              </Button>
              <Button type="button" variant="secondary" onClick={handleCopyLink} disabled={busy}>
                {linkCopied ? 'Copied!' : 'Copy customer link'}
              </Button>
            </div>
          </form>
        ) : null}
      </Container>
    </Section>
  )
}
