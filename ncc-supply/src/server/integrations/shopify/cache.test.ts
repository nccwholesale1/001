import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCacheForTests, withCache } from './cache'

describe('withCache', () => {
  afterEach(() => {
    clearCacheForTests()
    vi.useRealTimers()
  })

  it('calls fn once and returns the cached value on a second call within the TTL', async () => {
    const fn = vi.fn().mockResolvedValue('value')

    expect(await withCache('key', 60_000, fn)).toBe('value')
    expect(await withCache('key', 60_000, fn)).toBe('value')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('re-calls fn once the TTL has expired', async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockResolvedValue('value')

    await withCache('key', 1000, fn)
    vi.advanceTimersByTime(1001)
    await withCache('key', 1000, fn)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
