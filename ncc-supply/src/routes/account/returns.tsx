import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getMyReturnDetail, listMyReturns } from '../../server/returns/server-functions'
import type { ReturnSummary, ReturnView } from '../../server/returns/return-view'
import { RETURN_STATUS_DISPLAY, ReturnDetail } from '../../components/ui/ReturnDetail'
import { StatusChip } from '../../components/ui/StatusChip'

export const Route = createFileRoute('/account/returns')({
  loader: () => listMyReturns(),
  head: () => ({ meta: [{ title: 'Returns · NCC Supply' }] }),
  component: AccountReturnsRoute,
})

function AccountReturnsRoute() {
  const initialReturns = Route.useLoaderData()
  const [returns] = useState<ReturnSummary[]>(initialReturns)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailById, setDetailById] = useState<Record<string, ReturnView>>({})

  const getDetail = useServerFn(getMyReturnDetail)

  async function toggleExpand(returnId: string) {
    if (expandedId === returnId) {
      setExpandedId(null)
      return
    }
    setExpandedId(returnId)
    if (!detailById[returnId]) {
      const view = await getDetail({ data: { returnId } })
      if (view) setDetailById((prev) => ({ ...prev, [returnId]: view }))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Returns</h1>

      {returns.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No returns yet — request one from a confirmed order in{' '}
          <a href="/account/orders" className="text-primary hover:underline">
            Orders
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {returns.map((ret) => {
            const detail = detailById[ret.id]
            const expanded = expandedId === ret.id
            return (
              <div key={ret.id} className="surface-card rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(ret.id)}
                    className="text-left text-sm font-semibold text-foreground hover:underline"
                  >
                    Return {ret.id.slice(0, 8)}
                  </button>
                  <StatusChip
                    tone={RETURN_STATUS_DISPLAY[ret.status]?.tone ?? 'info'}
                    label={RETURN_STATUS_DISPLAY[ret.status]?.label ?? ret.status}
                  />
                </div>
                {expanded && detail ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <ReturnDetail ret={detail} bare />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
