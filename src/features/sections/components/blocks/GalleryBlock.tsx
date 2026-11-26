'use client'

import { useState } from 'react'
import { Block } from '@/shared/lib/types'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import Lightbox from '@/shared/components/Lightbox'

interface Props {
  block: Block
}

type AspectRatio = '1/1' | '3/2' | '3/4' | '16/9' | 'auto'

export default function GalleryBlock({ block }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  
  const images = block.content.images || []
  const columns = block.content.columns || 3
  const aspectRatio = (block.content.aspectRatio || 'auto') as AspectRatio

  const getAspectRatioClass = (ratio: AspectRatio): string => {
    switch (ratio) {
      case '1/1': return 'aspect-square'
      case '3/2': return 'aspect-[3/2]'
      case '3/4': return 'aspect-[3/4]'
      case '16/9': return 'aspect-video'
      default: return ''
    }
  }

  const getColumnsClass = (cols: number): string => {
    switch (cols) {
      case 2: return 'md:grid-cols-2'
      case 3: return 'md:grid-cols-2 lg:grid-cols-3'
      case 4: return 'md:grid-cols-2 lg:grid-cols-4'
      default: return 'md:grid-cols-3'
    }
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (images.length === 0) {
    return null
  }

  return (
    <>
      <div className={`grid grid-cols-1 ${getColumnsClass(columns)} gap-4 auto-rows-max`}>
        {images.map((image, index) => (
          <div
            key={image.url}
            className={`overflow-hidden border border-gray-800 hover:border-gray-700 transition flex flex-col cursor-pointer group ${
              aspectRatio !== 'auto' ? getAspectRatioClass(aspectRatio) : ''
            }`}
            onClick={() => openLightbox(index)}
          >
            <div className="w-full flex-1 overflow-hidden relative">
              <img
                src={sanitizeUrl(image.url)}
                alt={image.caption || `Gallery image ${index + 1}`}
                className={`w-full h-full group-hover:opacity-90 transition duration-300 ${
                  aspectRatio === 'auto' ? 'object-contain max-h-96' : 'object-cover'
                }`}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20">
                <span className="text-white text-xs bg-black/70 px-2 py-1 rounded">
                  Click to view
                </span>
              </div>
            </div>
            {image.caption && (
              <div className="p-3 bg-black border-t border-gray-800 text-sm text-gray-400">
                {image.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxOpen && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}
