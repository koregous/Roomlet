'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { Block } from '@/shared/lib/types'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import Lightbox from '@/shared/components/Lightbox'

interface Props {
  block: Block
}

export default function CarouselBlock({ block }: Props) {
  const images = block.content.images || []
  const showDots = block.content.showDots !== false // default true
  const autoPlay = block.content.carouselAutoPlay === true
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  if (images.length === 0) {
    return null
  }

  useEffect(() => {
    if (!autoPlay || images.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    }, 3000) // Change slide every 3 seconds

    return () => clearInterval(interval)
  }, [autoPlay, images.length])

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const openLightbox = () => {
    if (!isDragging) {
      setLightboxOpen(true)
    }
  }

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
    setTouchEnd(e.targetTouches[0].clientX)
    setIsDragging(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
    const distance = Math.abs(touchStart - e.targetTouches[0].clientX)
    if (distance > 5) {
      setIsDragging(true)
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50
    
    if (distance > minSwipeDistance) {
      goToNext()
    } else if (distance < -minSwipeDistance) {
      goToPrevious()
    }
    
    // Reset after a short delay to prevent accidental lightbox open
    setTimeout(() => setIsDragging(false), 100)
  }

  // Mouse drag handlers
  const [mouseDown, setMouseDown] = useState(false)
  const [mouseStart, setMouseStart] = useState(0)
  const [mouseEnd, setMouseEnd] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDown(true)
    setMouseStart(e.clientX)
    setMouseEnd(e.clientX)
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown) return
    setMouseEnd(e.clientX)
    const distance = Math.abs(mouseStart - e.clientX)
    if (distance > 5) {
      setIsDragging(true)
    }
  }

  const handleMouseUp = () => {
    if (mouseDown && isDragging) {
      const distance = mouseStart - mouseEnd
      const minSwipeDistance = 50
      
      if (distance > minSwipeDistance) {
        goToNext()
      } else if (distance < -minSwipeDistance) {
        goToPrevious()
      }
    }
    
    setMouseDown(false)
    // Reset after a short delay to prevent accidental lightbox open
    setTimeout(() => setIsDragging(false), 100)
  }

  const handleMouseLeave = () => {
    if (mouseDown) {
      setMouseDown(false)
      setIsDragging(false)
    }
  }

  // Calculate previous and next indices (with looping)
  const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1
  const nextIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1

  return (
    <>
      <div 
        ref={containerRef}
        className="relative border border-gray-800 overflow-hidden rounded select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ touchAction: 'pan-y', cursor: mouseDown ? 'grabbing' : 'grab' }}
      >
        <div className="relative w-full">
          {/* Show single image if only one */}
          {images.length === 1 ? (
            <div className="relative w-full h-full cursor-pointer group" onClick={openLightbox}>
              <img
                src={sanitizeUrl(images[0].url)}
                alt={images[0].caption || 'Carousel image'}
                className="w-full h-auto"
              />
              <div className="absolute top-3 left-3 p-2 bg-black/70 opacity-0 group-hover:opacity-100 transition">
                <Maximize2 size={16} className="text-white" />
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <div className="absolute left-0 w-[15%] h-full flex items-center opacity-40 -translate-x-[40%] hover:opacity-60 transition-opacity cursor-pointer z-10"
                onClick={goToPrevious}
              >
                <img
                  src={sanitizeUrl(images[prevIndex].url)}
                  alt="Previous"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60" />
              </div>

              <div className="relative z-20 w-[85%] h-full flex items-center justify-center cursor-pointer group"
                onClick={openLightbox}
              >
                <img
                  src={sanitizeUrl(images[currentIndex].url)}
                  alt={images[currentIndex].caption || `Slide ${currentIndex + 1}`}
                  className="w-full h-auto"
                />
                <div className="absolute top-3 left-3 p-2 bg-black/70 opacity-0 group-hover:opacity-100 transition">
                  <Maximize2 size={16} className="text-white" />
                </div>
              </div>

              <div className="absolute right-0 w-[15%] h-full flex items-center opacity-40 translate-x-[40%] hover:opacity-60 transition-opacity cursor-pointer z-10"
                onClick={goToNext}
              >
                <img
                  src={sanitizeUrl(images[nextIndex].url)}
                  alt="Next"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/60" />
              </div>
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full transition z-30"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full transition z-30"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {images.length > 1 && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded z-30">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {images[currentIndex].caption && (
          <div className="p-3 bg-gray-900/30 border-t border-gray-800 text-sm text-gray-400">
            {images[currentIndex].caption}
          </div>
        )}

        {showDots && images.length > 1 && (
          <div className="flex justify-center gap-2 py-3 bg-gray-900/30 border-t border-gray-800">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition ${
                  index === currentIndex ? 'bg-white' : 'bg-gray-700 hover:bg-gray-500'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox
          images={images}
          initialIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
