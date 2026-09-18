const DEBUG_ENDPOINT = 'http://127.0.0.1:7516/ingest/3bd6d664-9013-4cd7-906e-9686e0886622'

/** Session debug logs for the Vercel production HTTPError. Never log secret values. */
export function debugSessionLog(payload: {
  location: string
  message: string
  hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  data?: Record<string, unknown>
}): void {
  const body = {
    sessionId: '21cab6',
    runId: 'vercel-500',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  }
  // #region agent log
  try {
    if (process.env.VERCEL !== '1') {
      fetch(DEBUG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '21cab6' },
        body: JSON.stringify(body),
      }).catch(() => {})
    }
  } catch {
    // Vercel/Nitro fetch to 127.0.0.1 can throw HTTPError and take down SSR.
  }
  // #endregion
  console.error('[ncc-debug]', payload.hypothesisId, payload.location, payload.message, payload.data)
}
