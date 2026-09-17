import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppErrorBoundary } from '../components/app-boundaries/ErrorBoundary'
import { AppNotFound } from '../components/app-boundaries/NotFound'
import { AppPending } from '../components/app-boundaries/Pending'
import { Footer } from '../components/ui/Footer'
import { Header } from '../components/ui/Header'
import { getHeaderData } from '../server/layout/header-data-server-functions'

import appCss from '../styles.css?url'

const EMPTY_HEADER_DATA = { categories: [], buyer: null, basketCount: 0 }

export const Route = createRootRoute({
  loader: async () => {
    try {
      return await getHeaderData()
    } catch (error) {
      console.error('[root] header loader failed', error)
      return EMPTY_HEADER_DATA
    }
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
