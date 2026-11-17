'use client'

import { useState } from 'react'
import { Block } from '@/shared/lib/types'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import Lightbox from '@/shared/components/Lightbox'

interface Props {
  block: Block
}

export default function ImageBlock({ block }: Props) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const image = block.content.image

  if (!image?.url) {
    return null
  }

  return (
    <>
      <figure className="space-y-2">
        <div className="relative overflow-hidden border border-gray-800 cursor-pointer group">
          <img
            src={sanitizeUrl(image.url)}
            alt={image.alt || image.caption || 'Image'}
            className="w-full h-auto object-contain max-h-[600px] group-hover:opacity-90 transition"
            onClick={() => setIsLightboxOpen(true)}
          />
          {/* Hover hint */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/20 pointer-events-none">
            <span className="text-white text-sm bg-black/70 px-3 py-1 rounded">
              Click to view full size
            </span>
          </div>
        </div>
        {image.caption && (
          <figcaption className="text-sm text-gray-500 italic px-2">
            {image.caption}
          </figcaption>
        )}
      </figure>

      {isLightboxOpen && (
        <Lightbox
          images={[{ url: image.url, caption: image.caption, alt: image.alt }]}
          initialIndex={0}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  )
}
