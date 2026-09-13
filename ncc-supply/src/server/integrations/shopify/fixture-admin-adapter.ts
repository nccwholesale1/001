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
 * unconfigured. Never selected in production once that token is set
 * (env.ts requires ADMIN_COMMERCE_ADAPTER=live there).
 */
export function createFixtureAdminCommerceAdapter(): AdminCommerceAdapter {
  return { createDraftOrder, sendDraftOrderInvoice, approveReturn }
}

/**
 * `DraftOrderLineInput` carries no price (Shopify prices lines from its own
 * real variant data) — `totalPrice` here is a meaningless placeholder, same
 * as the rest of this fixture. The app's own `orderRequests.finalTotalPence`
 * (already server-recalculated at approval time) stays the one authoritative
 * total; this field is never read for anything real.
 */
async function createDraftOrder(orderRequest: ConfirmedOrderRequest): Promise<DraftOrder> {
  const id = `gid://shopify/DraftOrder/fixture-${randomUUID()}`
  return {
    id,
    name: `#FIXTURE-D${Math.floor(Math.random() * 9000 + 1000)}`,
    status: 'OPEN',
    invoiceUrl: null,
    totalPrice: { amountPence: orderRequest.lines.length, currencyCode: 'GBP' },
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
