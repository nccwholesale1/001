import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import type { Actor } from '../auth/authorization'
import { createTestDb } from '../db/test-helpers'
import { auditEvents, buyerUsers, companies } from '../db/schema'
import {
  BuyerNotFoundError,
  EmailAlreadyRegisteredError,
  ForbiddenError,
  inviteBuyer,
  listBuyersForCompany,
  registerCompany,
  removeBuyerUser,
  updateBuyerUser,
} from './companies'

describe('companies', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  async function seed() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(companies).values([{ id: 'co-a', name: 'Acme' }, { id: 'co-b', name: 'Beta' }])
    await db.insert(buyerUsers).values([
      { id: 'admin-a', companyId: 'co-a', name: 'Admin A', email: 'admin-a@example.com', role: 'company_admin', status: 'active' },
      { id: 'buyer-a', companyId: 'co-a', name: 'Buyer A', email: 'buyer-a@example.com', role: 'buyer', status: 'active' },
      { id: 'admin-b', companyId: 'co-b', name: 'Admin B', email: 'admin-b@example.com', role: 'company_admin', status: 'active' },
    ])
    return db
  }

  const adminA: Actor = { kind: 'buyer', buyerUserId: 'admin-a', companyId: 'co-a', role: 'company_admin' }
  const buyerA: Actor = { kind: 'buyer', buyerUserId: 'buyer-a', companyId: 'co-a', role: 'buyer' }
  const adminB: Actor = { kind: 'buyer', buyerUserId: 'admin-b', companyId: 'co-b', role: 'company_admin' }

  describe('registerCompany', () => {
    it('creates a company and its first buyer as an active company_admin', async () => {
      const { db, client } = await createTestDb()
      cleanup = () => client.close()

      const { companyId, buyerUserId } = await registerCompany(db, {
        companyName: 'New Co',
        adminName: 'Jane Doe',
        email: 'jane@newco.example',
        shopifyCustomerId: 'gid://shopify/Customer/1',
      })

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
      expect(company?.name).toBe('New Co')

      const [buyer] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, buyerUserId))
      expect(buyer?.role).toBe('company_admin')
      expect(buyer?.status).toBe('active')
      expect(buyer?.shopifyCustomerId).toBe('gid://shopify/Customer/1')

      const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'register_company'))
      expect(event?.resourceId).toBe(companyId)
    })

    it('records a self-reported referring sales rep id, if given', async () => {
      const { db, client } = await createTestDb()
      cleanup = () => client.close()

      const { companyId } = await registerCompany(db, {
        companyName: 'Referred Co',
        adminName: 'Jane Doe',
        email: 'jane@referredco.example',
        shopifyCustomerId: 'gid://shopify/Customer/3',
        referringSalesRepId: 'EMP-042',
      })

      const [company] = await db.select().from(companies).where(eq(companies.id, companyId))
      expect(company?.referringSalesRepId).toBe('EMP-042')
    })

    it('rejects an email that is already registered', async () => {
      const db = await seed()
      await expect(
        registerCompany(db, {
          companyName: 'Dup Co',
          adminName: 'Dup',
          email: 'admin-a@example.com',
          shopifyCustomerId: 'gid://shopify/Customer/2',
        }),
      ).rejects.toThrow(EmailAlreadyRegisteredError)
    })
  })

  describe('listBuyersForCompany', () => {
    it('returns only the buyers belonging to that company', async () => {
      const db = await seed()
      const buyers = await listBuyersForCompany(db, 'co-a')
      expect(buyers.map((b) => b.id).sort()).toEqual(['admin-a', 'buyer-a'])
    })
  })

  describe('inviteBuyer', () => {
    it('lets a company admin invite a new buyer at status invited', async () => {
      const db = await seed()
      await inviteBuyer(db, adminA, { email: 'New@Example.com', name: 'New Person', role: 'buyer' })

      const [invited] = await db.select().from(buyerUsers).where(eq(buyerUsers.email, 'new@example.com'))
      expect(invited?.status).toBe('invited')
      expect(invited?.companyId).toBe('co-a')
    })

    it('rejects a non-admin buyer', async () => {
      const db = await seed()
      await expect(
        inviteBuyer(db, buyerA, { email: 'x@example.com', name: 'X', role: 'buyer' }),
      ).rejects.toThrow(ForbiddenError)
    })

    it('rejects an already-registered email', async () => {
      const db = await seed()
      await expect(
        inviteBuyer(db, adminA, { email: 'buyer-a@example.com', name: 'Dup', role: 'buyer' }),
      ).rejects.toThrow(EmailAlreadyRegisteredError)
    })
  })

  describe('updateBuyerUser / removeBuyerUser — cross-company isolation', () => {
    it('lets a company admin update a buyer in their own company', async () => {
      const db = await seed()
      await updateBuyerUser(db, adminA, { buyerUserId: 'buyer-a', role: 'company_admin', spendLimit: 50000 })

      const [buyer] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, 'buyer-a'))
      expect(buyer?.role).toBe('company_admin')
      expect(buyer?.spendLimit).toBe(50000)
    })

    it("rejects a company admin editing another company's buyer", async () => {
      const db = await seed()
      await expect(
        updateBuyerUser(db, adminB, { buyerUserId: 'buyer-a', role: 'company_admin' }),
      ).rejects.toThrow(BuyerNotFoundError)
    })

    it('rejects a non-admin buyer from updating anyone', async () => {
      const db = await seed()
      await expect(updateBuyerUser(db, buyerA, { buyerUserId: 'buyer-a', role: 'company_admin' })).rejects.toThrow(
        ForbiddenError,
      )
    })

    it('removes a buyer in the admin’s own company', async () => {
      const db = await seed()
      await removeBuyerUser(db, adminA, 'buyer-a')
      const [buyer] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, 'buyer-a'))
      expect(buyer?.status).toBe('removed')
    })

    it("rejects removing another company's buyer", async () => {
      const db = await seed()
      await expect(removeBuyerUser(db, adminB, 'buyer-a')).rejects.toThrow(BuyerNotFoundError)

      const [buyer] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, 'buyer-a'))
      expect(buyer?.status).toBe('active')
    })
  })
})
