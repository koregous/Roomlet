'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

/**
 * AuthRedirect - Redirects logged-in users from homepage to gallery
 * 
 * Used on the homepage to automatically redirect authenticated users
 * to the gallery page since they don't need the marketing landing.
 */
export default function AuthRedirect() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          // User is logged in, redirect to gallery
          router.push('/gallery')
        } else {
          // User is not logged in, stay on homepage
          setIsChecking(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router])

  // Show nothing while checking (prevents flash of homepage)
  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  // User is not logged in, render nothing (homepage shows normally)
  return null
}
