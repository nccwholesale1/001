import { env } from '../../env'
import { adminRequest } from './admin-client'
import { storefrontRequest } from './storefront-client'

export interface ShopifyHealthStatus {
  configured: boolean
  ok: boolean
  latencyMs?: number
  error?: string
}

/**
 * Connectivity status only — never a credential value or raw API response
 * (CLAUDE.md rule 22). Safe to expose on a dev-only diagnostic route.
 */
export async function checkStorefrontHealth(): Promise<ShopifyHealthStatus> {
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    return { configured: false, ok: false }
  }
  const startedAt = Date.now()
  try {
    await storefrontRequest('healthCheck', 'query { shop { name } }')
    return { configured: true, ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkAdminHealth(): Promise<ShopifyHealthStatus> {
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return { configured: false, ok: false }
  }
  const startedAt = Date.now()
  try {
    await adminRequest('healthCheck', 'query { shop { name } }')
    return { configured: true, ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
