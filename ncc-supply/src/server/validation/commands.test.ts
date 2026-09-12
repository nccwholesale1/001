import { describe, expect, it } from 'vitest'
import { addBasketLineSchema, returnRequestSchema, submitBasketSchema } from './commands'

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
      reason: 'Damaged in transit',
      lines: [{ orderRequestLineId: 'line_1', quantity: 1 }],
    })
    expect(result.success).toBe(true)
  })
})
