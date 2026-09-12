import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { baskets } from '../db/schema'
import {
  addLine,
  BasketLineNotFoundError,
  getBasketView,
  InvalidQuantityError,
  removeLine,
  UnknownProductError,
  updateLineQuantity,
} from './basket'

describe('basket CRUD (against the fixture catalogue adapter)', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  async function seedBasket() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const basketId = 'basket_1'
    await db.insert(baskets).values({ id: basketId })
    return { db, basketId }
  }

  it('addLine resolves the real fixture product — price is never taken from input (rule 9)', async () => {
    const { db, basketId } = await seedBasket()

    await addLine(db, basketId, 'FIXTURE-CHG-001', 2)
    const view = await getBasketView(db, basketId)

    expect(view?.lines).toHaveLength(1)
    const [line] = view!.lines
    expect(line).toMatchObject({ available: true, sku: 'FIXTURE-CHG-001', quantity: 2 })
    if (line?.available) {
      expect(line.price.amountPence).toBe(1299)
      expect(line.lineTotalPence).toBe(2598)
    }
    expect(view!.subtotalPence).toBe(2598)
  })

  it('rejects an unknown SKU rather than adding a fabricated line', async () => {
    const { db, basketId } = await seedBasket()
    await expect(addLine(db, basketId, 'NOT-A-REAL-SKU', 1)).rejects.toThrow(UnknownProductError)
  })

  it('rejects a non-integer or non-positive quantity', async () => {
    const { db, basketId } = await seedBasket()
    await expect(addLine(db, basketId, 'FIXTURE-CHG-001', 0)).rejects.toThrow(InvalidQuantityError)
    await expect(addLine(db, basketId, 'FIXTURE-CHG-001', 1.5)).rejects.toThrow(
      InvalidQuantityError,
    )
    await expect(addLine(db, basketId, 'FIXTURE-CHG-001', -1)).rejects.toThrow(InvalidQuantityError)
  })

  it('adding the same SKU twice bumps quantity rather than duplicating the line', async () => {
    const { db, basketId } = await seedBasket()
    await addLine(db, basketId, 'FIXTURE-CHG-001', 2)
    await addLine(db, basketId, 'FIXTURE-CHG-001', 3)

    const view = await getBasketView(db, basketId)
    expect(view?.lines).toHaveLength(1)
    expect(view?.lines[0]?.quantity).toBe(5)
  })

  it('updateLineQuantity and removeLine only ever touch a line belonging to the given basket', async () => {
    const { db, basketId } = await seedBasket()
    await addLine(db, basketId, 'FIXTURE-CHG-001', 1)
    const [line] = (await getBasketView(db, basketId))!.lines

    await expect(updateLineQuantity(db, 'some-other-basket', line!.id, 5)).rejects.toThrow(
      BasketLineNotFoundError,
    )
    await expect(removeLine(db, 'some-other-basket', line!.id)).rejects.toThrow(
      BasketLineNotFoundError,
    )

    await updateLineQuantity(db, basketId, line!.id, 5)
    expect((await getBasketView(db, basketId))!.lines[0]?.quantity).toBe(5)

    await removeLine(db, basketId, line!.id)
    expect((await getBasketView(db, basketId))!.lines).toHaveLength(0)
  })
})
