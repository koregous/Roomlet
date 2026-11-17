'use client'

import Link from 'next/link'
import { Image as ImageIcon } from 'lucide-react'
import { PublishedSection } from '@/shared/lib/types'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { slugify } from '@/shared/lib/slug'
import NSFWBadge from '@/shared/components/NSFWBadge'

interface Props {
  sections: PublishedSection[]
}

export default function DiscoverListView({ sections }: Props) {
  return (
    <div className="space-y-2">
      {sections.map(section => (
        <SectionListItem key={section.id} section={section} />
      ))}
    </div>
  )
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`
  return `${Math.floor(seconds / 2592000)}mo ago`
}

function SectionListItem({ section }: { section: PublishedSection }) {
  // Collect all images from all blocks
  const allImages: string[] = []
  section.blocks.forEach(b => {
    if (b.type === 'image' && b.content?.image?.url) {
      allImages.push(b.content.image.url)
    } else if ((b.type === 'gallery' || b.type === 'carousel') && b.content?.images) {
      b.content.images.forEach((img: any) => {
        if (img.url) allImages.push(img.url)
      })
    }
  })

  const imageCount = allImages.length
  const previewImages = allImages.slice(0, 4) // Get up to 4 images for collage
  const CategoryIcon = getCategoryIcon(section.category.slug)
  
  // Generate section link - prefer username/slug format
  const sectionLink = `/${section.creator.username}/${slugify(section.title)}`

  return (
    <Link
      href={sectionLink}
      className="block group"
    >
      <div className="flex items-center gap-5 p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 hover:shadow-lg transition-all mobile-list-card">
        {/* Image Collage Preview */}
        <div className="w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mobile-list-collage">
          {previewImages.length === 1 ? (
            <img
              src={previewImages[0]}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : previewImages.length === 2 ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {previewImages.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ))}
            </div>
          ) : previewImages.length === 3 ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              <img
                src={previewImages[0]}
                alt=""
                className="col-span-2 h-1/2 w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <img
                src={previewImages[1]}
                alt=""
                className="h-1/2 w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <img
                src={previewImages[2]}
                alt=""
                className="h-1/2 w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : previewImages.length >= 4 ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {previewImages.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + Image Count */}
          <div className="flex items-baseline gap-3 mb-2">
            <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors truncate mobile-list-title">
              {section.title}
            </h3>
            {section.is_nsfw && <NSFWBadge size="sm" />}
            {imageCount > 0 && (
              <span className="text-sm font-medium text-gray-500 flex-shrink-0 mobile-list-meta">
                {imageCount} {imageCount === 1 ? 'image' : 'images'}
              </span>
            )}
          </div>
          
          {/* Category + Curator */}
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-2 mobile-list-meta">
            <span className="flex items-center gap-1.5 font-medium">
              <CategoryIcon className="w-4 h-4" />
              {section.category.name}
            </span>
            
            <span className="text-gray-600">·</span>
            
            <div className="flex items-center gap-2">
              {section.creator.avatar_url && (
                <img
                  src={section.creator.avatar_url}
                  alt={section.creator.username}
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span>
                by <span className="font-medium text-gray-300">{section.creator.display_name || section.creator.username}</span>
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mobile-list-meta">
            <span>
              {formatTimeAgo(section.published_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
