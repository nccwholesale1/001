import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Header } from './ui/Header'
import { getHeaderData } from '../server/layout/header-data-server-functions'
import type { HeaderData } from '../server/layout/header-data'

const EMPTY_HEADER_DATA: HeaderData = { categories: [], buyer: null, basketCount: 0 }

function asHeaderData(value: unknown): HeaderData {
  if (value === null || typeof value !== 'object') return EMPTY_HEADER_DATA
  const record = value as Partial<HeaderData>
  if (!Array.isArray(record.categories)) return EMPTY_HEADER_DATA
  return {
    categories: record.categories,
    buyer: record.buyer ?? null,
    basketCount: typeof record.basketCount === 'number' ? record.basketCount : 0,
  }
}

/**
 * Client-only. Dynamically imported from the root shell so the SSR bundle
 * never evaluates header server functions (those 500 as HTTPError on Vercel).
 */
export function LiveHeader() {
  const fetchHeader = useServerFn(getHeaderData)
  const [data, setData] = useState(EMPTY_HEADER_DATA)
  const locationHref = useRouterState({ select: (state) => state.location.href })
  const isLoading = useRouterState({ select: (state) => state.isLoading })

  useEffect(() => {
    let cancelled = false
    void fetchHeader()
      .then((next) => {
        if (!cancelled) setData(asHeaderData(next))
      })
      .catch((error: unknown) => {
        console.error('[header] failed to load header data', error)
        if (!cancelled) setData(EMPTY_HEADER_DATA)
      })
    return () => {
      cancelled = true
    }
  }, [fetchHeader, locationHref, isLoading])

  return (
    <Header
      categories={data.categories ?? []}
      buyer={data.buyer ?? null}
      basketCount={data.basketCount ?? 0}
    />
  )
}
