import { adminRequest } from './admin-client'
import type {
  AdminCommerceAdapter,
  ConfirmedOrderRequest,
  DraftOrder,
  EmailInput,
  ShopifyReturn,
} from './types'

/**
 * Real Admin-API-backed AdminCommerceAdapter. All three mutations verified
 * against the live schema this session (draftOrderCreate,
 * draftOrderInvoiceSend, returnApproveRequest) — not guessed. Nothing in
 * this module is called by any route yet; Phase 8 wires it up behind the
 * NCC-admin approval action, and no live mutation is ever executed in this
 * phase (contract-tested only, via mocked fetch).
 */

interface DraftOrderNode {
  id: string
  name: string
  status: string
  invoiceUrl: string | null
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }
}

const DRAFT_ORDER_FIELDS = `
  id
  name
  status
  invoiceUrl
  totalPriceSet { shopMoney { amount currencyCode } }
`

/**
 * Shopify money is a decimal string in the shop's currency; the app stores
 * pence. Kept in one place so every amount crossing this boundary converts
 * identically.
 */
function toShopifyMoney(pence: number): { amount: string; currencyCode: 'GBP' } {
  return { amount: (pence / 100).toFixed(2), currencyCode: 'GBP' }
}

function toDraftOrder(node: DraftOrderNode): DraftOrder {
  return {
    id: node.id,
    name: node.name,
    status: node.status,
    invoiceUrl: node.invoiceUrl,
    totalPrice: {
      amountPence: Math.round(Number(node.totalPriceSet.shopMoney.amount) * 100),
      currencyCode: 'GBP',
    },
  }
}

export function createAdminCommerceAdapter(): AdminCommerceAdapter {
  return { createDraftOrder, sendDraftOrderInvoice, approveReturn }
}

async function createDraftOrder(orderRequest: ConfirmedOrderRequest): Promise<DraftOrder> {
  const mutation = `
    mutation CreateDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { ${DRAFT_ORDER_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await adminRequest<{
    draftOrderCreate: {
      draftOrder: DraftOrderNode | null
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>('createDraftOrder', mutation, {
    input: {
      email: orderRequest.email,
      note: orderRequest.note,
      shippingAddress: orderRequest.shippingAddress,
      ...(orderRequest.reference ? { tags: [`ncc-order-${orderRequest.reference}`] } : {}),
      ...(orderRequest.shippingLine
        ? {
            shippingLine: {
              title: orderRequest.shippingLine.title,
              price: toShopifyMoney(orderRequest.shippingLine.pricePence).amount,
            },
          }
        : {}),
      lineItems: orderRequest.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        priceOverride: toShopifyMoney(line.unitPricePence),
      })),
    },
  })

  const { draftOrder, userErrors } = data.draftOrderCreate
  if (!draftOrder || userErrors.length > 0) {
    throw new Error(
      `draftOrderCreate failed: ${userErrors.map((e) => e.message).join('; ') || 'no draft order returned'}`,
    )
  }
  return toDraftOrder(draftOrder)
}

async function sendDraftOrderInvoice(draftOrderId: string, email: EmailInput): Promise<DraftOrder> {
  const mutation = `
    mutation SendDraftOrderInvoice($id: ID!, $email: EmailInput) {
      draftOrderInvoiceSend(id: $id, email: $email) {
        draftOrder { ${DRAFT_ORDER_FIELDS} }
        userErrors { field message }
      }
    }
  `
  const data = await adminRequest<{
    draftOrderInvoiceSend: {
      draftOrder: DraftOrderNode | null
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>('sendDraftOrderInvoice', mutation, {
    id: draftOrderId,
    email: { to: email.to, subject: email.subject, customMessage: email.customMessage },
  })

  const { draftOrder, userErrors } = data.draftOrderInvoiceSend
  if (!draftOrder || userErrors.length > 0) {
    throw new Error(
      `draftOrderInvoiceSend failed: ${userErrors.map((e) => e.message).join('; ') || 'no draft order returned'}`,
    )
  }
  return toDraftOrder(draftOrder)
}

async function approveReturn(returnId: string): Promise<ShopifyReturn> {
  const mutation = `
    mutation ApproveReturn($input: ReturnApproveRequestInput!) {
      returnApproveRequest(input: $input) {
        return { id status }
        userErrors { field message }
      }
    }
  `
  const data = await adminRequest<{
    returnApproveRequest: {
      return: { id: string; status: string } | null
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>('approveReturn', mutation, { input: { id: returnId } })

  const { return: approvedReturn, userErrors } = data.returnApproveRequest
  if (!approvedReturn || userErrors.length > 0) {
    throw new Error(
      `returnApproveRequest failed: ${userErrors.map((e) => e.message).join('; ') || 'no return returned'}`,
    )
  }
  return approvedReturn
}
