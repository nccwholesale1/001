import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { invalidateSession } from '../auth/session'
import { db } from '../db/client'
import type { StaffRole } from '../db/schema'
import { checkRateLimit, checkRateLimitByIp } from '../shared/rate-limit'
import { signInStaff } from './login'
import { clearStaffSessionCookie, getCurrentStaffActor, setStaffSessionCookie } from './staff-session'

const loginSchema = z.object({ identifier: z.string().min(1), password: z.string().min(1) })

/**
 * Two independent caps: one per source IP (a single attacker trying many
 * usernames), one per identifier regardless of IP (a distributed attacker
 * spraying one account from many IPs — a plain per-IP limit alone would
 * never catch this). scrypt's own cost (see auth/password.ts) already
 * throttles a single guess; this caps guess *volume* on top of that.
 */
export const staffLogin = createServerFn({ method: 'POST' })
  .validator(loginSchema.parse)
  .handler(async ({ data }) => {
    checkRateLimitByIp('staff-login', { limit: 20, windowMs: 15 * 60 * 1000 })
    checkRateLimit(`staff-login-identifier:${data.identifier.toLowerCase()}`, { limit: 8, windowMs: 15 * 60 * 1000 })
    const result = await signInStaff(db, data)
    setStaffSessionCookie(result.session)
    return { role: result.role }
  })

export const staffLogout = createServerFn({ method: 'POST' }).handler(async () => {
  const token = getCookie('ncc_staff_session')
  if (token) await invalidateSession(db, token)
  clearStaffSessionCookie()
})

export interface CurrentStaffSummary {
  role: StaffRole
}

export const getCurrentStaff = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentStaffSummary | null> => {
    const actor = await getCurrentStaffActor(db)
    if (!actor) return null
    return { role: actor.kind === 'ncc_admin' ? 'ncc_admin' : 'sales_rep' }
  },
)
