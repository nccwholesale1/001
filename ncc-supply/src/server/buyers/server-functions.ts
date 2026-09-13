import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { buyerUsers, companies, type BuyerRole } from '../db/schema'
import {
  inviteBuyerSchema,
  registerCompanySchema,
  removeBuyerUserSchema,
  updateBuyerUserSchema,
} from '../validation/commands'
import { establishBuyerSession, getCurrentActor, requireActor } from './buyer-session'
import {
  inviteBuyer,
  listBuyersForCompany,
  registerCompany,
  removeBuyerUser,
  updateBuyerUser,
  type BuyerUserSummary,
} from './companies'
import {
  beginBuyerLogin,
  clearPendingRegistrationIdentity,
  completeBuyerLogin,
  getPendingRegistrationIdentity,
  logoutBuyer,
  type CompleteBuyerLoginResult,
} from './oidc-flow'

export const beginLogin = createServerFn({ method: 'POST' }).handler(async () => beginBuyerLogin())

const completeLoginSchema = z.object({ code: z.string().min(1), state: z.string().min(1) })

export const completeLogin = createServerFn({ method: 'GET' })
  .validator(completeLoginSchema.parse)
  .handler(async ({ data }): Promise<CompleteBuyerLoginResult> => completeBuyerLogin(db, data))

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await logoutBuyer()
})

export interface CurrentBuyerSummary {
  buyerName: string
  companyName: string
  role: BuyerRole
}

/** Powers the Header's signed-in state (§5.2: "shows signed-in company name + role when authenticated"). */
export const getCurrentBuyerSummary = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentBuyerSummary | null> => {
    const actor = await getCurrentActor(db)
    if (!actor) return null

    const [row] = await db
      .select({ buyerName: buyerUsers.name, companyName: companies.name })
      .from(buyerUsers)
      .innerJoin(companies, eq(companies.id, buyerUsers.companyId))
      .where(eq(buyerUsers.id, actor.buyerUserId))
      .limit(1)
    if (!row) return null

    return { buyerName: row.buyerName, companyName: row.companyName, role: actor.role }
  },
)

export const getPendingRegistration = createServerFn({ method: 'GET' }).handler(async () =>
  getPendingRegistrationIdentity(),
)

export const submitCompanyRegistration = createServerFn({ method: 'POST' })
  .validator(registerCompanySchema.parse)
  .handler(async ({ data }) => {
    const pending = await getPendingRegistrationIdentity()
    if (!pending) {
      throw new Error('No verified sign-in found — please sign in again before registering.')
    }
    const { companyId, buyerUserId } = await registerCompany(db, {
      companyName: data.companyName,
      adminName: data.adminName,
      email: pending.email,
      shopifyCustomerId: pending.shopifyCustomerId,
      referringSalesRepId: data.referringSalesRepId,
    })
    await establishBuyerSession(buyerUserId)
    await clearPendingRegistrationIdentity()
    return { companyId }
  })

export const listCompanyBuyers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BuyerUserSummary[]> => {
    const actor = await requireActor(db)
    return listBuyersForCompany(db, actor.companyId)
  },
)

export const inviteCompanyBuyer = createServerFn({ method: 'POST' })
  .validator(inviteBuyerSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireActor(db)
    await inviteBuyer(db, actor, data)
  })

export const updateCompanyBuyer = createServerFn({ method: 'POST' })
  .validator(updateBuyerUserSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireActor(db)
    await updateBuyerUser(db, actor, data)
  })

export const removeCompanyBuyer = createServerFn({ method: 'POST' })
  .validator(removeBuyerUserSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireActor(db)
    await removeBuyerUser(db, actor, data.buyerUserId)
  })
