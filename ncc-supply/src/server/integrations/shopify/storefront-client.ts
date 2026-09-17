import { env } from '../../env'
import { shopifyGraphqlRequest } from './http-client'

/**
 * Server-only. Never import this module from client code — CLAUDE.md rule 8.
 * Always called with the store's own Storefront access token from the
 * server, even though that token type is also safe for a browser to hold —
 * keeping one call path here means caching and redacted logging apply
 * uniformly, and no Shopify credential ever needs to reach the browser.
 */
export async function storefrontRequest<T>(
  operationName: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) {
    throw new Error(
      'storefrontRequest called without SHOPIFY_STORE_DOMAIN/SHOPIFY_STOREFRONT_ACCESS_TOKEN configured',
    )
  }
  if (!env.SHOPIFY_STORE_DOMAIN.endsWith('.myshopify.com')) {
    throw new Error('SHOPIFY_STORE_DOMAIN must be the store *.myshopify.com hostname')
  }

  return shopifyGraphqlRequest<T>({
    endpoint: `https://${env.SHOPIFY_STORE_DOMAIN}/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    headers: { 'X-Shopify-Storefront-Access-Token': env.SHOPIFY_STOREFRONT_ACCESS_TOKEN },
    query,
    variables,
    operationName,
  })
}
