import { z } from 'zod'

/**
 * Every schema a guest or buyer can submit is `.strict()` — Zod rejects any
 * key it doesn't recognize rather than silently dropping it. That's the
 * concrete enforcement of CLAUDE.md rule 9 here: a client attempting to add
 * `unitPricePence`/`totalPence`/`status` to a request body fails validation
 * outright instead of the server having to remember to ignore those fields.
 */

const basketLineInputSchema = z
  .object({
    shopifyVariantId: z.string().min(1),
    quantity: z.number().int().positive(),
  })
  .strict()

export const submitBasketSchema = z
  .object({
    basketId: z.string().min(1),
    contactEmail: z.string().email().optional(),
    contactName: z.string().min(1).optional(),
    lines: z.array(basketLineInputSchema).min(1),
  })
  .strict()
export type SubmitBasketInput = z.infer<typeof submitBasketSchema>

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
