'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import { useSectionItemLikes } from '@/shared/contexts/SectionItemLikesContext'
import ItemLikeButton from '@/shared/components/ItemLikeButton'

interface LightboxImage {
  url: string
  caption?: string
  alt?: string
}

interface Props {
  images: LightboxImage[]
  initialIndex: number
  onClose: () => void
}

export default function Lightbox({ images, initialIndex, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [mounted, setMounted] = useState(false)

  const currentImage = images[currentIndex]
  const hasPrevious = images.length > 1
  const hasNext = images.length > 1

  // Per-image likes (only available inside a section; otherwise null)
  const itemLikes = useSectionItemLikes()
  const loadItemLikes = itemLikes?.load
  const likeItem = itemLikes?.lookup(currentImage.url)

  // Fetch like state the first time a lightbox opens in this section
  useEffect(() => {
    loadItemLikes?.()
  }, [loadItemLikes])

  // Only render portal on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        goToPrevious()
      } else if (e.key === 'ArrowRight' && hasNext) {
        goToNext()
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 3))
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(z - 0.25, 0.5))
      } else if (e.key === '0') {
        setZoom(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, hasPrevious, hasNext, onClose])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Reset zoom when changing images
  useEffect(() => {
    setZoom(1)
  }, [currentIndex])

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 0.25, 0.5))
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the image
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Don't render until mounted on client
  if (!mounted) return null

  // Render lightbox directly to document.body using portal to avoid transform context issues
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button - Fixed at top */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 p-2 bg-black/70 hover:bg-black text-white rounded-full transition z-[110] shadow-lg"
        aria-label="Close lightbox"
      >
        <X size={24} />
      </button>

      {/* Counter - Fixed at top */}
      {images.length > 1 && (
        <div className="fixed top-4 left-4 px-3 py-2 bg-black/70 text-white text-sm rounded z-[110] shadow-lg">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Like - Fixed at bottom center (only for indexed images) */}
      {likeItem && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] shadow-lg">
          <ItemLikeButton
            variant="overlay"
            itemId={likeItem.id}
            initialLiked={likeItem.liked_by_me}
            initialCount={likeItem.like_count}
            onChange={(liked, count) => itemLikes?.update(currentImage.url, liked, count)}
          />
        </div>
      )}

      {/* Zoom controls - Fixed at bottom */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-[110] shadow-lg">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 bg-black/70 hover:bg-black text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <ZoomOut size={20} />
        </button>
        <div className="px-3 py-2 bg-black/70 text-white text-sm rounded">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="p-2 bg-black/70 hover:bg-black text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <ZoomIn size={20} />
        </button>
      </div>

      {/* Navigation arrows */}
      {hasPrevious && (
        <button
          onClick={goToPrevious}
          className="fixed left-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black text-white rounded-full transition z-[110] shadow-lg"
          aria-label="Previous image"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {hasNext && (
        <button
          onClick={goToNext}
          className="fixed right-4 top-1/2 -translate-y-1/2 p-3 bg-black/70 hover:bg-black text-white rounded-full transition z-[110] shadow-lg"
          aria-label="Next image"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Image container */}
      <div className="w-full h-full flex flex-col items-center justify-center p-16 overflow-hidden">
        <div
          className="relative transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoom})`,
            cursor: zoom > 1 ? 'grab' : 'default',
          }}
        >
          <img
            src={sanitizeUrl(currentImage.url)}
            alt={currentImage.alt || currentImage.caption || `Image ${currentIndex + 1}`}
            className="max-w-full max-h-[80vh] object-contain"
            draggable={false}
          />
        </div>

        {/* Caption */}
        {currentImage.caption && (
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-2xl px-6 py-3 bg-black/70 text-white text-center text-sm rounded z-[110] shadow-lg">
            {currentImage.caption}
          </div>
        )}
      </div>

      {/* Keyboard hints - Fixed at bottom */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-400 space-y-1 z-[110]">
        <div>ESC: Close</div>
        {images.length > 1 && <div>← →: Navigate</div>}
        <div>+ −: Zoom</div>
      </div>
    </div>,
    document.body
  )
}
