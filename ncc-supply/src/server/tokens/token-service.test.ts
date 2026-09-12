import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { issueGuestToken, revokeGuestToken, verifyGuestToken } from './token-service'

describe('guest token service', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('issues a token that verifies back to the right resource, for the right resource type only', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    const { token } = await issueGuestToken(db, 'order_request', 'order_1')

    expect(await verifyGuestToken(db, token, 'order_request')).toEqual({ resourceId: 'order_1' })
    expect(await verifyGuestToken(db, token, 'quote')).toBeNull()
  })

  it('resists enumeration and replay: unknown, revoked, and expired tokens are all indistinguishable null', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    const { token: revoked } = await issueGuestToken(db, 'return', 'return_1')
    await revokeGuestToken(db, revoked)

    const { token: expired } = await issueGuestToken(db, 'support_ticket', 'ticket_1', -1)

    expect(await verifyGuestToken(db, 'never-issued', 'order_request')).toBeNull()
    expect(await verifyGuestToken(db, revoked, 'return')).toBeNull()
    expect(await verifyGuestToken(db, expired, 'support_ticket')).toBeNull()
  })
})
