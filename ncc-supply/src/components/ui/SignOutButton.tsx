import { useServerFn } from '@tanstack/react-start'
import type { ReactNode } from 'react'
import { logout } from '../../server/buyers/server-functions'

export function SignOutButton({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const signOut = useServerFn(logout)

  async function handleSignOut() {
    await signOut()
    window.location.href = '/'
  }

  return (
    <button type="button" onClick={handleSignOut} aria-label="Sign out" className={className}>
      {children}
    </button>
  )
}
