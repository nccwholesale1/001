import { env } from '../../env'
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
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    throw new Error(
      'adminRequest called without SHOPIFY_STORE_DOMAIN/SHOPIFY_ADMIN_ACCESS_TOKEN configured',
    )
  }
  if (!env.SHOPIFY_STORE_DOMAIN.endsWith('.myshopify.com')) {
    throw new Error('SHOPIFY_STORE_DOMAIN must be the store *.myshopify.com hostname')
  }

  return shopifyGraphqlRequest<T>({
    endpoint: `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    headers: { 'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_ACCESS_TOKEN },
    query,
    variables,
    operationName,
  })
}
