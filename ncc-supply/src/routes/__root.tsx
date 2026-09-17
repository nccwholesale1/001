import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { lazy, Suspense } from 'react'
import { AppErrorBoundary } from '../components/app-boundaries/ErrorBoundary'
import { AppNotFound } from '../components/app-boundaries/NotFound'
import { AppPending } from '../components/app-boundaries/Pending'
import { ClientOnly } from '../components/ClientOnly'
import { Footer } from '../components/ui/Footer'
import { Header } from '../components/ui/Header'

import appCss from '../styles.css?url'

const LiveHeader = lazy(async () => {
  const module = await import('../components/LiveHeader')
  return { default: module.LiveHeader }
})

const EMPTY_HEADER = <Header categories={[]} buyer={null} basketCount={0} />

export const Route = createRootRoute({
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
          <ClientOnly fallback={EMPTY_HEADER}>
            <Suspense fallback={EMPTY_HEADER}>
              <LiveHeader />
            </Suspense>
          </ClientOnly>
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
