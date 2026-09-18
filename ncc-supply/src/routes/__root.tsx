import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
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
  // #region agent log
  try {
    if (typeof window !== 'undefined' && process.env.VERCEL !== '1') {
      fetch('http://127.0.0.1:7516/ingest/3bd6d664-9013-4cd7-906e-9686e0886622',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'21cab6'},body:JSON.stringify({sessionId:'21cab6',runId:'post-fix',hypothesisId:'C',location:'src/routes/__root.tsx:RootDocument',message:'RootDocument render started',data:{hasWindow:typeof window!=='undefined'},timestamp:Date.now()})}).catch(()=>{});
    }
  } catch {
    // ignore instrumentation failures
  }
  // #endregion
  console.error('[ncc-debug] RootDocument', { hasWindow: typeof window !== 'undefined' })

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="ncc-debug" content="root-document-render" />
        <HeadContent />
      </head>
      <body>
        <ClientOnly fallback={EMPTY_HEADER}>
          <Suspense fallback={EMPTY_HEADER}>
            <LiveHeader />
          </Suspense>
        </ClientOnly>
        <main>{children}</main>
        <Footer />
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
