import { defineErrorHandler } from 'nitro'

function serializeUnknown(error: unknown): Record<string, unknown> {
  const err = error as {
    name?: string
    message?: string
    stack?: string
    status?: number
    data?: unknown
    cause?: unknown
    unhandled?: boolean
  }
  const cause = err.cause
  return {
    status: typeof err.status === 'number' ? err.status : 500,
    unhandled: true,
    name: err.name,
    message: err.message,
    stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 10) : undefined,
    dataType: err.data === undefined ? undefined : typeof err.data,
    causeName: cause instanceof Error ? cause.name : undefined,
    causeMessage: cause instanceof Error ? cause.message : cause === undefined ? undefined : String(cause),
    node: typeof process !== 'undefined' ? process.versions?.node : undefined,
    vercel: process.env.VERCEL ?? null,
  }
}

export default defineErrorHandler((error, event) => {
  const path = (() => {
    try {
      return String(event.req.url)
    } catch {
      return 'unknown'
    }
  })()
  const serialized = serializeUnknown(error)
  const body: Record<string, unknown> = { ...serialized, path, hypothesisId: 'F' }
  console.error('[ncc-debug] nitro-error-handler', body)
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
          location: 'error.ts:defineErrorHandler',
          message: 'nitro error handler invoked',
          data: { path, name: serialized.name, errorMessage: serialized.message },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
  } catch {
    // ignore instrumentation failures
  }
  // #endregion
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  })
})
