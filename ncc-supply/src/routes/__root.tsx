import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppErrorBoundary } from '../components/app-boundaries/ErrorBoundary'
import { AppNotFound } from '../components/app-boundaries/NotFound'
import { AppPending } from '../components/app-boundaries/Pending'
import { Footer } from '../components/ui/Footer'
import { Header, type HeaderBuyer, type HeaderCategory } from '../components/ui/Header'
import { getBasketCount } from '../server/basket/server-functions'
import { getCurrentBuyerSummary } from '../server/buyers/server-functions'
import { getCatalogueAdapter } from '../server/integrations/shopify'

import appCss from '../styles.css?url'

const getHeaderCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HeaderCategory[]> => {
    try {
      const collections = await getCatalogueAdapter().listCollections()
      return collections.map((collection) => ({ slug: collection.slug, title: collection.title }))
    } catch (error) {
      console.error('[root] failed to load header categories', error)
      return []
    }
  },
)

const getHeaderBuyer = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HeaderBuyer | null> => {
    try {
      const summary = await getCurrentBuyerSummary()
      if (!summary) return null
      return { companyName: summary.companyName, role: summary.role }
    } catch (error) {
      console.error('[root] failed to load header buyer', error)
      return null
    }
  },
)

const getHeaderBasketCount = createServerFn({ method: 'GET' }).handler(async (): Promise<number> => {
  try {
    return await getBasketCount()
  } catch (error) {
    console.error('[root] failed to load basket count', error)
    return 0
  }
})

/**
 * Temporary pre-launch gate (server/auth/site-access.ts) — checked before
 * every route except the gate page itself, so a client-side navigation
 * mid-session re-validates too, not just the first page load.
 */
export const Route = createRootRoute({
  loader: async () => {
    const [categories, buyer, basketCount] = await Promise.all([
      getHeaderCategories(),
      getHeaderBuyer(),
      getHeaderBasketCount(),
    ])
    return { categories, buyer, basketCount }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'NCC Supply' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  errorComponent: AppErrorBoundary,
  notFoundComponent: AppNotFound,
  pendingComponent: AppPending,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { categories, buyer, basketCount } = Route.useLoaderData()
  const isPreviewAccessGate = useRouterState({
    select: (state) => state.location.pathname === '/preview-access',
  })

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {isPreviewAccessGate ? null : (
          <Header categories={categories} buyer={buyer} basketCount={basketCount} />
        )}
        <main>{children}</main>
        {isPreviewAccessGate ? null : <Footer />}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
