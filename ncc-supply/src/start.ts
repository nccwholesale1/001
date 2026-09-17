import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
  // Vercel SSR/self-fetch often omits Origin/Referer; the default CSRF
  // middleware then rejects the call as HTTPError and the whole HTML
  // document 500s as {"message":"HTTPError"}.
  allowRequestsWithoutOriginCheck: true,
})

const debugErrorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = request.url
  // #region agent log
  try {
    if (process.env.VERCEL !== '1') {
      fetch('http://127.0.0.1:7516/ingest/3bd6d664-9013-4cd7-906e-9686e0886622', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '21cab6' },
        body: JSON.stringify({
          sessionId: '21cab6',
          runId: 'post-fix',
          hypothesisId: 'F',
          location: 'src/start.ts:debugErrorMiddleware',
          message: 'start request middleware entered',
          data: { url, vercel: process.env.VERCEL === '1' },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
  } catch {
    // ignore instrumentation failures
  }
  // #endregion
  console.error('[ncc-debug] start-middleware-enter', url)
  try {
    return await next()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    const cause = err.cause
    const payload = {
      status: 500,
      unhandled: true,
      name: err.name,
      message: err.message,
      path: url,
      stack: err.stack?.split('\n').slice(0, 10),
      causeName: cause instanceof Error ? cause.name : undefined,
      causeMessage: cause instanceof Error ? cause.message : undefined,
      hypothesisId: 'F',
    }
    console.error('[ncc-debug] start-middleware-caught', payload)
    // #region agent log
    try {
      if (process.env.VERCEL !== '1') {
        fetch('http://127.0.0.1:7516/ingest/3bd6d664-9013-4cd7-906e-9686e0886622', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '21cab6' },
          body: JSON.stringify({
            sessionId: '21cab6',
            runId: 'post-fix',
            hypothesisId: 'F',
            location: 'src/start.ts:debugErrorMiddleware',
            message: 'start request middleware caught',
            data: { name: err.name, errorMessage: err.message, url },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
      }
    } catch {
      // ignore instrumentation failures
    }
    // #endregion
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { 'content-type': 'application/json;charset=UTF-8' },
    })
  }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [debugErrorMiddleware, csrfMiddleware],
}))
