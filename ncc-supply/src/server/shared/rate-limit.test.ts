import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, RateLimitExceededError, resetRateLimitsForTests } from './rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitsForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to the limit, then throws', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key-a', { limit: 3, windowMs: 1000 })
    }
    expect(() => checkRateLimit('key-a', { limit: 3, windowMs: 1000 })).toThrow(RateLimitExceededError)
  })

  it('tracks separate keys independently', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('key-b', { limit: 3, windowMs: 1000 })
    // A different key starts fresh even though key-b is now exhausted.
    expect(() => checkRateLimit('key-c', { limit: 3, windowMs: 1000 })).not.toThrow()
  })

  it('resets once the window elapses', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('key-d', { limit: 3, windowMs: 1000 })
    expect(() => checkRateLimit('key-d', { limit: 3, windowMs: 1000 })).toThrow(RateLimitExceededError)

    vi.advanceTimersByTime(1001)

    expect(() => checkRateLimit('key-d', { limit: 3, windowMs: 1000 })).not.toThrow()
  })
})
