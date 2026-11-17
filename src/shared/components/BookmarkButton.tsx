'use client'

import { Heart } from 'lucide-react'
import { useBookmark } from '@/shared/hooks/useBookmark'
import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'

interface BookmarkButtonProps {
  sectionId: string
  initialBookmarked?: boolean
  variant?: 'icon' | 'button'
  className?: string
}

/**
 * BookmarkButton - Toggle bookmark with heart icon
 * Shows solid heart when bookmarked, outline when not
 * Requires authentication
 */
export default function BookmarkButton({
  sectionId,
  initialBookmarked = false,
  variant = 'button',
  className = '',
}: BookmarkButtonProps) {
  const { isBookmarked, isLoading, toggleBookmark } = useBookmark(sectionId, initialBookmarked)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null) // null = checking

  useEffect(() => {
    async function checkAuth() {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If still checking auth, wait
    if (isAuthenticated === null) {
      return
    }

    if (!isAuthenticated) {
      // Don't call toggle, just redirect
      window.location.href = '/login'
      return
    }

    try {
      await toggleBookmark()
    } catch (error) {
      // Error handling is done in the hook
      console.error('Bookmark button error:', error)
    }
  }

  // Don't render button until we know auth status
  if (isAuthenticated === null) {
    return null
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`p-2 rounded-full transition-colors ${
          isBookmarked
            ? 'text-red-500 hover:text-red-600'
            : 'text-gray-400 hover:text-red-500'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        <Heart
          size={20}
          className={isBookmarked ? 'fill-current' : ''}
        />
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
        isBookmarked
          ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
          : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700 hover:text-red-500'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      <Heart
        size={16}
        className={isBookmarked ? 'fill-current' : ''}
      />
      <span className="hidden sm:inline">
        {isBookmarked ? 'Bookmarked' : 'Bookmark'}
      </span>
    </button>
  )
}
