import { describe, expect, it } from 'vitest'
import { returnRequestSchema, submitBasketSchema } from './commands'

describe('submitBasketSchema', () => {
  it('accepts a well-formed basket submission', () => {
    const result = submitBasketSchema.safeParse({
      basketId: 'basket_1',
      lines: [{ shopifyVariantId: 'gid://shopify/ProductVariant/1', quantity: 3 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a client-supplied price/total field instead of silently dropping it (rule 9)', () => {
    const result = submitBasketSchema.safeParse({
      basketId: 'basket_1',
      lines: [
        { shopifyVariantId: 'gid://shopify/ProductVariant/1', quantity: 3, unitPricePence: 1 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive quantity', () => {
    const result = submitBasketSchema.safeParse({
      basketId: 'basket_1',
      lines: [{ shopifyVariantId: 'gid://shopify/ProductVariant/1', quantity: 0 }],
    })
    expect(result.success).toBe(false)
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
