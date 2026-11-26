'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useToast } from '@/shared/components/Toast'

export function LoginErrorHandler() {
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      addToast(`Authentication failed: ${decodeURIComponent(errorParam)}`, 'error')
    }
  }, [searchParams, addToast])

  return null
}
