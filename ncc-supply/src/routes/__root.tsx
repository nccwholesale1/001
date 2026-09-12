import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppErrorBoundary } from '../components/app-boundaries/ErrorBoundary'
import { AppNotFound } from '../components/app-boundaries/NotFound'
import { AppPending } from '../components/app-boundaries/Pending'
import { Footer } from '../components/ui/Footer'
import { Header, type HeaderCategory } from '../components/ui/Header'
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

export const Route = createRootRoute({
  loader: () => getHeaderCategories(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'NCC Supply' },
    ],
    links: [
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
  const categories = Route.useLoaderData()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Header categories={categories} />
        <main>{children}</main>
        <Footer />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
