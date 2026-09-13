import { describe, expect, it } from 'vitest'
import {
  addBasketLineSchema,
  inviteBuyerSchema,
  registerCompanySchema,
  returnRequestSchema,
  submitBasketSchema,
  updateBuyerUserSchema,
} from './commands'

describe('addBasketLineSchema', () => {
  it('accepts a well-formed line — sku and quantity only, no price field exists to supply', () => {
    expect(addBasketLineSchema.safeParse({ sku: 'NCC-CHG-001', quantity: 3 }).success).toBe(true)
  })

  it('rejects a client-supplied price field instead of silently dropping it (rule 9)', () => {
    expect(
      addBasketLineSchema.safeParse({ sku: 'NCC-CHG-001', quantity: 3, unitPricePence: 1 }).success,
    ).toBe(false)
  })

  it('rejects a non-positive quantity', () => {
    expect(addBasketLineSchema.safeParse({ sku: 'NCC-CHG-001', quantity: 0 }).success).toBe(false)
  })
})

describe('submitBasketSchema', () => {
  it('accepts contact fields only — basket id/contents are never client input', () => {
    const result = submitBasketSchema.safeParse({
      contactEmail: 'buyer@example.com',
      contactName: 'A Buyer',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty submission — both contact fields are optional', () => {
    expect(submitBasketSchema.safeParse({}).success).toBe(true)
  })

  it('rejects a client-supplied basketId or lines array (rule 9 — those are server-derived, not client input)', () => {
    expect(submitBasketSchema.safeParse({ basketId: 'basket_1' }).success).toBe(false)
    expect(submitBasketSchema.safeParse({ lines: [] }).success).toBe(false)
  })
})

describe('returnRequestSchema', () => {
  it('accepts a well-formed return request', () => {
    const result = returnRequestSchema.safeParse({
      orderRequestId: 'order_1',
      reason: 'damaged',
      lines: [{ orderRequestLineId: 'line_1', quantity: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a reason outside PRD §6.16\'s defined list', () => {
    const result = returnRequestSchema.safeParse({
      orderRequestId: 'order_1',
      reason: 'Damaged in transit',
      lines: [{ orderRequestLineId: 'line_1', quantity: 1 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('registerCompanySchema', () => {
  it('accepts company/admin name only — identity comes from the verified Shopify session, never here', () => {
    expect(
      registerCompanySchema.safeParse({ companyName: 'Acme Repairs', adminName: 'Jane Doe' }).success,
    ).toBe(true)
  })

  it('rejects a client-supplied email or shopifyCustomerId', () => {
    expect(
      registerCompanySchema.safeParse({
        companyName: 'Acme',
        adminName: 'Jane',
        email: 'jane@example.com',
      }).success,
    ).toBe(false)
  })
})

describe('inviteBuyerSchema', () => {
  it('accepts a well-formed invite', () => {
    expect(
      inviteBuyerSchema.safeParse({ email: 'buyer@example.com', name: 'A Buyer', role: 'buyer' }).success,
    ).toBe(true)
  })

  it('rejects an unknown role', () => {
    expect(
      inviteBuyerSchema.safeParse({ email: 'buyer@example.com', name: 'A Buyer', role: 'owner' }).success,
    ).toBe(false)
  })
})

describe('updateBuyerUserSchema', () => {
  it('accepts clearing the spend limit with null', () => {
    expect(updateBuyerUserSchema.safeParse({ buyerUserId: 'b1', spendLimit: null }).success).toBe(true)
  })

  it('rejects a negative spend limit', () => {
    expect(updateBuyerUserSchema.safeParse({ buyerUserId: 'b1', spendLimit: -100 }).success).toBe(false)
  })
})
