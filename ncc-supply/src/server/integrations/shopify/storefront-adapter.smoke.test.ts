import { describe, expect, it } from 'vitest'
import { env } from '../../env'
import { createStorefrontCatalogueAdapter } from './storefront-adapter'

/**
 * Real, read-only smoke test against the designated dev store — never
 * production, never a mutation. No-ops (rather than failing) when no real
 * Storefront credentials are configured, per CLAUDE.md rule 25: keep the
 * blocker precise instead of pretending this ran. Wire up
 * SHOPIFY_STORE_DOMAIN + SHOPIFY_STOREFRONT_ACCESS_TOKEN (see
 * .env.example) to actually exercise this against real data.
 */
const hasRealCredentials = Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_STOREFRONT_ACCESS_TOKEN)

describe.skipIf(!hasRealCredentials)('storefront adapter — live read-only smoke test', () => {
  it('fetches predictive search suggestions from the real dev store without error', async () => {
    const adapter = createStorefrontCatalogueAdapter()
    const result = await adapter.suggest('charger')
    expect(Array.isArray(result.products)).toBe(true)
  })
})

if (!hasRealCredentials) {
  describe('storefront adapter — live smoke test blocked', () => {
    it('records why the live smoke test did not run', () => {
      console.log(
        '[blocked] Live Storefront smoke test skipped — SHOPIFY_STORE_DOMAIN/SHOPIFY_STOREFRONT_ACCESS_TOKEN not configured. See .env.example.',
      )
      expect(hasRealCredentials).toBe(false)
    })
  })
}
