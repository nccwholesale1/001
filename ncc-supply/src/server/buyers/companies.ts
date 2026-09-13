import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ForbiddenError, isCompanyAdmin, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { buyerUsers, companies, type BuyerRole, type BuyerStatus } from '../db/schema'
import { transitionBuyer } from '../domain/status'

export { ForbiddenError }

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('That email is already registered to a company account')
    this.name = 'EmailAlreadyRegisteredError'
  }
}

export class BuyerNotFoundError extends Error {
  constructor() {
    super('Buyer user not found')
    this.name = 'BuyerNotFoundError'
  }
}

export interface BuyerUserSummary {
  id: string
  name: string
  email: string
  role: BuyerRole
  status: BuyerStatus
  spendLimit: number | null
}

/**
 * Creates a brand-new company and its first (admin) buyer for a Shopify
 * identity that `../buyers/oidc-flow.ts` already verified and found no
 * existing `buyerUsers` row for — this never re-verifies identity, it only
 * ever runs immediately after that verification, with the email/customer id
 * it produced.
 */
export async function registerCompany(
  db: Db,
  input: {
    companyName: string
    adminName: string
    email: string
    shopifyCustomerId: string
    referringSalesRepId?: string
  },
): Promise<{ companyId: string; buyerUserId: string }> {
  const [existing] = await db
    .select({ id: buyerUsers.id })
    .from(buyerUsers)
    .where(eq(buyerUsers.email, input.email))
    .limit(1)
  if (existing) throw new EmailAlreadyRegisteredError()

  const companyId = randomUUID()
  const buyerUserId = randomUUID()

  await db.insert(companies).values({
    id: companyId,
    name: input.companyName,
    referringSalesRepId: input.referringSalesRepId ?? null,
  })
  await db.insert(buyerUsers).values({
    id: buyerUserId,
    companyId,
    name: input.adminName,
    email: input.email,
    role: 'company_admin',
    status: 'active',
    shopifyCustomerId: input.shopifyCustomerId,
  })

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: buyerUserId,
    action: 'register_company',
    resourceType: 'company',
    resourceId: companyId,
  })

  return { companyId, buyerUserId }
}

export async function listBuyersForCompany(db: Db, companyId: string): Promise<BuyerUserSummary[]> {
  const rows = await db
    .select({
      id: buyerUsers.id,
      name: buyerUsers.name,
      email: buyerUsers.email,
      role: buyerUsers.role,
      status: buyerUsers.status,
      spendLimit: buyerUsers.spendLimit,
    })
    .from(buyerUsers)
    .where(eq(buyerUsers.companyId, companyId))
  return rows
}

export async function inviteBuyer(
  db: Db,
  actor: Actor,
  input: { email: string; name: string; role: BuyerRole; spendLimit?: number },
): Promise<void> {
  if (!isCompanyAdmin(actor)) throw new ForbiddenError()

  const email = input.email.toLowerCase()
  const [existing] = await db.select({ id: buyerUsers.id }).from(buyerUsers).where(eq(buyerUsers.email, email)).limit(1)
  if (existing) throw new EmailAlreadyRegisteredError()

  const buyerUserId = randomUUID()
  await db.insert(buyerUsers).values({
    id: buyerUserId,
    companyId: actor.companyId,
    name: input.name,
    email,
    role: input.role,
    status: 'invited',
    spendLimit: input.spendLimit ?? null,
  })

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: actor.buyerUserId,
    action: 'invite_buyer',
    resourceType: 'buyer_user',
    resourceId: buyerUserId,
    detail: { role: input.role },
  })
}

async function loadCompanyBuyerOrThrow(db: Db, companyId: string, buyerUserId: string) {
  const [target] = await db.select().from(buyerUsers).where(eq(buyerUsers.id, buyerUserId)).limit(1)
  if (!target || target.companyId !== companyId) throw new BuyerNotFoundError()
  return target
}

export async function updateBuyerUser(
  db: Db,
  actor: Actor,
  input: { buyerUserId: string; role?: BuyerRole; spendLimit?: number | null },
): Promise<void> {
  if (!isCompanyAdmin(actor)) throw new ForbiddenError()
  const target = await loadCompanyBuyerOrThrow(db, actor.companyId, input.buyerUserId)

  await db
    .update(buyerUsers)
    .set({
      role: input.role ?? target.role,
      spendLimit: input.spendLimit === undefined ? target.spendLimit : input.spendLimit,
    })
    .where(eq(buyerUsers.id, target.id))

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: actor.buyerUserId,
    action: 'update_buyer_user',
    resourceType: 'buyer_user',
    resourceId: target.id,
    detail: { role: input.role, spendLimit: input.spendLimit },
  })
}

export async function removeBuyerUser(db: Db, actor: Actor, buyerUserId: string): Promise<void> {
  if (!isCompanyAdmin(actor)) throw new ForbiddenError()
  const target = await loadCompanyBuyerOrThrow(db, actor.companyId, buyerUserId)
  const nextStatus = transitionBuyer(target.status, { type: 'remove' })

  await db.update(buyerUsers).set({ status: nextStatus }).where(eq(buyerUsers.id, target.id))

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: actor.buyerUserId,
    action: 'remove_buyer',
    resourceType: 'buyer_user',
    resourceId: target.id,
  })
}
