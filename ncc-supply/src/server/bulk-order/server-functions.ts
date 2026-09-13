import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/client'
import { getOrCreateBasketId } from '../basket/session'
import { addBulkOrderLinesSchema, bulkOrderCsvSchema } from '../validation/commands'
import {
  addBulkOrderLinesToBasket,
  previewBulkOrder as previewBulkOrderCsv,
  type AddBulkOrderLinesResult,
  type BulkOrderPreview,
} from './bulk-order'

export const previewBulkOrder = createServerFn({ method: 'POST' })
  .validator(bulkOrderCsvSchema.parse)
  .handler(async ({ data }): Promise<BulkOrderPreview> => previewBulkOrderCsv(data.csvText))

export const addBulkOrderLines = createServerFn({ method: 'POST' })
  .validator(addBulkOrderLinesSchema.parse)
  .handler(async ({ data }): Promise<AddBulkOrderLinesResult> => {
    const basketId = await getOrCreateBasketId(db)
    return addBulkOrderLinesToBasket(db, basketId, data.lines)
  })
