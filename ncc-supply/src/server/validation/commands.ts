import { z } from 'zod'
import { BUYER_ROLES } from '../db/schema'

/**
 * Every schema a guest or buyer can submit is `.strict()` — Zod rejects any
 * key it doesn't recognize rather than silently dropping it. That's the
 * concrete enforcement of CLAUDE.md rule 9 here: a client attempting to add
 * `unitPricePence`/`totalPence`/`status` to a request body fails validation
 * outright instead of the server having to remember to ignore those fields.
 */

export const addBasketLineSchema = z
  .object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict()
export type AddBasketLineInput = z.infer<typeof addBasketLineSchema>

export const updateBasketLineQuantitySchema = z
  .object({
    lineId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict()
export type UpdateBasketLineQuantityInput = z.infer<typeof updateBasketLineQuantitySchema>

export const removeBasketLineSchema = z.object({ lineId: z.string().min(1) }).strict()
export type RemoveBasketLineInput = z.infer<typeof removeBasketLineSchema>

/**
 * Phase 2 originally guessed `{ basketId, lines }` here — a client-supplied
 * line list to submit. Phase 6's real implementation persists the basket
 * server-side (lines added one at a time, each already price-validated —
 * see src/server/basket/basket.ts) and reads it via the session cookie, so
 * resubmitting the full line list at submit time is both unnecessary and a
 * needlessly larger attack surface. Submission now only needs the optional
 * contact fields; basket id and contents are never client input at all.
 */
export const submitBasketSchema = z
  .object({
    contactEmail: z.string().email().optional(),
    contactName: z.string().min(1).optional(),
  })
  .strict()
export type SubmitBasketInput = z.infer<typeof submitBasketSchema>

/** Company name only — the admin's identity (email/name) already comes from the verified Shopify session, never client-typed here. */
export const registerCompanySchema = z
  .object({
    companyName: z.string().min(1),
    adminName: z.string().min(1),
  })
  .strict()
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>

export const inviteBuyerSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(BUYER_ROLES),
    spendLimit: z.number().int().nonnegative().optional(),
  })
  .strict()
export type InviteBuyerInput = z.infer<typeof inviteBuyerSchema>

export const updateBuyerUserSchema = z
  .object({
    buyerUserId: z.string().min(1),
    role: z.enum(BUYER_ROLES).optional(),
    spendLimit: z.number().int().nonnegative().nullable().optional(),
  })
  .strict()
export type UpdateBuyerUserInput = z.infer<typeof updateBuyerUserSchema>

export const removeBuyerUserSchema = z.object({ buyerUserId: z.string().min(1) }).strict()
export type RemoveBuyerUserInput = z.infer<typeof removeBuyerUserSchema>

export const reorderSchema = z.object({ orderRequestId: z.string().min(1) }).strict()
export type ReorderInput = z.infer<typeof reorderSchema>

export const companyApprovalDecisionSchema = z
  .object({
    orderRequestId: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().min(1).optional(),
  })
  .strict()
export type CompanyApprovalDecisionInput = z.infer<typeof companyApprovalDecisionSchema>

/**
 * NCC-admin-only, per PRD rule 14 ("one atomic action"). Not client-facing
 * in the guest/buyer sense — an authenticated ncc_admin actor is the only
 * caller ever authorized to invoke it (enforced by ../auth/authorization,
 * not by this schema) — so, unlike the schemas above, it legitimately
 * carries the delivery/VAT/total fields the admin is confirming.
 */
export const nccApprovalSchema = z
  .object({
    orderRequestId: z.string().min(1),
    lines: z
      .array(
        z
          .object({
            orderRequestLineId: z.string().min(1),
            confirmedQuantity: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .min(1),
    deliveryPence: z.number().int().nonnegative(),
    vatPence: z.number().int().nonnegative(),
    finalTotalPence: z.number().int().nonnegative(),
  })
  .strict()
export type NccApprovalInput = z.infer<typeof nccApprovalSchema>

export const returnRequestSchema = z
  .object({
    orderRequestId: z.string().min(1),
    reason: z.string().min(1),
    note: z.string().min(1).optional(),
    lines: z
      .array(
        z
          .object({
            orderRequestLineId: z.string().min(1),
            quantity: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
export type ReturnRequestInput = z.infer<typeof returnRequestSchema>

export const supportTicketMessageSchema = z
  .object({
    supportTicketId: z.string().min(1),
    message: z.string().min(1).max(5000),
  })
  .strict()
export type SupportTicketMessageInput = z.infer<typeof supportTicketMessageSchema>
