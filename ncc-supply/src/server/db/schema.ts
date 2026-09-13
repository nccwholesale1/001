import { sql } from 'drizzle-orm'
import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Schema for every app-owned entity in docs/domain-model.md. Shopify remains
 * system of record for catalogue/draft-orders/returns-refunds (PRD §7.1) —
 * nothing here duplicates that; where a row needs to reference a Shopify
 * object, it stores only the Shopify GID as a plain text column.
 *
 * SQLite (via @libsql/client) per DECISIONS.md ADR-004 revision — Postgres
 * was the original recommendation but this build machine has neither
 * Postgres nor Docker installed.
 */

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`),
}

// ---------------------------------------------------------------------------
// Companies, locations, buyers (app-owned per ADR-006 — no Shopify B2B object)
// ---------------------------------------------------------------------------

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Self-reported at registration — see baskets.referringSalesRepId for the same field on orders/quotes. */
  referringSalesRepId: text('referring_sales_rep_id'),
  ...timestamps,
})

export const companyLocations = sqliteTable('company_locations', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  label: text('label').notNull(),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  postcode: text('postcode').notNull(),
  ...timestamps,
})

export const BUYER_ROLES = ['buyer', 'company_admin'] as const
export type BuyerRole = (typeof BUYER_ROLES)[number]

export const BUYER_STATUSES = ['invited', 'active', 'removed'] as const
export type BuyerStatus = (typeof BUYER_STATUSES)[number]

export const buyerUsers = sqliteTable(
  'buyer_users',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    /** Always stored lowercase — case-insensitive uniqueness/lookup (PRD acceptance criterion 21: email-only sign-in). */
    email: text('email').notNull(),
    role: text('role', { enum: BUYER_ROLES }).notNull().default('buyer'),
    spendLimit: integer('spend_limit_pence'),
    status: text('status', { enum: BUYER_STATUSES }).notNull().default('invited'),
    /** Correlates to a plain Shopify new-customer-account, never a B2B company link (ADR-003). */
    shopifyCustomerId: text('shopify_customer_id'),
    ...timestamps,
  },
  (table) => [uniqueIndex('buyer_users_email_unique').on(table.email)],
)

// ---------------------------------------------------------------------------
// NCC staff (entirely app-owned, PRD §7.2)
// ---------------------------------------------------------------------------

export const STAFF_ROLES = ['ncc_admin', 'sales_rep'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export const STAFF_STATUSES = ['pending_id_verification', 'active', 'deactivated'] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const staffUsers = sqliteTable(
  'staff_users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Lowercase-normalized. Sign-in accepts email OR username in one field (PRD §2). */
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: STAFF_ROLES }).notNull(),
    /** Required, unique once set, before a sales-rep account can activate (PRD §6.22). Null for ncc_admin. */
    employeeId: text('employee_id'),
    status: text('status', { enum: STAFF_STATUSES }).notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('staff_users_email_unique').on(table.email),
    uniqueIndex('staff_users_username_unique').on(table.username),
    uniqueIndex('staff_users_employee_id_unique').on(table.employeeId),
  ],
)

export const salesRepAssignments = sqliteTable(
  'sales_rep_assignments',
  {
    id: text('id').primaryKey(),
    staffUserId: text('staff_user_id')
      .notNull()
      .references(() => staffUsers.id),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id),
    ...timestamps,
  },
  (table) => [uniqueIndex('sales_rep_assignments_unique').on(table.staffUserId, table.companyId)],
)

export const staffSessions = sqliteTable(
  'staff_sessions',
  {
    id: text('id').primaryKey(),
    /** SHA-256 hex digest of the raw session token. The raw token is only ever held by the client (CLAUDE.md rule 16 — same non-enumerable pattern as guestTokens). */
    tokenHash: text('token_hash').notNull(),
    staffUserId: text('staff_user_id')
      .notNull()
      .references(() => staffUsers.id),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    ...timestamps,
  },
  (table) => [uniqueIndex('staff_sessions_token_hash_unique').on(table.tokenHash)],
)

// ---------------------------------------------------------------------------
// Baskets (pre-submission; guest or buyer-owned)
// ---------------------------------------------------------------------------

export const BASKET_STATUSES = ['open', 'submitted'] as const
export type BasketStatus = (typeof BASKET_STATUSES)[number]

export const baskets = sqliteTable('baskets', {
  id: text('id').primaryKey(),
  /** Null for a guest basket — guest identity is a session-cookie pointer to this row (Phase 6), never held client-side. */
  buyerUserId: text('buyer_user_id').references(() => buyerUsers.id),
  contactEmail: text('contact_email'),
  contactName: text('contact_name'),
  status: text('status', { enum: BASKET_STATUSES }).notNull().default('open'),
  /** Set once the basket becomes an order request (Phase 6) — a submitted basket is never editable again. */
  orderRequestId: text('order_request_id').references(() => orderRequests.id),
  /**
   * A self-reported NCC sales-rep identifier a buyer/guest optionally names
   * (e.g. from the Bulk Order page) so NCC can credit/follow up on the lead
   * — never an authorization credential, never validated against a real
   * staff row. Copied onto the resulting order_requests row at submission
   * (see submit-order-request.ts).
   */
  referringSalesRepId: text('referring_sales_rep_id'),
  ...timestamps,
})

export const basketLines = sqliteTable('basket_lines', {
  id: text('id').primaryKey(),
  basketId: text('basket_id')
    .notNull()
    .references(() => baskets.id),
  /** Catalogue SKU — how the app re-resolves current price/product truth (CatalogueAdapter.getProduct has no by-variant-id lookup). */
  sku: text('sku').notNull(),
  /** Shopify variant GID — carried through to the eventual Shopify draft order line (Phase 8). */
  shopifyVariantId: text('shopify_variant_id').notNull(),
  quantity: integer('quantity').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Order requests — the two-stage approval workflow (PRD §4 rules 6 & 13)
// ---------------------------------------------------------------------------

export const ORDER_REQUEST_STATUSES = [
  'awaiting_company_approval',
  'awaiting_ncc_review',
  'confirmed',
  'cancelled',
] as const
export type OrderRequestStatus = (typeof ORDER_REQUEST_STATUSES)[number]

export const orderRequests = sqliteTable('order_requests', {
  id: text('id').primaryKey(),
  buyerUserId: text('buyer_user_id').references(() => buyerUsers.id),
  guestContactEmail: text('guest_contact_email'),
  guestContactName: text('guest_contact_name'),
  status: text('status', { enum: ORDER_REQUEST_STATUSES }).notNull(),
  companyApprovedByBuyerUserId: text('company_approved_by_buyer_user_id').references(
    () => buyerUsers.id,
  ),
  companyApprovedAt: text('company_approved_at'),
  nccApprovedByStaffUserId: text('ncc_approved_by_staff_user_id').references(() => staffUsers.id),
  nccApprovedAt: text('ncc_approved_at'),
  cancelledReason: text('cancelled_reason'),
  deliveryPence: integer('delivery_pence'),
  vatPence: integer('vat_pence'),
  finalTotalPence: integer('final_total_pence'),
  invoiceUrl: text('invoice_url'),
  internalNotes: text('internal_notes'),
  /** Set only after NCC approval creates the Shopify Draft Order (PRD §7.1). */
  shopifyDraftOrderId: text('shopify_draft_order_id'),
  /** Copied from the submitting basket, if named — see baskets.referringSalesRepId. */
  referringSalesRepId: text('referring_sales_rep_id'),
  ...timestamps,
})

export const orderRequestLines = sqliteTable('order_request_lines', {
  id: text('id').primaryKey(),
  orderRequestId: text('order_request_id')
    .notNull()
    .references(() => orderRequests.id),
  /** Catalogue SKU — how the app re-resolves current product title/image for display (CatalogueAdapter.getProduct has no by-variant-id lookup). */
  sku: text('sku').notNull(),
  shopifyVariantId: text('shopify_variant_id').notNull(),
  requestedQuantity: integer('requested_quantity').notNull(),
  /** Null until NCC review. May only be <= requestedQuantity, never greater (rule 2/15) — enforced in domain/status.ts, not the DB layer alone. */
  confirmedQuantity: integer('confirmed_quantity'),
  unitPricePence: integer('unit_price_pence').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Quotes (PRD §6.8)
// ---------------------------------------------------------------------------

export const QUOTE_STATUSES = ['requested', 'quoted', 'accepted', 'expired'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  buyerUserId: text('buyer_user_id').references(() => buyerUsers.id),
  guestContactEmail: text('guest_contact_email'),
  guestContactName: text('guest_contact_name'),
  status: text('status', { enum: QUOTE_STATUSES }).notNull(),
  issuedByStaffUserId: text('issued_by_staff_user_id').references(() => staffUsers.id),
  expiresAt: text('expires_at'),
  /** Set when accepted — the order request it became (rule: quote never skips NCC review). */
  convertedOrderRequestId: text('converted_order_request_id').references(() => orderRequests.id),
  /** Self-reported at request time — see baskets.referringSalesRepId for the same field on orders. */
  referringSalesRepId: text('referring_sales_rep_id'),
  ...timestamps,
})

export const quoteLines = sqliteTable('quote_lines', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id')
    .notNull()
    .references(() => quotes.id),
  /** Catalogue SKU — same reasoning as orderRequestLines.sku: the CatalogueAdapter has no by-variant-id lookup, only getProduct(sku). */
  sku: text('sku').notNull(),
  shopifyVariantId: text('shopify_variant_id').notNull(),
  requestedQuantity: integer('requested_quantity').notNull(),
  quotedUnitPricePence: integer('quoted_unit_price_pence'),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Returns (PRD §6.16-6.17) — must reference an existing confirmed order+line
// ---------------------------------------------------------------------------

export const RETURN_STATUSES = [
  'requested',
  'under_review',
  'approved',
  'rejected',
  'refunded',
  'replacement_sent',
] as const
export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export const returns = sqliteTable('returns', {
  id: text('id').primaryKey(),
  orderRequestId: text('order_request_id')
    .notNull()
    .references(() => orderRequests.id),
  status: text('status', { enum: RETURN_STATUSES }).notNull(),
  reason: text('reason').notNull(),
  note: text('note'),
  rejectionReason: text('rejection_reason'),
  resolution: text('resolution', { enum: ['refund', 'replacement'] }),
  handledByStaffUserId: text('handled_by_staff_user_id').references(() => staffUsers.id),
  ...timestamps,
})

export const returnLines = sqliteTable('return_lines', {
  id: text('id').primaryKey(),
  returnId: text('return_id')
    .notNull()
    .references(() => returns.id),
  orderRequestLineId: text('order_request_line_id')
    .notNull()
    .references(() => orderRequestLines.id),
  quantity: integer('quantity').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Support tickets (PRD §6.18-6.19) — no originating order required
// ---------------------------------------------------------------------------

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'awaiting_ncc',
  'awaiting_customer',
  'resolved',
  'escalated',
] as const
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]

export const supportTickets = sqliteTable('support_tickets', {
  id: text('id').primaryKey(),
  buyerUserId: text('buyer_user_id').references(() => buyerUsers.id),
  guestContactEmail: text('guest_contact_email'),
  category: text('category').notNull(),
  orderRequestId: text('order_request_id').references(() => orderRequests.id),
  returnId: text('return_id').references(() => returns.id),
  status: text('status', { enum: SUPPORT_TICKET_STATUSES }).notNull(),
  ...timestamps,
})

export const supportTicketMessages = sqliteTable('support_ticket_messages', {
  id: text('id').primaryKey(),
  supportTicketId: text('support_ticket_id')
    .notNull()
    .references(() => supportTickets.id),
  authorStaffUserId: text('author_staff_user_id').references(() => staffUsers.id),
  authorBuyerUserId: text('author_buyer_user_id').references(() => buyerUsers.id),
  isInternalNote: integer('is_internal_note', { mode: 'boolean' }).notNull().default(false),
  message: text('message').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Attachments (PRD §6.16, §6.18 "optional note and photo upload" /
// "optional attachment") — stored in-app, never on local disk (no path-
// traversal surface) and never a public static path (served only through
// the owning resource's own authorization check, CLAUDE.md rule 21).
// ---------------------------------------------------------------------------

export const ATTACHMENT_OWNER_TYPES = ['return', 'support_ticket_message'] as const
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number]

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  ownerType: text('owner_type', { enum: ATTACHMENT_OWNER_TYPES }).notNull(),
  ownerId: text('owner_id').notNull(),
  filename: text('filename').notNull(),
  /** The sniffed content type from the file's own magic bytes, never the client's claimed MIME type. */
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Cross-cutting: tokens, idempotency, audit trail
// ---------------------------------------------------------------------------

export const TOKEN_RESOURCE_TYPES = ['order_request', 'quote', 'return', 'support_ticket'] as const
export type TokenResourceType = (typeof TOKEN_RESOURCE_TYPES)[number]

export const guestTokens = sqliteTable(
  'guest_tokens',
  {
    id: text('id').primaryKey(),
    /** SHA-256 hex digest of the raw token. The raw token itself is never stored (CLAUDE.md rule 16). */
    tokenHash: text('token_hash').notNull(),
    resourceType: text('resource_type', { enum: TOKEN_RESOURCE_TYPES }).notNull(),
    resourceId: text('resource_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    ...timestamps,
  },
  (table) => [uniqueIndex('guest_tokens_hash_unique').on(table.tokenHash)],
)

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    scope: text('scope').notNull(),
    /** JSON-serialized result of the first successful run, replayed on duplicate calls. */
    resultJson: text('result_json').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('idempotency_keys_scope_key_unique').on(table.scope, table.key)],
)

export const AUDIT_ACTOR_TYPES = ['guest', 'buyer', 'staff', 'system'] as const
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number]

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    actorType: text('actor_type', { enum: AUDIT_ACTOR_TYPES }).notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    /** JSON-serialized before/after or other structured detail. */
    detailJson: text('detail_json'),
    ...timestamps,
  },
  (table) => [index('audit_events_resource_idx').on(table.resourceType, table.resourceId)],
)
