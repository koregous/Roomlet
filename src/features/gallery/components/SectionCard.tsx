'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { PublishedSection, Block } from '@/shared/lib/types'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { slugify } from '@/shared/lib/slug'
import NSFWBadge from '@/shared/components/NSFWBadge'

interface Props {
  section: PublishedSection
  compact?: boolean
}

// Helper to check if section is new or recently updated (within 7 days)
function isRecentlyUpdated(publishedAt: string, updatedAt?: string): { isNew: boolean; isUpdated: boolean } {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const publishDate = new Date(publishedAt)
  const isNew = publishDate > sevenDaysAgo
  
  // Check if updated significantly after publishing (more than 1 hour difference)
  if (updatedAt) {
    const updateDate = new Date(updatedAt)
    const hourAfterPublish = new Date(publishDate.getTime() + 60 * 60 * 1000)
    const isUpdated = updateDate > hourAfterPublish && updateDate > sevenDaysAgo && !isNew
    return { isNew, isUpdated }
  }
  
  return { isNew, isUpdated: false }
}

export default function SectionCard({ section, compact = false }: Props) {
  const previewImage = getPreviewImage(section.blocks)
  const CategoryIcon = getCategoryIcon(section.category.slug)
  const { isNew, isUpdated } = isRecentlyUpdated(section.published_at, (section as any).updated_at)

  // Generate section link - prefer username/slug format over /s/id
  const sectionLink = `/${section.creator.username}/${slugify(section.title)}`
  
  if (compact) {
    return (
      <Link href={sectionLink} className="group block">
        <div className="flex gap-3 p-3 bg-black/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
          {/* Small Preview */}
          {previewImage ? (
            <div className="w-16 h-16 relative bg-gray-800 rounded shrink-0">
              <Image
                src={previewImage}
                alt={section.title}
                fill
                className="object-cover rounded"
              />
            </div>
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center rounded shrink-0">
              <CategoryIcon className="w-6 h-6 text-gray-400" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors line-clamp-1 text-sm mb-1">
              {section.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <CategoryIcon className="w-3.5 h-3.5" />
                <span className="truncate">{section.category.name}</span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={sectionLink} className="group block">
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors duration-200">
        {/* Preview Image - wider aspect ratio */}
        {previewImage ? (
          <div className="aspect-video relative bg-gray-800">
            <Image
              src={previewImage}
              alt={section.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {/* Badges Container */}
            <div className="absolute top-2 right-2 flex gap-2">
              {/* NEW/UPDATED Badge */}
              {isNew && (
                <div className="px-2 py-1 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase rounded flex items-center gap-1">
                  <Sparkles size={10} className="fill-current" />
                  New
                </div>
              )}
              {isUpdated && (
                <div className="px-2 py-1 bg-blue-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase rounded flex items-center gap-1">
                  <Sparkles size={10} className="fill-current" />
                  Updated
                </div>
              )}
              {/* NSFW Badge */}
              {section.is_nsfw && <NSFWBadge size="sm" />}
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative">
            <CategoryIcon className="w-12 h-12 text-gray-600" />
            <div className="absolute top-2 right-2 flex gap-2">
              {isNew && (
                <div className="px-2 py-1 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase rounded flex items-center gap-1">
                  <Sparkles size={10} className="fill-current" />
                  New
                </div>
              )}
              {isUpdated && (
                <div className="px-2 py-1 bg-blue-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase rounded flex items-center gap-1">
                  <Sparkles size={10} className="fill-current" />
                  Updated
                </div>
              )}
              {section.is_nsfw && <NSFWBadge size="sm" />}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          <h3 className="font-semibold text-white text-sm group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
            {section.title}
          </h3>

          <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
            {section.creator.avatar_url ? (
              <img
                src={section.creator.avatar_url}
                alt={section.creator.username}
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                {section.creator.username[0].toUpperCase()}
              </div>
            )}
            <span className="truncate">
              by {section.creator.display_name || section.creator.username}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CategoryIcon className="w-3 h-3" />
              <span className="truncate">{section.category.name}</span>
            </div>
            <span className="shrink-0 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              <span>{countImages(section.blocks)} {countImages(section.blocks) === 1 ? 'image' : 'images'}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function getPreviewImage(blocks: Block[]): string | null {
  // Prioritize gallery blocks first (better showcase imagery)
  const galleryBlock = blocks.find((b) => b.type === 'gallery')
  if (galleryBlock && (galleryBlock.content as any).images?.[0]) {
    const firstImage = (galleryBlock.content as any).images[0]
    return firstImage.url || firstImage
  }

  // Then carousel blocks
  const carouselBlock = blocks.find((b) => b.type === 'carousel')
  if (carouselBlock && (carouselBlock.content as any).images?.[0]) {
    const firstImage = (carouselBlock.content as any).images[0]
    return firstImage.url || firstImage
  }

  // Then single image blocks
  const imageBlock = blocks.find((b) => b.type === 'image')
  if (imageBlock && (imageBlock.content as any).image?.url) {
    return (imageBlock.content as any).image.url
  }

  // Finally, audio blocks with cover art
  const audioBlock = blocks.find((b) => b.type === 'audio')
  if (audioBlock && (audioBlock.content as any).coverArt) {
    return (audioBlock.content as any).coverArt
  }

  return null
}

function countImages(blocks: Block[]): number {
  let count = 0

  blocks.forEach((block) => {
    if (block.type === 'image') {
      // Single image block
      if ((block.content as any).imageUrl) {
        count += 1
      }
    } else if (block.type === 'gallery') {
      // Gallery block has multiple images
      const images = (block.content as any).images || []
      count += images.length
    } else if (block.type === 'carousel') {
      // Carousel block has multiple images
      const images = (block.content as any).images || []
      count += images.length
    }
  })

  return count
}
