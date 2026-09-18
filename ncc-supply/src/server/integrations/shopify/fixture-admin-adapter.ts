import { randomUUID } from 'node:crypto'
import type {
  AdminCommerceAdapter,
  ConfirmedOrderRequest,
  DraftOrder,
  EmailInput,
  ShopifyReturn,
} from './types'

/**
 * Simulates Shopify Draft Order creation/invoicing with zero Shopify
 * credentials, so Phase 8's NCC-approval → checkout flow is exercisable
 * end-to-end (CLAUDE.md rule 25) while SHOPIFY_ADMIN_ACCESS_TOKEN is
 * unconfigured. A hosted deploy requires ADMIN_COMMERCE_ADAPTER=live
 * (env.ts), so this adapter is never selected there.
 */
export function createFixtureAdminCommerceAdapter(): AdminCommerceAdapter {
  return { createDraftOrder, sendDraftOrderInvoice, approveReturn }
}

/**
 * Mirrors the live adapter's contract closely enough to be worth trusting in
 * dev: the total is summed from the same app-authoritative unit prices and
 * delivery charge the live adapter forces onto Shopify, and `invoiceUrl` is
 * populated at creation — real `draftOrderCreate` returns it too, so a
 * fixture that returned `null` here would hide the fact that no separate
 * invoice-send call is needed before a customer can pay.
 */
async function createDraftOrder(orderRequest: ConfirmedOrderRequest): Promise<DraftOrder> {
  const id = `gid://shopify/DraftOrder/fixture-${randomUUID()}`
  const linesPence = orderRequest.lines.reduce(
    (total, line) => total + line.unitPricePence * line.quantity,
    0,
  )
  return {
    id,
    name: `#FIXTURE-D${Math.floor(Math.random() * 9000 + 1000)}`,
    status: 'OPEN',
    invoiceUrl: `https://fixture-shopify.example/invoices/${encodeURIComponent(id)}`,
    totalPrice: {
      amountPence: linesPence + (orderRequest.shippingLine?.pricePence ?? 0),
      currencyCode: 'GBP',
    },
  }
}

async function sendDraftOrderInvoice(draftOrderId: string, _email: EmailInput): Promise<DraftOrder> {
  return {
    id: draftOrderId,
    name: `#FIXTURE-D${draftOrderId.slice(-4)}`,
    status: 'INVOICE_SENT',
    invoiceUrl: `https://fixture-shopify.example/invoices/${encodeURIComponent(draftOrderId)}`,
    totalPrice: { amountPence: 0, currencyCode: 'GBP' },
  }
}

async function approveReturn(returnId: string): Promise<ShopifyReturn> {
  return { id: returnId, status: 'REQUESTED' }
}
