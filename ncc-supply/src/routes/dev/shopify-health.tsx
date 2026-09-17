import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { isDevOnlySurfaceEnabled } from '../../server/dev/dev-only-server-functions'
import { checkAdminHealth, checkStorefrontHealth } from '../../server/integrations/shopify/health'

/**
 * Internal, dev-only connectivity diagnostic (CLAUDE.md rule 22 — reports
 * connectivity only, never a credential or raw API response). Not linked
 * from any public navigation.
 */
const getShopifyHealth = createServerFn({ method: 'GET' }).handler(async () => {
  const [storefront, admin] = await Promise.all([checkStorefrontHealth(), checkAdminHealth()])
  return { storefront, admin }
})

export const Route = createFileRoute('/dev/shopify-health')({
  beforeLoad: async () => {
    if (!(await isDevOnlySurfaceEnabled())) throw notFound()
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] }),
  loader: () => getShopifyHealth(),
  component: ShopifyHealthRoute,
})

function ShopifyHealthRoute() {
  const data = Route.useLoaderData()
  return (
    <pre className="whitespace-pre-wrap p-6 font-mono text-sm text-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
