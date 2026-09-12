import { afterEach, describe, expect, it } from 'vitest'
import { auditEvents } from '../db/schema'
import { createTestDb } from '../db/test-helpers'
import { recordAuditEvent } from './audit-log'

describe('recordAuditEvent', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('persists an event with its structured detail as JSON', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    await recordAuditEvent(db, {
      actorType: 'staff',
      actorId: 'staff_1',
      action: 'ncc_approve',
      resourceType: 'order_request',
      resourceId: 'order_1',
      detail: { finalTotalPence: 1999 },
    })

    const rows = await db.select().from(auditEvents)
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0]!.detailJson!)).toEqual({ finalTotalPence: 1999 })
  })
})
