'use client'

import { useEffect } from 'react'

interface Props {
  sectionId: string
}

export default function ViewTracker({ sectionId }: Props) {
  useEffect(() => {
    // Only track once per session per section
    const viewKey = `viewed_section_${sectionId}`
    
    if (typeof window !== 'undefined' && !sessionStorage.getItem(viewKey)) {
      const trackView = async () => {
        try {
          await fetch('/api/views/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionId }),
          })
          
          sessionStorage.setItem(viewKey, 'true')
        } catch (error) {
          // Silently fail - don't show errors to user
          console.error('Failed to track view:', error)
        }
      }

      trackView()
    }
  }, [sectionId])

  // This component doesn't render anything
  return null
}
