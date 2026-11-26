'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'

/**
 * Is the signed-in viewer the owner of this profile?
 *
 * Public profile pages are ISR-cached and rendered without knowing who is
 * looking, so ownership is resolved client-side after hydration. This is only
 * used to decide whether to *show* owner controls; the edit routes and the
 * database (RLS) are what actually enforce ownership.
 *
 * Uses getSession() (local, no network round-trip) so ordinary visitors don't
 * trigger an auth request on every profile view.
 */
export function useIsProfileOwner(profileUserId: string | undefined): boolean {
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!profileUserId) {
      setIsOwner(false)
      return
    }

    let cancelled = false

    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) setIsOwner(session?.user?.id === profileUserId)
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false)
      })

    return () => {
      cancelled = true
    }
  }, [profileUserId])

  return isOwner
}
