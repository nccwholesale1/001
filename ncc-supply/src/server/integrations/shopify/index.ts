import { env } from '../../env'
import { createAdminCommerceAdapter } from './admin-adapter'
import { withCache } from './cache'
import { createCustomerAccountAdapter } from './customer-account-adapter'
import { createFixtureAdminCommerceAdapter } from './fixture-admin-adapter'
import { createFixtureCatalogueAdapter } from './fixture-adapter'
import { createFixtureCustomerAccountAdapter } from './fixture-customer-account-adapter'
import { createStorefrontCatalogueAdapter } from './storefront-adapter'
import type {
  AdminCommerceAdapter,
  CatalogueAdapter,
  CollectionResult,
  CollectionSummary,
  CustomerAccountAdapter,
  FacetOpts,
  PaginationOpts,
  ProductDetail,
  ProductSummary,
  SearchResult,
  TypeaheadResult,
} from './types'

const COLLECTION_LIST_CACHE_TTL_MS = 60_000
const COLLECTION_CACHE_TTL_MS = 60_000
const PRODUCT_CACHE_TTL_MS = 60_000

function withCatalogueCache(adapter: CatalogueAdapter): CatalogueAdapter {
  return {
    listCollections: (): Promise<CollectionSummary[]> =>
      withCache('collections:all', COLLECTION_LIST_CACHE_TTL_MS, () => adapter.listCollections()),
    getCollection: (slug: string, opts: PaginationOpts & FacetOpts): Promise<CollectionResult> =>
      withCache(`collection:${slug}:${JSON.stringify(opts)}`, COLLECTION_CACHE_TTL_MS, () =>
        adapter.getCollection(slug, opts),
      ),
    getProduct: (sku: string): Promise<ProductDetail | null> =>
      withCache(`product:${sku}`, PRODUCT_CACHE_TTL_MS, () => adapter.getProduct(sku)),
    // Uncached, like search/suggest below: a bulk-order upload's SKU set is
    // effectively unique per request, so there's nothing worth keying a
    // cache on here.
    getProductsBySku: (skus: string[]): Promise<Map<string, ProductSummary>> =>
      adapter.getProductsBySku(skus),
    search: (query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult> =>
      adapter.search(query, opts),
    suggest: (query: string): Promise<TypeaheadResult> => adapter.suggest(query),
  }
}

/**
 * The one import point every later phase uses — nothing else should reach
 * into storefront-adapter.ts/fixture-adapter.ts directly (CLAUDE.md rule
 * 20: fixture and live adapters are never mixed in the same running
 * process). Search and suggest are left uncached since their results are
 * query-keyed and much less repeated than a fixed collection/product page.
 */
export function getCatalogueAdapter(): CatalogueAdapter {
  if (env.CATALOGUE_ADAPTER === 'live') {
    return withCatalogueCache(createStorefrontCatalogueAdapter())
  }
  return createFixtureCatalogueAdapter()
}

/**
 * Same fixture/live split as `getCatalogueAdapter()`, for the same reason:
 * SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID isn't configured yet, so the fixture
 * adapter (default) is what makes Phase 7's buyer sign-in flow demonstrable
 * without live Shopify credentials — see fixture-customer-account-adapter.ts.
 */
export function getCustomerAccountAdapter(): CustomerAccountAdapter {
  if (env.CUSTOMER_ACCOUNT_ADAPTER === 'live') {
    return createCustomerAccountAdapter()
  }
  return createFixtureCustomerAccountAdapter()
}

/**
 * Same fixture/live split, for Phase 8's Draft Order creation. Live once
 * SHOPIFY_ADMIN_ACCESS_TOKEN is configured; the fixture (default) fakes a
 * draft order id/invoice URL so the whole NCC-approval flow is demonstrable
 * without it — see fixture-admin-adapter.ts.
 */
export function getAdminCommerceAdapter(): AdminCommerceAdapter {
  if (env.ADMIN_COMMERCE_ADAPTER === 'live') {
    return createAdminCommerceAdapter()
  }
  return createFixtureAdminCommerceAdapter()
}
