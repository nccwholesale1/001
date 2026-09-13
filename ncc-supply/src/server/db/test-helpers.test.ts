import { afterEach, describe, expect, it } from 'vitest'
import { companies } from './schema'
import { createTestDb } from './test-helpers'

describe('createTestDb', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('applies every migration to a fresh in-memory database', async () => {
    const { client } = await createTestDb()
    cleanup = () => client.close()

    const tables = await client.execute(
      `select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name`,
    )
    const tableNames = tables.rows.map((row) => row.name)

    expect(tableNames).toEqual(
      [
        'attachments',
        'audit_events',
        'basket_lines',
        'baskets',
        'buyer_users',
        'company_locations',
        'companies',
        'guest_tokens',
        'idempotency_keys',
        'order_request_lines',
        'order_requests',
        'quote_lines',
        'quotes',
        'return_lines',
        'returns',
        'sales_rep_assignments',
        'staff_sessions',
        'staff_users',
        'support_ticket_messages',
        'support_tickets',
      ].sort(),
    )
  })

  it('round-trips an insert and query through drizzle', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    await db.insert(companies).values({ id: 'company_1', name: 'Test Traders Ltd' })
    const rows = await db.select().from(companies)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Test Traders Ltd')
  })

  it('gives each call a fresh, isolated database', async () => {
    const first = await createTestDb()
    cleanup = () => first.client.close()
    await first.db.insert(companies).values({ id: 'company_1', name: 'First' })

    const second = await createTestDb()
    try {
      const rows = await second.db.select().from(companies)
      expect(rows).toHaveLength(0)
    } finally {
      second.client.close()
    }
  })
})
