import { describe, expect, it } from 'vitest'
import {
  InvalidTransitionError,
  assertCanActivateOnFirstLogin,
  assertConfirmedQuantityAllowed,
  transitionBuyer,
  transitionOrderRequest,
  transitionQuote,
  transitionReturn,
  transitionStaff,
  transitionSupportTicket,
} from './status'

describe('transitionOrderRequest', () => {
  it('moves through the full happy path: submit -> company approve -> ncc approve', () => {
    expect(transitionOrderRequest('awaiting_company_approval', { type: 'company_approve' })).toBe(
      'awaiting_ncc_review',
    )
    expect(transitionOrderRequest('awaiting_ncc_review', { type: 'ncc_approve' })).toBe('confirmed')
  })

  it('allows cancellation from any non-terminal state', () => {
    expect(transitionOrderRequest('awaiting_company_approval', { type: 'cancel' })).toBe(
      'cancelled',
    )
    expect(transitionOrderRequest('awaiting_ncc_review', { type: 'cancel' })).toBe('cancelled')
    expect(transitionOrderRequest('confirmed', { type: 'cancel' })).toBe('cancelled')
  })

  it('rejects skipping company approval straight to ncc approval', () => {
    expect(() =>
      transitionOrderRequest('awaiting_company_approval', { type: 'ncc_approve' }),
    ).toThrow(InvalidTransitionError)
  })

  it('rejects any action once cancelled', () => {
    expect(() => transitionOrderRequest('cancelled', { type: 'company_approve' })).toThrow(
      InvalidTransitionError,
    )
    expect(() => transitionOrderRequest('cancelled', { type: 'ncc_approve' })).toThrow(
      InvalidTransitionError,
    )
  })

  it('rejects re-approving an already-confirmed order', () => {
    expect(() => transitionOrderRequest('confirmed', { type: 'ncc_approve' })).toThrow(
      InvalidTransitionError,
    )
  })
})

describe('assertConfirmedQuantityAllowed', () => {
  it('allows a confirmed quantity equal to or less than requested', () => {
    expect(() => assertConfirmedQuantityAllowed(5, 5)).not.toThrow()
    expect(() => assertConfirmedQuantityAllowed(5, 2)).not.toThrow()
    expect(() => assertConfirmedQuantityAllowed(5, 0)).not.toThrow()
  })

  it('rejects a confirmed quantity greater than requested (rule 2/15: never silently increased)', () => {
    expect(() => assertConfirmedQuantityAllowed(5, 6)).toThrow(/cannot exceed/)
  })

  it('rejects a negative confirmed quantity', () => {
    expect(() => assertConfirmedQuantityAllowed(5, -1)).toThrow(/cannot be negative/)
  })
})

describe('transitionQuote', () => {
  it('moves through the full happy path: requested -> quoted -> accepted', () => {
    expect(transitionQuote('requested', { type: 'issue' })).toBe('quoted')
    expect(transitionQuote('quoted', { type: 'accept' })).toBe('accepted')
  })

  it('allows expiry from requested or quoted', () => {
    expect(transitionQuote('requested', { type: 'expire' })).toBe('expired')
    expect(transitionQuote('quoted', { type: 'expire' })).toBe('expired')
  })

  it('rejects accepting a quote that was never issued', () => {
    expect(() => transitionQuote('requested', { type: 'accept' })).toThrow(InvalidTransitionError)
  })

  it('rejects any action on an expired or accepted quote', () => {
    expect(() => transitionQuote('expired', { type: 'issue' })).toThrow(InvalidTransitionError)
    expect(() => transitionQuote('accepted', { type: 'expire' })).toThrow(InvalidTransitionError)
  })
})

