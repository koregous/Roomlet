'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PublishedSection } from '@/shared/lib/types'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { slugify } from '@/shared/lib/slug'
import NSFWBadge from '@/shared/components/NSFWBadge'

interface Props {
  sections: PublishedSection[]
}

export default function CinemaCarousel({ sections }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    let animationId: number
    let scrollPosition = 0
    const scrollSpeed = 0.5 // pixels per frame (adjust for speed)
    let isPaused = false

    const animate = () => {
      if (!isPaused) {
        scrollPosition += scrollSpeed
        
        // Reset when we've scrolled past half (since content is duplicated)
        if (scrollPosition >= scrollContainer.scrollWidth / 2) {
          scrollPosition = 0
        }
        
        scrollContainer.scrollLeft = scrollPosition
      }
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    // Pause on hover (desktop)
    const handleMouseEnter = () => { isPaused = true }
    const handleMouseLeave = () => { isPaused = false }

    scrollContainer.addEventListener('mouseenter', handleMouseEnter)
    scrollContainer.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationId)
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter)
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Duplicate sections for infinite loop
  const duplicatedSections = [...sections, ...sections]

  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {duplicatedSections.map((section, index) => (
          <CarouselCard key={`${section.id}-${index}`} section={section} />
        ))}
      </div>
    </div>
  )
}

function CarouselCard({ section }: { section: PublishedSection }) {
  const firstImage = section.blocks.find(
    (b) => b.type === 'image' || b.type === 'gallery' || b.type === 'carousel'
  )

  const imageUrl =
    firstImage?.content?.image?.url ||
    firstImage?.content?.images?.[0]?.url

  const CategoryIcon = getCategoryIcon(section.category.slug)
  
  // Generate section link - prefer username/slug format
  const sectionLink = `/${section.creator.username}/${slugify(section.title)}`

  return (
    <Link
      href={sectionLink}
      className="group flex-shrink-0 w-[320px] block mobile-carousel-card"
    >
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-all">
        {imageUrl ? (
          <div className="aspect-[21/9] relative bg-gray-800">
            <Image
              src={imageUrl}
              alt={section.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* NSFW Badge */}
            {section.is_nsfw && (
              <div className="absolute top-2 right-2 z-10">
                <NSFWBadge size="sm" />
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">
                {section.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <CategoryIcon className="w-3 h-3" />
                <span>{section.category.name}</span>
                <span className="text-gray-600">•</span>
                <span>by {section.creator.display_name || section.creator.username}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="aspect-[21/9] bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
            <CategoryIcon className="w-10 h-10 text-gray-600 mb-2" />
            <div className="px-3 text-center">
              <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1">
                {section.title}
              </h3>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <span>{section.category.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
