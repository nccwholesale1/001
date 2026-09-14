import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'
import { getCurrentActor } from '../../server/buyers/buyer-session'
import { db } from '../../server/db/client'
import { buildReturnView, getReturnViewForActor, type ReturnView } from '../../server/returns/return-view'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { getAttachmentDataUrl } from '../../server/attachments/server-functions'
import { Container, Section } from '../../components/ui/Layout'
import { ReturnDetail } from '../../components/ui/ReturnDetail'

const returnDetailQuerySchema = z.object({ returnId: z.string().min(1), token: z.string().optional() }).strict()

const getReturnDetailView = createServerFn({ method: 'GET' })
  .validator(returnDetailQuerySchema.parse)
  .handler(async ({ data }): Promise<ReturnView | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'return')
      if (!verification || verification.resourceId !== data.returnId) return null
      return buildReturnView(db, data.returnId)
    }
    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      return await getReturnViewForActor(db, actor, data.returnId)
    } catch {
      return null
    }
  })

const returnDetailSearchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/returns/$id')({
  validateSearch: returnDetailSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const ret = await getReturnDetailView({ data: { returnId: params.id, token: deps.token } })
    if (!ret) throw notFound()
    return { ret, token: deps.token }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Return Status · NCC Supply' }] }),
  notFoundComponent: ReturnStatusNotFound,
  component: ReturnStatusRoute,
})

function ReturnStatusNotFound() {
  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-foreground">We Couldn't Find That Return</h1>
        <p className="text-sm text-muted-foreground">
          The link may be incorrect, expired, or no longer valid. If you have a support query,{' '}
          <a href="/support" className="text-primary hover:underline">
            contact NCC
          </a>
          .
        </p>
      </Container>
    </Section>
  )
}

function ReturnStatusRoute() {
  const { ret, token } = Route.useLoaderData()
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [loadingAttachment, setLoadingAttachment] = useState(false)
  const fetchAttachment = useServerFn(getAttachmentDataUrl)

  async function handleViewAttachment() {
    if (!ret.attachmentId) return
    setLoadingAttachment(true)
    try {
      const result = await fetchAttachment({ data: { attachmentId: ret.attachmentId, token } })
      if (result) setAttachmentUrl(result.dataUrl)
    } finally {
      setLoadingAttachment(false)
    }
  }

  return (
    <ReturnDetail
      ret={ret}
      actions={
        ret.attachmentId ? (
          <div className="flex flex-col gap-2">
            {attachmentUrl ? (
              <img src={attachmentUrl} alt="Attached to this return" className="max-w-xs rounded-lg border border-border" />
            ) : (
              <button
                type="button"
                onClick={handleViewAttachment}
                disabled={loadingAttachment}
                className="w-fit text-sm font-medium text-primary hover:underline"
              >
                {loadingAttachment ? 'Loading…' : 'View attached photo'}
              </button>
            )}
          </div>
        ) : null
      }
    />
  )
}
