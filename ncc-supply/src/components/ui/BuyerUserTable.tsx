import { useState } from 'react'
import type { BuyerRole, BuyerStatus } from '../../server/db/schema'
import { cn } from '../../lib/cn'
import { Button } from './Button'
import { StatusChip } from './StatusChip'

const compactInputClasses =
  'w-24 rounded-lg border border-input bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export interface BuyerUserRow {
  id: string
  name: string
  email: string
  role: BuyerRole
  status: BuyerStatus
  spendLimit: number | null
}

const STATUS_TONE: Record<BuyerStatus, { tone: 'info' | 'success' | 'neutral'; label: string }> = {
  invited: { tone: 'info', label: 'Pending invite' },
  active: { tone: 'success', label: 'Active' },
  removed: { tone: 'neutral', label: 'Removed' },
}

export interface BuyerUserTableProps {
  buyers: BuyerUserRow[]
  busyId: string | null
  onUpdate: (buyerUserId: string, patch: { role: BuyerRole; spendLimit: number | null }) => Promise<void>
  onRemove: (buyerUserId: string) => Promise<void>
}

/** §5.2 "Buyer user table — invite, role, spend limit, active/removed status, per-row edit." */
export function BuyerUserTable({ buyers, busyId, onUpdate, onRemove }: BuyerUserTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [role, setRole] = useState<BuyerRole>('buyer')
  const [spendLimit, setSpendLimit] = useState('')

  function startEdit(buyer: BuyerUserRow) {
    setEditingId(buyer.id)
    setRole(buyer.role)
    setSpendLimit(buyer.spendLimit !== null ? String(buyer.spendLimit / 100) : '')
  }

  async function saveEdit(buyerUserId: string) {
    const trimmed = spendLimit.trim()
    const parsedPounds = trimmed === '' ? null : Number(trimmed)
    await onUpdate(buyerUserId, {
      role,
      spendLimit: parsedPounds === null || Number.isNaN(parsedPounds) ? null : Math.round(parsedPounds * 100),
    })
    setEditingId(null)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Spend limit</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {buyers.map((buyer) => (
            <tr key={buyer.id} className="border-b border-border/60">
              <td className="py-3 pr-4 text-foreground">{buyer.name}</td>
              <td className="py-3 pr-4 text-muted-foreground">{buyer.email}</td>
              <td className="py-3 pr-4">
                {editingId === buyer.id ? (
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as BuyerRole)}
                    className="rounded-lg border border-input bg-card px-2 py-1 text-sm"
                  >
                    <option value="buyer">Buyer</option>
                    <option value="company_admin">Company admin</option>
                  </select>
                ) : buyer.role === 'company_admin' ? (
                  'Company admin'
                ) : (
                  'Buyer'
                )}
              </td>
              <td className="py-3 pr-4">
                {editingId === buyer.id ? (
                  <input
                    aria-label="Spend limit in pounds"
                    className={cn(compactInputClasses)}
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    inputMode="decimal"
                    placeholder="No limit"
                  />
                ) : buyer.spendLimit !== null ? (
                  `£${(buyer.spendLimit / 100).toFixed(2)}`
                ) : (
                  '—'
                )}
              </td>
              <td className="py-3 pr-4">
                <StatusChip tone={STATUS_TONE[buyer.status].tone} label={STATUS_TONE[buyer.status].label} />
              </td>
              <td className="py-3 pr-4 text-right">
                {buyer.status === 'removed' ? null : editingId === buyer.id ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button onClick={() => saveEdit(buyer.id)} disabled={busyId === buyer.id}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => startEdit(buyer)} disabled={busyId === buyer.id}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => onRemove(buyer.id)} disabled={busyId === buyer.id}>
                      Remove
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
