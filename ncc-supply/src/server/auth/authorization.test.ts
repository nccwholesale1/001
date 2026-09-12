import { describe, expect, it } from 'vitest'
import {
  canManageStaffTeam,
  canMutateCompanyResource,
  canViewCompanyResource,
  isCompanyAdmin,
  isNccAdmin,
  isSalesRep,
  type Actor,
  type CompanyScopedResourceRef,
} from './authorization'

const guest: Actor = { kind: 'guest' }
const buyerA: Actor = {
  kind: 'buyer',
  buyerUserId: 'buyer_a',
  companyId: 'company_a',
  role: 'buyer',
}
const otherBuyerA: Actor = {
  kind: 'buyer',
  buyerUserId: 'buyer_a2',
  companyId: 'company_a',
  role: 'buyer',
}
const adminA: Actor = {
  kind: 'buyer',
  buyerUserId: 'admin_a',
  companyId: 'company_a',
  role: 'company_admin',
}
const buyerB: Actor = {
  kind: 'buyer',
  buyerUserId: 'buyer_b',
  companyId: 'company_b',
  role: 'buyer',
}
const repAssignedToA: Actor = {
  kind: 'sales_rep',
  staffUserId: 'rep_1',
  assignedCompanyIds: ['company_a'],
}
const repAssignedToB: Actor = {
  kind: 'sales_rep',
  staffUserId: 'rep_2',
  assignedCompanyIds: ['company_b'],
}
const nccAdmin: Actor = { kind: 'ncc_admin', staffUserId: 'staff_1' }

const orderOwnedByBuyerA: CompanyScopedResourceRef = {
  companyId: 'company_a',
  ownerBuyerUserId: 'buyer_a',
}
const guestOrder: CompanyScopedResourceRef = { companyId: null, ownerBuyerUserId: null }

describe('canViewCompanyResource', () => {
  it('denies guests entirely — guest access is token-mediated, not actor-based', () => {
    expect(canViewCompanyResource(guest, orderOwnedByBuyerA)).toBe(false)
    expect(canViewCompanyResource(guest, guestOrder)).toBe(false)
  })

  it("lets a buyer view their own order but not a colleague's", () => {
    expect(canViewCompanyResource(buyerA, orderOwnedByBuyerA)).toBe(true)
    expect(canViewCompanyResource(otherBuyerA, orderOwnedByBuyerA)).toBe(false)
  })

  it('lets a company admin view any order in their own company', () => {
    expect(canViewCompanyResource(adminA, orderOwnedByBuyerA)).toBe(true)
  })

  it('denies cross-company access outright, even for a company admin', () => {
    expect(canViewCompanyResource(buyerB, orderOwnedByBuyerA)).toBe(false)
    const adminB: Actor = {
      kind: 'buyer',
      buyerUserId: 'admin_b',
      companyId: 'company_b',
      role: 'company_admin',
    }
    expect(canViewCompanyResource(adminB, orderOwnedByBuyerA)).toBe(false)
  })

  it('scopes a sales rep to only their assigned companies', () => {
    expect(canViewCompanyResource(repAssignedToA, orderOwnedByBuyerA)).toBe(true)
    expect(canViewCompanyResource(repAssignedToB, orderOwnedByBuyerA)).toBe(false)
  })

  it('never lets a sales rep view a guest-originated resource (no company to be assigned to)', () => {
    expect(canViewCompanyResource(repAssignedToA, guestOrder)).toBe(false)
  })

  it('lets an NCC admin view everything, including guest-originated resources', () => {
    expect(canViewCompanyResource(nccAdmin, orderOwnedByBuyerA)).toBe(true)
    expect(canViewCompanyResource(nccAdmin, guestOrder)).toBe(true)
  })
})

describe('canMutateCompanyResource', () => {
  it('denies a plain buyer from mutating even their own order', () => {
    expect(canMutateCompanyResource(buyerA, orderOwnedByBuyerA)).toBe(false)
  })

  it("lets a company admin mutate their own company's resource, never another company's", () => {
    expect(canMutateCompanyResource(adminA, orderOwnedByBuyerA)).toBe(true)
    const adminB: Actor = {
      kind: 'buyer',
      buyerUserId: 'admin_b',
      companyId: 'company_b',
      role: 'company_admin',
    }
    expect(canMutateCompanyResource(adminB, orderOwnedByBuyerA)).toBe(false)
  })

  it("denies a sales rep from mutating anything, even an assigned company's resource", () => {
    expect(canMutateCompanyResource(repAssignedToA, orderOwnedByBuyerA)).toBe(false)
  })

  it('denies guests', () => {
    expect(canMutateCompanyResource(guest, orderOwnedByBuyerA)).toBe(false)
  })

  it('lets an NCC admin mutate anything', () => {
    expect(canMutateCompanyResource(nccAdmin, orderOwnedByBuyerA)).toBe(true)
    expect(canMutateCompanyResource(nccAdmin, guestOrder)).toBe(true)
  })
})

describe('canManageStaffTeam', () => {
  it('is true only for an NCC admin', () => {
    expect(canManageStaffTeam(nccAdmin)).toBe(true)
  })

  it('is false for every other role, including a sales rep', () => {
    expect(canManageStaffTeam(repAssignedToA)).toBe(false)
    expect(canManageStaffTeam(adminA)).toBe(false)
    expect(canManageStaffTeam(buyerA)).toBe(false)
    expect(canManageStaffTeam(guest)).toBe(false)
  })
})

describe('role narrowing guards', () => {
  it('isNccAdmin / isSalesRep / isCompanyAdmin identify exactly their own kind', () => {
    expect(isNccAdmin(nccAdmin)).toBe(true)
    expect(isNccAdmin(repAssignedToA)).toBe(false)

    expect(isSalesRep(repAssignedToA)).toBe(true)
    expect(isSalesRep(nccAdmin)).toBe(false)

    expect(isCompanyAdmin(adminA)).toBe(true)
    expect(isCompanyAdmin(buyerA)).toBe(false)
  })
})
