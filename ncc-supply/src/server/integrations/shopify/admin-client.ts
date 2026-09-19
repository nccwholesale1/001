import { env } from '../../env'
import { getAdminAccessToken, hasClientCredentials, invalidateAdminToken } from './admin-token'
import { ShopifyApiError } from './errors'
import { shopifyGraphqlRequest } from './http-client'

/**
 * Server-only, privileged. Never import this module from client code or
 * expose SHOPIFY_ADMIN_ACCESS_TOKEN to the browser (CLAUDE.md rule 8). Not
 * called anywhere yet — Phase 8 is where real draft-order/invoice
 * operations happen. This phase only proves the boundary is correctly
 * shaped and never fires a live mutation.
 */
export async function adminRequest<T>(
  operationName: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!env.SHOPIFY_STORE_DOMAIN || !(env.SHOPIFY_ADMIN_ACCESS_TOKEN || hasClientCredentials())) {
    throw new Error(
      'adminRequest called without SHOPIFY_STORE_DOMAIN and Admin API credentials configured — set SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET, or a legacy SHOPIFY_ADMIN_ACCESS_TOKEN',
    )
  }
  if (!env.SHOPIFY_STORE_DOMAIN.endsWith('.myshopify.com')) {
    throw new Error('SHOPIFY_STORE_DOMAIN must be the store *.myshopify.com hostname')
  }

  const endpoint = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`

  const send = async (): Promise<T> =>
    shopifyGraphqlRequest<T>({
      endpoint,
      headers: { 'X-Shopify-Access-Token': await getAdminAccessToken() },
      query,
      variables,
      operationName,
    })

  try {
    return await send()
  } catch (error) {
    // A minted token can stop working before its stated expiry — the app's
    // secret was rotated, or the app was reinstalled. Drop it and try once
    // more with a fresh one. Only worth doing when we are the ones minting:
    // a statically configured token that 401s will 401 again.
    const isAuthFailure = error instanceof ShopifyApiError && error.status === 401
    if (!isAuthFailure || env.SHOPIFY_ADMIN_ACCESS_TOKEN || !hasClientCredentials()) throw error

    invalidateAdminToken()
    return send()
  }
}
