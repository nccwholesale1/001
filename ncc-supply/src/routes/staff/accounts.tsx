import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../server/staff/server-functions'
import { listStaffCompanies } from '../../server/staff/company-directory-server-functions'
import { Container, Section } from '../../components/ui/Layout'
import { StaffNav } from '../../components/ui/StaffNav'

function formatSpendLimit(pence: number | null): string {
  return pence === null ? 'No limit' : `£${(pence / 100).toFixed(2)}`
}

/**
 * PRD §6.15 "Staff: company accounts" — read-only for both roles in this
 * pass (an ncc_admin sees every company, a sales rep only their assigned
 * book): buyer users + spend limits for support purposes, and each
 * company's assigned sales rep. Contract/tier pricing administration is
 * out of scope — ADR-005 already resolved this build to uniform list
 * pricing with no per-company pricing at all. Staff-initiated *creation*
 * of a brand-new company is a recorded gap (DECISIONS.md) — every company
 * today is created by a buyer's own Shopify sign-in.
 */
export const Route = createFileRoute('/staff/accounts')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: () => listStaffCompanies(),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Company Accounts · NCC Staff' }] }),
  component: StaffAccountsRoute,
})

function StaffAccountsRoute() {
  const companies = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <StaffNav />
        <h1 className="text-2xl font-semibold text-foreground">Company Accounts</h1>
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No company accounts visible to you yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {companies.map((company) => (
              <div key={company.id} className="surface-card flex flex-col gap-3 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">{company.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {company.assignedSalesRep ? `Rep: ${company.assignedSalesRep.name}` : 'No sales rep assigned'}
                  </span>
                </div>
                {company.buyers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No buyer users yet.</p>
                ) : (
                  <div className="flex flex-col gap-1 border-t border-border pt-3">
                    {company.buyers.map((buyer) => (
                      <div key={buyer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-foreground">
                          {buyer.name} <span className="text-muted-foreground">({buyer.email})</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {buyer.role === 'company_admin' ? 'Admin' : 'Buyer'} · {buyer.status} · {formatSpendLimit(buyer.spendLimit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
