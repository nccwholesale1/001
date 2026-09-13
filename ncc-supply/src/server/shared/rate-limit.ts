import { getRequestIP } from '@tanstack/react-start/server'
import { env } from '../env'

/**
 * In-memory fixed-window rate limiter for public, unauthenticated-writable
 * endpoints (staff/site-access sign-in, guest order/quote/return/support
 * submission) — the runbook's Phase 12 security list names "rate limiting
 * and abuse handling for public submissions" explicitly.
 *
 * Deliberately simple and in-process: this app has no shared cache/store
 * (no Redis, nothing else external besides the DB), and a single Node
 * process is the current deployment target (see PHASE_HANDOFF.md). Recorded
 * limitation (CLAUDE.md rule 25): this resets on restart and does not
 * coordinate across multiple instances — a genuine multi-instance production
 * deployment would need a shared store instead. Good enough to blunt casual
 * scripted abuse of a single instance; not a defense against a determined
 * distributed attacker.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export class RateLimitExceededError extends Error {
  constructor(message = 'Too many attempts — please try again shortly.') {
    super(message)
    this.name = 'RateLimitExceededError'
  }
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

/** Throws RateLimitExceededError once `key` exceeds `limit` attempts within `windowMs`. */
export function checkRateLimit(key: string, options: RateLimitOptions): void {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return
  }

  if (existing.count >= options.limit) {
    throw new RateLimitExceededError()
  }

  existing.count += 1
}

/** Test-only: clears all buckets so tests don't leak state into each other. */
export function resetRateLimitsForTests(): void {
  buckets.clear()
}

/**
 * `xForwardedFor` is only trusted in production, where the deployment target
 * (see PHASE_HANDOFF.md) sits behind a real reverse proxy that sets the
 * header itself and strips any client-supplied one. Trusting it in local
 * dev/test would let a caller spoof its own rate-limit key.
 */
export function getClientIp(): string {
  return getRequestIP({ xForwardedFor: env.NODE_ENV === 'production' }) ?? 'unknown'
}

/** Rate-limits a public endpoint by client IP, scoped under `scope` so different endpoints don't share one bucket. */
export function checkRateLimitByIp(scope: string, options: RateLimitOptions): void {
  checkRateLimit(`${scope}:${getClientIp()}`, options)
}
