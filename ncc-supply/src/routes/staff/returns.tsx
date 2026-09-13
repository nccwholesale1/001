import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../server/staff/server-functions'
import { listStaffReturns } from '../../server/returns/staff-return-server-functions'
import { StatusChip } from '../../components/ui/StatusChip'
import { RETURN_STATUS_DISPLAY } from '../../components/ui/ReturnDetail'
import { Container, Section } from '../../components/ui/Layout'
import { StaffNav } from '../../components/ui/StaffNav'

/** PRD §6.20 "Staff: return/RMA queue" — mirrors /staff/orders exactly. */
export const Route = createFileRoute('/staff/returns')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: () => listStaffReturns(),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Return Queue · NCC Staff' }] }),
  component: StaffReturnsRoute,
})

function StaffReturnsRoute() {
  const returnList = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <StaffNav />
        <h1 className="text-2xl font-semibold text-foreground">Return Queue</h1>
        {returnList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No return requests yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {returnList.map((ret) => (
              <a
                key={ret.id}
                href={`/staff/return/${ret.id}`}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 no-underline hover:no-underline"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">Return {ret.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ret.lineCount} line{ret.lineCount === 1 ? '' : 's'} · {ret.reason} · requested{' '}
                    {new Date(ret.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip
                  tone={RETURN_STATUS_DISPLAY[ret.status]?.tone ?? 'info'}
                  label={RETURN_STATUS_DISPLAY[ret.status]?.label ?? ret.status}
                />
              </a>
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
