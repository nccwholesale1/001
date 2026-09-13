import { addLine, UnknownProductError, InvalidQuantityError } from '../basket/basket'
import type { Db } from '../db/client'
import { getCatalogueAdapter } from '../integrations/shopify'
import type { Money, ProductImage } from '../integrations/shopify/types'
import { parseBulkOrderCsv, type CsvRowError } from './csv'

export interface MatchedBulkOrderRow {
  sku: string
  title: string
  quantity: number
  price: Money
  thumbnail: ProductImage
}

export interface UnmatchedBulkOrderRow {
  sku: string
  quantity: number | null
  reason: string
}

export interface BulkOrderPreview {
  matched: MatchedBulkOrderRow[]
  unmatched: UnmatchedBulkOrderRow[]
}

function toUnmatchedFromParseError(error: CsvRowError): UnmatchedBulkOrderRow {
  return { sku: error.raw.trim() || '(blank row)', quantity: null, reason: error.reason }
}

/**
 * PRD §6.6: CSV/paste → match against the catalogue → preview. Read-only —
 * no basket mutation happens here. A single `getProductsBySku` call handles
 * every row's lookup (see the CatalogueAdapter interface doc comment for why
 * this must never be `getProduct` in a loop). Never silently drops a row:
 * every row that isn't a matched line ends up in `unmatched` with a specific
 * reason, whether the failure was at parse time (malformed row) or at
 * catalogue-match time (unknown SKU).
 */
export async function previewBulkOrder(csvText: string): Promise<BulkOrderPreview> {
  const { rows, errors } = parseBulkOrderCsv(csvText)
  const unmatched: UnmatchedBulkOrderRow[] = errors.map(toUnmatchedFromParseError)

  if (rows.length === 0) {
    return { matched: [], unmatched }
  }

  const products = await getCatalogueAdapter().getProductsBySku(rows.map((row) => row.sku))

  const matched: MatchedBulkOrderRow[] = []
  for (const row of rows) {
    const product = products.get(row.sku)
    if (!product) {
      unmatched.push({ sku: row.sku, quantity: row.quantity, reason: 'Unknown SKU — not found in the catalogue' })
      continue
    }
    matched.push({
      sku: row.sku,
      title: product.title,
      quantity: row.quantity,
      price: product.price,
      thumbnail: product.thumbnail,
    })
  }

  return { matched, unmatched }
}

export interface BulkOrderLineInput {
  sku: string
  quantity: number
}

export interface AddBulkOrderLinesResult {
  added: string[]
  failed: Array<{ sku: string; reason: string }>
}

/**
 * "Add matched lines to basket" (PRD §6.6). Reuses the existing `addLine`
 * per line, which is already the sole place price/availability is
 * re-resolved (CLAUDE.md rule 9) and already rejects an unknown SKU on its
 * own — safe to accept the client's confirmed `{sku,quantity}` list here
 * without re-deriving that logic, since the worst a tampered list could do
 * is add different real products at their own live prices, no different
 * from browsing and adding them one at a time. Never aborts partway: every
 * line is attempted, successes and failures both reported back.
 */
export async function addBulkOrderLinesToBasket(
  db: Db,
  basketId: string,
  lines: BulkOrderLineInput[],
): Promise<AddBulkOrderLinesResult> {
  const added: string[] = []
  const failed: Array<{ sku: string; reason: string }> = []

  for (const line of lines) {
    try {
      await addLine(db, basketId, line.sku, line.quantity)
      added.push(line.sku)
    } catch (error) {
      if (error instanceof UnknownProductError || error instanceof InvalidQuantityError) {
        failed.push({ sku: line.sku, reason: error.message })
      } else {
        throw error
      }
    }
  }

  return { added, failed }
}
