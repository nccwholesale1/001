import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../../server/staff/server-functions'
import { listStaffSupportTickets } from '../../../server/support/staff-support-server-functions'
import { StatusChip } from '../../../components/ui/StatusChip'
import { SUPPORT_STATUS_DISPLAY } from '../../../components/ui/SupportTicketDetail'
import { Container, Section } from '../../../components/ui/Layout'
import { StaffNav } from '../../../components/ui/StaffNav'

/** PRD §6.21 "Staff: support/complaints queue" — mirrors the other staff queues exactly. */
export const Route = createFileRoute('/staff/support/')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: () => listStaffSupportTickets(),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Support Queue · NCC Staff' }] }),
  component: StaffSupportQueueRoute,
})

function StaffSupportQueueRoute() {
  const tickets = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <StaffNav />
        <h1 className="text-2xl font-semibold text-foreground">Support Queue</h1>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No support tickets yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <a
                key={ticket.id}
                href={`/staff/support/${ticket.id}`}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 no-underline hover:no-underline"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">Ticket {ticket.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.category} · {ticket.messageCount} message{ticket.messageCount === 1 ? '' : 's'} · opened{' '}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip
                  tone={SUPPORT_STATUS_DISPLAY[ticket.status]?.tone ?? 'info'}
                  label={SUPPORT_STATUS_DISPLAY[ticket.status]?.label ?? ticket.status}
                />
              </a>
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
