import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../server/db/client'
import { orderRequestLines, orderRequests } from '../../server/db/schema'
import { getCatalogueAdapter } from '../../server/integrations/shopify'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { Container, Section } from '../../components/ui/Layout'
import { StatusChip } from '../../components/ui/StatusChip'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

const STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  awaiting_company_approval: { label: 'Awaiting Company Approval', tone: 'info' },
  awaiting_ncc_review: { label: 'Awaiting NCC Review', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

interface OrderRequestLineView {
  id: string
  sku: string
  title: string
  requestedQuantity: number
  confirmedQuantity: number | null
  unitPricePence: number
}

interface OrderRequestView {
  id: string
  status: string
  guestContactEmail: string | null
  guestContactName: string | null
  deliveryPence: number | null
  vatPence: number | null
  finalTotalPence: number | null
  lines: OrderRequestLineView[]
}

/**
 * Returns `null` uniformly for a missing token, wrong token, expired
 * token, revoked token, or a nonexistent order id — the caller can't tell
 * these apart, matching `verifyGuestToken`'s own no-enumeration contract
 * (CLAUDE.md rule 16, PRD rule 5).
 */
const getOrderRequestView = createServerFn({ method: 'GET' })
  .validator((input: { orderId: string; token: string }) => input)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    const verification = await verifyGuestToken(db, data.token, 'order_request')
    if (!verification || verification.resourceId !== data.orderId) return null

    const [orderRequest] = await db
      .select()
      .from(orderRequests)
      .where(eq(orderRequests.id, verification.resourceId))
      .limit(1)
    if (!orderRequest) return null

    const rows = await db
      .select()
      .from(orderRequestLines)
      .where(eq(orderRequestLines.orderRequestId, orderRequest.id))
    const adapter = getCatalogueAdapter()
    const lines = await Promise.all(
      rows.map(async (row) => {
        const product = await adapter.getProduct(row.sku)
        return {
          id: row.id,
          sku: row.sku,
          title: product?.title ?? row.sku,
          requestedQuantity: row.requestedQuantity,
          confirmedQuantity: row.confirmedQuantity,
          unitPricePence: row.unitPricePence,
        }
      }),
    )

    return {
      id: orderRequest.id,
      status: orderRequest.status,
      guestContactEmail: orderRequest.guestContactEmail,
      guestContactName: orderRequest.guestContactName,
      deliveryPence: orderRequest.deliveryPence,
      vatPence: orderRequest.vatPence,
      finalTotalPence: orderRequest.finalTotalPence,
      lines,
    }
  })

const orderSearchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/order/$id')({
  validateSearch: orderSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    if (!deps.token) return null
    return getOrderRequestView({ data: { orderId: params.id, token: deps.token } })
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Order Status · NCC Supply' }],
  }),
  component: OrderStatusRoute,
})

function OrderStatusRoute() {
  const order = Route.useLoaderData()

  if (!order) {
    return (
      <Section>
        <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold text-foreground">We couldn't find that order</h1>
          <p className="text-sm text-muted-foreground">
            The link may be incorrect, expired, or no longer valid. If you have a support query,{' '}
            <a href="/support" className="text-primary hover:underline">
              contact NCC
            </a>
            .
          </p>
        </Container>
      </Section>
    )
  }

  const subtotalPence = order.lines.reduce(
    (sum, line) => sum + line.unitPricePence * (line.confirmedQuantity ?? line.requestedQuantity),
    0,
  )

  return (
    <Section>
      <Container className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Order status</h1>
          <StatusChip
            tone={STATUS_DISPLAY[order.status]?.tone ?? 'info'}
            label={STATUS_DISPLAY[order.status]?.label ?? order.status}
          />
        </div>

        {order.status === 'awaiting_ncc_review' ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            NCC is reviewing your order. Quantities, delivery and VAT will be confirmed here — no
            payment is needed until then.
          </p>
        ) : null}

        <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
          {order.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">{line.title}</p>
                <p className="text-xs text-muted-foreground">SKU {line.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-foreground">
                  {line.confirmedQuantity !== null ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {line.requestedQuantity}
                      </span>{' '}
                      {line.confirmedQuantity}
                    </>
                  ) : (
                    line.requestedQuantity
                  )}{' '}
                  × {formatPrice(line.unitPricePence)}
                </p>
              </div>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
            <span>Subtotal (ex VAT)</span>
            <span>{formatPrice(subtotalPence)}</span>
          </div>
          {order.deliveryPence !== null || order.vatPence !== null ? (
            <>
              {order.deliveryPence !== null ? (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery</span>
                  <span>{formatPrice(order.deliveryPence)}</span>
                </div>
              ) : null}
              {order.vatPence !== null ? (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>VAT</span>
                  <span>{formatPrice(order.vatPence)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Delivery and VAT will be confirmed by NCC.
            </p>
          )}
          {order.finalTotalPence !== null ? (
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <span>Final total</span>
              <span>{formatPrice(order.finalTotalPence)}</span>
            </div>
          ) : null}
        </div>

        {order.guestContactEmail || order.guestContactName ? (
          <div className="text-sm text-muted-foreground">
            <p>Contact: {order.guestContactName ?? '—'}</p>
            <p>{order.guestContactEmail ?? ''}</p>
          </div>
        ) : null}
      </Container>
    </Section>
  )
}
