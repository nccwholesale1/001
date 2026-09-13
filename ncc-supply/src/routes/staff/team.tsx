import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { getCurrentStaff } from '../../server/staff/server-functions'
import {
  addTeamAccount,
  assignTeamCompany,
  deactivateTeamAccount,
  listCompaniesForAssignment,
  listTeamAccounts,
  reactivateTeamAccount,
  unassignTeamCompany,
  updateTeamAccountRole,
} from '../../server/staff/team-server-functions'
import type { StaffAccountSummary } from '../../server/staff/team-management'
import type { StaffRole } from '../../server/db/schema'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Container, Section } from '../../components/ui/Layout'
import { StatusChip } from '../../components/ui/StatusChip'
import { StaffNav } from '../../components/ui/StaffNav'

const STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  pending_id_verification: { label: 'Pending ID Verification', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  deactivated: { label: 'Deactivated', tone: 'danger' },
}

/** PRD §6.22 "Staff: team management" — NCC admin only, no read-only access for any other role. */
export const Route = createFileRoute('/staff/team')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
    if (staff.role !== 'ncc_admin') throw redirect({ to: '/staff/orders' })
  },
  loader: async () => {
    const [accounts, companies] = await Promise.all([listTeamAccounts(), listCompaniesForAssignment()])
    return { accounts, companies }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Team · NCC Staff' }] }),
  component: StaffTeamRoute,
})

function StaffTeamRoute() {
  const { accounts: initialAccounts, companies } = Route.useLoaderData()
  const [accounts, setAccounts] = useState<StaffAccountSummary[]>(initialAccounts)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<StaffRole>('sales_rep')
  const [initialPassword, setInitialPassword] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assignCompanyByStaffId, setAssignCompanyByStaffId] = useState<Record<string, string>>({})

  const add = useServerFn(addTeamAccount)
  const deactivate = useServerFn(deactivateTeamAccount)
  const reactivate = useServerFn(reactivateTeamAccount)
  const assign = useServerFn(assignTeamCompany)
  const unassign = useServerFn(unassignTeamCompany)
  const updateRole = useServerFn(updateTeamAccountRole)
  const refresh = useServerFn(listTeamAccounts)
  const [roleEditId, setRoleEditId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<StaffRole>('sales_rep')
  const [pendingEmployeeId, setPendingEmployeeId] = useState('')
  const [roleError, setRoleError] = useState<string | null>(null)

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    setAddError(null)
    if (role === 'sales_rep' && !employeeId.trim()) {
      setAddError('An employee ID is required for a sales rep account.')
      return
    }
    setAdding(true)
    try {
      await add({
        data: {
          name: name.trim(),
          email: email.trim(),
          username: username.trim(),
          role,
          initialPassword,
          employeeId: role === 'sales_rep' ? employeeId.trim() : undefined,
        },
      })
      setAccounts(await refresh())
      setName('')
      setEmail('')
      setUsername('')
      setInitialPassword('')
      setEmployeeId('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add that account.')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleActive(account: StaffAccountSummary) {
    setBusyId(account.id)
    try {
      if (account.status === 'deactivated') await reactivate({ data: { staffUserId: account.id } })
      else await deactivate({ data: { staffUserId: account.id } })
      setAccounts(await refresh())
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssign(staffUserId: string) {
    const companyId = assignCompanyByStaffId[staffUserId]
    if (!companyId) return
    setBusyId(staffUserId)
    try {
      await assign({ data: { staffUserId, companyId } })
      setAccounts(await refresh())
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnassign(staffUserId: string, companyId: string) {
    setBusyId(staffUserId)
    try {
      await unassign({ data: { staffUserId, companyId } })
      setAccounts(await refresh())
    } finally {
      setBusyId(null)
    }
  }

  function startRoleEdit(account: StaffAccountSummary) {
    setRoleEditId(account.id)
    setPendingRole(account.role)
    setPendingEmployeeId(account.employeeId ?? '')
    setRoleError(null)
  }

  async function handleSaveRole(staffUserId: string) {
    setBusyId(staffUserId)
    setRoleError(null)
    try {
      await updateRole({ data: { staffUserId, role: pendingRole, employeeId: pendingEmployeeId.trim() || undefined } })
      setAccounts(await refresh())
      setRoleEditId(null)
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Could not update that role.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Section>
      <Container className="flex flex-col gap-8">
        <StaffNav />
        <h1 className="text-2xl font-semibold text-foreground">Team</h1>

        <form onSubmit={handleAdd} className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add account</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            <Field
              label="Initial password"
              type="password"
              required
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              helpText="At least 8 characters."
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="staff-role">
                Role
              </label>
              <select
                id="staff-role"
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="sales_rep">Sales rep</option>
                <option value="ncc_admin">NCC admin</option>
              </select>
            </div>
            {role === 'sales_rep' ? (
              <Field
                label="Employee ID"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                helpText="Required before this account can activate."
              />
            ) : null}
          </div>
          {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
          <Button type="submit" disabled={adding} className="w-fit">
            {adding ? 'Adding…' : 'Add account'}
          </Button>
        </form>

        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <div key={account.id} className="surface-card flex flex-col gap-3 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {account.name} <span className="text-muted-foreground">· {account.role === 'ncc_admin' ? 'NCC admin' : 'Sales rep'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.email} · @{account.username}
                    {account.employeeId ? ` · ID ${account.employeeId}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip
                    tone={STATUS_DISPLAY[account.status]?.tone ?? 'info'}
                    label={STATUS_DISPLAY[account.status]?.label ?? account.status}
                  />
                  <Button variant="secondary" onClick={() => startRoleEdit(account)} disabled={busyId === account.id}>
                    Change role
                  </Button>
                  <Button variant="secondary" onClick={() => handleToggleActive(account)} disabled={busyId === account.id}>
                    {account.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                  </Button>
                </div>
              </div>

              {roleEditId === account.id ? (
                <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground" htmlFor={`role-${account.id}`}>
                      Role
                    </label>
                    <select
                      id={`role-${account.id}`}
                      value={pendingRole}
                      onChange={(e) => setPendingRole(e.target.value as StaffRole)}
                      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
                    >
                      <option value="sales_rep">Sales rep</option>
                      <option value="ncc_admin">NCC admin</option>
                    </select>
                  </div>
                  {pendingRole === 'sales_rep' ? (
                    <Field
                      label="Employee ID"
                      value={pendingEmployeeId}
                      onChange={(e) => setPendingEmployeeId(e.target.value)}
                    />
                  ) : null}
                  <Button onClick={() => handleSaveRole(account.id)} disabled={busyId === account.id}>
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => setRoleEditId(null)}>
                    Cancel
                  </Button>
                  {roleError ? <p className="text-sm text-destructive">{roleError}</p> : null}
                </div>
              ) : null}

              {account.role === 'sales_rep' ? (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assigned companies
                  </span>
                  {account.assignedCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {account.assignedCompanies.map((company) => (
                        <span
                          key={company.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs"
                        >
                          {company.name}
                          <button
                            type="button"
                            onClick={() => handleUnassign(account.id, company.id)}
                            aria-label={`Unassign ${company.name}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={assignCompanyByStaffId[account.id] ?? ''}
                      onChange={(e) => setAssignCompanyByStaffId((prev) => ({ ...prev, [account.id]: e.target.value }))}
                      className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm"
                    >
                      <option value="">Select a company…</option>
                      {companies
                        .filter((c) => !account.assignedCompanies.some((ac) => ac.id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="secondary"
                      onClick={() => handleAssign(account.id)}
                      disabled={busyId === account.id || !assignCompanyByStaffId[account.id]}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
