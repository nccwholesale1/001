import { timingSafeEqual } from 'node:crypto'
import { useSession } from '@tanstack/react-start/server'
import { env } from '../env'

/**
 * Temporary, whole-site pre-launch gate — entirely separate from buyer
 * sign-in (buyers/buyer-session.ts) and staff auth (auth/session.ts). One
 * shared password, held server-side only in SITE_ACCESS_PASSWORD, never
 * sent to the client. Session cookie lasts 30 days so a visitor who's
 * already entered the password isn't asked again on every visit.
 */

interface SiteAccessSessionData {
  granted?: boolean
}

function getSiteAccessSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see ../buyers/buyer-session.ts's identical note on useSession.
  return useSession<SiteAccessSessionData>({
    password: env.SESSION_SECRET,
    name: 'ncc_site_access',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    },
  })
}

export async function hasSiteAccess(): Promise<boolean> {
  const session = await getSiteAccessSession()
  return session.data.granted === true
}

/** Constant-time comparison — this gate is meant to keep casual visitors out, not withstand a targeted attack, but there's no reason to leak timing anyway. */
export function isCorrectSiteAccessPassword(candidate: string): boolean {
  const expected = Buffer.from(env.SITE_ACCESS_PASSWORD)
  const actual = Buffer.from(candidate)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export async function grantSiteAccess(): Promise<void> {
  const session = await getSiteAccessSession()
  await session.update({ granted: true })
}
