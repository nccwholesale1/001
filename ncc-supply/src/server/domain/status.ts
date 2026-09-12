import type {
  BuyerStatus,
  OrderRequestStatus,
  QuoteStatus,
  ReturnStatus,
  StaffRole,
  StaffStatus,
  SupportTicketStatus,
} from '../db/schema'

/**
 * Pure status-transition guards for every state machine in
 * docs/domain-model.md. Each throws InvalidTransitionError on a disallowed
 * move rather than silently no-op'ing, so callers (and tests) can assert on
 * failure explicitly. These are pure functions — no DB access, no I/O — so
 * every business rule from PRD §4 is testable in isolation.
 */
export class InvalidTransitionError extends Error {
  constructor(entity: string, from: string, action: string) {
    super(`Cannot apply "${action}" to ${entity} in status "${from}"`)
    this.name = 'InvalidTransitionError'
  }
}

// ---------------------------------------------------------------------------
// Order request — PRD §4 rules 2, 6, 13, 15
// ---------------------------------------------------------------------------

export type OrderRequestAction =
  | { type: 'company_approve' }
  | { type: 'company_reject' }
  | { type: 'ncc_approve' }
  | { type: 'cancel' }

const ORDER_REQUEST_TRANSITIONS: Record<
  OrderRequestStatus,
  Partial<Record<OrderRequestAction['type'], OrderRequestStatus>>
> = {
  awaiting_company_approval: {
    company_approve: 'awaiting_ncc_review',
    company_reject: 'cancelled',
    cancel: 'cancelled',
  },
  awaiting_ncc_review: {
    ncc_approve: 'confirmed',
    cancel: 'cancelled',
  },
  confirmed: {
    cancel: 'cancelled',
  },
  cancelled: {},
}

export function transitionOrderRequest(
  current: OrderRequestStatus,
  action: OrderRequestAction,
): OrderRequestStatus {
  const next = ORDER_REQUEST_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('order request', current, action.type)
  return next
}

/**
 * Rule 2/15: confirmed quantity may be reduced or removed, never increased
 * above what was requested. Zero is allowed (a full line removal).
 */
export function assertConfirmedQuantityAllowed(
  requestedQuantity: number,
  confirmedQuantity: number,
) {
  if (confirmedQuantity < 0) {
    throw new Error('Confirmed quantity cannot be negative')
  }
  if (confirmedQuantity > requestedQuantity) {
    throw new Error(
      `Confirmed quantity (${confirmedQuantity}) cannot exceed the requested quantity (${requestedQuantity})`,
    )
  }
}

// ---------------------------------------------------------------------------
// Quote — PRD §6.8
// ---------------------------------------------------------------------------

export type QuoteAction = { type: 'issue' } | { type: 'accept' } | { type: 'expire' }

const QUOTE_TRANSITIONS: Record<QuoteStatus, Partial<Record<QuoteAction['type'], QuoteStatus>>> = {
  requested: { issue: 'quoted', expire: 'expired' },
  quoted: { accept: 'accepted', expire: 'expired' },
  accepted: {},
  expired: {},
}

export function transitionQuote(current: QuoteStatus, action: QuoteAction): QuoteStatus {
  const next = QUOTE_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('quote', current, action.type)
  return next
}

// ---------------------------------------------------------------------------
// Return — PRD §6.16-6.17
// ---------------------------------------------------------------------------

export type ReturnAction =
  | { type: 'begin_review' }
  | { type: 'approve' }
  | { type: 'reject' }
  | { type: 'mark_refunded' }
  | { type: 'mark_replacement_sent' }

const RETURN_TRANSITIONS: Record<
  ReturnStatus,
  Partial<Record<ReturnAction['type'], ReturnStatus>>
> = {
  requested: { begin_review: 'under_review' },
  under_review: { approve: 'approved', reject: 'rejected' },
  approved: { mark_refunded: 'refunded', mark_replacement_sent: 'replacement_sent' },
  rejected: {},
  refunded: {},
  replacement_sent: {},
}

export function transitionReturn(current: ReturnStatus, action: ReturnAction): ReturnStatus {
  const next = RETURN_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('return', current, action.type)
  return next
}

// ---------------------------------------------------------------------------
// Support ticket — PRD §6.18-6.21
// ---------------------------------------------------------------------------

export type SupportTicketAction =
  | { type: 'ncc_reply' }
  | { type: 'customer_reply' }
  | { type: 'resolve' }
  | { type: 'escalate' }
  | { type: 'reopen' }

const SUPPORT_TICKET_TRANSITIONS: Record<
  SupportTicketStatus,
  Partial<Record<SupportTicketAction['type'], SupportTicketStatus>>
> = {
  open: { ncc_reply: 'awaiting_customer', resolve: 'resolved', escalate: 'escalated' },
  awaiting_ncc: { ncc_reply: 'awaiting_customer', resolve: 'resolved', escalate: 'escalated' },
  awaiting_customer: { customer_reply: 'awaiting_ncc', resolve: 'resolved' },
  resolved: { reopen: 'awaiting_ncc' },
  escalated: { ncc_reply: 'awaiting_customer', resolve: 'resolved' },
}

export function transitionSupportTicket(
  current: SupportTicketStatus,
  action: SupportTicketAction,
): SupportTicketStatus {
  const next = SUPPORT_TICKET_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('support ticket', current, action.type)
  return next
}

// ---------------------------------------------------------------------------
// Buyer user — PRD §6.12
// ---------------------------------------------------------------------------

export type BuyerAction = { type: 'activate' } | { type: 'remove' }

const BUYER_TRANSITIONS: Record<BuyerStatus, Partial<Record<BuyerAction['type'], BuyerStatus>>> = {
  invited: { activate: 'active', remove: 'removed' },
  active: { remove: 'removed' },
  removed: {},
}

export function transitionBuyer(current: BuyerStatus, action: BuyerAction): BuyerStatus {
  const next = BUYER_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('buyer', current, action.type)
  return next
}

// ---------------------------------------------------------------------------
// Staff user — PRD §6.22, ADR-007 (sales-rep activation on first login)
// ---------------------------------------------------------------------------

export type StaffAction = { type: 'first_login' } | { type: 'deactivate' } | { type: 'reactivate' }

const STAFF_TRANSITIONS: Record<StaffStatus, Partial<Record<StaffAction['type'], StaffStatus>>> = {
  pending_id_verification: { first_login: 'active', deactivate: 'deactivated' },
  active: { deactivate: 'deactivated' },
  deactivated: { reactivate: 'active' },
}

export function transitionStaff(current: StaffStatus, action: StaffAction): StaffStatus {
  const next = STAFF_TRANSITIONS[current][action.type]
  if (!next) throw new InvalidTransitionError('staff user', current, action.type)
  return next
}

/**
 * ADR-007: a sales rep's first-login activation is gated on an employee ID
 * already being on file — the one identity check PRD §6.22 keeps. An NCC
 * admin has no such requirement (`employeeId` is null for that role by
 * design). Call this before `transitionStaff(current, { type: 'first_login' })`
 * for a sales-rep account; the transition itself has no way to see the
 * employee-ID field, so this guard is what actually enforces the rule.
 */
export function assertCanActivateOnFirstLogin(staff: {
  role: StaffRole
  employeeId: string | null
}) {
  if (staff.role === 'sales_rep' && !staff.employeeId) {
    throw new Error('A sales-rep account cannot activate without an employee ID on file')
  }
}
