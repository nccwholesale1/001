import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies } from '../db/schema'
import { eq } from 'drizzle-orm'
import { mintFixtureIdToken } from '../integrations/shopify/fixture-customer-account-adapter'

function createFakeSession(initialData: Record<string, unknown> = {}) {
  const data = { ...initialData }
  return {
    id: 'fake',
    data,
    update: vi.fn(async (patch: Record<string, unknown>) => {
      Object.assign(data, patch)
      return { id: 'fake', data }
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(data)) delete data[key]
    }),
  }
}

/**
 * Mocks `useSession` to hand back a different fake session per cookie name
 * — `oidc-flow.ts` uses two (`ncc_oidc_pending`, and `ncc_buyer` indirectly
 * via `establishBuyerSession`) — and `getRequestUrl` for `beginBuyerLogin`'s
 * redirect_uri construction. CUSTOMER_ACCOUNT_ADAPTER defaults to `fixture`
 * in this test environment, so the real fixture adapter runs underneath
 * (no adapter mocking needed) — see fixture-customer-account-adapter.ts.
 */
function mockSessions(pendingData: Record<string, unknown> = {}, buyerData: Record<string, unknown> = {}) {
  const pendingSession = createFakeSession(pendingData)
  const buyerSession = createFakeSession(buyerData)
  vi.doMock('@tanstack/react-start/server', () => ({
    useSession: vi.fn((opts: { name: string }) =>
      Promise.resolve(opts.name === 'ncc_buyer' ? buyerSession : pendingSession),
    ),
    getRequestUrl: vi.fn(() => new URL('https://ncc-supply.example.com/auth')),
  }))
  return { pendingSession, buyerSession }
}

describe('oidc-flow', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.doUnmock('@tanstack/react-start/server')
    vi.resetModules()
  })

  describe('beginBuyerLogin', () => {
    it('stores pending OIDC state and returns the fixture login URL', async () => {
      const { pendingSession } = mockSessions()
      const { beginBuyerLogin } = await import('./oidc-flow')

      const { url } = await beginBuyerLogin()

      expect(url).toContain('/dev/fixture-shopify-login')
      expect(pendingSession.data.state).toEqual(expect.any(String))
      expect(pendingSession.data.codeVerifier).toEqual(expect.any(String))
      expect(pendingSession.data.redirectUri).toBe('https://ncc-supply.example.com/auth-callback')
    })
  })

  describe('completeBuyerLogin', () => {
    async function seed() {
      const { db, client } = await createTestDb()
      cleanup = () => client.close()
      await db.insert(companies).values({ id: 'co-a', name: 'Acme' })
      await db.insert(buyerUsers).values([
        { id: 'invited-buyer', companyId: 'co-a', name: 'Invited', email: 'invited@example.com', role: 'buyer', status: 'invited' },
        { id: 'active-buyer', companyId: 'co-a', name: 'Active', email: 'active@example.com', role: 'buyer', status: 'active' },
        { id: 'removed-buyer', companyId: 'co-a', name: 'Removed', email: 'removed@example.com', role: 'buyer', status: 'removed' },
      ])
      return db
    }

    it('activates an invited buyer on first sign-in and establishes a session', async () => {
      const db = await seed()
      const { buyerSession } = mockSessions({
        state: 'state-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'https://ncc-supply.example.com/auth-callback',
      })
      const { completeBuyerLogin } = await import('./oidc-flow')
      const code = await mintFixtureIdToken('invited@example.com')

      const result = await completeBuyerLogin(db, { code, state: 'state-1' })

      expect(result).toEqual({ outcome: 'signed_in' })
      expect(buyerSession.data.buyerUserId).toBe('invited-buyer')
      const [buyer] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, 'invited-buyer'))
      expect(buyer?.status).toBe('active')
      expect(buyer?.shopifyCustomerId).toEqual(expect.any(String))
    })

    it('signs in an already-active buyer without re-activating', async () => {
      const db = await seed()
      const { buyerSession } = mockSessions({
        state: 'state-2',
        codeVerifier: 'verifier-2',
        redirectUri: 'https://ncc-supply.example.com/auth-callback',
      })
      const { completeBuyerLogin } = await import('./oidc-flow')
      const code = await mintFixtureIdToken('active@example.com')

      const result = await completeBuyerLogin(db, { code, state: 'state-2' })

      expect(result).toEqual({ outcome: 'signed_in' })
      expect(buyerSession.data.buyerUserId).toBe('active-buyer')
    })

    it('refuses a removed buyer and establishes no session', async () => {
      const db = await seed()
      const { buyerSession } = mockSessions({
        state: 'state-3',
        codeVerifier: 'verifier-3',
        redirectUri: 'https://ncc-supply.example.com/auth-callback',
      })
      const { completeBuyerLogin } = await import('./oidc-flow')
      const code = await mintFixtureIdToken('removed@example.com')

      const result = await completeBuyerLogin(db, { code, state: 'state-3' })

      expect(result).toEqual({ outcome: 'removed' })
      expect(buyerSession.data.buyerUserId).toBeUndefined()
    })

    it('stashes the verified identity for /register when no buyer matches that email', async () => {
      const db = await seed()
      const { pendingSession } = mockSessions({
        state: 'state-4',
        codeVerifier: 'verifier-4',
        redirectUri: 'https://ncc-supply.example.com/auth-callback',
      })
      const { completeBuyerLogin, getPendingRegistrationIdentity } = await import('./oidc-flow')
      const code = await mintFixtureIdToken('brandnew@example.com')

      const result = await completeBuyerLogin(db, { code, state: 'state-4' })

      expect(result).toEqual({ outcome: 'pending_registration' })
      expect(pendingSession.data.pendingEmail).toBe('brandnew@example.com')
      const pending = await getPendingRegistrationIdentity()
      expect(pending?.email).toBe('brandnew@example.com')
    })

    it('rejects a mismatched or missing state (CSRF/replay protection)', async () => {
      const db = await seed()
      mockSessions({
        state: 'real-state',
        codeVerifier: 'verifier-5',
        redirectUri: 'https://ncc-supply.example.com/auth-callback',
      })
      const { completeBuyerLogin } = await import('./oidc-flow')
      const code = await mintFixtureIdToken('active@example.com')

      const result = await completeBuyerLogin(db, { code, state: 'wrong-state' })
      expect(result).toEqual({ outcome: 'invalid_state' })
    })
  })
})
