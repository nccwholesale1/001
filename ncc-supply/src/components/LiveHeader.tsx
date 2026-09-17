import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Header } from './ui/Header'
import { getHeaderData } from '../server/layout/header-data-server-functions'
import type { HeaderData } from '../server/layout/header-data'

const EMPTY_HEADER_DATA: HeaderData = { categories: [], buyer: null, basketCount: 0 }

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
        if (!cancelled) setData(next)
      })
      .catch((error: unknown) => {
        console.error('[header] failed to load header data', error)
      })
    return () => {
      cancelled = true
    }
  }, [fetchHeader, locationHref, isLoading])

  return <Header categories={data.categories} buyer={data.buyer} basketCount={data.basketCount} />
}
