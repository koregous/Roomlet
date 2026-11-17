'use client'

import { Search } from 'lucide-react'
import { PublishedSection } from '@/shared/lib/types'
import SectionCard from './SectionCard'

interface Props {
  sections: PublishedSection[]
  isLoading?: boolean
}

export default function GalleryGrid({ sections, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 animate-pulse"
          >
            <div className="aspect-video bg-gray-800" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-800 rounded w-1/2" />
              <div className="h-3 bg-gray-800 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-xl font-semibold text-gray-300 mb-2">
          No sections found
        </h3>
        <p className="text-gray-500">
          Try adjusting your filters or check back later
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mobile-gallery-grid">
      {sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  )
}
