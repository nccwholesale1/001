interface CacheEntry {
  value: unknown
  expiresAt: number
}

/**
 * Simple in-memory TTL cache for the live catalogue adapter — one Node
 * process, one Map, no external service. Reasonable for a ~321-SKU
 * catalogue on a single server instance; revisit with a shared/distributed
 * cache (e.g. Redis) only if the deployment target ever needs horizontal
 * scaling (no such decision has been made yet — see DECISIONS.md ADR-004).
 */
const store = new Map<string, CacheEntry>()

export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = store.get(key)
  if (cached && cached.expiresAt > now) return cached.value as T

  const value = await fn()
  store.set(key, { value, expiresAt: now + ttlMs })
  return value
}

/** Test-only. Production code never needs to clear the cache mid-process. */
export function clearCacheForTests() {
  store.clear()
}
