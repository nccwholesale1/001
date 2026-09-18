import type { CollectionSummary, ProductSummary } from '../server/integrations/shopify/types'

export interface PublicCatalogueData {
  collections: CollectionSummary[]
  popularProducts: ProductSummary[]
  error: string | null
}

const LOAD_ERROR = 'Could not load catalogue data right now.'

export const EMPTY_PUBLIC_CATALOGUE: PublicCatalogueData = {
  collections: [],
  popularProducts: [],
  error: null,
}

function asPublicCatalogue(value: unknown): PublicCatalogueData {
  if (value === null || typeof value !== 'object') {
    return { collections: [], popularProducts: [], error: LOAD_ERROR }
  }
  const record = value as Partial<PublicCatalogueData>
  return {
    collections: Array.isArray(record.collections)
      ? (record.collections as CollectionSummary[])
      : [],
    popularProducts: Array.isArray(record.popularProducts)
      ? (record.popularProducts as ProductSummary[])
      : [],
    error: typeof record.error === 'string' ? record.error : null,
  }
}

/**
 * Client-side catalogue fetch. Uses a plain GET so it does not depend on
 * `/_serverFn` CSRF or the native libsql bundle.
 */
export async function fetchPublicCatalogue(): Promise<PublicCatalogueData> {
  try {
    const response = await fetch('/api/catalogue', { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      return { collections: [], popularProducts: [], error: LOAD_ERROR }
    }
    return asPublicCatalogue(await response.json())
  } catch (error) {
    console.error('[catalogue] public fetch failed', error)
    return { collections: [], popularProducts: [], error: LOAD_ERROR }
  }
}
