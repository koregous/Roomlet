'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'

interface ItemLikeButtonProps {
  /** item_index id of the image */
  itemId: string
  initialLiked?: boolean
  initialCount?: number
  /** 'inline' = small pill for cards, 'overlay' = larger, for use over a photo (lightbox) */
  variant?: 'inline' | 'overlay'
  className?: string
  onChange?: (liked: boolean, count: number) => void
}

/**
 * ItemLikeButton - like/unlike a single image with an optimistic update.
 *
 * Uses POST/DELETE /api/items/[id]/like (both idempotent). Signed-out users
 * are sent to /login. Safe to render inside links/cards: clicks never bubble.
 */
export default function ItemLikeButton({
  itemId,
  initialLiked = false,
  initialCount = 0,
  variant = 'inline',
  className = '',
  onChange,
}: ItemLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const busy = useRef(false)

  // Re-sync when the button is reused for a different image (e.g. lightbox navigation)
  useEffect(() => {
    setLiked(initialLiked)
    setCount(initialCount)
  }, [itemId, initialLiked, initialCount])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy.current) return
    busy.current = true

    const previous = { liked, count }
    const next = !liked
    setLiked(next)
    setCount(c => Math.max(0, c + (next ? 1 : -1)))

    try {
      const response = await fetch(`/api/items/${itemId}/like`, {
        method: next ? 'POST' : 'DELETE',
      })

      if (response.status === 401) {
        setLiked(previous.liked)
        setCount(previous.count)
        window.location.href = '/login'
        return
      }

      if (!response.ok) throw new Error(`Like request failed: ${response.status}`)

      const data: { liked: boolean; like_count: number } = await response.json()
      setLiked(data.liked)
      setCount(data.like_count)
      onChange?.(data.liked, data.like_count)
    } catch (error) {
      console.error('Failed to update like:', error)
      setLiked(previous.liked)
      setCount(previous.count)
    } finally {
      busy.current = false
    }
  }

  const base =
    variant === 'overlay'
      ? 'flex items-center gap-2 px-3 py-2 rounded-full text-sm backdrop-blur-sm border'
      : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border'

  const tone = liked
    ? variant === 'overlay'
      ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
      : 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20'
    : variant === 'overlay'
      ? 'bg-black/50 border-white/20 text-white hover:text-red-400'
      : 'bg-transparent border-gray-800 text-gray-400 hover:text-red-400 hover:border-gray-700'

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike image' : 'Like image'}
      title={liked ? 'Unlike' : 'Like'}
      className={`${base} ${tone} transition-colors ${className}`}
    >
      <Heart size={variant === 'overlay' ? 18 : 14} className={liked ? 'fill-current' : ''} />
      {(count > 0 || variant === 'overlay') && <span className="tabular-nums">{count}</span>}
    </button>
  )
}
