import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getCatalogueAdapter } from '../integrations/shopify'
import type { Money, ProductImage } from '../integrations/shopify/types'
import type { Db } from '../db/client'
import { basketLines, baskets, type BasketStatus } from '../db/schema'

export interface AvailableBasketLineView {
  id: string
  sku: string
  available: true
  title: string
  price: Money
  thumbnail: ProductImage
  quantity: number
  lineTotalPence: number
}

export interface UnavailableBasketLineView {
  id: string
  sku: string
  available: false
  quantity: number
}

export type BasketLineView = AvailableBasketLineView | UnavailableBasketLineView

export interface BasketView {
  id: string
  status: BasketStatus
  lines: BasketLineView[]
  subtotalPence: number
}

export class UnknownProductError extends Error {
  constructor(sku: string) {
    super(`No product found for SKU "${sku}"`)
    this.name = 'UnknownProductError'
  }
}

export class InvalidQuantityError extends Error {
  constructor() {
    // Rule 12: any positive integer, no minimum or maximum business limit.
    super('Quantity must be a positive whole number')
    this.name = 'InvalidQuantityError'
  }
}

export class BasketLineNotFoundError extends Error {
  constructor() {
    super('Basket line not found')
    this.name = 'BasketLineNotFoundError'
  }
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new InvalidQuantityError()
}

/**
 * Looks up the real product via the catalogue adapter before accepting a
 * line — the SKU a client sends is just "which product," never trusted for
 * price (CLAUDE.md rule 9). Adding the same SKU twice bumps the existing
 * line's quantity rather than duplicating rows.
 */
export async function addLine(
  db: Db,
  basketId: string,
  sku: string,
  quantity: number,
): Promise<void> {
  assertValidQuantity(quantity)
  const product = await getCatalogueAdapter().getProduct(sku)
  if (!product) throw new UnknownProductError(sku)

  const [existingLine] = await db
    .select({ id: basketLines.id, quantity: basketLines.quantity })
    .from(basketLines)
    .where(and(eq(basketLines.basketId, basketId), eq(basketLines.sku, sku)))
    .limit(1)

  if (existingLine) {
    await db
      .update(basketLines)
      .set({ quantity: existingLine.quantity + quantity })
      .where(eq(basketLines.id, existingLine.id))
    return
  }

  await db.insert(basketLines).values({
    id: randomUUID(),
    basketId,
    sku,
    shopifyVariantId: product.variantId,
    quantity,
  })
}

export async function updateLineQuantity(
  db: Db,
  basketId: string,
  lineId: string,
  quantity: number,
): Promise<void> {
  assertValidQuantity(quantity)
  const result = await db
    .update(basketLines)
    .set({ quantity })
    .where(and(eq(basketLines.id, lineId), eq(basketLines.basketId, basketId)))
  if (result.rowsAffected === 0) throw new BasketLineNotFoundError()
}

export async function removeLine(db: Db, basketId: string, lineId: string): Promise<void> {
  const result = await db
    .delete(basketLines)
    .where(and(eq(basketLines.id, lineId), eq(basketLines.basketId, basketId)))
  if (result.rowsAffected === 0) throw new BasketLineNotFoundError()
}

/**
 * Every line's price is re-resolved from the catalogue adapter right now,
 * never read from a stored value — the basket view is never stale and
 * never trusts anything but the current live catalogue for price.
 */
export async function getBasketView(db: Db, basketId: string): Promise<BasketView | null> {
  const [basket] = await db
    .select({ id: baskets.id, status: baskets.status })
    .from(baskets)
    .where(eq(baskets.id, basketId))
    .limit(1)
  if (!basket) return null

  const rows = await db.select().from(basketLines).where(eq(basketLines.basketId, basketId))
  const adapter = getCatalogueAdapter()

  const lines: BasketLineView[] = []
  for (const row of rows) {
    const product = await adapter.getProduct(row.sku)
    if (!product) {
      // Discontinued/unavailable since it was added — kept visible rather
      // than silently dropped (the customer added it; the subtotal simply
      // excludes it, same "never silently drop, always show a reason"
      // principle as the bulk-order matcher, PRD §6.6).
      lines.push({ id: row.id, sku: row.sku, available: false, quantity: row.quantity })
      continue
    }
    lines.push({
      id: row.id,
      sku: row.sku,
      available: true,
      title: product.title,
      price: product.price,
      thumbnail: product.thumbnail,
      quantity: row.quantity,
      lineTotalPence: product.price.amountPence * row.quantity,
    })
  }

  return {
    id: basket.id,
    status: basket.status,
    lines,
    subtotalPence: lines.reduce((sum, line) => sum + (line.available ? line.lineTotalPence : 0), 0),
  }
}
