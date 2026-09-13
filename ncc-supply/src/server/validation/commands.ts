import { z } from 'zod'
import { BUYER_ROLES, STAFF_ROLES } from '../db/schema'

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

/** Raw file/paste text — parsed and row-capped server-side (see server/bulk-order/csv.ts). */
export const bulkOrderCsvSchema = z.object({ csvText: z.string().min(1).max(256_000) }).strict()
export type BulkOrderCsvInput = z.infer<typeof bulkOrderCsvSchema>

export const addBulkOrderLinesSchema = z
  .object({
    lines: z
      .array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() }).strict())
      .min(1)
      .max(500),
  })
  .strict()
export type AddBulkOrderLinesInput = z.infer<typeof addBulkOrderLinesSchema>

export const quoteRequestSchema = z
  .object({
    lines: z
      .array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() }).strict())
      .min(1)
      .max(100),
    contactEmail: z.string().email().optional(),
    contactName: z.string().min(1).optional(),
  })
  .strict()
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

/** NCC-admin-only (enforced in server/quotes/quote-pricing.ts, not here — schema validation and authorization are separate concerns). */
export const issueQuoteSchema = z
  .object({
    quoteId: z.string().min(1),
    lines: z
      .array(
        z
          .object({ quoteLineId: z.string().min(1), quotedUnitPricePence: z.number().int().nonnegative() })
          .strict(),
      )
      .min(1),
    expiresInDays: z.number().int().positive().max(365).optional(),
  })
  .strict()
export type IssueQuoteInput = z.infer<typeof issueQuoteSchema>

export const acceptQuoteSchema = z.object({ quoteId: z.string().min(1) }).strict()
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>

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
    internalNotes: z.string().max(5000).optional(),
  })
  .strict()
export type NccApprovalInput = z.infer<typeof nccApprovalSchema>

/** NCC-admin-only (see nccApprovalSchema's note) — a required reason per the phase's own rule. */
export const cancelOrderSchema = z
  .object({
    orderRequestId: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict()
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>

/** Base64-length cap is a defense-in-depth schema-level guard — storeAttachment enforces the real byte-size limit after decoding. */
export const attachmentInputSchema = z
  .object({
    filename: z.string().min(1).max(255),
    base64: z.string().min(1).max(7_000_000),
  })
  .strict()

/** PRD §6.16: "a reason from a defined list" — the exact list the PRD itself gives as an example; the final list is still Open Question 5. */
export const RETURN_REASONS = ['damaged', 'wrong_item', 'no_longer_needed', 'other'] as const

export const returnRequestSchema = z
  .object({
    orderRequestId: z.string().min(1),
    reason: z.enum(RETURN_REASONS),
    note: z.string().min(1).max(2000).optional(),
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
    attachment: attachmentInputSchema.optional(),
    /** Required only for a guest submitting against their own order — proves ownership (see submit-return-request.ts). */
    orderToken: z.string().optional(),
  })
  .strict()
export type ReturnRequestInput = z.infer<typeof returnRequestSchema>

export const decideReturnSchema = z
  .object({
    returnId: z.string().min(1),
    decision: z.enum(['approve', 'reject']),
    resolution: z.enum(['refund', 'replacement']).optional(),
    rejectionReason: z.string().min(1).max(2000).optional(),
  })
  .strict()
export type DecideReturnInput = z.infer<typeof decideReturnSchema>

export const markReturnOutcomeSchema = z
  .object({
    returnId: z.string().min(1),
    outcome: z.enum(['refunded', 'replacement_sent']),
  })
  .strict()
export type MarkReturnOutcomeInput = z.infer<typeof markReturnOutcomeSchema>

/** PRD §6.18: "category (order issue, account issue, site issue, other)" — the exact list the PRD itself gives. */
export const SUPPORT_TICKET_CATEGORIES = ['order_issue', 'account_issue', 'site_issue', 'other'] as const

export const supportTicketRequestSchema = z
  .object({
    category: z.enum(SUPPORT_TICKET_CATEGORIES),
    orderRequestId: z.string().min(1).optional(),
    returnId: z.string().min(1).optional(),
    message: z.string().min(1).max(5000),
    attachment: attachmentInputSchema.optional(),
    /** Required only when referencing an order/return as a guest. */
    referenceToken: z.string().optional(),
    contactEmail: z.string().email().optional(),
  })
  .strict()
export type SupportTicketRequestInput = z.infer<typeof supportTicketRequestSchema>

/** The customer-facing (guest-token-or-buyer) reply action on `/support/:id` — see `routes/support/$id.tsx`. */
export const supportTicketMessageSchema = z
  .object({
    ticketId: z.string().min(1),
    token: z.string().optional(),
    message: z.string().min(1).max(5000),
    attachment: attachmentInputSchema.optional(),
  })
  .strict()
export type SupportTicketMessageInput = z.infer<typeof supportTicketMessageSchema>

export const staffSupportReplySchema = z
  .object({
    ticketId: z.string().min(1),
    message: z.string().min(1).max(5000),
    isInternalNote: z.boolean(),
    attachment: attachmentInputSchema.optional(),
  })
  .strict()
export type StaffSupportReplyInput = z.infer<typeof staffSupportReplySchema>

export const supportTicketIdSchema = z.object({ ticketId: z.string().min(1) }).strict()

/** PRD §6.22 "Add account" — an initial password is required since staff sign-in is a real password check, unlike the buyer email-code flow; no password-reset-by-email flow exists in this build (see DECISIONS.md). */
export const addStaffAccountSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    username: z.string().min(3).max(50),
    role: z.enum(STAFF_ROLES),
    initialPassword: z.string().min(8),
    employeeId: z.string().min(1).max(20).optional(),
  })
  .strict()
export type AddStaffAccountInput = z.infer<typeof addStaffAccountSchema>

export const staffAccountIdSchema = z.object({ staffUserId: z.string().min(1) }).strict()

export const updateStaffRoleSchema = z
  .object({
    staffUserId: z.string().min(1),
    role: z.enum(STAFF_ROLES),
    employeeId: z.string().min(1).max(20).optional(),
  })
  .strict()
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>

export const salesRepCompanyAssignmentSchema = z
  .object({ staffUserId: z.string().min(1), companyId: z.string().min(1) })
  .strict()
export type SalesRepCompanyAssignmentInput = z.infer<typeof salesRepCompanyAssignmentSchema>
