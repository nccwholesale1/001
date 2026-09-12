import type { BuyerRole } from '../db/schema'

/** Generic authorization failure — shared across every module that enforces `canViewCompanyResource`/`canMutateCompanyResource`. */
export class ForbiddenError extends Error {
  constructor(message = 'Not authorized to perform this action') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * The five roles from docs/route-permissions-matrix.md, as a discriminated
 * union rather than a flat role string — callers narrow with `actor.kind`
 * and TypeScript tracks which fields (companyId, assignedCompanyIds, ...)
 * are actually available for each. `guest` is included for completeness but
 * every guard below denies it: guest access to any company-scoped resource
 * is mediated entirely by ../tokens/token-service, never by actor identity
 * (matrix: guest rows are all "Token-gated", never "Full"/"Own data only").
 */
export type Actor =
  | { kind: 'guest' }
  | { kind: 'buyer'; buyerUserId: string; companyId: string; role: BuyerRole }
  | { kind: 'sales_rep'; staffUserId: string; assignedCompanyIds: readonly string[] }
  | { kind: 'ncc_admin'; staffUserId: string }

/**
 * The company/owner shape shared by order requests, quotes, returns, and
 * support tickets. `companyId: null` means the resource was created by a
 * guest (no company at all) — only an NCC admin can reach those, never a
 * sales rep, since a guest resource can't be "assigned" to anyone.
 */
export interface CompanyScopedResourceRef {
  companyId: string | null
  ownerBuyerUserId: string | null
}

/**
 * Deny-by-default read/view access (CLAUDE.md rule 17) for the matrix's
 * "Own data only" and "Read-only, assigned companies only" cells:
 * `/order/:id`, `/quote/:id`, `/returns/:id`, `/support/:id`,
 * `/account/orders`, `/staff/orders`, etc.
 *
 * A plain `buyer` sees only the resources they personally own; a
 * `company_admin` sees every resource owned by anyone in their company; a
 * `sales_rep` sees every resource in a company they are assigned to (but
 * see `canMutateCompanyResource` — this function alone never grants write);
 * an `ncc_admin` sees everything.
 */
export function canViewCompanyResource(actor: Actor, resource: CompanyScopedResourceRef): boolean {
  switch (actor.kind) {
    case 'guest':
      return false
    case 'buyer':
      if (resource.companyId !== actor.companyId) return false
      return actor.role === 'company_admin' || resource.ownerBuyerUserId === actor.buyerUserId
    case 'sales_rep':
      return resource.companyId !== null && actor.assignedCompanyIds.includes(resource.companyId)
    case 'ncc_admin':
      return true
  }
}

/**
 * Mutating a company-scoped resource (approve, reject, cancel, reply,
 * price/issue a quote, etc.). A sales rep is read-only everywhere,
 * regardless of assignment — this is an authorization boundary, not a UI
 * convention (route-permissions-matrix.md note). Only an NCC admin may
 * mutate on the staff side; a company admin may mutate only their own
 * company's resources (e.g. the company-approval step); a plain buyer never
 * mutates one of these resources directly (cancellation before submission
 * happens on the basket, not here).
 */
export function canMutateCompanyResource(
  actor: Actor,
  resource: CompanyScopedResourceRef,
): boolean {
  switch (actor.kind) {
    case 'guest':
    case 'sales_rep':
      return false
    case 'buyer':
      return actor.role === 'company_admin' && resource.companyId === actor.companyId
    case 'ncc_admin':
      return true
  }
}

/** `/staff/team` — no role but NCC admin reaches this, not even read-only. */
export function canManageStaffTeam(actor: Actor): boolean {
  return actor.kind === 'ncc_admin'
}

export function isNccAdmin(actor: Actor): actor is Extract<Actor, { kind: 'ncc_admin' }> {
  return actor.kind === 'ncc_admin'
}

export function isSalesRep(actor: Actor): actor is Extract<Actor, { kind: 'sales_rep' }> {
  return actor.kind === 'sales_rep'
}

export function isCompanyAdmin(
  actor: Actor,
): actor is Extract<Actor, { kind: 'buyer' }> & { role: 'company_admin' } {
  return actor.kind === 'buyer' && actor.role === 'company_admin'
}
