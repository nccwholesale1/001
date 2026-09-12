import { createFileRoute, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import {
  getCurrentBuyerSummary,
  inviteCompanyBuyer,
  listCompanyBuyers,
  removeCompanyBuyer,
  updateCompanyBuyer,
} from '../../server/buyers/server-functions'
import type { BuyerRole } from '../../server/db/schema'
import { Button } from '../../components/ui/Button'
import { BuyerUserTable } from '../../components/ui/BuyerUserTable'
import { Field } from '../../components/ui/Field'

export const Route = createFileRoute('/account/users')({
  beforeLoad: async () => {
    const summary = await getCurrentBuyerSummary()
    if (!summary || summary.role !== 'company_admin') throw redirect({ to: '/account' })
  },
  loader: () => listCompanyBuyers(),
  head: () => ({ meta: [{ title: 'Users · NCC Supply' }] }),
  component: AccountUsersRoute,
})

function AccountUsersRoute() {
  const initialBuyers = Route.useLoaderData()
  const [buyers, setBuyers] = useState(initialBuyers)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<BuyerRole>('buyer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const invite = useServerFn(inviteCompanyBuyer)
  const update = useServerFn(updateCompanyBuyer)
  const remove = useServerFn(removeCompanyBuyer)
  const refresh = useServerFn(listCompanyBuyers)

  async function handleInvite(event: FormEvent) {
    event.preventDefault()
    setInviting(true)
    setInviteError(null)
    try {
      await invite({
        data: { email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole },
      })
      setBuyers(await refresh())
      setInviteEmail('')
      setInviteName('')
      setInviteRole('buyer')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send that invite.')
    } finally {
      setInviting(false)
    }
  }

  async function handleUpdate(buyerUserId: string, patch: { role: BuyerRole; spendLimit: number | null }) {
    setBusyId(buyerUserId)
    try {
      await update({ data: { buyerUserId, ...patch } })
      setBuyers(await refresh())
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(buyerUserId: string) {
    setBusyId(buyerUserId)
    try {
      await remove({ data: { buyerUserId } })
      setBuyers(await refresh())
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-foreground">Users</h1>

      <form
        onSubmit={handleInvite}
        className="surface-card flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-end sm:gap-3"
      >
        <Field
          label="Name"
          required
          value={inviteName}
          onChange={(event) => setInviteName(event.target.value)}
        />
        <Field
          label="Email"
          type="email"
          required
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="invite-role">
            Role
          </label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as BuyerRole)}
            className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="buyer">Buyer</option>
            <option value="company_admin">Company admin</option>
          </select>
        </div>
        <Button type="submit" disabled={inviting || !inviteEmail.trim() || !inviteName.trim()}>
          {inviting ? 'Inviting…' : 'Invite'}
        </Button>
      </form>
      {inviteError ? (
        <p role="alert" className="text-sm text-destructive">
          {inviteError}
        </p>
      ) : null}

      <BuyerUserTable buyers={buyers} busyId={busyId} onUpdate={handleUpdate} onRemove={handleRemove} />
    </div>
  )
}
