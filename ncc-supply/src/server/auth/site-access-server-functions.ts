import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { grantSiteAccess, hasSiteAccess, isCorrectSiteAccessPassword } from './site-access'

export const checkSiteAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => hasSiteAccess(),
)

const submitSiteAccessSchema = z.object({ password: z.string().min(1) })

export const submitSiteAccess = createServerFn({ method: 'POST' })
  .validator(submitSiteAccessSchema.parse)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!isCorrectSiteAccessPassword(data.password)) return { ok: false }
    await grantSiteAccess()
    return { ok: true }
  })