describe('transitionReturn', () => {
  it('moves through the full happy path to refunded', () => {
    expect(transitionReturn('requested', { type: 'begin_review' })).toBe('under_review')
    expect(transitionReturn('under_review', { type: 'approve' })).toBe('approved')
    expect(transitionReturn('approved', { type: 'mark_refunded' })).toBe('refunded')
  })

  it('supports the replacement resolution path', () => {
    expect(transitionReturn('approved', { type: 'mark_replacement_sent' })).toBe('replacement_sent')
  })

  it('allows rejection only from under_review', () => {
    expect(transitionReturn('under_review', { type: 'reject' })).toBe('rejected')
    expect(() => transitionReturn('requested', { type: 'reject' })).toThrow(InvalidTransitionError)
  })

  it('rejects resolving a return that was never approved', () => {
    expect(() => transitionReturn('requested', { type: 'mark_refunded' })).toThrow(
      InvalidTransitionError,
    )
  })

  it('rejects any action on a terminal state', () => {
    expect(() => transitionReturn('rejected', { type: 'approve' })).toThrow(InvalidTransitionError)
    expect(() => transitionReturn('refunded', { type: 'mark_replacement_sent' })).toThrow(
      InvalidTransitionError,
    )
  })
})

describe('transitionSupportTicket', () => {
  it('moves through a reply cycle between ncc and customer', () => {
    expect(transitionSupportTicket('open', { type: 'ncc_reply' })).toBe('awaiting_customer')
    expect(transitionSupportTicket('awaiting_customer', { type: 'customer_reply' })).toBe(
      'awaiting_ncc',
    )
  })

  it('allows escalation from open or awaiting_ncc', () => {
    expect(transitionSupportTicket('open', { type: 'escalate' })).toBe('escalated')
    expect(transitionSupportTicket('awaiting_ncc', { type: 'escalate' })).toBe('escalated')
  })

  it('allows reopening a resolved ticket', () => {
    expect(transitionSupportTicket('resolved', { type: 'reopen' })).toBe('awaiting_ncc')
  })

  it('rejects a customer reply while awaiting ncc', () => {
    expect(() => transitionSupportTicket('awaiting_ncc', { type: 'customer_reply' })).toThrow(
      InvalidTransitionError,
    )
  })

  it('rejects any action other than reopen on a resolved ticket', () => {
    expect(() => transitionSupportTicket('resolved', { type: 'ncc_reply' })).toThrow(
      InvalidTransitionError,
    )
  })
})

describe('transitionBuyer', () => {
  it('moves invited -> active -> removed', () => {
    expect(transitionBuyer('invited', { type: 'activate' })).toBe('active')
    expect(transitionBuyer('active', { type: 'remove' })).toBe('removed')
  })

  it('allows removing directly from invited (e.g. revoking an unused invite)', () => {
    expect(transitionBuyer('invited', { type: 'remove' })).toBe('removed')
  })

  it('rejects any action once removed', () => {
    expect(() => transitionBuyer('removed', { type: 'activate' })).toThrow(InvalidTransitionError)
  })
})

describe('transitionStaff', () => {
  it('activates on first login (ADR-007)', () => {
    expect(transitionStaff('pending_id_verification', { type: 'first_login' })).toBe('active')
  })

  it('allows deactivation and reactivation', () => {
    expect(transitionStaff('active', { type: 'deactivate' })).toBe('deactivated')
    expect(transitionStaff('deactivated', { type: 'reactivate' })).toBe('active')
  })

  it('allows deactivating a staff account still pending id verification', () => {
    expect(transitionStaff('pending_id_verification', { type: 'deactivate' })).toBe('deactivated')
  })

  it('rejects a first_login action on an already-active or deactivated account', () => {
    expect(() => transitionStaff('active', { type: 'first_login' })).toThrow(InvalidTransitionError)
    expect(() => transitionStaff('deactivated', { type: 'first_login' })).toThrow(
      InvalidTransitionError,
    )
  })
})

describe('assertCanActivateOnFirstLogin', () => {
  it('rejects a sales rep with no employee ID on file (ADR-007)', () => {
    expect(() => assertCanActivateOnFirstLogin({ role: 'sales_rep', employeeId: null })).toThrow(
      /employee ID/,
    )
  })

  it('allows a sales rep whose employee ID is on file', () => {
    expect(() =>
      assertCanActivateOnFirstLogin({ role: 'sales_rep', employeeId: 'EMP-001' }),
    ).not.toThrow()
  })

  it('never requires an employee ID for an NCC admin', () => {
    expect(() =>
      assertCanActivateOnFirstLogin({ role: 'ncc_admin', employeeId: null }),
    ).not.toThrow()
  })
})
