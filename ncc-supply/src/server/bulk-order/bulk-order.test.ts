import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { basketLines, baskets } from '../db/schema'
import { addBulkOrderLinesToBasket, previewBulkOrder } from './bulk-order'

describe('previewBulkOrder', () => {
  afterEach(() => {
    vi.doUnmock('../integrations/shopify')
    vi.resetModules()
  })

  it('matches a real fixture SKU and reports an unknown one with a specific reason', async () => {
    const preview = await previewBulkOrder('FIXTURE-CHG-001,3\nNOT-A-REAL-SKU,2')

    expect(preview.matched).toEqual([expect.objectContaining({ sku: 'FIXTURE-CHG-001', quantity: 3 })])
    expect(preview.unmatched).toEqual([
      { sku: 'NOT-A-REAL-SKU', quantity: 2, reason: expect.stringMatching(/unknown sku/i) },
    ])
  })

  it('surfaces malformed-row parse errors as unmatched rows too — never silently dropped', async () => {
    const preview = await previewBulkOrder('FIXTURE-CHG-001,3\nthis is not a valid row at all')
    expect(preview.unmatched.some((row) => /two columns/i.test(row.reason))).toBe(true)
  })

  it('calls the catalogue adapter once regardless of row count — never getProduct in a loop', async () => {
    vi.resetModules()
    const getProductsBySku = vi.fn().mockResolvedValue(new Map())
    vi.doMock('../integrations/shopify', () => ({
      getCatalogueAdapter: () => ({ getProductsBySku }),
    }))
    const { previewBulkOrder: previewWithSpy } = await import('./bulk-order')

    const csv = Array.from({ length: 50 }, (_, i) => `SKU${i},1`).join('\n')
    await previewWithSpy(csv)

    expect(getProductsBySku).toHaveBeenCalledTimes(1)
  })
})

describe('addBulkOrderLinesToBasket', () => {
  it('adds every matched line via the existing addLine, reporting failures without aborting the rest', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(baskets).values({ id: 'basket-1' })

      const result = await addBulkOrderLinesToBasket(db, 'basket-1', [
        { sku: 'FIXTURE-CHG-001', quantity: 2 },
        { sku: 'NOT-A-REAL-SKU', quantity: 1 },
      ])

      expect(result.added).toEqual(['FIXTURE-CHG-001'])
      expect(result.failed).toEqual([{ sku: 'NOT-A-REAL-SKU', reason: expect.stringMatching(/no product found/i) }])

      const lines = await db.select().from(basketLines).where(eq(basketLines.basketId, 'basket-1'))
      expect(lines).toHaveLength(1)
      expect(lines[0].sku).toBe('FIXTURE-CHG-001')
    } finally {
      client.close()
    }
  })
})
