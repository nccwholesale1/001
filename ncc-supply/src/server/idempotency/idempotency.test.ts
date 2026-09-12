import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { withIdempotency } from './idempotency'

describe('withIdempotency', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('runs once and replays the cached result on a duplicate call, never re-running the mutation', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const run = vi.fn().mockResolvedValue({ orderId: 'order_1' })

    const first = await withIdempotency(db, 'submit_basket', 'client-key-1', run)
    const second = await withIdempotency(db, 'submit_basket', 'client-key-1', run)

    expect(first).toEqual({ orderId: 'order_1' })
    expect(second).toEqual({ orderId: 'order_1' })
    expect(run).toHaveBeenCalledOnce()
  })

  it('does not collide across different scopes using the same key', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    await withIdempotency(db, 'submit_basket', 'same-key', () => Promise.resolve('basket-result'))
    const quoteResult = await withIdempotency(db, 'accept_quote', 'same-key', () =>
      Promise.resolve('quote-result'),
    )

    expect(quoteResult).toBe('quote-result')
  })
})
