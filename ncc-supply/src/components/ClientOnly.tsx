import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders `children` only after mount. Use this to keep hooks like
 * `useServerFn` out of the SSR tree — on Vercel those hooks throw an
 * opaque HTTPError and take the whole page down.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted ? children : fallback
}
