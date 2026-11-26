'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/shared/components/Toast'

interface UseBookmarkResult {
  isBookmarked: boolean
  isLoading: boolean
  toggleBookmark: () => Promise<void>
}

/**
 * Hook for managing bookmark state with optimistic updates
 * Checks if section is bookmarked and provides toggle functionality
 */
export function useBookmark(sectionId: string, initialBookmarked = false): UseBookmarkResult {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked)
  const [isLoading, setIsLoading] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    async function checkBookmark() {
      try {
        const response = await fetch(`/api/bookmarks/check?section_id=${sectionId}`)
        if (response.ok) {
          const data = await response.json()
          setIsBookmarked(data.bookmarked)
        }
      } catch (error) {
        console.error('Failed to check bookmark status:', error)
      }
    }

    checkBookmark()
  }, [sectionId])

  const toggleBookmark = async () => {
    // Optimistic update
    const previousState = isBookmarked
    setIsBookmarked(!isBookmarked)
    setIsLoading(true)

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        if (response.status === 401) {
          throw new Error('Please log in to bookmark sections')
        }
        
        throw new Error(errorData.error || 'Failed to toggle bookmark')
      }

      const data = await response.json()
      setIsBookmarked(data.bookmarked)
      
      addToast(
        data.bookmarked ? 'Added to bookmarks' : 'Removed from bookmarks',
        'success',
        2000
      )
    } catch (error) {
      setIsBookmarked(previousState)
      console.error('Bookmark toggle error:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update bookmark'
      addToast(errorMessage, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isBookmarked,
    isLoading,
    toggleBookmark,
  }
}
